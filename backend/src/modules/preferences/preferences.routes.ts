import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { handleGetPreferences, handlePatchPreferences } from './preferences.controller';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(handleGetPreferences));
router.patch('/', asyncHandler(handlePatchPreferences));

export { router as preferencesRouter };
