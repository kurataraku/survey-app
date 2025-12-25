'use client';

import { useState } from 'react';

export default function ExportPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError(null);

      const response = await fetch('/api/export');

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || data.message || 'CSVのダウンロードに失敗しました');
        }
        throw new Error('CSVのダウンロードに失敗しました');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const today = new Date().toISOString().split('T')[0];
      link.download = `survey_responses_${today}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSVダウンロードエラー:', e);
      setError(e instanceof Error ? e.message : 'CSVのダウンロードに失敗しました');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-sm border border-zinc-200 p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900">
            通信制高校リアルレビュー アンケートCSVダウンロード
          </h1>
          <p className="text-sm text-zinc-600">
            Supabaseに保存されたアンケート回答を、設問順のカラム構成でCSVとしてダウンロードできます。
          </p>
        </div>

        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 text-sm text-zinc-700 space-y-2">
          <p className="font-medium text-zinc-900">CSVのカラム順</p>
          <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
            <li>メタ情報：ID / 送信日時</li>
            <li>Step1 基本情報：Q1〜Q8（学校名〜入学年）</li>
            <li>Step2 学習/環境：Q9〜Q12.1（通学頻度〜生徒の雰囲気（その他））</li>
            <li>Step3 評価：Q13〜Q22（各評価〜総合満足度）</li>
            <li>自由記述・連絡先：Q23〜Q25（良かった点・改善点・メールアドレス）</li>
          </ol>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? '生成中...' : 'CSVをダウンロード'}
          </button>
          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            ※ データ件数が多い場合、生成に数秒かかることがあります。
          </p>
        </div>

        <div className="border-t border-zinc-200 pt-4 mt-2">
          <p className="text-xs text-zinc-500">
            CSVはUTF-8（BOM付き）で出力されます。Excelで開く際に文字化けする場合は、「データ &gt; テキスト/CSVからインポート」機能を利用し、文字コードにUTF-8を指定してください。
          </p>
        </div>
      </div>
    </div>
  );
}


