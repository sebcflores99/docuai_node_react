import type { Request, Response } from 'express';
import * as aiService from '../../services/ai/ai.service';

export async function ask(req: Request, res: Response): Promise<void> {
  const result = await aiService.ask({ userId: req.user!.id, ...req.body });
  res.status(200).json(result);
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const conversation = await aiService.getConversation(req.user!.id, String(req.params.id));
  res.json(conversation);
}
