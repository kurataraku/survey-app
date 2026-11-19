'use client';

import { isPrivateAnalyticsPath } from './private-path';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** GA4 へカスタムイベントを送る（GTM なし・gtag 直送） */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !GA_ID || typeof window.gtag !== 'function') return;
  if (isPrivateAnalyticsPath(window.location.pathname)) return;
  window.gtag('event', name, params ?? {});
}
