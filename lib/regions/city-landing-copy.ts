import { getAppBaseUrl } from '@/lib/env-check';
import { getPrefecturePath } from '@/lib/prefectures';
import { getCityLandingPath } from '@/lib/regions/city-landing';
import type { CityLandingData } from '@/lib/schools/getCityLandingData';

export function getCityLandingTitle(municipality: string, hasWards = true): string {
  return `${municipality}の通信制高校一覧｜${hasWards ? '区・駅' : '駅'}から口コミ・学費・通いやすさを比較`;
}

export function getCityLandingHeading(municipality: string): string {
  return `${municipality}の通信制高校・サポート校一覧`;
}

function topStationNames(data: CityLandingData, limit: number): string[] {
  return data.topStations.slice(0, limit).map((station) => station.name);
}

/** 口コミの表現。市の回答がない段階で県の回答を市の口コミと書かない */
function reviewPhrase(data: CityLandingData): string {
  if (data.cityReviewCount > 0) {
    return `${data.municipality}のキャンパスに通った人の口コミ${data.cityReviewCount}件`;
  }
  if (data.prefectureReviewCount > 0) {
    return `${data.prefecture}内のキャンパスに通った人の口コミ${data.prefectureReviewCount}件`;
  }
  return '';
}

export function getCityLandingSubtitle(data: CityLandingData): string {
  const review = reviewPhrase(data);
  return `${data.municipality}に通えるキャンパスがある通信制高校・サポート校${data.counts.totalSchools}校を掲載しています。最寄り駅や学費と、${review || `${data.prefecture}内の口コミ`}から、通えそうな学校を比べられます。`;
}

export function getCityLandingMetaDescription(data: CityLandingData): string {
  const stations = topStationNames(data, 3);
  const review = reviewPhrase(data);
  return `${data.municipality}に通えるキャンパスがある通信制高校・サポート校${data.counts.totalSchools}校を掲載。${stations.length > 0 ? `${stations.join('・')}などの` : ''}最寄り駅、通学頻度・転入などの口コミ、初年度納入金の目安から比較できます。${review ? `${review}を掲載しています。` : ''}`;
}

export function buildCityLandingIntro(data: CityLandingData): string {
  const { municipality, counts } = data;
  const parts: string[] = [
    `${municipality}で学校を比べるときは、通える場所にキャンパスがあるかに加えて、毎日通わない学び方や転入の経験がある人の声も参考になります。`,
    `このページでは、${municipality}内に通えるキャンパス・学習センターがある${counts.totalSchools}校を、場所と実際の口コミから探せます。`,
  ];
  parts.push(
    `口コミにある通学頻度は回答者の経験で、現在のコースや制度を保証するものではありません。気になる学校は、学校詳細と最新の募集要項も確認してください。`
  );
  if (data.prefectureReviewCount > 0) {
    parts.push(
      `下の口コミは、実際に${data.prefecture}内のキャンパスに通った人の声です。通学頻度や先生の対応、雰囲気など、パンフレットでは分かりにくい点の参考にしてください。`
    );
  }
  return parts.join('');
}

export function buildCityFaqItems(data: CityLandingData): { question: string; answer: string }[] {
  const { municipality, prefecture, counts } = data;
  const stations = topStationNames(data, 3);
  return [
    {
      question: '毎日通えなくても卒業を目指せますか？',
      answer: `通信制高校には、週1〜2日、月に数回、オンライン中心などさまざまな通い方があります。ただし、必要な登校日数やスクーリング会場は学校・コースによって異なります。このページの通学頻度は${prefecture}内で通った人の回答なので、候補を見つける参考にし、現在の制度は学校へ確認してください。`,
    },
    {
      question: '高校の途中から転入できますか？',
      answer: `転入学を受け付ける時期や、引き継げる単位は学校によって異なります。このページでは転入した人の口コミがある学校を絞れますが、出願時期・必要書類・単位の扱いは各学校へ確認してください。`,
    },
    {
      question: `${municipality}に通信制高校のキャンパスはいくつありますか？`,
      answer: `このページでは、${municipality}内に通えるキャンパス・学習センターがある${counts.totalSchools}校（${counts.campusLocationCount}か所）を掲載しています${stations.length > 0 ? `。${stations.join('・')}周辺に多く集まっています` : ''}。最新の所在地や開校状況は各学校の公式サイトで確認してください。`,
    },
    {
      question: `${municipality}に住んでいれば、どの通信制高校にも出願できますか？`,
      answer: `学校によって異なります。全国から出願できる広域通信制高校もあれば、${prefecture}に住んでいる・勤めている人だけが対象の学校（公立など）もあります。また、キャンパスに通えても、スクーリングは本校など別の場所で行う学校があります。出願資格とスクーリングの場所は、必ず各学校の募集要項で確認してください。`,
    },
    {
      question: `${municipality}の通信制高校の学費はどれくらいですか？`,
      answer: `学校やコース、通学頻度によって大きく変わります。比較表では、学校が公開している初年度納入金の目安を載せています。国の就学支援金が適用されると実際の負担は下がることが多いため、支援金の適用前か適用後かもあわせて確認してください。金額の記載がない学校は、学校の資料請求や個別相談で確認できます。`,
    },
    {
      question: `${municipality}の通信制高校の口コミは、どのような人の声ですか？`,
      answer: `当サイトのアンケートに回答した在校生・卒業生・保護者の声です。「主に通っていたキャンパス」が${prefecture}内だった口コミを掲載しており、${municipality}のキャンパスだと回答した口コミにはその旨を表示しています。`,
    },
  ];
}

export function buildCityLandingJsonLd(data: CityLandingData): Record<string, unknown> {
  const appBase = getAppBaseUrl().replace(/\/$/, '');
  const pageUrl = `${appBase}${getCityLandingPath(data.config)}`;
  const itemListElements = data.itemListSchools.map((school, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: school.name,
      ...(school.slug ? { url: `${appBase}/schools/${school.slug}` } : {}),
    }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'トップ', item: `${appBase}/` },
          { '@type': 'ListItem', position: 2, name: '学校一覧', item: `${appBase}/schools` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${data.prefecture}の通信制高校`,
            item: `${appBase}${getPrefecturePath(data.prefecture)}`,
          },
          { '@type': 'ListItem', position: 4, name: `${data.municipality}の通信制高校`, item: pageUrl },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: getCityLandingTitle(data.municipality, data.wards.length > 0),
        url: pageUrl,
        description: getCityLandingMetaDescription(data),
        isPartOf: { '@type': 'WebSite', name: '通信制高校リアルレビュー', url: appBase },
        about: { '@type': 'City', name: data.municipality, containedInPlace: { '@type': 'State', name: data.prefecture } },
        numberOfItems: data.counts.totalSchools,
      },
      {
        '@type': 'ItemList',
        name: `${data.municipality}の通信制高校一覧（口コミ比較）`,
        numberOfItems: itemListElements.length,
        itemListElement: itemListElements,
      },
      {
        '@type': 'FAQPage',
        mainEntity: buildCityFaqItems(data).map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };
}
