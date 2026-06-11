import { describe, it, expect } from 'vitest';
import { buildMessages } from '../promptBuilder';

describe('buildMessages', () => {
  it('places the template as the system message', () => {
    const msgs = buildMessages({ template: 'SYSTEM RULES', question: 'Hi?' });
    expect(msgs[0]).toEqual({ role: 'system', content: 'SYSTEM RULES' });
  });

  it('wraps question and context in explicit delimiters (injection framing)', () => {
    const msgs = buildMessages({ template: 'T', question: 'What?', context: 'Some doc text' });
    const user = msgs[msgs.length - 1];
    expect(user.role).toBe('user');
    expect(user.content).toContain('<context>');
    expect(user.content).toContain('Some doc text');
    expect(user.content).toContain('<question>');
    expect(user.content).toContain('What?');
  });

  it('emits a placeholder context block when no context is provided', () => {
    const msgs = buildMessages({ template: 'T', question: 'Q?' });
    const user = msgs[msgs.length - 1];
    expect(user.content).toContain('no document context provided');
  });

  it('includes prior history turns between system and the new user turn', () => {
    const history = [
      { role: 'user' as const, content: 'previous q' },
      { role: 'assistant' as const, content: 'previous a' },
    ];
    const msgs = buildMessages({ template: 'T', question: 'new q', history });
    expect(msgs).toHaveLength(4);
    expect(msgs[1]).toEqual(history[0]);
    expect(msgs[2]).toEqual(history[1]);
    expect(msgs[3].role).toBe('user');
  });
});
