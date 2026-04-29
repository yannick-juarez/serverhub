import { apiRequest } from "./http";

export type RequestFolder = {
  request_folder_id: string;
  db_id: string;
  folder_name: string;
  folder_description: string | null;
  created_at: string;
  updated_at: string;
};

export type SqlRequest = {
  request_id: string;
  db_id: string;
  request_folder_id: string | null;
  request_name: string;
  request_description: string | null;
  sql_text: string;
  created_at: string;
  updated_at: string;
};

export async function fetchRequestLibrary(dbId: string): Promise<{ folders: RequestFolder[]; requests: SqlRequest[] }> {
  const query = new URLSearchParams({ db_id: dbId });
  const raw = await apiRequest<
    Partial<{ folders: RequestFolder[]; requests: SqlRequest[] }> | { data?: Partial<{ folders: RequestFolder[]; requests: SqlRequest[] }> }
  >(`/requests?${query.toString()}`);

  const candidate = (
    raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object"
      ? raw.data
      : raw
  ) as Partial<{ folders: RequestFolder[]; requests: SqlRequest[] }> | undefined;

  return {
    folders: Array.isArray(candidate?.folders) ? candidate.folders : [],
    requests: Array.isArray(candidate?.requests) ? candidate.requests : [],
  };
}

export async function createRequestFolder(payload: {
  db_id: string;
  folder_name: string;
  folder_description?: string | null;
}): Promise<RequestFolder> {
  return apiRequest<RequestFolder>("/requests/folders", { method: "POST", body: payload });
}

export async function updateRequestFolder(
  folderId: string,
  patch: Partial<Pick<RequestFolder, "folder_name" | "folder_description">>,
): Promise<RequestFolder> {
  return apiRequest<RequestFolder>(`/requests/folders/${folderId}`, { method: "PATCH", body: patch });
}

export async function deleteRequestFolder(folderId: string): Promise<void> {
  await apiRequest(`/requests/folders/${folderId}`, { method: "DELETE" });
}

export async function createSqlRequest(payload: {
  db_id: string;
  request_name: string;
  request_description?: string | null;
  sql_text: string;
  request_folder_id?: string | null;
}): Promise<SqlRequest> {
  return apiRequest<SqlRequest>("/requests/sql", { method: "POST", body: payload });
}

export async function updateSqlRequest(
  requestId: string,
  patch: Partial<Pick<SqlRequest, "request_name" | "request_description" | "sql_text" | "request_folder_id">>,
): Promise<SqlRequest> {
  return apiRequest<SqlRequest>(`/requests/sql/${requestId}`, { method: "PATCH", body: patch });
}

export async function deleteSqlRequest(requestId: string): Promise<void> {
  await apiRequest(`/requests/sql/${requestId}`, { method: "DELETE" });
}
