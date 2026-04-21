'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  ends_at: string;
}

export default function CampaignBanner() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    fetch(apiPath('/api/campaign/active'))
      .then((r) => r.json())
      .then((d) => setCampaign(d.campaign));
  }, []);

  if (!campaign) return null;

  const endsAt = new Date(campaign.ends_at);
  const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: '#FFF8E7', border: '1px solid #F59E0B' }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">🎁</span>
        <div>
          <p className="font-bold text-amber-800 text-sm">
            【キャンペーン実施中】口コミ投稿で QUOカードPay {campaign.reward_amount.toLocaleString()}円分プレゼント！
          </p>
          {campaign.description && (
            <p className="text-amber-700 text-xs mt-0.5">{campaign.description}</p>
          )}
          <p className="text-amber-600 text-xs mt-1">
            口コミが承認された方全員に進呈。残り {daysLeft} 日
          </p>
        </div>
      </div>
    </div>
  );
}
