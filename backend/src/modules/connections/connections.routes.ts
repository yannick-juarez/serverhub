import { Router } from 'express';
import {
  handleCreateDbConnection,
  handleDeleteDbConnection,
  handleListConnections,
  handleUpdateDbConnection,
} from './connections.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(handleListConnections));
router.post('/db', asyncHandler(handleCreateDbConnection));
router.patch('/db/:dbId', asyncHandler(handleUpdateDbConnection));
router.delete('/db/:dbId', asyncHandler(handleDeleteDbConnection));

export { router as connectionsRouter };
