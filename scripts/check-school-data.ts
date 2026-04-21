/**
 * 特定学校の全AI生成データを詳細確認
 *   npx tsx scripts/check-school-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // R高等学校を検索
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, prefecture, slug, intro, status')
    .like('name', '%R高等学校%');

  if (!schools?.length) {
    console.log('R高等学校が見つかりません');
    return;
  }

  for (const school of schools) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`学校名: ${school.name}`);
    console.log(`ID: ${school.id}`);
    console.log(`都道府県: ${school.prefecture || '未設定'}`);
    console.log(`スラグ: ${school.slug || '未設定'}`);
    console.log(`intro: ${school.intro ? `${school.intro.length}字` : '未設定'}`);
    console.log(`status: ${school.status}`);

    // 口コミ数
    const { count: reviewCount } = await supabase
      .from('survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school.id)
      .eq('is_public', true);
    console.log(`口コミ数: ${reviewCount || 0}`);

    // school_ai_summaries 全件
    const { data: summaries } = await supabase
      .from('school_ai_summaries')
      .select('id, kind, topic, status, summary_text, meta_title, meta_description, reviews_count_used, generated_at')
      .eq('school_id', school.id)
      .order('kind')
      .order('topic');

    console.log(`\n--- school_ai_summaries (${summaries?.length || 0}件) ---`);
    if (summaries) {
      for (const s of summaries) {
        const textLen = (s.summary_text || '').length;
        const titleLen = (s.meta_title || '').length;
        const descLen = (s.meta_description || '').length;
        console.log(`  kind=${s.kind} topic=${s.topic || 'null'} status=${s.status}`);
        console.log(`    summary_text: ${textLen}字${textLen > 0 ? ` "${(s.summary_text || '').replace(/[\r\n]+/g, ' ').slice(0, 80)}..."` : ' (空)'}`);
        console.log(`    meta_title: ${titleLen}字 "${s.meta_title || ''}"`);
        console.log(`    meta_description: ${descLen}字 "${(s.meta_description || '').slice(0, 80)}"`);
        console.log(`    reviews_count_used: ${s.reviews_count_used} generated: ${s.generated_at}`);
      }
    }

    // review_tendency
    const { data: tendencies } = await supabase
      .from('review_tendency')
      .select('id, status, summary_text, reviews_count_used, generated_at')
      .eq('school_id', school.id);

    console.log(`\n--- review_tendency (${tendencies?.length || 0}件) ---`);
    if (tendencies) {
      for (const t of tendencies) {
        console.log(`  status=${t.status} reviews_count_used=${t.reviews_count_used}`);
        console.log(`    summary_text: ${(t.summary_text || '').length}字`);
      }
    }
  }
}

main().catch(console.error);
