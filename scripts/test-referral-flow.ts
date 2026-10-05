/**
 * 紹介制度の通し確認用 CLI（本番DBにテスト用の回答を作り、実際のメールを送る）
 *
 * 使い方:
 *   npx tsx scripts/test-referral-flow.ts --to=you@gmail.com              # テストデータ作成＋メール送信
 *   npx tsx scripts/test-referral-flow.ts --to=you@gmail.com --cleanup    # テストデータをすべて削除
 *   npx tsx scripts/test-referral-flow.ts --approve=someone@gmail.com     # その人の最新の承認待ち回答を「公開せずに」承認
 *   --site-url=http://localhost:3000  メール内リンクのドメイン（既定: localhost。未デプロイの画面を手元で確認するため）
 *
 * --approve は承認APIと同じく謝礼レコード作成と承認メール送信を行うが、is_public=false のままにし、
 * IndexNow 通知・RAG 同期もしない（サンプル確認の回答を本番サイトに出さないため）。
 *
 * テスト用アドレスは you+referral-a@gmail.com（紹介者A）/ you+referral-b@gmail.com（Aの紹介で回答したB）。
 * 回答は is_public=false・school_id=null で作るため、公開ページや学校の集計には出ない。
 * 手元のフォームから追加で試す場合も you+referral-○@gmail.com を使えば --cleanup で消える。
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TEST_SCHOOL_NAME = '【テスト】紹介制度の動作確認';
const DUMMY_GIFT_URL = 'https://example.com/quo-test-dummy';

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const value = (name: string) =>
    argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || null;
  return {
    to: value('to'),
    approve: value('approve'),
    siteUrl: (value('site-url') ?? 'http://localhost:3000').replace(/\/$/, ''),
    cleanup: argv.includes('--cleanup'),
  };
}

function testAddress(base: string, suffix: string): string {
  const [local, domain] = base.split('@');
  return `${local}+referral-${suffix}@${domain}`.toLowerCase();
}

function testAddressPattern(base: string): string {
  const [local, domain] = base.split('@');
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `${esc(local)}+referral-%@${esc(domain)}`;
}

async function cleanup(supabase: SupabaseClient, base: string) {
  const pattern = testAddressPattern(base);

  const { data: codes, error: codesError } = await supabase
    .from('referral_codes')
    .select('id, code')
    .ilike('referrer_email', pattern);
  if (codesError) return fail(`紹介コードの取得に失敗: ${codesError.message}`);
  const codeIds = (codes ?? []).map((c) => c.id);

  const { data: byEmail, error: byEmailError } = await supabase
    .from('survey_responses')
    .select('id, email')
    .ilike('email', pattern);
  if (byEmailError) return fail(`回答の取得に失敗: ${byEmailError.message}`);
  const { data: byCode, error: byCodeError } = codeIds.length
    ? await supabase.from('survey_responses').select('id, email').in('referral_code_id', codeIds)
    : { data: [], error: null };
  if (byCodeError) return fail(`紹介経由の回答の取得に失敗: ${byCodeError.message}`);
  const responses = new Map([...(byEmail ?? []), ...(byCode ?? [])].map((r) => [r.id, r.email]));
  const responseIds = [...responses.keys()];

  console.log('削除対象:');
  for (const [id, email] of responses) console.log(`  回答 ${id} ${email}`);
  for (const c of codes ?? []) console.log(`  紹介コード ${c.code}`);

  const steps: [string, () => PromiseLike<{ error: { message: string } | null; count: number | null }>][] = [
    ['email_logs（回答ID）', () => supabase.from('email_logs').delete({ count: 'exact' }).in('survey_response_id', responseIds)],
    ['email_logs（宛先）', () => supabase.from('email_logs').delete({ count: 'exact' }).ilike('to_email', pattern)],
    ['campaign_grants', () => supabase.from('campaign_grants').delete({ count: 'exact' }).in('survey_response_id', responseIds)],
    ['review_moderation_results', () => supabase.from('review_moderation_results').delete({ count: 'exact' }).in('survey_response_id', responseIds)],
    ['survey_responses', () => supabase.from('survey_responses').delete({ count: 'exact' }).in('id', responseIds)],
    ['referral_codes', () => supabase.from('referral_codes').delete({ count: 'exact' }).in('id', codeIds)],
    ['email_unsubscribes', () => supabase.from('email_unsubscribes').delete({ count: 'exact' }).ilike('email', pattern)],
  ];
  for (const [label, run] of steps) {
    const { error, count } = await run();
    if (error) return fail(`${label} の削除に失敗: ${error.message}`);
    console.log(`  ${label}: ${count ?? 0} 件削除`);
  }
  console.log('\nテストデータを削除しました。');
}

async function approveWithoutPublishing(supabase: SupabaseClient, email: string) {
  const { createGrantsOnApproval } = await import('@/lib/referral/grants');
  const { getReferralShareInfo } = await import('@/lib/referral/server');
  const { sendApprovedEmail } = await import('@/lib/email/sender');

  const { data: target, error: targetError } = await supabase
    .from('survey_responses')
    .select('id, school_name, created_at')
    .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (targetError) return fail(`回答の取得に失敗: ${targetError.message}`);
  if (!target) return fail(`${email} の承認待ち回答が見つかりません`);

  const { data: review, error } = await supabase
    .from('survey_responses')
    .update({ moderation_status: 'approved', is_public: false })
    .eq('id', target.id)
    .select('id, email, school_name, is_duplicate_email, referral_code_id, ip_hash')
    .single();
  if (error || !review) return fail(`承認に失敗: ${error?.message}`);
  console.log(`承認（非公開）: ${review.id} ${review.school_name} 重複=${review.is_duplicate_email} 紹介コードID=${review.referral_code_id ?? 'なし'}`);

  if (!review.email || review.is_duplicate_email) {
    console.log('重複メールのため謝礼・承認メールの対象外です（承認APIと同じ扱い）');
    return;
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, reward_amount, referral_enabled, referral_reward_amount, referral_max_per_referrer')
    .eq('is_active', true)
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!campaign) return fail('実施中のキャンペーンがありません');

  const result = await createGrantsOnApproval({ supabase, review, campaign });
  console.log('紹介者謝礼:', result.referrer);

  const { data: grants } = await supabase
    .from('campaign_grants')
    .select('email, grant_type, reward_amount, status, flag_reason')
    .eq('survey_response_id', review.id);
  for (const g of grants ?? []) {
    console.log(`  ${g.grant_type.padEnd(8)} ${g.email}  ${g.reward_amount}円  ${g.status}  ${g.flag_reason ?? ''}`);
  }

  const referral = campaign.referral_enabled
    ? await getReferralShareInfo(supabase, review.email, review.id, { forEmail: true })
    : null;
  await sendApprovedEmail({ to: review.email, schoolName: review.school_name, surveyResponseId: review.id, referral, supabase });
  console.log(`承認メールを送信しました: ${review.email}`);
}

async function main() {
  const args = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fail('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  const supabase = createClient(supabaseUrl, serviceKey);

  if (args.approve) {
    process.env.NEXT_PUBLIC_SITE_URL = args.siteUrl;
    return approveWithoutPublishing(supabase, args.approve);
  }

  if (!args.to || !args.to.includes('@')) return fail('--to=受信用メールアドレス を指定してください');
  if (args.cleanup) return cleanup(supabase, args.to);

  process.env.NEXT_PUBLIC_SITE_URL = args.siteUrl;
  const { getOrCreateReferralCode, getReferralShareInfo, hashIp } = await import('@/lib/referral/server');
  const { createGrantsOnApproval } = await import('@/lib/referral/grants');
  const { buildUnsubscribeApiUrl, buildUnsubscribePageUrl } = await import('@/lib/referral/unsubscribe');
  const { sendApprovedEmail, sendGrantGiftEmail, sendReferralRequestEmail, getSenderIdentity } = await import(
    '@/lib/email/sender'
  );

  if (!process.env.EMAIL_API_KEY) return fail('EMAIL_API_KEY が未設定です');
  if (!getSenderIdentity()) return fail('EMAIL_SENDER_ORG と EMAIL_SENDER_ADDRESS を設定してください');

  const emailA = testAddress(args.to, 'a');
  const emailB = testAddress(args.to, 'b');

  const { count: existing } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .ilike('email', testAddressPattern(args.to));
  if ((existing ?? 0) > 0) return fail('前回のテストデータが残っています。先に --cleanup を実行してください。');

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, reward_amount, referral_enabled, referral_reward_amount, referral_max_per_referrer, ends_at')
    .eq('is_active', true)
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!campaign?.referral_enabled) return fail('紹介制度が有効なキャンペーンが実施中ではありません');

  const { data: sample } = await supabase
    .from('survey_responses')
    .select('respondent_role, status')
    .eq('moderation_status', 'approved')
    .limit(1)
    .single();
  if (!sample) return fail('参考にする承認済み回答が見つかりません');

  const insertResponse = async (email: string, ip: string, referralCodeId: string | null) => {
    const { data, error } = await supabase
      .from('survey_responses')
      .insert({
        school_name: TEST_SCHOOL_NAME,
        respondent_role: sample.respondent_role,
        status: sample.status,
        overall_satisfaction: 4,
        good_comment: '紹介制度の動作確認用のテスト回答です。',
        bad_comment: '紹介制度の動作確認用のテスト回答です。',
        answers: {},
        email,
        school_id: null,
        is_public: false,
        moderation_status: 'approved',
        is_duplicate_email: false,
        referral_code_id: referralCodeId,
        ip_hash: hashIp(ip),
      })
      .select('id, email, ip_hash, referral_code_id')
      .single();
    if (error || !data) throw new Error(`回答の作成に失敗: ${error?.message}`);
    return data;
  };

  // 1. A が回答 → A の紹介コード発行 → B が A の紹介URLから回答（IP はドキュメント用アドレス）
  const reviewA = await insertResponse(emailA, '203.0.113.1', null);
  const codeA = await getOrCreateReferralCode(supabase, emailA, reviewA.id);
  if (!codeA) throw new Error('紹介コードの発行に失敗');
  const reviewB = await insertResponse(emailB, '203.0.113.2', codeA.id);
  console.log(`回答A: ${reviewA.id} (${emailA})`);
  console.log(`回答B: ${reviewB.id} (${emailB}) ← A の紹介コード ${codeA.code}`);

  // 2. 承認時と同じ処理で謝礼レコードを作る
  const resultA = await createGrantsOnApproval({ supabase, review: reviewA, campaign });
  const resultB = await createGrantsOnApproval({ supabase, review: reviewB, campaign });
  console.log('A承認時の紹介者謝礼:', resultA.referrer);
  console.log('B承認時の紹介者謝礼:', resultB.referrer);

  const { data: grants } = await supabase
    .from('campaign_grants')
    .select('email, grant_type, reward_amount, status, flag_reason, survey_response_id')
    .in('survey_response_id', [reviewA.id, reviewB.id])
    .order('created_at');
  console.log('\nQUO配布レコード:');
  for (const g of grants ?? []) {
    const of = g.survey_response_id === reviewA.id ? 'Aの回答' : 'Bの回答';
    console.log(`  ${g.grant_type.padEnd(8)} ${g.email}  ${g.reward_amount}円  ${g.status}  ${of}  ${g.flag_reason ?? ''}`);
  }
  const expected = [
    { email: emailA, type: 'review' },
    { email: emailB, type: 'referee' },
    { email: emailA, type: 'referrer' },
  ];
  const ok =
    grants?.length === 3 &&
    expected.every((e) => grants.some((g) => g.email === e.email && g.grant_type === e.type));
  console.log(ok ? '→ 期待どおり3件（A:通常 / B:被紹介 / A:紹介）' : '→ 期待と異なります。上の内容を確認してください');

  // 3. 実際のメールを送る
  const referralA = await getReferralShareInfo(supabase, emailA, reviewA.id, { forEmail: true });
  const referralB = await getReferralShareInfo(supabase, emailB, reviewB.id, { forEmail: true });
  const amountFor = (email: string, type: string) =>
    grants?.find((g) => g.email === email && g.grant_type === type)?.reward_amount ?? null;

  const sends: [string, () => Promise<boolean | void>][] = [
    ['承認メール（A宛・紹介のお願い付き）', () =>
      sendApprovedEmail({ to: emailA, schoolName: TEST_SCHOOL_NAME, surveyResponseId: reviewA.id, referral: referralA, supabase })],
    ['QUOお届け・通常（A宛）', () =>
      sendGrantGiftEmail({ to: emailA, grantType: 'review', schoolName: TEST_SCHOOL_NAME, rewardAmount: amountFor(emailA, 'review'), giftUrl: DUMMY_GIFT_URL, referral: referralA, surveyResponseId: reviewA.id, supabase })],
    ['QUOお届け・紹介経由で回答（B宛）', () =>
      sendGrantGiftEmail({ to: emailB, grantType: 'referee', schoolName: TEST_SCHOOL_NAME, rewardAmount: amountFor(emailB, 'referee'), giftUrl: DUMMY_GIFT_URL, referral: referralB, surveyResponseId: reviewB.id, supabase })],
    ['QUOお届け・紹介のお礼（A宛）', () =>
      sendGrantGiftEmail({ to: emailA, grantType: 'referrer', schoolName: TEST_SCHOOL_NAME, rewardAmount: amountFor(emailA, 'referrer'), giftUrl: DUMMY_GIFT_URL, referral: referralA, surveyResponseId: reviewB.id, supabase })],
    ['過去回答者向け紹介依頼（A宛）', async () =>
      referralA
        ? sendReferralRequestEmail({ to: emailA, schoolName: TEST_SCHOOL_NAME, referral: referralA, campaignEndsAt: campaign.ends_at, unsubscribePageUrl: buildUnsubscribePageUrl(emailA), unsubscribeApiUrl: buildUnsubscribeApiUrl(emailA), surveyResponseId: reviewA.id, supabase })
        : false],
  ];
  console.log('\nメール送信:');
  for (const [label, send] of sends) {
    const result = await send();
    console.log(`  ${result === false ? '失敗' : '送信'}  ${label}`);
    await sleep(700);
  }

  console.log(`\nAの紹介URL:     ${referralA?.url}`);
  console.log(`Aの配信停止URL: ${buildUnsubscribePageUrl(emailA)}`);
  console.log(`\n確認が終わったら: npx tsx scripts/test-referral-flow.ts --to=${args.to} --cleanup`);
}

main().catch((e) => {
  fail(`エラー: ${e instanceof Error ? e.message : String(e)}`);
});
