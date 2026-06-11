import OpenAI from 'openai';
import { env } from '../../../config/env';
import { AppError } from '../../../lib/errors';
import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from './types';

/** OpenAI Chat Completions provider. */
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
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: request.messages,
        ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
        },
      };
    } catch (err) {
      throw mapProviderError(err);
    }
  }
}

function mapProviderError(err: unknown): AppError {
  if (err instanceof OpenAI.APIError) {
    const status = err.status === 429 ? 429 : 502;
    return new AppError(status, `OpenAI request failed: ${err.message}`, 'PROVIDER_ERROR');
  }
  return new AppError(502, 'OpenAI request failed', 'PROVIDER_ERROR');
}
