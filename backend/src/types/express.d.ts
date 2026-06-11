import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth for authenticated requests. */
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
