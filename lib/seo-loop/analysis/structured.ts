import type { ZodType } from 'zod';
import type { LLMResponse } from '@/lib/seo-generation/llm-client';
import { payloadHash } from '../hash';
import type { StructuredAttempt } from './types';

export async function runStructuredStage<T>(params: {
  schema: ZodType<T>;
  maxAttempts?: number;
  makeInput: (attempt: number, previousError: string | null) => unknown;
  call: (inputSnapshot: unknown) => Promise<LLMResponse>;
}): Promise<{ data: T | null; attempts: StructuredAttempt<T>[] }> {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 2);
  const attempts: StructuredAttempt<T>[] = [];
  let previousError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const inputSnapshot = params.makeInput(attempt, previousError);
    const inputHash = payloadHash(inputSnapshot);
    try {
      const response = await params.call(inputSnapshot);
      let json: unknown;
      try {
        json = JSON.parse(response.content) as unknown;
      } catch (error) {
        previousError = error instanceof Error ? error.message : String(error);
        attempts.push({
          attempt,
          inputSnapshot,
          inputHash,
          rawOutput: response.content,
          parsedOutput: null,
          status: 'invalid_output',
          error: `JSON parse error: ${previousError}`,
          tokens: response.tokensUsed,
        });
        continue;
      }

      const parsed = params.schema.safeParse(json);
      if (!parsed.success) {
        previousError = parsed.error.message;
        attempts.push({
          attempt,
          inputSnapshot,
          inputHash,
          rawOutput: response.content,
          parsedOutput: null,
          status: 'invalid_output',
          error: `Schema error: ${previousError}`,
          tokens: response.tokensUsed,
        });
        continue;
      }

      attempts.push({
        attempt,
        inputSnapshot,
        inputHash,
        rawOutput: response.content,
        parsedOutput: parsed.data,
        status: 'succeeded',
        error: null,
        tokens: response.tokensUsed,
      });
      return { data: parsed.data, attempts };
    } catch (error) {
      previousError = error instanceof Error ? error.message : String(error);
      attempts.push({
        attempt,
        inputSnapshot,
        inputHash,
        rawOutput: null,
        parsedOutput: null,
        status: 'call_failed',
        error: previousError,
        tokens: { prompt: 0, completion: 0, total: 0 },
      });
    }
  }

  return { data: null, attempts };
}
