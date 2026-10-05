/**
 * 地域LPの「テーマ別に見る」リスト。根拠はすべて学校全体の公開口コミ。
 * 口コミが少ない学校は1人の回答で順位が振れるため、各テーマとも回答3件以上の学校だけを対象にする。
 */

export const THEME_MIN_ANSWERS = 3;
export const THEME_LIST_LIMIT = 5;
/** 該当校がこれより少ないテーマは、比べる意味が薄いため表示しない */
export const THEME_MIN_SCHOOLS = 3;

export const LOW_ATTENDANCE_ANSWERS = ['週1〜2', '月1〜数回', 'ほぼオンライン/自宅'] as const;
export const HIGH_ATTENDANCE_ANSWERS = ['週5', '週3〜4'] as const;

export type RegionalThemeKey = 'low_attendance' | 'high_attendance' | 'support' | 'tuition';

export type RegionalThemeSchoolInput = {
  id: string;
  name: string;
  slug: string | null;
  reviewCount: number;
  overallAvg: number | null;
  supportAvg: number | null;
  supportRatingCount: number;
  tuitionAvg: number | null;
  tuitionRatingCount: number;
  attendanceFrequencies: Record<string, number>;
};

export type RegionalThemeSchool = {
  id: string;
  name: string;
  slug: string | null;
  score: number;
  answerCount: number;
};

export type RegionalThemeList = {
  key: RegionalThemeKey;
  title: string;
  description: string;
  scoreLabel: string;
  schools: RegionalThemeSchool[];
};

function countAnswers(frequencies: Record<string, number>, answers: readonly string[]): number {
  return answers.reduce((sum, answer) => sum + (frequencies[answer] ?? 0), 0);
}

function totalAnswers(frequencies: Record<string, number>): number {
  return Object.values(frequencies).reduce((sum, count) => sum + count, 0);
}

/** 通学頻度の回答が3件以上あり、指定した回答が半数を超える学校か */
export function isAttendanceMajority(
  frequencies: Record<string, number>,
  answers: readonly string[]
): boolean {
  const total = totalAnswers(frequencies);
  return total >= THEME_MIN_ANSWERS && countAnswers(frequencies, answers) * 2 > total;
}

function rank(
  schools: RegionalThemeSchoolInput[],
  pick: (school: RegionalThemeSchoolInput) => { score: number | null; answerCount: number } | null
): RegionalThemeSchool[] {
  return schools
    .map((school) => {
      const picked = pick(school);
      if (!picked || picked.score == null || picked.answerCount < THEME_MIN_ANSWERS) return null;
      return {
        id: school.id,
        name: school.name,
        slug: school.slug,
        score: picked.score,
        answerCount: picked.answerCount,
      };
    })
    .filter((school): school is RegionalThemeSchool => school !== null)
    .sort(
      (a, b) =>
        b.score - a.score || b.answerCount - a.answerCount || a.name.localeCompare(b.name, 'ja')
    )
    .slice(0, THEME_LIST_LIMIT);
}

export function buildRegionalThemeLists(schools: RegionalThemeSchoolInput[]): RegionalThemeList[] {
  const byOverall = (answers: readonly string[]) => (school: RegionalThemeSchoolInput) =>
    isAttendanceMajority(school.attendanceFrequencies, answers)
      ? { score: school.overallAvg, answerCount: school.reviewCount }
      : null;

  const lists: RegionalThemeList[] = [
    {
      key: 'low_attendance',
      title: '口コミで週1〜2日・オンライン中心の人が多い学校',
      description:
        '通学頻度の回答が3件以上あり、半数を超える人が「週1〜2」「月1〜数回」「ほぼオンライン/自宅」と答えた学校を、総合満足度が高い順に表示しています。',
      scoreLabel: '総合満足度',
      schools: rank(schools, byOverall(LOW_ATTENDANCE_ANSWERS)),
    },
    {
      key: 'high_attendance',
      title: '口コミで週3〜5日通っている人が多い学校',
      description:
        '通学頻度の回答が3件以上あり、半数を超える人が「週3〜4」「週5」と答えた学校を、総合満足度が高い順に表示しています。',
      scoreLabel: '総合満足度',
      schools: rank(schools, byOverall(HIGH_ATTENDANCE_ANSWERS)),
    },
    {
      key: 'support',
      title: '口コミでサポートの評価が高い学校',
      description: 'サポートの満足度に3件以上の回答がある学校を、満足度が高い順に表示しています。',
      scoreLabel: 'サポート満足度',
      schools: rank(schools, (school) => ({
        score: school.supportAvg,
        answerCount: school.supportRatingCount,
      })),
    },
    {
      key: 'tuition',
      title: '口コミで学費の満足度が高い学校',
      description:
        '学費の満足度に3件以上の回答がある学校を、満足度が高い順に表示しています。満足度が高いことは、学費が安いことを意味しません。',
      scoreLabel: '学費満足度',
      schools: rank(schools, (school) => ({
        score: school.tuitionAvg,
        answerCount: school.tuitionRatingCount,
      })),
    },
  ];

  return lists.filter((list) => list.schools.length >= THEME_MIN_SCHOOLS);
}
