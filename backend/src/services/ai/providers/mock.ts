import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from './types';

/** Questions that don't warrant searching the user's documents. */
const GREETING_RE =
  /^(hi|hello|hey|yo|thanks|thank you|thx|bye|goodbye|how are you|who are you|what can you do|what are you)\b/;

/**
 * Deterministic, offline provider used as the default for local development
 * and tests. Requires no API key. It exercises the full agent loop without
 * spending tokens: when a `search_documents` tool is offered for a
 * document-like question it emits a tool call; once a tool result is present
 * (or for general questions) it returns a plain-text answer.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const userMessage = [...request.messages].reverse().find((m) => m.role === 'user');
    const question = extractQuestion(userMessage?.content ?? '');
    const hasSearchTool = (request.tools ?? []).some((t) => t.name === 'search_documents');
    const toolResult = [...request.messages].reverse().find((m) => m.role === 'tool');

    // A tool result is already in the transcript: produce the final answer.
    if (toolResult) {
      const hasContext = toolResult.content.trim().length > 0 && !/no relevant/i.test(toolResult.content);
      const answer = hasContext
        ? `This is a mock answer to "${question}", grounded in your documents. (Provider=mock; set LLM_PROVIDER for a real model.)`
        : `I couldn't find anything about "${question}" in your documents.`;
      return this.result(request, answer);
    }

    // First turn: invoke the document-search tool for document-like questions.
    const isGeneral = GREETING_RE.test(question.toLowerCase());
    if (hasSearchTool && !isGeneral) {
      return {
        content: '',
        model: request.model || 'mock-model',
        usage: this.usage(request, ''),
        toolCalls: [
          { id: 'mock-call-1', name: 'search_documents', arguments: { query: question } },
        ],
      };
    }

    // General question (or no tools offered): answer directly.
    return this.result(
      request,
      `This is a mock answer to "${question}". (Provider=mock; set LLM_PROVIDER for a real model.)`,
    );
  }

  private result(request: LLMCompletionRequest, content: string): LLMCompletionResult {
    return { content, model: request.model || 'mock-model', usage: this.usage(request, content) };
  }

  private usage(request: LLMCompletionRequest, content: string) {
    return {
      promptTokens: estimateTokens(request.messages.map((m) => m.content).join(' ')),
      completionTokens: estimateTokens(content),
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
