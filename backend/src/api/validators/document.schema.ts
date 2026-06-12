import { z } from 'zod';

// JSON body for the pasted-text path (multipart uploads are validated in the
// controller, where the file — not these fields — is the primary input).
export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  content: z.string().trim().min(1, 'Content is required').max(200000, 'Content is too long'),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
