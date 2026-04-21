import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // テーブルに直接insertテスト
  const testSchoolId = 'a168195e-b691-4cf5-be91-e024b356d292'; // R高等学校

  console.log('review_tendency テーブルの全レコード数を確認...');
  const { count, error: countError } = await supabase
    .from('review_tendency')
    .select('*', { count: 'exact', head: true });
  console.log(`count: ${count}, error: ${countError?.message || 'なし'}`);

  // テーブルのカラム構造を確認するため、空のselectを試す
  const { data: sample, error: sampleError } = await supabase
    .from('review_tendency')
    .select('*')
    .limit(1);
  console.log(`sample: ${JSON.stringify(sample)}`);
  console.log(`sampleError: ${sampleError?.message || 'なし'}`);

  // テスト insert
  console.log('\nテストinsertを試行...');
  const payload = {
    school_id: testSchoolId,
    status: 'draft',
    summary_text: JSON.stringify({
      good_points: ['テスト良い点1', 'テスト良い点2', 'テスト良い点3'],
      improvement_points: ['テスト改善点1', 'テスト改善点2', 'テスト改善点3'],
    }),
    reviews_count_used: 1,
    generated_at: new Date().toISOString(),
  };
  console.log('payload:', JSON.stringify(payload, null, 2));

  const { data: insertResult, error: insertError } = await supabase
    .from('review_tendency')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    console.log(`INSERT ERROR: ${insertError.message}`);
    console.log(`details: ${JSON.stringify(insertError)}`);
  } else {
    console.log(`INSERT OK: id=${insertResult?.id}`);
    // テストデータを削除
    await supabase.from('review_tendency').delete().eq('id', insertResult.id);
    console.log('テストデータ削除完了');
  }
}

main().catch(console.error);
