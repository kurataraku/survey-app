# .env.localファイルの更新方法

## NEXT_PUBLIC_SITE_URLの追加

`.env.local`ファイルに`NEXT_PUBLIC_SITE_URL`を追加する方法です。

### 方法1: 手動で追加（推奨）

1. **プロジェクトのルートディレクトリを開く**
   - `survey-app`フォルダを開く

2. **`.env.local`ファイルを開く**
   - テキストエディタ（メモ帳、VS Codeなど）で開く

3. **ファイルの最後に以下を追加**

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **ファイルを保存**

### 方法2: 既存の設定を確認

`.env.local`ファイルに既に`NEXT_PUBLIC_SITE_URL`が含まれている場合：

- コメント行（`#`で始まる行）になっていないか確認
- 値が正しく設定されているか確認（`http://localhost:3000`）

### .env.localファイルの完全な例

```env
# ============================================
# Supabase設定
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx

# ============================================
# メール送信設定（お問い合わせ機能用）
# ============================================
EMAIL_SERVICE=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev

# ============================================
# サイトURL（開発環境）
# ============================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 確認方法

追加後、以下のコマンドで確認できます：

```bash
npm run check-env
```

または、開発サーバーを再起動して、エラーが出ないか確認してください。

### 注意事項

- `.env.local`ファイルは`.gitignore`に含まれているため、Gitにコミットされません
- 環境変数を変更した後は、開発サーバーを再起動する必要があります
- 本番環境（Vercel）では、Vercelダッシュボードで環境変数を設定してください
