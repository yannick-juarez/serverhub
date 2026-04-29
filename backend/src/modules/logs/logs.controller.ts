import { Request, Response } from 'express';
import { getAvailableSources, tailLog, grepLog } from './logs.service';
import type { ApiResponse } from '../../types';

export async function handleSources(_req: Request, res: Response): Promise<void> {
  const data = await getAvailableSources();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleTail(req: Request, res: Response): Promise<void> {
  const { source } = req.params;
  const lines = parseInt((req.query.lines as string) ?? '200', 10);
  const data = await tailLog(source, lines);
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleGrep(req: Request, res: Response): Promise<void> {
  const { source } = req.params;
  const { pattern, lines } = req.query as { pattern?: string; lines?: string };
  if (!pattern) {
    res.status(400).json({ success: false, error: 'pattern is required' });
    return;
  }
  const data = await grepLog(source, pattern, parseInt(lines ?? '200', 10));
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}
