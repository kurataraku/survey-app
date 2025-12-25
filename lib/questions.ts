export type QuestionType = 'text' | 'singleSelect' | 'multiSelect' | 'radio' | 'textarea' | 'email';

export interface QuestionOption {
  label: string;
  value: string;
  showOtherInput?: boolean; // 「その他」選択時に追加入力欄を表示
}

export interface Question {
  id: string;
  number: number;
  step: 1 | 2 | 3;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: QuestionOption[];
  placeholder?: string;
  conditional?: {
    field: string; // 条件となるフィールド名
    value: string | string[]; // 条件値
  };
  minLength?: number; // 動的に設定される場合もある
  maxLength?: number;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export const questions: Question[] = [
  // Step1: 基本情報
  {
    id: 'school_name',
    number: 1,
    step: 1,
    type: 'text',
    label: 'どの通信制高校についての口コミですか？',
    required: true,
    placeholder: '学校名を入力してください',
  },
  {
    id: 'respondent_role',
    number: 2,
    step: 1,
    type: 'singleSelect',
    label: 'あなたの立場を教えてください。',
    required: true,
    options: [
      { label: '本人', value: '本人' },
      { label: '保護者', value: '保護者' },
    ],
  },
  {
    id: 'status',
    number: 3,
    step: 1,
    type: 'singleSelect',
    label: '現在の状況',
    required: true,
    options: [
      { label: '在籍中', value: '在籍中' },
      { label: '卒業した', value: '卒業した' },
      { label: '以前在籍していた（転校・退学など）', value: '以前在籍していた（転校・退学など）' },
    ],
  },
  {
    id: 'graduation_path',
    number: 4,
    step: 1,
    type: 'singleSelect',
    label: '卒業後の進路',
    required: true,
    conditional: {
      field: 'status',
      value: '卒業した',
    },
    options: [
      { label: '大学進学', value: '大学進学' },
      { label: '専門学校進学', value: '専門学校進学' },
      { label: '短期大学進学', value: '短期大学進学' },
      { label: '就職（正社員・契約社員・アルバイト問わず）', value: '就職' },
      { label: '休養（体調の回復・家庭の事情など）', value: '休養' },
      { label: 'その他', value: 'その他', showOtherInput: true },
    ],
  },
  {
    id: 'graduation_path_other',
    number: 4.1,
    step: 1,
    type: 'text',
    label: 'その他（卒業後の進路）',
    required: true,
    conditional: {
      field: 'graduation_path',
      value: 'その他',
    },
  },
  {
    id: 'reason_for_choosing',
    number: 5,
    step: 1,
    type: 'multiSelect',
    label: '全日制や定時制ではなく「通信制」を選んだ理由',
    required: true,
    options: [
      { label: '心の不調のため', value: '心の不調のため' },
      { label: '先生・友人などの人間関係に悩んだため', value: '先生・友人などの人間関係に悩んだため' },
      { label: '全日制の学習スタイルが合わないため', value: '全日制の学習スタイルが合わないため' },
      { label: '心や体の状態／発達障害・知的障害などのため', value: '心や体の状態／発達障害・知的障害などのため' },
      { label: '働きながら学びたいため', value: '働きながら学びたいため' },
      { label: 'スポーツ/芸術/芸能活動との両立のため', value: 'スポーツ/芸術/芸能活動との両立のため' },
      { label: '学費をおさえるため', value: '学費をおさえるため' },
      { label: '学びなおしのため', value: '学びなおしのため' },
      { label: 'その他', value: 'その他' },
    ],
  },
  {
    id: 'course',
    number: 6,
    step: 1,
    type: 'text',
    label: '在籍していたコースを教えてください',
    required: false,
    placeholder: '例：普通科、進学コース、特進コースなど',
  },
  {
    id: 'enrollment_type',
    number: 7,
    step: 1,
    type: 'singleSelect',
    label: '入学タイミング',
    required: true,
    options: [
      { label: '新入学（中学卒業後）', value: '新入学（中学卒業後）' },
      { label: '転入学（他校から転校）', value: '転入学（他校から転校）' },
      { label: '編入学（中退後に入り直し）', value: '編入学（中退後に入り直し）' },
    ],
  },
  {
    id: 'enrollment_year',
    number: 8,
    step: 1,
    type: 'singleSelect',
    label: '入学年',
    required: true,
    options: (() => {
      const currentYear = new Date().getFullYear();
      const years = [];
      // 過去15年から未来5年まで
      for (let i = currentYear - 15; i <= currentYear + 5; i++) {
        years.push({ label: `${i}年`, value: `${i}` });
      }
      return years.reverse(); // 新しい年から順に表示
    })(),
  },

  // Step2: 学習/環境
  {
    id: 'attendance_frequency',
    number: 9,
    step: 2,
    type: 'singleSelect',
    label: '主な通学頻度',
    required: true,
    options: [
      { label: '週5', value: '週5' },
      { label: '週3〜4', value: '週3〜4' },
      { label: '週1〜2', value: '週1〜2' },
      { label: '月1～月数回', value: '月1〜数回' },
      { label: 'ほぼオンライン/自宅', value: 'ほぼオンライン/自宅' },
    ],
  },
  {
    id: 'campus_prefecture',
    number: 10,
    step: 2,
    type: 'singleSelect',
    label: '主に通っていたキャンパス都道府県',
    required: true,
    options: [
      { label: '北海道', value: '北海道' },
      { label: '青森県', value: '青森県' },
      { label: '岩手県', value: '岩手県' },
      { label: '宮城県', value: '宮城県' },
      { label: '秋田県', value: '秋田県' },
      { label: '山形県', value: '山形県' },
      { label: '福島県', value: '福島県' },
      { label: '茨城県', value: '茨城県' },
      { label: '栃木県', value: '栃木県' },
      { label: '群馬県', value: '群馬県' },
      { label: '埼玉県', value: '埼玉県' },
      { label: '千葉県', value: '千葉県' },
      { label: '東京都', value: '東京都' },
      { label: '神奈川県', value: '神奈川県' },
      { label: '新潟県', value: '新潟県' },
      { label: '富山県', value: '富山県' },
      { label: '石川県', value: '石川県' },
      { label: '福井県', value: '福井県' },
      { label: '山梨県', value: '山梨県' },
      { label: '長野県', value: '長野県' },
      { label: '岐阜県', value: '岐阜県' },
      { label: '静岡県', value: '静岡県' },
      { label: '愛知県', value: '愛知県' },
      { label: '三重県', value: '三重県' },
      { label: '滋賀県', value: '滋賀県' },
      { label: '京都府', value: '京都府' },
      { label: '大阪府', value: '大阪府' },
      { label: '兵庫県', value: '兵庫県' },
      { label: '奈良県', value: '奈良県' },
      { label: '和歌山県', value: '和歌山県' },
      { label: '鳥取県', value: '鳥取県' },
      { label: '島根県', value: '島根県' },
      { label: '岡山県', value: '岡山県' },
      { label: '広島県', value: '広島県' },
      { label: '山口県', value: '山口県' },
      { label: '徳島県', value: '徳島県' },
      { label: '香川県', value: '香川県' },
      { label: '愛媛県', value: '愛媛県' },
      { label: '高知県', value: '高知県' },
      { label: '福岡県', value: '福岡県' },
      { label: '佐賀県', value: '佐賀県' },
      { label: '長崎県', value: '長崎県' },
      { label: '熊本県', value: '熊本県' },
      { label: '大分県', value: '大分県' },
      { label: '宮崎県', value: '宮崎県' },
      { label: '鹿児島県', value: '鹿児島県' },
      { label: '沖縄県', value: '沖縄県' },
    ],
  },
  {
    id: 'teaching_style',
    number: 11,
    step: 2,
    type: 'multiSelect',
    label: '授業のスタイルとして、近いものをすべて選んでください',
    required: true,
    options: [
      { label: '校舎での集団授業が中心（同じ教室で複数人に一斉授業）', value: '校舎集団中心' },
      { label: '校舎での個別指導・少人数指導が中心', value: '校舎個別/少人数中心' },
      { label: '校舎での集団授業と個別指導が半々くらい', value: '半々' },
      { label: 'オンラインのライブ授業が中心（リアルタイム配信）', value: 'オンラインライブ中心' },
      { label: 'オンラインの録画授業・オンデマンド視聴が中心', value: '録画/オンデマンド中心' },
      { label: 'レポート提出や自主学習が中心', value: '自主学習/レポート中心' },
    ],
  },
  {
    id: 'student_atmosphere',
    number: 12,
    step: 2,
    type: 'multiSelect',
    label: 'どんなタイプの生徒が多いと感じましたか？当てはまるものをすべて選んでください',
    required: true,
    options: [
      { label: 'まじめで、授業や学校行事にも積極的な人', value: 'まじめで授業/行事に積極的' },
      { label: '落ち着いていて、気のあう数名の友達と過ごす人', value: '落ち着いて少人数で過ごす' },
      { label: '一人の時間や自分の世界を大事にしている人', value: '一人時間を大事にする' },
      { label: 'アニメ・ゲーム・漫画などの趣味をもつ人', value: 'アニメ/ゲーム等の趣味' },
      { label: 'ファッションやメイクなどおしゃれを楽しんでいる人', value: 'おしゃれを楽しむ' },
      { label: 'にぎやかで、ルールなどにしばられずマイペースな人', value: 'にぎやかでルールにしばられずマイペース' },
      { label: '習い事・アルバイトなど、校外の活動を重視する人', value: '校外活動重視' },
      { label: '社会人・フリーターなど、幅広い年齢の人', value: '幅広い年齢層' },
      { label: 'その他', value: 'その他', showOtherInput: true },
    ],
  },
  {
    id: 'atmosphere_other',
    number: 12.1,
    step: 2,
    type: 'text',
    label: 'その他（生徒の雰囲気）',
    required: true,
    conditional: {
      field: 'student_atmosphere',
      value: 'その他',
    },
  },

  // Step3: 評価＋自由記述
  {
    id: 'flexibility_rating',
    number: 13,
    step: 3,
    type: 'radio',
    label: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'staff_rating',
    number: 14,
    step: 3,
    type: 'radio',
    label: '先生・職員の対応',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'support_rating',
    number: 15,
    step: 3,
    type: 'radio',
    label: '心や体調の波・不安などに対するサポート',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'atmosphere_fit_rating',
    number: 16,
    step: 3,
    type: 'radio',
    label: '在校生の雰囲気',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'credit_rating',
    number: 17,
    step: 3,
    type: 'radio',
    label: '単位取得のしやすさ',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'unique_course_rating',
    number: 18,
    step: 3,
    type: 'radio',
    label: '学校独自の授業・コース（IT・デザイン・美容・スポーツなど等）の充実度',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
      { label: '独自の授業・コースを受講していない／該当しない', value: '6' },
    ],
  },
  {
    id: 'career_support_rating',
    number: 19,
    step: 3,
    type: 'radio',
    label: '進学・就職など進路サポートの手厚さ',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'campus_life_rating',
    number: 20,
    step: 3,
    type: 'radio',
    label: '授業以外の学校行事やキャンパスライフ',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
      { label: '通学をしていないなどの理由で評価できない', value: '6' },
    ],
  },
  {
    id: 'tuition_rating',
    number: 21,
    step: 3,
    type: 'radio',
    label: '学費の納得感',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
      { label: '支払いは保護者等に任せていたためわからない', value: '6' },
    ],
  },
  {
    id: 'overall_satisfaction',
    number: 22,
    step: 3,
    type: 'radio',
    label: '総合満足度',
    required: true,
    options: [
      { label: 'とても不満', value: '1' },
      { label: 'やや不満', value: '2' },
      { label: 'どちらとも言えない', value: '3' },
      { label: 'やや満足', value: '4' },
      { label: 'とても満足', value: '5' },
    ],
  },
  {
    id: 'good_comment',
    number: 23,
    step: 3,
    type: 'textarea',
    label: 'この学校に通って良かった点を教えてください。',
    required: true,
    placeholder: '良かった点を記入してください',
  },
  {
    id: 'bad_comment',
    number: 24,
    step: 3,
    type: 'textarea',
    label: 'この学校の「改善してほしい」点や「人によっては合わないかもしれない」点を教えてください。',
    required: true,
    placeholder: '改善してほしい点や合わない点を記入してください',
  },
  {
    id: 'email',
    number: 25,
    step: 3,
    type: 'email',
    label: 'メールアドレス',
    required: true,
    placeholder: 'example@email.com',
  },
];

