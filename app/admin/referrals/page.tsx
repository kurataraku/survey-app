'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';

interface ReferralRow {
  id: string;
  code: string;
  referrer_email: string;
  is_active: boolean;
  created_at: string;
  referred_total: number;
  referred_approved: number;
  referred_pending: number;
  referred_rejected: number;
  referrer_grants_open: number;
  referrer_grants_sent: number;
  referrer_grants_flagged: number;
}

export default function ReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const res = await fetch(apiPath(`/api/admin/referrals${q ? `?q=${encodeURIComponent(q)}` : ''}`));
    const json = await res.json();
    setRows(json.referrals ?? []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row: ReferralRow) => {
    const message = row.is_active
      ? `紹介コード ${row.code} を無効化しますか？\n以後このURL経由の回答は紹介として扱われません（作成済みの謝礼は変わりません）。`
      : `紹介コード ${row.code} を再度有効にしますか？`;
    if (!confirm(message)) return;
    setUpdating(row.id);
    await fetch(apiPath(`/api/admin/referrals/${row.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    setUpdating(null);
    load(query);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">紹介管理</h1>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); load(query); }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="紹介コード / メールで検索"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
            />
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              検索
            </button>
          </form>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          紹介経由の回答がある紹介者の一覧です。紹介者への謝礼の送付は「口コミ管理 → QUO配布管理」で行います。
          自作自演が疑われる場合はコードを無効化してください。
        </p>

        {loading ? (
          <p className="text-gray-500 text-center py-12">読み込み中...</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">該当する紹介はありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">紹介者</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">紹介経由の回答</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">紹介者への謝礼</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状態</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className={row.is_active ? '' : 'bg-gray-50'}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-mono text-xs text-gray-900">{row.code}</p>
                      <p className="text-xs text-gray-600 break-all">{row.referrer_email}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-700">
                      <p>合計 {row.referred_total} 件</p>
                      <p className="text-gray-500">
                        承認 {row.referred_approved} ／ 審査待ち {row.referred_pending} ／ 却下 {row.referred_rejected}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-700">
                      <p>送付済み {row.referrer_grants_sent} ／ 未送付 {row.referrer_grants_open}</p>
                      {row.referrer_grants_flagged > 0 && (
                        <p className="text-red-600 mt-0.5">要確認 {row.referrer_grants_flagged} 件</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.is_active ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">有効</span>
                      ) : (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">無効</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        onClick={() => toggleActive(row)}
                        disabled={updating === row.id}
                        className={`px-3 py-1 text-xs rounded border disabled:opacity-50 ${row.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                      >
                        {row.is_active ? '無効化' : '有効化'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
