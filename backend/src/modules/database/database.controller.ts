import { Request, Response } from 'express';
import {
  fetchTablePreview,
  fetchTableStructure,
  getSourceExplorer,
  insertTableRow,
  runSourceSql,
} from './database.service';

export async function handleGetSourceExplorer(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const data = await getSourceExplorer(dbId);
  res.json({ success: true, data });
}

export async function handleTablePreview(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const { database, table } = req.query as { database?: string; table?: string };
  const limit = parseInt((req.query.limit as string) ?? '200', 10);

  if (!database || !table) {
    res.status(400).json({ success: false, error: 'database and table are required' });
    return;
  }

  const data = await fetchTablePreview({ dbId, database, table, limit });
  res.json({ success: true, data });
}

export async function handleTableStructure(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const { database, table } = req.query as { database?: string; table?: string };

  if (!database || !table) {
    res.status(400).json({ success: false, error: 'database and table are required' });
    return;
  }

  const data = await fetchTableStructure({ dbId, database, table });
  res.json({ success: true, data });
}

export async function handleRunSourceSql(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const { sql, database } = req.body as { sql?: string; database?: string };

  if (!sql) {
    res.status(400).json({ success: false, error: 'sql is required' });
    return;
  }

  const data = await runSourceSql({ dbId, sql, database });
  res.json({ success: true, data });
}

export async function handleInsertTableRow(req: Request, res: Response): Promise<void> {
  const { dbId } = req.params;
  const { database, table, data } = req.body as {
    database?: string;
    table?: string;
    data?: Record<string, unknown>;
  };

  if (!database || !table || !data) {
    res.status(400).json({ success: false, error: 'database, table and data are required' });
    return;
  }

  await insertTableRow({ dbId, database, table, data });
  res.status(201).json({ success: true, message: 'Row inserted' });
}
