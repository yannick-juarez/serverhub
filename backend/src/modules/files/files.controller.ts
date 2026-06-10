import { Request, Response } from 'express';
import {
  listDirectory,
  readFile,
  writeFile,
  deleteEntry,
  deleteEntries,
  renameEntry,
  createDirectory,
  getFilesRoot,
  setEntryPermissions,
  setEntriesPermissions,
  compressEntries,
  resolveFilePath,
  buildArchiveForDownload,
} from './files.service';
import type { ApiResponse } from '../../types';
import fs from 'fs/promises';
import path from 'path';

export async function handleRoot(_req: Request, res: Response): Promise<void> {
  const root = await getFilesRoot();
  const resp: ApiResponse = { success: true, data: { root } };
  res.json(resp);
}

export async function handleList(req: Request, res: Response): Promise<void> {
  const p = (req.query.path as string) ?? '/';
  const data = await listDirectory(p);
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleRead(req: Request, res: Response): Promise<void> {
  const p = (req.query.path as string) ?? '';
  const maxBytesRaw = req.query.maxBytes as string | undefined;
  const maxBytes = maxBytesRaw ? Number.parseInt(maxBytesRaw, 10) : undefined;
  const data = await readFile(p, Number.isFinite(maxBytes) ? maxBytes : undefined);
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleWrite(req: Request, res: Response): Promise<void> {
  const { path: p, content } = req.body as { path?: string; content?: string };
  if (!p || content === undefined) {
    res.status(400).json({ success: false, error: 'path and content are required' });
    return;
  }
  await writeFile(p, content);
  const resp: ApiResponse = { success: true, message: 'File saved' };
  res.json(resp);
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  const p = (req.query.path as string) ?? '';
  await deleteEntry(p);
  const resp: ApiResponse = { success: true, message: 'Deleted' };
  res.json(resp);
}

export async function handleDeleteMany(req: Request, res: Response): Promise<void> {
  const { paths } = req.body as { paths?: string[] };
  if (!Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ success: false, error: 'paths is required and must be a non-empty array' });
    return;
  }
  await deleteEntries(paths);
  const resp: ApiResponse = { success: true, message: 'Deleted' };
  res.json(resp);
}

export async function handleRename(req: Request, res: Response): Promise<void> {
  const { path: p, newName } = req.body as { path?: string; newName?: string };
  if (!p || !newName) {
    res.status(400).json({ success: false, error: 'path and newName are required' });
    return;
  }
  await renameEntry(p, newName);
  const resp: ApiResponse = { success: true, message: 'Renamed' };
  res.json(resp);
}

export async function handlePermissions(req: Request, res: Response): Promise<void> {
  const { path: p, permissions } = req.body as { path?: string; permissions?: string };
  if (!p || !permissions) {
    res.status(400).json({ success: false, error: 'path and permissions are required' });
    return;
  }
  await setEntryPermissions(p, permissions);
  const resp: ApiResponse = { success: true, message: 'Permissions updated' };
  res.json(resp);
}

export async function handlePermissionsMany(req: Request, res: Response): Promise<void> {
  const { paths, permissions } = req.body as { paths?: string[]; permissions?: string };
  if (!Array.isArray(paths) || paths.length === 0 || !permissions) {
    res.status(400).json({ success: false, error: 'paths and permissions are required' });
    return;
  }
  await setEntriesPermissions(paths, permissions);
  const resp: ApiResponse = { success: true, message: 'Permissions updated' };
  res.json(resp);
}

export async function handleCompress(req: Request, res: Response): Promise<void> {
  const { paths, archiveName } = req.body as { paths?: string[]; archiveName?: string };
  if (!Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ success: false, error: 'paths is required and must be a non-empty array' });
    return;
  }
  const archivePath = await compressEntries(paths, archiveName);
  const resp: ApiResponse<{ archivePath: string }> = { success: true, data: { archivePath } };
  res.json(resp);
}

export async function handleDownload(req: Request, res: Response): Promise<void> {
  const p = (req.query.path as string) ?? '';
  if (!p) {
    res.status(400).json({ success: false, error: 'path is required' });
    return;
  }

  const resolvedPath = await resolveFilePath(p);
  const stats = await fs.stat(resolvedPath);

  if (stats.isDirectory()) {
    const archive = await buildArchiveForDownload([p], path.basename(resolvedPath));
    res.download(archive.archivePath, archive.fileName, async () => {
      await fs.rm(archive.cleanupDir, { recursive: true, force: true });
    });
    return;
  }

  res.download(resolvedPath, path.basename(resolvedPath));
}

export async function handleArchiveDownload(req: Request, res: Response): Promise<void> {
  const { paths, archiveName } = req.body as { paths?: string[]; archiveName?: string };
  if (!Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ success: false, error: 'paths is required and must be a non-empty array' });
    return;
  }

  const archive = await buildArchiveForDownload(paths, archiveName);
  res.download(archive.archivePath, archive.fileName, async () => {
    await fs.rm(archive.cleanupDir, { recursive: true, force: true });
  });
}

export async function handleMkdir(req: Request, res: Response): Promise<void> {
  const { path: p } = req.body as { path?: string };
  if (!p) {
    res.status(400).json({ success: false, error: 'path is required' });
    return;
  }
  await createDirectory(p);
  const resp: ApiResponse = { success: true, message: 'Directory created' };
  res.json(resp);
}
