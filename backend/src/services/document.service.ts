import type { Document } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { extractText } from './extraction';
import * as rag from './rag/rag.service';

export interface CreateFromTextInput {
  ownerId: string;
  title: string;
  content: string;
}

export interface CreateFromFileInput {
  ownerId: string;
  title?: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
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

/** Returns the ids of the owner's READY documents (for cross-document chat). */
export async function listReadyDocumentIds(ownerId: string): Promise<string[]> {
  const docs = await prisma.document.findMany({
    where: { ownerId, status: 'READY' },
    select: { id: true },
  });
  return docs.map((d) => d.id);
}

/**
 * Creates a document from pasted text. Ingestion runs in the background so the
 * request returns immediately with status PROCESSING.
 */
export async function createFromText(input: CreateFromTextInput): Promise<Document> {
  const document = await prisma.document.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      content: input.content,
      status: 'PROCESSING',
      progress: 0,
    },
  });

  startIngestion(document.id, {
    ownerId: input.ownerId,
    title: input.title,
    content: input.content,
  });

  return document;
}

/**
 * Creates a document from an uploaded file. Text extraction + ingestion run in
 * the background; the request returns immediately with status PROCESSING.
 */
export async function createFromFile(input: CreateFromFileInput): Promise<Document> {
  const title = input.title?.trim() || stripExtension(input.fileName);

  const document = await prisma.document.create({
    data: {
      ownerId: input.ownerId,
      title,
      content: '',
      status: 'PROCESSING',
      progress: 0,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });

  startIngestion(document.id, {
    ownerId: input.ownerId,
    title,
    file: { buffer: input.buffer, fileName: input.fileName, mimeType: input.mimeType },
  });

  return document;
}

export async function deleteDocument(ownerId: string, id: string): Promise<void> {
  await getDocument(ownerId, id);
  await rag.removeDocument(id, ownerId);
  await prisma.document.delete({ where: { id } });
}

interface IngestionSource {
  ownerId: string;
  title: string;
  content?: string;
  file?: { buffer: Buffer; fileName: string; mimeType?: string };
}

/**
 * Fire-and-forget background ingestion. Extracts text (for file uploads),
 * runs the chunk -> embed -> store pipeline, and updates the document's
 * status/progress. Errors are captured on the document, never thrown to the
 * caller (the HTTP response has already been sent).
 */
function startIngestion(documentId: string, source: IngestionSource): void {
  void ingestInBackground(documentId, source).catch((err) => {
    logger.error('ingest.crashed', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

async function ingestInBackground(documentId: string, source: IngestionSource): Promise<void> {
  const log = logger.child({ stage: 'document.ingest', documentId, ownerId: source.ownerId });
  const startedAt = Date.now();
  log.info('started', { title: source.title, fromFile: Boolean(source.file) });
  try {
    let content = source.content ?? '';
    let pageBoundaries: number[] | undefined;

    if (source.file) {
      log.info('extracting', { fileName: source.file.fileName, mimeType: source.file.mimeType });
      const extracted = await extractText({
        buffer: source.file.buffer,
        fileName: source.file.fileName,
        mimeType: source.file.mimeType,
      });
      content = extracted.content;
      pageBoundaries = extracted.pageBoundaries;
      log.info('extracted', {
        chars: content.length,
        pages: extracted.pageBoundaries.length,
      });
      // Persist the extracted text + initial progress.
      await prisma.document.update({
        where: { id: documentId },
        data: { content, progress: 10 },
      });
    }

    const result = await rag.ingestDocument(
      { documentId, ownerId: source.ownerId, title: source.title, content, pageBoundaries },
      (percent) => updateProgress(documentId, percent),
    );

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'READY', progress: 100, error: null },
    });
    log.info('ready', { chunks: result.chunks, ms: Date.now() - startedAt });
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Ingestion failed';
    log.error('failed', {
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - startedAt,
    });
    await prisma.document
      .update({ where: { id: documentId }, data: { status: 'FAILED', error: message } })
      .catch(() => undefined);
  }
}

async function updateProgress(documentId: string, percent: number): Promise<void> {
  await prisma.document
    .update({ where: { id: documentId }, data: { progress: percent } })
    .catch(() => undefined);
}

function stripExtension(fileName: string): string {
  const base = fileName.split('/').pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}
