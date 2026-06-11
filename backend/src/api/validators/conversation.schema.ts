import { z } from 'zod';

export const createConversationSchema = z.object({
  documentId: z.string().uuid('documentId must be a valid UUID'),
  title: z.string().trim().max(200, 'Title is too long').optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').max(4000, 'Message is too long'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
