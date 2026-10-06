import type {
  CampusLocation,
  ModerationFinding,
  OfficialPageResult,
  SchoolModerationContext,
} from './types';

export type RuleCheckInput = {
  reviewSchoolName: string;
  school: SchoolModerationContext;
  campusPrefecture: string | null;
  campusCity: string | null;
  enrollmentYear: string | null;
  postedAt: Date;
  email: string | null;
  duplicateEmail: boolean;
  officialPage: OfficialPageResult;
};

export function buildRuleFindings(input: RuleCheckInput): ModerationFinding[] {
  const findings: ModerationFinding[] = [];

  if (input.school.lookup === 'error') {
    findings.push({
      aspect: 'fact',
      verdict: 'not_stated',
      quote: input.reviewSchoolName,
      comparedWith: '学校マスターの取得に失敗した',
      meaning: '学校の登録有無とキャンパスは照合できていない',
    });
  } else if (input.school.lookup === 'missing') {
    findings.push({
      aspect: 'safety',
      verdict: 'contradict',
      quote: input.reviewSchoolName,
      comparedWith: '学校マスターと別名一覧',
      meaning: 'この学校名は登録済みの学校にも別名にも無い',
    });
  } else if (isUnconfirmedProvisional(input.school)) {
    findings.push({
      aspect: 'fact',
      verdict: 'not_stated',
      quote: input.reviewSchoolName,
      comparedWith: '学校マスターは仮登録のみで、キャンパス一覧も公式URLも無い',
      meaning: '登録された学校として実在するかは、この材料では確認できない',
    });
  }

  findings.push(...campusFindings(input));
  const futureYear = futureEnrollmentFinding(input);
  if (futureYear) findings.push(futureYear);

  if (input.duplicateEmail) {
    findings.push({
      aspect: 'safety',
      verdict: 'contradict',
      quote: input.email?.trim() || '投稿メールアドレス',
      comparedWith: '承認済みの口コミ',
      meaning: '同じメールアドレスで、すでに承認済みの口コミがある',
    });
  }

  if (input.officialPage.status !== 'fetched') {
    findings.push({
      aspect: 'fact',
      verdict: 'not_stated',
      quote: '公式ページ',
      comparedWith: input.officialPage.note,
      meaning: '公式サイトに書いてある事実とは照合できていない。学校マスターにある情報だけを見ている',
    });
  }

  return findings;
}

function isUnconfirmedProvisional(school: SchoolModerationContext): boolean {
  return school.lookup === 'found'
    && school.status === 'pending'
    && school.campusLocations.length === 0
    && !school.officialUrl;
}

function campusFindings(input: RuleCheckInput): ModerationFinding[] {
  if (input.school.lookup !== 'found' || input.school.campusLocations.length === 0) return [];

  const findings: ModerationFinding[] = [];
  const campuses = input.school.campusLocations;
  const campusList = formatCampusList(campuses);
  const prefecture = input.campusPrefecture?.trim() || '';

  if (prefecture) {
    const inList = campuses.some((campus) => samePlace(campus.prefecture, prefecture));
    findings.push({
      aspect: 'fact',
      verdict: inList ? 'consistent' : 'contradict',
      quote: prefecture,
      comparedWith: `学校マスターのキャンパス一覧（${campusList}）`,
      meaning: inList
        ? '回答の都道府県はこの学校のキャンパス所在地と一致する。通っていた県として不自然ではない'
        : '回答の都道府県は、この学校のキャンパス所在地に含まれない',
    });
    if (!inList) return findings;
  }

  const city = input.campusCity?.trim() || '';
  if (!city) return findings;

  const inPrefecture = prefecture
    ? campuses.filter((campus) => samePlace(campus.prefecture, prefecture))
    : campuses;
  const compared = (inPrefecture.length > 0 ? inPrefecture : campuses).filter((campus) => campus.city);
  if (compared.length === 0) return findings;

  const matched = compared.some((campus) => campus.city && placesOverlap(city, campus.city));

  findings.push({
    aspect: 'fact',
    verdict: matched ? 'consistent' : 'contradict',
    quote: city,
    comparedWith: `学校マスターのキャンパス市区町村（${formatCampusList(compared)}）`,
    meaning: matched
      ? '回答の市区町村は、この学校のキャンパス所在地と一致する'
      : '回答の市区町村は、この学校のキャンパス所在地と一致しない',
  });

  return findings;
}

function futureEnrollmentFinding(input: RuleCheckInput): ModerationFinding | null {
  const year = parseEnrollmentYear(input.enrollmentYear);
  if (year == null || Number.isNaN(input.postedAt.getTime())) return null;
  const postedYear = yearInJapan(input.postedAt);
  if (year <= postedYear) return null;

  const posted = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(input.postedAt);

  return {
    aspect: 'internal',
    verdict: 'contradict',
    quote: `${year}年`,
    comparedWith: `投稿日（${posted}）`,
    meaning: '入学年が投稿日より未来のため、在籍の時期と合わない',
  };
}

export function parseEnrollmentYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  if (year < 1990 || year > 2100) return null;
  return year;
}

function yearInJapan(date: Date): number {
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
  }).format(date);
  return Number(year);
}

function formatCampusList(campuses: CampusLocation[]): string {
  return campuses
    .map((campus) => (campus.city ? `${campus.prefecture} ${campus.city}` : campus.prefecture))
    .join('、');
}

function samePlace(left: string, right: string): boolean {
  return normalizePlace(left) === normalizePlace(right);
}

function placesOverlap(answer: string, campus: string): boolean {
  const left = normalizePlace(answer);
  const right = normalizePlace(campus);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function normalizePlace(value: string): string {
  return value.normalize('NFKC').replace(/[\s\u3000]+/g, '').trim();
}
