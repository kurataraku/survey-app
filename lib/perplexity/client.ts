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

export type PerplexityInstitutionType = 'public' | 'private' | 'support';

export interface PerplexityInstitutionTypeResult {
  institutionType: PerplexityInstitutionType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  citations: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface PerplexityCampusLocation {
  prefecture: string;
  city: string;
}

export interface PerplexityCampusLocationsResult {
  locations: PerplexityCampusLocation[];
  confidence: 'high' | 'medium' | 'low';
  officialFound: boolean;
  reason: string;
  citations: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface PerplexityOfficialUrlResult {
  officialUrl: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
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

function createInstitutionTypePrompt(schoolName: string, prefecture?: string | null): string {
  return `通信制高校・サポート校「${schoolName}」の公式サイトを検索し、設置区分を次の3つから1つだけ判定してください。

候補:
- public: 公立通信制高校（都道府県立・市立など自治体が設置する通信制高校）
- private: 私立通信制高校（学校法人などが設置し、高等学校卒業資格を取得できる通信制高校）
- support: サポート校（提携する通信制高校の学習支援・通学サポートを行う施設。単独では高校卒業資格を出さない）

学校名: ${schoolName}
都道府県: ${prefecture || '不明'}

判定ルール:
- 公式サイト、学校概要、設置者、学校種別、提携校、卒業資格の説明を優先する。
- 校名だけで決めず、公式情報に基づいて判定する。
- 「学校法人」「私立高等学校」「広域通信制高等学校」などは private の根拠になる。
- 「県立」「都立」「市立」など自治体設置は public。
- 「提携校」「技能連携」「サポート校」「通信制高校の卒業資格は提携校で取得」などは support。
- 不明な場合でも最も可能性が高いものを選び、confidence を low にする。

出力はJSONのみ:
{
  "institution_type": "public" | "private" | "support",
  "confidence": "high" | "medium" | "low",
  "reason": "公式情報に基づく判定理由を80字以内"
}`;
}

function createCampusLocationsPrompt(schoolName: string, prefectures?: string[] | null): string {
  return `通信制高校・サポート校「${schoolName}」の公式サイトを検索し、キャンパス・本校・学習センター・校舎の所在地を「都道府県」と「市区町村」単位で抽出してください。

学校名: ${schoolName}
登録済み対応都道府県: ${prefectures?.length ? prefectures.join('、') : '不明'}

判定ルール:
- 公式サイト、学校法人サイト、公式募集要項、公式キャンパス一覧を最優先する。
- 公式情報が見つからない場合、locations は空配列にし、official_found は false にする。
- 公式サイト・学校法人サイト・自治体/教育委員会/文部科学省などの公的サイトを根拠にできない場合、第三者サイトに所在地があっても locations は空配列にする。
- 市区町村まで確認できない所在地は locations に入れない。
- 住所が複数ある場合は、同じ都道府県・市区町村の重複を除いてすべて入れる。
- 「東京校」「大阪キャンパス」などの名称だけで、市区町村が公式に確認できない場合は入れない。
- 第三者サイトだけでしか確認できない場合は、locations は空配列にし、official_found は false にする。
- 政令指定都市の区が分かる場合は「横浜市西区」「大阪市北区」のように市区まで含める。

出力はJSONのみ:
{
  "official_found": true | false,
  "locations": [
    { "prefecture": "東京都", "city": "新宿区" }
  ],
  "confidence": "high" | "medium" | "low",
  "reason": "公式情報に基づく判断理由を100字以内"
}`;
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

/**
 * 学校の公式サイトURLのみを特定する（金額は一切聞かない）。
 * 学費抽出のオプトインフォールバック用。結果は人間が確認する前提。
 */
export async function callPerplexityForOfficialUrl(
  schoolName: string
): Promise<PerplexityOfficialUrlResult> {
  const apiKey = getPerplexityApiKey();
  const prompt = `通信制高校・サポート校「${schoolName}」の公式サイトのトップページURLを特定してください。

判定ルール:
- 学校自身（または運営する学校法人）が運営する公式サイトのみを対象とする
- まとめサイト・比較サイト・口コミサイト・Wikipediaは公式サイトではない
- 公式サイトが特定できない場合は official_url を null にする

出力はJSONのみ:
{
  "official_url": "https://..." | null,
  "confidence": "high" | "medium" | "low",
  "reason": "判定理由を80字以内"
}`;

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
            '日本の通信制高校・サポート校の公式サイトURLを特定する専門家です。公式サイト以外のURLは返さないでください。',
        },
        { role: 'user', content: prompt },
      ],
      web_search_options: { search_context_size: 'medium' },
      temperature: 0.1,
      max_tokens: 300,
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

  const jsonText = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: { official_url?: unknown; confidence?: string; reason?: string };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Perplexity API のJSON解析に失敗しました: ${content.slice(0, 160)}`);
  }

  const officialUrl =
    typeof parsed.official_url === 'string' && /^https?:\/\//i.test(parsed.official_url.trim())
      ? parsed.official_url.trim()
      : null;

  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'low';

  return {
    officialUrl,
    confidence,
    reason: typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 120) : '',
    citations,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    },
  };
}

export async function callPerplexityForInstitutionType(
  schoolName: string,
  prefecture?: string | null
): Promise<PerplexityInstitutionTypeResult> {
  const apiKey = getPerplexityApiKey();
  const prompt = createInstitutionTypePrompt(schoolName, prefecture);

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
            '日本の通信制高校・サポート校の公式情報を確認し、設置区分をJSONで分類する専門家です。推測は避け、公式情報の根拠を短く示してください。',
        },
        { role: 'user', content: prompt },
      ],
      web_search_options: { search_context_size: 'high' },
      temperature: 0.1,
      max_tokens: 300,
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

  const jsonText = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: {
    institution_type?: string;
    confidence?: string;
    reason?: string;
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Perplexity API のJSON解析に失敗しました: ${content.slice(0, 160)}`);
  }

  const institutionType = parsed.institution_type;
  if (institutionType !== 'public' && institutionType !== 'private' && institutionType !== 'support') {
    throw new Error(`不正な設置区分が返されました: ${String(institutionType)}`);
  }

  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'low';

  return {
    institutionType,
    confidence,
    reason: typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 120) : '',
    citations,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    },
  };
}

export async function callPerplexityForCampusLocations(
  schoolName: string,
  prefectures?: string[] | null
): Promise<PerplexityCampusLocationsResult> {
  const apiKey = getPerplexityApiKey();
  const prompt = createCampusLocationsPrompt(schoolName, prefectures);

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
            '日本の通信制高校・サポート校の公式サイトから、キャンパス所在地を都道府県・市区町村単位でJSON抽出する専門家です。公式情報が確認できない場合は空配列を返してください。',
        },
        { role: 'user', content: prompt },
      ],
      web_search_options: { search_context_size: 'high' },
      temperature: 0.1,
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

  const jsonText = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: {
    official_found?: boolean;
    locations?: unknown;
    confidence?: string;
    reason?: string;
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Perplexity API のJSON解析に失敗しました: ${content.slice(0, 160)}`);
  }

  const locations = Array.isArray(parsed.locations)
    ? parsed.locations
        .map((location) => {
          if (!location || typeof location !== 'object') return null;
          const record = location as Record<string, unknown>;
          const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
          const city = typeof record.city === 'string' ? record.city.trim() : '';
          return prefecture && city ? { prefecture, city } : null;
        })
        .filter((location): location is PerplexityCampusLocation => Boolean(location))
    : [];

  const deduped: PerplexityCampusLocation[] = [];
  const seen = new Set<string>();
  for (const location of locations) {
    const key = `${location.prefecture}::${location.city}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(location);
  }

  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'low';

  return {
    locations: deduped,
    confidence,
    officialFound: parsed.official_found === true,
    reason: typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 140) : '',
    citations,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    },
  };
}
