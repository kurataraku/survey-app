# Vercel ドメイン（real-review.vercel.app）を実質クローズする手順

新ドメイン（careeressence.jp）へ移行したにもかかわらず、社員が `real-review.vercel.app` でアクセスしている場合の**原因**と**対策**です。  
SEO 的にも同一コンテンツが2つのドメインで見える状態は避け、vercel.app は「開いても必ず careeressence.jp に飛ぶ」状態にします。

---

## 1. 想定される原因

### 1-1. 本番でリダイレクトが無効になっている（最有力）

- **原因**: デバッグ用に **`SKIP_VERCEL_APP_REDIRECT`** を本番の環境変数に設定したまま、削除し忘れている。
- **結果**: `middleware.ts` が「vercel.app → careeressence.jp への 308 リダイレクト」を行わないため、`real-review.vercel.app` でそのままコンテンツが表示される。
- **根拠**: ドキュメント（`DOMAIN_MIGRATION_BROWSER_STEPS.md`）では「確認後、**Environment Variables** で `SKIP_VERCEL_APP_REDIRECT` を **削除** し、再度 **Redeploy** する」とあるが、削除されていない可能性がある。

### 1-2. 社内のブックマーク・共有リンクが旧 URL のまま

- 以前の URL（`https://real-review.vercel.app/tsushin-kuchikomi/...`）がブックマークや社内メモ・チャットに残っており、そのままアクセスしている。
- リダイレクトが有効であれば「開くと careeressence.jp に飛ぶ」だけで済むが、上記の通りリダイレクトがオフだと旧 URL のまま表示される。

### 1-3. 正式 URL の周知不足

- 移行後、「業務では careeressence.jp を使う」という案内が不十分で、検索結果や履歴から vercel.app にアクセスし続けている可能性。

### 1-4. Vercel の仕様（vercel.app は「消せない」）

- Vercel のプロジェクトには **デフォルトの `*.vercel.app` の URL が必ず付与**されます。この URL 自体を「削除」する機能はありません。
- できるのは **「アプリ側でリダイレクトする」** か **「Vercel の Domains でリダイレクト先を指定する」** のいずれかです。  
  → そのため「完全クローズ」は「vercel.app にアクセスしても中身を見せず、必ず careeressence.jp に飛ばす」という意味で実現します。

---

## 2. 対策（実施順）

### 対策 A. 本番でリダイレクトを確実に有効にする（最優先）

1. **Vercel ダッシュボード**で対象プロジェクトを開く。
2. **Settings** → **Environment Variables** を開く。
3. **`SKIP_VERCEL_APP_REDIRECT`** が **Production** に設定されていないか確認する。
4. **設定されていれば削除**し、**Save** する。
5. **Deployments** から **最新デプロイを Redeploy** する（環境変数変更後は自動で再デプロイされる場合もありますが、念のため確認）。
6. 確認: シークレットウィンドウで `https://real-review.vercel.app/tsushin-kuchikomi` を開く → **即座に `https://careeressence.jp/tsushin-kuchikomi` に 308 で飛べば OK**。

これで「vercel.app で中身を見る」ことはできず、SEO 上もリダイレクト時に `X-Robots-Tag: noindex` が付与されるため、vercel.app が実質クローズした状態になります。

---

### 対策 B. Vercel の Domains で vercel.app をリダイレクト先に設定する（二重の保険）

アプリの middleware に加え、**Vercel のドメイン設定**でも「vercel.app を別ドメインへリダイレクト」できます。  
middleware の不具合や環境変数の誤設定に備えた二重の保険として推奨します。

1. **Vercel** → 対象プロジェクト → **Settings** → **Domains** を開く。
2. 一覧に **`real-review.vercel.app`**（または表示されている `*.vercel.app` のドメイン）があることを確認する。
3. そのドメインの行で **「Redirect to Another Domain」**（または同等のリダイレクト設定）を選ぶ。
4. **307 Temporary Redirect**（または 308 Permanent Redirect）で、行き先を **`https://careeressence.jp`** に設定する。  
   （パスはそのまま引き継がれる設定になっているか、Vercel の UI に従って確認してください。）
5. 保存後、再度 `https://real-review.vercel.app/tsushin-kuchikomi` にアクセスして、careeressence.jp に飛ぶことを確認する。

※ Vercel の UI は時期により「Redirect」の項目名や場所が異なる場合があります。  
  「Domains」画面で該当ドメインの「…」メニューや「Edit」からリダイレクト先を指定できる箇所を探してください。

---

### 対策 C. 本番では SKIP_VERCEL_APP_REDIRECT を無視する（コード側の保険）✅ 実装済み

**本番環境（`VERCEL_ENV === 'production'`）では、たとえ環境変数に `SKIP_VERCEL_APP_REDIRECT` が設定されていてもリダイレクトを有効にする**ように `middleware.ts` で制御しています。  
誤って本番でオフにしたままにしても、vercel.app は必ず careeressence.jp に飛びます。  
（Preview や開発時のみ `SKIP_VERCEL_APP_REDIRECT` が効き、vercel.app で動作確認できます。）

---

### 対策 D. 社内周知とブックマークの更新

- **社内に正式な業務用 URL を案内する**  
  - 「通信制高校リアルレビュー」の業務では **`https://careeressence.jp/tsushin-kuchikomi`**（およびその配下）を使用すること。
- **ブックマーク・共有リンクの更新**  
  - `real-review.vercel.app` のブックマークは `careeressence.jp` の同じパスに付け直すよう依頼する。
- **必要なら社内マニュアル・FAQ を更新**  
  - 旧 URL の記載があれば、すべて新ドメインに差し替える。

---

## 3. SEO 面の整理

- **現状の問題**: vercel.app でコンテンツが表示されると、同じ内容が2つのドメインで存在していると見なされ、**重複コンテンツ**や**評価の分散**の原因になる。
- **対策後**:
  - vercel.app へのアクセスは **常に 308 で careeressence.jp に転送**される。
  - 転送時のレスポンスに **`X-Robots-Tag: noindex`** が付与される（`middleware.ts` の実装どおり）。
  - 検索エンジンは vercel.app をインデックスせず、正規のドメインは careeressence.jp に統一される。

既に **canonical** や **sitemap / robots.txt** が careeressence.jp 向けになっていれば、リダイレクトを確実にすることで、SEO 上の「2つある」問題は解消されます。

---

## 4. 確認チェックリスト

- [ ] Vercel の **Production** 環境変数から **`SKIP_VERCEL_APP_REDIRECT`** を削除した
- [ ] 削除後、**Redeploy** して本番に反映した
- [ ] `https://real-review.vercel.app/tsushin-kuchikomi` にアクセスすると、**308 で `https://careeressence.jp/tsushin-kuchikomi` に飛ぶ**ことを確認した
- [ ] （任意）Vercel の **Domains** で vercel.app を careeressence.jp へリダイレクトする設定を追加した
- [ ] 社内に **正式 URL は careeressence.jp** であることを周知した
- [ ] 必要に応じてブックマーク・社内ドキュメントの URL を新ドメインに更新した

---

## 5. まとめ

| 項目 | 内容 |
|------|------|
| **原因** | 本番で `SKIP_VERCEL_APP_REDIRECT` が有効のままになっている可能性が高い。加えてブックマーク・周知不足。 |
| **実質クローズの意味** | vercel.app の URL は Vercel の仕様で削除できないため、「開いたら必ず careeressence.jp にリダイレクトする」状態にすることでクローズとする。 |
| **最優先対応** | Vercel の本番環境変数で `SKIP_VERCEL_APP_REDIRECT` を削除し、Redeploy。 |
| **SEO** | リダイレクトが有効であれば、vercel.app には noindex が付き、重複コンテンツ問題は解消される。 |

この手順で、vercel ドメインのサイトを実質完全クローズし、社員の利用と SEO を新ドメインに統一できます。
