import { createHash } from 'node:crypto';
import type { Embedder } from './types';

const DIMENSIONS = 256;

/**
 * Deterministic, offline embedder for local dev/tests (no API key needed).
 * It produces a bag-of-words vector by hashing tokens into buckets, then
 * L2-normalizes. This is NOT semantically strong, but it is stable and makes
 * the full RAG pipeline (chunk -> embed -> store -> retrieve) runnable
 * end-to-end without external services.
 */
export class MockEmbedder implements Embedder {
  readonly name = 'mock';
  readonly dimensions = DIMENSIONS;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => embedOne(t));
  }
}

function embedOne(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const token of tokens) {
    const bucket = hashToBucket(token);
    vector[bucket] += 1;
  }
  return l2normalize(vector);
}

function hashToBucket(token: string): number {
  const hash = createHash('md5').update(token).digest();
  return hash.readUInt32BE(0) % DIMENSIONS;
}

function l2normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}
