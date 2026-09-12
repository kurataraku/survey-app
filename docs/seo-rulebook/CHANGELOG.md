# SEO Rulebook Changelog

## v1 — 2026-09-11

- analyzer / risk / opsの初期ルールを構造化
- 既存Hard Gate、Soft Eval、Typed Action Allowlistと同じ安全基準を収録
- DB障害時用fallbackと同一hashで開始

Rulebookの変更は既存versionを上書きせず、新versionとして追加します。active版の変更・rollback・Typed Rule Patchは実装単位8の対象です。

## Unit 8 — 2026-09-11

- 複数の独立feedbackから固定AllowlistのTyped Rule Patch候補を生成
- Slack第二承認で新versionを追加し、既存run bindingを維持
- 直前版への原子的rollbackとactivation event監査を追加
- 一人運用ではfeedback提出者本人が別工程の第二承認を行えるよう補正。Typed Patch等の安全境界は維持

動的に追加されたversionの正本と変更履歴はDBです。このMarkdownは実装・運用方式のスナップショットであり、各active contentの複製ではありません。

## Unit 9 — 2026-09-12

- 第二承認から即active化する経路を廃止し、旧active版とのshadow比較を追加
- shadow proposalをSlack・承認・Executorへ流さない専用評価ログを追加
- 5指標、最低サンプル数、最終昇格承認を追加
- active版を維持したshadow停止と、昇格後の直前版rollback手順を追加
