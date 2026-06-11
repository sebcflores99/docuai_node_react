import { prisma } from '../config/prisma';
import { AppError } from '../lib/errors';
import * as rag from './rag/rag.service';

export interface CreateDocumentInput {
  ownerId: string;
  title: string;
  content: string;
}

export function listDocuments(ownerId: string) {
  return prisma.document.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDocument(ownerId: string, id: string) {
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.ownerId !== ownerId) {
    throw new AppError(404, 'Document not found', 'NOT_FOUND');
  }
  return document;
}

/**
 * Creates a document and synchronously ingests it into the vector store
 * (chunk -> embed -> store). Status reflects the ingestion lifecycle so the
 * UI can show progress: PROCESSING -> READY, or FAILED if ingestion errors.
 */
export async function createDocument(input: CreateDocumentInput) {
  const document = await prisma.document.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      content: input.content,
      status: 'PROCESSING',
    },
  });

  try {
    await rag.ingestDocument({
      documentId: document.id,
      ownerId: document.ownerId,
      title: document.title,
      content: document.content,
    });
    return prisma.document.update({
      where: { id: document.id },
      data: { status: 'READY' },
    });
  } catch (err) {
    console.error(`Ingestion failed for document ${document.id}:`, err);
    // The document is still usable via the full-text fallback in retrieval,
    // but we surface FAILED so the user knows embedding-based search is off.
    return prisma.document.update({
      where: { id: document.id },
      data: { status: 'FAILED' },
    });
  }
}

export async function deleteDocument(ownerId: string, id: string): Promise<void> {
  await getDocument(ownerId, id);
  await rag.removeDocument(id);
  await prisma.document.delete({ where: { id } });
}
