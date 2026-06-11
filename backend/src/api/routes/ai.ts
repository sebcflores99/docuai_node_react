import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { askSchema } from '../validators/ai.schema';

const router: Router = Router();

router.use(requireAuth);

router.post('/ask', validateBody(askSchema), aiController.ask);
router.get('/conversations/:id', aiController.getConversation);

export default router;
