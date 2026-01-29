# 会社ページ モダンデザイン刷新 - 変更サマリー

## 変更したファイル一覧

- `styles/theme.css`
- `app/company/layout.tsx`
- `app/company/page.tsx`

## 変更点の要約（見た目の改善ポイント）

### デザイントークン（theme.css）
- `--company-primary-hover`、`--company-shadow-header`、`--company-shadow-card-hover` を追加
- 余白・コンテナ: `--company-section-gap`、`--company-container-max`、`--company-gutter` 系を追加
- タイポグラフィ: `--company-font-size-hero`、`--company-font-size-h2`、`--company-font-size-body`、`--company-line-height-*` を追加

### ヘッダー（layout）
- 背景を半透明＋`backdrop-blur-md` に変更
- 常時軽い `box-shadow`（`--company-shadow-header`）を適用
- ナビのフォントを `font-semibold`、`gap-8` で視認性向上
- モバイルナビのタップ領域拡大（`px-4 py-2.5`）
- ロゴ・ナビ・CTA に `focus-visible:ring-2` でフォーカスリング付与
- コンテナ幅を `--company-container-max`（1024px）に統一

### フッター（layout）
- 余白を `py-16`、`gap-10` / `gap-8` に拡大
- 会社名・住所のフォントサイズ・`leading-relaxed` を調整
- リンクにフォーカスリング付与
- ボーダー色を `rgba(0,0,0,0.06)` に統一

### HERO（page）
- 背景に薄い `linear-gradient`（白→スレート系）を適用
- 右側に CSS のみの抽象図形（円・四角のグラデーション）を配置（lg 以上で表示）
- `h1` を `--company-font-size-hero`（clamp）で強化
- サブキャッチ・CTA 周りの余白を拡大
- CTA に `hover:bg-[--company-primary-hover]`、フォーカスリングを付与

### セクション見出し（page）
- VISION・MISSION: 英字ラベル（小・uppercase）＋ 日本語 `h2` の2段構成に変更
- サービス・代表紹介・お問い合わせ: 単一 `h2` のまま、`--company-font-size-h2` を適用
- セクション間に `--company-section-gap` で余白を付与

### サービスカード（page）
- 各カードに Lucide アイコン（通信制: GraduationCap、DX: Cpu、RPO: Users）を追加
- hover で `-translate-y-0.5`、`border`・`shadow` の変化を付与
- 「くわしく見る」に `focus-visible:ring-2`、`hover:bg-[--company-primary-hover]` を適用

### 代表紹介（page）
- 役職・名前・コメントの余白・`leading-relaxed` を整理
- 区切り線・パディングを微調整

### お問い合わせブロック（page）
- セクション全体の背景を `--company-bg-alt` に変更
- 内側コンテナの `padding` を `p-6 sm:p-10` に拡大
- CTA を `px-8 py-3.5`、`font-semibold` で強調し、フォーカスリング・hover を適用

## 主要ブレークポイントでの表示確認メモ

- **スマホ（375px）**: HERO 中央寄せ・装飾非表示、ナビ横スクロール、サービスカード縦積み、代表紹介縦積み、お問い合わせ CTA 全幅可。フォーカス・タップ領域問題なし。
- **タブレット（768px）**: ガター・余白・見出しサイズが意図どおり。サービス3カードは md でグリッド化。
- **PC（1024px）**: HERO 右側に抽象図形表示、コンテナ max-width 1024px で統一。ヘッダー・フッターのナビ・CTA が横並びで表示。

## 影響範囲

- **変更なし**: `app/(survey)/`、`components/Header`、`components/Footer`、`lib/company-content.ts`、ルーティング・リンク先・セクションID。
