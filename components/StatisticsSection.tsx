'use client';

import { useState } from 'react';
import { getQuestionLabel } from '@/lib/questionLabels';

interface StatisticsSectionProps {
  title: string;
  items: Array<{ label: string; count: number; percentage: number }>;
  type: 'bar' | 'badge';
  totalCount: number;
  maxInitialItems?: number;
}

export default function StatisticsSection({
  title,
  items,
  type,
  totalCount,
  maxInitialItems = 3,
}: StatisticsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = items.length > maxInitialItems;
  const displayItems = isExpanded || !hasMore ? items : items.slice(0, maxInitialItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {displayItems.map((item, index) => (
          <div key={index} className="space-y-1.5">
            {type === 'bar' ? (
              <>
                {/* モバイル対応：縦積みでも崩れない */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="text-sm text-gray-700 flex-1 min-w-0">{item.label}</span>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1 min-w-0">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 tabular-nums whitespace-nowrap flex-shrink-0">
                      {item.count}件 ({item.percentage}%)
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    title.includes('雰囲気')
                      ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {item.label} ({item.count})
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              <span>折りたたむ</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              <span>もっと見る ({items.length - maxInitialItems}件)</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

