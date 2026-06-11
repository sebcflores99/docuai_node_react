import { prisma } from '../config/prisma';
import { AppError } from '../lib/errors';

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

export function createDocument(input: CreateDocumentInput) {
  // No async ingestion pipeline yet, so a freshly added document is
  // immediately queryable. When RAG lands, this becomes PENDING and a
  // worker flips it to READY after chunking + embedding.
  return prisma.document.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      content: input.content,
      status: 'READY',
    },
  });
}

export async function deleteDocument(ownerId: string, id: string): Promise<void> {
  await getDocument(ownerId, id);
  await prisma.document.delete({ where: { id } });
}
