import { Router } from 'express';
import * as documentController from '../controllers/document.controller';
import { requireAuth } from '../middleware/requireAuth';
import { uploadSingle } from '../middleware/upload';

const router: Router = Router();

router.use(requireAuth);

router.get('/', documentController.list);
// Accepts multipart/form-data (file upload) or JSON { title, content }.
router.post('/', uploadSingle, documentController.create);
router.get('/:id', documentController.get);
router.delete('/:id', documentController.remove);

export default router;
