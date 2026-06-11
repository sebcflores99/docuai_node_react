import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from './types';

/**
 * Deterministic, offline provider used as the default for local development
 * and tests. Requires no API key. It echoes a structured answer derived from
 * the prompt so the full pipeline (prompt -> invoke -> post-process) can be
 * exercised without spending tokens.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const userMessage = [...request.messages].reverse().find((m) => m.role === 'user');
    const contextBody = (userMessage?.content ?? '').match(/<context>\s*([\s\S]*?)\s*<\/context>/)?.[1]?.trim() ?? '';
    const question = extractQuestion(userMessage?.content ?? '');
    const hasContext = contextBody.length > 0 && contextBody !== '(no document context provided)';

    const payload = {
      answer: hasContext
        ? `This is a mock answer to: "${question}". (Provider=mock; wire a real provider via LLM_PROVIDER.)`
        : `I don't have enough context to answer "${question}" confidently.`,
      confidence: hasContext ? 'medium' : 'low',
      citations: hasContext ? ['context:1'] : [],
    };

    const content = JSON.stringify(payload);
    return {
      content,
      model: request.model || 'mock-model',
      usage: {
        promptTokens: estimateTokens(request.messages.map((m) => m.content).join(' ')),
        completionTokens: estimateTokens(content),
      },
    };
  }
}

function extractQuestion(userContent: string): string {
  const match = userContent.match(/<question>\s*([\s\S]*?)\s*<\/question>/);
  return (match?.[1] ?? userContent).trim().slice(0, 200);
}

/** Rough heuristic (~4 chars/token) — for mock usage reporting only. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
