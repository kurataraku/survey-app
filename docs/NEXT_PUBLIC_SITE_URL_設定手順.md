# NEXT_PUBLIC_SITE_URL の設定手順

検索エンジンやSNSシェアで正しいURL（canonical・OGP）を出すために、**本番のドメイン**を環境変数で指定します。

---

## 設定する値

- **本番サイトのURL** をそのまま書きます。
- 例: `https://example.com` や `https://careeressence.jp`
- **注意**: `https://` を付ける。末尾の `/` は付けない。

---

## 1. ローカル（自分のPCで開発するとき）

1. プロジェクトのルートに `.env.local` があるか確認する（なければ作成する）。
2. 次の1行を追加または編集する。

   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. 開発サーバーを再起動する（`npm run dev` を止めてからもう一度実行）。

ローカルでは `http://localhost:3000` のままで問題ありません。本番用のURLは **本番環境の環境変数** で設定します。

---

## 2. 本番（Vercel でデプロイしている場合）

### 手順

1. **Vercel にログイン**して、このプロジェクトを開く。
2. 画面上方の **「Settings」** をクリック。
3. 左メニューから **「Environment Variables」** をクリック。
4. **「Key」** に次の名前を**そのまま**入力する。
   ```
   NEXT_PUBLIC_SITE_URL
   ```
5. **「Value」** に **本番のURL** を入力する。
   - 例: `https://careeressence.jp` や `https://your-app.vercel.app`
   - `https://` を付ける。末尾の `/` は付けない。
6. **Environment** で **Production** にチェックを入れる（Preview/Development は必要なら付けてよい）。
7. **「Save」** をクリック。
8. **再デプロイする**  
   - 「Deployments」タブ → 最新のデプロイの「⋯」→ **Redeploy** を実行。  
   - 環境変数を変えたあとは、再デプロイしないと反映されません。

### 補足

- カスタムドメイン（例: `https://careeressence.jp`）を使っている場合は、そのURLを入れます。
- VercelのデフォルトURL（例: `https://xxx.vercel.app`）だけを使う場合は、そのURLを入れます。

---

## 3. 本番（Vercel 以外の場合）

- **Netlify**: Site settings → Environment variables で `NEXT_PUBLIC_SITE_URL` を追加。
- **自前サーバー / Docker**: 起動時に渡す環境変数に `NEXT_PUBLIC_SITE_URL=https://あなたのドメイン` を追加。

いずれも **本番用の環境** にだけ本番URLを設定し、**再デプロイまたは再起動** すると反映されます。

---

## 設定できているか確認する方法

1. 本番サイトで学校個別ページ（例: N高のページ）を開く。
2. ブラウザで **右クリック → 「ページのソースを表示」**（または Ctrl+U / Cmd+Option+U）。
3. ソース内で `<link rel="canonical"` または `og:url` を検索する。
4. そこに **本番のドメイン**（localhost や example.com 以外）が入っていればOKです。

例（正しく設定されている場合）:

```html
<link rel="canonical" href="https://careeressence.jp/tsushin-kuchikomi/schools/n-koukou-kuchikomi"/>
<meta property="og:url" content="https://careeressence.jp/tsushin-kuchikomi/schools/n-koukou-kuchikomi"/>
```

---

## よくある質問

**Q. ローカルでも本番URLを入れてよい？**  
A. 入れても動きますが、canonical が本番URLになり、ローカルで確認しづらくなります。ローカルは `http://localhost:3000` のままがおすすめです。

**Q. 値を変えたのに反映されない**  
A. `NEXT_PUBLIC_` 付きの変数は **ビルド時** に埋め込まれます。変更したら **必ず再デプロイ**（Vercelなら Redeploy）してください。

**Q. ベースパス（/tsushin-kuchikomi）は書く？**  
A. いいえ。`NEXT_PUBLIC_SITE_URL` には **ドメインまで** だけを書きます。例: `https://careeressence.jp`  
ベースパスはコード側で自動的に付与されます。
