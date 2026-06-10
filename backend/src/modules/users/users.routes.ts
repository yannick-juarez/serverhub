import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import {
  handleCreateUser,
  handleDeleteUser,
  handleListUsers,
  handleRenameUser,
  handleUpdateRole,
  handleUpdatePassword,
  handleUpdateStatus,
} from './users.controller';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);
router.get('/', asyncHandler(handleListUsers));
router.post('/', asyncHandler(handleCreateUser));
router.patch('/:username/password', asyncHandler(handleUpdatePassword));
router.patch('/:username/username', asyncHandler(handleRenameUser));
router.patch('/:username/role', asyncHandler(handleUpdateRole));
router.patch('/:username', asyncHandler(handleUpdateStatus));
router.delete('/:username', asyncHandler(handleDeleteUser));

export { router as usersRouter };
