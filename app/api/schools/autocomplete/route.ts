import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSearchQuery } from '@/lib/utils';

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:5',message:'オートコンプリートAPI開始',data:{hasSupabaseUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'production-check',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:12',message:'エラー:環境変数未設定(autocomplete)',data:{supabaseUrl:supabaseUrl||'未設定',serviceKey:supabaseServiceKey?'設定済み':'未設定'},timestamp:Date.now(),sessionId:'debug-session',runId:'production-check',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    // 検索クエリを正規化（全角→半角変換）
    const normalizedQuery = normalizeSearchQuery(q);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:30',message:'オートコンプリート:クエリ実行前',data:{originalQuery:q,normalizedQuery},timestamp:Date.now(),sessionId:'debug-session',runId:'production-check',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // 学校名での部分一致検索（最大10件）
    // 正規化されたクエリで検索（status='active'のみ）
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug, status')
      .eq('is_public', true)
      .eq('status', 'active') // 承認済み（active）のみ
      .ilike('name', `%${normalizedQuery}%`)
      .order('name', { ascending: true })
      .limit(10);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:42',message:'オートコンプリート:学校検索結果',data:{query:normalizedQuery,schoolsCount:schools?.length||0,hasError:!!error,errorMessage:error?.message,errorCode:error?.code,allActive:schools?.every(s=>s.status==='active')},timestamp:Date.now(),sessionId:'debug-session',runId:'production-check',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:47',message:'オートコンプリート:エラー検出',data:{errorMessage:error.message,errorCode:error.code,errorDetails:error.details,errorHint:error.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'production-check',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      console.error('学校検索エラー:', error);
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    // 念のため、activeのみをフィルタリング（クエリで既にフィルタリング済みだが、二重チェック）
    const suggestions = (schools || [])
      .filter((school) => school.status === 'active')
      .map((school) => ({
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

