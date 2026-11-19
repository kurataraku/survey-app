'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import { consentText, consentVersion } from '@/lib/partnerships/model';

const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

export default function SchoolMaterialRequestForm({ school }: { school: { id: string; name: string; slug: string; recipient: string } }) {
  const submission = useRef<string | null>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [id, setId] = useState('');
  const schoolHref = appPath(`/schools/${encodeURIComponent(school.slug)}`);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    submission.current ??= crypto.randomUUID();
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(apiPath('/api/material-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(fields),
          school_id: school.id,
          recipient_label: school.name,
          recipient_name: school.recipient,
          submission_key: submission.current,
          consent: fields.get('consent') === 'on',
          consent_version: consentVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error);
      else setId(data.id);
    } catch {
      setError('通信に失敗しました。同じ内容で再送できます。');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (id) return (
    <div className="space-y-4" role="status">
      <h2 className="text-xl font-bold">資料請求を受け付けました</h2>
      <p>運営が内容を確認してから、{school.name}へ共有します。資料は学校から郵送されます。</p>
      <p className="break-all text-sm text-slate-600">受付番号 {id}</p>
      <Link className="text-blue-700 underline" href={schoolHref}>学校ページに戻る</Link>
    </div>
  );

  return (
    <form method="post" onSubmit={submit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="block font-medium">お申込みの方
          <select className={inputClass} name="applicant_role" defaultValue="" required>
            <option value="" disabled>選択してください</option><option value="guardian">保護者</option><option value="adult">18歳以上の本人</option>
          </select>
        </label>
        <label className="block font-medium">宛名<input className={inputClass} name="addressee" autoComplete="name" required maxLength={80} /></label>
        <label className="block font-medium">郵便番号<input className={inputClass} name="postal_code" autoComplete="postal-code" inputMode="numeric" placeholder="123-4567" required maxLength={12} /></label>
        <label className="block font-medium">住所（建物名・部屋番号まで）<input className={inputClass} name="address" autoComplete="street-address" required maxLength={240} /></label>
        <label className="block font-medium">受付連絡用メールアドレス<input className={inputClass} type="email" name="email" autoComplete="email" required maxLength={254} /></label>
        <label className="block font-medium">電話番号（任意）<input className={inputClass} type="tel" name="phone" autoComplete="tel" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <div hidden><label>ウェブサイト<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed">
          <h2 className="font-bold">個人情報の取扱い</h2>
          <p>{consentText(school.name, school.recipient, Boolean(phone.trim()))}</p>
          <Link href={appPath('/privacy')} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">プライバシーポリシー</Link>
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>個人情報の取扱いを確認し、上記の目的で{school.name}へ情報を提供することに同意します。</span>
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60" type="submit">
          {pending ? '送信中…' : '同意して無料で資料請求する'}
        </button>
      </fieldset>
    </form>
  );
}
