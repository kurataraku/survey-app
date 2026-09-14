import {
  resolveModel,
  type LLMProvider,
} from '@/lib/seo-generation/llm-client';

export type SeoLoopModel = {
  provider: LLMProvider;
  model: string;
};

function providerFor(model: string): LLMProvider {
  return model.startsWith('claude-') ? 'anthropic' : 'openai';
}

/**
 * 旧SEO_LOOP_LLM_MODELを後方互換fallbackとして残しつつ、
 * 品質とコスト特性が異なるAnalyst / Strategistを別モデルにする。
 */
function resolveRoleModel(envVar: string, defaultModel: string): SeoLoopModel {
  const fallback = process.env.SEO_LOOP_LLM_MODEL?.trim() || defaultModel;
  return resolveModel(envVar, fallback, providerFor(fallback));
}

export function resolveSeoLoopAnalystModel(): SeoLoopModel {
  return resolveRoleModel('SEO_LOOP_ANALYST_MODEL', 'gpt-5.6-luna');
}

export function resolveSeoLoopStrategistModel(): SeoLoopModel {
  return resolveRoleModel('SEO_LOOP_STRATEGIST_MODEL', 'gpt-5.6-terra');
}
