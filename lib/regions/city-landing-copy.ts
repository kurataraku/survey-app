import { getAppBaseUrl } from '@/lib/env-check';
import { getPrefecturePath } from '@/lib/prefectures';
import { getCityLandingPath } from '@/lib/regions/city-landing';
import type { CityLandingData } from '@/lib/schools/getCityLandingData';

export function getCityLandingTitle(municipality: string): string {
  return `${municipality}の通信制高校一覧｜区・駅から口コミ・学費・通いやすさを比較`;
}

export function getCityLandingHeading(municipality: string): string {
  return `${municipality}の通信制高校・サポート校一覧`;
}

function topWardNames(data: CityLandingData, limit: number): string[] {
  return data.wards.slice(0, limit).map((ward) => ward.name);
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
  const stations = topStationNames(data, 3);
  const wards = topWardNames(data, 3);
  const review = reviewPhrase(data);
  const stationPart = stations.length > 0 ? `${stations.join('・')}など駅から通える学校を探せます。` : '';
  const wardPart = wards.length > 0 ? `キャンパスが多いのは${wards.join('・')}です。` : '';
  return `${data.municipality}に通えるキャンパスがある通信制高校・サポート校${data.counts.totalSchools}校を比較できます。${stationPart}${wardPart}${review ? `${review}も読めます。` : ''}`;
}

export function getCityLandingMetaDescription(data: CityLandingData): string {
  const stations = topStationNames(data, 3);
  const review = reviewPhrase(data);
  return `${data.municipality}に通えるキャンパスがある通信制高校・サポート校${data.counts.totalSchools}校を比較。${stations.length > 0 ? `${stations.join('・')}など` : ''}最寄り駅・区から探せます。${review ? `${review}、` : ''}初年度納入金の目安、公立・私立・サポート校の違いも同じ表で確認できます。`;
}

export function buildCityLandingIntro(data: CityLandingData): string {
  const { municipality, counts } = data;
  const wards = topWardNames(data, 4);
  const topStation = data.topStations[0];
  const parts: string[] = [
    `${municipality}で通信制高校を探すなら、まずは「自宅や通学経路の駅から通えるキャンパスがあるか」を確認するのがおすすめです。`,
    `このページでは、${municipality}内に通えるキャンパス・学習センターがある${counts.totalSchools}校を掲載しています。`,
  ];
  if (topStation) {
    parts.push(`${topStation.name}周辺だけでも${topStation.schoolCount}校があり、`);
  }
  if (wards.length > 0) {
    parts.push(`区では${wards.join('・')}にキャンパスが集まっています。`);
  }
  parts.push(
    `本校が他県にある広域通信制高校でも、${municipality}のキャンパスに通って学べる学校があります。一方で、年に数日のスクーリング（登校授業）は本校など別の場所で行う学校もあるため、気になる学校は学校詳細と募集要項で確認してください。`
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
  const itemListElements = data.itemListSchools
    .filter((school) => school.slug)
    .map((school, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: school.name,
      url: `${appBase}/schools/${school.slug}`,
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
        name: getCityLandingTitle(data.municipality),
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
