/**
 * ダミーデータ削除スクリプト
 * CSVファイルに含まれる学校のみを残し、それ以外の学校と関連データを削除します
 * 実行方法: npm run delete-dummy-data
 */

// 環境変数を読み込む（.env.localファイルから）
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import * as readline from 'readline';

// .env.localファイルを明示的に読み込む
config({ path: resolve(process.cwd(), '.env.local') });
import { normalizeText } from '../lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ユーザー確認用のreadlineインターフェース
let rl: readline.Interface | null = null;

function createReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

function question(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const readlineInterface = createReadline();
      readlineInterface.question(query, (answer) => {
        resolve(answer);
      });
    } catch (error) {
      // readlineが使用できない場合（非対話環境など）
      console.error('対話的な入力ができません。環境変数 CONFIRM_DELETE=yes を設定して実行してください。');
      reject(error);
    }
  });
}

function closeReadline() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

async function deleteDummyData() {
  try {
    console.log('========================================');
    console.log('ダミーデータ削除スクリプト');
    console.log('========================================\n');

    // 1. CSVファイルを読み込む
    const csvFileName = '20260108_通信制高校一覧（加工版）.csv';
    let csvPath: string;
    
    if (process.env.CSV_FILE_PATH) {
      csvPath = process.env.CSV_FILE_PATH;
    } else {
      const rootPath = join(process.cwd(), csvFileName);
      const defaultPath = join(process.cwd(), '..', 'Career Essence', '通信制メディア', csvFileName);
      
      try {
        readFileSync(rootPath, 'utf-8');
        csvPath = rootPath;
      } catch {
        csvPath = defaultPath;
      }
    }
    
    console.log(`CSVファイルを読み込み中: ${csvPath}`);
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    // ヘッダー行をスキップ
    const schoolNames = lines.slice(1).map(line => line.trim()).filter(name => name.length > 0);
    
    // CSVの学校名を正規化してセットに変換
    const csvNormalizedNames = new Set<string>();
    for (const schoolName of schoolNames) {
      if (!schoolName || schoolName === '学校名（ユニーク）') {
        continue;
      }
      const normalized = normalizeText(schoolName);
      csvNormalizedNames.add(normalized);
    }
    
    console.log(`CSVファイルから ${csvNormalizedNames.size} 件の学校名を読み込みました\n`);

    // 2. データベースから全学校を取得
    console.log('データベースから学校データを取得中...');
    const { data: allSchools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, name_normalized, status');
    
    if (schoolsError) {
      throw new Error(`学校データの取得に失敗しました: ${schoolsError.message}`);
    }
    
    if (!allSchools || allSchools.length === 0) {
      console.log('データベースに学校データが存在しません。');
      closeReadline();
      return;
    }
    
    console.log(`データベースに ${allSchools.length} 件の学校が存在します\n`);

    // 3. CSVに含まれる学校と削除対象の学校を特定
    const keepSchoolIds: string[] = [];
    const deleteSchoolIds: string[] = [];
    const deleteSchoolNames: string[] = [];
    
    for (const school of allSchools) {
      if (csvNormalizedNames.has(school.name_normalized)) {
        keepSchoolIds.push(school.id);
      } else {
        deleteSchoolIds.push(school.id);
        deleteSchoolNames.push(school.name);
      }
    }
    
    console.log('========================================');
    console.log('削除対象の確認');
    console.log('========================================');
    console.log(`保持する学校: ${keepSchoolIds.length} 件`);
    console.log(`削除対象の学校: ${deleteSchoolIds.length} 件\n`);
    
    if (deleteSchoolIds.length === 0) {
      console.log('削除対象の学校がありません。処理を終了します。');
      closeReadline();
      return;
    }
    
    // 4. 削除対象の学校に関連するデータを確認
    console.log('削除対象の学校に関連するデータを確認中...');
    
    // survey_responsesの確認
    const { data: relatedResponses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('id')
      .in('school_id', deleteSchoolIds);
    
    if (responsesError) {
      throw new Error(`口コミデータの確認に失敗しました: ${responsesError.message}`);
    }
    
    const relatedResponseCount = relatedResponses?.length || 0;
    console.log(`削除される口コミ: ${relatedResponseCount} 件`);
    
    // review_likesの確認（存在する場合）
    let relatedLikesCount = 0;
    try {
      const { data: relatedLikes } = await supabase
        .from('review_likes')
        .select('id')
        .in('review_id', relatedResponses?.map(r => r.id) || []);
      
      relatedLikesCount = relatedLikes?.length || 0;
      console.log(`削除されるいいね: ${relatedLikesCount} 件`);
    } catch (error) {
      // review_likesテーブルが存在しない場合は無視
      console.log('review_likesテーブルは存在しません（スキップ）');
    }
    
    // school_aliasesはCASCADEで自動削除されるため、確認のみ
    const { data: relatedAliases, error: aliasesError } = await supabase
      .from('school_aliases')
      .select('id')
      .in('school_id', deleteSchoolIds);
    
    if (aliasesError) {
      // school_aliasesテーブルが存在しない場合は無視
      console.log('school_aliasesテーブルは存在しません（スキップ）');
    } else {
      const relatedAliasesCount = relatedAliases?.length || 0;
      console.log(`削除される別名: ${relatedAliasesCount} 件（CASCADEで自動削除）`);
    }
    
    console.log('\n========================================');
    console.log('削除対象の学校一覧（最初の20件）');
    console.log('========================================');
    deleteSchoolNames.slice(0, 20).forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    if (deleteSchoolNames.length > 20) {
      console.log(`... 他 ${deleteSchoolNames.length - 20} 件`);
    }
    console.log('========================================\n');
    
    // 5. ユーザー確認
    console.log('⚠️  警告: この操作は不可逆的です。');
    console.log('削除前にSupabaseダッシュボードでバックアップを取得することを推奨します。\n');
    
    // 環境変数で確認をスキップできるようにする
    const confirmEnv = process.env.CONFIRM_DELETE;
    let shouldDelete = false;
    
    if (confirmEnv === 'yes' || confirmEnv === 'y') {
      console.log('環境変数 CONFIRM_DELETE=yes が設定されているため、削除を実行します。\n');
      shouldDelete = true;
    } else {
      try {
        const answer = await question('削除を実行しますか？ (y/n): ');
        shouldDelete = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      } catch (error) {
        console.error('\n対話的な入力ができませんでした。');
        console.error('環境変数 CONFIRM_DELETE=yes を設定して再実行してください。');
        console.error('例: CONFIRM_DELETE=yes npm run delete-dummy-data\n');
        closeReadline();
        return;
      }
    }
    
    if (!shouldDelete) {
      console.log('削除をキャンセルしました。');
      closeReadline();
      return;
    }
    
    // 6. 削除実行
    console.log('\n削除を実行中...');
    
    // 6-1. review_likesを削除（存在する場合）
    if (relatedLikesCount > 0) {
      try {
        const { error: likesError } = await supabase
          .from('review_likes')
          .delete()
          .in('review_id', relatedResponses?.map(r => r.id) || []);
        
        if (likesError) {
          console.warn(`いいねの削除でエラーが発生しました（続行）: ${likesError.message}`);
        } else {
          console.log(`✓ いいね ${relatedLikesCount} 件を削除しました`);
        }
      } catch (error) {
        console.warn('いいねの削除をスキップしました');
      }
    }
    
    // 6-2. survey_responsesを削除
    if (relatedResponseCount > 0) {
      const { error: responsesDeleteError } = await supabase
        .from('survey_responses')
        .delete()
        .in('school_id', deleteSchoolIds);
      
      if (responsesDeleteError) {
        throw new Error(`口コミの削除に失敗しました: ${responsesDeleteError.message}`);
      }
      console.log(`✓ 口コミ ${relatedResponseCount} 件を削除しました`);
    }
    
    // 6-3. schoolsを削除（school_aliasesはCASCADEで自動削除）
    const { error: schoolsDeleteError } = await supabase
      .from('schools')
      .delete()
      .in('id', deleteSchoolIds);
    
    if (schoolsDeleteError) {
      throw new Error(`学校の削除に失敗しました: ${schoolsDeleteError.message}`);
    }
    console.log(`✓ 学校 ${deleteSchoolIds.length} 件を削除しました`);
    
    // 7. 削除後の確認
    console.log('\n========================================');
    console.log('削除後の確認');
    console.log('========================================');
    
    const { data: remainingSchools, error: remainingError } = await supabase
      .from('schools')
      .select('id');
    
    if (remainingError) {
      console.warn(`確認クエリでエラーが発生しました: ${remainingError.message}`);
    } else {
      console.log(`残存する学校: ${remainingSchools?.length || 0} 件`);
    }
    
    console.log('\n========================================');
    console.log('削除処理が完了しました！');
    console.log('========================================');
    
    closeReadline();
  } catch (error) {
    console.error('\n========================================');
    console.error('エラーが発生しました');
    console.error('========================================');
    console.error(error instanceof Error ? error.message : String(error));
    closeReadline();
    process.exit(1);
  }
}

// スクリプト実行
deleteDummyData();
