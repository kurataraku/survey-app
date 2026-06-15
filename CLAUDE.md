# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 開発サーバー起動
npm run dev

# ビルド（SSR整合性チェック → next build）
npm run build

# Lint
npm run lint

# 環境変数チェック
npm run check-env

# SEOカバレッジ（公開校・AI要約・記事件数のJSON出力）
npm run seo:coverage

# 学校タグ highlights を OpenAI で一括生成（初回は --dry-run --limit=5 推奨）
npm run generate:highlights -- --all --sleep-ms=150

# SSR整合性チェック単体
npm run verify-ssr

# AIエージェント実行（全校バッチ）
npx tsx scripts/agent-setup.ts --all --publish=false

# AIエージェント実行（単一学校）
npx tsx scripts/agent-setup.ts --school-id=<uuid> --publish=true

# 学費・コースの一括AI抽出（公式URL自動特定込み。すべてdraft保存・公開は人間）
# 公式URL未登録校もPerplexityで特定して保存（未確認フラグ付き）
npm run agent:school-info -- --prefecture=東京都 --limit=20 --resolve-url
# 学費のみ / コースのみ
npm run agent:school-info -- --prefecture=東京都 --only=tuition
npm run agent:school-info -- --prefecture=東京都 --only=courses
# 学費目安のみ一括抽出（従来CLI）
npm run agent:tuition -- --prefecture=東京都 --limit=20 --use-perplexity

# CSVから学校マスターインポート
npm run seed:schools

# 集計再計算
npm run recalculate-aggregates
```

## アーキテクチャ概要

### ルーティングとベースパス

アプリは Next.js App Router で動作し、ベースパスは `/tsushin-kuchikomi`。`next.config.ts` の rewrites で `/tsushin-kuchikomi/*` → `/*` にマッピングされている。

パス生成には必ず `lib/base-path.ts` のヘルパーを使う:
- `appPath(path)` — Linkやrouter.push用のページパス
- `apiPath(path)` — fetch用のAPIパス

### ルートグループ構成

```
app/
  (survey)/          # 公開サイト（口コミメディア）
  admin/             # 管理画面（認証必須）
  company/           # 会社トップ（/ にリダイレクト）
  api/
    submit/          # 口コミ投稿
    admin/           # 管理者専用API
      reviews/       # 口コミ承認・却下・AI審査
      campaigns/     # QUOカードキャンペーン管理
      agent/         # AIエージェントセットアップ
      seo-drafts/    # SEO記事生成パイプライン
    campaign/active/ # フロントエンド向け有効キャンペーン取得
```

### Supabaseクライアントの使い分け

`lib/supabase/server.ts` に2種類ある:
- `createServerSupabaseClient()` — Cookieセッションを使う。Server Components・認証が必要なAPIで使用
- `createAdminSupabaseClient()` — Service Role Key使用。RLSをバイパスしてDB操作が必要な管理系APIで使用

### 認証パターン

`lib/auth/admin.ts` に3つの関数がある:
- `requireAdmin(request)` — セッション確認 + `admin_users`テーブル照会。ガード成功時は`AdminAuthResult`、失敗時は`NextResponse(403)`を返す
- `requireAdminOrAgent(request)` — `Authorization: Bearer {AGENT_API_KEY}`を優先チェックし、なければ`requireAdmin`にフォールバック。AIエージェント用APIで使用
- `requireOwner(request)` — `role === 'owner'`のみ許可

使い方のパターン:
```typescript
const authResult = await requireAdmin(request);
if (authResult instanceof NextResponse) return authResult;
```

### SSR制約（重要）

`npm run build` は `verify-ssr` を事前実行する。`app/(survey)/` 配下ではカード系コンポーネントのClient版は使用禁止で、Server版を使う必要がある:

| ❌ 使用禁止 | ✅ 使用すること |
|---|---|
| `ReviewCard` | `ReviewCardServer` |
| `SchoolCard` | `SchoolCardServer` |
| `ArticleCard` | `ArticleCardServer` |
| `RankingCard` | `RankingCardServer` |

### 口コミ投稿〜公開フロー

1. `POST /api/submit` — `survey_responses` に保存（`moderation_status='pending'`, `is_public=false`）→ 非同期で `/api/admin/reviews/[id]/moderate` を起動
2. `POST /api/admin/reviews/[id]/moderate` — OpenAI (gpt-4o) でAI審査。結果を `review_moderation_results` に保存
3. 管理者が管理画面で承認 → `POST /api/admin/reviews/[id]/approve`
   - アクティブなキャンペーンがあれば QUOカード発行 → `campaign_grants` に記録 → キャンペーンメール送信
   - キャンペーンなしなら通常の承認メール送信
   - いずれも `email_logs` にログ保存

### AIエージェント（学校ページ自動セットアップ）

`scripts/agent-setup.ts` → `app/api/admin/agent/schools/[id]/setup/` の流れ。

処理ステップ（`--steps` で個別指定可能）:
- `prefecture` — OpenAIで都道府県推定
- `slug` — URLスラグ生成
- `intro` — Perplexityで学校紹介文生成
- `summary` — OpenAIで口コミ全体要約
- `meta` — meta_title / meta_description 生成
- `seo_sections` — SEOセクション別テキスト生成
- `faq` — よくある質問と回答を生成
- `review_tendency` — 口コミ傾向（良い点・改善点）生成

すべての結果は `school_ai_summaries` テーブルに `kind` と `topic` で分類して保存。`published`済みレコードは上書きしない。

### SEO記事生成パイプライン

`lib/seo-generation/` 配下に生成ステップごとのモジュールがある（planner → researcher → researcher-web → writer → verifier → rewriter → generate-image → transfer）。対応するAPIは `app/api/admin/seo-drafts/[id]/[step]/route.ts`。

### 外部サービス

| サービス | 用途 | 環境変数 |
|---|---|---|
| Supabase | DB・認証 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| OpenAI | AI審査・要約・SEO生成 | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Perplexity | 学校紹介文生成（Web検索付き） | `PERPLEXITY_API_KEY` |
| Resend | メール送信 | `EMAIL_API_KEY`, `EMAIL_FROM` |
| QUOカードPay | 口コミキャンペーン特典発行 | `QUOCARD_API_KEY`, `QUOCARD_API_URL` |
| Anthropic | SEO記事生成（lib/seo-generation） | `ANTHROPIC_API_KEY` |

`QUOCARD_API_KEY` / `QUOCARD_API_URL` が未設定の場合、`lib/quocard/client.ts` はモックコード（`MOCK-{timestamp}`）を返す（本番では要設定）。

### Supabaseマイグレーション

`supabase-migrations/` 配下のSQLファイルを Supabase ダッシュボードまたは CLI で手動適用する（自動マイグレーション機構はない）。ファイルはアルファベット順ではなく依存関係順に適用する。
