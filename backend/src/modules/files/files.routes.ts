import { Router } from 'express';
import {
  handleList,
  handleRead,
  handleWrite,
  handleDelete,
  handleDeleteMany,
  handleRename,
  handlePermissions,
  handlePermissionsMany,
  handleCompress,
  handleDownload,
  handleArchiveDownload,
  handleMkdir,
  handleRoot,
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

/** DELETE /api/files/batch – supprime plusieurs entrées */
router.delete('/batch', asyncHandler(handleDeleteMany));

/** PATCH /api/files/rename – renomme */
router.patch('/rename', asyncHandler(handleRename));

/** PATCH /api/files/permissions – modifie les permissions */
router.patch('/permissions', asyncHandler(handlePermissions));

/** PATCH /api/files/permissions/batch – permissions en masse */
router.patch('/permissions/batch', asyncHandler(handlePermissionsMany));

/** POST /api/files/compress – compresse des fichiers/dossiers */
router.post('/compress', asyncHandler(handleCompress));

/** GET /api/files/download?path=… – télécharge un fichier ou dossier (archive) */
router.get('/download', asyncHandler(handleDownload));

/** POST /api/files/archive/download – télécharge une archive multi-sélection */
router.post('/archive/download', asyncHandler(handleArchiveDownload));

/** POST /api/files/mkdir – crée un dossier */
router.post('/mkdir', asyncHandler(handleMkdir));

export { router as filesRouter };
