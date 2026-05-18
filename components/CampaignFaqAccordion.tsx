'use client';

import { useState } from 'react';
import { CAMPAIGN_FAQ } from '@/lib/campaign/copy';

export default function CampaignFaqAccordion() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(CAMPAIGN_FAQ[0]?.q ?? null);

  return (
    <div className="space-y-1.5 sm:space-y-3">
      {CAMPAIGN_FAQ.map((item) => {
        const isOpen = openQuestion === item.q;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-lg sm:rounded-xl border border-gray-100 bg-white shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-5 sm:py-4 text-left font-bold text-gray-900 text-sm sm:text-base"
              aria-expanded={isOpen}
              onClick={() => setOpenQuestion(isOpen ? null : item.q)}
            >
              <span>{item.q}</span>
              <span
                className="flex h-5 w-5 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 text-xs sm:text-base transition-transform"
                aria-hidden
              >
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 sm:px-5 sm:pb-5 text-xs sm:text-base text-gray-600 leading-snug sm:leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
