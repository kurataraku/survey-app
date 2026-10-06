import { describe, expect, it } from 'vitest';
import { assembleModeration } from '../../lib/moderation/assemble';
import {
  COMMENT_HEADINGS,
  EMPTY_SUPPORT,
  latestByCreatedAt,
  readFindings,
} from '../../lib/moderation/comment';
import { htmlToText, isSafeOfficialUrl } from '../../lib/moderation/official-page';
import { buildRuleFindings } from '../../lib/moderation/rules';
import { fillerFindings } from '../../lib/moderation/filler';
import { sanitizeFindings } from '../../lib/moderation/sanitize';
import { scoreModeration } from '../../lib/moderation/score';
import type { ModerationFinding, SchoolModerationContext } from '../../lib/moderation/types';

const asukaSchool: SchoolModerationContext = {
  lookup: 'found',
  schoolId: 'school-1',
  schoolName: '飛鳥未来高等学校',
  status: 'active',
  institutionType: 'private',
  officialUrl: 'https://www.sanko.ac.jp/asuka/asukamirai/nagoya/',
  campusLocations: [
    { prefecture: '愛知県', city: '名古屋市' },
    { prefecture: '東京都', city: '豊島区' },
  ],
  courseNames: ['メイクライセンスコース'],
  tuitionText: null,
};

describe('scoreModeration', () => {
  const none = {
    personalInfo: false,
    hateSpeech: false,
    advertisement: false,
    fakeSchool: false,
    duplicateEmail: false,
    factConflict: false,
    internalConflict: false,
    fillerPadding: false,
  };

  it('一致や未記載だけでは点を足さない', () => {
    expect(scoreModeration(none)).toBe(0);
  });

  it('安全フラグと事実矛盾、回答矛盾を決められた重みで足し、100で止める', () => {
    expect(scoreModeration({ ...none, personalInfo: true, factConflict: true })).toBe(75);
    expect(scoreModeration({ ...none, internalConflict: true })).toBe(25);
    expect(scoreModeration({ ...none, duplicateEmail: true })).toBe(15);
    expect(scoreModeration({ ...none, fillerPadding: true })).toBe(80);
    expect(scoreModeration({
      personalInfo: true,
      hateSpeech: true,
      advertisement: true,
      fakeSchool: true,
      duplicateEmail: true,
      factConflict: true,
      internalConflict: true,
      fillerPadding: true,
    })).toBe(100);
  });
});

describe('fillerFindings', () => {
  it('句読点や記号で長くした良かった点と、読点の連打を検知する', () => {
    const findings = buildRuleFindings({
      reviewSchoolName: 'S高等学校',
      school: { ...asukaSchool, campusLocations: [] },
      campusPrefecture: null,
      campusCity: null,
      enrollmentYear: '2025',
      postedAt: new Date('2026-10-06T08:28:24Z'),
      email: null,
      duplicateEmail: false,
      officialPage: { status: 'fetched', text: '本文', note: '' },
      goodComment: '自分の行きたい進路に行けた。 ●○。●○。●○。●○。●○。●○。●○！！！',
      badComment: 'レポートの授業動画をもっと面白くしてほしい,,,,,,,',
    });
    const fillers = findings.filter((finding) => finding.kind === 'filler_padding');

    expect(fillers).toHaveLength(2);
    expect(fillers[0]?.comparedWith).toBe('良かった点');
    expect(fillers[1]?.comparedWith).toBe('改善してほしい点');

    const result = assembleModeration({
      ruleFindings: findings,
      aiFindings: [],
      personalInfo: false,
      hateSpeech: false,
      advertisement: false,
      fakeSchool: false,
      duplicateEmail: false,
      aiFailed: false,
    });
    expect(result.dangerScore).toBe(80);
    expect(result.flags.filler_padding).toBe(true);
    expect(result.flags.internal_conflict).toBe(false);
    expect(result.reason).toContain('句読点や空白で文章を埋めています。');
    expect(result.reason).toContain('埋め込みと判断した');
  });

  it('普通の文末の句点では検知しない', () => {
    const findings = fillerFindings(
      '自分の行きたい進路に行けた。先生も話を聞いてくれた。',
      'レポートの授業動画をもっと面白くしてほしい。'
    );
    expect(findings).toEqual([]);
  });

  it('同じ句読点4文字、記号や空白4文字から検知し、3文字では検知しない', () => {
    expect(fillerFindings('面白くしてほしい,,,,', null)).toHaveLength(1);
    expect(fillerFindings('進路に行けた。 ●○', null)).toHaveLength(1);
    expect(fillerFindings('面白くしてほしい,,,', null)).toEqual([]);
    expect(fillerFindings('進路に行けた。●○', null)).toEqual([]);
  });
});

describe('buildRuleFindings', () => {
  it('愛知県は飛鳥未来のキャンパスと一致し、事実矛盾にはしない', () => {
    const findings = buildRuleFindings({
      reviewSchoolName: '飛鳥未来高等学校',
      school: asukaSchool,
      campusPrefecture: '愛知県',
      campusCity: '名古屋市西区',
      enrollmentYear: '2025',
      postedAt: new Date('2026-10-06T04:22:28Z'),
      email: 'example@example.com',
      duplicateEmail: false,
      officialPage: { status: 'fetched', text: '週1日から通学できます', note: '' },
    });

    expect(findings.some((finding) => finding.verdict === 'consistent' && finding.quote === '愛知県')).toBe(true);
    expect(findings.some((finding) => finding.verdict === 'consistent' && finding.quote === '名古屋市西区')).toBe(true);
    expect(findings.some((finding) => finding.verdict === 'contradict')).toBe(false);
  });

  it('キャンパス一覧が空なら都道府県の不一致を出さない', () => {
    const findings = buildRuleFindings({
      reviewSchoolName: '飛鳥未来高等学校',
      school: { ...asukaSchool, campusLocations: [] },
      campusPrefecture: '北海道',
      campusCity: null,
      enrollmentYear: '2025',
      postedAt: new Date('2026-10-06T04:22:28Z'),
      email: null,
      duplicateEmail: false,
      officialPage: { status: 'missing', text: '', note: '公式URLが未登録のため、公式ページは読んでいない' },
    });

    expect(findings.some((finding) => finding.quote === '北海道')).toBe(false);
    expect(findings.some((finding) => finding.verdict === 'not_stated' && finding.quote === '公式ページ')).toBe(true);
  });

  it('入学年が投稿日より未来なら回答の矛盾にする', () => {
    const findings = buildRuleFindings({
      reviewSchoolName: '飛鳥未来高等学校',
      school: asukaSchool,
      campusPrefecture: '愛知県',
      campusCity: null,
      enrollmentYear: '2027',
      postedAt: new Date('2026-10-06T04:22:28Z'),
      email: null,
      duplicateEmail: false,
      officialPage: { status: 'fetched', text: '本文', note: '' },
    });

    expect(findings).toContainEqual(expect.objectContaining({
      aspect: 'internal',
      verdict: 'contradict',
      quote: '2027年',
    }));
  });

  it('学校マスターに無い学校名は架空校として弱い点に残す', () => {
    const findings = buildRuleFindings({
      reviewSchoolName: '存在しない高等学校',
      school: {
        ...asukaSchool,
        lookup: 'missing',
        schoolId: null,
        schoolName: null,
        campusLocations: [],
        officialUrl: null,
      },
      campusPrefecture: '愛知県',
      campusCity: null,
      enrollmentYear: '2025',
      postedAt: new Date('2026-10-06T04:22:28Z'),
      email: null,
      duplicateEmail: false,
      officialPage: { status: 'missing', text: '', note: '公式URLが未登録のため、公式ページは読んでいない' },
    });

    expect(findings).toContainEqual(expect.objectContaining({
      aspect: 'safety',
      verdict: 'contradict',
      quote: '存在しない高等学校',
      comparedWith: '学校マスターと別名一覧',
    }));
  });
});

describe('assembleModeration', () => {
  const flexibility: ModerationFinding = {
    aspect: 'internal',
    verdict: 'contradict',
    quote: '学校に行かず家にいる時間が増えたため、自由な時間が増えた',
    comparedWith: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）の1/5（とても不満）',
    meaning: '通学を減らせている体験と、調整しやすさへのとても不満が逆を向いている',
  };
  const tuition: ModerationFinding = {
    aspect: 'internal',
    verdict: 'unexplained',
    quote: '学費の納得感は1/5',
    comparedWith: '良かった点と改善してほしい点',
    meaning: '本文が学費に触れていないため、不満の中身が分からない',
  };
  const lunch: ModerationFinding = {
    aspect: 'fact',
    verdict: 'not_stated',
    quote: '2教室の空き教室のみ飲食可能',
    comparedWith: '学校マスターのキャンパス一覧と公式ページの抜粋には記載がない',
    meaning: '具体的な体験だが、公開情報では確認も否定もできない',
  };

  function asukaRules() {
    return buildRuleFindings({
      reviewSchoolName: '飛鳥未来高等学校',
      school: asukaSchool,
      campusPrefecture: '愛知県',
      campusCity: null,
      enrollmentYear: '2025',
      postedAt: new Date('2026-10-06T04:22:28Z'),
      email: 'example@example.com',
      duplicateEmail: false,
      officialPage: { status: 'fetched', text: '週1日から通学できます', note: '' },
    });
  }

  it('飛鳥未来の口コミは、一致を残し、柔軟性の逆向きだけを危険度に足す', () => {
    const result = assembleModeration({
      ruleFindings: asukaRules(),
      aiFindings: [flexibility, tuition, lunch],
      personalInfo: false,
      hateSpeech: false,
      advertisement: false,
      fakeSchool: false,
      duplicateEmail: false,
      aiFailed: false,
    });

    expect(result.dangerScore).toBe(25);
    expect(result.flags.fact_conflict).toBe(false);
    expect(result.flags.internal_conflict).toBe(true);
    expect(result.reason).toContain('安全上の問題はなし。公開情報との矛盾はなし。回答の食い違いは1件。理由が書かれていない点数は1件。');
    expect(result.reason).toContain(COMMENT_HEADINGS.support);
    expect(result.reason).toContain(COMMENT_HEADINGS.weak);
    expect(result.reason).toContain(COMMENT_HEADINGS.unknown);
    expect(result.reason).toContain('口コミの「愛知県」');
    expect(result.reason).toContain('学校マスターのキャンパス一覧');
    expect(result.reason).toContain('自由な時間が増えた');
    expect(result.reason).toContain('学びの柔軟さ');
    expect(result.reason).toContain('学費の納得感は1/5');
    expect(result.reason).toContain('2教室の空き教室のみ飲食可能');
    expect(result.reason).not.toContain('問題なし');
    expect(result.reason).not.toContain(EMPTY_SUPPORT);
  });

  it('引用か比較先が欠けた指摘は捨てる', () => {
    const kept = sanitizeFindings([
      {
        aspect: 'fact',
        verdict: 'consistent',
        quote: '  愛知県 ',
        compared_with: ' キャンパス一覧 ',
        meaning: ' 一致する ',
      },
      {
        aspect: 'fact',
        verdict: 'contradict',
        quote: '',
        compared_with: 'キャンパス一覧',
        meaning: '食い違う',
      },
      {
        aspect: 'internal',
        verdict: 'unexplained',
        quote: '学費',
        compared_with: '',
        meaning: '理由がない',
      },
    ]);

    expect(kept).toEqual([
      {
        aspect: 'fact',
        verdict: 'consistent',
        quote: '愛知県',
        comparedWith: 'キャンパス一覧',
        meaning: '一致する',
      },
    ]);
  });

  it('保存した指摘を読み戻しても、三つの見出しに分けられる', () => {
    const result = assembleModeration({
      ruleFindings: asukaRules(),
      aiFindings: [flexibility, lunch],
      personalInfo: false,
      hateSpeech: false,
      advertisement: false,
      fakeSchool: false,
      duplicateEmail: false,
      aiFailed: false,
    });
    const findings = readFindings(result.flags);

    expect(findings.some((finding) => finding.verdict === 'consistent' && finding.quote === '愛知県')).toBe(true);
    expect(findings.some((finding) => finding.verdict === 'contradict' && finding.quote.includes('自由な時間'))).toBe(true);
    expect(findings.some((finding) => finding.verdict === 'not_stated' && finding.quote.includes('空き教室'))).toBe(true);
  });
});

describe('official page helpers', () => {
  it('脚本とタグを除いた本文だけを残す', () => {
    expect(htmlToText('<style>p{}</style><script>alert(1)</script><p>名古屋&amp;週1</p>')).toBe('名古屋&週1');
  });

  it('https以外と内部アドレスは取得しない', () => {
    expect(isSafeOfficialUrl('http://www.sanko.ac.jp/asuka/')).toBeNull();
    expect(isSafeOfficialUrl('https://localhost/school')).toBeNull();
    expect(isSafeOfficialUrl('https://127.0.0.1/school')).toBeNull();
    expect(isSafeOfficialUrl('https://www.sanko.ac.jp/asuka/')?.hostname).toBe('www.sanko.ac.jp');
  });
});

describe('latestByCreatedAt', () => {
  it('再審査後は新しい結果を選ぶ', () => {
    const latest = latestByCreatedAt([
      { id: 'old', created_at: '2026-10-01T00:00:00Z' },
      { id: 'new', created_at: '2026-10-06T00:00:00Z' },
    ]);
    expect(latest?.id).toBe('new');
  });
});
