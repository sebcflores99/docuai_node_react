import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../../lib/errors';

/** Catches requests that match no route. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
};

/**
 * Central error handler. Translates AppError into structured responses and
 * masks unexpected errors as 500 to avoid leaking internals.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
