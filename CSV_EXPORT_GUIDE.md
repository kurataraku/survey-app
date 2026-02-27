# CSVエクスポートガイド

アンケート回答データをCSV形式でダウンロードする方法を説明します。

## 方法1: Supabaseダッシュボードから直接エクスポート（最も簡単）

### ステップ1: Table Editorでエクスポート

1. Supabaseダッシュボードで「**Table Editor**」を開く
2. `survey_responses` テーブルを選択
3. テーブルの右上にある「**...**」（三点リーダー）メニューをクリック
4. 「**Export as CSV**」または「**Download CSV**」を選択
5. CSVファイルがダウンロードされます

### ステップ2: SQL Editorでエクスポート

1. Supabaseダッシュボードで「**SQL Editor**」を開く
2. 「**New query**」をクリック
3. 以下のSQLを実行：

```sql
SELECT * FROM survey_responses ORDER BY created_at DESC;
```

4. 結果の右上にある「**Download**」ボタンまたは「**Export**」ボタンをクリック
5. 「**CSV**」形式を選択してダウンロード

## 方法2: SQLで整形してエクスポート

`answers`（JSONB）を展開して、より見やすい形式でエクスポートする場合：

```sql
SELECT 
  id,
  created_at,
  school_name,
  respondent_role,
  status,
  graduation_path,
  graduation_path_other,
  overall_satisfaction,
  good_comment,
  bad_comment,
  email,
  -- answersから各フィールドを展開
  answers->>'reason_for_choosing' as reason_for_choosing,
  answers->>'course' as course,
  answers->>'enrollment_type' as enrollment_type,
  answers->>'enrollment_year' as enrollment_year,
  answers->>'attendance_frequency' as attendance_frequency,
  answers->>'teaching_style' as teaching_style,
  answers->>'student_atmosphere' as student_atmosphere,
  answers->>'atmosphere_other' as atmosphere_other,
  answers->>'flexibility_rating' as flexibility_rating,
  answers->>'staff_rating' as staff_rating,
  answers->>'support_rating' as support_rating,
  answers->>'atmosphere_fit_rating' as atmosphere_fit_rating,
  answers->>'credit_rating' as credit_rating,
  answers->>'unique_course_rating' as unique_course_rating,
  answers->>'career_support_rating' as career_support_rating,
  answers->>'campus_life_rating' as campus_life_rating,
  answers->>'tuition_rating' as tuition_rating
FROM survey_responses
ORDER BY created_at DESC;
```

このSQLを実行後、「**Download**」ボタンからCSVをダウンロードできます。

## 方法3: 配列フィールドを文字列に変換

`reason_for_choosing`、`teaching_style`、`student_atmosphere`は配列なので、CSVで見やすくするために文字列に変換：

```sql
SELECT 
  id,
  created_at,
  school_name,
  respondent_role,
  status,
  graduation_path,
  graduation_path_other,
  overall_satisfaction,
  good_comment,
  bad_comment,
  email,
  -- 配列をカンマ区切りの文字列に変換
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'reason_for_choosing')), ', ') as reason_for_choosing,
  answers->>'course' as course,
  answers->>'enrollment_type' as enrollment_type,
  answers->>'enrollment_year' as enrollment_year,
  answers->>'attendance_frequency' as attendance_frequency,
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'teaching_style')), ', ') as teaching_style,
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'student_atmosphere')), ', ') as student_atmosphere,
  answers->>'atmosphere_other' as atmosphere_other,
  answers->>'flexibility_rating' as flexibility_rating,
  answers->>'staff_rating' as staff_rating,
  answers->>'support_rating' as support_rating,
  answers->>'atmosphere_fit_rating' as atmosphere_fit_rating,
  answers->>'credit_rating' as credit_rating,
  answers->>'unique_course_rating' as unique_course_rating,
  answers->>'career_support_rating' as career_support_rating,
  answers->>'campus_life_rating' as campus_life_rating,
  answers->>'tuition_rating' as tuition_rating
FROM survey_responses
ORDER BY created_at DESC;
```

## 注意事項

- CSVファイルはUTF-8エンコーディングで保存されます
- Excelで開く場合、文字化けする場合は「データ」→「テキストファイル」からインポートし、文字コードを「UTF-8」に設定してください
- `answers`カラムがJSON形式のままの場合、Excelで開くと見づらい場合があります。方法2または方法3を使用することを推奨します

## おすすめ

**最も見やすい形式は「方法3」です。**
- すべてのフィールドが個別の列として表示されます
- 配列データもカンマ区切りの文字列として見やすく表示されます

---

## CSVインポート時の形式（管理画面の口コミ一括インポート用）

管理画面から口コミをCSVでインポートする場合、以下の形式に従ってください。

### 複数選択項目の表記（通信制を選んだ理由・授業スタイル・生徒の雰囲気）

- **区切り文字**: **セミコロン**（`;`）または全角セミコロン（`；`）。セミコロンの後ろのスペースはあってもなくてもよい。
- **例**: `心の不調のため; 働きながら学びたいため` または `心の不調のため；学びなおしのため`
- エクスポートCSVでは `"; "`（セミコロン＋スペース）で結合しているため、**エクスポートしたCSVをそのまま編集してインポートし直す場合は、セミコロン区切りのまま**で問題ありません。

### 選択肢の表記（1字1句あっている必要は？）

- **単一選択項目**（あなたの立場・状況・入学タイミング・主な通学頻度・都道府県・各評価・総合満足度 など）  
  → **Zod の enum で完全一致**が求められます。表記が1字でも違うとバリデーションでその行はエラーになります。
- **複数選択項目**（通信制を選んだ理由・授業スタイル・生徒の雰囲気）  
  → インポート時は「文字列の配列」として受け取り、その後に DB の `answer_schema` の `enum_values` と照合します。**一覧にない表記の選択肢はその項目だけ破棄され、エラーにはなりませんが、正しい選択肢だけが保存されます。** 表示・集計を正しくするため、**選択肢はエクスポートCSVやアンケート画面の値と完全に同じ表記**にすることを推奨します。

### 複数選択の選択肢一覧（コピー用）

- **通信制を選んだ理由**: `心の不調のため` / `先生・友人などの人間関係に悩んだため` / `全日制の学習スタイルが合わないため` / `心や体の状態／発達障害・知的障害などのため` / `働きながら学びたいため` / `スポーツ/芸術/芸能活動との両立のため` / `学費をおさえるため` / `学びなおしのため` / `その他`
- **授業スタイル**: `校舎集団中心` / `校舎個別/少人数中心` / `半々` / `オンラインライブ中心` / `録画/オンデマンド中心` / `自主学習/レポート中心`
- **生徒の雰囲気**: `まじめで授業/行事に積極的` / `落ち着いて少人数で過ごす` / `一人時間を大事にする` / `アニメ/ゲーム等の趣味` / `おしゃれを楽しむ` / `にぎやかでルールにしばられずマイペース` / `校外活動重視` / `幅広い年齢層` / `その他`

### メールアドレス

- **半角の `@` を使ってください。** 全角の「＠」はバリデーションで弾かれます（有効なメールとして認識されません）。  
- インポート時は、メール列の**全角＠を半角@に自動で置き換える**処理を入れているため、全角で入力していてもそのまま取り込めるようになっています。

