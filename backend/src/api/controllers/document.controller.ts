import type { Request, Response } from 'express';
import * as documentService from '../../services/document.service';

export async function list(req: Request, res: Response): Promise<void> {
  const documents = await documentService.listDocuments(req.user!.id);
  res.json(documents);
}

export async function get(req: Request, res: Response): Promise<void> {
  const document = await documentService.getDocument(req.user!.id, String(req.params.id));
  res.json(document);
}

export async function create(req: Request, res: Response): Promise<void> {
  const document = await documentService.createDocument({ ownerId: req.user!.id, ...req.body });
  res.status(201).json(document);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await documentService.deleteDocument(req.user!.id, String(req.params.id));
  res.status(204).send();
}
