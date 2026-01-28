# ドメイン移行前のSEO確認事項と事前準備チェックリスト

このドキュメントは、Vercelからお名前ドットコムへのドメイン移行を実施する前に、SEO上の懸念点を確認し、事前準備を行うためのチェックリストです。

## ⚠️ 重要なSEO上の懸念点

### 1. インデックス状況の確認（最優先）

**実施内容**:
- [ ] 旧サイト（STUDIO）の現在のインデックス状況を確認
  - Google検索で `site:旧ドメイン` を実行してインデックス数を確認
  - 主要ページがインデックスされているか確認
- [ ] 現在のVercelサブドメイン（real-review.vercel.app）のインデックス状況を確認
  - `site:real-review.vercel.app` で検索
  - もしインデックスされている場合、移行前にnoindex設定を確認
- [ ] 主要ページのURLリストを作成
  - 学校詳細ページ（/schools/[slug]）
  - 口コミ詳細ページ（/reviews/[id]）
  - 特集記事（/features/[slug]）
  - その他の主要ページ

**確認方法**:
```bash
# Google検索で確認
site:旧ドメイン
site:real-review.vercel.app
```

### 2. 外部リンクの確認

**実施内容**:
- [ ] 旧サイトへの外部リンクを調査
  - Google Search Console（旧サイト）で「リンク」レポートを確認
  - 主要な被リンク元をリスト化
- [ ] 重要な外部リンク元を特定
  - 教育関連サイト
  - SNS（Twitter、Facebook等）
  - ブックマークサイト
  - その他のメディア

**注意点**:
- 301/308リダイレクトにより、リンクジュースは新ドメインに引き継がれますが、移行後も監視が必要です

### 3. ソーシャルシェアの影響確認

**実施内容**:
- [ ] OGP（Open Graph）の設定を確認
  - 現在のOGP画像URLが相対パスか絶対パスか確認
  - 移行後もOGP画像が正しく表示されるか確認
- [ ] Twitter Cardの設定を確認
- [ ] 既存のソーシャルシェア数を記録（参考値として）

**確認箇所**:
- `app/layout.tsx`の`metadata.openGraph`
- 各ページの`generateMetadata`でのOGP設定

### 4. 構造化データの確認

**実施内容**:
- [ ] 現在の構造化データ（JSON-LD）を確認
  - Organizationスキーマ
  - WebSiteスキーマ
  - その他のスキーマ（Article、Review等）
- [ ] 構造化データ内のURLが環境変数ベースになっているか確認
  - `getSiteUrl()`を使用しているか確認

**確認箇所**:
- `app/layout.tsx`の構造化データ
- `components/StructuredData.tsx`

### 5. サイトマップの確認

**実施内容**:
- [ ] 現在のサイトマップ（sitemap.xml）を確認
  - `https://real-review.vercel.app/sitemap.xml` にアクセス
  - URLが正しく生成されているか確認
  - 動的ページ（学校、口コミ、記事）が含まれているか確認
- [ ] サイトマップのURL数と主要ページの包含を確認

**確認方法**:
```bash
# サイトマップをダウンロードして確認
curl https://real-review.vercel.app/sitemap.xml
```

### 6. robots.txtの確認

**実施内容**:
- [ ] 現在のrobots.txtを確認
  - `https://real-review.vercel.app/robots.txt` にアクセス
  - 適切なdisallow設定があるか確認
  - sitemap.xmlのURLが正しいか確認

### 7. パフォーマンスへの影響確認

**実施内容**:
- [ ] リダイレクトチェーンの防止を確認
  - middlewareとnext.config.tsのリダイレクトが重複していないか
  - 1回のリダイレクトで最終URLに到達できるか
- [ ] リダイレクトのパフォーマンス影響を評価
  - 301/308リダイレクトは軽量だが、多数のリダイレクトは避ける

### 8. 重複コンテンツ対策の確認

**実施内容**:
- [ ] canonical URLの設定を確認
  - 現在の実装でcanonicalが設定されているか確認
  - 未設定の場合は実装が必要
- [ ] vercel.appドメインでのnoindex設定を確認
  - middlewareで`X-Robots-Tag: noindex`を付与する予定

## 📋 事前準備チェックリスト

### 技術的な準備

- [ ] **環境変数の準備**
  - `NEXT_PUBLIC_SITE_URL=https://careeressence.jp` をVercelの環境変数に設定
  - 本番環境とプレビュー環境で適切に設定されているか確認

- [ ] **DNSレコードの確認**
  - お名前ドットコムで現在のDNSレコードを確認
  - MXレコード（メール用）を記録（削除しないため）
  - SPF/DKIMレコード（メール認証用）を記録

- [ ] **Vercelでのドメイン追加準備**
  - Vercelのダッシュボードでドメイン追加の手順を確認
  - 必要なDNSレコード（A/CNAME/TXT）を記録

### サーチコンソール関連（後で実施予定）

- [ ] **Google Search Consoleの準備**
  - 新ドメイン（careeressence.jp）をSearch Consoleに追加
  - 所有権の確認方法を準備（DNS/TXTレコードまたはHTMLファイル）
  - 旧ドメインのSearch Consoleデータをエクスポート（参考用）

- [ ] **サイトマップの再送信**
  - 移行後、新ドメインのSearch Consoleでサイトマップを送信
  - `https://careeressence.jp/sitemap.xml` を送信

### 監視・分析の準備

- [ ] **アナリティクスの確認**
  - Google Analytics等の設定を確認
  - ドメイン変更後のトラッキングが正しく動作するか確認
  - 現在のコードベースにアナリティクスが実装されているか確認

- [ ] **監視ツールの準備**
  - リダイレクトの動作確認方法を準備
  - 404エラーの監視方法を準備
  - パフォーマンス監視の準備

### コンテンツの確認

- [ ] **内部リンクの確認**
  - サイト内のリンクが相対パスか絶対パスか確認
  - 絶対パスの場合、移行後に更新が必要か確認
  - 現在のコードベースではNext.jsの`Link`コンポーネントを使用しているため、相対パスで問題なし

- [ ] **画像・アセットの確認**
  - 画像URLが相対パスか絶対パスか確認
  - CDNを使用している場合、ドメイン変更の影響を確認

## 🚨 実装前に特に注意すべき点

### 1. リダイレクトチェーンの防止

**懸念点**:
- middlewareとnext.config.tsのリダイレクトが重複すると、リダイレクトチェーンが発生する可能性
- 例: `/tsushin-kuchikomi/schools/xxx` → middlewareでリダイレクト → next.config.tsでもリダイレクト

**対策**:
- middlewareでホスト正規化のみを実施
- next.config.tsで旧URLパスのリダイレクトを実施
- 両方が同時に発動しないよう、処理順序を確認

### 2. vercel.appドメインのインデックス防止

**懸念点**:
- 移行前にvercel.appドメインがインデックスされている場合、重複コンテンツとして評価される可能性

**対策**:
- middlewareでvercel.appドメインにアクセスした場合、`X-Robots-Tag: noindex`を付与
- リダイレクトと併用することで、確実にインデックスを防止

### 3. 旧URLの404エラー

**懸念点**:
- `/tsushin-kuchikomi/:path*`へのアクセスが404になると、SEO的にマイナス

**対策**:
- 必ず308リダイレクトを設定
- リダイレクト先が存在しないページの場合でも、トップページではなく適切なページ（学校一覧等）にリダイレクト

### 4. サイトマップの更新タイミング

**懸念点**:
- 移行直後にサイトマップが更新されないと、検索エンジンが新URLを認識しない

**対策**:
- 移行後、すぐにSearch Consoleでサイトマップを再送信
- サイトマップの`lastModified`が適切に更新されているか確認

### 5. パフォーマンスへの影響

**懸念点**:
- 多数のリダイレクトが発生すると、ページ読み込み速度に影響

**対策**:
- リダイレクトは1回のみで最終URLに到達するよう設計
- 301/308リダイレクトは軽量だが、過度なリダイレクトは避ける

## 📝 移行後の確認事項（実装後に実施）

### 即座に確認（移行直後）

- [ ] リダイレクトの動作確認
  - `www.careeressence.jp` → `careeressence.jp` にリダイレクト
  - `real-review.vercel.app` → `careeressence.jp` にリダイレクト
  - `/tsushin-kuchikomi/schools/xxx` → `/schools/xxx` にリダイレクト

- [ ] canonical URLの確認
  - 主要ページでcanonicalが正しく設定されているか確認
  - `https://careeressence.jp` が正しく設定されているか確認

- [ ] サイトマップの確認
  - `https://careeressence.jp/sitemap.xml` が正しく生成されているか確認
  - すべてのURLがapexドメインになっているか確認

- [ ] robots.txtの確認
  - `https://careeressence.jp/robots.txt` が正しく生成されているか確認

### 1週間以内に確認

- [ ] Google Search Consoleでの確認
  - 新ドメインのインデックス状況を確認
  - 404エラーの有無を確認
  - リダイレクトエラーの有無を確認

- [ ] パフォーマンスの確認
  - Core Web Vitalsの確認
  - ページ読み込み速度の確認

### 1ヶ月以内に確認

- [ ] インデックス数の推移を確認
  - 旧ドメインから新ドメインへの移行が進んでいるか確認
  - 主要ページが新ドメインでインデックスされているか確認

- [ ] 検索順位の確認
  - 主要キーワードでの検索順位を確認
  - 順位の大幅な下落がないか確認

## 🔗 参考リンク

- [Google Search Console](https://search.google.com/search-console)
- [Googleのサイト移行ガイド](https://developers.google.com/search/docs/crawling-indexing/site-moves-with-url-changes)
- [Next.js Redirects Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/redirects)

## 📌 注意事項

1. **DNS変更の反映時間**: DNSレコードの変更は、最大48時間かかる場合があります。即座に反映されない場合は、しばらく待ってから確認してください。

2. **SSL証明書**: Vercelが自動的にSSL証明書を発行しますが、反映まで数分〜数時間かかる場合があります。

3. **キャッシュ**: ブラウザやCDNのキャッシュにより、変更が即座に反映されない場合があります。ハードリロード（Ctrl+Shift+R）で確認してください。

4. **段階的移行**: 可能であれば、テスト環境で動作確認してから本番環境に適用することを推奨します。
