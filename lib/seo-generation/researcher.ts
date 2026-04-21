import { callLLM, resolveModel } from './llm-client';
import {
  collectAllData,
  type CollectedReview,
  type CollectedArticle,
  type CollectedSchoolInfo,
} from './data-collector';
import { expandKeywordToSearchTerms } from './query-expander';
import { inferPrefecturesFromKeyword } from '@/lib/seo-generation/keyword-region';
import { BASE_PATH } from '@/lib/base-path';
import type { SeoDraftEvidence, EvidenceKind, ConfidenceLevel } from './types';

interface ResearcherInput {
  draftId: string;
  keyword: string;
  draftType: 'knowledge' | 'school';
  schoolId?: string;
  maxReviews?: number;
}

interface ResearcherOutput {
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

function formatReviewsForResearch(reviews: CollectedReview[]): string {
  return reviews
    .slice(0, 45)
    .map(
      (r, i) =>
        `【口コミ${i + 1}】${r.school_name} (${r.enrollment_year || '不明'})${r.school_slug ? ` | school_slug: ${r.school_slug}` : ''}
総合満足度: ${r.overall_satisfaction}/5 | 先生: ${r.staff_rating || '-'}/5 | 雰囲気: ${r.atmosphere_fit_rating || '-'}/5
通学頻度: ${r.attendance_frequency || '不明'}
良い点: ${r.good_comment || ''}
改善点: ${r.bad_comment || ''}`
    )
    .join('\n\n');
}

function formatArticlesForResearch(articles: CollectedArticle[]): string {
  return articles
    .slice(0, 4)
    .map(
      (a) =>
        `【記事】タイトル: ${a.title} | slug: ${a.slug} | カテゴリ: ${a.category}
${(a.content || '').slice(0, 2500)}`
    )
    .join('\n\n---\n\n');
}

function findArticleBySourceTitle(
  articles: CollectedArticle[],
  title: string | undefined
): CollectedArticle | undefined {
  if (!title?.trim()) return undefined;
  const raw = title.trim();
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const nRaw = norm(raw);
  return (
    articles.find((x) => x.title === raw) ||
    articles.find((x) => norm(x.title) === nRaw) ||
    articles.find(
      (x) =>
        nRaw.includes(norm(x.title)) ||
        norm(x.title).includes(nRaw)
    )
  );
}

function findReviewRowByExcerpt(
  reviews: CollectedReview[],
  excerpt: string | undefined
): CollectedReview | undefined {
  if (!excerpt?.trim()) return undefined;
  const needle = excerpt.trim().slice(0, Math.min(24, excerpt.length));
  return reviews.find(
    (r) =>
      (r.good_comment && r.good_comment.includes(needle)) ||
      (r.bad_comment && r.bad_comment.includes(needle))
  );
}

/** LLMが同一校の excerpt カードを増やしても、根拠は各校最大2枚に抑える */
function limitReviewEvidenceCardsPerSchool<
  T extends {
    excerpt?: string;
    school_name?: string;
  }
>(cards: T[], reviews: CollectedReview[]): T[] {
  const excerptCountBySchool = new Map<string, number>();
  const out: T[] = [];
  for (const card of cards) {
    const schoolNameTrimmed = card.school_name?.trim();
    const byExcerpt = findReviewRowByExcerpt(reviews, card.excerpt);
    const byName = schoolNameTrimmed
      ? reviews.find((r) => r.school_name === schoolNameTrimmed)
      : undefined;
    const row = byExcerpt || byName;
    const schoolKey = (row?.school_name || schoolNameTrimmed || '').trim();

    if (card.excerpt && schoolKey.length > 0) {
      const n = excerptCountBySchool.get(schoolKey) || 0;
      if (n >= 2) continue;
      excerptCountBySchool.set(schoolKey, n + 1);
    }
    out.push(card);
  }
  return out;
}

function formatSchoolInfoForResearch(info: CollectedSchoolInfo): string {
  const parts: string[] = [`学校名: ${info.name}`];
  if (info.intro) parts.push(`紹介文: ${info.intro}`);
  if (info.highlights?.length)
    parts.push(`特長: ${info.highlights.join('、')}`);
  if (info.ai_summary) parts.push(`AI要約: ${info.ai_summary.slice(0, 500)}`);
  if (info.review_tendency) {
    if (info.review_tendency.good_points?.length)
      parts.push(`良い点: ${info.review_tendency.good_points.join(' / ')}`);
    if (info.review_tendency.improvement_points?.length)
      parts.push(
        `改善点: ${info.review_tendency.improvement_points.join(' / ')}`
      );
  }
  parts.push(`口コミ件数: ${info.review_count}件`);
  if (info.overall_avg)
    parts.push(`総合満足度平均: ${info.overall_avg.toFixed(1)}/5`);
  return parts.join('\n');
}

export async function runResearcher(
  input: ResearcherInput
): Promise<ResearcherOutput> {
  const { provider, model } = resolveModel(
    'SEO_RESEARCHER_MODEL',
    process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4-20250514' : 'gpt-5.4',
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'
  );

  let totalTokens = { prompt: 0, completion: 0, total: 0 };

  /** ナレッジ記事のみ: キーワードを意味関連語に展開して口コミの部分一致検索を強化 */
  let expandedTerms: string[] | undefined;
  if (!input.schoolId && input.keyword.trim()) {
    try {
      const expanded = await expandKeywordToSearchTerms(input.keyword);
      if (expanded.terms.length > 0) {
        expandedTerms = expanded.terms;
      }
      totalTokens.prompt += expanded.tokensUsed.prompt;
      totalTokens.completion += expanded.tokensUsed.completion;
      totalTokens.total += expanded.tokensUsed.total;
    } catch (err) {
      console.error('[researcher] expandKeywordToSearchTerms failed:', err);
    }
  }

  const data = await collectAllData(
    input.schoolId,
    input.keyword,
    input.maxReviews ?? 45,
    expandedTerms
  );

  const evidence: Omit<
    SeoDraftEvidence,
    'id' | 'draft_id' | 'retrieved_at'
  >[] = [];

  if (data.reviews.length > 0) {
    const reviewsText = formatReviewsForResearch(data.reviews);

    const regionNote =
      inferPrefecturesFromKeyword(input.keyword).length > 0
        ? `\n※本テーマは地域を含みます。**キャンパス都道府県がその地域の回答**の excerpt を他より優先してカードに使ってください（学校本部の所在地だけのブロックより、通学実態の声を優先）。\n`
        : '';

    const response = await callLLM({
      provider,
      model,
      systemPrompt:
        '通信制高校の口コミ分析専門家です。当サイトのアンケート回答が記事の主役になるよう、口コミを論点別に厚く整理し、JSON配列で出力してください。',
      userPrompt: `以下の口コミデータを分析し、記事テーマ「${input.keyword}」に関連する論点別の要約カードをJSON配列で出力してください。

※各【口コミ】の1行目に学校名があります。excerptを採る際はそのブロックの学校名をschool_nameに必ず対応させてください。
${regionNote}
口コミデータ:
${reviewsText}

出力形式（JSON配列のみ出力）:
[
  {
    "title": "論点タイトル（例: 学費の納得感）",
    "summary": "この論点の傾向を2-3文で要約",
    "excerpt": "代表的な口コミの抜粋（原文そのまま50-150字）",
    "school_name": "上記excerptが採られた口コミの学校名。【口コミ】行頭に記載の学校名を一字一句そのまま転記すること",
    "confidence": "high/medium/low"
  }
]

ルール:
- **8-12個**のカードに整理（口コミを記事の主根拠にするため多めに）
- 各カードは異なる論点をカバー
- **学校の偏り禁止**: 口コミデータ内に5校以上の学校名がある場合、カードの**半数以上は異なる学校名**のexcerptにすること。**同一高校の excerpt 付きカードは最大2（厳守）**。全校が2校分しかなくても同一校に3枚目を作らず要約で統合する。同一高校の長文を複数カードに分割しない
- 傾向として表現（断定は避ける）
- excerptは必ず口コミの原文から50-150字を正確に抜粋すること。要約や言い換えは不可
- school_nameは必須。該当する【口コミ】ブロックの学校名と一致させること（読者がどの高校の声か分かるようにする）
- 各カードには必ず具体的な口コミの原文抜粋を含めること（最低30文字）
- 数値データ（平均満足度、件数）があれば要約に含めること
- ポジティブとネガティブの両面をバランスよくカバーすること`,
      temperature: 0.3,
      maxTokens: 2000,
    });

    totalTokens.prompt += response.tokensUsed.prompt;
    totalTokens.completion += response.tokensUsed.completion;
    totalTokens.total += response.tokensUsed.total;

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      const cardsRaw = JSON.parse(jsonMatch ? jsonMatch[0] : response.content) as Array<{
        title: string;
        summary: string;
        excerpt?: string;
        school_name?: string;
        confidence?: string;
      }>;
      const cards = limitReviewEvidenceCardsPerSchool(cardsRaw, data.reviews);

      for (const card of cards.slice(0, 12)) {
        const byExcerpt = findReviewRowByExcerpt(data.reviews, card.excerpt);
        const schoolNameTrimmed = card.school_name?.trim();
        const byName = schoolNameTrimmed
          ? data.reviews.find((r) => r.school_name === schoolNameTrimmed)
          : undefined;
        const row = byExcerpt || byName;

        const attribution =
          row?.school_name || card.school_name?.trim() || undefined;
        const schoolPageUrl =
          row?.school_slug && row.school_slug.length > 0
            ? `${BASE_PATH}/schools/${row.school_slug}`
            : null;

        evidence.push({
          kind: 'review' as EvidenceKind,
          source_id: null,
          url: schoolPageUrl,
          title: card.title,
          excerpt: card.excerpt || null,
          summary: card.summary,
          section_ref: attribution
            ? `${attribution}（当サイトのアンケート回答）`
            : null,
          confidence: (card.confidence || 'medium') as ConfidenceLevel,
        });
      }
    } catch {
      evidence.push({
        kind: 'review',
        source_id: null,
        url: null,
        title: '口コミ要約',
        excerpt: null,
        summary: response.content.slice(0, 500),
        section_ref: null,
        confidence: 'medium',
      });
    }
  }

  if (data.articles.length > 0) {
    const articlesText = formatArticlesForResearch(data.articles);

    const response = await callLLM({
      provider,
      model,
      systemPrompt:
        '通信制高校メディアの編集者です。当サイト掲載の特集・体験記事から補助的なポイントのみ抽出してください（口コミの代替にはしない）。',
      userPrompt: `以下は当サイト内の記事（特集・コラム等）です。「${input.keyword}」に関連し、**口コミアンケートを補強する**観点だけをJSON配列で出力してください。

記事データ:
${articlesText}

出力形式（JSON配列のみ出力）:
[
  {
    "title": "ポイントタイトル",
    "summary": "要点を2-3文で要約",
    "excerpt": "記事からの引用（50-150字）",
    "source_title": "元記事のタイトル",
    "confidence": "high/medium/low"
  }
]

ルール:
- **3-4個**のカードに抑える（主役は口コミのため少なめ）
- source_titleは必須。上記【記事】行の「タイトル: 〜」と**完全一致**する文字列を転記すること（slugはJSONに含めない）
- 体験談記事の場合は、具体的なエピソードや感情を引用すること
- excerptは記事の原文から50-150字を正確に抜粋すること。要約や言い換えは不可
- 各カードは異なる論点をカバー`,
      temperature: 0.3,
      maxTokens: 1500,
    });

    totalTokens.prompt += response.tokensUsed.prompt;
    totalTokens.completion += response.tokensUsed.completion;
    totalTokens.total += response.tokensUsed.total;

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      const cards = JSON.parse(jsonMatch ? jsonMatch[0] : response.content) as Array<{
        title: string;
        summary: string;
        excerpt?: string;
        source_title?: string;
        confidence?: string;
      }>;

      for (const card of cards.slice(0, 4)) {
        const ref = card.source_title?.trim();
        const articleHit = findArticleBySourceTitle(data.articles, ref);
        const articleUrl = articleHit?.slug
          ? `${BASE_PATH}/features/${articleHit.slug}`
          : null;

        evidence.push({
          kind: 'article' as EvidenceKind,
          source_id: articleHit?.id ?? null,
          url: articleUrl,
          title: card.title,
          excerpt: card.excerpt || null,
          summary: card.summary,
          section_ref: ref ?? null,
          confidence: (card.confidence || 'medium') as ConfidenceLevel,
        });
      }
    } catch {
      /* skip if parsing fails */
    }
  }

  if (data.schoolInfo) {
    const infoText = formatSchoolInfoForResearch(data.schoolInfo);

    const response = await callLLM({
      provider,
      model,
      systemPrompt:
        '通信制高校の学校情報分析専門家です。学校データからSEO記事に使える重要ポイントを抽出してください。',
      userPrompt: `以下の学校情報を分析し、「${input.keyword}」のSEO記事で使える重要ポイントをJSON配列で出力してください。

学校情報:
${infoText}

出力形式（JSON配列のみ出力）:
[
  {
    "title": "ポイントタイトル（例: 充実したサポート体制）",
    "summary": "このポイントを2-3文で要約。記事で使えるように具体的に記述",
    "confidence": "high/medium/low"
  }
]

ルール:
- 2-3個のカードに整理
- 学校のセールスポイントや特長を具体的に抽出
- 数値データ（口コミ件数、満足度など）があれば含めること
- 紹介文やAI要約から記事に引用できるフレーズを抽出`,
      temperature: 0.3,
      maxTokens: 1000,
    });

    totalTokens.prompt += response.tokensUsed.prompt;
    totalTokens.completion += response.tokensUsed.completion;
    totalTokens.total += response.tokensUsed.total;

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      const cards = JSON.parse(jsonMatch ? jsonMatch[0] : response.content) as Array<{
        title: string;
        summary: string;
        confidence?: string;
      }>;

      for (const card of cards) {
        evidence.push({
          kind: 'school_info' as EvidenceKind,
          source_id: data.schoolInfo!.id,
          url: null,
          title: card.title,
          excerpt: null,
          summary: card.summary,
          section_ref: null,
          confidence: (card.confidence || 'high') as ConfidenceLevel,
        });
      }
    } catch {
      evidence.push({
        kind: 'school_info',
        source_id: data.schoolInfo.id,
        url: null,
        title: `${data.schoolInfo.name} 基本情報`,
        excerpt: null,
        summary: infoText.slice(0, 500),
        section_ref: `${data.schoolInfo.name}（掲載学校プロフィール・当サイト）`,
        confidence: 'high',
      });
    }
  }

  if (data.schoolInfo && (data.schoolInfo.review_count > 0 || data.schoolInfo.overall_avg)) {
    const statsLines: string[] = [];
    statsLines.push(`口コミ件数: ${data.schoolInfo.review_count}件`);
    if (data.schoolInfo.overall_avg) {
      statsLines.push(`総合満足度平均: ${data.schoolInfo.overall_avg.toFixed(1)}/5`);
    }
    const reviewCount = data.reviews.length;
    if (reviewCount > 0) {
      const avgSatisfaction =
        data.reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) / reviewCount;
      const staffRatings = data.reviews.filter((r) => r.staff_rating != null);
      const atmosphereRatings = data.reviews.filter((r) => r.atmosphere_fit_rating != null);
      statsLines.push(`分析対象口コミ数: ${reviewCount}件`);
      statsLines.push(`分析対象の平均満足度: ${avgSatisfaction.toFixed(1)}/5`);
      if (staffRatings.length > 0) {
        const avgStaff =
          staffRatings.reduce((sum, r) => sum + r.staff_rating!, 0) / staffRatings.length;
        statsLines.push(`先生の評価平均: ${avgStaff.toFixed(1)}/5 (${staffRatings.length}件)`);
      }
      if (atmosphereRatings.length > 0) {
        const avgAtm =
          atmosphereRatings.reduce((sum, r) => sum + r.atmosphere_fit_rating!, 0) /
          atmosphereRatings.length;
        statsLines.push(`雰囲気の評価平均: ${avgAtm.toFixed(1)}/5 (${atmosphereRatings.length}件)`);
      }
    }

    evidence.push({
      kind: 'review' as EvidenceKind,
      source_id: null,
      url: null,
      title: '口コミ統計データ',
      excerpt: null,
      summary: `口コミ統計: ${statsLines.join('、')}`,
      section_ref:
        data.schoolInfo?.name != null
          ? `${data.schoolInfo.name}を中心とした当サイトアンケートの集計`
          : '当サイトに寄せられた複数校のアンケートを集計',
      confidence: 'high',
    });
  }

  return { evidence, tokensUsed: totalTokens };
}
