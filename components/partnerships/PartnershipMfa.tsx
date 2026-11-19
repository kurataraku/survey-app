'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { getPartnershipAuth } from './auth';

export default function PartnershipMfa({ scope, onSuccess }: { scope: 'school' | 'operator'; onSuccess: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr?: string; secret?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function prepare() {
    setBusy(true);
    setError('');
    try {
      const auth = getPartnershipAuth(scope).auth;
      const { data, error: listError } = await auth.mfa.listFactors();
      if (listError) throw listError;
      const registered = data.totp.find((item: { id: string; status: string }) => item.status === 'verified');
      if (registered) {
        setFactor({ id: registered.id });
        return;
      }
      for (const item of data.all) {
        if (item.factor_type === 'totp' && item.status === 'unverified') await auth.mfa.unenroll({ factorId: item.id });
      }
      const { data: enrolled, error: enrollError } = await auth.mfa.enroll({ factorType: 'totp', issuer: 'tsushin-realreview', friendlyName: `admin-${Date.now()}` });
      if (enrollError) throw enrollError;
      setFactor({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    } catch {
      setError('認証アプリの設定を取得できませんでした。');
    } finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor) return;
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    setBusy(true);
    setError('');
    try {
      const { error: verifyError } = await getPartnershipAuth(scope).auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyError) throw verifyError;
      onSuccess();
    } catch {
      setError('認証コードを確認して、もう一度お試しください。');
    } finally { setBusy(false); }
  }

  return <section className="max-w-lg space-y-4 rounded-xl border bg-white p-5">
    <h2 className="text-lg font-semibold">二要素認証</h2>
    <p className="text-sm text-slate-600">資料請求と提携情報の管理には、認証アプリによる確認が必要です。</p>
    {factor ? <form method="post" className="space-y-3" onSubmit={verify}>
      {factor.qr && <div className="space-y-2 text-sm">
        <p>認証アプリでQRコードを読み取ってください。</p>
        {/* QRコードはSVGのdata URLなので next/image は使わない */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={factor.qr} width={180} height={180} alt="認証アプリ登録用QRコード" />
        <div className="space-y-1 rounded border bg-slate-50 p-3">
          <p className="font-medium">QRが読み取れないときは、こちらを手入力してください</p>
          <p>アカウント名: 任意（例「通信制高校リアルレビュー」）／ キーの種類: 時間ベース</p>
          <code className="block break-all rounded bg-white p-2 text-base tracking-wider">{factor.secret}</code>
        </div>
      </div>}
      <label className="block">認証アプリの6桁のコード<input name="code" required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" className="mt-1 block w-full rounded border p-2" /></label>
      <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">確認する</button>
    </form> : <button onClick={prepare} disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">認証アプリで確認する</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
