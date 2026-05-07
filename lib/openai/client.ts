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

## 判断材料のリード（200〜320字）
保護者が通信制高校を比較検討するうえで役立つ内容にしてください。学費の負担感、通学やオンラインの実態、サポートや面談の手触り、単位取得のしんどさなど、口コミに根ざした具体論点を必ず含めてください。抽象的な形容に偏らず、「どのような家庭・学習スタイル向きか」が伝わるように書いてください。「口コミ」「評判」という語は全体で2回までに抑えてください。

## 学費・通学スタイルの注意点
- 項目1（学費の体感、追加費用の有無、納得感などに触れる）
- 項目2（通学頻度・オンライン比率・通いやすさなどに触れる）
- 項目3（必要なら補足）

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
  // 先頭のリードのみ（学費・通学セクション等をメタ文面に混ぜない）
  let summary = summaryText.split(/\n##\s+/)[0]?.replace(/\n\n※.*$/, '').trim() || '';
  if (!summary) {
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
  const summaryMatch =
    response.match(/## 判断材料のリード[^\n]*\n([\s\S]*?)(?=\n## |$)/) ||
    response.match(/## 概要[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  const tuitionMatch = response.match(
    /## 学費・通学スタイルの注意点[^\n]*\n([\s\S]*?)(?=\n## |$)/
  );
  const fitsMatch = response.match(/## この学校が合う人[\s\S]*?\n([\s\S]*?)(?=\n## |$)/);
  const notFitsMatch = response.match(/## この学校が合わない人[\s\S]*?\n([\s\S]*?)(?=\n## |$)/);
  const metaTitleMatch = response.match(/meta_title:\s*(.+?)(?:\n|$)/i);
  const metaDescriptionMatch = response.match(/meta_description:\s*(.+?)(?:\n|$)/i);

  const summary = summaryMatch?.[1]?.trim() || '';
  const tuition = tuitionMatch?.[1]?.trim() || '';
  const fits = fitsMatch?.[1]?.trim() || '';
  const notFits = notFitsMatch?.[1]?.trim() || '';
  // 要約テキストを組み立て（先頭ブロックには見出し行を付けない＝従来DB形式と互換）
  let summaryText = summary;
  if (tuition) {
    summaryText += '\n\n## 学費・通学スタイルの注意点\n' + tuition;
  }
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
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';

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
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
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
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
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

★文字数ルール（厳守）★:
- 各項目は必ず40〜80字にすること。40字未満は不可。
- 1文で簡潔に書く。具体的な内容（何がどう良い/悪いか）を含めて40字以上にする。
- 例（55字）: 「自宅学習が中心で自分のペースで進められるため、不登校経験者でも無理なく学習を続けやすいという声がある」
- 例（48字）: 「担任の先生が個別に学習計画を立ててくれるため、勉強が苦手な生徒でも安心して取り組めると評価されている」
- 断定は避けて「〜という声がある」「〜と評価されている」などと表現。
- 口コミが少ない場合は「現時点では限られた声のなかでは〜」と表現。
- 個人名・誹謗中傷は含めない。`;
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
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
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

// --- meta_title / meta_description 専用の軽量生成 ---

export interface MetaGenerationAlert {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface MetaGenerationResult {
  metaTitle: string;
  metaDescription: string;
  alerts: MetaGenerationAlert[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

const FORBIDDEN_WORDS = ['絶対', '必ず', '間違いなく', '確実に', '最高の', '最悪の'];

function detectForbiddenWords(text: string): string[] {
  return FORBIDDEN_WORDS.filter((w) => text.includes(w));
}

function validateMeta(
  schoolName: string,
  metaTitle: string,
  metaDescription: string
): MetaGenerationAlert[] {
  const alerts: MetaGenerationAlert[] = [];

  if (metaTitle.length < 28 || metaTitle.length > 35) {
    alerts.push({
      code: 'ALERT-03',
      message: `meta_title が ${metaTitle.length}文字（目標28-35）`,
      severity: 'warning',
    });
  }
  if (!metaTitle.includes('口コミ') && !metaTitle.includes('評判')) {
    alerts.push({
      code: 'ALERT-04',
      message: 'meta_title に「口コミ」「評判」が含まれていない',
      severity: 'warning',
    });
  }
  if (metaDescription.length < 105 || metaDescription.length > 115) {
    alerts.push({
      code: 'ALERT-01',
      message: `meta_description が ${metaDescription.length}文字（目標105-115）`,
      severity: 'warning',
    });
  }
  if (!/[。！？]$/.test(metaDescription)) {
    alerts.push({
      code: 'ALERT-02',
      message: 'meta_description が句点で終わっていない',
      severity: 'warning',
    });
  }
  const forbidden = detectForbiddenWords(metaTitle + metaDescription);
  if (forbidden.length > 0) {
    alerts.push({
      code: 'ALERT-14',
      message: `禁止ワード検出: ${forbidden.join(', ')}`,
      severity: 'warning',
    });
  }
  return alerts;
}

function isMetaValid(metaTitle: string, metaDescription: string): boolean {
  return (
    metaTitle.length >= 28 &&
    metaTitle.length <= 35 &&
    (metaTitle.includes('口コミ') || metaTitle.includes('評判')) &&
    metaDescription.length >= 105 &&
    metaDescription.length <= 125 &&
    /[。！？]$/.test(metaDescription)
  );
}

/**
 * meta_title + meta_description のみを軽量に生成（summary_text は生成しない）
 * バリデーション不通過なら最大3回リトライ
 */
export async function callOpenAIForMeta(
  schoolName: string,
  reviews: Array<{
    good_comment: string;
    bad_comment: string;
    overall_satisfaction: number;
  }>
): Promise<MetaGenerationResult> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';

  const reviewsText = reviews
    .slice(0, 30)
    .map((r, i) => {
      const good = (r.good_comment || '').slice(0, 150);
      const bad = (r.bad_comment || '').slice(0, 150);
      return `【${i + 1}】${r.overall_satisfaction}/5 良:${good} 改:${bad}`;
    })
    .join('\n');

  const titlePrefix = `${schoolName}の口コミ・評判`;
  const titlePrefixLen = titlePrefix.length;
  const titleRemaining = 32 - titlePrefixLen; // 目標32字（28-35の中央寄り）
  const descPrefix = `${schoolName}の口コミ・評判から見える特徴として、`;
  const descPrefixLen = descPrefix.length;
  const descBodyTarget = 110 - descPrefixLen; // 本文部分の目標文字数

  const prompt = `以下の口コミデータを基に、通信制高校「${schoolName}」の SEO 用メタ情報のみを生成してください。

口コミデータ:
${reviewsText}

■ meta_title の生成ルール（★文字数厳守★）:
- 「${titlePrefix}」（${titlePrefixLen}字）で始め、その後に学校の特徴を表す修飾語を${titleRemaining > 0 ? titleRemaining + '字程度' : '数字'}追加して、合計28〜35字にする。
- 修飾語の例: 「｜自由な学びと手厚いサポートの実態」「を徹底分析｜学費・通学・サポート体制」「まとめ｜在校生が語る学びの実態」
- 28字未満は不可。必ず28字以上にすること。

■ meta_description の生成ルール（★文字数厳守★）:
- 「${descPrefix}」（${descPrefixLen}字）で始める。
- その後に学校の特徴を2〜3文で具体的に書き、合計105〜115字にする（本文部分は${descBodyTarget}字前後）。
- 文末は必ず句点（。）で終わる。途中で切れないこと。
- 特徴は口コミの傾向を反映し、具体的に書く（例: 「自宅学習を中心に自分のペースで学べる環境が整い、先生のサポートが手厚いと評価されている。一方で自己管理力が求められるとの声もある。」）

出力形式（この2行のみ出力。他の文章は一切書かない）:
meta_title: ここにタイトル
meta_description: ここに説明文`;

  let bestTitle = '';
  let bestDesc = '';
  let totalTokens = { prompt: 0, completion: 0, total: 0 };
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            '通信制高校のSEOメタ情報を生成する専門家です。指定された文字数を厳守してください。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: attempt === 1 ? 0.5 : 0.7,
      max_tokens: 500,
    });

    totalTokens.prompt += completion.usage?.prompt_tokens || 0;
    totalTokens.completion += completion.usage?.completion_tokens || 0;
    totalTokens.total += completion.usage?.total_tokens || 0;

    const text = completion.choices[0]?.message?.content || '';
    const titleMatch = text.match(/meta_title:\s*(.+?)(?:\n|$)/i);
    const descMatch = text.match(/meta_description:\s*(.+?)(?:\n|$)/i);

    bestTitle = titleMatch?.[1]?.trim() || bestTitle;
    bestDesc = descMatch?.[1]?.trim() || bestDesc;

    if (isMetaValid(bestTitle, bestDesc)) break;
  }

  if (!bestTitle || bestTitle.length < 28) {
    bestTitle = `${schoolName}の口コミ・評判｜在校生が語る学びの実態`;
    if (bestTitle.length > 35) {
      bestTitle = `${schoolName}の口コミ・評判を徹底分析`;
    }
    if (bestTitle.length > 35) {
      bestTitle = `${schoolName}の口コミ・評判まとめ`;
    }
    if (bestTitle.length > 35) {
      bestTitle = `${schoolName}の口コミ・評判`;
    }
  }

  if (!bestDesc || bestDesc.length < 100) {
    const descBase = `${schoolName}の口コミ・評判から見える特徴として、`;
    const descBodies = [
      '在校生・卒業生の声をもとに学校の雰囲気や学習環境、サポート体制について詳しくまとめています。進路選びの参考にご覧ください。',
      '在校生・卒業生のリアルな声をもとに学校の雰囲気や学習環境、先生のサポート体制について詳しくまとめています。',
      '在校生の声をもとに学校の雰囲気や学習環境について詳しくまとめています。進路選びの参考にご覧ください。',
    ];
    for (const body of descBodies) {
      const candidate = descBase + body;
      if (candidate.length >= 105 && candidate.length <= 125) {
        bestDesc = candidate;
        break;
      }
    }
    if (!bestDesc || bestDesc.length < 100) {
      bestDesc = descBase + descBodies[0];
    }
    if (!/[。！？]$/.test(bestDesc)) bestDesc += '。';
  }

  const alerts = validateMeta(schoolName, bestTitle, bestDesc);

  return {
    metaTitle: bestTitle,
    metaDescription: bestDesc,
    alerts,
    tokensUsed: totalTokens,
  };
}

// --- 都道府県推定 ---

import { prefectures as VALID_PREFECTURES } from '@/lib/prefectures';

export interface PrefectureResult {
  prefecture: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * LLM で学校名から本部所在地の都道府県を推定する
 */
export async function callOpenAIForPrefecture(
  schoolName: string
): Promise<PrefectureResult> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';

  const prompt = `通信制高校「${schoolName}」の本部（主たる事務所）が所在する都道府県を答えてください。

注意:
- 通信制高校は本部とキャンパスが異なる都道府県にあることが多いです。本部の所在地を答えてください。
- 確信が持てない場合は confidence を low にしてください。

以下のJSON形式のみ出力してください:
{"prefecture": "○○県", "confidence": "high", "reasoning": "理由を1文で"}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          '日本の通信制高校に詳しい専門家です。学校の本部所在地を正確に回答してください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 200,
  });

  const raw = (completion.choices[0]?.message?.content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { prefecture: '', confidence: 'low', reasoning: 'JSONパース失敗' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      prefecture?: string;
      confidence?: string;
      reasoning?: string;
    };

    const pref = parsed.prefecture || '';
    const conf = (['high', 'medium', 'low'].includes(parsed.confidence || '')
      ? parsed.confidence
      : 'low') as 'high' | 'medium' | 'low';

    if (!VALID_PREFECTURES.includes(pref)) {
      return {
        prefecture: pref,
        confidence: 'low',
        reasoning: `「${pref}」は有効な都道府県名ではありません`,
      };
    }

    return {
      prefecture: pref,
      confidence: conf,
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return { prefecture: '', confidence: 'low', reasoning: 'JSONパース失敗: ' + raw.slice(0, 100) };
  }
}

export async function callOpenAIForSlug(schoolName: string): Promise<string> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';

  const prompt = `以下の通信制高校名を URL スラグ形式に変換してください。

ルール:
- ヘボン式ローマ字に変換し、末尾に「-kuchikomi」を付ける
- 小文字、ハイフン区切り、英数字のみ
- 「高等学校」は「koukou」、「高等部」は「kotobu」、「高等学院」は「gakuin」のように学校種別を端的に表現する
- 「県立」「市立」「私立」などは省略可
- スラグのみを返す（説明不要）

例:
第一学院高等学校 → daiichi-gakuin-kuchikomi
N高等学校 → n-koukou-kuchikomi
佐賀県立佐賀北高等学校 → saga-kita-koukou-kuchikomi

学校名: ${schoolName}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 80,
  });

  const raw = (completion.choices[0]?.message?.content || '').trim().toLowerCase();
  // 余分な文字を除去してスラグとして安全な文字列だけ残す
  const slug = raw.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'unknown-kuchikomi';
}
