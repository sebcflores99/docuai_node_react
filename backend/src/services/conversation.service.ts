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
import * as rag from './rag/rag.service';
import type { RetrievedChunk } from './rag/weaviate';
import {
  type MessageSource,
  buildContextBlock,
  buildSourceFooter,
  buildSources,
} from './rag/sources';

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
  const history = toLLMHistory(conversation.messages);

  const userMessage = await prisma.message.create({
    data: { conversationId: conversation.id, role: 'USER', content },
  });

  const { context, chunks } = await buildRetrievalContext(
    input.userId,
    conversation.documentId,
    content,
  );

  const result = await generateAnswer({ question: content, context, history });

  const sources = buildSources(chunks);
  const footer = buildSourceFooter(chunks);
  const answer = footer ? `${result.answer}\n\n${footer}` : result.answer;

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: answer,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      promptVersionId: result.promptVersion.id,
      confidence: CONFIDENCE_SCORE[result.confidence],
      sources: sources.length > 0 ? (sources as unknown as object) : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { userMessage, assistantMessage };
}

interface RetrievalContext {
  context?: string;
  chunks: RetrievedChunk[];
}

/**
 * Retrieves relevant chunks for the question via RAG. If retrieval yields
 * nothing (no linked document, vector store unavailable, or not yet indexed),
 * it gracefully falls back to the document's full text so answers still work.
 */
async function buildRetrievalContext(
  userId: string,
  documentId: string | null,
  question: string,
): Promise<RetrievalContext> {
  if (!documentId) return { chunks: [] };

  const document = await documentService.getDocument(userId, documentId);

  try {
    const chunks = await rag.retrieve(documentId, question);
    if (chunks.length > 0) {
      return { context: buildContextBlock(chunks), chunks };
    }
  } catch (err) {
    console.error(`RAG retrieval failed for document ${documentId}:`, err);
  }

  // Fallback: inline (truncated) full document text.
  return { context: document.content.slice(0, MAX_CONTEXT_CHARS), chunks: [] };
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

export type { MessageSource };
