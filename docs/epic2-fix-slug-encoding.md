# Epic2: slugエンコーディング修正

## 問題

`app/schools/[slug]/page.tsx`で、デコード済みの`slug`をそのままURLに使用しているため、特殊文字が含まれる場合に正しく動作しない可能性があります。

## 修正内容

`fetch`のURLと`Link`の`href`で、`slug`を`encodeURIComponent`でエンコードする必要があります。





