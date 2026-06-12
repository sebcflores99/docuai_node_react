import { describe, it, expect } from 'vitest';
import { extractText } from '../index';

const buf = (s: string) => Buffer.from(s, 'utf-8');

describe('extractText', () => {
  it('extracts plain text as a single page', async () => {
    const r = await extractText({ buffer: buf('hello world'), fileName: 'note.txt' });
    expect(r.content).toBe('hello world');
    expect(r.pageBoundaries).toEqual([0]);
  });

  it('treats markdown as text', async () => {
    const r = await extractText({ buffer: buf('# Title\nbody'), fileName: 'readme.md' });
    expect(r.content).toContain('Title');
    expect(r.pageBoundaries).toEqual([0]);
  });

  it('uses mimeType when extension is ambiguous', async () => {
    const r = await extractText({ buffer: buf('plain'), fileName: 'data', mimeType: 'text/plain' });
    expect(r.content).toBe('plain');
  });

  it('rejects an empty file', async () => {
    await expect(extractText({ buffer: Buffer.alloc(0), fileName: 'x.txt' })).rejects.toMatchObject({
      code: 'EMPTY_FILE',
    });
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 0x61);
    await expect(extractText({ buffer: big, fileName: 'big.txt' })).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('rejects unsupported file types (e.g. legacy .doc)', async () => {
    await expect(
      extractText({ buffer: buf('x'), fileName: 'old.doc', mimeType: 'application/msword' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });
});
