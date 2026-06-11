import { describe, it, expect } from 'vitest';
import { MockProvider } from '../mock';
import type { LLMMessage } from '../types';

const provider = new MockProvider();

function messages(userContent: string): LLMMessage[] {
  return [
    { role: 'system', content: 'rules' },
    { role: 'user', content: userContent },
  ];
}

describe('MockProvider', () => {
  it('returns valid JSON with medium confidence when context is present', async () => {
    const user = '<context>\nParis is the capital.\n</context>\n\n<question>\nCapital?\n</question>';
    const res = await provider.complete({ messages: messages(user), model: 'mock-model' });
    const parsed = JSON.parse(res.content);
    expect(parsed.confidence).toBe('medium');
    expect(parsed.citations.length).toBeGreaterThan(0);
    expect(res.model).toBe('mock-model');
    expect(res.usage.promptTokens).toBeGreaterThan(0);
  });

  it('returns low confidence and no citations when context is the placeholder', async () => {
    const user =
      '<context>\n(no document context provided)\n</context>\n\n<question>\nWho won?\n</question>';
    const res = await provider.complete({ messages: messages(user), model: 'mock-model' });
    const parsed = JSON.parse(res.content);
    expect(parsed.confidence).toBe('low');
    expect(parsed.citations).toEqual([]);
  });

  it('falls back to a default model name when none is given', async () => {
    const res = await provider.complete({ messages: messages('<question>\nhi\n</question>'), model: '' });
    expect(res.model).toBe('mock-model');
  });
});
