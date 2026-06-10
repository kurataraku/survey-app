'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type DiagnosisStartLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  source: string;
  eventParams?: Record<string, unknown>;
  ariaLabel?: string;
};

export default function DiagnosisStartLink({
  href,
  children,
  className,
  source,
  eventParams,
  ariaLabel,
}: DiagnosisStartLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() =>
        trackEvent(GA_EVENTS.diagnosisStartClick, {
          source,
          ...eventParams,
        })
      }
    >
      {children}
    </Link>
  );
}
