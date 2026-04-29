import type { Request, Response } from 'express';
import {
  createRequestFolder,
  createSqlRequest,
  deleteRequestFolder,
  deleteSqlRequest,
  getRequestLibrary,
  updateRequestFolder,
  updateSqlRequest,
} from './requests.service';

export async function handleGetLibrary(req: Request, res: Response): Promise<void> {
  const dbId = req.query.db_id as string | undefined;

  if (!dbId) {
    res.status(400).json({ success: false, error: 'db_id is required' });
    return;
  }

  const data = await getRequestLibrary(dbId);
  res.json({ success: true, data });
}

export async function handleCreateFolder(req: Request, res: Response): Promise<void> {
  const { db_id, folder_name, folder_description } = req.body as {
    db_id?: string;
    folder_name?: string;
    folder_description?: string | null;
  };

  if (!db_id || !folder_name) {
    res.status(400).json({ success: false, error: 'db_id and folder_name are required' });
    return;
  }

  const created = await createRequestFolder({ db_id, folder_name, folder_description });
  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateFolder(req: Request, res: Response): Promise<void> {
  const { folderId } = req.params;
  const updated = await updateRequestFolder(folderId, req.body);
  res.json({ success: true, data: updated });
}

export async function handleDeleteFolder(req: Request, res: Response): Promise<void> {
  const { folderId } = req.params;
  await deleteRequestFolder(folderId);
  res.json({ success: true, message: 'Folder deleted' });
}

export async function handleCreateSqlRequest(req: Request, res: Response): Promise<void> {
  const { db_id, request_name, request_description, sql_text, request_folder_id } = req.body as {
    db_id?: string;
    request_name?: string;
    request_description?: string | null;
    sql_text?: string;
    request_folder_id?: string | null;
  };

  if (!db_id || !request_name || !sql_text) {
    res.status(400).json({ success: false, error: 'db_id, request_name and sql_text are required' });
    return;
  }

  const created = await createSqlRequest({
    db_id,
    request_name,
    request_description,
    sql_text,
    request_folder_id,
  });

  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateSqlRequest(req: Request, res: Response): Promise<void> {
  const { requestId } = req.params;
  const updated = await updateSqlRequest(requestId, req.body);
  res.json({ success: true, data: updated });
}

export async function handleDeleteSqlRequest(req: Request, res: Response): Promise<void> {
  const { requestId } = req.params;
  await deleteSqlRequest(requestId);
  res.json({ success: true, message: 'Request deleted' });
}
