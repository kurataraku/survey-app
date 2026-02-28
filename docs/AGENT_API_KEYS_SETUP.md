# エージェント用 API キーの設定方法

AI エージェント（`scripts/agent-setup.ts`）と管理 API を動かすために、次の2つの環境変数を設定します。

---

## 1. AGENT_API_KEY（自分で作る秘密キー）

**用途**: CLI や外部ツールが管理 API を呼ぶときの認証。Cookie の代わりにこのキーを `Authorization: Bearer <キー>` で送る。

**設定手順**:

1. 長いランダム文字列を1つ用意する（推奨: 32文字以上）
2. プロジェクトルートの `.env.local` に次の1行を追加する

```env
AGENT_API_KEY=ここにあなたの秘密文字列を貼る
```

**キーの作り方（例）**:

- **PowerShell（Windows）**  
  `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`
- **Node.js**  
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- **手動**  
  英数字と記号を混ぜた長い文字列（例: `MySecretAgentKey2025XyZ!@#`）でも可

**注意**:
- このキーを知られると、誰でも管理 API を叩けるようになります
- `.env.local` は Git にコミットしないでください（`.gitignore` 済み）
- 本番環境（Vercel 等）でエージェントを動かす場合も、その環境の「環境変数」に同じ `AGENT_API_KEY` を設定してください

---

## 2. PERPLEXITY_API_KEY（Perplexity から発行されるキー）

**用途**: 学校の公式サイトを検索して `summary_text`（概要）を生成するときに、Perplexity Sonar API を呼ぶため。

**設定手順**:

1. **Perplexity に登録**  
   - https://www.perplexity.ai/ にアクセス  
   - Google / Apple / メールでアカウント作成

2. **API 用のクレジットを用意**  
   - ログイン後、アカウント設定や「API」のページへ  
   - 有料プラン（Pro 等）または API 用クレジットの購入が必要です  
   - 公式: https://docs.perplexity.ai/ で最新の料金・手順を確認してください

3. **API キーを発行**  
   - ダッシュボードの「API」→「API Keys」などから「Create key」を実行  
   - 表示されたキー（`pplx-xxxx...` のような形式）をコピー

4. **`.env.local` に追加**

```env
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxx
```

**注意**:
- キーは再表示できないことが多いので、発行直後に安全な場所に控えておいてください
- 使わない場合は `callPerplexityForSummary` を呼ばない運用にすれば、このキーがなくてもエージェントは動きます（summary_text だけ生成されません）

---

## 設定後の確認

1. `.env.local` を保存する
2. 開発サーバーを再起動する（`npm run dev` を止めてから再度実行）
3. エージェントを実行する  
   - 単一学校:  
     `npx tsx scripts/agent-setup.ts --school-id=<学校のUUID>`  
   - 全校（ドライラン）:  
     `npx tsx scripts/agent-setup.ts --all --dry-run`

`AGENT_API_KEY` が未設定のときは、CLI が「AGENT_API_KEY が環境変数に設定されていません」と表示して終了します。  
`PERPLEXITY_API_KEY` が未設定のときは、summary 生成ステップでエラーになります。

---

## 本番・Vercel で使う場合

- **AGENT_API_KEY**: Vercel の「Project → Settings → Environment Variables」に追加（Production / Preview どちらで使うか選択）
- **PERPLEXITY_API_KEY**: 同上
- CLI で本番 API を叩くときは、`AGENT_BASE_URL` に本番 URL を指定する  
  - 例: `AGENT_BASE_URL=https://your-domain.com npx tsx scripts/agent-setup.ts --all --dry-run`
