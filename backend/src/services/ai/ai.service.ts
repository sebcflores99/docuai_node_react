import { getProvider } from './providers';
import type { LLMMessage, LLMTool } from './providers/types';
import { DEFAULT_PROMPT_NAME, getActivePromptVersion } from './promptVersion';
import { buildContextBlock } from '../rag/sources';
import type { RetrievedChunk } from '../rag/weaviate';
import { logger } from '../../lib/logger';

/** Max number of tool-call rounds before we force a final answer. */
const MAX_TOOL_ROUNDS = 2;

/**
 * The single tool exposed to the general agent. Calling it hands off to the
 * RAG agent, which embeds the query and retrieves the most relevant passages
 * from the user's own documents (scoped + page-tagged).
 */
const SEARCH_TOOL: LLMTool = {
  name: 'search_documents',
  description:
    "Search the user's uploaded documents for passages relevant to a query. " +
    'Call this whenever the question might be answered by the user\u2019s documents. ' +
    'Returns labeled passages with their document title and page numbers.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "The search query \u2014 usually the user's question or its key terms.",
      },
    },
    required: ['query'],
  },
};

/** Executes a document search (the RAG agent). Provided by the caller so the
 * AI engine stays free of persistence/ownership concerns. */
export type SearchDocumentsFn = (query: string) => Promise<RetrievedChunk[]>;

export interface GenerateAnswerInput {
  question: string;
  history?: LLMMessage[];
  /**
   * When provided, the model may call `search_documents` (the RAG agent). Omit
   * it (e.g. the user has no documents) to force a general, non-grounded answer.
   */
  searchDocuments?: SearchDocumentsFn;
}

export interface GenerateAnswerResult {
  answer: string;
  /** Chunks retrieved across all tool calls (used to build sources). */
  retrievedChunks: RetrievedChunk[];
  provider: string;
  model: string;
  promptVersion: { id: string; name: string; version: number };
  usage: { promptTokens?: number; completionTokens?: number };
}

/**
 * The general agent. It answers directly OR, by calling the `search_documents`
 * tool, defers to the RAG agent and grounds its answer in retrieved passages.
 * The model decides which path to take. This function performs no persistence
 * and no ownership checks — callers own those concerns.
 */
export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<GenerateAnswerResult> {
  const promptVersion = await getActivePromptVersion(DEFAULT_PROMPT_NAME);
  const provider = getProvider(promptVersion.provider);
  const tools = input.searchDocuments ? [SEARCH_TOOL] : undefined;

  const messages: LLMMessage[] = [
    { role: 'system', content: promptVersion.template },
    ...(input.history ?? []),
    { role: 'user', content: input.question },
  ];

  const retrieved: RetrievedChunk[] = [];
  const usage = { promptTokens: 0, completionTokens: 0 };
  let lastModel = promptVersion.model;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await provider.complete({
      messages,
      model: promptVersion.model,
      temperature: 0.2,
      tools,
    });
    usage.promptTokens += completion.usage.promptTokens ?? 0;
    usage.completionTokens += completion.usage.completionTokens ?? 0;
    lastModel = completion.model;

    const wantsTool = completion.toolCalls && completion.toolCalls.length > 0;
    if (wantsTool && input.searchDocuments && round < MAX_TOOL_ROUNDS) {
      messages.push({
        role: 'assistant',
        content: completion.content,
        toolCalls: completion.toolCalls,
      });

      for (const call of completion.toolCalls!) {
        const query =
          typeof call.arguments.query === 'string' && call.arguments.query.trim()
            ? call.arguments.query.trim()
            : input.question;
        logger.info('rag.tool_call', { tool: call.name, query });
        const chunks = await input.searchDocuments(query);
        retrieved.push(...chunks);
        logger.info('rag.tool_result', { tool: call.name, query, chunks: chunks.length });
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content:
            chunks.length > 0
              ? buildContextBlock(chunks)
              : "No relevant passages were found in the user's documents.",
        });
      }
      continue;
    }

    return {
      answer: completion.content.trim() || 'I was unable to generate a response.',
      retrievedChunks: dedupeChunks(retrieved),
      provider: provider.name,
      model: lastModel,
      promptVersion: {
        id: promptVersion.id,
        name: promptVersion.name,
        version: promptVersion.version,
      },
      usage,
    };
  }

  // Exhausted tool rounds without a final answer (defensive): summarize what
  // we have rather than looping forever.
  return {
    answer: 'I was unable to complete the request within the allowed steps.',
    retrievedChunks: dedupeChunks(retrieved),
    provider: provider.name,
    model: lastModel,
    promptVersion: {
      id: promptVersion.id,
      name: promptVersion.name,
      version: promptVersion.version,
    },
    usage,
  };
}

/** Collapses duplicate chunks (same document + chunk index) from repeat calls. */
function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    const key = `${c.documentId}:${c.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Removes control characters that could be used to smuggle instructions. */
export function sanitizeInput(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}
