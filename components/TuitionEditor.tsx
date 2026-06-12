'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';
import type {
  TuitionDisplayMode,
  TuitionEstimate,
  TuitionPlan,
  TuitionSourceType,
  TuitionSourceUrl,
} from '@/lib/types/tuition';
import { buildTuitionRangeLines } from '@/lib/tuition/format';

interface TuitionEditorProps {
  schoolId: string;
}

interface FormState {
  display_mode: TuitionDisplayMode;
  first_year_min: string;
  first_year_max: string;
  annual_min: string;
  annual_max: string;
  monthly_min: string;
  monthly_max: string;
  plans: Array<{
    label: string;
    course_name: string;
    attendance: string;
    first_year_min: string;
    first_year_max: string;
    annual_min: string;
    annual_max: string;
    monthly_min: string;
    monthly_max: string;
    support_fund: 'before' | 'after' | 'unknown';
    note: string;
  }>;
  support_fund_note: string;
  public_note: string;
  source_type: TuitionSourceType;
  source_urls: Array<{ url: string; note: string }>;
  source_excerpt: string;
  verified_at: string;
  internal_memo: string;
}

const EMPTY_FORM: FormState = {
  display_mode: 'amounts',
  first_year_min: '',
  first_year_max: '',
  annual_min: '',
  annual_max: '',
  monthly_min: '',
  monthly_max: '',
  plans: [],
  support_fund_note: '',
  public_note: '',
  source_type: 'unverified',
  source_urls: [],
  source_excerpt: '',
  verified_at: '',
  internal_memo: '',
};

function numToStr(value: number | null | undefined): string {
  return value != null ? String(value) : '';
}

function strToNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function estimateToForm(estimate: TuitionEstimate): FormState {
  return {
    display_mode: estimate.display_mode,
    first_year_min: numToStr(estimate.first_year_min),
    first_year_max: numToStr(estimate.first_year_max),
    annual_min: numToStr(estimate.annual_min),
    annual_max: numToStr(estimate.annual_max),
    monthly_min: numToStr(estimate.monthly_min),
    monthly_max: numToStr(estimate.monthly_max),
    plans: (estimate.plans || []).map((p: TuitionPlan) => ({
      label: p.label || '',
      course_name: p.course_name || '',
      attendance: p.attendance || '',
      first_year_min: numToStr(p.first_year_min),
      first_year_max: numToStr(p.first_year_max),
      annual_min: numToStr(p.annual_min),
      annual_max: numToStr(p.annual_max),
      monthly_min: numToStr(p.monthly_min),
      monthly_max: numToStr(p.monthly_max),
      support_fund: p.support_fund || 'unknown',
      note: p.note || '',
    })),
    support_fund_note: estimate.support_fund_note || '',
    public_note: estimate.public_note || '',
    source_type: estimate.source_type,
    source_urls: (estimate.source_urls || []).map((s: TuitionSourceUrl) => ({
      url: s.url,
      note: s.note || '',
    })),
    source_excerpt: estimate.source_excerpt || '',
    verified_at: estimate.verified_at || '',
    internal_memo: estimate.internal_memo || '',
  };
}

function formToPayload(form: FormState) {
  return {
    display_mode: form.display_mode,
    first_year_min: strToNum(form.first_year_min),
    first_year_max: strToNum(form.first_year_max),
    annual_min: strToNum(form.annual_min),
    annual_max: strToNum(form.annual_max),
    monthly_min: strToNum(form.monthly_min),
    monthly_max: strToNum(form.monthly_max),
    plans: form.plans.map((p) => ({
      label: p.label || null,
      course_name: p.course_name || null,
      attendance: p.attendance || null,
      first_year_min: strToNum(p.first_year_min),
      first_year_max: strToNum(p.first_year_max),
      annual_min: strToNum(p.annual_min),
      annual_max: strToNum(p.annual_max),
      monthly_min: strToNum(p.monthly_min),
      monthly_max: strToNum(p.monthly_max),
      support_fund: p.support_fund,
      note: p.note || null,
    })),
    support_fund_note: form.support_fund_note || null,
    public_note: form.public_note || null,
    source_type: form.source_type,
    source_urls: form.source_urls
      .filter((s) => s.url.trim())
      .map((s) => ({ url: s.url.trim(), kind: null, note: s.note || null })),
    source_excerpt: form.source_excerpt || null,
    verified_at: form.verified_at || null,
    internal_memo: form.internal_memo || null,
  };
}

const SOURCE_TYPE_LABELS: Record<TuitionSourceType, string> = {
  official_site: '公式サイト',
  official_pdf: '公式PDF',
  external_media: '外部メディア参考',
  unverified: '未確認',
};

function RangeInputs({
  label,
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 flex-shrink-0 text-sm text-gray-700">{label}</span>
      <input
        type="number"
        min={1}
        value={minValue}
        onChange={(e) => onChangeMin(e.target.value)}
        placeholder="最小（円）"
        className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-gray-400">〜</span>
      <input
        type="number"
        min={1}
        value={maxValue}
        onChange={(e) => onChangeMax(e.target.value)}
        placeholder="最大（円）"
        className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-xs text-gray-400">円・不明は空欄</span>
    </div>
  );
}

/**
 * 学費目安の編集・承認UI（管理画面専用）
 * AI抽出 → 下書き編集 → 人間確認 → 公開 のワークフロー。自動公開はしない。
 */
export default function TuitionEditor({ schoolId }: TuitionEditorProps) {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<TuitionEstimate | null>(null);
  const [draft, setDraft] = useState<TuitionEstimate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tuitionPageUrl, setTuitionPageUrl] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/tuition`), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('学費目安の取得に失敗しました');
      const data = (await res.json()) as {
        published: TuitionEstimate | null;
        draft: TuitionEstimate | null;
      };
      setPublished(data.published);
      setDraft(data.draft);
      if (data.draft) {
        setForm(estimateToForm(data.draft));
      } else if (data.published) {
        // draftがない場合はpublishedをベースに編集できるようにする
        setForm(estimateToForm(data.published));
      } else {
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      console.error('学費目安取得エラー:', e);
      alert(e instanceof Error ? e.message : '学費目安の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/tuition`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formToPayload(form)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '下書きの保存に失敗しました');
      }
      alert('下書きを保存しました');
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '下書きの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    const message = tuitionPageUrl.trim()
      ? `指定した学費ページURLからAI抽出を実行しますか？\n${tuitionPageUrl.trim()}\n\n既存の下書きは上書きされます（公開中の情報には影響しません）。`
      : '公式サイトURLを起点に学費情報のAI抽出を実行しますか？\n\n既存の下書きは上書きされます（公開中の情報には影響しません）。';
    if (!confirm(message)) return;

    setExtracting(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/tuition/extract`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          tuitionPageUrl.trim() ? { tuitionPageUrl: tuitionPageUrl.trim() } : {}
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'AI抽出に失敗しました');
      }
      if (data.skipped) {
        alert(`スキップされました: ${data.reason}`);
        return;
      }
      const fetchedText =
        Array.isArray(data.fetched_urls) && data.fetched_urls.length > 0
          ? `\n\n取得ページ:\n- ${data.fetched_urls.join('\n- ')}`
          : '';
      const warnText =
        Array.isArray(data.warnings) && data.warnings.length > 0
          ? `\n\n警告:\n- ${data.warnings.join('\n- ')}`
          : '';
      const foundText = data.found_tuition_info
        ? '金額を検出しました。'
        : '金額は検出できませんでした（個別確認が必要）。';
      alert(
        `AI抽出が完了し、下書きとして保存しました。${foundText}内容を確認してから公開してください。${fetchedText}${warnText}`
      );
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI抽出に失敗しました');
    } finally {
      setExtracting(false);
    }
  };

  const handlePublishAction = async (
    estimateId: string,
    action: 'publish' | 'unpublish' | 'reject'
  ) => {
    const messages = {
      publish:
        'この下書きを公開しますか？\n公開前に、出典URLを開いて金額が一致するか確認してください。',
      unpublish: '公開中の学費目安を非公開（下書き）に戻しますか？',
      reject: 'この下書きを却下しますか？',
    };
    if (!confirm(messages[action])) return;

    setPublishing(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/tuition/publish`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estimateId, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '状態変更に失敗しました');
      }
      alert(
        action === 'publish' ? '公開しました' : action === 'unpublish' ? '非公開にしました' : '却下しました'
      );
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '状態変更に失敗しました');
    } finally {
      setPublishing(false);
    }
  };

  const updatePlan = (index: number, patch: Partial<FormState['plans'][number]>) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  if (loading) {
    return <p className="text-sm text-gray-600">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">学費目安の管理</h3>
        <p className="text-sm text-gray-500">
          AI抽出した下書きを人間が確認してから公開します（自動公開はされません）。出典・確認日はユーザー向けページには表示されません。
        </p>
      </div>

      {/* 公開中の情報 */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-900">
            公開中の学費目安
            {published ? (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                公開中
              </span>
            ) : (
              <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                未公開
              </span>
            )}
          </h4>
          {published && (
            <button
              onClick={() => handlePublishAction(published.id, 'unpublish')}
              disabled={publishing}
              className="px-3 py-1.5 text-sm text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              非公開に戻す
            </button>
          )}
        </div>
        {published ? (
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              表示モード:{' '}
              {published.display_mode === 'amounts'
                ? '金額表示'
                : published.display_mode === 'varies'
                  ? 'コースにより変動'
                  : '個別確認が必要'}
            </p>
            {buildTuitionRangeLines(published).map((line) => (
              <p key={line.label}>
                {line.label}: <span className="font-bold">{line.value}</span>
              </p>
            ))}
            <p className="text-xs text-gray-500">
              情報源: {SOURCE_TYPE_LABELS[published.source_type]} / 確認日:{' '}
              {published.verified_at || '未確認'} / 作成元:{' '}
              {published.origin === 'ai' ? 'AI抽出' : '手入力'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">公開中の学費目安はありません。</p>
        )}
      </div>

      {/* AI抽出 */}
      <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
        <h4 className="font-semibold text-gray-900 mb-2">AI抽出</h4>
        <p className="text-sm text-gray-600 mb-3">
          基本情報タブの「公式サイトURL」を起点に、学費ページに明記された金額のみを抽出して下書きを作成します。学費ページが見つからない場合は、下のURL欄で<strong>学費・入学案内の下層ページ</strong>を直接指定して再実行できます（公式トップURLは入れないでください）。
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={tuitionPageUrl}
            onChange={(e) => setTuitionPageUrl(e.target.value)}
            placeholder="学費ページURLを直接指定（任意）"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleExtract}
            disabled={extracting || saving || publishing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 whitespace-nowrap"
          >
            {extracting ? '抽出中...' : 'AIで抽出'}
          </button>
        </div>
      </div>

      {/* 下書き編集フォーム */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">
            下書き
            {draft && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                {draft.origin === 'ai' ? 'AI抽出済み・未確認' : '下書き'}
              </span>
            )}
          </h4>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="tuition-display-mode" className="block text-sm font-medium text-gray-700 mb-1">
              表示モード
            </label>
            <select
              id="tuition-display-mode"
              value={form.display_mode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_mode: e.target.value as TuitionDisplayMode }))
              }
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="amounts">金額レンジを表示</option>
              <option value="varies">コースにより変動（金額は出さない）</option>
              <option value="contact_required">個別確認が必要（金額は出さない）</option>
            </select>
          </div>

          {form.display_mode === 'amounts' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">費用目安（円・税込相当の総額目安）</p>
              <RangeInputs
                label="初年度"
                minValue={form.first_year_min}
                maxValue={form.first_year_max}
                onChangeMin={(v) => setForm((prev) => ({ ...prev, first_year_min: v }))}
                onChangeMax={(v) => setForm((prev) => ({ ...prev, first_year_max: v }))}
              />
              <RangeInputs
                label="年間"
                minValue={form.annual_min}
                maxValue={form.annual_max}
                onChangeMin={(v) => setForm((prev) => ({ ...prev, annual_min: v }))}
                onChangeMax={(v) => setForm((prev) => ({ ...prev, annual_max: v }))}
              />
              <RangeInputs
                label="月額"
                minValue={form.monthly_min}
                maxValue={form.monthly_max}
                onChangeMin={(v) => setForm((prev) => ({ ...prev, monthly_min: v }))}
                onChangeMax={(v) => setForm((prev) => ({ ...prev, monthly_max: v }))}
              />
            </div>
          )}

          {/* コース別パターン */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">コース・通学頻度別の目安（任意）</p>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    plans: [
                      ...prev.plans,
                      {
                        label: '',
                        course_name: '',
                        attendance: '',
                        first_year_min: '',
                        first_year_max: '',
                        annual_min: '',
                        annual_max: '',
                        monthly_min: '',
                        monthly_max: '',
                        support_fund: 'unknown',
                        note: '',
                      },
                    ],
                  }))
                }
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                追加
              </button>
            </div>
            <div className="space-y-3">
              {form.plans.map((plan, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={plan.course_name}
                      onChange={(e) => updatePlan(index, { course_name: e.target.value })}
                      placeholder="コース名"
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      value={plan.attendance}
                      onChange={(e) => updatePlan(index, { attendance: e.target.value })}
                      placeholder="通学頻度（例: 週5日）"
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <select
                      value={plan.support_fund}
                      onChange={(e) =>
                        updatePlan(index, {
                          support_fund: e.target.value as 'before' | 'after' | 'unknown',
                        })
                      }
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      <option value="unknown">就学支援金: 不明</option>
                      <option value="before">就学支援金: 適用前</option>
                      <option value="after">就学支援金: 適用後</option>
                    </select>
                  </div>
                  <RangeInputs
                    label="初年度"
                    minValue={plan.first_year_min}
                    maxValue={plan.first_year_max}
                    onChangeMin={(v) => updatePlan(index, { first_year_min: v })}
                    onChangeMax={(v) => updatePlan(index, { first_year_max: v })}
                  />
                  <RangeInputs
                    label="年間"
                    minValue={plan.annual_min}
                    maxValue={plan.annual_max}
                    onChangeMin={(v) => updatePlan(index, { annual_min: v })}
                    onChangeMax={(v) => updatePlan(index, { annual_max: v })}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={plan.note}
                      onChange={(e) => updatePlan(index, { note: e.target.value })}
                      placeholder="補足（例: 教材費別途）"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          plans: prev.plans.filter((_, i) => i !== index),
                        }))
                      }
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
              {form.plans.length === 0 && (
                <p className="text-sm text-gray-500">コース別パターンは未登録です。</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="tuition-support-note" className="block text-sm font-medium text-gray-700 mb-1">
              就学支援金に関する注記（公開表示）
            </label>
            <textarea
              id="tuition-support-note"
              value={form.support_fund_note}
              onChange={(e) => setForm((prev) => ({ ...prev, support_fund_note: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 就学支援金の適用により、世帯年収に応じて授業料負担が軽減される場合があります。"
            />
          </div>

          <div>
            <label htmlFor="tuition-public-note" className="block text-sm font-medium text-gray-700 mb-1">
              学費に関する注意書き（公開表示）
            </label>
            <textarea
              id="tuition-public-note"
              value={form.public_note}
              onChange={(e) => setForm((prev) => ({ ...prev, public_note: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 上記とは別に教材費・スクーリング費がかかります。"
            />
          </div>

          {/* 内部管理（ユーザー非表示） */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              内部管理情報（ユーザー向けページには表示されません）
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tuition-source-type" className="block text-sm font-medium text-gray-700 mb-1">
                  情報源の種別
                </label>
                <select
                  id="tuition-source-type"
                  value={form.source_type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, source_type: e.target.value as TuitionSourceType }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tuition-verified-at" className="block text-sm font-medium text-gray-700 mb-1">
                  情報確認日（人間が出典と照合した日）
                </label>
                <input
                  id="tuition-verified-at"
                  type="date"
                  value={form.verified_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, verified_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="block text-sm font-medium text-gray-700">出典URL</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      source_urls: [...prev.source_urls, { url: '', note: '' }],
                    }))
                  }
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  追加
                </button>
              </div>
              <div className="space-y-2">
                {form.source_urls.map((source, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={source.url}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          source_urls: prev.source_urls.map((s, i) =>
                            i === index ? { ...s, url: e.target.value } : s
                          ),
                        }))
                      }
                      placeholder="https://..."
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      value={source.note}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          source_urls: prev.source_urls.map((s, i) =>
                            i === index ? { ...s, note: e.target.value } : s
                          ),
                        }))
                      }
                      placeholder="メモ"
                      className="w-40 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          source_urls: prev.source_urls.filter((_, i) => i !== index),
                        }))
                      }
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                ))}
                {form.source_urls.length === 0 && (
                  <p className="text-sm text-gray-500">出典URLは未登録です。</p>
                )}
              </div>
            </div>

            {form.source_excerpt && (
              <div>
                <label htmlFor="tuition-source-excerpt" className="block text-sm font-medium text-gray-700 mb-1">
                  抽出元の原文抜粋（監査用・読み取り専用）
                </label>
                <textarea
                  id="tuition-source-excerpt"
                  value={form.source_excerpt}
                  readOnly
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-600"
                />
              </div>
            )}

            <div>
              <label htmlFor="tuition-internal-memo" className="block text-sm font-medium text-gray-700 mb-1">
                内部メモ（条件不明点・AI抽出の警告など）
              </label>
              <textarea
                id="tuition-internal-memo"
                value={form.internal_memo}
                onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 操作ボタン */}
          <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-200">
            {draft && (
              <button
                onClick={() => handlePublishAction(draft.id, 'reject')}
                disabled={publishing || saving || extracting}
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                却下
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              disabled={saving || publishing || extracting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '下書き保存'}
            </button>
            {draft && (
              <button
                onClick={() => handlePublishAction(draft.id, 'publish')}
                disabled={publishing || saving || extracting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? '処理中...' : '公開する'}
              </button>
            )}
          </div>
          {!draft && (
            <p className="text-xs text-gray-500 text-right">
              公開するには、まず「下書き保存」または「AIで抽出」で下書きを作成してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
