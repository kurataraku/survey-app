import type { SeoDraftEvidence, ConfidenceLevel } from './types';

interface WebResearcherInput {
  keyword: string;
  draftType: 'knowledge' | 'school';
  schoolName?: string;
}

interface WebResearcherOutput {
  evidence: Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

function getPerplexityApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY が未設定です');
  return apiKey;
}

export async function runWebResearcher(
  input: WebResearcherInput
): Promise<WebResearcherOutput> {
  const apiKey = getPerplexityApiKey();
  const model = process.env.SEO_WEB_SEARCH_MODEL || 'sonar-pro';

  const schoolContext =
    input.draftType === 'school' && input.schoolName
      ? `対象学校「${input.schoolName}」に関する`
      : '';

  const prompt = `通信制高校に関するキーワード「${input.keyword}」について、${schoolContext}以下の情報を**最小限**、公式・行政サイトから検索してください。

記事の主役は当サイトの口コミです。Webは**キーワードと直接関係する**制度・行政情報の補足のみ。無関係な全国トレンドはカードに含めないでください。

## 関連性のルール（必須）
- 各カードの内容は**キーワード「${input.keyword}」の検索意図と一文で説明できる関係**にあること。関係が薄い情報は出力しない（件数を減らしてよい）
- キーワードに**地名・都道府県**が含まれる場合: **その地域の教育委員会・都道府県・市区の公式、または文科省の一次資料**を優先。**全国の在籍者数ニュース・学校法人の広報まとめだけ**のカードは作らない
- キーワードが全国一般のみの場合: 文科省・教育委員会レベルの**制度・定義**に限定

調査対象の例（該当するものだけ。該当なしならカード数を減らす）:
1. キーワードに直結する制度の位置づけ（該当する行政の公式）
2. キーワードの地域がある場合、その**地域の通信制・高校教育に関する公的情報**
3. 口コミだけでは示せず、かつキーワードと**明確に関連する**統計（なければ省略）

★重要: 口コミサイト・まとめブログ・第三者SEOメディアは不要。公式・行政のみ。
★出力は**JSON配列 3件以内**（該当が少なければ1〜2件でもよい）。各 summary は**2文以内**。

以下のJSON形式で各情報を出力してください:
[
  {
    "title": "情報のタイトル（例: 通信制高校の制度概要）",
    "summary": "事実情報の要約（2-3文）",
    "confidence": "high/medium/low"
  }
]`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '通信制高校の公式情報・行政情報を正確に調査する専門家です。ユーザー指定キーワードと無関係な全国トレンドは返さず、公式・行政のみを根拠にしてください。',
        },
        { role: 'user', content: prompt },
      ],
      web_search_options: { search_context_size: 'high' },
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Perplexity API エラー (${response.status}): ${errorBody.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];

  const tokensUsed = {
    prompt: data.usage?.prompt_tokens || 0,
    completion: data.usage?.completion_tokens || 0,
    total:
      (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
  };

  const evidence: Omit<
    SeoDraftEvidence,
    'id' | 'draft_id' | 'retrieved_at'
  >[] = [];

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const cards = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        summary: string;
        confidence?: string;
      }>;

      const maxWebCards = 3;
      cards.slice(0, maxWebCards).forEach((card, i) => {
        evidence.push({
          kind: 'web',
          source_id: null,
          url: citations[i] || null,
          title: card.title,
          excerpt: null,
          summary: card.summary,
          section_ref: null,
          confidence: (card.confidence || 'medium') as ConfidenceLevel,
        });
      });
    }
  } catch {
    if (content.trim()) {
      evidence.push({
        kind: 'web',
        source_id: null,
        url: citations[0] || null,
        title: 'Web補足調査結果',
        excerpt: null,
        summary: content.slice(0, 500),
        section_ref: null,
        confidence: 'medium',
      });
    }
  }

  if (evidence.length === 0 && citations.length > 0) {
    evidence.push({
      kind: 'web',
      source_id: null,
      url: citations[0],
      title: 'Web補足情報',
      excerpt: null,
      summary: content.slice(0, 500) || '情報を取得しましたが、構造化できませんでした。',
      section_ref: null,
      confidence: 'low',
    });
  }

  return { evidence, tokensUsed };
}
