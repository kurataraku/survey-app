'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { appPath } from '@/lib/base-path';
import { REVIEW_REASON_GROUPS } from '@/lib/reviews/reason-groups';

const SORT_OPTIONS = [
  { value: 'newest',      label: '新着順' },
  { value: 'rating_desc', label: '高評価順' },
  { value: 'rating_asc',  label: '低評価順' },
];

const ATTENDANCE_OPTIONS = [
  { value: '',                   label: 'ALL' },
  { value: '週5',                label: '週5日' },
  { value: '週3〜4',             label: '週3〜4日' },
  { value: '週1〜2',             label: '週1〜2日' },
  { value: '月1〜数回',          label: '月1〜数回' },
  { value: 'ほぼオンライン/自宅', label: 'ほぼ自宅' },
];

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

const STAR_OPTIONS = [
  { value: '',  label: 'ALL' },
  { value: '1', label: '★1' },
  { value: '2', label: '★2' },
  { value: '3', label: '★3' },
  { value: '4', label: '★4' },
  { value: '5', label: '★5' },
];

const RATING_DIMENSIONS = [
  { key: 'staff',      label: '先生・サポート' },
  { key: 'atmosphere', label: '雰囲気・居心地' },
  { key: 'credit',     label: 'カリキュラム' },
  { key: 'tuition',    label: '学費の納得感' },
];

function buildUrl(current: URLSearchParams, updates: Record<string, string>): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }
  next.delete('page');
  const qs = next.toString();
  return appPath(`/reviews${qs ? `?${qs}` : ''}`);
}

export default function ReviewsFilter() {
  const searchParams = useSearchParams();
  const sort       = searchParams.get('sort') ?? 'newest';
  const attendance = searchParams.get('attendance_frequency') ?? '';
  const prefecture = searchParams.get('prefecture') ?? '';
  const reasonGroup = searchParams.get('reason_group') ?? '';
  const overall    = searchParams.get('overall') ?? '';
  const [detailOpen, setDetailOpen] = useState(false);

  const hasDetailFilter = ['staff', 'atmosphere', 'credit', 'tuition'].some(
    k => !!searchParams.get(k)
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-col gap-5">

      {/* 表示順 */}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2 tracking-wide">表示順</p>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(opt => {
            const isActive = opt.value === sort;
            return (
              <Link
                key={opt.value}
                href={buildUrl(searchParams, { sort: opt.value })}
                rel="nofollow"
                className={`text-sm font-bold px-4 py-1.5 rounded-full border-2 transition-all ${
                  isActive
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 通学スタイル */}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2 tracking-wide">通学スタイル</p>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_OPTIONS.map(opt => {
            const isActive = opt.value === attendance;
            return (
              <Link
                key={opt.value}
                href={buildUrl(searchParams, { attendance_frequency: opt.value })}
                rel="nofollow"
                className={`text-sm font-bold px-4 py-1.5 rounded-full border-2 transition-all ${
                  isActive
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-400 hover:text-sky-600'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 都道府県 */}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2 tracking-wide">都道府県</p>
        <div className="relative">
          <select
            value={prefecture}
            onChange={e => {
              window.location.href = buildUrl(searchParams, { prefecture: e.target.value });
            }}
            className={`w-full border-2 rounded-xl px-3 py-2 text-sm font-bold appearance-none pr-8 transition-all ${
              prefecture
                ? 'border-sky-500 text-sky-700 bg-sky-50'
                : 'border-gray-200 text-gray-600 bg-white'
            }`}
          >
            <option value="">全国</option>
            {PREFECTURES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
        </div>
      </div>

      {/* 通信制を選んだ理由 */}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2 tracking-wide">通信制を選んだ理由</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl(searchParams, { reason_group: '' })}
            rel="nofollow"
            className={`text-sm font-bold px-4 py-1.5 rounded-full border-2 transition-all ${
              reasonGroup === ''
                ? 'bg-gray-200 text-gray-700 border-gray-200'
                : 'bg-white text-gray-600 border-gray-200 hover:border-sky-400 hover:text-sky-600'
            }`}
          >
            ALL
          </Link>
          {REVIEW_REASON_GROUPS.map(group => {
            const isActive = group.key === reasonGroup;
            return (
              <Link
                key={group.key}
                href={buildUrl(searchParams, { reason_group: group.key })}
                  rel="nofollow"
                className={`text-sm font-bold px-4 py-1.5 rounded-full border-2 transition-all ${
                  isActive
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-400 hover:text-sky-600'
                }`}
              >
                {group.shortLabel}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 総合満足度 */}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2 tracking-wide">総合満足度</p>
        <div className="flex flex-wrap gap-1.5">
          {STAR_OPTIONS.map(opt => {
            const isActive = opt.value === overall;
            const isAll = opt.value === '';
            return (
              <Link
                key={opt.value}
                href={buildUrl(searchParams, { overall: opt.value })}
                  rel="nofollow"
                className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all whitespace-nowrap ${
                  isActive
                    ? isAll
                      ? 'bg-gray-200 text-gray-700 border-gray-200'
                      : 'bg-amber-400 text-white border-amber-400'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 詳細満足度（折りたたみ） */}
      <div>
        <button
          type="button"
          onClick={() => setDetailOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs font-black text-gray-400 tracking-wide hover:text-sky-600 transition-colors"
        >
          <span>詳細な満足度でさらに絞り込む</span>
          {hasDetailFilter && !detailOpen && (
            <span className="bg-sky-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">ON</span>
          )}
          <span className={`text-[10px] transition-transform duration-200 ${detailOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {detailOpen && (
          <div className="mt-3 flex flex-col gap-2.5">
            {RATING_DIMENSIONS.map(dim => {
              const current = searchParams.get(dim.key) ?? '';
              return (
                <div key={dim.key} className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-gray-600">{dim.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {STAR_OPTIONS.map(opt => {
                      const isActive = opt.value === current;
                      const isAll = opt.value === '';
                      return (
                        <Link
                          key={opt.value}
                          href={buildUrl(searchParams, { [dim.key]: opt.value })}
                          rel="nofollow"
                          className={`text-xs font-bold px-2 py-1 rounded-full border-2 transition-all whitespace-nowrap ${
                            isActive
                              ? isAll
                                ? 'bg-gray-200 text-gray-700 border-gray-200'
                                : 'bg-amber-400 text-white border-amber-400'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                          }`}
                        >
                          {opt.label}
                        </Link>
                      );
                    })}
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
