'use client';

import { useEffect, useRef, useState } from 'react';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import {
  compareRegionalSchools,
  RATING_SORT_MIN_REVIEWS,
  REGIONAL_SORT_OPTIONS,
  type RegionalSortableSchool,
  type RegionalSortKey,
} from '@/lib/schools/regionalLanding';
import type { SchoolInstitutionType } from '@/lib/types/schools';

type FinderStation = {
  id: string;
  label: string;
  schoolCount: number;
  typeCounts: Partial<Record<SchoolInstitutionType, number>>;
};

type FinderSchoolType = {
  key: SchoolInstitutionType;
  label: string;
  schoolCount: number;
};

interface RegionalSchoolFinderProps {
  targetId: string;
  prefecture: string;
  totalSchools: number;
  stations: FinderStation[];
  schoolTypes: FinderSchoolType[];
}

function readSortable(row: HTMLElement): RegionalSortableSchool {
  const rating = row.dataset.rating ? Number(row.dataset.rating) : null;
  return {
    name: row.dataset.name ?? '',
    defaultOrder: Number(row.dataset.defaultOrder ?? 0),
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    reviewCount: Number(row.dataset.reviewCount ?? 0),
  };
}

function sortNote(sort: RegionalSortKey, prefecture: string): string {
  if (sort === 'rating-desc' || sort === 'rating-asc') {
    return `総合満足度は学校全体の値です。口コミが${RATING_SORT_MIN_REVIEWS}件未満の学校は、満足度の順位とは別に後ろへ並べています。`;
  }
  if (sort === 'reviews-desc' || sort === 'reviews-asc') {
    return '口コミ件数は学校全体の件数です。';
  }
  return `標準は${prefecture}内の口コミが多い順、次に学校全体の口コミが多い順です。`;
}

export default function RegionalSchoolFinder({
  targetId,
  prefecture,
  totalSchools,
  stations,
  schoolTypes,
}: RegionalSchoolFinderProps) {
  const [stationId, setStationId] = useState('');
  const [schoolType, setSchoolType] = useState<SchoolInstitutionType | ''>('');
  const [sort, setSort] = useState<RegionalSortKey>('default');
  const reordered = useRef(false);
  const hasFilter = Boolean(stationId || schoolType);
  const selectedStation = stations.find((station) => station.id === stationId);
  const selectedType = schoolTypes.find((option) => option.key === schoolType);

  let matchingCount = totalSchools;
  if (selectedStation && schoolType) matchingCount = selectedStation.typeCounts[schoolType] ?? 0;
  else if (selectedStation) matchingCount = selectedStation.schoolCount;
  else if (selectedType) matchingCount = selectedType.schoolCount;

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    if (!hasFilter && !root.querySelector('[data-regional-school][hidden]')) return;
    for (const row of root.querySelectorAll<HTMLElement>('[data-regional-school]')) {
      const stationMatches =
        !stationId || (row.dataset.stationFilters ?? '').split(' ').includes(stationId);
      const typeMatches = !schoolType || row.dataset.schoolType === schoolType;
      row.hidden = !(stationMatches && typeMatches);
    }
  }, [hasFilter, schoolType, stationId, targetId]);

  useEffect(() => {
    if (sort === 'default' && !reordered.current) return;
    const list = document.getElementById(targetId)?.querySelector<HTMLElement>('[data-regional-list]');
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>(':scope > [data-regional-school]')];
    rows
      .map((row) => ({ row, school: readSortable(row) }))
      .sort((a, b) => compareRegionalSchools(a.school, b.school, sort))
      .forEach(({ row }) => list.appendChild(row));
    reordered.current = sort !== 'default';
  }, [sort, targetId]);

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

  const clear = () => {
    setStationId('');
    setSchoolType('');
  };

  const buttonClass = (active: boolean, disabled: boolean) =>
    [
      'min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
      active
        ? 'border-blue-700 bg-blue-700 text-white'
        : 'border-blue-200 bg-white text-gray-700 hover:border-blue-500 hover:text-blue-800',
      disabled ? 'cursor-not-allowed opacity-40 hover:border-blue-200 hover:text-gray-700' : '',
    ].join(' ');

  return (
    <section
      className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-5 sm:px-6"
      aria-labelledby={`${targetId}-finder-heading`}
    >
      <div className="mb-5">
        <h2 id={`${targetId}-finder-heading`} className="text-xl font-bold text-gray-900">
          通う場所と学校の種類で絞る
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          どちらも選ばなければ、全{totalSchools}校を表示します。
        </p>
      </div>

      {stations.length > 0 && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-bold text-gray-800">最寄り駅</legend>
          <div className="flex flex-wrap gap-2">
            {stations.map((station) => {
              const count = schoolType ? station.typeCounts[schoolType] ?? 0 : station.schoolCount;
              const active = stationId === station.id;
              const disabled = count === 0 && !active;
              return (
                <button
                  key={station.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  className={buttonClass(active, disabled)}
                  onClick={() => setStationId(active ? '' : station.id)}
                >
                  {station.label} <span className="font-normal">{count}校</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-gray-800">学校の種類</legend>
        <div className="flex flex-wrap gap-2">
          {schoolTypes.map((option) => {
            const count = selectedStation
              ? selectedStation.typeCounts[option.key] ?? 0
              : option.schoolCount;
            const active = schoolType === option.key;
            const disabled = count === 0 && !active;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                className={buttonClass(active, disabled)}
                onClick={() => setSchoolType(active ? '' : option.key)}
              >
                {option.label} <span className="font-normal">{count}校</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          サポート校は、通信制高校に在籍しながら学習や生活の支援を受けるために通う学校です。多くの場合、通信制高校の学費も別にかかります。
        </p>
      </fieldset>

      <div className="mt-5 flex flex-col gap-3 border-t border-blue-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-gray-800" aria-live="polite">
            {hasFilter ? `${matchingCount}校を表示しています` : `全${totalSchools}校を表示しています`}
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={clear}
              className="min-h-11 text-sm font-semibold text-blue-800 underline decoration-blue-300 underline-offset-4 hover:text-blue-950"
            >
              条件を解除
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          並び順
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as RegionalSortKey)}
            className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-normal text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            {REGIONAL_SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{sortNote(sort, prefecture)}</p>
    </section>
  );
}
