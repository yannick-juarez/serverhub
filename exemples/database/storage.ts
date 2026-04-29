import type { DatabaseConnection } from "../../api/connections";
import type { LeftPanelTab, SelectedTable } from "./types";

const STORAGE_KEY_SOURCE = "database:selected-source";
const STORAGE_KEY_TABLE = "database:selected-table";
const STORAGE_KEY_SQL = "database:sql-query";
const STORAGE_KEY_LEFT_PANEL_TAB = "database:left-panel-tab";

type PersistedSource = {
  type: "db";
  id: string | null;
  name: string;
};

type PersistedTable = {
  sourceId: string;
  schema: string;
  table: string;
};

const safeReadJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    // Storage can contain stale or malformed values after deployments.
    localStorage.removeItem(key);
    return null;
  }
};

const safeWrite = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota and privacy-mode storage errors.
  }
};

export const readPersistedSource = (): PersistedSource | null => {
  const parsed = safeReadJson<Partial<PersistedSource>>(STORAGE_KEY_SOURCE);
  if (!parsed || parsed.type !== "db") {
    return null;
  }

  return {
    type: "db",
    id: typeof parsed.id === "string" || parsed.id === null ? parsed.id : null,
    name: typeof parsed.name === "string" ? parsed.name : "",
  };
};

export const persistSource = (connection: DatabaseConnection | null) => {
  if (!connection) {
    localStorage.removeItem(STORAGE_KEY_SOURCE);
    return;
  }

  const payload: PersistedSource = {
    type: "db",
    id: connection.db_id,
    name: connection.name,
  };

  safeWrite(STORAGE_KEY_SOURCE, JSON.stringify(payload));
};

export const readPersistedTable = (sourceId: string | null): SelectedTable | null => {
  if (!sourceId) {
    return null;
  }

  const parsed = safeReadJson<Partial<PersistedTable>>(STORAGE_KEY_TABLE);
  if (!parsed || parsed.sourceId !== sourceId) {
    return null;
  }

  if (typeof parsed.schema === "string" && typeof parsed.table === "string") {
    return {
      schema: parsed.schema,
      table: parsed.table,
    };
  }

  return null;
};

export const persistTable = (sourceId: string | null, table: SelectedTable | null) => {
  if (!sourceId || !table) {
    localStorage.removeItem(STORAGE_KEY_TABLE);
    return;
  }

  const payload: PersistedTable = {
    sourceId,
    schema: table.schema,
    table: table.table,
  };

  safeWrite(STORAGE_KEY_TABLE, JSON.stringify(payload));
};

export const readPersistedSql = (): string => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SQL);
    return raw || "SELECT 1;";
  } catch {
    return "SELECT 1;";
  }
};

export const persistSql = (sql: string) => {
  safeWrite(STORAGE_KEY_SQL, sql);
};

export const readPersistedLeftPanelTab = (): LeftPanelTab => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEFT_PANEL_TAB);
    if (raw === "sources") {
      return "sources";
    }

    return raw === "tables" ? "tables" : "requests";
  } catch {
    return "requests";
  }
};

export const persistLeftPanelTab = (tab: LeftPanelTab) => {
  safeWrite(STORAGE_KEY_LEFT_PANEL_TAB, tab);
};
