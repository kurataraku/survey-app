import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveSeoLoopAnalystModel,
  resolveSeoLoopStrategistModel,
} from '../../lib/seo-loop/models';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SEO loopの工程別モデル', () => {
  it('既定値はAnalyst=Luna、Strategist=Terra', () => {
    vi.stubEnv('SEO_LOOP_LLM_MODEL', '');
    vi.stubEnv('SEO_LOOP_ANALYST_MODEL', '');
    vi.stubEnv('SEO_LOOP_STRATEGIST_MODEL', '');

    expect(resolveSeoLoopAnalystModel()).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
    });
    expect(resolveSeoLoopStrategistModel()).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-terra',
    });
  });

  it('工程別環境変数を旧共通設定より優先する', () => {
    vi.stubEnv('SEO_LOOP_LLM_MODEL', 'gpt-4o-mini');
    vi.stubEnv('SEO_LOOP_ANALYST_MODEL', 'gpt-5.6-luna');
    vi.stubEnv('SEO_LOOP_STRATEGIST_MODEL', 'gpt-5.6-terra');

    expect(resolveSeoLoopAnalystModel().model).toBe('gpt-5.6-luna');
    expect(resolveSeoLoopStrategistModel().model).toBe('gpt-5.6-terra');
  });
});
