import { useEffect, useState } from "react";
import {
  getDbConnections,
  updateDbConnection,
  type SettingsDbConnection,
} from "../../api/settings";
import { app } from "./app";
import type { SettingsSectionDefinition } from "../../core/settings/types";

type DbDraft = {
  host: string;
  port: string;
  username: string;
  password: string;
  default_database: string;
};

const DatabaseSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [dbConnections, setDbConnections] = useState<SettingsDbConnection[]>([]);
  const [dbDrafts, setDbDrafts] = useState<Record<string, DbDraft>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const connections = await getDbConnections();
        setDbConnections(connections);
        setDbDrafts(
          Object.fromEntries(
            connections.map((connection) => [
              connection.db_id ?? connection.name,
              {
                host: connection.host,
                port: String(connection.port),
                username: connection.username,
                password: "",
                default_database: connection.default_database,
              },
            ]),
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load db connections");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const saveDbConnection = async (connection: SettingsDbConnection) => {
    const key = connection.db_id ?? connection.name;
    const draft = dbDrafts[key];
    if (!draft || !connection.db_id) {
      return;
    }

    const parsedPort = Number.parseInt(draft.port, 10);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      setError("DB port must be a valid positive number.");
      return;
    }

    const actionKey = `db:${connection.db_id}`;
    try {
      setPendingAction(actionKey);
      setError(null);

      const payload: {
        host: string;
        port: number;
        username: string;
        default_database: string;
        password?: string;
      } = {
        host: draft.host.trim(),
        port: parsedPort,
        username: draft.username.trim(),
        default_database: draft.default_database.trim(),
      };

      if (draft.password.trim()) {
        payload.password = draft.password;
      }

      const updated = await updateDbConnection(connection.db_id, payload);
      setDbConnections((prev) => prev.map((item) => (item.db_id === updated.db_id ? updated : item)));
      setDbDrafts((prev) => ({
        ...prev,
        [key]: {
          host: updated.host,
          port: String(updated.port),
          username: updated.username,
          password: "",
          default_database: updated.default_database,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update db connection");
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading database settings...</div>;
  }

  return (
    <>
      <h2 className="text-lg font-semibold">Databases connections</h2>
      <p className="mt-1 text-xs text-slate-400">
        Update credentials for persisted local MySQL/PostgreSQL connections.
      </p>

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-4 space-y-3">
        {dbConnections.map((connection) => {
          const key = connection.db_id ?? connection.name;
          const draft = dbDrafts[key];
          if (!draft) return null;

          const actionKey = `db:${connection.db_id}`;

          return (
            <div key={key} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">{connection.name}</p>
                <span className="text-xs text-slate-400">{connection.engine}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={draft.host}
                  onChange={(event) =>
                    setDbDrafts((prev) => ({
                      ...prev,
                      [key]: { ...draft, host: event.target.value },
                    }))
                  }
                  placeholder="host"
                />
                <input
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={draft.port}
                  onChange={(event) =>
                    setDbDrafts((prev) => ({
                      ...prev,
                      [key]: { ...draft, port: event.target.value },
                    }))
                  }
                  placeholder="port"
                />
                <input
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={draft.username}
                  onChange={(event) =>
                    setDbDrafts((prev) => ({
                      ...prev,
                      [key]: { ...draft, username: event.target.value },
                    }))
                  }
                  placeholder="username"
                />
                <input
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={draft.default_database}
                  onChange={(event) =>
                    setDbDrafts((prev) => ({
                      ...prev,
                      [key]: { ...draft, default_database: event.target.value },
                    }))
                  }
                  placeholder="default database"
                />
                <input
                  type="password"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none md:col-span-2"
                  value={draft.password}
                  onChange={(event) =>
                    setDbDrafts((prev) => ({
                      ...prev,
                      [key]: { ...draft, password: event.target.value },
                    }))
                  }
                  placeholder="new password (leave empty to keep current)"
                />
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:opacity-60"
                  disabled={pendingAction === actionKey}
                  onClick={() => {
                    void saveDbConnection(connection);
                  }}
                >
                  {pendingAction === actionKey ? "Saving..." : "Save DB credentials"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "databases",
  label: "Databases",
  description: "Connection credentials",
  component: DatabaseSettingsSection,
  color: app.color,
  order: 30,
};
