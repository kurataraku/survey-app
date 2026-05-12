import { callLLM, resolveModel } from './llm-client';
import { parseJsonObjectFromLlmText } from './llm-json-parse';
import { defaultOpenAiEconomyModel } from './openai-model-defaults';
import type { OutlineSection } from './types';
import { inferPrefecturesFromKeyword } from '@/lib/seo-generation/keyword-region';

interface PlannerInput {
  keyword: string;
  draftType: 'knowledge' | 'school';
  schoolName?: string;
}

interface PlannerOutput {
  intent: string;
  audience: string;
  title: string;
  outline: OutlineSection[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

export async function runPlanner(input: PlannerInput): Promise<PlannerOutput> {
  const { provider, model } = resolveModel(
    'SEO_PLANNER_MODEL',
    defaultOpenAiEconomyModel(),
    'openai'
  );

  const schoolContext =
    input.draftType === 'school' && input.schoolName
      ? `対象学校: ${input.schoolName}\n`
      : '';

  const articleTypeGuidance =
    input.draftType === 'school'
      ? `## 学校別記事の構成ガイド
この記事は特定の通信制高校を深掘りする記事です。以下の要素を必ずアウトラインに組み込んでください:
- 学校の基本情報と特徴（コース・カリキュラム・学費・サポート体制）
- 在校生・卒業生の口コミ要約（ポジティブ面・ネガティブ面の両方）
- 他校との比較ポイント（同エリアの通信制高校や類似校との差別化要素）
- 入学・転入に関する実践的情報（出願時期・選考方法・必要書類）
- どんな人に向いている学校か（適性・ミスマッチの具体的な判断軸）

H2の構成例:
1. 「${input.schoolName || '○○高校'}の特徴と他校にない強み」→ dataSourceHint: "school_info"
2. 「在校生・卒業生の口コミから見る${input.schoolName || '○○高校'}のリアルな評判」→ dataSourceHint: "review"
3. 「${input.schoolName || '○○高校'}の学費・コース・サポート体制を徹底解説」→ dataSourceHint: "school_info"
4. 「${input.schoolName || '○○高校'}はこんな人におすすめ（向いている人・向いていない人）」→ dataSourceHint: "review, school_info"
5. 「${input.schoolName || '○○高校'}への入学・転入手続きガイド」→ dataSourceHint: "school_info, web"
6. FAQ → dataSourceHint: "review, web"`
      : `## ナレッジ記事の構成ガイド
この記事は通信制高校に関する知識・ノウハウを伝える記事です。以下の要素を必ずアウトラインに組み込んでください:
- キーワードの定義・概要（読者が最初に知りたい基本情報）
- 実際のデータ・口コミに基づく現状解説（統計・満足度・傾向）
- メリット・デメリットの具体的な解説（実体験ベース）
- 読者が取るべき具体的なアクション（ステップ形式が望ましい）
- 判断基準やチェックリスト（読者が自分で判断できる材料）
- 比較が効く論点では、執筆時に **Markdown表（縦棒区切りのGFM表）** で示せるよう、keyPointsに「表で対比する項目（列名・行の観点）」を具体的に書くこと

H2の構成例:
1. 「${input.keyword}とは？基本から分かりやすく解説」→ dataSourceHint: "review, article, web"（主役は口コミ・自社記事。Webは制度の一行補足のみ）
2. 「${input.keyword}の実態を口コミ・データから徹底分析」→ dataSourceHint: "review, article"
3. 「${input.keyword}のメリット・デメリットを経験者が解説」→ dataSourceHint: "review"
4. 「失敗しないための${input.keyword}チェックポイント」→ dataSourceHint: "review, school_info"
5. 「${input.keyword}で迷ったら？具体的な行動ステップ」→ dataSourceHint: "review, article, web"
6. FAQ → dataSourceHint: "review, web"`;

  const prompt = `あなたは通信制高校メディア「通信制高校リアルレビュー」の編集長兼SEOストラテジストです。
読者は通信制高校を検討中の中高生とその保護者です。検索意図を正確に読み取り、競合記事よりも具体的で実用的な構成を企画してください。

## 記事基本情報
キーワード: ${input.keyword}
記事タイプ: ${input.draftType === 'school' ? '学校別記事' : 'ナレッジ記事'}
${schoolContext}
${articleTypeGuidance}
${
  input.draftType === 'knowledge' &&
  inferPrefecturesFromKeyword(input.keyword).length > 0
    ? `

### 地域を含むキーワード（本企画で検出）
キーワードに地域が含まれます。**全国共通の説明だけで埋めないこと**。以下をアウトラインのkeyPointsに必ず織り込むこと:
- その地域ならではの**通学・拠点・説明会・キャンパス選択**の観点（口コミに地名が少なくても、読者の行動チェックとして具体化する）
- **複数校の比較**ができるよう、口コミ・学校情報を横断する論点（同一インタビューだけに依存しない指示）
- 地域名をタイトルに入れている場合、**少なくとも2つのH2のkeyPoints**に地域固有の確認事項を書くこと
`
    : ''
}

## 出力形式（厳守）
- **出力は JSON オブジェクトのみ**（前後に説明文・マークダウン・コードフェンスを付けない）
- **先頭文字は \`{\`、末尾は \`}\` のみ**（\`\`\`json は禁止）

{
  "intent": "検索意図の具体的な説明（「〜を知りたい」「〜を比較したい」など読者の動機を含む1-2文）",
  "audience": "想定読者の具体像（例: 「不登校経験があり通信制高校への転入を検討している高校1-2年生とその保護者」）",
  "title": "SEOに最適化した記事タイトル（30-50文字、キーワードを前半に配置、数字や具体性を含む）",
  "outline": [
    {
      "heading": "読者の疑問やベネフィットを反映した見出し文",
      "level": 2,
      "keyPoints": [
        "このセクションで必ず言及する具体的なポイント（例: 「スクーリングは年○回、最短○日で完了する点を説明」）",
        "2つ目の具体的なポイント（例: 「口コミで特に評価が高いサポート体制の内容を引用付きで紹介」）"
      ],
      "isFaq": false,
      "dataSourceHint": "使用するデータの種類（review / school_info / article / web の組み合わせ）"
    }
  ]
}

## 構成ルール（必ず守ること）

### SEO構造
- H2は4-6個（FAQを含む）。各H2の下にH3を2-3個配置すること
- 最初のH2にキーワード「${input.keyword}」を自然に含めること
- 最初のH2以外にも、少なくとも2つのH2にキーワードまたはその関連語を含めること
- H2は「〜とは？」「〜のメリット・デメリット」「〜の選び方」など、読者の疑問形やベネフィットを反映した表現にすること。「概要」「まとめ」のような無機質なラベルは禁止

### keyPointsの書き方
- 各keyPointは「何を、どのデータで、どう伝えるか」が分かる具体的な指示にすること
- NG例: 「ポイント1」「特徴を説明」「メリットを紹介」
- OK例: 「口コミデータから満足度の高い項目TOP3を紹介し、具体的な声を引用する」
- OK例: 「学費の年間総額を他校（全日制・定時制）と比較表形式で提示する」
- 各H2セクションのkeyPointsは2-4個

### dataSourceHint
- 各セクション（H2・H3とも）に必ずdataSourceHintを付与すること
- 選択肢: "review"（口コミ）, "school_info"（学校情報）, "article"（自社記事）, "web"（外部Web情報）
- 複数の場合はカンマ区切り（例: "review, school_info"）
- 記事全体でreviewまたはschool_infoが主要データソースとなるようバランスを取ること

### FAQセクション
- 最後のH2はFAQセクション（isFaq: true）にすること
- FAQのH3は質問形式で4-5個。以下の条件を守ること:
  - 各質問はユーザーが実際にGoogleで検索しそうなロングテールクエリにすること
  - 「${input.keyword}」に関連するが、本文のH2で直接カバーしていない周辺疑問を扱うこと
  - 「〜ですか？」「〜できますか？」「〜はどうなりますか？」など具体的な質問形式にすること
  - NG例: 「通信制高校について」（質問になっていない）
  - OK例: 「通信制高校の卒業率はどのくらいですか？」「通信制高校から大学受験はできますか？」`;

  const response = await callLLM({
    provider,
    model,
    systemPrompt: `あなたは通信制高校メディア「通信制高校リアルレビュー」の編集長兼SEOストラテジストです。
在校生・卒業生の口コミデータと学校情報を最大限活用する記事構成を企画します。
読者は通信制高校を検討中の中高生とその保護者であり、信頼性の高い具体的な情報を求めています。
構造化されたJSON出力のみ行ってください。前置き・後書き・\`\`\` は禁止です。`,
    userPrompt: prompt,
    temperature: 0.5,
    maxTokens: 3000,
    jsonMode: provider === 'openai',
  });

  let parsed: {
    intent: string;
    audience: string;
    title: string;
    outline: OutlineSection[];
  };

  try {
    parsed = parseJsonObjectFromLlmText<{
      intent: string;
      audience: string;
      title: string;
      outline: OutlineSection[];
    }>(response.content);
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Plannerの出力JSONパースに失敗: ${hint}\n---先頭400字---\n${response.content.slice(0, 400)}`
    );
  }

  if (!parsed.title || !parsed.outline || parsed.outline.length === 0) {
    throw new Error('Plannerの出力が不完全です');
  }

  return {
    intent: parsed.intent || '',
    audience: parsed.audience || '',
    title: parsed.title,
    outline: parsed.outline,
    tokensUsed: response.tokensUsed,
  };
}
