/**
 * 学校提携（公式サイトリンク・郵送の資料請求・学校提供情報）の設定確認CLI。
 *
 * docs/school-partnership-setup.md の手順1〜3が終わったかを、DBを変更せずに点検する。
 * 検証環境・本番それぞれで、通しの受付テストを始める前に実行する。
 *
 * 使い方:
 *   npx tsx scripts/check-partnership-setup.ts
 *   npx tsx scripts/check-partnership-setup.ts --env=.env.staging
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const envArg = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length);
dotenv.config({ path: path.join(process.cwd(), envArg ?? '.env.local') });

type Level = 'ok' | 'warn' | 'fail';
const results: { level: Level; label: string; detail: string }[] = [];
const mark = { ok: '✅', warn: '⚠️ ', fail: '❌' } as const;

function record(level: Level, label: string, detail: string) {
  results.push({ level, label, detail });
  console.log(`${mark[level]} ${label}: ${detail}`);
}

function requireEnv(name: string, level: Level = 'fail'): string | null {
  const value = process.env[name]?.trim();
  if (!value) {
    record(level, name, '未設定');
    return null;
  }
  record('ok', name, name.includes('KEY') ? `設定済み（${value.length}文字）` : value);
  return value;
}

const PARTNERSHIP_TABLES = [
  'school_partnerships',
  'school_partner_members',
  'school_partner_content',
  'school_material_requests',
  'school_material_request_events',
  'school_partner_notifications',
  'email_deliveries',
];

const BLANK_UUID = '00000000-0000-0000-0000-000000000000';

async function main() {
  console.log(`=== 学校提携の設定確認（${envArg ?? '.env.local'}） ===\n`);

  console.log('--- 1. 運営データベース ---');
  const mainUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!mainUrl || !serviceKey) {
    summarize();
    return;
  }
  const db = createClient(mainUrl, serviceKey, { auth: { persistSession: false } });

  for (const table of PARTNERSHIP_TABLES) {
    // head:true だと欠損テーブルの404が本文なしで返り、エラーとして拾えないため limit(0) で確認する
    const { count, error } = await db.from(table).select('*', { count: 'exact' }).limit(0);
    if (error || count === null) {
      record('fail', `テーブル ${table}`, `参照できません（${error?.message ?? '不明なエラー'}）。create-school-partnerships.sql を適用してください。`);
    } else {
      record('ok', `テーブル ${table}`, `${count ?? 0}件`);
    }
  }

  const officialColumn = await db.from('schools').select('official_url, official_url_verified').limit(1);
  if (officialColumn.error) {
    record('fail', 'schools.official_url_verified', `参照できません（${officialColumn.error.message}）。add-official-url-verification.sql を適用してください。`);
  } else {
    record('ok', 'schools.official_url_verified', '参照できます');
  }

  // RPCは「存在しないIDで呼ぶと関数自身の例外が返る」ことだけを確認する（データは変更しない）
  const rpcProbes: { name: string; args: Record<string, unknown>; expected: string }[] = [
    {
      name: 'submit_school_material_request',
      expected: 'request_unavailable',
      args: {
        p_school_id: BLANK_UUID,
        p_submission_key: BLANK_UUID,
        p_recipient_name: '-',
        p_recipient_label: '-',
        p_addressee: '-',
        p_postal_code: '0000000',
        p_address: '-',
        p_email: 'probe@example.invalid',
        p_phone: null,
        p_applicant_role: 'adult',
        p_consent_version: 'probe',
        p_consent_text: 'probe',
        p_source_hash: 'probe',
      },
    },
    {
      name: 'submit_school_partner_content',
      expected: 'content_unavailable',
      args: { p_member_id: BLANK_UUID, p_kind: 'message', p_body: 'probe', p_photo_path: null, p_caption: null, p_alt: null },
    },
    {
      name: 'review_school_partner_content',
      expected: 'content_conflict',
      args: { p_content_id: BLANK_UUID, p_action: 'approve', p_actor_id: BLANK_UUID, p_reason: null },
    },
    {
      name: 'process_school_material_request',
      expected: 'request_not_found',
      args: { p_request_id: BLANK_UUID, p_action: 'viewed', p_actor_id: BLANK_UUID, p_scope: 'school' },
    },
  ];
  for (const probe of rpcProbes) {
    const { error } = await db.rpc(probe.name, probe.args);
    if (!error) {
      record('warn', `RPC ${probe.name}`, `例外 ${probe.expected} を期待しましたが成功しました。関数の内容を確認してください。`);
    } else if (error.message.includes(probe.expected)) {
      record('ok', `RPC ${probe.name}`, '登録済み');
    } else {
      record('fail', `RPC ${probe.name}`, `応答が想定外です（${error.code ?? ''} ${error.message}）`);
    }
  }

  const buckets = await db.storage.listBuckets();
  const photoBucket = buckets.data?.find((bucket) => bucket.id === 'school-partner-photos');
  if (buckets.error) {
    record('fail', 'ストレージ', `バケット一覧を取得できません（${buckets.error.message}）`);
  } else if (!photoBucket) {
    record('fail', 'バケット school-partner-photos', '未作成です。create-school-partnerships.sql を適用してください。');
  } else {
    record(photoBucket.public ? 'fail' : 'ok', 'バケット school-partner-photos',
      photoBucket.public ? '公開バケットになっています。非公開に戻してください。' : '非公開で作成済み');
  }

  console.log('\n--- 2. 学校担当者用の認証プロジェクト ---');
  const schoolUrl = requireEnv('NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_URL');
  const schoolAnon = requireEnv('NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_ANON_KEY');
  const schoolService = requireEnv('SCHOOL_AUTH_SUPABASE_SERVICE_ROLE_KEY');
  if (schoolUrl) {
    const sameProject = new URL(schoolUrl).origin === new URL(mainUrl).origin;
    record(sameProject ? 'fail' : 'ok', '認証プロジェクトの分離',
      sameProject ? '運営データベースと同じプロジェクトです。別プロジェクトを作成してください。' : '運営データベースとは別プロジェクトです');
  }
  if (schoolUrl && schoolAnon) {
    const settings = await fetch(`${schoolUrl.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: schoolAnon } })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (!settings) {
      record('warn', '認証設定の取得', 'auth/v1/settings を取得できませんでした。URLとanonキーを確認してください。');
    } else {
      record(settings.external?.email ? 'ok' : 'fail', 'メール認証',
        settings.external?.email ? '有効' : '無効です。メール認証を有効にしてください。');
      record(settings.disable_signup ? 'ok' : 'fail', '一般ユーザーの新規登録',
        settings.disable_signup ? '無効（招待制）' : '有効のままです。無効にしてください。');
      if (settings.mailer_autoconfirm) {
        record('warn', 'メール確認の自動承認', '有効です。認証コードでの確認が前提のため、設定を見直してください。');
      }
    }
  }
  if (schoolUrl && schoolService) {
    const auth = createClient(schoolUrl, schoolService, { auth: { persistSession: false, autoRefreshToken: false } });
    const users = await auth.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (users.error) record('fail', '学校認証のサービスロールキー', `利用できません（${users.error.message}）`);
    else record('ok', '学校認証のサービスロールキー', '利用できます');
  }
  record('warn', '手動確認が必要な項目',
    'Magic Linkメール本文の {{ .Token }}、学校宛に届くSMTP、TOTP（二要素認証）の有効化はダッシュボードで確認してください。');

  console.log('\n--- 3. 通知メールと集計 ---');
  const emailService = process.env.EMAIL_SERVICE?.trim();
  record(!emailService || emailService === 'resend' ? 'ok' : 'fail', 'EMAIL_SERVICE',
    emailService ?? '未設定（resendとして扱われます）');
  requireEnv('EMAIL_API_KEY');
  requireEnv('EMAIL_FROM');
  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL');
  if (siteUrl?.startsWith('http://localhost')) {
    record('warn', 'NEXT_PUBLIC_SITE_URL', 'localhostです。通知メールのリンクが検証環境のURLになるよう設定してください。');
  }
  const property = requireEnv('GA4_PARTNERSHIP_PROPERTY_ID', 'warn');
  const stream = requireEnv('GA4_PARTNERSHIP_STREAM_ID', 'warn');
  if (property && stream && !(/^\d+$/.test(property) && /^\d+$/.test(stream))) {
    record('fail', 'GA4の設定値', '数字のみで指定してください。');
  }
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY_PATH?.trim();
  const keyJson = process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (keyJson) {
    record('ok', 'GSCサービスアカウント', '環境変数から読み込めます');
  } else if (keyPath && fs.existsSync(path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath))) {
    record('ok', 'GSCサービスアカウント', `${keyPath} を読み込めます`);
  } else {
    record('warn', 'GSCサービスアカウント', '鍵が見つかりません。運営画面の閲覧数・クリック数は「未取得」と表示されます。');
  }

  console.log('\n--- 4. 提携の有効化状況 ---');
  const partnerships = await db.from('school_partnerships')
    .select('school_id, official_link_enabled, request_enabled, content_enabled, recipient_name, access_days, schools(name, status)');
  if (partnerships.error) {
    record('fail', '提携設定の一覧', partnerships.error.message);
  } else if (!partnerships.data.length) {
    record('warn', '提携設定の一覧', '登録された学校がありません。運営画面から担当者を招待してください。');
  } else {
    const members = await db.from('school_partner_members').select('school_id, active');
    for (const row of partnerships.data) {
      const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
      const active = (members.data ?? []).filter((member) => member.school_id === row.school_id && member.active).length;
      const flags = [
        row.official_link_enabled && '公式リンク',
        row.request_enabled && '資料請求',
        row.content_enabled && '写真・メッセージ',
      ].filter(Boolean).join('・') || '未公開';
      const ready = !row.request_enabled || (active > 0 && Boolean(row.recipient_name?.trim()) && school?.status === 'active');
      record(ready ? 'ok' : 'fail', `${school?.name ?? row.school_id}`,
        `${flags} / 担当者${active}名 / 提供先「${row.recipient_name || '未設定'}」/ 閲覧期限${row.access_days}日${ready ? '' : ' ← 資料請求を受け付ける条件が揃っていません'}`);
    }
  }

  summarize();
}

function summarize() {
  const fails = results.filter((item) => item.level === 'fail');
  const warns = results.filter((item) => item.level === 'warn');
  console.log(`\n=== 結果: 要対応${fails.length}件 / 確認推奨${warns.length}件 ===`);
  for (const item of fails) console.log(`${mark.fail} ${item.label}: ${item.detail}`);
  if (fails.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('確認中にエラーが発生しました:', error);
  process.exitCode = 1;
});
