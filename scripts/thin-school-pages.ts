/**
 * noindex / サイトマップ除外の対象になる「実質空の学校ページ」を集計する（読み取りのみ）。
 * 判定は lib/seo/thin-school-page.ts と共通なので、デプロイ前に影響範囲を確認できる。
 *
 * 使い方:
 *   npm run seo:thin-pages
 *   npm run seo:thin-pages -- --list        対象校の一覧をすべて出力
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isThinSchoolPage, MIN_INTRO_CHARS_FOR_INDEX } from '../lib/seo/thin-school-page';
import {
  countReviewsBySchool,
  type ReviewSchoolLink,
} from '../lib/seo/school-review-counts';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 150;

type SchoolRow = {
  id: string;
  name: string;
  slug: string | null;
  intro: string | null;
};

async function fetchAllSchools(supabase: SupabaseClient): Promise<SchoolRow[]> {
  const out: SchoolRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, slug, intro')
      .eq('status', 'active')
      .eq('is_public', true)
      .not('slug', 'is', null)
      .order('slug')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as SchoolRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

async function fetchAllReviewLinks(supabase: SupabaseClient): Promise<ReviewSchoolLink[]> {
  const out: ReviewSchoolLink[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('school_id, school_name, schools(id, status)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as unknown as ReviewSchoolLink[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

async function fetchPublishedSchoolIds(
  supabase: SupabaseClient,
  table: string,
  schoolIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < schoolIds.length; i += ID_CHUNK_SIZE) {
    const slice = schoolIds.slice(i, i + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .select('school_id')
      .in('school_id', slice)
      .eq('status', 'published');
    if (error) throw error;
    for (const row of (data as { school_id: string | null }[] | null) ?? []) {
      if (row.school_id) out.add(row.school_id);
    }
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const showList = process.argv.slice(2).includes('--list');
  const supabase = createClient(url, key);

  const [schools, reviewLinks] = await Promise.all([
    fetchAllSchools(supabase),
    fetchAllReviewLinks(supabase),
  ]);

  const reviewCounts = countReviewsBySchool(schools, reviewLinks);
  const schoolIds = schools.map((s) => s.id);
  const [aiIds, tuitionIds, courseIds] = await Promise.all([
    fetchPublishedSchoolIds(supabase, 'school_ai_summaries', schoolIds),
    fetchPublishedSchoolIds(supabase, 'school_tuition_estimates', schoolIds),
    fetchPublishedSchoolIds(supabase, 'school_course_listings', schoolIds),
  ]);

  const thin: Array<{ name: string; slug: string | null; intro_chars: number }> = [];
  let zeroReview = 0;
  // 口コミ0件校が「中身あり」と判定される根拠の内訳（閾値を締める判断材料）
  const zeroReviewSaviors = {
    intro_120_plus: 0,
    published_ai_content: 0,
    tuition_estimate: 0,
    course_listing: 0,
    only_intro_under_120: 0,
  };

  for (const school of schools) {
    const reviewCount = reviewCounts.get(school.id) ?? 0;
    const introChars = (school.intro ?? '').trim().length;
    const hasAi = aiIds.has(school.id);
    const hasTuition = tuitionIds.has(school.id);
    const hasCourses = courseIds.has(school.id);

    if (reviewCount === 0) {
      zeroReview++;
      if (introChars >= MIN_INTRO_CHARS_FOR_INDEX) zeroReviewSaviors.intro_120_plus++;
      if (hasAi) zeroReviewSaviors.published_ai_content++;
      if (hasTuition) zeroReviewSaviors.tuition_estimate++;
      if (hasCourses) zeroReviewSaviors.course_listing++;
      if (
        introChars > 0 &&
        introChars < MIN_INTRO_CHARS_FOR_INDEX &&
        !hasAi &&
        !hasTuition &&
        !hasCourses
      ) {
        zeroReviewSaviors.only_intro_under_120++;
      }
    }

    const result = isThinSchoolPage({
      reviewCount,
      intro: school.intro,
      hasPublishedAiContent: hasAi,
      hasTuitionEstimate: hasTuition,
      hasCourseListing: hasCourses,
    });

    if (result) {
      thin.push({
        name: school.name,
        slug: school.slug,
        intro_chars: introChars,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        min_intro_chars_for_index: MIN_INTRO_CHARS_FOR_INDEX,
        schools_active_public_with_slug: schools.length,
        // この件数がそのまま /schools/{slug}/reviews の noindex 対象になる
        schools_zero_public_reviews: zeroReview,
        zero_review_schools_content_breakdown: zeroReviewSaviors,
        thin_pages_to_be_noindexed: thin.length,
        thin_pages_pct: schools.length
          ? Math.round((1000 * thin.length) / schools.length) / 10
          : 0,
        samples: showList ? thin : thin.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
