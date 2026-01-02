'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolCard from '@/components/SchoolCard';
import ReviewCard from '@/components/ReviewCard';
import ArticleCard from '@/components/ArticleCard';
import { prefectures } from '@/lib/prefectures';
import { normalizeSearchQuery } from '@/lib/utils';

interface HomeData {
  topRankedSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
  }>;
  popularSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
  }>;
  latestReviews: Array<{
    id: string;
    school_id: string;
    school_name: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
    created_at: string;
    like_count: number;
    schools: {
      id: string;
      name: string;
      slug: string | null;
    } | null;
  }>;
  latestArticles: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featured_image_url: string | null;
    published_at: string | null;
    category: 'interview' | 'useful_info';
  }>;
}

// 主要都道府県（参考サイトを参考に）
const majorPrefectures = [
  '東京都',
  '神奈川県',
  '埼玉県',
  '千葉県',
  '大阪府',
  '兵庫県',
  '京都府',
  '愛知県',
];

interface SchoolSuggestion {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
}

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrefecture, setSelectedPrefecture] = useState('');
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHomeData();
  }, []);

  // オートコンプリート候補を取得
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        // 検索クエリを正規化（全角→半角変換）
        const normalizedQuery = normalizeSearchQuery(searchQuery.trim());
        const response = await fetch(`/api/schools/autocomplete?q=${encodeURIComponent(normalizedQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setShowSuggestions(data.suggestions && data.suggestions.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('候補取得エラー:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    // デバウンス処理（500ms待機）
    const timeoutId = setTimeout(() => {
      fetchSuggestions();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // クリックアウトサイドで候補を非表示
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchHomeData = async () => {
    try {
      const response = await fetch('/api/home');
      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }
      const homeData = await response.json();
      setData(homeData);
    } catch (error) {
      console.error('ホームデータ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      // 検索クエリを正規化（全角→半角変換）
      const normalizedQuery = normalizeSearchQuery(searchQuery.trim());
      params.append('q', normalizedQuery);
    }
    if (selectedPrefecture) {
      params.append('prefecture', selectedPrefecture);
    }
    router.push(`/schools?${params.toString()}`);
  };

  const handleSuggestionClick = (suggestion: SchoolSuggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    const params = new URLSearchParams();
    // 検索クエリを正規化（全角→半角変換）
    const normalizedQuery = normalizeSearchQuery(suggestion.name);
    params.append('q', normalizedQuery);
    if (selectedPrefecture) {
      params.append('prefecture', selectedPrefecture);
    }
    router.push(`/schools?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-3"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse mb-4 w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">データの読み込みに失敗しました</h3>
            <p className="mt-2 text-sm text-gray-600">しばらくしてから再度お試しください</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-br from-blue-50 to-blue-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              通信制高校リアルレビュー
            </h1>
            <p className="text-xl text-gray-700 mb-2">
              自分に合った通信制高校を選んで、
            </p>
            <p className="text-xl text-gray-700">
              大学進学・就職への一歩を踏みだそう！
            </p>
          </div>

          {/* 検索パネル - 1つの視覚的ユニットとして統合 */}
          <div className="max-w-3xl mx-auto mb-8">
            <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-xl p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                学校を探す
              </label>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative" ref={searchInputRef}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="学校名で検索"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showSuggestions && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {isLoadingSuggestions ? (
                        <div className="px-4 py-3 text-sm text-gray-500">読み込み中...</div>
                      ) : suggestions.length > 0 ? (
                        suggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{suggestion.name}</div>
                            <div className="text-sm text-gray-500">{suggestion.prefecture}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">該当する学校が見つかりませんでした</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="md:w-48">
                  <select
                    value={selectedPrefecture}
                    onChange={(e) => setSelectedPrefecture(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">都道府県を選択</option>
                    {prefectures.map((pref) => (
                      <option key={pref} value={pref}>
                        {pref}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  検索
                </button>
              </div>
            </form>
          </div>

          {/* 主CTA - より大きく目立つデザイン */}
          <div className="text-center">
            <Link
              href="/survey"
              className="inline-flex items-center gap-3 px-10 py-4 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              学校の口コミをする
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ランキングサマリー */}
        {data.topRankedSchools.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">総合評判ランキング TOP5</h2>
                <p className="text-sm text-gray-600">口コミ数と評価の高い学校</p>
              </div>
              <Link
                href="/rankings/overall"
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.topRankedSchools.slice(0, 3).map((school, index) => (
                <div key={school.id} className="relative">
                  <div className="absolute -top-2 -left-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm z-10">
                    {index + 1}
                  </div>
                  <SchoolCard
                    id={school.id}
                    name={school.name}
                    prefecture={school.prefecture}
                    slug={school.slug}
                    reviewCount={school.review_count}
                    overallAvg={school.overall_avg}
                  />
                </div>
              ))}
            </div>
            {data.topRankedSchools.length > 3 && (
              <div className="mt-4 text-center">
                <Link
                  href="/rankings/overall"
                  className="inline-block px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  ランキングTOP5を見る
                </Link>
              </div>
            )}
          </section>
        )}

        {/* 注目の学校（口コミ数順） */}
        {data.popularSchools.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の学校</h2>
                <p className="text-sm text-gray-600">多くの口コミが寄せられている学校</p>
              </div>
              <Link
                href="/schools"
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.popularSchools.slice(0, 3).map((school) => (
                <SchoolCard
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
                  slug={school.slug}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
                />
              ))}
            </div>
          </section>
        )}

        {/* 注目の口コミ */}
        {data.latestReviews.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の口コミ</h2>
                <p className="text-sm text-gray-600">多くのいいねが寄せられている口コミ</p>
              </div>
              <Link
                href="/reviews"
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.latestReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  id={review.id}
                  schoolName={review.schools?.name || review.school_name}
                  schoolSlug={review.schools?.slug || null}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  badComment={review.bad_comment}
                  enrollmentYear={null}
                  attendanceFrequency={null}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                />
              ))}
            </div>
          </section>
        )}

        {/* 最新記事 */}
        {data.latestArticles.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">特集記事</h2>
                <p className="text-sm text-gray-600">通信制高校に関する役立つ情報</p>
              </div>
              <Link
                href="/features"
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.latestArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  slug={article.slug}
                  category={article.category}
                  excerpt={article.excerpt}
                  featured_image_url={article.featured_image_url}
                  published_at={article.published_at}
                />
              ))}
            </div>
          </section>
        )}

        {/* 都道府県別クイックアクセス */}
        <section className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            都道府県別で探す
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {majorPrefectures.map((pref) => (
              <Link
                key={pref}
                href={`/schools?prefecture=${encodeURIComponent(pref)}`}
                className="px-4 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-center text-sm font-medium text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-colors"
              >
                {pref.replace(/[都道府県]$/, '')}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/schools"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
            >
              すべての都道府県を見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
