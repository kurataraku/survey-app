/**
 * 直近の口コミ投稿数を集計
 * 実行: npx tsx scripts/recent-submissions-report.ts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jstDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id, created_at, moderation_status, is_public, school_name')
    .gte('created_at', daysAgoIso(21))
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const byDay = new Map<string, { total: number; pending: number; approved: number; rejected: number; public: number }>();

  for (const r of rows) {
    const key = jstDateKey(r.created_at);
    const bucket = byDay.get(key) ?? { total: 0, pending: 0, approved: 0, rejected: 0, public: 0 };
    bucket.total++;
    const status = r.moderation_status as 'pending' | 'approved' | 'rejected';
    bucket[status]++;
    if (r.is_public) bucket.public++;
    byDay.set(key, bucket);
  }

  const last7 = rows.filter((r) => r.created_at >= daysAgoIso(7));
  const prev7 = rows.filter((r) => r.created_at >= daysAgoIso(14) && r.created_at < daysAgoIso(7));

  console.log('=== 直近21日間 日別投稿数 (JST) ===');
  for (const day of [...byDay.keys()].sort().reverse()) {
    const b = byDay.get(day)!;
    console.log(
      `${day}: ${b.total}件 (承認待ち${b.pending} / 承認${b.approved} / 却下${b.rejected}, 公開${b.public})`
    );
  }

  console.log('\n=== 週次比較 ===');
  console.log(`直近7日: ${last7.length}件`);
  console.log(`その前7日: ${prev7.length}件`);
  console.log(`差分: ${last7.length - prev7.length}件`);

  console.log('\n=== 直近7日の投稿 (最新10件) ===');
  for (const r of last7.slice(0, 10)) {
    console.log(`${jstDateKey(r.created_at)} ${r.school_name} [${r.moderation_status}]`);
  }

  const { count: pendingTotal } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('moderation_status', 'pending');

  const { count: pendingVisible } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('moderation_status', 'pending')
    .gte('created_at', '2026-05-18T15:00:00.000Z');

  console.log('\n=== 承認待ち件数 ===');
  console.log(`DB全体: ${pendingTotal ?? 0}件`);
  console.log(`管理画面表示対象(5/19以降): ${pendingVisible ?? 0}件`);
  console.log(`非表示(5/18以前): ${(pendingTotal ?? 0) - (pendingVisible ?? 0)}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
