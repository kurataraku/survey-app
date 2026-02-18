'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SchoolSearchFilters from '@/components/SchoolSearchFilters';
import { prefectures } from '@/lib/prefectures';
import { appPath } from '@/lib/base-path';

interface SchoolsPageFiltersProps {
  initialQ: string;
  initialPrefecture: string;
  initialMinRating: number | null;
  initialMinReviewCount: number | null;
  initialSort: string;
}

export default function SchoolsPageFilters({
  initialQ,
  initialPrefecture,
  initialMinRating,
  initialMinReviewCount,
  initialSort,
}: SchoolsPageFiltersProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedPrefecture, setSelectedPrefecture] = useState(initialPrefecture);
  const [minRating, setMinRating] = useState<number | null>(initialMinRating);
  const [minReviewCount, setMinReviewCount] = useState<number | null>(initialMinReviewCount);
  const [sortBy, setSortBy] = useState(initialSort);

  useEffect(() => {
    setSearchQuery(initialQ);
    setSelectedPrefecture(initialPrefecture);
    setMinRating(initialMinRating);
    setMinReviewCount(initialMinReviewCount);
    setSortBy(initialSort);
  }, [initialQ, initialPrefecture, initialMinRating, initialMinReviewCount, initialSort]);

  const buildUrl = (
    prefecture: string,
    rating: number | null,
    reviewCount: number | null,
    sort: string
  ) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (prefecture) params.set('prefecture', prefecture);
    if (rating != null) params.set('min_rating', rating.toString());
    if (reviewCount != null) params.set('min_review_count', reviewCount.toString());
    if (sort && sort !== 'name') params.set('sort', sort);
    return `${appPath('/schools')}${params.toString() ? `?${params.toString()}` : ''}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl(selectedPrefecture, minRating, minReviewCount, sortBy));
  };

  return (
    <SchoolSearchFilters
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      selectedPrefecture={selectedPrefecture}
      onPrefectureChange={(v) => {
        setSelectedPrefecture(v);
        router.push(buildUrl(v, minRating, minReviewCount, sortBy));
      }}
      minRating={minRating}
      onMinRatingChange={(v) => {
        setMinRating(v);
        router.push(buildUrl(selectedPrefecture, v, minReviewCount, sortBy));
      }}
      minReviewCount={minReviewCount}
      onMinReviewCountChange={(v) => {
        setMinReviewCount(v);
        router.push(buildUrl(selectedPrefecture, minRating, v, sortBy));
      }}
      sortBy={sortBy}
      onSortByChange={(v) => {
        setSortBy(v);
        router.push(buildUrl(selectedPrefecture, minRating, minReviewCount, v));
      }}
      onSubmit={handleSubmit}
      prefectures={prefectures}
    />
  );
}
