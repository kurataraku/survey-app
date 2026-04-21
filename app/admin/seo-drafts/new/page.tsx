'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPath, appPath } from '@/lib/base-path';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import type { DraftType, GenerationStep } from '@/lib/seo-generation/types';

interface SchoolOption {
  id: string;
  name: string;
}

interface StepLogEntry {
  id: string;
  step: GenerationStep;
  label: string;
  status: 'running' | 'done' | 'error';
  elapsed?: number;
  message?: string;
}

const STEP_CONFIG: Record<
  GenerationStep,
  { label: string; progress: number }
> = {
  plan: { label: '企画中...', progress: 10 },
  research: { label: '自社データ調査中...', progress: 25 },
  'research-web': { label: 'Web補足調査中...', progress: 35 },
  write: { label: '執筆中...', progress: 50 },
  verify: { label: '検証中...', progress: 60 },
  rewrite: { label: 'リライト中（品質改善）...', progress: 70 },
  'generate-image': { label: 'サムネイル画像生成中...', progress: 90 },
};

export default function NewSeoDraftPage() {
  const router = useRouter();

  const [keyword, setKeyword] = useState('');
  const [draftType, setDraftType] = useState<DraftType>('knowledge');
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');

  const [webResearch, setWebResearch] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [stepLog, setStepLog] = useState<StepLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (draftType === 'school') {
      fetchSchools();
    }
  }, [draftType]);

  const fetchSchools = async () => {
    try {
      const res = await fetch(apiPath('/api/admin/schools?limit=500'), {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setSchools(
        (data.schools || data).map((s: { id: string; name: string }) => ({
          id: s.id,
          name: s.name,
        }))
      );
    } catch {
      console.error('学校一覧取得失敗');
    }
  };

  const runStep = async (
    draftId: string,
    step: GenerationStep,
    options?: { logId?: string; label?: string; progress?: number }
  ): Promise<unknown> => {
    const logId = options?.logId || step;
    const label = options?.label || STEP_CONFIG[step]?.label || step;
    const progress = options?.progress || STEP_CONFIG[step]?.progress || 0;

    const start = Date.now();
    setCurrentStep(step);
    setCurrentProgress(progress);
    setStepLog((prev) => [...prev, { id: logId, step, label, status: 'running' }]);

    try {
      const res = await fetch(apiPath(`/api/admin/seo-drafts/${draftId}/${step}`), {
        method: 'POST',
        credentials: 'include',
      });
      const elapsed = Date.now() - start;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `${step}失敗`);
      }

      const data = await res.json();
      setStepLog((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: 'done', elapsed } : l))
      );
      return data;
    } catch (err) {
      const elapsed = Date.now() - start;
      setStepLog((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: 'error', elapsed } : l))
      );
      throw err;
    }
  };

  const addInfoLog = (id: string, message: string) => {
    setStepLog((prev) => [
      ...prev,
      { id, step: 'verify', label: message, status: 'done', message },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setIsGenerating(true);
    setError(null);
    setStepLog([]);
    setCurrentProgress(0);

    try {
      const createRes = await fetch(apiPath('/api/admin/seo-drafts'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          draft_type: draftType,
          school_id: draftType === 'school' ? schoolId : undefined,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || '下書き作成失敗');
      }

      const draft = await createRes.json();
      const draftId = draft.id;

      // Phase 1: plan → research → [research-web] → write
      await runStep(draftId, 'plan');
      await runStep(draftId, 'research');
      if (webResearch) {
        await runStep(draftId, 'research-web');
      }
      await runStep(draftId, 'write');

      // Phase 2: verify → conditional rewrite → verify again
      const verifyResult = await runStep(draftId, 'verify') as { qualityScore?: { overall: number } };
      const score = verifyResult?.qualityScore?.overall ?? 100;

      if (score < 75) {
        addInfoLog(
          'score-info',
          `品質スコア: ${score}/100 — 自動リライトを実行します`
        );

        await runStep(draftId, 'rewrite', {
          logId: 'rewrite',
          progress: 70,
        });

        await runStep(draftId, 'verify', {
          logId: 'verify-2',
          label: '再検証中...',
          progress: 80,
        });
      }

      // Phase 3: generate image
      await runStep(draftId, 'generate-image');

      setCurrentStep(null);
      setCurrentProgress(100);
      router.push(appPath(`/admin/seo-drafts/${draftId}`));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生成中にエラーが発生しました';
      setError(message);
      setIsGenerating(false);
      setCurrentStep(null);
    }
  };

  const filteredSchools = schoolSearch
    ? schools.filter((s) => s.name.includes(schoolSearch))
    : schools;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push(appPath('/admin/seo-drafts'))}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            一覧に戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">SEO記事を生成</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {!isGenerating ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  キーワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 通信制高校 学費 安い"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  記事タイプ
                </label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="draft_type"
                      value="knowledge"
                      checked={draftType === 'knowledge'}
                      onChange={() => setDraftType('knowledge')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      ナレッジ記事
                    </span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="draft_type"
                      value="school"
                      checked={draftType === 'school'}
                      onChange={() => setDraftType('school')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      学校別記事
                    </span>
                  </label>
                </div>
              </div>

              {draftType === 'school' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    対象学校 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    placeholder="学校名で絞り込み..."
                    className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-2"
                  />
                  <select
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required={draftType === 'school'}
                  >
                    <option value="">学校を選択</option>
                    {filteredSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 詳細設定 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">詳細設定</h3>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webResearch}
                    onChange={(e) => setWebResearch(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Web補足調査（制度・公式情報を補足取得）
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" variant="primary" disabled={!keyword.trim()}>
                生成開始
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-medium text-gray-900">
                    記事を生成しています
                  </h2>
                  <span className="text-sm text-gray-500">{currentProgress}%</span>
                </div>
                <ProgressBar value={currentProgress} variant="primary" size="md" />
                {currentStep && (
                  <p className="mt-2 text-sm text-blue-600 animate-pulse">
                    {STEP_CONFIG[currentStep]?.label}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {stepLog.map((log) => {
                  const isInfoMessage = !!log.message;
                  return (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between text-sm ${
                        isInfoMessage ? 'bg-amber-50 rounded px-3 py-1.5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isInfoMessage ? (
                          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : log.status === 'running' ? (
                          <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : log.status === 'done' ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={
                          isInfoMessage
                            ? 'text-amber-700 font-medium'
                            : log.status === 'error'
                              ? 'text-red-600'
                              : 'text-gray-700'
                        }>
                          {isInfoMessage ? log.message : log.label.replace('...', '')}
                        </span>
                      </div>
                      {!isInfoMessage && log.elapsed !== undefined && (
                        <span className="text-gray-400">
                          {(log.elapsed / 1000).toFixed(1)}秒
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => {
                      setIsGenerating(false);
                      setError(null);
                      setStepLog([]);
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    やり直す
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-400">
                ※ ページを離れると生成が中断されます。途中結果はDBに保存されています。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
