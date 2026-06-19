import type { NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export type ConsultationChatLogStatus = 'success' | 'no_evidence' | 'error';

export type ConsultationChatLogInput = {
  sessionId?: string | null;
  source?: string | null;
  pageUrl?: string | null;
  userQuestion: string;
  assistantReply?: string | null;
  conversationPreview?: string | null;
  intent?: string | null;
  focusLabel?: string | null;
  mentionedSchools?: string[];
  prefecture?: string | null;
  reasonGroup?: string | null;
  routeJson?: Record<string, unknown> | null;
  model?: string | null;
  sourcesJson?: unknown;
  schoolCandidatesJson?: unknown;
  ragDocCount?: number;
  status: ConsultationChatLogStatus;
  errorMessage?: string | null;
  latencyMs?: number | null;
  request?: NextRequest;
};

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

export async function logConsultationChat(input: ConsultationChatLogInput): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from('consultation_chat_logs').insert({
      session_id: input.sessionId ?? null,
      source: input.source ?? null,
      page_url: input.pageUrl ?? null,
      user_question: input.userQuestion,
      assistant_reply: input.assistantReply ?? null,
      conversation_preview: input.conversationPreview ?? null,
      intent: input.intent ?? null,
      focus_label: input.focusLabel ?? null,
      mentioned_schools: input.mentionedSchools ?? null,
      prefecture: input.prefecture ?? null,
      reason_group: input.reasonGroup ?? null,
      route_json: input.routeJson ?? null,
      model: input.model ?? null,
      sources_json: input.sourcesJson ?? null,
      school_candidates_json: input.schoolCandidatesJson ?? null,
      rag_doc_count: input.ragDocCount ?? 0,
      status: input.status,
      error_message: input.errorMessage ?? null,
      latency_ms: input.latencyMs ?? null,
      ip: input.request ? getClientIP(input.request) : null,
      user_agent: input.request?.headers.get('user-agent') ?? null,
    });

    if (error) {
      console.error('[consultation-chat/log] insert failed:', error);
    }
  } catch (error) {
    console.error('[consultation-chat/log] unexpected error:', error);
  }
}
