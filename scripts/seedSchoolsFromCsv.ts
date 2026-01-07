/**
 * CSVから学校データを投入するスクリプト
 * 実行方法: npm run seed:schools
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeText, generateSlug } from '../lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedSchools() {
  try {
    // CSVファイルを読み込み
    const csvPath = join(process.cwd(), '..', 'Career Essence', '通信制メディア', '20260108_通信制高校一覧（加工版）.csv');
    console.log(`CSVファイルを読み込み中: ${csvPath}`);
    
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    // ヘッダー行をスキップ
    const schoolNames = lines.slice(1).map(line => line.trim()).filter(name => name.length > 0);
    
    console.log(`${schoolNames.length}件の学校名を読み込みました`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const schoolName of schoolNames) {
      if (!schoolName || schoolName === '学校名（ユニーク）') {
        continue;
      }

      try {
        const nameNormalized = normalizeText(schoolName);
        
        // 既存チェック
        const { data: existing } = await supabase
          .from('schools')
          .select('id')
          .eq('name_normalized', nameNormalized)
          .single();

        if (existing) {
          console.log(`スキップ: ${schoolName} (既に存在)`);
          skipCount++;
          continue;
        }

        // 新規作成
        const slug = generateSlug(schoolName);
        const { data: newSchool, error } = await supabase
          .from('schools')
          .insert({
            name: schoolName,
            name_normalized: nameNormalized,
            prefecture: '不明', // CSVに都道府県情報がないため
            prefectures: ['不明'],
            slug: slug,
            status: 'active',
            is_public: true,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`エラー: ${schoolName} - ${error.message}`);
          errorCount++;
        } else {
          console.log(`追加: ${schoolName} (ID: ${newSchool.id})`);
          successCount++;
        }
      } catch (error) {
        console.error(`エラー: ${schoolName} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    console.log('\n=== 投入結果 ===');
    console.log(`成功: ${successCount}件`);
    console.log(`スキップ: ${skipCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計: ${schoolNames.length}件`);
  } catch (error) {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  }
}

seedSchools();

