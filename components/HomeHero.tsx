'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { prefectures } from '@/lib/prefectures';
import { normalizeSearchQuery } from '@/lib/utils';
import { appPath, BASE_PATH } from '@/lib/base-path';
import { apiPath } from '@/lib/base-path';

interface SchoolSuggestion {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
}

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
    router.push(`${appPath('/schools')}?${params.toString()}`);
  };

  const handleSuggestionClick = (suggestion: SchoolSuggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    const params = new URLSearchParams();
    params.append('q', normalizeSearchQuery(suggestion.name));
    if (selectedPrefecture) params.append('prefecture', selectedPrefecture);
    router.push(`${appPath('/schools')}?${params.toString()}`);
  };

  return (
    <section className="relative min-h-[420px] bg-gradient-to-br from-blue-100 to-blue-200 py-16 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="relative h-full w-full">
          <Image
            src={`${BASE_PATH}/hero-visual.png`}
            alt="通信制高校検索のビジュアル"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            リアルなクチコミで
            <br />
            通信制高校を選ぼう
          </h1>
        </div>
        <div className="max-w-3xl mx-auto mb-8">
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-lg shadow-xl p-6 border border-gray-200"
          >
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              通信制高校を探す
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative" ref={searchInputRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="学校名で検索"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
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
              <div className="md:w-48">
                <select
                  value={selectedPrefecture}
                  onChange={(e) => setSelectedPrefecture(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
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
                className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                検索
              </button>
            </div>
          </form>
        </div>
        <div className="text-center">
          <Link
            href={appPath('/survey')}
            className="inline-flex items-center gap-3 px-10 py-4 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            学校の口コミをする
          </Link>
        </div>
      </div>
    </section>
  );
}
