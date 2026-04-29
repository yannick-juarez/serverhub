import { Request, Response } from 'express';
import {
  listDirectory, readFile, writeFile, deleteEntry, renameEntry, createDirectory, getFilesRoot,
} from './files.service';
import type { ApiResponse } from '../../types';

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
  const data = await readFile(p);
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
