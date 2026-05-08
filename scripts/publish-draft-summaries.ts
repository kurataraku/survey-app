/**
 * school_ai_summaries の下書き（status=draft、全 kind / topic）を一括で公開する
 * 管理画面の「公開」と同じ2段階（同一 school/kind/topic の published → draft、対象行 → published）
 *
 * 使い方:
 *   npx tsx scripts/publish-draft-summaries.ts
 *   npx tsx scripts/publish-draft-summaries.ts --dry-run
 *   npx tsx scripts/publish-draft-summaries.ts --kind=overall   # overall + topic=null のみ（従来相当）
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DraftRow = {
  id: string;
  school_id: string;
  kind: string;
  topic: string | null;
  status: string;
};

function parseArgs(): { dryRun: boolean; kindOverallOnly: boolean } {
  const dryRun = process.argv.includes('--dry-run');
  const kindOverallOnly = process.argv.some((a) => a === '--kind=overall');
  return { dryRun, kindOverallOnly };
}

async function publishDraftRow(db: SupabaseClient, row: DraftRow): Promise<{ ok: true } | { ok: false; message: string }> {
  let unpublish = db
    .from('school_ai_summaries')
    .update({ status: 'draft' })
    .eq('school_id', row.school_id)
    .eq('kind', row.kind || 'overall')
    .eq('status', 'published');
  unpublish = row.topic == null ? unpublish.is('topic', null) : unpublish.eq('topic', row.topic);
  const { error: unpublishError } = await unpublish;
  if (unpublishError) {
    console.warn(`  WARN unpublish sibling: ${unpublishError.message}`);
  }

  const { error: publishError } = await db
    .from('school_ai_summaries')
    .update({ status: 'published' })
    .eq('id', row.id);

  if (publishError) {
    return { ok: false, message: publishError.message };
  }
  return { ok: true };
}

async function main() {
  const { dryRun, kindOverallOnly } = parseArgs();
  console.log('=== school_ai_summaries 下書きの一括公開 ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Scope: ${kindOverallOnly ? 'kind=overall & topic=null のみ' : '全 kind / topic'}\n`);

  let q = supabase.from('school_ai_summaries').select('id, school_id, kind, topic, status').eq('status', 'draft');
  if (kindOverallOnly) {
    q = q.eq('kind', 'overall').is('topic', null);
  }
  const { data: drafts, error: fetchError } = await q.order('school_id', { ascending: true });

  if (fetchError) {
    console.error('取得エラー:', fetchError.message);
    process.exit(1);
  }
  if (!drafts?.length) {
    console.log('対象の下書きはありません。');
    return;
  }

  console.log(`下書き件数: ${drafts.length}\n`);

  let ok = 0;
  let err = 0;

  for (const row of drafts as DraftRow[]) {
    const topicLabel = row.topic == null ? '(null)' : JSON.stringify(row.topic);
    if (dryRun) {
      console.log(`  [DRY] ${row.id} school=${row.school_id} kind=${row.kind} topic=${topicLabel}`);
      ok++;
      continue;
    }

    const result = await publishDraftRow(supabase, row);
    if (result.ok) {
      console.log(`  OK: ${row.id} school=${row.school_id} kind=${row.kind} topic=${topicLabel}`);
      ok++;
    } else {
      console.log(`  ERROR: ${row.id} — ${result.message}`);
      err++;
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`処理試行: ${drafts.length} / 成功: ${ok} / 失敗: ${err}`);
  if (dryRun) console.log('\n※ DRY RUN のため実際の変更は行っていません。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
