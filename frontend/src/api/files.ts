import { apiRequest } from "./http";

export interface ServerFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  permissions: string;
}

export interface ServerFileContent {
  content: string;
  encoding: string;
}

export async function getServerFilesRoot(): Promise<string> {
  const res = await apiRequest<{ root: string }>('/files/root');
  return res.root;
}

export async function listServerDirectory(path: string): Promise<ServerFileEntry[]> {
  const query = new URLSearchParams({ path }).toString();
  return apiRequest<ServerFileEntry[]>(`/files?${query}`);
}

export async function readServerFile(path: string): Promise<ServerFileContent> {
  const query = new URLSearchParams({ path }).toString();
  return apiRequest<ServerFileContent>(`/files/read?${query}`);
}
