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

## 4. Vercel / 環境変数

必須:

- `CRON_SECRET`
- `SEO_LOOP_ENABLED`
- `SEO_LOOP_EXECUTION_ENABLED`
- `GSC_SITE_URL`
- `GSC_SERVICE_ACCOUNT_KEY_JSON` または `GSC_SERVICE_ACCOUNT_KEY_PATH`
- `SLACK_BOT_TOKEN`
- `SLACK_SEO_CHANNEL_ID`
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
```

## 5. Supabase

`supabase-migrations/create-seo-loop-system.sql` をSupabase SQL Editorで適用します。

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
スケジュールは `vercel.json` の `17 23 * * *`（UTC）= 毎日 **日本時間 8:17** です。
1回のtickで観測→分析→Slack通知まで連続実行し、人間承認待ちで停止します。
承認後の実行ゲートは、次回以降のCron（または手動tick）で進みます。

## 7. 運用上の注意

- GSC・Slack・Service Accountの秘密情報をdocsやレポートへ書かない
- `SEO_LOOP_EXECUTION_ENABLED=false` の間は観測・提案までで止まる
- Type Aの実行はAllowlist Executorのみ
- Type Bは本番ソースを書き換えず、提案として保存する
