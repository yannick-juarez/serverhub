import { Router } from 'express';
import { handleList, handleCreate, handleUpdate, handleDelete, handleRun } from './cron.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET    /api/cron – liste les jobs */
router.get('/', asyncHandler(handleList));

/** POST   /api/cron – crée un job */
router.post('/', asyncHandler(handleCreate));

/** PATCH  /api/cron/:id – modifie un job */
router.patch('/:id', asyncHandler(handleUpdate));

/** POST   /api/cron/:id/run – lance un job manuellement */
router.post('/:id/run', asyncHandler(handleRun));

/** DELETE /api/cron/:id – supprime un job */
router.delete('/:id', asyncHandler(handleDelete));

export { router as cronRouter };
