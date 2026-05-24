/** イラスト地図風UI用の都道府県配置（%座標） */
export interface PrefectureMapPosition {
  prefecture: string;
  x: number;
  y: number;
}

export const prefectureMapPositions: PrefectureMapPosition[] = [
  { prefecture: '北海道', x: 68, y: 2 },
  { prefecture: '青森県', x: 74, y: 13 },
  { prefecture: '岩手県', x: 82, y: 17 },
  { prefecture: '宮城県', x: 76, y: 21 },
  { prefecture: '秋田県', x: 66, y: 17 },
  { prefecture: '山形県', x: 68, y: 24 },
  { prefecture: '福島県', x: 74, y: 28 },
  { prefecture: '茨城県', x: 76, y: 35 },
  { prefecture: '栃木県', x: 70, y: 33 },
  { prefecture: '群馬県', x: 62, y: 35 },
  { prefecture: '埼玉県', x: 68, y: 40 },
  { prefecture: '千葉県', x: 80, y: 40 },
  { prefecture: '東京都', x: 72, y: 44 },
  { prefecture: '神奈川県', x: 66, y: 48 },
  { prefecture: '新潟県', x: 58, y: 30 },
  { prefecture: '富山県', x: 48, y: 34 },
  { prefecture: '石川県', x: 42, y: 30 },
  { prefecture: '福井県', x: 44, y: 40 },
  { prefecture: '山梨県', x: 56, y: 42 },
  { prefecture: '長野県', x: 52, y: 38 },
  { prefecture: '岐阜県', x: 48, y: 46 },
  { prefecture: '静岡県', x: 56, y: 50 },
  { prefecture: '愛知県', x: 48, y: 50 },
  { prefecture: '三重県', x: 46, y: 54 },
  { prefecture: '滋賀県', x: 42, y: 48 },
  { prefecture: '京都府', x: 38, y: 50 },
  { prefecture: '大阪府', x: 40, y: 54 },
  { prefecture: '兵庫県', x: 34, y: 50 },
  { prefecture: '奈良県', x: 42, y: 56 },
  { prefecture: '和歌山県', x: 38, y: 58 },
  { prefecture: '鳥取県', x: 26, y: 46 },
  { prefecture: '島根県', x: 20, y: 40 },
  { prefecture: '岡山県', x: 30, y: 50 },
  { prefecture: '広島県', x: 24, y: 48 },
  { prefecture: '山口県', x: 20, y: 52 },
  { prefecture: '徳島県', x: 32, y: 56 },
  { prefecture: '香川県', x: 34, y: 54 },
  { prefecture: '愛媛県', x: 26, y: 56 },
  { prefecture: '高知県', x: 28, y: 60 },
  { prefecture: '福岡県', x: 16, y: 60 },
  { prefecture: '佐賀県', x: 12, y: 62 },
  { prefecture: '長崎県', x: 6, y: 64 },
  { prefecture: '熊本県', x: 14, y: 66 },
  { prefecture: '大分県', x: 22, y: 64 },
  { prefecture: '宮崎県', x: 18, y: 70 },
  { prefecture: '鹿児島県', x: 12, y: 74 },
  { prefecture: '沖縄県', x: 8, y: 88 },
];

export function getPrefectureShortName(prefecture: string): string {
  return prefecture.replace(/[都府県]$/, '');
}
