import { appPath } from '@/lib/base-path';

export type ThemeHubId =
  | 'tuition'
  | 'public'
  | 'schooling'
  | 'transfer'
  | 'demerit'
  | 'enrollment';

export type ThemeHub = {
  id: ThemeHubId;
  title: string;
  description: string;
  keywords: string[];
  primarySlug: string;
  relatedSlugs?: string[];
};

/** テーマ別ハブ記事の定義（DB上の公開記事slugと対応） */
export const THEME_HUBS: ThemeHub[] = [
  {
    id: 'tuition',
    title: '学費・費用',
    description:
      '公立と私立の学費の目安、就学支援金や無償化の考え方、口コミで分かった学費満足度までをまとめています。',
    keywords: ['通信制高校 学費', '学費 安い', '就学支援金'],
    primarySlug: 'tsushinsei-cost',
    relatedSlugs: [
      'tsushinsei-koukou-gakuhi-mushouka',
      'shiritsu-tsushinsei-koukou-shugaku-shienkin',
      'tsushinsei-koukou-kouritsu-gakuhi',
    ],
  },
  {
    id: 'public',
    title: '公立通信制高校',
    description:
      '公立と私立の違い、入学の流れ、お住まいの地域で選べる学校の探し方を整理しています。',
    keywords: ['公立通信制高校', '通信制高校 公立 学費'],
    primarySlug: 'tsushinsei-type-comparison',
    relatedSlugs: ['tsushinsei-koukou-kouritsu-gakuhi'],
  },
  {
    id: 'schooling',
    title: 'スクーリング・通学頻度',
    description:
      '週何日通うか、宿泊の有無、オンライン中心かなど、通学の負担感を口コミとあわせて確認できます。',
    keywords: ['通信制高校 スクーリング', '通学頻度'],
    primarySlug: 'tsushinsei-schooling-location',
    relatedSlugs: [
      'tsushinsei-highschool-taiiku-schooling',
      'tsushinsei-koukou-taiiku-tanni-schooling',
      'tsushinsei-highschool-class-style',
    ],
  },
  {
    id: 'transfer',
    title: '転入・編入',
    description:
      '転入・編入のタイミング、単位の引き継ぎ、事前に確認しておきたいポイントを解説しています。',
    keywords: ['通信制高校 転入', '通信制高校 編入'],
    primarySlug: 'tsushinsei-transfer',
    relatedSlugs: ['tsushinsei-koukou-tennyu-koukai', 'tsushin-nyugaku-guide'],
  },
  {
    id: 'demerit',
    title: 'デメリット・不安',
    description:
      '後悔や不安の声を口コミベースで整理。煽らずに、比較検討の材料として読める内容です。',
    keywords: ['通信制高校 デメリット', '通信制高校 後悔'],
    primarySlug: 'tsushinsei-koukou-demerit',
    relatedSlugs: ['school-refusal-correspondence-tsushinsei-highschool-reality'],
  },
  {
    id: 'enrollment',
    title: '入学時期・説明会',
    description:
      'いつから入学できるか、説明会の選び方、地域別の最新スケジュールを確認できます。',
    keywords: ['通信制高校 説明会', '通信制高校 入学'],
    primarySlug: 'tsushin-nyugaku-guide',
    relatedSlugs: [
      'kanto-tsushin-setsumeikai-2026-schedule',
      'kansai-tsushin-setsumeikai-2026-schedule',
      'fukuoka-tsushin-setsumeikai-2026-schedule',
    ],
  },
];

export function getThemeHubById(id: ThemeHubId): ThemeHub | undefined {
  return THEME_HUBS.find((hub) => hub.id === id);
}

export function getThemeHubArticlePath(slug: string): string {
  return appPath(`/features/${encodeURIComponent(slug)}`);
}

export function getThemeHubsPagePath(): string {
  return appPath('/features/topics');
}

/** テーマハブで参照する全記事 slug */
export function getAllThemeHubSlugs(): string[] {
  const slugs = new Set<string>();
  for (const hub of THEME_HUBS) {
    slugs.add(hub.primarySlug);
    for (const related of hub.relatedSlugs ?? []) {
      slugs.add(related);
    }
  }
  return [...slugs];
}
