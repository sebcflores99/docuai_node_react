import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AppError, conflict, unauthorized } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { logger } from '../lib/logger';
import { ensureTenant } from './rag/weaviate';
import type { LoginInput, SignupInput } from '../api/validators/auth.schema';

const SALT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

/** Registers a new user. Fails with 409 if the email is already taken. */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  // Provision the user's isolated vector tenant up front. Best-effort: it is
  // also created lazily on first document ingest, so a transient vector-store
  // outage must not block signup.
  await ensureTenant(user.id).catch((err) => {
    logger.warn('tenant.provision_failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const token = signAccessToken({ sub: user.id, email: user.email });
  return { token, user };
}

/** Authenticates a user with email + password. */
export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Always run a hash comparison to avoid leaking whether the email exists.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !passwordMatches) {
    throw unauthorized('Invalid email or password');
  }

  const token = signAccessToken({ sub: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } };
}

/** Returns the public profile for an authenticated user. */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return user;
}
