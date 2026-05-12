/**
 * SEO カバレッジ集計（公開校数・学校紹介 intro の有無・AI要約 published 件数・公開記事数）
 * 使い方:
 *   npx tsx scripts/seo-coverage.ts
 *   npx tsx scripts/seo-coverage.ts --prefecture-coverage
 *   npx tsx scripts/seo-coverage.ts --intro-depth
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { prefectures } from '../lib/prefectures';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function hasNonEmptyHighlights(highlights: unknown): boolean {
  if (!Array.isArray(highlights)) return false;
  return highlights.some((h) => typeof h === 'string' && h.trim() !== '');
}

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  prefectures: string[] | null;
  intro: string | null;
  highlights: unknown;
};

async function fetchAllActiveSchools(supabase: SupabaseClient): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const out: SchoolRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, intro, highlights')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as SchoolRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** 公開口コミが1件以上ある学校ID */
async function fetchReviewCountBySchool(supabase: SupabaseClient): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const pageSize = 5000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('school_id')
      .eq('is_public', true)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data as { school_id: string }[]) {
      const id = row.school_id;
      map.set(id, (map.get(id) || 0) + 1);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function schoolIdsWithPublishedSeo(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const chunk = 150;
  for (let i = 0; i < schoolIds.length; i += chunk) {
    const slice = schoolIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .select('school_id')
      .in('school_id', slice)
      .eq('kind', 'seo')
      .eq('status', 'published');
    if (error) throw error;
    for (const row of data || []) {
      out.add((row as { school_id: string }).school_id);
    }
  }
  return out;
}

async function schoolIdsWithPublishedFaq(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const chunk = 150;
  for (let i = 0; i < schoolIds.length; i += chunk) {
    const slice = schoolIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .select('school_id')
      .in('school_id', slice)
      .eq('kind', 'seo')
      .eq('topic', 'faq')
      .eq('status', 'published');
    if (error) throw error;
    for (const row of data || []) {
      out.add((row as { school_id: string }).school_id);
    }
  }
  return out;
}

/** kind=overall published で meta_title が入っている学校 */
async function schoolIdsWithPublishedOverallMeta(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const chunk = 150;
  for (let i = 0; i < schoolIds.length; i += chunk) {
    const slice = schoolIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .select('school_id')
      .in('school_id', slice)
      .eq('kind', 'overall')
      .is('topic', null)
      .eq('status', 'published')
      .not('meta_title', 'is', null)
      .neq('meta_title', '');
    if (error) throw error;
    for (const row of data || []) {
      out.add((row as { school_id: string }).school_id);
    }
  }
  return out;
}

function introCharLen(intro: string | null): number {
  return (intro ?? '').trim().length;
}

function introLengthBucket(len: number): 'empty' | '1_79' | '80_149' | '150_249' | '250_plus' {
  if (len === 0) return 'empty';
  if (len < 80) return '1_79';
  if (len < 150) return '80_149';
  if (len < 250) return '150_249';
  return '250_plus';
}

function introStatsForSchools(schools: SchoolRow[]) {
  const buckets: Record<'empty' | '1_79' | '80_149' | '150_249' | '250_plus', number> = {
    empty: 0,
    '1_79': 0,
    '80_149': 0,
    '150_249': 0,
    '250_plus': 0,
  };
  let highlightsNonempty = 0;
  let introUnder120 = 0;
  for (const s of schools) {
    const len = introCharLen(s.intro);
    buckets[introLengthBucket(len)]++;
    if (hasNonEmptyHighlights(s.highlights)) highlightsNonempty++;
    if (len > 0 && len < 120) introUnder120++;
  }
  return {
    school_count: schools.length,
    intro_char_buckets: buckets,
    highlights_nonempty: highlightsNonempty,
    highlights_nonempty_pct: schools.length ? Math.round((1000 * highlightsNonempty) / schools.length) / 10 : 0,
    intro_nonempty_but_under_120_chars: introUnder120,
    intro_under_120_pct: schools.length ? Math.round((1000 * introUnder120) / schools.length) / 10 : 0,
  };
}

async function runIntroDepthReport(supabase: SupabaseClient) {
  const [schools, reviewCountBySchool] = await Promise.all([
    fetchAllActiveSchools(supabase),
    fetchReviewCountBySchool(supabase),
  ]);
  const allIds = schools.map((s) => s.id);
  const [seoSet, faqSet, metaSet] = await Promise.all([
    schoolIdsWithPublishedSeo(supabase, allIds),
    schoolIdsWithPublishedFaq(supabase, allIds),
    schoolIdsWithPublishedOverallMeta(supabase, allIds),
  ]);

  const zeroReview = schools.filter((s) => (reviewCountBySchool.get(s.id) || 0) === 0);
  const withReviews = schools.filter((s) => (reviewCountBySchool.get(s.id) || 0) > 0);

  const thinnest = [...schools]
    .map((s) => ({
      id: s.id,
      name: s.name,
      intro_chars: introCharLen(s.intro),
      public_reviews: reviewCountBySchool.get(s.id) || 0,
    }))
    .filter((s) => s.intro_chars > 0 && s.intro_chars < 120)
    .sort((a, b) => a.intro_chars - b.intro_chars)
    .slice(0, 20);

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        report: 'intro_depth_and_enrichment',
        note:
          'intro_char_buckets: エージェント目標はおおよそ150〜300字前後。120未満は一覧用にもやや短い想定。',
        schools_active_public: schools.length,
        public_review_schools_zero_vs_positive: {
          zero_public_reviews: zeroReview.length,
          one_or_more_public_reviews: withReviews.length,
        },
        published_ai_school_counts: {
          overall_meta_title_nonempty: metaSet.size,
          any_published_seo_row: seoSet.size,
          published_faq: faqSet.size,
        },
        intro_and_highlights_all: introStatsForSchools(schools),
        intro_and_highlights_zero_public_reviews: introStatsForSchools(zeroReview),
        intro_and_highlights_with_public_reviews: introStatsForSchools(withReviews),
        sample_thinnest_nonempty_intro_under_120_chars: thinnest,
      },
      null,
      2
    )
  );
}

function schoolsInPrefecture(schools: SchoolRow[], pref: string): SchoolRow[] {
  return schools.filter((s) => {
    if (s.prefecture === pref) return true;
    const arr = Array.isArray(s.prefectures) ? s.prefectures : [];
    return arr.includes(pref);
  });
}

async function runPrefectureCoverage(supabase: SupabaseClient) {
  const [allSchools, reviewCountBySchool] = await Promise.all([
    fetchAllActiveSchools(supabase),
    fetchReviewCountBySchool(supabase),
  ]);

  const allZeroIds = allSchools
    .filter((s) => (reviewCountBySchool.get(s.id) || 0) === 0)
    .map((s) => s.id);

  const [seoSet, faqSet] =
    allZeroIds.length > 0
      ? await Promise.all([
          schoolIdsWithPublishedSeo(supabase, allZeroIds),
          schoolIdsWithPublishedFaq(supabase, allZeroIds),
        ])
      : [new Set<string>(), new Set<string>()];

  const rows = prefectures.map((pref) => {
    const inPref = schoolsInPrefecture(allSchools, pref);
    const zeros = inPref.filter((s) => (reviewCountBySchool.get(s.id) || 0) === 0);
    const zeroWithIntro = zeros.filter((s) => s.intro && s.intro.trim() !== '').length;
    const zeroWithHighlights = zeros.filter((s) => hasNonEmptyHighlights(s.highlights)).length;
    const zeroWithSeo = zeros.filter((z) => seoSet.has(z.id)).length;
    const zeroWithFaq = zeros.filter((z) => faqSet.has(z.id)).length;

    return {
      prefecture: pref,
      total_schools: inPref.length,
      zero_review_schools: zeros.length,
      zero_review_intro_nonempty: zeroWithIntro,
      zero_review_highlights_nonempty: zeroWithHighlights,
      zero_review_published_seo_schools: zeroWithSeo,
      zero_review_published_faq_schools: zeroWithFaq,
    };
  });

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        report: 'prefecture_zero_review_coverage',
        prefectures: rows,
      },
      null,
      2
    )
  );
}

async function runDefaultSummary(supabase: SupabaseClient) {
  const { count: activeSchools } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('is_public', true);

  const { count: publishedOverall } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'published');

  const { count: publishedSeo } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'seo')
    .eq('status', 'published');

  const { count: publishedTendency } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'review_tendency')
    .is('topic', null)
    .eq('status', 'published');

  const { count: draftOverall } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'draft');

  const { count: publicArticles } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true);

  const { count: unknownPref } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('prefecture', '不明');

  const { count: introNonEmpty } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('is_public', true)
    .not('intro', 'is', null)
    .neq('intro', '');

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        schools_active_public: activeSchools ?? 0,
        schools_intro_nonempty: introNonEmpty ?? 0,
        ai_summaries_overall_published: publishedOverall ?? 0,
        ai_summaries_overall_draft: draftOverall ?? 0,
        ai_summaries_seo_rows_published: publishedSeo ?? 0,
        ai_summaries_review_tendency_published: publishedTendency ?? 0,
        articles_public: publicArticles ?? 0,
        schools_prefecture_unknown: unknownPref ?? 0,
      },
      null,
      2
    )
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const args = process.argv.slice(2);
  if (args.includes('--intro-depth')) {
    await runIntroDepthReport(supabase);
  } else if (args.includes('--prefecture-coverage')) {
    await runPrefectureCoverage(supabase);
  } else {
    await runDefaultSummary(supabase);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
