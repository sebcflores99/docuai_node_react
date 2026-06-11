import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai';
import type { LLMProvider } from './types';

export type ProviderName = 'mock' | 'openai' | 'anthropic';

const factories: Record<ProviderName, () => LLMProvider> = {
  mock: () => new MockProvider(),
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
};

// Providers are stateless after construction, so we cache one instance each.
const cache = new Map<ProviderName, LLMProvider>();

/**
 * Returns the configured LLM provider. Defaults to LLM_PROVIDER from env, but
 * an explicit name can be passed (e.g. per prompt-version configuration).
 */
export function getProvider(name?: string): LLMProvider {
  const key = (name ?? env.llmProvider).toLowerCase();
  if (!isProviderName(key)) {
    throw new AppError(500, `Unsupported LLM provider: "${key}"`, 'PROVIDER_UNKNOWN');
  }

  const cached = cache.get(key);
  if (cached) return cached;

  const provider = factories[key]();
  cache.set(key, provider);
  return provider;
}

function isProviderName(value: string): value is ProviderName {
  return value === 'mock' || value === 'openai' || value === 'anthropic';
}

export type { LLMProvider } from './types';
