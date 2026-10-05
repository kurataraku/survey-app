'use client';

import { useState } from 'react';
import { apiPath } from '@/lib/base-path';

export default function UnsubscribeForm({ e, t }: { e: string; t: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async () => {
    setState('sending');
    try {
      const res = await fetch(apiPath('/api/unsubscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e, t }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <p className="text-sm text-gray-700 leading-relaxed">
        配信を停止しました。今後、お知り合いへのご紹介に関するご案内はお送りしません。<br />
        なお、口コミの掲載や謝礼のお届けなど、ご投稿に関するご連絡は引き続きお送りすることがあります。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700 leading-relaxed">
        「通信制高校リアルレビュー」からの、お知り合いへのご紹介に関するご案内メールを停止します。
        よろしければ下のボタンを押してください。
      </p>
      {state === 'error' && (
        <p className="text-sm text-red-600">
          処理に失敗しました。時間をおいて再度お試しいただくか、お問い合わせページよりご連絡ください。
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={state === 'sending'}
        className="px-5 py-2 text-sm font-medium bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
      >
        {state === 'sending' ? '処理中...' : '配信を停止する'}
      </button>
    </div>
  );
}
