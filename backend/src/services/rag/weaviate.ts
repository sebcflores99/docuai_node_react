import weaviate, { type WeaviateClient } from 'weaviate-ts-client';
import { env } from '../../config/env';

const CLASS_NAME = 'DocumentChunk';

export interface ChunkRecord {
  documentId: string;
  ownerId: string;
  title: string;
  text: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
}

export interface RetrievedChunk extends ChunkRecord {
  /** Cosine similarity in 0..1 (higher is closer). */
  score: number;
}

let client: WeaviateClient | undefined;

function getClient(): WeaviateClient {
  if (client) return client;
  const url = new URL(env.weaviateUrl);
  client = weaviate.client({
    scheme: url.protocol.replace(':', ''),
    host: url.host,
  });
  return client;
}

let schemaReady = false;

/** Idempotently ensures the DocumentChunk class exists (vectorizer: none). */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const c = getClient();
  const schema = await c.schema.getter().do();
  const exists = schema.classes?.some((cls) => cls.class === CLASS_NAME);
  if (!exists) {
    await c.schema
      .classCreator()
      .withClass({
        class: CLASS_NAME,
        description: 'A chunk of a user document, embedded for retrieval.',
        vectorizer: 'none',
        properties: [
          { name: 'documentId', dataType: ['text'] },
          { name: 'ownerId', dataType: ['text'] },
          { name: 'title', dataType: ['text'] },
          { name: 'text', dataType: ['text'] },
          { name: 'chunkIndex', dataType: ['int'] },
          { name: 'pageStart', dataType: ['int'] },
          { name: 'pageEnd', dataType: ['int'] },
        ],
      })
      .do();
  }
  schemaReady = true;
}

/** Stores chunk records with their precomputed vectors. */
export async function upsertChunks(records: ChunkRecord[], vectors: number[][]): Promise<void> {
  if (records.length === 0) return;
  await ensureSchema();
  const c = getClient();
  let batcher = c.batch.objectsBatcher();
  records.forEach((record, i) => {
    batcher = batcher.withObject({
      class: CLASS_NAME,
      properties: { ...record },
      vector: vectors[i],
    });
  });
  await batcher.do();
}

/** Vector search for the most relevant chunks within a single document. */
export async function searchChunks(
  documentId: string,
  queryVector: number[],
  limit: number,
): Promise<RetrievedChunk[]> {
  await ensureSchema();
  const c = getClient();
  const result = await c.graphql
    .get()
    .withClassName(CLASS_NAME)
    .withFields('documentId ownerId title text chunkIndex pageStart pageEnd _additional { distance }')
    .withNearVector({ vector: queryVector })
    .withWhere({
      path: ['documentId'],
      operator: 'Equal',
      valueText: documentId,
    })
    .withLimit(limit)
    .do();

  const items = result?.data?.Get?.[CLASS_NAME] ?? [];
  return items.map((item: Record<string, unknown>) => {
    const distance = (item._additional as { distance?: number } | undefined)?.distance ?? 1;
    return {
      documentId: String(item.documentId ?? ''),
      ownerId: String(item.ownerId ?? ''),
      title: String(item.title ?? ''),
      text: String(item.text ?? ''),
      chunkIndex: Number(item.chunkIndex ?? 0),
      pageStart: Number(item.pageStart ?? 1),
      pageEnd: Number(item.pageEnd ?? 1),
      score: 1 - distance,
    };
  });
}

/** Removes all chunks belonging to a document (used on delete/re-ingest). */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await ensureSchema();
  const c = getClient();
  await c.batch
    .objectsBatchDeleter()
    .withClassName(CLASS_NAME)
    .withWhere({ path: ['documentId'], operator: 'Equal', valueText: documentId })
    .do();
}
