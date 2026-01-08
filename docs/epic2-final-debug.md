# Epic2: ページ遷移404エラーの最終デバッグ

## 現在の状況

- SQLでslugは正しく設定されている（`g高校`、`s高`など）
- URLエンコーディングの問題は修正済み
- まだ404エラーが発生している

## デバッグ手順

### Step 1: 開発サーバーを再起動

1. ターミナルで `Ctrl + C` を押して開発サーバーを停止
2. `npm run dev` で再起動

### Step 2: ブラウザのコンソールでログを確認

1. ブラウザのページを完全にリロード（Ctrl + F5）
2. F12キーで開発者ツールを開く
3. 「Console」タブを開く
4. 学校カードをクリック
5. コンソールに表示されるログを確認：

```
[SchoolCard] clicked: { id: "...", name: "...", slug: "...", slug_type: "...", slug_length: ..., href: "/schools/..." }
```

### Step 3: サーバーのログを確認

開発サーバーが起動しているターミナルで、以下のようなログが表示されるか確認：

```
[API] /api/schools/[slug] - Received slug: ...
[API] /api/schools/[slug] - Decoded slug: ...
```

もし404エラーの場合：

```
[API] /api/schools/[slug] - School not found. Error: ...
[API] /api/schools/[slug] - Searching for slug: ...
[API] /api/schools/[slug] - Available slugs: [...]
```

### Step 4: ログの内容を確認

以下の情報を確認してください：

1. **SchoolCardのログ**:
   - `slug`の値（`null`か、実際の値か）
   - `href`の値（正しいURLか）

2. **APIのログ**:
   - `Received slug`: URLパラメータから受け取ったslug
   - `Decoded slug`: デコード後のslug
   - `Available slugs`: データベースに存在するslugの一覧

### Step 5: 不一致を確認

もし`Decoded slug`と`Available slugs`が一致しない場合、以下の可能性があります：

1. **slugの大文字小文字の問題**
   - データベースのslugが`g高校`（小文字）なのに、リクエストが`G高校`（大文字）になっている
   - → 解決策: SQLでslugを小文字に統一する（既に実施済み）

2. **slugに余分な文字が含まれている**
   - スペースや特殊文字が含まれている
   - → 解決策: SQLでslugを再生成する

3. **slugがnullの場合**
   - フロントエンドで`slug`が`null`の場合、IDベースのURLにフォールバックするはずですが、それでも動作しない場合
   - → 解決策: IDベースのAPIルートが正しく動作しているか確認

## 次のステップ

上記のログを確認したら、その内容を共有してください。それに基づいて、具体的な修正方法を提案します。















