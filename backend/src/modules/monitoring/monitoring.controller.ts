import { Request, Response } from 'express';
import { getSystemOverview, getCpuLoad, getProcesses, getAllMonitoringData, dropPageCaches } from './monitoring.service';
import type { ApiResponse } from '../../types';

export async function handleOverview(_req: Request, res: Response): Promise<void> {
  const data = await getSystemOverview();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleCpuLoad(_req: Request, res: Response): Promise<void> {
  const data = await getCpuLoad();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleProcesses(_req: Request, res: Response): Promise<void> {
  const data = await getProcesses();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleAll(_req: Request, res: Response): Promise<void> {
  const data = await getAllMonitoringData();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}

export async function handleDropCaches(_req: Request, res: Response): Promise<void> {
  const data = await dropPageCaches();
  const resp: ApiResponse = { success: true, data };
  res.json(resp);
}
