'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';

interface Campaign {
  id: string;
  title: string;
  reward_amount: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

interface Grant {
  id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  sent_at: string | null;
}

export default function CampaignGrantsPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [campaignsRes, grantsRes] = await Promise.all([
      fetch(apiPath('/api/admin/campaigns')),
      fetch(apiPath(`/api/admin/campaigns/${id}/grants`)),
    ]);
    const campaignsJson = await campaignsRes.json();
    const grantsJson = await grantsRes.json();

    const found = (campaignsJson.campaigns ?? []).find((c: Campaign) => c.id === id);
    setCampaign(found ?? null);
    setGrants(grantsJson.grants ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const markSent = async (grantId: string) => {
    setMarking(grantId);
    await fetch(apiPath(`/api/admin/campaigns/${id}/grants/${grantId}`), {
      method: 'PATCH',
    });
    await load();
    setMarking(null);
  };

  const pendingCount = grants.filter(g => g.status === 'pending').length;
  const sentCount = grants.filter(g => g.status === 'sent').length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={appPath('/admin/campaigns')} className="text-sm text-blue-600 hover:underline">
            ← キャンペーン一覧に戻る
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-12">読み込み中...</p>
        ) : !campaign ? (
          <p className="text-gray-500 text-center py-12">キャンペーンが見つかりません</p>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{campaign.title}</h1>
              <p className="text-sm text-gray-600">
                QUOカード {campaign.reward_amount.toLocaleString()}円 ／{' '}
                {new Date(campaign.starts_at).toLocaleDateString('ja-JP')} 〜{' '}
                {new Date(campaign.ends_at).toLocaleDateString('ja-JP')}
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-orange-600 font-medium">未送付: {pendingCount}件</span>
                <span className="text-green-600 font-medium">送付済み: {sentCount}件</span>
              </div>
            </div>

            {grants.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">対象者はまだいません</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">メールアドレス</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">承認日時</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grants.map((grant) => (
                      <tr key={grant.id}>
                        <td className="px-4 py-3 text-gray-900">{grant.email}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(grant.created_at).toLocaleString('ja-JP')}
                        </td>
                        <td className="px-4 py-3">
                          {grant.status === 'sent' ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                              送付済み
                            </span>
                          ) : grant.status === 'pending' ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                              未送付
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-medium">
                              失敗
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {grant.status === 'pending' && (
                            <button
                              onClick={() => markSent(grant.id)}
                              disabled={marking === grant.id}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {marking === grant.id ? '更新中...' : '送付済みにする'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
