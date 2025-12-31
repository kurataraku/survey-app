import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    // #region agent log
    try{const logDir=join(process.cwd(),'.cursor');await mkdir(logDir,{recursive:true});const logPath=join(logDir,'debug.log');const logEntry={location:'app/api/rankings/[type]/route.ts:9',message:'ランキングAPI呼び出し開始',data:{type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};await writeFile(logPath,JSON.stringify(logEntry)+'\n',{flag:'a'});}catch(e){}
    // #endregion
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
        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('is_public', true);

        // 評価データを取得
        const { data: reviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction, staff_rating, atmosphere_fit_rating, credit_rating, tuition_rating')
          .eq('school_id', school.id)
          .eq('is_public', true);

        // 各評価項目の平均を計算
        const overallAvg = reviews && reviews.length > 0
          ? reviews.filter(r => r.overall_satisfaction !== null)
            .reduce((sum, r) => sum + (r.overall_satisfaction || 0), 0) / reviews.filter(r => r.overall_satisfaction !== null).length
          : null;

        const staffAvg = reviews && reviews.length > 0
          ? reviews.filter(r => r.staff_rating !== null)
            .reduce((sum, r) => sum + (r.staff_rating || 0), 0) / reviews.filter(r => r.staff_rating !== null).length
          : null;

        const atmosphereAvg = reviews && reviews.length > 0
          ? reviews.filter(r => r.atmosphere_fit_rating !== null)
            .reduce((sum, r) => sum + (r.atmosphere_fit_rating || 0), 0) / reviews.filter(r => r.atmosphere_fit_rating !== null).length
          : null;

        const creditAvg = reviews && reviews.length > 0
          ? reviews.filter(r => r.credit_rating !== null)
            .reduce((sum, r) => sum + (r.credit_rating || 0), 0) / reviews.filter(r => r.credit_rating !== null).length
          : null;

        const tuitionAvg = reviews && reviews.length > 0
          ? reviews.filter(r => r.tuition_rating !== null)
            .reduce((sum, r) => sum + (r.tuition_rating || 0), 0) / reviews.filter(r => r.tuition_rating !== null).length
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
      // #region agent log
      try{const logDir=join(process.cwd(),'.cursor');await mkdir(logDir,{recursive:true});const logPath=join(logDir,'debug.log');const logEntry={location:'app/api/rankings/[type]/route.ts:98',message:'進学実績ランキング拒否',data:{type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};await writeFile(logPath,JSON.stringify(logEntry)+'\n',{flag:'a'});}catch(e){}
      // #endregion
      return NextResponse.json(
        { error: '進学実績ランキングは削除されました' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'overall':
        // #region agent log
        try{const logDir=join(process.cwd(),'.cursor');await mkdir(logDir,{recursive:true});const logPath=join(logDir,'debug.log');const logEntry={location:'app/api/rankings/[type]/route.ts:105',message:'overallランキング処理開始',data:{type,schoolsCount:schoolsWithStats.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};await writeFile(logPath,JSON.stringify(logEntry)+'\n',{flag:'a'});}catch(e){}
        // #endregion
        rankedSchools = schoolsWithStats
          .filter(s => s.overall_avg !== null && s.review_count >= 3)
          .sort((a, b) => (b.overall_avg || 0) - (a.overall_avg || 0));
        break;
      case 'staff':
        rankedSchools = schoolsWithStats
          .filter(s => s.staff_avg !== null && s.review_count >= 3)
          .sort((a, b) => (b.staff_avg || 0) - (a.staff_avg || 0));
        break;
      case 'atmosphere':
        rankedSchools = schoolsWithStats
          .filter(s => s.atmosphere_avg !== null && s.review_count >= 3)
          .sort((a, b) => (b.atmosphere_avg || 0) - (a.atmosphere_avg || 0));
        break;
      case 'credit':
        rankedSchools = schoolsWithStats
          .filter(s => s.credit_avg !== null && s.review_count >= 3)
          .sort((a, b) => (b.credit_avg || 0) - (a.credit_avg || 0));
        break;
      case 'tuition':
        rankedSchools = schoolsWithStats
          .filter(s => s.tuition_avg !== null && s.review_count >= 3)
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

    // #region agent log
    try{const logDir=join(process.cwd(),'.cursor');await mkdir(logDir,{recursive:true});const logPath=join(logDir,'debug.log');const logEntry={location:'app/api/rankings/[type]/route.ts:143',message:'ランキングAPI成功',data:{type,total,paginatedCount:paginatedSchools.length,page,totalPages},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};await writeFile(logPath,JSON.stringify(logEntry)+'\n',{flag:'a'});}catch(e){}
    // #endregion

    return NextResponse.json({
      schools: paginatedSchools,
      total,
      page,
      limit,
      total_pages: totalPages,
      type,
    });
  } catch (error) {
    // #region agent log
    try{const logDir=join(process.cwd(),'.cursor');await mkdir(logDir,{recursive:true});const logPath=join(logDir,'debug.log');const logEntry={location:'app/api/rankings/[type]/route.ts:157',message:'ランキングAPIエラー',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};await writeFile(logPath,JSON.stringify(logEntry)+'\n',{flag:'a'});}catch(e){}
    // #endregion
    console.error('ランキングAPIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

