import type { Message } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError, badRequest } from '../lib/errors';
import * as documentService from './document.service';
import {
  MAX_CONTEXT_CHARS,
  generateAnswer,
  sanitizeInput,
} from './ai/ai.service';
import type { Confidence } from './ai/postProcess';
import type { LLMMessage } from './ai/providers/types';

const MAX_HISTORY_MESSAGES = 10;

// Maps the model's qualitative confidence onto the 0..1 scale the UI renders.
const CONFIDENCE_SCORE: Record<Confidence, number> = {
  low: 0.3,
  medium: 0.65,
  high: 0.9,
};

export interface SendMessageInput {
  userId: string;
  conversationId: string;
  content: string;
}

export function listConversations(userId: string, documentId?: string) {
  return prisma.conversation.findMany({
    where: { userId, ...(documentId ? { documentId } : {}) },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createConversation(
  userId: string,
  documentId: string,
  title?: string,
) {
  // Ownership of the linked document is enforced before creating.
  const document = await documentService.getDocument(userId, documentId);
  return prisma.conversation.create({
    data: {
      userId,
      documentId: document.id,
      title: title?.trim() || document.title,
    },
  });
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conversation || conversation.userId !== userId) {
    throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  }
  return conversation;
}

export interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const content = sanitizeInput(input.content);
  if (!content) throw badRequest('Message content must not be empty');

  const conversation = await getConversation(input.userId, input.conversationId);
  const context = await resolveContext(input.userId, conversation.documentId);
  const history = toLLMHistory(conversation.messages);

  const userMessage = await prisma.message.create({
    data: { conversationId: conversation.id, role: 'USER', content },
  });

  const result = await generateAnswer({ question: content, context, history });

  const sources = result.citations.length > 0
    ? result.citations.map((c) => ({ documentId: conversation.documentId ?? '', snippet: c }))
    : undefined;

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: result.answer,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      promptVersionId: result.promptVersion.id,
      confidence: CONFIDENCE_SCORE[result.confidence],
      sources,
    },
  });

  // Touch the conversation so list ordering reflects recent activity.
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { userMessage, assistantMessage };
}

async function resolveContext(
  userId: string,
  documentId: string | null,
): Promise<string | undefined> {
  if (!documentId) return undefined;
  const document = await documentService.getDocument(userId, documentId);
  return document.content.slice(0, MAX_CONTEXT_CHARS);
}

function toLLMHistory(messages?: Message[]): LLMMessage[] {
  if (!messages?.length) return [];
  return messages
    .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
}
