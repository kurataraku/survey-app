'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';

type ConsultationChatLogDetail = {
  id: string;
  created_at: string;
  session_id: string | null;
  source: string | null;
  page_url: string | null;
  user_question: string;
  assistant_reply: string | null;
  conversation_preview: string | null;
  intent: string | null;
  focus_label: string | null;
  mentioned_schools: string[] | null;
  prefecture: string | null;
  reason_group: string | null;
  route_json: Record<string, unknown> | null;
  model: string | null;
  sources_json: unknown;
  school_candidates_json: unknown;
  rag_doc_count: number | null;
  status: string;
  error_message: string | null;
  latency_ms: number | null;
  is_reviewed: boolean;
  review_notes: string | null;
  ip: string | null;
  user_agent: string | null;
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

export default function ConsultationChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [log, setLog] = useState<ConsultationChatLogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (id) fetchLog();
  }, [id]);

  const fetchLog = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiPath(`/api/admin/consultation-chats/${id}`));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ログの取得に失敗しました');
      }
      setLog(data.log);
      setReviewNotes(data.log.review_notes ?? '');
    } catch (error) {
      console.error('相談AIログ取得エラー:', error);
      alert('ログの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReview = async (nextReviewed?: boolean) => {
    if (!log) return;
    setIsSaving(true);
    try {
      const response = await fetch(apiPath(`/api/admin/consultation-chats/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_reviewed: typeof nextReviewed === 'boolean' ? nextReviewed : log.is_reviewed,
          review_notes: reviewNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '更新に失敗しました');
      }
      setLog(data.log);
      setReviewNotes(data.log.review_notes ?? '');
    } catch (error) {
      console.error('レビュー保存エラー:', error);
      alert('レビューの保存に失敗しました');
    } finally {
      setIsSaving(false);
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
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">ログが見つかりませんでした</p>
            <Link href={appPath('/admin/consultation-chats')} className="mt-4 inline-block text-blue-600">
              一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push(appPath('/admin/consultation-chats'))}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            一覧に戻る
          </button>
          <div className="flex justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">相談AIログ詳細</h1>
            <button
              onClick={() => saveReview(!log.is_reviewed)}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                log.is_reviewed
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {isSaving ? '保存中...' : log.is_reviewed ? '未確認に戻す' : '確認済みにする'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : log.status === 'no_evidence'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {STATUS_LABELS[log.status] ?? log.status}
              </span>
              {log.intent && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                  {INTENT_LABELS[log.intent] ?? log.intent}
                </span>
              )}
              <span className="text-sm text-gray-500">ID: {log.id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">日時</p>
                <p className="text-gray-900">{formatDate(log.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">セッション</p>
                <p className="text-gray-900 font-mono text-xs break-all">{log.session_id ?? '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">導線</p>
                <p className="text-gray-900">{log.source ?? '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">モデル / 応答時間</p>
                <p className="text-gray-900">
                  {log.model ?? '-'}
                  {log.latency_ms != null ? ` / ${log.latency_ms}ms` : ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500">主訴 / 都道府県</p>
                <p className="text-gray-900">
                  {log.focus_label ?? '-'} / {log.prefecture ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">RAG根拠件数</p>
                <p className="text-gray-900">{log.rag_doc_count ?? 0} 件</p>
              </div>
              {log.page_url && (
                <div className="md:col-span-2">
                  <p className="text-gray-500">ページURL</p>
                  <a
                    href={log.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {log.page_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">ユーザー質問</h2>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{log.user_question}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">AI回答</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                {log.assistant_reply ?? '（回答なし）'}
              </p>
            </div>
            {log.error_message && (
              <p className="mt-3 text-sm text-red-700">エラー: {log.error_message}</p>
            )}
          </div>

          {log.conversation_preview && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">会話プレビュー</h2>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 overflow-x-auto">
                {log.conversation_preview}
              </pre>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">レビューメモ</h2>
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              rows={4}
              placeholder="精度改善のためのメモ（例: 候補校が不適切、根拠不足、表現改善が必要 など）"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm"
            />
            <button
              onClick={() => saveReview()}
              disabled={isSaving}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : 'メモを保存'}
            </button>
          </div>

          <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <summary className="cursor-pointer text-lg font-semibold text-gray-900">
              技術メタデータ（ルーター・根拠・候補校）
            </summary>
            <div className="mt-4 space-y-4 text-sm">
              {log.mentioned_schools && log.mentioned_schools.length > 0 && (
                <div>
                  <p className="text-gray-500 mb-1">言及学校</p>
                  <p className="text-gray-900">{log.mentioned_schools.join(' / ')}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500 mb-1">ルーター結果</p>
                <pre className="bg-gray-50 rounded-lg p-3 overflow-x-auto text-xs">
                  {JSON.stringify(log.route_json, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-gray-500 mb-1">引用ソース</p>
                <pre className="bg-gray-50 rounded-lg p-3 overflow-x-auto text-xs">
                  {JSON.stringify(log.sources_json, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-gray-500 mb-1">学校候補</p>
                <pre className="bg-gray-50 rounded-lg p-3 overflow-x-auto text-xs">
                  {JSON.stringify(log.school_candidates_json, null, 2)}
                </pre>
              </div>
              {(log.ip || log.user_agent) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {log.ip && (
                    <div>
                      <p className="text-gray-500">IP</p>
                      <p className="font-mono text-xs">{log.ip}</p>
                    </div>
                  )}
                  {log.user_agent && (
                    <div>
                      <p className="text-gray-500">User-Agent</p>
                      <p className="font-mono text-xs break-all">{log.user_agent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
