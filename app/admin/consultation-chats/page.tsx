'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';

type ConsultationChatLog = {
  id: string;
  created_at: string;
  session_id: string | null;
  source: string | null;
  page_url: string | null;
  user_question: string;
  assistant_reply: string | null;
  intent: string | null;
  focus_label: string | null;
  prefecture: string | null;
  model: string | null;
  rag_doc_count: number | null;
  status: string;
  is_reviewed: boolean;
  latency_ms: number | null;
};

const INTENT_LABELS: Record<string, string> = {
  school_recommendation: '学校推薦',
  procedure_explanation: '制度説明',
  style_comparison: '学び方比較',
  general_advice: '一般相談',
};

const STATUS_LABELS: Record<string, string> = {
  success: '成功',
  no_evidence: '根拠不足',
  error: 'エラー',
};

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default function ConsultationChatsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ConsultationChatLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'no_evidence' | 'error'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, reviewFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (reviewFilter === 'reviewed') params.append('is_reviewed', 'true');
      if (reviewFilter === 'unreviewed') params.append('is_reviewed', 'false');
      if (search.trim()) params.append('search', search.trim());

      const response = await fetch(apiPath(`/api/admin/consultation-chats?${params.toString()}`));
      if (!response.ok) {
        throw new Error('相談AIログ一覧の取得に失敗しました');
      }
      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('相談AIログ一覧取得エラー:', error);
      alert('相談AIログ一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReviewed = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(apiPath(`/api/admin/consultation-chats/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_reviewed: !currentStatus }),
      });
      if (!response.ok) {
        throw new Error('確認状態の更新に失敗しました');
      }
      setLogs((prev) =>
        prev.map((log) => (log.id === id ? { ...log, is_reviewed: !currentStatus } : log))
      );
    } catch (error) {
      console.error('確認状態更新エラー:', error);
      alert('確認状態の更新に失敗しました');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            管理画面に戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">相談AIモニタリング</h1>
          <p className="mt-2 text-sm text-gray-600">
            ユーザー質問とAI回答を記録し、精度改善のための確認に使います（全 {total} 件）
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            {(['all', 'success', 'no_evidence', 'error'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {value === 'all' ? 'すべて' : STATUS_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['all', 'unreviewed', 'reviewed'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setReviewFilter(value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reviewFilter === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {value === 'all' ? '確認: すべて' : value === 'unreviewed' ? '未確認' : '確認済み'}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 ml-auto"
            onSubmit={(event) => {
              event.preventDefault();
              fetchLogs();
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="質問・回答を検索"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-56"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800"
            >
              検索
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">ログがありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">意図</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">質問</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">導線</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">確認</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className={!log.is_reviewed ? 'bg-amber-50/60' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : log.status === 'no_evidence'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {STATUS_LABELS[log.status] ?? log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {log.intent ? INTENT_LABELS[log.intent] ?? log.intent : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                        <Link
                          href={appPath(`/admin/consultation-chats/${log.id}`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {truncate(log.user_question)}
                        </Link>
                        {log.focus_label && (
                          <p className="text-xs text-gray-500 mt-1">主訴: {log.focus_label}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {log.source ?? '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.is_reviewed
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.is_reviewed ? '確認済み' : '未確認'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleReviewed(log.id, log.is_reviewed)}
                          className="px-3 py-1 rounded text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50"
                        >
                          {log.is_reviewed ? '未確認に戻す' : '確認済みにする'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
