'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiPath, appPath } from '@/lib/base-path';
import { contentLabels, defaultSettings, deliveryLabels, requestLabels, verifiedOfficialLink } from '@/lib/partnerships/model';
import type { PartnershipSettings } from '@/lib/partnerships/model';
import PartnershipMfa from './PartnershipMfa';

const endpoint = apiPath('/api/admin/partnerships');
const panel = 'space-y-4 rounded-xl border bg-white p-5';
const primary = 'rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const secondary = 'rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
const input = 'mt-1 block w-full rounded-lg border p-2';

type SchoolRelation = { name: string; slug?: string } | { name: string; slug?: string }[] | null;
type Post = { id: string; kind: string; status: string; body: string | null; caption: string | null; alt: string | null; stop_reason: string | null; schools: SchoolRelation };
type RequestRow = { id: string; recipient_label: string; status: string; created_at: string };
type RequestDetail = RequestRow & { addressee: string; postal_code: string; address: string; email: string; phone: string | null; recipient_name: string; consent_text: string; consented_at: string };
type Notice = { event_id: string; event_kind: string; schools: SchoolRelation };
type Undelivered = { id: string; kind: string; ref_id: string; recipient: string; status: string; detail: string | null; created_at: string; schools: SchoolRelation };
type Dashboard = {
  school: { id: string; name: string; slug: string; official_url: string | null; official_url_verified: boolean } | null;
  schools: { school_id: string; schools: SchoolRelation }[];
  settings: PartnershipSettings;
  members: { user_id: string; email: string; active: boolean }[];
  content: Post[];
  requests: RequestRow[];
  notices: Notice[];
  undelivered: Undelivered[];
  schoolLink?: { school_link_url: string | null; school_link_updated_at: string | null } | null;
  requestCount: number;
  schoolAuthReady: boolean;
  month: string;
};
type Traffic = { status: 'ok'; views: number; officialClicks: number; requestClicks: number } | { status: 'unconfigured' | 'unavailable' };
type Report = { traffic: Traffic; received: number; shared: number; shipped: number; month: string };

function relatedName(value: SchoolRelation) {
  return (Array.isArray(value) ? value[0]?.name : value?.name) ?? '学校名未設定';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

export default function PartnershipOperator({ initialSchool }: { initialSchool: string }) {
  const [schoolId, setSchoolId] = useState(initialSchool);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [settings, setSettings] = useState<PartnershipSettings>(defaultSettings);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [stop, setStop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page) });
    if (schoolId) params.set('school', schoolId);
    try {
      const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (signal?.aborted) return;
      setNeedsMfa(data.code === 'mfa');
      if (response.ok) {
        setDashboard(data);
        setSettings(data.settings);
      } else {
        setDashboard(null);
        setDetail(null);
        setError(data.code === 'mfa' ? '' : data.error);
      }
    } catch {
      if (!signal?.aborted) setError('提携管理画面を取得できませんでした。');
    }
  }, [schoolId, page]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function selectSchool(id: string) {
    setSchoolId(id);
    setPage(1);
    setReport(null);
    setDetail(null);
    setStop(null);
    setDashboard(null);
    setError('');
    setNotice('');
  }

  async function action(payload: Record<string, unknown>) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        if (data.code === 'mfa' || data.code === 'login') { setDetail(null); await load(); }
        return false;
      }
      if (payload.type === 'request' && payload.action === 'viewed') {
        setDetail(data);
      } else {
        setDetail(null);
        setStop(null);
        setReport(null);
        setNotice(data.notified === false ? '操作を保存しました。メール送信に失敗しました。通知欄から再送できます。招待の場合は同じ宛先で再度招待してください。' : '操作を保存しました。');
        await load();
      }
      return true;
    } catch {
      setError('通信に失敗しました。状態を確認してから再度お試しください。');
      return false;
    } finally { setBusy(false); }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action({ type: 'invite', schoolId, email: new FormData(form).get('email') })) form.reset();
  }

  async function loadReport() {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const params = new URLSearchParams({ school: schoolId, month, view: 'report' });
      const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok) setReport(data);
      else setError(data.error);
    } catch { setError('レポートを取得できませんでした。'); }
    finally { setBusy(false); }
  }

  const official = verifiedOfficialLink(dashboard?.school?.official_url, dashboard?.school?.official_url_verified);
  const notices = [...new Map((dashboard?.notices ?? []).map((item) => [`${item.event_kind}:${item.event_id}`, item])).values()];
  // 送信後に配信結果を照合して分かった不達（cronが15分おきに更新）
  const undelivered = dashboard?.undelivered ?? [];
  const undeliveredFor = (memberId: string) => undelivered.find((item) => item.kind === 'school_invitation' && item.ref_id === memberId);
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold">学校提携・資料請求</h1>
    {needsMfa && <PartnershipMfa scope="operator" onSuccess={() => void load()} />}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    {!dashboard && !needsMfa && !error && <p>読み込み中…</p>}
    {dashboard && <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">学校 <select className="rounded border p-2" value={schoolId} disabled={busy} onChange={(event) => selectSchool(event.target.value)}>
          <option value="">全校の未対応一覧</option>
          {dashboard.school && !dashboard.schools.some((item) => item.school_id === schoolId) && <option value={schoolId}>{dashboard.school.name}</option>}
          {dashboard.schools.map((item) => <option value={item.school_id} key={item.school_id}>{relatedName(item.schools)}</option>)}
        </select></label>
        <Link className="text-sm text-blue-700 underline" href={appPath('/admin/schools')}>学校一覧から選ぶ</Link>
        {dashboard.school && <Link className="text-sm text-blue-700 underline" href={appPath(`/admin/schools/${schoolId}/edit`)}>学校情報・公式URLを編集</Link>}
      </div>
      {dashboard.school && <div className="grid gap-4 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="font-bold">{dashboard.school.name}の提携設定</h2>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void action({ type: 'settings', schoolId, settings }); }}>
            <label className="flex gap-2"><input type="checkbox" checked={settings.official_link_enabled} onChange={(event) => setSettings({ ...settings, official_link_enabled: event.target.checked })} />公式サイトのボタンを表示</label>
            <p className="break-all text-sm text-slate-600">運営が確認した公式URL: {official ?? '未確認（学校編集画面で公式サイトURLを確認してください）'}</p>
            {dashboard.schoolLink?.school_link_url && <div className="space-y-1 rounded bg-blue-50 p-3 text-sm">
              <p className="break-all"><span className="font-semibold">学校が設定したリンク（公開ページではこちらを優先）:</span> {dashboard.schoolLink.school_link_url}</p>
              {dashboard.schoolLink.school_link_updated_at && <p className="text-slate-600">更新 {formatDate(dashboard.schoolLink.school_link_updated_at)}</p>}
              <button type="button" disabled={busy} className="text-red-700 underline" onClick={() => { if (window.confirm('学校が設定したリンクを外します。公開ページは運営が確認した公式URLに戻ります。よろしいですか？')) void action({ type: 'clear_school_link', schoolId }); }}>このリンクを外す</button>
            </div>}
            <label className="flex gap-2"><input type="checkbox" checked={settings.content_enabled} onChange={(event) => setSettings({ ...settings, content_enabled: event.target.checked })} />学校による写真・メッセージの掲載を有効にする</label>
            <label className="flex gap-2"><input type="checkbox" checked={settings.request_enabled} onChange={(event) => setSettings({ ...settings, request_enabled: event.target.checked })} />郵送の資料請求を受け付ける</label>
            <label className="block text-sm">提供先の運営法人名<input className={input} value={settings.recipient_name} onChange={(event) => setSettings({ ...settings, recipient_name: event.target.value })} required={settings.request_enabled} maxLength={150} /></label>
            <label className="block text-sm">学校の閲覧期限（日、学校へ公開した日から）<input className={input} type="number" min={7} max={365} value={settings.access_days || ''} onChange={(event) => setSettings({ ...settings, access_days: Number(event.target.value) })} required /></label>
            <button className={primary} disabled={busy}>設定を保存</button>
          </form>
        </section>
        <section className={panel}>
          <h2 className="font-bold">学校担当者</h2>
          {!dashboard.schoolAuthReady && <p className="rounded bg-amber-50 p-3 text-sm">学校用の認証プロジェクトを設定すると、担当者を招待できます。</p>}
          <form className="space-y-3" onSubmit={invite}>
            <label className="block text-sm">学校が指定した担当者の業務用メール<input className={input} name="email" type="email" required /></label>
            <button className={primary} disabled={busy || !dashboard.schoolAuthReady}>担当者を招待</button>
          </form>
          <ul className="divide-y">
            {dashboard.members.map((member) => <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" key={member.user_id}>
              <span className="break-all">{member.email}（{member.active ? '有効' : '停止中'}）{undeliveredFor(member.user_id) && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">招待メール {deliveryLabels[undeliveredFor(member.user_id)!.status as keyof typeof deliveryLabels] ?? '不達'}</span>}</span>
              {member.active && <button className={secondary} disabled={busy} onClick={() => {
                if (window.confirm('この担当者の学校向け画面へのアクセスを停止しますか？')) void action({ type: 'disable_member', schoolId, userId: member.user_id });
              }}>アクセス停止</button>}
            </li>)}
          </ul>
        </section>
      </div>}
      {dashboard.school && <section className={panel}>
        <h2 className="font-bold">学校別の効果（運営用）</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">集計月 <input className="rounded border p-2" type="month" value={month || dashboard.month} disabled={busy} onChange={(event) => { setMonth(event.target.value); setReport(null); }} /></label>
          <button className={secondary} disabled={busy} onClick={() => void loadReport()}>集計を表示</button>
        </div>
        {report && <>
          <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              ['学校ページ閲覧', report.traffic.status === 'ok' ? report.traffic.views : '未取得'],
              ['公式サイトへのクリック', report.traffic.status === 'ok' ? report.traffic.officialClicks : '未取得'],
              ['資料請求ボタンのクリック', report.traffic.status === 'ok' ? report.traffic.requestClicks : '未取得'],
              ['請求受付', report.received], ['学校へ公開', report.shared], ['発送済み', report.shipped],
            ].map(([label, value]) => <div className="rounded bg-slate-50 p-3" key={label}><dt className="text-sm">{label}</dt><dd className="font-semibold">{typeof value === 'number' ? value.toLocaleString('ja-JP') : value}</dd></div>)}
          </dl>
          {report.traffic.status !== 'ok' && <p className="text-sm text-slate-600">GA4の設定または接続をご確認ください。請求件数はサイト側の記録です。</p>}
          <p className="text-sm text-slate-600">{report.month}の集計。閲覧・クリックはGA4、請求はそれぞれの受付日・公開日・発送日を基準に集計します。</p>
        </>}
      </section>}
      <section className={panel}>
        <h2 className="font-bold">資料請求 {dashboard.requestCount}件</h2>
        <ul className="divide-y">
          {dashboard.requests.map((item) => <li className={`py-3 text-sm ${detail?.id === item.id ? 'bg-blue-50' : ''}`} key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <span><span className="font-mono text-xs text-slate-600">受付 {item.id.slice(0, 8)}</span>　{item.recipient_label}　{requestLabels[item.status]}　{formatDate(item.created_at)}</span>
              <button className="text-blue-700 underline" disabled={busy} onClick={() => {
                if (detail?.id === item.id) { setDetail(null); return; }
                setDetail(null);
                void action({ type: 'request', id: item.id, action: 'viewed' });
              }}>{detail?.id === item.id ? '閉じる' : '受付内容を確認'}</button>
            </div>
            {detail?.id === item.id && <div className="mt-3 space-y-2 rounded-lg border-l-4 border-blue-700 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold">受付 {detail.id.slice(0, 8)}　{detail.recipient_label}への資料請求</h3>
                <button onClick={() => setDetail(null)} className="text-sm text-blue-700 underline">閉じる</button>
              </div>
              <p>{detail.addressee} 様　〒{detail.postal_code} {detail.address}</p>
              <p className="break-all">受付連絡先 {detail.email}　電話番号 {detail.phone || '入力なし'}</p>
              <p className="text-sm">提供先法人 {detail.recipient_name}　同意日時 {formatDate(detail.consented_at)}</p>
              <p className="text-sm text-slate-600">{detail.consent_text}</p>
              <div className="flex flex-wrap gap-2">
                {['received', 'held'].includes(detail.status) && <button disabled={busy} className={primary} onClick={() => {
                  if (window.confirm(`${detail.recipient_label}に請求内容を公開して通知しますか？`)) void action({ type: 'request', id: detail.id, action: 'shared' });
                }}>学校へ公開</button>}
                {detail.status === 'received' && <button disabled={busy} className={secondary} onClick={() => void action({ type: 'request', id: detail.id, action: 'held' })}>保留</button>}
                {['received', 'held', 'shared', 'acknowledged'].includes(detail.status) && <button disabled={busy} className={secondary} onClick={() => {
                  if (window.confirm(`受付 ${detail.id.slice(0, 8)} の請求を取り消しますか？`)) void action({ type: 'request', id: detail.id, action: 'cancelled' });
                }}>取消</button>}
              </div>
            </div>}
          </li>)}
        </ul>
        {dashboard.requestCount === 0 && <p className="text-sm text-slate-600">対象の資料請求はありません。</p>}
        {dashboard.requestCount > 25 && <div className="flex gap-4 text-sm"><button disabled={page === 1 || busy} onClick={() => { setDetail(null); setPage(page - 1); }}>前へ</button><span>{page}ページ</span><button disabled={page * 25 >= dashboard.requestCount || busy} onClick={() => { setDetail(null); setPage(page + 1); }}>次へ</button></div>}
      </section>
      <section className={panel}>
        <h2 className="font-bold">学校提供情報の確認</h2>
        {!dashboard.content.length && <p className="text-sm text-slate-600">対象の掲載はありません。</p>}
        {dashboard.content.map((post) => <article key={post.id} className="space-y-2 rounded-lg border p-4">
          <h3 className="font-semibold">{relatedName(post.schools)}　{post.kind === 'photo' ? '写真' : 'メッセージ'}</h3>
          <p className="text-sm text-slate-600">{contentLabels[post.status]}</p>
          {post.kind === 'photo' ? <figure><Image unoptimized src={`${endpoint}?view=photo&id=${post.id}`} width={640} height={400} alt={post.alt ?? ''} className="max-h-64 w-auto object-contain" /><figcaption>{post.caption}</figcaption></figure>
            : <p className="whitespace-pre-wrap break-words">{post.body}</p>}
          {post.stop_reason && <p className="text-sm text-amber-900">停止理由 {post.stop_reason}</p>}
          <div className="flex gap-2">
            {['pending', 'revision_pending'].includes(post.status) && <button className={primary} disabled={busy} onClick={() => void action({ type: 'content', id: post.id, action: 'approve' })}>{post.status === 'revision_pending' ? '確認して公開' : '確認済みにする'}</button>}
            {post.status !== 'stopped' && <button className={secondary} disabled={busy} onClick={() => setStop(post.id)}>掲載停止</button>}
          </div>
          {stop === post.id && <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get('reason');
            void action({ type: 'content', id: post.id, action: 'stop', reason });
          }}>
            <label className="block text-sm">学校へ伝える理由と修正のお願い<textarea name="reason" required maxLength={600} rows={3} className={input} /></label>
            <button disabled={busy} className="rounded bg-red-700 px-4 py-2 text-sm text-white">非表示にして学校へ通知</button>
          </form>}
        </article>)}
      </section>
      {undelivered.length > 0 && <section className="space-y-3 rounded-xl border-2 border-red-300 bg-red-50 p-5">
        <h2 className="font-bold text-red-900">届かなかったメール {undelivered.length}件</h2>
        <p className="text-sm text-red-900">送信はできていますが、宛先に届いていません。種類ごとの対応を確認してください。</p>
        <ul className="space-y-2">
          {undelivered.map((item) => <li className="rounded-lg bg-white p-3 text-sm" key={item.id}>
            <p><span className="font-semibold text-red-900">{deliveryLabels[item.status as keyof typeof deliveryLabels] ?? item.status}</span>　{relatedName(item.schools)}　{item.kind === 'school_invitation' ? '学校担当者の招待' : item.kind === 'applicant_receipt' ? '受付確認メール（応募者宛）' : '資料請求の新着通知'}</p>
            <p className="break-all text-slate-700">宛先 {item.recipient}　送信 {formatDate(item.created_at)}</p>
            {item.detail && <p className="text-slate-600">{item.detail}</p>}
            <p className="text-slate-700">{item.kind === 'school_invitation'
              ? 'アドレスの誤りを学校に確認し、正しいアドレスで招待し直してください。'
              : item.kind === 'applicant_receipt'
                ? '入力ミスのほか、いたずらの可能性もあります。学校へ公開する前に、請求の内容を確認してください。'
                : '担当者のアドレスを確認し、必要なら学校へ電話等で直接連絡してください。'}</p>
          </li>)}
        </ul>
      </section>}
      {notices.length > 0 && <section className={panel}>
        <h2 className="font-bold">送信待ち・失敗した通知</h2>
        {notices.map((item) => <div className="flex flex-wrap items-center gap-3" key={`${item.event_kind}:${item.event_id}`}>
          <span className="text-sm">{relatedName(item.schools)}　{item.event_kind === 'request_shared' ? '資料請求' : '掲載停止'}</span>
          <button className={secondary} disabled={busy} onClick={() => void action({ type: 'retry', id: item.event_id, kind: item.event_kind })}>再送する</button>
        </div>)}
      </section>}
    </>}
  </div>;
}
