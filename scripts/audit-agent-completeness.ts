/**
 * AIエージェントの生成結果を監査し、欠落データを特定する
 *   npx tsx scripts/audit-agent-completeness.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEO_KEYS = [
  'good_bad',
  'tuition',
  'learning',
  'syllabus',
  'flexibility',
];

interface SchoolIssue {
  name: string;
  id: string;
  reviewCount: number;
  issues: string[];
}

async function main() {
  // 口コミ1件以上の学校を取得
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, prefecture, slug, intro, status')
    .eq('status', 'active')
    .eq('is_public', true);

  if (!schools?.length) {
    console.log('学校が見つかりません');
    return;
  }

  // 口コミ数を取得
  const { data: reviewCounts } = await supabase
    .from('survey_responses')
    .select('school_id')
    .eq('is_public', true);

  const countMap = new Map<string, number>();
  (reviewCounts || []).forEach((r: any) => {
    countMap.set(r.school_id, (countMap.get(r.school_id) || 0) + 1);
  });

  const schoolsWithReviews = schools.filter((s) => (countMap.get(s.id) || 0) >= 1);
  console.log(`口コミ1件以上の学校: ${schoolsWithReviews.length}校\n`);

  // 全 school_ai_summaries を取得
  const { data: allSummaries } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, kind, topic, status, summary_text, meta_title, meta_description');

  // review_tendency を取得 (school_ai_summaries kind='review_tendency')
  const { data: allTendencies } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, status, summary_text')
    .eq('kind', 'review_tendency')
    .is('topic', null);

  const summaryMap = new Map<string, typeof allSummaries>();
  (allSummaries || []).forEach((s: any) => {
    const arr = summaryMap.get(s.school_id) || [];
    arr.push(s);
    summaryMap.set(s.school_id, arr);
  });

  const tendencyMap = new Map<string, any[]>();
  (allTendencies || []).forEach((t: any) => {
    const arr = tendencyMap.get(t.school_id) || [];
    arr.push(t);
    tendencyMap.set(t.school_id, arr);
  });

  const problems: SchoolIssue[] = [];

  for (const school of schoolsWithReviews) {
    const rc = countMap.get(school.id) || 0;
    const issues: string[] = [];
    const summaries = (summaryMap.get(school.id) || []) as any[];
    const tendencies = (tendencyMap.get(school.id) || []) as any[];

    // Group A checks
    if (!school.prefecture) issues.push('都道府県未設定');
    if (!school.slug) issues.push('スラグ未設定');
    if (!school.intro || school.intro.trim().length === 0) issues.push('学校概要(intro)未設定');

    // overall summary
    const overall = summaries.filter((s: any) => s.kind === 'overall' && s.topic === null);
    const publishedOverall = overall.find((s: any) => s.status === 'published');
    const draftOverall = overall.find((s: any) => s.status === 'draft');

    if (!publishedOverall && !draftOverall) {
      issues.push('口コミ要約なし');
    } else {
      const target = publishedOverall || draftOverall;
      if (!target.summary_text || target.summary_text.trim().length === 0) issues.push('口コミ要約テキスト空');
      if (!target.meta_title) issues.push('Meta Title未設定');
      if (!target.meta_description) issues.push('Meta Desc未設定');
      if (target.meta_title && target.meta_title.length < 28) issues.push(`Meta Title短い(${target.meta_title.length}字)`);
      if (target.meta_description && target.meta_description.length < 100) issues.push(`Meta Desc短い(${target.meta_description.length}字)`);
      if (draftOverall && !publishedOverall) issues.push('口コミ要約が下書きのまま(未公開)');
    }

    // SEO sections
    const seoSections = summaries.filter((s: any) => s.kind === 'seo' && s.topic && s.topic !== 'faq');
    const publishedSeo = seoSections.filter((s: any) => s.status === 'published');
    const draftSeo = seoSections.filter((s: any) => s.status === 'draft');
    const seoTopics = new Set([...publishedSeo, ...draftSeo].map((s: any) => s.topic));
    const missingSeo = SEO_KEYS.filter((k) => !seoTopics.has(k));
    if (missingSeo.length > 0) issues.push(`SEOセクション欠落(${missingSeo.join(',')})`);
    if (draftSeo.length > 0 && publishedSeo.length < SEO_KEYS.length) {
      const unpubTopics = draftSeo.filter((s: any) => !publishedSeo.find((p: any) => p.topic === s.topic)).map((s: any) => s.topic);
      if (unpubTopics.length > 0) issues.push(`SEO下書き未公開(${unpubTopics.join(',')})`);
    }

    // FAQ
    const faq = summaries.filter((s: any) => s.kind === 'seo' && s.topic === 'faq');
    const publishedFaq = faq.find((s: any) => s.status === 'published');
    const draftFaq = faq.find((s: any) => s.status === 'draft');
    if (!publishedFaq && !draftFaq) {
      issues.push('FAQ未生成');
    } else if (draftFaq && !publishedFaq) {
      issues.push('FAQ下書き未公開');
    }

    // review_tendency
    const publishedTend = tendencies.find((t: any) => t.status === 'published');
    const draftTend = tendencies.find((t: any) => t.status === 'draft');
    if (!publishedTend && !draftTend) {
      issues.push('口コミ傾向未生成');
    } else if (draftTend && !publishedTend) {
      issues.push('口コミ傾向下書き未公開');
    }

    if (issues.length > 0) {
      problems.push({ name: school.name, id: school.id, reviewCount: rc, issues });
    }
  }

  // 集計
  const issueCounts = new Map<string, number>();
  problems.forEach((p) => {
    p.issues.forEach((i) => {
      const key = i.replace(/\(.*\)/, '(...)');
      issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
    });
  });

  console.log(`=== 問題がある学校: ${problems.length}/${schoolsWithReviews.length}校 ===\n`);

  console.log('--- 問題種別の集計 ---');
  [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count}校`);
    });

  console.log('\n--- 問題校の詳細 ---');
  problems.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (口コミ${p.reviewCount}件)`);
    p.issues.forEach((issue) => console.log(`   - ${issue}`));
  });
}

main().catch(console.error);
