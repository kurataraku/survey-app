import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const id = resolvedParams.id;

    // 学校情報を取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .eq('is_public', true)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    // 口コミ数を取得
    const { count: reviewCount } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', school.id)
      .eq('is_public', true);

    // 評価の平均値を計算
    const { data: reviews } = await supabase
      .from('survey_responses')
      .select('overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating')
      .eq('school_id', school.id)
      .eq('is_public', true);

    const calculateAvg = (field: string) => {
      const values = reviews
        ?.map(r => (r as any)[field])
        .filter((v): v is number => v !== null && v !== undefined) || [];
      return values.length > 0
        ? parseFloat((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
        : null;
    };

    const overallAvg = calculateAvg('overall_satisfaction');
    const staffRatingAvg = calculateAvg('staff_rating');
    const atmosphereFitRatingAvg = calculateAvg('atmosphere_fit_rating');
    const creditRatingAvg = calculateAvg('credit_rating');
    const tuitionRatingAvg = calculateAvg('tuition_rating');

    // 最新の口コミを取得（3件）
    const { data: latestReviews } = await supabase
      .from('survey_responses')
      .select('id, overall_satisfaction, good_comment, created_at')
      .eq('school_id', school.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      slug: school.slug || null,
      intro: school.intro,
      highlights: school.highlights,
      faq: school.faq,
      review_count: reviewCount || 0,
      overall_avg: overallAvg,
      staff_rating_avg: staffRatingAvg,
      atmosphere_fit_rating_avg: atmosphereFitRatingAvg,
      credit_rating_avg: creditRatingAvg,
      tuition_rating_avg: tuitionRatingAvg,
      latest_reviews: latestReviews?.map(review => ({
        id: review.id,
        overall_satisfaction: review.overall_satisfaction,
        good_comment: review.good_comment,
        created_at: review.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}


