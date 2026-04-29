import { apiRequest } from "./http";

export type ExplorerTable = { name: string };

export type ExplorerSchema = {
  name: string;
  tables: ExplorerTable[];
};

export type SourceExplorerResponse = {
  schemas: ExplorerSchema[];
};

export type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  column_key?: string | null;
  extra?: string | null;
  enum_values?: string[] | null;
};

export type SqlResult = {
  command?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs?: number;
};

export async function fetchSourceExplorer(dbId: string): Promise<SourceExplorerResponse> {
  const response = await apiRequest<{ databases: Array<{ name: string; tables: ExplorerTable[] }> }>(
    `/db/sources/${dbId}/explorer`,
  );

  return {
    // Backward-compatible name used by UI state
    schemas: response.databases.map((db) => ({ name: db.name, tables: db.tables })),
  };
}

export async function fetchTablePreview(
  dbId: string,
  database: string,
  table: string,
  limit = 200,
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
  const query = new URLSearchParams({ database, table, limit: String(limit) });
  return apiRequest<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }>(
    `/db/sources/${dbId}/preview?${query.toString()}`,
  );
}

export async function fetchTableStructure(
  dbId: string,
  database: string,
  table: string,
): Promise<{ columns: ColumnInfo[] }> {
  const query = new URLSearchParams({ database, table });
  return apiRequest<{ columns: ColumnInfo[] }>(`/db/sources/${dbId}/structure?${query.toString()}`);
}

export async function runSourceSql(
  dbId: string,
  sql: string,
  database?: string,
): Promise<SqlResult> {
  return apiRequest<SqlResult>(`/db/sources/${dbId}/query`, {
    method: "POST",
    body: { sql, database },
  });
}

export async function insertTableRow(
  dbId: string,
  database: string,
  table: string,
  data: Record<string, unknown>,
): Promise<void> {
  await apiRequest(`/db/sources/${dbId}/insert`, {
    method: "POST",
    body: { database, table, data },
  });
}
