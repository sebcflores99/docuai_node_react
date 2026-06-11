import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errors';

export interface JwtPayload {
  sub: string;
  email: string;
}

/** Signs a short-lived access token for an authenticated user. */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

/** Verifies a token and returns its payload, or throws a 401 AppError. */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'string' || !decoded.sub || !('email' in decoded)) {
      throw unauthorized('Invalid token');
    }
    return { sub: String(decoded.sub), email: String(decoded.email) };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}
