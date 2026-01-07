# answers 正規化機能の実装ガイド

## 概要

`survey_responses`テーブルの`answers`（JSONB）カラムのキー名を固定し、将来的な変更に備えた正規化・バリデーション機能を実装しました。

## 実装内容

### 1. answer_schema テーブルの作成

**ファイル**: `supabase-schema-answer-schema.sql`

- `answer_schema`テーブルを作成し、answers JSONBの正規キーを定義
- 各キーの型（string, number, string[], number[], boolean）を定義
- 過去のキー名や別名を`aliases`で管理可能
- 現在使用中のすべてのキーを初期データとして登録

### 2. normalizeAnswers 関数の実装

**ファイル**: `lib/normalizeAnswers.ts`

- 入力されたanswersを正規化する関数
- `answer_schema`テーブルからスキーマを取得
- aliasesを使用して入力キーを正規キーに変換
- スキーマに存在しないキーは破棄
- 型が合わない値は可能な限り安全に変換（例: "4" → 4）
- 空文字や空配列は保存しない
- enum_valuesが定義されている場合、値の検証も実施

### 3. 保存処理の修正

**ファイル**: `app/api/submit/route.ts`

- `normalizeAnswers`関数をインポート
- answersをSupabaseに保存する前に`normalizeAnswers`で正規化
- 正規化後のanswersのみをデータベースに保存

## セットアップ手順

### ステップ1: answer_schema テーブルを作成

1. Supabaseダッシュボードにアクセス
2. 「SQL Editor」を開く
3. 「New query」をクリック
4. `supabase-schema-answer-schema.sql`の内容をコピー＆ペースト
5. 「Run」ボタンをクリックして実行

### ステップ2: 動作確認

以下の手順で正規化機能が正常に動作することを確認してください。

## 動作確認手順

### テスト1: 正常なキーが保存されることを確認

1. アンケートフォームを開く
   - ブラウザで `http://localhost:3000/survey` にアクセス
   
2. フォームに回答を入力して送信

3. SupabaseのTable Editorで確認
   - `survey_responses`テーブルを開く
   - 最新のレコードの`answers`カラムを確認
   - 正規キー（例: `reason_for_choosing`, `enrollment_year`など）が正しく保存されていることを確認

### テスト2: 誤ったキーが保存されないことを確認

このテストでは、一時的にコードを変更して誤ったキーを送信し、それが保存されないことを確認します。

#### テスト手順

1. `app/api/submit/route.ts`の`rawAnswers`オブジェクトに、誤ったキーを一時的に追加：

```typescript
const rawAnswers: Record<string, any> = {
  // ... 既存のキー ...
  
  // テスト用: スキーマに存在しないキー
  invalid_key: 'このキーは保存されない',
  wrong_key_name: 'このキーも保存されない',
};
```

2. 開発サーバーを再起動（必要に応じて）

3. アンケートフォームから回答を送信

4. サーバーのコンソールログを確認
   - 以下のような警告が表示されることを確認：
     ```
     スキーマに存在しないキーを破棄: invalid_key
     スキーマに存在しないキーを破棄: wrong_key_name
     ```

5. SupabaseのTable Editorで確認
   - 最新のレコードの`answers`カラムを確認
   - `invalid_key`や`wrong_key_name`が含まれていないことを確認

6. **テスト後にコードを元に戻す**（一時的に追加したキーを削除）

### テスト3: aliases（別名）による変換を確認

将来、キー名を変更する場合のテストです。

#### テスト手順

1. SupabaseのSQL Editorで、テスト用のaliasを追加：

```sql
-- テスト用: 'enrollment_year' を 'enrollmentYear' としても受け入れる
UPDATE answer_schema 
SET aliases = COALESCE(aliases, ARRAY[]::TEXT[]) || ARRAY['enrollmentYear']
WHERE key = 'enrollment_year';
```

2. `app/api/submit/route.ts`の`rawAnswers`を一時的に変更：

```typescript
const rawAnswers: Record<string, any> = {
  // ... 既存のキー ...
  
  // テスト用: aliasを使用
  enrollmentYear: '2024',  // これは 'enrollment_year' に変換される
};
```

3. アンケートフォームから回答を送信

4. SupabaseのTable Editorで確認
   - 最新のレコードの`answers`カラムを確認
   - `enrollmentYear`ではなく、`enrollment_year`として保存されていることを確認

5. **テスト後にSQLを元に戻す**（追加したaliasを削除）

```sql
-- テスト用aliasを削除
UPDATE answer_schema 
SET aliases = array_remove(COALESCE(aliases, ARRAY[]::TEXT[]), 'enrollmentYear')
WHERE key = 'enrollment_year';
```

### テスト4: 空の値が保存されないことを確認

1. アンケートフォームで、オプショナルな項目を空欄のまま送信

2. SupabaseのTable Editorで確認
   - 最新のレコードの`answers`カラムを確認
   - 空文字列や空配列のキーが含まれていないことを確認

## 変更箇所のまとめ

### 作成されたファイル

1. **`supabase-schema-answer-schema.sql`**
   - `answer_schema`テーブル作成用のSQL
   - 初期データの挿入

2. **`lib/normalizeAnswers.ts`**
   - `normalizeAnswers`関数の実装
   - 型定義（`AnswerSchema`, `NormalizedAnswers`）

3. **`ANSWERS_NORMALIZATION_GUIDE.md`**（このファイル）
   - 実装ガイドと動作確認手順

### 修正されたファイル

1. **`app/api/submit/route.ts`**
   - `normalizeAnswers`関数のインポート追加
   - `answers`の準備部分を`rawAnswers`に変更
   - `normalizeAnswers`を呼び出して正規化処理を追加

## 今後の拡張

### キー名の変更

将来的にキー名を変更する場合：

1. `answer_schema`テーブルで新しいキーを追加
2. 古いキーを`aliases`に追加：

```sql
-- 例: 'enrollment_year' を 'enrollmentYear' に変更する場合
INSERT INTO answer_schema (key, type, required, description) VALUES
  ('enrollmentYear', 'string', false, '入学年（4桁の文字列）')
ON CONFLICT (key) DO NOTHING;

UPDATE answer_schema 
SET aliases = COALESCE(aliases, ARRAY[]::TEXT[]) || ARRAY['enrollment_year']
WHERE key = 'enrollmentYear';
```

3. コードを新しいキー名に更新
4. 古いキーは`aliases`経由で自動的に新しいキーに変換される

### enum_valuesの追加

選択肢を制限したい場合：

```sql
-- 例: enrollment_type にenum値を追加
UPDATE answer_schema 
SET enum_values = ARRAY['新入学（中学卒業後）', '転入学（他校から転校）', '編入学（中退後に入り直し）']
WHERE key = 'enrollment_type';
```

## トラブルシューティング

### answer_schemaテーブルが見つからないエラー

- `supabase-schema-answer-schema.sql`を実行してテーブルを作成してください

### すべてのキーが破棄される

- `answer_schema`テーブルに必要なキーが登録されているか確認してください
- SQL Editorで以下を実行：

```sql
SELECT * FROM answer_schema ORDER BY key;
```

### 正規化処理が遅い

- `answer_schema`テーブルにインデックスが作成されていることを確認
- 必要に応じてキャッシュを検討してください

















