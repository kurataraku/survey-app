# Epic1 動作確認ガイド

Epic1の実装が正しく動作していることを確認するためのガイドです。

## 確認項目

1. 新規投稿のテスト（アンケートフォームから投稿）
2. データが正しく保存されているかの確認

---

## Step 1: 新規投稿のテスト

### 1.1 アンケートフォームにアクセス

1. 開発サーバーが起動していることを確認
   ```bash
   npm run dev
   ```
2. ブラウザで以下のURLにアクセス
   ```
   http://localhost:3000/survey
   ```

### 1.2 新しい口コミを投稿

以下の条件でテスト投稿を行ってください：

#### テストケース1: 既存の学校名で投稿

1. 学校名: 既にSupabaseに存在する学校名を入力
   - 例: 既存の`schools`テーブルにある学校名を使用
2. その他の必須項目を入力して送信

#### テストケース2: 新しい学校名で投稿（推奨）

1. 学校名: これまでに存在しない新しい学校名を入力
   - 例: "テスト通信制高校" など
2. その他の必須項目を入力して送信
3. 特に以下を確認:
   - 都道府県（`campus_prefecture`）を選択
   - 入学年（`enrollment_year`）を入力
   - 通学頻度（`attendance_frequency`）を選択
   - 通信制を選んだ理由（`reason_for_choosing`）を選択
   - 評価項目（`staff_rating`, `atmosphere_fit_rating`, `credit_rating`, `tuition_rating`）を選択

### 1.3 投稿成功の確認

投稿後、以下のメッセージが表示されれば成功です：
- "回答ありがとうございました！"

---

## Step 2: Supabaseでデータを確認

Supabaseダッシュボードで以下の確認を行います。

### 2.1 schoolsテーブルの確認

#### 確認項目

1. **新しい学校が作成されているか**
   - Supabaseダッシュボード → 「Table Editor」 → `schools`テーブルを開く
   - 新しく投稿した学校名が存在することを確認

2. **学校情報が正しく保存されているか**
   - `name`: 学校名が正しく保存されている
   - `prefecture`: 都道府県が正しく設定されている（`campus_prefecture`から取得）
   - `slug`: URL用のスラッグが自動生成されている（小文字、ハイフン区切り）
   - `is_public`: `true`になっている

#### 確認用SQL

```sql
-- 最新の学校を確認
SELECT * FROM schools 
ORDER BY created_at DESC 
LIMIT 5;
```

### 2.2 survey_responsesテーブルの確認

#### 確認項目

1. **新しい口コミが保存されているか**
   - Supabaseダッシュボード → 「Table Editor」 → `survey_responses`テーブルを開く
   - 最新のレコード（`created_at`が最も新しいもの）を確認

2. **school_idが正しく設定されているか**
   - `school_id`カラムに値（UUID）が設定されている
   - このUUIDが`schools`テーブルの`id`と一致する

3. **検索用カラムが正しく設定されているか**
   以下のカラムに値が設定されていることを確認：
   - `enrollment_year`: 入学年（INTEGER）
   - `attendance_frequency`: 通学頻度（TEXT）
   - `reason_for_choosing`: 通信制を選んだ理由（TEXT[]、配列）
   - `staff_rating`: 先生・職員の対応評価（INTEGER、1-5）
   - `atmosphere_fit_rating`: 在校生の雰囲気評価（INTEGER、1-5）
   - `credit_rating`: 単位取得のしやすさ評価（INTEGER、1-5）
   - `tuition_rating`: 学費の納得感評価（INTEGER、1-5）
   - `is_public`: `true`になっている

4. **answers JSONBにも値が保存されているか**
   - `answers`カラムをクリックして、JSON形式で値が表示されることを確認
   - 検索用カラムと同じ値が`answers` JSONBにも保存されている（二重保存）

#### 確認用SQL

```sql
-- 最新の口コミを確認（全てのカラム）
SELECT 
  id,
  created_at,
  school_name,
  school_id,
  enrollment_year,
  attendance_frequency,
  reason_for_choosing,
  staff_rating,
  atmosphere_fit_rating,
  credit_rating,
  tuition_rating,
  overall_satisfaction,
  is_public,
  answers
FROM survey_responses 
ORDER BY created_at DESC 
LIMIT 1;
```

### 2.3 関連性の確認

#### 確認項目

`school_id`が正しく`schools`テーブルと関連付けられているか

#### 確認用SQL

```sql
-- 最新の口コミと学校情報を結合して確認
SELECT 
  sr.id AS review_id,
  sr.created_at,
  sr.school_name,
  sr.school_id,
  s.id AS school_table_id,
  s.name AS school_table_name,
  s.prefecture,
  s.slug,
  sr.enrollment_year,
  sr.attendance_frequency,
  sr.staff_rating,
  sr.is_public
FROM survey_responses sr
LEFT JOIN schools s ON sr.school_id = s.id
ORDER BY sr.created_at DESC
LIMIT 1;
```

このクエリで、`school_id`と`school_table_id`が一致し、`school_name`と`school_table_name`が一致することを確認してください。

---

## Step 3: エラーがないか確認

### 3.1 ブラウザのコンソールを確認

1. ブラウザでF12キーを押して開発者ツールを開く
2. 「Console」タブを開く
3. エラーメッセージがないか確認

### 3.2 サーバーのログを確認

ターミナル（開発サーバーが起動しているウィンドウ）で、エラーメッセージがないか確認してください。

---

## 期待される動作

### ✅ 正常な動作

1. **既存の学校名で投稿した場合**
   - 新しい`schools`レコードは作成されない
   - 既存の`school_id`が使用される
   - `survey_responses`に新しいレコードが作成される

2. **新しい学校名で投稿した場合**
   - `schools`テーブルに新しいレコードが作成される
   - `school_id`が正しく設定される
   - `slug`が自動生成される
   - `survey_responses`に新しいレコードが作成される

3. **データの保存**
   - 検索用カラムに値が設定される
   - `answers` JSONBにも値が保存される（二重保存）
   - `is_public`が`true`に設定される

### ❌ 異常な動作

以下の場合は問題があります：

1. `school_id`が`NULL`のまま
2. 検索用カラムに値が設定されていない
3. `answers` JSONBが空のまま
4. エラーメッセージが表示される

---

## トラブルシューティング

### エラー: "relation 'schools' does not exist"

→ `epic1-01-schools.sql`が実行されていない可能性があります。実行してください。

### エラー: "column 'school_id' does not exist"

→ `epic1-02-survey-responses-alter.sql`が実行されていない可能性があります。実行してください。

### school_idがNULLのまま

→ `app/api/submit/route.ts`のコードが正しく更新されていない可能性があります。確認してください。

### 検索用カラムに値が設定されていない

→ `app/api/submit/route.ts`のコードを確認してください。特に、検索用カラムへの値の設定部分を確認してください。

---

## 確認完了後の次のステップ

全ての確認が完了したら：

1. Epic1の実装は完了です
2. Epic2（Media MVP）の実装に進む準備が整いました









