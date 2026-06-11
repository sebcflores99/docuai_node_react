import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { loginSchema, signupSchema } from '../validators/auth.schema';

const router: Router = Router();

router.post('/signup', validateBody(signupSchema), authController.signup);
router.post('/login', validateBody(loginSchema), authController.login);

// Returns the currently authenticated user — also serves as a protected-route example.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
