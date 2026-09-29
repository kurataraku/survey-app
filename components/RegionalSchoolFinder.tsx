'use client';

import { useEffect, useMemo, useState } from 'react';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import type { RegionalReviewFilterKey } from '@/lib/schools/regionalLanding';

type FinderOption = {
  id: string;
  label: string;
  schoolCount: number;
  reviewCounts: Partial<Record<RegionalReviewFilterKey, number>>;
};

interface RegionalSchoolFinderProps {
  targetId: string;
  prefecture: string;
  reviewRegionLabel: string;
  totalSchools: number;
  stations: FinderOption[];
  reviewOptions: Array<{
    key: RegionalReviewFilterKey;
    label: string;
    schoolCount: number;
  }>;
}

function tokens(value: string | undefined): string[] {
  return value?.split(' ').filter(Boolean) ?? [];
}

export default function RegionalSchoolFinder({
  targetId,
  prefecture,
  reviewRegionLabel,
  totalSchools,
  stations,
  reviewOptions,
}: RegionalSchoolFinderProps) {
  const [stationId, setStationId] = useState('');
  const [reviewFilter, setReviewFilter] = useState<RegionalReviewFilterKey | ''>('');
  const [showAll, setShowAll] = useState(false);
  const hasFilter = Boolean(stationId || reviewFilter);
  const selectedStation = stations.find((station) => station.id === stationId);
  const selectedReview = reviewOptions.find((option) => option.key === reviewFilter);
  const matchingCount = useMemo(() => {
    if (selectedStation && reviewFilter) {
      return selectedStation.reviewCounts[reviewFilter] ?? 0;
    }
    if (selectedStation) return selectedStation.schoolCount;
    if (selectedReview) return selectedReview.schoolCount;
    return totalSchools;
  }, [reviewFilter, selectedReview, selectedStation, totalSchools]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    if (!hasFilter && !showAll && !root.querySelector('[data-regional-school][hidden]')) return;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-regional-school]')];
    for (const row of rows) {
      const rowStations = tokens(row.dataset.stationFilters);
      const rowReviews = tokens(row.dataset.reviewFilters) as RegionalReviewFilterKey[];
      const stationMatches = !stationId || rowStations.includes(stationId);
      const reviewMatches = !reviewFilter || rowReviews.includes(reviewFilter);
      const matchesCurrent = stationMatches && reviewMatches;
      row.hidden = hasFilter && !showAll && !matchesCurrent;
    }

    for (const section of root.querySelectorAll<HTMLElement>('[data-regional-section]')) {
      section.hidden = ![...section.querySelectorAll<HTMLElement>('[data-regional-school]')].some(
        (row) => !row.hidden
      );
    }
  }, [hasFilter, reviewFilter, showAll, stationId, targetId]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const onClick = (event: Event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-school-link]');
      if (!anchor) return;
      trackEvent(GA_EVENTS.regionSchoolClick, {
        prefecture,
        block: anchor.dataset.schoolLink ?? 'regional_list',
        link_url: anchor.getAttribute('href') ?? '',
      });
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [prefecture, targetId]);

  const hiddenCount = useMemo(
    () => (hasFilter ? Math.max(0, totalSchools - matchingCount) : 0),
    [hasFilter, matchingCount, totalSchools]
  );

  const clear = () => {
    setStationId('');
    setReviewFilter('');
    setShowAll(false);
  };

  const buttonClass = (active: boolean, disabled: boolean) =>
    [
      'min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
      active
        ? 'border-emerald-600 bg-emerald-600 text-white'
        : 'border-emerald-200 bg-white text-gray-700 hover:border-emerald-500 hover:text-emerald-800',
      disabled ? 'cursor-not-allowed opacity-40 hover:border-emerald-200 hover:text-gray-700' : '',
    ].join(' ');

  return (
    <section
      className="mb-10 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-5 sm:px-6"
      aria-labelledby={`${targetId}-finder-heading`}
    >
      <div className="mb-5">
        <h2 id={`${targetId}-finder-heading`} className="text-xl font-bold text-gray-900">
          気になる条件で学校を絞る
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          選ばなくても全校を見られます。口コミの条件は学校の制度ではなく、
          {reviewRegionLabel}で実際に回答があった学校を示します。
        </p>
      </div>

      {stations.length > 0 && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-bold text-gray-800">
            通いやすい場所 <span className="font-normal text-gray-500">（1つ選択）</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {stations.map((station) => {
              const count = reviewFilter
                ? station.reviewCounts[reviewFilter] ?? 0
                : station.schoolCount;
              const disabled = count === 0 && stationId !== station.id;
              return (
                <button
                  key={station.id}
                  type="button"
                  aria-pressed={stationId === station.id}
                  disabled={disabled}
                  className={buttonClass(stationId === station.id, disabled)}
                  onClick={() => {
                    setStationId((current) => (current === station.id ? '' : station.id));
                    setShowAll(false);
                  }}
                >
                  {station.label} <span aria-label={`${count}校`}>{count}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-gray-800">
          口コミで確かめたいこと <span className="font-normal text-gray-500">（1つ選択）</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {reviewOptions.map((option) => {
            const count = stationId
              ? selectedStation?.reviewCounts[option.key] ?? 0
              : option.schoolCount;
            const disabled = count === 0 && reviewFilter !== option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={reviewFilter === option.key}
                disabled={disabled}
                className={buttonClass(reviewFilter === option.key, disabled)}
                onClick={() => {
                  setReviewFilter((current) => (current === option.key ? '' : option.key));
                  setShowAll(false);
                }}
              >
                {option.label} <span aria-label={`${count}校`}>{count}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 border-t border-emerald-200 pt-4">
        <p className="text-sm font-semibold text-gray-800" aria-live="polite">
          {hasFilter
            ? showAll
              ? `条件に合う${matchingCount}校を含む全${totalSchools}校を表示しています`
              : `${matchingCount}校を表示しています`
            : `全${totalSchools}校を表示しています`}
        </p>
        {hasFilter && matchingCount === 0 && (
          <p className="mt-1 text-sm text-gray-600">
            この組み合わせに該当する口コミはありません。条件を片方外すか、全校を表示してください。
          </p>
        )}
        {hasFilter && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <button
              type="button"
              onClick={clear}
              className="min-h-11 font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
            >
              条件をすべて解除
            </button>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="min-h-11 text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-gray-950"
              >
                {showAll
                  ? '条件に合う学校だけに戻す'
                  : `口コミではこの条件を確認できない学校も見る（${hiddenCount}校）`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
