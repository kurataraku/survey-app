'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { appPath } from '@/lib/base-path';
import { trackEvent } from '@/lib/analytics/track';

interface SurveyCtaLinkProps {
  children: ReactNode;
  className?: string;
  /** GA4 の event 名（例: cta_survey_from_school） */
  eventName?: string;
  eventParams?: Record<string, unknown>;
}

export default function SurveyCtaLink({
  children,
  className,
  eventName = 'cta_survey',
  eventParams,
}: SurveyCtaLinkProps) {
  return (
    <Link
      href={appPath('/survey')}
      className={className}
      onClick={() => trackEvent(eventName, eventParams)}
    >
      {children}
    </Link>
  );
}
