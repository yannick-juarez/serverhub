import { Router } from 'express';
import { handleLogin, handleMe } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

/** POST /api/auth/login */
router.post('/login', asyncHandler(handleLogin));

/** GET /api/auth/me – retourne l'utilisateur connecté */
router.get('/me', requireAuth, asyncHandler(handleMe));

export { router as authRouter };
