import { z } from 'zod';

export const askSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(4000, 'Question is too long'),
  conversationId: z.string().uuid('conversationId must be a valid UUID').optional(),
  documentId: z.string().uuid('documentId must be a valid UUID').optional(),
  context: z.string().max(20000, 'Inline context is too long').optional(),
});

export type AskInput = z.infer<typeof askSchema>;
