import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { loginSchema, signupSchema } from '../validators/auth.schema';

const router: Router = Router();

// `register` is the primary name; `signup` is kept as an alias.
router.post('/register', validateBody(signupSchema), authController.register);
router.post('/signup', validateBody(signupSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/me', requireAuth, authController.me);

export default router;
