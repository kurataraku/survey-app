import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMCallOptions {
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY が未設定です');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/** OpenAI Chat Completions で `max_tokens` が拒否されるモデル（`max_completion_tokens` を使う） */
function openAiChatUsesMaxCompletionTokens(model: string): boolean {
  const m = model.toLowerCase();
  if (m.startsWith('gpt-5')) return true;
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4'))
    return true;
  return false;
}

/**
 * GPT-5 / o 系では `temperature` を 1 以外にすると 400 になる（デフォルト 1 のみ許可）。
 */
function openAiEffectiveTemperature(model: string, requested?: number): number {
  const m = model.toLowerCase();
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    return 1;
  }
  return requested ?? 0.5;
}

/** reasoning + 本文の合算が max に達し、visible が空になるのを防ぐ */
function openAiChatDefaultMaxTokens(model: string, requested: number): number {
  const m = model.toLowerCase();
  if (m.startsWith('gpt-5') && requested < 8000) {
    return 8000;
  }
  return requested;
}

/**
 * reasoning_effort の許容値はモデル世代で異なる。
 * - `gpt-5.2` / `gpt-5.4` など `gpt-5.{数字}`: none, low, …（minimal は不可）
 * - `gpt-5-mini` / `gpt-5-nano` 等: minimal, low, …（none は不可）
 */
function openAiReasoningEffort(
  model: string
): 'none' | 'minimal' | undefined {
  const m = model.toLowerCase();
  if (!m.startsWith('gpt-5')) return undefined;
  if (/^gpt-5\.\d/.test(m)) return 'none';
  return 'minimal';
}

function extractOpenAiAssistantText(message: { content?: unknown } | undefined): string {
  if (!message) return '';
  const c = message.content;
  if (c == null) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((part: unknown) => {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type: string }).type === 'text' &&
          'text' in part
        ) {
          return String((part as { text: string }).text);
        }
        return '';
      })
      .join('');
  }
  return '';
}

async function callOpenAI(options: LLMCallOptions): Promise<LLMResponse> {
  const client = getOpenAI();
  const baseMax = options.maxTokens ?? 2000;
  const maxVal = openAiChatUsesMaxCompletionTokens(options.model)
    ? openAiChatDefaultMaxTokens(options.model, baseMax)
    : baseMax;

  const payload = {
    stream: false as const,
    model: options.model,
    messages: [
      { role: 'system' as const, content: options.systemPrompt },
      { role: 'user' as const, content: options.userPrompt },
    ],
    temperature: openAiEffectiveTemperature(options.model, options.temperature),
    ...(openAiChatUsesMaxCompletionTokens(options.model)
      ? { max_completion_tokens: maxVal }
      : { max_tokens: maxVal }),
    ...(options.jsonMode
      ? { response_format: { type: 'json_object' as const } }
      : {}),
    ...((() => {
      const effort = openAiReasoningEffort(options.model);
      return effort ? { reasoning_effort: effort } : {};
    })()),
  };

  const completion = await client.chat.completions.create(payload);

  const content = extractOpenAiAssistantText(completion.choices[0]?.message);
  return {
    content,
    tokensUsed: {
      prompt: completion.usage?.prompt_tokens || 0,
      completion: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    },
  };
}

async function callAnthropic(options: LLMCallOptions): Promise<LLMResponse> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userPrompt }],
    temperature: options.temperature ?? 0.5,
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  const content = textBlock?.text || '';

  return {
    content,
    tokensUsed: {
      prompt: response.usage.input_tokens,
      completion: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  if (options.provider === 'anthropic') {
    return callAnthropic(options);
  }
  return callOpenAI(options);
}

export function resolveModel(
  envVar: string,
  defaultModel: string,
  defaultProvider: LLMProvider
): { provider: LLMProvider; model: string } {
  const envValue = process.env[envVar];
  if (!envValue) {
    return { provider: defaultProvider, model: defaultModel };
  }

  if (envValue.startsWith('claude-')) {
    return { provider: 'anthropic', model: envValue };
  }
  if (
    envValue.startsWith('gpt-') ||
    envValue.startsWith('o1') ||
    envValue.startsWith('o3')
  ) {
    return { provider: 'openai', model: envValue };
  }

  return { provider: defaultProvider, model: envValue };
}
