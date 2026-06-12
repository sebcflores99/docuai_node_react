/**
 * Provider-agnostic LLM contract. Concrete providers (OpenAI, Anthropic,
 * mock) implement this so the rest of the app never depends on a specific
 * vendor SDK. Switching providers is a config change (LLM_PROVIDER).
 *
 * The contract supports tool (function) calling so the "general agent" can
 * decide, at inference time, to invoke the document-search tool (the RAG
 * agent) rather than the caller hard-coding the routing.
 */

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

/** A tool call requested by the model. `arguments` are the parsed JSON args. */
export interface LLMToolCall {
  /** Provider-assigned id used to correlate the matching tool result. */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
  /** Present on assistant turns that requested tool calls. */
  toolCalls?: LLMToolCall[];
  /** Present on `tool` messages: the id of the call this result answers. */
  toolCallId?: string;
}

/** A tool the model may call. `parameters` is a JSON Schema object. */
export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Hint to request strict JSON output where the provider supports it. */
  json?: boolean;
  /** Tools the model is allowed to call this turn. */
  tools?: LLMTool[];
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: LLMUsage;
  /** Tool calls the model requested (empty/undefined for a final answer). */
  toolCalls?: LLMToolCall[];
}

export interface LLMProvider {
  /** Stable identifier, e.g. "openai" | "anthropic" | "mock". */
  readonly name: string;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
