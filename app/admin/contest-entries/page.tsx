'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPath, appPath } from '@/lib/base-path';

interface SurveyResponseSummary {
  id: string;
  school_name: string;
  email: string | null;
  respondent_role: string;
  status: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  moderation_status: string;
  rejection_reason?: string | null;
  created_at: string;
}

interface ContestEntry {
  id: string;
  survey_response_id: string;
  author_type: '在校生' | '卒業生';
  pen_name: string;
  title: string;
  effort_summary: string;
  before_enrollment: string;
  after_enrollment: string;
  learning_and_change: string;
  future_goal?: string | null;
  current_life?: string | null;
  wants_feedback: boolean;
  publication_consent: boolean;
  created_at: string;
  survey_responses?: SurveyResponseSummary | SurveyResponseSummary[] | null;
}

type AuthorFilter = 'all' | '在校生' | '卒業生';
type ModerationFilter = 'all' | 'pending' | 'approved' | 'rejected';

const MODERATION_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: '口コミ承認待ち', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: '口コミ承認済', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: '口コミ却下', className: 'bg-red-50 text-red-700 border-red-200' },
};

function surveyFor(entry: ContestEntry): SurveyResponseSummary | null {
  if (!entry.survey_responses) return null;
  return Array.isArray(entry.survey_responses)
    ? entry.survey_responses[0] ?? null
    : entry.survey_responses;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StoryField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-sky-700">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{value}</p>
    </div>
  );
}

export default function ContestEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<AuthorFilter>('all');
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (authorFilter !== 'all') params.set('author_type', authorFilter);
      if (moderationFilter !== 'all') params.set('moderation_status', moderationFilter);

      const res = await fetch(apiPath(`/api/admin/contest-entries?${params.toString()}`));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'コンテスト応募の取得に失敗しました');
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setLimit(data.limit ?? 20);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'コンテスト応募の取得に失敗しました');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, authorFilter, moderationFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push(appPath('/admin'))}
            className="mb-4 flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            管理画面に戻る
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">コンテスト投稿</h1>
              <p className="mt-1 text-sm text-gray-600">
                MY STORY AWARD の体験談応募を確認できます。口コミの承認・却下は
                <Link href={appPath('/admin/reviews')} className="mx-1 text-blue-600 hover:underline">
                  口コミ管理
                </Link>
                から行います。
              </p>
            </div>
            <button
              onClick={loadEntries}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              再読み込み
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {([
            ['all', 'すべて'],
            ['在校生', '在校生'],
            ['卒業生', '卒業生'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setPage(1);
                setAuthorFilter(value);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                authorFilter === value
                  ? 'bg-sky-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 hidden h-8 w-px bg-gray-200 sm:inline-block" />
          {([
            ['all', '口コミ状態すべて'],
            ['pending', '承認待ち'],
            ['approved', '承認済'],
            ['rejected', '却下'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setPage(1);
                setModerationFilter(value);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                moderationFilter === value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-gray-500">全 {total} 件（投稿日時の新しい順）</p>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
            読み込み中...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
            該当するコンテスト応募はありません
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const survey = surveyFor(entry);
              const mod = survey
                ? MODERATION_LABELS[survey.moderation_status] ?? {
                    label: survey.moderation_status,
                    className: 'bg-gray-50 text-gray-700 border-gray-200',
                  }
                : null;
              const open = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">{entry.title}</h2>
                        <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">
                          {entry.author_type}
                        </span>
                        {mod && (
                          <span className={`rounded border px-1.5 py-0.5 text-xs ${mod.className}`}>
                            {mod.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {entry.pen_name}
                        {survey ? ` / ${survey.school_name}` : ''}
                        {survey?.email ? ` / ${survey.email}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{formatDate(entry.created_at)}</span>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <StoryField label="頑張ったこと" value={entry.effort_summary} />
                      <StoryField
                        label={entry.author_type === '在校生' ? 'これから挑戦したいこと' : '卒業後の現在の生活'}
                        value={entry.author_type === '在校生' ? entry.future_goal : entry.current_life}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : entry.id)}
                      className="text-sm font-medium text-sky-700 hover:text-sky-800"
                    >
                      {open ? '詳細を閉じる ▲' : '体験談の全文・口コミ要約を表示 ▼'}
                    </button>

                    {open && (
                      <div className="space-y-4 rounded-lg border border-sky-100 bg-sky-50/60 p-4">
                        <StoryField label="入学前" value={entry.before_enrollment} />
                        <StoryField label="入学後" value={entry.after_enrollment} />
                        <StoryField label="学び・変化" value={entry.learning_and_change} />
                        <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                          <p>フィードバック希望: {entry.wants_feedback ? '希望する' : '希望しない'}</p>
                          <p>作品利用同意: {entry.publication_consent ? '同意済み' : '未同意'}</p>
                        </div>

                        {survey && (
                          <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800">紐づく口コミ</p>
                              <Link
                                href={appPath('/admin/reviews')}
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                口コミ管理で確認・承認
                              </Link>
                            </div>
                            <div className="mb-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                              <p>投稿者: {survey.respondent_role} / {survey.status}</p>
                              <p>総合満足度: {survey.overall_satisfaction}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-xs font-medium text-gray-500">良かった点</p>
                                <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                                  {survey.good_comment || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-medium text-gray-500">改善してほしい点</p>
                                <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                                  {survey.bad_comment || '—'}
                                </p>
                              </div>
                            </div>
                            {survey.rejection_reason && (
                              <p className="mt-3 text-xs text-red-600">
                                却下理由: {survey.rejection_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
