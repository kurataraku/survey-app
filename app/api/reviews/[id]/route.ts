import { NextRequest, NextResponse } from 'next/server';
import { getReviewById } from '@/lib/reviews/getReviewById';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const reviewId = resolvedParams.id;

    const review = await getReviewById(reviewId, {
      request,
      requirePublic: true,
    });

    if (!review) {
      return NextResponse.json(
        { error: '口コミが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(review);
  } catch (error: unknown) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      {
        error: 'サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
