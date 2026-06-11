import express, { type Express } from 'express';
import healthRouter from './api/routes/health';
import authRouter from './api/routes/auth';
import aiRouter from './api/routes/ai';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/ai', aiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
