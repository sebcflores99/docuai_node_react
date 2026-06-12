import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../lib/errors';
import * as documentService from '../../services/document.service';
import { createDocumentSchema } from '../validators/document.schema';

export async function list(req: Request, res: Response): Promise<void> {
  const documents = await documentService.listDocuments(req.user!.id);
  res.json(documents);
}

export async function get(req: Request, res: Response): Promise<void> {
  const document = await documentService.getDocument(req.user!.id, String(req.params.id));
  res.json(document);
}

/**
 * Creates a document from either a multipart file upload (`file` field) or a
 * JSON `{ title, content }` body (kept for backward compatibility). Both return
 * a document in PROCESSING; ingestion completes in the background.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;

  if (req.file) {
    const titleField = typeof req.body?.title === 'string' ? req.body.title : undefined;
    const document = await documentService.createFromFile({
      ownerId,
      title: titleField,
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
    res.status(201).json(document);
    return;
  }

  let parsed;
  try {
    parsed = createDocumentSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const path = issue?.path.join('.');
      const message = path ? `${path}: ${issue?.message}` : (issue?.message ?? 'Invalid request body');
      throw new AppError(400, message, 'VALIDATION_ERROR');
    }
    throw err;
  }

  const document = await documentService.createFromText({ ownerId, ...parsed });
  res.status(201).json(document);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await documentService.deleteDocument(req.user!.id, String(req.params.id));
  res.status(204).send();
}
