/**
 * 会社ページ（https://careeressence.jp/）用の文言・固定情報
 * 電話番号・SNS は記載しない方針。採用情報は掲載しない。
 */

export const COMPANY = {
  name: '株式会社キャリアエッセンス',
  catchphrase: '今がもっと注目される社会へ',
  /** Hero のサブキャッチ（会社名は非表示） */
  subCatchphrase: '私達は人の過去でなく今を応援することで社会の発展を支えていきます。',
  /** ヘッダー用ロゴ。public/company/logo.jpg を配置すること */
  logoPath: '/company/logo.jpg',
  /** 設立日（フッター用） */
  established: '2021年4月1日',
  /** 連絡先メール（フッター用） */
  contactEmail: 'info@careeressence.co.jp',
} as const;

export const VISION = {
  heading: 'VISION',
  main: '今がもっと注目される社会へ',
  sub: `育った環境、出身の学校、出身の会社など、良くも悪くも人は過去に囚われてしまいます。
そして、我々はつい過去をもとに表面的にその人のことを判断してしまいがちです。
それは時に人の希望を奪い、成長の機会を奪っていくことにつながります。
また、何かを得たその時から人は過去に囚われ、過去にしがみつくと、その人の成長は止まってしまいます。
誰もが過去に囚われず、今生き続ける人の現在が評価されることで社会はもっと面白くなるはず。
我々は人の過去でなく今を映し出し、今を生きる人を応援することで社会の発展を支えていくことを目指しています。`,
} as const;

export const MISSION = {
  heading: 'MISSION',
  main: '今を生きるあなたと企業をつなぐ架け橋になる',
  sub: `私たちは誰よりもあなたの今をきちんと映し出し、あなたのことを本当に必要としている企業と結ばれるように全力を尽くします。
そのために、人と企業の力を科学し、それぞれの成長に寄り添います。`,
} as const;

export const SERVICES = [
  {
    id: 'tsushin' as const,
    name: '通信制高校リアルレビュー',
    description:
      '経験者のリアルな声を集め、進路に悩む人が納得して通信制高校を選べるよう支援する口コミメディアです。',
    href: '/tsushin-kuchikomi',
    hasButton: true,
  },
  {
    id: 'dx' as const,
    name: '企業・学校向けDX推進支援',
    description:
      '業務整理・要件設計からシステム／AIの導入/活用、運用定着までを一気通貫で支援するDX推進サービスを提供しています。',
    href: null,
    hasButton: false,
  },
  {
    id: 'rpo' as const,
    name: '採用支援・RPO',
    description:
      '企業の採用活動に深く入り込み、設計・運用・改善までを担う採用支援／RPOサービスを提供しています。',
    href: null,
    hasButton: false,
  },
] as const;

export const EXECUTIVE = {
  name: '倉田 嵩之',
  title: '代表取締役',
  /** 代表写真。public/company/rep-photo.jpg を配置すること */
  photoPath: '/company/rep-photo.jpg',
  /** 代表紹介コメント（経歴・ビジョン） */
  comment: `2009年伊藤忠商事入社。M&A・リスク管理制度の企画・運営・審査業務に従事。

2014年リクルート入社。スタディサプリ進路部門で営業・営業企画に従事。

「今を生きる企業と人を応援したい」というビジョンで、2021年キャリアエッセンスを創業。`,
} as const;

export const ADDRESS = {
  postal: '〒103-0014',
  line1: '東京都中央区日本橋蛎殻町1-13-1',
  line2: 'ユニゾ蛎殻町北島ビル',
} as const;
