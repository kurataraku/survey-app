import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
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

    const reviewId = resolvedParams.id;
    const body = await request.json();
    const action = body.action; // 'like' or 'unlike'

    // 口コミが存在するか確認
    const { data: review, error: reviewError } = await supabase
      .from('survey_responses')
      .select('id')
      .eq('id', reviewId)
      .eq('is_public', true)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: '口コミが見つかりません' },
        { status: 404 }
      );
    }

    // クライアントIPを取得
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    if (action === 'like') {
      // いいねを追加（既に存在する場合は無視）
      const { error: insertError } = await supabase
        .from('review_likes')
        .insert({
          review_id: reviewId,
          user_ip: clientIp,
        })
        .select();

      // 重複エラー（UNIQUE制約違反）の場合は無視
      if (insertError && insertError.code !== '23505') {
        console.error('いいね追加エラー:', insertError);
        return NextResponse.json(
          { error: 'いいねの追加に失敗しました', details: insertError.message },
          { status: 500 }
        );
      }
    } else if (action === 'unlike') {
      // いいねを削除
      const { error: deleteError } = await supabase
        .from('review_likes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_ip', clientIp);

      if (deleteError) {
        console.error('いいね削除エラー:', deleteError);
        return NextResponse.json(
          { error: 'いいねの削除に失敗しました', details: deleteError.message },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: '無効なアクションです。actionは"like"または"unlike"である必要があります。' },
        { status: 400 }
      );
    }

    // 現在のいいね数を取得
    const { count: likeCount } = await supabase
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId);

    // ユーザーがいいねしているか確認
    const { count: userLikeCount } = await supabase
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId)
      .eq('user_ip', clientIp);

    return NextResponse.json({
      success: true,
      like_count: likeCount || 0,
      is_liked: (userLikeCount || 0) > 0,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}


