'use client';

import { useState, useEffect, useRef } from 'react';
import { ArticleFormData, ArticleCategory } from '@/lib/types/articles';
import { generateSlug } from '@/lib/utils';
import RichTextEditor from './RichTextEditor';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(value || null);
  }, [value]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルのみアップロードできます');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下である必要があります');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || '画像のアップロードに失敗しました';
        const details = errorData.details ? `\n詳細: ${errorData.details}` : '';
        const hint = errorData.hint ? `\n\n解決方法:\n${errorData.hint}` : '';
        throw new Error(errorMessage + details + hint);
      }

      const data = await response.json();
      onChange(data.url);
      setPreviewUrl(data.url);
    } catch (error) {
      console.error('画像アップロードエラー:', error);
      alert(error instanceof Error ? error.message : '画像のアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-orange-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isUploading}
        />
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
            <p className="text-sm text-gray-600">アップロード中...</p>
          </div>
        ) : previewUrl ? (
          <div className="space-y-2">
            <img
              src={previewUrl}
              alt="プレビュー"
              className="max-h-48 mx-auto rounded-lg object-contain"
            />
            <p className="text-sm text-gray-600">クリックまたはドラッグ&ドロップで画像を変更</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-600 mb-1">
              クリックまたはドラッグ&ドロップで画像をアップロード
            </p>
            <p className="text-xs text-gray-500">対応形式: JPG, PNG, GIF (最大10MB)</p>
          </div>
        )}
      </div>
      {previewUrl && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={previewUrl}
            onChange={(e) => {
              const url = e.target.value;
              setPreviewUrl(url);
              onChange(url);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            placeholder="または画像URLを直接入力"
          />
          <button
            type="button"
            onClick={() => {
              onChange('');
              setPreviewUrl(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}

interface ArticleEditorProps {
  initialData?: Partial<ArticleFormData>;
  onSubmit: (data: ArticleFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export default function ArticleEditor({
  initialData,
  onSubmit,
  isSubmitting = false,
}: ArticleEditorProps) {
  const [formData, setFormData] = useState<ArticleFormData>({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    category: initialData?.category || 'interview',
    content: initialData?.content || '',
    excerpt: initialData?.excerpt || '',
    featured_image_url: initialData?.featured_image_url || '',
    is_public: initialData?.is_public !== undefined ? initialData.is_public : false,
    published_at: initialData?.published_at || null,
    meta_title: initialData?.meta_title || '',
    meta_description: initialData?.meta_description || '',
  });

  const [slugAutoGenerated, setSlugAutoGenerated] = useState(false);

  // タイトルからスラッグを自動生成
  useEffect(() => {
    if (!initialData?.slug && formData.title && !slugAutoGenerated) {
      const generatedSlug = generateSlug(formData.title);
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
      setSlugAutoGenerated(true);
    }
  }, [formData.title, initialData?.slug, slugAutoGenerated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'title' && !slugAutoGenerated) {
      // タイトル変更時にスラッグも自動更新（手動編集していない場合）
      const generatedSlug = generateSlug(value);
      setFormData((prev) => ({
        ...prev,
        title: value,
        slug: generatedSlug,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }

    // スラッグを手動編集した場合、自動生成フラグを解除
    if (name === 'slug') {
      setSlugAutoGenerated(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
          スラッグ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="slug"
          name="slug"
          value={formData.slug}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          URLに使用されるスラッグ（例: article-title）
        </p>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          カテゴリ <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="interview">リアル体験談 クチコミ・インタビュー</option>
          <option value="useful_info">通信制高校お役立ち情報</option>
        </select>
      </div>

      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-1">
          抜粋
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          value={formData.excerpt}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="記事の抜粋文を入力してください（一覧表示で使用されます）"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          本文
        </label>
        <RichTextEditor
          value={formData.content}
          onChange={(html) => {
            setFormData((prev) => ({ ...prev, content: html }));
          }}
          placeholder="本文を入力してください..."
        />
        <p className="mt-2 text-sm text-gray-500">
          <strong>使い方:</strong> ツールバーから見出し、太字、リストなどの書式を選択できます。キーボードショートカット（Ctrl+B: 太字、Ctrl+I: 斜体、Ctrl+U: 下線）も使用できます。
        </p>
      </div>

      <div>
        <label htmlFor="featured_image_url" className="block text-sm font-medium text-gray-700 mb-1">
          アイキャッチ画像
        </label>
        <ImageUpload
          value={formData.featured_image_url}
          onChange={(url) => {
            setFormData((prev) => ({ ...prev, featured_image_url: url }));
          }}
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_public"
          name="is_public"
          checked={formData.is_public}
          onChange={handleChange}
          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
        />
        <label htmlFor="is_public" className="ml-2 text-sm font-medium text-gray-700">
          公開する
        </label>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">SEO設定</h3>

        <div className="mb-4">
          <label htmlFor="meta_title" className="block text-sm font-medium text-gray-700 mb-1">
            メタタイトル
          </label>
          <input
            type="text"
            id="meta_title"
            name="meta_title"
            value={formData.meta_title}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="SEO用のタイトル（未指定の場合はタイトルが使用されます）"
          />
        </div>

        <div>
          <label htmlFor="meta_description" className="block text-sm font-medium text-gray-700 mb-1">
            メタ説明
          </label>
          <textarea
            id="meta_description"
            name="meta_description"
            value={formData.meta_description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="SEO用の説明文（未指定の場合は抜粋が使用されます）"
          />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}




