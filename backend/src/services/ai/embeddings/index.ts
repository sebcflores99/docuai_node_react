import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import { MockEmbedder } from './mock';
import { OpenAIEmbedder } from './openai';
import type { Embedder } from './types';

export type EmbedderName = 'mock' | 'openai';

const factories: Record<EmbedderName, () => Embedder> = {
  mock: () => new MockEmbedder(),
  openai: () => new OpenAIEmbedder(),
};

let cached: Embedder | undefined;

/** Returns the configured embedder (cached). */
export function getEmbedder(): Embedder {
  if (cached) return cached;
  const key = env.embeddingProvider.toLowerCase();
  if (key !== 'mock' && key !== 'openai') {
    throw new AppError(500, `Unsupported embedding provider: "${key}"`, 'EMBEDDER_UNKNOWN');
  }
  cached = factories[key]();
  return cached;
}

export type { Embedder } from './types';
