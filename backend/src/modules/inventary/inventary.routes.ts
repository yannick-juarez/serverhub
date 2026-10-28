import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as controller from './inventary.controller';

const router = Router();
router.use(requireAuth);
router.get('/contexts', asyncHandler(controller.listContexts));
router.post('/contexts', asyncHandler(controller.createContext));
router.put('/contexts/:contextId', asyncHandler(controller.updateContext));
router.delete('/contexts/:contextId', asyncHandler(controller.deleteContext));
router.get('/contexts/:contextId/entries', asyncHandler(controller.listEntries));
router.post('/contexts/:contextId/entries', asyncHandler(controller.createEntry));
router.put('/contexts/:contextId/entries/:entryId', asyncHandler(controller.updateEntry));
router.delete('/contexts/:contextId/entries/:entryId', asyncHandler(controller.deleteEntry));
router.post('/contexts/:contextId/entries/:entryId/stock', asyncHandler(controller.adjustStock));
export { router as inventaryRouter };
