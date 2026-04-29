import type { Request, Response } from 'express';
import { getPreferences, patchPreferences } from './preferences.service';

export async function handleGetPreferences(_req: Request, res: Response): Promise<void> {
  const data = await getPreferences();
  res.json({ success: true, data });
}

export async function handlePatchPreferences(req: Request, res: Response): Promise<void> {
  const payload = req.body as Record<string, unknown>;
  const data = await patchPreferences(payload);
  res.json({ success: true, data });
}
