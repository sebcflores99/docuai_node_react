import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMMessage,
  LLMProvider,
  LLMToolCall,
} from './types';

const DEFAULT_MAX_TOKENS = 1024;

/** Anthropic Messages API provider (supports tool use). */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor() {
    if (!env.anthropicApiKey) {
      throw new AppError(500, 'ANTHROPIC_API_KEY is not configured', 'PROVIDER_MISCONFIGURED');
    }
    this.client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    // Anthropic takes the system prompt separately from the message turns.
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const turns = request.messages
      .filter((m) => m.role !== 'system')
      .map(toAnthropicMessage);

    const tools = (request.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: request.temperature,
        ...(system ? { system } : {}),
        ...(tools.length > 0 ? { tools } : {}),
        messages: turns,
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map<LLMToolCall>((block) => ({
          id: block.id,
          name: block.name,
          arguments:
            block.input && typeof block.input === 'object'
              ? (block.input as Record<string, unknown>)
              : {},
        }));

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.input_tokens,
          completionTokens: response.usage?.output_tokens,
        },
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } catch (err) {
      throw mapProviderError(err);
    }
  }
}

/** Maps our provider-agnostic message onto an Anthropic message turn. */
function toAnthropicMessage(m: LLMMessage): Anthropic.MessageParam {
  if (m.role === 'tool') {
    return {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: m.content },
      ],
    };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (m.content) blocks.push({ type: 'text', text: m.content });
    for (const tc of m.toolCalls) {
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
    }
    return { role: 'assistant', content: blocks };
  }
  return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
}

function mapProviderError(err: unknown): AppError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 429 ? 429 : 502;
    return new AppError(status, `Anthropic request failed: ${err.message}`, 'PROVIDER_ERROR');
  }
  return new AppError(502, 'Anthropic request failed', 'PROVIDER_ERROR');
}
