export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthPayload {
  username: string;
  iat?: number;
  exp?: number;
}

export type DatabaseEngine = 'mysql' | 'postgresql' | 'sqlite';

export interface DatabaseConnection {
  id: string;
  engine: DatabaseEngine;
  label: string;
  host: string;
  port: number;
  user: string;
  database?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  managed?: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  permissions: string;
}

export interface LogSource {
  id: string;
  label: string;
  path: string;
}
