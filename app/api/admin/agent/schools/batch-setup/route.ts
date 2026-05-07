import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const filter = body.filter || {};
    const steps = body.steps || ['prefecture', 'slug', 'summary', 'meta', 'seo_sections', 'faq', 'review_tendency'];
    const publish: boolean = body.publish ?? false;
    const deltaThreshold: number = body.review_delta_threshold ?? 5;
    const dryRun: boolean = body.dry_run ?? false;
    const limit: number = Math.min(body.limit ?? 10, 50);
    const offset: number = body.offset ?? 0;
    const sleepMs: number = Math.min(Math.max(Number(body.sleep_ms) || 0, 0), 10_000);

    const supabase = createAdminSupabaseClient();

    let query = supabase
      .from('schools')
      .select('id, name', { count: 'exact' })
      .order('name', { ascending: true })
      .order('id', { ascending: true });

    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    // intro 再実行時など、未設定の校だけ対象にして Vercel 往復を減らす（Perplexity は setup 側でも already_set で抑止済み）
    const introMissing =
      filter.intro_missing === true ||
      filter.intro_missing === 'true' ||
      filter.intro_missing === '1';
    if (introMissing) {
      // or(intro.is.null,intro.eq.) + range で高オフセット時に PostgREST が失敗することがあるため、
      // 「未設定 = intro IS NULL」のみ列挙（空文字は normalize-school-intro-empty-to-null.sql で NULL 化してから再実行）
      query = query.is('intro', null);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: schools, error: schoolsError, count: totalCount } = await query;

    if (schoolsError) {
      return NextResponse.json(
        { error: '学校一覧の取得に失敗しました', details: schoolsError.message },
        { status: 500 }
      );
    }

    if (!schools || schools.length === 0) {
      return NextResponse.json({
        total: totalCount || 0,
        processed: 0,
        skipped: 0,
        results: [],
        alerts_summary: { total_alerts: 0, by_code: {} },
      });
    }

    const results: Array<Record<string, unknown>> = [];
    const alertCounts: Record<string, number> = {};
    let totalAlerts = 0;
    let processedCount = 0;
    let skippedCount = 0;

    const baseUrl = request.nextUrl.origin;
    const agentKey = process.env.AGENT_API_KEY;

    for (const school of schools) {
      try {
        const setupUrl = `${baseUrl}/api/admin/agent/schools/${school.id}/setup`;
        const setupResponse = await fetch(setupUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(agentKey ? { Authorization: `Bearer ${agentKey}` } : {}),
          },
          body: JSON.stringify({
            steps,
            publish,
            review_delta_threshold: deltaThreshold,
            dry_run: dryRun,
          }),
        });

        const setupResult = await setupResponse.json();

        if (!setupResponse.ok) {
          results.push({
            school_id: school.id,
            school_name: school.name,
            error: setupResult.error || 'Unknown error',
          });
          continue;
        }

        results.push(setupResult);

        const schoolAlerts = (setupResult.alerts || []) as Array<{ code: string }>;
        if (schoolAlerts.length > 0) {
          totalAlerts += schoolAlerts.length;
          for (const alert of schoolAlerts) {
            alertCounts[alert.code] = (alertCounts[alert.code] || 0) + 1;
          }
        }

        const allSkipped = Object.values(setupResult.results || {}).every(
          (r: any) => r.status === 'skipped'
        );
        if (allSkipped) {
          skippedCount++;
        } else {
          processedCount++;
        }
      } catch (e) {
        results.push({
          school_id: school.id,
          school_name: school.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }

    return NextResponse.json({
      total: totalCount || 0,
      batch_size: schools.length,
      processed: processedCount,
      skipped: skippedCount,
      offset,
      limit,
      results,
      alerts_summary: {
        total_alerts: totalAlerts,
        by_code: alertCounts,
      },
    });
  } catch (error) {
    console.error('Batch setup API エラー:', error);
    return NextResponse.json(
      { error: 'バッチセットアップに失敗しました', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
