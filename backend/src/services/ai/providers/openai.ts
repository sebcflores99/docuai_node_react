import OpenAI from 'openai';
import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMMessage,
  LLMProvider,
  LLMToolCall,
} from './types';

/** OpenAI Chat Completions provider (supports tool/function calling). */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor() {
    if (!env.openaiApiKey) {
      throw new AppError(500, 'OPENAI_API_KEY is not configured', 'PROVIDER_MISCONFIGURED');
    }
    this.client = new OpenAI({ apiKey: env.openaiApiKey });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const tools = (request.tools ?? []).map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const hasTools = tools.length > 0;

    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: request.messages.map(toOpenAIMessage),
        ...(hasTools ? { tools } : {}),
        // response_format and tools don't combine well; only force JSON when
        // no tools are offered.
        ...(request.json && !hasTools ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices[0];
      const toolCalls = (choice?.message?.tool_calls ?? [])
        .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: 'function' } =>
          tc.type === 'function',
        )
        .map<LLMToolCall>((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: safeParseArgs(tc.function.arguments),
        }));

      return {
        content: choice?.message?.content ?? '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
        },
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } catch (err) {
      throw mapProviderError(err);
    }
  }
}

/** Maps our provider-agnostic message onto the OpenAI message shape. */
function toOpenAIMessage(
  m: LLMMessage,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
  }
  if (m.role === 'assistant') return { role: 'assistant', content: m.content };
  if (m.role === 'system') return { role: 'system', content: m.content };
  return { role: 'user', content: m.content };
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function mapProviderError(err: unknown): AppError {
  if (err instanceof OpenAI.APIError) {
    const status = err.status === 429 ? 429 : 502;
    return new AppError(status, `OpenAI request failed: ${err.message}`, 'PROVIDER_ERROR');
  }
  return new AppError(502, 'OpenAI request failed', 'PROVIDER_ERROR');
}
