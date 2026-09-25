'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';
import { prefectures } from '@/lib/prefectures';
import type { AdmissionScope, SchoolAdmissionProfile } from '@/lib/schools/admissionProfiles';

interface AdmissionProfileEditorProps {
  schoolId: string;
}

interface FormState {
  admission_scope: AdmissionScope;
  admission_prefectures: string[];
  schooling_prefectures: string[];
  schooling_note: string;
  source_urls: Array<{ url: string; note: string }>;
  verified_at: string;
  target_year: string;
  internal_memo: string;
}

const EMPTY_FORM: FormState = {
  admission_scope: 'unknown',
  admission_prefectures: [],
  schooling_prefectures: [],
  schooling_note: '',
  source_urls: [{ url: '', note: '' }],
  verified_at: '',
  target_year: '',
  internal_memo: '',
};

const SCOPE_LABELS: Record<AdmissionScope, string> = {
  nationwide: '全国から出願可',
  prefectures: '指定都道府県の在住・在勤者のみ',
  unknown: '未確認',
};

function profileToForm(profile: SchoolAdmissionProfile): FormState {
  return {
    admission_scope: profile.admission_scope,
    admission_prefectures: profile.admission_prefectures ?? [],
    schooling_prefectures: profile.schooling_prefectures ?? [],
    schooling_note: profile.schooling_note ?? '',
    source_urls:
      profile.source_urls?.length > 0
        ? profile.source_urls.map((s) => ({ url: s.url, note: s.note ?? '' }))
        : [{ url: '', note: '' }],
    verified_at: profile.verified_at ?? '',
    target_year: profile.target_year != null ? String(profile.target_year) : '',
    internal_memo: profile.internal_memo ?? '',
  };
}

function PrefectureMultiSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <select
      id={id}
      multiple
      value={value}
      onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((option) => option.value))}
      className="w-full h-40 px-2 py-1 border border-gray-300 rounded text-sm"
    >
      {prefectures.map((pref) => (
        <option key={pref} value={pref}>
          {pref}
        </option>
      ))}
    </select>
  );
}

/**
 * 入学条件（募集区域）・必須スクーリング会場の確認データ編集UI（管理画面専用）。
 * 公式サイト・公式PDF・教育委員会ページで確認した内容だけを入力し、人間が公開する。
 * 確認日から12か月を過ぎると公開側では自動的に未確認扱いに戻る。
 */
export default function AdmissionProfileEditor({ schoolId }: AdmissionProfileEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [profile, setProfile] = useState<SchoolAdmissionProfile | null>(null);
  const [stale, setStale] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/admission-profile`), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('入学条件の取得に失敗しました');
      const data = (await res.json()) as {
        profile: SchoolAdmissionProfile | null;
        tableMissing: boolean;
        needsReverification: boolean | null;
      };
      setTableMissing(data.tableMissing);
      setProfile(data.profile);
      setStale(data.needsReverification);
      setForm(data.profile ? profileToForm(data.profile) : EMPTY_FORM);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '入学条件の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const save = async (action: 'draft' | 'publish') => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/admission-profile`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...form,
          source_urls: form.source_urls.filter((s) => s.url.trim()),
          target_year: form.target_year ? Number(form.target_year) : null,
        }),
      });
      const data = (await res.json()) as { profile?: SchoolAdmissionProfile; error?: string };
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');
      setMessage(action === 'publish' ? '公開しました（LPへの反映は最大1時間後）' : '下書きを保存しました');
      await fetchData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">読み込み中...</div>;

  if (tableMissing) {
    return (
      <div className="p-4 border border-amber-300 bg-amber-50 rounded text-sm text-amber-900">
        入学条件テーブルが未作成です。Supabase の SQL Editor で
        <code className="mx-1">supabase-migrations/create-school-admission-profiles.sql</code>
        を実行してください。
      </div>
    );
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-600 space-y-1">
        <p>
          公式サイト・公式PDF・教育委員会ページで確認できた内容だけを入力してください。推測や比較サイトの情報は入力しません。
        </p>
        <p>確認日から12か月を過ぎる、または対象年度が過ぎると、公開側では自動的に「未確認」として扱われます。</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">状態:</span>
        {profile ? (
          <span
            className={`px-2 py-0.5 rounded ${
              profile.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {profile.status === 'published' ? '公開中' : '下書き'}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">未登録</span>
        )}
        {stale && profile?.status === 'published' && (
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
            再確認期限切れ（公開側では未確認扱い）
          </span>
        )}
      </div>

      <div>
        <label htmlFor="admission-scope" className={labelClass}>
          募集区域
        </label>
        <select
          id="admission-scope"
          value={form.admission_scope}
          onChange={(e) => setForm((prev) => ({ ...prev, admission_scope: e.target.value as AdmissionScope }))}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          {(Object.keys(SCOPE_LABELS) as AdmissionScope[]).map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
            </option>
          ))}
        </select>
      </div>

      {form.admission_scope === 'prefectures' && (
        <div>
          <label htmlFor="admission-prefectures" className={labelClass}>
            出願できる都道府県（Ctrl / ⌘ で複数選択）
          </label>
          <PrefectureMultiSelect
            id="admission-prefectures"
            value={form.admission_prefectures}
            onChange={(next) => setForm((prev) => ({ ...prev, admission_prefectures: next }))}
          />
        </div>
      )}

      <div>
        <label htmlFor="schooling-prefectures" className={labelClass}>
          必須スクーリングの実施都道府県（未確認なら選択しない）
        </label>
        <PrefectureMultiSelect
          id="schooling-prefectures"
          value={form.schooling_prefectures}
          onChange={(next) => setForm((prev) => ({ ...prev, schooling_prefectures: next }))}
        />
      </div>

      <div>
        <label htmlFor="schooling-note" className={labelClass}>
          スクーリングの補足（公開表示・300字まで）
        </label>
        <input
          id="schooling-note"
          type="text"
          value={form.schooling_note}
          onChange={(e) => setForm((prev) => ({ ...prev, schooling_note: e.target.value }))}
          placeholder="例: 年1回、本校で4泊5日の集中スクーリング"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <div className="space-y-2">
        <span className={labelClass}>出典URL（公開には1件以上必須）</span>
        {form.source_urls.map((source, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
            <input
              type="url"
              aria-label={`出典URL ${index + 1}`}
              value={source.url}
              onChange={(e) =>
                setForm((prev) => {
                  const next = [...prev.source_urls];
                  next[index] = { ...next[index], url: e.target.value };
                  return { ...prev, source_urls: next };
                })
              }
              placeholder="https://..."
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              aria-label={`出典メモ ${index + 1}`}
              value={source.note}
              onChange={(e) =>
                setForm((prev) => {
                  const next = [...prev.source_urls];
                  next[index] = { ...next[index], note: e.target.value };
                  return { ...prev, source_urls: next };
                })
              }
              placeholder="例: 2027年度 生徒募集要項 p.2"
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  source_urls: prev.source_urls.filter((_, i) => i !== index),
                }))
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setForm((prev) => ({ ...prev, source_urls: [...prev.source_urls, { url: '', note: '' }] }))
          }
          className="px-3 py-1 text-xs border border-gray-300 rounded"
        >
          出典を追加
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="admission-verified-at" className={labelClass}>
            確認日（出典と照合した日）
          </label>
          <input
            id="admission-verified-at"
            type="date"
            value={form.verified_at}
            onChange={(e) => setForm((prev) => ({ ...prev, verified_at: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label htmlFor="admission-target-year" className={labelClass}>
            対象年度（入学年度）
          </label>
          <input
            id="admission-target-year"
            type="number"
            min={2020}
            max={2100}
            value={form.target_year}
            onChange={(e) => setForm((prev) => ({ ...prev, target_year: e.target.value }))}
            placeholder="例: 2027"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="admission-internal-memo" className={labelClass}>
          内部メモ（非公開）
        </label>
        <textarea
          id="admission-internal-memo"
          value={form.internal_memo}
          onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      {message && <div className="text-sm text-gray-800 bg-gray-50 border rounded p-2">{message}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save('draft')}
          className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
        >
          {profile?.status === 'published' ? '下書きに戻して保存' : '下書き保存'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save('publish')}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          確認済みとして公開
        </button>
      </div>
    </div>
  );
}
