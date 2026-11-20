'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import { contentLabels, requestLabels } from '@/lib/partnerships/model';
import PartnershipMfa from './PartnershipMfa';
import { getPartnershipAuth } from './auth';

const endpoint = apiPath('/api/school-portal');
const input = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2';
const primary = 'rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50';
const panel = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6';

type RequestRow = { id: string; status: string; shared_at: string; can_view: boolean };
type RequestDetail = Pick<RequestRow, 'id' | 'status' | 'shared_at'> & { addressee: string; postal_code: string; address: string; phone: string | null; shipped_at: string | null };
type Content = { id: string; kind: string; status: string; body: string | null; caption: string | null; alt: string | null; stop_reason: string | null };
type Dashboard = {
  school: { name: string; slug: string };
  settings: { content_enabled: boolean; request_enabled: boolean };
  official_link: { enabled: boolean; url: string | null } | null;
  content: Content[];
  requests: RequestRow[];
  counts: { shared: number; acknowledged: number; shipped: number };
  month: string;
};

function SchoolLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    setBusy(true);
    setError('');
    try {
      const auth = getPartnershipAuth('school').auth;
      if (sent) {
        const { error: verifyError } = await auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
        if (verifyError) throw verifyError;
        onSuccess();
      } else {
        const { error: sendError } = await auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
        if (sendError) throw sendError;
        setSent(true);
      }
    } catch {
      setError(sent ? 'メールに届いたコードと有効期限をご確認ください。' : 'コードを送れませんでした。学校担当者として登録済みのアドレスをご確認ください。');
    } finally { setBusy(false); }
  }

  return <section className={`${panel} max-w-lg`}>
    <h2 className="font-semibold">学校担当者ログイン</h2>
    <form method="post" onSubmit={submit} className="space-y-3">
      <label className="block">学校の業務用メールアドレス<input type="email" className={input} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required readOnly={sent} /></label>
      {sent && <label className="block">メールに届いた認証コード<input name="code" className={input} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" /></label>}
      <button disabled={busy} className={primary}>{sent ? 'ログインする' : '認証コードを送る'}</button>
      {sent && <button type="button" disabled={busy} onClick={() => setSent(false)} className="ml-3 text-sm text-blue-700 underline">メールアドレス変更・再送</button>}
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}

function ContentEditor({ content, kind, onSave }: { content?: Content; kind: 'photo' | 'message'; onSave: (form: FormData) => Promise<boolean> }) {
  const title = kind === 'photo' ? '学校提供の写真' : '学校からのメッセージ';
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    setBusy(true);
    try { if (await onSave(payload) && kind === 'photo') form.reset(); } finally { setBusy(false); }
  }
  const needsReview = content && ['stopped', 'revision_pending'].includes(content.status);
  return <section className={panel}>
    <h3 className="font-bold">{title}</h3>
    <p className="text-sm text-slate-600">{content ? contentLabels[content.status] : '未登録'}</p>
    {content?.stop_reason && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">修正のお願い {content.stop_reason}</p>}
    {kind === 'photo' && content && <Image unoptimized src={`${endpoint}?photo=${content.id}`} width={640} height={400} alt={content.alt ?? ''} className="max-h-52 w-full rounded object-contain" />}
    <form method="post" className="space-y-3" onSubmit={submit}>
      <input type="hidden" name="kind" value={kind} />
      {kind === 'photo' ? <>
        <label className="block">写真（JPEG・PNG・WebP、3MB以内）<input name="file" type="file" accept="image/jpeg,image/png,image/webp" className={input} required /></label>
        <label className="block">写真の説明（読み上げ用）<input name="alt" className={input} defaultValue={content?.alt ?? ''} maxLength={120} required /></label>
        <label className="block">キャプション（任意）<input name="caption" className={input} defaultValue={content?.caption ?? ''} maxLength={120} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="permission" required />この写真を公開するために必要な許可を確認しました。</label>
      </> : <label className="block">メッセージ（300字以内）<textarea name="body" className={input} defaultValue={content?.body ?? ''} maxLength={300} rows={5} required /></label>}
      <button disabled={busy} className={primary}>{needsReview ? '修正版を提出する' : '保存して公開する'}</button>
    </form>
  </section>;
}

function OfficialLinkEditor({ link, onSave }: { link: { enabled: boolean; url: string | null }; onSave: (url: string) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get('url') ?? '');
    setBusy(true);
    try { await onSave(url); } finally { setBusy(false); }
  }
  return <section className={panel}>
    <h3 className="font-bold">公式サイトのボタン</h3>
    <p className="text-sm text-slate-600">貴校の公開ページに表示される「公式サイトを見る」ボタンのリンク先です。保存するとすぐに公開ページへ反映されます。</p>
    {!link.enabled && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">現在、このボタンは公開ページに表示されない設定です。表示を希望する場合は運営へご連絡ください。</p>}
    <form method="post" className="space-y-3" onSubmit={submit}>
      <label className="block">リンク先のURL（https:// で始まるもの）
        <input key={link.url ?? ''} name="url" type="url" className={input} defaultValue={link.url ?? ''} maxLength={500} placeholder="https://example.ac.jp/" />
      </label>
      <p className="text-xs text-slate-600">空欄で保存すると、設定を外します（運営が登録した公式サイトのURLがあれば、そちらが使われます）。</p>
      <button disabled={busy} className={primary}>保存して公開する</button>
    </form>
  </section>;
}

export default function SchoolPortal() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'mfa' | 'ready' | 'error'>('loading');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ month, page: String(page) })}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (signal?.aborted) return;
      if (data.code === 'login' || data.code === 'mfa') {
        setDashboard(null);
        setDetail(null);
        setPhase(data.code);
      } else if (response.ok) {
        setDashboard(data);
        setPhase('ready');
      } else {
        setDashboard(null);
        setDetail(null);
        setPhase('error');
        setError(data.error);
      }
    } catch {
      if (signal?.aborted) return;
      setError('学校向け画面を読み込めませんでした。');
      setPhase('error');
    }
  }, [month, page]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function logout() {
    setDetail(null);
    setDashboard(null);
    setError('');
    setMessage('');
    try { await getPartnershipAuth('school').auth.signOut({ scope: 'local' }); } finally { setPhase('login'); }
  }

  async function post(payload: FormData | { id: string; action: string }) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const multipart = payload instanceof FormData;
      const response = await fetch(endpoint, { method: 'POST', headers: multipart ? undefined : { 'Content-Type': 'application/json' }, body: multipart ? payload : JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        if ([401, 403, 404].includes(response.status)) { setDetail(null); await load(); }
        return false;
      }
      if (!multipart) setDetail(data);
      if (multipart) setMessage('掲載内容を保存しました。');
      await load();
      return true;
    } catch {
      setError('通信に失敗しました。');
      return false;
    } finally { setBusy(false); }
  }

  async function saveLink(url: string) {
    setError('');
    setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'official_link', url }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return false; }
      setMessage(data.url ? '公式サイトのリンク先を保存しました。' : 'リンク先の設定を外しました。');
      await load();
      return true;
    } catch {
      setError('通信に失敗しました。');
      return false;
    }
  }

  const total = dashboard ? Object.values(dashboard.counts).reduce((sum, value) => sum + value, 0) : 0;
  return <main className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 py-8 sm:px-6">
    <div className="flex items-start justify-between gap-3"><h1 className="text-2xl font-bold">学校向け管理画面</h1>
      {phase !== 'loading' && phase !== 'login' && <button onClick={logout} className="text-sm text-blue-700 underline">ログアウト</button>}
    </div>
    {phase === 'loading' && <p>読み込み中…</p>}
    {phase === 'login' && <SchoolLogin onSuccess={() => void load()} />}
    {phase === 'mfa' && <PartnershipMfa scope="school" onSuccess={() => void load()} />}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {phase === 'ready' && dashboard && <>
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{dashboard.school.name}</h2><Link href={appPath(`/schools/${encodeURIComponent(dashboard.school.slug)}`)} className="text-sm text-blue-700 underline">公開ページを見る</Link></div>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">届いた資料請求</h3>
          <label className="text-sm">学校に公開された月 <input className="rounded border p-1" type="month" value={month || dashboard.month} onChange={(event) => { setDetail(null); setPage(1); setMonth(event.target.value); }} /></label>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['届いた件数', total], ['未確認', dashboard.counts.shared], ['発送待ち', dashboard.counts.acknowledged], ['発送済み', dashboard.counts.shipped]].map(([label, value]) => <div key={label} className="rounded bg-slate-50 p-3"><dt className="text-sm">{label}</dt><dd className="text-lg font-semibold">{value}件</dd></div>)}
        </dl>
        <ul className="divide-y">
          {dashboard.requests.map((row) => <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" key={row.id}>
            <span>{new Date(row.shared_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}　{requestLabels[row.status]}　受付番号 {row.id.slice(0, 8)}</span>
            {row.can_view ? <button className="text-blue-700 underline" disabled={busy} onClick={() => { setDetail(null); void post({ id: row.id, action: 'viewed' }); }}>詳細を見る</button> : <span>閲覧期限終了</span>}
          </li>)}
        </ul>
        {total === 0 && <p className="text-sm text-slate-600">この月に届いた資料請求はありません。</p>}
        {total > 25 && <div className="flex gap-4 text-sm"><button disabled={page === 1} onClick={() => { setDetail(null); setPage(page - 1); }}>前へ</button><span>{page}ページ</span><button disabled={page * 25 >= total} onClick={() => { setDetail(null); setPage(page + 1); }}>次へ</button></div>}
        {detail && <div className="space-y-2 rounded-lg bg-slate-50 p-4">
          <div className="flex justify-between gap-3"><h4 className="font-bold">郵送先・連絡先</h4><button onClick={() => setDetail(null)} className="text-sm text-blue-700 underline">閉じる</button></div>
          <p>{detail.addressee} 様</p><p>〒{detail.postal_code} {detail.address}</p><p>電話番号 {detail.phone || '入力なし'}</p>
          {detail.status === 'shared' && <button disabled={busy} className={primary} onClick={() => void post({ id: detail.id, action: 'acknowledged' })}>確認済みにする</button>}
          {detail.status === 'acknowledged' && <button disabled={busy} className={primary} onClick={() => void post({ id: detail.id, action: 'shipped' })}>発送済みにする</button>}
          {detail.status === 'shipped' && <p>発送済み</p>}
        </div>}
      </section>
      {dashboard.official_link && <OfficialLinkEditor link={dashboard.official_link} onSave={saveLink} />}
      {dashboard.settings.content_enabled && <div className="grid gap-4 md:grid-cols-2">
        {(['photo', 'message'] as const).map((kind) => {
          const content = dashboard.content.find((item) => item.kind === kind);
          return <ContentEditor key={content?.id ?? kind} kind={kind} content={content} onSave={post} />;
        })}
      </div>}
    </>}
  </main>;
}
