# 環境変数の確認ガイド

## ステップ3: 環境変数の確認（詳細版）

### 確認すべき環境変数

以下の4つの環境変数が正しく設定されているか確認します：

1. `NEXT_PUBLIC_SUPABASE_URL` - SupabaseプロジェクトのURL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabaseの公開キー（anon key）
3. `SUPABASE_SERVICE_ROLE_KEY` - Supabaseのサービスロールキー（機密情報）
4. `NEXT_PUBLIC_SITE_URL` - 本番環境のサイトURL

---

## 確認方法1: ローカル環境（開発環境）

### 1-1. .env.localファイルの確認

1. **プロジェクトのルートディレクトリを開く**
   - `survey-app`フォルダを開く

2. **`.env.local`ファイルを開く**
   - ファイルが見つからない場合は作成してください

3. **以下の内容が含まれているか確認**

```env
# Supabase設定（開発環境）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx

# サイトURL（開発環境では localhost でもOK）
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 1-2. 環境変数の値が正しいか確認

#### NEXT_PUBLIC_SUPABASE_URL の確認

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com にログイン
   - プロジェクトを選択

2. **Settings → API を開く**
   - 左メニューから「Settings」→「API」をクリック

3. **Project URL を確認**
   - 「Project URL」の値をコピー
   - `.env.local`の`NEXT_PUBLIC_SUPABASE_URL`と一致しているか確認
   - 形式: `https://xxxxxxxxxxxxx.supabase.co`

#### NEXT_PUBLIC_SUPABASE_ANON_KEY の確認

1. **Settings → API を開く**
   - 上記と同じ画面

2. **anon public キーを確認**
   - 「anon public」の「Reveal」ボタンをクリック
   - 表示されたキーをコピー
   - `.env.local`の`NEXT_PUBLIC_SUPABASE_ANON_KEY`と一致しているか確認
   - 形式: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`で始まる長い文字列

#### SUPABASE_SERVICE_ROLE_KEY の確認

1. **Settings → API を開く**
   - 上記と同じ画面

2. **service_role キーを確認**
   - 「service_role」の「Reveal」ボタンをクリック
   - 表示されたキーをコピー
   - `.env.local`の`SUPABASE_SERVICE_ROLE_KEY`と一致しているか確認
   - ⚠️ **このキーは機密情報です。絶対に公開しないでください**

#### NEXT_PUBLIC_SITE_URL の確認

- **開発環境**: `http://localhost:3000` で問題ありません
- **本番環境**: 実際のドメイン（例: `https://yourdomain.com`）を設定してください

### 1-3. 環境変数が読み込まれているか確認

1. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

2. **ブラウザで確認**
   - http://localhost:3000 にアクセス
   - ページが正常に表示されれば環境変数は読み込まれています

3. **エラーが出る場合**
   - ブラウザのコンソール（F12）でエラーを確認
   - ターミナルのエラーメッセージを確認
   - 環境変数が正しく設定されているか再確認

---

## 確認方法2: 本番環境（Vercelの場合）

### 2-1. Vercelダッシュボードで確認

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com にログイン
   - プロジェクトを選択

2. **Settings → Environment Variables を開く**
   - 左メニューから「Settings」をクリック
   - 「Environment Variables」をクリック

3. **環境変数が設定されているか確認**

以下の4つの環境変数が設定されているか確認：

| 環境変数名 | 値の例 | 必須 |
|-----------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxxxxxxx.supabase.co` | ✅ 必須 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | ✅ 必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | ✅ 必須 |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | ✅ 必須（本番環境） |

### 2-2. 環境ごとの設定確認

Vercelでは、環境ごとに異なる値を設定できます：

- **Production**: 本番環境用の値
- **Preview**: プレビュー環境用の値
- **Development**: 開発環境用の値（通常は使用しない）

**重要**: 本番環境（Production）では、開発環境のSupabase URLが設定されていないか確認してください。

#### 確認方法

1. **各環境変数の「Environment」列を確認**
   - Productionにチェックが入っているか確認
   - Previewにチェックが入っているか確認

2. **本番環境のSupabase URLを確認**
   - `NEXT_PUBLIC_SUPABASE_URL`の値が本番環境のSupabaseプロジェクトのURLか確認
   - 開発環境のURL（例: `localhost`を含む）が設定されていないか確認

### 2-3. 環境変数の追加・編集方法

#### 環境変数を追加する場合

1. **「Add New」ボタンをクリック**
2. **Key**に環境変数名を入力（例: `NEXT_PUBLIC_SITE_URL`）
3. **Value**に値を入力（例: `https://yourdomain.com`）
4. **Environment**で適用する環境を選択（Production, Preview, Development）
5. **「Save」ボタンをクリック**

#### 環境変数を編集する場合

1. **編集したい環境変数の右側の「...」をクリック**
2. **「Edit」を選択**
3. **値を変更**
4. **「Save」ボタンをクリック**

### 2-4. デプロイ後の確認

環境変数を追加・編集した後は、再デプロイが必要です：

1. **自動再デプロイ**
   - 環境変数を保存すると、自動的に再デプロイが開始されます

2. **手動再デプロイ**
   - 「Deployments」タブから最新のデプロイを選択
   - 「Redeploy」ボタンをクリック

3. **デプロイ後の確認**
   - 本番環境のサイトにアクセス
   - ページが正常に表示されるか確認
   - エラーが出ないか確認

---

## 確認方法3: 本番環境と開発環境の分離確認

### 3-1. 接続先DBが混ざらないようにする確認

#### 開発環境（ローカル）

- `.env.local`の`NEXT_PUBLIC_SUPABASE_URL`が開発用のSupabaseプロジェクトを指しているか確認
- 例: `https://dev-project-xxxxx.supabase.co`

#### 本番環境（Vercel）

- Vercelの環境変数`NEXT_PUBLIC_SUPABASE_URL`が本番用のSupabaseプロジェクトを指しているか確認
- 例: `https://prod-project-xxxxx.supabase.co`

### 3-2. 確認クエリ

以下のクエリで、現在接続しているSupabaseプロジェクトを確認できます：

1. **Supabaseダッシュボードで確認**
   - 各プロジェクトの「Settings」→「API」で「Project URL」を確認
   - 開発環境と本番環境で異なるURLになっているか確認

2. **アプリケーション側で確認**
   - 開発環境: `http://localhost:3000` にアクセス
   - 本番環境: `https://yourdomain.com` にアクセス
   - それぞれ異なるデータが表示されるか確認

---

## 確認方法4: 環境変数の検証スクリプト

### 4-1. 検証スクリプトの作成

以下のスクリプトで環境変数を確認できます：

```typescript
// scripts/check-env.ts (新規作成)
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

console.log('=== 環境変数の確認 ===\n');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
];

let allSet = true;

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // 機密情報は一部のみ表示
    if (varName.includes('KEY')) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未設定`);
    allSet = false;
  }
});

console.log('\n=== 確認結果 ===');
if (allSet) {
  console.log('✅ すべての環境変数が設定されています');
} else {
  console.log('❌ 一部の環境変数が設定されていません');
  process.exit(1);
}

// 本番環境のチェック
const env = process.env.NODE_ENV || 'development';
if (env === 'production') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    console.log('\n⚠️ 警告: 本番環境で開発用のSupabase URLが設定されています');
    process.exit(1);
  }
}
```

### 4-2. スクリプトの実行

```bash
npm run check-env
```

---

## チェックリスト

### ローカル環境（開発環境）

- [ ] `.env.local`ファイルが存在する
- [ ] `NEXT_PUBLIC_SUPABASE_URL`が設定されている
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`が設定されている
- [ ] `SUPABASE_SERVICE_ROLE_KEY`が設定されている
- [ ] `NEXT_PUBLIC_SITE_URL`が設定されている（開発環境では`http://localhost:3000`でOK）
- [ ] 開発サーバーが正常に起動する
- [ ] ブラウザでページが正常に表示される

### 本番環境（Vercel）

- [ ] Vercelダッシュボードで環境変数が設定されている
- [ ] `NEXT_PUBLIC_SUPABASE_URL`が本番環境のSupabaseプロジェクトを指している
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`が本番環境のSupabaseプロジェクトのキー
- [ ] `SUPABASE_SERVICE_ROLE_KEY`が本番環境のSupabaseプロジェクトのキー
- [ ] `NEXT_PUBLIC_SITE_URL`が本番環境のドメイン（例: `https://yourdomain.com`）
- [ ] 本番環境のサイトが正常に表示される
- [ ] 開発環境と本番環境で異なるSupabaseプロジェクトに接続している

---

## トラブルシューティング

### エラー: "Supabase環境変数が設定されていません"

**原因**: 環境変数が正しく読み込まれていない

**解決策**:
1. `.env.local`ファイルがプロジェクトルートにあるか確認
2. 環境変数の名前が正しいか確認（大文字小文字、アンダースコアなど）
3. 開発サーバーを再起動（環境変数を変更した後は再起動が必要）

### エラー: "本番環境で開発用のSupabase URLが設定されています"

**原因**: 本番環境で開発用のSupabase URLが設定されている

**解決策**:
1. Vercelの環境変数を確認
2. `NEXT_PUBLIC_SUPABASE_URL`が本番環境のSupabaseプロジェクトを指しているか確認
3. 必要に応じて環境変数を修正して再デプロイ

### データが表示されない

**原因**: 接続先のSupabaseプロジェクトが間違っている可能性

**解決策**:
1. 現在接続しているSupabaseプロジェクトを確認
2. 開発環境と本番環境で異なるプロジェクトに接続しているか確認
3. 各環境のSupabaseプロジェクトにデータが存在するか確認
