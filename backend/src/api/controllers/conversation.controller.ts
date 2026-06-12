import type { Request, Response } from 'express';
import * as conversationService from '../../services/conversation.service';

export async function list(req: Request, res: Response): Promise<void> {
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const conversations = await conversationService.listConversations(req.user!.id, documentId);
  res.json(conversations);
}

export async function create(req: Request, res: Response): Promise<void> {
  const conversation = await conversationService.createConversation({
    userId: req.user!.id,
    title: req.body.title,
    documentIds: req.body.documentIds,
  });
  res.status(201).json(conversation);
}

export async function get(req: Request, res: Response): Promise<void> {
  const conversation = await conversationService.getConversation(req.user!.id, String(req.params.id));
  res.json(conversation);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await conversationService.deleteConversation(req.user!.id, String(req.params.id));
  res.status(204).send();
}

export async function rename(req: Request, res: Response): Promise<void> {
  const conversation = await conversationService.renameConversation(
    req.user!.id,
    String(req.params.id),
    req.body.title,
  );
  res.json(conversation);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const result = await conversationService.sendMessage({
    userId: req.user!.id,
    conversationId: String(req.params.id),
    content: req.body.content,
    documentIds: req.body.documentIds,
  });
  res.status(201).json(result);
}
