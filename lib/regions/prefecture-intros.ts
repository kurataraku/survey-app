import { getRegionSlugForPrefecture } from '@/lib/regions/prefecture-url-slugs';
import type { RegionSlug } from '@/lib/regions/types';

/** 東京・大阪・神奈川・埼玉・千葉・愛知・福岡・兵庫・京都は文面を差し替え。キーは `regionSlug`。 */
const INTRO_LEADS: Partial<Record<RegionSlug, string>> = {
  tokyo:
    '東京都の通信制高校を、総合満足度だけでなく、学びの柔軟さ、先生・職員の対応、サポート体制、在校生の雰囲気、単位取得、進路サポート、学費などの項目別評価から比較できます。気になる学校は、良かった点と改善してほしい点のコメントもあわせて確認してみてください。',
  osaka:
    '大阪府の通信制高校は、通学やオンラインの組み合わせ方も含めて選択肢が広がっています。口コミ件数の多い学校と、満足度の平均が高い学校をまとめて確認できます。',
  kanagawa:
    '神奈川県は東京都内キャンパスに通う選択肢も含め、通信制高校の通い方を考える家庭が多いエリアです。口コミが蓄積されている学校と、評価の高い学校から比較のヒントを得られます。',
  saitama:
    '埼玉県は首都圏への通学や、県内キャンパスでのスクーリングなど、通い方の選択肢が学校ごとに異なります。口コミの通学頻度と学費満足度をあわせて比較してください。',
  chiba:
    '千葉県の通信制高校は、オンライン中心から週数回通学まで幅があります。口コミが多い学校と、サポート評価の高い学校から検討の起点をつかめます。',
  aichi:
    '愛知県（名古屋圏）の通信制高校は、進路サポートや通学頻度の違いが学校選びのポイントになりやすいエリアです。口コミと項目別評価から比較できます。',
  fukuoka:
    '福岡県の通信制高校は、九州エリアから通う家庭も含め、キャンパスの立地や通い方が学校ごとに異なります。口コミの良い点・気になる点をあわせて確認してください。',
  hyogo:
    '兵庫県（阪神間）の通信制高校は、通学距離やスクーリングの頻度が選校の重要ポイントになります。口コミ件数の多い学校から評判の傾向を把握できます。',
  kyoto:
    '京都府の通信制高校は、通学形態やサポート体制が学校ごとに大きく異なります。口コミ・評判ページから、良かった点と注意点の両面を確認してください。',
};

export function defaultPrefectureIntroLead(prefectureLabel: string): string {
  return `${prefectureLabel}の通信制高校を、口コミの多さと評判の観点から探せます。気になる学校は詳細ページで口コミ一覧もご確認ください。`;
}

export function getPrefectureIntroLead(prefectureLabel: string): string {
  const slug = getRegionSlugForPrefecture(prefectureLabel);
  return INTRO_LEADS[slug] ?? defaultPrefectureIntroLead(prefectureLabel);
}

/** 導入文を実データから組み立てるための材料 */
export type PrefectureIntroStats = {
  totalSchools: number;
  publicCount: number;
  privateCount: number;
  supportCount: number;
  localCampusLocationCount: number;
  cityCount: number;
  topCities: Array<{ city: string; schoolCount: number }>;
  topStations: Array<{ name: string; schoolCount: number }>;
  localReviewCount: number;
  localReviewSchoolCount: number;
  topAttendance: { label: string; count: number } | null;
  topEnrollment: { label: string; count: number } | null;
  tuitionConfirmed: number;
};

/**
 * 都道府県固有の導入文を実データから生成する。
 *
 * 47県で同じ汎用文を並べると、県名だけを差し替えたページに見える。
 * キャンパス分布、学校種別、最寄り駅、地域口コミの傾向、学費の確認状況という
 * 県ごとに必ず異なる実数だけで構成し、手書き文面の使い回しをやめる。
 */
export function buildPrefectureIntroLead(
  prefectureLabel: string,
  stats?: PrefectureIntroStats
): string {
  if (!stats || stats.totalSchools === 0) {
    return getPrefectureIntroLead(prefectureLabel);
  }

  const sentences: string[] = [];

  const cityPart = stats.topCities
    .slice(0, 3)
    .map((city) => `${city.city}${city.schoolCount}校`)
    .join('、');
  sentences.push(
    stats.cityCount > 0
      ? `${prefectureLabel}で比較できる通信制高校・サポート校は${stats.totalSchools}校あり、${prefectureLabel}内${stats.cityCount}市区町村の${stats.localCampusLocationCount}拠点に分かれています。掲載校が多いのは${cityPart}です。`
      : `${prefectureLabel}で比較できる通信制高校・サポート校は${stats.totalSchools}校です。`
  );

  if (stats.topStations.length > 0) {
    const stationPart = stats.topStations
      .slice(0, 2)
      .map((station) => `${station.name}から${station.schoolCount}校`)
      .join('、');
    sentences.push(
      `通学のしやすさから絞り込む場合は最寄り駅が目安になり、${stationPart}を比較できます。`
    );
  }

  sentences.push(
    `公立${stats.publicCount}校は学費を抑えやすい一方でレポートやスクーリングの管理を自分で進める場面が多く、私立${stats.privateCount}校は通学コースとサポート体制の幅が学校ごとに大きく異なります。サポート校${stats.supportCount}校は単独では高校卒業資格にならないため、提携する通信制高校の学費と合わせて確認が必要です。`
  );

  if (stats.localReviewCount > 0) {
    const parts: string[] = [];
    if (stats.topAttendance) {
      parts.push(`通学頻度は「${stats.topAttendance.label}」が最も多く${stats.topAttendance.count}件`);
    }
    if (stats.topEnrollment) {
      parts.push(
        `入学タイミングは「${stats.topEnrollment.label}」が最も多く${stats.topEnrollment.count}件`
      );
    }
    sentences.push(
      parts.length > 0
        ? `${prefectureLabel}のキャンパスに通ったと回答した口コミは${stats.localReviewCount}件（${stats.localReviewSchoolCount}校）で、${parts.join('、')}でした。`
        : `${prefectureLabel}のキャンパスに通ったと回答した口コミは${stats.localReviewCount}件（${stats.localReviewSchoolCount}校）です。`
    );
  } else {
    sentences.push(
      `${prefectureLabel}のキャンパスを回答した口コミはまだないため、学校全体の口コミと項目別評価を比較の起点にしてください。`
    );
  }

  sentences.push(
    `学費は${stats.tuitionConfirmed}校で公開情報から確認できており、残りはコースや通学頻度で金額が変わるため各校の募集要項での確認が必要です。良かった点と改善してほしい点の両面を同じ回答で見比べると、費用と通いやすさのどちらを優先するか判断しやすくなります。`
  );

  return sentences.join('');
}
