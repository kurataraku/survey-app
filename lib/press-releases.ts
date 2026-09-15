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

/** 通学頻度×個別評価の高評価率（4〜5）。図2用。 */
export const ATTENDANCE_METRIC_COMPARE = {
  frequencies: [
    'ほぼオンライン／自宅',
    '月1〜数回',
    '週1〜2',
    '週3〜4',
    '週5',
  ] as const,
  series: [
    {
      key: 'support',
      label: '心身サポート',
      values: [60.3, 57.4, 78.8, 81.8, 87.4],
    },
    {
      key: 'atmosphere',
      label: '雰囲気の適合',
      strokeDasharray: '6 4',
      values: [69.0, 58.4, 72.9, 73.4, 73.6],
    },
    {
      key: 'career',
      label: '進路サポート',
      strokeDasharray: '2 3',
      values: [62.0, 55.4, 72.1, 79.2, 81.6],
    },
  ],
  /** 月1〜数回層の内部対比（学習面は高い） */
  monthlyLearning: [
    { label: '単位取得のしやすさ', value: 84.2 },
    { label: '学びの柔軟さ', value: 83.2 },
  ],
} as const;

/** 図3: ほぼオンライン層と週5通学層の比較（総合は同率、中身が異なる）。 */
export const ONLINE_VS_WEEKLY_COMPARE = {
  groups: [
    {
      key: 'online',
      label: 'ほぼオンライン／自宅',
      short: 'ほぼオンライン',
    },
    {
      key: 'weekly',
      label: '週5通学',
      short: '週5通学',
    },
  ],
  rows: [
    {
      key: 'overall',
      label: '総合満足度4〜5',
      note: '同率',
      online: 94.3,
      weekly: 94.3,
      onlineCount: '216／229人',
      weeklyCount: '82／87人',
    },
    {
      key: 'support',
      label: '心身サポート4〜5',
      online: 60.3,
      weekly: 87.4,
      onlineCount: '138／229人',
      weeklyCount: '76／87人',
    },
    {
      key: 'career',
      label: '進路サポート4〜5',
      online: 62.0,
      weekly: 81.6,
      onlineCount: '142／229人',
      weeklyCount: '71／87人',
    },
    {
      key: 'tuition',
      label: '学費納得感1〜2',
      note: '低評価の割合',
      online: 7.9,
      weekly: 20.0,
      onlineCount: '15／191人',
      weeklyCount: '15／75人',
    },
  ],
} as const;
