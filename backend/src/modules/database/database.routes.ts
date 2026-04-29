import { Router } from 'express';
import {
	handleGetSourceExplorer,
	handleInsertTableRow,
	handleRunSourceSql,
	handleTablePreview,
	handleTableStructure,
} from './database.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET /api/db/sources/:dbId/explorer */
router.get('/sources/:dbId/explorer', asyncHandler(handleGetSourceExplorer));

/** GET /api/db/sources/:dbId/preview?database=&table=&limit=200 */
router.get('/sources/:dbId/preview', asyncHandler(handleTablePreview));

/** GET /api/db/sources/:dbId/structure?database=&table= */
router.get('/sources/:dbId/structure', asyncHandler(handleTableStructure));

/** POST /api/db/sources/:dbId/query */
router.post('/sources/:dbId/query', asyncHandler(handleRunSourceSql));

/** POST /api/db/sources/:dbId/insert */
router.post('/sources/:dbId/insert', asyncHandler(handleInsertTableRow));

export { router as databaseRouter };
