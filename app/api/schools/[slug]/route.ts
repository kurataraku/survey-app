import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    console.log('[API] /api/schools/[slug] - Request started');
    
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[API] /api/schools/[slug] - Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API] /api/schools/[slug] - Missing environment variables');
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Next.jsのAPIルートではparamsはすでにデコードされているため、そのまま使用
    // ただし、ブラウザからエンコードされて送られてくる場合もあるため、両方に対応
    let slug = resolvedParams.slug;
    
    // デコードが必要な場合（%が含まれている場合）
    if (slug.includes('%')) {
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // デコードに失敗した場合はそのまま使用
        console.warn('[API] Slug decode failed, using original:', slug);
      }
    }
    
    // デバッグ用ログ
    console.log('[API] /api/schools/[slug] - Received slug (raw):', resolvedParams.slug);
    console.log('[API] /api/schools/[slug] - Processed slug:', slug);
    console.log('[API] /api/schools/[slug] - Slug type:', typeof slug);
    console.log('[API] /api/schools/[slug] - Slug length:', slug?.length);

    // 学校情報を取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (schoolError || !school) {
      console.log('[API] /api/schools/[slug] - School not found. Error:', schoolError);
      console.log('[API] /api/schools/[slug] - Searching for slug:', slug);
      console.log('[API] /api/schools/[slug] - Slug type:', typeof slug);
      console.log('[API] /api/schools/[slug] - Slug length:', slug?.length);
      
      // すべての学校のslugを取得してデバッグ
      const { data: schoolsList } = await supabase
        .from('schools')
        .select('id, name, slug')
        .eq('is_public', true)
        .limit(100);
      
      console.log('[API] /api/schools/[slug] - Total schools found:', schoolsList?.length);
      console.log('[API] /api/schools/[slug] - Available slugs:', schoolsList?.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        slugType: typeof s.slug,
        slugLength: s.slug?.length,
        slugMatches: s.slug === slug,
        slugIncludes: s.slug?.includes(slug) || slug?.includes(s.slug || '')
      })));
      
      // 大文字小文字を区別しない検索を試行（参考用）
      const { data: caseInsensitiveSchools } = await supabase
        .from('schools')
        .select('id, name, slug')
        .eq('is_public', true)
        .ilike('slug', slug);
      
      if (caseInsensitiveSchools && caseInsensitiveSchools.length > 0) {
        console.log('[API] /api/schools/[slug] - Found with case-insensitive search:', caseInsensitiveSchools);
      }
      
      return NextResponse.json(
        { 
          error: '学校が見つかりません', 
          received_slug: slug,
          received_slug_encoded: resolvedParams.slug,
          available_slugs_count: schoolsList?.length || 0
        },
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
      slug: school.slug,
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
    console.error('[API] /api/schools/[slug] - Error occurred:', error);
    console.error('[API] /api/schools/[slug] - Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[API] /api/schools/[slug] - Error message:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}

