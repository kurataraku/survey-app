'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ConsultationAiLogicEditor from '@/components/admin/ConsultationAiLogicEditor';
import { DEFAULT_CONSULTATION_AI_LOGIC_DOCS } from '@/lib/consultation-ai-logic/defaults';
import type { ConsultationAiLogicDocsContent } from '@/lib/consultation-ai-logic/schema';
import { apiPath, appPath } from '@/lib/base-path';

type DocsResponse = ConsultationAiLogicDocsContent & {
  id?: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return '未更新';
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

export default function ConsultationAiLogicPage() {
  const [docs, setDocs] = useState<DocsResponse | null>(null);
  const [draft, setDraft] = useState<ConsultationAiLogicDocsContent>(DEFAULT_CONSULTATION_AI_LOGIC_DOCS);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch(apiPath('/api/admin/consultation-ai-logic'));
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503 && data.defaults) {
          setTableMissing(true);
          setDocs(null);
          setDraft(data.defaults as ConsultationAiLogicDocsContent);
          setMessage({
            type: 'error',
            text:
              data.details ??
              'DBテーブルが未作成のため、初期データを表示しています。保存するにはマイグレーションを適用してください。',
          });
          return;
        }
        throw new Error(data.details ?? data.error ?? 'ドキュメントの取得に失敗しました');
      }
      setTableMissing(false);
      setDocs(data);
      setDraft({
        purpose_intro: data.purpose_intro,
        purpose_note: data.purpose_note,
        logic_flow: data.logic_flow,
        active_rules: data.active_rules,
        improvement_history: data.improvement_history,
        review_loop: data.review_loop,
        caution_notes: data.caution_notes,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'ドキュメントの取得に失敗しました',
      });
      setDraft(DEFAULT_CONSULTATION_AI_LOGIC_DOCS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(apiPath('/api/admin/consultation-ai-logic'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? '保存に失敗しました');
      }
      setDocs(data.docs);
      setDraft({
        purpose_intro: data.docs.purpose_intro,
        purpose_note: data.docs.purpose_note,
        logic_flow: data.docs.logic_flow,
        active_rules: data.docs.active_rules,
        improvement_history: data.docs.improvement_history,
        review_loop: data.docs.review_loop,
        caution_notes: data.docs.caution_notes,
      });
      setIsEditing(false);
      setTableMissing(false);
      setMessage({ type: 'success', text: '保存しました。デプロイなしで反映されています。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存に失敗しました',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (docs) {
      setDraft({
        purpose_intro: docs.purpose_intro,
        purpose_note: docs.purpose_note,
        logic_flow: docs.logic_flow,
        active_rules: docs.active_rules,
        improvement_history: docs.improvement_history,
        review_loop: docs.review_loop,
        caution_notes: docs.caution_notes,
      });
    } else {
      setDraft(DEFAULT_CONSULTATION_AI_LOGIC_DOCS);
    }
    setIsEditing(false);
    setMessage(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  const viewData = docs ?? draft;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={appPath('/admin')} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← 管理画面に戻る
          </Link>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">相談AIロジック・改善履歴</h1>
              <p className="mt-2 text-gray-600">
                相談AIの説明・改善履歴を管理画面から編集できます（デプロイ不要）。
              </p>
              <p className="mt-1 text-xs text-gray-500">最終更新: {formatUpdatedAt(docs?.updated_at)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={appPath('/admin/consultation-chats')}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                相談ログを見る
              </Link>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving || tableMissing}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={tableMissing}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  編集
                </button>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-lg border p-4 text-sm ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {tableMissing && (
          <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold text-amber-950">初回セットアップが必要です</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Supabase で{' '}
              <code className="rounded bg-amber-100 px-1">supabase-migrations/create-consultation-ai-logic-docs.sql</code>{' '}
              を実行すると、編集内容を保存できるようになります。
            </p>
          </section>
        )}

        {isEditing ? (
          <ConsultationAiLogicEditor draft={draft} onChange={setDraft} disabled={isSaving} />
        ) : (
          <>
            <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
              <h2 className="text-xl font-semibold text-blue-950">このページの目的</h2>
              <p className="mt-2 text-sm leading-6 text-blue-900">{viewData.purpose_intro}</p>
              <p className="mt-3 text-sm leading-6 text-blue-900">{viewData.purpose_note}</p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">現在の回答生成フロー</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {viewData.logic_flow.map((item) => (
                  <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{item.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.examples.map((example) => (
                        <span key={example} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">現在有効な主なルール</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {viewData.active_rules.map((group) => (
                  <div key={group.category} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900">{group.category}</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                      {group.rules.map((rule) => (
                        <li key={rule} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">改善履歴</h2>
              <div className="space-y-4">
                {viewData.improvement_history.map((item) => (
                  <div
                    key={`${item.date}-${item.title}`}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {item.date}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                      {item.changes.map((change) => (
                        <li key={change} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900">改善サイクル</h2>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                  {viewData.review_loop.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="text-xl font-bold text-amber-950">注意点</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-900">
                  {viewData.caution_notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
