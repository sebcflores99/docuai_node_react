/**
 * Splits document text into overlapping chunks for embedding/retrieval, and
 * assigns each chunk a page range.
 *
 * Pasted text has no native pages, so pages are defined as:
 *  - explicit form-feed (\f) page breaks when present, otherwise
 *  - synthetic fixed-size windows of ~PAGE_SIZE_CHARS characters.
 *
 * This gives users meaningful "p. 1–2" style citations regardless of source.
 */

const CHUNK_SIZE_CHARS = 1000;
const CHUNK_OVERLAP_CHARS = 150;
const PAGE_SIZE_CHARS = 1800;

export interface TextChunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageStart: number;
  pageEnd: number;
}

export function chunkDocument(content: string): TextChunk[] {
  const text = content.replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  const pageBoundaries = computePageBoundaries(text);
  const segments = splitIntoSegments(text);

  const chunks: TextChunk[] = [];
  let buffer = '';
  let bufferStart = 0;
  let cursor = 0; // running char offset into `text`

  const flush = (endOffset: number) => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push(makeChunk(chunks.length, trimmed, bufferStart, endOffset, pageBoundaries));
  };

  for (const segment of segments) {
    const segStart = cursor;
    cursor += segment.length;

    if (buffer === '') bufferStart = segStart;

    if ((buffer + segment).length <= CHUNK_SIZE_CHARS) {
      buffer += segment;
      continue;
    }

    // Current buffer is full — emit it, then start a new buffer with overlap.
    flush(segStart);
    const overlap = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP_CHARS));
    buffer = overlap + segment;
    bufferStart = segStart - overlap.length;
  }

  flush(cursor);
  return chunks;
}

function makeChunk(
  index: number,
  text: string,
  charStart: number,
  charEnd: number,
  pageBoundaries: number[],
): TextChunk {
  return {
    index,
    text,
    charStart,
    charEnd,
    pageStart: pageForOffset(charStart, pageBoundaries),
    pageEnd: pageForOffset(Math.max(charStart, charEnd - 1), pageBoundaries),
  };
}

/** Splits on paragraph boundaries, keeping the delimiters so offsets line up. */
function splitIntoSegments(text: string): string[] {
  const segments = text.split(/(\n{2,})/);
  return segments.filter((s) => s.length > 0);
}

/**
 * Returns ascending character offsets where each page starts (page 1 starts
 * at 0). Uses form-feed breaks if any exist, else fixed-size windows.
 */
function computePageBoundaries(text: string): number[] {
  if (text.includes('\f')) {
    const boundaries = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\f') boundaries.push(i + 1);
    }
    return boundaries;
  }

  const boundaries: number[] = [];
  for (let offset = 0; offset < Math.max(text.length, 1); offset += PAGE_SIZE_CHARS) {
    boundaries.push(offset);
  }
  return boundaries;
}

/** 1-based page number for a character offset. */
function pageForOffset(offset: number, boundaries: number[]): number {
  let page = 1;
  for (let i = 0; i < boundaries.length; i++) {
    if (offset >= boundaries[i]) page = i + 1;
    else break;
  }
  return page;
}
