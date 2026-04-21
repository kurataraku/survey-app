'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';

interface ModerationResult {
  danger_score: number;
  flags: {
    personal_info: boolean;
    fake_review: boolean;
    advertisement: boolean;
    hate_speech: boolean;
    fake_school: boolean;
    duplicate_email: boolean;
  };
  reason: string;
  similar_response_ids: string[];
}

interface PendingReview {
  id: string;
  school_name: string;
  respondent_role: string;
  status: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  email: string;
  is_duplicate_email: boolean;
  moderation_status: string;
  created_at: string;
  review_moderation_results: ModerationResult[];
}

const FLAG_LABELS: Record<string, string> = {
  personal_info: '個人特定',
  fake_review: '虚偽',
  advertisement: '広告',
  hate_speech: 'ヘイト',
  fake_school: '架空の学校',
  duplicate_email: 'メール重複',
};

function DangerBadge({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">審査待ち</span>;
  }
  const color = score >= 61 ? 'bg-red-100 text-red-700' : score >= 31 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>危険度 {score}</span>;
}

function FlagBadges({ flags }: { flags: ModerationResult['flags'] | undefined }) {
  if (!flags) return null;
  const active = Object.entries(flags).filter(([, v]) => v);
  if (active.length === 0) return <span className="text-xs text-gray-400">問題なし</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([key]) => (
        <span key={key} className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">
          {FLAG_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiPath('/api/admin/reviews/pending'));
    const json = await res.json();
    setReviews(json.reviews ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setProcessing(id);
    await fetch(apiPath(`/api/admin/reviews/${id}/approve`), { method: 'POST' });
    setProcessing(null);
    load();
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setProcessing(id);
    await fetch(apiPath(`/api/admin/reviews/${id}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setProcessing(null);
    setRejectingId(null);
    setRejectReason('');
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">口コミ承認キュー</h1>
            <p className="text-sm text-gray-500 mt-1">承認待ち {total} 件（危険度の高い順）</p>
          </div>
          <button onClick={load} className="text-sm text-blue-600 hover:underline">更新</button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-12">読み込み中...</p>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">承認待ちの口コミはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const mod = review.review_moderation_results?.[0];
              return (
                <div key={review.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  {/* ヘッダー */}
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{review.school_name}</span>
                      <span className="text-xs text-gray-500">{review.respondent_role} / {review.status}</span>
                      <DangerBadge score={mod?.danger_score} />
                      {review.is_duplicate_email && (
                        <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded">メール重複</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleString('ja-JP')}</span>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* AI審査結果 */}
                    {mod && (
                      <div className="bg-gray-50 rounded p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">AI審査:</span>
                          <FlagBadges flags={mod.flags} />
                        </div>
                        <p className="text-xs text-gray-600">{mod.reason}</p>
                        {mod.similar_response_ids?.length > 0 && (
                          <p className="text-xs text-orange-600">類似投稿 {mod.similar_response_ids.length} 件検出</p>
                        )}
                      </div>
                    )}

                    {/* 投稿内容 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">良かった点</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{review.good_comment}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">改善してほしい点</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{review.bad_comment}</p>
                      </div>
                    </div>

                    {/* メタ情報 */}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>総合満足度: {review.overall_satisfaction}/5</span>
                      <span>メール: {review.email}</span>
                    </div>

                    {/* アクション */}
                    {rejectingId === review.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full text-sm border border-gray-300 rounded p-2 resize-none"
                          rows={3}
                          placeholder="却下理由を入力（投稿者へのメールに使用されます）"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => reject(review.id)}
                            disabled={!rejectReason.trim() || processing === review.id}
                            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {processing === review.id ? '処理中...' : '却下する'}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(review.id)}
                          disabled={processing === review.id}
                          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {processing === review.id ? '処理中...' : '承認'}
                        </button>
                        <button
                          onClick={() => setRejectingId(review.id)}
                          className="px-4 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                        >
                          却下
                        </button>
                      </div>
                    )}
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
