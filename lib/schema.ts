import { z } from 'zod';

// 動的バリデーション用のヘルパー関数
const getCommentMinLength = (overallSatisfaction: number | undefined, field: 'good' | 'bad'): number => {
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
};

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

