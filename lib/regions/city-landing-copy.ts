import { getAppBaseUrl } from '@/lib/env-check';
import { getPrefecturePath } from '@/lib/prefectures';
import { getCityLandingPath } from '@/lib/regions/city-landing';
import { UNSPECIFIED_WARD_LABEL, type CityLandingData } from '@/lib/schools/getCityLandingData';

export function getCityLandingTitle(municipality: string): string {
  return `${municipality}の通信制高校一覧｜区・駅から口コミ・学費・通いやすさを比較`;
}

export function getCityLandingHeading(municipality: string): string {
  return `${municipality}の通信制高校・サポート校一覧`;
}

function topWardNames(data: CityLandingData, limit: number): string[] {
  return data.wards
    .filter((ward) => ward.name !== UNSPECIFIED_WARD_LABEL)
    .slice(0, limit)
    .map((ward) => ward.name);
}

/** 口コミの表現。市の回答がない段階で県の回答を市の口コミと書かない */
function reviewPhrase(data: CityLandingData): string {
  if (data.cityReviewCount > 0) {
    return `${data.municipality}のキャンパスに通った回答${data.cityReviewCount}件`;
  }
  if (data.prefectureReviewCount > 0) {
    return `${data.prefecture}内のキャンパスに通った回答${data.prefectureReviewCount}件`;
  }
  return '';
}

export function getCityLandingSubtitle(data: CityLandingData): string {
  const wards = topWardNames(data, 3);
  const stations = data.topStations.slice(0, 2).map((station) => station.name);
  const wardPart = wards.length > 0 ? `拠点が多いのは${wards.join('・')}で、` : '';
  const stationPart = stations.length > 0 ? `${stations.join('・')}など最寄り駅からも確認できます。` : '';
  const review = reviewPhrase(data);
  return `${data.municipality}内に通学できる拠点がある通信制高校・サポート校${data.counts.totalSchools}校（市内${data.counts.campusLocationCount}拠点）を比較できます。${wardPart}${data.counts.wardCount}区に分布しています。${stationPart}${review ? `${review}と学校全体の口コミを分けて表示しています。` : ''}`;
}

export function getCityLandingMetaDescription(data: CityLandingData): string {
  const wards = topWardNames(data, 3);
  const review = reviewPhrase(data);
  return `${data.municipality}に通学拠点がある通信制高校・サポート校${data.counts.totalSchools}校を比較。市内${data.counts.campusLocationCount}拠点を${wards.length > 0 ? `${wards.join('・')}など` : ''}区・最寄り駅別に整理し、${review ? `${review}、` : ''}学費の確認状態、公立・私立・サポート校の区分を同じ表で確認できます。`;
}

export function buildCityLandingIntro(data: CityLandingData): string {
  const { municipality, prefecture, counts } = data;
  const wards = topWardNames(data, 4);
  const topStation = data.topStations[0];
  const parts: string[] = [
    `${municipality}で通信制高校を探す場合、まず確認したいのは「市内に通える拠点があるか」と「自宅から通いやすい区・駅か」です。`,
    `このページでは、${municipality}内に常設のキャンパス・学習センターが登録されている${counts.totalSchools}校を掲載しています（試験会場や説明会だけの会場は含めていません）。`,
  ];
  if (wards.length > 0) {
    parts.push(`拠点は${wards.join('・')}に多く、`);
  }
  if (topStation) {
    parts.push(`最寄り駅では${topStation.name}周辺に${topStation.schoolCount}校が集まっています。`);
  }
  parts.push(
    `本校が他県にある広域通信制高校でも、${municipality}のキャンパスに通って学べる場合があります。ただし必須スクーリングの会場や出願できる地域は学校ごとに異なるため、学校詳細と募集要項で確認してください。`
  );
  if (data.cityReviewCount === 0 && data.prefectureReviewCount > 0) {
    parts.push(
      `口コミは回答時に申告されたキャンパス所在地で集計しています。${municipality}まで申告された回答はまだないため、${prefecture}内キャンパスの回答（${data.prefectureReviewCount}件）と学校全体の口コミを区別して表示しています。`
    );
  }
  if (counts.tuitionConfirmed > 0) {
    parts.push(`学費は公開情報で確認できた${counts.tuitionConfirmed}校のみ状態を表示しています。`);
  }
  return parts.join('');
}

export function buildCityFaqItems(data: CityLandingData): { question: string; answer: string }[] {
  const { municipality, prefecture, counts } = data;
  const wards = topWardNames(data, 3);
  return [
    {
      question: `${municipality}に通信制高校のキャンパスはいくつありますか？`,
      answer: `当サイトの登録では、${municipality}内に常設の拠点がある学校は${counts.totalSchools}校、拠点数は${counts.campusLocationCount}か所です${wards.length > 0 ? `（多い区: ${wards.join('・')}）` : ''}。試験会場や説明会だけの会場は含めていません。最新の所在地は各学校の公式サイトで確認してください。`,
    },
    {
      question: `${municipality}に住んでいれば、どの通信制高校にも出願できますか？`,
      answer: `学校によって異なります。全国から出願できる広域通信制高校もあれば、${prefecture}など特定の都道府県に住んでいる・勤めている人だけが対象の学校（公立など）もあります。また、キャンパスに通えても必須スクーリングは本校など別の場所で行う学校があります。最終的な出願資格とスクーリング会場は、必ず各学校の募集要項で確認してください。`,
    },
    {
      question: `${municipality}の通信制高校の口コミは、どのように集計していますか？`,
      answer: `口コミは当サイトのアンケートで回答者が申告した「主に通っていたキャンパス」の所在地で分けています。${municipality}まで申告された回答だけを${municipality}の口コミとして数え、${prefecture}内のキャンパスの回答や、他県を含む学校全体の口コミとは別に表示しています。`,
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
