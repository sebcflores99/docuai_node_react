import OpenAI from 'openai';
import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import type { Embedder } from './types';

// text-embedding-3-small default dimensionality.
const DIMENSIONS = 1536;

/** OpenAI embeddings provider. */
export class OpenAIEmbedder implements Embedder {
  readonly name = 'openai';
  readonly dimensions = DIMENSIONS;
  private readonly client: OpenAI;

  constructor() {
    if (!env.openaiApiKey) {
      throw new AppError(500, 'OPENAI_API_KEY is not configured', 'EMBEDDER_MISCONFIGURED');
    }
    this.client = new OpenAI({ apiKey: env.openaiApiKey });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const response = await this.client.embeddings.create({
        model: env.embeddingModel,
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (err) {
      const message = err instanceof OpenAI.APIError ? err.message : 'embedding request failed';
      throw new AppError(502, `OpenAI embeddings failed: ${message}`, 'EMBEDDER_ERROR');
    }
  }
}
