import { z } from 'zod';

export const LogicFlowItemSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  examples: z.array(z.string().min(1).max(300)).max(12),
});

export const ActiveRuleGroupSchema = z.object({
  category: z.string().min(1).max(120),
  rules: z.array(z.string().min(1).max(1000)).min(1).max(30),
});

export const ImprovementHistoryItemSchema = z.object({
  date: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  changes: z.array(z.string().min(1).max(1000)).min(1).max(20),
});

export const ConsultationAiLogicDocsContentSchema = z.object({
  purpose_intro: z.string().min(1).max(4000),
  purpose_note: z.string().min(1).max(4000),
  logic_flow: z.array(LogicFlowItemSchema).max(20),
  active_rules: z.array(ActiveRuleGroupSchema).max(20),
  improvement_history: z.array(ImprovementHistoryItemSchema).max(100),
  review_loop: z.array(z.string().min(1).max(500)).max(20),
  caution_notes: z.array(z.string().min(1).max(1000)).max(20),
});

export const ConsultationAiLogicDocsUpdateSchema = ConsultationAiLogicDocsContentSchema.partial();

export type LogicFlowItem = z.infer<typeof LogicFlowItemSchema>;
export type ActiveRuleGroup = z.infer<typeof ActiveRuleGroupSchema>;
export type ImprovementHistoryItem = z.infer<typeof ImprovementHistoryItemSchema>;
export type ConsultationAiLogicDocsContent = z.infer<typeof ConsultationAiLogicDocsContentSchema>;

export type ConsultationAiLogicDocsRecord = ConsultationAiLogicDocsContent & {
  id: string;
  updated_at: string | null;
  updated_by: string | null;
};

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function linesToText(lines: string[]): string {
  return lines.join('\n');
}

export function textToLines(value: string): string[] {
  return splitLines(value);
}

export function mergeConsultationAiLogicDocs(
  current: ConsultationAiLogicDocsContent,
  patch: z.infer<typeof ConsultationAiLogicDocsUpdateSchema>
): ConsultationAiLogicDocsContent {
  return ConsultationAiLogicDocsContentSchema.parse({
    ...current,
    ...patch,
  });
}
