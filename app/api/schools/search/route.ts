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
    // prefecturesカラムが存在しない場合に備えて、エラーハンドリングを追加
    let query = supabase
      .from('schools')
      .select(`
        id,
        name,
        prefecture,
        prefectures,
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
    // メインの都道府県（prefecture）または複数の都道府県配列（prefectures）に含まれる場合に該当
    // 注意: 都道府県フィルタリングは後でJavaScriptで行う（配列検索のため）
    let prefectureFilter: string | null = prefecture || null;

    // ページネーション（都道府県フィルタリング前の全データを取得）
    query = query
      .order('name', { ascending: true });

    let { data: allSchools, error, count } = await query;

    // prefecturesカラムが存在しない場合のエラーハンドリング
    if (error) {
      const errorCode = error.code;
      const errorMessage = error.message || '';
      
      if (errorCode === '42703' || (errorMessage.includes('prefectures') && errorMessage.includes('column') && errorMessage.includes('does not exist'))) {
        console.warn('[API] /api/schools/search - prefecturesカラムが存在しません。prefectureのみで再試行します。');
        // prefecturesカラムなしで再試行
        query = supabase
          .from('schools')
          .select(`
            id,
            name,
            prefecture,
            slug,
            is_public
          `, { count: 'exact' })
          .eq('is_public', true);
        
        if (q) {
          const normalizedQuery = normalizeSearchQuery(q);
          query = query.ilike('name', `%${normalizedQuery}%`);
        }
        
        query = query.order('name', { ascending: true });
        const retryResult = await query;
        allSchools = retryResult.data;
        error = retryResult.error;
        count = retryResult.count;
      }
      
      if (error) {
        console.error('学校検索エラー:', error);
        console.error('エラー詳細:', JSON.stringify(error, null, 2));
        return NextResponse.json(
          { error: '学校検索に失敗しました', details: error.message, code: error.code },
          { status: 500 }
        );
      }
    }

    // 都道府県でのフィルタリング（メインの都道府県またはprefectures配列に含まれる場合）
    let filteredSchools = allSchools || [];
    if (prefectureFilter) {
      filteredSchools = filteredSchools.filter((school: any) => {
        // メインの都道府県が一致する場合
        if (school.prefecture === prefectureFilter) {
          return true;
        }
        // prefectures配列に含まれる場合（prefecturesカラムが存在する場合のみ）
        if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) {
          return school.prefectures.includes(prefectureFilter);
        }
        return false;
      });
    }

    console.log('学校検索結果:', { 
      totalBeforeFilter: allSchools?.length || 0, 
      totalAfterFilter: filteredSchools.length,
      prefectureFilter 
    });

    // 各学校の口コミ数と平均評価を取得
    const schoolsWithStats = await Promise.all(
      filteredSchools.map(async (school: any) => {
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

        // 検索で該当した都道府県を特定
        let matchedPrefecture: string | null = null;
        if (prefectureFilter) {
          if (school.prefecture === prefectureFilter) {
            matchedPrefecture = school.prefecture;
          } else if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.includes(prefectureFilter)) {
            matchedPrefecture = prefectureFilter;
          }
        }

        return {
          id: school.id,
          name: school.name,
          prefecture: school.prefecture,
          prefectures: school.prefectures || null,
          matched_prefecture: matchedPrefecture,
          slug: school.slug || null, // nullの場合はnullを返す
          review_count: reviewCount || 0,
          overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
        };
      })
    );

    // フィルタリング（評価、口コミ数）
    let finalFilteredSchools = schoolsWithStats;
    if (minRating) {
      const minRatingValue = parseFloat(minRating);
      finalFilteredSchools = finalFilteredSchools.filter(s => s.overall_avg !== null && s.overall_avg >= minRatingValue);
    }
    if (minReviewCount) {
      const minReviewCountValue = parseInt(minReviewCount);
      finalFilteredSchools = finalFilteredSchools.filter(s => s.review_count >= minReviewCountValue);
    }

    // ソート
    switch (sortBy) {
      case 'rating_desc':
        finalFilteredSchools.sort((a, b) => (b.overall_avg || 0) - (a.overall_avg || 0));
        break;
      case 'rating_asc':
        finalFilteredSchools.sort((a, b) => (a.overall_avg || 0) - (b.overall_avg || 0));
        break;
      case 'review_count_desc':
        finalFilteredSchools.sort((a, b) => b.review_count - a.review_count);
        break;
      case 'review_count_asc':
        finalFilteredSchools.sort((a, b) => a.review_count - b.review_count);
        break;
      case 'name':
      default:
        finalFilteredSchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        break;
    }

    // ページネーション
    const total = finalFilteredSchools.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedSchools = finalFilteredSchools.slice(offset, offset + limit);

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

