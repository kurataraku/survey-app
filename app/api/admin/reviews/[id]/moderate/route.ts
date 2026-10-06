import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { assembleModeration } from '@/lib/moderation/assemble';
import { loadSchoolModerationContext } from '@/lib/moderation/load-school';
import { fetchOfficialPageExcerpt } from '@/lib/moderation/official-page';
import { buildModerationUserPrompt, MODERATION_SYSTEM_PROMPT } from '@/lib/moderation/prompt';
import { buildRuleFindings } from '@/lib/moderation/rules';
import { parseAiModeration } from '@/lib/moderation/sanitize';
import type { ReviewModerationInput } from '@/lib/moderation/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: review, error: fetchError } = await supabase
    .from('survey_responses')
    .select('id, school_id, school_name, respondent_role, status, overall_satisfaction, good_comment, bad_comment, email, answers, created_at')
    .eq('id', id)
    .single();

  if (fetchError || !review) {
    return NextResponse.json({ error: '口コミが見つかりません' }, { status: 404 });
  }

  const { count: duplicateCount } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('email', review.email)
    .eq('moderation_status', 'approved')
    .neq('id', id);

  const isDuplicateEmail = (duplicateCount ?? 0) > 0;
  const similarIds = await findSimilarIds(supabase, {
    id,
    schoolName: review.school_name,
    goodComment: review.good_comment,
  });

  const answers = asRecord(review.answers);
  const school = await loadSchoolModerationContext(supabase, {
    schoolId: typeof review.school_id === 'string' ? review.school_id : null,
    schoolName: review.school_name ?? '',
  });
  const officialPage = await fetchOfficialPageExcerpt(school.officialUrl);
  const postedAt = review.created_at ? new Date(review.created_at) : new Date();
  const reviewInput: ReviewModerationInput = {
    schoolName: review.school_name ?? '',
    respondentRole: textOrNull(review.respondent_role),
    status: textOrNull(review.status),
    overallSatisfaction: typeof review.overall_satisfaction === 'number' ? review.overall_satisfaction : null,
    goodComment: textOrNull(review.good_comment),
    badComment: textOrNull(review.bad_comment),
    answers,
  };

  const ruleFindings = buildRuleFindings({
    reviewSchoolName: reviewInput.schoolName,
    school,
    campusPrefecture: textOrNull(answers.campus_prefecture),
    campusCity: textOrNull(answers.campus_city),
    enrollmentYear: textOrNull(answers.enrollment_year),
    postedAt,
    email: textOrNull(review.email),
    duplicateEmail: isDuplicateEmail,
    officialPage,
    goodComment: reviewInput.goodComment,
    badComment: reviewInput.badComment,
  });

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1';
  let ai: ReturnType<typeof parseAiModeration> = null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        { role: 'user', content: buildModerationUserPrompt(reviewInput, school, officialPage) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    ai = parseAiModeration(JSON.parse(raw));
    if (!ai) console.error('[moderate] AI審査のJSONが不正です');
  } catch (error) {
    console.error('[moderate] LLM審査エラー:', error);
  }

  const moderation = assembleModeration({
    ruleFindings,
    aiFindings: ai?.findings ?? [],
    personalInfo: ai?.personalInfo ?? false,
    hateSpeech: ai?.hateSpeech ?? false,
    advertisement: ai?.advertisement ?? false,
    fakeSchool: school.lookup === 'missing',
    duplicateEmail: isDuplicateEmail,
    aiFailed: ai == null,
  });

  if (isDuplicateEmail) {
    await supabase
      .from('survey_responses')
      .update({ is_duplicate_email: true })
      .eq('id', id);
  }

  const { error: insertError } = await supabase
    .from('review_moderation_results')
    .insert({
      survey_response_id: id,
      danger_score: moderation.dangerScore,
      flags: moderation.flags,
      reason: moderation.reason,
      similar_response_ids: similarIds,
      model_used: model,
    });

  if (insertError) {
    console.error('[moderate] 審査結果保存エラー:', insertError);
    return NextResponse.json({ error: '審査結果の保存に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    danger_score: moderation.dangerScore,
    flags: moderation.flags,
    reason: moderation.reason,
    similar_count: similarIds.length,
  });
}

async function findSimilarIds(
  supabase: ReturnType<typeof getSupabase>,
  review: { id: string; schoolName: string | null; goodComment: string | null }
): Promise<string[]> {
  if (!review.schoolName || !review.goodComment) return [];

  const { data: similarReviews } = await supabase
    .from('survey_responses')
    .select('id, good_comment')
    .eq('school_name', review.schoolName)
    .neq('id', review.id)
    .limit(20);

  const similarIds: string[] = [];
  for (const candidate of similarReviews ?? []) {
    if (!candidate.good_comment) continue;
    if (tokenOverlap(review.goodComment, candidate.good_comment) > 0.8) {
      similarIds.push(candidate.id);
    }
  }
  return similarIds;
}

function tokenOverlap(left: string, right: string): number {
  const tokensA = new Set(left.split(/\s+|。|、/));
  const tokensB = new Set(right.split(/\s+|。|、/));
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
