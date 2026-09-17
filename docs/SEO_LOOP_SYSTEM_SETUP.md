# SEO自走システム セットアップ

この手順は、通信制高校リアルレビューのアプリ本体がGSC観測・Slack承認付きSEOループを実行するためのものです。秘密情報はGitに含めないでください。

## 1. Google Search Console API

1. Google Cloud Consoleでプロジェクトを開く
2. Search Console APIを有効化する
3. Service Accountを作成する
4. JSONキーを発行し、ローカルまたはVercel Secretに保存する
5. JSON内の `client_email` をコピーする
6. Google Search Consoleで対象プロパティを開く
7. 設定 → ユーザーと権限 → ユーザーを追加
8. Service Accountのメールアドレスを **制限付き** 権限で追加する

読み取り専用scopeは `https://www.googleapis.com/auth/webmasters.readonly` です。Owner権限やIndexing APIは使用しません。

## 2. GSC_SITE_URL

GSCのプロパティ種別に合わせます。

- ドメインプロパティ: `sc-domain:careeressence.jp`
- URLプレフィックス: `https://careeressence.jp/`

## 3. Slack

1. Slack Appを作成する
2. Bot Tokenを発行し、`chat:write` を付与する
3. SEO承認通知用チャンネルにBotを招待する
4. Interactivityを有効化する
5. Request URLを `/api/seo-loop/slack/interactions` に設定する
6. Signing SecretをVercel envへ設定する

「却下」「修正依頼」はModalを開き、理由と分類を`seo_feedback`へ保存します。Slack AppのInteractivity設定を変更した場合は再インストールが必要なことがあります。
承認・却下・修正依頼を操作できるSlack User IDは`SLACK_SEO_APPROVER_IDS`へカンマ区切りで設定します。`SLACK_SEO_CHANNEL_ID`にはチャンネル名ではなく`C`から始まるChannel IDを設定し、通知チャンネル以外からの操作も拒否します。

## 4. Vercel / 環境変数

必須:

- `CRON_SECRET`
- `SEO_LOOP_ENABLED`
- `SEO_LOOP_EXECUTION_ENABLED`
- `GSC_SITE_URL`
- `GSC_SERVICE_ACCOUNT_KEY_JSON` または `GSC_SERVICE_ACCOUNT_KEY_PATH`
- `SLACK_BOT_TOKEN`
- `SLACK_SEO_CHANNEL_ID`
- `SLACK_SEO_APPROVER_IDS`
- `SLACK_SIGNING_SECRET`
- `OPENAI_API_KEY` または既存SEO生成で使うLLMキー
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

安全な初期値:

```env
SEO_LOOP_ENABLED=false
SEO_LOOP_EXECUTION_ENABLED=false
SEO_LOOP_MAX_DAILY_PROPOSALS=10
SEO_LOOP_MAX_DAILY_EXECUTIONS=3
SEO_LOOP_MAX_TARGETS_PER_PROPOSAL=3
SEO_LOOP_SOFT_EVAL_MIN_SCORE=75
SEO_RULEBOOK_PATCH_ENABLED=false
SEO_RULEBOOK_SHADOW_ENABLED=false
```

## 5. Supabase

次の順でSupabase SQL Editorから適用します。

1. `supabase-migrations/create-seo-loop-system.sql`
2. `supabase-migrations/add-seo-loop-proposal-v2.sql`
3. `supabase-migrations/add-seo-loop-analysis-traces.sql`
4. `supabase-migrations/add-seo-loop-proposal-evaluations.sql`
5. `supabase-migrations/add-seo-loop-feedback.sql`
6. `supabase-migrations/add-seo-loop-proposal-revisions.sql`
7. `supabase-migrations/add-seo-loop-versioned-rulebook.sql`
8. `supabase-migrations/add-seo-loop-typed-rule-patches.sql`
9. `supabase-migrations/allow-seo-loop-single-operator-rule-patch-approval.sql`
10. `supabase-migrations/add-seo-loop-shadow-rollouts.sql`
11. `supabase-migrations/add-seo-loop-approved-internal-links.sql`

Proposal v2は`schema_version`と生成時の`context_snapshot`へ、二段階分析は`seo_analysis_traces`へ、品質ゲートは`seo_proposal_evaluations`へ、Slackの却下・修正理由は`seo_feedback`へ書き込みます。修正依頼から生成した子proposalは`parent_proposal_id`と`revision_feedback_id`で旧行・feedbackへ接続し、`seo_revision_traces`へ生成履歴を残します。2つ目以降のmigrationは対応コードをデプロイする前に適用してください。
特に`add-seo-loop-feedback.sql`未適用の状態で単位5のコードをデプロイすると、Slackの承認・却下処理は安全側に停止します。
単位6ではrunを一時的に`revising`へ戻し、`create_seo_proposal_revision` RPC内で子proposal作成・旧approval無効化・親の`revision_resolved_at`更新を原子的に行います。子の`version`は親+1、`revision_number`はチェーン深度です。単位6 migration未適用時は改訂処理だけを縮退し、通常の観測・分析は継続します。
単位7ではactiveな`seo_rulebook_versions`をrun開始時に`seo_rulebook_bindings`へsnapshot固定します。同じrunではactive版が変わっても固定済み内容を使い続け、proposalとevaluationへversion・hash・rule IDsを保存します。DB取得失敗・schema不適合・hash不一致時は、より緩い設定へ倒さずコード内の安全なv1 fallbackを使います。人間向け内容と変更履歴は`docs/seo-rulebook/`を参照してください。
単位8では独立した複数feedbackから固定AllowlistのTyped Rule Patchだけを候補化します。9番は、8番を適用済みの環境を含め、一人運用でも同じSlackユーザーが別工程の第二承認を行えるようにする補正migrationです。10番の適用後は第二承認で即active化せず、旧active版を主系に維持したshadow比較へ移行します。11番は承認済み内部リンクを本文へ直接挿入せず、専用Allowlistテーブルから関連リンク枠へ表示するために必要です。比較基準を満たし、Slackで最終昇格承認した次runからだけ新版が有効になります。既定は`SEO_RULEBOOK_PATCH_ENABLED=false`かつ`SEO_RULEBOOK_SHADOW_ENABLED=false`です。設定、運用床、一人運用時の安全境界、状態確認、rollbackは`docs/seo-rulebook/RULE_PATCH_OPERATIONS.md`を参照してください。

## 6. 動作確認

GSCのみ:

```bash
npm run seo:gsc:summary
npm run seo:gsc:pages
npm run seo:gsc:queries
```

Cron API（ローカル確認）:

```bash
curl -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/seo-loop
```

本番ではVercel Cronが `CRON_SECRET` をBearerとして付与します。
スケジュールは `vercel.json` の `17 * * * *`（UTC）= **毎時17分**です。毎時起動はVercel Proプランが前提です。
Cron path は `/tsushin-kuchikomi/api/cron/seo-loop` です（ベースパス付き）。
GSC観測は日次run key（`seo-loop:YYYY-MM-DD`）で1日1回だけ実行し、以降のtickは未分析課題の分析、Slack通知、修正依頼の改訂、承認済みの実行ゲートを進めます。
1 tickでは観測→分析→Slack通知を繰り返し、未分析課題か当日proposal予算が尽きるか、実行時間予算（180秒）に達したところで止めます。残りは次のtickで続きます。
修正依頼の改訂は次のtickで処理するため、Slack再提案まで最大約1時間です。急ぐ場合はCron APIを手動実行してください。
提案0件のtickでは、Slackの実行結果通知に見送り理由と未分析課題数が入ります。
Vercel ダッシュボードの Cron / Function ログで実行有無も確認してください。

## 7. 運用上の注意

- GSC・Slack・Service Accountの秘密情報をdocsやレポートへ書かない
- 通常運用は`SEO_LOOP_EXECUTION_ENABLED=true`。異常時は`false`へ戻してDB書き込みだけを即時停止する
- `SEO_RULEBOOK_SHADOW_ENABLED=false` の間はshadow評価・指標更新・昇格操作を行わない
- Type Aの実行はAllowlist Executorのみ
- Type Bは本番ソースを書き換えず、提案として保存する
- `revision_requested`のfeedbackはuntrusted dataとして扱い、固定actionの改訂proposalを別行で生成して再度品質ゲート・人間承認へ送る
- 改訂の非一時的な生成失敗は最大3回で停止し、`revision_error`へ理由を残す。復旧時は原因修正後に対象proposalの`revision_retry_count=0`、`revision_next_action_at=now()`へ戻す

## 8. Unit 9の適用・段階リリース

既存環境へ導入する際は、Slackカード操作とmigration/deployの競合を避けるため次の順に行います。

1. Vercelで`SEO_RULEBOOK_PATCH_ENABLED=false`、`SEO_RULEBOOK_SHADOW_ENABLED=false`にして再デプロイする
2. `add-seo-loop-shadow-rollouts.sql`をSupabase SQL Editorで適用する
3. Unit 9コードをデプロイする
4. `npm run seo:rulebook:status`でactive版のhash整合性と`rollout: null`を確認する
5. Vercelで`SEO_RULEBOOK_PATCH_ENABLED=true`、`SEO_RULEBOOK_SHADOW_ENABLED=true`にして再デプロイする
6. Typed Executor本番化後は`SEO_LOOP_EXECUTION_ENABLED=true`。異常時は`false`へ戻す

第二承認後は`npm run seo:rulebook:status`の`rollout`で`shadowing`、run数、評価proposal数、判断数、5指標を確認できます。最低7 run・10 proposal・主系とshadow対象それぞれ5実判断に達するまでは昇格しません。基準達成時は`ready`になり、Slackへ最終昇格カードを1回だけ送ります。

shadow評価は同一proposalの比較専用で、Slack proposalカードやExecutorへは流れません。shadow処理で一時障害が起きても主系処理は継続します。障害が続く場合は`SEO_RULEBOOK_SHADOW_ENABLED=false`にして再デプロイし、active版を維持したまま調査します。

昇格直後はactive版のschema/hashを再検査し、失敗時は自動rollbackを要求します。運用中の異常は次で直前版へ戻します。

```bash
npm run seo:rulebook:status -- --rollback-current --yes --actor=Uxxxxxxxx
```

rollback後も既存run bindingは固定されたままです。次のrunから戻したactive版を使用します。
