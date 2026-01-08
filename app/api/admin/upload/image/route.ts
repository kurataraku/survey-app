import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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

    // FormDataからファイルを取得
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }

    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '画像ファイルのみアップロードできます' },
        { status: 400 }
      );
    }

    // ファイルサイズの検証（10MB以下）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下である必要があります' },
        { status: 400 }
      );
    }

    // ファイル名を生成（タイムスタンプ + 元のファイル名）
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `article-images/${fileName}`;

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // バケット名（環境変数で設定可能、デフォルトは'article-images'）
    // 注意: 'public'はSupabaseの予約語のため使用できません
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'article-images';

    // バケットの存在確認
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('バケット一覧取得エラー:', listError);
      return NextResponse.json(
        { 
          error: 'Storageバケットの確認に失敗しました',
          details: listError.message,
          hint: 'SupabaseダッシュボードでStorageバケットが作成されているか確認してください'
        },
        { status: 500 }
      );
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.error(`バケット '${bucketName}' が存在しません`);
      return NextResponse.json(
        { 
          error: `Storageバケット '${bucketName}' が存在しません`,
          details: 'SupabaseダッシュボードでStorageバケットを作成してください',
          hint: `1. Supabaseダッシュボード → Storage → New bucket\n2. バケット名: ${bucketName}\n3. Public bucket: 有効にする`
        },
        { status: 400 }
      );
    }

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('画像アップロードエラー:', error);
      console.error('エラー詳細:', JSON.stringify(error, null, 2));
      
      // より詳細なエラーメッセージ
      let errorMessage = '画像のアップロードに失敗しました';
      const errorMessageStr = error.message || '';
      
      if (errorMessageStr) {
        errorMessage = errorMessageStr;
        // エラーメッセージから404や403を判定
        if (errorMessageStr.includes('404') || errorMessageStr.includes('not found') || errorMessageStr.includes('見つかりません')) {
          errorMessage = `バケット '${bucketName}' が見つかりません。Supabaseダッシュボードでバケットを作成してください。`;
        } else if (errorMessageStr.includes('403') || errorMessageStr.includes('Forbidden') || errorMessageStr.includes('アクセス権限')) {
          errorMessage = `バケット '${bucketName}' へのアクセス権限がありません。バケットが公開設定になっているか確認してください。`;
        }
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorMessageStr || '不明なエラー',
          code: (error as any).statusCode || (error as any).error || 'UNKNOWN_ERROR'
        },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: '公開URLの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

