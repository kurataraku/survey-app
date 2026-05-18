'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  ends_at: string;
}

export default function CampaignBanner() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch(apiPath('/api/campaign/active'))
      .then((r) => r.json())
      .then((d) => {
        const c = d.campaign as Campaign | null;
        setCampaign(c);
        if (c) {
          const endsAt = new Date(c.ends_at);
          setDaysLeft(
            Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }
      });
  }, []);

  if (!campaign || daysLeft === null) return null;

  const rewardLabel = campaign.reward_amount.toLocaleString('ja-JP');

  return (
    <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: '#FFF8E7', border: '1px solid #F59E0B' }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🎁
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-800 text-sm">
            【キャンペーン実施中】口コミ投稿で QUOカードPay {rewardLabel}円分プレゼント！
          </p>
          {campaign.description && (
            <p className="text-amber-700 text-xs mt-0.5">{campaign.description}</p>
          )}
          <p className="text-amber-600 text-xs mt-1">
            承認された方に進呈（2020年以降の入学者が対象）。残り {daysLeft} 日
          </p>
          <Link
            href={appPath('/campaign')}
            className="inline-block mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            キャンペーン詳細を見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
