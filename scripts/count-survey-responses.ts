/**
 * 口コミアンケート完了件数を取得するスクリプト
 * 実行方法: npx tsx scripts/count-survey-responses.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function countSurveyResponses() {
  try {
    // 全体の件数（公開・非公開含む全ての完了アンケート）
    const { count: totalCount, error: totalError } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`件数の取得に失敗しました: ${totalError.message}`);
    }

    // 公開中の口コミ件数（is_public = true）
    const { count: publicCount, error: publicError } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true);

    if (publicError) {
      // is_publicカラムが存在しない場合（古いスキーマ）は無視
      console.log('\n口コミアンケート 完了件数:');
      console.log('---------------------------');
      console.log(`合計: ${totalCount ?? 0} 件`);
      console.log('\n※ is_publicカラムが存在しないため、公開/非公開の内訳は取得できませんでした。');
      return;
    }

    console.log('\n通信制高校リアルレビュー 口コミアンケート 完了件数');
    console.log('================================================');
    console.log(`合計: ${totalCount ?? 0} 件`);
    console.log(`  - 公開中: ${publicCount ?? 0} 件`);
    console.log(`  - 非公開: ${(totalCount ?? 0) - (publicCount ?? 0)} 件`);
    console.log('');
  } catch (error) {
    console.error('エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

countSurveyResponses();
