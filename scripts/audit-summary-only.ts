import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEO_KEYS = ['good_bad', 'tuition', 'learning', 'syllabus', 'flexibility'];

async function main() {
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, prefecture, slug, intro, status')
    .eq('status', 'active')
    .eq('is_public', true);

  const { data: reviewCounts } = await supabase
    .from('survey_responses')
    .select('school_id')
    .eq('is_public', true);

  const countMap = new Map<string, number>();
  (reviewCounts || []).forEach((r: any) => {
    countMap.set(r.school_id, (countMap.get(r.school_id) || 0) + 1);
  });

  const schoolsWithReviews = (schools || []).filter((s) => (countMap.get(s.id) || 0) >= 1);

  const { data: allSummaries } = await supabase
    .from('school_ai_summaries')
    .select('school_id, kind, topic, status, summary_text, meta_title, meta_description');

  const summaryMap = new Map<string, any[]>();
  (allSummaries || []).forEach((s: any) => {
    const arr = summaryMap.get(s.school_id) || [];
    arr.push(s);
    summaryMap.set(s.school_id, arr);
  });

  const issueCounts = new Map<string, number>();
  let problemCount = 0;

  for (const school of schoolsWithReviews) {
    const summaries = (summaryMap.get(school.id) || []) as any[];
    const issues: string[] = [];

    if (!school.intro || school.intro.trim().length === 0) issues.push('intro missing');

    const overall = summaries.filter((s: any) => s.kind === 'overall' && s.topic === null);
    const pubOverall = overall.find((s: any) => s.status === 'published');
    const draftOverall = overall.find((s: any) => s.status === 'draft');
    const target = pubOverall || draftOverall;
    if (!target) {
      issues.push('overall missing');
    } else {
      if (!target.meta_title) issues.push('meta_title missing');
      if (!target.meta_description) issues.push('meta_desc missing');
      if (target.meta_title && target.meta_title.length < 28) issues.push('meta_title short');
      if (target.meta_description && target.meta_description.length < 100) issues.push('meta_desc short');
      if (draftOverall && !pubOverall) issues.push('overall unpublished');
    }

    const seoSections = summaries.filter((s: any) => s.kind === 'seo' && s.topic && s.topic !== 'faq');
    const seoTopics = new Set(seoSections.map((s: any) => s.topic));
    const missingSeo = SEO_KEYS.filter((k) => !seoTopics.has(k));
    if (missingSeo.length > 0) issues.push(`seo missing(${missingSeo.length})`);
    const unpubSeo = seoSections.filter((s: any) => s.status === 'draft' && !seoSections.find((p: any) => p.topic === s.topic && p.status === 'published'));
    if (unpubSeo.length > 0) issues.push(`seo unpub(${unpubSeo.length})`);

    const faq = summaries.filter((s: any) => s.kind === 'seo' && s.topic === 'faq');
    if (faq.length === 0) issues.push('faq missing');
    else if (!faq.find((f: any) => f.status === 'published')) issues.push('faq unpub');

    const tend = summaries.filter((s: any) => s.kind === 'review_tendency');
    if (tend.length === 0) issues.push('tendency missing');
    else if (!tend.find((t: any) => t.status === 'published')) issues.push('tendency unpub');

    if (issues.length > 0) {
      problemCount++;
      issues.forEach((i) => {
        const key = i.replace(/\(\d+\)/, '(N)');
        issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
      });
    }
  }

  console.log(`Problem schools: ${problemCount}/${schoolsWithReviews.length}`);
  console.log('\nIssue breakdown:');
  [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count}`);
    });
}

main().catch(console.error);
