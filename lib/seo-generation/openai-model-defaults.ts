/**
 * OpenAI モデルの段階別デフォルト（環境変数で上書き可能）。
 *
 * - premium: 本文生成・リライト（`gpt-5.4` フル）
 * - economy: プランナー・リサーチャー・検証など（デフォルト `gpt-5-mini`）
 *
 * 中間にしたい場合: `SEO_OPENAI_ECONOMY_MODEL=gpt-5.4-mini`
 * 個別ステップ: `SEO_WRITER_MODEL` 等で上書き。
 */
export const SEO_OPENAI_PREMIUM_DEFAULT = 'gpt-5.4';
export const SEO_OPENAI_ECONOMY_DEFAULT = 'gpt-5-mini';

export function defaultOpenAiPremiumModel(): string {
  return process.env.SEO_OPENAI_PREMIUM_MODEL?.trim() || SEO_OPENAI_PREMIUM_DEFAULT;
}

export function defaultOpenAiEconomyModel(): string {
  return process.env.SEO_OPENAI_ECONOMY_MODEL?.trim() || SEO_OPENAI_ECONOMY_DEFAULT;
}
