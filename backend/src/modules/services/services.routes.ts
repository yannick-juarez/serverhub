import { Router } from 'express';
import { handleList, handleControl, handleStatus } from './services.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET  /api/services – liste tous les services systemd */
router.get('/', asyncHandler(handleList));

/** GET  /api/services/:name/status – statut détaillé d'un service */
router.get('/:name/status', asyncHandler(handleStatus));

/** POST /api/services/:name/control – start / stop / restart / reload */
router.post('/:name/control', asyncHandler(handleControl));

export { router as servicesRouter };
