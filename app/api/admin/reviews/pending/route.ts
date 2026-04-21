import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: reviews, error, count } = await supabase
    .from('survey_responses')
    .select(`
      id,
      school_name,
      school_id,
      respondent_role,
      status,
      overall_satisfaction,
      good_comment,
      bad_comment,
      email,
      is_duplicate_email,
      moderation_status,
      created_at,
      review_moderation_results (
        danger_score,
        flags,
        reason,
        similar_response_ids
      )
    `, { count: 'exact' })
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // danger_scoreでソート（高い順）
  const sorted = (reviews ?? []).sort((a, b) => {
    const scoreA = (a.review_moderation_results as any)?.[0]?.danger_score ?? -1;
    const scoreB = (b.review_moderation_results as any)?.[0]?.danger_score ?? -1;
    return scoreB - scoreA;
  });

  return NextResponse.json({ reviews: sorted, total: count ?? 0, page, limit });
}
