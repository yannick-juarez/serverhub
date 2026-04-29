import { apiRequest } from "./http";

export type PreferencesResponse = {
  filesRoot?: string;
  [key: string]: unknown;
};

export type SettingsUser = {
  user_id: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MeResponse = {
  username: string;
};

export type SettingsDbConnection = {
  db_id: string | null;
  name: string;
  engine: "mysql" | "postgresql";
  host: string;
  port: number;
  username: string;
  default_database: string;
  created_at?: string;
  updated_at?: string;
};

export type UpdateCheckResponse = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string | null;
  repository: {
    owner: string;
    repo: string;
    source: "preferences" | "environment" | "default";
  };
};

export type UpdateInstallResponse = {
  previousVersion: string;
  currentVersion: string;
  updated: boolean;
  restartRequired: boolean;
  branch: string;
  repositoryRoot: string;
};

export async function getPreferences(): Promise<PreferencesResponse> {
  return apiRequest<PreferencesResponse>("/preferences");
}

export async function patchPreferences(payload: Record<string, unknown>): Promise<PreferencesResponse> {
  return apiRequest<PreferencesResponse>("/preferences", {
    method: "PATCH",
    body: payload,
  });
}

export async function getUsers(): Promise<SettingsUser[]> {
  return apiRequest<SettingsUser[]>("/users");
}

export async function createUser(username: string, password: string): Promise<SettingsUser> {
  return apiRequest<SettingsUser>("/users", {
    method: "POST",
    body: { username, password },
  });
}

export async function updateUserPassword(username: string, password: string): Promise<SettingsUser> {
  return apiRequest<SettingsUser>(`/users/${encodeURIComponent(username)}/password`, {
    method: "PATCH",
    body: { password },
  });
}

export async function updateUserStatus(username: string, is_active: boolean): Promise<SettingsUser> {
  return apiRequest<SettingsUser>(`/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: { is_active },
  });
}

export async function updateUsername(username: string, nextUsername: string): Promise<SettingsUser> {
  return apiRequest<SettingsUser>(`/users/${encodeURIComponent(username)}/username`, {
    method: "PATCH",
    body: { username: nextUsername },
  });
}

export async function deleteUser(username: string): Promise<void> {
  await apiRequest(`/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
  });
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>("/auth/me");
}

export async function getDbConnections(): Promise<SettingsDbConnection[]> {
  const data = await apiRequest<{ db?: SettingsDbConnection[] }>("/connections");
  return Array.isArray(data.db) ? data.db : [];
}

export async function updateDbConnection(
  dbId: string,
  payload: Partial<SettingsDbConnection> & { password?: string },
): Promise<SettingsDbConnection> {
  return apiRequest<SettingsDbConnection>(`/connections/db/${encodeURIComponent(dbId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function checkPlatformUpdates(): Promise<UpdateCheckResponse> {
  return apiRequest<UpdateCheckResponse>("/updates/check");
}

export async function installPlatformUpdate(): Promise<UpdateInstallResponse> {
  return apiRequest<UpdateInstallResponse>("/updates/install", {
    method: "POST",
  });
}
