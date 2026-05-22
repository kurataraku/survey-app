'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics/track';

interface PrefectureLandingTrackedLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  eventName: string;
  eventParams?: Record<string, unknown>;
  ariaLabel?: string;
}

export default function PrefectureLandingTrackedLink({
  href,
  children,
  className,
  eventName,
  eventParams,
  ariaLabel,
}: PrefectureLandingTrackedLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => trackEvent(eventName, eventParams)}
    >
      {children}
    </Link>
  );
}
