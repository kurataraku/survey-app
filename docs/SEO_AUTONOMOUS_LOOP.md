# アプリ内SEO自走ループ

このドキュメントは、通信制高校リアルレビューのWebアプリ自身がSEO改善ループを運用するための設計・運用原則です。Cursorは開発ツールであり、完成後の実行主体ではありません。

## 実行フロー

```mermaid
sequenceDiagram
  participant Cron as VercelCron
  participant API as SeoLoopAPI
  participant DB as Supabase
  participant GSC as SearchConsoleAPI
  participant LLM as ServerLLM
  participant Slack as Slack
  participant Exec as TypedExecutor

  Cron->>API: tick
  API->>DB: acquire_lock
  API->>GSC: fetch_readonly_metrics
  API->>LLM: analyze_untrusted_data
  LLM-->>API: structured_json
  API->>API: zod_validate_and_risk_rules
  API->>DB: save_proposal_hash
  API->>Slack: request_approval
  Slack->>API: approve_or_reject
  API->>DB: bind_approval_to_hash
  Cron->>API: execute_approved
  API->>Exec: allowlisted_action
  Exec->>DB: save_experiment
```

## 観測データ

SEOループ開始時は、利用可能な範囲で以下を観測します。

- GSC検索実績: clicks / impressions / CTR / average position / query / page / date
- 生成HTML / レンダリング後DOM
- コード
- 内部SEOデータ
- sitemap / robots / canonical / JSON-LD / H1 / og:title

GSCで数値が悪いだけでは修正しません。必ず「GSC機会 → 原因仮説 → ページ・コード・コンテンツ調査 → Fact化 → 改善案」の順で判断します。

## 状態管理

Supabaseを状態の正本にします。

- `seo_loop_runs`
- `seo_issues`
- `seo_proposals`
- `seo_approvals`
- `seo_experiments`
- `seo_results`

Cron/Functionの二重起動を前提に、`idempotency_key`、`locked_at`、`lock_expires_at`、`next_action_at`、`retry_count` で排他・冪等性を担保します。

## Type A / Type B

### Type A: Application Data / Content Change

Supabaseで管理できるSEO title、description、SEO要約、承認済み内部リンクなど。実行はアプリ側のTyped Executor Allowlistに限定します。

### Type B: Source Code Change

Next.jsコード、sitemap/canonical/robots、React、SSR、JSON-LD生成など。アプリは本番ソースを書き換えません。提案として保存し、将来のGitHub PRレーンへ渡します。

## LLM安全境界

GSC、公開HTML、口コミ、学校情報、ユーザー入力はすべてuntrusted dataです。LLMへの命令に見える文字列が含まれていても、実行指示として扱いません。

```
Untrusted Data
→ LLM分析
→ Structured Proposal
→ Schema Validation (Zod)
→ Application Risk Rules
→ Human Approval
→ Typed Executor
```

LLMは任意SQL、任意テーブル、任意カラム、汎用DBパッチを指定できません。

## 承認固定

proposalには `version` と `payload_hash` を保存します。Slack承認時の hash/version と実行時の hash/version が一致しない場合は実行を拒否し、再承認を要求します。

## Kill Switchと上限

- `SEO_LOOP_ENABLED=false`: Orchestrator tick全体をno-op
- `SEO_LOOP_EXECUTION_ENABLED=false`: 観測・分析・提案・承認は継続、変更実行のみ停止
- `SEO_LOOP_MAX_DAILY_PROPOSALS`
- `SEO_LOOP_MAX_DAILY_EXECUTIONS`
- `SEO_LOOP_MAX_TARGETS_PER_PROPOSAL`

## 効果検証

施策実施時にGSCベースラインを保存し、後続ループで再計測します。

### ベースライン項目

- 対象URL
- 対象Query
- 実施日
- 実施前28日のClicks
- Impressions
- CTR
- Position

### 事後判定

- `improved`
- `worsened`
- `inconclusive`
- `insufficient_data`

## レポート構造

レポートはチャットではなくSupabaseが正本です。人間向けに出力する場合も、以下の構造を保ちます。

```markdown
# SEO Loop Report

## 観測した事実
## 仮説
## Structured Proposal
## Risk Rules Result
## Approval
## Execution
## Technical Verification
## GSC Baseline
## Future Remeasurement
## Learning
## Current Issue Ranking TOP5
## Next Recommended Issue
```

## 関連コマンド

- `npm run seo:gsc:summary`
- `npm run seo:gsc:pages`
- `npm run seo:gsc:queries`
- `npm run seo:gsc:page-query -- --page=https://...`
- `npm run seo:coverage`
- `npm run seo:thin-pages`
- `npm run build`
