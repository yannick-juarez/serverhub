import type { Request, Response } from 'express';
import { checkForUpdates, installUpdate } from './updates.service';

function ensureAdmin(req: Request, res: Response): boolean {
  if (!req.user?.is_admin) {
    res.status(403).json({ success: false, error: 'Only admin can manage platform updates.' });
    return false;
  }

  return true;
}

export async function handleCheckUpdates(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const data = await checkForUpdates();
  res.json({ success: true, data });
}

export async function handleInstallUpdate(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const data = await installUpdate();
  res.json({ success: true, data });
}
