import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 学校を取得（非公開含む）
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const {
      name,
      prefecture,
      prefectures,
      slug,
      intro,
      highlights,
      faq,
      is_public,
      status,
    } = body;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:70',message:'学校更新API:リクエスト受信',data:{id,status,hasStatus:!!status},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // バリデーション
    if (!name || !prefecture || !slug) {
      return NextResponse.json(
        { error: '学校名、都道府県、スラッグは必須です' },
        { status: 400 }
      );
    }

    // prefectures配列を準備（prefecturesが指定されていない場合はprefectureから作成）
    const prefecturesArray = prefectures && Array.isArray(prefectures) && prefectures.length > 0
      ? prefectures
      : [prefecture];

    // 学校名の重複チェック（自分自身を除く）
    const { data: nameConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .neq('id', id)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'この学校名は既に使用されています' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック（自分自身を除く）
    const { data: slugConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (slugConflict) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 学校情報を更新
    const updateData: any = {
      name,
      prefecture,
      prefectures: prefecturesArray,
      slug,
      intro: intro || null,
      highlights: highlights || null,
      faq: faq || null,
      is_public: is_public !== undefined ? is_public : true,
    };
    
    // statusが指定されている場合は更新に含める
    if (status !== undefined) {
      updateData.status = status;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:135',message:'学校更新API:更新データ準備',data:{id,updateData,hasStatus:!!updateData.status,status:updateData.status},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // statusが'pending'から'active'に変更される場合、school_nameで紐づいている口コミのschool_idを更新
    if (status === 'active') {
      // 現在の学校情報を取得（更新前）
      const { data: currentSchool } = await supabase
        .from('schools')
        .select('name, status')
        .eq('id', id)
        .single();
      
      // 現在のstatusが'pending'の場合、school_nameで紐づいている口コミのschool_idを更新
      if (currentSchool && currentSchool.status === 'pending') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:143',message:'学校更新API:口コミ紐づけ開始',data:{id,schoolName:currentSchool.name},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // school_nameで紐づいているが、school_idがnullの口コミを更新
        const { data: updatedReviews, error: updateReviewsError } = await supabase
          .from('survey_responses')
          .update({ school_id: id })
          .eq('school_name', currentSchool.name)
          .is('school_id', null)
          .select('id');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:151',message:'学校更新API:口コミ紐づけ完了',data:{id,updatedReviewsCount:updatedReviews?.length||0,error:updateReviewsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (updateReviewsError) {
          console.error('口コミ紐づけエラー:', updateReviewsError);
          // エラーが発生しても続行（学校の更新は実行される）
        }
      }
    }

    const { data: school, error: updateError } = await supabase
      .from('schools')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:145',message:'学校更新API:更新エラー',data:{id,updateError:updateError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('学校更新エラー:', updateError);
      return NextResponse.json(
        { error: '学校情報の更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/schools/[id]/route.ts:152',message:'学校更新API:更新成功',data:{id,schoolId:school?.id,schoolStatus:school?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'status-update',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}





