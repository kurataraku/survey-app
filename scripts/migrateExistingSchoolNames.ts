/**
 * 既存のsurvey_responses.school_nameからschoolsテーブルへの移行スクリプト
 * 実行方法: npm run migrate:schools
 * 
 * 注意: このスクリプトは既存データがある場合のみ実行してください。
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeText, generateSlug } from '../lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateSchoolNames() {
  try {
    console.log('既存のschool_nameを集計中...');

    // 既存のschool_nameを集計
    const { data: responses, error: fetchError } = await supabase
      .from('survey_responses')
      .select('school_name, school_id')
      .not('school_name', 'is', null);

    if (fetchError) {
      throw new Error(`データ取得エラー: ${fetchError.message}`);
    }

    if (!responses || responses.length === 0) {
      console.log('移行するデータがありません');
      return;
    }

    console.log(`${responses.length}件の回答を処理します`);

    // school_nameを正規化してグループ化
    const schoolNameMap = new Map<string, { name: string; count: number; school_id: string | null }>();

    for (const response of responses) {
      if (!response.school_name) continue;

      const normalized = normalizeText(response.school_name);
      const existing = schoolNameMap.get(normalized);

      if (existing) {
        existing.count++;
        // school_idが既に設定されている場合は保持
        if (response.school_id && !existing.school_id) {
          existing.school_id = response.school_id;
        }
      } else {
        schoolNameMap.set(normalized, {
          name: response.school_name,
          count: 1,
          school_id: response.school_id || null,
        });
      }
    }

    console.log(`${schoolNameMap.size}種類の学校名が見つかりました`);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // 各学校名をschoolsテーブルに登録
    for (const [normalized, data] of schoolNameMap.entries()) {
      try {
        if (data.school_id) {
          // 既にschool_idが設定されている場合はスキップ
          console.log(`スキップ: ${data.name} (既にschool_idが設定済み)`);
          continue;
        }

        // 既存の学校を検索
        const { data: existingSchool } = await supabase
          .from('schools')
          .select('id')
          .eq('name_normalized', normalized)
          .single();

        let schoolId: string;

        if (existingSchool) {
          schoolId = existingSchool.id;
          console.log(`既存: ${data.name} (ID: ${existingSchool.id})`);
        } else {
          // 新規作成
          const slug = generateSlug(data.name);
          const { data: newSchool, error: createError } = await supabase
            .from('schools')
            .insert({
              name: data.name,
              name_normalized: normalized,
              prefecture: '不明',
              prefectures: ['不明'],
              slug: slug,
              status: 'active',
              is_public: true,
            })
            .select('id')
            .single();

          if (createError) {
            throw new Error(`学校作成エラー: ${createError.message}`);
          }

          schoolId = newSchool.id;
          createdCount++;
          console.log(`作成: ${data.name} (ID: ${newSchool.id}, ${data.count}件の回答)`);
        }

        // survey_responsesのschool_idを更新
        const { error: updateError } = await supabase
          .from('survey_responses')
          .update({ school_id: schoolId })
          .eq('school_name', data.name)
          .is('school_id', null);

        if (updateError) {
          throw new Error(`更新エラー: ${updateError.message}`);
        }

        updatedCount += data.count;
      } catch (error) {
        console.error(`エラー: ${data.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    console.log('\n=== 移行結果 ===');
    console.log(`新規作成: ${createdCount}件`);
    console.log(`更新: ${updatedCount}件の回答`);
    console.log(`エラー: ${errorCount}件`);
  } catch (error) {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  }
}

migrateSchoolNames();

