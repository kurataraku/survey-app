'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';
import { isSameGiftUrl } from '@/lib/campaign/giftUrl';
import {
  COMMENT_HEADINGS,
  EMPTY_SUPPORT,
  EMPTY_UNKNOWN,
  EMPTY_WEAK,
  latestByCreatedAt,
  moderationSections,
  readFindings,
  summaryLines,
} from '@/lib/moderation/comment';
import type { ModerationFinding } from '@/lib/moderation/types';

interface ModerationFlags {
  personal_info?: boolean;
  fake_review?: boolean;
  advertisement?: boolean;
  hate_speech?: boolean;
  fake_school?: boolean;
  duplicate_email?: boolean;
  fact_conflict?: boolean;
  internal_conflict?: boolean;
  filler_padding?: boolean;
  findings?: ModerationFinding[];
}

interface ModerationResult {
  danger_score: number;
  flags: ModerationFlags;
  reason: string;
  similar_response_ids: string[];
  created_at?: string;
}

interface Answers {
  reason_for_choosing?: string[];
  important_points?: string[];
  enrollment_type?: string;
  enrollment_year?: string;
  attendance_frequency?: string;
  campus_prefecture?: string;
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
  rejection_reason?: string | null;
  created_at: string;
  referral_code_id?: string | null;
  referral_codes?: { code: string; referrer_email: string } | null;
  review_moderation_results: ModerationResult[];
}

type GrantType = 'review' | 'referee' | 'referrer';

interface PendingGrant {
  id: string;
  campaign_id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  gift_code: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  grant_type: GrantType | null;
  reward_amount: number | null;
  flag_reason: string | null;
  survey_responses: { id: string; school_name: string; email: string | null } | null;
  campaigns: { title: string; reward_amount: number } | null;
  referral_codes: { code: string; referrer_email: string } | null;
}

const GRANT_TYPE_LABELS: Record<GrantType, { label: string; className: string }> = {
  review: { label: '通常', className: 'bg-gray-100 text-gray-700' },
  referee: { label: '紹介経由の回答者', className: 'bg-sky-100 text-sky-700' },
  referrer: { label: '紹介者', className: 'bg-violet-100 text-violet-700' },
};

const FLAG_LABELS: Record<string, string> = {
  personal_info: '個人特定',
  fake_review: '虚偽',
  advertisement: '広告',
  hate_speech: 'ヘイト',
  fake_school: '架空の学校',
  duplicate_email: 'メール重複',
  fact_conflict: '公開情報と矛盾',
  internal_conflict: '回答の食い違い',
  filler_padding: '文章の埋め込み',
};

const FLAG_ORDER = [
  'personal_info',
  'hate_speech',
  'advertisement',
  'fake_school',
  'duplicate_email',
  'fact_conflict',
  'internal_conflict',
  'filler_padding',
  'fake_review',
] as const;

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

type RatingKey = keyof Pick<Answers,
  | 'flexibility_rating'
  | 'staff_rating'
  | 'support_rating'
  | 'atmosphere_fit_rating'
  | 'credit_rating'
  | 'unique_course_rating'
  | 'career_support_rating'
  | 'campus_life_rating'
  | 'tuition_rating'
>;

const DEFAULT_REJECT_REASON = '投稿いただいた内容に不備または不審な点が確認されました。';

function DangerBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">審査待ち</span>;
  const color = score >= 61 ? 'bg-red-100 text-red-700' : score >= 31 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>危険度 {score}</span>;
}

function FlagBadges({ flags }: { flags: ModerationResult['flags'] | undefined }) {
  if (!flags) return null;
  const active = FLAG_ORDER.filter((key) => flags[key] === true)
    .filter((key) => !(key === 'fake_review' && flags.fact_conflict === true));
  if (active.length === 0) {
    if (Array.isArray(flags.findings) && flags.findings.length > 0) return null;
    return <span className="text-xs text-gray-400">問題なし</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((key) => (
        <span key={key} className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">
          {FLAG_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

function ModerationReport({
  mod,
  onRerun,
  rerunning,
}: {
  mod: ModerationResult;
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  const findings = readFindings(mod.flags);
  return (
    <div className="bg-gray-50 rounded p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-600">AI審査:</span>
        <FlagBadges flags={mod.flags} />
        {onRerun && (
          <button
            onClick={onRerun}
            disabled={rerunning}
            className="text-xs text-purple-700 underline disabled:opacity-50"
          >
            {rerunning ? '審査中...' : '再審査'}
          </button>
        )}
      </div>
      {findings.length === 0 ? (
        mod.reason ? <p className="text-xs text-gray-600 whitespace-pre-wrap">{mod.reason}</p> : null
      ) : (
        <ModerationFindings reason={mod.reason} findings={findings} />
      )}
      {mod.similar_response_ids?.length > 0 && (
        <p className="text-xs text-orange-600">類似投稿 {mod.similar_response_ids.length} 件検出</p>
      )}
    </div>
  );
}

function ModerationFindings({ reason, findings }: { reason: string; findings: ModerationFinding[] }) {
  const sections = moderationSections(findings);
  return (
    <div className="space-y-3">
      {summaryLines(reason).map((line, index) => (
        <p key={`${index}-${line}`} className="text-xs text-gray-800">{line}</p>
      ))}
      <FindingList title={COMMENT_HEADINGS.support} items={sections.support} empty={EMPTY_SUPPORT} className="text-green-900" />
      <FindingList title={COMMENT_HEADINGS.weak} items={sections.weak} empty={EMPTY_WEAK} className="text-amber-950" />
      <FindingList title={COMMENT_HEADINGS.unknown} items={sections.unknown} empty={EMPTY_UNKNOWN} className="text-gray-600" />
    </div>
  );
}

function FindingList({
  title,
  items,
  empty,
  className,
}: {
  title: string;
  items: string[];
  empty: string;
  className: string;
}) {
  const lines = items.length > 0 ? items : [empty];
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">{title}</p>
      <ul className={`space-y-1 text-xs leading-relaxed ${className}`}>
        {lines.map((line, index) => (
          <li key={`${title}-${index}`}>{line}</li>
        ))}
      </ul>
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
              {a.campus_prefecture && <div className="flex gap-2"><span className="text-gray-500 shrink-0">都道府県</span><span className="text-gray-800">{a.campus_prefecture}</span></div>}
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
                  <RatingDisplay value={a[key as RatingKey]} />
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
  const [tab, setTab] = useState<'pending' | 'rejected' | 'quocard'>('pending');

  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [rejectedReviews, setRejectedReviews] = useState<PendingReview[]>([]);
  const [rejectedTotal, setRejectedTotal] = useState(0);
  const [loadingRejectedReviews, setLoadingRejectedReviews] = useState(false);
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
  const [grantGiftUrls, setGrantGiftUrls] = useState<Record<string, string>>({});
  const [grantTypeFilter, setGrantTypeFilter] = useState<'all' | GrantType>('all');

  const loadReviews = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingReviews(true);
    const res = await fetch(apiPath('/api/admin/reviews/pending'));
    const json = await res.json();
    setReviews(json.reviews ?? []);
    setTotal(json.total ?? 0);
    setLoadingReviews(false);
  }, []);

  const loadRejectedReviews = useCallback(async () => {
    setLoadingRejectedReviews(true);
    const res = await fetch(apiPath('/api/admin/reviews/rejected'));
    const json = await res.json();
    setRejectedReviews(json.reviews ?? []);
    setRejectedTotal(json.total ?? 0);
    setLoadingRejectedReviews(false);
  }, []);

  const loadGrants = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingGrants(true);
    const res = await fetch(apiPath('/api/admin/reviews/pending-grants'));
    const json = await res.json();
    setGrants(json.grants ?? []);
    setLoadingGrants(false);
  }, []);

  // Initial/tab-triggered admin data fetches intentionally hydrate client state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReviews(false); }, [loadReviews]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === 'quocard') loadGrants(false); }, [tab, loadGrants]);

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
    loadRejectedReviews();
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

  const updateGrant = async (grant: PendingGrant, body: Record<string, unknown>) => {
    setMarking(grant.id);
    const res = await fetch(apiPath(`/api/admin/campaigns/${grant.campaign_id}/grants/${grant.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? '更新に失敗しました');
    }
    await loadGrants(false);
    setMarking(null);
  };

  const markSent = (grant: PendingGrant) => {
    if (!confirm('メールは送信せず「送付済み」にします。QUOカードPayは別途お送り済みですか？')) return;
    updateGrant(grant, {});
  };

  const giftUrlFor = (grant: PendingGrant) => grantGiftUrls[grant.id] ?? grant.gift_code ?? '';

  const sendGrantEmail = (grant: PendingGrant) => {
    const url = giftUrlFor(grant).trim();
    if (!url) return;
    const duplicate = grants.find((g) => g.id !== grant.id && isSameGiftUrl(g.gift_code, url));
    if (duplicate) {
      alert(`NG: このURLは既に ${duplicate.email} の配布記録で使われています。\n新しいQUOカードPayのURLを発行して入力してください。`);
      return;
    }
    const warning = grant.flag_reason ? `\n\n要確認: ${grant.flag_reason}` : '';
    if (!confirm(`${grant.email} にQUOカードPayのURLをメール送信します。${warning}`)) return;
    updateGrant(grant, { action: 'send_email', gift_url: url });
  };

  const cancelGrant = (grant: PendingGrant) => {
    if (!confirm('この謝礼を対象外にしますか？（メールは送信されません）')) return;
    updateGrant(grant, { action: 'cancel' });
  };

  const isOpenGrant = (g: PendingGrant) => g.status === 'pending' || g.status === 'failed';
  const pendingGrantCount = grants.filter(isOpenGrant).length;
  const visibleGrants = grants.filter(
    (g) => grantTypeFilter === 'all' || (g.grant_type ?? 'review') === grantTypeFilter
  );

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
              onClick={() => { loadReviews(); if (tab === 'rejected') loadRejectedReviews(); if (tab === 'quocard') loadGrants(); }}
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
            onClick={() => { setTab('rejected'); loadRejectedReviews(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'rejected' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            却下済み
            {rejectedTotal > 0 && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{rejectedTotal}</span>
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
            <p className="text-sm text-gray-500 mb-4">承認待ち {total} 件（投稿日時の新しい順）</p>
            {loadingReviews ? (
              <p className="text-gray-500 text-center py-12">読み込み中...</p>
            ) : reviews.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">承認待ちの口コミはありません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const mod = latestByCreatedAt(review.review_moderation_results);
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
                          {review.referral_codes && (
                            <span
                              className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded"
                              title={`紹介者: ${review.referral_codes.referrer_email}`}
                            >
                              紹介経由（{review.referral_codes.code}）
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleString('ja-JP')}</span>
                      </div>

                      <div className="px-5 py-4 space-y-4">
                        {review.referral_codes && (
                          <p className="text-xs text-violet-700 bg-violet-50 rounded px-3 py-2">
                            紹介者: {review.referral_codes.referrer_email}
                            {' '}／ 紹介制度が有効なキャンペーン中に承認すると、この回答者の謝礼（通常額・1件のみ）と紹介者の紹介謝礼が「QUO配布管理」に作られます。
                          </p>
                        )}
                        {/* AI審査結果 */}
                        {mod ? (
                          <ModerationReport
                            mod={mod}
                            onRerun={() => runModerate(review.id)}
                            rerunning={moderating === review.id}
                          />
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
                              {review.referral_codes && (
                                <p className="text-xs text-violet-700 mb-1">
                                  ここに貼るのはこの回答者（紹介経由）の分です。紹介者の分は承認後に「QUO配布管理」から送信してください。
                                </p>
                              )}
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

        {/* 却下済みタブ */}
        {tab === 'rejected' && (
          <>
            <p className="text-sm text-gray-500 mb-4">却下済み {rejectedTotal} 件（投稿日時の新しい順）</p>
            {loadingRejectedReviews ? (
              <p className="text-gray-500 text-center py-12">読み込み中...</p>
            ) : rejectedReviews.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">却下済みの口コミはありません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rejectedReviews.map((review) => {
                  const mod = latestByCreatedAt(review.review_moderation_results);
                  return (
                    <div key={review.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{review.school_name}</span>
                          <span className="text-xs text-gray-500">{review.respondent_role} / {review.status}</span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">却下済み</span>
                          <DangerBadge score={mod?.danger_score} />
                          {review.is_duplicate_email && (
                            <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded">メール重複</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleString('ja-JP')}</span>
                      </div>

                      <div className="px-5 py-4 space-y-4">
                        <div className="bg-red-50 rounded p-3 border border-red-100">
                          <p className="text-xs font-medium text-red-700 mb-1">却下理由</p>
                          <p className="text-sm text-red-900 whitespace-pre-wrap break-words">
                            {review.rejection_reason || '却下理由は保存されていません'}
                          </p>
                        </div>

                        {mod && <ModerationReport mod={mod} />}

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

                        <AnswerDetail review={review} />

                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>総合満足度: {review.overall_satisfaction}/5</span>
                          <span>メール: {review.email}</span>
                        </div>
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
            <div className="mb-4 space-y-2">
              <p className="text-sm text-gray-500">
                QUOカードPayの配布記録です。未送付の行にギフトURLを貼り付けて「URLをメール送信」を押すと、種別に合ったお礼メールが届き、送付済みになります。
                別の方法で送った場合は「送付済みにする（メールなし）」を押してください。
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">種別:</span>
                {(['all', 'review', 'referee', 'referrer'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setGrantTypeFilter(t)}
                    className={`px-2 py-1 rounded border ${grantTypeFilter === t ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t === 'all' ? 'すべて' : GRANT_TYPE_LABELS[t].label}
                  </button>
                ))}
              </div>
            </div>
            {loadingGrants ? (
              <p className="text-gray-500 text-center py-12">読み込み中...</p>
            ) : visibleGrants.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">QUO配布対象者はいません</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">送付先・学校</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">金額・キャンペーン</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">承認日時</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">QUOカードPay URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleGrants.map((grant) => {
                      const type = grant.grant_type ?? 'review';
                      const typeLabel = GRANT_TYPE_LABELS[type];
                      const amount = grant.reward_amount ?? grant.campaigns?.reward_amount ?? null;
                      const isOpen = isOpenGrant(grant);
                      const isSending = grant.error_message === '__sending__';
                      return (
                        <tr key={grant.id} className={isOpen ? '' : 'bg-gray-50'}>
                          <td className="px-4 py-3 align-top">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${typeLabel.className}`}>
                              {typeLabel.label}
                            </span>
                            {grant.referral_codes && (
                              <p className="text-[11px] text-gray-400 mt-1 font-mono">{grant.referral_codes.code}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="text-gray-700 font-mono text-xs break-all">{grant.email}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {type === 'referrer' ? '紹介した回答: ' : ''}
                              {grant.survey_responses?.school_name ?? '—'}
                            </p>
                            {type === 'referrer' && grant.survey_responses?.email && (
                              <p className="text-[11px] text-gray-400 mt-0.5 break-all">
                                紹介された人: {grant.survey_responses.email}
                              </p>
                            )}
                            {type === 'referee' && grant.referral_codes && (
                              <p className="text-[11px] text-gray-400 mt-0.5 break-all">
                                紹介者: {grant.referral_codes.referrer_email}
                              </p>
                            )}
                            {grant.flag_reason && (
                              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 mt-1">
                                要確認: {grant.flag_reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs align-top">
                            <p className="text-gray-800 font-medium">{amount ? `${amount.toLocaleString()}円` : '—'}</p>
                            <p className="mt-0.5">{grant.campaigns?.title ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs align-top whitespace-nowrap">
                            {new Date(grant.created_at).toLocaleString('ja-JP')}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {grant.status === 'sent' ? (
                              <div>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">送付済み</span>
                                {grant.sent_at && (
                                  <p className="text-xs text-gray-400 mt-0.5">{new Date(grant.sent_at).toLocaleString('ja-JP')}</p>
                                )}
                              </div>
                            ) : grant.status === 'cancelled' ? (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">対象外</span>
                            ) : grant.status === 'failed' ? (
                              <div>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">送信失敗</span>
                                {grant.error_message && !isSending && (
                                  <p className="text-xs text-red-500 mt-0.5">{grant.error_message}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                                {isSending ? '送信処理中' : '未送付'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs align-top min-w-[16rem]">
                            {isOpen ? (
                              <div className="space-y-1.5">
                                <input
                                  type="url"
                                  placeholder="https://..."
                                  value={giftUrlFor(grant)}
                                  onChange={(e) => setGrantGiftUrls({ ...grantGiftUrls, [grant.id]: e.target.value })}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                />
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    onClick={() => sendGrantEmail(grant)}
                                    disabled={marking === grant.id || isSending || !giftUrlFor(grant).trim()}
                                    className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    {marking === grant.id ? '処理中...' : 'URLをメール送信'}
                                  </button>
                                  <button
                                    onClick={() => markSent(grant)}
                                    disabled={marking === grant.id}
                                    className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    送付済みにする（メールなし）
                                  </button>
                                  <button
                                    onClick={() => cancelGrant(grant)}
                                    disabled={marking === grant.id || grant.status !== 'pending'}
                                    className="px-2 py-1 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50 disabled:opacity-50"
                                  >
                                    対象外
                                  </button>
                                </div>
                              </div>
                            ) : grant.gift_code ? (
                              <a href={grant.gift_code} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {grant.gift_code}
                              </a>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
