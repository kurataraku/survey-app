# Epic2: APIルートのデバッグ方法

## 問題

SQLを実行してslugを設定したが、まだ404エラーが発生する。

## デバッグ手順

### Step 1: APIルートが正しく動作しているか確認

ブラウザの開発者ツールの「Network」タブで、以下のリクエストの詳細を確認してください：

1. 404エラーになっているリクエストをクリック
2. 「Preview」または「Response」タブを開く
3. エラーメッセージの内容を確認

### Step 2: 直接APIを呼び出して確認

ブラウザのアドレスバーまたはコンソールで、以下のURLに直接アクセスしてみてください：

```
http://localhost:3000/api/schools/[slug]
```

`[slug]`の部分を、実際の学校のslugに置き換えてください。

例：
```
http://localhost:3000/api/schools/g高校
```

### Step 3: ターミナルでサーバーログを確認

開発サーバーが起動しているターミナルで、エラーメッセージが表示されていないか確認してください。

### Step 4: Supabaseで直接確認

SupabaseのSQL Editorで、以下のクエリを実行して、slugが正しく設定されているか確認：

```sql
-- 特定のslugで学校を検索
SELECT id, name, slug 
FROM schools 
WHERE slug = 'g高校';  -- 実際のslugに置き換える
```

このクエリで結果が返ってこない場合、slugが正しく設定されていない可能性があります。

## よくある問題

### 問題1: URLエンコーディングの問題

slugに日本語が含まれている場合、URLエンコーディングが必要です。コードを修正して、`decodeURIComponent`を使用するようにしました。

**解決方法**: 開発サーバーを再起動してください。

### 問題2: slugの大文字小文字の違い

PostgreSQLはデフォルトで大文字小文字を区別します。`LOWER()`関数を使用してslugを小文字に変換する必要があります。

**確認方法**: Supabaseで以下のクエリを実行：

```sql
SELECT id, name, slug, LOWER(slug) as slug_lower
FROM schools 
LIMIT 10;
```

### 問題3: ブラウザのキャッシュ

ブラウザが古いデータをキャッシュしている可能性があります。

**解決方法**:
1. ブラウザのキャッシュをクリア（Ctrl + Shift + Delete）
2. 開発サーバーを再起動
3. ページを完全にリロード（Ctrl + F5）
















