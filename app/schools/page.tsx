'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SchoolCard from '@/components/SchoolCard';
import SchoolSearchFilters from '@/components/SchoolSearchFilters';
import { prefectures } from '@/lib/prefectures';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  review_count: number;
  overall_avg: number | null;
}

function SchoolsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedPrefecture, setSelectedPrefecture] = useState(
    searchParams.get('prefecture') || ''
  );
  const [minRating, setMinRating] = useState<number | null>(
    searchParams.get('min_rating') ? parseFloat(searchParams.get('min_rating')!) : null
  );
  const [minReviewCount, setMinReviewCount] = useState<number | null>(
    searchParams.get('min_review_count') ? parseInt(searchParams.get('min_review_count')!) : null
  );
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');

  const limit = 20;

  useEffect(() => {
    fetchSchools();
  }, [page, searchQuery, selectedPrefecture, minRating, minReviewCount, sortBy]);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      if (selectedPrefecture) {
        params.append('prefecture', selectedPrefecture);
      }
      if (minRating !== null) {
        params.append('min_rating', minRating.toString());
      }
      if (minReviewCount !== null) {
        params.append('min_review_count', minReviewCount.toString());
      }
      if (sortBy) {
        params.append('sort', sortBy);
      }

      const response = await fetch(`/api/schools/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('学校検索に失敗しました');
      }

      const data = await response.json();
      setSchools(data.schools);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('学校検索エラー:', error);
      alert('学校検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    updateURL();
  };

  const updateURL = () => {
    updateURLWithFilters(selectedPrefecture, minRating, minReviewCount, sortBy);
  };

  const updateURLWithFilters = (
    prefecture: string,
    rating: number | null,
    reviewCount: number | null,
    sort: string
  ) => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('q', searchQuery);
    }
    if (prefecture) {
      params.append('prefecture', prefecture);
    }
    if (rating !== null) {
      params.append('min_rating', rating.toString());
    }
    if (reviewCount !== null) {
      params.append('min_review_count', reviewCount.toString());
    }
    if (sort && sort !== 'name') {
      params.append('sort', sort);
    }
    router.push(`/schools?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            通信制高校を探す
          </h1>

          <SchoolSearchFilters
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            selectedPrefecture={selectedPrefecture}
            onPrefectureChange={(value) => {
              setSelectedPrefecture(value);
              setPage(1);
              updateURLWithFilters(value, minRating, minReviewCount, sortBy);
            }}
            minRating={minRating}
            onMinRatingChange={(value) => {
              setMinRating(value);
              setPage(1);
              updateURLWithFilters(selectedPrefecture, value, minReviewCount, sortBy);
            }}
            minReviewCount={minReviewCount}
            onMinReviewCountChange={(value) => {
              setMinReviewCount(value);
              setPage(1);
              updateURLWithFilters(selectedPrefecture, minRating, value, sortBy);
            }}
            sortBy={sortBy}
            onSortByChange={(value) => {
              setSortBy(value);
              setPage(1);
              updateURLWithFilters(selectedPrefecture, minRating, minReviewCount, value);
            }}
            onSubmit={handleSearch}
            prefectures={prefectures}
          />

          {total > 0 && (
            <p className="text-gray-600 mb-4">
              {total}件の学校が見つかりました
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">学校が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {schools.map((school) => (
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

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SchoolsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <SchoolsPageContent />
    </Suspense>
  );
}

