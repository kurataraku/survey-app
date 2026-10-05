'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  referral_enabled: boolean;
  referral_reward_amount: number | null;
  created_at: string;
  campaign_grants: { count: number }[];
}

const emptyForm = {
  title: '',
  description: '',
  reward_amount: 200,
  starts_at: '',
  ends_at: '',
  is_active: false,
  referral_enabled: false,
  referral_reward_amount: 200,
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiPath('/api/admin/campaigns'));
    const json = await res.json();
    setCampaigns(json.campaigns ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (campaign: Campaign) => {
    await fetch(apiPath(`/api/admin/campaigns/${campaign.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !campaign.is_active }),
    });
    load();
  };

  const updateReferral = async (campaign: Campaign) => {
    const amountInput = prompt(
      '紹介者への謝礼（円・紹介1人につき）。紹介された人は通常の謝礼金額のみです',
      String(campaign.referral_reward_amount ?? campaign.reward_amount)
    );
    if (amountInput === null) return;
    const amount = Number(amountInput);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert('金額は1以上の整数で入力してください');
      return;
    }
    await fetch(apiPath(`/api/admin/campaigns/${campaign.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_reward_amount: amount }),
    });
    load();
  };

  const toggleReferral = async (campaign: Campaign) => {
    await fetch(apiPath(`/api/admin/campaigns/${campaign.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_enabled: !campaign.referral_enabled }),
    });
    load();
  };

  const save = async () => {
    setSaving(true);
    await fetch(apiPath('/api/admin/campaigns'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        reward_amount: Number(form.reward_amount),
        referral_reward_amount: Number(form.referral_reward_amount),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('このキャンペーンを削除しますか？')) return;
    await fetch(apiPath(`/api/admin/campaigns/${id}`), { method: 'DELETE' });
    load();
  };

  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">キャンペーン管理</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + 新規作成
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">新規キャンペーン作成</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例: 春の口コミキャンペーン"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">説明（任意）</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="例: 期間中に口コミを投稿・承認された方全員に進呈"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">謝礼金額（円）</label>
                <input
                  type="number"
                  className="w-32 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.reward_amount}
                  onChange={(e) => setForm({ ...form, reward_amount: Number(e.target.value) })}
                  min={100}
                  step={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開始日時</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">終了日時</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">作成後すぐに有効化する</label>
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="referral_enabled"
                    checked={form.referral_enabled}
                    onChange={(e) => setForm({ ...form, referral_enabled: e.target.checked })}
                  />
                  <label htmlFor="referral_enabled" className="text-sm text-gray-700">
                    紹介制度を有効にする（回答完了画面・承認メールに紹介URLと依頼文を表示）
                  </label>
                </div>
                {form.referral_enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        紹介者への謝礼（円・紹介1人につき）
                      </label>
                      <input
                        type="number"
                        className="w-32 border border-gray-300 rounded px-3 py-1.5 text-sm"
                        value={form.referral_reward_amount}
                        onChange={(e) => setForm({ ...form, referral_reward_amount: Number(e.target.value) })}
                        min={100}
                        step={100}
                      />
                    </div>
                    <p className="col-span-2 text-xs text-gray-500">
                      紹介者1人あたりの紹介人数に上限はありません。
                      紹介された人の謝礼は上の「謝礼金額」のみです（紹介経由でも上乗せはしません）。
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving || !form.title || !form.starts_at || !form.ends_at}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-12">読み込み中...</p>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">キャンペーンはまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const isRunning = c.is_active && new Date(c.starts_at) <= now && new Date(c.ends_at) >= now;
              const grantCount = c.campaign_grants?.[0]?.count ?? 0;
              return (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.title}</span>
                      {isRunning && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">実施中</span>
                      )}
                      {!c.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">無効</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      QUOカードPay {c.reward_amount.toLocaleString()}円 ／
                      {new Date(c.starts_at).toLocaleDateString('ja-JP')} 〜 {new Date(c.ends_at).toLocaleDateString('ja-JP')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">配布記録 {grantCount} 件</p>
                    <p className="text-xs mt-1">
                      {c.referral_enabled ? (
                        <span className="text-violet-700">
                          紹介制度: 有効 ／ 紹介者へ1人につき {(c.referral_reward_amount ?? c.reward_amount).toLocaleString()}円（上限なし）／ 紹介された人は通常謝礼 {c.reward_amount.toLocaleString()}円のみ
                        </span>
                      ) : (
                        <span className="text-gray-400">紹介制度: 無効</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleReferral(c)}
                      className={`px-3 py-1 text-xs rounded border ${c.referral_enabled ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-violet-300 text-violet-600 hover:bg-violet-50'}`}
                    >
                      {c.referral_enabled ? '紹介を無効化' : '紹介を有効化'}
                    </button>
                    <button
                      onClick={() => updateReferral(c)}
                      className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      紹介設定
                    </button>
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-3 py-1 text-xs rounded border ${c.is_active ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                    >
                      {c.is_active ? '無効化' : '有効化'}
                    </button>
                    <button
                      onClick={() => deleteCampaign(c.id)}
                      className="px-3 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
