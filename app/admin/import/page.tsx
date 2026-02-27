'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  parseCsvToImportRows,
  validateImportRows,
  getTemplateCsvContent,
  VALIDATION_FIELD_LABELS,
  VALIDATION_FIELD_COLUMN,
  type ParseCsvResult,
  type SurveyImportRow,
  type RowValidationError,
} from '@/lib/csv-import';
import { surveyImportSchema } from '@/lib/schema';
import { appPath, apiPath } from '@/lib/base-path';

type Phase = 'upload' | 'preview' | 'result';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

export default function AdminImportPage() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [parseResult, setParseResult] = useState<ParseCsvResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<RowValidationError[]>([]);
  const [validRows, setValidRows] = useState<SurveyImportRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        const result = parseCsvToImportRows(text);
        setParseResult(result);
        if (result.rows.length === 0 && result.parseErrors.length > 0) {
          setValidationErrors([]);
          setValidRows([]);
          setPhase('preview');
          return;
        }
        const { valid, errors } = validateImportRows(result.rows, surveyImportSchema);
        setValidRows(valid);
        setValidationErrors(errors);
        setPhase('preview');
      };
      reader.onerror = () => setErrorMessage('ファイルの読み込みに失敗しました');
      reader.readAsText(file, 'UTF-8');
    },
    []
  );

  const handleDownloadTemplate = useCallback(() => {
    const content = getTemplateCsvContent();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async () => {
    if (validRows.length === 0) return;
    if (!confirm(`${validRows.length}件のアンケートをインポートします。よろしいですか？`)) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(apiPath('/api/admin/reviews/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error ?? 'インポートに失敗しました');
        setImportResult({
          success: data.success ?? 0,
          failed: data.failed ?? validRows.length,
          errors: Array.isArray(data.errors) ? data.errors : [],
        });
        setPhase('result');
        return;
      }
      setImportResult({
        success: data.success ?? 0,
        failed: data.failed ?? 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      setPhase('result');
    } catch (err) {
      setErrorMessage('通信エラーが発生しました');
      setPhase('result');
    } finally {
      setLoading(false);
    }
  }, [validRows]);

  const handleReset = useCallback(() => {
    setPhase('upload');
    setParseResult(null);
    setValidationErrors([]);
    setValidRows([]);
    setImportResult(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={appPath('/admin')}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← 管理画面トップ
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CSVアンケート一括インポート</h1>
        <p className="text-gray-600 text-sm mb-8">
          エクスポートCSVと同じ形式のファイルをアップロードし、アンケートを一括で登録します。学校名はシステムに登録済みの名前と完全一致している必要があります。
        </p>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {errorMessage}
          </div>
        )}

        {phase === 'upload' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. CSVファイルを選択</h2>
            <p className="text-sm text-gray-600 mb-4">
              テンプレートをダウンロードし、同じ列構成でデータを用意してください。
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                テンプレートCSVをダウンロード
              </button>
              <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
                CSVファイルを選択
                <input
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        )}

        {phase === 'preview' && parseResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 読み込み結果</h2>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>読み込み行数: {parseResult.rows.length}件</li>
                {parseResult.parseErrors.length > 0 && (
                  <li className="text-amber-700">パースエラー: {parseResult.parseErrors.length}件</li>
                )}
              </ul>
              {parseResult.parseErrors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">パースエラー詳細</p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                    {parseResult.parseErrors.map((e, i) => (
                      <li key={i}>
                        行{e.rowIndex}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. バリデーション結果</h2>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>バリデーション通過: {validRows.length}件</li>
                <li>エラー: {validationErrors.length}件</li>
              </ul>
              {validationErrors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">エラー行（修正してください）</p>
                  <p className="text-xs text-gray-500 mb-2">※「CSV○列目」はExcel等で開いたときの列番号です。該当セルの値を「入力値」のとおりに修正してください。</p>
                  <ul className="text-sm text-gray-600 space-y-4 max-h-[420px] overflow-y-auto pr-2">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="border border-amber-200 rounded-lg bg-amber-50/50 p-3">
                        <p className="font-medium text-gray-900 mb-2">CSVの行{err.rowIndex}（データ{err.rowIndex}件目）</p>
                        <ul className="list-disc list-inside space-y-2 text-amber-900/90">
                          {err.issues.map((iss, j) => {
                            const fieldKey = typeof iss.path[0] === 'string' ? iss.path[0] : String(iss.path[0]);
                            const label = VALIDATION_FIELD_LABELS[fieldKey] ?? fieldKey;
                            const colNum = VALIDATION_FIELD_COLUMN[fieldKey];
                            const raw = (err.row as unknown as Record<string, unknown>)[fieldKey];
                            const displayValue =
                              raw === undefined || raw === null
                                ? '（未入力）'
                                : Array.isArray(raw)
                                  ? (raw as string[]).join('；')
                                  : String(raw);
                            const colInfo = colNum != null ? `CSV${colNum}列目・` : '';
                            return (
                              <li key={j} className="flex flex-col gap-0.5">
                                <span className="font-medium text-gray-800">{colInfo}{label}</span>
                                <span className="text-red-700 bg-red-50/80 px-1.5 py-0.5 rounded text-xs font-mono">
                                  入力値: 「{displayValue}」
                                </span>
                                <span className="text-gray-700">{iss.message}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {validRows.length > 0 && validationErrors.length === 0 && (
                <div className="mt-6">
                  <p className="text-sm text-gray-700 mb-2">
                    {validRows.length}件すべてバリデーションを通過しました。インポートを実行できます。
                  </p>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'インポート中...' : 'インポート実行'}
                  </button>
                </div>
              )}
              {(validRows.length > 0 || validationErrors.length > 0) && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    別のファイルを選択
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'result' && importResult && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">4. インポート結果</h2>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>成功: {importResult.success}件</li>
              <li>失敗・スキップ: {importResult.failed}件</li>
            </ul>
            {importResult.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">エラー詳細</p>
                <ul className="text-sm text-gray-600 space-y-1 max-h-60 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>
                      行{e.rowIndex}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                もう一度インポート
              </button>
              <Link
                href={appPath('/admin')}
                className="ml-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                管理画面トップへ
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
