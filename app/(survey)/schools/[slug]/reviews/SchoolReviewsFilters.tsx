'use client';

import { useRouter } from 'next/navigation';
import ReviewFilters, { ReviewFilters as ReviewFiltersType } from '@/components/ReviewFilters';
import { appPath } from '@/lib/base-path';

interface SchoolReviewsFiltersProps {
  slug: string;
  filters: ReviewFiltersType;
  sort: string;
  totalBeforeFilter: number;
  filteredCount: number;
}

export default function SchoolReviewsFilters({
  slug,
  filters,
  sort,
  totalBeforeFilter,
  filteredCount,
}: SchoolReviewsFiltersProps) {
  const router = useRouter();

  const buildUrl = (newFilters: ReviewFiltersType, newSort: string, newPage = 1) => {
    const q = new URLSearchParams();
    q.set('sort', newSort);
    if (newPage > 1) q.set('page', newPage.toString());
    if (newFilters.role) q.set('role', newFilters.role);
    if (newFilters.graduation_path) q.set('graduation_path', newFilters.graduation_path);
    if (newFilters.enrollment_type) q.set('enrollment_type', newFilters.enrollment_type);
    if (newFilters.attendance_frequency) q.set('attendance_frequency', newFilters.attendance_frequency);
    if (newFilters.campus_prefecture) q.set('campus_prefecture', newFilters.campus_prefecture);
    if (newFilters.reason_for_choosing && newFilters.reason_for_choosing.length > 0) {
      q.set('reason_for_choosing', newFilters.reason_for_choosing.join(','));
    }
    return `${appPath(`/schools/${encodeURIComponent(slug)}/reviews`)}?${q.toString()}`;
  };

  const handleFiltersChange = (newFilters: ReviewFiltersType) => {
    router.push(buildUrl(newFilters, sort, 1), { scroll: false });
  };

  const handleSortChange = (newSort: string) => {
    router.push(buildUrl(filters, newSort, 1), { scroll: false });
  };

  return (
    <ReviewFilters
      filters={filters}
      onFiltersChange={handleFiltersChange}
      totalCount={totalBeforeFilter}
      filteredCount={filteredCount}
      sort={sort}
      onSortChange={handleSortChange}
    />
  );
}
