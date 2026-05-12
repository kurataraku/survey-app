'use client';

import React from 'react';
import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';
import Badge from './ui/Badge';
import { appPath } from '@/lib/base-path';
import { MIN_REVIEW_COUNT_FOR_TUITION_COMMUTE_TREND } from '@/lib/schools/review-display-thresholds';
import { CheckCircle2, XCircle, Bus } from 'lucide-react';

function ratingVsGlobalLabel(
  value: number | null,
  globalAvg: number | null | undefined
): { text: string; className: string } | null {
  if (value === null || value === undefined) return null;
  if (globalAvg === null || globalAvg === undefined) return null;
  const diff = value - globalAvg;
  const text =
    diff > 0 ? `(+${diff.toFixed(1)})` : diff < 0 ? `(${diff.toFixed(1)})` : `(±0.0)`;
  const className =
    diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500';
  return { text, className };
}

interface SchoolSummaryProps {
  name: string;
  prefecture: string;
  prefectures?: string[];
  slug: string;
  overallAvg: number | null;
  reviewCount: number;
  staffRatingAvg: number | null;
  atmosphereFitRatingAvg: number | null;
  creditRatingAvg: number | null;
  latestReviews: Array<{
    good_comment: string;
    bad_comment: string;
  }>;
  /** AI要約のリード（保護者向け判断材料・FV用に短く渡す） */
  decisionLead?: string | null;
  fitsBullets?: string[];
  notFitsBullets?: string[];
  tuitionCommuteBullets?: string[];
  /** 統計から生成した学費・通学の一文 */
  tuitionAttendStatsHint?: string | null;
  /** サイト全体平均（詳細評価と同基準の差分表示用） */
  globalAverages?: {
    overall_satisfaction_avg?: number | null;
    staff_rating_avg?: number | null;
    atmosphere_fit_rating_avg?: number | null;
    credit_rating_avg?: number | null;
  };
}

export default function SchoolSummary({
  name,
  prefecture,
  prefectures,
  slug,
  overallAvg,
  reviewCount,
  staffRatingAvg,
  atmosphereFitRatingAvg,
  creditRatingAvg,
  latestReviews: _latestReviews,
  decisionLead = null,
  fitsBullets = [],
  notFitsBullets = [],
  tuitionCommuteBullets = [],
  tuitionAttendStatsHint = null,
  globalAverages,
}: SchoolSummaryProps) {
  void _latestReviews;

  const isValidPrefecture = (pref: string | null | undefined): boolean => {
    return pref !== null && pref !== undefined && pref.trim() !== '' && pref !== '不明';
  };

  const allPrefecturesSet = new Set<string>();
  if (isValidPrefecture(prefecture)) {
    allPrefecturesSet.add(prefecture);
  }
  if (prefectures && prefectures.length > 0) {
    prefectures.forEach((p) => {
      if (isValidPrefecture(p)) {
        allPrefecturesSet.add(p);
      }
    });
  }
  const displayPrefectures = Array.from(allPrefecturesSet);

  const showTuitionCommuteTrend =
    reviewCount >= MIN_REVIEW_COUNT_FOR_TUITION_COMMUTE_TREND &&
    (tuitionCommuteBullets.length > 0 || Boolean(tuitionAttendStatsHint));

  const hasDecisionBlock =
    fitsBullets.length > 0 || notFitsBullets.length > 0 || showTuitionCommuteTrend;

  const overallDiff = ratingVsGlobalLabel(overallAvg, globalAverages?.overall_satisfaction_avg);
  const staffDiff = ratingVsGlobalLabel(staffRatingAvg, globalAverages?.staff_rating_avg);
  const atmosphereDiff = ratingVsGlobalLabel(
    atmosphereFitRatingAvg,
    globalAverages?.atmosphere_fit_rating_avg
  );
  const creditDiff = ratingVsGlobalLabel(creditRatingAvg, globalAverages?.credit_rating_avg);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden relative mb-8">
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100" />

      <div className="p-6 md:p-8 pt-8">
        <div className="mb-5">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight tracking-tight">
          {reviewCount === 0 ? `${name}の学校情報・口コミ` : `${name}の口コミ・評判`}
        </h1>
        <div className="flex flex-wrap gap-2 mt-3">
          {displayPrefectures.map((pref, index) => (
            <Badge key={index} variant="primary" size="md">
              {pref}
            </Badge>
          ))}
        </div>
        {reviewCount === 0 && (
          <p className="text-sm text-gray-600 leading-relaxed max-w-2xl mt-3">
            口コミはまだありません。掲載の学校概要やページ内の説明・よくある質問を参考にし、学費・サポート・通学形態は必ず学校公式サイトで最新情報をご確認ください。
          </p>
        )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-gray-200">
          {overallAvg !== null ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <StarRatingDisplay value={overallAvg} size="lg" />
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-3xl md:text-4xl font-bold text-gray-900 tabular-nums">
                    {overallAvg.toFixed(1)}
                    <span className="text-lg md:text-xl font-normal text-gray-600 ml-1">/ 5.0</span>
                  </div>
                  {overallDiff ? (
                    <span className="inline-flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-normal text-gray-500">全体平均比</span>
                      <span
                        className={`text-base md:text-lg font-semibold tabular-nums ${overallDiff.className}`}
                        title="サイト全体の口コミ平均との差"
                      >
                        {overallDiff.text}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-base text-gray-600 sm:ml-auto">
                口コミ <span className="font-semibold text-gray-900">{reviewCount}</span> 件
              </div>
            </>
          ) : (
            <div className="text-gray-500 text-sm">
              総合評価はまだありません。口コミ <span className="font-semibold">{reviewCount}</span> 件
            </div>
          )}
        </div>

        {hasDecisionBlock ? (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">まず押さえる要点</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fitsBullets.length > 0 && (
                <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden />
                    <span className="font-semibold text-gray-900">この学校が合う人</span>
                  </div>
                  <ul className="text-sm text-gray-800 space-y-1.5 list-none pl-0">
                    {fitsBullets.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-600 flex-shrink-0">・</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {notFitsBullets.length > 0 && (
                <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" aria-hidden />
                    <span className="font-semibold text-gray-900">合わない人・注意したい人</span>
                  </div>
                  <ul className="text-sm text-gray-800 space-y-1.5 list-none pl-0">
                    {notFitsBullets.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-rose-600 flex-shrink-0">・</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {showTuitionCommuteTrend && (
                <div className="md:col-span-2 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bus className="w-5 h-5 text-amber-800 flex-shrink-0" aria-hidden />
                    <span className="font-semibold text-gray-900">学費・通学スタイルの注意点</span>
                  </div>
                  {tuitionCommuteBullets.length > 0 && (
                    <ul className="text-sm text-gray-800 space-y-1.5 list-none pl-0 mb-2">
                      {tuitionCommuteBullets.map((t, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-800 flex-shrink-0">・</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {tuitionAttendStatsHint ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{tuitionAttendStatsHint}</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {decisionLead ? (
          <p className="text-sm md:text-base text-gray-800 leading-relaxed mb-6 border-l-4 border-blue-400 pl-4 py-1">
            {decisionLead}
          </p>
        ) : null}

        <nav
          aria-label="このページのセクション"
          className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-8 pb-6 border-b border-gray-200"
        >
          <a href="#section-review-summary" className="text-blue-600 hover:underline font-medium">
            良い点・改善点の傾向
          </a>
          <a href="#section-featured" className="text-blue-600 hover:underline font-medium">
            注目の口コミ
          </a>
          <Link
            href={appPath(`/schools/${slug}/reviews`)}
            className="text-blue-600 hover:underline font-medium"
          >
            条件で口コミを探す
          </Link>
        </nav>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="text-center p-6 bg-blue-50/80 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs md:text-sm text-gray-600 mb-3">先生・職員の対応</p>
            {staffRatingAvg !== null ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <StarRatingDisplay value={staffRatingAvg} size="sm" />
                <span className="text-base md:text-lg font-semibold text-gray-900 tabular-nums">
                  {staffRatingAvg.toFixed(1)}
                </span>
                {staffDiff ? (
                  <span className="inline-flex items-baseline gap-1 flex-wrap justify-center">
                    <span className="text-[10px] sm:text-xs font-normal text-gray-500">全体平均比</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${staffDiff.className}`}
                      title="サイト全体平均との差"
                    >
                      {staffDiff.text}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-gray-400">評価なし</span>
            )}
          </div>
          <div className="text-center p-6 bg-green-50/80 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs md:text-sm text-gray-600 mb-3">在校生の雰囲気</p>
            {atmosphereFitRatingAvg !== null ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <StarRatingDisplay value={atmosphereFitRatingAvg} size="sm" />
                <span className="text-base md:text-lg font-semibold text-gray-900 tabular-nums">
                  {atmosphereFitRatingAvg.toFixed(1)}
                </span>
                {atmosphereDiff ? (
                  <span className="inline-flex items-baseline gap-1 flex-wrap justify-center">
                    <span className="text-[10px] sm:text-xs font-normal text-gray-500">全体平均比</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${atmosphereDiff.className}`}
                      title="サイト全体平均との差"
                    >
                      {atmosphereDiff.text}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-gray-400">評価なし</span>
            )}
          </div>
          <div className="text-center p-6 bg-amber-50/80 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs md:text-sm text-gray-600 mb-3">単位取得のしやすさ</p>
            {creditRatingAvg !== null ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <StarRatingDisplay value={creditRatingAvg} size="sm" />
                <span className="text-base md:text-lg font-semibold text-gray-900 tabular-nums">
                  {creditRatingAvg.toFixed(1)}
                </span>
                {creditDiff ? (
                  <span className="inline-flex items-baseline gap-1 flex-wrap justify-center">
                    <span className="text-[10px] sm:text-xs font-normal text-gray-500">全体平均比</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${creditDiff.className}`}
                      title="サイト全体平均との差"
                    >
                      {creditDiff.text}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-gray-400">評価なし</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
