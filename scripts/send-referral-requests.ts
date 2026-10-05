/**
 * 過去の回答者（承認済み）に、お知り合いへの紹介をお願いするメールを送る CLI
 *
 * 使い方:
 *   npm run referral:send-requests -- --dry-run                     # 対象件数とサンプルを表示（送信・DB書き込みなし）
 *   npm run referral:send-requests -- --test-to=you@example.com     # 自分宛てにテスト送信（1通）
 *   npm run referral:send-requests -- --limit=50 --sleep-ms=600     # 先行配信
 *   npm run referral:send-requests -- --sleep-ms=600                # 残り全件
 *   npm run referral:send-requests -- --only=someone@example.com    # 対象者のうち1人にだけ本番どおり送る
 *   --site-url=https://...  メール内のURLのドメイン（既定: https://careeressence.jp）
 *
 * 対象: moderation_status='approved'、メールあり、is_duplicate_email=false の回答者（メールで重複排除）
 * 除外: 配信停止した人（email_unsubscribes）、送信済みの人（email_logs の referral_request / sent）
 * 前提: 紹介制度が有効なキャンペーンが実施中であること
 * 環境: .env.local に NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_API_KEY,
 *       EMAIL_SENDER_ORG, EMAIL_SENDER_ADDRESS（特定電子メール法の表示義務）
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type ResponseRow = {
  id: string;
  email: string;
  school_name: string | null;
  created_at: string;
};

type Target = {
  email: string;
  surveyResponseId: string;
  schoolName: string | null;
};

const PAGE_SIZE = 1000;

function parseArgs() {
  const argv = process.argv.slice(2);
  const numberArg = (name: string): number | null => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    if (!a) return null;
    const n = parseInt(a.split('=')[1], 10);
    return Number.isFinite(n) ? n : null;
  };
  const testTo = argv.find((x) => x.startsWith('--test-to='))?.split('=')[1]?.trim() || null;
  const siteUrl = argv.find((x) => x.startsWith('--site-url='))?.slice('--site-url='.length).trim();
  const only = argv.find((x) => x.startsWith('--only='))?.slice('--only='.length).trim() || null;
  return {
    only,
    // .env.local の NEXT_PUBLIC_SITE_URL は開発用（localhost）のことが多いため、メール内のURLは既定で本番にする
    siteUrl: (siteUrl || 'https://careeressence.jp').replace(/\/$/, ''),
    dryRun: argv.includes('--dry-run'),
    limit: numberArg('limit'),
    // Resend の既定レート制限（毎秒2リクエスト）を超えないようにする
    sleepMs: numberArg('sleep-ms') ?? 600,
    testTo,
  };
}

/** Windows で fetch のハンドルが残ったまま process.exit すると libuv が異常終了するため、終了コードだけ設定する */
function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain ?? ''}`;
}

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadTargets(supabase: SupabaseClient, normalizeEmail: (e: string) => string) {
  const responses = await fetchAll<ResponseRow>((from, to) =>
    supabase
      .from('survey_responses')
      .select('id, email, school_name, created_at')
      .eq('moderation_status', 'approved')
      .eq('is_duplicate_email', false)
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const unsubscribed = new Set(
    (await fetchAll<{ email: string }>((from, to) =>
      supabase.from('email_unsubscribes').select('email').range(from, to)
    )).map((r) => normalizeEmail(r.email))
  );

  const alreadySent = new Set(
    (await fetchAll<{ to_email: string }>((from, to) =>
      supabase
        .from('email_logs')
        .select('to_email')
        .eq('email_type', 'referral_request')
        .eq('status', 'sent')
        .range(from, to)
    )).map((r) => normalizeEmail(r.to_email))
  );

  // 新しい順に並んでいるので、最初に出てきた回答がその人の最新の承認済み回答
  const latestByEmail = new Map<string, Target>();
  for (const r of responses) {
    const key = normalizeEmail(r.email);
    if (!key.includes('@') || latestByEmail.has(key)) continue;
    latestByEmail.set(key, { email: r.email.trim(), surveyResponseId: r.id, schoolName: r.school_name });
  }

  const all = [...latestByEmail.entries()];
  const targets = all
    .filter(([key]) => !unsubscribed.has(key) && !alreadySent.has(key))
    .map(([, t]) => t);

  return {
    uniqueEmails: all.length,
    unsubscribedCount: all.filter(([key]) => unsubscribed.has(key)).length,
    alreadySentCount: all.filter(([key]) => alreadySent.has(key)).length,
    targets,
  };
}

async function main() {
  const args = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return fail('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  }

  process.env.NEXT_PUBLIC_SITE_URL = args.siteUrl;

  // 環境変数を読み込んだ後に評価させるため動的 import にする
  const { getActiveReferralCampaign, getReferralShareInfo, normalizeEmail } = await import('@/lib/referral/server');
  const { buildUnsubscribeApiUrl, buildUnsubscribePageUrl } = await import('@/lib/referral/unsubscribe');
  const { getSenderIdentity, sendReferralRequestEmail } = await import('@/lib/email/sender');

  const supabase = createClient(supabaseUrl, serviceKey);

  const campaign = await getActiveReferralCampaign(supabase);
  if (!campaign) {
    return fail('紹介制度が有効なキャンペーンが実施中ではありません。キャンペーン画面で「紹介を有効化」してから実行してください。');
  }

  if (!args.dryRun) {
    if (!process.env.EMAIL_API_KEY) return fail('EMAIL_API_KEY が未設定です');
    if (!getSenderIdentity()) {
      return fail('EMAIL_SENDER_ORG と EMAIL_SENDER_ADDRESS（運営者名・所在地）を設定してください');
    }
  }

  const { uniqueEmails, unsubscribedCount, alreadySentCount, targets } = await loadTargets(supabase, normalizeEmail);
  const pool = args.only ? targets.filter((t) => normalizeEmail(t.email) === normalizeEmail(args.only!)) : targets;
  if (args.only && pool.length === 0) {
    return fail(`${args.only} は配信対象にいません（未承認・重複のみ・配信停止済み・送信済みのいずれか）`);
  }
  const selected = args.limit != null ? pool.slice(0, args.limit) : pool;

  console.log('紹介依頼メール 配信対象');
  console.log('================================');
  console.log(`承認済み回答者（メール重複排除後）: ${uniqueEmails} 人`);
  console.log(`  - 配信停止済み: ${unsubscribedCount} 人`);
  console.log(`  - 送信済み:     ${alreadySentCount} 人`);
  console.log(`未送信の対象:   ${targets.length} 人`);
  console.log(`今回の送信予定: ${selected.length} 人${args.limit != null ? `（--limit=${args.limit}）` : ''}`);
  console.log(`メール内のURL:  ${args.siteUrl}`);
  console.log(`キャンペーン:   ${campaign.id}（${new Date(campaign.endsAt).toLocaleDateString('ja-JP')} まで）`);
  console.log(`謝礼:           紹介された人 ${campaign.rewardAmount}円 / 紹介者 ${campaign.referrerRewardAmount}円`);
  console.log('');

  if (args.dryRun) {
    console.log('サンプル（先頭5件）:');
    for (const t of selected.slice(0, 5)) {
      console.log(`  ${maskEmail(t.email)}  ${t.schoolName ?? '（学校名なし）'}`);
    }
    console.log('\n--dry-run のため送信していません。');
    return;
  }

  if (args.testTo) {
    const sample = selected[0] ?? targets[0];
    if (!sample) return fail('テスト送信に使う回答が見つかりません');
    const referral = await getReferralShareInfo(supabase, args.testTo, null);
    if (!referral) return fail('テスト用の紹介URLを発行できませんでした');
    const ok = await sendReferralRequestEmail({
      to: args.testTo,
      schoolName: sample.schoolName,
      referral,
      campaignEndsAt: campaign.endsAt,
      unsubscribePageUrl: buildUnsubscribePageUrl(args.testTo),
      unsubscribeApiUrl: buildUnsubscribeApiUrl(args.testTo),
      surveyResponseId: sample.surveyResponseId,
      supabase,
    });
    console.log(ok ? `テスト送信しました: ${args.testTo}` : 'テスト送信に失敗しました');
    return;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const [i, t] of selected.entries()) {
    // 同時に別プロセスで実行された場合に備え、送信直前にも送信済みかを確認する
    const { count } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('email_type', 'referral_request')
      .eq('status', 'sent')
      .ilike('to_email', t.email.replace(/[\\%_]/g, (c) => `\\${c}`));
    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }

    const referral = await getReferralShareInfo(supabase, t.email, t.surveyResponseId, { forEmail: true });
    if (!referral) {
      skipped++;
      continue;
    }

    const ok = await sendReferralRequestEmail({
      to: t.email,
      schoolName: t.schoolName,
      referral,
      campaignEndsAt: campaign.endsAt,
      unsubscribePageUrl: buildUnsubscribePageUrl(t.email),
      unsubscribeApiUrl: buildUnsubscribeApiUrl(t.email),
      surveyResponseId: t.surveyResponseId,
      supabase,
    });
    if (ok) sent++;
    else failed++;

    console.log(`[${i + 1}/${selected.length}] ${ok ? '送信' : '失敗'} ${maskEmail(t.email)}`);
    if (args.sleepMs > 0) await sleep(args.sleepMs);
  }

  console.log(`\n完了: 送信 ${sent} / スキップ ${skipped} / 失敗 ${failed}`);
}

main().catch((e) => {
  fail(`エラー: ${e instanceof Error ? e.message : String(e)}`);
});
