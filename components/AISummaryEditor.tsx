'use client';

import { useState, useEffect } from 'react';
import { apiPath } from '@/lib/base-path';

interface AISummary {
  id: string;
  school_id: string;
  kind: string;
  topic: string | null;
  status: 'draft' | 'published';
  summary_text: string;
  meta_title: string | null;
  meta_description: string | null;
  reviews_count_used: number;
  source_signature: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

interface AISummaryEditorProps {
  schoolId: string;
}

export default function AISummaryEditor({ schoolId }: AISummaryEditorProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSummaryText, setEditedSummaryText] = useState('');
  const [editedMetaTitle, setEditedMetaTitle] = useState('');
  const [editedMetaDescription, setEditedMetaDescription] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [schoolId]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      // draftまたはpublishedの要約を取得
      const response = await fetch(apiPath(`/api/admin/schools/${schoolId}/ai-summary`));
      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          setSummary(data.summary);
          setEditedSummaryText(data.summary.summary_text);
          setEditedMetaTitle(data.summary.meta_title || '');
          setEditedMetaDescription(data.summary.meta_description || '');
        } else {
          setSummary(null);
        }
      } else if (response.status !== 404) {
        const errorData = await response.json();
        throw new Error(errorData.error || '要約の取得に失敗しました');
      }
    } catch (error) {
      console.error('要約取得エラー:', error);
      setError(error instanceof Error ? error.message : '要約の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm('AI要約を生成しますか？既存の下書きがある場合は上書きされます。')) {
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(apiPath(`/api/admin/schools/${schoolId}/ai-summary/generate`), {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '要約の生成に失敗しました');
      }

      const data = await response.json();
      setSummary(data.summary);
      setEditedSummaryText(data.summary.summary_text);
      setEditedMetaTitle(data.summary.meta_title || '');
      setEditedMetaDescription(data.summary.meta_description || '');

      alert(`要約を生成しました（使用トークン: ${data.tokensUsed?.total || '不明'}）`);
    } catch (error) {
      console.error('要約生成エラー:', error);
      setError(error instanceof Error ? error.message : '要約の生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!summary) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-summary/${summary.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary_text: editedSummaryText,
          meta_title: editedMetaTitle || null,
          meta_description: editedMetaDescription || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '下書きの保存に失敗しました');
      }

      const data = await response.json();
      setSummary(data.summary);
      alert('下書きを保存しました');
    } catch (error) {
      console.error('下書き保存エラー:', error);
      setError(error instanceof Error ? error.message : '下書きの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!summary || summary.status !== 'draft') {
      return;
    }

    if (!confirm('この要約を公開しますか？既存の公開済み要約がある場合は非公開になります。')) {
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const response = await fetch(apiPath(`/api/admin/ai-summary/${summary.id}/publish`), {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '要約の公開に失敗しました');
      }

      const data = await response.json();
      setSummary(data.summary);
      alert('要約を公開しました');
    } catch (error) {
      console.error('要約公開エラー:', error);
      setError(error instanceof Error ? error.message : '要約の公開に失敗しました');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">AI口コミ要約</h3>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {generating ? '生成中...' : '要約を生成する（GPT-4o）'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              ステータス:{' '}
              <span
                className={`font-semibold ${
                  summary.status === 'published' ? 'text-green-600' : 'text-gray-600'
                }`}
              >
                {summary.status === 'published' ? '公開済み' : '下書き'}
              </span>
            </span>
            <span>使用口コミ数: {summary.reviews_count_used}件</span>
            <span>生成日時: {new Date(summary.generated_at).toLocaleString('ja-JP')}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              要約テキスト
            </label>
            <textarea
              value={editedSummaryText}
              onChange={(e) => setEditedSummaryText(e.target.value)}
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meta Title（28〜35文字推奨）
            </label>
            <input
              type="text"
              value={editedMetaTitle}
              onChange={(e) => setEditedMetaTitle(e.target.value)}
              maxLength={60}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {editedMetaTitle.length}文字 / 60文字
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meta Description（100〜120文字推奨）
            </label>
            <textarea
              value={editedMetaDescription}
              onChange={(e) => setEditedMetaDescription(e.target.value)}
              rows={3}
              maxLength={160}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {editedMetaDescription.length}文字 / 160文字
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || summary.status === 'published'}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '下書き保存'}
            </button>
            {summary.status === 'draft' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {publishing ? '公開中...' : '公開する'}
              </button>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-2">再生成判断の参考情報:</p>
            <p>Source Signature: {summary.source_signature.slice(0, 16)}...</p>
            <p className="mt-2">
              ※Source Signatureが変わった場合、口コミデータに変化がある可能性があります。
            </p>
          </div>
        </div>
      )}

      {!summary && !loading && (
        <div className="text-center py-8 text-gray-500">
          <p>まだ要約が生成されていません。</p>
          <p className="mt-2 text-sm">「要約を生成する」ボタンをクリックして生成してください。</p>
        </div>
      )}
    </div>
  );
}
