import { z } from 'zod';

export type Confidence = 'low' | 'medium' | 'high';

export interface StructuredAnswer {
  answer: string;
  confidence: Confidence;
  citations: string[];
}

const rawAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  citations: z.array(z.string()).optional(),
});

/**
 * Turns a raw model completion into a validated, structured answer.
 * Models can be unreliable about strict JSON, so this is defensive:
 *  - strips markdown code fences,
 *  - extracts the first JSON object if extra prose surrounds it,
 *  - falls back to treating the whole text as a low-confidence answer.
 */
export function postProcess(rawContent: string): StructuredAnswer {
  const text = rawContent?.trim() ?? '';
  if (!text) {
    return { answer: 'The model returned an empty response.', confidence: 'low', citations: [] };
  }

  const parsed = tryParseJson(text);
  if (parsed) {
    const result = rawAnswerSchema.safeParse(parsed);
    if (result.success) {
      return {
        answer: result.data.answer.trim(),
        confidence: result.data.confidence ?? 'medium',
        citations: result.data.citations ?? [],
      };
    }
  }

  // Fallback: model returned plain prose instead of JSON.
  return { answer: text, confidence: 'low', citations: [] };
}

function tryParseJson(text: string): unknown {
  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidates = [withoutFences];
  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(withoutFences.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}
