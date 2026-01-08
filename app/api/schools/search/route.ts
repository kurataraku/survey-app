import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const prefecture = searchParams.get('prefecture') || '';
    const minRating = searchParams.get('min_rating') ? parseFloat(searchParams.get('min_rating')!) : null;
    const minReviewCount = searchParams.get('min_review_count') ? parseInt(searchParams.get('min_review_count')!, 10) : null;
    const sort = searchParams.get('sort') || 'name';
    const offset = (page - 1) * limit;

    // 検索クエリを正規化（qが空の場合は全件検索）
    const normalizedQuery = q ? normalizeText(q) : '';

    // 1. schoolsテーブルでname_normalizedで検索
    // trigram類似検索を使用（pg_trgm拡張が必要）
    // まずは部分一致検索で試す
    let schoolsQuery = supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, status, slug')
      .eq('status', 'active') // 承認済み（active）のみを検索
      .eq('is_public', true);

    // 検索クエリがある場合は名前でフィルタリング
    if (normalizedQuery) {
      schoolsQuery = schoolsQuery.ilike('name_normalized', `%${normalizedQuery}%`);
    }

    // 都道府県でフィルタリング
    if (prefecture) {
      schoolsQuery = schoolsQuery.or(`prefecture.eq.${prefecture},prefectures.cs.{${prefecture}}`);
    }

    // まず全件取得（統計計算のため）
    const { data: schoolsByName, error: errorByName } = await schoolsQuery;

    if (errorByName) {
      console.error('学校名検索エラー:', errorByName);
      // エラーを返すのではなく、空配列を返して続行
    }

    // デバッグ用ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] /api/schools/search - クエリ: "${q}", 正規化: "${normalizedQuery}"`);
      console.log(`[API] 検索結果数: ${schoolsByName?.length || 0}`);
    }

    // 3. 結果をマージ（重複除去）
    const schoolMap = new Map<string, { id: string; name: string; prefecture: string; status: string; slug: string | null }>();

    // schoolsテーブルからの結果を追加（activeのみ）
    if (schoolsByName) {
      schoolsByName.forEach((school) => {
        if (school.status === 'active') {
          // prefecture（単一）またはprefectures（配列）から都道府県を取得
          let prefecture = '不明';
          if (school.prefecture) {
            prefecture = school.prefecture;
          } else if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) {
            prefecture = school.prefectures[0];
          }
          
          schoolMap.set(school.id, {
            id: school.id,
            name: school.name,
            prefecture: prefecture,
            status: school.status,
            slug: school.slug,
          });
        }
      });
    }

    // 2. school_aliasesテーブルで検索（別名での検索、検索クエリがある場合のみ）
    if (normalizedQuery) {
      const { data: aliases, error: errorAliases } = await supabase
        .from('school_aliases')
        .select('school_id, alias')
        .ilike('alias_normalized', `%${normalizedQuery}%`)
        .limit(100);

      if (errorAliases) {
        console.error('別名検索エラー:', errorAliases);
      }

      // school_aliasesから取得したschool_idを使って、schoolsテーブルから詳細を取得
      if (aliases && aliases.length > 0) {
        const schoolIds = aliases.map((alias: any) => alias.school_id);
        let aliasSchoolsQuery = supabase
          .from('schools')
          .select('id, name, prefecture, prefectures, status, slug')
          .in('id', schoolIds)
          .eq('status', 'active')
          .eq('is_public', true);

        // 都道府県でフィルタリング
        if (prefecture) {
          aliasSchoolsQuery = aliasSchoolsQuery.or(`prefecture.eq.${prefecture},prefectures.cs.{${prefecture}}`);
        }

        const { data: schoolsFromAliases, error: errorSchoolsFromAliases } = await aliasSchoolsQuery;

        if (errorSchoolsFromAliases) {
          console.error('別名経由の学校取得エラー:', errorSchoolsFromAliases);
        } else if (schoolsFromAliases) {
          schoolsFromAliases.forEach((school) => {
            // activeのみを追加
            if (school.status === 'active') {
              let prefecture = '不明';
              if (school.prefecture) {
                prefecture = school.prefecture;
              } else if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) {
                prefecture = school.prefectures[0];
              }
              
              schoolMap.set(school.id, {
                id: school.id,
                name: school.name,
                prefecture: prefecture,
                status: school.status,
                slug: school.slug,
              });
            }
          });
        }
      }
    }


    // 4. 配列に変換（activeのみなので、名前順でソート）
    let schoolsList = Array.from(schoolMap.values())
      .filter((school) => school.status === 'active'); // 念のため、activeのみをフィルタリング

    // 5. 各学校の総合満足度と口コミ数を計算
    const schoolsWithStatsRaw = await Promise.all(
      schoolsList.map(async (school) => {
        try {
          // school_idでフィルタリング（pending状態の学校の口コミを除外）
          const { count: reviewCount, error: countError } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('is_public', true);

          if (countError) {
            console.warn(`[API] /api/schools/search - 口コミ数取得エラー (${school.name}):`, countError);
          }

          // school_idでフィルタリング（pending状態の学校の口コミを除外）
          const { data: reviews, error: reviewsError } = await supabase
            .from('survey_responses')
            .select('overall_satisfaction')
            .eq('school_id', school.id)
            .eq('is_public', true)
            .not('overall_satisfaction', 'is', null);

          if (reviewsError) {
            console.warn(`[API] /api/schools/search - 評価取得エラー (${school.name}):`, reviewsError);
          }

          // 評価値6（該当なし）を除外し、1-5の範囲のみで平均を計算
          const validRatings = reviews
            ?.filter(r => r.overall_satisfaction !== null && r.overall_satisfaction !== 6 && r.overall_satisfaction >= 1 && r.overall_satisfaction <= 5)
            .map(r => r.overall_satisfaction) || [];

          const overallAvg = validRatings.length > 0
            ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
            : null;

          // 学校のslugを取得
          const { data: schoolData } = await supabase
            .from('schools')
            .select('slug')
            .eq('id', school.id)
            .single();

          return {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug || schoolData?.slug || null,
            review_count: reviewCount || 0,
            overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
          };
        } catch (error) {
          console.error(`[API] /api/schools/search - 学校統計計算エラー (${school.name}):`, error);
          // エラーが発生した場合でも、基本的な情報を返す
          return {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug || null,
            review_count: 0,
            overall_avg: null,
          };
        }
      })
    );

    // 6. フィルタリング（最小評価、最小口コミ数）
    let filteredSchools = schoolsWithStatsRaw;
    
    if (minRating !== null) {
      filteredSchools = filteredSchools.filter(school => 
        school.overall_avg !== null && school.overall_avg >= minRating
      );
    }
    
    if (minReviewCount !== null) {
      filteredSchools = filteredSchools.filter(school => 
        school.review_count >= minReviewCount
      );
    }

    // 7. ソート
    let sortedSchools = [...filteredSchools];
    if (sort === 'rating_desc') {
      sortedSchools.sort((a, b) => {
        if (a.overall_avg === null) return 1;
        if (b.overall_avg === null) return -1;
        return b.overall_avg - a.overall_avg;
      });
    } else if (sort === 'rating_asc') {
      sortedSchools.sort((a, b) => {
        if (a.overall_avg === null) return 1;
        if (b.overall_avg === null) return -1;
        return a.overall_avg - b.overall_avg;
      });
    } else if (sort === 'review_count_desc') {
      sortedSchools.sort((a, b) => b.review_count - a.review_count);
    } else if (sort === 'review_count_asc') {
      sortedSchools.sort((a, b) => a.review_count - b.review_count);
    } else {
      // デフォルト: 名前順
      sortedSchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }

    // 8. ページネーション
    const total = sortedSchools.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedSchools = sortedSchools.slice(offset, offset + limit);

    // デバッグ用ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] 最終結果数: ${paginatedSchools.length}, 総件数: ${total}, ページ: ${page}/${totalPages}`);
    }

    return NextResponse.json({ 
      schools: paginatedSchools,
      total,
      total_pages: totalPages,
      page,
      limit,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
