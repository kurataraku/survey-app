import { callLLM } from './llm-client';
import { defaultOpenAiEconomyModel } from './openai-model-defaults';

const EXPANDER_MODEL =
  process.env.SEO_QUERY_EXPANDER_MODEL || defaultOpenAiEconomyModel();

/** PostgREST .or() 内で問題になる文字を除去 */
export function sanitizeSearchTermForOr(term: string): string {
  return term
    .trim()
    .replace(/[,%:*()]/g, '')
    .slice(0, 40);
}

/**
 * キーワードを意味的に関連する口コミ検索用の語に展開する（LLMセマンティック拡張）。
 * 「デメリット」等の表層語が本文に無くても、大変・孤独・後悔などでヒットしやすくする。
 */
export async function expandKeywordToSearchTerms(
  keyword: string
): Promise<{ terms: string[]; tokensUsed: { prompt: number; completion: number; total: number } }> {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return { terms: [], tokensUsed: { prompt: 0, completion: 0, total: 0 } };
  }

  const response = await callLLM({
    provider: 'openai',
    model: EXPANDER_MODEL,
    systemPrompt: `あなたは通信制高校の口コミ検索の専門家です。
出力はJSONのみ。説明文は書かない。`,
    userPrompt: `記事のキーワード「${trimmed}」について、通信制高校の口コミ（良い点・改善点の自由記述）に**実際に書かれていそうな日本語の表現**を15〜25個リストアップしてください。

目的: データベースの部分一致検索で、キーワードそのものが本文に無くても意味的に関連する口コミを拾うこと。

ルール:
- 短い語句（2〜12文字程度）を多く含める
- ポジティブ・ネガティブ両方のニュアンスを含める（例: デメリット記事なら「大変」「孤独」「後悔」に加え「サポート」「安心」も混ぜてバランスよく）
- 抽象的すぎる単語1語だけ（「学校」等）は避け、口コミらしい言い回しを優先
- 重複・ほぼ同義は避ける

次のJSON形式のみ出力:
{"terms":["表現1","表現2",...]}`,
    temperature: 0.4,
    maxTokens: 1200,
    jsonMode: true,
  });

  let terms: string[] = [];
  try {
    const parsed = JSON.parse(response.content) as { terms?: unknown };
    if (Array.isArray(parsed.terms)) {
      terms = parsed.terms
        .filter((t): t is string => typeof t === 'string')
        .map(sanitizeSearchTermForOr)
        .filter((t) => t.length >= 2);
    }
  } catch {
    const fallback = trimmed.split(/[\s　]+/).filter((t) => t.length > 0);
    terms = fallback.map(sanitizeSearchTermForOr).filter((t) => t.length >= 2);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of terms) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return {
    terms: unique.slice(0, 25),
    tokensUsed: response.tokensUsed,
  };
}
