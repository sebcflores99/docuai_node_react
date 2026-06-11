import { getEmbedder } from '../ai/embeddings';
import { chunkDocument } from './chunker';
import {
  type ChunkRecord,
  type RetrievedChunk,
  deleteDocumentChunks,
  searchChunks,
  upsertChunks,
} from './weaviate';

export const DEFAULT_TOP_K = 4;

export interface IngestInput {
  documentId: string;
  ownerId: string;
  title: string;
  content: string;
}

export interface IngestResult {
  chunks: number;
}

/**
 * Chunks a document, embeds each chunk, and stores it in the vector store.
 * Re-ingestion is safe: existing chunks for the document are removed first.
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const chunks = chunkDocument(input.content);
  await deleteDocumentChunks(input.documentId);
  if (chunks.length === 0) return { chunks: 0 };

  const embedder = getEmbedder();
  const vectors = await embedder.embed(chunks.map((c) => c.text));

  const records: ChunkRecord[] = chunks.map((c) => ({
    documentId: input.documentId,
    ownerId: input.ownerId,
    title: input.title,
    text: c.text,
    chunkIndex: c.index,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
  }));

  await upsertChunks(records, vectors);
  return { chunks: records.length };
}

/** Embeds the query and returns the most relevant chunks for a document. */
export async function retrieve(
  documentId: string,
  query: string,
  topK = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  const embedder = getEmbedder();
  const [queryVector] = await embedder.embed([query]);
  if (!queryVector) return [];
  return searchChunks(documentId, queryVector, topK);
}

/** Best-effort cleanup; never throws (document deletion must not be blocked). */
export async function removeDocument(documentId: string): Promise<void> {
  try {
    await deleteDocumentChunks(documentId);
  } catch {
    // Vector store may be unavailable; relational delete still proceeds.
  }
}
