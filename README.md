# 通信制高校リアルレビュー アンケートアプリ

Next.js + Supabaseで実装されたアンケートWebアプリケーションです。

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- React Hook Form
- Zod + @hookform/resolvers
- Supabase JS SDK
- Tailwind CSS

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env.local`を作成し、実際の値を設定してください：

```bash
cp .env.example .env.local
```

`.env.local`ファイルに以下の環境変数を設定してください：

```env
# Supabase設定（必須）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Supabaseのダッシュボード（Settings → API）から各値を取得できます。

詳細は`.env.example`を参照してください。

### 3. Supabaseテーブルの作成

SupabaseのSQL Editorで`supabase-schema.sql`の内容を実行してテーブルを作成してください。

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000/survey](http://localhost:3000/survey) を開いてアンケートフォームにアクセスできます。

## プロジェクト構造

```
survey-app/
├── app/
│   ├── api/
│   │   └── submit/
│   │       └── route.ts          # アンケート送信API
│   ├── survey/
│   │   └── page.tsx              # メインフォームページ
│   └── layout.tsx
├── components/
│   ├── QuestionRenderer.tsx      # 質問レンダリングコンポーネント
│   └── Stepper.tsx               # ステップ表示コンポーネント
├── lib/
│   ├── questions.ts              # 質問定義
│   ├── schema.ts                 # Zodスキーマ定義
│   └── supabase.ts              # Supabaseクライアント
└── supabase-schema.sql           # テーブル作成SQL
```

## 主な機能

### 3ステップフォーム

- **Step1**: 基本情報（学校名、立場、状況、入学情報など）
- **Step2**: 学習/環境（通学頻度、授業スタイル、生徒の雰囲気など）
- **Step3**: 評価＋自由記述（5段階評価、コメント）

### 条件分岐

1. **No.4（卒業後の進路）**: No.3（状況）が「卒業した」の場合のみ表示・必須
2. **No.23/No.24の文字数制限**: No.22（総合満足度）に応じて動的に変更
   - 満足度4〜5: 良かった点100字以上、改善点30字以上
   - 満足度1〜2: 良かった点30字以上、改善点100字以上
   - 満足度3: 両方70字以上

### バリデーション

- クライアント側: React Hook Form + Zod
- サーバー側: APIルートでも同じZodスキーマで検証

### データ保存

- Supabaseの`survey_responses`テーブルに保存
- 主要フィールドは個別カラム、その他は`answers`（JSONB）に格納

## ビルド

```bash
npm run build
npm start
```

## 注意事項

- スパム対策/CAPTCHA/レート制限は未実装です
- 本番環境では適切なセキュリティ対策を実装してください

## 開発フロー

### ブランチ構成

```
main：本番用（直接push禁止）
  ↑
dev：統合用（複数PRの受け皿）
  ↑
feature/xxx：各メンバー作業用（例：feature/ui-school-header）
```

### 作業手順

1. **ブランチの作成**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/ui-xxx
   ```

2. **ローカルで修正・確認**
   - CursorでUI修正
   - `npm run dev`でローカル表示確認

3. **コミット・プッシュ**
   ```bash
   git add .
   git commit -m "feat(ui): 変更内容の説明"
   git push -u origin feature/ui-xxx
   ```

4. **PR作成**
   - GitHubでPRを作成（`feature/*` → `dev`）
   - PRテンプレートに従って記入
   - Before/Afterのスクショを添付

5. **レビュー・マージ**
   - レビュー承認後、`dev`にマージ
   - まとまったタイミングで`dev` → `main`にマージ（本番反映）

### 許可される変更

- ✅ 文言・テキストの変更
- ✅ 文字サイズ・フォント・色の変更
- ✅ トーン&マナーの調整
- ✅ 画像の挿入・差し替え
- ✅ レイアウト・余白・サイズの調整
- ✅ スタイリング（CSS/Tailwind）の変更

### 絶対に禁止される変更

- ❌ 機能の追加・変更・削除
- ❌ バックエンド（API、データベース）への変更
- ❌ サーバー側（API Route、Server Component）のロジック変更
- ❌ データ取得ロジックの変更
- ❌ ルーティングの変更
- ❌ 認証・セキュリティ関連の変更
- ❌ 環境変数の追加・変更
- ❌ パッケージの追加・削除

詳細は`.github/pull_request_template.md`と`.github/ISSUE_TEMPLATE/ui-improvement.md`を参照してください。
