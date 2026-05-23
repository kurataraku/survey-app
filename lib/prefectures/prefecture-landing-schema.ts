import { getAppBaseUrl } from '@/lib/env-check';
import {
  getPrefectureLandingCollectionDescription,
  getPrefectureLandingItemListDescription,
} from '@/lib/prefectures/prefecture-landing-copy';
import { getPrefecturePath } from '@/lib/prefectures';

type SchoolRow = { id: string; name: string; slug: string | null };

export type PrefectureFaqStats = {
  totalSchools?: number;
  schoolsWithReviewsCount?: number;
  totalReviewCount?: number;
  averageOverallSatisfaction?: number | null;
};

export function buildPrefectureFaqItems(
  prefecture: string,
  stats?: PrefectureFaqStats
): { question: string; answer: string }[] {
  return [
    {
      question: `${prefecture}で通信制高校を選ぶとき、まず何を比較すればいいですか？`,
      answer: `${prefecture}の通信制高校は、キャンパスの場所、通学頻度、オンライン学習の有無、先生・職員の対応、学費、卒業までのサポート体制を比べるのがおすすめです。このページでは、口コミの良かった点・改善してほしい点と、項目別の満足度をあわせて確認できます。`,
    },
    {
      question: `${prefecture}の通信制高校は、毎日通う必要がありますか？`,
      answer:
        '学校やコースによって異なります。週5で通える学校もあれば、週1〜2日、月数回、オンライン中心で学べる学校もあります。口コミでは、実際の通学頻度やキャンパスでの過ごしやすさ、オンライン学習の進めやすさを確認してみてください。',
    },
    {
      question: '公立・私立・サポート校はどう違いますか？',
      answer:
        '公立は学費を抑えやすい一方で、自分で学習を進める力が必要になることがあります。私立は通学コースやオンライン、個別サポートなど選択肢が広い傾向があります。サポート校は、提携する通信制高校の卒業を目指しながら、学習・生活・進路面の支援を受ける施設です。',
    },
    {
      question: `${prefecture}で学費が気になる場合、どこを見ればいいですか？`,
      answer:
        '学費は授業料だけでなく、通学コース費、サポート費、教材費、スクーリング費、行事費などを含めて確認する必要があります。このページでは学費満足度の高い学校や、口コミ内の「学費の納得感」に関する声を参考にできます。最終的な金額は必ず学校公式サイトや募集要項で確認してください。',
    },
    {
      question: '口コミを見るときは、どんな点に注目すればいいですか？',
      answer:
        `総合満足度だけでなく、良かった点と改善してほしい点の両方を見るのがおすすめです。特に${prefecture}で通学を考える場合は、先生の対応、在校生の雰囲気、単位取得のしやすさ、進路サポート、学費の納得感など、自分が重視したい項目を比べてください。`,
    },
    {
      question: '不登校経験や体調面の不安がある場合、どんな学校を選ぶとよいですか？',
      answer:
        '無理なく通える頻度を選べるか、オンライン学習に対応しているか、先生や職員に相談しやすいか、体調に合わせて学習計画を調整できるかを確認すると安心です。口コミでは、先生対応・サポート体制・学校の雰囲気に関する声を重点的に見ると、自分に合う環境を判断しやすくなります。',
    },
  ];
}

export function buildPrefectureLandingJsonLd(params: {
  prefecture: string;
  page: number;
  schools: SchoolRow[];
  total: number;
  stats?: PrefectureFaqStats;
}): Record<string, unknown> {
  const appBase = getAppBaseUrl().replace(/\/$/, '');
  const pageUrl =
    params.page > 1
      ? `${appBase}${getPrefecturePath(params.prefecture)}?page=${params.page}`
      : `${appBase}${getPrefecturePath(params.prefecture)}`;

  const itemListElements = params.schools
    .filter((s) => s.slug)
    .map((school, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: school.name,
      url: `${appBase}/schools/${school.slug}`,
    }));

  const faqItems = buildPrefectureFaqItems(params.prefecture, params.stats);

  const breadcrumbItems = [
    { '@type': 'ListItem' as const, position: 1, name: 'トップ', item: `${appBase}/` },
    { '@type': 'ListItem' as const, position: 2, name: '学校一覧', item: `${appBase}/schools` },
    {
      '@type': 'ListItem' as const,
      position: 3,
      name: `${params.prefecture}の通信制高校`,
      item: pageUrl,
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
      {
        '@type': 'CollectionPage',
        name: `${params.prefecture}の通信制高校を口コミで比較`,
        url: pageUrl,
        description: getPrefectureLandingCollectionDescription(params.prefecture),
        isPartOf: { '@type': 'WebSite', name: '通信制高校リアルレビュー', url: appBase },
        numberOfItems: params.total,
      },
      {
        '@type': 'ItemList',
        name: `${params.prefecture}の通信制高校一覧（口コミ比較・${params.page}ページ目）`,
        description: getPrefectureLandingItemListDescription(params.prefecture),
        numberOfItems: itemListElements.length,
        itemListElement: itemListElements,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };
}
