import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // 1. meta_title / meta_description
  const { data: metas } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, meta_title, meta_description, kind, status')
    .eq('kind', 'overall')
    .not('meta_title', 'is', null)
    .order('created_at', { ascending: false });

  console.log('=== Meta Title/Description ===');
  console.log('Total records:', metas?.length || 0);

  const titleShort: { title: string; len: number }[] = [];
  const titleLong: { title: string; len: number }[] = [];
  const descShort: { desc: string; len: number }[] = [];
  const descLong: { desc: string; len: number }[] = [];
  const noKuchikomi: { title: string }[] = [];
  const descNoPeriod: { desc: string }[] = [];

  for (const m of metas || []) {
    const tLen = (m.meta_title || '').length;
    const dLen = (m.meta_description || '').length;
    if (tLen > 0 && tLen < 28) titleShort.push({ title: m.meta_title, len: tLen });
    if (tLen > 35) titleLong.push({ title: m.meta_title, len: tLen });
    if (dLen > 0 && dLen < 105) descShort.push({ desc: m.meta_description, len: dLen });
    if (dLen > 125) descLong.push({ desc: m.meta_description, len: dLen });
    if (m.meta_title && !m.meta_title.includes('\u53E3\u30B3\u30DF') && !m.meta_title.includes('\u8A55\u5224')) {
      noKuchikomi.push({ title: m.meta_title });
    }
    if (m.meta_description && !/[\u3002\uFF01\uFF1F]$/.test(m.meta_description)) {
      descNoPeriod.push({ desc: m.meta_description });
    }
  }

  console.log(`  meta_title < 28\u5B57: ${titleShort.length}\u4EF6`);
  titleShort.slice(0, 5).forEach((t) => console.log(`    "${t.title}" (${t.len}\u5B57)`));
  console.log(`  meta_title > 35\u5B57: ${titleLong.length}\u4EF6`);
  titleLong.slice(0, 5).forEach((t) => console.log(`    "${t.title}" (${t.len}\u5B57)`));
  console.log(`  meta_desc < 105\u5B57: ${descShort.length}\u4EF6`);
  descShort.slice(0, 3).forEach((t) => console.log(`    (${t.len}\u5B57) "${t.desc.slice(0, 60)}..."`));
  console.log(`  meta_desc > 125\u5B57: ${descLong.length}\u4EF6`);
  descLong.slice(0, 3).forEach((t) => console.log(`    (${t.len}\u5B57) "${t.desc.slice(0, 60)}..."`));
  console.log(`  \u53E3\u30B3\u30DF/\u8A55\u5224\u306A\u3057: ${noKuchikomi.length}\u4EF6`);
  console.log(`  \u53E5\u70B9\u306A\u3057: ${descNoPeriod.length}\u4EF6`);

  // 2. summary_text
  const { data: summaries } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, summary_text, kind, status')
    .eq('kind', 'overall')
    .not('summary_text', 'is', null)
    .neq('summary_text', '');

  const schools: Record<string, string> = {};
  const summaryShort: { id: string; len: number }[] = [];
  const summaryLong: { id: string; len: number; text: string }[] = [];

  for (const s of summaries || []) {
    const len = (s.summary_text || '').length;
    if (len > 0 && len < 100) summaryShort.push({ id: s.school_id, len });
    if (len > 350) summaryLong.push({ id: s.school_id, len, text: s.summary_text.slice(0, 50) });
  }

  console.log('\n=== Summary Text ===');
  console.log(`  < 100\u5B57: ${summaryShort.length}\u4EF6`);
  console.log(`  > 350\u5B57: ${summaryLong.length}\u4EF6`);
  summaryLong.slice(0, 3).forEach((s) => console.log(`    (${s.len}\u5B57) "${s.text}..."`));

  // 3. SEO / FAQ / Tendency counts
  const { count: seoCount } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'seo')
    .neq('topic', 'faq')
    .eq('status', 'published');

  const { count: faqCount } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'seo')
    .eq('topic', 'faq')
    .eq('status', 'published');

  const { count: tendCount } = await supabase
    .from('review_tendency')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');

  console.log('\n=== \u516C\u958B\u6E08\u307F\u30EC\u30B3\u30FC\u30C9\u6570 ===');
  console.log(`  SEO sections: ${seoCount}`);
  console.log(`  FAQ: ${faqCount}`);
  console.log(`  Review Tendency: ${tendCount}`);

  // 4. schools with reviews but no meta
  const { data: schoolsWithReviews } = await supabase
    .rpc('get_schools_with_review_count')
    .gt('review_count', 0);

  if (!schoolsWithReviews) {
    // fallback: manual count
    const { data: allSchools } = await supabase.from('schools').select('id, name');
    const missingMeta: string[] = [];
    for (const s of (allSchools || []).slice(0, 20)) {
      const { count } = await supabase
        .from('survey_responses')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', s.id)
        .eq('is_public', true);
      if ((count || 0) > 0) {
        const { data: meta } = await supabase
          .from('school_ai_summaries')
          .select('id')
          .eq('school_id', s.id)
          .eq('kind', 'overall')
          .not('meta_title', 'is', null)
          .limit(1);
        if (!meta || meta.length === 0) {
          missingMeta.push(s.name);
        }
      }
    }
    if (missingMeta.length > 0) {
      console.log(`\n=== \u53E3\u30B3\u30DF\u3042\u308A\u3060\u304Cmeta\u672A\u8A2D\u5B9A ===`);
      missingMeta.forEach((n) => console.log(`  ${n}`));
    }
  }
}

check().catch(console.error);
