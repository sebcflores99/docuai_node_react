import type { RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '../../lib/errors';

/**
 * Validates `req.body` against a zod schema. On success the parsed (and
 * coerced) value replaces `req.body`; on failure a 400 is raised with the
 * first validation issue.
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        const path = issue?.path.join('.');
        const message = path ? `${path}: ${issue?.message}` : (issue?.message ?? 'Invalid request body');
        next(new AppError(400, message, 'VALIDATION_ERROR'));
        return;
      }
      next(err);
    }
  };
}
