'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolCard from '@/components/SchoolCard';
import ReviewCard from '@/components/ReviewCard';
import ArticleCard from '@/components/ArticleCard';
import { prefectures } from '@/lib/prefectures';
import { normalizeSearchQuery } from '@/lib/utils';
import { apiPath, appPath, BASE_PATH } from '@/lib/base-path';

interface HomeData {
  topRankedSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    prefectures?: string[] | null;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
  }>;
  popularSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    prefectures?: string[] | null;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
  }>;
  latestReviews: Array<{
    id: string;
    school_id: string;
    school_name: string;
    status?: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
    created_at: string;
    like_count: number;
    reason_for_choosing?: string[];
    attendance_frequency?: string | null;
    campus_prefecture?: string | null;
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
        const response = await fetch(apiPath(`/api/schools/autocomplete?q=${encodeURIComponent(normalizedQuery)}`));
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
    const timeoutId = setTimeout(() => fetchSuggestions(), 500);
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

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiPath('/api/home'));
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      if (!response.ok) {
        let errorData: any = { error: 'データの取得に失敗しました' };
        if (isJson) {
          try {
            errorData = await response.json();
          } catch (e) {
            const text = await response.text();
            errorData = { error: `サーバーエラー (${response.status}): ${text.substring(0, 100)}` };
          }
        } else {
          const text = await response.text();
          errorData = { error: `サーバーエラー (${response.status}): ${text.substring(0, 100)}` };
        }
        throw new Error(errorData.error || errorData.message || `データの取得に失敗しました (${response.status})`);
      }
      let homeData: any;
      if (isJson) {
        try {
          homeData = await response.json();
        } catch (e) {
          throw new Error('レスポンスの解析に失敗しました');
        }
      } else {
        throw new Error('予期しないレスポンス形式です');
      }
      if (!homeData || typeof homeData !== 'object') {
        throw new Error('無効なデータ形式です');
      }
      setData(homeData);
    } catch (error) {
      console.error('ホームデータ取得エラー:', error);
      setData({
        topRankedSchools: [],
        popularSchools: [],
        latestReviews: [],
        latestArticles: [],
      });
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-gray-50">
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
            <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-xl p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-4">通信制高校を探す</label>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative" ref={searchInputRef}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    placeholder="学校名で検索"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                  {showSuggestions && (
                    <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {isLoadingSuggestions ? (
                        <div className="px-4 py-3 text-sm text-gray-500">読み込み中...</div>
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
                        <div className="px-4 py-3 text-sm text-gray-500">該当する学校が見つかりませんでした</div>
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
                      <option key={pref} value={pref}>{pref}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-md hover:shadow-lg">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-3" />
                <div className="h-3 bg-gray-200 rounded animate-pulse mb-4 w-2/3" />
                <div className="h-3 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : data && (
          <>
            {data.popularSchools.length > 0 && (
              <section className="mb-12">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の学校</h2>
                    <p className="text-sm text-gray-600">多くの口コミが寄せられている学校</p>
                  </div>
                  <Link href={appPath('/schools')} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    もっと見る
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {data.popularSchools.slice(0, 3).map((school) => (
                    <SchoolCard
                      key={school.id}
                      id={school.id}
                      name={school.name}
                      prefecture={school.prefecture}
                      prefectures={school.prefectures || undefined}
                      slug={school.slug}
                      reviewCount={school.review_count}
                      overallAvg={school.overall_avg}
                    />
                  ))}
                </div>
              </section>
            )}
            {data.latestReviews.length > 0 && (
              <section className="mb-12">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の口コミ</h2>
                    <p className="text-sm text-gray-600">多くのいいねが寄せられている口コミ</p>
                  </div>
                  <Link href={appPath('/reviews')} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    もっと見る
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
                      status={review.status}
                      reasonForChoosing={review.reason_for_choosing}
                      attendanceFrequencyProp={review.attendance_frequency}
                      campusPrefecture={review.campus_prefecture}
                    />
                  ))}
                </div>
              </section>
            )}
            {data.latestArticles.length > 0 && (
              <section className="mb-12">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">特集記事</h2>
                    <p className="text-sm text-gray-600">通信制高校に関する役立つ情報</p>
                  </div>
                  <Link href={appPath('/features')} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    もっと見る
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
          </>
        )}
        <section className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">都道府県別で探す</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {majorPrefectures.map((pref) => (
              <Link
                key={pref}
                href={`${appPath('/schools')}?prefecture=${encodeURIComponent(pref)}`}
                className="px-4 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-center text-sm font-medium text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-colors"
              >
                {pref.replace(/[都道府県]$/, '')}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href={appPath('/schools')} className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1">
              すべての都道府県を見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
