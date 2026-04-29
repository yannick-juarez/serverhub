import { Router } from 'express';
import { handleOverview, handleCpuLoad, handleProcesses, handleAll, handleDropCaches } from './monitoring.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET /api/monitoring/overview – vue d'ensemble système */
router.get('/overview', asyncHandler(handleOverview));

/** GET /api/monitoring/cpu – charge CPU en temps réel */
router.get('/cpu', asyncHandler(handleCpuLoad));

/** GET /api/monitoring/processes – top 50 processus */
router.get('/processes', asyncHandler(handleProcesses));

/** GET /api/monitoring/all – overview + cpu cores + processes in one shot */
router.get('/all', asyncHandler(handleAll));

/** POST /api/monitoring/drop-caches – safe kernel page-cache wipe */
router.post('/drop-caches', asyncHandler(handleDropCaches));

export { router as monitoringRouter };
