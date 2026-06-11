/**
 * Provider-agnostic LLM contract. Concrete providers (OpenAI, Anthropic,
 * mock) implement this so the rest of the app never depends on a specific
 * vendor SDK. Switching providers is a config change (LLM_PROVIDER).
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Hint to request strict JSON output where the provider supports it. */
  json?: boolean;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: LLMUsage;
}

export interface LLMProvider {
  /** Stable identifier, e.g. "openai" | "anthropic" | "mock". */
  readonly name: string;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
