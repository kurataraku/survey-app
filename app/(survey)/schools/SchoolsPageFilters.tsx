'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SchoolSearchFilters from '@/components/SchoolSearchFilters';
import { prefectures } from '@/lib/prefectures';
import { appPath } from '@/lib/base-path';
import { DEFAULT_SCHOOL_LIST_SORT } from '@/lib/schools/school-search-constants';
import type { SearchSchool } from '@/lib/schools/searchSchools';

interface SchoolsPageFiltersProps {
  initialQ: string;
  initialPrefecture: string;
  initialCampusPrefecture: string;
  initialCampusCity: string;
  initialMinReviewCount: number | null;
  initialSort: string;
  schools: SearchSchool[];
}

export default function SchoolsPageFilters({
  initialQ,
  initialPrefecture,
  initialCampusPrefecture,
  initialCampusCity,
  initialMinReviewCount,
  initialSort,
  schools,
}: SchoolsPageFiltersProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedPrefecture, setSelectedPrefecture] = useState(initialPrefecture);
  const [selectedCampusPrefecture, setSelectedCampusPrefecture] = useState(initialCampusPrefecture);
  const [selectedCampusCity, setSelectedCampusCity] = useState(initialCampusCity);
  const [minReviewCount, setMinReviewCount] = useState<number | null>(initialMinReviewCount);
  const [sortBy, setSortBy] = useState(initialSort);

  useEffect(() => {
    setSearchQuery(initialQ);
    setSelectedPrefecture(initialPrefecture);
    setSelectedCampusPrefecture(initialCampusPrefecture);
    setSelectedCampusCity(initialCampusCity);
    setMinReviewCount(initialMinReviewCount);
    setSortBy(initialSort);
  }, [initialQ, initialPrefecture, initialCampusPrefecture, initialCampusCity, initialMinReviewCount, initialSort]);

  const cityOptions = Array.from(
    new Set(
      schools
        .flatMap((school) => school.campus_locations ?? [])
        .filter((location) => !selectedCampusPrefecture || location.prefecture === selectedCampusPrefecture)
        .map((location) => location.city)
    )
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  const buildUrl = (
    prefecture: string,
    campusPrefecture: string,
    campusCity: string,
    reviewCount: number | null,
    sort: string
  ) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (prefecture) params.set('prefecture', prefecture);
    if (campusPrefecture) params.set('campus_prefecture', campusPrefecture);
    if (campusCity) params.set('campus_city', campusCity);
    if (reviewCount != null) params.set('min_review_count', reviewCount.toString());
    if (sort && sort !== DEFAULT_SCHOOL_LIST_SORT) params.set('sort', sort);
    return `${appPath('/schools')}${params.toString() ? `?${params.toString()}` : ''}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl(selectedPrefecture, selectedCampusPrefecture, selectedCampusCity, minReviewCount, sortBy));
  };

  const pushCurrent = (next: {
    prefecture?: string;
    campusPrefecture?: string;
    campusCity?: string;
    minReviewCount?: number | null;
    sortBy?: string;
  }) => {
    router.push(buildUrl(
      next.prefecture ?? selectedPrefecture,
      next.campusPrefecture ?? selectedCampusPrefecture,
      next.campusCity ?? selectedCampusCity,
      next.minReviewCount ?? minReviewCount,
      next.sortBy ?? sortBy
    ));
  };

  return (
    <SchoolSearchFilters
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      selectedPrefecture={selectedPrefecture}
      onPrefectureChange={(v) => {
        setSelectedPrefecture(v);
        const nextCampusPrefecture = selectedCampusPrefecture || v;
        setSelectedCampusPrefecture(nextCampusPrefecture);
        setSelectedCampusCity('');
        pushCurrent({ prefecture: v, campusPrefecture: nextCampusPrefecture, campusCity: '' });
      }}
      selectedCampusPrefecture={selectedCampusPrefecture}
      onCampusPrefectureChange={(v) => {
        setSelectedCampusPrefecture(v);
        setSelectedCampusCity('');
        pushCurrent({ campusPrefecture: v, campusCity: '' });
      }}
      selectedCampusCity={selectedCampusCity}
      onCampusCityChange={(v) => {
        setSelectedCampusCity(v);
        pushCurrent({ campusCity: v });
      }}
      campusCityOptions={cityOptions}
      minReviewCount={minReviewCount}
      onMinReviewCountChange={(v) => {
        setMinReviewCount(v);
        pushCurrent({ minReviewCount: v });
      }}
      sortBy={sortBy}
      onSortByChange={(v) => {
        setSortBy(v);
        pushCurrent({ sortBy: v });
      }}
      onSubmit={handleSubmit}
      prefectures={prefectures}
    />
  );
}
