import type { Message } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, badRequest } from '../../lib/errors';
import { getProvider } from './providers';
import type { LLMMessage } from './providers/types';
import { buildMessages } from './promptBuilder';
import { postProcess, type StructuredAnswer } from './postProcess';
import { getActivePromptVersion } from './promptVersion';

// Pre-RAG guardrail: cap inline document context to bound prompt size/cost.
const MAX_CONTEXT_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 10;

export interface AskInput {
  userId: string;
  question: string;
  conversationId?: string;
  documentId?: string;
  context?: string;
}

export interface AskResult extends StructuredAnswer {
  conversationId: string;
  provider: string;
  model: string;
  promptVersion: { id: string; name: string; version: number };
  usage: { promptTokens?: number; completionTokens?: number };
}

export async function ask(input: AskInput): Promise<AskResult> {
  const question = sanitize(input.question);
  if (!question) throw badRequest('Question must not be empty');

  const conversation = await resolveConversation(input);
  const context = await resolveContext(input);
  const promptVersion = await getActivePromptVersion();

  const history = await loadHistory(conversation.id);

  await prisma.message.create({
    data: { conversationId: conversation.id, role: 'USER', content: question },
  });

  const messages = buildMessages({
    template: promptVersion.template,
    question,
    context,
    history,
  });

  const provider = getProvider(promptVersion.provider);
  const completion = await provider.complete({
    messages,
    model: promptVersion.model,
    temperature: 0.2,
    json: true,
  });

  const structured = postProcess(completion.content);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: structured.answer,
      model: completion.model,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      promptVersionId: promptVersion.id,
    },
  });

  return {
    ...structured,
    conversationId: conversation.id,
    provider: provider.name,
    model: completion.model,
    promptVersion: { id: promptVersion.id, name: promptVersion.name, version: promptVersion.version },
    usage: completion.usage,
  };
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

async function resolveConversation(input: AskInput) {
  if (input.conversationId) {
    const existing = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
    });
    if (!existing || existing.userId !== input.userId) {
      throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
    }
    return existing;
  }

  return prisma.conversation.create({
    data: {
      userId: input.userId,
      documentId: input.documentId ?? null,
      title: input.question.slice(0, 80),
    },
  });
}

/** Inline context wins; otherwise fall back to the linked document's text. */
async function resolveContext(input: AskInput): Promise<string | undefined> {
  if (input.context?.trim()) {
    return input.context.trim().slice(0, MAX_CONTEXT_CHARS);
  }
  if (input.documentId) {
    const doc = await prisma.document.findUnique({ where: { id: input.documentId } });
    if (!doc || doc.ownerId !== input.userId) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }
    return doc.content.slice(0, MAX_CONTEXT_CHARS);
  }
  return undefined;
}

async function loadHistory(conversationId: string): Promise<LLMMessage[]> {
  const recent = await prisma.message.findMany({
    where: { conversationId, role: { in: ['USER', 'ASSISTANT'] } },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  });
  return recent
    .reverse()
    .map((m: Message) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
}

/** Removes control characters that could be used to smuggle instructions. */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}
