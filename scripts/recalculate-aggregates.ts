/**
 * 集計データの再計算スクリプト
 * ダミーデータ削除後に実行
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function recalculateAggregates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('環境変数が設定されていません');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('集計データの再計算を開始...');

  // 1. 学校ごとの口コミ数と平均評価を再計算
  const { data: schools, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name');

  if (schoolsError) {
    throw new Error(`学校一覧の取得に失敗しました: ${schoolsError.message}`);
  }

  if (!schools || schools.length === 0) {
    console.log('学校が見つかりませんでした');
    return;
  }

  console.log(`${schools.length}件の学校を処理します...`);

  let successCount = 0;
  let errorCount = 0;

  for (const school of schools) {
    try {
      // 口コミ数と平均評価を計算
      const { data: reviews, error: reviewsError } = await supabase
        .from('survey_responses')
        .select('overall_satisfaction')
        .eq('school_id', school.id)
        .eq('is_public', true)
        .not('overall_satisfaction', 'is', null)
        .gte('overall_satisfaction', 1)
        .lte('overall_satisfaction', 5);

      if (reviewsError) {
        console.error(`学校 ${school.name} (${school.id}) の口コミ取得エラー:`, reviewsError.message);
        errorCount++;
        continue;
      }

      const reviewCount = reviews?.length || 0;
      const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) / reviews.length
        : null;

      // 学校テーブルを更新
      // 注意: review_count, overall_avgカラムが存在する場合のみ更新
      const { error: updateError } = await supabase
        .from('schools')
        .update({
          review_count: reviewCount,
          overall_avg: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
        })
        .eq('id', school.id);

      if (updateError) {
        // カラムが存在しない場合は無視（後方互換性）
        if (updateError.code === '42703') {
          console.warn(`学校 ${school.name} (${school.id}): review_count/overall_avgカラムが存在しません`);
        } else {
          console.error(`学校 ${school.name} (${school.id}) の更新エラー:`, updateError.message);
          errorCount++;
          continue;
        }
      } else {
        console.log(`✓ 学校 ${school.name}: 口コミ数=${reviewCount}, 平均評価=${avgRating?.toFixed(2) || 'N/A'}`);
        successCount++;
      }
    } catch (error) {
      console.error(`学校 ${school.name} (${school.id}) の処理エラー:`, error);
      errorCount++;
    }
  }

  console.log('\n集計データの再計算が完了しました');
  console.log(`成功: ${successCount}件, エラー: ${errorCount}件`);
}

recalculateAggregates().catch((error) => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});
