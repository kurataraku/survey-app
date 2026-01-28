# 会社ページ用アセット

`https://careeressence.jp/` の会社トップで利用する画像をこのフォルダに配置してください。

## 必要なファイル

| ファイル名 | 用途 | 推奨 |
|-----------|------|------|
| `logo.png` | ヘッダー用会社ロゴ | 横長推奨（例: 幅 160px 以上、高さ 40px 程度） |
| `rep-photo.jpg` または `rep-photo.svg` | 代表取締役の顔写真 | 正方形に近い比率（例: 300×300px 以上）。未配置時は `rep-photo.svg` のプレースホルダーを使用 |

## 配置手順

1. 上記ファイルを `public/company/` に保存する。
2. ヘッダーは現在テキストロゴです。`logo.png` を配置したあと、  
   `app/company/layout.tsx` のロゴ部分を `<Image src="/company/logo.png" … />` に差し替えて利用できます。
3. 代表写真は `rep-photo.jpg` または `rep-photo.svg` を配置してください。未配置時は `rep-photo.svg` プレースホルダーが表示されます。実写真を使う場合は `rep-photo.jpg` を配置し、`lib/company-content.ts` の `EXECUTIVE.photoPath` を `'/company/rep-photo.jpg'` に変更してください。

## 注意

- 電話番号・SNS・採用情報は掲載しない方針です。
