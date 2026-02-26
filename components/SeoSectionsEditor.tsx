'use client';

import { useState, useEffect } from 'react';
import { apiPath } from '@/lib/base-path';
import {
  SEO_SECTION_KEYS,
  SEO_SECTION_LABELS,
  FAQ_TOPIC,
  FAQ_QUESTIONS,
} from '@/lib/seo-sections';
import { REVIEW_TENDENCY_LABEL } from '@/lib/review-tendency';

interface SectionState {
  id: string;
  status: string;
  summary_text: string;
  generated_at: string | null;
}

interface ReviewTendencyRow {
  id: string;
  status: string;
  summary_text: string;
  generated_at: string | null;
  reviews_count_used?: number;
}

interface SeoSectionsData {
  sections: Record<string, SectionState>;
  faq: SectionState | null;
}

interface ReviewTendencyData {
  draft: ReviewTendencyRow | null;
  published: ReviewTendencyRow | null;
}

interface SeoSectionsEditorProps {
  schoolId: string;
}

const REVIEW_TENDENCY_KEY = 'review_tendency';

export default function SeoSectionsEditor({ schoolId }: SeoSectionsEditorProps) {
  const [data, setData] = useState<SeoSectionsData | null>(null);
  const [reviewTendency, setReviewTendency] = useState<ReviewTendencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<Record<string, string>>({});

  const fetchSections = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectionsRes, tendencyRes] = await Promise.all([
        fetch(apiPath(`/api/admin/schools/${schoolId}/seo-sections`)),
        fetch(apiPath(`/api/admin/schools/${schoolId}/review-tendency`)),
      ]);
      if (!sectionsRes.ok) throw new Error('SEOセクションの取得に失敗しました');
      if (!tendencyRes.ok) throw new Error('良い点・改善点の取得に失敗しました');
      const sectionsJson = await sectionsRes.json();
      const tendencyJson = await tendencyRes.json();
      setData({ sections: sectionsJson.sections || {}, faq: sectionsJson.faq || null });
      setReviewTendency({ draft: tendencyJson.draft || null, published: tendencyJson.published || null });
      setEditedText({});
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (summaryId: string, summaryText: string, editKey: string) => {
    setSaving(summaryId);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/ai-summary/${summaryId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_text: summaryText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存に失敗しました');
      setEditedText((prev) => {
        const next = { ...prev };
        delete next[editKey];
        return next;
      });
      await fetchSections();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [schoolId]);

  const handleGenerate = async (section: string) => {
    setGenerating(section);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/seo-sections/generate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || '生成に失敗しました');
      alert(
        section === FAQ_TOPIC
          ? `FAQを生成しました（トークン: ${json.tokensUsed?.total ?? '—'}）`
          : `「${SEO_SECTION_LABELS[section as keyof typeof SEO_SECTION_LABELS] || section}」を生成しました（トークン: ${json.tokensUsed?.total ?? '—'}）`
      );
      await fetchSections();
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateReviewTendency = async () => {
    setGenerating(REVIEW_TENDENCY_KEY);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/schools/${schoolId}/review-tendency/generate`), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || '生成に失敗しました');
      alert(`${REVIEW_TENDENCY_LABEL}を生成しました（トークン: ${json.tokensUsed ?? '—'}）`);
      await fetchSections();
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
    } finally {
      setGenerating(null);
    }
  };

  const handlePublish = async (summaryId: string) => {
    setPublishing(summaryId);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/ai-summary/${summaryId}/publish`), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '公開に失敗しました');
      alert('公開しました');
      await fetchSections();
    } catch (e) {
      setError(e instanceof Error ? e.message : '公開に失敗しました');
    } finally {
      setPublishing(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  const parseReviewTendency = (json: string | undefined) => {
    if (!json) return null;
    try {
      const p = JSON.parse(json) as { good_points?: string[]; improvement_points?: string[] };
      return Array.isArray(p.good_points) && Array.isArray(p.improvement_points) ? p : null;
    } catch {
      return null;
    }
  };
  const publishedParsed = parseReviewTendency(reviewTendency?.published?.summary_text);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        各セクションをGPTで生成し、下書きのまま編集したうえで公開できます。公開済みの内容が個別高校ページの「評判の詳細・よくある質問」に反映されます。
      </p>
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{REVIEW_TENDENCY_LABEL}</h3>
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-900">口コミを要約した良い点・改善してほしい点（各3箇条）</span>
            <div className="flex items-center gap-2">
              {reviewTendency?.published && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  公開中
                </span>
              )}
              {reviewTendency?.draft && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  下書きあり
                </span>
              )}
              <button
                type="button"
                onClick={handleGenerateReviewTendency}
                disabled={generating !== null}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating === REVIEW_TENDENCY_KEY ? '生成中...' : '生成'}
              </button>
              {reviewTendency?.draft?.id && (
                <button
                  type="button"
                  onClick={() => handlePublish(reviewTendency.draft!.id)}
                  disabled={publishing !== null}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {publishing === reviewTendency.draft?.id ? '公開中...' : '公開'}
                </button>
              )}
            </div>
          </div>
          {/* 公開中の内容を最優先で表示（公開ボタン押下後に「今の公開内容」がここに表示される） */}
          {reviewTendency?.published && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">現在公開中の内容</p>
              {publishedParsed ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm text-gray-600 rounded-lg border border-gray-200 bg-white p-4">
                  <div>
                    <p className="font-semibold text-green-700 mb-1">良い点</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {(publishedParsed.good_points ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-rose-700 mb-1">改善してほしい点</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {(publishedParsed.improvement_points ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">要約のプレビューを表示できません（JSON形式を確認してください）</p>
              )}
            </div>
          )}
          {reviewTendency?.draft && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-600 mb-2">
                {reviewTendency?.published ? '下書き（未公開）' : '下書き'}
              </p>
              <p className="text-xs text-gray-500 mb-1">JSON形式で編集できます。good_points と improvement_points はそれぞれ3要素の配列にしてください。</p>
              <textarea
                value={editedText[REVIEW_TENDENCY_KEY] ?? reviewTendency.draft.summary_text}
                onChange={(e) =>
                  setEditedText((prev) => ({ ...prev, [REVIEW_TENDENCY_KEY]: e.target.value }))
                }
                rows={12}
                className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm"
                placeholder='{"good_points":["...","...","..."],"improvement_points":["...","...","..."]}'
              />
              <button
                type="button"
                onClick={() =>
                  handleSaveDraft(
                    reviewTendency.draft!.id,
                    editedText[REVIEW_TENDENCY_KEY] ?? reviewTendency.draft!.summary_text,
                    REVIEW_TENDENCY_KEY
                  )
                }
                disabled={saving !== null}
                className="mt-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving === reviewTendency.draft?.id ? '保存中...' : '下書きを保存'}
              </button>
            </div>
          )}
          {!reviewTendency?.published && !reviewTendency?.draft && (
            <p className="mt-2 text-sm text-gray-500">未生成。口コミがある学校で「生成」を実行してください。</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">SEO本文セクション</h3>
        {SEO_SECTION_KEYS.map((key) => {
          const row = data?.sections?.[key];
          const label = SEO_SECTION_LABELS[key];
          const text = editedText[key] ?? row?.summary_text ?? '';
          return (
            <div
              key={key}
              className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{label}</span>
                <div className="flex items-center gap-2">
                  {row && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.status === 'published' ? '公開中' : '下書き'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleGenerate(key)}
                    disabled={generating !== null}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generating === key ? '生成中...' : '生成'}
                  </button>
                  {row?.id && row.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handlePublish(row.id)}
                      disabled={publishing !== null}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {publishing === row.id ? '公開中...' : '公開'}
                    </button>
                  )}
                </div>
              </div>
              {row ? (
                row.status === 'draft' ? (
                  <div className="mt-3">
                    <textarea
                      value={text}
                      onChange={(e) =>
                        setEditedText((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      rows={6}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                      placeholder="本文を編集..."
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDraft(row.id, text, key)}
                      disabled={saving !== null}
                      className="mt-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {saving === row.id ? '保存中...' : '下書きを保存'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                    {row.summary_text}
                  </p>
                )
              ) : (
                <p className="mt-2 text-sm text-gray-500">未生成</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">よくある質問（FAQ）</h3>
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-900">FAQ 5問（一括生成）</span>
            <div className="flex items-center gap-2">
              {data?.faq && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    data.faq.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {data.faq.status === 'published' ? '公開中' : '下書き'}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleGenerate(FAQ_TOPIC)}
                disabled={generating !== null}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating === FAQ_TOPIC ? '生成中...' : 'FAQを生成'}
              </button>
              {data?.faq?.id && data.faq.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handlePublish(data.faq!.id)}
                  disabled={publishing !== null}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {publishing === data.faq?.id ? '公開中...' : '公開'}
                </button>
              )}
            </div>
          </div>
          {data?.faq ? (
            data.faq.status === 'draft' ? (
              <div className="mt-3">
                <textarea
                  value={editedText['faq'] ?? data.faq.summary_text}
                  onChange={(e) =>
                    setEditedText((prev) => ({ ...prev, faq: e.target.value }))
                  }
                  rows={12}
                  className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm"
                  placeholder='[{"question":"...","answer":"..."}, ...]'
                />
                <button
                  type="button"
                  onClick={() =>
                    handleSaveDraft(
                      data.faq!.id,
                      editedText['faq'] ?? data.faq!.summary_text,
                      'faq'
                    )
                  }
                  disabled={saving !== null}
                  className="mt-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving === data.faq?.id ? '保存中...' : '下書きを保存'}
                </button>
              </div>
            ) : (
              (() => {
                try {
                  const items = JSON.parse(
                    data.faq.summary_text
                  ) as Array<{ question: string; answer: string }>;
                  if (!Array.isArray(items))
                    return (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                        {data.faq.summary_text}
                      </p>
                    );
                  return (
                    <ul className="mt-2 space-y-3 text-sm text-gray-600">
                      {items.map((item, i) => (
                        <li key={i}>
                          <strong>Q:</strong> {item.question}
                          <br />
                          <strong>A:</strong> {item.answer}
                        </li>
                      ))}
                    </ul>
                  );
                } catch {
                  return (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                      {data.faq.summary_text}
                    </p>
                  );
                }
              })()
            )
          ) : (
            <p className="mt-2 text-sm text-gray-500">未生成</p>
          )}
        </div>
        <p className="text-xs text-gray-500">
          設問: {FAQ_QUESTIONS.join(' / ')}
        </p>
      </div>
    </div>
  );
}
