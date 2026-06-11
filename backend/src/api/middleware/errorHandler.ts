import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../../lib/errors';

/** Catches requests that match no route. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Resource not found', code: 'NOT_FOUND' });
};

/**
 * Central error handler. Translates AppError into a flat { message, code }
 * response (consumed directly by the frontend) and masks unexpected errors
 * as 500 to avoid leaking internals.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message, code: err.code });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
};
