/**
 * 学校マージ処理のデバッグスクリプト
 * 本番反映前に、マージ対象の件数と更新内容を確認できます。
 *
 * 使い方:
 *   npx tsx scripts/debug-merge.ts <統合元の学校ID> <統合先の学校ID>
 *   npx tsx scripts/debug-merge.ts <統合元の学校ID> <統合先の学校ID> --execute  # 実際に更新（ローカル/検証用）
 *
 * 例:
 *   npx tsx scripts/debug-merge.ts "uuid-of-ktc" "uuid-of-oozora"
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const args = process.argv.slice(2);
  const sourceId = args[0];
  const targetId = args[1];
  const execute = args.includes('--execute');

  if (!sourceId || !targetId) {
    console.error('使い方: npx tsx scripts/debug-merge.ts <統合元の学校ID> <統合先の学校ID> [--execute]');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください（.env.local）');
    process.exit(1);
  }

  if (sourceId === targetId) {
    console.error('統合元と統合先が同じです。');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== マージ デバッグ ===\n');

  // 統合元・統合先の学校取得
  const { data: sourceSchool, error: sourceError } = await supabase
    .from('schools')
    .select('id, name, status')
    .eq('id', sourceId)
    .single();

  if (sourceError || !sourceSchool) {
    console.error('統合元の学校が見つかりません:', sourceError?.message || '');
    process.exit(1);
  }

  const { data: targetSchool, error: targetError } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', targetId)
    .single();

  if (targetError || !targetSchool) {
    console.error('統合先の学校が見つかりません:', targetError?.message || '');
    process.exit(1);
  }

  console.log('統合元:', sourceSchool.name, `(id: ${sourceSchool.id}, status: ${sourceSchool.status})`);
  console.log('統合先:', targetSchool.name, `(id: ${targetSchool.id})\n`);

  // 2a: school_id が統合元のレコード数
  const { count: countBySchoolId, error: err1 } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', sourceId);

  if (err1) {
    console.error('survey_responses 取得エラー (school_id):', err1.message);
    process.exit(1);
  }
  console.log(`[2a] school_id = 統合元 の口コミ数: ${countBySchoolId ?? 0} 件`);

  // 2b: school_id が null かつ school_name が統合元のレコード数
  const { count: countByName, error: err2 } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .is('school_id', null)
    .eq('school_name', sourceSchool.name);

  if (err2) {
    console.error('survey_responses 取得エラー (school_name):', err2.message);
    process.exit(1);
  }
  console.log(`[2b] school_id IS NULL AND school_name = 統合元 の口コミ数: ${countByName ?? 0} 件`);

  const totalMoved = (countBySchoolId ?? 0) + (countByName ?? 0);
  console.log(`\n→ マージ後に統合先に移動する口コミ: 合計 ${totalMoved} 件`);
  console.log(`→ 統合先「${targetSchool.name}」の口コミ一覧は school_name で検索するため、両方の更新で school_name を「${targetSchool.name}」に揃える必要があります。\n`);

  if (!execute) {
    console.log('実際の更新は行っていません。実行するには --execute を付けてください。');
    return;
  }

  console.log('--- --execute: 更新を実行します ---\n');

  // 2a
  const { error: updateError } = await supabase
    .from('survey_responses')
    .update({ school_id: targetId, school_name: targetSchool.name })
    .eq('school_id', sourceId);

  if (updateError) {
    console.error('2a 更新エラー:', updateError.message);
    process.exit(1);
  }
  console.log('2a: school_id=統合元 のレコードを更新しました。');

  // 2b
  const { error: updateByNameError } = await supabase
    .from('survey_responses')
    .update({ school_id: targetId, school_name: targetSchool.name })
    .is('school_id', null)
    .eq('school_name', sourceSchool.name);

  if (updateByNameError) {
    console.error('2b 更新エラー:', updateByNameError.message);
    process.exit(1);
  }
  console.log('2b: school_id IS NULL & school_name=統合元 のレコードを更新しました。');

  // 統合元の status を merged に（スクリプトでは省略可能。API経由でマージする想定ならここではやらない）
  console.log('\n※ 学校の status を "merged" に変更する処理は API 経由で行ってください。');
  console.log('デバッグ用にここでは survey_responses の更新のみ実行しました。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
