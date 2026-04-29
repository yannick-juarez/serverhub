import { Request, Response } from 'express';
import { listJobs, createJob, updateJob, deleteJob } from './cron.service';
import type { ApiResponse, CronJob } from '../../types';

export function handleList(_req: Request, res: Response): void {
  const resp: ApiResponse = { success: true, data: listJobs() };
  res.json(resp);
}

export function handleCreate(req: Request, res: Response): void {
  const body = req.body as Pick<CronJob, 'name' | 'schedule' | 'command' | 'enabled'>;
  if (!body.name || !body.schedule || !body.command) {
    res.status(400).json({ success: false, error: 'name, schedule and command are required' });
    return;
  }
  const job = createJob(body);
  const resp: ApiResponse = { success: true, data: job };
  res.status(201).json(resp);
}

export function handleUpdate(req: Request, res: Response): void {
  const { id } = req.params;
  const job = updateJob(id, req.body as Partial<CronJob>);
  const resp: ApiResponse = { success: true, data: job };
  res.json(resp);
}

export function handleDelete(req: Request, res: Response): void {
  const { id } = req.params;
  deleteJob(id);
  const resp: ApiResponse = { success: true, message: 'Job deleted' };
  res.json(resp);
}
