import OpenAI from 'openai';

export const CHAT_MODEL_MAIN = process.env.CHAT_OPENAI_MAIN_MODEL?.trim() || 'gpt-5-mini';
export const CHAT_MODEL_ROUTER = process.env.CHAT_OPENAI_ROUTER_MODEL?.trim() || 'gpt-5-mini';
export const CHAT_MODEL_HARD = process.env.CHAT_OPENAI_HARD_MODEL?.trim() || 'gpt-5';
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
