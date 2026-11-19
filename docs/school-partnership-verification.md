# 学校提携の検証・本番反映チェックリスト

`docs/school-partnership-setup.md` の手順を、実際に手を動かす順に落としたもの。
設定の点検は `npm run check:partnership`（`--env=` で参照する env ファイルを変えられる。DBは変更しない）。

## 手順の全体像

| # | やること | 担当 | 完了の判定 |
|---|---|---|---|
| 1 | 本番DBに `create-school-partnerships.sql` を適用 | 運営（SQL Editor） | `npm run check:partnership` でテーブル6・関数4・非公開バケットが揃う |
| 2 | `seed-partnership-verification.sql` を適用 | 運営（SQL Editor） | ダミー校A・Bが `is_public = false` で作られる |
| 3 | RPCレベルの通し検証 | 開発 | `npm run verify:partnership` が不合格0件 |
| 4 | 学校担当者用のSupabase認証プロジェクトを作成・設定 | 運営（ダッシュボード） | 第2節の設定が済み、URL・anonキー・service roleキーが手元にある |
| 5 | 環境変数を登録（学校認証3件・GA4 2件・SITE_URL） | 開発 | `npm run check:partnership` で認証プロジェクトの分離と新規登録の無効化が ✅ |
| 6 | 運営アカウントにTOTPを登録 | 運営（ブラウザ） | `/admin/partnerships` が二要素認証を求めずに開く |
| 7 | 実在の担当者を招待し、ログイン・TOTP登録・新着メールを確認 | 運営＋開発 | 招待メールが届き、学校向け画面に入れる |
| 8 | 画面からの通し確認（受付→公開→通知→自校閲覧→発送済み） | 運営＋開発 | 第5節の表の1〜9・13が期待どおり |
| 9 | 公開ページの確認（`is_public` を一時的に true） | 開発 | 第5節の表の10〜12が期待どおり。確認後すぐ false に戻す |
| 10 | 検証データの後片付け | 運営＋開発 | `cleanup-partnership-verification.sql` 実行、写真と学校認証のテストユーザー削除 |
| 11 | 提携の差分だけをコミットしてデプロイ | 開発 | 第0節の一覧のみがコミットされ、別件の未コミット変更が残っている |
| 12 | 事業側の判断事項を確定（第6節5〜6） | 運営 | 試験掲載期間・電話番号の扱い・発送目安・通知先・閲覧期限・保管削除ルールが決まる |
| 12.5 | `add-email-delivery-tracking.sql` を本番DBに適用し、cronの稼働を確認 | 開発 | `npm run check:partnership` で `email_deliveries` が揃い、不達がSlackに届く |
| 13 | 最初の1校を有効化 | 運営＋開発 | 第4節の手順で公式リンクと資料請求が公開される |

## 0. 今回の差分の範囲

学校提携として追加・変更したファイルは以下。作業ツリーには別件（MY STORY AWARD、X保護者アウトリーチ、
公式URL検証スクリプト、GA計測の整理、CSVインポート、AIプロンプト調整）の未コミット変更も混在しているため、
コミットするときはこの一覧だけを対象にする。

新規:
- `supabase-migrations/create-school-partnerships.sql`
- `docs/school-partnership-setup.md` / `docs/school-partnership-verification.md`
- `lib/partnerships/{model,server,notifications,analytics}.ts`
- `lib/analytics/private-path.ts`
- `app/(survey)/schools/[slug]/request/page.tsx`
- `app/school-portal/page.tsx` / `app/api/school-portal/route.ts`
- `app/admin/partnerships/page.tsx` / `app/api/admin/partnerships/route.ts`
- `app/api/material-requests/route.ts`
- `app/api/school-partnerships/photo/[id]/route.ts`
- `components/SchoolPartnershipCard.tsx` / `components/SchoolMaterialRequestForm.tsx`
- `components/partnerships/{SchoolPortal,PartnershipOperator,PartnershipMfa}.tsx` / `components/partnerships/auth.ts`
- `scripts/check-partnership-setup.ts` / `scripts/verify-partnership-flow.ts`
- `supabase-migrations/seed-partnership-verification.sql` / `supabase-migrations/cleanup-partnership-verification.sql`
- `supabase-migrations/add-email-delivery-tracking.sql`
- `lib/partnerships/delivery.ts` / `app/api/cron/partnership-email/route.ts`

変更（この機能に関係する差分のみ）:
- `app/(survey)/schools/[slug]/page.tsx`・`components/SchoolDetailClient.tsx` — 学校ページへの案内カード追加と、
  資料請求を受け付ける学校では既存の「資料請求の通知希望」CTAを出さない分岐
- `app/admin/schools/[id]/edit/page.tsx`・`components/AdminHeader.tsx` — 運営画面への導線
- `app/(survey)/privacy/page.tsx` — 取得項目・利用目的・第三者提供の追記
- `middleware.ts` — `/school-portal` をベースパス正規化の対象に追加
- `lib/analytics/events.ts` — `school_official_site_click` / `school_material_request_click`
- `lib/analytics/track.ts`・`components/{GoogleAnalytics,GoogleAnalyticsInit,AnalyticsEngagement}.tsx` —
  学校向け画面と資料請求画面をGA計測から除外（`isPrivateAnalyticsPath`）
- `lib/gsc/auth.ts` — サービスアカウントのトークンをスコープ別にキャッシュ（GA4 Data API用）
- `package.json` — `sharp`（写真のWebP変換）と `check:partnership` / `verify:partnership`
- `.env.example` — 学校認証とGA4の欄、`SLACK_PARTNERSHIP_CHANNEL_ID`
- `vercel.json` — メール配信結果を照合するcron（15分おき）

## 1. 検証環境のデータベース

1. 検証用プロジェクト（運営データベース）に `supabase-migrations/create-school-partnerships.sql` を貼り付けて実行する。
   先に `supabase-migrations/add-official-url-verification.sql` が適用済みであること（`official_url_verified` 列が必要）。
2. `npm run check:partnership --env=<検証用env>` で、6テーブル・4関数・非公開バケットが揃うことを確認する。

### 本番データベースでダミー校を使う場合

公開側（学校個別ページ・学校一覧・sitemap・`generateStaticParams`・RLSの公開ポリシー）は
いずれも `status = 'active'` かつ `is_public = true` で絞っている。
一方で提携のRPCは `status = 'active'` だけを条件にしているため、**`is_public = false` のダミー校なら
本番サイトに一切出ないまま、受付から発送までを通せる**。

1. `create-school-partnerships.sql` を本番に適用する（既存テーブルは変更しない。提携フラグは全校falseなので表示は変わらない）
2. `supabase-migrations/seed-partnership-verification.sql` を実行する（ダミー校A・B、提携設定、担当者3名。いずれも `is_public = false`）
3. `npm run verify:partnership` を実行する（受付→保留→公開→通知の積み上げ→自校分の閲覧→確認済み→発送済み、
   および他校ID指定・停止担当者・閲覧期限切れ・テスト請求の共有拒否を自動で確認する）
4. 公開ページの見た目（案内カード・写真の即時反映・掲載停止後の消え方）を見るときだけ、対象校を
   `is_public = true` にし、確認後すぐ `false` に戻す。この間だけ学校一覧とsitemapに載り得るので、
   作業は短時間で行い、本番の再デプロイを挟まない
5. 終わったら `supabase-migrations/cleanup-partnership-verification.sql` を実行し、写真を登録した場合は
   `school-partner-photos` バケットのファイルも削除する

ダミー校の担当者3名は `school_partner_members` に直接入れたUUIDで、学校認証プロジェクトのユーザーと
対応しないため**学校向け画面にはログインできない**。画面・メール・二要素認証の確認は、招待で作った
実在の担当者アカウントで行う。

## 2. 学校担当者用のSupabaseプロジェクト（新規作成）

運営データベースとは**別プロジェクト**にする。同一プロジェクトだと `schoolAuthConfig()` が無効と判定し、
招待ボタンも資料請求の有効化も通らない。

- Authentication > Providers: Email を有効、Confirm email は有効のまま
- Authentication > Sign In / Up: 新規登録（signup）を無効にする（招待制）
- Email Templates > Magic Link: 本文に `{{ .Token }}` を表示する（画面は6〜10桁のコード入力）
- SMTP: 学校の業務用アドレスに確実に届く送信元を設定する（Supabase既定の制限付きSMTPは使わない）

今回の設定（2026-11-09）:

- プロジェクト名 `realreview-school-auth` / Project ID `qbrqrlqbfnbhwzlexvar` / リージョン ap-northeast-1
- SMTPは Resend を利用。Host `smtp.resend.com` / Port `465` / Username `resend` /
  Password は `.env.local` の `EMAIL_API_KEY`（問い合わせメールと**同じキーを使い回している**）。
  送信元 `noreply@careeressence.jp`、送信者名「通信制高校リアルレビュー」。
  カスタムSMTPにすると認証メールの上限が 30通/時 になる。

> **キーを再発行するときの注意**: `EMAIL_API_KEY` は「アプリの通知メール」と「Supabase学校認証のSMTPパスワード」の
> 2か所で使っている。Resend側でキーを入れ替えたら、`.env.local`（と本番の環境変数）だけでなく
> Supabaseの Authentication > Emails > SMTP Settings も必ず更新する。片方だけだと、
> エラーは出ないまま学校担当者にログインコードが届かなくなる。
- Authentication > MFA: TOTP を有効にする
- 運営側（既存プロジェクト）も TOTP を有効にする。運営画面の提携管理は AAL2 必須で、未登録だと
  画面上で認証アプリの登録を求められる

## 3. 環境変数

検証環境・本番ともに以下を設定する（`.env.example` の学校認証欄のコメントを外す）。

| 変数 | 内容 |
|---|---|
| `NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_URL` | 学校認証プロジェクトのURL |
| `NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_ANON_KEY` | 同プロジェクトのanonキー |
| `SCHOOL_AUTH_SUPABASE_SERVICE_ROLE_KEY` | 同プロジェクトのservice roleキー（招待でユーザーを作成する） |
| `GA4_PARTNERSHIP_PROPERTY_ID` / `GA4_PARTNERSHIP_STREAM_ID` | 運営画面の閲覧数・クリック数。未設定なら「未取得」表示 |
| `NEXT_PUBLIC_SITE_URL` | 通知メール内のリンクに使う。検証環境では検証URLにする |

GSCで使っているサービスアカウントに、対象GA4プロパティの閲覧権限を付ける（GA4管理 > プロパティのアクセス管理）。

## 4. 学校の有効化

1. 運営画面 > 学校提携（または学校編集ページの「この学校の提携・資料請求を管理」）を開く
2. 学校編集画面で公式サイトURLを確認・保存する（`official_url_verified` が true でないと公式リンクは公開できない）
3. 担当者の業務用メールを入力して招待 → 招待メールのリンクから本人がログイン・TOTP登録できることを確認
4. 提供先の運営法人名と閲覧期限（7〜365日）を入れて設定を保存
5. 公式リンク・写真/メッセージ・資料請求のチェックを入れる

## 5. 通し検証（検証環境、架空の宛名・住所・電話番号で）

学校A・Bの2校を有効化してから実施する。

| # | 操作 | 期待する結果 |
|---|---|---|
| 1 | 学校Aの公開ページ | 公式サイトボタンと「無料で資料請求」が出る。既存の通知希望CTAは出ない |
| 2 | 資料請求フォームを送信（電話番号あり・なしの2件） | 同意文の項目が電話番号の入力有無で変わる。受付番号が表示される |
| 3 | 同じ内容で再送信 | 二重登録されない（同じ受付番号が返る） |
| 4 | 運営画面 > 資料請求 > 受付内容を確認 | 宛名・住所・連絡先・同意文・同意日時が見える |
| 5 | 「学校へ公開」 | 状態が「未確認」になり、Aの担当者に新着メールが届く |
| 6 | Aの担当者が `/school-portal` にログイン（コード→TOTP） | 自校の件数と一覧のみ。詳細で宛名・住所・電話番号が見える |
| 7 | 「確認済みにする」→「発送済みにする」 | 状態が発送待ち→発送済みに進む。運営画面にも反映される |
| 8 | AでログインしたままBの受付IDを `POST /api/school-portal` に直接指定 | 404（`request_not_found`） |
| 9 | 運営画面でAの担当者を「アクセス停止」→ 同じ詳細を再取得 | 403（学校の閲覧権限がありません） |
| 10 | 学校画面から写真とメッセージを保存 | 保存直後に公開ページへ出る（写真は「学校提供」表記付き） |
| 11 | 運営画面で理由を入れて「掲載停止」 | 公開ページから消え、学校に掲載停止メールが届く |
| 12 | 学校画面から修正版を提出 → 運営が「確認して公開」 | 修正版が公開される（提出時点から公開され、状態は修正版・確認待ち） |
| 13 | 閲覧期限切れの確認 | `access_until` を過去日に更新すると一覧が「閲覧期限終了」になり、詳細取得は404 |

注意:
- `is_test = true` の請求は学校へ公開できない（RPC側で除外）。通し検証はフォーム経由の通常レコードで行い、
  終わったら運営画面で「取消」するか、検証環境のレコードを削除する
- 学校ページは静的生成のため、写真・メッセージの即時反映は `revalidatePath` 依存。
  CDNキャッシュが残る場合は再読み込みで確認する
- メール送信に失敗すると運営画面の「送信待ち・失敗した通知」に出る。再送は手動ボタンのみ
- Resendは送信を受け付けた時点で200を返すため、通知の `sent` は「届いた」を意味しない。
  送信時にメッセージIDを `email_deliveries` に控え、15分おきのcron
  （`/api/cron/partnership-email`）がResendに問い合わせて `delivered` / `bounced` を反映する。
  不達は運営画面の「届かなかったメール」とSlackに出る。追跡対象は資料請求の新着通知と学校担当者の招待メール。
  送信48時間を過ぎても結果が確定しないものは「結果不明」として打ち切り、同じく通知する
- 将来Webhookを足す場合は `applyDeliveryEvent()`（`lib/partnerships/delivery.ts`）を呼ぶ。
  状態は弱い結果で上書きされないよう順位で判定しているため、cronと併用しても矛盾しない

## 6. 本番反映に必要な作業

1. 上記の差分をコミットし、本番へデプロイする（デプロイ自体は提携設定がすべて false なので表示は変わらない）
2. 本番の運営データベースに `create-school-partnerships.sql` を適用する
3. 学校認証プロジェクトを本番用に用意する（検証用と分けるか共用するかを決める）。Vercelの本番環境変数に
   学校認証3件・GA4 2件を登録し、`npm run check:partnership` を本番envで実行する
4. 運営アカウントにTOTPを登録する（未登録だと提携管理画面を操作できない）
5. 最初の学校と、通知先アドレス・電話番号の利用目的・発送目安・閲覧期限を合意する
6. 運用ルールを決める: 受付データと提供記録の保管期間と削除手順（学校画面の閲覧期限とは別）、
   通知失敗の確認頻度（自動再送はない）、掲載停止の判断基準
7. GA4プロパティ・ストリームIDとサービスアカウント権限を確認し、運営画面の集計が「未取得」でないことを見る
