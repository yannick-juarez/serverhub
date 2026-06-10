import { apiRequest } from "./http";

export type PreferencesResponse = {
  filesRoot?: string;
  [key: string]: unknown;
};

export type SettingsUser = {
  user_id: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type MeResponse = {
  username: string;
  is_admin: boolean;
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

export type SystemScriptResult = {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type SystemBuildStartResponse = {
  command: string;
  cwd: string;
  pid: number;
  started: true;
};

export type SystemSettingsResponse = {
  workspaceRoot: string;
  scripts: {
    build: string;
    install: string;
  };
  domains: {
    configured: string[];
    preferred: string[];
    email: string;
    appPort: number;
  };
};

export type SystemApplyDomainsResponse = {
  domains: string[];
  siteFile: string;
  certificate: {
    attempted: boolean;
    success: boolean;
  };
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

export async function updateUserRole(username: string, is_admin: boolean): Promise<SettingsUser> {
  return apiRequest<SettingsUser>(`/users/${encodeURIComponent(username)}/role`, {
    method: "PATCH",
    body: { is_admin },
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

export async function getSystemSettings(): Promise<SystemSettingsResponse> {
  return apiRequest<SystemSettingsResponse>("/system/settings");
}

export async function patchSystemSettings(payload: {
  domains?: string[];
  email?: string;
  appPort?: number;
}): Promise<SystemSettingsResponse> {
  return apiRequest<SystemSettingsResponse>("/system/settings", {
    method: "PATCH",
    body: payload,
  });
}

export async function runSystemBuild(): Promise<SystemBuildStartResponse> {
  return apiRequest<SystemBuildStartResponse>("/system/build", {
    method: "POST",
  });
}

export async function runSystemInstall(payload: {
  domains?: string[];
  email?: string;
  appPort?: number;
}): Promise<SystemBuildStartResponse> {
  return apiRequest<SystemBuildStartResponse>("/system/install", {
    method: "POST",
    body: payload,
  });
}

export async function applySystemDomains(payload: {
  domains: string[];
  email?: string;
  appPort?: number;
  requestCertificate?: boolean;
  autoInstallPackages?: boolean;
}): Promise<SystemApplyDomainsResponse> {
  return apiRequest<SystemApplyDomainsResponse>("/system/domains/apply", {
    method: "POST",
    body: payload,
  });
}
