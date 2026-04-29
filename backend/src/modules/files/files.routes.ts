import { Router } from 'express';
import {
  handleList, handleRead, handleWrite, handleDelete, handleRename, handleMkdir, handleRoot,
} from './files.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

/** GET  /api/files/root – effective filesystem root */
router.get('/root', asyncHandler(handleRoot));

/** GET  /api/files?path=/ – liste un dossier */
router.get('/', asyncHandler(handleList));

/** GET  /api/files/read?path=… – lit un fichier */
router.get('/read', asyncHandler(handleRead));

/** PUT  /api/files/write – sauvegarde un fichier */
router.put('/write', asyncHandler(handleWrite));

/** DELETE /api/files?path=… – supprime fichier ou dossier */
router.delete('/', asyncHandler(handleDelete));

/** PATCH /api/files/rename – renomme */
router.patch('/rename', asyncHandler(handleRename));

/** POST /api/files/mkdir – crée un dossier */
router.post('/mkdir', asyncHandler(handleMkdir));

export { router as filesRouter };
