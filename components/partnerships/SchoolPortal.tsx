'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import { contentLabels, requestLabels } from '@/lib/partnerships/model';
import PartnershipMfa from './PartnershipMfa';
import { getPartnershipAuth } from './auth';

const schoolEndpoint = apiPath('/api/school-portal');
// 運営が学校の画面を代わりに表示するときのAPI（?school=<学校ID> を付ける）
const operatorEndpoint = apiPath('/api/admin/partnerships/school-view');
function portalUrl(operatorSchoolId?: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(operatorSchoolId ? { school: operatorSchoolId, ...params } : params).toString();
  return `${operatorSchoolId ? operatorEndpoint : schoolEndpoint}${query ? `?${query}` : ''}`;
}
const input = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2';
const primary = 'rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50';
const panel = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6';

type RequestRow = { id: string; status: string; shared_at: string; can_view: boolean };
type RequestDetail = Pick<RequestRow, 'id' | 'status' | 'shared_at'> & { addressee: string; postal_code: string; address: string; phone: string | null; shipped_at: string | null };
type Content = { id: string; kind: string; status: string; body: string | null; caption: string | null; alt: string | null; stop_reason: string | null; submitted_scope?: string };
type Dashboard = {
  school: { name: string; slug: string };
  settings: { content_enabled: boolean; request_enabled: boolean };
  official_link: { url: string | null } | null;
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

type SaveResult = { ok: boolean; message: string };

// 結果は保存ボタンのすぐ下に出す（画面上部のメッセージ欄は、この枠からは見えない位置にあるため）。
// 保存すると掲載内容のIDが変わり、この枠は作り直されるので、結果は親が持って渡す。
function ContentEditor({ content, kind, result, onSave, photoUrl, operator }: { content?: Content; kind: 'photo' | 'message'; result?: SaveResult; onSave: (kind: 'photo' | 'message', form: FormData) => Promise<SaveResult>; photoUrl: (id: string) => string; operator: boolean }) {
  const title = kind === 'photo' ? '学校提供の写真' : '学校からのメッセージ';
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    setBusy(true);
    try {
      const outcome = await onSave(kind, payload);
      if (outcome.ok && kind === 'photo') form.reset();
    } finally { setBusy(false); }
  }
  const needsReview = content && ['stopped', 'revision_pending'].includes(content.status);
  return <section className={panel}>
    <h3 className="font-bold">{title}</h3>
    <p className="text-sm text-slate-600">{content ? contentLabels[content.status] : '未登録'}{content?.submitted_scope === 'operator' && '（運営が登録）'}</p>
    {content?.stop_reason && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">修正のお願い {content.stop_reason}</p>}
    {kind === 'photo' && content && <Image unoptimized src={photoUrl(content.id)} width={640} height={400} alt={content.alt ?? ''} className="max-h-52 w-full rounded object-contain" />}
    <form method="post" className="space-y-3" onSubmit={submit}>
      <input type="hidden" name="kind" value={kind} />
      {kind === 'photo' ? <>
        <label className="block">写真（JPEG・PNG・WebP、3MB以内）<input name="file" type="file" accept="image/jpeg,image/png,image/webp" className={input} required /></label>
        <div>
          <label className="block">写真の説明（目の見えない方への読み上げ・検索用）
            <input name="alt" className={input} defaultValue={content?.alt ?? ''} maxLength={120} required aria-describedby="alt-help" placeholder="例：明るい教室で、生徒が机に向かって学習している様子" />
          </label>
          <p id="alt-help" className="mt-1 space-y-1 text-xs text-slate-600">
            <span className="block">写真が見えない方のために、画面読み上げソフトがこの文章を読み上げます。画像が表示されないときの代わりの表示や、Googleなどの検索で画像の内容を伝える手がかりにも使われます。</span>
            <span className="block">写っているものを具体的に書いてください。（画面には表示されません）</span>
            <span className="block">例：明るい教室で、生徒が机に向かって学習している様子</span>
          </p>
        </div>
        <div>
          <label className="block">キャプション（任意）<input name="caption" className={input} defaultValue={content?.caption ?? ''} maxLength={120} aria-describedby="caption-help" placeholder="例：教室の一風景です" /></label>
          <p id="caption-help" className="mt-1 text-xs text-slate-600">写真の下に表示される短い補足です。「（学校提供）」の表記は自動で付きます。<br />例：教室の一風景です</p>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="permission" required />この写真を公開するために必要な許可を確認しました。</label>
      </> : <label className="block">メッセージ（300字以内）<textarea name="body" className={input} defaultValue={content?.body ?? ''} maxLength={300} rows={5} required /></label>}
      <button disabled={busy} className={primary}>{operator ? '代理で登録して公開する' : needsReview ? '修正版を提出する' : '保存して公開する'}</button>
      {result && <p role={result.ok ? 'status' : 'alert'} className={`rounded p-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{result.message}</p>}
    </form>
  </section>;
}

function OfficialLinkEditor({ link, onSave }: { link: { url: string | null }; onSave: (url: string) => Promise<{ ok: boolean; message: string }> }) {
  const [busy, setBusy] = useState(false);
  // 結果は入力欄のすぐ下に出す（画面上部のメッセージ欄は、この枠からは見えない位置にあるため）
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get('url') ?? '');
    setBusy(true);
    setResult(null);
    try { setResult(await onSave(url)); } finally { setBusy(false); }
  }
  return <section className={panel}>
    <h3 className="font-bold">公式サイトのボタン</h3>
    <p className="text-sm text-slate-600">貴校の公開ページに表示される「公式サイトを見る」ボタンのリンク先です。保存するとすぐに公開ページへ反映されます。リンク先を設定しないと、ボタンは表示されません。</p>
    <form method="post" className="space-y-3" onSubmit={submit}>
      <label className="block">リンク先のURL（https:// で始まるもの）
        <input key={link.url ?? ''} name="url" type="url" className={input} defaultValue={link.url ?? ''} maxLength={500} placeholder="https://example.ac.jp/" />
      </label>
      <p className="text-xs text-slate-600">空欄で保存すると、設定を外します（公開ページのボタンは表示されなくなります）。</p>
      <button disabled={busy} className={primary}>保存して公開する</button>
      {result && <p role={result.ok ? 'status' : 'alert'} className={`rounded p-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{result.message}</p>}
    </form>
  </section>;
}

export default function SchoolPortal({ operatorSchoolId }: { operatorSchoolId?: string }) {
  // 運営の代理表示か。学校と同じ画面を出し、写真・メッセージ・公式サイトのリンクは代理で登録できる。
  // 資料請求の「確認済み」「発送済み」は学校だけの操作なので、運営の表示では出さない。
  const operator = Boolean(operatorSchoolId);
  const [phase, setPhase] = useState<'loading' | 'login' | 'mfa' | 'ready' | 'error'>('loading');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [contentResults, setContentResults] = useState<Partial<Record<'photo' | 'message', SaveResult>>>({});

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(portalUrl(operatorSchoolId, { month, page: String(page) }), { cache: 'no-store', signal });
      const data = await response.json();
      if (signal?.aborted) return;
      if (operator && data.code === 'login') {
        setDashboard(null);
        setPhase('error');
        setError('運営管理者としてログインしてください。');
      } else if (data.code === 'login' || data.code === 'mfa') {
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
  }, [month, page, operator, operatorSchoolId]);

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

  async function post(payload: { id: string; action: string }) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const response = await fetch(portalUrl(operatorSchoolId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        if ([401, 403, 404].includes(response.status)) { setDetail(null); await load(); }
        return false;
      }
      setDetail(data);
      await load();
      return true;
    } catch {
      setError('通信に失敗しました。');
      return false;
    } finally { setBusy(false); }
  }

  async function saveContent(kind: 'photo' | 'message', payload: FormData): Promise<SaveResult> {
    setError('');
    setMessage('');
    const finish = (outcome: SaveResult) => { setContentResults((current) => ({ ...current, [kind]: outcome })); return outcome; };
    setContentResults((current) => ({ ...current, [kind]: undefined }));
    try {
      const response = await fetch(portalUrl(operatorSchoolId), { method: 'POST', body: payload });
      const data = await response.json();
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) { setDetail(null); await load(); }
        return finish({ ok: false, message: data.error ?? '掲載内容を保存できませんでした。' });
      }
      await load();
      return finish({ ok: true, message: operator ? '代理で登録しました。運営の確認済みとして公開されています。' : '保存しました。' });
    } catch {
      return finish({ ok: false, message: '通信に失敗しました。' });
    }
  }

  async function saveLink(url: string): Promise<{ ok: boolean; message: string }> {
    setError('');
    setMessage('');
    try {
      const response = await fetch(portalUrl(operatorSchoolId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'official_link', url }) });
      const data = await response.json();
      if (!response.ok) return { ok: false, message: data.error ?? 'リンク先を保存できませんでした。' };
      await load();
      return { ok: true, message: data.url ? '保存しました。公開ページに反映されています。' : '設定を外しました。' };
    } catch {
      return { ok: false, message: '通信に失敗しました。' };
    }
  }

  const total = dashboard ? Object.values(dashboard.counts).reduce((sum, value) => sum + value, 0) : 0;
  return <main className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 py-8 sm:px-6">
    <div className="flex items-start justify-between gap-3"><h1 className="text-2xl font-bold">学校向け管理画面{operator && '（運営として表示中）'}</h1>
      {operator
        ? <Link href={appPath(`/admin/partnerships?school=${operatorSchoolId}`)} className="text-sm text-blue-700 underline">学校提携・資料請求に戻る</Link>
        : phase !== 'loading' && phase !== 'login' && <button onClick={logout} className="text-sm text-blue-700 underline">ログアウト</button>}
    </div>
    {operator && <p className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      運営として、この学校の管理画面を表示しています。写真・メッセージ・公式サイトのリンクは、代理で登録できます（運営の確認済みとして、すぐに公開されます）。資料請求の「確認済み」「発送済み」の記録は、学校の担当者だけが行えます。
    </p>}
    {phase === 'loading' && <p>読み込み中…</p>}
    {phase === 'login' && <SchoolLogin onSuccess={() => void load()} />}
    {phase === 'mfa' && <PartnershipMfa scope={operator ? 'operator' : 'school'} onSuccess={() => void load()} />}
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
          {operator && detail.status !== 'shipped' && <p className="text-sm text-slate-600">確認済み・発送済みの記録は、学校の担当者が行います（現在の状況：{requestLabels[detail.status]}）。</p>}
          {!operator && detail.status === 'shared' && <button disabled={busy} className={primary} onClick={() => void post({ id: detail.id, action: 'acknowledged' })}>確認済みにする</button>}
          {!operator && detail.status === 'acknowledged' && <button disabled={busy} className={primary} onClick={() => void post({ id: detail.id, action: 'shipped' })}>発送済みにする</button>}
          {detail.status === 'shipped' && <p>発送済み</p>}
        </div>}
      </section>
      {dashboard.official_link && <OfficialLinkEditor link={dashboard.official_link} onSave={saveLink} />}
      {dashboard.settings.content_enabled && <div className="grid gap-4 md:grid-cols-2">
        {(['photo', 'message'] as const).map((kind) => {
          const content = dashboard.content.find((item) => item.kind === kind);
          return <ContentEditor key={content?.id ?? kind} kind={kind} content={content} result={contentResults[kind]} onSave={saveContent} photoUrl={(id) => portalUrl(operatorSchoolId, { photo: id })} operator={operator} />;
        })}
      </div>}
    </>}
  </main>;
}
