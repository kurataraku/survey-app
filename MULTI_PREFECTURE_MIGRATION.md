# 複数都道府県対応のマイグレーション手順

## 概要
通信制高校が複数の都道府県にキャンパスを設置している場合に対応するため、以下の変更を行いました：

1. 口コミ回答データで`campus_prefecture`を配列として扱えるように変更
2. 学校テーブルに`prefectures`配列カラムを追加
3. フロントエンドで複数の都道府県を表示できるように修正
4. 口コミ送信時に学校の`prefectures`配列を自動更新
5. 管理画面で複数の都道府県を管理できるように修正

## データベースマイグレーション

### ステップ1: Supabase SQL Editorでマイグレーションを実行

1. [Supabaseダッシュボード](https://app.supabase.com/)にログイン
2. プロジェクトを選択
3. 左側のメニューから「**SQL Editor**」をクリック
4. 「**New query**」をクリック
5. 以下のSQLを実行：

```sql
-- 1. schoolsテーブルにprefectures配列カラムを追加
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS prefectures TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. 既存のprefectureデータをprefectures配列に移行
UPDATE schools 
SET prefectures = ARRAY[prefecture]::TEXT[]
WHERE prefectures IS NULL OR array_length(prefectures, 1) IS NULL;

-- 3. prefectures配列のインデックスを作成（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_schools_prefectures ON schools USING GIN (prefectures);

-- 4. answer_schemaテーブルでcampus_prefectureを配列型に更新
UPDATE answer_schema 
SET type = 'string[]', 
    description = '主に通っていたキャンパス都道府県（複数選択可）'
WHERE key = 'campus_prefecture';
```

### ステップ2: マイグレーション結果の確認

```sql
-- schoolsテーブルの構造を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'schools' 
  AND column_name IN ('prefecture', 'prefectures');

-- 既存データの確認
SELECT id, name, prefecture, prefectures 
FROM schools 
LIMIT 10;

-- answer_schemaの確認
SELECT key, type, description 
FROM answer_schema 
WHERE key = 'campus_prefecture';
```

## 変更内容

### 1. データベーススキーマ
- `schools`テーブルに`prefectures TEXT[]`カラムを追加
- `answer_schema`テーブルで`campus_prefecture`の型を`string[]`に変更

### 2. フロントエンド
- `lib/schema.ts`: `campus_prefecture`を配列型に変更
- `lib/questions.ts`: `campus_prefecture`を`multiSelect`タイプに変更
- `components/ReviewCard.tsx`: 複数の都道府県を表示できるように修正
- `components/SchoolCard.tsx`: 複数の都道府県を表示できるように修正
- `components/SchoolSummary.tsx`: 複数の都道府県を表示できるように修正
- `components/SchoolEditor.tsx`: 複数の都道府県を選択できるUIを追加

### 3. APIエンドポイント
- `app/api/submit/route.ts`: 口コミ送信時に学校の`prefectures`配列を更新
- `app/api/home/route.ts`: `campus_prefecture`を配列として取得・返却
- `app/api/admin/schools/route.ts`: `prefectures`配列を保存・更新
- `app/api/admin/schools/[id]/route.ts`: `prefectures`配列を保存・更新
- `app/api/schools/[slug]/route.ts`: `prefectures`配列を返却

### 4. 型定義
- `lib/types/schools.ts`: `School`と`SchoolFormData`に`prefectures?: string[]`を追加
- `app/page.tsx`: `campus_prefecture`を配列型に変更

## 使用方法

### 口コミ投稿時
1. アンケートフォームで「主に通っていたキャンパス都道府県」を複数選択
2. 送信すると、選択された都道府県が配列として保存されます
3. 学校の`prefectures`配列が自動的に更新されます

### 管理画面での学校編集
1. 管理画面で学校を編集
2. 「都道府県（メイン）」でメインの都道府県を選択
3. 「都道府県（複数選択可）」でチェックボックスから複数の都道府県を選択
4. 保存すると、`prefectures`配列が更新されます

## 注意事項

- 既存の`prefecture`カラムは後方互換性のため保持されています
- `prefectures`配列が空の場合は、`prefecture`の値が使用されます
- 口コミ回答で複数の都道府県を選択した場合、学校の`prefectures`配列に自動的に追加されます








