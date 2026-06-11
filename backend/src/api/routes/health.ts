import { Router } from 'express';

const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'docu-ai-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
