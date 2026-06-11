import type { RetrievedChunk } from './weaviate';

/** Structured grounding source persisted on a message and shown in the UI. */
export interface MessageSource {
  documentId: string;
  documentTitle: string;
  snippet: string;
  score: number;
  /** Human-readable page range, e.g. "1" or "1–2". */
  page: string;
}

const SNIPPET_CHARS = 220;

/**
 * Builds the labeled context block passed to the model. Each chunk is tagged
 * with an index and its page so the model can ground its answer; the block is
 * inserted verbatim inside <context> by the prompt builder.
 */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] (${c.title}, p. ${formatRange(c.pageStart, c.pageEnd)}) ${c.text}`)
    .join('\n\n');
}

/** Maps retrieved chunks to structured sources (deduped snippets, rounded scores). */
export function buildSources(chunks: RetrievedChunk[]): MessageSource[] {
  return chunks.map((c) => ({
    documentId: c.documentId,
    documentTitle: c.title,
    snippet: truncate(c.text, SNIPPET_CHARS),
    score: round(c.score),
    page: formatRange(c.pageStart, c.pageEnd),
  }));
}

/**
 * Builds the human-readable footer appended to an answer, e.g.
 * "Sources: France Facts (pp. 1, 3–4)". Groups by document and collapses
 * page numbers into compact ranges.
 */
export function buildSourceFooter(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  const byDoc = new Map<string, { title: string; pages: Set<number> }>();
  for (const c of chunks) {
    const entry = byDoc.get(c.documentId) ?? { title: c.title, pages: new Set<number>() };
    for (let p = c.pageStart; p <= c.pageEnd; p++) entry.pages.add(p);
    byDoc.set(c.documentId, entry);
  }

  const parts = [...byDoc.values()].map((d) => {
    const pages = [...d.pages].sort((a, b) => a - b);
    const label = pages.length > 1 ? 'pp.' : 'p.';
    return `${d.title} (${label} ${formatPageList(pages)})`;
  });

  return `Sources: ${parts.join('; ')}`;
}

function formatPageList(pages: number[]): string {
  const ranges: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const current = pages[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(formatRange(start, prev));
    start = current;
    prev = current;
  }
  return ranges.join(', ');
}

function formatRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}–${end}`;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
