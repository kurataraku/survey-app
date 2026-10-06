import { questions, type Question } from '@/lib/questions';
import type { OfficialPageResult, ReviewModerationInput, SchoolModerationContext } from './types';

const INSTITUTION_LABELS: Record<string, string> = {
  public: '公立通信制高校',
  private: '私立通信制高校',
  support: 'サポート校',
};

const SKIPPED_ANSWER_IDS = new Set(['school_name', 'good_comment', 'bad_comment', 'email']);

export const MODERATION_SYSTEM_PROMPT = `あなたは通信制高校の口コミ審査担当です。掲載前に、安全・事実・回答同士の整合だけを見ます。

見ないもの:
- 辛口か、不満が多いか、文章がうまいか
- 低評価が揃っていること自体
- 学校が実在しそうか。実在は別処理で照合済みなので、学校名の印象では判定しない

材料に無い体験は未記載です。虚偽にしてはいけません。食堂の部屋数や、入口での服装注意のように、渡した材料に書いていない校舎の話は not_stated にします。

返すのはJSONだけです。危険度の点数や、自由な総評は返さないでください。

{
  "personal_info": false,
  "hate_speech": false,
  "advertisement": false,
  "findings": [
    {
      "aspect": "fact",
      "verdict": "consistent",
      "quote": "口コミまたは回答からの短い引用",
      "compared_with": "比べた対象を名詞句で。未記載なら、どの材料に無かったか",
      "meaning": "だから支えるのか、弱いのか、判断できないのかを1文",
      "flag": null
    }
  ]
}

aspect と verdict:
- fact + consistent: 口コミの事実が、渡した学校材料と一致する。一致した材料の記述を compared_with に書く。一致は省略しない。
- fact + contradict: 口コミの事実が、渡した学校材料と食い違う。材料に無いことは contradict にしない。
- fact + not_stated: 具体的な体験だが、学校材料にも公式ページにも無い。確認できた、とは書かない。
- internal + contradict: 点数と自由記述、または通学頻度・授業スタイル・在籍状況・入学年が逆を向いている。設問文と両方の内容が分かるように compared_with を書く。
- internal + unexplained: 点数が高い、または低いのに、本文がその項目の理由に触れていない。本文に理由がある低評価は指摘しない。低評価が並んでいるだけでも指摘しない。
- safety + contradict: 個人を特定できる第三者の氏名・連絡先、誹謗中傷・差別、広告・宣伝。flag は personal_info、hate_speech、advertisement のいずれか。投稿者自身のメールアドレス欄は personal_info にしない。

quote、compared_with、meaning は必ず入れる。最大8件。矛盾と理由不足を優先し、次に一致、最後に未記載。`;

export function buildModerationUserPrompt(
  review: ReviewModerationInput,
  school: SchoolModerationContext,
  officialPage: OfficialPageResult
): string {
  return [
    '口コミ:',
    `学校名: ${review.schoolName}`,
    `投稿者の立場: ${review.respondentRole ?? '不明'}`,
    `在籍状況: ${review.status ?? '不明'}`,
    `総合満足度: ${review.overallSatisfaction ?? '不明'}/5`,
    `良かった点: ${review.goodComment ?? ''}`,
    `改善してほしい点: ${review.badComment ?? ''}`,
    '',
    '選択回答と項目別の点数:',
    formatAnswers(review),
    '',
    '学校材料（事実の照合はこの範囲だけ）:',
    formatSchoolMaterials(school, officialPage),
  ].join('\n');
}

function formatAnswers(review: ReviewModerationInput): string {
  const lines: string[] = [];
  for (const question of questions) {
    if (SKIPPED_ANSWER_IDS.has(question.id)) continue;
    const raw = review.answers[question.id];
    if (raw == null || raw === '') continue;
    const value = formatAnswerValue(question, raw);
    if (!value) continue;
    lines.push(`- ${question.label}: ${value}`);
  }
  return lines.length > 0 ? lines.join('\n') : '（選択回答なし）';
}

function formatAnswerValue(question: Question, raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((item) => formatOneAnswer(question, item)).filter(Boolean).join('、');
  }
  return formatOneAnswer(question, raw);
}

function formatOneAnswer(question: Question, raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const label = question.options?.find((option) => option.value === value)?.label;
  if (value === '6' && label) return label;
  if (/^[1-5]$/.test(value) && label) return `${value}/5（${label}）`;
  if (label && label !== value) return label;
  return value;
}

export function formatSchoolMaterials(
  school: SchoolModerationContext,
  officialPage: OfficialPageResult
): string {
  if (school.lookup === 'missing') {
    return '学校マスターに、この学校名の登録は無い。';
  }
  if (school.lookup === 'error') {
    return '学校マスターを取得できなかった。';
  }

  const institution = school.institutionType
    ? INSTITUTION_LABELS[school.institutionType] ?? school.institutionType
    : '不明';
  const campuses = school.campusLocations.length > 0
    ? school.campusLocations
      .map((campus) => (campus.city ? `${campus.prefecture} ${campus.city}` : campus.prefecture))
      .join('、')
    : 'キャンパス一覧は無い';
  const courses = school.courseNames.length > 0
    ? school.courseNames.join('、')
    : '公開済みのコース一覧は無い';
  const tuition = school.tuitionText ?? '公開済みの学費目安は無い';
  const page = officialPage.status === 'fetched'
    ? officialPage.text
    : officialPage.note;

  return [
    `登録校名: ${school.schoolName ?? ''}`,
    `状態: ${school.status ?? '不明'}`,
    `設置区分: ${institution}`,
    `キャンパス: ${campuses}`,
    `コース: ${courses}`,
    `学費: ${tuition}`,
    `公式ページ: ${page}`,
  ].join('\n');
}
