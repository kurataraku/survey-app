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
- Rulebookの変更経路は専用switchで制御する。`SEO_LOOP_EXECUTION_ENABLED=false`のままshadow比較と最終昇格は行えるが、本番コンテンツ変更は行わない

## 有効化

Vercelに次を設定して再デプロイします。

```text
SEO_RULEBOOK_PATCH_ENABLED=true
SEO_RULEBOOK_SHADOW_ENABLED=true
SLACK_SEO_RULEBOOK_APPROVER_IDS=Uxxxxxxxx
```

`SLACK_SEO_RULEBOOK_APPROVER_IDS`にはRulebook管理者を指定します。一人運用では通常のproposal承認者と同じSlack User IDで構いません。「第二承認」は別人による承認ではなく、個別proposalへのfeedbackからRulebook全体への変更を切り離した、別工程の明示的な承認です。

Slackカードの第二承認後は`shadowing`を開始し、旧active版を主系として維持します。新版は同一proposalを評価して専用ログへ保存するだけで、Slack proposalカード、承認、Executorには流れません。最低7 run・10 proposal・主系とshadow対象それぞれ5実判断を含む固定基準を満たすと`ready`になり、Slackの最終昇格カードを送ります。この最終承認で初めて旧active版をretired、新版をactiveへ同一DB transactionで切り替えます。既存runのbindingは変えず、次に作成されるrunから新版を使います。

Unit 8のTyped Patchはrisk scopeだけを変更するため、提案生成率は旧新版で同一です。評価による表出差はSlack到達可能率として別に記録します。shadowには独自の人間判断がないため、承認率・修正率・同じ修正の再発率は、主系で得た実判断を「新版も表出させた同一proposal」に限定して投影します。実測値と投影値はSlackカード・DBの`measurementMode`で区別します。

承認者がfeedback提出者本人でも、異なる`issue_key`由来2件以上、固定Typed path、固定歩幅、運用床、version/hash固定、shadow基準、最終昇格承認、rollbackの安全境界は維持されます。

Slack投稿またはmessage timestamp保存に失敗した候補は、重複カードを避けるため`failed`へ移して自動再投稿しません。DBとSlackの両方で未投稿を確認したうえで、再候補化の要否を判断します。

## 状態確認

```bash
npm run seo:rulebook:status
```

active版のversion、hash、schema/hash整合性に加え、進行中rolloutのstatus、サンプル数、比較指標を表示します。

shadowだけを緊急停止する場合はVercelで次を設定し、再デプロイします。旧active版は変わりません。

```text
SEO_RULEBOOK_SHADOW_ENABLED=false
```

基準未達や異常で進行中rolloutを終了する場合は、switchをtrueにした状態で明示的に却下します。

```bash
npm run seo:rulebook:status -- --reject-rollout --yes --actor=Uxxxxxxxx
```

## 直前版へのrollback

Office・本番コンテンツは変更せず、Rulebookだけを直前版へ戻します。

```bash
npm run seo:rulebook:status -- --rollback-current --yes --actor=Uxxxxxxxx
```

CLIはrollback対象のZod schemaとhashを検証してから、`rollback_seo_rulebook` RPCを呼びます。任意の過去版ではなく、現在のactive化イベントが指す直前版だけが対象です。rollback後も既存run bindingは不変です。
