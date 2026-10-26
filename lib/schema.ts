import { z } from 'zod';
import { CONTEST_TEXT_LIMITS, MY_STORY_AWARD_SOURCE } from '@/lib/contest/copy';

/** 総合満足度に応じた口コミ本文の最小文字数（アンケート・管理画面編集で共通） */
export function getCommentMinLength(
  overallSatisfaction: number | undefined,
  field: 'good' | 'bad'
): number {
  if (!overallSatisfaction) return 70; // デフォルト値
  
  if (overallSatisfaction >= 4) {
    // 4〜5：No.23 100字以上必須、No.24 30字以上必須
    return field === 'good' ? 100 : 30;
  } else if (overallSatisfaction <= 2) {
    // 1〜2：No.23 30字以上必須、No.24 100字以上必須
    return field === 'good' ? 30 : 100;
  } else {
    // 3：両方 70字以上必須
    return 70;
  }
}

// ベーススキーマ（条件分岐なし）
const baseSchema = z.object({
  school_name: z.string().min(1, '学校名を入力してください'),
  school_id: z.string().uuid().optional(), // 後方互換のためオプショナル（ただし、school_nameが入力されている場合は必須）
  school_name_input: z.string().optional(), // その他入力時の原文
  respondent_role: z.enum(['本人', '保護者']),
  status: z.enum(['在籍中', '卒業した', '以前在籍していた（転校・退学など）']),
  graduation_path: z.string().optional(),
  graduation_path_other: z.string().optional(),
  reason_for_choosing: z.array(z.string()).min(1, '通信制を選んだ理由を1つ以上選択してください'),
  course: z.string().optional(),
  enrollment_type: z.enum(['新入学（中学卒業後）', '転入学（他校から転校）', '編入学（中退後に入り直し）']),
  enrollment_year: z.string().regex(/^\d{4}$/, '4桁の年を入力してください（例：2024）'),
  attendance_frequency: z.enum(['週5', '週3〜4', '週1〜2', '月1〜数回', 'ほぼオンライン/自宅']),
  campus_prefecture: z.string().min(1, '都道府県を選択してください'),
  campus_city: z.string().max(40, '市区町村は40文字以内で入力してください').optional(),
  teaching_style: z.array(z.string()).min(1, '授業スタイルを1つ以上選択してください'),
  student_atmosphere: z.array(z.string()).min(1, '生徒の雰囲気を1つ以上選択してください'),
  atmosphere_other: z.string().optional(),
  flexibility_rating: z.enum(['1', '2', '3', '4', '5']),
  staff_rating: z.enum(['1', '2', '3', '4', '5']),
  support_rating: z.enum(['1', '2', '3', '4', '5']),
  atmosphere_fit_rating: z.enum(['1', '2', '3', '4', '5']),
  credit_rating: z.enum(['1', '2', '3', '4', '5']),
  unique_course_rating: z.enum(['1', '2', '3', '4', '5', '6']),
  career_support_rating: z.enum(['1', '2', '3', '4', '5']),
  campus_life_rating: z.enum(['1', '2', '3', '4', '5', '6']),
  tuition_rating: z.enum(['1', '2', '3', '4', '5', '6']),
  overall_satisfaction: z.enum(['1', '2', '3', '4', '5']),
  good_comment: z.string().min(1, '良かった点を入力してください'),
  bad_comment: z.string().min(1, '改善してほしい点/合わない点を入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .refine((val) => val.includes('@'), {
      message: 'メールアドレスには@が含まれている必要があります',
    })
    .email('有効なメールアドレスを入力してください'),
});

// 動的バリデーションを含むスキーマ
export const surveySchema = baseSchema
  .refine(
    (data) => {
      // No.4: status = '卒業した' の場合、graduation_path は必須
      if (data.status === '卒業した') {
        return !!data.graduation_path;
      }
      return true;
    },
    {
      message: '卒業後の進路を選択してください',
      path: ['graduation_path'],
    }
  )
  .refine(
    (data) => {
      // graduation_path = 'その他' の場合、graduation_path_other は必須
      if (data.graduation_path === 'その他') {
        return !!data.graduation_path_other && data.graduation_path_other.trim().length > 0;
      }
      return true;
    },
    {
      message: 'その他（卒業後の進路）を入力してください',
      path: ['graduation_path_other'],
    }
  )
  .refine(
    (data) => {
      // student_atmosphere に 'その他' が含まれる場合、atmosphere_other は必須
      if (data.student_atmosphere?.includes('その他')) {
        return !!data.atmosphere_other && data.atmosphere_other.trim().length > 0;
      }
      return true;
    },
    {
      message: 'その他（生徒の雰囲気）を入力してください',
      path: ['atmosphere_other'],
    }
  )
  .refine(
    (data) => {
      // school_nameが入力されている場合、school_idは必須（候補から選択するか、追加ボタンを押す必要がある）
      if (data.school_name && data.school_name.trim().length > 0) {
        return !!data.school_id && data.school_id.trim().length > 0;
      }
      return true;
    },
    {
      message: '候補から学校を選択するか、「追加して続ける」をクリックしてください',
      path: ['school_id'],
    }
  )
  .superRefine((data, ctx) => {
    // No.23: 総合満足度に応じた文字数チェック
    const overallSatisfaction = data.overall_satisfaction ? parseInt(data.overall_satisfaction) : undefined;
    const minLength = getCommentMinLength(overallSatisfaction, 'good');
    if (data.good_comment.trim().length < minLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `良かった点は${minLength}文字以上入力してください`,
        path: ['good_comment'],
      });
    }
    // No.24: 総合満足度に応じた文字数チェック
    const minLengthBad = getCommentMinLength(overallSatisfaction, 'bad');
    if (data.bad_comment.trim().length < minLengthBad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `改善してほしい点/合わない点は${minLengthBad}文字以上入力してください`,
        path: ['bad_comment'],
      });
    }
  });

export type SurveyFormData = z.infer<typeof surveySchema>;

export const contestEntrySchema = z
  .object({
    entry_source: z.literal(MY_STORY_AWARD_SOURCE),
    author_type: z.enum(['在校生', '卒業生']),
    pen_name: z.string().trim().min(1, 'サイトに出すときの名前を入力してください').max(40, '40字以内で入力してください'),
    title: z.string().trim().min(1, '作品タイトルを入力してください').max(CONTEST_TEXT_LIMITS.title.max, '作品タイトルは20字以内で入力してください'),
    effort_summary: z.string().trim().min(CONTEST_TEXT_LIMITS.effort_summary.min, `頑張ったことは${CONTEST_TEXT_LIMITS.effort_summary.min}字以上入力してください`),
    before_enrollment: z.string().trim().min(CONTEST_TEXT_LIMITS.before_enrollment.min, `入学前のことは${CONTEST_TEXT_LIMITS.before_enrollment.min}字以上入力してください`),
    after_enrollment: z.string().trim().min(CONTEST_TEXT_LIMITS.after_enrollment.min, `入学後のことは${CONTEST_TEXT_LIMITS.after_enrollment.min}字以上入力してください`),
    learning_and_change: z.string().trim().min(CONTEST_TEXT_LIMITS.learning_and_change.min, `学びや変化は${CONTEST_TEXT_LIMITS.learning_and_change.min}字以上入力してください`),
    future_goal: z.string().trim().optional(),
    current_life: z.string().trim().optional(),
    wants_feedback: z.boolean().default(false),
    publication_consent: z.boolean().refine((value) => value, {
      message: '作品の利用について同意してください',
    }),
    draft_token: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.author_type === '在校生') {
      if (!data.future_goal || data.future_goal.trim().length < CONTEST_TEXT_LIMITS.future_goal.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `これから挑戦したいことは${CONTEST_TEXT_LIMITS.future_goal.min}字以上入力してください`,
          path: ['future_goal'],
        });
      }
    }

    if (data.author_type === '卒業生') {
      if (!data.current_life || data.current_life.trim().length < CONTEST_TEXT_LIMITS.current_life.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `卒業後のことは${CONTEST_TEXT_LIMITS.current_life.min}字以上入力してください`,
          path: ['current_life'],
        });
      }
    }
  });

export type ContestEntryFormData = z.infer<typeof contestEntrySchema>;

/**
 * インポート用スキーマ（CSV一括投入）
 * 通常スキーマと同じ厳密なバリデーションだが、school_id は不要（API側で学校名から解決）
 */
export const surveyImportSchema = baseSchema
  .refine(
    (data) => {
      if (data.status === '卒業した') return !!data.graduation_path;
      return true;
    },
    { message: '卒業後の進路を選択してください', path: ['graduation_path'] }
  )
  .refine(
    (data) => {
      if (data.graduation_path === 'その他') {
        return !!data.graduation_path_other && data.graduation_path_other.trim().length > 0;
      }
      return true;
    },
    { message: 'その他（卒業後の進路）を入力してください', path: ['graduation_path_other'] }
  )
  .refine(
    (data) => {
      if (data.student_atmosphere?.includes('その他')) {
        return !!data.atmosphere_other && data.atmosphere_other.trim().length > 0;
      }
      return true;
    },
    { message: 'その他（生徒の雰囲気）を入力してください', path: ['atmosphere_other'] }
  )
  .superRefine((data, ctx) => {
    const overallSatisfaction = data.overall_satisfaction ? parseInt(data.overall_satisfaction) : undefined;
    const minLength = getCommentMinLength(overallSatisfaction, 'good');
    if (data.good_comment.trim().length < minLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `良かった点は${minLength}文字以上入力してください`,
        path: ['good_comment'],
      });
    }
    const minLengthBad = getCommentMinLength(overallSatisfaction, 'bad');
    if (data.bad_comment.trim().length < minLengthBad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `改善してほしい点/合わない点は${minLengthBad}文字以上入力してください`,
        path: ['bad_comment'],
      });
    }
  });

export type SurveyImportFormData = z.infer<typeof surveyImportSchema>;

