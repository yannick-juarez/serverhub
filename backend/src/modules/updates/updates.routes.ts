import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { handleCheckUpdates, handleInstallUpdate } from './updates.controller';

const router = Router();

router.use(requireAuth);
router.get('/check', asyncHandler(handleCheckUpdates));
router.post('/install', asyncHandler(handleInstallUpdate));

export { router as updatesRouter };
