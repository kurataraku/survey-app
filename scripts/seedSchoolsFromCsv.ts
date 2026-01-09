/**
 * CSVから学校データを投入するスクリプト（バッチ処理対応版）
 * 実行方法: npm run seed:schools
 * 
 * 環境変数:
 * - CSV_FILE_PATH: CSVファイルのパス（オプション）
 * - BATCH_SIZE: バッチサイズ（デフォルト: 100）
 */

// 環境変数を読み込む（.env.localファイルから）
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

// .env.localファイルを明示的に読み込む
config({ path: resolve(process.cwd(), '.env.local') });
import { normalizeText, generateSlug } from '../lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// バッチサイズ（環境変数で指定可能、デフォルト: 100）
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

interface SchoolData {
  name: string;
  nameNormalized: string;
  slug: string;
}

/**
 * CSVファイルから学校名リストを抽出
 */
function parseCsvFile(csvPath: string): string[] {
  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      // ファイルが見つからない場合、プロジェクトルートを直接試す
      const scriptDir = __dirname;
      const projectRoot = resolve(scriptDir, '..');
      const fallbackPath = join(projectRoot, '20260109_サポート校追加リスト.csv');
      try {
        csvContent = readFileSync(fallbackPath, 'utf-8');
        console.log(`フォールバックパスを使用: ${fallbackPath}`);
      } catch (fallbackError: any) {
        throw new Error(`CSVファイルが見つかりません。\n試行したパス:\n  1. ${csvPath}\n  2. ${fallbackPath}\n\nプロジェクトルートに "20260109_サポート校追加リスト.csv" を配置するか、環境変数 CSV_FILE_PATH でパスを指定してください。`);
      }
    } else {
      throw error;
    }
  }
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    throw new Error('CSVファイルが空です');
  }

  // ヘッダー行の検出とスキップ
  // 「学校名」「学校名（ユニーク）」「サポート校名」などを検出
  const headerPatterns = [
    /^学校名/,
    /^サポート校名/,
    /^名称/,
  ];
  
  let startIndex = 0;
  const firstLine = lines[0];
  const isHeader = headerPatterns.some(pattern => pattern.test(firstLine));
  
  if (isHeader) {
    console.log(`ヘッダー行を検出: "${firstLine}"`);
    startIndex = 1;
  }

  // データ行を抽出
  const schoolNames = lines.slice(startIndex)
    .map(line => line.trim())
    .filter(name => name.length > 0 && name !== '学校名（ユニーク）');

  return schoolNames;
}

/**
 * 既存の学校データを一括取得（重複チェック用）
 */
async function getExistingSchools(): Promise<Set<string>> {
  console.log('既存の学校データを取得中...');
  const { data: existingSchools, error } = await supabase
    .from('schools')
    .select('name_normalized');

  if (error) {
    console.error('既存データの取得エラー:', error.message);
    throw error;
  }

  const normalizedNames = new Set<string>();
  if (existingSchools) {
    existingSchools.forEach(school => {
      if (school.name_normalized) {
        normalizedNames.add(school.name_normalized);
      }
    });
  }

  console.log(`既存データ: ${normalizedNames.size}件`);
  return normalizedNames;
}

/**
 * 学校データを準備（重複チェック済み）
 */
function prepareSchoolData(
  schoolNames: string[],
  existingNormalizedNames: Set<string>
): SchoolData[] {
  const newSchools: SchoolData[] = [];

  for (const schoolName of schoolNames) {
    if (!schoolName || schoolName.trim().length === 0) {
      continue;
    }

    const nameNormalized = normalizeText(schoolName);
    
    // 重複チェック
    if (existingNormalizedNames.has(nameNormalized)) {
      continue; // 重複はスキップ（後でカウント）
    }

    const slug = generateSlug(schoolName);
    newSchools.push({
      name: schoolName,
      nameNormalized,
      slug,
    });
  }

  return newSchools;
}

/**
 * バッチ処理で学校データをINSERT
 */
async function insertSchoolsBatch(schools: SchoolData[]): Promise<{ success: number; errors: Array<{ name: string; error: string }> }> {
  const insertData = schools.map(school => ({
    name: school.name,
    name_normalized: school.nameNormalized,
    prefecture: '不明',
    prefectures: ['不明'],
    slug: school.slug,
    status: 'active' as const,
    is_public: true,
  }));

  const { data, error } = await supabase
    .from('schools')
    .insert(insertData)
    .select('id, name');

  if (error) {
    // エラーが発生した場合、個別にエラーを返す
    return {
      success: 0,
      errors: schools.map(school => ({ name: school.name, error: error.message })),
    };
  }

  return {
    success: data?.length || 0,
    errors: [],
  };
}

/**
 * メイン処理
 */
async function seedSchools() {
  const startTime = Date.now();
  
  try {
    // CSVファイルのパスを取得
    let csvPath: string;
    const csvFileName = '20260109_サポート校追加リスト.csv';
    
    if (process.env.CSV_FILE_PATH) {
      csvPath = process.env.CSV_FILE_PATH;
    } else {
      // プロジェクトルートを優先（スクリプトのディレクトリから相対パスで解決）
      // scripts/seedSchoolsFromCsv.ts から見て、プロジェクトルートは1つ上
      const scriptDir = __dirname;
      const projectRoot = resolve(scriptDir, '..');
      csvPath = join(projectRoot, csvFileName);
    }

    // CSVファイルをパース
    console.log(`CSVファイルを読み込み中...`);
    const schoolNames = parseCsvFile(csvPath);
    console.log(`\n${schoolNames.length}件の学校名を読み込みました\n`);

    if (schoolNames.length === 0) {
      console.log('処理するデータがありません');
      return;
    }

    // 既存データを一括取得
    const existingNormalizedNames = await getExistingSchools();

    // 新規データのみを抽出
    const newSchools = prepareSchoolData(schoolNames, existingNormalizedNames);
    const skipCount = schoolNames.length - newSchools.length;

    console.log(`新規追加対象: ${newSchools.length}件`);
    console.log(`既存データ（スキップ）: ${skipCount}件\n`);

    if (newSchools.length === 0) {
      console.log('新規追加するデータがありません');
      return;
    }

    // バッチ処理
    let successCount = 0;
    let errorCount = 0;
    const allErrors: Array<{ name: string; error: string }> = [];

    const totalBatches = Math.ceil(newSchools.length / BATCH_SIZE);
    console.log(`バッチサイズ: ${BATCH_SIZE}件`);
    console.log(`バッチ数: ${totalBatches}件\n`);

    for (let i = 0; i < newSchools.length; i += BATCH_SIZE) {
      const batch = newSchools.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const progress = `[${Math.min(i + BATCH_SIZE, newSchools.length)}/${newSchools.length}]`;

      console.log(`${progress} バッチ ${batchNumber}/${totalBatches} 処理中...`);

      try {
        const result = await insertSchoolsBatch(batch);
        successCount += result.success;
        errorCount += result.errors.length;
        allErrors.push(...result.errors);

        if (result.success > 0) {
          console.log(`  ✓ ${result.success}件を追加しました`);
        }
        if (result.errors.length > 0) {
          console.log(`  ✗ ${result.errors.length}件でエラーが発生しました`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ✗ バッチ処理エラー: ${errorMessage}`);
        errorCount += batch.length;
        batch.forEach(school => {
          allErrors.push({ name: school.name, error: errorMessage });
        });
      }
    }

    // 結果サマリー
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('=== 投入結果 ===');
    console.log('='.repeat(50));
    console.log(`成功: ${successCount}件`);
    console.log(`スキップ（既存）: ${skipCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計: ${schoolNames.length}件`);
    console.log(`処理時間: ${duration}秒`);
    console.log('='.repeat(50));

    // エラー詳細
    if (allErrors.length > 0) {
      console.log('\n=== エラー詳細 ===');
      allErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.name}: ${err.error}`);
      });
    }
  } catch (error) {
    console.error('\nスクリプト実行エラー:', error);
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('スタックトレース:', error.stack);
    }
    process.exit(1);
  }
}

seedSchools();
