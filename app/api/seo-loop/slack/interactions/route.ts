import { after, NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { verifySlackSignature } from '@/lib/seo-loop/slack';
import {
  handleSlackInteraction,
  replaceSlackOriginalMessage,
} from '@/lib/seo-loop/slack-interactions/handler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: 'SLACK_SIGNING_SECRET is not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const valid = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    rawBody,
  });

  if (!valid) {
    return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 });
  }

  let isViewSubmission = false;
  try {
    const payload = JSON.parse(new URLSearchParams(rawBody).get('payload') ?? '{}') as {
      type?: unknown;
    };
    isViewSubmission = payload.type === 'view_submission';
  } catch (error) {
    console.error('Slack interaction payload preparse failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    // handler側で不正payloadとして応答する
  }

  try {
    const result = await handleSlackInteraction({
      supabase: createAdminSupabaseClient(),
      rawBody,
    });
    if (result.afterResponse) {
      const update = result.afterResponse;
      after(async () => {
        await replaceSlackOriginalMessage(update).catch(() => undefined);
      });
    }
    if (result.afterAction) {
      const action = result.afterAction;
      after(async () => {
        await action().catch((error) => {
          console.error('Slack interaction after-action failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      });
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Slack interaction processing failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    // 署名検証済みリクエストは3秒以内にackし、Slackの再送・二重操作を避ける。
    return NextResponse.json(
      isViewSubmission
        ? {
            response_action: 'errors',
            errors: {
              feedback_reason: '保存に失敗しました。時間をおいて再試行してください',
            },
          }
        : { ok: false, message: '処理に失敗しました。カードから再試行してください' },
      { status: 200 }
    );
  }
}
