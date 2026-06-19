import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appPath } from '@/lib/base-path';
import { REVIEW_REASON_GROUPS, type ReviewReasonGroupKey } from '@/lib/reviews/reason-groups';
import {
  CHAT_EMBEDDING_DIMENSIONS,
  CHAT_EMBEDDING_MODEL,
  getChatOpenAIClient,
} from '@/lib/chat/config';
import type { RagDocumentUpsert, RagReasonGroup, RagSourceType } from '@/lib/rag/types';

type AnyRecord = Record<string, unknown>;

type RawRagDocument = Omit<RagDocumentUpsert, 'embedding'>;

const EMBEDDING_BATCH_SIZE = 64;
const UPSERT_BATCH_SIZE = 50;

function getServiceSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((v) => `${v}`).join(',')}]`;
}

function splitTextByLength(text: string, maxLength = 900): string[] {
  const cleaned = normalizeContent(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxLength) return [cleaned];

  const paragraphs = cleaned.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = paragraph;
    if (current.length > maxLength) {
      for (let i = 0; i < current.length; i += maxLength) {
        chunks.push(current.slice(i, i + maxLength));
      }
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk) => normalizeContent(chunk)).filter(Boolean);
}

function flattenSchoolJoin(value: unknown): AnyRecord | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as AnyRecord) ?? null;
  if (typeof value === 'object') return value as AnyRecord;
  return null;
}

function extractReasons(row: AnyRecord): string[] {
  const reasonsColumn = row.reason_for_choosing;
  if (Array.isArray(reasonsColumn)) {
    return reasonsColumn.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  }
  const answers = (row.answers ?? {}) as AnyRecord;
  const reasonsInAnswers = answers.reason_for_choosing;
  if (Array.isArray(reasonsInAnswers)) {
    return reasonsInAnswers.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  }
  return [];
}

function reasonsToGroups(reasons: string[]): RagReasonGroup[] {
  const matched = new Set<RagReasonGroup>();
  for (const reason of reasons) {
    for (const group of REVIEW_REASON_GROUPS) {
      if (group.reasons.includes(reason)) {
        matched.add(group.key as ReviewReasonGroupKey);
      }
    }
  }
  return Array.from(matched) as RagReasonGroup[];
}

function pickPrefecture(row: AnyRecord, school: AnyRecord | null): string | null {
  const answers = (row.answers ?? {}) as AnyRecord;
  const campusPref = answers.campus_prefecture;
  if (typeof campusPref === 'string' && campusPref.trim()) return campusPref.trim();
  if (Array.isArray(campusPref)) {
    const first = campusPref.find((v) => typeof v === 'string' && v.trim() !== '');
    if (typeof first === 'string') return first.trim();
  }
  return trimOrNull(school?.prefecture) ?? trimOrNull(row.prefecture);
}

function extractFaqItems(faq: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(faq)) return [];
  const out: Array<{ question: string; answer: string }> = [];
  for (const raw of faq) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as AnyRecord;
    const question =
      trimOrNull(item.question) ??
      trimOrNull(item.q) ??
      trimOrNull(item.title) ??
      trimOrNull(item.label);
    const answer = trimOrNull(item.answer) ?? trimOrNull(item.a) ?? trimOrNull(item.body);
    if (question && answer) out.push({ question, answer });
  }
  return out;
}

function plainArticleText(content: string | null): string {
  if (!content) return '';
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_`>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReviewDoc(row: AnyRecord): RawRagDocument | null {
  const school = flattenSchoolJoin(row.schools);
  const schoolId = trimOrNull(row.school_id);
  const reviewId = trimOrNull(row.id);
  if (!reviewId) return null;

  const schoolName = trimOrNull(school?.name) ?? trimOrNull(row.school_name) ?? '学校名不明';
  const reasons = extractReasons(row);
  const reasonGroups = reasonsToGroups(reasons);
  const answers = (row.answers ?? {}) as AnyRecord;
  const attendance = trimOrNull(answers.attendance_frequency) ?? trimOrNull(row.attendance_frequency);
  const supportRating = trimOrNull(answers.support_rating);
  const flexibilityRating = trimOrNull(answers.flexibility_rating);
  const goodComment = trimOrNull(row.good_comment) ?? '（記載なし）';
  const badComment = trimOrNull(row.bad_comment) ?? '（記載なし）';
  const role = trimOrNull(row.respondent_role) ?? '不明';
  const overall = row.overall_satisfaction != null ? `${row.overall_satisfaction}` : '不明';
  const status = trimOrNull(row.status) ?? '不明';
  const prefecture = pickPrefecture(row, school);

  const content = normalizeContent(
    [
      `学校: ${schoolName}`,
      `立場: ${role}`,
      `現在の状況: ${status}`,
      `総合満足度: ${overall}/5`,
      reasons.length > 0 ? `通信制を選んだ理由: ${reasons.join(' / ')}` : null,
      attendance ? `主な通学頻度: ${attendance}` : null,
      supportRating ? `心身の波へのサポート評価: ${supportRating}/5` : null,
      flexibilityRating ? `学びの柔軟さ評価: ${flexibilityRating}/5` : null,
      `良かった点: ${goodComment}`,
      `改善してほしい点: ${badComment}`,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n')
  );

  return {
    source_type: 'review',
    source_id: reviewId,
    chunk_key: 'main',
    school_id: schoolId,
    school_name: schoolName,
    prefecture,
    reason_groups: reasonGroups,
    title: `${schoolName} の口コミ`,
    content,
    metadata: {
      respondent_role: role,
      reasons,
      attendance_frequency: attendance,
      support_rating: supportRating,
      flexibility_rating: flexibilityRating,
      overall_satisfaction: overall,
      created_at: row.created_at ?? null,
    },
    source_url: appPath(`/reviews/${encodeURIComponent(reviewId)}`),
    is_public: true,
    content_hash: hashContent(content),
  };
}

function buildSchoolDocs(row: AnyRecord): RawRagDocument[] {
  const schoolId = trimOrNull(row.id);
  const schoolName = trimOrNull(row.name);
  if (!schoolId || !schoolName) return [];

  const schoolSlug = trimOrNull(row.slug);
  const prefecture = trimOrNull(row.prefecture);
  const intro = trimOrNull(row.intro);
  const highlights = Array.isArray(row.highlights)
    ? row.highlights.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    : [];
  const faqItems = extractFaqItems(row.faq);

  const schoolUrl = schoolSlug
    ? appPath(`/schools/${encodeURIComponent(schoolSlug)}`)
    : appPath(`/schools/id/${encodeURIComponent(schoolId)}`);

  const baseContent = normalizeContent(
    [
      `学校名: ${schoolName}`,
      prefecture ? `主な所在地: ${prefecture}` : null,
      intro ? `学校紹介: ${intro}` : null,
      highlights.length > 0 ? `特徴: ${highlights.join(' / ')}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n')
  );

  const docs: RawRagDocument[] = [
    {
      source_type: 'school',
      source_id: schoolId,
      chunk_key: 'main',
      school_id: schoolId,
      school_name: schoolName,
      prefecture,
      reason_groups: [],
      title: `${schoolName} の基本情報`,
      content: baseContent,
      metadata: {
        institution_type: trimOrNull(row.institution_type),
        official_url: trimOrNull(row.official_url),
      },
      source_url: schoolUrl,
      is_public: true,
      content_hash: hashContent(baseContent),
    },
  ];

  faqItems.forEach((faq, index) => {
    const content = normalizeContent(`質問: ${faq.question}\n回答: ${faq.answer}`);
    docs.push({
      source_type: 'faq',
      source_id: schoolId,
      chunk_key: `faq-${index + 1}`,
      school_id: schoolId,
      school_name: schoolName,
      prefecture,
      reason_groups: [],
      title: `${schoolName} のFAQ`,
      content,
      metadata: {
        question: faq.question,
      },
      source_url: schoolUrl,
      is_public: true,
      content_hash: hashContent(content),
    });
  });

  return docs;
}

function buildSchoolSummaryDoc(row: AnyRecord): RawRagDocument | null {
  const summaryId = trimOrNull(row.id);
  const schoolId = trimOrNull(row.school_id);
  const summaryText = trimOrNull(row.summary_text);
  if (!summaryId || !schoolId || !summaryText) return null;

  const school = flattenSchoolJoin(row.schools);
  const schoolName = trimOrNull(school?.name) ?? '学校名不明';
  const prefecture = trimOrNull(school?.prefecture);
  const slug = trimOrNull(school?.slug);
  const kind = trimOrNull(row.kind) ?? 'summary';
  const topic = trimOrNull(row.topic);

  const content = normalizeContent(
    [`学校: ${schoolName}`, `種別: ${kind}${topic ? ` / ${topic}` : ''}`, summaryText].join('\n')
  );

  return {
    source_type: kind === 'seo' ? 'seo_section' : 'school_summary',
    source_id: summaryId,
    chunk_key: topic ? `${kind}-${topic}` : `${kind}-main`,
    school_id: schoolId,
    school_name: schoolName,
    prefecture,
    reason_groups: [],
    title: `${schoolName} のAI要約`,
    content,
    metadata: {
      kind,
      topic,
    },
    source_url: slug
      ? appPath(`/schools/${encodeURIComponent(slug)}`)
      : appPath(`/schools/id/${encodeURIComponent(schoolId)}`),
    is_public: true,
    content_hash: hashContent(content),
  };
}

function buildArticleDocs(row: AnyRecord): RawRagDocument[] {
  const articleId = trimOrNull(row.id);
  const title = trimOrNull(row.title);
  const slug = trimOrNull(row.slug);
  if (!articleId || !title || !slug) return [];

  const excerpt = trimOrNull(row.excerpt);
  const contentText = plainArticleText(trimOrNull(row.content));
  const merged = normalizeContent(
    [title, excerpt ? `概要: ${excerpt}` : null, contentText].filter((v): v is string => Boolean(v)).join('\n\n')
  );
  const chunks = splitTextByLength(merged, 1200);

  return chunks.map((chunk, index) => ({
    source_type: 'article',
    source_id: articleId,
    chunk_key: `part-${index + 1}`,
    school_id: null,
    school_name: null,
    prefecture: null,
    reason_groups: [],
    title,
    content: chunk,
    metadata: {
      category: trimOrNull(row.category),
      published_at: row.published_at ?? null,
      chunk_index: index + 1,
      chunk_total: chunks.length,
    },
    source_url: appPath(`/features/${encodeURIComponent(slug)}`),
    is_public: true,
    content_hash: hashContent(chunk),
  }));
}

function buildTuitionDoc(row: AnyRecord): RawRagDocument | null {
  const schoolId = trimOrNull(row.school_id);
  const school = flattenSchoolJoin(row.schools);
  if (!schoolId || !school) return null;
  const schoolName = trimOrNull(school.name) ?? '学校名不明';
  const slug = trimOrNull(school.slug);
  const prefecture = trimOrNull(school.prefecture);

  const plans = Array.isArray(row.plans) ? row.plans : [];
  const planLines = plans
    .map((plan) => {
      if (!plan || typeof plan !== 'object') return null;
      const p = plan as AnyRecord;
      const label = trimOrNull(p.label) ?? trimOrNull(p.course_name);
      const attendance = trimOrNull(p.attendance);
      const firstYearMin = p.first_year_min != null ? `${p.first_year_min}` : null;
      const firstYearMax = p.first_year_max != null ? `${p.first_year_max}` : null;
      const range =
        firstYearMin || firstYearMax
          ? `初年度目安: ${firstYearMin ?? '?'}〜${firstYearMax ?? '?'}円`
          : null;
      const note = trimOrNull(p.note);
      return [label, attendance, range, note].filter((v): v is string => Boolean(v)).join(' / ');
    })
    .filter((line): line is string => Boolean(line));

  const displayMode = trimOrNull(row.display_mode) ?? 'amounts';
  const content = normalizeContent(
    [
      `学校: ${schoolName}`,
      `学費表示モード: ${displayMode}`,
      row.first_year_min != null || row.first_year_max != null
        ? `初年度目安: ${row.first_year_min ?? '?'}〜${row.first_year_max ?? '?'}円`
        : null,
      row.monthly_min != null || row.monthly_max != null
        ? `月額目安: ${row.monthly_min ?? '?'}〜${row.monthly_max ?? '?'}円`
        : null,
      trimOrNull(row.support_fund_note) ? `就学支援金注記: ${trimOrNull(row.support_fund_note)}` : null,
      trimOrNull(row.public_note) ? `注記: ${trimOrNull(row.public_note)}` : null,
      planLines.length > 0 ? `コース別情報: ${planLines.join(' / ')}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n')
  );

  return {
    source_type: 'tuition',
    source_id: schoolId,
    chunk_key: 'main',
    school_id: schoolId,
    school_name: schoolName,
    prefecture,
    reason_groups: [],
    title: `${schoolName} の学費目安`,
    content,
    metadata: {
      display_mode: displayMode,
      has_plans: planLines.length > 0,
    },
    source_url: slug
      ? appPath(`/schools/${encodeURIComponent(slug)}`)
      : appPath(`/schools/id/${encodeURIComponent(schoolId)}`),
    is_public: true,
    content_hash: hashContent(content),
  };
}

function buildCourseDoc(row: AnyRecord): RawRagDocument | null {
  const schoolId = trimOrNull(row.school_id);
  const school = flattenSchoolJoin(row.schools);
  if (!schoolId || !school) return null;
  const schoolName = trimOrNull(school.name) ?? '学校名不明';
  const slug = trimOrNull(school.slug);
  const prefecture = trimOrNull(school.prefecture);

  const courses = Array.isArray(row.courses) ? row.courses : [];
  const courseLines = courses
    .map((course) => {
      if (!course || typeof course !== 'object') return null;
      const c = course as AnyRecord;
      const name = trimOrNull(c.name);
      if (!name) return null;
      const attendance = trimOrNull(c.attendance);
      const note = trimOrNull(c.note);
      return [name, attendance, note].filter((v): v is string => Boolean(v)).join(' / ');
    })
    .filter((line): line is string => Boolean(line));

  if (courseLines.length === 0) return null;

  const content = normalizeContent(
    [
      `学校: ${schoolName}`,
      `コース情報: ${courseLines.join(' / ')}`,
      trimOrNull(row.public_note) ? `注記: ${trimOrNull(row.public_note)}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n')
  );

  return {
    source_type: 'course',
    source_id: schoolId,
    chunk_key: 'main',
    school_id: schoolId,
    school_name: schoolName,
    prefecture,
    reason_groups: [],
    title: `${schoolName} のコース情報`,
    content,
    metadata: {
      course_count: courseLines.length,
    },
    source_url: slug
      ? appPath(`/schools/${encodeURIComponent(slug)}`)
      : appPath(`/schools/id/${encodeURIComponent(schoolId)}`),
    is_public: true,
    content_hash: hashContent(content),
  };
}

async function embedDocuments(docs: RawRagDocument[]): Promise<RagDocumentUpsert[]> {
  if (docs.length === 0) return [];
  const openai = getChatOpenAIClient();
  const out: RagDocumentUpsert[] = [];

  for (let i = 0; i < docs.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = docs.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: CHAT_EMBEDDING_MODEL,
      dimensions: CHAT_EMBEDDING_DIMENSIONS,
      input: batch.map((doc) => doc.content),
    });

    response.data.forEach((item, index) => {
      const doc = batch[index];
      if (!doc) return;
      out.push({
        ...doc,
        embedding: toVectorLiteral(item.embedding),
      });
    });
  }

  return out;
}

async function upsertRagDocuments(supabase: SupabaseClient, docs: RagDocumentUpsert[]): Promise<void> {
  for (let i = 0; i < docs.length; i += UPSERT_BATCH_SIZE) {
    const batch = docs.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('rag_documents')
      .upsert(batch as unknown as AnyRecord[], { onConflict: 'source_type,source_id,chunk_key' });
    if (error) throw error;
  }
}

async function deleteBySourceTypes(supabase: SupabaseClient, sourceTypes: RagSourceType[]): Promise<void> {
  if (sourceTypes.length === 0) return;
  const { error } = await supabase.from('rag_documents').delete().in('source_type', sourceTypes);
  if (error) throw error;
}

async function deleteBySourceIds(
  supabase: SupabaseClient,
  sourceType: RagSourceType,
  sourceIds: string[]
): Promise<void> {
  if (sourceIds.length === 0) return;
  const { error } = await supabase
    .from('rag_documents')
    .delete()
    .eq('source_type', sourceType)
    .in('source_id', sourceIds);
  if (error) throw error;
}

async function deleteBySchoolIds(
  supabase: SupabaseClient,
  sourceTypes: RagSourceType[],
  schoolIds: string[]
): Promise<void> {
  if (sourceTypes.length === 0 || schoolIds.length === 0) return;
  const { error } = await supabase
    .from('rag_documents')
    .delete()
    .in('source_type', sourceTypes)
    .in('school_id', schoolIds);
  if (error) throw error;
}

async function fetchPublicReviews(
  supabase: SupabaseClient,
  reviewIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('survey_responses')
    .select(
      'id, school_id, school_name, respondent_role, status, overall_satisfaction, good_comment, bad_comment, reason_for_choosing, answers, created_at, is_public, schools(id,name,slug,prefecture,is_public,status)'
    )
    .eq('is_public', true);
  if (reviewIds && reviewIds.length > 0) {
    query = query.in('id', reviewIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function fetchPublicSchools(
  supabase: SupabaseClient,
  schoolIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('schools')
    .select('id,name,prefecture,slug,intro,highlights,faq,institution_type,official_url,is_public,status')
    .eq('is_public', true)
    .eq('status', 'active');
  if (schoolIds && schoolIds.length > 0) {
    query = query.in('id', schoolIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function fetchPublishedSchoolSummaries(
  supabase: SupabaseClient,
  schoolIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('school_ai_summaries')
    .select('id, school_id, kind, topic, summary_text, status, schools(id,name,slug,prefecture,is_public,status)')
    .eq('status', 'published');
  if (schoolIds && schoolIds.length > 0) {
    query = query.in('school_id', schoolIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function fetchPublishedTuition(
  supabase: SupabaseClient,
  schoolIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('school_tuition_estimates')
    .select(
      'school_id, display_mode, first_year_min, first_year_max, monthly_min, monthly_max, plans, support_fund_note, public_note, status, schools(id,name,slug,prefecture,is_public,status)'
    )
    .eq('status', 'published');
  if (schoolIds && schoolIds.length > 0) {
    query = query.in('school_id', schoolIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function fetchPublishedCourses(
  supabase: SupabaseClient,
  schoolIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('school_course_listings')
    .select('school_id, courses, public_note, status, schools(id,name,slug,prefecture,is_public,status)')
    .eq('status', 'published');
  if (schoolIds && schoolIds.length > 0) {
    query = query.in('school_id', schoolIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function fetchPublicArticles(
  supabase: SupabaseClient,
  articleIds?: string[]
): Promise<AnyRecord[]> {
  let query = supabase
    .from('articles')
    .select('id,title,slug,excerpt,content,category,published_at,is_public')
    .eq('is_public', true);
  if (articleIds && articleIds.length > 0) {
    query = query.in('id', articleIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnyRecord[];
}

async function rebuildAndUpsert(docs: RawRagDocument[]): Promise<number> {
  if (docs.length === 0) return 0;
  const supabase = getServiceSupabaseClient();
  const embedded = await embedDocuments(docs);
  await upsertRagDocuments(supabase, embedded);
  return embedded.length;
}

export async function syncRagForReviewIds(reviewIds: string[]): Promise<number> {
  if (reviewIds.length === 0) return 0;
  const supabase = getServiceSupabaseClient();
  await deleteBySourceIds(supabase, 'review', reviewIds);
  const rows = await fetchPublicReviews(supabase, reviewIds);
  const docs = rows.map(buildReviewDoc).filter((doc): doc is RawRagDocument => doc !== null);
  return rebuildAndUpsert(docs);
}

export async function syncRagForSchoolIds(schoolIds: string[]): Promise<number> {
  if (schoolIds.length === 0) return 0;
  const supabase = getServiceSupabaseClient();
  await deleteBySchoolIds(
    supabase,
    ['school', 'faq', 'school_summary', 'seo_section', 'tuition', 'course'],
    schoolIds
  );

  const [schools, summaries, tuitions, courses] = await Promise.all([
    fetchPublicSchools(supabase, schoolIds),
    fetchPublishedSchoolSummaries(supabase, schoolIds),
    fetchPublishedTuition(supabase, schoolIds),
    fetchPublishedCourses(supabase, schoolIds),
  ]);

  const docs: RawRagDocument[] = [];
  schools.forEach((row) => docs.push(...buildSchoolDocs(row)));
  summaries.forEach((row) => {
    const doc = buildSchoolSummaryDoc(row);
    if (doc) docs.push(doc);
  });
  tuitions.forEach((row) => {
    const doc = buildTuitionDoc(row);
    if (doc) docs.push(doc);
  });
  courses.forEach((row) => {
    const doc = buildCourseDoc(row);
    if (doc) docs.push(doc);
  });

  return rebuildAndUpsert(docs);
}

export async function syncRagForArticleIds(articleIds: string[]): Promise<number> {
  if (articleIds.length === 0) return 0;
  const supabase = getServiceSupabaseClient();
  await deleteBySourceIds(supabase, 'article', articleIds);
  const rows = await fetchPublicArticles(supabase, articleIds);
  const docs: RawRagDocument[] = [];
  rows.forEach((row) => docs.push(...buildArticleDocs(row)));
  return rebuildAndUpsert(docs);
}

export async function removeRagForArticleIds(articleIds: string[]): Promise<void> {
  if (articleIds.length === 0) return;
  const supabase = getServiceSupabaseClient();
  await deleteBySourceIds(supabase, 'article', articleIds);
}

export async function syncRagForAllPublicContent(): Promise<{
  total: number;
  counts: Record<RagSourceType, number>;
}> {
  const supabase = getServiceSupabaseClient();
  await deleteBySourceTypes(supabase, [
    'review',
    'school',
    'school_summary',
    'article',
    'tuition',
    'course',
    'faq',
    'seo_section',
  ]);

  const [reviews, schools, summaries, articles, tuitions, courses] = await Promise.all([
    fetchPublicReviews(supabase),
    fetchPublicSchools(supabase),
    fetchPublishedSchoolSummaries(supabase),
    fetchPublicArticles(supabase),
    fetchPublishedTuition(supabase),
    fetchPublishedCourses(supabase),
  ]);

  const docs: RawRagDocument[] = [];
  reviews.forEach((row) => {
    const doc = buildReviewDoc(row);
    if (doc) docs.push(doc);
  });
  schools.forEach((row) => docs.push(...buildSchoolDocs(row)));
  summaries.forEach((row) => {
    const doc = buildSchoolSummaryDoc(row);
    if (doc) docs.push(doc);
  });
  articles.forEach((row) => docs.push(...buildArticleDocs(row)));
  tuitions.forEach((row) => {
    const doc = buildTuitionDoc(row);
    if (doc) docs.push(doc);
  });
  courses.forEach((row) => {
    const doc = buildCourseDoc(row);
    if (doc) docs.push(doc);
  });

  const embedded = await embedDocuments(docs);
  await upsertRagDocuments(supabase, embedded);

  const counts: Record<RagSourceType, number> = {
    review: 0,
    school: 0,
    school_summary: 0,
    article: 0,
    tuition: 0,
    course: 0,
    faq: 0,
    seo_section: 0,
  };
  for (const doc of embedded) {
    counts[doc.source_type] += 1;
  }

  return {
    total: embedded.length,
    counts,
  };
}
