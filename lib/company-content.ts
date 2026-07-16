/**
 * 会社ページ（https://careeressence.jp/）用の文言・固定情報
 * 電話番号・SNS は記載しない方針。採用情報は掲載しない。
 */

export const COMPANY = {
  name: '株式会社キャリアエッセンス',
  catchphrase: '過去ではなく、今の挑戦が未来をつくる社会へ',
  /** Hero のサブキャッチ（会社名は非表示） */
  subCatchphrase: '私たちは、過去にとらわれず、今を生きる人と会社に寄り添います。',
  /** ヘッダー用ロゴ。public/company/logo.jpg を配置すること */
  logoPath: '/company/logo.jpg',
  /** 設立日（フッター用） */
  established: '2021年4月1日',
  /** 連絡先メール（フッター用） */
  contactEmail: 'info@careeressence.co.jp',
} as const;

export const VISION = {
  heading: 'VISION',
  main: '過去ではなく、今の挑戦が未来をつくる社会へ',
  sub: `どんな学校を出たか、どんな会社にいたか、どれだけ大きな組織か。そうした過去のラベルだけで、人や会社の可能性は測れません。

大切なのは、今どんな思いを持ち、どんな一歩を踏み出そうとしているかです。

私たちは、過去にとらわれず、今を生きる人と会社に寄り添います。

一人ひとり、一社一社の現在の挑戦が、より多くの選択肢や機会につながる社会をつくります。`,
} as const;

export const MISSION = {
  heading: 'MISSION',
  main: '今を生きる人と会社に、前へ進む力を届ける',
  sub: `過去にとらわれず、今を生きる人と会社に寄り添い、前へ進む力を届けます。

一人ひとり、一社一社の現在の挑戦が、より多くの選択肢や機会につながるよう支援します。`,
} as const;

export const FEATURED_SERVICE = {
  id: 'tsushin' as const,
  name: '通信制高校リアルレビュー',
  description:
    '通信制高校の卒業生・在校生・保護者のリアルな口コミを集めた口コミメディアです。学校の雰囲気やサポート、学費の実感など、公式情報だけでは見えにくい実態を伝え、進路に悩む方や保護者が納得して学校を選べるよう支援しています。',
  href: '/tsushin-kuchikomi',
  hasButton: true,
  /** サービスロゴ（public/logo-service.png） */
  logoPath: '/logo-service.png',
} as const;

export const OTHER_SERVICES = [
  {
    id: 'dx' as const,
    name: 'シクミット',
    description:
      '初期費用0円・月額10万円から、手作業や属人化した業務を御社専用のWebシステムへ変える月額制サービスです。業務整理から開発、AI機能の活用、導入後の定着・保守まで伴走し、作って終わりではなく現場で使われる仕組みづくりを支援します。',
    href: 'https://shikumit.careeressence.jp/',
    hasButton: true,
    /** サービスロゴ（public/company/shikumit-logo.png） */
    logoPath: '/company/shikumit-logo.png',
  },
  {
    id: 'rpo' as const,
    name: '採用支援・RPO',
    description:
      '新卒採用・中途採用の両方に対応し、採用戦略の立案から実行まで一気通貫で伴走する採用支援サービスです。母集団形成、候補者対応、選考進捗の管理、改善提案まで現場の状況に合わせて運用を整え、必要な人材と出会う仕組みづくりを支援します。',
    href: null,
    hasButton: false,
    /** 採用支援・RPOイメージ（public/company/rpo-support.svg） */
    logoPath: '/company/rpo-support.svg',
  },
] as const;

/** 全サービス一覧（順序: 主力 → その他） */
export const SERVICES = [FEATURED_SERVICE, ...OTHER_SERVICES] as const;

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
