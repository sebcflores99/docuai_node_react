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

/**
 * Idempotently ensures the DocumentChunk class exists. The class is
 * multi-tenant: each user's chunks live in their own tenant (keyed by user id),
 * so retrieval is hard-isolated per user rather than relying solely on a filter.
 */
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
        multiTenancyConfig: { enabled: true },
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

// Tenants we've already created this process, to avoid redundant round-trips.
const ensuredTenants = new Set<string>();

/**
 * Idempotently ensures a per-user tenant exists. Safe to call before every
 * write/read; creation is skipped once we've seen the tenant in this process.
 */
export async function ensureTenant(tenant: string): Promise<void> {
  if (!tenant) throw new Error('A tenant id is required');
  await ensureSchema();
  if (ensuredTenants.has(tenant)) return;
  const c = getClient();
  const existing = await c.schema.tenantsGetter(CLASS_NAME).do();
  const present = existing.some((t) => t.name === tenant);
  if (!present) {
    await c.schema.tenantsCreator(CLASS_NAME, [{ name: tenant }]).do();
  }
  ensuredTenants.add(tenant);
}

/** Stores chunk records with their precomputed vectors into the owner's tenant. */
export async function upsertChunks(records: ChunkRecord[], vectors: number[][]): Promise<void> {
  if (records.length === 0) return;
  const tenant = records[0].ownerId;
  await ensureTenant(tenant);
  const c = getClient();
  let batcher = c.batch.objectsBatcher();
  records.forEach((record, i) => {
    batcher = batcher.withObject({
      class: CLASS_NAME,
      tenant,
      properties: { ...record },
      vector: vectors[i],
    });
  });
  await batcher.do();
}

export interface SearchScope {
  ownerId: string;
  /** Restrict to these document ids; empty/undefined = all of the owner's docs. */
  documentIds?: string[];
}

/**
 * Vector search for the most relevant chunks. Always scoped to the owner; when
 * `documentIds` is provided, retrieval is further restricted to that subset
 * (enabling both single- and cross-document conversations).
 */
export async function searchChunks(
  scope: SearchScope,
  queryVector: number[],
  limit: number,
): Promise<RetrievedChunk[]> {
  await ensureTenant(scope.ownerId);
  const c = getClient();

  let getter = c.graphql
    .get()
    .withClassName(CLASS_NAME)
    .withTenant(scope.ownerId)
    .withFields(
      'documentId ownerId title text chunkIndex pageStart pageEnd _additional { distance }',
    )
    .withNearVector({ vector: queryVector })
    .withLimit(limit);

  // Tenancy already isolates by user; only narrow further by document subset.
  if (scope.documentIds && scope.documentIds.length > 0) {
    getter = getter.withWhere({
      path: ['documentId'],
      operator: 'ContainsAny',
      valueTextArray: scope.documentIds,
    });
  }

  const result = await getter.do();

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

/** Removes all chunks belonging to a document within its owner's tenant. */
export async function deleteDocumentChunks(
  documentId: string,
  ownerId: string,
): Promise<void> {
  await ensureTenant(ownerId);
  const c = getClient();
  await c.batch
    .objectsBatchDeleter()
    .withClassName(CLASS_NAME)
    .withTenant(ownerId)
    .withWhere({ path: ['documentId'], operator: 'Equal', valueText: documentId })
    .do();
}
