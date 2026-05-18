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

interface Answers {
  reason_for_choosing?: string[];
  important_points?: string[];
  enrollment_type?: string;
  enrollment_year?: string;
  attendance_frequency?: string;
  teaching_style?: string[];
  student_atmosphere?: string[];
  atmosphere_other?: string;
  flexibility_rating?: string;
  staff_rating?: string;
  support_rating?: string;
  atmosphere_fit_rating?: string;
  credit_rating?: string;
  unique_course_rating?: string;
  career_support_rating?: string;
  campus_life_rating?: string;
  tuition_rating?: string;
}

interface PendingReview {
  id: string;
  school_name: string;
  respondent_role: string;
  status: string;
  graduation_path?: string;
  graduation_path_other?: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  answers: Answers;
  email: string;
  is_duplicate_email: boolean;
  moderation_status: string;
  created_at: string;
  review_moderation_results: ModerationResult[];
}

interface PendingGrant {
  id: string;
  campaign_id: string;
  email: string;
  status: 'pending' | 'sent';
  created_at: string;
  sent_at: string | null;
  survey_responses: { id: string; school_name: string } | null;
  campaigns: { title: string; reward_amount: number } | null;
}

const FLAG_LABELS: Record<string, string> = {
  personal_info: '個人特定',
  fake_review: '虚偽',
  advertisement: '広告',
  hate_speech: 'ヘイト',
  fake_school: '架空の学校',
  duplicate_email: 'メール重複',
};

const RATING_LABELS: Record<string, string> = {
  flexibility_rating: '柔軟性',
  staff_rating: '教職員',
  support_rating: 'サポート',
  atmosphere_fit_rating: '雰囲気',
  credit_rating: '単位取得',
  unique_course_rating: '独自コース',
  career_support_rating: '進路サポート',
  campus_life_rating: '学校生活',
  tuition_rating: '学費',
};

const DEFAULT_REJECT_REASON = '投稿いただいた内容に不備または不審な点が確認されました。';

function DangerBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">審査待ち</span>;
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

function RatingDisplay({ value }: { value?: string }) {
  if (!value) return <span className="text-gray-300">—</span>;
  if (value === '6') return <span className="text-xs text-gray-400">評価不可</span>;
  const n = parseInt(value);
  return (
    <span className="font-medium text-gray-800">
      {n}<span className="text-gray-400 text-xs">/5</span>
    </span>
  );
}

function Tags({ values }: { values?: string[] }) {
  if (!values?.length) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v, i) => (
        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{v}</span>
      ))}
    </div>
  );
}

function AnswerDetail({ review }: { review: PendingReview }) {
  const [open, setOpen] = useState(false);
  const a = review.answers ?? {};

  return (
    <div className="border border-gray-200 rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span>回答全項目を確認する</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100">
          {/* 基本情報 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">基本情報</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <div className="flex gap-2"><span className="text-gray-500 shrink-0">投稿者</span><span className="text-gray-800">{review.respondent_role}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 shrink-0">在籍状況</span><span className="text-gray-800">{review.status}</span></div>
              {a.enrollment_year && <div className="flex gap-2"><span className="text-gray-500 shrink-0">入学年</span><span className="text-gray-800">{a.enrollment_year}年</span></div>}
              {a.enrollment_type && <div className="flex gap-2"><span className="text-gray-500 shrink-0">入学タイプ</span><span className="text-gray-800">{a.enrollment_type}</span></div>}
              {a.attendance_frequency && <div className="flex gap-2"><span className="text-gray-500 shrink-0">通学頻度</span><span className="text-gray-800">{a.attendance_frequency}</span></div>}
              {review.graduation_path && <div className="flex gap-2"><span className="text-gray-500 shrink-0">卒業後の進路</span><span className="text-gray-800">{review.graduation_path}{review.graduation_path_other ? `（${review.graduation_path_other}）` : ''}</span></div>}
            </div>
          </div>

          {/* 選択回答 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">選択回答</p>
            <div className="space-y-2 text-xs">
              {a.reason_for_choosing?.length ? <div><span className="text-gray-500 block mb-1">入学を選んだ理由</span><Tags values={a.reason_for_choosing} /></div> : null}
              {a.important_points?.length ? <div><span className="text-gray-500 block mb-1">重視した点</span><Tags values={a.important_points} /></div> : null}
              {a.teaching_style?.length ? <div><span className="text-gray-500 block mb-1">授業スタイル</span><Tags values={a.teaching_style} /></div> : null}
              {a.student_atmosphere?.length ? <div><span className="text-gray-500 block mb-1">生徒の雰囲気</span><Tags values={a.student_atmosphere} /></div> : null}
              {a.atmosphere_other ? <div><span className="text-gray-500 block mb-1">雰囲気（その他）</span><span className="text-gray-800">{a.atmosphere_other}</span></div> : null}
            </div>
          </div>

          {/* 評価点 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">項目別評価</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {Object.entries(RATING_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">{label}</span>
                  <RatingDisplay value={(a as any)[key]} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewModerationPage() {
  const [tab, setTab] = useState<'pending' | 'quocard'>('pending');

  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [giftUrl, setGiftUrl] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(DEFAULT_REJECT_REASON);
  const [processing, setProcessing] = useState<string | null>(null);
  const [moderating, setModerating] = useState<string | null>(null);
  const [batchModerating, setBatchModerating] = useState(false);

  const [grants, setGrants] = useState<PendingGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoadingReviews(true);
    const res = await fetch(apiPath('/api/admin/reviews/pending'));
    const json = await res.json();
    setReviews(json.reviews ?? []);
    setTotal(json.total ?? 0);
    setLoadingReviews(false);
  }, []);

  const loadGrants = useCallback(async () => {
    setLoadingGrants(true);
    const res = await fetch(apiPath('/api/admin/reviews/pending-grants'));
    const json = await res.json();
    setGrants(json.grants ?? []);
    setLoadingGrants(false);
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);
  useEffect(() => { if (tab === 'quocard') loadGrants(); }, [tab, loadGrants]);

  const approve = async (id: string, url: string) => {
    setProcessing(id);
    await fetch(apiPath(`/api/admin/reviews/${id}/approve`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gift_url: url.trim() || undefined }),
    });
    setProcessing(null);
    setApprovingId(null);
    setGiftUrl('');
    loadReviews();
    loadGrants();
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
    setRejectReason(DEFAULT_REJECT_REASON);
    loadReviews();
  };

  const runModerate = async (id: string) => {
    setModerating(id);
    await fetch(apiPath(`/api/admin/reviews/${id}/remoderate`), { method: 'POST' });
    setModerating(null);
    loadReviews();
  };

  const runBatchModerate = async () => {
    const unmoderated = reviews.filter(r => !r.review_moderation_results?.length);
    if (unmoderated.length === 0) return;
    setBatchModerating(true);
    for (const r of unmoderated) {
      await fetch(apiPath(`/api/admin/reviews/${r.id}/remoderate`), { method: 'POST' });
    }
    setBatchModerating(false);
    loadReviews();
  };

  const markSent = async (grant: PendingGrant) => {
    setMarking(grant.id);
    await fetch(apiPath(`/api/admin/campaigns/${grant.campaign_id}/grants/${grant.id}`), {
      method: 'PATCH',
    });
    await loadGrants();
    setMarking(null);
  };

  const pendingGrantCount = grants.filter(g => g.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">口コミ管理</h1>
          <div className="flex items-center gap-3">
            {tab === 'pending' && (
              <button
                onClick={runBatchModerate}
                disabled={batchModerating}
                className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {batchModerating ? 'AI審査中...' : '未審査を一括AI審査'}
              </button>
            )}
            <button
              onClick={() => { loadReviews(); if (tab === 'quocard') loadGrants(); }}
              className="text-sm text-blue-600 hover:underline"
            >
              更新
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            承認待ち
            {total > 0 && (
              <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{total}</span>
            )}
          </button>
          <button
            onClick={() => setTab('quocard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'quocard' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            QUO配布管理
            {pendingGrantCount > 0 && (
              <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{pendingGrantCount}</span>
            )}
          </button>
        </div>

        {/* 承認待ちタブ */}
        {tab === 'pending' && (
          <>
            <p className="text-sm text-gray-500 mb-4">承認待ち {total} 件（危険度の高い順）</p>
            {loadingReviews ? (
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
                        {mod ? (
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
                        ) : (
                          <div className="bg-gray-50 rounded p-3 flex items-center justify-between">
                            <span className="text-xs text-gray-400">AI審査未実施</span>
                            <button
                              onClick={() => runModerate(review.id)}
                              disabled={moderating === review.id}
                              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                            >
                              {moderating === review.id ? '審査中...' : 'AI審査を実行'}
                            </button>
                          </div>
                        )}

                        {/* 良かった点・改善点 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 mb-1">良かった点</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{review.good_comment}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 mb-1">改善してほしい点</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{review.bad_comment}</p>
                          </div>
                        </div>

                        {/* 回答全項目（折りたたみ） */}
                        <AnswerDetail review={review} />

                        {/* メタ情報 */}
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>総合満足度: {review.overall_satisfaction}/5</span>
                          <span>メール: {review.email}</span>
                        </div>

                        {/* アクション */}
                        {approvingId === review.id ? (
                          <div className="space-y-3 bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-sm font-medium text-blue-900">承認メールの送信確認</p>
                            <div className="text-xs text-blue-700 space-y-0.5">
                              <p>宛先: {review.email}</p>
                              <p>学校: {review.school_name}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-blue-800 mb-1">
                                QUOカードPay URL
                                <span className="ml-1 font-normal text-blue-500">（キャンペーン期間中は貼り付けてください）</span>
                              </label>
                              <input
                                type="url"
                                className="w-full text-sm border border-blue-200 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="https://..."
                                value={giftUrl}
                                onChange={(e) => setGiftUrl(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => approve(review.id, giftUrl)}
                                disabled={processing === review.id}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {processing === review.id ? '処理中...' : '承認してメール送信'}
                              </button>
                              <button
                                onClick={() => { setApprovingId(null); setGiftUrl(''); }}
                                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : rejectingId === review.id ? (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">却下理由（投稿者へのメールに使用されます）</p>
                            <textarea
                              className="w-full text-sm border border-gray-300 rounded p-2 resize-none"
                              rows={3}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => reject(review.id)}
                                disabled={!rejectReason.trim() || processing === review.id}
                                className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {processing === review.id ? '処理中...' : '却下してメール送信'}
                              </button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason(DEFAULT_REJECT_REASON); }}
                                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setApprovingId(review.id); setGiftUrl(''); setRejectingId(null); }}
                              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              承認
                            </button>
                            <button
                              onClick={() => { setRejectingId(review.id); setRejectReason(DEFAULT_REJECT_REASON); setApprovingId(null); }}
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
          </>
        )}

        {/* QUO配布管理タブ */}
        {tab === 'quocard' && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              QUOカードPayの配布記録です。未送付の方に送付後「送付済みにする」を押してください。
            </p>
            {loadingGrants ? (
              <p className="text-gray-500 text-center py-12">読み込み中...</p>
            ) : grants.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">QUO配布対象者はいません</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">学校名</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">メールアドレス</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">キャンペーン</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">承認日時</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grants.map((grant) => (
                      <tr key={grant.id} className={grant.status === 'sent' ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-3 text-gray-900">{grant.survey_responses?.school_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{grant.email}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {grant.campaigns
                            ? `${grant.campaigns.title}（${grant.campaigns.reward_amount.toLocaleString()}円）`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(grant.created_at).toLocaleString('ja-JP')}
                        </td>
                        <td className="px-4 py-3">
                          {grant.status === 'sent' ? (
                            <div>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">送付済み</span>
                              {grant.sent_at && (
                                <p className="text-xs text-gray-400 mt-0.5">{new Date(grant.sent_at).toLocaleString('ja-JP')}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">未送付</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {grant.status === 'pending' && (
                            <button
                              onClick={() => markSent(grant)}
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
