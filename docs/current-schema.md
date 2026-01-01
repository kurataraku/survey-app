# 現在のデータベーススキーマ

最終更新日: 2024年（Epic0完了時点）

## テーブル一覧

### 1. survey_responses

アンケート回答を格納するメインテーブル。

#### カラム定義

| カラム名 | 型 | NULL | デフォルト値 | 説明 |
|---------|----|----|------------|------|
| id | UUID | NOT NULL | gen_random_uuid() | プライマリキー |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 作成日時 |
| school_name | TEXT | NOT NULL | - | 学校名 |
| respondent_role | TEXT | NOT NULL | - | 回答者の立場（'本人' or '保護者'） |
| status | TEXT | NOT NULL | - | 現在の状況（'在籍中', '卒業した', '以前在籍していた（転校・退学など）'） |
| graduation_path | TEXT | NULL | - | 卒業後の進路（status = '卒業した' の場合のみ） |
| graduation_path_other | TEXT | NULL | - | その他（卒業後の進路） |
| overall_satisfaction | INTEGER | NOT NULL | - | 総合満足度（1-5） |
| good_comment | TEXT | NOT NULL | - | 良かった点（自由記述） |
| bad_comment | TEXT | NOT NULL | - | 改善してほしい点/合わない点（自由記述） |
| answers | JSONB | NOT NULL | '{}' | その他の回答（JSONB形式） |
| email | TEXT | NULL | - | メールアドレス（任意） |

#### インデックス

- `idx_survey_responses_school_name` - school_nameカラムのインデックス
- `idx_survey_responses_status` - statusカラムのインデックス
- `idx_survey_responses_created_at` - created_atカラムのインデックス
- `idx_survey_responses_overall_satisfaction` - overall_satisfactionカラムのインデックス
- `idx_survey_responses_answers` - answers JSONBカラムのGINインデックス

#### answers JSONBの構造

`answers`カラムには以下のようなJSONデータが格納されます：

```json
{
  "reason_for_choosing": ["心の不調", "人間関係", ...],
  "course": "普通科",
  "enrollment_type": "新入学（中学卒業後）",
  "enrollment_year": "2024",
  "attendance_frequency": "週1〜2",
  "campus_prefecture": "東京都",
  "teaching_style": ["校舎集団中心", "オンラインライブ中心", ...],
  "student_atmosphere": ["まじめで授業/行事に積極的", ...],
  "atmosphere_other": "その他の雰囲気の説明",
  "flexibility_rating": "4",
  "staff_rating": "5",
  "support_rating": "4",
  "atmosphere_fit_rating": "3",
  "credit_rating": "4",
  "unique_course_rating": "5",
  "career_support_rating": "4",
  "campus_life_rating": "6",
  "tuition_rating": "4"
}
```

**注意**: 評価項目（rating）は文字列型の数値（"1"〜"5"または"6"）として格納されます。

### 2. answer_schema

`answers` JSONBのキー定義を管理するテーブル（Epic0完了時点で実装済み）。

#### カラム定義

| カラム名 | 型 | NULL | デフォルト値 | 説明 |
|---------|----|----|------------|------|
| key | TEXT | NOT NULL | - | 正規キー名（プライマリキー） |
| type | TEXT | NOT NULL | - | データ型（'string', 'number', 'string[]', 'number[]', 'boolean'） |
| required | BOOLEAN | NOT NULL | false | 必須フラグ |
| enum_values | TEXT[] | NULL | - | 選択肢がある場合のenum値の配列 |
| aliases | TEXT[] | NULL | - | 過去のキー名や別名 |
| description | TEXT | NULL | - | 説明 |

#### インデックス

- `idx_answer_schema_type` - typeカラムのインデックス
- `idx_answer_schema_required` - requiredカラムのインデックス

#### 登録されているキー（Epic0完了時点）

- `reason_for_choosing` (string[], false) - 通信制を選んだ理由（複数選択可）
- `course` (string, false) - 在籍していたコース
- `enrollment_type` (string, false) - 入学タイミング
- `enrollment_year` (string, false) - 入学年（4桁の文字列）
- `attendance_frequency` (string, false) - 主な通学頻度
- `campus_prefecture` (string, false) - 主に通っていたキャンパス都道府県
- `teaching_style` (string[], false) - 授業スタイル（複数選択可）
- `student_atmosphere` (string[], false) - 生徒の雰囲気（複数選択可）
- `atmosphere_other` (string, false) - その他（生徒の雰囲気）
- `flexibility_rating` (string, false) - 学びの柔軟さ（評価）
- `staff_rating` (string, false) - 先生・職員の対応（評価）
- `support_rating` (string, false) - 心や体調の波・不安などに対するサポート（評価）
- `atmosphere_fit_rating` (string, false) - 在校生の雰囲気が自分に合っていたか（評価）
- `credit_rating` (string, false) - 単位取得のしやすさ（評価）
- `unique_course_rating` (string, false) - 独自授業・コースの充実度（評価）
- `career_support_rating` (string, false) - 進路サポート（評価）
- `campus_life_rating` (string, false) - 行事やキャンパスライフの過ごしやすさ（評価）
- `tuition_rating` (string, false) - 学費の納得感（評価）

## 環境変数

### APIルートで使用

- `NEXT_PUBLIC_SUPABASE_URL` - SupabaseプロジェクトのURL
- `SUPABASE_SERVICE_ROLE_KEY` - SupabaseのService Role Key（サーバーサイドでのみ使用）

**注意**: `NEXT_PUBLIC_SUPABASE_URL`は`NEXT_PUBLIC_`プレフィックスが付いていますが、サーバーサイドAPIルートでのみ使用されているため、クライアント側に露出していません。

## 正規化処理

`normalizeAnswers`関数（`lib/normalizeAnswers.ts`）により、`answers` JSONBのキーが正規化されます：

1. **キー名の統一**: `aliases`を使用して過去のキー名から正規キーにマッピング
2. **型変換**: スキーマ定義に基づいて型を変換
3. **バリデーション**: `enum_values`が定義されている場合、値がenumに含まれているかチェック
4. **空値の除外**: null、undefined、空文字列、空配列は保存しない
5. **不明キーの破棄**: スキーマに存在しないキーは破棄

## 関連ファイル

- `supabase-schema.sql` - テーブル作成SQL（初期版）
- `supabase-schema-safe.sql` - テーブル作成SQL（安全版、既存データを保持）
- `supabase-schema-answer-schema.sql` - answer_schemaテーブル作成SQL
- `lib/normalizeAnswers.ts` - 正規化処理の実装
- `app/api/submit/route.ts` - アンケート送信API（normalizeAnswersを使用）
- `app/api/export/route.ts` - CSVエクスポートAPI

## 次のステップ（Epic1）

以下のテーブルを追加予定：

1. **schools** - 学校マスタテーブル
2. **aggregates** - 学校別集計キャッシュテーブル

また、`survey_responses`テーブルに以下のカラムを追加予定：

- `school_id` (UUID, FK to schools.id)
- `enrollment_year` (INTEGER)
- `attendance_frequency` (TEXT)
- `reason_for_choosing` (TEXT[])
- `staff_rating` (INTEGER)
- `atmosphere_fit_rating` (INTEGER)
- `credit_rating` (INTEGER)
- `tuition_rating` (INTEGER)
- `is_public` (BOOLEAN)

これらのカラムは、`answers` JSONBから抽出した値も保存します（二重保存）。








