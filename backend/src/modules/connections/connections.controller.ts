import type { Request, Response } from 'express';
import {
  createDbConnection,
  deleteDbConnection,
  listConnections,
  updateDbConnection,
} from './connections.service';

export async function handleListConnections(_req: Request, res: Response): Promise<void> {
  const data = await listConnections();
  res.json({ success: true, data });
}

export async function handleCreateDbConnection(req: Request, res: Response): Promise<void> {
  const {
    name,
    engine,
    host,
    port,
    username,
    password,
    default_database,
  } = req.body as {
    name?: string;
    engine?: 'mysql' | 'postgresql';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    default_database?: string;
  };

  if (!name || !engine || !host || !port || !username || default_database === undefined) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  const created = await createDbConnection({
    name,
    engine,
    host,
    port,
    username,
    password: password ?? '',
    default_database,
  });

  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateDbConnection(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const updated = await updateDbConnection(dbId, req.body);
  res.json({ success: true, data: updated });
}

export async function handleDeleteDbConnection(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  await deleteDbConnection(dbId);
  res.json({ success: true, message: 'Connection deleted' });
}
