import { randomUUID } from 'crypto';
import { readStorage, updateStorage, type RequestFolderRecord, type SqlRequestRecord } from '../storage/storage.service';

export async function getRequestLibrary(dbId: string): Promise<{
  folders: RequestFolderRecord[];
  requests: SqlRequestRecord[];
}> {
  const storage = await readStorage();

  return {
    folders: storage.requests.folders.filter((f) => f.db_id === dbId),
    requests: storage.requests.items.filter((r) => r.db_id === dbId),
  };
}

export async function createRequestFolder(payload: {
  db_id: string;
  folder_name: string;
  folder_description?: string | null;
}): Promise<RequestFolderRecord> {
  const now = new Date().toISOString();
  const folder: RequestFolderRecord = {
    request_folder_id: randomUUID(),
    db_id: payload.db_id,
    folder_name: payload.folder_name,
    folder_description: payload.folder_description ?? null,
    created_at: now,
    updated_at: now,
  };

  await updateStorage((current) => ({
    ...current,
    requests: {
      ...current.requests,
      folders: [...current.requests.folders, folder],
    },
  }));

  return folder;
}

export async function updateRequestFolder(
  folderId: string,
  patch: Partial<Pick<RequestFolderRecord, 'folder_name' | 'folder_description'>>,
): Promise<RequestFolderRecord> {
  let updated: RequestFolderRecord | null = null;

  await updateStorage((current) => ({
    ...current,
    requests: {
      ...current.requests,
      folders: current.requests.folders.map((f) => {
        if (f.request_folder_id !== folderId) return f;
        updated = {
          ...f,
          ...patch,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }),
    },
  }));

  if (!updated) throw new Error('Folder not found');
  return updated;
}

export async function deleteRequestFolder(folderId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    requests: {
      folders: current.requests.folders.filter((f) => f.request_folder_id !== folderId),
      items: current.requests.items.filter((r) => r.request_folder_id !== folderId),
    },
  }));
}

export async function createSqlRequest(payload: {
  db_id: string;
  request_name: string;
  request_description?: string | null;
  sql_text: string;
  request_folder_id?: string | null;
}): Promise<SqlRequestRecord> {
  const now = new Date().toISOString();

  const item: SqlRequestRecord = {
    request_id: randomUUID(),
    db_id: payload.db_id,
    request_name: payload.request_name,
    request_description: payload.request_description ?? null,
    sql_text: payload.sql_text,
    request_folder_id: payload.request_folder_id ?? null,
    created_at: now,
    updated_at: now,
  };

  await updateStorage((current) => ({
    ...current,
    requests: {
      ...current.requests,
      items: [...current.requests.items, item],
    },
  }));

  return item;
}

export async function updateSqlRequest(
  requestId: string,
  patch: Partial<Pick<SqlRequestRecord, 'request_name' | 'request_description' | 'sql_text' | 'request_folder_id'>>,
): Promise<SqlRequestRecord> {
  let updated: SqlRequestRecord | null = null;

  await updateStorage((current) => ({
    ...current,
    requests: {
      ...current.requests,
      items: current.requests.items.map((r) => {
        if (r.request_id !== requestId) return r;
        updated = {
          ...r,
          ...patch,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }),
    },
  }));

  if (!updated) throw new Error('Request not found');
  return updated;
}

export async function deleteSqlRequest(requestId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    requests: {
      ...current.requests,
      items: current.requests.items.filter((r) => r.request_id !== requestId),
    },
  }));
}
