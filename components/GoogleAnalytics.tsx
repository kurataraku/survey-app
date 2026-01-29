'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** 同一 path の短時間重複送信を防ぐ。モジュールレベルで ref リセットに依存しない。 */
const DEDUPE_MS = 3000;
let lastSentPath: string | null = null;
let lastSentTime = 0;

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/admin');
}

function sendPageView(path: string, location: string): boolean {
  if (!GA_ID || typeof window.gtag !== 'function' || isAdminPath()) return false;
  const now = Date.now();
  if (lastSentPath === path && now - lastSentTime < DEDUPE_MS) return false;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: location,
  });
  lastSentPath = path;
  lastSentTime = now;
  return true;
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return;
    if (isAdminPath()) return;

    const path = window.location.pathname;
    const loc = window.location.href;
    const prev = lastPathRef.current;

    const trySend = (): boolean => {
      if (typeof window.gtag !== 'function') return false;
      if (prev !== null && prev === path) return true;
      if (isInitialMount.current) {
        isInitialMount.current = false;
        lastPathRef.current = path;
        return true;
      }
      const sent = sendPageView(path, loc);
      if (!sent) return true;
      lastPathRef.current = path;
      return true;
    };

    if (trySend()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const ok = trySend();
      if (ok || attempts >= 10) clearInterval(interval);
    }, 80);

    return () => clearInterval(interval);
  }, [pathname]);

  return null;
}
