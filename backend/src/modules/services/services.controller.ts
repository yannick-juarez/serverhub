import { Request, Response } from 'express';
import { listServices, controlService, getServiceStatus } from './services.service';
import type { ApiResponse } from '../../types';

export async function handleList(_req: Request, res: Response): Promise<void> {
  const data = await listServices();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleControl(req: Request, res: Response): Promise<void> {
  const { name } = req.params;
  const { action } = req.body as { action?: string };
  if (!action) {
    res.status(400).json({ success: false, error: 'action is required' });
    return;
  }
  const message = await controlService(name, action as 'start' | 'stop' | 'restart' | 'reload');
  const resp: ApiResponse = { success: true, message };
  res.json(resp);
}

export async function handleStatus(req: Request, res: Response): Promise<void> {
  const { name } = req.params;
  const data = await getServiceStatus(name);
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}
