import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MODERATION_PROMPT = `あなたは通信制高校の口コミサイトのモデレーターです。
以下の口コミを審査し、JSON形式で結果を返してください。

審査項目:
1. personal_info: 教師名・生徒名など個人を特定できる記述が含まれているか
2. fake_review: 在校経験がなさそうな虚偽・作り話の可能性があるか
3. advertisement: 広告・宣伝・営業目的の投稿か
4. hate_speech: 差別・ヘイト・誹謗中傷表現が含まれているか
5. fake_school: 学校名が実在しない、または架空の可能性があるか
6. duplicate_email: （外部チェック済みの値をそのまま引き継ぐ）

danger_scoreは0〜100で、問題があるほど高くしてください。
- 0〜30: 問題なし（通常承認）
- 31〜60: 注意が必要（管理者要確認）
- 61〜100: 高リスク（要注意）

必ず以下のJSON形式のみで返答してください（説明文不要）:
{
  "danger_score": <0-100の整数>,
  "flags": {
    "personal_info": <true/false>,
    "fake_review": <true/false>,
    "advertisement": <true/false>,
    "hate_speech": <true/false>,
    "fake_school": <true/false>
  },
  "reason": "<日本語で150字以内の判定理由>"
}`;

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

  // 口コミデータ取得
  const { data: review, error: fetchError } = await supabase
    .from('survey_responses')
    .select('id, school_name, respondent_role, status, good_comment, bad_comment, overall_satisfaction, email, answers')
    .eq('id', id)
    .single();

  if (fetchError || !review) {
    return NextResponse.json({ error: '口コミが見つかりません' }, { status: 404 });
  }

  // 重複メールチェック
  const { count: duplicateCount } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('email', review.email)
    .eq('moderation_status', 'approved')
    .neq('id', id);

  const isDuplicateEmail = (duplicateCount ?? 0) > 0;

  // 類似投稿チェック（同じ学校への同内容）
  const { data: similarReviews } = await supabase
    .from('survey_responses')
    .select('id, good_comment, bad_comment')
    .eq('school_name', review.school_name)
    .neq('id', id)
    .limit(20);

  const similarIds: string[] = [];
  if (similarReviews && review.good_comment) {
    for (const r of similarReviews) {
      if (!r.good_comment) continue;
      const similarity = cosineSimilaritySimple(review.good_comment, r.good_comment);
      if (similarity > 0.8) similarIds.push(r.id);
    }
  }

  // LLM審査
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const reviewText = `
学校名: ${review.school_name}
投稿者の立場: ${review.respondent_role}
現在の状況: ${review.status}
総合満足度: ${review.overall_satisfaction}/5
良かった点: ${review.good_comment}
改善してほしい点: ${review.bad_comment}
  `.trim();

  let moderationResult = {
    danger_score: 0,
    flags: {
      personal_info: false,
      fake_review: false,
      advertisement: false,
      hate_speech: false,
      fake_school: false,
    },
    reason: '審査完了',
  };

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
      messages: [
        { role: 'system', content: MODERATION_PROMPT },
        { role: 'user', content: reviewText },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    moderationResult = {
      danger_score: Math.min(100, Math.max(0, parseInt(parsed.danger_score ?? 0))),
      flags: {
        personal_info: !!parsed.flags?.personal_info,
        fake_review: !!parsed.flags?.fake_review,
        advertisement: !!parsed.flags?.advertisement,
        hate_speech: !!parsed.flags?.hate_speech,
        fake_school: !!parsed.flags?.fake_school,
      },
      reason: parsed.reason ?? '審査完了',
    };
  } catch (e) {
    console.error('[moderate] LLM審査エラー:', e);
  }

  // 重複フラグをDBに保存
  if (isDuplicateEmail) {
    await supabase
      .from('survey_responses')
      .update({ is_duplicate_email: true })
      .eq('id', id);
  }

  // 審査結果を保存
  const flagsWithDuplicate = {
    ...moderationResult.flags,
    duplicate_email: isDuplicateEmail,
  };

  const { error: insertError } = await supabase
    .from('review_moderation_results')
    .insert({
      survey_response_id: id,
      danger_score: moderationResult.danger_score,
      flags: flagsWithDuplicate,
      reason: moderationResult.reason,
      similar_response_ids: similarIds,
      model_used: process.env.OPENAI_MODEL ?? 'gpt-4.1',
    });

  if (insertError) {
    console.error('[moderate] 審査結果保存エラー:', insertError);
  }

  return NextResponse.json({
    success: true,
    danger_score: moderationResult.danger_score,
    flags: flagsWithDuplicate,
    reason: moderationResult.reason,
    similar_count: similarIds.length,
  });
}

// 簡易類似度チェック（共通単語の割合）
function cosineSimilaritySimple(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+|。|、/));
  const tokensB = new Set(b.split(/\s+|。|、/));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}
