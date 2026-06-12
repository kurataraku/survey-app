'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';
import type { CourseListing, CourseSourceType } from '@/lib/types/courses';

interface CourseEditorProps {
  schoolId: string;
}

interface FormState {
  courses: Array<{ name: string; attendance: string; note: string }>;
  public_note: string;
  source_type: CourseSourceType;
  source_urls: Array<{ url: string; note: string }>;
  source_excerpt: string;
  verified_at: string;
  internal_memo: string;
}

const EMPTY_FORM: FormState = {
  courses: [],
  public_note: '',
  source_type: 'unverified',
  source_urls: [],
  source_excerpt: '',
  verified_at: '',
  internal_memo: '',
};

const SOURCE_TYPE_LABELS: Record<CourseSourceType, string> = {
  official_site: '公式サイト',
  official_pdf: '公式PDF',
  external_media: '外部メディア参考',
  unverified: '未確認',
};

function listingToForm(listing: CourseListing): FormState {
  return {
    courses: (listing.courses || []).map((c) => ({
      name: c.name,
      attendance: c.attendance || '',
      note: c.note || '',
    })),
    public_note: listing.public_note || '',
    source_type: listing.source_type,
    source_urls: (listing.source_urls || []).map((s) => ({ url: s.url, note: s.note || '' })),
    source_excerpt: listing.source_excerpt || '',
    verified_at: listing.verified_at || '',
    internal_memo: listing.internal_memo || '',
  };
}

function formToPayload(form: FormState) {
  return {
    courses: form.courses
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        attendance: c.attendance.trim() || null,
        note: c.note.trim() || null,
      })),
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

/**
 * コース一覧の編集・承認UI（管理画面専用）
 * AI抽出 → 下書き編集 → 人間確認 → 公開 のワークフロー。学費目安と同じ概念だが独立して管理する。
 */
export default function CourseEditor({ schoolId }: CourseEditorProps) {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<CourseListing | null>(null);
  const [draft, setDraft] = useState<CourseListing | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [coursePageUrl, setCoursePageUrl] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/courses`), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('コース一覧の取得に失敗しました');
      const data = (await res.json()) as {
        published: CourseListing | null;
        draft: CourseListing | null;
      };
      setPublished(data.published);
      setDraft(data.draft);
      if (data.draft) {
        setForm(listingToForm(data.draft));
      } else if (data.published) {
        setForm(listingToForm(data.published));
      } else {
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      console.error('コース一覧取得エラー:', e);
      alert(e instanceof Error ? e.message : 'コース一覧の取得に失敗しました');
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
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/courses`), {
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
    const message = coursePageUrl.trim()
      ? `指定したコースページURLからAI抽出を実行しますか？\n${coursePageUrl.trim()}\n\n既存の下書きは上書きされます（公開中の情報には影響しません）。`
      : '公式サイトURLを起点にコース情報のAI抽出を実行しますか？\n\n既存の下書きは上書きされます（公開中の情報には影響しません）。';
    if (!confirm(message)) return;

    setExtracting(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/courses/extract`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          coursePageUrl.trim() ? { coursePageUrl: coursePageUrl.trim() } : {}
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
      const foundText = data.found_courses
        ? 'コース名を検出しました。'
        : 'コース名は検出できませんでした。';
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
    listingId: string,
    action: 'publish' | 'unpublish' | 'reject'
  ) => {
    const labels = { publish: '公開', unpublish: '非公開化', reject: '却下' } as const;
    if (!confirm(`このコース一覧を${labels[action]}しますか？`)) return;

    setPublishing(true);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/courses/publish`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '状態変更に失敗しました');
      }
      alert(`${labels[action]}しました`);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '状態変更に失敗しました');
    } finally {
      setPublishing(false);
    }
  };

  const updateCourse = (index: number, field: 'name' | 'attendance' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  if (loading) {
    return <p className="text-sm text-gray-600 py-8 text-center">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">コース一覧の管理</h3>
        <p className="text-sm text-gray-600">
          公式サイトに明記されたコース名のみを転記します。AI抽出した下書きは必ず出典と照合してから公開してください。公開側には「出典: 学校公式サイト」のクレジットと公式サイトリンクが表示されます。
        </p>
      </div>

      {/* 公開中 */}
      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-900">公開中のコース一覧</h4>
          {published && (
            <button
              onClick={() => handlePublishAction(published.id, 'unpublish')}
              disabled={publishing || saving || extracting}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              非公開にする
            </button>
          )}
        </div>
        {published ? (
          <div className="text-sm text-gray-700 space-y-1">
            <ul className="list-disc pl-5 space-y-0.5">
              {published.courses.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.name}</span>
                  {c.attendance && <span className="text-gray-500">（{c.attendance}）</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 pt-1">
              情報源: {SOURCE_TYPE_LABELS[published.source_type]} / 確認日:{' '}
              {published.verified_at || '未確認'} / 作成元:{' '}
              {published.origin === 'ai' ? 'AI抽出' : '手入力'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">公開中のコース一覧はありません。</p>
        )}
      </div>

      {/* AI抽出 */}
      <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
        <h4 className="font-semibold text-gray-900 mb-2">AI抽出</h4>
        <p className="text-sm text-gray-600 mb-3">
          基本情報タブの「公式サイトURL」を起点に、コースページに明記された名称のみを抽出して下書きを作成します。見つからない場合は、下のURL欄で<strong>コース紹介の下層ページ</strong>を直接指定して再実行できます（公式トップURLは入れないでください）。
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={coursePageUrl}
            onChange={(e) => setCoursePageUrl(e.target.value)}
            placeholder="コースページURLを直接指定（任意）"
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

      {/* 下書き編集 */}
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
            <div className="flex items-center justify-between mb-2">
              <span className="block text-sm font-medium text-gray-700">コース一覧</span>
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    courses: [...prev.courses, { name: '', attendance: '', note: '' }],
                  }))
                }
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                追加
              </button>
            </div>
            {form.courses.length === 0 ? (
              <p className="text-xs text-gray-400">コースは未登録です。</p>
            ) : (
              <div className="space-y-2">
                {form.courses.map((course, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={course.name}
                      onChange={(e) => updateCourse(i, 'name', e.target.value)}
                      placeholder="コース名（公式サイトの名称をそのまま）"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={course.attendance}
                      onChange={(e) => updateCourse(i, 'attendance', e.target.value)}
                      placeholder="通学頻度（例: 週5日）"
                      className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={course.note}
                      onChange={(e) => updateCourse(i, 'note', e.target.value)}
                      placeholder="補足（任意）"
                      className="w-full sm:w-44 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          courses: prev.courses.filter((_, j) => j !== i),
                        }))
                      }
                      className="px-3 py-2 text-red-600 border border-red-200 rounded text-sm hover:bg-red-50 whitespace-nowrap"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="course-public-note" className="block text-sm font-medium text-gray-700 mb-1">
              コースに関する注意書き（公開表示）
            </label>
            <textarea
              id="course-public-note"
              value={form.public_note}
              onChange={(e) => setForm((prev) => ({ ...prev, public_note: e.target.value }))}
              rows={2}
              placeholder="例: コース名・募集状況は年度により変わる場合があります。"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              内部管理情報（ユーザー向けページには表示されません）
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="course-source-type" className="block text-sm font-medium text-gray-700 mb-1">
                  情報源の種別
                </label>
                <select
                  id="course-source-type"
                  value={form.source_type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, source_type: e.target.value as CourseSourceType }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(SOURCE_TYPE_LABELS) as CourseSourceType[]).map((key) => (
                    <option key={key} value={key}>
                      {SOURCE_TYPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="course-verified-at" className="block text-sm font-medium text-gray-700 mb-1">
                  情報確認日（人間が出典と照合した日）
                </label>
                <input
                  id="course-verified-at"
                  type="date"
                  value={form.verified_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, verified_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="block text-sm font-medium text-gray-700">出典URL</span>
                <button
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      source_urls: [...prev.source_urls, { url: '', note: '' }],
                    }))
                  }
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  追加
                </button>
              </div>
              {form.source_urls.length === 0 ? (
                <p className="text-xs text-gray-400">出典URLは未登録です。</p>
              ) : (
                <div className="space-y-2">
                  {form.source_urls.map((src, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="url"
                        value={src.url}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            source_urls: prev.source_urls.map((s, j) =>
                              j === i ? { ...s, url: e.target.value } : s
                            ),
                          }))
                        }
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={src.note}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            source_urls: prev.source_urls.map((s, j) =>
                              j === i ? { ...s, note: e.target.value } : s
                            ),
                          }))
                        }
                        placeholder="メモ"
                        className="w-32 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            source_urls: prev.source_urls.filter((_, j) => j !== i),
                          }))
                        }
                        className="px-3 py-2 text-red-600 border border-red-200 rounded text-sm hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="course-source-excerpt" className="block text-sm font-medium text-gray-700 mb-1">
                抽出元の原文抜粋（監査・読み取り専用）
              </label>
              <textarea
                id="course-source-excerpt"
                value={form.source_excerpt}
                readOnly
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-600"
              />
            </div>

            <div>
              <label htmlFor="course-internal-memo" className="block text-sm font-medium text-gray-700 mb-1">
                内部メモ（AI抽出の警告など）
              </label>
              <textarea
                id="course-internal-memo"
                value={form.internal_memo}
                onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 操作ボタン */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
            <button
              onClick={handleSaveDraft}
              disabled={saving || publishing || extracting}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? '保存中...' : '下書きを保存'}
            </button>
            {draft && (
              <>
                <button
                  onClick={() => handlePublishAction(draft.id, 'publish')}
                  disabled={publishing || saving || extracting}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  {publishing ? '処理中...' : 'この下書きを公開する'}
                </button>
                <button
                  onClick={() => handlePublishAction(draft.id, 'reject')}
                  disabled={publishing || saving || extracting}
                  className="px-4 py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm disabled:opacity-50"
                >
                  却下
                </button>
              </>
            )}
            <p className="text-xs text-gray-500 w-full">
              ※公開前に必ず出典ページとコース名を照合し、「情報確認日」を入力してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
