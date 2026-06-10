import { apiRequest } from "./http";
import Cookies from "js-cookie";
import { apiUrl } from "../config/api";

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

type DownloadResult = {
  blob: Blob;
  fileName: string;
};

function parseFileNameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename\*?=(?:UTF-8''|\")?([^\";]+)/i.exec(contentDisposition);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/\"/g, "").trim());
}

async function downloadWithAuth(path: string, options: RequestInit = {}): Promise<DownloadResult> {
  const token = Cookies.get("token");
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const fromHeader = parseFileNameFromContentDisposition(response.headers.get("content-disposition"));
  return {
    blob,
    fileName: fromHeader ?? "download.bin",
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function getServerFilesRoot(): Promise<string> {
  const res = await apiRequest<{ root: string }>('/files/root');
  return res.root;
}

export async function listServerDirectory(path: string): Promise<ServerFileEntry[]> {
  const query = new URLSearchParams({ path }).toString();
  return apiRequest<ServerFileEntry[]>(`/files?${query}`);
}

export async function readServerFile(path: string, maxBytes?: number): Promise<ServerFileContent> {
  const query = new URLSearchParams({ path });
  if (typeof maxBytes === "number" && Number.isFinite(maxBytes) && maxBytes > 0) {
    query.set("maxBytes", String(Math.floor(maxBytes)));
  }
  return apiRequest<ServerFileContent>(`/files/read?${query}`);
}

export async function deleteServerEntry(path: string): Promise<void> {
  const query = new URLSearchParams({ path }).toString();
  await apiRequest(`/files?${query}`, { method: "DELETE" });
}

export async function deleteServerEntries(paths: string[]): Promise<void> {
  await apiRequest("/files/batch", { method: "DELETE", body: { paths } });
}

export async function renameServerEntry(path: string, newName: string): Promise<void> {
  await apiRequest("/files/rename", { method: "PATCH", body: { path, newName } });
}

export async function setServerEntryPermissions(path: string, permissions: string): Promise<void> {
  await apiRequest("/files/permissions", { method: "PATCH", body: { path, permissions } });
}

export async function setServerEntriesPermissions(paths: string[], permissions: string): Promise<void> {
  await apiRequest("/files/permissions/batch", { method: "PATCH", body: { paths, permissions } });
}

export async function compressServerEntries(paths: string[], archiveName?: string): Promise<{ archivePath: string }> {
  return apiRequest<{ archivePath: string }>("/files/compress", { method: "POST", body: { paths, archiveName } });
}

export async function downloadServerEntry(path: string): Promise<void> {
  const query = new URLSearchParams({ path }).toString();
  const { blob, fileName } = await downloadWithAuth(`/files/download?${query}`);
  triggerBlobDownload(blob, fileName);
}

export async function downloadServerEntriesArchive(paths: string[], archiveName?: string): Promise<void> {
  const { blob, fileName } = await downloadWithAuth("/files/archive/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, archiveName }),
  });
  triggerBlobDownload(blob, fileName);
}

export async function fetchServerFileBlob(path: string): Promise<Blob> {
  const query = new URLSearchParams({ path }).toString();
  const { blob } = await downloadWithAuth(`/files/download?${query}`);
  return blob;
}
