import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  CONSULTATION_AI_LOGIC_DOCS_ID,
  DEFAULT_CONSULTATION_AI_LOGIC_DOCS,
} from '@/lib/consultation-ai-logic/defaults';
import {
  ConsultationAiLogicDocsContentSchema,
  type ConsultationAiLogicDocsContent,
  type ConsultationAiLogicDocsRecord,
} from '@/lib/consultation-ai-logic/schema';

type DbRow = {
  id: string;
  purpose_intro: string | null;
  purpose_note: string | null;
  logic_flow_json: unknown;
  active_rules_json: unknown;
  improvement_history_json: unknown;
  review_loop_json: unknown;
  caution_notes_json: unknown;
  updated_at: string | null;
  updated_by: string | null;
};

function rowToContent(row: DbRow): ConsultationAiLogicDocsContent {
  return ConsultationAiLogicDocsContentSchema.parse({
    purpose_intro: row.purpose_intro ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.purpose_intro,
    purpose_note: row.purpose_note ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.purpose_note,
    logic_flow: row.logic_flow_json ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.logic_flow,
    active_rules: row.active_rules_json ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.active_rules,
    improvement_history:
      row.improvement_history_json ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.improvement_history,
    review_loop: row.review_loop_json ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.review_loop,
    caution_notes: row.caution_notes_json ?? DEFAULT_CONSULTATION_AI_LOGIC_DOCS.caution_notes,
  });
}

function contentToDbPayload(content: ConsultationAiLogicDocsContent, updatedBy: string | null) {
  return {
    purpose_intro: content.purpose_intro,
    purpose_note: content.purpose_note,
    logic_flow_json: content.logic_flow,
    active_rules_json: content.active_rules,
    improvement_history_json: content.improvement_history,
    review_loop_json: content.review_loop,
    caution_notes_json: content.caution_notes,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
}

function isEmptyContent(row: DbRow): boolean {
  return (
    !row.purpose_intro?.trim() &&
    !row.purpose_note?.trim() &&
    (!Array.isArray(row.logic_flow_json) || row.logic_flow_json.length === 0) &&
    (!Array.isArray(row.active_rules_json) || row.active_rules_json.length === 0) &&
    (!Array.isArray(row.improvement_history_json) || row.improvement_history_json.length === 0) &&
    (!Array.isArray(row.review_loop_json) || row.review_loop_json.length === 0) &&
    (!Array.isArray(row.caution_notes_json) || row.caution_notes_json.length === 0)
  );
}

export async function getConsultationAiLogicDocs(): Promise<ConsultationAiLogicDocsRecord> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('consultation_ai_logic_docs')
    .select('*')
    .eq('id', CONSULTATION_AI_LOGIC_DOCS_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const seeded = await saveConsultationAiLogicDocs(DEFAULT_CONSULTATION_AI_LOGIC_DOCS, null);
    return seeded;
  }

  const row = data as DbRow;
  if (isEmptyContent(row)) {
    const seeded = await saveConsultationAiLogicDocs(DEFAULT_CONSULTATION_AI_LOGIC_DOCS, null);
    return seeded;
  }

  const content = rowToContent(row);
  return {
    id: row.id,
    ...content,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export async function saveConsultationAiLogicDocs(
  content: ConsultationAiLogicDocsContent,
  updatedBy: string | null
): Promise<ConsultationAiLogicDocsRecord> {
  const validated = ConsultationAiLogicDocsContentSchema.parse(content);
  const supabase = createAdminSupabaseClient();
  const payload = contentToDbPayload(validated, updatedBy);

  const { data: existing, error: existingError } = await supabase
    .from('consultation_ai_logic_docs')
    .select('id')
    .eq('id', CONSULTATION_AI_LOGIC_DOCS_ID)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('consultation_ai_logic_docs')
      .insert({
        id: CONSULTATION_AI_LOGIC_DOCS_ID,
        ...payload,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const row = data as DbRow;
    return {
      id: row.id,
      ...validated,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    };
  }

  const { data, error } = await supabase
    .from('consultation_ai_logic_docs')
    .update(payload)
    .eq('id', CONSULTATION_AI_LOGIC_DOCS_ID)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const row = data as DbRow;
  return {
    id: row.id,
    ...validated,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}
