import { Request, Response } from 'express';
import { listJobs, createJob, updateJob, deleteJob, runJob } from './cron.service';
import type { ApiResponse, CronJob } from '../../types';

export async function handleList(_req: Request, res: Response): Promise<void> {
  const resp: ApiResponse = { success: true, data: await listJobs() };
  res.json(resp);
}

export async function handleCreate(req: Request, res: Response): Promise<void> {
  const body = req.body as Pick<CronJob, 'name' | 'schedule' | 'command' | 'enabled'>;
  if (!body.name || !body.schedule || !body.command) {
    res.status(400).json({ success: false, error: 'name, schedule and command are required' });
    return;
  }
  const job = await createJob(body);
  const resp: ApiResponse = { success: true, data: job };
  res.status(201).json(resp);
}

export async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const job = await updateJob(id, req.body as Partial<CronJob>);
  const resp: ApiResponse = { success: true, data: job };
  res.json(resp);
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await deleteJob(id);
  const resp: ApiResponse = { success: true, message: 'Job deleted' };
  res.json(resp);
}

export async function handleRun(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await runJob(id);
  const resp: ApiResponse = { success: true, data: result };
  res.json(resp);
}
