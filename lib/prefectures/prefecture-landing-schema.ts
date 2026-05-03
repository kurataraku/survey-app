import { getAppBaseUrl } from '@/lib/env-check';

type SchoolRow = { id: string; name: string; slug: string | null };

export function buildPrefectureFaqItems(prefecture: string): { question: string; answer: string }[] {
  return [
    {
      question: `${prefecture}で通信制高校を選ぶときのポイントは？`,
      answer: `${prefecture}内の通信制高校は、学費・サポート体制・通学やスクーリングの頻度、自分のペースで進められるかなど、優先したい条件が人によって異なります。当サイトでは口コミ件数や満足度の傾向も参考にできるので、まずは気になる学校の詳細ページで実際の声を読み比べることをおすすめします。`,
    },
    {
      question: `${prefecture}の通信制高校は何校ありますか？`,
      answer: `掲載校数は随時更新しています。このページの一覧で${prefecture}に所在する通信制高校の件数をご確認いただけます。`,
    },
    {
      question: '不登校・不登校気味でも通える学校はありますか？',
      answer:
        '通信制高校には多様な支援スタイルがあります。口コミの「雰囲気」「先生対応」「通いやすさ」などの項目や、学校ごとの紹介文・よくある質問をあわせて確認してください。',
    },
    {
      question: '学費や支援制度の情報はどこで見られますか？',
      answer:
        '各校の詳細ページでは口コミから見える学費満足度の傾向などを掲載しています。最新の学費表や就学支援金は必ず学校公式サイトでご確認ください。',
    },
  ];
}

export function buildPrefectureLandingJsonLd(params: {
  prefecture: string;
  page: number;
  pageSize: number;
  schools: SchoolRow[];
  total: number;
}): Record<string, unknown> {
  const appBase = getAppBaseUrl().replace(/\/$/, '');
  const prefEnc = encodeURIComponent(params.prefecture);
  const pageUrl =
    params.page > 1
      ? `${appBase}/schools/prefecture/${prefEnc}?page=${params.page}`
      : `${appBase}/schools/prefecture/${prefEnc}`;

  const startRank = (params.page - 1) * params.pageSize;
  const itemListElements = params.schools
    .filter((s) => s.slug)
    .map((school, index) => ({
      '@type': 'ListItem' as const,
      position: startRank + index + 1,
      name: school.name,
      url: `${appBase}/schools/${school.slug}`,
    }));

  const faqItems = buildPrefectureFaqItems(params.prefecture);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${params.prefecture}の通信制高校`,
        url: pageUrl,
        description: `${params.prefecture}の通信制高校を口コミ・評判から比較できます。`,
        isPartOf: { '@type': 'WebSite', name: '通信制高校リアルレビュー', url: appBase },
        numberOfItems: params.total,
      },
      {
        '@type': 'ItemList',
        name: `${params.prefecture}の通信制高校一覧（${params.page}ページ目）`,
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
