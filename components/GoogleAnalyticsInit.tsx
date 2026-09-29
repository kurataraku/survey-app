'use client';

import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const LOAD_DELAY_MS = 8000;
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * page_view と操作イベントは先に dataLayer へ積み、外部タグだけを遅延する。
 * 操作開始時または8秒後に読み込むため、計測を保ちながら初期描画を妨げない。
 * page_view の手動送信・/admin 除外は GoogleAnalytics クライアント側で実施。
 */
export function GoogleAnalyticsInit() {
  useEffect(() => {
    if (!GA_ID || window.location.pathname.includes('/admin')) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || (function gtag() {
      // gtag.js expects an Arguments object in dataLayer, matching Google's bootstrap snippet.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    } as Window['gtag']);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false });

    let loaded = false;
    const load = () => {
      if (loaded || document.getElementById('ga-js')) return;
      loaded = true;
      const script = document.createElement('script');
      script.id = 'ga-js';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
      document.head.appendChild(script);
      for (const eventName of INTERACTION_EVENTS) {
        window.removeEventListener(eventName, load);
      }
    };

    const timeout = window.setTimeout(load, LOAD_DELAY_MS);
    for (const eventName of INTERACTION_EVENTS) {
      window.addEventListener(eventName, load, { passive: true, once: true });
    }

    return () => {
      window.clearTimeout(timeout);
      for (const eventName of INTERACTION_EVENTS) {
        window.removeEventListener(eventName, load);
      }
    };
  }, []);

  return null;
}
