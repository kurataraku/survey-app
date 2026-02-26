import OpenAI from 'openai';
import type { SeoSectionKey } from '@/lib/seo-sections';
import { SEO_SECTION_LABELS, FAQ_QUESTIONS, type FaqItem } from '@/lib/seo-sections';
import type { ReviewTendencySummary } from '@/lib/review-tendency';

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
口コミ・評判から見える学校の特徴を、傾向として要約してください。ただし、「口コミ」「評判」という言葉は使わず、特徴そのものを直接説明してください。断定ではなく、傾向として表現してください。

## この学校が合う人
- 項目1（簡潔に）
- 項目2（簡潔に）

## この学校が合わない人
- 項目1（簡潔に）
- 項目2（簡潔に）

## SEO用メタ情報
- meta_title: 学校名を含む28〜35文字のタイトル。「口コミ」「評判」という言葉を必ず含めてください（例：「○○高等学校の口コミ・評判を徹底分析」など）。
- meta_description: 学校名と主要な特徴を簡潔にまとめた説明文（105〜115文字）。「○○高等学校の口コミ・評判から見える特徴として、」から始まり、特徴のみを自然な文章で説明してください。文末は必ず句点（。）で終わり、途中で切れないようにしてください。合う人・合わない人の情報は含めません。「口コミ・評判」という言葉は接頭語に1度のみ使用するため、本文では使わないでください。

注意事項:
- 個人名、具体的な校舎名、誹謗中傷、過度な断定表現は避けてください
- 口コミの傾向を客観的に要約し、主観的な評価は避けてください
- 「本ページの口コミ・評判をもとにAIが傾向を要約しています」という免責文を末尾に追加してください`;
}

/**
 * 要約テキストからMeta Descriptionを生成（100文字程度、特徴のみ）
 */
function generateMetaDescriptionFromSummary(
  schoolName: string,
  summaryText: string
): string {  
  // 要約テキストから概要部分のみを抽出（「## この学校が合う人」の前まで）
  let summary = '';
  if (summaryText.includes('## この学校が合う人')) {
    const summaryMatch = summaryText.match(/^([\s\S]*?)(?=\n\n## この学校が合う人|\n## この学校が合う人)/);
    summary = summaryMatch?.[1]?.trim() || '';
  } else {
    // 「## この学校が合う人」がない場合は全体から免責文を除いたものを使用
    summary = summaryText.replace(/\n\n※.*$/, '').trim();
  }
  // 概要から不要な接頭語を削除
  const prefixPatterns = [
    new RegExp(`^${schoolName}の口コミ・評判から見える特徴として、`),
    new RegExp(`^${schoolName}の口コミ・評判からは、`),
    new RegExp(`^${schoolName}に関する口コミ・評判からは、`),
    /^口コミ・評判から見える特徴として、/,
    /^口コミ・評判からは、/,
    /^口コミ・評判によれば、/,
    /^口コミ・評判では、/,
  ];
  
  let cleanedSummary = summary;
  for (const pattern of prefixPatterns) {
    cleanedSummary = cleanedSummary.replace(pattern, '').trim();
  }
  
  // 「口コミ・評判」「口コミ」「評判」という表現を除去（接頭語に含まれるため重複を避ける）
  cleanedSummary = cleanedSummary
    .replace(/口コミ・評判/g, '')
    .replace(/口コミ/g, '')
    .replace(/評判/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 105〜115文字程度に調整（接頭語「○○高等学校の口コミ・評判から見える特徴として、」を含めて）
  const prefix = `${schoolName}の口コミ・評判から見える特徴として、`;
  const targetLength = 110; // 中間値
  const minLength = 105;
  const maxLength = 115;
  const availableLength = maxLength - prefix.length; // 約70文字程度（余裕を持たせる）

  // 文の区切りで自然に切る（必ず句点で終わるようにする）
  let summaryShort = cleanedSummary;
  const sentences = summaryShort.match(/[^。！？]+[。！？]/g) || [];
  
  if (sentences.length > 0) {
    let accumulated = '';
    for (const sentence of sentences) {
      const candidate = accumulated + sentence;
      if (candidate.length <= availableLength) {
        accumulated = candidate;
      } else {
        break;
      }
    }
    
    if (accumulated) {
      summaryShort = accumulated;
    } else {
      // 最初の文が長すぎる場合は、文の途中で自然に切れる位置を探す
      // 読点（、）や助詞で切れる位置を探す
      const firstSentence = sentences[0];
      if (firstSentence) {
        let cutPoint = availableLength;
        for (let i = availableLength - 1; i >= availableLength - 20 && i >= 20; i--) {
          const char = firstSentence.charAt(i);
          if (char === '、' || char === 'の' || char === 'が' || char === 'を' || char === 'に') {
            cutPoint = i + 1;
            break;
          }
        }
        summaryShort = firstSentence.substring(0, cutPoint);
        if (!summaryShort.match(/[。！？]$/)) {
          summaryShort += '。';
        }
      } else {
        // sentencesが空の場合は文字数で切る
        summaryShort = summaryShort.substring(0, availableLength - 3) + '...';
        if (!summaryShort.match(/[。！？]$/)) {
          summaryShort += '。';
        }
      }
    }
  } else {
    // 句点がない場合は、読点や助詞で自然に切れる位置を探す
    if (summaryShort.length > availableLength) {
      let cutPoint = availableLength;
      for (let i = availableLength - 1; i >= availableLength - 20 && i >= 20; i--) {
        const char = summaryShort.charAt(i);
        if (char === '、' || char === 'の' || char === 'が' || char === 'を' || char === 'に') {
          cutPoint = i + 1;
          break;
        }
      }
      summaryShort = summaryShort.substring(0, cutPoint);
      if (!summaryShort.match(/[。！？]$/)) {
        summaryShort += '。';
      }
    }
  }

  // Meta Descriptionを組み立て
  let metaDesc = prefix + summaryShort;
  
  // 末尾が句点で終わっていない場合は追加（必須）
  if (!metaDesc.match(/[。！？]$/)) {
    metaDesc += '。';
  }

  // 文字数調整（105〜115文字の範囲に収める、5〜10文字オーバーは許容）
  if (metaDesc.length < minLength) {
    // 105文字未満の場合は、もう少し詳細を追加（ただし115文字を超えないように）
    const remainingSpace = maxLength - metaDesc.length;
    if (remainingSpace > 10 && cleanedSummary.length > summaryShort.length) {
      // 次の文を追加できるか確認
      const remainingText = cleanedSummary.substring(summaryShort.length).trim();
      const nextSentences = remainingText.match(/[^。！？]+[。！？]/g) || [];
      
      if (nextSentences.length > 0) {
        const nextSentence = nextSentences[0];
        if (nextSentence) {
          const candidateLength = metaDesc.length - 1 + nextSentence.length; // 既存の句点を削除して追加
          
          if (candidateLength <= maxLength + 10) { // 10文字オーバーまで許容
            metaDesc = metaDesc.replace(/[。！？]$/, '');
            metaDesc += nextSentence;
          }
        }
      }
    }
  } else if (metaDesc.length > maxLength + 10) {
    // 125文字（115+10）を超える場合は短縮
    const excess = metaDesc.length - (maxLength + 10);
    const prefixLength = prefix.length;
    const currentSummary = metaDesc.substring(prefixLength);
    const newSummaryLength = Math.max(30, currentSummary.length - excess - 2); // 余裕を持たせる
    
    // 自然に切れる位置を探す
    let truncatedSummary = currentSummary.substring(0, newSummaryLength);
    for (let i = truncatedSummary.length - 1; i >= truncatedSummary.length - 15 && i >= 0; i--) {
      const char = truncatedSummary.charAt(i);
      if (char === '。' || char === '、') {
        truncatedSummary = truncatedSummary.substring(0, i + (char === '。' ? 1 : 0));
        break;
      }
    }
    
    metaDesc = prefix + truncatedSummary;
    if (!metaDesc.match(/[。！？]$/)) {
      metaDesc += '。';
    }
  }
  
  // 「...」で終わっている場合は削除して句点を追加
  metaDesc = metaDesc.replace(/\.\.\.+[。！？]*$/, '。');

  const finalMetaDesc = metaDesc.trim();  
  return finalMetaDesc;
}

/**
 * OpenAI APIレスポンスから要約情報をパース
 */
function parseSummaryResponse(
  response: string,
  schoolName: string
): {
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

  let metaTitle = metaTitleMatch?.[1]?.trim() || '';
  let metaDescription = metaDescriptionMatch?.[1]?.trim() || '';
  // meta_titleに「口コミ」または「評判」が含まれているかチェック（より堅牢な方法）
  const hasKuchikomi = metaTitle && (metaTitle.includes('口コミ') || metaTitle.includes('くちこみ') || metaTitle.includes('クチコミ'));
  const hasHyoban = metaTitle && (metaTitle.includes('評判') || metaTitle.includes('ひょうばん') || metaTitle.includes('ヒョウバン'));
  const hasKuchikomiOrHyoban = hasKuchikomi || hasHyoban;
  // meta_titleに「口コミ」「評判」が含まれていない場合は自動的に追加または修正
  if (!metaTitle || !hasKuchikomiOrHyoban) {
    if (metaTitle) {
      // 既存のタイトルがあるが「口コミ・評判」が含まれていない場合
      // 学校名の後に「の口コミ・評判」を追加
      // パターン1: 「○○高等学校」で始まる場合
      if (metaTitle.startsWith(schoolName)) {
        const rest = metaTitle.substring(schoolName.length).trim();
        // 「の」が既にある場合は重複を避ける
        if (rest.startsWith('の')) {
          metaTitle = `${schoolName}の口コミ・評判${rest.substring(1)}`;
        } else {
          metaTitle = `${schoolName}の口コミ・評判${rest}`;
        }
      } else if (metaTitle.includes(schoolName)) {
        // パターン2: 学校名が含まれているが先頭でない場合
        const schoolNameIndex = metaTitle.indexOf(schoolName);
        const before = metaTitle.substring(0, schoolNameIndex);
        const after = metaTitle.substring(schoolNameIndex + schoolName.length);
        // 「の」が既にある場合は重複を避ける
        if (after.startsWith('の')) {
          metaTitle = `${before}${schoolName}の口コミ・評判${after.substring(1)}`;
        } else {
          metaTitle = `${before}${schoolName}の口コミ・評判${after}`;
        }
      } else {
        // パターン3: 学校名が含まれていない場合
        metaTitle = `${schoolName}の口コミ・評判${metaTitle}`;
      }
    } else {
      // meta_titleが生成されていない場合はフォールバック生成
      metaTitle = `${schoolName}の口コミ・評判を徹底分析`;
    }
    
    // 文字数制限（28〜35文字）を超える場合は調整
    if (metaTitle.length > 35) {
      // 後ろから削る
      const excess = metaTitle.length - 35;
      const basePart = `${schoolName}の口コミ・評判`;
      const restPart = metaTitle.substring(basePart.length);
      if (restPart.length > excess) {
        // 「を徹底分析」などの末尾部分を短縮または削除
        const truncatedRest = restPart.substring(0, Math.max(0, restPart.length - excess - 3));
        metaTitle = basePart + truncatedRest;
      } else {
        metaTitle = basePart;
      }
    }  }
  // meta_descriptionが適切な長さでない場合（105文字未満または125文字超過）、要約テキストから生成
  // 免責文を除いた要約テキストを使用
  const summaryTextForMeta = summaryText.replace(/\n\n※.*$/, '');
  if (metaDescription.length < 105 || metaDescription.length > 125) {    metaDescription = generateMetaDescriptionFromSummary(schoolName, summaryTextForMeta);  }

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

    const parsed = parseSummaryResponse(responseText, schoolName);

    return {
      ...parsed,
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    // OpenAI APIエラーの詳細情報を取得
    let errorDetails: any = {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    };
    
    // OpenAI SDKのエラーオブジェクトから詳細情報を抽出
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      if (errorObj.status) errorDetails.status = errorObj.status;
      if (errorObj.code) errorDetails.code = errorObj.code;
      if (errorObj.type) errorDetails.type = errorObj.type;
      if (errorObj.param) errorDetails.param = errorObj.param;
      if (errorObj.response) {
        errorDetails.responseStatus = errorObj.response?.status;
        errorDetails.responseData = errorObj.response?.data;
      }
    }
    
    // より詳細なエラーメッセージを構築
    let detailedMessage = error instanceof Error ? error.message : String(error);
    if (errorDetails.status) {
      detailedMessage += ` (Status: ${errorDetails.status})`;
    }
    if (errorDetails.code) {
      detailedMessage += ` (Code: ${errorDetails.code})`;
    }
    if (errorDetails.responseData) {
      detailedMessage += ` (Response: ${JSON.stringify(errorDetails.responseData)})`;
    }
    
    if (error instanceof Error) {
      const enhancedError = new Error(`OpenAI API呼び出しエラー: ${detailedMessage}`);
      // 元のエラー情報を保持
      (enhancedError as any).originalError = error;
      (enhancedError as any).errorDetails = errorDetails;
      throw enhancedError;
    }
    throw error;
  }
}

// --- SEO本文・FAQ生成（供給路用） ---

function formatReviewsForPrompt(
  reviews: Array<{ good_comment: string; bad_comment: string; overall_satisfaction: number; answers?: Record<string, unknown> }>
): string {
  const MAX = 8000;
  let len = 0;
  const parts: string[] = [];
  for (const r of reviews) {
    const block = `【口コミ】満足度${r.overall_satisfaction}/5\n良い点: ${(r.good_comment || '').slice(0, 200)}\n気になる点: ${(r.bad_comment || '').slice(0, 200)}\n`;
    if (len + block.length > MAX) break;
    parts.push(block);
    len += block.length;
  }
  return parts.join('\n');
}

function createSeoSectionPrompt(
  schoolName: string,
  sectionKey: SeoSectionKey,
  reviewsText: string,
  officialText: string
): string {
  const label = SEO_SECTION_LABELS[sectionKey];
  const instructions: Record<SeoSectionKey, string> = {
    good_bad:
      '口コミの良い評判・悪い評判を項目別（先生対応・雰囲気・単位・学費・柔軟さ・サポートなど）に整理し、傾向として200〜400字でまとめてください。断定は避け、「〜という声がある」「傾向として」と表現してください。',
    tuition:
      '学費に関する口コミの傾向（納得感・負担感）をまとめつつ、数値（金額・回数）は口コミからは断定せず「公式の案内を確認してください」と促す形にしてください。200〜350字。',
    learning:
      'レポート・単位取得に関する口コミの傾向をまとめてください。公式情報があれば補足。200〜350字。',
    syllabus:
      'スクーリング・通学頻度に関する口コミの傾向と、公式情報があればその要点をまとめてください。200〜350字。',
    flexibility:
      '不登校や心身の波がある子の「通いやすさ」「学びの柔軟さ」に関する口コミの傾向をまとめてください。200〜350字。',
  };
  return `あなたは通信制高校の口コミ・評判を分析する専門家です。以下の口コミと公式情報のみを根拠に、「${label}」の本文を生成してください。

学校名: ${schoolName}

【口コミデータ】
${reviewsText}

【公式・紹介文（参考）】
${officialText || '（なし）'}

${instructions[sectionKey]}

注意: 口コミにない内容は書かないでください。数値は公式のみ断定。口コミは「傾向」「〜という声」で表現。出力は本文のみ（見出しやラベルは付けない）。`;
}

/**
 * SEO本文セクションを1つ生成（GPT連携）
 */
export async function callOpenAIForSeoSection(
  schoolName: string,
  sectionKey: SeoSectionKey,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
    answers?: Record<string, unknown>;
  }>,
  officialText?: string
): Promise<{ summaryText: string; tokensUsed: { prompt: number; completion: number; total: number } }> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const reviewsText = formatReviewsForPrompt(reviews);
  const prompt = createSeoSectionPrompt(schoolName, sectionKey, reviewsText, officialText || '');

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'あなたは通信制高校の口コミを分析する専門家です。口コミと公式情報のみを根拠に、客観的で中立的な本文を生成してください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  const summaryText = (completion.choices[0]?.message?.content || '').trim();
  if (!summaryText) throw new Error('OpenAI APIからのレスポンスが空です');

  return {
    summaryText,
    tokensUsed: {
      prompt: completion.usage?.prompt_tokens || 0,
      completion: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    },
  };
}

function createFaqPrompt(
  schoolName: string,
  reviewsText: string,
  officialText: string
): string {
  const qList = FAQ_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return `あなたは通信制高校の口コミ・評判を分析する専門家です。以下の口コミと公式情報のみを根拠に、次の5問に答えてください。

学校名: ${schoolName}

【口コミデータ】
${reviewsText}

【公式・紹介文（参考）】
${officialText || '（なし）'}

【質問】
${qList}

出力形式（JSONのみ、他は書かない）:
[
  {"question": "質問1の全文", "answer": "回答1（80〜150字）"},
  {"question": "質問2の全文", "answer": "回答2"},
  ...
]

注意: 口コミ・公式にない内容は書かず、「〜という声がある」「傾向として」を使う。口コミが少ない場合は「現時点では限られた声のなかでは〜」と表現。`;
}

/**
 * FAQ 5問の回答を一括生成（GPT連携）
 */
export async function callOpenAIForFaq(
  schoolName: string,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
    answers?: Record<string, unknown>;
  }>,
  officialText?: string
): Promise<{ items: FaqItem[]; tokensUsed: { prompt: number; completion: number; total: number } }> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const reviewsText = formatReviewsForPrompt(reviews);
  const prompt = createFaqPrompt(schoolName, reviewsText, officialText || '');

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'あなたは通信制高校の口コミを分析する専門家です。指定された5問に、口コミ・公式情報のみを根拠に答えてください。出力は必ずJSON配列のみにしてください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 1500,
  });

  const raw = (completion.choices[0]?.message?.content || '').trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;
  let items: FaqItem[];
  try {
    items = JSON.parse(jsonStr) as FaqItem[];
  } catch {
    throw new Error('FAQのJSONパースに失敗しました: ' + raw.slice(0, 200));
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('FAQが空です');
  }
  // 5問に揃える（不足分はFAQ_QUESTIONSから補う）
  const result: FaqItem[] = FAQ_QUESTIONS.slice(0, 5).map((q, i) => ({
    question: items[i]?.question || q,
    answer: items[i]?.answer || '口コミ・公式情報を確認のうえ、追って記載します。',
  }));

  return {
    items: result,
    tokensUsed: {
      prompt: completion.usage?.prompt_tokens || 0,
      completion: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    },
  };
}

/** 良い点・改善してほしい点の傾向用プロンプト（3箇条ずつ要約） */
function createReviewTendencyPrompt(schoolName: string, reviewsText: string): string {
  return `あなたは通信制高校の口コミ・評判を分析する専門家です。以下の口コミデータを踏まえ、この学校の「良い点」を要約して3つの箇条書きに、「改善してほしい点」も要約して3つの箇条書きにまとめてください。

学校名: ${schoolName}

【口コミデータ】
${reviewsText}

出力形式（JSONのみ、他は書かない）:
{
  "good_points": ["良い点の要約1", "良い点の要約2", "良い点の要約3"],
  "improvement_points": ["改善してほしい点の要約1", "改善してほしい点の要約2", "改善してほしい点の要約3"]
}

注意:
- 各項目は1文で簡潔に（目安40〜80字）。口コミの傾向をまとめ、断定は避けて「〜という声がある」などと表現してください。
- 口コミが少ない場合は「現時点では限られた声のなかでは〜」と表現してください。
- 個人名・誹謗中傷は含めないでください。`;
}

/**
 * 良い点・改善してほしい点の傾向を3箇条ずつ生成（GPT連携）
 */
export async function callOpenAIForReviewTendency(
  schoolName: string,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
    answers?: Record<string, unknown>;
  }>
): Promise<{
  summary: ReviewTendencySummary;
  tokensUsed: { prompt: number; completion: number; total: number };
}> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const reviewsText = formatReviewsForPrompt(reviews);
  const prompt = createReviewTendencyPrompt(schoolName, reviewsText);

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'あなたは通信制高校の口コミを分析する専門家です。口コミのみを根拠に、良い点と改善してほしい点をそれぞれ3つの箇条書きに要約してください。出力は必ず指定のJSON形式のみにしてください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  const raw = (completion.choices[0]?.message?.content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;
  let parsed: ReviewTendencySummary;
  try {
    parsed = JSON.parse(jsonStr) as ReviewTendencySummary;
  } catch {
    throw new Error('良い点・改善点要約のJSONパースに失敗しました: ' + raw.slice(0, 200));
  }
  const good_points = Array.isArray(parsed.good_points)
    ? parsed.good_points.slice(0, 3).map((s) => (typeof s === 'string' ? s : '').trim()).filter(Boolean)
    : [];
  const improvement_points = Array.isArray(parsed.improvement_points)
    ? parsed.improvement_points.slice(0, 3).map((s) => (typeof s === 'string' ? s : '').trim()).filter(Boolean)
    : [];
  return {
    summary: {
      good_points: good_points.length >= 3 ? good_points : [...good_points, ...Array(3 - good_points.length).fill('口コミを元に追って記載します。')].slice(0, 3),
      improvement_points: improvement_points.length >= 3 ? improvement_points : [...improvement_points, ...Array(3 - improvement_points.length).fill('口コミを元に追って記載します。')].slice(0, 3),
    },
    tokensUsed: {
      prompt: completion.usage?.prompt_tokens || 0,
      completion: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    },
  };
}
