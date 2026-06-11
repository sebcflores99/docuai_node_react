import type { RequestHandler } from 'express';
import { unauthorized } from '../../lib/errors';
import { verifyAccessToken } from '../../lib/jwt';

/**
 * Requires a valid Bearer access token. On success, attaches the decoded
 * user to `req.user`; otherwise raises a 401.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
};
