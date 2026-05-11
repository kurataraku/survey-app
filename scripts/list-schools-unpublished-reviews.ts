/**
 * 管理画面と同スコープで学校に紐づく口コミはあるが、
 * いずれも is_public=false（サイト未公開）の学校を一覧する。
 *
 * 実行: npm run list:schools-unpublished-reviews
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import {
  publicSurveyResponsesOrFilter,
  shouldIncludeSurveyOnSchoolHubPage,
} from '../lib/reviews/schoolReviewLinkage';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です（.env.local）');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type SchoolRow = { id: string; name: string; slug: string };

async function fetchLinkedResponses(school: SchoolRow) {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id, is_public, school_id, school_name, schools(id, status)')
    .or(publicSurveyResponsesOrFilter(school.id, school.name));

  if (error) {
    console.error(`[${school.name}] 取得エラー:`, error.message);
    return null;
  }
  return data ?? [];
}

async function main() {
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, slug')
    .eq('is_public', true)
    .eq('status', 'active')
    .order('name');

  if (schoolErr || !schools?.length) {
    console.error('学校一覧の取得に失敗しました', schoolErr?.message);
    process.exit(1);
  }

  const concurrency = 12;
  const results: Array<{
    school: SchoolRow;
    totalLinked: number;
    publicLinked: number;
    visibleIfPublic: number;
  }> = [];

  for (let i = 0; i < schools.length; i += concurrency) {
    const chunk = schools.slice(i, i + concurrency) as SchoolRow[];
    const part = await Promise.all(
      chunk.map(async (school) => {
        const rows = await fetchLinkedResponses(school);
        if (!rows) {
          return { school, totalLinked: -1, publicLinked: 0, visibleIfPublic: 0 };
        }
        const onHub = rows.filter((r) =>
          shouldIncludeSurveyOnSchoolHubPage(
            r as Parameters<typeof shouldIncludeSurveyOnSchoolHubPage>[0],
            school.id,
            school.name
          )
        );
        const publicOnHub = onHub.filter((r) => r.is_public === true);
        return {
          school,
          totalLinked: rows.length,
          publicLinked: rows.filter((r) => r.is_public === true).length,
          visibleIfPublic: publicOnHub.length,
        };
      })
    );
    results.push(...part);
  }

  const unpublishedOnly = results.filter((r) => r.totalLinked > 0 && r.publicLinked === 0);
  const hasReviewsButNoneVisible = results.filter(
    (r) => r.totalLinked > 0 && r.visibleIfPublic === 0 && r.publicLinked > 0
  );

  console.log('\n=== 口コミはあるが、すべて未公開（is_public=false）の学校 ===\n');
  console.log(`対象校数（active・サイト公開）: ${schools.length}`);
  console.log(`該当: ${unpublishedOnly.length} 校\n`);

  if (unpublishedOnly.length === 0) {
    console.log('該当する学校はありません。');
  } else {
    console.log('| # | 学校名 | slug | 紐づき口コミ件数（全件） |');
    console.log('|--|--------|------|-------------------------|');
    unpublishedOnly.forEach((r, idx) => {
      console.log(
        `| ${idx + 1} | ${r.school.name} | ${r.school.slug} | ${r.totalLinked} |`
      );
    });
    console.log('\n--- TSV（コピー用） ---\n');
    console.log(['name', 'slug', 'linked_total'].join('\t'));
    for (const r of unpublishedOnly) {
      console.log([r.school.name, r.school.slug, String(r.totalLinked)].join('\t'));
    }
  }

  console.log('\n=== 参考: 公開中の口コミはあるが、ハブ表示条件で0件になる学校 ===\n');
  console.log(`該当: ${hasReviewsButNoneVisible.length} 校（別校ID誤紐づけ等の可能性）\n`);
  if (hasReviewsButNoneVisible.length > 0) {
    console.log(['name', 'slug', 'linked_total', 'is_public_true'].join('\t'));
    for (const r of hasReviewsButNoneVisible) {
      console.log(
        [r.school.name, r.school.slug, String(r.totalLinked), String(r.publicLinked)].join('\t')
      );
    }
  }

  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
