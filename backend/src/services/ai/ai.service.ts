import { getProvider } from './providers';
import type { LLMMessage } from './providers/types';
import { buildMessages } from './promptBuilder';
import { postProcess, type StructuredAnswer } from './postProcess';
import { getActivePromptVersion } from './promptVersion';

// Pre-RAG guardrail: cap context to bound prompt size/cost.
export const MAX_CONTEXT_CHARS = 8000;

export interface GenerateAnswerInput {
  question: string;
  context?: string;
  history?: LLMMessage[];
}

export interface GenerateAnswerResult extends StructuredAnswer {
  provider: string;
  model: string;
  promptVersion: { id: string; name: string; version: number };
  usage: { promptTokens?: number; completionTokens?: number };
}

/**
 * Pure AI engine: prompt construction -> model invocation -> post-processing.
 * It performs no persistence and no ownership checks — callers (e.g. the
 * conversation service) own those concerns. This keeps the AI pipeline
 * reusable and easy to test in isolation.
 */
export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<GenerateAnswerResult> {
  const promptVersion = await getActivePromptVersion();

  const messages = buildMessages({
    template: promptVersion.template,
    question: input.question,
    context: input.context,
    history: input.history,
  });

  const provider = getProvider(promptVersion.provider);
  const completion = await provider.complete({
    messages,
    model: promptVersion.model,
    temperature: 0.2,
    json: true,
  });

  const structured = postProcess(completion.content);

  return {
    ...structured,
    provider: provider.name,
    model: completion.model,
    promptVersion: { id: promptVersion.id, name: promptVersion.name, version: promptVersion.version },
    usage: completion.usage,
  };
}

/** Removes control characters that could be used to smuggle instructions. */
export function sanitizeInput(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}
