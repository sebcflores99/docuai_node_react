import { Router } from 'express';
import * as conversationController from '../controllers/conversation.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import {
  createConversationSchema,
  renameConversationSchema,
  sendMessageSchema,
} from '../validators/conversation.schema';

const router: Router = Router();

router.use(requireAuth);

router.get('/', conversationController.list);
router.post('/', validateBody(createConversationSchema), conversationController.create);
router.get('/:id', conversationController.get);
router.patch('/:id', validateBody(renameConversationSchema), conversationController.rename);
router.delete('/:id', conversationController.remove);
router.post('/:id/messages', validateBody(sendMessageSchema), conversationController.sendMessage);

export default router;
