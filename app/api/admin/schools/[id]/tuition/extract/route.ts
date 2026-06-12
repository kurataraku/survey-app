import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { extractTuitionFromOfficialSite } from '@/lib/tuition/extract';
import { callPerplexityForOfficialUrl } from '@/lib/perplexity/client';

export const maxDuration = 120;

/**
 * 学費目安のAI抽出（管理画面・エージェントCLI共用）
 * - 公式URL（schools.official_url）を起点に学費ページを取得し、明記された金額のみ抽出する
 * - 結果は必ず draft として保存する（自動公開しない）。published には触れない
 * - official_url 未登録の学校はデフォルトでスキップ（usePerplexity=true 指定時のみURL特定を試みる）
 *
 * body: {
 *   tuitionPageUrl?: string;  // 学費ページの直接指定（再実行用）
 *   usePerplexity?: boolean;  // 公式URL未登録時にPerplexityでURL特定する（デフォルト false）
 *   dryRun?: boolean;         // 抽出のみ実行し保存しない
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;
    const body = (await request.json().catch(() => ({}))) as {
      tuitionPageUrl?: string;
      usePerplexity?: boolean;
      dryRun?: boolean;
    };

    const supabase = createAdminSupabaseClient();
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, official_url')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });
    }

    const tuitionPageUrl =
      typeof body.tuitionPageUrl === 'string' && /^https?:\/\//i.test(body.tuitionPageUrl.trim())
        ? body.tuitionPageUrl.trim()
        : null;

    let officialUrl: string | null =
      typeof school.official_url === 'string' && school.official_url.trim()
        ? school.official_url.trim()
        : null;
    let perplexityMemo: string | null = null;

    // official_url 未登録 + 学費ページ直接指定なし
    if (!officialUrl && !tuitionPageUrl) {
      if (body.usePerplexity !== true) {
        // デフォルトはスキップ（手動登録を促す）
        return NextResponse.json({
          skipped: true,
          reason: 'official_url が未登録です。管理画面で公式URLを登録するか、usePerplexity を指定してください。',
          school: { id: school.id, name: school.name },
        });
      }
      const urlResult = await callPerplexityForOfficialUrl(school.name);
      if (!urlResult.officialUrl) {
        return NextResponse.json({
          skipped: true,
          reason: `Perplexity で公式URLを特定できませんでした（${urlResult.reason || '理由不明'}）`,
          school: { id: school.id, name: school.name },
        });
      }
      officialUrl = urlResult.officialUrl;
      // Perplexity 由来のURLは schools には保存しない（人間が確認してから登録する）
      perplexityMemo = `公式URLはPerplexityで特定（confidence=${urlResult.confidence}）: ${urlResult.officialUrl}\n理由: ${urlResult.reason}\n※schools.official_url には未保存。人間が確認のうえ登録してください。`;
    }

    const result = await extractTuitionFromOfficialSite({
      schoolName: school.name,
      officialUrl,
      tuitionPageUrl,
    });

    if (perplexityMemo) {
      result.input.internal_memo = [perplexityMemo, result.input.internal_memo]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000);
    }

    if (body.dryRun === true) {
      return NextResponse.json({
        dryRun: true,
        school: { id: school.id, name: school.name },
        extraction: result,
      });
    }

    // draft として保存（既存draftがあれば上書き。published には絶対に触れない）
    const createdBy = authResult.adminUser.id !== 'agent' ? authResult.adminUser.id : null;
    const { data: existingDraft } = await supabase
      .from('school_tuition_estimates')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let saveResult;
    if (existingDraft) {
      saveResult = await supabase
        .from('school_tuition_estimates')
        .update({ ...result.input, origin: 'ai' })
        .eq('id', existingDraft.id)
        .select()
        .single();
    } else {
      saveResult = await supabase
        .from('school_tuition_estimates')
        .insert({
          school_id: schoolId,
          ...result.input,
          origin: 'ai',
          status: 'draft',
          created_by: createdBy,
        })
        .select()
        .single();
    }

    if (saveResult.error) {
      console.error('[tuition extract] draft保存エラー:', saveResult.error);
      return NextResponse.json({ error: '抽出結果の保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      school: { id: school.id, name: school.name },
      draft: saveResult.data,
      found_tuition_info: result.foundTuitionInfo,
      fetched_urls: result.fetchedUrls,
      warnings: result.warnings,
      tokens_used: result.tokensUsed,
    });
  } catch (error) {
    console.error('[tuition extract] APIエラー:', error);
    return NextResponse.json(
      {
        error: '学費情報の抽出に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
