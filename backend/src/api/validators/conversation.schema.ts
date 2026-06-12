import { z } from 'zod';

const documentIds = z
  .array(z.string().uuid('documentIds must be valid UUIDs'))
  .max(100, 'Too many documentIds')
  .optional();

// Document binding is optional: omit documentIds to chat across all of the
// user's READY documents, or pass a subset to scope retrieval.
export const createConversationSchema = z.object({
  title: z.string().trim().max(200, 'Title is too long').optional(),
  documentIds,
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').max(4000, 'Message is too long'),
  // Optional per-message override of the retrieval scope.
  documentIds,
});

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type RenameConversationInput = z.infer<typeof renameConversationSchema>;
