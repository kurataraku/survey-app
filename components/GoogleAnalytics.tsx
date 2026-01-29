'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** 同一 path の短時間重複送信を防ぐ（Strict Mode 二重マウント等対策）。モジュールレベルで ref リセットに依存しない。 */
const DEDUPE_MS = 2000;
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

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return;
    if (isAdminPath()) return;

    const path = window.location.pathname;
    const loc = window.location.href;
    const prev = lastPathRef.current;

    const trySend = (): boolean => {
      if (typeof window.gtag !== 'function') return false;
      if (prev !== null && prev === path) return true;
      if (!sendPageView(path, loc)) return true;
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
