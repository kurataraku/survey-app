import OpenAI from 'openai';

/**
 * OpenAIクライアントの初期化
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY が環境変数に設定されていません');
  }

  return new OpenAI({
    apiKey,
  });
}

/**
 * 口コミ要約生成用のプロンプトを作成
 */
function createSummaryPrompt(
  schoolName: string,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
  }>
): string {
  const reviewsText = reviews
    .map((review, index) => {
      const stars = '★'.repeat(review.overall_satisfaction);
      return `【口コミ${index + 1}】総合満足度: ${stars} (${review.overall_satisfaction}/5)
良い点: ${review.good_comment}
改善してほしい点: ${review.bad_comment}`;
    })
    .join('\n\n');

  return `あなたは通信制高校の口コミ・評判を分析する専門家です。以下の口コミデータを基に、学校の特徴を要約してください。

学校名: ${schoolName}

口コミデータ:
${reviewsText}

以下の形式で要約を生成してください：

## 概要（250〜400字）
口コミ・評判から見える学校の特徴を、傾向として要約してください。「口コミ」「評判」という言葉を必ず含めてください。断定ではなく、傾向として表現してください。

## この学校が合う人
- 項目1（簡潔に）
- 項目2（簡潔に）

## この学校が合わない人
- 項目1（簡潔に）
- 項目2（簡潔に）

## SEO用メタ情報
- meta_title: 学校名を含む28〜35文字のタイトル（「口コミ」「評判」を含む）
- meta_description: 要約である旨を含む100〜120文字の説明文

注意事項:
- 個人名、具体的な校舎名、誹謗中傷、過度な断定表現は避けてください
- 口コミの傾向を客観的に要約し、主観的な評価は避けてください
- 「本ページの口コミ・評判をもとにAIが傾向を要約しています」という免責文を末尾に追加してください`;
}

/**
 * OpenAI APIレスポンスから要約情報をパース
 */
function parseSummaryResponse(response: string): {
  summaryText: string;
  metaTitle: string;
  metaDescription: string;
} {
  // レスポンスをパース（マークダウン形式を想定）
  const summaryMatch = response.match(/## 概要[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  const fitsMatch = response.match(/## この学校が合う人[\s\S]*?\n([\s\S]*?)(?=\n## |$)/);
  const notFitsMatch = response.match(/## この学校が合わない人[\s\S]*?\n([\s\S]*?)(?=\n## |$)/);
  const metaTitleMatch = response.match(/meta_title:\s*(.+?)(?:\n|$)/i);
  const metaDescriptionMatch = response.match(/meta_description:\s*(.+?)(?:\n|$)/i);

  const summary = summaryMatch?.[1]?.trim() || '';
  const fits = fitsMatch?.[1]?.trim() || '';
  const notFits = notFitsMatch?.[1]?.trim() || '';

  // 要約テキストを組み立て
  let summaryText = summary;
  if (fits) {
    summaryText += '\n\n## この学校が合う人\n' + fits;
  }
  if (notFits) {
    summaryText += '\n\n## この学校が合わない人\n' + notFits;
  }
  summaryText += '\n\n※本ページの口コミ・評判をもとにAIが傾向を要約しています。';

  const metaTitle = metaTitleMatch?.[1]?.trim() || '';
  const metaDescription = metaDescriptionMatch?.[1]?.trim() || '';

  return {
    summaryText: summaryText.trim(),
    metaTitle: metaTitle.trim(),
    metaDescription: metaDescription.trim(),
  };
}

/**
 * OpenAI APIを使用して口コミ要約を生成
 */
export async function callOpenAIForSummary(
  schoolName: string,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
  }>
): Promise<{
  summaryText: string;
  metaTitle: string;
  metaDescription: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  // 口コミテキストを整形（最大文字数制限）
  const MAX_CHAR_PER_REVIEW = 300; // good_comment + bad_comment の合計
  const MAX_TOTAL_CHARS = 25000; // 全体の文字数上限

  const formattedReviews = reviews
    .map((review) => {
      const good = (review.good_comment || '').slice(0, MAX_CHAR_PER_REVIEW);
      const bad = (review.bad_comment || '').slice(0, MAX_CHAR_PER_REVIEW);
      return {
        good_comment: good,
        bad_comment: bad,
        overall_satisfaction: review.overall_satisfaction,
      };
    })
    .filter((review) => review.good_comment || review.bad_comment);

  // 文字数制限に達するまで古い口コミから間引き
  let totalChars = 0;
  const selectedReviews: typeof formattedReviews = [];
  for (const review of formattedReviews) {
    const reviewChars =
      (review.good_comment?.length || 0) + (review.bad_comment?.length || 0);
    if (totalChars + reviewChars > MAX_TOTAL_CHARS) {
      break;
    }
    selectedReviews.push(review);
    totalChars += reviewChars;
  }

  if (selectedReviews.length === 0) {
    throw new Error('要約生成に使用できる口コミがありません');
  }

  const prompt = createSummaryPrompt(schoolName, selectedReviews);

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'あなたは通信制高校の口コミ・評判を分析する専門家です。客観的で中立的な要約を生成してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // 出力トークン数の上限
    });

    const responseText = completion.choices[0]?.message?.content || '';
    if (!responseText) {
      throw new Error('OpenAI APIからのレスポンスが空です');
    }

    const parsed = parseSummaryResponse(responseText);

    return {
      ...parsed,
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAI API呼び出しエラー: ${error.message}`);
    }
    throw error;
  }
}
