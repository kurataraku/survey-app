import { describe, expect, it } from 'vitest';
import {
  addRegionalReview,
  createRegionalReviewIndex,
  finalizeRegionalReviews,
} from '@/lib/schools/regionalReviews';
import { selectRepresentativeRegionalReviewExcerpts } from '@/lib/schools/regionalReviewExcerpts';

const parseRating = (value: unknown) => {
  const rating = Number(value);
  return rating >= 1 && rating <= 5 ? rating : null;
};

describe('regional review aggregation', () => {
  it('地域内の評価平均・理由分類・回答者区分を集計する', () => {
    const index = createRegionalReviewIndex();
    addRegionalReview(
      index,
      'school-1',
      {
        campus_prefecture: '愛知県',
        atmosphere_fit_rating: '4',
        staff_rating: 5,
        reason_for_choosing: [
          '心の不調のため',
          '先生・友人などの人間関係に悩んだため',
          '全日制の学習スタイルが合わないため',
        ],
        attendance_frequency: '週1〜2',
        enrollment_type: '新入学（中学卒業後）',
      },
      4,
      parseRating,
      '本人'
    );
    addRegionalReview(
      index,
      'school-1',
      {
        campus_prefecture: '愛知県',
        atmosphere_fit_rating: 2,
        staff_rating: 3,
        reason_for_choosing: ['心や体の状態／発達障害・知的障害などのため'],
        attendance_frequency: 'ほぼオンライン/自宅',
        enrollment_type: '転入学（他校から転校）',
      },
      2,
      parseRating,
      '保護者'
    );

    const [stat] = finalizeRegionalReviews(index, 'school-1')!;
    expect(stat.reviewCount).toBe(2);
    expect(stat.overallAvg).toBe(3);
    expect(stat.staffAvg).toBe(4);
    expect(stat.atmosphereAvg).toBe(3);
    expect(stat.reasonGroups).toEqual({
      mental_relationship: 1,
      learning_style: 1,
      health_development: 1,
    });
    expect(stat.respondentRoles).toEqual({ 本人: 1, 保護者: 1 });
  });

  it('同じ理由分類に複数の選択肢が一致しても1口コミを1回だけ数える', () => {
    const index = createRegionalReviewIndex();
    addRegionalReview(
      index,
      'school-1',
      {
        campus_prefecture: '東京都',
        reason_for_choosing: [
          '心の不調のため',
          '心の不調のため',
          '先生・友人などの人間関係に悩んだため',
        ],
      },
      3,
      parseRating,
      '本人'
    );

    expect(finalizeRegionalReviews(index, 'school-1')?.[0].reasonGroups.mental_relationship).toBe(1);
  });

  it('キャンパス都道府県がない口コミはすべての地域集計から除外する', () => {
    const index = createRegionalReviewIndex();
    addRegionalReview(
      index,
      'school-1',
      {
        atmosphere_fit_rating: 5,
        reason_for_choosing: ['全日制の学習スタイルが合わないため'],
      },
      5,
      parseRating,
      '保護者'
    );

    expect(finalizeRegionalReviews(index, 'school-1')).toBeNull();
  });
});

describe('representative regional review excerpts', () => {
  it('完全性・具体性・新しさで各校1件を選び、属性値や高評価を優先しない', () => {
    const repeatedGood = '学校生活について具体的に書いた良かった点です。'.repeat(6);
    const repeatedBad = '入学前に知りたかった気になった点です。'.repeat(5);
    const reviews = [
      {
        id: 'school-1-old',
        school_id: 'school-1',
        respondent_role: '保護者',
        overall_satisfaction: 5,
        good_comment: repeatedGood,
        bad_comment: repeatedBad,
        created_at: '2025-01-01T00:00:00Z',
        answers: {
          campus_city: '名古屋市中区',
          enrollment_type: '転入学（他校から転校）',
          attendance_frequency: '週1〜2',
          reason_for_choosing: ['心の不調のため'],
        },
      },
      {
        id: 'school-1-new',
        school_id: 'school-1',
        respondent_role: '本人',
        overall_satisfaction: 1,
        good_comment: repeatedGood,
        bad_comment: repeatedBad,
        created_at: '2026-01-01T00:00:00Z',
        answers: {
          campus_city: '名古屋市中村区',
          enrollment_type: '新入学（中学卒業後）',
          attendance_frequency: '月1〜数回',
          reason_for_choosing: ['全日制の学習スタイルが合わないため'],
        },
      },
      {
        id: 'school-1-newest-incomplete',
        school_id: 'school-1',
        respondent_role: '保護者',
        overall_satisfaction: 5,
        good_comment: '新しいものの、片面だけの短い口コミです。',
        bad_comment: null,
        created_at: '2027-01-01T00:00:00Z',
        answers: {
          enrollment_type: '転入学（他校から転校）',
          reason_for_choosing: ['心の不調のため'],
        },
      },
      {
        id: 'school-2-only',
        school_id: 'school-2',
        respondent_role: '保護者',
        overall_satisfaction: 4,
        good_comment: '先生が丁寧でした。',
        bad_comment: null,
        created_at: '2026-02-01T00:00:00Z',
        answers: { campus_city: '豊橋市' },
      },
    ];

    const result = selectRepresentativeRegionalReviewExcerpts({
      schools: [
        { id: 'school-1', name: '学校1', slug: 'school-1', localReviewCount: 2 },
        { id: 'school-2', name: '学校2', slug: null, localReviewCount: 1 },
      ],
      reviews,
      municipality: '名古屋市',
    });

    expect(result).toHaveLength(2);
    expect(result.map((review) => review.id)).toEqual(['school-1-new', 'school-2-only']);
    expect(result[0]).toMatchObject({
      schoolId: 'school-1',
      respondentRole: '本人',
      enrollmentType: '新入学（中学卒業後）',
      reasonGroupKeys: ['learning_style'],
      attendance: '月1〜数回',
      overall: 1,
      isCityCampus: true,
    });
    expect(result[0].good?.endsWith('…')).toBe(true);
    expect(new Set(result.map((review) => review.schoolId)).size).toBe(result.length);
  });

  it('除外IDの口コミは、同じ学校にほかの候補がある場合だけ避ける', () => {
    const detailed = '先生がこまめに声をかけてくれて、レポートの進め方も相談しやすかったです。'.repeat(2);
    const reviews = [
      {
        id: 'used-on-city-page',
        school_id: 'school-1',
        good_comment: detailed,
        bad_comment: detailed,
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: 'other-review',
        school_id: 'school-1',
        good_comment: '短い口コミです。',
        bad_comment: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'only-review',
        school_id: 'school-2',
        good_comment: detailed,
        bad_comment: null,
        created_at: '2026-02-01T00:00:00Z',
      },
    ];

    const result = selectRepresentativeRegionalReviewExcerpts({
      schools: [
        { id: 'school-1', name: '学校1', slug: 'school-1', localReviewCount: 2 },
        { id: 'school-2', name: '学校2', slug: 'school-2', localReviewCount: 1 },
      ],
      reviews,
      excludeReviewIds: ['used-on-city-page', 'only-review'],
    });

    expect(result.map((review) => review.id)).toEqual(['other-review', 'only-review']);
  });
});
