import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. 東日本国際大学附属昌平高等学校の詳細
  console.log('=== 1. 東日本国際大学附属昌平高等学校 ===');
  const { data: school1 } = await supabase
    .from('schools')
    .select('id, name, slug, prefecture, prefectures, status')
    .ilike('name', '%昌平%')
    .single();

  if (school1) {
    console.log('  ID:', school1.id);
    console.log('  Name:', school1.name);
    console.log('  Slug:', school1.slug || '(未設定)');
    console.log('  Prefecture:', school1.prefecture || '(未設定)');
    console.log('  Prefectures:', school1.prefectures || '(未設定)');
    console.log('  Status:', school1.status);

    const { count: reviewCount } = await supabase
      .from('survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school1.id)
      .eq('is_public', true);
    console.log('  Public reviews:', reviewCount);

    const { data: summaries } = await supabase
      .from('school_ai_summaries')
      .select('id, kind, topic, status, summary_text, meta_title, meta_description, reviews_count_used, created_at')
      .eq('school_id', school1.id);
    console.log('  AI Summaries:', summaries?.length || 0);
    summaries?.forEach(s => {
      console.log(`    [${s.kind}/${s.topic || '-'}] status=${s.status} title=${(s.meta_title || '').slice(0, 30)} desc_len=${(s.meta_description || '').length} summary_len=${(s.summary_text || '').length}`);
    });

    const { data: tendency } = await supabase
      .from('review_tendency')
      .select('id, status, summary_text, reviews_count_used')
      .eq('school_id', school1.id);
    console.log('  Review Tendency:', tendency?.length || 0);
    tendency?.forEach(t => {
      console.log(`    status=${t.status} text_len=${(t.summary_text || '').length}`);
    });
  }

  // 2. 全処理対象校（口コミ1件以上）のDB保存状態を網羅的に検証
  console.log('\n=== 2. 全処理対象校のDB検証 ===');

  // 口コミがある学校を取得
  const { data: allSchools } = await supabase
    .from('schools')
    .select('id, name, slug, prefecture')
    .order('name');

  if (!allSchools) { console.log('学校データ取得失敗'); return; }

  const issues: { school: string; problems: string[] }[] = [];
  let totalWithReviews = 0;
  let slugOk = 0, slugMissing = 0;
  let prefOk = 0, prefMissing = 0;
  let metaOk = 0, metaMissing = 0;
  let summaryOk = 0, summaryMissing = 0;
  let seoOk = 0, seoMissing = 0;
  let faqOk = 0, faqMissing = 0;
  let tendencyOk = 0, tendencyMissing = 0;

  for (const school of allSchools) {
    const { count } = await supabase
      .from('survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school.id)
      .eq('is_public', true);

    const reviewCount = count || 0;
    if (reviewCount === 0) continue;
    totalWithReviews++;

    const problems: string[] = [];

    // Slug
    if (!school.slug) { slugMissing++; problems.push('slug\u672A\u8A2D\u5B9A'); } else { slugOk++; }

    // Prefecture
    if (!school.prefecture || school.prefecture === '\u4E0D\u660E') {
      prefMissing++;
      problems.push(`prefecture=${school.prefecture || '(null)'}`);
    } else { prefOk++; }

    // AI Summary (overall) - meta_title, meta_description, summary_text
    const { data: overallSummaries } = await supabase
      .from('school_ai_summaries')
      .select('id, status, meta_title, meta_description, summary_text')
      .eq('school_id', school.id)
      .eq('kind', 'overall')
      .is('topic', null);

    const published = overallSummaries?.find(s => s.status === 'published');
    const draft = overallSummaries?.find(s => s.status === 'draft');
    const best = published || draft;

    if (!best?.meta_title) { metaMissing++; problems.push('meta_title\u672A\u8A2D\u5B9A'); } else { metaOk++; }
    if (!best?.summary_text || best.summary_text.length < 10) {
      summaryMissing++;
      problems.push(`summary_text=${best?.summary_text ? best.summary_text.length + '\u5B57' : '(null)'}`);
    } else { summaryOk++; }

    // SEO sections (3件以上のみ対象)
    if (reviewCount >= 3) {
      const { count: seoCount } = await supabase
        .from('school_ai_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('kind', 'seo')
        .neq('topic', 'faq');

      if ((seoCount || 0) >= 5) { seoOk++; } else { seoMissing++; problems.push(`seo=${seoCount || 0}/5`); }

      // FAQ
      const { count: faqCount } = await supabase
        .from('school_ai_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('kind', 'seo')
        .eq('topic', 'faq');

      if ((faqCount || 0) >= 1) { faqOk++; } else { faqMissing++; problems.push('faq\u672A\u8A2D\u5B9A'); }

      // Review Tendency
      const { count: tendCount } = await supabase
        .from('review_tendency')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id);

      if ((tendCount || 0) >= 1) { tendencyOk++; } else { tendencyMissing++; problems.push('tendency\u672A\u8A2D\u5B9A'); }
    }

    if (problems.length > 0) {
      issues.push({ school: `${school.name} (${reviewCount}\u4EF6)`, problems });
    }
  }

  console.log(`\u53E3\u30B3\u30DF\u3042\u308A\u5B66\u6821: ${totalWithReviews}\u6821`);
  console.log(`\n--- \u30B0\u30EB\u30FC\u30D7A\uFF08\u5168\u5BFE\u8C61\u6821\uFF09 ---`);
  console.log(`  Slug:       OK=${slugOk}  \u672A\u8A2D\u5B9A=${slugMissing}`);
  console.log(`  Prefecture: OK=${prefOk}  \u672A\u8A2D\u5B9A/\u4E0D\u660E=${prefMissing}`);
  console.log(`  Meta:       OK=${metaOk}  \u672A\u8A2D\u5B9A=${metaMissing}`);
  console.log(`  Summary:    OK=${summaryOk}  \u672A\u8A2D\u5B9A=${summaryMissing}`);
  console.log(`\n--- \u30B0\u30EB\u30FC\u30D7B\uFF08\u53E3\u30B3\u30DF3\u4EF6\u4EE5\u4E0A\uFF09 ---`);
  console.log(`  SEO:        OK=${seoOk}  \u672A\u8A2D\u5B9A=${seoMissing}`);
  console.log(`  FAQ:        OK=${faqOk}  \u672A\u8A2D\u5B9A=${faqMissing}`);
  console.log(`  Tendency:   OK=${tendencyOk}  \u672A\u8A2D\u5B9A=${tendencyMissing}`);

  console.log(`\n=== 3. \u554F\u984C\u306E\u3042\u308B\u5B66\u6821\u4E00\u89A7 (${issues.length}\u6821) ===`);
  issues.forEach(i => {
    console.log(`  ${i.school}: ${i.problems.join(', ')}`);
  });
}

main().catch(console.error);
