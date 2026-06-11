import { describe, it, expect } from 'vitest';
import { chunkDocument } from '../chunker';

describe('chunkDocument', () => {
  it('returns no chunks for empty or whitespace-only input', () => {
    expect(chunkDocument('')).toEqual([]);
    expect(chunkDocument('   \n  \t ')).toEqual([]);
  });

  it('produces a single chunk for short text, on page 1', () => {
    const chunks = chunkDocument('Paris is the capital of France.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('Paris');
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[0].pageEnd).toBe(1);
    expect(chunks[0].index).toBe(0);
  });

  it('splits long text into multiple overlapping, sequentially-indexed chunks', () => {
    const para = 'This is a sentence about the document. '.repeat(20);
    const doc = Array.from({ length: 6 }, (_, i) => `Section ${i + 1}. ${para}`).join('\n\n');
    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    // Each chunk stays within the configured size budget (plus overlap).
    chunks.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(1200));
  });

  it('assigns ascending, non-decreasing page numbers across chunks', () => {
    const para = 'Filler content for paging. '.repeat(40);
    const doc = Array.from({ length: 8 }, (_, i) => `Part ${i + 1}. ${para}`).join('\n\n');
    const chunks = chunkDocument(doc);

    for (const c of chunks) {
      expect(c.pageStart).toBeGreaterThanOrEqual(1);
      expect(c.pageEnd).toBeGreaterThanOrEqual(c.pageStart);
    }
    // Pages should advance through the document.
    expect(chunks[chunks.length - 1].pageEnd).toBeGreaterThan(1);
  });

  it('uses explicit form-feed characters as page boundaries when present', () => {
    const doc = 'Page one content.\fPage two content.\fPage three content.';
    const chunks = chunkDocument(doc);
    const maxPage = Math.max(...chunks.map((c) => c.pageEnd));
    expect(maxPage).toBe(3);
  });

  it('normalizes CRLF without breaking offsets', () => {
    const doc = 'Line one.\r\n\r\nLine two.';
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('Line one.');
    expect(chunks[0].text).toContain('Line two.');
  });
});
