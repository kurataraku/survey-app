'use client';

import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics/track';

interface PrefectureSchoolCardTrackerProps {
  prefecture: string;
  block?: string;
  children: ReactNode;
}

/** 学校カード内の詳細リンククリックを GA4 に送る（Server カードを Client 化しない） */
export default function PrefectureSchoolCardTracker({
  prefecture,
  block,
  children,
}: PrefectureSchoolCardTrackerProps) {
  return (
    <div
      onClick={(e) => {
        const anchor = (e.target as HTMLElement).closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';
        if (!href.includes('/schools/')) return;
        trackEvent('prefecture_school_detail_click', {
          prefecture,
          block: block ?? 'list',
          link_url: href,
        });
      }}
    >
      {children}
    </div>
  );
}
