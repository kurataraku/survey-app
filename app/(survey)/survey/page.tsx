'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { surveySchema, SurveyFormData } from '@/lib/schema';
import { questions } from '@/lib/questions';
import { apiPath } from '@/lib/base-path';
import Stepper from '@/components/Stepper';
import QuestionRenderer from '@/components/QuestionRenderer';
import Button from '@/components/ui/Button';
import CampaignBanner from '@/components/CampaignBanner';

export default function SurveyPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const submittedMessageRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    trigger,
    setValue,
  } = useForm<SurveyFormData>({
    resolver: zodResolver(surveySchema),
    mode: 'onBlur',
    defaultValues: {
      school_name: '',
      reason_for_choosing: [],
      teaching_style: [],
      student_atmosphere: [],
    },
  });

  const currentStepQuestions = questions.filter((q) => q.step === currentStep);

  const getStepForField = (fieldName: string): number => {
    const question = questions.find((q) => q.id === fieldName);
    if (question) {
      return question.step;
    }
    if (fieldName === 'school_id') {
      return 1;
    }
    if (fieldName === 'graduation_path_other') {
      return 1;
    }
    if (fieldName === 'atmosphere_other') {
      return 2;
    }
    return currentStep;
  };

  const shouldShowQuestion = (question: typeof questions[0]): boolean => {
    if (!question.conditional) return true;

    const conditionalValue = watch(question.conditional.field as any);
    if (Array.isArray(question.conditional.value)) {
      return question.conditional.value.includes(conditionalValue);
    }
    return conditionalValue === question.conditional.value;
  };

  const handleNext = async () => {
    const visibleQuestions = currentStepQuestions.filter((q) => {
      if (q.id === 'course') return false;
      return shouldShowQuestion(q);
    });

    const fieldsToValidate = visibleQuestions
      .filter((q) => q.required)
      .map((q) => q.id);

    const status = watch('status');
    const graduationPath = watch('graduation_path');
    const studentAtmosphere = watch('student_atmosphere');

    if (status === '卒業した' && graduationPath === 'その他') {
      fieldsToValidate.push('graduation_path_other');
    }

    if (Array.isArray(studentAtmosphere) && studentAtmosphere.includes('その他')) {
      fieldsToValidate.push('atmosphere_other');
    }

    const schoolName = watch('school_name');
    if (schoolName && schoolName.trim().length > 0) {
      fieldsToValidate.push('school_id');
    }

    const isValid = await trigger(fieldsToValidate as any);

    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (!isValid) {
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const errorStep = getStepForField(firstErrorField);

        if (errorStep !== currentStep) {
          setCurrentStep(errorStep);
          setTimeout(() => {
            const scrollToErrorField = () => {
              const fieldNameToFind = firstErrorField === 'school_id' ? 'school_name' : firstErrorField;
              const errorElement = document.querySelector(`[name="${fieldNameToFind}"]`) as HTMLElement;
              const errorContainer = document.querySelector(`[data-question-id="${fieldNameToFind}"]`) as HTMLElement;

              if (errorElement || errorContainer) {
                const targetElement = errorContainer || errorElement;
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (errorElement) {
                  setTimeout(() => {
                    errorElement.focus();
                    if (errorContainer) {
                      errorContainer.style.transition = 'all 0.3s ease';
                      errorContainer.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                      setTimeout(() => {
                        errorContainer.style.backgroundColor = '';
                      }, 2000);
                    }
                  }, 300);
                }
              }
            };

            scrollToErrorField();
            setTimeout(scrollToErrorField, 200);
            setTimeout(scrollToErrorField, 500);
          }, 100);
        } else {
          const fieldNameToFind = firstErrorField === 'school_id' ? 'school_name' : firstErrorField;
          const errorElement = document.querySelector(`[name="${fieldNameToFind}"]`) as HTMLElement;
          const errorContainer = document.querySelector(`[data-question-id="${fieldNameToFind}"]`) as HTMLElement;

          if (errorElement || errorContainer) {
            const targetElement = errorContainer || errorElement;
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (errorElement) {
              setTimeout(() => {
                errorElement.focus();
                if (errorContainer) {
                  errorContainer.style.transition = 'all 0.3s ease';
                  errorContainer.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                  setTimeout(() => {
                    errorContainer.style.backgroundColor = '';
                  }, 2000);
                }
              }, 300);
            }
          }
        }
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: SurveyFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(apiPath('/api/submit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('非JSONレスポンス:', text);
        throw new Error('サーバーから予期しない形式のレスポンスが返されました。環境変数が正しく設定されているか確認してください。');
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || '送信に失敗しました');
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('送信エラー:', error);
      alert(error instanceof Error ? error.message : '送信に失敗しました。もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSubmitted) {
      const scrollToMessage = () => {
        if (submittedMessageRef.current) {
          submittedMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        const messageElement = document.getElementById('submitted-message');
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      };

      scrollToMessage();
      setTimeout(() => scrollToMessage(), 100);
      setTimeout(() => scrollToMessage(), 300);
      setTimeout(() => scrollToMessage(), 600);
      setTimeout(() => scrollToMessage(), 1000);
    }
  }, [isSubmitted]);

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div id="submitted-message" ref={submittedMessageRef} className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'sans-serif' }}>回答ありがとうございました！</h1>
          <p className="text-gray-700 mb-6 leading-relaxed" style={{ fontFamily: 'sans-serif' }}>
            あなたの体験談が通信制高校を検討されている方々にとって
            <br />
            とても大切な情報となります。
            <br />
            貴重なご協力、本当にありがとうございました！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 text-center">
              <span className="font-semibold">匿名で回答できます</span> • 所要時間: 約3〜5分
            </p>
            <p className="text-xs text-blue-600 text-center mt-1">
              ※個人が特定される内容は書かないでください
            </p>
          </div>

          <CampaignBanner />

          <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">
            口コミアンケートにご協力ください
          </h1>
          <p className="text-center mb-8 leading-relaxed text-gray-700">
            あなたの経験のシェアが、次に悩む人の力になります。
          </p>

          <Stepper currentStep={currentStep} totalSteps={3} />

          <form onSubmit={handleSubmit(onSubmit, (errs) => {
            const firstErrorField = Object.keys(errs)[0];
            if (firstErrorField) {
              setTimeout(() => {
                let errorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
                if (!errorElement) {
                  errorElement = document.querySelector(`#${firstErrorField}`) as HTMLElement;
                }
                if (!errorElement) {
                  const label = document.querySelector(`label[for="${firstErrorField}"]`);
                  if (label) {
                    errorElement = label.nextElementSibling as HTMLElement;
                  }
                }
                if (errorElement) {
                  errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  errorElement.focus();
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }, 100);
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          })}>
            <div className="space-y-6">
              {currentStep === 3 && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-900">
                    ここまでで2/3完了。あと1〜2分
                  </p>
                </div>
              )}

              {currentStep === 2 && (() => {
                const teachingStyleQuestion = currentStepQuestions.find(q => q.id === 'teaching_style');
                const studentAtmosphereQuestion = currentStepQuestions.find(q => q.id === 'student_atmosphere');
                const otherQuestions = currentStepQuestions.filter(q =>
                  q.id !== 'teaching_style' && q.id !== 'student_atmosphere' && q.id !== 'atmosphere_other'
                );
                const atmosphereOtherQuestion = currentStepQuestions.find(q => q.id === 'atmosphere_other');

                return (
                  <>
                    {otherQuestions.map((question) => (
                      <QuestionRenderer
                        key={question.id}
                        question={question}
                        control={control}
                        watch={watch}
                        errors={errors}
                        setValue={setValue}
                      />
                    ))}

                    {teachingStyleQuestion && (
                      <div className="bg-white rounded-lg">
                        <QuestionRenderer
                          question={teachingStyleQuestion}
                          control={control}
                          watch={watch}
                          errors={errors}
                          setValue={setValue}
                        />
                      </div>
                    )}

                    {studentAtmosphereQuestion && (
                      <div className="bg-white rounded-lg">
                        <QuestionRenderer
                          question={studentAtmosphereQuestion}
                          control={control}
                          watch={watch}
                          errors={errors}
                          setValue={setValue}
                        />
                        {atmosphereOtherQuestion && shouldShowQuestion(atmosphereOtherQuestion) && (
                          <div className="mt-4">
                            <QuestionRenderer
                              question={atmosphereOtherQuestion}
                              control={control}
                              watch={watch}
                              errors={errors}
                              setValue={setValue}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {currentStep === 3 && (() => {
                const learningQuestions = currentStepQuestions.filter(q =>
                  ['flexibility_rating', 'credit_rating', 'unique_course_rating'].includes(q.id)
                );
                const supportQuestions = currentStepQuestions.filter(q =>
                  ['staff_rating', 'support_rating', 'career_support_rating'].includes(q.id)
                );
                const environmentQuestions = currentStepQuestions.filter(q =>
                  ['atmosphere_fit_rating', 'campus_life_rating', 'tuition_rating'].includes(q.id)
                );
                const otherQuestions = currentStepQuestions.filter(q =>
                  !['flexibility_rating', 'credit_rating', 'unique_course_rating',
                    'staff_rating', 'support_rating', 'career_support_rating',
                    'atmosphere_fit_rating', 'campus_life_rating', 'tuition_rating'].includes(q.id)
                );

                const step3RatingErrors = Object.keys(errors).filter(key =>
                  ['flexibility_rating', 'staff_rating', 'support_rating', 'atmosphere_fit_rating',
                    'credit_rating', 'unique_course_rating', 'career_support_rating',
                    'campus_life_rating', 'tuition_rating'].includes(key)
                );
                const hasRatingErrors = step3RatingErrors.length > 0;

                return (
                  <>
                    {hasRatingErrors && (
                      <div
                        className="mb-4 p-4 rounded-lg cursor-pointer transition-colors"
                        style={{
                          backgroundColor: 'rgba(255, 141, 54, 0.1)',
                          border: '1px solid var(--ce-warning)',
                          borderRadius: 'var(--ce-radius-control)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 141, 54, 0.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 141, 54, 0.1)'; }}
                        onClick={() => {
                          const firstErrorId = step3RatingErrors[0];
                          if (!firstErrorId) return;

                          let errorElement = document.querySelector(`[name="${firstErrorId}"]`) as HTMLElement;

                          if (!errorElement) {
                            const questionElement = document.querySelector(`[data-question-id="${firstErrorId}"]`) as HTMLElement;
                            if (questionElement) {
                              errorElement = questionElement;
                            } else {
                              const errorMessage = document.querySelector(`[data-error-field="${firstErrorId}"]`) as HTMLElement;
                              if (errorMessage) {
                                errorElement = errorMessage.closest('.mb-6') as HTMLElement || errorMessage;
                              }
                            }
                          }

                          if (errorElement) {
                            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const focusableElement = errorElement.querySelector('button, input, select, textarea') as HTMLElement;
                            if (focusableElement) {
                              focusableElement.focus();
                            }
                          }
                        }}
                      >
                        <p className="text-sm font-medium" style={{
                          fontFamily: 'var(--ce-font-body)',
                          color: 'var(--ce-warning)'
                        }}>
                          未入力が{step3RatingErrors.length}件あります（クリックで該当箇所へ移動）
                        </p>
                      </div>
                    )}

                    {learningQuestions.length > 0 && (
                      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: 'sans-serif' }}>授業関連の満足度について教えてください</h3>
                        <div className="space-y-6">
                          {learningQuestions.map((question) => (
                            <QuestionRenderer
                              key={question.id}
                              question={question}
                              control={control}
                              watch={watch}
                              errors={errors}
                              setValue={setValue}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {supportQuestions.length > 0 && (
                      <div className="p-6 rounded-lg" style={{
                        backgroundColor: 'var(--ce-surface)',
                        border: '1px solid var(--ce-border)',
                        borderRadius: 'var(--ce-radius-card)',
                        boxShadow: 'var(--ce-shadow-card)'
                      }}>
                        <h3 className="text-lg font-bold mb-4" style={{
                          fontFamily: 'var(--ce-font-heading)',
                          color: 'var(--ce-text)',
                          letterSpacing: '0.02em'
                        }}>サポート関連の満足度について教えてください</h3>
                        <div className="space-y-6">
                          {supportQuestions.map((question) => (
                            <QuestionRenderer
                              key={question.id}
                              question={question}
                              control={control}
                              watch={watch}
                              errors={errors}
                              setValue={setValue}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {environmentQuestions.length > 0 && (
                      <div className="p-6 rounded-lg" style={{
                        backgroundColor: 'var(--ce-surface)',
                        border: '1px solid var(--ce-border)',
                        borderRadius: 'var(--ce-radius-card)',
                        boxShadow: 'var(--ce-shadow-card)'
                      }}>
                        <h3 className="text-lg font-bold mb-4" style={{
                          fontFamily: 'var(--ce-font-heading)',
                          color: 'var(--ce-text)',
                          letterSpacing: '0.02em'
                        }}>学習環境関連の満足度について教えてください</h3>
                        <div className="space-y-6">
                          {environmentQuestions.map((question) => (
                            <QuestionRenderer
                              key={question.id}
                              question={question}
                              control={control}
                              watch={watch}
                              errors={errors}
                              setValue={setValue}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {otherQuestions.map((question) => (
                      <QuestionRenderer
                        key={question.id}
                        question={question}
                        control={control}
                        watch={watch}
                        errors={errors}
                        setValue={setValue}
                      />
                    ))}
                  </>
                );
              })()}

              {currentStep === 1 && currentStepQuestions.map((question) => (
                <QuestionRenderer
                  key={question.id}
                  question={question}
                  control={control}
                  watch={watch}
                  errors={errors}
                  setValue={setValue}
                />
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-6 py-2 transition-colors"
                style={{
                  borderRadius: 'var(--ce-radius-control)',
                  fontFamily: 'var(--ce-font-body)',
                  ...(currentStep === 1
                    ? {
                        backgroundColor: 'var(--ce-border)',
                        color: 'var(--ce-muted)',
                        cursor: 'not-allowed',
                        opacity: 0.5
                      }
                    : {
                        backgroundColor: 'var(--ce-border)',
                        color: 'var(--ce-text)'
                      })
                }}
                onMouseEnter={(e) => {
                  if (currentStep !== 1) {
                    e.currentTarget.style.backgroundColor = 'var(--ce-muted)';
                    e.currentTarget.style.color = 'var(--ce-surface)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentStep !== 1) {
                    e.currentTarget.style.backgroundColor = 'var(--ce-border)';
                    e.currentTarget.style.color = 'var(--ce-text)';
                  }
                }}
              >
                戻る
              </button>

              <div className="flex gap-4 justify-end">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    size="lg"
                  >
                    戻る
                  </Button>
                )}

                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    variant="primary"
                    size="lg"
                  >
                    次へ
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant="accent"
                    size="lg"
                  >
                    {isSubmitting ? '送信中...' : '回答終了'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
