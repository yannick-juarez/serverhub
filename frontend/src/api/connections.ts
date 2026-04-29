import { apiRequest } from "./http";

export type DatabaseConnection = {
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

export type SSHConnection = {
  ssh_id: string | null;
  name: string;
  host?: string;
  port?: number;
  username?: string;
};

export type Connection = DatabaseConnection | SSHConnection;

export type ConnectionsResponse = {
  db: DatabaseConnection[];
  ssh: SSHConnection[];
};

export async function fetchConnections(): Promise<ConnectionsResponse> {
  const raw = await apiRequest<Partial<ConnectionsResponse> | { data?: Partial<ConnectionsResponse> }>("/connections");

  const candidate = (
    raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object"
      ? raw.data
      : raw
  ) as Partial<ConnectionsResponse> | undefined;

  return {
    db: Array.isArray(candidate?.db) ? candidate.db : [],
    ssh: Array.isArray(candidate?.ssh) ? candidate.ssh : [],
  };
}
