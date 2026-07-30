'use client';

import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

const DEFAULT_SUBJECT = '資料請求の希望';

type RequestNotificationCtaProps = {
  source: string;
  schoolName?: string;
  schoolSlug?: string;
  prefecture?: string;
  variant?: 'banner' | 'inline';
  className?: string;
};

function buildContactHref(source: string, schoolName?: string): string {
  const params = new URLSearchParams({
    subject: DEFAULT_SUBJECT,
    source,
  });
  if (schoolName) {
    params.set('school', schoolName);
  }
  return `${appPath('/contact')}?${params.toString()}`;
}

export default function RequestNotificationCta({
  source,
  schoolName,
  schoolSlug,
  prefecture,
  variant = 'banner',
  className = '',
}: RequestNotificationCtaProps) {
  const href = buildContactHref(source, schoolName);

  const handleClick = () => {
    trackEvent(GA_EVENTS.requestNotificationClick, {
      source,
      school_name: schoolName,
      school_slug: schoolSlug,
      prefecture,
    });
  };

  if (variant === 'inline') {
    return (
      <p className={`text-sm text-gray-600 ${className}`}>
        {schoolName ? `${schoolName}の資料請求をご希望の方は` : '資料請求をご希望の方は'}
        <Link
          href={href}
          onClick={handleClick}
          rel="nofollow"
          className="ml-1 text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          こちらからご連絡ください
        </Link>
      </p>
    );
  }

  return (
    <section
      className={`rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 md:p-6 ${className}`}
      aria-label="資料請求の希望受付"
    >
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        {schoolName
          ? `${schoolName}の資料請求をご希望の方へ`
          : '気になる学校の資料請求をご希望の方へ'}
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        {schoolName
          ? 'ご希望をお送りいただくと、資料請求のご案内が可能になり次第、メールでご連絡します（無料）。'
          : '気になる学校名を添えてお送りいただくと、資料請求のご案内が可能になり次第、メールでご連絡します（無料）。'}
      </p>
      <Link
        href={href}
        onClick={handleClick}
        rel="nofollow"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        資料請求を希望する
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </section>
  );
}
