import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  CONSULTATION_AI_LOGIC_DOCS_ID,
  DEFAULT_CONSULTATION_AI_LOGIC_DOCS,
} from '@/lib/consultation-ai-logic/defaults';
import {
  ConsultationAiLogicDocsContentSchema,
  type ActiveRuleGroup,
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

function syncMissingDefaults(content: ConsultationAiLogicDocsContent): {
  content: ConsultationAiLogicDocsContent;
  changed: boolean;
} {
  let changed = false;
  let next = content;

  const existingHistoryTitles = new Set(next.improvement_history.map((item) => item.title));
  const missingHistory = DEFAULT_CONSULTATION_AI_LOGIC_DOCS.improvement_history.filter(
    (item) => !existingHistoryTitles.has(item.title)
  );
  if (missingHistory.length > 0) {
    next = { ...next, improvement_history: [...next.improvement_history, ...missingHistory] };
    changed = true;
  }

  const categoryOrder = next.active_rules.map((group) => group.category);
  const rulesMap = new Map(
    next.active_rules.map((group) => [group.category, { ...group, rules: [...group.rules] }])
  );

  for (const defaultGroup of DEFAULT_CONSULTATION_AI_LOGIC_DOCS.active_rules) {
    const current = rulesMap.get(defaultGroup.category);
    if (!current) {
      rulesMap.set(defaultGroup.category, {
        category: defaultGroup.category,
        rules: [...defaultGroup.rules],
      });
      categoryOrder.push(defaultGroup.category);
      changed = true;
      continue;
    }

    const existingRules = new Set(current.rules);
    for (const rule of defaultGroup.rules) {
      if (!existingRules.has(rule)) {
        current.rules.push(rule);
        changed = true;
      }
    }
  }

  if (changed) {
    next = {
      ...next,
      active_rules: categoryOrder
        .map((category) => rulesMap.get(category))
        .filter((group): group is ActiveRuleGroup => Boolean(group)),
    };
  }

  const existingNotes = new Set(next.caution_notes);
  const missingNotes = DEFAULT_CONSULTATION_AI_LOGIC_DOCS.caution_notes.filter(
    (note) => !existingNotes.has(note)
  );
  if (missingNotes.length > 0) {
    next = { ...next, caution_notes: [...next.caution_notes, ...missingNotes] };
    changed = true;
  }

  const logicFlowByTitle = new Map(next.logic_flow.map((item) => [item.title, { ...item, examples: [...item.examples] }]));
  for (const defaultStep of DEFAULT_CONSULTATION_AI_LOGIC_DOCS.logic_flow) {
    const current = logicFlowByTitle.get(defaultStep.title);
    if (!current) continue;
    const existingExamples = new Set(current.examples);
    for (const example of defaultStep.examples) {
      if (!existingExamples.has(example)) {
        current.examples.push(example);
        changed = true;
      }
    }
    logicFlowByTitle.set(defaultStep.title, current);
  }

  if (changed) {
    next = {
      ...next,
      logic_flow: next.logic_flow.map((item) => logicFlowByTitle.get(item.title) ?? item),
    };
  }

  return { content: next, changed };
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
  const synced = syncMissingDefaults(content);
  if (synced.changed) {
    return saveConsultationAiLogicDocs(synced.content, null);
  }

  return {
    id: row.id,
    ...synced.content,
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
