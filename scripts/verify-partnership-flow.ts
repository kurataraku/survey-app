/**
 * 学校提携の受付〜発送と、学校間のアクセス制御をデータベース関数レベルで通すCLI。
 *
 * seed-partnership-verification.sql で投入したダミー校A・Bと架空の申込情報を使い、
 * 受付 → 運営確認 → 学校へ公開 → 通知の積み上げ → 自校分の閲覧 → 確認済み → 発送済み までを通す。
 * あわせて、他校の請求ID指定・停止された担当者・閲覧期限切れ・テスト請求の共有が拒否されることを確認する。
 *
 * 画面・メール・二要素認証は対象外（ブラウザでの確認が必要）。この CLI はAPIの手前にある
 * RPCの振る舞いだけを検証する。実行するたびにダミー校の請求・掲載内容を作り直す。
 *
 * 使い方:
 *   npx tsx scripts/verify-partnership-flow.ts
 *   npx tsx scripts/verify-partnership-flow.ts --env=.env.staging
 *   npx tsx scripts/verify-partnership-flow.ts --keep   # 検証で作ったデータを消さずに残す
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const envArg = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length);
const keepData = process.argv.includes('--keep');
dotenv.config({ path: path.join(process.cwd(), envArg ?? '.env.local') });

const SCHOOL_A = '0a0a0a0a-0000-4000-8000-00000000000a';
const SCHOOL_B = '0b0b0b0b-0000-4000-8000-00000000000b';
const MEMBER_A1 = '1a1a1a1a-0000-4000-8000-00000000000a';
const MEMBER_A2 = '2a2a2a2a-0000-4000-8000-00000000000a';
const MEMBER_B1 = '1b1b1b1b-0000-4000-8000-00000000000b';
const OPERATOR = '9f9f9f9f-0000-4000-8000-00000000000f';
const SCHOOLS = [SCHOOL_A, SCHOOL_B];

const APPLICANT = {
  addressee: '検証 太郎',
  postal_code: '1500001',
  address: '東京都渋谷区神宮前0-0-0 検証ビル999号室',
  email: 'kensho-applicant@example.invalid',
  phone: '09000000000',
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function submitRequest(schoolId: string, schoolName: string, recipient: string, overrides: Record<string, unknown> = {}) {
  return db.rpc('submit_school_material_request', {
    p_school_id: schoolId,
    p_submission_key: randomUUID(),
    p_recipient_name: recipient,
    p_recipient_label: schoolName,
    p_addressee: APPLICANT.addressee,
    p_postal_code: APPLICANT.postal_code,
    p_address: APPLICANT.address,
    p_email: APPLICANT.email,
    p_phone: APPLICANT.phone,
    p_applicant_role: 'guardian',
    p_consent_version: 'postal-2026-11-v1',
    p_consent_text: '検証用の同意文',
    p_source_hash: `verify-${randomUUID()}`,
    ...overrides,
  });
}

function act(requestId: string, action: string, actorId: string, scope: 'operator' | 'school') {
  return db.rpc('process_school_material_request', { p_request_id: requestId, p_action: action, p_actor_id: actorId, p_scope: scope });
}

async function purge() {
  await db.from('school_partner_notifications').delete().in('school_id', SCHOOLS);
  const { data: requests } = await db.from('school_material_requests').select('id').in('school_id', SCHOOLS);
  if (requests?.length) {
    await db.from('school_material_request_events').delete().in('request_id', requests.map((row) => row.id));
    await db.from('school_material_requests').delete().in('school_id', SCHOOLS);
  }
  await db.from('school_partner_content').delete().in('school_id', SCHOOLS);
  await db.from('school_partner_members').update({ active: true }).in('school_id', SCHOOLS);
}

async function main() {
  console.log(`=== 学校提携の通し検証（${envArg ?? '.env.local'}） ===\n`);

  const { data: schools, error: schoolError } = await db.from('schools')
    .select('id, name, status, is_public, school_partnerships(recipient_name, request_enabled, content_enabled, access_days)')
    .in('id', SCHOOLS);
  if (schoolError || schools?.length !== 2) {
    console.error('ダミー校が見つかりません。seed-partnership-verification.sql を先に実行してください。', schoolError?.message ?? '');
    process.exit(1);
  }
  const schoolA = schools.find((row) => row.id === SCHOOL_A)!;
  const schoolB = schools.find((row) => row.id === SCHOOL_B)!;
  const settingsOf = (school: typeof schoolA) => (Array.isArray(school.school_partnerships) ? school.school_partnerships[0] : school.school_partnerships) as
    { recipient_name: string; request_enabled: boolean; content_enabled: boolean; access_days: number };

  for (const school of [schoolA, schoolB]) {
    check(`${school.name} は公開サイトに出ない設定`, school.is_public === false,
      school.is_public === false ? 'is_public = false' : 'is_public = true のままです。検証中はfalseに戻してください');
  }

  console.log('\n--- 受付 ---');
  await purge();
  const created = await submitRequest(SCHOOL_A, schoolA.name, settingsOf(schoolA).recipient_name);
  check('架空の申込を受け付ける', !created.error && created.data?.created === true, created.error?.message ?? `id=${created.data?.id}`);
  const requestA = created.data?.id as string;
  if (!requestA) {
    summarize();
    return;
  }

  const sameKey = {
    p_submission_key: (await db.from('school_material_requests').select('submission_key').eq('id', requestA).single()).data?.submission_key,
  };
  const repeat = await submitRequest(SCHOOL_A, schoolA.name, settingsOf(schoolA).recipient_name, sameKey);
  check('同じ送信キーの再送で二重登録しない', !repeat.error && repeat.data?.created === false && repeat.data?.id === requestA, repeat.error?.message ?? '');

  const changed = await submitRequest(SCHOOL_A, schoolA.name, settingsOf(schoolA).recipient_name, { ...sameKey, p_address: '別の住所に差し替え' });
  check('送信キーが同じで内容が違う場合は拒否する', changed.error?.message.includes('submission_conflict') === true, changed.error?.message ?? '受け付けてしまいました');

  const wrongRecipient = await submitRequest(SCHOOL_A, schoolA.name, '別の学校法人');
  check('同意した提供先と不一致なら拒否する', wrongRecipient.error?.message.includes('consent_changed') === true, wrongRecipient.error?.message ?? '受け付けてしまいました');

  const unknownSchool = await submitRequest('00000000-0000-0000-0000-000000000000', '存在しない学校', '存在しない法人');
  check('受付していない学校なら拒否する', unknownSchool.error?.message.includes('request_unavailable') === true, unknownSchool.error?.message ?? '受け付けてしまいました');

  console.log('\n--- 運営の確認と学校への公開 ---');
  const operatorView = await act(requestA, 'viewed', OPERATOR, 'operator');
  check('運営は受付内容の全項目を確認できる',
    !operatorView.error && operatorView.data?.email === APPLICANT.email && operatorView.data?.address === APPLICANT.address,
    operatorView.error?.message ?? '');
  check('運営の応答に送信キーと送信元ハッシュを含めない',
    !operatorView.error && operatorView.data?.source_hash === undefined && operatorView.data?.submission_key === undefined);

  const held = await act(requestA, 'held', OPERATOR, 'operator');
  check('保留にできる', !held.error && held.data?.status === 'held', held.error?.message ?? '');

  const shared = await act(requestA, 'shared', OPERATOR, 'operator');
  check('学校へ公開できる', !shared.error && shared.data?.status === 'shared' && Boolean(shared.data?.access_until), shared.error?.message ?? '');
  const accessUntil = shared.data?.access_until as string | undefined;
  const expectedDays = settingsOf(schoolA).access_days;
  const actualDays = accessUntil ? Math.round((Date.parse(accessUntil) - Date.now()) / 86_400_000) : -1;
  check(`閲覧期限が設定どおり（${expectedDays}日）`, actualDays === expectedDays, `${actualDays}日`);

  const notifications = await db.from('school_partner_notifications').select('member_id, status').eq('event_kind', 'request_shared').eq('event_id', requestA);
  check('有効な担当者全員に新着通知が積まれる',
    notifications.data?.length === 2 && notifications.data.every((row) => row.status === 'pending'),
    `${notifications.data?.length ?? 0}件`);

  console.log('\n--- 学校側の確認と発送 ---');
  const schoolView = await act(requestA, 'viewed', MEMBER_A1, 'school');
  check('学校は自校分の郵送先を確認できる',
    !schoolView.error && schoolView.data?.addressee === APPLICANT.addressee && schoolView.data?.phone === APPLICANT.phone,
    schoolView.error?.message ?? '');
  check('学校の応答に受付連絡用メールアドレスと同意記録を含めない',
    !schoolView.error && schoolView.data?.email === undefined && schoolView.data?.consent_text === undefined,
    schoolView.data ? `返却項目: ${Object.keys(schoolView.data).join(', ')}` : '');

  const skipAhead = await act(requestA, 'shipped', MEMBER_A1, 'school');
  check('確認前に発送済みへ飛ばせない', skipAhead.error?.message.includes('request_conflict') === true, skipAhead.error?.message ?? '通ってしまいました');

  const acknowledged = await act(requestA, 'acknowledged', MEMBER_A1, 'school');
  check('確認済みにできる', !acknowledged.error && acknowledged.data?.status === 'acknowledged', acknowledged.error?.message ?? '');
  const shipped = await act(requestA, 'shipped', MEMBER_A1, 'school');
  check('発送済みにできる', !shipped.error && shipped.data?.status === 'shipped' && Boolean(shipped.data?.shipped_at), shipped.error?.message ?? '');

  const events = await db.from('school_material_request_events').select('action, actor_scope').eq('request_id', requestA);
  const actions = (events.data ?? []).map((row) => `${row.actor_scope}:${row.action}`);
  check('操作の記録が残る', ['operator:shared', 'school:acknowledged', 'school:shipped'].every((item) => actions.includes(item)), actions.join(' / '));

  console.log('\n--- 学校間のアクセス制御 ---');
  const requestB = await submitRequest(SCHOOL_B, schoolB.name, settingsOf(schoolB).recipient_name);
  const sharedB = requestB.data?.id ? await act(requestB.data.id as string, 'shared', OPERATOR, 'operator') : null;
  check('学校Bの請求も受付・公開できる', !requestB.error && Boolean(sharedB && !sharedB.error), requestB.error?.message ?? sharedB?.error?.message ?? '');

  if (requestB.data?.id) {
    const crossSchool = await act(requestB.data.id as string, 'viewed', MEMBER_A1, 'school');
    check('学校Aの担当者が学校Bの受付IDを指定しても取得できない',
      crossSchool.error?.message.includes('request_not_found') === true, crossSchool.error?.message ?? '取得できてしまいました');

    const crossOther = await act(requestA, 'viewed', MEMBER_B1, 'school');
    check('学校Bの担当者が学校Aの受付IDを指定しても取得できない',
      crossOther.error?.message.includes('request_not_found') === true, crossOther.error?.message ?? '取得できてしまいました');
  }

  await db.from('school_partner_members').update({ active: false }).eq('user_id', MEMBER_A2);
  const disabled = await act(requestA, 'viewed', MEMBER_A2, 'school');
  check('停止された担当者は詳細を取得できない', disabled.error?.message.includes('request_not_found') === true, disabled.error?.message ?? '取得できてしまいました');
  await db.from('school_partner_members').update({ active: true }).eq('user_id', MEMBER_A2);

  await db.from('school_material_requests').update({ access_until: new Date(Date.now() - 86_400_000).toISOString() }).eq('id', requestA);
  const expired = await act(requestA, 'viewed', MEMBER_A1, 'school');
  check('閲覧期限を過ぎた請求は取得できない', expired.error?.message.includes('request_not_found') === true, expired.error?.message ?? '取得できてしまいました');
  if (accessUntil) await db.from('school_material_requests').update({ access_until: accessUntil }).eq('id', requestA);

  const testRequest = await db.from('school_material_requests').insert({
    school_id: SCHOOL_A, submission_key: randomUUID(), recipient_name: settingsOf(schoolA).recipient_name,
    recipient_label: schoolA.name, addressee: 'テスト請求', postal_code: '1500001', address: 'テスト',
    email: 'test-request@example.invalid', applicant_role: 'adult', consent_version: 'postal-2026-11-v1',
    consent_text: 'テスト', source_hash: `verify-test-${randomUUID()}`, is_test: true,
  }).select('id').single();
  if (testRequest.data?.id) {
    const shareTest = await act(testRequest.data.id, 'shared', OPERATOR, 'operator');
    check('テスト請求は学校へ公開できない', shareTest.error?.message.includes('request_conflict') === true, shareTest.error?.message ?? '公開できてしまいました');
  } else {
    check('テスト請求は学校へ公開できない', false, `テスト請求を作成できませんでした: ${testRequest.error?.message}`);
  }

  console.log('\n--- 写真・メッセージの即時公開と掲載停止 ---');
  const message = await db.rpc('submit_school_partner_content', {
    p_member_id: MEMBER_A1, p_kind: 'message', p_body: '検証用のメッセージです。本番前に削除します。',
    p_photo_path: null, p_caption: null, p_alt: null,
  });
  check('学校が保存したメッセージは確認待ちのまま公開される', !message.error, message.error?.message ?? '');
  const contentId = message.data as string | undefined;

  const publicRead = await db.from('school_partner_content').select('id, status').eq('school_id', SCHOOL_A).in('status', ['pending', 'approved']);
  check('公開ページの読み取り条件（pending/approved）に入る', publicRead.data?.some((row) => row.id === contentId) === true,
    publicRead.data?.map((row) => row.status).join(',') ?? '');

  const otherSchoolContent = await db.from('school_partner_content').select('school_id').eq('id', contentId ?? '').maybeSingle();
  check('保存したメッセージは担当者の自校に紐づく', otherSchoolContent.data?.school_id === SCHOOL_A, String(otherSchoolContent.data?.school_id));

  if (contentId) {
    const stop = await db.rpc('review_school_partner_content', {
      p_content_id: contentId, p_action: 'stop', p_actor_id: OPERATOR, p_reason: '検証用の掲載停止です。',
    });
    check('運営が理由を入れて掲載停止できる', !stop.error, stop.error?.message ?? '');
    const stopped = await db.from('school_partner_content').select('status, stop_reason').eq('id', contentId).single();
    check('掲載停止後は公開条件から外れる', stopped.data?.status === 'stopped', String(stopped.data?.status));
    const stopNotice = await db.from('school_partner_notifications').select('member_id').eq('event_kind', 'content_stopped').eq('event_id', contentId);
    check('掲載停止の通知が担当者全員に積まれる', stopNotice.data?.length === 2, `${stopNotice.data?.length ?? 0}件`);

    const noReason = await db.rpc('review_school_partner_content', { p_content_id: contentId, p_action: 'stop', p_actor_id: OPERATOR, p_reason: '  ' });
    check('理由なしの掲載停止は通らない', noReason.error?.message.includes('content_conflict') === true, noReason.error?.message ?? '通ってしまいました');

    const revision = await db.rpc('submit_school_partner_content', {
      p_member_id: MEMBER_A1, p_kind: 'message', p_body: '修正版の検証用メッセージです。', p_photo_path: null, p_caption: null, p_alt: null,
    });
    const revisionId = revision.data as string | undefined;
    const revisionRow = revisionId ? await db.from('school_partner_content').select('status').eq('id', revisionId).single() : null;
    check('停止後の修正版は修正版・確認待ちになる', revisionRow?.data?.status === 'revision_pending', String(revisionRow?.data?.status));
    const superseded = await db.from('school_partner_content').select('status').eq('id', contentId).single();
    check('前の版は履歴として残る', superseded.data?.status === 'superseded', String(superseded.data?.status));

    if (revisionId) {
      const approve = await db.rpc('review_school_partner_content', { p_content_id: revisionId, p_action: 'approve', p_actor_id: OPERATOR, p_reason: null });
      const approved = await db.from('school_partner_content').select('status').eq('id', revisionId).single();
      check('運営の確認で修正版が確認済みになる', !approve.error && approved.data?.status === 'approved', approve.error?.message ?? String(approved.data?.status));
    }
    const current = await db.from('school_partner_content').select('id').eq('school_id', SCHOOL_A).eq('kind', 'message').neq('status', 'superseded');
    check('公開中の版は常に1件だけ', current.data?.length === 1, `${current.data?.length ?? 0}件`);
  }

  if (!keepData) {
    await purge();
    console.log('\n検証で作成した請求・掲載内容を削除しました（ダミー校と担当者は残しています）。');
  } else {
    console.log('\n--keep が指定されたため、検証データを残しました。');
  }
  summarize();
}

function summarize() {
  console.log(`\n=== 合格${passed}件 / 不合格${failures.length}件 ===`);
  for (const item of failures) console.log(`❌ ${item}`);
  console.log('\n画面・メール・二要素認証・公開ページの見た目は、この検証の対象外です。');
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('検証中にエラーが発生しました:', error);
  process.exitCode = 1;
});
