import { NextResponse } from 'next/server';
import { getHomeData } from '@/lib/home/getHomeData';

export async function GET() {
  try {
    const data = await getHomeData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[API] /api/home - エラー:', error);
    return NextResponse.json(
      {
        topRankedSchools: [],
        popularSchools: [],
        latestReviews: [],
        latestArticles: [],
        totalSchoolCount: 0,
        totalReviewCount: 0,
        schoolCardGlobalAverages: null,
        error: 'サーバーエラーが発生しました',
      },
      { status: 200 }
    );
  }
}
