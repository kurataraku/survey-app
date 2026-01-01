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

    if (!allSchools) {
      return NextResponse.json({ schools: [], total: 0, page, limit, total_pages: 0 });
    }

    // 各学校の統計を取得
    const schoolsWithStats = await Promise.all(
      allSchools.map(async (school) => {
        // ホームページAPIと同じロジックを使用
        // school_idとis_publicで検索（カラムが存在する場合）
        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('is_public', true);

        // 評価データを取得
        const { data: reviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction, answers')
          .eq('school_id', school.id)
          .eq('is_public', true)
          .not('overall_satisfaction', 'is', null);

        // 各評価項目の平均を計算
        // 既に.not('overall_satisfaction', 'is', null)でフィルタリング済みなので、nullチェックは不要
        const overallAvg = reviews && reviews.length > 0
          ? reviews.reduce((sum, r) => sum + (r.overall_satisfaction || 0), 0) / reviews.length
          : null;

        // answers JSONBから評価データを取得
        // 評価値は1-5の範囲で、6は「評価できない」を意味するため除外
        const staffRatings = reviews && reviews.length > 0
          ? reviews
              .map(r => r.answers?.staff_rating)
              .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
              .map(r => parseInt(r, 10))
              .filter(r => !isNaN(r) && r >= 1 && r <= 5)
          : [];

        const atmosphereRatings = reviews && reviews.length > 0
          ? reviews
              .map(r => r.answers?.atmosphere_fit_rating)
              .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
              .map(r => parseInt(r, 10))
              .filter(r => !isNaN(r) && r >= 1 && r <= 5)
          : [];

        const creditRatings = reviews && reviews.length > 0
          ? reviews
              .map(r => r.answers?.credit_rating)
              .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
              .map(r => parseInt(r, 10))
              .filter(r => !isNaN(r) && r >= 1 && r <= 5)
          : [];

        const tuitionRatings = reviews && reviews.length > 0
          ? reviews
              .map(r => r.answers?.tuition_rating)
              .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
              .map(r => parseInt(r, 10))
              .filter(r => !isNaN(r) && r >= 1 && r <= 5)
          : [];

        const staffAvg = staffRatings.length > 0
          ? staffRatings.reduce((sum, r) => sum + r, 0) / staffRatings.length
          : null;

        const atmosphereAvg = atmosphereRatings.length > 0
          ? atmosphereRatings.reduce((sum, r) => sum + r, 0) / atmosphereRatings.length
          : null;

        const creditAvg = creditRatings.length > 0
          ? creditRatings.reduce((sum, r) => sum + r, 0) / creditRatings.length
          : null;

        const tuitionAvg = tuitionRatings.length > 0
          ? tuitionRatings.reduce((sum, r) => sum + r, 0) / tuitionRatings.length
          : null;

        return {
          id: school.id,
          name: school.name,
          prefecture: school.prefecture,
          slug: school.slug,
          review_count: reviewCount || 0,
          overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
          staff_avg: staffAvg ? parseFloat(staffAvg.toFixed(2)) : null,
          atmosphere_avg: atmosphereAvg ? parseFloat(atmosphereAvg.toFixed(2)) : null,
          credit_avg: creditAvg ? parseFloat(creditAvg.toFixed(2)) : null,
          tuition_avg: tuitionAvg ? parseFloat(tuitionAvg.toFixed(2)) : null,
        };
      })
    );

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
    });
  } catch (error) {
    console.error('ランキングAPIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

