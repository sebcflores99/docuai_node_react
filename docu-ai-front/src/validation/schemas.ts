import { z } from 'zod';

// Centralized client-side validation. Mirrors the backend's rules so users get
// fast, friendly feedback before a request is ever sent.

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Accepted upload types and size limit, kept in sync with the backend.
export const ACCEPTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ACCEPTED_FILE_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx'];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadSchema = z.object({
  title: z.string().trim().max(200, 'Title is too long').optional(),
  file: z
    .instanceof(File, { message: 'Choose a file to upload' })
    .refine((f) => f.size > 0, 'The selected file is empty')
    .refine((f) => f.size <= MAX_FILE_BYTES, 'File must be 10 MB or smaller')
    .refine(
      (f) =>
        (ACCEPTED_FILE_TYPES as readonly string[]).includes(f.type) ||
        ACCEPTED_FILE_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      'Unsupported file type. Use .txt, .md, .pdf, .doc or .docx',
    ),
});

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Type a question first')
    .max(4000, 'Message is too long'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type UploadValues = z.infer<typeof uploadSchema>;

/**
 * Validates `values` against `schema`, returning either the parsed data or a
 * flat { field: message } map for rendering inline errors.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  values: unknown,
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
