import { Router } from 'express';
import { prisma } from '../../config/prisma';

const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'docu-ai-backend',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

export default router;
