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

    // 記事を取得（非公開も含む）
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    // 関連学校を取得
    const { data: articleSchools, error: schoolsError } = await supabase
      .from('article_schools')
      .select(`
        id,
        article_id,
        school_id,
        display_order,
        note,
        schools (
          id,
          name,
          prefecture,
          slug
        )
      `)
      .eq('article_id', id)
      .order('display_order', { ascending: true });

    return NextResponse.json({
      ...article,
      schools: articleSchools || [],
    });
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
      title,
      slug,
      category,
      content,
      excerpt,
      featured_image_url,
      is_public,
      meta_title,
      meta_description,
    } = body;

    // 既存の記事を取得（公開状態を確認するため）
    const { data: existingArticle } = await supabase
      .from('articles')
      .select('is_public, published_at')
      .eq('id', id)
      .single();

    if (!existingArticle) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    // スラッグの重複チェック（自分自身を除く）
    if (slug) {
      const { data: slugConflict } = await supabase
        .from('articles')
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
    }

    // 公開フラグがtrueに変更された場合、published_atを設定（まだ設定されていない場合）
    let publishedAt = existingArticle.published_at;
    if (is_public === true && !publishedAt) {
      publishedAt = new Date().toISOString();
    }

    // カテゴリのバリデーション
    if (category && category !== 'interview' && category !== 'useful_info') {
      return NextResponse.json(
        { error: 'カテゴリはinterviewまたはuseful_infoである必要があります' },
        { status: 400 }
      );
    }

    // 記事を更新
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (publishedAt !== undefined) updateData.published_at = publishedAt;
    if (meta_title !== undefined) updateData.meta_title = meta_title;
    if (meta_description !== undefined) updateData.meta_description = meta_description;

    const { data: article, error: updateError } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('記事更新エラー:', updateError);
      return NextResponse.json(
        { error: '記事の更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // 記事を削除（CASCADEにより関連するarticle_schoolsも自動削除される）
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('記事削除エラー:', deleteError);
      return NextResponse.json(
        { error: '記事の削除に失敗しました', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

