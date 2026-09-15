# SEO提案品質改善 Handoff

別チャットでこの改善を再開するための引き継ぎメモ。  
作成日: 2026-09-14 / 直前コミット: `5a229db`

## いまのゴール

提案数は戻ったが、**言い換え・短縮・語尾追加**が多く、SEO効果のある提案が少ない。  
dry-run期間なので本番書き込みリスクはない。低価値案はSlackで却下して学習材料にし、生成側ルールを強くする。

## 完了済み（実装済み・デプロイ済み）

- Hard Gate 3層化: 構造退行は `warn`、重複リンクは `block`
- Soft Eval: 文字数変化5%未満・短縮のみを warning
- Slackカード: Hard Gate警告表示
- 改訂レーン: `wrong_target` は abandoned、中間失敗のSlackスパム抑制、LLM再試行3回
- `striking_distance` に `updateSchoolMetaTitle` 解禁
- Rulebook v2 active（hash `3ac835c8...b253de`、SQL適用済み）
- CLI:
  - `npm run seo:proposals:review -- --days=1 --limit=8`
  - `npm run seo:revision:status`
  - `npm run seo:rulebook:status`

Typed Executor はまだ Phase1 dry-run（`blockedUntilPhase2`）。`SEO_LOOP_EXECUTION_ENABLED=false` 維持。

### 2026-09-14 追加（改善1・2を実装）

**1. 生成プロンプト強化**（`lib/seo-loop/analysis/prompts.ts`）

- `STRATEGIST_CONTENT_POLICY.forbidden` に `<br>`化、文字数が減るだけのsummary、語尾に一般語を足すだけのtitle、before/afterを示さないrationaleを追加
- `required` に title優先（`candidateActions` は優先順、`striking_distance`/`low_ctr` ではtitleを選ぶ）、summaryは口コミ由来の新規情報がある時だけ、proposedValueにcurrentValue未収録のクエリ語を1つ以上、rationaleに差分を列挙を追加
- `STRATEGIST_NULL_CONDITIONS` を新設。改訂レーンはaction固定でnullを返せないため生成レーンだけに渡す
- `strategistInput` に `issueType` と `candidateActionsAreOrderedByPriority` を追加（`analyzer.ts` から `issue.issue_type` を渡す）
- version: `seo-strategist-v2` / `seo-revision-strategist-v2`（`prompt_version` は自由文カラムなのでマイグレーション不要）

**2. Soft Eval 上限キャップ**（`lib/seo-loop/content-change.ts` / `evaluation/soft-eval.ts`）

`lowValueChangeFindings` で5フラグを判定。詳細は `docs/SEO_AUTONOMOUS_LOOP.md`「情報が増えない変更の上限キャップ」。重度フラグ（`paraphrase_only` / `shortened_without_addition` / `structure_flattened` / `concrete_axis_removed` / `no_new_query_term`）が立つと `expressionQuality` と `expectedImpact` を各6点に制限し、理論最大72点で閾値75を構造的に超えられなくする。`no_new_query_term` は短文変更でクエリ語も具体軸も追加されない場合だけ立つ。

**実データ検証**（`npm run seo:proposals:review -- --days=3 --limit=8`）

下記8件の再採点が、handoffの人手評価と完全一致した。

| # | 旧 | 新 | 判定フラグ |
|---|---|---|---|
| 1 | 84–92 | 64 | shortened_without_addition |
| 2 | 84–92 | 64 | paraphrase_only + shortened + structure_flattened(`<br>`) |
| 3 | 84–92 | 64 | paraphrase_only（追加部分「する学校」） |
| 4 | 84–92 | 64 | shortened_without_addition |
| 5 | 92 | **92** | フラグなし（唯一ましな案は通過） |
| 6 | 92 | 64 | paraphrase_only（文字数変化0.9%） |
| 7 | 84–92 | 64 | shortened_without_addition |
| 8 | 84–92 | 64 | shortened_without_addition |

**撤退ライン**: 次ループで提案がゼロになったら `soft-eval.ts` の `LOW_VALUE_DIMENSION_CAP` を6→10に上げる（理論最大80点で通過余地が生まれる）。

### 2026-09-15 追加（提案枯渇対策）

- 分析時に対象ページの上位クエリ内訳をGSCから取得し、Fact inventoryへ`gsc.page_queries`として載せる
- Analyst prompt `seo-analyst-v2`: 競合SERP/端末別/変更履歴が無いことだけで`sufficient=false`にしない
- Strategist prompt `seo-strategist-v4` / Revision `seo-revision-strategist-v4`: クエリ語が既にtitle等にあっても、口コミ・学費等の具体比較軸を足せるなら提案可
- Soft Evalの閾値や重度判定は変更しない

### 2026-09-14 追加（バランス型の品質改善）

- 工程別モデル: Analyst=`gpt-5.6-luna`（reasoning low）、Strategist/Revision=`gpt-5.6-terra`（reasoning medium）。旧`SEO_LOOP_LLM_MODEL`は後方互換fallback
- prompt version: `seo-strategist-v4` / `seo-revision-strategist-v4`（以前はv3）
- クラーク型（学費・コース等の具体軸を「多様な学び」「充実したサポート体制」へ置換）を`concrete_axis_removed`として重度判定
- 短文でクエリ語も新しい具体軸も増えない`no_new_query_term`を重度判定。ただし通学・コース等を新しく足すあずさ型は対象外
- 重度`lowValueChangeFindings`を生成時validateへ接続し、Slack保存前に最大3回再生成
- 内部リンクは同一origin確認後にHEAD→GETで到達性確認し、404/410等をHard Gate block
- featureの`striking_distance`は`updateFeatureMetaDescription`を内部リンクより優先
- Rulebook v3 migration: `activate-seo-rulebook-v3-feature-striking-distance.sql`

集中回帰テストは66件合格。次は本番デプロイ、Rulebook v3適用、Vercel工程別モデル設定後の実測確認。

## 直近8件の評価結果（2026-09-14時点）

| # | 学校 | action | status | 評価 |
|---|---|---|---|---|
| 1 | わせがく夢育 | updateSeoSummary | pending | 言い換え+15%短縮。却下相当 |
| 2 | 第一学院 | updateSeoSummary | pending | 見出しを`<br>`化。明確に悪い |
| 3 | 星槎国際 | updateSchoolMetaTitle | pending | 「提供する学校」語尾追加のみ。無価値 |
| 4 | 日本航空 | updateSeoSummary | pending | 文体の断定化のみ。却下相当 |
| 5 | あずさ第一 | updateSchoolMetaTitle | execution_blocked | 唯一まし。承認済み→dry-run blocked |
| 6 | 目黒日大 | updateSeoSummary | pending | ほぼ同文の言い換え。無価値 |
| 7 | わせがく夢育 | updateSeoSummary | rejected | 同系統の短縮案。済み |
| 8 | わせがく夢育 | updateSeoSummary | revision_requested | 同系統。改訂中。触らない |

共通問題:

1. striking_distanceなのに summary 言い換えへ逃げる
2. 「充実」と言いつつ実際は短縮
3. Soft Eval 高得点（84–92）でも実質無価値
4. わせがくが繰り返し出る

## Slack運用方針（合意済み）

- 言い換え summary / 語尾追加 title は **却下**（修正依頼にしない）
- 理由: 改訂レーンは action 変更不可。修正依頼するとまた言い換えが返りやすい
- 一般ルール化候補は **ON**
- #5 あずさ第一は操作不要
- #7 rejected済み / #8 revision_requested中は追加操作不要

却下文面の型:

- 分類候補: `対象・actionが不適切` / `表現品質` / `検索意図と不一致` / `期待効果が不明確`
- 理由の要点: 情報追加がない / クエリ語がない / 構造破壊 / CTR改善根拠がない

## 次チャットでやるべき改善（優先順）

### 1. 生成品質を上げる（最優先） — 2026-09-14 実装済み

### 2. Soft Eval を実質ゲートに近づける — 2026-09-14 実装済み

### 2.5. 次ループの実測確認（最優先）

Cronを1周させて確認する。

- execute後に当日runが`completed`で止まらず、残りopen issueがあれば`analyzing`へ戻るか（2026-09-14 修正）
- 提案が生成されるか（`npm run seo:proposals:review -- --days=1`）。`quality_blocked` だけでゼロになっていないか
- title提案の比率が上がっているか（プロンプトのtitle優先が効いているか）
- Slackに届いた案がクエリ語・具体事実を足しているか
- 提案が完全にゼロなら `LOW_VALUE_DIMENSION_CAP` を6→10に緩める

### 3. 生成時validateの再調整 — 2026-09-14 実装済み

対象: `lib/seo-loop/context/validate.ts`

- `lowValueChangeFindings` の重度フラグを `retryableContentChangeRegressions` に追加済み
- 生成時blockはリトライ3回を消費するため、次ループで`strategist`失敗率と提案数を確認する
- 提案がゼロの場合、まず`no_new_query_term`だけを重度対象から戻す。構造破壊・短縮・具体軸削除は緩めない

### 4. 却下フィードバックの一般ルール化

Slackで general_rule_candidate=true の却下が溜まったら、Typed Rule Patch / プロンプト追記へ反映。

## 触るべき主なファイル

- `lib/seo-loop/analysis/prompts.ts`
- `lib/seo-loop/revision/prompts.ts`
- `lib/seo-loop/evaluation/soft-eval.ts`
- `lib/seo-loop/content-change.ts`
- `lib/seo-loop/context/validate.ts`
- `lib/seo-loop/evaluation/hard-gate.ts`
- `tests/seo-loop/content-change.test.ts`
- `docs/SEO_AUTONOMOUS_LOOP.md`

## 確認コマンド

```bash
npm run seo:proposals:review -- --days=1 --limit=8
npm run seo:revision:status
npm run seo:rulebook:status
npx vitest run tests/seo-loop
```

## 新しいチャットの開始プロンプト（コピー用）

```text
docs/SEO_PROPOSAL_QUALITY_HANDOFF.md を読んで、SEO提案品質改善を続けてください。

現状:
- 改善1（プロンプト強化）と2（Soft Eval上限キャップ）は実装・テスト済み
- 直近8件の再採点は人手評価と一致（低価値7件が64点、まともな1件が92点）
- 次は handoff の 2.5「次ループの実測確認」

Cronを1周させた結果を確認し、提案が生成されているか、title比率が上がったか、
Slackに届いた案がクエリ語・具体事実を足しているかを見てください。
提案が完全にゼロなら LOW_VALUE_DIMENSION_CAP を6→10に緩める判断をしてください。
```

## やらないこと

- Typed Executor の本番書き込み有効化
- Hard Gate を急に全面厳格化して提案ゼロに戻すこと
- 無関係な SchoolDetailClient 等の未コミット変更を混ぜること
