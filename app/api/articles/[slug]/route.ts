import { NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/articles/getArticleBySlug';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const slug = resolvedParams.slug;

    const article = await getArticleBySlug(slug);

    if (!article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
