import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSearchQuery } from '@/lib/utils';

export async function GET(request: NextRequest) {
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

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    // 検索クエリを正規化（全角→半角変換）
    const normalizedQuery = normalizeSearchQuery(q);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:28',message:'検索クエリ受信',data:{originalQuery:q,normalizedQuery,queryLength:q.length},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-priority',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const maxResults = 10;
    const allSchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = [];
    const prioritySchoolIds = new Set<string>(); // 優先表示する学校のID

    // ステップ0: 「N高」「S高」を特別扱い（クエリが「N」または「S」の場合）
    const isNSearch = normalizedQuery === 'N' || normalizedQuery === 'n';
    const isSSearch = normalizedQuery === 'S' || normalizedQuery === 's';
    
    if (isNSearch || isSSearch) {
      const priorityPattern = isNSearch ? 'N高' : 'S高';
      const priorityPatternFull = isNSearch ? 'N高等学校' : 'S高等学校';
      
      // 「N高」または「S高」を含む学校名を明示的に検索（最優先）
      // Supabaseの.or()メソッドを使用（条件をカンマ区切りで指定）
      const { data: prioritySchools, error: priorityError } = await supabase
        .from('schools')
        .select('id, name, prefecture, slug, status')
        .eq('is_public', true)
        .eq('status', 'active')
        .or(`name.ilike.%${priorityPattern}%,name.ilike.%${priorityPatternFull}%`)
        .order('name', { ascending: true })
        .limit(5); // 優先校は最大5件まで

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:42',message:'優先校検索結果',data:{priorityPattern,resultCount:prioritySchools?.length||0,hasError:!!priorityError,errorMessage:priorityError?.message,allSchoolNames:prioritySchools?.map(s=>s.name)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-priority',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!priorityError && prioritySchools) {
        // 優先校を先頭に追加
        allSchools.push(...prioritySchools);
        prioritySchools.forEach(school => prioritySchoolIds.add(school.id));
      }
    }

    // ステップ1: 先頭一致の検索を優先実行（最大10件）
    const { data: prefixMatchSchools, error: prefixError } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug, status')
      .eq('is_public', true)
      .eq('status', 'active')
      .ilike('name', `${normalizedQuery}%`) // 先頭一致（%を先頭に付けない）
      .order('name', { ascending: true })
      .limit(maxResults);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:38',message:'先頭一致検索結果',data:{resultCount:prefixMatchSchools?.length||0,hasError:!!prefixError,errorMessage:prefixError?.message,allSchoolNames:prefixMatchSchools?.map(s=>s.name)||[],includesNHigh:prefixMatchSchools?.some(s=>s.name.includes('N高')||s.name.includes('N高等学校'))||false,includesSHigh:prefixMatchSchools?.some(s=>s.name.includes('S高')||s.name.includes('S高等学校'))||false},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (prefixError) {
      console.error('学校検索エラー（先頭一致）:', prefixError);
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: prefixError.message, code: prefixError.code },
        { status: 500 }
      );
    }

    // 先頭一致の結果を追加（優先校は除外）
    if (prefixMatchSchools) {
      const nonPriorityPrefixSchools = prefixMatchSchools.filter(
        school => !prioritySchoolIds.has(school.id)
      );
      allSchools.push(...nonPriorityPrefixSchools);
    }

    // ステップ2: 先頭一致の結果が10件未満の場合、部分一致の検索を追加実行
    if (allSchools.length < maxResults) {
      const excludeIds = allSchools.map((s) => s.id);
      const remainingCount = maxResults - allSchools.length;

      // 部分一致検索（先頭一致で取得したIDは除外）
      let partialQuery = supabase
        .from('schools')
        .select('id, name, prefecture, slug, status')
        .eq('is_public', true)
        .eq('status', 'active')
        .ilike('name', `%${normalizedQuery}%`); // 部分一致

      // 先頭一致で取得したIDと優先校のIDを除外
      if (excludeIds.length > 0) {
        // Supabaseの.not()メソッドで配列を除外
        // excludeIdsの各IDに対して.not()を適用（Supabaseでは複数の.not()をチェーンできる）
        for (const excludeId of excludeIds) {
          partialQuery = partialQuery.neq('id', excludeId);
        }
      }
      // 優先校のIDも除外
      for (const priorityId of prioritySchoolIds) {
        partialQuery = partialQuery.neq('id', priorityId);
      }

      const { data: partialMatchSchools, error: partialError } = await partialQuery
        .order('name', { ascending: true })
        .limit(remainingCount);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:63',message:'部分一致検索結果',data:{resultCount:partialMatchSchools?.length||0,hasError:!!partialError,errorMessage:partialError?.message,remainingCount,excludeIdsCount:excludeIds.length,allSchoolNames:partialMatchSchools?.map(s=>s.name)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (partialError) {
        console.error('学校検索エラー（部分一致）:', partialError);
        // 部分一致のエラーは無視して、先頭一致の結果のみを返す
      } else if (partialMatchSchools) {
        // 部分一致の結果を追加
        allSchools.push(...partialMatchSchools);
      }
    }

    // 念のため、activeのみをフィルタリング（クエリで既にフィルタリング済みだが、二重チェック）
    // また、重複を排除
    const uniqueSchoolsMap = new Map<string, { id: string; name: string; prefecture: string; slug: string | null }>();
    for (const school of allSchools) {
      if (school.status === 'active' && !uniqueSchoolsMap.has(school.id)) {
        uniqueSchoolsMap.set(school.id, {
          id: school.id,
          name: school.name,
          prefecture: school.prefecture,
          slug: school.slug,
        });
      }
    }

    let suggestions = Array.from(uniqueSchoolsMap.values());

    // 最終ソート: 優先校（N高、S高）を先頭に配置
    suggestions.sort((a, b) => {
      const aIsPriority = prioritySchoolIds.has(a.id);
      const bIsPriority = prioritySchoolIds.has(b.id);
      
      if (aIsPriority && !bIsPriority) return -1; // aを先に
      if (!aIsPriority && bIsPriority) return 1;  // bを先に
      
      // 両方とも優先校、または両方とも通常校の場合は名前順
      return a.name.localeCompare(b.name, 'ja');
    });

    // 最大10件に制限
    suggestions = suggestions.slice(0, maxResults);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:145',message:'最終検索結果',data:{totalResultCount:suggestions.length,allSchoolNames:suggestions.map(s=>s.name),prioritySchoolCount:prioritySchoolIds.size,firstSchoolName:suggestions[0]?.name||null,includesNHigh:suggestions.some(s=>s.name.includes('N高')||s.name.includes('N高等学校')),includesSHigh:suggestions.some(s=>s.name.includes('S高')||s.name.includes('S高等学校'))},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-priority',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

