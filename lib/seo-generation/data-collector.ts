import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { sanitizeSearchTermForOr } from '@/lib/seo-generation/query-expander';
import {
  inferPrefecturesFromKeyword,
  respondentCampusEqValues,
} from '@/lib/seo-generation/keyword-region';

const MAX_OR_TERMS_REVIEWS = 20;
const MAX_OR_TERMS_ARTICLES = 15;

export interface CollectedReview {
  id: string;
  good_comment: string;
  bad_comment: string;
  overall_satisfaction: number;
  staff_rating: number | null;
  atmosphere_fit_rating: number | null;
  credit_rating: number | null;
  tuition_rating: number | null;
  enrollment_year: string | null;
  attendance_frequency: string | null;
  school_name: string;
  /** 公開サイトの学校ページ用（schools.slug） */
  school_slug: string | null;
}

export interface CollectedArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  school_name: string | null;
}

export interface CollectedSchoolInfo {
  id: string;
  name: string;
  intro: string | null;
  highlights: string[] | null;
  faq: Array<{ question: string; answer: string }> | null;
  ai_summary: string | null;
  review_tendency: { good_points?: string[]; improvement_points?: string[] } | null;
  review_count: number;
  overall_avg: number | null;
}

export interface CollectedData {
  reviews: CollectedReview[];
  articles: CollectedArticle[];
  schoolInfo: CollectedSchoolInfo | null;
}

function mergeUniqueSearchTerms(
  keyword: string,
  expandedTerms?: string[]
): string[] {
  const keywordParts = keyword
    .split(/[\s　]+/)
    .map((t) => sanitizeSearchTermForOr(t))
    .filter((t) => t.length >= 2);

  if (!expandedTerms?.length) {
    return keywordParts;
  }

  const expanded = expandedTerms
    .map((t) => sanitizeSearchTermForOr(t))
    .filter((t) => t.length >= 2);

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const t of [...keywordParts, ...expanded]) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(t);
    }
  }
  return merged.slice(0, MAX_OR_TERMS_REVIEWS);
}

function mapSurveyRowToReview(r: Record<string, unknown>): CollectedReview {
  const schools = r.schools as { name: string; slug?: string | null } | null;
  return {
    id: r.id as string,
    good_comment: r.good_comment as string,
    bad_comment: r.bad_comment as string,
    overall_satisfaction: r.overall_satisfaction as number,
    staff_rating: r.staff_rating as number | null,
    atmosphere_fit_rating: r.atmosphere_fit_rating as number | null,
    credit_rating: r.credit_rating as number | null,
    tuition_rating: r.tuition_rating as number | null,
    enrollment_year: r.enrollment_year as string | null,
    attendance_frequency: r.attendance_frequency as string | null,
    school_name: schools?.name || '',
    school_slug: schools?.slug ?? null,
  };
}

/** 学校の所在都道府県で口コミを拾い、地域キーワード記事の根拠の偏りを減らす */
async function fetchReviewsForPrefectures(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  prefs: string[],
  perPref: number
): Promise<CollectedReview[]> {
  const collected: CollectedReview[] = [];
  const ids = new Set<string>();

  for (const pref of prefs) {
    const { data: d1, error: e1 } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug, prefecture, prefectures)'
      )
      .eq('is_public', true)
      .eq('schools.prefecture', pref)
      .order('created_at', { ascending: false })
      .limit(perPref);

    if (e1) {
      console.error('[data-collector] regional reviews (prefecture):', e1.message);
    } else {
      for (const row of d1 || []) {
        const r = mapSurveyRowToReview(row as Record<string, unknown>);
        if (!ids.has(r.id)) {
          ids.add(r.id);
          collected.push(r);
        }
      }
    }

    const { data: d2, error: e2 } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug, prefecture, prefectures)'
      )
      .eq('is_public', true)
      .contains('schools.prefectures', [pref])
      .order('created_at', { ascending: false })
      .limit(perPref);

    if (e2) {
      console.error('[data-collector] regional reviews (prefectures[]):', e2.message);
    } else {
      for (const row of d2 || []) {
        const r = mapSurveyRowToReview(row as Record<string, unknown>);
        if (!ids.has(r.id)) {
          ids.add(r.id);
          collected.push(r);
        }
      }
    }
  }

  return collected;
}

/** アンケート「主に通っていたキャンパス都道府県」一致の回答を優先取得（地域キーワード記事の主根拠用） */
async function fetchReviewsByRespondentCampus(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  prefs: string[],
  totalCap: number
): Promise<CollectedReview[]> {
  const collected: CollectedReview[] = [];
  const ids = new Set<string>();
  const perPref = Math.max(
    14,
    Math.ceil((totalCap * 1.15) / Math.max(1, prefs.length))
  );

  for (const pref of prefs) {
    const values = respondentCampusEqValues(pref);
    const orClause = values
      .map((v) => `answers->>campus_prefecture.eq.${v}`)
      .join(',');

    const { data: dStr, error: e1 } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug)'
      )
      .eq('is_public', true)
      .or(orClause)
      .order('created_at', { ascending: false })
      .limit(perPref);

    if (e1) {
      console.error('[data-collector] respondent campus (string):', e1.message);
    } else {
      for (const row of dStr || []) {
        const r = mapSurveyRowToReview(row as Record<string, unknown>);
        if (!ids.has(r.id)) {
          ids.add(r.id);
          collected.push(r);
        }
      }
    }

    const { data: dArr, error: e2 } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug)'
      )
      .eq('is_public', true)
      .contains('answers', { campus_prefecture: [pref] })
      .order('created_at', { ascending: false })
      .limit(Math.ceil(perPref / 2));

    if (e2) {
      console.error('[data-collector] respondent campus (array):', e2.message);
    } else {
      for (const row of dArr || []) {
        const r = mapSurveyRowToReview(row as Record<string, unknown>);
        if (!ids.has(r.id)) {
          ids.add(r.id);
          collected.push(r);
        }
      }
    }
  }

  return collected.slice(0, totalCap);
}

export async function collectReviews(
  schoolId?: string,
  keyword?: string,
  limit = 30,
  expandedTerms?: string[]
): Promise<CollectedReview[]> {
  const supabase = createAdminSupabaseClient();

  if (schoolId) {
    const { data: schoolData } = await supabase
      .from('schools')
      .select('name, slug')
      .eq('id', schoolId)
      .single();

    const { data, error } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency'
      )
      .eq('school_id', schoolId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[data-collector] reviews error:', error);
      return [];
    }

    return (data || []).map((r) =>
      mapSurveyRowToReview({
        ...r,
        schools: {
          name: schoolData?.name || '',
          slug: schoolData?.slug ?? null,
        },
      } as Record<string, unknown>)
    );
  }

  if (keyword) {
    const searchTerms = mergeUniqueSearchTerms(keyword, expandedTerms);

    if (searchTerms.length === 0) {
      return collectRecentReviews(supabase, limit);
    }

    const conditions = searchTerms
      .map((t) => `good_comment.ilike.%${t}%,bad_comment.ilike.%${t}%`)
      .join(',');

    const { data, error } = await supabase
      .from('survey_responses')
      .select(
        'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug)'
      )
      .eq('is_public', true)
      .or(conditions)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[data-collector] keyword reviews error:', error);
      return collectRecentReviews(supabase, limit);
    }

    let reviews = (data || []).map((r: Record<string, unknown>) =>
      mapSurveyRowToReview(r)
    );

    const regionPrefs = inferPrefecturesFromKeyword(keyword);
    if (regionPrefs.length > 0) {
      const campusCap = Math.min(45, Math.ceil(limit * 0.72));
      const campusRows = await fetchReviewsByRespondentCampus(
        supabase,
        regionPrefs,
        campusCap
      );

      const schoolPrefCap = Math.min(16, Math.ceil(limit * 0.22));
      const perSchoolPref = Math.max(
        4,
        Math.ceil(schoolPrefCap / regionPrefs.length)
      );
      const schoolPrefRows = await fetchReviewsForPrefectures(
        supabase,
        regionPrefs,
        perSchoolPref
      );

      const idSeen = new Set<string>();
      const merged: CollectedReview[] = [];
      for (const r of campusRows) {
        if (!idSeen.has(r.id)) {
          idSeen.add(r.id);
          merged.push(r);
        }
      }
      for (const r of schoolPrefRows) {
        if (!idSeen.has(r.id)) {
          idSeen.add(r.id);
          merged.push(r);
        }
      }
      for (const r of reviews) {
        if (!idSeen.has(r.id)) {
          idSeen.add(r.id);
          merged.push(r);
        }
      }
      reviews = merged.slice(0, limit);
    }

    if (reviews.length < 20) {
      const recentReviews = await collectRecentReviews(supabase, limit - reviews.length);
      const existingIds = new Set(reviews.map(r => r.id));
      for (const r of recentReviews) {
        if (!existingIds.has(r.id)) {
          reviews.push(r);
        }
      }
    }

    return reviews;
  }

  return collectRecentReviews(supabase, limit);
}

async function collectRecentReviews(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  limit: number
): Promise<CollectedReview[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select(
      'id, good_comment, bad_comment, overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating, enrollment_year, attendance_frequency, schools!inner(name, slug)'
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((r: Record<string, unknown>) => mapSurveyRowToReview(r));
}

export async function collectArticles(
  schoolId?: string,
  keyword?: string,
  limit = 10,
  expandedTerms?: string[]
): Promise<CollectedArticle[]> {
  const supabase = createAdminSupabaseClient();

  if (schoolId) {
    const { data, error } = await supabase
      .from('article_schools')
      .select(
        'articles!inner(id, title, content, category, slug)'
      )
      .eq('school_id', schoolId)
      .limit(limit);

    if (error) {
      console.error('[data-collector] school articles error:', error);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => {
      const a = row.articles as {
        id: string;
        title: string;
        content: string;
        category: string;
        slug: string;
      };
      return {
        id: a.id,
        title: a.title,
        content: (a.content || '').slice(0, 3000),
        category: a.category,
        slug: a.slug,
        school_name: null,
      };
    });
  }

  if (keyword) {
    const searchTerms = mergeUniqueSearchTerms(keyword, expandedTerms).slice(
      0,
      MAX_OR_TERMS_ARTICLES
    );

    if (searchTerms.length === 0) {
      return [];
    }

    const conditions = searchTerms
      .map((t) => `title.ilike.%${t}%,content.ilike.%${t}%`)
      .join(',');

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, content, category, slug')
      .or(conditions)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[data-collector] keyword articles error:', error);
      return [];
    }

    return (data || []).map((a) => ({
      ...a,
      content: (a.content || '').slice(0, 3000),
      school_name: null,
    }));
  }

  return [];
}

export async function collectSchoolInfo(
  schoolId: string
): Promise<CollectedSchoolInfo | null> {
  const supabase = createAdminSupabaseClient();

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, intro, highlights, faq')
    .eq('id', schoolId)
    .single();

  if (schoolError || !school) return null;

  const { data: aiSummaries } = await supabase
    .from('school_ai_summaries')
    .select('summary_text, kind')
    .eq('school_id', schoolId)
    .in('kind', ['overall', 'review_tendency']);

  let aiSummary: string | null = null;
  let reviewTendency: { good_points?: string[]; improvement_points?: string[] } | null =
    null;

  for (const s of aiSummaries || []) {
    if (s.kind === 'overall') aiSummary = s.summary_text;
    if (s.kind === 'review_tendency') {
      try {
        reviewTendency = JSON.parse(s.summary_text);
      } catch {
        /* ignore */
      }
    }
  }

  const { count } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('is_public', true);

  const { data: agg } = await supabase
    .from('aggregates')
    .select('overall_avg')
    .eq('school_id', schoolId)
    .single();

  return {
    id: school.id,
    name: school.name,
    intro: school.intro,
    highlights: school.highlights,
    faq: school.faq,
    ai_summary: aiSummary,
    review_tendency: reviewTendency,
    review_count: count || 0,
    overall_avg: agg?.overall_avg || null,
  };
}

/** ナレッジ記事では口コミ根拠を厚くし、特集記事の根拠カード数は抑える */
const ARTICLE_EVIDENCE_LIMIT_FOR_KEYWORD = 4;

export async function collectAllData(
  schoolId?: string,
  keyword?: string,
  maxReviews = 45,
  expandedTerms?: string[]
): Promise<CollectedData> {
  const articleLimit = schoolId ? 10 : ARTICLE_EVIDENCE_LIMIT_FOR_KEYWORD;
  const [reviews, articles, schoolInfo] = await Promise.all([
    collectReviews(schoolId, keyword, maxReviews, expandedTerms),
    collectArticles(schoolId, keyword, articleLimit, expandedTerms),
    schoolId ? collectSchoolInfo(schoolId) : Promise.resolve(null),
  ]);

  return { reviews, articles, schoolInfo };
}
