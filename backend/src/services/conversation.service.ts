import type { Message } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError, badRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import * as documentService from './document.service';
import { generateAnswer, sanitizeInput } from './ai/ai.service';
import type { LLMMessage } from './ai/providers/types';
import * as rag from './rag/rag.service';
import type { RetrievedChunk } from './rag/weaviate';
import { type MessageSource, buildSourceFooter, buildSources } from './rag/sources';

const MAX_HISTORY_MESSAGES = 10;

export interface CreateConversationInput {
  userId: string;
  title?: string;
  documentIds?: string[];
}

export interface SendMessageInput {
  userId: string;
  conversationId: string;
  content: string;
  documentIds?: string[];
}

export interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

export function listConversations(userId: string, documentId?: string) {
  return prisma.conversation.findMany({
    where: {
      userId,
      ...(documentId ? { documentIds: { has: documentId } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createConversation(input: CreateConversationInput) {
  const documentIds = input.documentIds ?? [];
  // Validate ownership of any explicitly-scoped documents up front.
  const documents = await assertOwnedDocuments(input.userId, documentIds);

  const defaultTitle =
    documents.length === 1 ? documents[0].title : 'New conversation';

  return prisma.conversation.create({
    data: {
      userId: input.userId,
      documentIds,
      title: input.title?.trim() || defaultTitle,
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

/** Deletes a conversation (and its messages, via cascade) after ownership check. */
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conversation || conversation.userId !== userId) {
    throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  }
  await prisma.conversation.delete({ where: { id: conversationId } });
}

/** Renames a conversation after an ownership check. */
export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conversation || conversation.userId !== userId) {
    throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  }
  const trimmed = title.trim();
  if (!trimmed) throw badRequest('Title must not be empty');
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { title: trimmed },
  });
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const content = sanitizeInput(input.content);
  if (!content) throw badRequest('Message content must not be empty');

  const conversation = await getConversation(input.userId, input.conversationId);
  const history = toLLMHistory(conversation.messages);

  const userMessage = await prisma.message.create({
    data: { conversationId: conversation.id, role: 'USER', content },
  });

  const scopeIds = await resolveScope(input.userId, conversation.documentIds, input.documentIds);

  // The general agent answers directly or calls the RAG agent (search_documents)
  // to ground its answer. The tool is only offered when the user has documents
  // in scope, so general chats skip retrieval entirely.
  const result = await generateAnswer({
    question: content,
    history,
    searchDocuments:
      scopeIds.length > 0
        ? (query) => retrieveScoped(input.userId, scopeIds, query)
        : undefined,
  });

  const chunks = result.retrievedChunks;
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
      sources: sources.length > 0 ? (sources as unknown as object) : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { userMessage, assistantMessage };
}

/**
 * Resolves which documents to search for a message:
 *  1. an explicit per-message subset (validated for ownership), else
 *  2. the conversation's bound documents, else
 *  3. all of the user's READY documents (cross-document chat).
 */
async function resolveScope(
  userId: string,
  conversationDocIds: string[],
  messageDocIds?: string[],
): Promise<string[]> {
  if (messageDocIds && messageDocIds.length > 0) {
    await assertOwnedDocuments(userId, messageDocIds);
    return messageDocIds;
  }
  if (conversationDocIds.length > 0) return conversationDocIds;
  return documentService.listReadyDocumentIds(userId);
}

/**
 * The RAG agent: embeds the query and returns the most relevant chunks across
 * the scoped documents. Returns an empty list (so the model answers
 * conservatively) when there's nothing to search or the vector store is down.
 */
async function retrieveScoped(
  userId: string,
  documentIds: string[],
  question: string,
): Promise<RetrievedChunk[]> {
  if (documentIds.length === 0) return [];
  try {
    return await rag.retrieve({ ownerId: userId, documentIds }, question);
  } catch (err) {
    logger.error('rag.retrieve_failed', {
      ownerId: userId,
      documents: documentIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Ensures every id belongs to the user; returns the loaded documents. */
async function assertOwnedDocuments(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const documents = await prisma.document.findMany({
    where: { id: { in: ids }, ownerId: userId },
  });
  if (documents.length !== new Set(ids).size) {
    throw new AppError(404, 'One or more documents were not found', 'NOT_FOUND');
  }
  return documents;
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
