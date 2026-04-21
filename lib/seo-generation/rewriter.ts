import { callLLM, resolveModel } from './llm-client';
import type { SeoMeta, QualityScore, SeoDraftEvidence } from './types';

interface RewriterInput {
  keyword: string;
  title: string;
  bodyMd: string;
  qualityScore: QualityScore;
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[];
}

interface RewriterOutput {
  bodyMd: string;
  seoMeta: SeoMeta;
  tokensUsed: { prompt: number; completion: number; total: number };
}

export async function runRewriter(input: RewriterInput): Promise<RewriterOutput> {
  const { provider, model } = resolveModel(
    'SEO_WRITER_MODEL',
    process.env.ANTHROPIC_API_KEY ? 'claude-opus-4-20250514' : 'gpt-5.4',
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'
  );

  const issuesList = input.qualityScore.issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.message}${issue.section ? ` (${issue.section})` : ''}`)
    .join('\n');

  const evidenceKindOrder: Record<string, number> = {
    review: 0,
    article: 1,
    school_info: 2,
    web: 3,
  };
  const evidenceExcerpts = [...input.evidence]
    .sort(
      (a, b) =>
        (evidenceKindOrder[a.kind] ?? 9) - (evidenceKindOrder[b.kind] ?? 9)
    )
    .filter((e) => e.excerpt || e.section_ref)
    .map((e) => {
      const src = e.section_ref ? `引用元: ${e.section_ref} ` : '';
      const quote = e.excerpt ? `「${e.excerpt}」` : `（要約のみ）${e.summary.slice(0, 120)}`;
      return `【${e.kind}】${src}${quote}`;
    })
    .join('\n');

  const prompt = `あなたは「通信制高校リアルレビュー」のSEOライター兼エディターです。
以下の記事が品質検証で指摘を受けました。指摘事項を全て改善したリライト版を出力してください。

## 品質スコア
総合: ${input.qualityScore.overall}/100
事実精度: ${input.qualityScore.factAccuracy}/100
SEO最適化: ${input.qualityScore.seoOptimization}/100
可読性: ${input.qualityScore.readability}/100

## 指摘事項
${issuesList}

## 利用可能な口コミ引用
${evidenceExcerpts || '（なし）'}

## キーワード: ${input.keyword}
## 現在の記事タイトル: ${input.title}

## 現在の記事本文
${input.bodyMd}

## リライトルール
1. 指摘事項を全て改善すること
2. **【review】を最優先**し、上記リストの**アンケート原文**から「」引用を大幅に増やすこと（目安: アンケート由来16回以上、全体20回前後）。引用元に高校名がある場合は本文でも必ず明記すること
3. キーワードの出現回数が不足している場合は**語順を変えて**自然に追加すること（文頭にキーワード全文を並べない）
4. 文字数が不足している場合は各セクションを充実させること
5. 既存の良い部分は維持しつつ改善すること
6. 出力はMarkdown形式で、記事本文のみ（タイトルのH1含む）
7. 記事の最後に ---SEO_META--- セクションを含めること
8. 外部サイトの http(s):// を含む【出典】・リンクは**3件程度**に抑え、口コミ・当サイト記事で足りる主張からはURLを削除すること（公的統計・制度の一行補足にのみ残す）
9. **同じ「」引用や同一インタビューの長文を繰り返している箇所は1回に統合**し、不足分は別の口コミ・別校の要約で補うこと
10. 「通信制高校　東京で本当に大丈夫？」のような**メタ的・テンプレ感の文**や、**結論：キーワード全文〜**の連発をやめ、編集長向けの自然な日本語に直すこと
11. **同一高校名の「」引用は記事全体で2回まで（チェックリストの口コミ例の「」も含む）**。3回目以降は削除または別校の引用・無「」要約に置換する。地域キーワード記事では**全国在籍者数だけの段落を削除または圧縮**する。Web出典はキーワードと無関係なら削除する
12. 根拠に**内部リンクURL**がある記事・学校は、**Markdownリンク**に直す（useful_info 等のラベルは削除）。主張と無関係な外部URL・校名は削除する
13. **「（在校生・当サイトアンケート）」等で校名が無い引用をすべて修正**する。各「」の前後に**正式校名**を入れる（根拠の引用元ラベルと一致）

---SEO_META---
{
  "metaTitle": "改善されたSEOタイトル",
  "metaDescription": "改善されたメタディスクリプション（120文字以内。決まり文句の問いかけは避け、自然な一文で）",
  "excerpt": "記事の要約（150-200文字）。読者が一覧ページで見たときに記事の価値が伝わる内容",
  "focusKeyword": "${input.keyword}",
  "secondaryKeywords": ["改善された副キーワード1", "改善された副キーワード2", "改善された副キーワード3"]
}`;

  const response = await callLLM({
    provider,
    model,
    systemPrompt: `通信制高校メディア「通信制高校リアルレビュー」の専属SEOエディターです。
品質検証のフィードバックに基づき記事をリライトします。
**当サイトアンケートの口コミを主根拠**にし、外部URLに依存する文は削減してください。アンケートの「」原文を**合計20回前後**（うちアンケート由来が半数以上）になるよう増やし、特集記事の引用だけで埋めないこと。キーワード全文を**文頭テンプレ**（例:「通信制高校　東京で〜」の繰り返し）にしないこと。**全国の公的統計と「本記事は〜を踏まえ」を結びつけない**（メタ・リードを修正）。Webは制度・統計の補足に限定し、本文中の https:// は多くても3件程度を目安にしてください。
出力はMarkdown形式のみです。`,
    userPrompt: prompt,
    temperature: 0.4,
    maxTokens: 6000,
  });

  let raw = response.content;
  raw = raw.replace(/^```(?:markdown|md)?\s*\n?/i, '');
  raw = raw.replace(/\n?```\s*$/i, '');

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
  } else {
    const trailingJson = raw.match(/\n\s*\{\s*"metaTitle"[\s\S]*\}\s*$/);
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

  bodyMd = bodyMd.replace(/\n*```\s*$/g, '');
  bodyMd = bodyMd.replace(/\n*-{3,}\s*$/g, '');
  bodyMd = bodyMd.trim();

  return { bodyMd, seoMeta, tokensUsed: response.tokensUsed };
}
