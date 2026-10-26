'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { apiPath, appPath } from '@/lib/base-path';
import {
  CONTEST_CHAPTERS,
  CONTEST_REVIEW_INTRO,
  CONTEST_STORAGE_KEY,
  CONTEST_TEXT_LIMITS,
  MY_STORY_AWARD_DEADLINE_LABEL,
  MY_STORY_AWARD_SOURCE,
} from '@/lib/contest/copy';
import { getCommentMinLength } from '@/lib/schema';
import { questions } from '@/lib/questions';
import SchoolAutocomplete from '@/components/SchoolAutocomplete';

type FormValues = Record<string, string | string[] | boolean | null | undefined>;

const q = (id: string) => questions.find((question) => question.id === id);
const optionList = (id: string) => q(id)?.options ?? [];

const steps = [
  { chapter: CONTEST_CHAPTERS.story, title: 'まずは、あなたのことを教えてください', time: '1分', fields: ['author_type', 'pen_name', 'email'] },
  { chapter: CONTEST_CHAPTERS.story, title: 'タイトルと、頑張ったこと', time: '3分', fields: ['title', 'effort_summary'] },
  { chapter: CONTEST_CHAPTERS.story, title: '入学前は、どんな気持ちでしたか？', time: '3分', fields: ['before_enrollment'] },
  { chapter: CONTEST_CHAPTERS.story, title: '入学後、どんな変化がありましたか？', time: '3分', fields: ['after_enrollment'] },
  { chapter: CONTEST_CHAPTERS.story, title: 'この経験で学んだこと', time: '3分', fields: ['learning_and_change', 'future_goal', 'current_life'] },
  { chapter: CONTEST_CHAPTERS.review, title: '通っている学校のこと', time: '2分', fields: ['school_name', 'school_id', 'reason_for_choosing', 'course', 'enrollment_type', 'enrollment_year', 'graduation_path', 'graduation_path_other'] },
  { chapter: CONTEST_CHAPTERS.review, title: '通い方や授業のこと', time: '2分', fields: ['attendance_frequency', 'campus_prefecture', 'campus_city', 'teaching_style', 'student_atmosphere', 'atmosphere_other'] },
  { chapter: CONTEST_CHAPTERS.review, title: '学校の評価 前半', time: '1分', fields: ['flexibility_rating', 'staff_rating', 'support_rating', 'atmosphere_fit_rating', 'credit_rating'] },
  { chapter: CONTEST_CHAPTERS.review, title: '学校の評価 後半', time: '1分', fields: ['unique_course_rating', 'career_support_rating', 'campus_life_rating', 'tuition_rating', 'overall_satisfaction'] },
  { chapter: CONTEST_CHAPTERS.review, title: '通ってよかったこと', time: '2分', fields: ['good_comment'] },
  { chapter: CONTEST_CHAPTERS.review, title: '気になる点や、合わないかもしれない点', time: '2分', fields: ['bad_comment'] },
  { chapter: CONTEST_CHAPTERS.confirm, title: '送る前の確認', time: '1分', fields: ['wants_feedback', 'publication_consent'] },
] as const;

const defaultValues: FormValues = {
  author_type: '在校生',
  respondent_role: '本人',
  status: '在籍中',
  school_name: '',
  school_id: '',
  school_name_input: '',
  reason_for_choosing: [],
  teaching_style: [],
  student_atmosphere: [],
  wants_feedback: false,
  publication_consent: false,
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function charCount(value: unknown) {
  return String(value ?? '').trim().length;
}

function stringValue(value: FormValues[string]): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function HelpBox({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-sm text-sky-950">
      <summary className="cursor-pointer font-bold">書き方の例を見る</summary>
      <div className="mt-2 leading-relaxed">{children}</div>
    </details>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{message}</p>;
}

function Counter({ value, min, max, target }: { value: unknown; min?: number; max?: number; target?: number }) {
  const count = charCount(value);
  const below = min !== undefined && count < min;
  const over = max !== undefined && count > max;
  const suffix = max ? ` / ${max}字` : min ? ` / ${min}字以上${target ? `（目安${target}字）` : ''}` : `${count}字`;
  return (
    <div className={classNames('mt-1 text-right text-xs font-bold', below || over ? 'text-rose-600' : 'text-sky-700')}>
      {max ? `${count}${suffix}` : `${count}${suffix}`}
      {below && <span className="ml-2">あと{min - count}字で次へ進めます</span>}
    </div>
  );
}

function TextInput({
  label,
  name,
  register,
  error,
  placeholder,
  required,
  maxLength,
  watchValue,
}: {
  label: string;
  name: string;
  register: ReturnType<typeof useForm>['register'];
  error?: string;
  placeholder?: string;
  required?: string;
  maxLength?: number;
  watchValue?: unknown;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-lg font-black text-slate-900">{label}</label>
      <input
        id={name}
        {...register(name, { required, maxLength: maxLength ? { value: maxLength, message: `${maxLength}字以内で入力してください` } : undefined })}
        placeholder={placeholder}
        className="mt-3 w-full rounded-3xl border-2 border-sky-100 bg-white px-5 py-4 text-base outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
      {maxLength && <Counter value={watchValue} max={maxLength} />}
      <FieldError message={error} />
    </div>
  );
}

function TextAreaField({
  label,
  note,
  name,
  register,
  watchValue,
  error,
  min,
  target,
  rows = 8,
  children,
}: {
  label: string;
  note: string;
  name: string;
  register: ReturnType<typeof useForm>['register'];
  watchValue: unknown;
  error?: string;
  min: number;
  target?: number;
  rows?: number;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-2xl font-black text-slate-900">{label}</label>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
      <textarea
        id={name}
        {...register(name, {
          required: 'この項目を入力してください',
          validate: (value) => charCount(value) >= min || `あと${min - charCount(value)}字で次へ進めます`,
        })}
        rows={rows}
        className="mt-4 w-full rounded-[28px] border-2 border-sky-100 bg-white px-5 py-4 text-base leading-relaxed outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
      <Counter value={watchValue} min={min} target={target} />
      <FieldError message={error} />
      {children}
    </div>
  );
}

function ButtonSelect({
  name,
  control,
  options,
  columns = 'sm:grid-cols-2',
  required = 'この項目を選択してください',
}: {
  name: string;
  control: ReturnType<typeof useForm>['control'];
  options: Array<{ label: string; value: string }>;
  columns?: string;
  required?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required }}
      render={({ field }) => (
        <div className={classNames('grid grid-cols-1 gap-3', columns)}>
          {options.map((option) => {
            const selected = field.value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => field.onChange(option.value)}
                className={classNames(
                  'rounded-3xl border-2 px-4 py-3 text-left text-sm font-bold transition',
                  selected ? 'border-sky-500 bg-sky-100 text-sky-950 shadow-sm' : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    />
  );
}

function MultiButtonSelect({
  name,
  control,
  options,
}: {
  name: string;
  control: ReturnType<typeof useForm>['control'];
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ validate: (value) => (Array.isArray(value) && value.length > 0) || '1つ以上選んでください' }}
      render={({ field }) => {
        const value: string[] = Array.isArray(field.value) ? field.value : [];
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const selected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    field.onChange(selected ? value.filter((item) => item !== option.value) : [...value, option.value]);
                  }}
                  className={classNames(
                    'rounded-3xl border-2 px-4 py-3 text-left text-sm font-bold transition',
                    selected ? 'border-sky-500 bg-sky-100 text-sky-950 shadow-sm' : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      }}
    />
  );
}

function SelectField({
  name,
  label,
  control,
  options,
  error,
}: {
  name: string;
  label: string;
  control: ReturnType<typeof useForm>['control'];
  options: Array<{ label: string; value: string }>;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-lg font-black text-slate-900">{label}</label>
      <Controller
        name={name}
        control={control}
        rules={{ required: 'この項目を選択してください' }}
        render={({ field }) => (
          <select
            id={name}
            {...field}
            className="mt-3 w-full rounded-3xl border-2 border-sky-100 bg-white px-5 py-4 text-base outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option value="">選択してください</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
      />
      <FieldError message={error} />
    </div>
  );
}

export default function MyStoryAwardForm() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showPause, setShowPause] = useState(false);
  const [resumeMailSent, setResumeMailSent] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues, mode: 'onBlur' });

  const values = watch();
  const authorType = watch('author_type');
  const overallSatisfaction = Number(watch('overall_satisfaction') || 0) || undefined;
  const goodMin = getCommentMinLength(overallSatisfaction, 'good');
  const badMin = getCommentMinLength(overallSatisfaction, 'bad');
  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  useEffect(() => {
    if (authorType === '卒業生') setValue('status', '卒業した');
    if (authorType === '在校生') setValue('status', '在籍中');
    setValue('respondent_role', '本人');
  }, [authorType, setValue]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('draft');
    if (token) {
      fetch(apiPath(`/api/contest/drafts?token=${encodeURIComponent(token)}`))
        .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
          if (!ok) throw new Error(json.error ?? '下書きを開けませんでした');
          setDraftToken(json.draft.token);
          reset({ ...defaultValues, ...(json.draft.payload ?? {}) });
          setSaveStatus('saved');
        })
        .catch((error) => alert(error instanceof Error ? error.message : '下書きを開けませんでした'));
      return;
    }

    try {
      const stored = localStorage.getItem(CONTEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.payload && confirm('書きかけの応募があります。続きから書きますか？')) {
          reset({ ...defaultValues, ...parsed.payload });
          setDraftToken(parsed.token ?? null);
          setSaveStatus('saved');
        }
      }
    } catch {
      // localStorage が使えない環境では無視
    }
  }, [reset]);

  const saveDraft = useCallback(async (payload: FormValues, token: string | null, email: string | undefined) => {
    try {
      setSaveStatus('saving');
      if (!token && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const res = await fetch(apiPath('/api/contest/drafts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? '下書きを保存できませんでした');
        setDraftToken(json.draft.token);
        localStorage.setItem(CONTEST_STORAGE_KEY, JSON.stringify({ token: json.draft.token, payload }));
      } else if (token) {
        const res = await fetch(apiPath('/api/contest/drafts'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email, payload }),
        });
        if (!res.ok) throw new Error('下書きを保存できませんでした');
      }
      localStorage.setItem(CONTEST_STORAGE_KEY, JSON.stringify({ token, payload }));
      setSaveStatus('saved');
    } catch (error) {
      console.error('[contest draft] save failed:', error);
      setSaveStatus('error');
    }
  }, []);

  useEffect(() => {
    if (submitted) return;
    const payload = getValues();
    try {
      localStorage.setItem(CONTEST_STORAGE_KEY, JSON.stringify({ token: draftToken, payload }));
      setSaveStatus('saved');
    } catch {
      // ignore
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(payload, draftToken, stringValue(payload.email));
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [values, draftToken, getValues, saveDraft, submitted]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!submitted && isDirty) {
        event.preventDefault();
        event.returnValue = '下書きは残っています。このページを離れますか？';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, submitted]);

  const visibleFields = useMemo(() => {
    const fields = [...currentStep.fields];
    if (authorType === '在校生') return fields.filter((field) => field !== 'current_life' && field !== 'graduation_path' && field !== 'graduation_path_other');
    if (authorType === '卒業生') return fields.filter((field) => field !== 'future_goal');
    return fields;
  }, [authorType, currentStep.fields]);

  const goNext = async () => {
    const extra = [];
    const studentAtmosphere = watch('student_atmosphere');
    if (stepIndex === 5 && watch('graduation_path') === 'その他') extra.push('graduation_path_other');
    if (stepIndex === 6 && Array.isArray(studentAtmosphere) && studentAtmosphere.includes('その他')) extra.push('atmosphere_other');
    const ok = await trigger([...visibleFields, ...extra]);
    if (!ok) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendResumeEmail = async () => {
    const payload = getValues();
    const email = stringValue(payload.email);
    if (!email) {
      alert('先にメールアドレスを入力してください');
      return;
    }
    let token = draftToken;
    if (!token) {
      await saveDraft(payload, null, email);
      token = draftToken;
    }
    const latestToken = token ?? JSON.parse(localStorage.getItem(CONTEST_STORAGE_KEY) || '{}')?.token;
    if (!latestToken) {
      alert('下書きの準備中です。少し待ってからもう一度お試しください。');
      return;
    }
    const res = await fetch(apiPath('/api/contest/drafts'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: latestToken, email, payload, action: 'send_resume_email' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'メールを送れませんでした');
      return;
    }
    setResumeMailSent(true);
  };

  const submit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const body = {
        ...data,
        respondent_role: '本人',
        status: data.author_type === '卒業生' ? '卒業した' : '在籍中',
        contest_entry: {
          entry_source: MY_STORY_AWARD_SOURCE,
          author_type: data.author_type,
          pen_name: data.pen_name,
          title: data.title,
          effort_summary: data.effort_summary,
          before_enrollment: data.before_enrollment,
          after_enrollment: data.after_enrollment,
          learning_and_change: data.learning_and_change,
          future_goal: data.future_goal,
          current_life: data.current_life,
          wants_feedback: Boolean(data.wants_feedback),
          publication_consent: Boolean(data.publication_consent),
          draft_token: draftToken ?? undefined,
        },
      };
      const res = await fetch(apiPath('/api/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? '応募の送信に失敗しました');
      localStorage.removeItem(CONTEST_STORAGE_KEY);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      alert(error instanceof Error ? error.message : '応募の送信に失敗しました');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#eefdff] bg-[linear-gradient(rgba(14,165,233,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.12)_1px,transparent_1px)] bg-[size:22px_22px] px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-[36px] border-4 border-sky-200 bg-white p-8 text-center shadow-xl">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-slate-900">応募を受け付けました</p>
          <h1 className="text-3xl font-black text-sky-900">あなたのストーリーを送ってくれてありがとう</h1>
          <div className="mt-6 space-y-3 text-left text-slate-700">
            <p>口コミは確認後、学校を選ぶ人の参考として公開されます。</p>
            <p>200円分のQUOカードPayは、承認後に1回お届けします。</p>
            <p>作品は自動では公開されません。公開同意の範囲で、後日編集して使います。</p>
          </div>
          <Link href={appPath('/')} className="mt-8 inline-flex rounded-full bg-sky-500 px-6 py-3 font-black text-white">トップへ戻る</Link>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="space-y-8">
            <div>
              <p className="mb-3 text-sm font-bold text-sky-700">あなたはどちらですか？</p>
              <ButtonSelect name="author_type" control={control} options={[{ label: '在校生', value: '在校生' }, { label: '卒業生', value: '卒業生' }]} />
              <FieldError message={errors.author_type?.message as string} />
            </div>
            <TextInput label="サイトに出すときの名前" name="pen_name" register={register} error={errors.pen_name?.message as string} placeholder="例：みなと、卒業生A" required="サイトに出すときの名前を入力してください" />
            <TextInput label="連絡用メールアドレス" name="email" register={register} error={errors.email?.message as string} placeholder="example@email.com" required="メールアドレスを入力してください" />
          </div>
        );
      case 1:
        return (
          <div className="space-y-8">
            <TextInput label="作品タイトル" name="title" register={register} error={errors.title?.message as string} placeholder="20字以内" required="作品タイトルを入力してください" maxLength={20} watchValue={watch('title')} />
            <TextAreaField label="高校生活で頑張ったこと" note="最初は短くて大丈夫です。どんなことに取り組んだのか、あなたの言葉で書いてください。" name="effort_summary" register={register} watchValue={watch('effort_summary')} error={errors.effort_summary?.message as string} min={CONTEST_TEXT_LIMITS.effort_summary.min} target={CONTEST_TEXT_LIMITS.effort_summary.target} rows={5}>
              <HelpBox>例：週3日の通学とアルバイトを両立した、イラストの作品づくりを続けた、レポートを自分のペースで進められるようになった、など。</HelpBox>
            </TextAreaField>
          </div>
        );
      case 2:
        return <TextAreaField label="入学前のこと" note="通信制高校を考えていた頃の状況、不安、期待を書いてください。" name="before_enrollment" register={register} watchValue={watch('before_enrollment')} error={errors.before_enrollment?.message as string} min={CONTEST_TEXT_LIMITS.before_enrollment.min} target={CONTEST_TEXT_LIMITS.before_enrollment.target}><HelpBox>例：学校に通うペース、人間関係、勉強への不安、もう一度やってみたい気持ちなど。</HelpBox></TextAreaField>;
      case 3:
        return <TextAreaField label="入学後のこと" note="生活や学び方、考え方がどう変わったかを書いてください。" name="after_enrollment" register={register} watchValue={watch('after_enrollment')} error={errors.after_enrollment?.message as string} min={CONTEST_TEXT_LIMITS.after_enrollment.min} target={CONTEST_TEXT_LIMITS.after_enrollment.target}><HelpBox>例：登校のペース、先生との関わり、レポート、友人、趣味やアルバイトとの両立など。</HelpBox></TextAreaField>;
      case 4:
        return (
          <div className="space-y-8">
            <TextAreaField label="学んだことや変化したこと" note="この経験を通じて、自分の考え方や将来への気持ちがどう変わったかを書いてください。" name="learning_and_change" register={register} watchValue={watch('learning_and_change')} error={errors.learning_and_change?.message as string} min={CONTEST_TEXT_LIMITS.learning_and_change.min} target={CONTEST_TEXT_LIMITS.learning_and_change.target} />
            {authorType === '在校生' ? (
              <TextAreaField label="これから挑戦してみたいこと" note="小さな目標でも大丈夫です。これからやってみたいことを書いてください。" name="future_goal" register={register} watchValue={watch('future_goal')} error={errors.future_goal?.message as string} min={CONTEST_TEXT_LIMITS.future_goal.min} target={CONTEST_TEXT_LIMITS.future_goal.target} rows={5} />
            ) : (
              <TextAreaField label="卒業後の今の生活" note="進学、就職、休養など、卒業後の過ごし方を書いてください。" name="current_life" register={register} watchValue={watch('current_life')} error={errors.current_life?.message as string} min={CONTEST_TEXT_LIMITS.current_life.min} target={CONTEST_TEXT_LIMITS.current_life.target} rows={5} />
            )}
            <div className="rounded-3xl bg-yellow-100 p-4 text-sm font-bold text-slate-800">ストーリーはここまで。次は学校のことを少し教えてください。</div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-7">
            <p className="rounded-3xl bg-sky-50 p-4 text-sm font-bold text-sky-900">{CONTEST_REVIEW_INTRO}</p>
            <div>
              <label className="mb-3 block text-lg font-black text-slate-900">学校名</label>
              <SchoolAutocomplete control={control} name="school_name" setValue={setValue} placeholder="学校名を入力してください" error={errors.school_id || errors.school_name} required />
              <FieldError message={(errors.school_id?.message || errors.school_name?.message) as string} />
            </div>
            <div>
              <p className="mb-3 text-lg font-black text-slate-900">通信制を選んだ理由</p>
              <MultiButtonSelect name="reason_for_choosing" control={control} options={optionList('reason_for_choosing')} />
              <FieldError message={errors.reason_for_choosing?.message as string} />
            </div>
            <TextInput label="在籍していたコース（任意）" name="course" register={register} placeholder="例：普通科、進学コース" />
            <div>
              <p className="mb-3 text-lg font-black text-slate-900">入学タイミング</p>
              <ButtonSelect name="enrollment_type" control={control} options={optionList('enrollment_type')} />
              <FieldError message={errors.enrollment_type?.message as string} />
            </div>
            <SelectField name="enrollment_year" label="入学年" control={control} options={optionList('enrollment_year')} error={errors.enrollment_year?.message as string} />
            {authorType === '卒業生' && (
              <>
                <div>
                  <p className="mb-3 text-lg font-black text-slate-900">卒業後の進路</p>
                  <ButtonSelect name="graduation_path" control={control} options={optionList('graduation_path')} />
                  <FieldError message={errors.graduation_path?.message as string} />
                </div>
                {watch('graduation_path') === 'その他' && (
                  <TextInput label="その他の進路" name="graduation_path_other" register={register} error={errors.graduation_path_other?.message as string} required="その他の進路を入力してください" />
                )}
              </>
            )}
          </div>
        );
      case 6:
        const studentAtmosphere = watch('student_atmosphere');
        return (
          <div className="space-y-7">
            <div>
              <p className="mb-3 text-lg font-black text-slate-900">主な通学頻度</p>
              <ButtonSelect name="attendance_frequency" control={control} options={optionList('attendance_frequency')} />
              <FieldError message={errors.attendance_frequency?.message as string} />
            </div>
            <SelectField name="campus_prefecture" label="主に通っていたキャンパス都道府県" control={control} options={optionList('campus_prefecture')} error={errors.campus_prefecture?.message as string} />
            <TextInput label="キャンパスの市区町村（任意）" name="campus_city" register={register} placeholder="例：名古屋市中村区" />
            <div>
              <p className="mb-3 text-lg font-black text-slate-900">授業スタイル</p>
              <MultiButtonSelect name="teaching_style" control={control} options={optionList('teaching_style')} />
              <FieldError message={errors.teaching_style?.message as string} />
            </div>
            <div>
              <p className="mb-3 text-lg font-black text-slate-900">生徒の雰囲気</p>
              <MultiButtonSelect name="student_atmosphere" control={control} options={optionList('student_atmosphere')} />
              <FieldError message={errors.student_atmosphere?.message as string} />
            </div>
            {Array.isArray(studentAtmosphere) && studentAtmosphere.includes('その他') && (
              <TextInput label="その他の雰囲気" name="atmosphere_other" register={register} error={errors.atmosphere_other?.message as string} required="その他の雰囲気を入力してください" />
            )}
          </div>
        );
      case 7:
      case 8: {
        const ratingFields = stepIndex === 7
          ? ['flexibility_rating', 'staff_rating', 'support_rating', 'atmosphere_fit_rating', 'credit_rating']
          : ['unique_course_rating', 'career_support_rating', 'campus_life_rating', 'tuition_rating', 'overall_satisfaction'];
        return (
          <div className="space-y-6">
            {ratingFields.map((field) => (
              <div key={field}>
                <p className="mb-3 text-lg font-black text-slate-900">{q(field)?.label}</p>
                <ButtonSelect name={field} control={control} options={optionList(field)} columns="sm:grid-cols-3" />
                <FieldError message={errors[field]?.message as string} />
              </div>
            ))}
          </div>
        );
      }
      case 9:
        return <TextAreaField label="この学校に通って良かった点" note="学校を選ぶ人がイメージしやすいよう、具体的に書いてください。" name="good_comment" register={register} watchValue={watch('good_comment')} error={errors.good_comment?.message as string} min={goodMin} rows={7} />;
      case 10:
        return <TextAreaField label="気になる点や、合わないかもしれない点" note="良い点だけでなく、合う・合わないを考える参考になる内容も大切です。" name="bad_comment" register={register} watchValue={watch('bad_comment')} error={errors.bad_comment?.message as string} min={badMin} rows={7} />;
      default:
        return (
          <div className="space-y-6">
            <label className="flex items-start gap-3 rounded-3xl bg-sky-50 p-4">
              <input type="checkbox" {...register('wants_feedback')} className="mt-1 h-5 w-5" />
              <span className="text-sm font-bold text-slate-800">審査結果に関わらず、審査員からの個別フィードバックを希望します</span>
            </label>
            <label className="flex items-start gap-3 rounded-3xl bg-yellow-100 p-4">
              <input type="checkbox" {...register('publication_consent', { required: '作品の利用について同意してください' })} className="mt-1 h-5 w-5" />
              <span className="text-sm font-bold text-slate-800">応募した作品を、通信制高校の多様な学び方を伝えるコンテンツとして使うことに同意します。作品は自動公開されず、公開時は内容を確認・編集します。</span>
            </label>
            <FieldError message={errors.publication_consent?.message as string} />
            <div className="rounded-[28px] border-2 border-sky-100 bg-white p-5 text-sm text-slate-700">
              <p className="font-black text-slate-900">送る前に</p>
              <p className="mt-2">口コミは確認後に公開されます。作品は自動では公開されません。200円分のQUOカードPayは、承認後に1回届きます。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#eefdff] bg-[linear-gradient(rgba(14,165,233,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.12)_1px,transparent_1px)] bg-[size:22px_22px] pb-32">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={appPath('/my-story-award')} className="mb-5 inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-sky-700 shadow-sm">募集ページへ戻る</Link>
        <div className="rounded-[36px] border-4 border-sky-200 bg-white/95 p-5 shadow-xl sm:p-8">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black text-sky-700">
              <span>{currentStep.chapter} {stepIndex + 1}/{steps.length}</span>
              <span>{currentStep.time}くらい</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-sky-100">
              <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <h1 className="mt-6 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{currentStep.title}</h1>
          </div>

          {showPause ? (
            <div className="rounded-[30px] bg-yellow-100 p-6">
              <h2 className="text-2xl font-black text-slate-900">ここまでの内容は下書きとして残っています</h2>
              <p className="mt-3 text-sm font-bold text-slate-700">期限は{MY_STORY_AWARD_DEADLINE_LABEL}です。</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>今の端末で続きを書く場合は、もう一度このページを開いてください。</li>
                <li>別の端末で続きを書く場合は、続きのリンクをメールで受け取れます。</li>
              </ul>
              {resumeMailSent ? (
                <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-sky-800">再開リンクをメールで送りました。</p>
              ) : (
                <button type="button" onClick={sendResumeEmail} className="mt-6 rounded-full bg-sky-500 px-6 py-3 font-black text-white shadow-md">続きのリンクをメールで受け取る</button>
              )}
              <button type="button" onClick={() => setShowPause(false)} className="ml-0 mt-3 block rounded-full bg-white px-5 py-2 text-sm font-black text-sky-700 sm:ml-3 sm:inline-block">入力に戻る</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)}>{renderStep()}</form>
          )}
        </div>
      </main>

      {!showPause && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-100 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(14,165,233,0.14)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button type="button" onClick={goBack} disabled={stepIndex === 0} className="rounded-full bg-sky-50 px-5 py-3 text-sm font-black text-sky-700 disabled:opacity-40">もどる</button>
            <button type="button" onClick={() => setShowPause(true)} className="hidden rounded-full bg-white px-4 py-3 text-sm font-black text-slate-500 sm:block">あとで続きから</button>
            <div className="min-w-0 flex-1 text-center text-xs font-bold text-slate-500">
              {saveStatus === 'saving' ? '保存しています' : saveStatus === 'error' ? '保存に失敗しました' : '保存済み'}
            </div>
            {stepIndex === steps.length - 1 ? (
              <button type="button" onClick={handleSubmit(submit)} disabled={isSubmitting} className="rounded-full bg-yellow-300 px-5 py-3 text-sm font-black text-slate-950 shadow-md disabled:opacity-60">この内容で応募する</button>
            ) : (
              <button type="button" onClick={goNext} className="rounded-full bg-yellow-300 px-6 py-3 text-sm font-black text-slate-950 shadow-md">つぎへ</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
