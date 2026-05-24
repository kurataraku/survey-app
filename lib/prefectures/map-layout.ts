/** イラスト地図風UI用の都道府県グループ */
export interface PrefectureMapGroup {
  label: string;
  prefectures: string[];
  className: string;
}

export const prefectureMapGroups: PrefectureMapGroup[] = [
  {
    label: '北海道',
    prefectures: ['北海道'],
    className: 'lg:col-start-5 lg:col-span-2 bg-orange-50 border-orange-200',
  },
  {
    label: '東北',
    prefectures: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
    className: 'lg:col-start-5 lg:col-span-2 bg-yellow-50 border-yellow-200',
  },
  {
    label: '関東',
    prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
    className: 'lg:col-start-5 lg:col-span-2 bg-green-50 border-green-200',
  },
  {
    label: '中部',
    prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
    className: 'lg:col-start-3 lg:col-span-2 lg:row-start-2 bg-sky-50 border-sky-200',
  },
  {
    label: '近畿',
    prefectures: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
    className: 'lg:col-start-3 lg:col-span-2 lg:row-start-3 bg-purple-50 border-purple-200',
  },
  {
    label: '中国',
    prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
    className: 'lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-pink-50 border-pink-200',
  },
  {
    label: '四国',
    prefectures: ['徳島県', '香川県', '愛媛県', '高知県'],
    className: 'lg:col-start-1 lg:col-span-2 lg:row-start-3 bg-indigo-50 border-indigo-200',
  },
  {
    label: '九州・沖縄',
    prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
    className: 'lg:col-start-1 lg:col-span-2 lg:row-start-4 bg-red-50 border-red-200',
  },
];

export function getPrefectureShortName(prefecture: string): string {
  return prefecture.replace(/[都府県]$/, '');
}
