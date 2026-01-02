import { questions } from './questions';

/**
 * 質問IDと値から、アンケートで表示されたラベルを取得する
 */
export function getQuestionLabel(questionId: string, value: string): string {
  const question = questions.find(q => q.id === questionId);
  if (!question || !question.options) {
    return value; // ラベルが見つからない場合は値をそのまま返す
  }

  const option = question.options.find(opt => opt.value === value);
  return option ? option.label : value;
}

/**
 * 複数選択項目の値の配列から、ラベルの配列を取得する
 */
export function getQuestionLabels(questionId: string, values: string[]): string[] {
  return values.map(value => getQuestionLabel(questionId, value));
}

/**
 * 授業スタイルの値からラベルを取得
 */
export function getTeachingStyleLabel(value: string): string {
  const mapping: Record<string, string> = {
    '校舎集団中心': '校舎での集団授業が中心（同じ教室で複数人に一斉授業）',
    '校舎個別/少人数中心': '校舎での個別指導・少人数指導が中心',
    '半々': '校舎での集団授業と個別指導が半々くらい',
    'オンラインライブ中心': 'オンラインのライブ授業が中心（リアルタイム配信）',
    '録画/オンデマンド中心': 'オンラインの録画授業・オンデマンド視聴が中心',
    '自主学習/レポート中心': 'レポート提出や自主学習が中心',
  };
  return mapping[value] || value;
}

/**
 * 生徒の雰囲気の値からラベルを取得
 */
export function getStudentAtmosphereLabel(value: string): string {
  const mapping: Record<string, string> = {
    'まじめで授業/行事に積極的': 'まじめで、授業や学校行事にも積極的な人',
    '落ち着いて少人数で過ごす': '落ち着いていて、気のあう数名の友達と過ごす人',
    '一人時間を大事にする': '一人の時間や自分の世界を大事にしている人',
    'アニメ/ゲーム等の趣味': 'アニメ・ゲーム・漫画などの趣味をもつ人',
    'おしゃれを楽しむ': 'ファッションやメイクなどおしゃれを楽しんでいる人',
    'にぎやかでルールにしばられずマイペース': 'にぎやかで、ルールなどにしばられずマイペースな人',
    '校外活動重視': '習い事・アルバイトなど、校外の活動を重視する人',
    '幅広い年齢層': '社会人・フリーターなど、幅広い年齢の人',
    'その他': 'その他',
  };
  return mapping[value] || value;
}

/**
 * 通学頻度の値からラベルを取得
 */
export function getAttendanceFrequencyLabel(value: string): string {
  const mapping: Record<string, string> = {
    '週5': '週5',
    '週3〜4': '週3〜4',
    '週1〜2': '週1〜2',
    '月1〜数回': '月1～月数回',
    'ほぼオンライン/自宅': 'ほぼオンライン/自宅',
  };
  return mapping[value] || value;
}

/**
 * 入学年の値からラベルを取得
 */
export function getEnrollmentYearLabel(value: string): string {
  // valueが'2024'のような形式の場合、'2024年'に変換
  if (value && /^\d{4}$/.test(value)) {
    return `${value}年`;
  }
  return value;
}

/**
 * 卒業後の進路の値からラベルを取得
 */
export function getGraduationPathLabel(value: string): string {
  const mapping: Record<string, string> = {
    '大学進学': '大学進学',
    '専門学校進学': '専門学校進学',
    '短期大学進学': '短期大学進学',
    '就職': '就職（正社員・契約社員・アルバイト問わず）',
    '休養': '休養（体調の回復・家庭の事情など）',
    'その他': 'その他',
  };
  return mapping[value] || value;
}

