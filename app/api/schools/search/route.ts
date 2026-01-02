import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSearchQuery } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase環境変数が設定されていません');
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const prefecture = searchParams.get('prefecture') || '';
    
    console.log('APIリクエスト:', { q, prefecture, url: request.nextUrl.toString() });
    const minRating = searchParams.get('min_rating');
    const minReviewCount = searchParams.get('min_review_count');
    const sortBy = searchParams.get('sort') || 'name';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 学校検索クエリを構築
    let query = supabase
      .from('schools')
      .select(`
        id,
        name,
        prefecture,
        slug,
        is_public
      `, { count: 'exact' })
      .eq('is_public', true);

    // 学校名での検索（検索クエリを正規化）
    if (q) {
      const normalizedQuery = normalizeSearchQuery(q);
      query = query.ilike('name', `%${normalizedQuery}%`);
    }

    // 都道府県でのフィルタリング
    if (prefecture) {
      query = query.eq('prefecture', prefecture);
    }

    // ページネーション
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: schools, error, count } = await query;

    if (error) {
      console.error('学校検索エラー:', error);
      console.error('エラー詳細:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    console.log('学校検索結果:', { count: schools?.length || 0, total: count });

    // 各学校の口コミ数と平均評価を取得
    const schoolsWithStats = await Promise.all(
      (schools || []).map(async (school) => {
        // 口コミ数を取得
        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_name', school.name);

        // 平均評価を取得
        const { data: reviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction')
          .eq('school_name', school.name)
          .not('overall_satisfaction', 'is', null);

        const overallAvg = reviews && reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) / reviews.length
          : null;

        return {
          id: school.id,
          name: school.name,
          prefecture: school.prefecture,
          slug: school.slug || null, // nullの場合はnullを返す
          review_count: reviewCount || 0,
          overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
        };
      })
    );

    // フィルタリング（評価、口コミ数）
    let filteredSchools = schoolsWithStats;
    if (minRating) {
      const minRatingValue = parseFloat(minRating);
      filteredSchools = filteredSchools.filter(s => s.overall_avg !== null && s.overall_avg >= minRatingValue);
    }
    if (minReviewCount) {
      const minReviewCountValue = parseInt(minReviewCount);
      filteredSchools = filteredSchools.filter(s => s.review_count >= minReviewCountValue);
    }

    // ソート
    switch (sortBy) {
      case 'rating_desc':
        filteredSchools.sort((a, b) => (b.overall_avg || 0) - (a.overall_avg || 0));
        break;
      case 'rating_asc':
        filteredSchools.sort((a, b) => (a.overall_avg || 0) - (b.overall_avg || 0));
        break;
      case 'review_count_desc':
        filteredSchools.sort((a, b) => b.review_count - a.review_count);
        break;
      case 'review_count_asc':
        filteredSchools.sort((a, b) => a.review_count - b.review_count);
        break;
      case 'name':
      default:
        filteredSchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        break;
    }

    // ページネーション
    const total = filteredSchools.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedSchools = filteredSchools.slice(offset, offset + limit);

    return NextResponse.json({
      schools: paginatedSchools,
      total,
      page,
      limit,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

