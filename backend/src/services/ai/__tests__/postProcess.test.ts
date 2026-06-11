import { describe, it, expect } from 'vitest';
import { postProcess } from '../postProcess';

describe('postProcess', () => {
  it('parses a clean JSON object', () => {
    const out = postProcess(JSON.stringify({ answer: 'Paris', confidence: 'high', citations: ['context:1'] }));
    expect(out).toEqual({ answer: 'Paris', confidence: 'high', citations: ['context:1'] });
  });

  it('defaults confidence to medium and citations to [] when omitted', () => {
    const out = postProcess(JSON.stringify({ answer: 'Paris' }));
    expect(out.confidence).toBe('medium');
    expect(out.citations).toEqual([]);
  });

  it('strips markdown code fences around JSON', () => {
    const raw = '```json\n{"answer":"Hello","confidence":"low"}\n```';
    const out = postProcess(raw);
    expect(out.answer).toBe('Hello');
    expect(out.confidence).toBe('low');
  });

  it('extracts the JSON object when surrounded by prose', () => {
    const raw = 'Sure! Here is the result: {"answer":"42","confidence":"high"} — hope that helps.';
    const out = postProcess(raw);
    expect(out.answer).toBe('42');
    expect(out.confidence).toBe('high');
  });

  it('falls back to low-confidence plain text when not valid JSON', () => {
    const out = postProcess('I think the answer is Paris.');
    expect(out.answer).toBe('I think the answer is Paris.');
    expect(out.confidence).toBe('low');
    expect(out.citations).toEqual([]);
  });

  it('handles empty input gracefully', () => {
    const out = postProcess('   ');
    expect(out.confidence).toBe('low');
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it('rejects an invalid confidence value by falling back', () => {
    const out = postProcess(JSON.stringify({ answer: 'X', confidence: 'super-high' }));
    // Schema rejects the bad enum, so the whole thing is treated as prose.
    expect(out.confidence).toBe('low');
  });
});
