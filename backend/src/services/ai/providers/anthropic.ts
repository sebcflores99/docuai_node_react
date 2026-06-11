import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMMessage,
  LLMProvider,
} from './types';

const DEFAULT_MAX_TOKENS = 1024;

/** Anthropic Messages API provider. */
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
      .filter((m): m is LLMMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: request.temperature,
        ...(system ? { system } : {}),
        messages: turns,
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.input_tokens,
          completionTokens: response.usage?.output_tokens,
        },
      };
    } catch (err) {
      throw mapProviderError(err);
    }
  }
}

function mapProviderError(err: unknown): AppError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 429 ? 429 : 502;
    return new AppError(status, `Anthropic request failed: ${err.message}`, 'PROVIDER_ERROR');
  }
  return new AppError(502, 'Anthropic request failed', 'PROVIDER_ERROR');
}
