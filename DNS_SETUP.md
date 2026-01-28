# お名前ドットコム DNS 設定ガイド（careeressence.jp → Vercel）

Vercel に `careeressence.jp` と `www.careeressence.jp` をカスタムドメインとして追加したあと、**お名前ドットコム**の DNS 管理画面で、以下を設定してください。

## 事前準備

1. **Vercel でドメインを追加**
   - 対象プロジェクト → **Settings** → **Domains** → **Add**
   - `careeressence.jp` と `www.careeressence.jp` を追加
   - 追加後、各ドメインに表示される **DNS レコード**をメモする

2. **既存 DNS の確認**
   - お名前ドットコムで現在の DNS レコードを一覧し、**MX / SPF / DKIM などメール用のレコードは削除・変更しない**
   - Web 用（A / CNAME / 必要に応じて TXT）のみ追加・変更する

## Web 用 DNS レコード（Vercel 向け）

Vercel の **Domains** 画面に表示される値が優先です。以下は一般的な例です。

### 1. apex ドメイン（careeressence.jp）

| タイプ | ホスト / 名前 | 値 / 内容 | TTL（任意） |
|--------|----------------|-----------|-------------|
| **A**  | `@`            | `76.76.21.21` | 60 など |

- ホストが `@` または `careeressence.jp` の場合は、apex 用の A レコード
- 値は Vercel で案内されている IP（上記は Vercel の代表的な Anycast IP）を使用

### 2. www サブドメイン（www.careeressence.jp）

| タイプ   | ホスト / 名前 | 値 / 内容                 | TTL（任意） |
|----------|----------------|---------------------------|-------------|
| **CNAME**| `www`          | `cname.vercel-dns.com` 等 | 60 など     |

- 値は **Vercel の Domains 画面に表示される CNAME のリンク先**に合わせてください  
  （例: `cname.vercel-dns.com` / `cname.vercel-dns-0.com` など、プロジェクトごとに異なる場合があります）

### 3. ドメイン所有権確認用 TXT（Vercel が要求する場合）

Vercel が TXT による確認を求める場合は、案内どおりに追加します。

| タイプ | ホスト / 名前 | 値 / 内容            | TTL（任意） |
|--------|----------------|----------------------|-------------|
| **TXT**| `@` または `_vercel` 等 | Vercel に表示される文字列 | 60 など     |

- ホスト名・値は **Vercel の Domains 画面の指示に必ず従って**設定してください

## 注意事項（必ず守ること）

1. **メール用レコードは触らない**
   - **MX**（メールサーバー）
   - **SPF**（TXT）
   - **DKIM**（TXT）
   - 上記は **削除・上書きしない**でください。Web 用の A / CNAME / TXT のみ追加・変更します。

2. **既存の A / CNAME の扱い**
   - 現在、apex や `www` に別の A / CNAME が設定されている場合は、**Vercel 用の値に置き換える**必要があります。
   - メール用とは別のレコードなので、MX / SPF / DKIM を残したまま、Web 用だけ差し替えて問題ありません。

3. **反映までは時間がかかる**
   - 変更後、反映に **最大 24〜48 時間**かかることがあります。
   - [whatsmydns.net](https://www.whatsmydns.net) などで `careeressence.jp` / `www.careeressence.jp` の A / CNAME を確認できます。

4. **SSL 証明書**
   - DNS が正しく Vercel を向くと、Vercel が自動で SSL 証明書を発行します。数分〜数十分かかる場合があります。

## お名前ドットコムでの操作の流れ（イメージ）

1. お名前.com にログイン → **ドメイン** → 対象の **careeressence.jp** を選択
2. **DNS 設定 / DNS レコード設定** を開く
3. 上記のとおり **A**（`@` → `76.76.21.21`）と **CNAME**（`www` → Vercel 表示どおり）を追加または修正
4. Vercel から TXT の追加を求められている場合は、案内どおり **TXT** を追加
5. 保存後、Vercel の **Domains** でドメインの状態を確認（「Valid Configuration」などになれば OK）

## 参考リンク

- [Vercel: Adding a domain](https://vercel.com/docs/projects/domains/add-a-domain)
- [Vercel: Working with DNS](https://vercel.com/docs/projects/domains/working-with-dns)
- [Vercel: Troubleshooting domains](https://vercel.com/docs/domains/troubleshooting)

---

**重要**: 実際に追加するレコードの **ホスト名・タイプ・値** は、必ず **Vercel の Domains 画面に表示されている内容** に合わせてください。プロジェクトや時期によって案内が異なる場合があります。
