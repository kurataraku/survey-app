'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { prefectures } from '@/lib/prefectures';
import { normalizeSearchQuery } from '@/lib/utils';
import { appPath, BASE_PATH, apiPath } from '@/lib/base-path';
import { trackEvent } from '@/lib/analytics/track';

interface SchoolSuggestion {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
}

const HERO_IMAGE_SRC = `${BASE_PATH}/hero-illustration-v4.png`;
const HERO_IMAGE_ALT =
  '保護者と高校生が一緒にタブレットで通信制高校の口コミを読んでいるイラスト';

export default function HomeHero() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrefecture, setSelectedPrefecture] = useState('');
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setIsLoadingSuggestions(true);
      try {
        const normalizedQuery = normalizeSearchQuery(searchQuery.trim());
        const response = await fetch(
          apiPath(`/api/schools/autocomplete?q=${encodeURIComponent(normalizedQuery)}`)
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setShowSuggestions(!!(data.suggestions && data.suggestions.length > 0));
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.append('q', normalizeSearchQuery(searchQuery.trim()));
    }
    if (selectedPrefecture) params.append('prefecture', selectedPrefecture);
    const qLen = searchQuery.trim().length;
    trackEvent('hero_search_submit', {
      has_query: qLen > 0,
      query_length_bucket: qLen === 0 ? '0' : qLen <= 3 ? '1-3' : qLen <= 10 ? '4-10' : '11+',
      prefecture_selected: Boolean(selectedPrefecture),
    });
    router.push(`${appPath('/schools')}?${params.toString()}`);
  };

  const handleSuggestionClick = (suggestion: SchoolSuggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    const params = new URLSearchParams();
    params.append('q', normalizeSearchQuery(suggestion.name));
    if (selectedPrefecture) params.append('prefecture', selectedPrefecture);
    trackEvent('hero_autocomplete_pick', { source: 'hero' });
    router.push(`${appPath('/schools')}?${params.toString()}`);
  };

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-[#dde9f7] via-[#cfe0f1] to-[#b8cfe5] min-h-[420px] sm:min-h-[460px] lg:min-h-0"
      aria-label="通信制高校の口コミメディア"
    >
      {/* PC: 画像のアスペクト比に合わせたコンテナを右端揃えで配置（右余白ゼロ、左余白は左フェードで吸収） */}
      {/* 画像左端をマスクでフェードアウトさせ、ヒーロー背景グラデと滑らかに同化させる */}
      <div
        aria-hidden
        className="hidden lg:block pointer-events-none absolute inset-y-0 right-0 aspect-[3/2] h-full"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 100%)',
        }}
      >
        <Image
          src={HERO_IMAGE_SRC}
          alt=""
          fill
          sizes="(min-width: 1024px) 75vw, 0px"
          priority
          className="object-contain"
        />
      </div>

      {/* SP/タブレット用: 装飾的な薄い円（背景グラデの単調さを緩和、文字に被らないよう右側のみ配置） */}
      <div
        aria-hidden
        className="lg:hidden pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-white/40 blur-3xl"
      />
      <div
        aria-hidden
        className="lg:hidden pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl"
      />

      {/* PC: 左から右への可読性フェード（テキスト領域を保護） */}
      <div
        aria-hidden
        className="hidden lg:block pointer-events-none absolute inset-0 bg-gradient-to-r from-[#dde9f7]/95 via-[#dde9f7]/60 via-40% to-transparent"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10 lg:py-20 xl:py-24">
        <div className="max-w-sm mx-auto text-center sm:mx-0 sm:text-left sm:max-w-xl lg:max-w-[58%] xl:max-w-[56%]">
          <h1 className="font-bold text-gray-900 leading-[1.2] tracking-tight mb-3 sm:mb-4 md:mb-5 text-balance text-[1.5rem] sm:text-[1.875rem] md:text-[2rem] lg:text-[2.5rem] xl:text-5xl">
            <span className="block">通信制高校のリアルは、</span>
            <span className="block">
              <span className="relative inline-block">
                <span className="relative z-10 text-blue-700">公式サイト</span>
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-0.5 h-2 bg-yellow-200/70 -z-0"
                />
              </span>
              では見えない
            </span>
          </h1>
          <p
            className="text-[0.8125rem] sm:text-sm md:text-[0.95rem] text-slate-700 font-medium leading-[1.75] tracking-[0.02em] mb-4 sm:mb-5 md:mb-7 max-w-xl text-balance"
            style={{ fontFamily: "var(--font-mplus-2), var(--font-sans)" }}
          >
            <span className="block">
              パンフレットや学校HPは「学校が伝えたい情報」
            </span>
            <span className="block text-slate-800/95">
              だから、実際に通った生徒の声を集めました
            </span>
          </p>

          <form
            onSubmit={handleSearch}
            className="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_-20px_rgba(30,64,175,0.3)] ring-1 ring-white/70 p-3 sm:p-4 md:p-5 text-left"
          >
            <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-2.5">
              通信制高校を探す
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative" ref={searchInputRef}>
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="学校名で検索"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                  >
                    {isLoadingSuggestions ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        読み込み中...
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{s.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        該当する学校が見つかりませんでした
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="md:w-44">
                <select
                  value={selectedPrefecture}
                  onChange={(e) => setSelectedPrefecture(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">都道府県から探す</option>
                  {prefectures.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-6 md:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                検索する
              </button>
            </div>
          </form>

          <div className="mt-4 sm:mt-5 md:mt-6 flex flex-col items-center sm:items-start gap-1.5">
            <p className="text-[11px] sm:text-xs font-semibold text-gray-600 tracking-wide">
              在校生・卒業生・保護者のかたへ
            </p>
            <Link
              href={appPath('/survey')}
              onClick={() => trackEvent('cta_survey', { source: 'hero' })}
              className="group inline-flex items-center gap-1.5 pl-5 pr-4 py-2.5 bg-white border-2 border-rose-500 text-rose-600 rounded-full text-sm font-bold shadow-[0_4px_14px_rgba(244,63,94,0.18)] hover:bg-rose-500 hover:text-white hover:shadow-[0_6px_20px_rgba(244,63,94,0.32)] transition-all duration-200"
            >
              <svg
                className="w-4 h-4 -ml-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              体験を投稿する
              <span className="text-[11px] font-medium opacity-80">（最短3分）</span>
              <svg
                className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* 下端：次セクション(bg-gray-50)への滑らかなフェード */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 md:h-16 bg-gradient-to-b from-transparent to-gray-50"
      />
    </section>
  );
}
