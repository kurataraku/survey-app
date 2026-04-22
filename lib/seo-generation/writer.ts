import { callLLM, resolveModel } from './llm-client';
import { defaultOpenAiPremiumModel } from './openai-model-defaults';
import type { OutlineSection, SeoMeta, SeoDraftEvidence } from './types';
import { inferPrefecturesFromKeyword } from '@/lib/seo-generation/keyword-region';
import { collectReviewSchoolNames } from '@/lib/seo-generation/quote-guards';

interface WriterInput {
  keyword: string;
  title: string;
  intent: string;
  audience: string;
  outline: OutlineSection[];
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[];
  draftType: 'knowledge' | 'school';
  schoolName?: string;
}

interface WriterOutput {
  bodyMd: string;
  seoMeta: SeoMeta;
  tokensUsed: { prompt: number; completion: number; total: number };
}

function formatOutline(outline: OutlineSection[]): string {
  return outline
    .map((s) => {
      const prefix = s.level === 2 ? '##' : '###';
      const faqTag = s.isFaq ? ' [FAQ]' : '';
      const hint = s.dataSourceHint ? `  [データソース: ${s.dataSourceHint}]` : '';
      const points = s.keyPoints.map((p) => `  - ${p}`).join('\n');
      return `${prefix} ${s.heading}${faqTag}${hint}\n${points}`;
    })
    .join('\n\n');
}

/** LLMが先に読むほど重視しやすいよう、口コミ→自社記事→学校情報→Webの順に並べる */
const EVIDENCE_KIND_ORDER: Record<string, number> = {
  review: 0,
  article: 1,
  school_info: 2,
  web: 3,
};

function sortEvidenceForWriter(
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[]
): Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[] {
  return [...evidence].sort(
    (a, b) =>
      (EVIDENCE_KIND_ORDER[a.kind] ?? 9) - (EVIDENCE_KIND_ORDER[b.kind] ?? 9)
  );
}

function formatEvidence(
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[]
): string {
  const sorted = sortEvidenceForWriter(evidence);
  const reviewSchools = collectReviewSchoolNames(evidence);
  const guardHeader =
    reviewSchools.length > 0
      ? `【執筆前確認・自動検証】以下の各校について、当サイトアンケートの「」原文引用は本文全体で各校最大2回まで（3回目禁止）。校名は各「」の前後すぐに書くこと: ${reviewSchools.join('、')}\n\n`
      : '';

  return (
    guardHeader +
    sorted
    .map((e, i) => {
      const parts = [`【根拠${i + 1}】[${e.kind}] ${e.title || '(無題)'}`];
      parts.push(`要約: ${e.summary}`);
      if (e.section_ref) parts.push(`引用元ラベル: ${e.section_ref}`);
      if (e.excerpt) parts.push(`引用: 「${e.excerpt}」`);

      if (e.kind === 'article' && e.url && e.section_ref) {
        parts.push(
          `**本文での必須表記**: Markdown内部リンク [\`${e.section_ref}\`](${e.url})（記事タイトルは根拠の「引用元ラベル」と一致させる）。**「当サイト記事（useful_info）」「（interview）」など内部用カテゴリ名・英語ラベルを本文に書かないこと**`
        );
      } else if (e.kind === 'article' && e.section_ref && !e.url) {
        parts.push(
          '※記事slugが未取得のためリンクなし。記事タイトルのみ自然な日本語で明記すること。'
        );
      }

      if (e.kind === 'review' && e.url && e.section_ref) {
        const schoolLabel = e.section_ref.split('（')[0].trim();
        parts.push(
          `**推奨の内部リンク（初出付近で1回）**: [\`${schoolLabel}の学校情報・口コミ一覧\`](${e.url})`
        );
      }

      if (e.kind === 'web' && e.url) {
        parts.push(`外部出典URL（本文ではこのURLのみ。捏造URL禁止）: ${e.url}`);
      }
      return parts.join('\n');
    })
    .join('\n\n')
  );
}

export async function runWriter(input: WriterInput): Promise<WriterOutput> {
  const { provider, model } = resolveModel(
    'SEO_WRITER_MODEL',
    process.env.ANTHROPIC_API_KEY ? 'claude-opus-4-20250514' : defaultOpenAiPremiumModel(),
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'
  );

  const selfEvidenceCount = input.evidence.filter(
    (e) => e.kind !== 'web'
  ).length;
  const webEvidenceCount = input.evidence.filter(
    (e) => e.kind === 'web'
  ).length;

  const schoolContext =
    input.draftType === 'school' && input.schoolName
      ? `対象学校: ${input.schoolName}\n`
      : '';

  const articleTypeWritingGuide =
    input.draftType === 'school'
      ? `### 学校別記事の執筆ポイント
- 学校の強み・特徴は口コミデータと学校情報の両方から裏付けること
- ポジティブな口コミだけでなく、改善点や注意点も正直に書くこと（信頼性向上）
- 他校との比較は具体的な数字（学費・スクーリング日数・卒業率など）で行うこと
- 「この学校が向いている人」「向いていない人」を明確に書き分けること
- **対象校の「」引用も同一の長文は2回まで**（くどさ回避）。全国統計はその学校の説明に必要なときのみ1文補足`
      : `### ナレッジ記事の執筆ポイント
- **主役は常に「当サイトアンケート（口コミ）」**。Webや他サイトURLの列挙で本文を埋めないこと
- 冒頭で定義・概要を端的に説明し、読者の検索意図に即座に応えること（定義は短く、すぐ口コミの実感へ）
- 一般的な説明だけで終わらず、**「」付きの口コミ原文**でリアルな実態を伝えること
- キーワードに**地名・都道府県・「東京」「大阪」など**が含まれる場合: **全国向けの一般論だけで埋めない**こと。通学拠点・説明会・キャンパス選択・生活動線など、その地域の読者の**意思決定に直結するチェック**へ落とすこと
- **同一の「」口コミ原文を記事内で繰り返さない**（2回目以降は要約に切り替えるか、別回答者の引用にする）。**同じ当サイト記事の同一インタビュー引用は2回まで**（3回目以降は禁止）
- **当サイトアンケート（review）の「」原文を最優先**。記事内の「」引用の**半数以上**は、根拠[kind=review]の excerpt をそのまま使うこと。特集記事（article）の引用だけで本文を埋めないこと
- 根拠カードに十分な口コミがあるときは、**異なる高校名から最低5校**を「」引用または明確な要約で言及すること（1校の長文だけに寄せない）
- **自然な日本語**: キーワード全文を**文頭に機械的に並べない**こと。NG例:「通信制高校　東京で本当に大丈夫？」「通信制高校　東京で迷うときは」「結論：通信制高校　東京は〜」のような**コピペ感の硬いフレーズの連発**。OK例:「東京で通信制高校を探している方へ」「都内の校舎では〜」「首都圏で通う場合は〜」など**語順を変え、1記事で同型の文頭パターンは2回まで**
- **同一高校名を出所にした「」引用は記事全体で2回まで（上掟と同じ。違反は再リライト対象）**（超える場合は要約か別校・別回答の口コミに差し替え）。**当サイト記事からの長文「」引用は合計4カ所まで**（特集は補助。主役はアンケート）
- 読者が記事を読んだ後に取るべき具体的なアクションを提示すること
- 抽象的なアドバイスではなく、チェックリストやステップ形式で実行しやすくすること`;

  const prompt = `以下の企画・アウトライン・根拠データに基づき、SEO最適化されたMarkdown記事を執筆してください。

## 記事情報
キーワード: ${input.keyword}
タイトル: ${input.title}
検索意図: ${input.intent}
想定読者: ${input.audience}
${schoolContext}
## 記事構成（アウトライン）
${formatOutline(input.outline)}

## 根拠データ（${selfEvidenceCount}件の自社データ + ${webEvidenceCount}件のWeb情報）
${formatEvidence(input.evidence)}

${articleTypeWritingGuide}
${
  input.draftType === 'knowledge' &&
  inferPrefecturesFromKeyword(input.keyword).length > 0
    ? `

### 地域キーワード記事の追加ルール（厳守）
- **全国の在籍者数増だけの話題は独立段落にしない**（削除または1文の補足に圧縮）
- **Web出典はその地域の選校・通学・制度確認に直結する公式のみ**（全国ニュース系URLは本文に載せない）
`
    : ''
}

## 執筆ルール（すべて厳守すること）

### 文字数・構成
- 記事全体で3000-4500文字（見出し含む）
- 各H2セクションは300-600文字
- 導入文（最初のH2の前）は100-150文字で、検索意図に直接答える要約を書くこと
- 各セクションの冒頭でそのセクションの結論を先に述べること（PREP法: 結論→理由→具体例→結論）

### 口コミ・根拠の引用ルール（最重要）
- **【掟・検証で自動エラー】同一の正式校名（根拠reviewの引用元ラベルと一致する表記）に紐づく「」原文引用は、記事全体で厳密に2回まで**（チェックリストの口コミ例に「」を使う場合も同一校として数える）。3回目以降は削除するか別校の根拠excerptに差し替えるか、「」を使わない要約のみにすること
- **【掟・検証で自動エラー】アンケートの「」引用では、校名をその引用の前後360字以内に必ず書くこと**。「（在校生・当サイトアンケート）」「（卒業生・当サイトアンケート）」「（当サイトアンケート）」**単体**は禁止（どの高校の声か判別不能）。OK例:「◯◯高等学校の回答では「…」」「「…」（◯◯高等学校・当サイトアンケート）」
- 根拠[kind=article]に**内部リンクURL**が付いている場合、本文では**必ず** Markdownの [記事タイトル](根拠に記載のURL) 形式で言及すること（「当サイト記事（カテゴリコード）」「useful_info」など内部用ラベルは禁止。タイトルは根拠の「引用元ラベル」と一致させる）
- 根拠[kind=review]に**学校ページURL**が付いている場合、該当校を初めて出す段落で**1回**、[学校名の学校情報・口コミ一覧](根拠に記載のURL) のMarkdownを入れること（「当サイトアンケート（校名）」だけの硬い表記にしない）
- 根拠カードに「引用元ラベル」が書かれている場合は、本文でも**同じ出典が分かるように**書くこと（例: 「◯◯高等学校の回答者によると…」「以下は当サイトアンケート（◯◯高校）より」）
- 口コミ（review）の引用では、可能な限り**高校名**を文中に入れること。根拠カードの引用元の学校名と矛盾させないこと
- 根拠カードの口コミ引用（excerpt）がある場合は、必ず「」内に原文を引用すること
- 引用時は主体を明記すること: 「◯◯高校の回答では「○○○」とあります」「卒業生からは「○○○」という声が寄せられています（◯◯高校・当サイトアンケート）」
- 1つのH2セクションに、根拠に review が十分ある場合は**最低2つの**当サイトアンケート「」引用（別の論点または別校）を含めること。FAQの各回答にも可能なら1つずつ「」引用を入れること
- 数値データ（満足度スコア、口コミ件数等）が根拠カードにある場合は必ず記事に含めること
- 根拠なしの一般論は書かないこと。すべての主張に根拠カードの参照を含めること
- 「〜と言われています」「〜という意見もあります」のような曖昧表現は禁止。具体的な口コミ引用に置き換えること
- **繰り返し検査**: 同じフレーズの引用（「」内20文字以上が完全一致）を複数セクションに貼り付けないこと

### 公的統計・外部数値の書き方（全記事共通・虚偽・誇張防止）
- 文科省の学校基本調査など**全国規模の数値**は、当サイトアンケートの分析とは**別枠の参考**であることを明確にすること
- リード・メタディスクリプション・見出し直下で、**「本記事は〇〇のデータを踏まえ」「〇〇人のデータも踏まえ」など、全国統計と口コミ分析を結びつける表現は禁止**（読者が「当サイトがその統計を主に扱った」と誤解するため）
- 全国の生徒数・率を触れる場合は**1文程度の補足**にとどめ、「速報では」「公的資料では」と主語を分けること。**同じ統計数値をメタ・リード・本文で何度も「根拠として喧伝」しない**
- キーワードに**都道府県・「東京」「大阪」など地域語**が含まれる場合:**全国の通信制在籍者数・増加トレンド・全国シェアのみを述べる段落は原則書かない**（読者の地域選びに脈絡がなく唐突になるため）。全国統計をどうしても触れるなら**地域キーワードと一文で接続**できる場合に限り、**1文・出典1件**にとどめること

### データソースの使い分け（厳守）
- **本文の主張の中心は必ず自社データ（review / article / school_info）**。**当サイトアンケート由来の「」引用を記事全体で最低16回**（目安。FAQ含む）。「」引用の合計は**最低20回**を目標にすること
- Web根拠（[web]）は**制度・公的統計の1点補足に限定**：各H2セクションで**Webに依存する文は1〜2文まで**。外部URLを連ねる段落は禁止
- ${
    input.draftType === 'school'
      ? '**外部サイトURL（本文中の http(s):// を含む【出典】やリンク）は5件までを目安**とし、口コミ・学校情報で説明できる内容にはURLを付けないこと'
      : '**外部サイトURL（本文中の http(s):// を含む【出典】やリンク）は記事全体で3件まで**（同一URLの繰り返しも避ける）。口コミ・体験談・満足度・通いやすさ・校則の話題には**URLを付けず**、「当サイトアンケート」「当サイト記事」と明記するだけでよいこと'
  }
- 公的統計（例: 通信制在籍者数の一次速報）や、自社だけでは権威づけしづらい**制度の一行定義**など、**口コミでは代替できない事実にのみ**外部URLを使うこと
- **根拠[kind=web]はキーワード・検索意図と内容が対応するときだけ本文に使うこと**。キーワードが地域を含むとき、**全国トレンド紹介・学校法人の広報まとめだけ**を根拠にしたURLは使わない（**その地域の教育行政・制度に直結する公式**に限定）。無関係に見えるwebカードは無視してよい
- **検索ポータル・一覧サイトのURLを、特定校の設置・方針の根拠にしないこと**。根拠に**ない高校名**を本文に持ち込まない（一覧ページから拾った校名を口コミと結びつけない）。URLのリンク先の内容と**主張が一致しない**出典は使わない
- 出典URLは、**自社口コミ・当サイト記事だけでは説明できない事実**に付けること。口コミで言える内容にURLを付けないこと
- 自社データ（口コミ・当サイト記事・学校情報）で語れる部分を、**Web要約の言い換えで埋めない**こと
- アウトラインのdataSourceHint（[データソース: ...]）を参考にしつつ、**review を最優先**すること
- 根拠カードのうち、本文で実際に使う主張の**8割以上は review / article / school_info に基づく**こと

### SEO最適化ルール
- キーワード「${input.keyword}」は記事全体で**5-8回程度、自然な間隔**で出現させること。**全文一致のままの連続使用は3回以下**にし、それ以外は「東京の通信制高校」「都内の通信制」など**分割・言い換え**でカバーすること（SEOのための不自然な反復は禁止）
- H1は記事タイトルそのもの（= "${input.title}"）
- H2にはキーワードまたはその関連語を含めること（**文頭にキーワード全文をそのまま置かない**こと）
- 導入文にキーワードを含めること（語順は自然に。メタ的な問いかけ文にしないこと）

### FAQセクション
- FAQセクションは質問をH3見出しとし、回答を本文として書くこと
- 各回答は80-150文字で簡潔に。可能であれば口コミや具体的データを含めること

### 文体
- 「です・ます」調で統一
- 読者への語りかけは「あなた」ではなく内容で寄り添うこと
- 専門用語には簡単な補足説明を添えること

## 出力形式
まずMarkdown記事本文を出力し、記事の最後に以下の区切り線とSEOメタ情報を追加してください:

---SEO_META---
{
  "metaTitle": "SEO用タイトル（30-50文字、キーワードを前半に配置）",
  "metaDescription": "120文字以内。以下を含むこと: ①キーワードまたは自然な分割形を**前半**に ②**当サイトアンケートの声**を軸にしたことが分かる表現 ③読者ベネフィットを**一文で自然に**。④全国の生徒数など**公的統計を「本記事の分析の根拠」と誤解される結びつけは禁止**（必要なら数字は出さない）⑤決まり文句の問いかけは禁止",
  "excerpt": "記事の要約（150-200文字）。読者が一覧ページで見たときに記事の価値が伝わる内容。具体的な口コミ件数やデータ、記事で分かることの要点を含めること",
  "focusKeyword": "${input.keyword}",
  "secondaryKeywords": ["実際にユーザーが検索しそうなフレーズを3-5個"]
}`;

  const response = await callLLM({
    provider,
    model,
    systemPrompt: `あなたは通信制高校メディア「通信制高校リアルレビュー」の専属SEOライターです。

## メディアについて
通信制高校リアルレビューは、実際の在校生・卒業生の声を元にした信頼性の高い通信制高校の情報メディアです。
独自に収集した口コミ・体験談・学校データを保有しており、それらを根拠とした記事を配信しています。

## 読者について
読者は通信制高校を検討中の中高生とその保護者です。
不登校経験のある生徒、全日制からの転入を考えている生徒、社会人で高卒資格を目指す方など、背景はさまざまです。
共通して「信頼できる具体的な情報」を求めており、一般論や曖昧な情報には敏感です。

## トーンとブランドボイス
「信頼できる先輩からのアドバイス」がコンセプトです。
- 堅すぎず砕けすぎず、丁寧だけど親しみやすい「です・ます」調
- 具体的な口コミを引用する際は「」で囲み、「在校生」「卒業生」など出所を明記する
- 読者を不安にさせすぎない。課題を提示しつつ、前向きな解決策やアクションを示す
- 根拠のない断定や過剰な煽りは絶対に避ける

## 執筆の鉄則
- すべての主張には根拠（口コミ引用・データ・出典）を付けること
- **当サイトアンケートの「」引用を厚く**し、特集記事の引用は補助に留めること
- **全国の公的統計と口コミ調査を同一の「データを踏まえた」主張で混ぜない**こと
- 「〜と言われています」「〜という声もあります」のような曖昧な伝聞表現は禁止。具体的な口コミの「」引用に置き換えること
- 数字で語れることは数字で語る（満足度、卒業率、学費など）
- **キーワードを文頭テンプレにしない**（読み上げて違和感がないかを意識すること）
- 出力はMarkdown形式のみ。前置き・解説・メタコメントは一切不要`,
    userPrompt: prompt,
    temperature: 0.4,
    maxTokens: 6000,
  });

  let raw = response.content;

  // LLMが ```markdown ... ``` で囲む場合があるので除去
  raw = raw.replace(/^```(?:markdown|md)?\s*\n?/i, '');
  raw = raw.replace(/\n?```\s*$/i, '');

  const metaSeparator = '---SEO_META---';
  // SEO_META区切り（前後に---や空行があるパターンも対応）
  const metaPattern = /\n*-{0,3}\s*---SEO_META---\s*-{0,3}\s*\n*/;
  const metaMatch = raw.match(metaPattern);

  let bodyMd: string;
  let seoMeta: SeoMeta;
  const fallbackMeta: SeoMeta = {
    metaTitle: input.title,
    metaDescription: `${input.keyword}について、口コミ・体験談をもとに詳しく解説します。`,
    excerpt: `${input.keyword}について、実際の在校生・卒業生の口コミや体験談をもとに詳しく解説します。この記事では具体的なデータと体験者の声を紹介し、あなたの疑問を解消します。`,
    focusKeyword: input.keyword,
    secondaryKeywords: [],
  };

  if (metaMatch && metaMatch.index !== undefined) {
    bodyMd = raw.slice(0, metaMatch.index).trim();
    const metaJson = raw.slice(metaMatch.index + metaMatch[0].length).trim();
    try {
      const jsonMatch = metaJson.match(/\{[\s\S]*\}/);
      seoMeta = JSON.parse(jsonMatch ? jsonMatch[0] : metaJson);
    } catch {
      seoMeta = fallbackMeta;
    }
  } else if (raw.includes(metaSeparator)) {
    const idx = raw.indexOf(metaSeparator);
    bodyMd = raw.slice(0, idx).trim();
    const metaJson = raw.slice(idx + metaSeparator.length).trim();
    try {
      const jsonMatch = metaJson.match(/\{[\s\S]*\}/);
      seoMeta = JSON.parse(jsonMatch ? jsonMatch[0] : metaJson);
    } catch {
      seoMeta = fallbackMeta;
    }
  } else {
    // SEO_METAがないがJSONブロックが末尾にあるパターン
    const trailingJson = raw.match(
      /\n\s*\{\s*"metaTitle"[\s\S]*\}\s*$/
    );
    if (trailingJson && trailingJson.index !== undefined) {
      bodyMd = raw.slice(0, trailingJson.index).trim();
      try {
        seoMeta = JSON.parse(trailingJson[0].trim());
      } catch {
        seoMeta = fallbackMeta;
      }
    } else {
      bodyMd = raw.trim();
      seoMeta = fallbackMeta;
    }
  }

  // 末尾に残った ``` や SEO_META 残骸をクリーンアップ
  bodyMd = bodyMd.replace(/\n*```\s*$/g, '');
  bodyMd = bodyMd.replace(/\n*-{3,}\s*$/g, '');
  bodyMd = bodyMd.trim();

  return {
    bodyMd,
    seoMeta,
    tokensUsed: response.tokensUsed,
  };
}
