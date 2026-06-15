import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { callPerplexityForOfficialUrl } from '@/lib/perplexity/client';

export const maxDuration = 120;

/**
 * 公式サイトURLの自動特定（管理画面・エージェントCLI共用）
 * - Perplexity で学校名から公式サイトURLを特定し、schools.official_url に保存する
 * - AI特定のため official_url_verified = false（未確認）で保存し、人間の確認を促す
 * - 既に official_url が登録済みの場合はデフォルトでスキップ（force=true で上書き）
 *
 * body: {
 *   force?: boolean;   // 既存URLを上書きする
 *   dryRun?: boolean;  // 特定のみ行い保存しない
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
      force?: boolean;
      dryRun?: boolean;
    };

    const supabase = createAdminSupabaseClient();
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, official_url, official_url_verified')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });
    }

    const existingUrl =
      typeof school.official_url === 'string' && school.official_url.trim()
        ? school.official_url.trim()
        : null;

    if (existingUrl && body.force !== true) {
      return NextResponse.json({
        skipped: true,
        reason: '公式URLは既に登録済みです（上書きするには force を指定してください）',
        school: { id: school.id, name: school.name },
        official_url: existingUrl,
        official_url_verified: school.official_url_verified ?? false,
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

    if (body.dryRun === true) {
      return NextResponse.json({
        dryRun: true,
        school: { id: school.id, name: school.name },
        official_url: urlResult.officialUrl,
        confidence: urlResult.confidence,
        reason: urlResult.reason,
        saved: false,
      });
    }

    const { error: updateError } = await supabase
      .from('schools')
      .update({
        official_url: urlResult.officialUrl,
        official_url_verified: false,
        official_url_source: 'ai',
      })
      .eq('id', schoolId);

    if (updateError) {
      console.error('[official-url resolve] 保存エラー:', updateError);
      return NextResponse.json(
        { error: '公式URLの保存に失敗しました', message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      school: { id: school.id, name: school.name },
      official_url: urlResult.officialUrl,
      confidence: urlResult.confidence,
      reason: urlResult.reason,
      official_url_verified: false,
      official_url_source: 'ai',
      saved: true,
      tokens_used: urlResult.tokensUsed,
    });
  } catch (error) {
    console.error('[official-url resolve] APIエラー:', error);
    return NextResponse.json(
      {
        error: '公式URLの特定に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
