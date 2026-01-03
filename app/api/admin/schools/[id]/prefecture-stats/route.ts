import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 学校の名前を取得
    const { data: school } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', schoolId)
      .single();

    if (!school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    // その学校の口コミを取得
    const { data: reviews, error: reviewsError } = await supabase
      .from('survey_responses')
      .select('answers')
      .eq('school_name', school.name);

    if (reviewsError) {
      console.error('口コミ取得エラー:', reviewsError);
      return NextResponse.json(
        { error: '口コミの取得に失敗しました', details: reviewsError.message },
        { status: 500 }
      );
    }

    // 都道府県を集計
    const prefectureCounts: Record<string, number> = {};
    let totalResponses = 0;

    (reviews || []).forEach((review: any) => {
      if (!review.answers) return;
      
      let answers: any = {};
      try {
        answers = typeof review.answers === 'string' 
          ? JSON.parse(review.answers) 
          : review.answers;
      } catch (error) {
        console.warn('answersパースエラー:', error);
        return;
      }

      // campus_prefectureを取得（複数のキー名に対応）
      let campusPrefecture: string | null = null;
      
      if (answers.campus_prefecture) {
        if (Array.isArray(answers.campus_prefecture)) {
          campusPrefecture = answers.campus_prefecture.length > 0 
            ? String(answers.campus_prefecture[0]).trim() 
            : null;
        } else if (String(answers.campus_prefecture).trim() !== '') {
          campusPrefecture = String(answers.campus_prefecture).trim();
        }
      } else if (answers.campusPrefecture) {
        if (Array.isArray(answers.campusPrefecture)) {
          campusPrefecture = answers.campusPrefecture.length > 0 
            ? String(answers.campusPrefecture[0]).trim() 
            : null;
        } else if (String(answers.campusPrefecture).trim() !== '') {
          campusPrefecture = String(answers.campusPrefecture).trim();
        }
      } else if (answers['主に通っていたキャンパス']) {
        if (Array.isArray(answers['主に通っていたキャンパス'])) {
          campusPrefecture = answers['主に通っていたキャンパス'].length > 0 
            ? String(answers['主に通っていたキャンパス'][0]).trim() 
            : null;
        } else if (String(answers['主に通っていたキャンパス']).trim() !== '') {
          campusPrefecture = String(answers['主に通っていたキャンパス']).trim();
        }
      }

      if (campusPrefecture) {
        prefectureCounts[campusPrefecture] = (prefectureCounts[campusPrefecture] || 0) + 1;
        totalResponses++;
      }
    });

    // 都道府県を件数順でソート
    const prefectureStats = Object.entries(prefectureCounts)
      .map(([prefecture, count]) => ({
        prefecture,
        count,
        percentage: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      prefectureStats,
      totalResponses,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

