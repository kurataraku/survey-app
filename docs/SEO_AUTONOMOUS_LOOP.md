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

  Cron->>API: tick (毎時)
  API->>DB: acquire_lock
  API->>GSC: fetch_readonly_metrics
  API->>LLM: analyze_untrusted_data
  LLM-->>API: structured_json
  API->>API: zod_validate_and_risk_rules
  API->>DB: save_proposal_hash
  API->>DB: active版とshadow版を同一proposalで評価
  Note over API,DB: shadow結果は専用ログだけへ保存し、proposal/approval/実行へ流さない
  API->>Slack: active版合格proposalだけrequest_approval
  Note over API: 1回のtickで観測→分析→Slack通知を繰り返し、未分析課題と当日予算が尽きたら停止
  Slack->>API: approve_or_reject
  API->>DB: bind_approval_to_hash
  Cron->>API: 次回tickで承認済みをexecute
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
- `seo_rulebook_rollouts`
- `seo_rulebook_shadow_evaluations`
- `seo_rulebook_rollout_metric_snapshots`

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

## 提案スループット

Cronは毎時17分に起動します。GSC観測は`seo-loop:YYYY-MM-DD`のrun keyで1日1回だけ行い、以降のtickは未分析課題、Slack通知、修正依頼の改訂、承認済みの実行ゲートを進めます。修正依頼を押してから再提案が届くまでは最大1時間です。

1 tickの流れは次のとおりです。

- 観測でproposal上限の2倍（既定20件）まで課題を保存する
- 分析は5件ずつ処理し、Slack通知後に未分析課題と当日予算が残っていれば同じrunで分析へ戻る
- Function実行時間の予算（180秒）を超えたら新しい課題に着手せず、残りをopenのまま次tickへ回す

1日のproposal数はRulebookの`ops.maxDailyProposals`が上限です（既定10件）。`SEO_LOOP_MAX_DAILY_PROPOSALS`を大きくしてもRulebook値が優先されるため、10件を超えるにはRulebook新版とshadow昇格が必要です。

提案が0件で終わったtickでは、Slackの実行結果通知に見送り理由（`context` / `facts` / `policy` / `analyst` / `strategist` / `assemble`）と未分析課題数が入ります。どの段で落ちたかを見て、プロンプトかRulebookのどちらを直すか判断してください。

## 情報削減と重複変更の禁止

「短くする」「一般的な一覧へリンクを増やす」といった変更は、それ自体ではSEO改善の根拠になりません。次の変更はStrategistプロンプトで禁止し、生成時の再試行検証とHard Gateの両方で拒否します。

- `content_structure_preserved`: `updateSeoSummary`で、currentValueにある見出しの削除、箇条書きの純減、残存文字数比率80%未満の短縮
- `internal_link_not_duplicated`: `addApprovedInternalLink`で、公開HTMLの既存内部リンクと同一URL、または対象ページ自身へのリンク追加

判定は実測値だけで行います。既存リンクは提案評価時点の公開HTML（`html.internalLinks`）を正規化して比較し、要約構造はDBのcurrentValueと比較します。CTR課題では`updateSchoolMetaTitle`・`updateFeatureMetaDescription`を優先検討させ、本文要約の変更には検索意図との対応の明示を求めます。

Slackの承認カードは`*変更内容*`として、対象URL、文字数のbefore/after、削除・追加される見出し、箇条書きと行の増減、内部リンク件数の増減を表示します。承認者は本文全体を読み比べずに変化を判断できます。

## 承認固定

proposalには `version` と `payload_hash` を保存します。Slack承認時の hash/version と実行時の hash/version が一致しない場合は実行を拒否し、再承認を要求します。

## Kill Switchと上限

- `SEO_LOOP_ENABLED=false`: Orchestrator tick全体をno-op
- `SEO_LOOP_EXECUTION_ENABLED=false`: 観測・分析・提案・承認は継続、変更実行のみ停止
- `SEO_RULEBOOK_SHADOW_ENABLED=false`: Rulebook新版のshadow評価・指標更新・昇格操作を停止
- `SEO_LOOP_MAX_DAILY_PROPOSALS`
- `SEO_LOOP_MAX_DAILY_EXECUTIONS`
- `SEO_LOOP_MAX_TARGETS_PER_PROPOSAL`

## Rulebookのshadow運用

Typed Rule Patchの第二承認は新版の即時active化ではなく、`shadowing`開始を許可します。旧active版は主系のままです。以後、旧版で生成された同一proposalを新版Rulebookでも評価し、shadow結果は`seo_rulebook_shadow_evaluations`だけへ保存します。shadow側から`seo_proposals`、`seo_approvals`、Slack proposalカード、Typed Executorへは書き込みません。

比較指標は提案生成率、Hard Gate通過率、承認率、修正率、同じ修正の再発率です。Unit 8のTyped Patchはrisk scopeだけを変更するため、提案生成率は旧新版で同一です。評価による表出差はSlack到達可能率として別に比較します。shadowでは人間へカードを送らないため、承認率・修正率・再発率は「主系で実際に得た人間判断のうち、新版も表出させた同一proposal」に限定した投影値です。実判断のない値をshadow承認として捏造しません。

最低7 run、評価済み10 proposal、主系・shadow対象とも実判断5件を満たし、固定された回帰基準をすべて通過した場合だけ`ready`になります。`ready`になっても自動昇格せず、Slackの最終昇格承認で初めて旧版をretired、新版をactiveへ同一transactionで切り替えます。既存runのRulebook bindingは変わらず、次runから新版を使います。

障害時は`SEO_RULEBOOK_SHADOW_ENABLED=false`でshadow経路だけを停止できます。主系proposal処理はshadowの失敗を理由に停止しません。昇格後に異常があれば`npm run seo:rulebook:status -- --rollback-current --yes --actor=<Slack User ID>`で直前active版へ戻します。`SEO_LOOP_EXECUTION_ENABLED=false`はExecutor本番設計と効果再計測が完成するまで維持します。

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
