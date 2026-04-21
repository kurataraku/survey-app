/**
 * school_ai_summaries の下書き（kind=overall, topic=null）を一括で公開する
 *
 * 使い方:
 *   npx tsx scripts/publish-draft-summaries.ts
 *   npx tsx scripts/publish-draft-summaries.ts --dry-run
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
  const dryRun = process.argv.includes('--dry-run');
  console.log('=== 下書き AI要約の一括公開 ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const { data: drafts, error: fetchError } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, kind, topic, status')
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'draft');

  if (fetchError || !drafts?.length) {
    console.log('対象の下書きはありません。', fetchError?.message || '');
    return;
  }

  console.log(`下書き件数: ${drafts.length}\n`);

  let ok = 0;
  let err = 0;

  for (const row of drafts) {
    if (!dryRun) {
      // 同一 school_id / kind / topic の既存 published を draft に戻す
      await supabase
        .from('school_ai_summaries')
        .update({ status: 'draft' })
        .eq('school_id', row.school_id)
        .eq('kind', 'overall')
        .is('topic', null)
        .eq('status', 'published');

      const { error: updateError } = await supabase
        .from('school_ai_summaries')
        .update({ status: 'published' })
        .eq('id', row.id);

      if (updateError) {
        console.log(`  ERROR: summary_id=${row.id} — ${updateError.message}`);
        err++;
      } else {
        console.log(`  OK: summary_id=${row.id} (school_id=${row.school_id})`);
        ok++;
      }
    } else {
      console.log(`  [DRY] would publish summary_id=${row.id} school_id=${row.school_id}`);
      ok++;
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`公開: ${ok}`);
  if (err > 0) console.log(`エラー: ${err}`);
  if (dryRun) console.log('\n※ DRY RUN のため実際の変更は行っていません。');
}

main().catch(console.error);
