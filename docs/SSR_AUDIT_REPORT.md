# SSR状況 再調査レポート

> 最終更新: 改善余地ページをすべてSSR化済み

## 現在SSR化済み・維持されているページ

| ページ | ルート | generateStaticParams | Server Component | 状態 |
|--------|--------|---------------------|------------------|------|
| ランキング詳細 | `/rankings/[type]` | ✓ (6タイプ) | RankingCardServer | ● SSG |
| 特集記事詳細 | `/features/[slug]` | ✓ (69件) | MarkdownRenderer* | ● SSG |
| 学校個別 | `/schools/[slug]` | ✓ (612件) | SchoolDetailClient** | ● SSG |
| 学校別口コミ一覧 | `/schools/[slug]/reviews` | ✓ | SchoolReviewCard | ● SSG*** |
| 口コミ一覧 | `/reviews` | - | ReviewCardServer | サーバー描画 |
| ホーム（口コミ部分） | `/` | - | ReviewCardServer | サーバー描画 |

\* MarkdownRendererはClientだが、親がServerなので初期レンダリング時に含まれる  
\** SchoolDetailClientはClientだが、親がServerでデータ渡し、SSG時はビルドでHTML生成  
\*** searchParamsありのためビルド時はDynamic表示の可能性あり

---

## 要確認・改善余地ありのページ

### 1. 口コミ詳細 `/reviews/[id]`

| 項目 | 状態 |
|------|------|
| generateStaticParams | **なし**（Dynamic） |
| 本文の描画 | good_comment, bad_comment はページ内で直接描画 → **初期HTMLに含まれる** |
| Client Component | StarRatingDisplay, Chip, LikeButton, RatingDisplay（UIのみ） |
| リスク | 初回アクセス時にストリーミングで遅延の可能性。本文はServer側で描画されているため、実質的にはSSRされている |

**推奨**: 重要ページであれば `getReviewIds` + `generateStaticParams` を追加してSSG化を検討

---

### 2. 学校一覧 `/schools`

| 項目 | 状態 |
|------|------|
| generateStaticParams | なし（searchParamsのため不向き） |
| 一覧コンポーネント | SchoolCard（Client） |
| リスク | ClientだがデータはServerから渡されており、初回はサーバー描画される |

**推奨**: SchoolCardServerを作成して本文・学校名をServer Component化する選択肢あり

---

### 3. 都道府県別学校一覧 `/schools/prefecture/[prefecture]`

| 項目 | 状態 |
|------|------|
| generateStaticParams | **なし** |
| 一覧コンポーネント | SchoolCard（Client） |
| リスク | 同上。47都道府県分のSSG化は可能 |

**推奨**: `getPrefectures` + `generateStaticParams` で都道府県ページをSSG化可能

---

### 4. 特集一覧 `/features`

| 項目 | 状態 |
|------|------|
| generateStaticParams | なし（searchParams: page, category） |
| 一覧コンポーネント | ArticleCard（Client） |
| リスク | 同上。タイトル・抜粋はClientだが、初回はサーバー描画される |

**推奨**: ArticleCardServerを作成する選択肢あり

---

### 5. ホーム `/`

| 項目 | 状態 |
|------|------|
| 口コミ | ReviewCardServer ✓ |
| 学校 | SchoolCard（Client） |
| 特集 | ArticleCard（Client） |
| リスク | 口コミはSSR済み。学校・特集はClientだが初回はサーバー描画 |

---

## 静的レンダリングされるページ（SSR非該当）

- `/rankings` - 静的コンテンツのみ
- `/about`, `/terms`, `/privacy`, `/contact` - 静的

---

## 戻っている可能性が低い理由

1. **generateStaticParams** は以下の4ページで維持されている  
   - rankings/[type], features/[slug], schools/[slug], schools/[slug]/reviews  
2. **ReviewCardServer / SchoolReviewCard** は口コミ一覧・学校別口コミで使用継続  
3. **RankingCardServer** はランキング詳細で使用継続  

過去にSSRしたページが戻っている形跡は見つかっていません。

---

## 改善の優先度

| 優先度 | ページ | アクション |
|--------|--------|------------|
| 高 | `/reviews/[id]` | generateStaticParams + getReviewIds でSSG化 |
| 中 | `/schools/prefecture/[prefecture]` | generateStaticParams（47都道府県） |
| 低 | `/schools`, `/features` | SchoolCardServer, ArticleCardServer の導入検討 |

---

## 学校個別ページ ソース・SEOチェック（N高 ページソース）

> 最終更新: ページソース全文を基にSSR・クローラビリティを確認し、必要修正を実施

### 確認結果（良好な点）

| 項目 | 状態 |
|------|------|
| **SSR** | 主要コンテンツはすべて初期HTMLに含まれる（H1・評価・口コミ要約・目次・良い点・気になる点・詳細評価・みんなの傾向・注目の口コミ・評判の詳細・FAQ） |
| **非表示タブ** | 「みんなの傾向」は `class="hidden"` だがDOMに出力されているためクローラーが読める |
| **メタ** | title, description, keywords, robots, googlebot, canonical, og:*, twitter:* が出力されている |
| **構造化データ** | WebSite / Organization / SearchAction がルートで出力済み |
| **robots** | `index, follow` および googleBot の max-snippet 等が (survey)/layout で設定済み |

### 実施した修正

1. **metadataBase**  
   - ルート `app/layout.tsx` に `metadataBase: new URL(getAppBaseUrl())` を追加。  
   - 本番で `NEXT_PUBLIC_SITE_URL` を設定すれば canonical / og:url が正しい絶対URLになる。

2. **FAQPage 構造化データ**  
   - 学校個別ページで `faq_items` がある場合に、FAQPage の JSON-LD を出力するよう追加。  
   - Google の FAQ リッチリザルト対象とするため。

3. **robots.txt の sitemap URL**  
   - `sitemap` を `getSiteUrl()` のドメイン直下ではなく `getAppBaseUrl() + '/sitemap.xml'` に変更。  
   - ベースパス（`/tsushin-kuchikomi`）配下でサイトを提供している場合に正しい sitemap を指すようにした。

### 本番環境で必要な設定

- **NEXT_PUBLIC_SITE_URL** を本番ドメイン（例: `https://example.com`）に設定すること。  
  未設定または localhost のままの場合、canonical・og:url が localhost になり検索・SNSシェアで不適切になる。

### 補足（ソース上の軽微な点）

- `<div hidden="">` が body 直下にあるのは Next/React のテンプレート由来。hidden のため検索結果のメインコンテンツには影響しない。
- 末尾の RSC 用 `<script>` ペイロードは Next.js のクライアント hydration 用であり、クローラーは初期HTMLのテキストを評価するため問題なし。
