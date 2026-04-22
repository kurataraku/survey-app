import { callLLM, resolveModel } from './llm-client';
import { defaultOpenAiEconomyModel } from './openai-model-defaults';
import type { QualityScore, QualityIssue, SeoDraftEvidence } from './types';
import {
  analyzeProgrammaticQuoteGuards,
  clampScoresForQuoteGuardErrors,
} from './quote-guards';

interface VerifierInput {
  keyword: string;
  title: string;
  bodyMd: string;
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[];
}

interface VerifierOutput {
  qualityScore: QualityScore;
  tokensUsed: { prompt: number; completion: number; total: number };
}

interface ArticleMetrics {
  charCount: number;
  h2Count: number;
  h3Count: number;
  h2Headings: string[];
  /** キーワード全文の出現回数（スペース入り複合語は一致しにくい） */
  keywordCount: number;
  /** 複合キーワードを構成語に分けたときの各語の出現回数 */
  keywordTermCounts: { term: string; count: number }[];
  quotedTextCount: number;
  /** 本文中の http(s):// の出現回数（外部引用の多さの目安） */
  externalHttpCount: number;
  /** 長めの「」引用で、同一テキストが複数回出た回数（繰り返しの目安） */
  repeatedLongQuoteCount: number;
  hasFaqSection: boolean;
  h2SectionLengths: { heading: string; length: number }[];
}

function analyzeArticleMetrics(bodyMd: string, keyword: string): ArticleMetrics {
  const charCount = bodyMd.length;

  const h2Matches = bodyMd.match(/^## .+$/gm) || [];
  const h3Matches = bodyMd.match(/^### .+$/gm) || [];
  const h2Headings = h2Matches.map((h) => h.replace(/^## /, ''));
  const h2Count = h2Headings.length;
  const h3Count = h3Matches.length;

  const keywordEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keywordRegex = new RegExp(keywordEscaped, 'gi');
  const keywordCount = (bodyMd.match(keywordRegex) || []).length;

  let kwTerms = keyword
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (kwTerms.length === 0 && keyword.trim().length >= 2) {
    kwTerms = [keyword.trim()];
  }
  const keywordTermCounts = kwTerms.map((term) => {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'gi');
    return { term, count: (bodyMd.match(re) || []).length };
  });

  const quotedMatches = bodyMd.match(/「[^」]{10,}」/g) || [];
  const quotedTextCount = quotedMatches.length;

  const externalHttpCount = (bodyMd.match(/https?:\/\//gi) || []).length;

  const longQuoteInners = (bodyMd.match(/「([^」]{30,200})」/g) || []).map((q) =>
    q.slice(1, -1).trim()
  );
  const quoteFreq = new Map<string, number>();
  for (const inner of longQuoteInners) {
    quoteFreq.set(inner, (quoteFreq.get(inner) || 0) + 1);
  }
  let repeatedLongQuoteCount = 0;
  for (const c of quoteFreq.values()) {
    if (c > 1) repeatedLongQuoteCount += c - 1;
  }

  const hasFaqSection = /^##\s*.*(FAQ|よくある質問|Q\s*&\s*A|質問).*/im.test(bodyMd);

  const h2SectionLengths: { heading: string; length: number }[] = [];
  const lines = bodyMd.split('\n');
  let currentH2: string | null = null;
  let currentLength = 0;

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (currentH2 !== null) {
        h2SectionLengths.push({ heading: currentH2, length: currentLength });
      }
      currentH2 = line.replace(/^## /, '');
      currentLength = 0;
    } else if (currentH2 !== null) {
      currentLength += line.length;
    }
  }
  if (currentH2 !== null) {
    h2SectionLengths.push({ heading: currentH2, length: currentLength });
  }

  return {
    charCount,
    h2Count,
    h3Count,
    h2Headings,
    keywordCount,
    keywordTermCounts,
    quotedTextCount,
    externalHttpCount,
    repeatedLongQuoteCount,
    hasFaqSection,
    h2SectionLengths,
  };
}

export async function runVerifier(input: VerifierInput): Promise<VerifierOutput> {
  const { provider, model } = resolveModel(
    'SEO_VERIFIER_MODEL',
    defaultOpenAiEconomyModel(),
    'openai'
  );

  const selfDataCount = input.evidence.filter((e) => e.kind !== 'web').length;
  const totalEvidence = input.evidence.length;
  const selfDataRatio =
    totalEvidence > 0 ? Math.round((selfDataCount / totalEvidence) * 100) : 0;

  const metrics = analyzeArticleMetrics(input.bodyMd, input.keyword);

  const shortSections = metrics.h2SectionLengths
    .filter((s) => s.length < 300)
    .map((s) => `「${s.heading}」(${s.length}字)`);
  const longSections = metrics.h2SectionLengths
    .filter((s) => s.length > 600)
    .map((s) => `「${s.heading}」(${s.length}字)`);
  let keywordTerms = input.keyword
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (keywordTerms.length === 0 && input.keyword.trim().length >= 2) {
    keywordTerms = [input.keyword.trim()];
  }
  const h2WithoutKeyword = metrics.h2Headings.filter((h) => {
    if (input.keyword.length >= 2 && h.includes(input.keyword)) return false;
    return !keywordTerms.some((t) => h.includes(t));
  });

  const prompt = `あなたは「通信制高校リアルレビュー」の品質管理担当です。以下のSEO記事を**厳密に**検証し、品質スコアと具体的な指摘事項をJSON形式で出力してください。

## 記事情報
キーワード: ${input.keyword}
タイトル: ${input.title}

## 計測済みメトリクス（正確な数値）
- 本文文字数: ${metrics.charCount}文字
- H2見出し数: ${metrics.h2Count}個（${metrics.h2Headings.join('、')}）
- H3見出し数: ${metrics.h3Count}個
- キーワード全文「${input.keyword}」の連続一致: ${metrics.keywordCount}回（複合語は文中で分割されやすく、0回でも正常なことがある）
- キーワード構成語ごとの出現回数: ${metrics.keywordTermCounts.map((x) => `「${x.term}」${x.count}回`).join('、') || '（単一語キーワード）'}
- 「」で囲まれた口コミ引用: ${metrics.quotedTextCount}箇所
${(() => {
  const g = analyzeProgrammaticQuoteGuards(
    input.bodyMd,
    input.evidence as Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[]
  );
  if (g.length === 0) return '- 【自動検証】同一校「」引用の上限(2回)・校名必須: **違反なし**';
  return `- 【自動検証・要修正】\n${g.map((x) => `  - [${x.severity}] ${x.message}`).join('\n')}`;
})()}
- 本文中の http(s):// の出現: ${metrics.externalHttpCount}回（**ナレッジ記事では3回超**、**学校別でも6回超**は外部依存が強すぎる目安。issuesに「公的統計・制度に必要な最小限のURLに絞り、口コミ・当サイト記事中心に」と具体的に書くこと）
- 同一の長い「」引用の繰り返し: **${metrics.repeatedLongQuoteCount}回分の重複**（0より大きい場合は品質低下。issuesに「同じ引用は1セクションに1回まで。他は要約か別校の口コミに差し替え」と書くこと）
- FAQセクション: ${metrics.hasFaqSection ? 'あり' : 'なし'}
- 根拠カード数: 自社${selfDataCount}件 / 全${totalEvidence}件（自社データ比率: ${selfDataRatio}%）
${shortSections.length > 0 ? `- 短すぎるセクション（300字未満）: ${shortSections.join('、')}` : ''}
${longSections.length > 0 ? `- 長すぎるセクション（600字超）: ${longSections.join('、')}` : ''}
${h2WithoutKeyword.length > 0 ? `- キーワード未含有のH2: ${h2WithoutKeyword.join('、')}` : ''}

## 記事本文
${input.bodyMd.slice(0, 3000)}
${input.bodyMd.length > 3000 ? '\n...(以下省略)...' : ''}

## 検証チェックリスト
以下の各項目を確認し、問題があればissuesに具体的に記載すること:

### 事実精度 (factAccuracy)
- 根拠に基づいた記述か、ハルシネーションはないか
- 「」で囲まれた引用が**12箇所未満**の場合は根拠が薄い。factAccuracyは**75点上限**。**8箇所以下**なら60点以下。**16箇所以上**でアンケート声が厚い記事は高く評価してよい
- **8箇所未満で本文が外部URL中心**の場合は45点以下
- 各H2セクションに口コミ引用や具体的データが含まれているか
- **本文がWeb出典のURL列挙や他サイト要約で埋まり、当サイトアンケートの「」引用が薄い**場合は重大な問題。issuesに「根拠[kind=review]のexcerptを『』で増やし、特集記事だけに頼らない」と具体的に書くこと
- **キーワード全文を文頭に繰り返すテンプレ**（例:「通信制高校　東京で〜」が本文で何度も始まる）がある場合は文体の問題。issuesに「語順を変え、東京の通信制高校は…等に修正」と書くこと
- メタ・リードで**全国の生徒数・率と「当サイトの分析」「踏まえ」を同一視**している場合は重大（誇張・誤解招き）。issuesに「全国統計は参考1文に限定し、アンケート主役に修正」と書くこと
- キーワードに地域が含まれるのに、**全国の通信制在籍者数・増加のみの段落**が東京（等）の本文に挟まっている場合は構成上の問題。issuesに「全国統計の段落を削除、または地域選びと一文で接続できる1文に圧縮」と書くこと
- **同一高校名が出所として繰り返し登場**し、「」引用や要約が**同一校に偏りすぎている**場合はissuesに「当該校の引用は2回まで、他校の口コミに差し替え」と書くこと
- メトリクス欄の**【自動検証】**に同一校「」引用>2や校名欠落が出ている場合は**必ず severity:error**で追記し、overallは55未満を推奨（事実精度の欠陥として扱う）
- **（在校生・当サイトアンケート）等で校名が同じ文脈に無い**引用は重大。必ず「◯◯高等学校の回答では「…」」または「…」（◯◯高等学校・当サイトアンケート）の形にせよ
- 本文に **useful_info**、**(interview)** など内部用ラベルがそのまま出ている場合はissuesに「記事はMarkdown内部リンクとタイトルのみに修正」と書くこと
- **根拠にない校名**や、**リンク先の内容と主張が一致しない外部URL**がある場合は重大。issuesに「該当段落を削除または根拠カードに沿った引用に差し替え」と書くこと
- キーワードに地名・都道府県があるのに、**東京（等）固有の通学・拠点の話が薄く全国記事に見える**場合は警告。issuesに「地域の確認項目をチェックリストへ具体化」「口コミ・学校の偏りを減らす」と書くこと

### SEO最適化 (seoOptimization)
- H2の数は適切か（4-6個が理想）
- キーワードは**複合語の場合、全文一致回数だけで判断しないこと**。構成語（例: 通信制高校、デメリット）が本文・見出しに自然に含まれていれば良い。各構成語が合計で十分な頻度（目安: 主要語は各3回以上）なら高めに評価してよい
- 全文一致が0回でも、構成語が適切に使われていれば「キーワード不足」として過小評価しないこと
- 導入文（最初のH2の前）が検索意図に直接答えているか
- FAQセクションが存在し、3-5個のQ&Aがあるか

### 可読性 (readability)
- 文章の読みやすさ、段落構成、言い回しは自然か
- 各H2セクションが300-600文字あるか
- 記事が2500文字未満の場合、readabilityは70点以下

### 自社データ比率 (selfDataRatio)
- 自社データが記事の70-80%の根拠になっているか

## スコアリング基準（厳格に適用すること）
- 90-100: 即公開可能な高品質記事（全チェック項目クリア）
- 75-89: 軽微な修正で公開可能
- 60-74: 大幅なリライトが必要
- 0-59: 再生成推奨

## 出力形式（JSONのみ出力）
{
  "overall": 0-100の総合スコア,
  "factAccuracy": 0-100,
  "seoOptimization": 0-100,
  "readability": 0-100,
  "selfDataRatio": ${selfDataRatio},
  "issues": [
    {
      "severity": "error/warning/info",
      "message": "具体的で実行可能な指摘内容（何をどう修正すべきか明記）",
      "section": "該当セクション（任意）"
    }
  ]
}

## issues記載ルール
- 曖昧な指摘は禁止。以下のように具体的に記載すること:
  - ✕「SEO改善点あり」→ ◯「H2「○○」にキーワードが含まれていません。「通信制高校 ○○」のように追加してください」
  - ✕「文字数不足」→ ◯「記事全体が約${metrics.charCount}文字です。3000-4500文字を目標に、各セクションにもう1-2段落追加してください」
  - ✕「口コミ引用が少ない」→ ◯「「」引用が${metrics.quotedTextCount}箇所です。当サイトアンケートの原文を「」で16回以上（合計20回前後）になるよう各H2に追加してください」
- severity判定:
  - error: 事実誤認、根拠なしの断定、「」引用が**8箇所以下**、**すべてのキーワード構成語が本文で極端に少ない**（各1回未満など）、自社データ比率50%未満
  - warning: H2数の過不足、セクション文字数不足/過多、FAQ不足、「」引用が**12箇所未満**、自社データ比率50-70%、構成語のバランスが悪い
  - info: スタイル改善提案、より良い表現の提案`;

  const response = await callLLM({
    provider,
    model,
    systemPrompt:
      'SEO記事の品質管理専門家です。厳密に検証し、構造化されたJSON出力のみ行ってください。甘い採点は厳禁です。',
    userPrompt: prompt,
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: provider === 'openai',
  });

  let qualityScore: QualityScore;

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content) as {
      overall: number;
      factAccuracy: number;
      seoOptimization: number;
      readability: number;
      selfDataRatio: number;
      issues: QualityIssue[];
    };

    const programmaticIssues = analyzeProgrammaticQuoteGuards(
      input.bodyMd,
      input.evidence as Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[]
    );
    const hasQuoteGuardError = programmaticIssues.some((i) => i.severity === 'error');

    const mergedIssues = [...programmaticIssues, ...(Array.isArray(parsed.issues) ? parsed.issues : [])];

    let overall = clamp(parsed.overall, 0, 100);
    let factAccuracy = clamp(parsed.factAccuracy, 0, 100);
    const capped = clampScoresForQuoteGuardErrors(
      { overall, factAccuracy },
      hasQuoteGuardError
    );
    overall = capped.overall;
    factAccuracy = capped.factAccuracy;

    qualityScore = {
      overall,
      factAccuracy,
      seoOptimization: clamp(parsed.seoOptimization, 0, 100),
      readability: clamp(parsed.readability, 0, 100),
      selfDataRatio: selfDataRatio,
      issues: mergedIssues,
    };
  } catch {
    const programmaticIssues = analyzeProgrammaticQuoteGuards(
      input.bodyMd,
      input.evidence as Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[]
    );
    const hasQuoteGuardError = programmaticIssues.some((i) => i.severity === 'error');
    const capped = clampScoresForQuoteGuardErrors(
      { overall: 50, factAccuracy: 50 },
      hasQuoteGuardError
    );
    qualityScore = {
      overall: capped.overall,
      factAccuracy: capped.factAccuracy,
      seoOptimization: 50,
      readability: 50,
      selfDataRatio: selfDataRatio,
      issues: [
        ...programmaticIssues,
        {
          severity: 'warning',
          message: '品質検証の出力解析に失敗しました。手動で確認してください。',
        },
      ],
    };
  }

  return {
    qualityScore,
    tokensUsed: response.tokensUsed,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
