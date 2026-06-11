/**
 * Application-level error with an associated HTTP status code.
 * Thrown by services/controllers and translated to responses by the
 * central error handler.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (message: string): AppError =>
  new AppError(400, message, 'BAD_REQUEST');

export const unauthorized = (message = 'Unauthorized'): AppError =>
  new AppError(401, message, 'UNAUTHORIZED');

export const conflict = (message: string): AppError =>
  new AppError(409, message, 'CONFLICT');
