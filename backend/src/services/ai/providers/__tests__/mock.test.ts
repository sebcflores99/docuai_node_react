import { describe, it, expect } from 'vitest';
import { MockProvider } from '../mock';
import type { LLMMessage, LLMTool } from '../types';

const provider = new MockProvider();

const SEARCH_TOOL: LLMTool = {
  name: 'search_documents',
  description: 'search',
  parameters: { type: 'object', properties: { query: { type: 'string' } } },
};

function messages(...msgs: LLMMessage[]): LLMMessage[] {
  return [{ role: 'system', content: 'rules' }, ...msgs];
}

describe('MockProvider tool calling', () => {
  it('calls search_documents for a document-like question when the tool is offered', async () => {
    const res = await provider.complete({
      messages: messages({ role: 'user', content: 'What is the revenue in the report?' }),
      model: 'mock-model',
      tools: [SEARCH_TOOL],
    });
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls?.[0].name).toBe('search_documents');
    expect(res.toolCalls?.[0].arguments.query).toContain('revenue');
    expect(res.content).toBe('');
  });

  it('answers greetings directly without calling a tool', async () => {
    const res = await provider.complete({
      messages: messages({ role: 'user', content: 'hello there' }),
      model: 'mock-model',
      tools: [SEARCH_TOOL],
    });
    expect(res.toolCalls).toBeUndefined();
    expect(res.content.length).toBeGreaterThan(0);
  });

  it('produces a grounded final answer once a tool result is present', async () => {
    const res = await provider.complete({
      messages: messages(
        { role: 'user', content: 'What is the capital?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', name: 'search_documents', arguments: { query: 'capital' } }],
        },
        { role: 'tool', toolCallId: 'c1', content: '[1] (France Facts, p. 1) Paris is the capital.' },
      ),
      model: 'mock-model',
      tools: [SEARCH_TOOL],
    });
    expect(res.toolCalls).toBeUndefined();
    expect(res.content).toMatch(/grounded in your documents/i);
  });

  it('reports it could not find anything when the tool result is empty', async () => {
    const res = await provider.complete({
      messages: messages(
        { role: 'user', content: 'What is X?' },
        {
          role: 'tool',
          toolCallId: 'c1',
          content: "No relevant passages were found in the user's documents.",
        },
      ),
      model: 'mock-model',
      tools: [SEARCH_TOOL],
    });
    expect(res.content).toMatch(/couldn't find/i);
  });

  it('answers directly when no tools are offered', async () => {
    const res = await provider.complete({
      messages: messages({ role: 'user', content: 'Tell me about France.' }),
      model: 'mock-model',
    });
    expect(res.toolCalls).toBeUndefined();
    expect(res.content.length).toBeGreaterThan(0);
  });

  it('falls back to a default model name when none is given', async () => {
    const res = await provider.complete({
      messages: messages({ role: 'user', content: 'hi' }),
      model: '',
    });
    expect(res.model).toBe('mock-model');
    expect(res.usage.promptTokens).toBeGreaterThan(0);
  });
});
