'use client';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/admin');
}

/** GA4 へカスタムイベントを送る（GTM なし・gtag 直送） */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !GA_ID || typeof window.gtag !== 'function') return;
  if (isAdminPath()) return;
  window.gtag('event', name, params ?? {});
}
