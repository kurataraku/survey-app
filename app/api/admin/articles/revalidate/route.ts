import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { revalidateArticleCaches } from '@/lib/articles/revalidateArticleCaches';

/**
 * 記事ページの ISR / CDN キャッシュを手動で無効化する（管理画面・運用用）。
 * body: { slug: string } または { id: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = (await request.json()) as { slug?: string; id?: string };
    let slug = body.slug?.trim();

    if (!slug && body.id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
          { error: 'Supabase環境変数が設定されていません' },
          { status: 500 }
        );
      }
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: article, error } = await supabase
        .from('articles')
        .select('slug')
        .eq('id', body.id)
        .single();
      if (error || !article?.slug) {
        return NextResponse.json(
          { error: '記事が見つかりません' },
          { status: 404 }
        );
      }
      slug = article.slug;
    }

    if (!slug) {
      return NextResponse.json(
        { error: 'slug または id が必要です' },
        { status: 400 }
      );
    }

    revalidateArticleCaches(slug);

    return NextResponse.json({ ok: true, slug });
  } catch (error) {
    console.error('[articles/revalidate] error:', error);
    return NextResponse.json(
      { error: 'キャッシュの再検証に失敗しました' },
      { status: 500 }
    );
  }
}
