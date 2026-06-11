import { describe, it, expect } from 'vitest';
import { buildContextBlock, buildSourceFooter, buildSources } from '../sources';
import type { RetrievedChunk } from '../weaviate';

function chunk(partial: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    documentId: 'doc-1',
    ownerId: 'owner-1',
    title: 'France Facts',
    text: 'Paris is the capital of France.',
    chunkIndex: 0,
    pageStart: 1,
    pageEnd: 1,
    score: 0.9,
    ...partial,
  };
}

describe('buildSourceFooter', () => {
  it('returns an empty string when there are no chunks', () => {
    expect(buildSourceFooter([])).toBe('');
  });

  it('uses singular "p." for a single page', () => {
    expect(buildSourceFooter([chunk({ pageStart: 1, pageEnd: 1 })])).toBe(
      'Sources: France Facts (p. 1)',
    );
  });

  it('collapses contiguous pages into a range and uses "pp."', () => {
    const chunks = [
      chunk({ pageStart: 1, pageEnd: 1 }),
      chunk({ pageStart: 2, pageEnd: 3 }),
    ];
    expect(buildSourceFooter(chunks)).toBe('Sources: France Facts (pp. 1–3)');
  });

  it('renders non-contiguous pages as a comma list', () => {
    const chunks = [
      chunk({ pageStart: 1, pageEnd: 1 }),
      chunk({ pageStart: 3, pageEnd: 4 }),
    ];
    expect(buildSourceFooter(chunks)).toBe('Sources: France Facts (pp. 1, 3–4)');
  });

  it('groups pages by document and separates docs with a semicolon', () => {
    const chunks = [
      chunk({ documentId: 'd1', title: 'Doc A', pageStart: 1, pageEnd: 1 }),
      chunk({ documentId: 'd2', title: 'Doc B', pageStart: 2, pageEnd: 2 }),
    ];
    const footer = buildSourceFooter(chunks);
    expect(footer).toContain('Doc A (p. 1)');
    expect(footer).toContain('Doc B (p. 2)');
    expect(footer).toContain('; ');
  });
});

describe('buildSources', () => {
  it('maps chunks to structured sources with rounded scores and page labels', () => {
    const sources = buildSources([chunk({ score: 0.91234, pageStart: 2, pageEnd: 3 })]);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      documentId: 'doc-1',
      documentTitle: 'France Facts',
      page: '2–3',
      score: 0.91,
    });
    expect(sources[0].snippet.length).toBeGreaterThan(0);
  });

  it('truncates long snippets with an ellipsis', () => {
    const long = 'word '.repeat(200);
    const [src] = buildSources([chunk({ text: long })]);
    expect(src.snippet.length).toBeLessThanOrEqual(221);
    expect(src.snippet.endsWith('…')).toBe(true);
  });
});

describe('buildContextBlock', () => {
  it('labels each chunk with an index and page for grounding', () => {
    const block = buildContextBlock([
      chunk({ text: 'First passage.', pageStart: 1, pageEnd: 1 }),
      chunk({ text: 'Second passage.', pageStart: 2, pageEnd: 2 }),
    ]);
    expect(block).toContain('[1]');
    expect(block).toContain('[2]');
    expect(block).toContain('First passage.');
    expect(block).toContain('p. 1');
  });
});
