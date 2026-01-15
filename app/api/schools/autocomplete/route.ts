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

    const maxResults = 10;
    
    // 3つのカテゴリに分けて管理
    const prioritySchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ①人気高（N高、S高）
    const prefixMatchSchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ②先頭一致
    const partialMatchSchools: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = []; // ③部分一致
    
    const allSchoolIds = new Set<string>(); // 重複チェック用

    // パフォーマンス最適化: クエリを並列実行
    const isNSearch = normalizedQuery === 'N' || normalizedQuery === 'n';
    const isSSearch = normalizedQuery === 'S' || normalizedQuery === 's';
    
    // 並列でクエリを実行
    const [priorityResults, prefixResults, partialResults] = await Promise.all([
      // ステップ1: 優先校の検索（N高、S高の場合のみ）
      (async () => {
        if (!isNSearch && !isSSearch) {
          return { data: [], error: null };
        }
        
        const priorityPattern = isNSearch ? 'N高' : 'S高';
        const priorityPatternFull = isNSearch ? 'N高等学校' : 'S高等学校';
        
        // 優先校の検索パターン（複数のパターンで検索）
        const priorityPatterns = [
          priorityPatternFull, // 「N高等学校」「S高等学校」を最優先
          priorityPattern,     // 「N高」「S高」
        ];
        
        // 各パターンで検索してマージ
        const allPriorityResults: Array<{ id: string; name: string; prefecture: string; slug: string | null; status: string }> = [];
        
        const patternQueries = priorityPatterns.map(pattern =>
          supabase
            .from('schools')
            .select('id, name, prefecture, slug, status')
            .eq('is_public', true)
            .eq('status', 'active')
            .ilike('name', `%${pattern}%`)
            .order('name', { ascending: true })
            .limit(10)
        );
        
        const patternResults = await Promise.all(patternQueries);
        
        for (const result of patternResults) {
          if (!result.error && result.data) {
            for (const school of result.data) {
              // 重複チェック
              if (!allPriorityResults.find(s => s.id === school.id)) {
                allPriorityResults.push(school);
              }
            }
          }
        }
        
        return { data: allPriorityResults, error: null };
      })(),
      
      // ステップ2: 先頭一致の検索
      (async () => {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, prefecture, slug, status')
          .eq('is_public', true)
          .eq('status', 'active')
          .ilike('name', `${normalizedQuery}%`) // 先頭一致
          .order('name', { ascending: true })
          .limit(maxResults);
        
        return { data: data || [], error };
      })(),
      
      // ステップ3: 部分一致の検索（後で必要に応じて使用）
      (async () => {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, prefecture, slug, status')
          .eq('is_public', true)
          .eq('status', 'active')
          .ilike('name', `%${normalizedQuery}%`) // 部分一致
          .order('name', { ascending: true })
          .limit(maxResults);
        
        return { data: data || [], error };
      })(),
    ]);
    
    // 優先校を追加
    if (priorityResults.data && priorityResults.data.length > 0) {
      for (const school of priorityResults.data) {
        if (!allSchoolIds.has(school.id)) {
          prioritySchools.push(school);
          allSchoolIds.add(school.id);
        }
      }
    }
    
    // 先頭一致の結果を処理
    if (prefixResults.data && prefixResults.data.length > 0) {
      // 先頭一致の結果から、優先校（N高、S高）を抽出して優先校リストに追加
      if (isNSearch || isSSearch) {
        const priorityPattern = isNSearch ? 'N高' : 'S高';
        const priorityPatternFull = isNSearch ? 'N高等学校' : 'S高等学校';
        
        for (const school of prefixResults.data) {
          // 優先校パターンにマッチする場合は優先校リストに追加
          if ((school.name.includes(priorityPattern) || school.name.includes(priorityPatternFull)) && !allSchoolIds.has(school.id)) {
            prioritySchools.push(school);
            allSchoolIds.add(school.id);
          }
        }
      }
      
      // 先頭一致の結果を追加（優先校は除外）
      for (const school of prefixResults.data) {
        if (!allSchoolIds.has(school.id)) {
          prefixMatchSchools.push(school);
          allSchoolIds.add(school.id);
        }
      }
    }
    
    // 部分一致の検索（10件に満たない場合のみ）
    const currentTotal = prioritySchools.length + prefixMatchSchools.length;
    if (currentTotal < maxResults && partialResults.data && partialResults.data.length > 0) {
      const remainingCount = maxResults - currentTotal;
      
      for (const school of partialResults.data) {
        if (partialMatchSchools.length >= remainingCount) break;
        if (!allSchoolIds.has(school.id)) {
          partialMatchSchools.push(school);
          allSchoolIds.add(school.id);
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

    return NextResponse.json({ suggestions }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

