'use client';

import { useState } from 'react';
import {
  buildLineShareUrl,
  buildReferralMessage,
  describeReferralReward,
  REFERRAL_MESSAGE_SUBJECT,
  type ReferralShareInfo,
} from '@/lib/referral/shared';

export default function ReferralShareBlock({ referral }: { referral: ReferralShareInfo }) {
  const [copied, setCopied] = useState<'message' | 'url' | null>(null);
  const message = buildReferralMessage(referral);

  const copy = async (kind: 'message' | 'url') => {
    const text = kind === 'message' ? message : referral.url;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('コピーしてお使いください', text);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ text: message });
    } catch {
      // キャンセル時は何もしない
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="mt-8 text-left rounded-lg border border-blue-200 bg-blue-50 p-6">
      <p className="text-lg font-bold text-blue-900 mb-2">お知り合いにも口コミ投稿をお願いできませんか？</p>
      <p className="text-sm text-blue-900 leading-relaxed mb-4">
        通信制高校に通っている・通っていた方や、その保護者の方がお知り合いにいらっしゃれば、
        下の文面をそのまま送ってください。ご紹介した方の口コミが掲載されると、
        <strong>{describeReferralReward(referral)}</strong>
        をお贈りします。
      </p>

      <label className="block text-xs font-medium text-blue-800 mb-1">
        送る文面（あなた専用のURL入り・そのまま使えます）
      </label>
      <textarea
        readOnly
        value={message}
        rows={8}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full text-sm border border-blue-200 rounded px-3 py-2 bg-white text-gray-800 resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy('message')}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {copied === 'message' ? 'コピーしました' : '文面をコピー'}
        </button>
        <a
          href={buildLineShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium rounded text-white"
          style={{ backgroundColor: '#06C755' }}
        >
          LINEでこの文面を送る
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(REFERRAL_MESSAGE_SUBJECT)}&body=${encodeURIComponent(message)}`}
          className="px-4 py-2 text-sm font-medium rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-100"
        >
          メールで送る
        </a>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="px-4 py-2 text-sm font-medium rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-100"
          >
            その他の方法で送る
          </button>
        )}
        <button
          type="button"
          onClick={() => copy('url')}
          className="px-4 py-2 text-sm font-medium rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-100"
        >
          {copied === 'url' ? 'コピーしました' : 'URLだけコピー'}
        </button>
      </div>

      <ul className="mt-4 text-xs text-blue-700 space-y-1 list-disc list-inside">
        <li>特典は、ご自身とご紹介した方の口コミがそれぞれ承認・掲載された後にお送りします。</li>
        <li>ご本人による別アドレスでの投稿や、内容が掲載基準を満たさない場合は対象外です。</li>
        <li>この文面とURLは、口コミ掲載のお知らせメールにも記載します。</li>
      </ul>
    </div>
  );
}
