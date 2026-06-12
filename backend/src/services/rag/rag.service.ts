import { getEmbedder } from '../ai/embeddings';
import { logger } from '../../lib/logger';
import { chunkDocument } from './chunker';
import {
  type ChunkRecord,
  type RetrievedChunk,
  type SearchScope,
  deleteDocumentChunks,
  ensureTenant,
  searchChunks,
  upsertChunks,
} from './weaviate';

export const DEFAULT_TOP_K = 6;
// Embed in batches so we can report incremental progress and bound memory.
const EMBED_BATCH = 16;

export interface IngestInput {
  documentId: string;
  ownerId: string;
  title: string;
  content: string;
  /** Optional real page boundaries (char offsets) from extraction. */
  pageBoundaries?: number[];
}

export interface IngestResult {
  chunks: number;
}

/** Reports ingestion progress as an integer percentage (0..100). */
export type ProgressFn = (percent: number) => void | Promise<void>;

/**
 * Chunks a document, embeds each chunk, and stores it in the vector store.
 * Re-ingestion is safe: existing chunks for the document are removed first.
 * `onProgress` is invoked as embedding batches complete.
 */
export async function ingestDocument(
  input: IngestInput,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  const log = logger.child({ stage: 'rag.ingest', documentId: input.documentId, ownerId: input.ownerId });
  const startedAt = Date.now();
  const report = async (p: number) => {
    if (onProgress) await onProgress(Math.max(0, Math.min(100, Math.round(p))));
  };

  // Per-user isolation: ensure the tenant exists before any read/write.
  await ensureTenant(input.ownerId);

  const chunks = chunkDocument(input.content, input.pageBoundaries);
  log.info('chunked', { chunks: chunks.length, contentChars: input.content.length });
  await deleteDocumentChunks(input.documentId, input.ownerId);
  if (chunks.length === 0) {
    log.warn('no_chunks', { reason: 'document produced no chunks' });
    await report(100);
    return { chunks: 0 };
  }

  await report(20);
  const embedder = getEmbedder();
  log.info('embedding_start', { embedder: embedder.name, dimensions: embedder.dimensions, batch: EMBED_BATCH });

  const records: ChunkRecord[] = [];
  const vectors: number[][] = [];
  const totalBatches = Math.ceil(chunks.length / EMBED_BATCH);
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batchNo = Math.floor(i / EMBED_BATCH) + 1;
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const batchVectors = await embedder.embed(batch.map((c) => c.text));
    batch.forEach((c, j) => {
      records.push({
        documentId: input.documentId,
        ownerId: input.ownerId,
        title: input.title,
        text: c.text,
        chunkIndex: c.index,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
      });
      vectors.push(batchVectors[j]);
    });
    log.info('embedding_batch', { batch: batchNo, totalBatches, embedded: records.length, of: chunks.length });
    // 20%..90% spans embedding.
    await report(20 + (70 * Math.min(i + batch.length, chunks.length)) / chunks.length);
  }

  log.info('upsert_start', { vectors: records.length });
  await upsertChunks(records, vectors);
  log.info('ingest_complete', { chunks: records.length, ms: Date.now() - startedAt });
  await report(100);
  return { chunks: records.length };
}

/**
 * Embeds the query and returns the most relevant chunks for the given scope
 * (owner, optionally restricted to a subset of documents).
 */
export async function retrieve(
  scope: SearchScope,
  query: string,
  topK = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  const embedder = getEmbedder();
  const [queryVector] = await embedder.embed([query]);
  if (!queryVector) return [];
  return searchChunks(scope, queryVector, topK);
}

/** Best-effort cleanup; never throws (document deletion must not be blocked). */
export async function removeDocument(documentId: string, ownerId: string): Promise<void> {
  try {
    await deleteDocumentChunks(documentId, ownerId);
  } catch {
    // Vector store may be unavailable; relational delete still proceeds.
  }
}
