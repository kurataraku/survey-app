import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { DEFAULT_CONSULTATION_AI_LOGIC_DOCS } from '@/lib/consultation-ai-logic/defaults';
import {
  getConsultationAiLogicDocs,
  saveConsultationAiLogicDocs,
} from '@/lib/consultation-ai-logic/repository';
import {
  ConsultationAiLogicDocsContentSchema,
  mergeConsultationAiLogicDocs,
} from '@/lib/consultation-ai-logic/schema';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const docs = await getConsultationAiLogicDocs();
    return NextResponse.json(docs);
  } catch (error) {
    console.error('[api/admin/consultation-ai-logic] GET failed:', error);
    const message = error instanceof Error ? error.message : '不明なエラー';
    if (message.includes('consultation_ai_logic_docs') || message.includes('does not exist')) {
      return NextResponse.json(
        {
          error: '相談AIロジック用テーブルが未作成です',
          details:
            'Supabaseで supabase-migrations/create-consultation-ai-logic-docs.sql を実行してください。',
          defaults: DEFAULT_CONSULTATION_AI_LOGIC_DOCS,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'ドキュメントの取得に失敗しました', details: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const parsed = ConsultationAiLogicDocsContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '入力内容が不正です', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const docs = await saveConsultationAiLogicDocs(parsed.data, authResult.adminUser.id);
    return NextResponse.json({ success: true, docs });
  } catch (error) {
    console.error('[api/admin/consultation-ai-logic] PUT failed:', error);
    const message = error instanceof Error ? error.message : '不明なエラー';
    if (message.includes('consultation_ai_logic_docs') || message.includes('does not exist')) {
      return NextResponse.json(
        {
          error: '相談AIロジック用テーブルが未作成です',
          details:
            'Supabaseで supabase-migrations/create-consultation-ai-logic-docs.sql を実行してください。',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'ドキュメントの保存に失敗しました', details: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const current = await getConsultationAiLogicDocs();
    const merged = mergeConsultationAiLogicDocs(current, body);
    const docs = await saveConsultationAiLogicDocs(merged, authResult.adminUser.id);
    return NextResponse.json({ success: true, docs });
  } catch (error) {
    console.error('[api/admin/consultation-ai-logic] PATCH failed:', error);
    const message = error instanceof Error ? error.message : '不明なエラー';
    return NextResponse.json({ error: 'ドキュメントの更新に失敗しました', details: message }, { status: 500 });
  }
}
