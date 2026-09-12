# Typed Rule Patch運用

## 安全境界

- `SEO_RULEBOOK_PATCH_ENABLED=false`が既定。false時は候補生成・第二承認を行わない
- feedbackの自由文はRulebook contentへコピーしない
- `general_rule_candidate=true`かつ、直近60日・異なる`issue_key`由来2件以上のみ候補化する
- 同じ課題が別runやproposal改訂チェーンで再検出されても、同じ`issue_key`なら1票に数える
- 1候補は固定Allowlist内の`replace` 1操作のみ
- 同一pathは適用・rollback・却下後30日間再提案しない
- title/description上限には運用床、Soft Evalには上限90を設ける
- 第二承認はproposal feedbackとは別の明示的な操作として行う。一人運用では同じSlackユーザーが実行できる
- evidenceは候補化時に消費し、候補を却下・失効しても再利用しない
- Rulebookの変更経路は専用switchで制御するため、`SEO_LOOP_EXECUTION_ENABLED=false`のままでも第二承認後のRulebook active化は行われる

## 有効化

Vercelに次を設定して再デプロイします。

```text
SEO_RULEBOOK_PATCH_ENABLED=true
SLACK_SEO_RULEBOOK_APPROVER_IDS=Uxxxxxxxx
```

`SLACK_SEO_RULEBOOK_APPROVER_IDS`にはRulebook管理者を指定します。一人運用では通常のproposal承認者と同じSlack User IDで構いません。「第二承認」は別人による承認ではなく、個別proposalへのfeedbackからRulebook全体への変更を切り離した、別工程の明示的な承認です。

Slackカードの第二承認後、旧active版をretired、新版をactiveへ同一DB transactionで切り替えます。既存runのbindingは変えず、次に作成されるrunから新版を使います。承認者がfeedback提出者本人でも、異なる`issue_key`由来2件以上、固定Typed path、固定歩幅、運用床、version/hash固定、rollbackの安全境界は維持されます。

Slack投稿またはmessage timestamp保存に失敗した候補は、重複カードを避けるため`failed`へ移して自動再投稿しません。DBとSlackの両方で未投稿を確認したうえで、再候補化の要否を判断します。

## 状態確認

```bash
npm run seo:rulebook:status
```

active版のversion、hash、schema/hash整合性を表示します。

## 直前版へのrollback

Office・本番コンテンツは変更せず、Rulebookだけを直前版へ戻します。

```bash
npm run seo:rulebook:status -- --rollback-current --yes --actor=Uxxxxxxxx
```

CLIはrollback対象のZod schemaとhashを検証してから、`rollback_seo_rulebook` RPCを呼びます。任意の過去版ではなく、現在のactive化イベントが指す直前版だけが対象です。rollback後も既存run bindingは不変です。
