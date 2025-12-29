# Epic1 データ確認 ステップバイステップガイド

このガイドでは、3つの確認項目を具体的にどのように確認するかを、画面を見ながら説明します。

---

## 確認項目1: survey_responsesテーブルに新しいカラムが追加されている

### 確認方法: Table Editorでカラムを確認

#### Step 1: survey_responsesテーブルを開く

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**Table Editor**」をクリック
3. テーブル一覧から「**survey_responses**」をクリック

#### Step 2: カラムを確認

テーブルを開くと、上部にカラム名が表示されます。右にスクロールして、以下のカラムが存在することを確認してください：

**Epic1で追加されたカラム（新しいカラム）:**
- `school_id` - 学校ID（UUID形式）
- `enrollment_year` - 入学年（数値）
- `attendance_frequency` - 通学頻度（テキスト）
- `reason_for_choosing` - 通信制を選んだ理由（配列）
- `staff_rating` - 先生・職員の対応評価（数値）
- `atmosphere_fit_rating` - 在校生の雰囲気評価（数値）
- `credit_rating` - 単位取得のしやすさ評価（数値）
- `tuition_rating` - 学費の納得感評価（数値）
- `is_public` - 公開フラグ（真偽値）

**既存のカラム（元々あったカラム）:**
- `id`
- `school_name`
- `respondent_role`
- `status`
- `overall_satisfaction`
- `good_comment`
- `bad_comment`
- `answers`
- `email`
- `created_at`

#### ✅ 確認ポイント

- 新しいカラム（`school_id`, `enrollment_year`など）が**カラム一覧に表示されている**ことを確認
- これらが存在すれば、カラムが正しく追加されています

---

## 確認項目2: survey_responses.school_idが正しく設定されている

### 確認方法: Table Editorで実際のデータを確認

#### Step 1: survey_responsesテーブルを開く

1. 「**Table Editor**」→「**survey_responses**」を開く（上記と同じ）

#### Step 2: 最新のレコードを確認

1. テーブルの**最上部**（最新のデータ）を確認
2. 右にスクロールして「**school_id**」カラムを探す

#### Step 3: school_idの値を確認

`school_id`カラムに以下のような値が表示されていることを確認：

```
例: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**UUID形式の文字列**（ハイフンで区切られた長い文字列）が表示されていればOKです。

#### ❌ 問題がある場合

以下の場合は問題です：

- `school_id`カラムが表示されない → カラムが追加されていない
- `school_id`の値が`null`または空白 → データが正しく保存されていない
- `school_id`にエラーメッセージが表示される → データ形式が正しくない

#### ✅ 確認ポイント

- `school_id`カラムに**UUID形式の値**（例: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`）が表示されている
- 値が`null`や空白でない

---

## 確認項目3: school_idとschools.idが正しく関連付けられている

### 確認方法: SQL EditorでJOINクエリを実行

この確認では、`survey_responses.school_id`と`schools.id`が正しく関連付けられているかを、SQLクエリで確認します。

#### Step 1: SQL Editorを開く

1. 左側のメニューから「**SQL Editor**」をクリック
2. 「**New query**」ボタンをクリック

#### Step 2: SQLクエリを入力

以下のSQLをコピーして、SQL Editorに貼り付けます：

```sql
-- 口コミデータと学校データを結合して確認
SELECT 
  sr.id AS review_id,
  sr.school_name,
  sr.school_id,
  s.id AS school_table_id,
  s.name AS school_table_name,
  s.prefecture
FROM survey_responses sr
LEFT JOIN schools s ON sr.school_id = s.id
ORDER BY sr.created_at DESC
LIMIT 10;
```

#### Step 3: クエリを実行

1. 「**RUN**」ボタンをクリック（または `Ctrl + Enter`）
2. 結果が表示されるまで待つ

#### Step 4: 結果を確認

実行結果の表で、以下の列を確認してください：

| 列名 | 説明 | 確認ポイント |
|------|------|------------|
| `review_id` | 口コミのID | - |
| `school_name` | 口コミの学校名 | - |
| `school_id` | 口コミのschool_id（UUID） | 値が表示されている |
| `school_table_id` | schoolsテーブルのID（UUID） | 値が表示されている |
| `school_table_name` | schoolsテーブルの学校名 | 値が表示されている |
| `prefecture` | 都道府県 | 値が表示されている |

#### ✅ 正常な状態

以下の条件をすべて満たしていれば、正しく関連付けられています：

1. **`school_id`と`school_table_id`が一致している**
   - 例: `school_id` = `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - 例: `school_table_id` = `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - この2つが**完全に同じ値**であることを確認

2. **`school_name`と`school_table_name`が一致している**
   - 例: `school_name` = `テスト通信制高校`
   - 例: `school_table_name` = `テスト通信制高校`
   - この2つが**完全に同じ値**であることを確認

3. **`prefecture`に値が表示されている**
   - 例: `prefecture` = `東京都`
   - 値が表示されていれば、schoolsテーブルから正しくデータを取得できています

#### ❌ 問題がある場合

以下の場合は問題です：

- `school_table_id`が`null` → `school_id`に対応する学校が`schools`テーブルに存在しない
- `school_name`と`school_table_name`が異なる → 学校名が一致していない（大文字小文字、スペースなど）
- `school_id`と`school_table_id`が異なる → 関連付けが正しくない

---

## 実際の確認例

### 例1: 正常な状態

SQLクエリの実行結果：

| review_id | school_name | school_id | school_table_id | school_table_name | prefecture |
|-----------|-------------|-----------|-----------------|-------------------|------------|
| abc-123 | テスト通信制高校 | def-456 | def-456 | テスト通信制高校 | 東京都 |

この場合：
- ✅ `school_id`（`def-456`）と`school_table_id`（`def-456`）が一致
- ✅ `school_name`（`テスト通信制高校`）と`school_table_name`（`テスト通信制高校`）が一致
- ✅ `prefecture`（`東京都`）に値が表示されている

→ **正常に関連付けられています**

### 例2: 問題がある状態

SQLクエリの実行結果：

| review_id | school_name | school_id | school_table_id | school_table_name | prefecture |
|-----------|-------------|-----------|-----------------|-------------------|------------|
| abc-123 | テスト通信制高校 | def-456 | (null) | (null) | (null) |

この場合：
- ❌ `school_table_id`が`null` → `school_id`（`def-456`）に対応する学校が`schools`テーブルに存在しない
- ❌ `school_table_name`が`null` → 関連付けが失敗している

→ **問題があります。`schools`テーブルを確認してください**

---

## 3つの確認項目のチェックリスト

実際に確認した結果をチェックしてください：

### 確認項目1: 新しいカラムが追加されている

- [ ] `survey_responses`テーブルを開いた
- [ ] カラム一覧に`school_id`が表示されている
- [ ] カラム一覧に`enrollment_year`が表示されている
- [ ] カラム一覧に`attendance_frequency`が表示されている
- [ ] カラム一覧に`staff_rating`が表示されている
- [ ] カラム一覧に`is_public`が表示されている
- [ ] 他の新しいカラムも表示されている

→ **すべてチェックがつけば、新しいカラムが正しく追加されています**

### 確認項目2: school_idが正しく設定されている

- [ ] `survey_responses`テーブルの最新レコードを確認した
- [ ] `school_id`カラムにUUID形式の値が表示されている（例: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`）
- [ ] `school_id`が`null`や空白でない

→ **すべてチェックがつけば、school_idが正しく設定されています**

### 確認項目3: school_idとschools.idが正しく関連付けられている

- [ ] SQL EditorでJOINクエリを実行した
- [ ] `school_id`と`school_table_id`が一致している
- [ ] `school_name`と`school_table_name`が一致している
- [ ] `prefecture`に値が表示されている

→ **すべてチェックがつけば、正しく関連付けられています**

---

## トラブルシューティング

### 問題1: 新しいカラムが表示されない

**原因**: SQLファイル（`epic1-02-survey-responses-alter.sql`）が実行されていない可能性があります。

**解決方法**:
1. Supabaseダッシュボードで「SQL Editor」を開く
2. `supabase-schema-epic1-survey-responses-alter.sql`の内容をコピー
3. SQL Editorに貼り付けて実行

### 問題2: school_idがnullのまま

**原因**: `app/api/submit/route.ts`のコードが正しく動作していない可能性があります。

**確認事項**:
1. 開発サーバーのターミナルにエラーメッセージが表示されていないか確認
2. ブラウザの開発者ツール（F12）でエラーを確認
3. `.env.local`ファイルに`SUPABASE_SERVICE_ROLE_KEY`が正しく設定されているか確認

**解決方法**:
- 開発サーバーを再起動（`Ctrl + C` → `npm run dev`）
- 新しいアンケート投稿を試す

### 問題3: school_idとschool_table_idが一致しない

**原因**: `schools`テーブルに該当する学校が存在しない可能性があります。

**確認事項**:
1. `schools`テーブルにデータが存在するか確認
2. `school_name`が完全に一致しているか確認（大文字小文字、スペースなど）

**解決方法**:
- `schools`テーブルに該当する学校を手動で追加する
- または、SQLで`school_id`を更新する

---

## 確認完了後の次のステップ

すべての確認項目が完了したら：

1. ✅ Epic1の実装は正しく動作しています
2. ✅ Epic2（Media MVP）の実装に進む準備が整いました

確認中に問題が見つかった場合は、上記のトラブルシューティングを参照するか、エラーメッセージを教えてください。



