# 公開前チェックリスト

## 1. 環境変数

### ✅ 確認済み
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` は適切に設定されている
- `SUPABASE_SERVICE_ROLE_KEY` は全てAPIルート（サーバーサイド）でのみ使用されている
- クライアントサイド（'use client'コンポーネント）では使用されていない

### ⚠️ 要確認
- **Production/Preview/Developmentで接続先DBが混ざらない設計になっているか**
  - 現在、環境変数で制御されているが、明示的な環境チェックがない
  - 推奨: 環境変数に `NODE_ENV` や `VERCEL_ENV` を確認するロジックを追加

### 🔧 修正PR案
```typescript
// lib/env-check.ts (新規作成)
export function getSupabaseConfig() {
  const env = process.env.NODE_ENV || process.env.VERCEL_ENV || 'development';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }

  // 本番環境では、開発用のURLが設定されていないかチェック
  if (env === 'production') {
    if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
      throw new Error('本番環境で開発用のSupabase URLが設定されています');
    }
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceKey: supabaseServiceKey,
    env,
  };
}
```

## 2. DB/RLS

### ⚠️ 問題点
1. **RLSポリシーが一部のテーブルのみに設定されている**
   - `contact_settings` と `contact_messages` にはRLSが設定されている
   - `schools`, `survey_responses`, `articles` などの主要テーブルにRLSが設定されていない可能性

2. **管理画面の認証チェックが不足**
   - 管理画面のAPIルートで認証チェックが実装されていない
   - 誰でも管理画面にアクセスできる可能性

### 🔧 修正PR案

#### 2-1. RLSポリシーの追加
```sql
-- supabase-migrations/add-rls-policies.sql (新規作成)

-- schoolsテーブルのRLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 公開側: activeな学校のみSELECT可能
CREATE POLICY "公開側はactiveな学校のみ参照可能"
  ON schools
  FOR SELECT
  USING (status = 'active' AND is_public = true);

-- 管理者: 全操作可能（service_roleキーはRLSをバイパスするため、ここではauthenticatedロールを想定）
CREATE POLICY "管理者はschoolsを全操作可能"
  ON schools
  FOR ALL
  USING (auth.role() = 'authenticated');

-- survey_responsesテーブルのRLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- 公開側: is_public=trueの口コミのみSELECT可能
CREATE POLICY "公開側は公開された口コミのみ参照可能"
  ON survey_responses
  FOR SELECT
  USING (is_public = true);

-- 公開側: INSERT可能（アンケート送信）
CREATE POLICY "公開側はsurvey_responsesにINSERT可能"
  ON survey_responses
  FOR INSERT
  WITH CHECK (true);

-- 管理者: 全操作可能
CREATE POLICY "管理者はsurvey_responsesを全操作可能"
  ON survey_responses
  FOR ALL
  USING (auth.role() = 'authenticated');

-- articlesテーブルのRLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 公開側: is_published=trueの記事のみSELECT可能
CREATE POLICY "公開側は公開された記事のみ参照可能"
  ON articles
  FOR SELECT
  USING (is_published = true);

-- 管理者: 全操作可能
CREATE POLICY "管理者はarticlesを全操作可能"
  ON articles
  FOR ALL
  USING (auth.role() = 'authenticated');
```

#### 2-2. 管理画面の認証チェック
```typescript
// lib/auth-check.ts (新規作成)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function checkAdminAuth(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase環境変数が設定されていません' },
      { status: 500 }
    );
  }

  // セッションを確認
  const authHeader = request.headers.get('authorization');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者ロールのチェック（必要に応じて）
    // const { data: profile } = await supabase
    //   .from('user_profiles')
    //   .select('role')
    //   .eq('id', user.id)
    //   .single();
    // 
    // if (profile?.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: '管理者権限が必要です' },
    //     { status: 403 }
    //   );
    // }

    return { user, supabase };
  }

  // Cookieからセッションを確認
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  return { user: session.user, supabase };
}

// 使用例: app/api/admin/schools/route.ts
export async function GET(request: NextRequest) {
  const authResult = await checkAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult; // エラーレスポンス
  }
  
  const { supabase } = authResult;
  // 以降の処理...
}
```

## 3. データ

### ⚠️ 問題点
1. **ダミーデータ削除後の集計処理**
   - 平均点や口コミ数の再計算処理が存在しない
   - ダミーデータ削除後に統計が不正確になる可能性

2. **キャッシュの再計算処理**
   - 集計データのキャッシュが存在する場合、再計算処理が必要

### 🔧 修正PR案

#### 3-1. 集計データの再計算スクリプト
```typescript
// scripts/recalculate-aggregates.ts (新規作成)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function recalculateAggregates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('環境変数が設定されていません');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('集計データの再計算を開始...');

  // 1. 学校ごとの口コミ数と平均評価を再計算
  const { data: schools } = await supabase
    .from('schools')
    .select('id');

  if (!schools) {
    console.log('学校が見つかりませんでした');
    return;
  }

  for (const school of schools) {
    // 口コミ数と平均評価を計算
    const { data: reviews } = await supabase
      .from('survey_responses')
      .select('overall_satisfaction')
      .eq('school_id', school.id)
      .eq('is_public', true)
      .not('overall_satisfaction', 'is', null)
      .gte('overall_satisfaction', 1)
      .lte('overall_satisfaction', 5);

    const reviewCount = reviews?.length || 0;
    const avgRating = reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) / reviews.length
      : null;

    // 学校テーブルを更新（review_count, overall_avgカラムが存在する場合）
    await supabase
      .from('schools')
      .update({
        review_count: reviewCount,
        overall_avg: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
      })
      .eq('id', school.id);

    console.log(`学校 ${school.id}: 口コミ数=${reviewCount}, 平均評価=${avgRating?.toFixed(2) || 'N/A'}`);
  }

  console.log('集計データの再計算が完了しました');
}

recalculateAggregates().catch(console.error);
```

#### 3-2. package.jsonにスクリプトを追加
```json
{
  "scripts": {
    "recalculate-aggregates": "tsx scripts/recalculate-aggregates.ts"
  }
}
```

## 4. SEO最低限

### ✅ 確認済み
- `sitemap.xml` と `robots.txt` が実装されている
- 各ページにメタ情報（title, description, OGP）が設定されている

### ⚠️ 問題点
1. **学校ページのslugがユニーク制約されていない**
   - `name_normalized`にはユニーク制約があるが、`slug`にはユニーク制約がない
   - 同じslugの学校が複数存在する可能性

2. **NEXT_PUBLIC_SITE_URLが設定されていない**
   - `sitemap.ts`と`robots.ts`で`NEXT_PUBLIC_SITE_URL`を使用しているが、デフォルト値が`https://example.com`
   - 本番環境で正しいURLが設定されていない可能性

### 🔧 修正PR案

#### 4-1. slugのユニーク制約追加
```sql
-- supabase-migrations/add-slug-unique-constraint.sql (新規作成)

-- slugのユニーク制約を追加（NULLを許可するため、部分インデックスを使用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug_unique 
ON schools(slug) 
WHERE slug IS NOT NULL;

-- 既存データで重複するslugがある場合は修正が必要
-- 重複チェッククエリ:
-- SELECT slug, COUNT(*) 
-- FROM schools 
-- WHERE slug IS NOT NULL 
-- GROUP BY slug 
-- HAVING COUNT(*) > 1;
```

#### 4-2. 環境変数の確認とドキュメント
```typescript
// app/sitemap.ts の修正
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  if (!baseUrl || baseUrl === 'https://example.com') {
    console.warn('NEXT_PUBLIC_SITE_URLが設定されていません。本番環境では必ず設定してください。');
  }
  
  // ...
}
```

```markdown
# .env.local.example (新規作成)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## 実装済みファイル

### ✅ 作成済み
1. **`supabase-migrations/add-rls-policies.sql`** - RLSポリシーの追加
2. **`supabase-migrations/add-slug-unique-constraint.sql`** - slugのユニーク制約
3. **`lib/env-check.ts`** - 環境変数のチェックと取得
4. **`scripts/recalculate-aggregates.ts`** - 集計データの再計算スクリプト
5. **`package.json`** - `recalculate-aggregates`スクリプトを追加

### ⚠️ 要実装
1. **管理画面の認証チェック** - `lib/auth-check.ts`の実装と各管理APIへの適用が必要

## 実行手順

### 1. RLSポリシーの適用
```bash
# SupabaseのSQL Editorで実行
# supabase-migrations/add-rls-policies.sql
```

### 2. slugのユニーク制約の適用
```bash
# SupabaseのSQL Editorで実行
# supabase-migrations/add-slug-unique-constraint.sql
# 重複チェッククエリを実行して確認
```

### 3. 環境変数の設定確認
```bash
# .env.localに以下を設定（本番環境では必須）
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### 4. 集計データの再計算（ダミーデータ削除後）
```bash
npm run recalculate-aggregates
```

## まとめ

### 優先度: 高（実装済み）
1. ✅ **RLSポリシーの追加** - `supabase-migrations/add-rls-policies.sql`
2. ⚠️ **管理画面の認証チェック** - 要実装（`lib/auth-check.ts`の適用が必要）
3. ✅ **slugのユニーク制約** - `supabase-migrations/add-slug-unique-constraint.sql`

### 優先度: 中（実装済み）
4. ✅ **環境変数の明示的なチェック** - `lib/env-check.ts`
5. ✅ **NEXT_PUBLIC_SITE_URLの設定確認** - `lib/env-check.ts`と`app/layout.tsx`

### 優先度: 低（実装済み）
6. ✅ **集計データの再計算スクリプト** - `scripts/recalculate-aggregates.ts`
