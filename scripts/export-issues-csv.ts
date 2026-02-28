import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: allSchools } = await supabase
    .from('schools')
    .select('id, name, slug, prefecture')
    .order('name');

  if (!allSchools) { console.log('Failed'); return; }

  const rows: string[][] = [];
  rows.push([
    '\u5B66\u6821\u540D',
    '\u53E3\u30B3\u30DF\u6570',
    'Slug',
    'Prefecture',
    'Meta Title',
    'Meta Title\u6587\u5B57\u6570',
    'Meta Desc\u6587\u5B57\u6570',
    'Summary Text\u6587\u5B57\u6570',
    'Summary Text\u5148\u982D50\u5B57',
    'SEO\u30BB\u30AF\u30B7\u30E7\u30F3\u6570',
    'FAQ',
    'Review Tendency',
    '\u554F\u984C\u70B9',
  ]);

  for (const school of allSchools) {
    const { count } = await supabase
      .from('survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school.id)
      .eq('is_public', true);

    const reviewCount = count || 0;
    if (reviewCount === 0) continue;

    const problems: string[] = [];

    // Slug
    const slugStatus = school.slug || '';
    if (!school.slug) problems.push('Slug\u672A\u8A2D\u5B9A');

    // Prefecture
    const prefStatus = school.prefecture || '';
    if (!school.prefecture || school.prefecture === '\u4E0D\u660E') {
      problems.push('Prefecture\u672A\u8A2D\u5B9A\u307E\u305F\u306F\u4E0D\u660E');
    }

    // AI Summary (overall)
    const { data: overallSummaries } = await supabase
      .from('school_ai_summaries')
      .select('id, status, meta_title, meta_description, summary_text')
      .eq('school_id', school.id)
      .eq('kind', 'overall')
      .is('topic', null);

    const published = overallSummaries?.find(s => s.status === 'published');
    const draft = overallSummaries?.find(s => s.status === 'draft');
    const best = published || draft;

    const metaTitle = best?.meta_title || '';
    const metaTitleLen = metaTitle.length;
    const metaDescLen = (best?.meta_description || '').length;
    const summaryText = best?.summary_text || '';
    const summaryLen = summaryText.length;
    const summaryPreview = summaryText.replace(/[\r\n]+/g, ' ').slice(0, 50);

    if (!metaTitle) problems.push('Meta Title\u672A\u8A2D\u5B9A');
    if (metaTitleLen > 0 && metaTitleLen < 28) problems.push(`Meta Title\u77ED\u3044(${metaTitleLen}\u5B57)`);
    if (metaTitleLen > 35) problems.push(`Meta Title\u9577\u3044(${metaTitleLen}\u5B57)`);
    if (metaDescLen > 0 && metaDescLen < 105) problems.push(`Meta Desc\u77ED\u3044(${metaDescLen}\u5B57)`);
    if (!summaryText || summaryLen < 10) problems.push('Summary Text\u672A\u8A2D\u5B9A');
    if (summaryLen > 350) problems.push(`Summary Text\u9577\u3044(${summaryLen}\u5B57)`);

    // SEO sections (3\u4EF6\u4EE5\u4E0A)
    let seoCount = 0;
    let faqStatus = '-';
    let tendencyStatus = '-';

    if (reviewCount >= 3) {
      const { count: sc } = await supabase
        .from('school_ai_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('kind', 'seo')
        .neq('topic', 'faq');
      seoCount = sc || 0;

      const { count: fc } = await supabase
        .from('school_ai_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('kind', 'seo')
        .eq('topic', 'faq');
      faqStatus = (fc || 0) >= 1 ? 'OK' : '\u672A\u8A2D\u5B9A';

      const { count: tc } = await supabase
        .from('review_tendency')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', school.id);
      tendencyStatus = (tc || 0) >= 1 ? 'OK' : '\u672A\u8A2D\u5B9A';

      if (seoCount < 5) problems.push(`SEO ${seoCount}/5`);
      if (faqStatus === '\u672A\u8A2D\u5B9A') problems.push('FAQ\u672A\u8A2D\u5B9A');
      if (tendencyStatus === '\u672A\u8A2D\u5B9A') problems.push('Tendency\u672A\u8A2D\u5B9A');
    }

    rows.push([
      school.name,
      String(reviewCount),
      slugStatus,
      prefStatus,
      metaTitle,
      String(metaTitleLen),
      String(metaDescLen),
      String(summaryLen),
      summaryPreview,
      reviewCount >= 3 ? String(seoCount) : '-',
      faqStatus,
      tendencyStatus,
      problems.join(' / '),
    ]);
  }

  // BOM + CSV
  const bom = '\uFEFF';
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const outPath = path.join(process.cwd(), 'logs', 'issues-report.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, bom + csv, 'utf-8');
  console.log(`CSV exported: ${outPath}`);
  console.log(`Total schools with reviews: ${rows.length - 1}`);
  console.log(`Schools with problems: ${rows.filter((r, i) => i > 0 && r[r.length - 1] !== '').length}`);
}

main().catch(console.error);
