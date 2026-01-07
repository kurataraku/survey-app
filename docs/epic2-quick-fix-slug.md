# Epic2: ページ遷移が機能しない場合のクイック修正

## 問題

学校検索ページから学校をクリックしてもページ遷移しない。

## 最も確実な解決方法

データベースの`schools`テーブルに`slug`を設定するSQLを実行してください。

### Step 1: SQLを実行

1. Supabaseダッシュボードにログイン
2. 「SQL Editor」を開く
3. 「New query」をクリック
4. 以下のSQLをコピー＆ペーストして実行：

```sql
-- slugがnullまたは空の学校に対して、nameからslugを生成
UPDATE schools
SET slug = LOWER(
  TRIM(BOTH '-' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', '-', 'g'),
      '-+', '-', 'g'
    )
  )
)
WHERE slug IS NULL OR slug = '';

-- 空文字列になった場合は'unknown-' + idを使用
UPDATE schools
SET slug = 'unknown-' || id::text
WHERE slug IS NULL OR slug = '' OR LENGTH(slug) = 0;
```

5. 「RUN」ボタンをクリック

### Step 2: 実行結果を確認

以下のクエリで、slugが正しく設定されたことを確認：

```sql
SELECT id, name, slug FROM schools LIMIT 10;
```

すべてのレコードに`slug`が設定されていることを確認してください。

### Step 3: ブラウザで確認

1. ブラウザのページを**完全にリロード**（Ctrl + F5 または Cmd + Shift + R）
2. 学校検索ページから学校をクリック
3. ページ遷移が正常に動作することを確認

## それでも動作しない場合

### 確認項目

1. **開発サーバーを再起動**
   - ターミナルで `Ctrl + C` を押して停止
   - `npm run dev` で再起動

2. **ブラウザのコンソールでエラーを確認**
   - F12キーで開発者ツールを開く
   - 「Console」タブでエラーメッセージを確認

3. **ネットワークタブでリクエストを確認**
   - 開発者ツールの「Network」タブを開く
   - 学校カードをクリック
   - `/api/schools/`へのリクエストのステータスコードを確認

## トラブルシューティング

### エラー: "relation 'schools' does not exist"

→ `schools`テーブルが存在しません。Epic1のSQLファイルを実行してください。

### エラー: "column 'slug' does not exist"

→ `slug`カラムが存在しません。Epic1のSQLファイル（`supabase-schema-epic1-survey-responses-alter.sql`）を実行してください。

### すべての学校にslugが設定されたが、まだ404エラー

→ ブラウザのキャッシュをクリアして、ページをリロードしてください。














