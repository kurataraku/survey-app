'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/track';

const DEPTHS = [25, 50, 75, 100] as const;

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/admin');
}

/** スクロール深度（25/50/75/100%）を1セッションにつき各1回だけ計測 */
export function AnalyticsEngagement() {
  const pathname = usePathname();
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || isAdminPath()) return;

    fired.current = new Set();

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const pct = (scrollTop / scrollHeight) * 100;

      for (const d of DEPTHS) {
        if (pct >= d - 2 && !fired.current.has(d)) {
          fired.current.add(d);
          trackEvent('scroll_depth', { depth_percent: d, page_path: pathname });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return null;
}
