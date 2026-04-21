'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiPath, appPath } from '@/lib/base-path';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type {
  SeoDraftWithEvidence,
  DraftStatus,
  EvidenceKind,
} from '@/lib/seo-generation/types';

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: string; variant: 'primary' | 'default' | 'warning' | 'success' | 'error' }
> = {
  generating: { label: '生成中', variant: 'primary' },
  draft: { label: '下書き', variant: 'default' },
  needs_review: { label: '要レビュー', variant: 'warning' },
  revised: { label: '修正済み', variant: 'primary' },
  approved: { label: '承認済み', variant: 'success' },
  failed: { label: '失敗', variant: 'error' },
};

const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  review: '口コミ',
  article: '体験談・記事',
  school_info: '学校情報',
  web: 'Web',
};

type TabId = 'body' | 'outline' | 'evidence' | 'verify';

export default function SeoDraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<SeoDraftWithEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('body');
  const [editingBody, setEditingBody] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    fetchDraft();
  }, [id]);

  const fetchDraft = async () => {
    try {
      const res = await fetch(apiPath(`/api/admin/seo-drafts/${id}`));
      if (!res.ok) throw new Error('取得失敗');
      const data: SeoDraftWithEvidence = await res.json();
      setDraft(data);
      setBodyDraft(data.body_md || '');
    } catch (error) {
      console.error('下書き取得失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(apiPath(`/api/admin/seo-drafts/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchDraft();
        setEditingBody(false);
      }
    } catch (error) {
      console.error('保存失敗:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: DraftStatus) => {
    await handleSave({ status: newStatus });
  };

  const handleApproveAndTransfer = async () => {
    if (!confirm('承認して記事管理に転送しますか？\n（未公開の状態で記事が作成されます）')) return;
    setApproving(true);
    try {
      const res = await fetch(apiPath(`/api/admin/seo-drafts/${id}/transfer`), {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '転送に失敗しました');
      }
      const data = await res.json();
      alert('記事管理に転送しました。記事編集画面に移動します。');
      router.push(appPath(`/admin/articles/${data.articleId}/edit`));
    } catch (error) {
      console.error('転送失敗:', error);
      alert(error instanceof Error ? error.message : '転送に失敗しました');
    } finally {
      setApproving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(apiPath('/api/admin/upload/image'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'アップロード失敗');
      }

      const data = await res.json();
      await handleSave({ featured_image_url: data.url });
    } catch (error) {
      console.error('画像アップロード失敗:', error);
      alert(error instanceof Error ? error.message : 'アップロードに失敗しました');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRewrite = async () => {
    if (!confirm('リライト（品質改善）を実行しますか？\n記事本文がAIにより書き直されます。')) return;
    setRewriting(true);
    try {
      const rewriteRes = await fetch(apiPath(`/api/admin/seo-drafts/${id}/rewrite`), {
        method: 'POST',
      });
      if (!rewriteRes.ok) {
        const body = await rewriteRes.json().catch(() => ({}));
        throw new Error(body.error || 'リライトに失敗しました');
      }

      const verifyRes = await fetch(apiPath(`/api/admin/seo-drafts/${id}/verify`), {
        method: 'POST',
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || '再検証に失敗しました');
      }

      await fetchDraft();
    } catch (error) {
      console.error('リライト失敗:', error);
      alert(error instanceof Error ? error.message : 'リライトに失敗しました');
    } finally {
      setRewriting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-yellow-100 text-yellow-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-yellow-500';
    if (score >= 60) return 'bg-orange-400';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center py-12 text-gray-500">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center py-12 text-gray-500">
          下書きが見つかりません
        </div>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[draft.status] || STATUS_CONFIG.draft;
  const selfEvidenceCount = draft.evidence.filter(
    (e) => e.kind !== 'web'
  ).length;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'body', label: '本文編集' },
    { id: 'outline', label: 'アウトライン' },
    { id: 'evidence', label: `根拠カード (${draft.evidence.length})` },
    { id: 'verify', label: '検証結果' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {draft.title || draft.keyword}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant={statusConf.variant} size="sm">
                  {statusConf.label}
                </Badge>
                <span className="text-sm text-gray-500">
                  キーワード: {draft.keyword}
                </span>
                {draft.school && (
                  <span className="text-sm text-gray-500">
                    学校: {draft.school.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {draft.status === 'draft' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('needs_review')}
                >
                  レビュー依頼
                </Button>
              )}
              {(draft.status === 'needs_review' || draft.status === 'revised') && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={approving}
                  onClick={handleApproveAndTransfer}
                >
                  {approving ? '転送中...' : '承認 → 記事管理に転送'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 検証サマリー (常時表示) */}
        {draft.quality_score && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">品質スコア:</span>
                  <span className={`text-xl font-bold ${getScoreColor(draft.quality_score.overall)}`}>
                    {draft.quality_score.overall}/100
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { label: '事実精度', value: draft.quality_score.factAccuracy },
                    { label: 'SEO', value: draft.quality_score.seoOptimization },
                    { label: '可読性', value: draft.quality_score.readability },
                    { label: '自社データ', value: draft.quality_score.selfDataRatio },
                  ].map(({ label, value }) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getScoreBgColor(value)}`}
                    >
                      {label}
                      <span className="font-bold">{value}</span>
                    </span>
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  根拠: 自社{selfEvidenceCount}件 / 全{draft.evidence.length}件
                </span>
              </div>
              {draft.quality_score.overall < 80 && draft.status !== 'generating' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rewriting}
                  onClick={handleRewrite}
                >
                  {rewriting ? 'リライト中...' : 'リライト（品質改善）'}
                </Button>
              )}
            </div>
            {/* Score bars */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '事実精度', value: draft.quality_score.factAccuracy },
                { label: 'SEO最適化', value: draft.quality_score.seoOptimization },
                { label: '可読性', value: draft.quality_score.readability },
                { label: '自社データ比率', value: draft.quality_score.selfDataRatio },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{label}</span>
                    <span className={`font-medium ${getScoreColor(value)}`}>{value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getScoreBarColor(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* タブコンテンツ */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'body' && (
            <div className="space-y-4">
              {/* サムネイル画像 */}
              <div className="border border-gray-200 rounded p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-2">サムネイル画像</h3>
                {draft.featured_image_url ? (
                  <div className="flex items-start gap-4">
                    <img
                      src={draft.featured_image_url}
                      alt="サムネイル"
                      className="w-48 h-32 object-cover rounded border"
                    />
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                        {uploadingImage ? 'アップロード中...' : '画像を変更'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>
                      <button
                        onClick={() => handleSave({ featured_image_url: null })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        画像を削除
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                    {uploadingImage ? 'アップロード中...' : '画像をアップロード'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                )}
              </div>

              {/* SEOメタ情報 */}
              {draft.seo_meta && (
                <div className="border border-gray-200 rounded p-4 bg-gray-50 space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">SEOメタ情報</h3>
                  <div className="text-sm">
                    <span className="text-gray-500">title: </span>
                    <span className="text-gray-900">{draft.seo_meta.metaTitle}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">description: </span>
                    <span className="text-gray-900">{draft.seo_meta.metaDescription}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">キーワード: </span>
                    <span className="text-gray-900">
                      {draft.seo_meta.focusKeyword}
                      {draft.seo_meta.secondaryKeywords?.length > 0 &&
                        `, ${draft.seo_meta.secondaryKeywords.join(', ')}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 本文 */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">本文 (Markdown)</h3>
                <div className="flex gap-2">
                  {!editingBody ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewMode(!previewMode)}
                      >
                        {previewMode ? 'ソース表示' : 'プレビュー'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingBody(true)}
                      >
                        編集
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingBody(false);
                          setBodyDraft(draft.body_md || '');
                        }}
                      >
                        キャンセル
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleSave({ body_md: bodyDraft })}
                      >
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editingBody ? (
                <textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  className="w-full h-[600px] font-mono text-sm border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : draft.body_md ? (
                previewMode ? (
                  /* 本番ブログ（features/[slug]）と同じレイアウトで表示 */
                  <div className="bg-gray-50 -mx-6 -mb-6 mt-2 p-6 rounded-b-lg">
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <div className="mb-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            通信制高校お役立ち情報
                          </span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                          {draft.title || draft.keyword}
                        </h1>
                        <p className="text-sm text-gray-500 mb-4">
                          {new Date().toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        {draft.featured_image_url && (
                          <div className="mb-6">
                            <img
                              src={draft.featured_image_url}
                              alt={draft.title || draft.keyword}
                              className="w-full h-auto rounded-lg"
                            />
                          </div>
                        )}
                        {draft.seo_meta?.metaDescription && (
                          <p className="text-lg text-gray-700 mb-4">
                            {draft.seo_meta.metaDescription}
                          </p>
                        )}
                      </div>
                      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <MarkdownRenderer content={draft.body_md} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed bg-gray-50 rounded p-4">
                    {draft.body_md}
                  </pre>
                )
              ) : (
                <p className="text-gray-400 italic">本文がまだありません</p>
              )}
            </div>
          )}

          {activeTab === 'outline' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">記事構成</h3>
              {draft.outline_json && draft.outline_json.length > 0 ? (
                <div className="space-y-2">
                  {draft.outline_json.map((section, i) => (
                    <div
                      key={i}
                      className={`${section.level === 3 ? 'ml-6' : ''} py-2`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">
                          H{section.level}
                        </span>
                        <span
                          className={`text-sm ${
                            section.level === 2
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {section.heading}
                          {section.isFaq && (
                            <span className="ml-2 text-xs text-blue-500">[FAQ]</span>
                          )}
                        </span>
                      </div>
                      {section.keyPoints?.length > 0 && (
                        <ul className="ml-12 mt-1 space-y-1">
                          {section.keyPoints.map((point, j) => (
                            <li key={j} className="text-xs text-gray-500">
                              - {point}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">アウトラインがまだありません</p>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">根拠カード</h3>
              {draft.evidence.length > 0 ? (
                <div className="space-y-3">
                  {(['review', 'article', 'school_info', 'web'] as EvidenceKind[]).map(
                    (kind) => {
                      const items = draft.evidence.filter((e) => e.kind === kind);
                      if (items.length === 0) return null;
                      return (
                        <div key={kind}>
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                            {EVIDENCE_KIND_LABELS[kind]} ({items.length})
                          </h4>
                          <div className="space-y-2">
                            {items.map((ev) => (
                              <div
                                key={ev.id}
                                className="border border-gray-200 rounded p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-800">
                                    {ev.title || '(無題)'}
                                  </span>
                                  <Badge
                                    variant={
                                      ev.confidence === 'high'
                                        ? 'success'
                                        : ev.confidence === 'low'
                                          ? 'warning'
                                          : 'default'
                                    }
                                    size="sm"
                                  >
                                    {ev.confidence}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{ev.summary}</p>
                                {ev.section_ref && (
                                  <p className="text-xs text-blue-800 font-medium mt-2 bg-blue-50 rounded px-2 py-1">
                                    引用元: {ev.section_ref}
                                  </p>
                                )}
                                {ev.excerpt && (
                                  <p className="text-xs text-gray-400 mt-1 italic">
                                    &ldquo;{ev.excerpt}&rdquo;
                                  </p>
                                )}
                                {ev.url && (
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                                  >
                                    出典を開く
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <p className="text-gray-400 italic">根拠カードがまだありません</p>
              )}
            </div>
          )}

          {activeTab === 'verify' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">検証結果</h3>
                {draft.quality_score && draft.quality_score.overall < 80 && draft.status !== 'generating' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rewriting}
                    onClick={handleRewrite}
                  >
                    {rewriting ? 'リライト中...' : 'リライト（品質改善）'}
                  </Button>
                )}
              </div>
              {draft.quality_score ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: '総合', value: draft.quality_score.overall },
                      { label: '事実精度', value: draft.quality_score.factAccuracy },
                      { label: 'SEO最適化', value: draft.quality_score.seoOptimization },
                      { label: '可読性', value: draft.quality_score.readability },
                      { label: '自社データ比率', value: draft.quality_score.selfDataRatio },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="bg-gray-50 rounded-lg p-4 text-center"
                      >
                        <div className={`text-2xl font-bold ${getScoreColor(value)}`}>
                          {value}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{label}</div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full ${getScoreBarColor(value)}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {draft.quality_score.issues?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        指摘事項 ({draft.quality_score.issues.length}件)
                      </h4>
                      <div className="space-y-2">
                        {draft.quality_score.issues.map((issue, i) => (
                          <div
                            key={i}
                            className={`text-sm p-3 rounded ${
                              issue.severity === 'error'
                                ? 'bg-red-50 text-red-700'
                                : issue.severity === 'warning'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            <span className="font-medium capitalize">
                              [{issue.severity}]
                            </span>{' '}
                            {issue.message}
                            {issue.section && (
                              <span className="text-xs opacity-75">
                                {' '}
                                ({issue.section})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  検証結果がまだありません
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
