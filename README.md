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

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Supabaseのダッシュボード（Settings → API）から各値を取得できます。

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
