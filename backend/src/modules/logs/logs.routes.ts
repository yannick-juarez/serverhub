import { Router } from 'express';
import { handleSources, handleTail, handleGrep } from './logs.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET /api/logs/sources – liste les sources disponibles */
router.get('/sources', asyncHandler(handleSources));

/** GET /api/logs/:source/tail?lines=200 – tail d'un log */
router.get('/:source/tail', asyncHandler(handleTail));

/** GET /api/logs/:source/grep?pattern=&lines=200 – grep dans un log */
router.get('/:source/grep', asyncHandler(handleGrep));

export { router as logsRouter };
