'use client';

import type {
  ActiveRuleGroup,
  ConsultationAiLogicDocsContent,
  ImprovementHistoryItem,
  LogicFlowItem,
} from '@/lib/consultation-ai-logic/schema';
import { linesToText, textToLines } from '@/lib/consultation-ai-logic/schema';

type ConsultationAiLogicEditorProps = {
  draft: ConsultationAiLogicDocsContent;
  onChange: (next: ConsultationAiLogicDocsContent) => void;
  disabled?: boolean;
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700">{children}</label>;
}

function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
    />
  );
}

function TextArea({
  value,
  onChange,
  disabled,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 text-gray-900 disabled:bg-gray-100"
    />
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export default function ConsultationAiLogicEditor({
  draft,
  onChange,
  disabled = false,
}: ConsultationAiLogicEditorProps) {
  const updateLogicFlow = (index: number, patch: Partial<LogicFlowItem>) => {
    const next = draft.logic_flow.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    onChange({ ...draft, logic_flow: next });
  };

  const updateActiveRule = (index: number, patch: Partial<ActiveRuleGroup>) => {
    const next = draft.active_rules.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    onChange({ ...draft, active_rules: next });
  };

  const updateHistory = (index: number, patch: Partial<ImprovementHistoryItem>) => {
    const next = draft.improvement_history.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    onChange({ ...draft, improvement_history: next });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="ページ説明">
        <div>
          <FieldLabel>このページの目的（本文）</FieldLabel>
          <TextArea
            value={draft.purpose_intro}
            onChange={(value) => onChange({ ...draft, purpose_intro: value })}
            disabled={disabled}
            rows={4}
          />
        </div>
        <div>
          <FieldLabel>補足（実装との関係など）</FieldLabel>
          <TextArea
            value={draft.purpose_note}
            onChange={(value) => onChange({ ...draft, purpose_note: value })}
            disabled={disabled}
            rows={4}
          />
        </div>
      </SectionCard>

      <SectionCard title="回答生成フロー">
        {draft.logic_flow.map((item, index) => (
          <div key={`logic-flow-${index}`} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">ステップ {index + 1}</p>
              <SecondaryButton
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...draft,
                    logic_flow: draft.logic_flow.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                削除
              </SecondaryButton>
            </div>
            <FieldLabel>タイトル</FieldLabel>
            <TextInput
              value={item.title}
              onChange={(value) => updateLogicFlow(index, { title: value })}
              disabled={disabled}
            />
            <div className="mt-3">
              <FieldLabel>説明</FieldLabel>
              <TextArea
                value={item.body}
                onChange={(value) => updateLogicFlow(index, { body: value })}
                disabled={disabled}
                rows={3}
              />
            </div>
            <div className="mt-3">
              <FieldLabel>例（1行1件）</FieldLabel>
              <TextArea
                value={linesToText(item.examples)}
                onChange={(value) => updateLogicFlow(index, { examples: textToLines(value) })}
                disabled={disabled}
                rows={3}
              />
            </div>
          </div>
        ))}
        <SecondaryButton
          disabled={disabled}
          onClick={() =>
            onChange({
              ...draft,
              logic_flow: [
                ...draft.logic_flow,
                { title: '新しいステップ', body: '', examples: [] },
              ],
            })
          }
        >
          ステップを追加
        </SecondaryButton>
      </SectionCard>

      <SectionCard title="有効なルール">
        {draft.active_rules.map((group, index) => (
          <div key={`active-rule-${index}`} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">カテゴリ {index + 1}</p>
              <SecondaryButton
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...draft,
                    active_rules: draft.active_rules.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                削除
              </SecondaryButton>
            </div>
            <FieldLabel>カテゴリ名</FieldLabel>
            <TextInput
              value={group.category}
              onChange={(value) => updateActiveRule(index, { category: value })}
              disabled={disabled}
            />
            <div className="mt-3">
              <FieldLabel>ルール（1行1件）</FieldLabel>
              <TextArea
                value={linesToText(group.rules)}
                onChange={(value) => updateActiveRule(index, { rules: textToLines(value) })}
                disabled={disabled}
                rows={5}
              />
            </div>
          </div>
        ))}
        <SecondaryButton
          disabled={disabled}
          onClick={() =>
            onChange({
              ...draft,
              active_rules: [...draft.active_rules, { category: '新しいカテゴリ', rules: ['新しいルール'] }],
            })
          }
        >
          カテゴリを追加
        </SecondaryButton>
      </SectionCard>

      <SectionCard title="改善履歴">
        {draft.improvement_history.map((item, index) => (
          <div key={`history-${index}`} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">履歴 {index + 1}</p>
              <SecondaryButton
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...draft,
                    improvement_history: draft.improvement_history.filter(
                      (_, itemIndex) => itemIndex !== index
                    ),
                  })
                }
              >
                削除
              </SecondaryButton>
            </div>
            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <div>
                <FieldLabel>日付</FieldLabel>
                <TextInput
                  value={item.date}
                  onChange={(value) => updateHistory(index, { date: value })}
                  disabled={disabled}
                  placeholder="2026-07-07"
                />
              </div>
              <div>
                <FieldLabel>タイトル</FieldLabel>
                <TextInput
                  value={item.title}
                  onChange={(value) => updateHistory(index, { title: value })}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="mt-3">
              <FieldLabel>変更内容（1行1件）</FieldLabel>
              <TextArea
                value={linesToText(item.changes)}
                onChange={(value) => updateHistory(index, { changes: textToLines(value) })}
                disabled={disabled}
                rows={4}
              />
            </div>
          </div>
        ))}
        <SecondaryButton
          disabled={disabled}
          onClick={() =>
            onChange({
              ...draft,
              improvement_history: [
                ...draft.improvement_history,
                { date: new Date().toISOString().slice(0, 10), title: '新しい改善', changes: ['新しい変更内容'] },
              ],
            })
          }
        >
          履歴を追加
        </SecondaryButton>
      </SectionCard>

      <SectionCard title="改善サイクル">
        <FieldLabel>手順（1行1件）</FieldLabel>
        <TextArea
          value={linesToText(draft.review_loop)}
          onChange={(value) => onChange({ ...draft, review_loop: textToLines(value) })}
          disabled={disabled}
          rows={6}
        />
      </SectionCard>

      <SectionCard title="注意点">
        <FieldLabel>注意事項（1行1件）</FieldLabel>
        <TextArea
          value={linesToText(draft.caution_notes)}
          onChange={(value) => onChange({ ...draft, caution_notes: textToLines(value) })}
          disabled={disabled}
          rows={8}
        />
      </SectionCard>
    </div>
  );
}
