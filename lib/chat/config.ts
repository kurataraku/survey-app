import OpenAI from 'openai';

// gpt-5.4-mini はデフォルトで推論なし（none）のため、回答生成側で reasoning_effort を明示する
export const CHAT_MODEL_MAIN = process.env.CHAT_OPENAI_MAIN_MODEL?.trim() || 'gpt-5.4-mini';
export const CHAT_MODEL_ROUTER = process.env.CHAT_OPENAI_ROUTER_MODEL?.trim() || 'gpt-5-mini';
export const CHAT_MODEL_HARD = process.env.CHAT_OPENAI_HARD_MODEL?.trim() || 'gpt-5.4-mini';

// priority はトークン単価が標準の約2倍になる代わりに生成速度が速く安定する。
// 環境変数 CHAT_OPENAI_SERVICE_TIER=default で通常処理へ戻せる
export const CHAT_SERVICE_TIER: 'priority' | 'default' =
  process.env.CHAT_OPENAI_SERVICE_TIER?.trim() === 'default' ? 'default' : 'priority';

// 回答生成の推論レベル。low は速度優先、medium へ環境変数だけで戻せる
const REASONING_EFFORT_VALUES = ['minimal', 'low', 'medium', 'high'] as const;
export type ChatReasoningEffort = (typeof REASONING_EFFORT_VALUES)[number];
const envReasoningEffort = process.env.CHAT_OPENAI_REASONING_EFFORT?.trim();
export const CHAT_REASONING_EFFORT: ChatReasoningEffort = REASONING_EFFORT_VALUES.includes(
  envReasoningEffort as ChatReasoningEffort
)
  ? (envReasoningEffort as ChatReasoningEffort)
  : 'low';
export const CHAT_EMBEDDING_MODEL =
  process.env.CHAT_OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-large';
// pgvector インデックス上限（2000）に合わせる。text-embedding-3-large は dimensions で縮約可能
export const CHAT_EMBEDDING_DIMENSIONS = Number(
  process.env.CHAT_OPENAI_EMBEDDING_DIMENSIONS ?? 2000
);

export function getChatOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY が環境変数に設定されていません');
  }
  return new OpenAI({ apiKey });
}

export function chooseGenerationModel(difficulty: 'low' | 'high'): string {
  return difficulty === 'high' ? CHAT_MODEL_HARD : CHAT_MODEL_MAIN;
}
