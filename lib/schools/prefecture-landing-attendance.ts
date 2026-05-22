import { appPath } from '@/lib/base-path';

/** 口コミ検索で使う通学頻度（lib/questions.ts と一致） */
export const PREFECTURE_ATTENDANCE_FREQUENCY_OPTIONS = [
  { label: '週5', value: '週5' },
  { label: '週3〜4', value: '週3〜4' },
  { label: '週1〜2', value: '週1〜2' },
  { label: '月1〜数回', value: '月1〜数回' },
  { label: 'ほぼオンライン/自宅', value: 'ほぼオンライン/自宅' },
] as const;

export type PrefectureAttendanceLink = {
  label: string;
  href: string;
};

export function getPrefectureAttendanceFrequencyLinks(prefecture: string): PrefectureAttendanceLink[] {
  return PREFECTURE_ATTENDANCE_FREQUENCY_OPTIONS.map(({ label, value }) => ({
    label,
    href: appPath(
      `/reviews?prefecture=${encodeURIComponent(prefecture)}&attendance_frequency=${encodeURIComponent(value)}`
    ),
  }));
}
