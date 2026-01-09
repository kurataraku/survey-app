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
    
    // 3つのカテゴリに分けて管理
    const prioritySchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ①人気高（N高、S高）
    const prefixMatchSchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ②先頭一致
    const partialMatchSchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ③部分一致
    
    const allSchoolIds = new Set<string>(); // 重複チェック用

    // ステップ1: 「N高」「S高」を特別扱い（クエリが「N」または「S」の場合）
    const isNSearch = normalizedQuery === 'N' || normalizedQuery === 'n';
    const isSSearch = normalizedQuery === 'S' || normalizedQuery === 's';
    
    if (isNSearch || isSSearch) {
      const priorityPattern = isNSearch ? 'N高' : 'S高';
      const priorityPatternFull = isNSearch ? 'N高等学校' : 'S高等学校';
      
      // 「N高」を含む学校名を検索
      const { data: prioritySchools1, error: error1 } = await supabase
        .from('schools')
        .select('id, name, prefecture, slug, status')
        .eq('is_public', true)
        .eq('status', 'active')
        .ilike('name', `%${priorityPattern}%`)
        .order('name', { ascending: true })
        .limit(10);

      // 「N高等学校」を含む学校名を検索（重複を避けるため）
      const { data: prioritySchools2, error: error2 } = await supabase
        .from('schools')
        .select('id, name, prefecture, slug, status')
        .eq('is_public', true)
        .eq('status', 'active')
        .ilike('name', `%${priorityPatternFull}%`)
        .order('name', { ascending: true })
        .limit(10);

      // 結果をマージ（重複を排除）
      const mergedPriority = [...(prioritySchools1 || []), ...(prioritySchools2 || [])];
      const uniquePriority = mergedPriority.filter((school, index, self) => 
        index === self.findIndex(s => s.id === school.id)
      );

      // 優先校を追加
      for (const school of uniquePriority) {
        if (!allSchoolIds.has(school.id)) {
          prioritySchools.push(school);
          allSchoolIds.add(school.id);
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:45',message:'優先校検索結果',data:{priorityPattern,resultCount:prioritySchools.length,allSchoolNames:prioritySchools.map(s=>s.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix-v2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }

    // ステップ2: 先頭一致の検索（優先校を除外）
    const excludeIdsForPrefix = Array.from(allSchoolIds);
    let prefixQuery = supabase
      .from('schools')
      .select('id, name, prefecture, slug, status')
      .eq('is_public', true)
      .eq('status', 'active')
      .ilike('name', `${normalizedQuery}%`); // 先頭一致

    // 優先校を除外
    for (const excludeId of excludeIdsForPrefix) {
      prefixQuery = prefixQuery.neq('id', excludeId);
    }

    const { data: prefixMatchData, error: prefixError } = await prefixQuery
      .order('name', { ascending: true })
      .limit(maxResults);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:75',message:'先頭一致検索結果',data:{resultCount:prefixMatchData?.length||0,hasError:!!prefixError,errorMessage:prefixError?.message,allSchoolNames:prefixMatchData?.map(s=>s.name)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix-v2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!prefixError && prefixMatchData) {
      for (const school of prefixMatchData) {
        if (!allSchoolIds.has(school.id)) {
          prefixMatchSchools.push(school);
          allSchoolIds.add(school.id);
        }
      }
    }

    // ステップ3: 部分一致の検索（優先校と先頭一致を除外、10件に満たない場合のみ）
    const currentTotal = prioritySchools.length + prefixMatchSchools.length;
    if (currentTotal < maxResults) {
      const excludeIdsForPartial = Array.from(allSchoolIds);
      const remainingCount = maxResults - currentTotal;

      let partialQuery = supabase
        .from('schools')
        .select('id, name, prefecture, slug, status')
        .eq('is_public', true)
        .eq('status', 'active')
        .ilike('name', `%${normalizedQuery}%`); // 部分一致

      // 優先校と先頭一致を除外
      for (const excludeId of excludeIdsForPartial) {
        partialQuery = partialQuery.neq('id', excludeId);
      }

      const { data: partialMatchData, error: partialError } = await partialQuery
        .order('name', { ascending: true })
        .limit(remainingCount);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:103',message:'部分一致検索結果',data:{resultCount:partialMatchData?.length||0,hasError:!!partialError,errorMessage:partialError?.message,remainingCount,allSchoolNames:partialMatchData?.map(s=>s.name)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix-v2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (!partialError && partialMatchData) {
        for (const school of partialMatchData) {
          if (!allSchoolIds.has(school.id)) {
            partialMatchSchools.push(school);
            allSchoolIds.add(school.id);
          }
        }
      }
    }

    // ステップ4: 3つのカテゴリを順序通りにマージ
    // ①人気高（N高、S高）→ ②先頭一致 → ③部分一致
    const suggestions: Array<{ id: string; name: string; prefecture: string; slug: string | null }> = [];
    
    // 各カテゴリ内で名前順にソート
    prioritySchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    prefixMatchSchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    partialMatchSchools.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    // 順序通りにマージ（最大10件）
    for (const school of prioritySchools) {
      if (suggestions.length >= maxResults) break;
      suggestions.push({
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
      });
    }
    
    for (const school of prefixMatchSchools) {
      if (suggestions.length >= maxResults) break;
      suggestions.push({
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
      });
    }
    
    for (const school of partialMatchSchools) {
      if (suggestions.length >= maxResults) break;
      suggestions.push({
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/autocomplete/route.ts:145',message:'最終検索結果',data:{totalResultCount:suggestions.length,priorityCount:prioritySchools.length,prefixCount:prefixMatchSchools.length,partialCount:partialMatchSchools.length,allSchoolNames:suggestions.map(s=>s.name),firstSchoolName:suggestions[0]?.name||null,includesNHigh:suggestions.some(s=>s.name.includes('N高')||s.name.includes('N高等学校')),includesSHigh:suggestions.some(s=>s.name.includes('S高')||s.name.includes('S高等学校'))},timestamp:Date.now(),sessionId:'debug-session',runId:'autocomplete-fix-v2',hypothesisId:'E'})}).catch(()=>{});
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

