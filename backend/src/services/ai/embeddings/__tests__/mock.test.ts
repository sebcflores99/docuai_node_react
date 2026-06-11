import { describe, it, expect } from 'vitest';
import { MockEmbedder } from '../mock';

describe('MockEmbedder', () => {
  const embedder = new MockEmbedder();

  it('reports a stable name and dimensionality', () => {
    expect(embedder.name).toBe('mock');
    expect(embedder.dimensions).toBe(256);
  });

  it('produces one vector per input, each of the right length', async () => {
    const vecs = await embedder.embed(['hello world', 'another text']);
    expect(vecs).toHaveLength(2);
    vecs.forEach((v) => expect(v).toHaveLength(256));
  });

  it('returns an empty array for empty input', async () => {
    expect(await embedder.embed([])).toEqual([]);
  });

  it('is deterministic for identical input', async () => {
    const [a] = await embedder.embed(['repeatable text']);
    const [b] = await embedder.embed(['repeatable text']);
    expect(a).toEqual(b);
  });

  it('produces L2-normalized vectors for non-empty text', async () => {
    const [v] = await embedder.embed(['the quick brown fox']);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('gives different vectors for clearly different text', async () => {
    const [a] = await embedder.embed(['apples oranges bananas']);
    const [b] = await embedder.embed(['quantum relativity physics']);
    expect(a).not.toEqual(b);
  });
});
