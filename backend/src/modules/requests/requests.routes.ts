import { Router } from 'express';
import {
  handleCreateFolder,
  handleCreateSqlRequest,
  handleDeleteFolder,
  handleDeleteSqlRequest,
  handleGetLibrary,
  handleUpdateFolder,
  handleUpdateSqlRequest,
} from './requests.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(handleGetLibrary));

router.post('/folders', asyncHandler(handleCreateFolder));
router.patch('/folders/:folderId', asyncHandler(handleUpdateFolder));
router.delete('/folders/:folderId', asyncHandler(handleDeleteFolder));

router.post('/sql', asyncHandler(handleCreateSqlRequest));
router.patch('/sql/:requestId', asyncHandler(handleUpdateSqlRequest));
router.delete('/sql/:requestId', asyncHandler(handleDeleteSqlRequest));

export { router as requestsRouter };
