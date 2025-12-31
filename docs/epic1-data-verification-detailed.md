# Epic1 データ確認詳細ガイド

このガイドでは、Epic1の実装が正しく動作していることを確認するために、Supabaseダッシュボードでデータを確認する手順を詳しく説明します。

## 確認の全体像

以下の3つのテーブルを確認します：

1. **schoolsテーブル** - 学校マスタデータ
2. **survey_responsesテーブル** - 口コミデータ
3. **データの関連性** - `school_id`による関連付け

---

## Step 1: Supabaseダッシュボードにアクセス

1. ブラウザで [https://supabase.com](https://supabase.com) にアクセス
2. ログイン（必要に応じて）
3. プロジェクトを選択（`survey-app`など）

---

## Step 2: schoolsテーブルの確認

### 2.1 テーブルにアクセス

1. 左側のメニューから「**Table Editor**」をクリック
2. テーブル一覧から「**schools**」を選択

### 2.2 確認項目

#### ✅ テーブルが存在することを確認

- `schools`テーブルがテーブル一覧に表示されているか確認

#### ✅ カラム構成を確認

以下のカラムが存在することを確認：

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | uuid | 主キー（自動生成） |
| `name` | text | 学校名（ユニーク制約） |
| `prefecture` | text | 都道府県 |
| `slug` | text | URL用スラッグ |
| `intro` | text | 学校紹介文（NULL可） |
| `highlights` | jsonb | 学校の特徴（NULL可） |
| `faq` | jsonb | よくある質問（NULL可） |
| `is_public` | boolean | 公開フラグ |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

#### ✅ データが存在することを確認

1. テーブルにデータ（行）が表示されているか確認
2. 最新のアンケート投稿で使用した学校名が存在するか確認

#### ✅ 新規学校の自動作成を確認

1. アンケートフォームで**新しい学校名**を入力して投稿した場合
2. `schools`テーブルにその学校名が追加されているか確認
3. 以下の項目が正しく設定されているか確認：
   - `name` - 入力した学校名
   - `prefecture` - 選択した都道府県（または「不明」）
   - `slug` - 学校名から自動生成されたスラッグ
   - `is_public` - `true`になっている

---

## Step 3: survey_responsesテーブルの確認

### 3.1 テーブルにアクセス

1. 左側のメニューから「**Table Editor**」をクリック
2. テーブル一覧から「**survey_responses**」を選択

### 3.2 確認項目

#### ✅ 新しいカラムが追加されていることを確認

以下のカラムが存在することを確認：

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `school_id` | uuid | schoolsテーブルへの外部キー（NULL可） |
| `enrollment_year` | integer | 入学年（NULL可） |
| `attendance_frequency` | text | 通学頻度（NULL可） |
| `reason_for_choosing` | text[] | 通信制を選んだ理由（配列、NULL可） |
| `staff_rating` | integer | 先生・職員の対応評価（1-5、NULL可） |
| `atmosphere_fit_rating` | integer | 在校生の雰囲気評価（1-5、NULL可） |
| `credit_rating` | integer | 単位取得のしやすさ評価（1-5、NULL可） |
| `tuition_rating` | integer | 学費の納得感評価（1-6、NULL可） |
| `is_public` | boolean | 公開フラグ |

**注意**: これらのカラムはEpic1で追加されたものです。既存のカラム（`id`, `school_name`, `respondent_role`, `status`, `overall_satisfaction`, `good_comment`, `bad_comment`, `answers`, `email`, `created_at`など）も引き続き存在します。

#### ✅ 最新の投稿データを確認

1. テーブルの最上部（最新のデータ）を確認
2. 最新のアンケート投稿データが存在するか確認

#### ✅ 検索用カラムにデータが保存されていることを確認

最新の投稿データで、以下のカラムに値が入っていることを確認：

- `school_id` - UUID形式の値が入っている（NULLでない）
- `enrollment_year` - 数値（例: `2024`）
- `attendance_frequency` - テキスト（例: `月1回`）
- `reason_for_choosing` - 配列形式（例: `{"心の不調のため","全日制の学習スタイルが合わないため"}`）
- `staff_rating` - 1〜5の数値
- `atmosphere_fit_rating` - 1〜5の数値
- `credit_rating` - 1〜5の数値
- `tuition_rating` - 1〜6の数値
- `is_public` - `true`になっている

**注意**: 一部のカラムはNULLでも問題ありません（任意項目の場合）。

#### ✅ school_idが正しく設定されていることを確認

1. `school_id`カラムに値が入っているか確認
2. 値がUUID形式（例: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`）であることを確認

---

## Step 4: データの関連性確認

### 4.1 school_idとschoolsテーブルの関連を確認

#### 方法1: 目視確認（簡単）

1. `survey_responses`テーブルの1行を選択
2. `school_id`の値をコピー
3. `schools`テーブルに切り替え
4. `id`カラムで検索（検索ボックスに貼り付け）
5. 該当する学校が表示されることを確認
6. `name`カラムの値が、`survey_responses`の`school_name`と一致することを確認

#### 方法2: SQL Editorで確認（推奨）

1. 左側のメニューから「**SQL Editor**」をクリック
2. 「**New query**」をクリック
3. 以下のSQLを入力：

```sql
-- 口コミデータと学校データを結合して確認
SELECT 
  sr.id AS review_id,
  sr.school_name,
  sr.school_id,
  s.name AS school_name_from_schools,
  s.prefecture,
  sr.enrollment_year,
  sr.attendance_frequency,
  sr.staff_rating,
  sr.overall_satisfaction
FROM survey_responses sr
LEFT JOIN schools s ON sr.school_id = s.id
ORDER BY sr.created_at DESC
LIMIT 10;
```

4. 「**RUN**」ボタンをクリック
5. 結果を確認：
   - `school_name`と`school_name_from_schools`が一致していることを確認
   - `school_id`がNULLでないことを確認
   - `prefecture`などのデータが正しく表示されることを確認

---

## Step 5: 既存学校への投稿をテスト（オプション）

### 5.1 テスト手順

1. アンケートフォームを開く（http://localhost:3000/survey）
2. 既に`schools`テーブルに存在する学校名を入力
3. 他の必須項目を入力して送信

### 5.2 確認項目

1. **投稿が成功することを確認**
   - 「回答ありがとうございました！」画面が表示される

2. **schoolsテーブルに新しい学校が作成されていないことを確認**
   - `schools`テーブルの行数が増えていないことを確認

3. **survey_responsesテーブルにデータが保存されることを確認**
   - 新しい口コミデータが追加されていることを確認
   - `school_id`が既存の学校のIDと一致していることを確認

---

## Step 6: 新規学校の自動作成をテスト（オプション）

### 6.1 テスト手順

1. アンケートフォームを開く（http://localhost:3000/survey）
2. **これまでに存在しない新しい学校名**を入力
   - 例: "テスト通信制高校2024"など
3. 都道府県を選択（重要）
4. 他の必須項目を入力して送信

### 6.2 確認項目

1. **投稿が成功することを確認**
   - 「回答ありがとうございました！」画面が表示される

2. **schoolsテーブルに新しい学校が作成されることを確認**
   - `schools`テーブルに新しい行が追加されていることを確認
   - `name`が入力した学校名と一致していることを確認
   - `prefecture`が選択した都道府県と一致していることを確認
   - `slug`が自動生成されていることを確認（例: `テスト通信制高校2024` → `テスト通信制高校2024`）

3. **survey_responsesテーブルにデータが保存されることを確認**
   - 新しい口コミデータが追加されていることを確認
   - `school_id`が新しく作成された学校のIDと一致していることを確認

---

## Step 7: aggregatesテーブルの確認（参考）

### 7.1 テーブルにアクセス

1. 左側のメニューから「**Table Editor**」をクリック
2. テーブル一覧から「**aggregates**」を選択

### 7.2 確認項目

#### ✅ テーブルが存在することを確認

- `aggregates`テーブルがテーブル一覧に表示されているか確認

#### ✅ カラム構成を確認

以下のカラムが存在することを確認：

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `school_id` | uuid | 主キー、schoolsテーブルへの外部キー |
| `review_count` | integer | 口コミ数 |
| `overall_avg` | numeric(3,2) | 総合満足度の平均 |
| `staff_rating_avg` | numeric(3,2) | 先生・職員の対応評価の平均 |
| `atmosphere_fit_rating_avg` | numeric(3,2) | 在校生の雰囲気評価の平均 |
| `credit_rating_avg` | numeric(3,2) | 単位取得のしやすさ評価の平均 |
| `tuition_rating_avg` | numeric(3,2) | 学費の納得感評価の平均 |
| `top_good_review_id` | uuid | 最高評価の良かった点レビューID（NULL可） |
| `top_bad_review_id` | uuid | 最低評価の改善点レビューID（NULL可） |
| `updated_at` | timestamptz | 更新日時 |

**注意**: Epic1では`aggregates`テーブルは作成されましたが、集計データの更新処理はまだ実装されていません（Epic3で実装予定）。そのため、このテーブルにはデータが入っていない可能性があります。これは正常です。

---

## トラブルシューティング

### 問題1: schoolsテーブルに新しい学校が作成されない

**確認事項**:
1. `app/api/submit/route.ts`のコードが正しく実装されているか確認
2. 開発サーバーのターミナルにエラーメッセージが表示されていないか確認
3. `.env.local`ファイルに`SUPABASE_SERVICE_ROLE_KEY`が正しく設定されているか確認

**解決方法**:
- 開発サーバーを再起動（`Ctrl + C` → `npm run dev`）
- ブラウザの開発者ツール（F12）でエラーを確認
- Supabaseダッシュボードの「Logs」でエラーを確認

### 問題2: school_idがNULLになっている

**確認事項**:
1. `school_name`が正しく入力されているか確認
2. `schools`テーブルに該当する学校が存在するか確認（大文字小文字、スペースの有無を確認）

**解決方法**:
- 学校名の入力が正確か確認
- 手動で`school_id`を更新する場合は、以下のSQLを実行：

```sql
-- 例: school_nameからschool_idを更新
UPDATE survey_responses sr
SET school_id = s.id
FROM schools s
WHERE sr.school_name = s.name 
  AND sr.school_id IS NULL;
```

### 問題3: 検索用カラムにデータが入っていない

**確認事項**:
1. `app/api/submit/route.ts`のコードが正しく実装されているか確認
2. アンケートフォームで該当項目を入力したか確認

**解決方法**:
- 開発サーバーのターミナルにエラーメッセージが表示されていないか確認
- ブラウザの開発者ツール（F12）でエラーを確認

---

## 確認完了チェックリスト

以下の項目を確認して、すべてチェックがつけば完了です：

- [ ] `schools`テーブルが存在する
- [ ] `schools`テーブルにデータが存在する
- [ ] `survey_responses`テーブルに新しいカラムが追加されている
- [ ] `survey_responses.school_id`が正しく設定されている
- [ ] `survey_responses.enrollment_year`にデータが入っている（該当項目を入力した場合）
- [ ] `survey_responses.attendance_frequency`にデータが入っている（該当項目を入力した場合）
- [ ] `survey_responses.reason_for_choosing`にデータが入っている（該当項目を入力した場合）
- [ ] `survey_responses.staff_rating`にデータが入っている（該当項目を入力した場合）
- [ ] `school_id`と`schools.id`の関連が正しい（SQLで確認）
- [ ] 既存学校への投稿時に新しい学校が作成されない
- [ ] 新規学校の自動作成が正しく機能する

---

## 次のステップ

データ確認が完了したら、Epic2（Media MVP）に進むことができます。

Epic2では、これらのデータを使用してメディアサイトを構築します：
- 学校検索ページ
- 学校個別ページ
- 口コミ一覧・詳細ページ
- いいね機能





