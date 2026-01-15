import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // すべての公開されている学校を取得
    const { data: allSchools } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug')
      .eq('is_public', true);

    if (!allSchools || allSchools.length === 0) {
      return NextResponse.json({ schools: [], total: 0, page, limit, total_pages: 0, type });
    }

    // パフォーマンス最適化: 全ての学校の統計情報を一括取得
    const schoolIds = allSchools.map(s => s.id);
    
    // 全ての口コミデータを一度に取得
    const { data: allReviews, error: reviewsError } = await supabase
      .from('survey_responses')
      .select('school_id, overall_satisfaction, answers')
      .in('school_id', schoolIds)
      .eq('is_public', true)
      .not('school_id', 'is', null);

    if (reviewsError) {
      console.error('[API] /api/rankings/[type] - 口コミデータ取得エラー:', reviewsError);
    }

    // 学校IDごとに統計情報を集計
    const statsMap = new Map<string, {
      review_count: number;
      overall_ratings: number[];
      staff_ratings: number[];
      atmosphere_ratings: number[];
      credit_ratings: number[];
      tuition_ratings: number[];
    }>();

    // 初期化（全ての学校を0件で初期化）
    schoolIds.forEach(id => {
      statsMap.set(id, {
        review_count: 0,
        overall_ratings: [],
        staff_ratings: [],
        atmosphere_ratings: [],
        credit_ratings: [],
        tuition_ratings: [],
      });
    });

    // 統計情報を集計
    if (allReviews) {
      allReviews.forEach((review) => {
        const schoolId = review.school_id;
        if (!schoolId) return;

        const stats = statsMap.get(schoolId);
        if (!stats) return;

        stats.review_count++;

        // overall_satisfactionの処理
        if (review.overall_satisfaction !== null && 
            review.overall_satisfaction !== 6 && 
            review.overall_satisfaction >= 1 && 
            review.overall_satisfaction <= 5) {
          stats.overall_ratings.push(review.overall_satisfaction);
        }

        // answers JSONBから評価データを取得
        if (review.answers) {
          const answers = typeof review.answers === 'string' 
            ? JSON.parse(review.answers) 
            : review.answers;

          // staff_rating
          if (answers.staff_rating) {
            const rating = parseInt(answers.staff_rating, 10);
            if (!isNaN(rating) && rating >= 1 && rating <= 5 && rating !== 6) {
              stats.staff_ratings.push(rating);
            }
          }

          // atmosphere_fit_rating
          if (answers.atmosphere_fit_rating) {
            const rating = parseInt(answers.atmosphere_fit_rating, 10);
            if (!isNaN(rating) && rating >= 1 && rating <= 5 && rating !== 6) {
              stats.atmosphere_ratings.push(rating);
            }
          }

          // credit_rating
          if (answers.credit_rating) {
            const rating = parseInt(answers.credit_rating, 10);
            if (!isNaN(rating) && rating >= 1 && rating <= 5 && rating !== 6) {
              stats.credit_ratings.push(rating);
            }
          }

          // tuition_rating
          if (answers.tuition_rating) {
            const rating = parseInt(answers.tuition_rating, 10);
            if (!isNaN(rating) && rating >= 1 && rating <= 5 && rating !== 6) {
              stats.tuition_ratings.push(rating);
            }
          }
        }
      });
    }

    // 学校データと統計情報を結合
    const schoolsWithStats = allSchools.map((school) => {
      const stats = statsMap.get(school.id) || {
        review_count: 0,
        overall_ratings: [],
        staff_ratings: [],
        atmosphere_ratings: [],
        credit_ratings: [],
        tuition_ratings: [],
      };

      const overallAvg = stats.overall_ratings.length > 0
        ? stats.overall_ratings.reduce((sum, r) => sum + r, 0) / stats.overall_ratings.length
        : null;

      const staffAvg = stats.staff_ratings.length > 0
        ? stats.staff_ratings.reduce((sum, r) => sum + r, 0) / stats.staff_ratings.length
        : null;

      const atmosphereAvg = stats.atmosphere_ratings.length > 0
        ? stats.atmosphere_ratings.reduce((sum, r) => sum + r, 0) / stats.atmosphere_ratings.length
        : null;

      const creditAvg = stats.credit_ratings.length > 0
        ? stats.credit_ratings.reduce((sum, r) => sum + r, 0) / stats.credit_ratings.length
        : null;

      const tuitionAvg = stats.tuition_ratings.length > 0
        ? stats.tuition_ratings.reduce((sum, r) => sum + r, 0) / stats.tuition_ratings.length
        : null;

      return {
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
        review_count: stats.review_count,
        overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
        staff_avg: staffAvg ? parseFloat(staffAvg.toFixed(2)) : null,
        atmosphere_avg: atmosphereAvg ? parseFloat(atmosphereAvg.toFixed(2)) : null,
        credit_avg: creditAvg ? parseFloat(creditAvg.toFixed(2)) : null,
        tuition_avg: tuitionAvg ? parseFloat(tuitionAvg.toFixed(2)) : null,
      };
    });

    // ランキングタイプに応じてソート
    // 注意: 進学実績ランキングは削除されました。追加しないでください。
    let rankedSchools: typeof schoolsWithStats;
    let rankingValue: number | null;

    // 進学実績ランキング関連のタイプを明示的に拒否
    if (type === 'graduation' || type === 'career' || type === 'advancement' || type === '進学実績') {
      return NextResponse.json(
        { error: '進学実績ランキングは削除されました' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'overall':
        rankedSchools = schoolsWithStats
          .filter(s => s.overall_avg !== null && s.review_count >= 1)
          .sort((a, b) => (b.overall_avg || 0) - (a.overall_avg || 0));
        break;
      case 'staff':
        rankedSchools = schoolsWithStats
          .filter(s => s.staff_avg !== null && s.review_count >= 1)
          .sort((a, b) => (b.staff_avg || 0) - (a.staff_avg || 0));
        break;
      case 'atmosphere':
        rankedSchools = schoolsWithStats
          .filter(s => s.atmosphere_avg !== null && s.review_count >= 1)
          .sort((a, b) => (b.atmosphere_avg || 0) - (a.atmosphere_avg || 0));
        break;
      case 'credit':
        rankedSchools = schoolsWithStats
          .filter(s => s.credit_avg !== null && s.review_count >= 1)
          .sort((a, b) => (b.credit_avg || 0) - (a.credit_avg || 0));
        break;
      case 'tuition':
        rankedSchools = schoolsWithStats
          .filter(s => s.tuition_avg !== null && s.review_count >= 1)
          .sort((a, b) => (b.tuition_avg || 0) - (a.tuition_avg || 0));
        break;
      case 'review-count':
        rankedSchools = schoolsWithStats
          .filter(s => s.review_count > 0)
          .sort((a, b) => b.review_count - a.review_count);
        break;
      default:
        return NextResponse.json(
          { error: '無効なランキングタイプです' },
          { status: 400 }
        );
    }

    // ページネーション
    const total = rankedSchools.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedSchools = rankedSchools.slice(offset, offset + limit);

    return NextResponse.json({
      schools: paginatedSchools,
      total,
      page,
      limit,
      total_pages: totalPages,
      type,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('ランキングAPIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

