import { Router } from 'express';
import * as documentController from '../controllers/document.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { createDocumentSchema } from '../validators/document.schema';

const router: Router = Router();

router.use(requireAuth);

router.get('/', documentController.list);
router.post('/', validateBody(createDocumentSchema), documentController.create);
router.get('/:id', documentController.get);
router.delete('/:id', documentController.remove);

export default router;
