export const ATTENDANCE_SATISFACTION_RELEASE = {
  slug: 'attendance-frequency-satisfaction-2026',
  publishedAt: '2026-09-15',
  displayDate: '2026年9月15日',
  category: '調査リリース',
  title:
    '通信制高校に「満足度の谷」――「月1〜数回通学」の高満足率は79.2％、ほぼオンライン・週5通学はともに94.3％',
  shortTitle:
    '通信制高校に「満足度の谷」――月1〜数回通学は79.2％',
  description:
    '通信制高校204校の公開口コミ851件を点検し、重複を除いた849件をクロス分析。中間的な通学層では、学校との接点や進路支援への期待と実際の支援にギャップがある可能性が見えてきました。',
} as const;

export const PRESS_RELEASES = [ATTENDANCE_SATISFACTION_RELEASE] as const;

export const ATTENDANCE_SATISFACTION_DATA = [
  { label: 'ほぼオンライン／自宅', value: 94.3, count: '216／229人' },
  { label: '月1〜数回', value: 79.2, count: '80／101人', highlighted: true },
  { label: '週1〜2', value: 92.1, count: '221／240人' },
  { label: '週3〜4', value: 90.1, count: '173／192人' },
  { label: '週5', value: 94.3, count: '82／87人' },
] as const;
