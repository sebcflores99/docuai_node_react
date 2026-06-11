import express, { type Express } from 'express';
import healthRouter from './api/routes/health';
import authRouter from './api/routes/auth';
import documentRouter from './api/routes/document';
import conversationRouter from './api/routes/conversation';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/conversations', conversationRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
