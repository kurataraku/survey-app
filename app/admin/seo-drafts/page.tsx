'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import Badge from '@/components/ui/Badge';
import type { SeoDraft, DraftStatus } from '@/lib/seo-generation/types';

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: string; variant: 'primary' | 'default' | 'warning' | 'success' | 'error' }
> = {
  generating: { label: '生成中', variant: 'primary' },
  draft: { label: '下書き', variant: 'default' },
  needs_review: { label: '要レビュー', variant: 'warning' },
  revised: { label: '修正済み', variant: 'primary' },
  approved: { label: '承認済み', variant: 'success' },
  failed: { label: '失敗', variant: 'error' },
};

const DRAFT_TYPE_LABELS: Record<string, string> = {
  knowledge: 'ナレッジ',
  school: '学校別',
};

function SeoDraftsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drafts, setDrafts] = useState<SeoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [draftTypeFilter, setDraftTypeFilter] = useState(
    searchParams.get('draft_type') || ''
  );

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (draftTypeFilter) params.set('draft_type', draftTypeFilter);

      const res = await fetch(apiPath(`/api/admin/seo-drafts?${params.toString()}`));
      if (!res.ok) throw new Error('取得失敗');
      const data = await res.json();
      setDrafts(data.drafts);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('下書き一覧の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, draftTypeFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('この下書きを削除しますか？')) return;

    try {
      const res = await fetch(apiPath(`/api/admin/seo-drafts/${id}`), {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchDrafts();
      }
    } catch (error) {
      console.error('削除失敗:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SEO記事下書き</h1>
            <p className="text-sm text-gray-500 mt-1">
              全{total}件
            </p>
          </div>
          <Link
            href={appPath('/admin/seo-drafts/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            新規作成
          </Link>
        </div>

        {/* フィルター */}
        <div className="mb-4 flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">すべてのステータス</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={draftTypeFilter}
            onChange={(e) => {
              setDraftTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">すべてのタイプ</option>
            <option value="knowledge">ナレッジ</option>
            <option value="school">学校別</option>
          </select>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">読み込み中...</div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              下書きがありません
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    キーワード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タイプ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    学校
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    更新日
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drafts.map((draft) => {
                  const statusConf = STATUS_CONFIG[draft.status] || STATUS_CONFIG.draft;
                  return (
                    <tr
                      key={draft.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        router.push(appPath(`/admin/seo-drafts/${draft.id}`))
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {draft.title || draft.keyword}
                        </div>
                        {draft.title && (
                          <div className="text-xs text-gray-500">{draft.keyword}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {DRAFT_TYPE_LABELS[draft.draft_type] || draft.draft_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {draft.school?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={statusConf.variant} size="sm">
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(draft.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {draft.status === 'failed' && (
                          <Link
                            href={appPath(`/admin/seo-drafts/new?retry=${draft.id}`)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 mr-3"
                          >
                            再生成
                          </Link>
                        )}
                        <button
                          onClick={(e) => handleDelete(draft.id, e)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SeoDraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center py-12 text-gray-500">
            読み込み中...
          </div>
        </div>
      }
    >
      <SeoDraftsContent />
    </Suspense>
  );
}
