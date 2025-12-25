'use client';

import { Control, Controller, FieldValues } from 'react-hook-form';
import { Question } from '@/lib/questions';
import StarRating from './StarRating';
import ChipSelect from './ChipSelect';
import TextAreaWithCounter from './TextAreaWithCounter';

interface QuestionRendererProps {
  question: Question;
  control: Control<any>;
  watch: (name: string) => any;
  errors: any;
}

export default function QuestionRenderer({
  question,
  control,
  watch,
  errors,
}: QuestionRendererProps) {
  // 条件分岐チェック
  const shouldShow = () => {
    if (!question.conditional) return true;
    
    const conditionalValue = watch(question.conditional.field);
    if (Array.isArray(question.conditional.value)) {
      return question.conditional.value.includes(conditionalValue);
    }
    return conditionalValue === question.conditional.value;
  };

  // 「その他」入力欄の表示チェック
  const shouldShowOtherInput = () => {
    // graduation_path_otherの表示チェック
    if (question.id === 'graduation_path') {
      const graduationPath = watch('graduation_path');
      return graduationPath === 'その他';
    }
    // atmosphere_otherの表示チェック
    if (question.id === 'student_atmosphere') {
      const studentAtmosphere = watch('student_atmosphere');
      return Array.isArray(studentAtmosphere) && studentAtmosphere.includes('その他');
    }
    return false;
  };

  if (!shouldShow()) {
    return null;
  }

  const error = errors[question.id];
  const fieldName = question.id;

  return (
    <div className="mb-6">
      <label className={`block font-medium mb-2 ${
        question.id === 'overall_satisfaction' || question.id === 'good_comment' || question.id === 'bad_comment'
          ? 'text-lg font-semibold' 
          : 'text-sm'
      }`}
      style={{ 
        fontFamily: 'var(--ce-font-body)',
        color: 'var(--ce-text)'
      }}>
        {question.label}
        {question.required && <span style={{ color: 'var(--ce-warning)' }} className="ml-1">*</span>}
      </label>
      {/* エラー表示（入力欄の直下に1行だけ表示） */}
      {error && (
        <p className="mb-2 text-sm" style={{ 
          fontFamily: 'var(--ce-font-body)',
          color: 'var(--ce-warning)'
        }}>
          {(() => {
            const errorMessage = error.message || '';
            // 技術的な英語エラーメッセージを自然な日本語に変換
            if (errorMessage.includes('Invalid input') || 
                errorMessage.includes('Invalid option') ||
                errorMessage.includes('expected') || 
                errorMessage.includes('received undefined') || 
                errorMessage.includes('enum') ||
                errorMessage.includes('one of')) {
              // 質問の種類に応じた適切なメッセージを返す
              if (question.type === 'singleSelect' || question.type === 'radio') {
                return 'この項目を選択してください';
              }
              if (question.type === 'multiSelect') {
                return 'この項目を1つ以上選択してください';
              }
              return 'この項目を入力してください';
            }
            if (errorMessage.includes('Required')) {
              return 'この項目は必須です';
            }
            return errorMessage || 'この項目は必須です';
          })()}
        </p>
      )}

      {question.type === 'text' && (
        <Controller
          name={fieldName}
          control={control}
          rules={{ required: question.required }}
          render={({ field }) => (
            <input
              type="text"
              {...field}
              placeholder={question.placeholder}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
              style={{
                borderRadius: 'var(--ce-radius-control)',
                borderColor: error ? 'var(--ce-warning)' : 'var(--ce-border)',
                fontFamily: 'var(--ce-font-body)',
                ...(error ? {} : {
                  '--tw-ring-color': 'var(--ce-primary)'
                } as React.CSSProperties)
              }}
              onFocus={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--ce-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 191, 99, 0.2)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--ce-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            />
          )}
        />
      )}

      {question.type === 'email' && (
        <Controller
          name={fieldName}
          control={control}
          rules={{ required: question.required }}
          render={({ field }) => (
            <input
              type="email"
              {...field}
              placeholder={question.placeholder}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
              style={{
                borderRadius: 'var(--ce-radius-control)',
                borderColor: error ? 'var(--ce-warning)' : 'var(--ce-border)',
                fontFamily: 'var(--ce-font-body)',
                ...(error ? {} : {
                  '--tw-ring-color': 'var(--ce-primary)'
                } as React.CSSProperties)
              }}
              onFocus={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--ce-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 191, 99, 0.2)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = 'var(--ce-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            />
          )}
        />
      )}

      {question.type === 'textarea' && (
        (() => {
          const overallSatisfaction = watch('overall_satisfaction');
          let minLength = 70;
          if (overallSatisfaction) {
            const satisfaction = parseInt(overallSatisfaction);
            if (satisfaction >= 4) {
              minLength = question.id === 'good_comment' ? 100 : 30;
            } else if (satisfaction <= 2) {
              minLength = question.id === 'good_comment' ? 30 : 100;
            } else {
              minLength = 70;
            }
          }
          const currentValue = watch(fieldName) || '';
          const currentLength = currentValue.length;
          
          return (
            <TextAreaWithCounter
              name={fieldName}
              control={control}
              placeholder={question.placeholder}
              minLength={minLength}
              currentLength={currentLength}
              error={error?.message}
            />
          );
        })()
      )}

      {question.type === 'singleSelect' && question.options ? (
        question.id === 'campus_prefecture' || question.id === 'enrollment_year' ? (
          // 都道府県と入学年はプルダウン形式
          <Controller
            name={fieldName}
            control={control}
            rules={{ required: question.required }}
            render={({ field }) => (
              <select
                {...field}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
                style={{
                  borderRadius: 'var(--ce-radius-control)',
                  borderColor: error ? 'var(--ce-warning)' : 'var(--ce-border)',
                  fontFamily: 'var(--ce-font-body)'
                }}
                onFocus={(e) => {
                  if (!error) {
                    e.currentTarget.style.borderColor = 'var(--ce-primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 191, 99, 0.2)';
                  }
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.currentTarget.style.borderColor = 'var(--ce-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <option value="">選択してください</option>
                {question.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        ) : (
          // その他のsingleSelectはラジオボタン形式
          // respondent_roleは横並び、その他はPC2列、スマホ1列
          <Controller
            name={fieldName}
            control={control}
            rules={{ required: question.required }}
            render={({ field }) => (
              <div className={question.id === 'respondent_role'
                ? 'flex gap-2' 
                : 'grid grid-cols-1 md:grid-cols-2 gap-2'
              }>
                {question.options?.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 border rounded-md cursor-pointer ${
                      question.id === 'respondent_role' ? 'flex-1' : ''
                    }`}
                    style={{
                      borderRadius: 'var(--ce-radius-control)',
                      borderColor: 'var(--ce-border)',
                      fontFamily: 'var(--ce-font-body)',
                      color: 'var(--ce-text)',
                      backgroundColor: 'var(--ce-surface)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--ce-bg)';
                      e.currentTarget.style.borderColor = 'var(--ce-muted)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--ce-surface)';
                      e.currentTarget.style.borderColor = 'var(--ce-border)';
                    }}
                  >
                    <input
                      type="radio"
                      {...field}
                      value={option.value}
                      checked={field.value === option.value}
                      className="mr-3"
                    />
                    <span className="text-xs">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
        )
      ) : null}

      {question.type === 'multiSelect' && question.options ? (
        <div>
          <p className="text-xs text-gray-500 mb-3">※複数選択可能</p>
          <ChipSelect
            name={fieldName}
            control={control}
            options={question.options}
            error={error?.message}
            columns={question.id === 'teaching_style' ? 2 : 3}
          />
          {shouldShowOtherInput() && (
            <div className="mt-4">
              <Controller
                name="atmosphere_other"
                control={control}
                rules={{ required: true }}
                render={({ field: otherField }) => (
                  <input
                    type="text"
                    {...otherField}
                    placeholder="その他（生徒の雰囲気）を入力してください"
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      errors.atmosphere_other ? 'border-red-400' : 'border-gray-200'
                    }`}
                  />
                )}
              />
            </div>
          )}
        </div>
      ) : null}

      {question.type === 'radio' && question.options ? (
        // 5段階または6段階評価の満足度設問は星型で表示
        (question.id === 'flexibility_rating' ||
          question.id === 'staff_rating' ||
          question.id === 'support_rating' ||
          question.id === 'atmosphere_fit_rating' ||
          question.id === 'credit_rating' ||
          question.id === 'career_support_rating' ||
          question.id === 'unique_course_rating' ||
          question.id === 'campus_life_rating' ||
          question.id === 'tuition_rating' ||
          question.id === 'overall_satisfaction') &&
        (question.options.length === 5 || question.options.length === 6) ? (
          <Controller
            name={fieldName}
            control={control}
            rules={{ required: question.required }}
            render={({ field }) => {
              const hasNotApplicable = question.options ? question.options.length === 6 : false;
              const notApplicableOption = hasNotApplicable && question.options
                ? question.options.find((opt) => opt.value === '6')
                : null;

              return (
                <div>
                  <StarRating
                    value={field.value}
                    onChange={field.onChange}
                    maxStars={5}
                    hasNotApplicable={hasNotApplicable}
                    notApplicableLabel={notApplicableOption?.label || '該当なし'}
                  />
                </div>
              );
            }}
          />
        ) : (
          // その他のradio設問はラジオボタンで表示（PC2列、スマホ1列）
          <Controller
            name={fieldName}
            control={control}
            rules={{ required: question.required }}
            render={({ field }) => (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {question.options?.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center p-3 border rounded-md cursor-pointer"
                    style={{
                      borderRadius: 'var(--ce-radius-control)',
                      borderColor: 'var(--ce-border)',
                      fontFamily: 'var(--ce-font-body)',
                      color: 'var(--ce-text)',
                      backgroundColor: 'var(--ce-surface)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--ce-bg)';
                      e.currentTarget.style.borderColor = 'var(--ce-muted)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--ce-surface)';
                      e.currentTarget.style.borderColor = 'var(--ce-border)';
                    }}
                  >
                    <input
                      type="radio"
                      {...field}
                      value={option.value}
                      checked={field.value === option.value}
                      className="mr-3"
                    />
                    <span className="text-xs">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
        )
      ) : null}

      {/* エラー表示は各コンポーネント内で処理（Step3の改善のため） */}

      {/* 「その他」入力欄（graduation_path_other用） */}
      {shouldShowOtherInput() && question.id === 'graduation_path' && (
        <div className="mt-3">
          <Controller
            name="graduation_path_other"
            control={control}
            rules={{ required: true }}
            render={({ field: otherField }) => (
              <input
                type="text"
                {...otherField}
                placeholder="その他（卒業後の進路）を入力してください"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
                style={{
                  borderRadius: 'var(--ce-radius-control)',
                  borderColor: errors.graduation_path_other ? 'var(--ce-warning)' : 'var(--ce-border)',
                  fontFamily: 'var(--ce-font-body)'
                }}
                onFocus={(e) => {
                  if (!errors.graduation_path_other) {
                    e.currentTarget.style.borderColor = 'var(--ce-primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 191, 99, 0.2)';
                  }
                }}
                onBlur={(e) => {
                  if (!errors.graduation_path_other) {
                    e.currentTarget.style.borderColor = 'var(--ce-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

