/**
 * Perplexity 生成の summary_text を schools.intro に移動し、
 * summary_text をリセットするマイグレーションスクリプト
 *
 * 使い方:
 *   npx tsx scripts/migrate-summary-to-intro.ts
 *   npx tsx scripts/migrate-summary-to-intro.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KUCHIKOMI_KEYWORDS = [
  'この学校が合う人',
  '口コミ・評判をもとに',
  '※本ページの口コミ',
  'この学校が合わない人',
];

function isKuchikomiBased(text: string): boolean {
  return KUCHIKOMI_KEYWORDS.some((kw) => text.includes(kw));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== Perplexity summary_text → schools.intro マイグレーション ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // 1. overall の summary_text を全件取得
  const { data: allOverall, error: fetchError } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, summary_text, status')
    .eq('kind', 'overall')
    .is('topic', null)
    .not('summary_text', 'is', null)
    .neq('summary_text', '');

  if (fetchError || !allOverall) {
    console.error('データ取得エラー:', fetchError?.message);
    return;
  }

  // 2. Perplexity 由来のレコードを抽出
  const perplexityRecords = allOverall.filter(
    (d) => d.summary_text && d.summary_text.length > 50 && !isKuchikomiBased(d.summary_text)
  );
  const kuchikomiRecords = allOverall.filter(
    (d) => d.summary_text && isKuchikomiBased(d.summary_text)
  );

  console.log(`全 overall レコード: ${allOverall.length}`);
  console.log(`  口コミベース: ${kuchikomiRecords.length} (そのまま維持)`);
  console.log(`  Perplexityベース: ${perplexityRecords.length} (移行対象)\n`);

  // 3. バックアップ CSV 出力
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const backupPath = path.join(logDir, 'backup-perplexity-summary.csv');
  const csvHeader = 'school_id,summary_id,status,summary_text_length,summary_text_preview\n';
  const csvRows = perplexityRecords.map((d) => {
    const preview = (d.summary_text || '').replace(/[\r\n,]/g, ' ').slice(0, 100);
    return `${d.school_id},${d.id},${d.status},${(d.summary_text || '').length},"${preview}"`;
  });
  fs.writeFileSync(backupPath, csvHeader + csvRows.join('\n'), 'utf-8');
  console.log(`バックアップ: ${backupPath}\n`);

  // 4. 各レコードを処理
  let movedCount = 0;
  let skippedIntroExists = 0;
  let errorCount = 0;

  for (const record of perplexityRecords) {
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, intro')
      .eq('id', record.school_id)
      .single();

    if (!school) {
      console.log(`  SKIP: school not found (${record.school_id})`);
      errorCount++;
      continue;
    }

    const label = school.name.slice(0, 30);

    if (school.intro && school.intro.trim().length > 0) {
      // intro は既にあるので summary_text のリセットだけ行う
      if (!dryRun) {
        const { error: resetErr } = await supabase
          .from('school_ai_summaries')
          .update({ summary_text: '' })
          .eq('id', record.id);
        if (resetErr) {
          console.log(`  ERROR: ${label} — summary_text リセット失敗: ${resetErr.message}`);
          errorCount++;
          continue;
        }
      }
      console.log(`  RESET: ${label} — intro既存, summary_text をリセット`);
      skippedIntroExists++;
      continue;
    }

    if (!dryRun) {
      // schools.intro に移動
      const { error: introError } = await supabase
        .from('schools')
        .update({ intro: record.summary_text })
        .eq('id', record.school_id);

      if (introError) {
        console.log(`  ERROR: ${label} — intro 更新失敗: ${introError.message}`);
        errorCount++;
        continue;
      }

      // summary_text をリセット（NOT NULL 制約のため空文字列）
      const { error: resetError } = await supabase
        .from('school_ai_summaries')
        .update({ summary_text: '' })
        .eq('id', record.id);

      if (resetError) {
        console.log(`  ERROR: ${label} — summary_text リセット失敗: ${resetError.message}`);
        errorCount++;
        continue;
      }
    }

    console.log(`  OK: ${label} — ${(record.summary_text || '').length}字 → schools.intro`);
    movedCount++;
  }

  console.log(`\n=== 結果 ===`);
  console.log(`移行完了: ${movedCount}`);
  console.log(`スキップ (intro既存): ${skippedIntroExists}`);
  console.log(`エラー: ${errorCount}`);
  console.log(`口コミベース (変更なし): ${kuchikomiRecords.length}`);

  if (dryRun) {
    console.log('\n※ DRY RUN のため実際の変更は行われていません');
  }
}

main().catch(console.error);
