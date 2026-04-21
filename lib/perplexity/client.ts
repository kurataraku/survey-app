/**
 * Perplexity Sonar API クライアント
 * 公式サイト情報を Web 検索して要約を生成する
 */

export interface PerplexitySummaryResult {
  summaryText: string;
  citations: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

function getPerplexityApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY が環境変数に設定されていません');
  }
  return apiKey;
}

function createSummaryPrompt(schoolName: string): string {
  return `通信制高校「${schoolName}」の公式サイトを検索し、以下3点を要約してください。

1. 学習スタイル — 公式の「学び方」「コース紹介」「学校の特長」ページから要点のみ簡潔に（コピペ禁止）
2. 場所・通学・スクーリング — 所在地、宿泊型/通学型、実施場所（本校/キャンパス/提携会場）
3. コース体系 — 公式コース一覧のコース名を固有名詞として列挙

★出力ルール（厳守）★:
- 3点を1つの段落にまとめ、180〜220字（200字前後）に収めること。
- 220字を超えたら情報を削って短くすること。180字未満なら具体的な特徴を追加すること。
- 箇条書き禁止。見出し・ラベル禁止。本文のみ出力。
- 文字数カウント（例:「（198字）」「（200文字）」など）は絶対に出力しないこと。
- 公式サイトに情報がない項目は省略。`;
}

/**
 * Perplexity Sonar API で公式サイト情報を検索し、学校の概要テキストを生成
 */
export async function callPerplexityForSummary(
  schoolName: string
): Promise<PerplexitySummaryResult> {
  const apiKey = getPerplexityApiKey();
  const prompt = createSummaryPrompt(schoolName);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            '通信制高校の公式情報を正確に要約する専門家です。公式サイトの情報のみを根拠にし、推測は含めないでください。',
        },
        { role: 'user', content: prompt },
      ],
      web_search_options: { search_context_size: 'high' },
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'Perplexity APIキーが無効です。Vercelの環境変数 PERPLEXITY_API_KEY を確認してください。'
      );
    }
    const errorBody = await response.text().catch(() => '');
    const shortBody = errorBody.length > 200 ? errorBody.slice(0, 200) + '...' : errorBody;
    throw new Error(
      `Perplexity API エラー (${response.status}): ${shortBody || response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];

  if (!content.trim()) {
    throw new Error('Perplexity API からのレスポンスが空です');
  }

  // LLMが末尾に付けてしまう文字数カウント表記を除去
  const cleaned = content.trim().replace(/[（(]\s*\d+\s*[字文][字]?\s*[）)]\s*$/, '').trim();

  return {
    summaryText: cleaned,
    citations,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    },
  };
}
