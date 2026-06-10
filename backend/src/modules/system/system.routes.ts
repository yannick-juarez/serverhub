import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  handleApplyDomains,
  handleGetSystemSettings,
  handlePatchSystemSettings,
  handleRunBuild,
  handleRunInstall,
} from './system.controller';

const router = Router();

router.use(requireAuth);
router.get('/settings', asyncHandler(handleGetSystemSettings));
router.patch('/settings', asyncHandler(handlePatchSystemSettings));
router.post('/build', asyncHandler(handleRunBuild));
router.post('/install', asyncHandler(handleRunInstall));
router.post('/domains/apply', asyncHandler(handleApplyDomains));

export { router as systemRouter };
