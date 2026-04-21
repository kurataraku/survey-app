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
    .select('id, name, intro, status')
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
    .select('school_id, kind, topic, status, meta_title, meta_description');

  const summaryMap = new Map<string, any[]>();
  (allSummaries || []).forEach((s: any) => {
    const arr = summaryMap.get(s.school_id) || [];
    arr.push(s);
    summaryMap.set(s.school_id, arr);
  });

  // --- Meta Title短い ---
  console.log('=== Meta Title 短い（28字未満） ===');
  const titleShort: { name: string; title: string; len: number; reviews: number }[] = [];
  for (const school of schoolsWithReviews) {
    const summaries = summaryMap.get(school.id) || [];
    const overall = summaries.find((s: any) => s.kind === 'overall' && s.topic === null && (s.status === 'published' || s.status === 'draft'));
    if (overall?.meta_title && overall.meta_title.length < 28) {
      titleShort.push({ name: school.name, title: overall.meta_title, len: overall.meta_title.length, reviews: countMap.get(school.id) || 0 });
    }
  }
  titleShort.sort((a, b) => a.len - b.len);
  console.log(`${titleShort.length}校:\n`);
  titleShort.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} (${s.len}字, 口コミ${s.reviews}件)`);
    console.log(`   "${s.title}"`);
  });

  // --- Meta Desc短い ---
  console.log('\n=== Meta Description 短い（100字未満） ===');
  const descShort: { name: string; desc: string; len: number; reviews: number }[] = [];
  for (const school of schoolsWithReviews) {
    const summaries = summaryMap.get(school.id) || [];
    const overall = summaries.find((s: any) => s.kind === 'overall' && s.topic === null && (s.status === 'published' || s.status === 'draft'));
    if (overall?.meta_description && overall.meta_description.length < 100) {
      descShort.push({ name: school.name, desc: overall.meta_description, len: overall.meta_description.length, reviews: countMap.get(school.id) || 0 });
    }
  }
  descShort.sort((a, b) => a.len - b.len);
  console.log(`${descShort.length}校:\n`);
  descShort.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} (${s.len}字, 口コミ${s.reviews}件)`);
    console.log(`   "${s.desc}"`);
  });

  // --- intro未設定 ---
  console.log('\n=== intro未設定 ===');
  const introMissing: { name: string; reviews: number }[] = [];
  for (const school of schoolsWithReviews) {
    if (!school.intro || school.intro.trim().length === 0) {
      introMissing.push({ name: school.name, reviews: countMap.get(school.id) || 0 });
    }
  }
  introMissing.sort((a, b) => b.reviews - a.reviews);
  console.log(`${introMissing.length}校:\n`);
  introMissing.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} (口コミ${s.reviews}件)`);
  });

  // --- SEO未公開 ---
  console.log('\n=== SEO未公開（draftのみでpublishedなし） ===');
  const seoUnpub: { name: string; topics: string[]; reviews: number }[] = [];
  for (const school of schoolsWithReviews) {
    const summaries = summaryMap.get(school.id) || [];
    const seoSections = summaries.filter((s: any) => s.kind === 'seo' && s.topic && s.topic !== 'faq');
    const unpubTopics: string[] = [];
    for (const key of SEO_KEYS) {
      const published = seoSections.find((s: any) => s.topic === key && s.status === 'published');
      const draft = seoSections.find((s: any) => s.topic === key && s.status === 'draft');
      if (draft && !published) {
        unpubTopics.push(key);
      }
    }
    // FAQもチェック
    const faqPub = summaries.find((s: any) => s.kind === 'seo' && s.topic === 'faq' && s.status === 'published');
    const faqDraft = summaries.find((s: any) => s.kind === 'seo' && s.topic === 'faq' && s.status === 'draft');
    if (faqDraft && !faqPub) unpubTopics.push('faq');

    if (unpubTopics.length > 0) {
      seoUnpub.push({ name: school.name, topics: unpubTopics, reviews: countMap.get(school.id) || 0 });
    }
  }
  console.log(`${seoUnpub.length}校:\n`);
  seoUnpub.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} (口コミ${s.reviews}件)`);
    console.log(`   未公開topic: ${s.topics.join(', ')}`);
  });
}

main().catch(console.error);
