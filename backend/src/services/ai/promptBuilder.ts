import type { LLMMessage } from './providers/types';

export interface PromptBuildInput {
  /** System instructions, typically from the active PromptVersion.template. */
  template: string;
  /** The user's question. */
  question: string;
  /** Optional document context (inline now; RAG-retrieved chunks later). */
  context?: string;
  /** Prior turns for multi-turn conversations. */
  history?: LLMMessage[];
}

/**
 * Pure prompt construction — no model calls, no I/O. Wraps user-controlled
 * input in explicit delimiters so the model treats it as data, and so the
 * post-processor / RAG layer can reason about it independently.
 */
export function buildMessages(input: PromptBuildInput): LLMMessage[] {
  const contextBlock = input.context?.trim()
    ? `<context>\n${input.context.trim()}\n</context>`
    : '<context>\n(no document context provided)\n</context>';

  const userContent = `${contextBlock}\n\n<question>\n${input.question.trim()}\n</question>`;

  return [
    { role: 'system', content: input.template },
    ...(input.history ?? []),
    { role: 'user', content: userContent },
  ];
}
