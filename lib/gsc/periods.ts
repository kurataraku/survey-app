import type { GscPeriod } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Search Console は直近データが遅延するため、既定では3日前を終端にする。
 */
export function getGscComparisonPeriods(days = 28, dataDelayDays = 3): {
  current: GscPeriod;
  previous: GscPeriod;
} {
  const today = new Date();
  const currentEnd = addDays(today, -dataDelayDays);
  const currentStart = addDays(currentEnd, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    current: {
      startDate: formatDate(currentStart),
      endDate: formatDate(currentEnd),
    },
    previous: {
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd),
    },
  };
}
