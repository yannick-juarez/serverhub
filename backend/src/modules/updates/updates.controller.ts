import type { Request, Response } from 'express';
import { config } from '../../config/env';
import { checkForUpdates, installUpdate } from './updates.service';

function ensureAdmin(req: Request, res: Response): boolean {
  const username = req.user?.username?.trim().toLowerCase() ?? '';
  const adminUsername = config.admin.username.trim().toLowerCase();

  if (username !== adminUsername) {
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
