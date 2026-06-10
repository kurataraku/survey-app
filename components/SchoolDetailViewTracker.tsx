'use client';

import { useEffect } from 'react';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type SchoolDetailViewTrackerProps = {
  schoolSlug: string;
  schoolName: string;
  prefecture?: string | null;
  reviewCount: number;
};

/** 学校詳細ページの閲覧を GA4 に送る */
export default function SchoolDetailViewTracker({
  schoolSlug,
  schoolName,
  prefecture,
  reviewCount,
}: SchoolDetailViewTrackerProps) {
  useEffect(() => {
    trackEvent(GA_EVENTS.schoolDetailView, {
      school_slug: schoolSlug,
      school_name: schoolName,
      prefecture: prefecture ?? undefined,
      review_count: reviewCount,
    });
  }, [schoolSlug, schoolName, prefecture, reviewCount]);

  return null;
}
