'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/admin');
}

function sendPageView() {
  if (!GA_ID || typeof window.gtag !== 'function' || isAdminPath()) return;
  window.gtag('event', 'page_view', {
    page_path: window.location.pathname,
    page_location: window.location.href,
  });
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return;
    if (isAdminPath()) return;

    const path = window.location.pathname;
    const prev = lastPathRef.current;

    const trySend = (): boolean => {
      if (typeof window.gtag !== 'function') return false;
      if (prev !== null && prev === path) return true;
      sendPageView();
      lastPathRef.current = path;
      return true;
    };

    if (trySend()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (trySend() || attempts >= 10) clearInterval(interval);
    }, 80);

    return () => clearInterval(interval);
  }, [pathname]);

  return null;
}
