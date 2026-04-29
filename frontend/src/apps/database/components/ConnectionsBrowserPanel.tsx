import { useMemo } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { HiOutlineDatabase } from "react-icons/hi";
import { HiOutlineFolderArrowDown } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { ConnectionsResponse, DatabaseConnection, SSHConnection } from "../../../api/connections";

interface ConnectionsBrowserPanelProps {
  title?: string;
  description?: string;
  connections: ConnectionsResponse;
  isLoading: boolean;
  error: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onSelectDatabase?: (connection: DatabaseConnection) => void;
  getDatabaseHref?: (connection: DatabaseConnection) => string | null;
  selectedDatabaseId?: string | null;
  className?: string;
  type?: "db" | "ssh";
}

interface ConnectionRowProps {
  type: "ssh" | "db";
  item: SSHConnection | DatabaseConnection;
  selected?: boolean;
  onSelectDatabase?: (connection: DatabaseConnection) => void;
  getDatabaseHref?: (connection: DatabaseConnection) => string | null;
}

const ConnectionRow = ({ type, item, selected, onSelectDatabase, getDatabaseHref }: ConnectionRowProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (type === "db") {
      if (onSelectDatabase) {
        onSelectDatabase(item as DatabaseConnection);
      } else if (getDatabaseHref) {
        const href = getDatabaseHref(item as DatabaseConnection);
        if (href) {
          navigate(href);
        }
      }
    }
  };

  return (
    <div
      className={`px-1 transition border ${
        selected
          ? "border-white/20 bg-white/10 hover:bg-white/10"
          : "border-white/0 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 cursor-pointer`}
        onClick={type === "db" ? handleClick : undefined}
      >
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-100">
        {type === "ssh" ? <HiOutlineFolderArrowDown className="h-4 w-4" /> : <HiOutlineDatabase className="h-4 w-4" />}
          </div>
          <p className="truncate text-xs font-medium text-white">{item.name}</p>
        </div>
      </div>
    </div>
  );
};

const ConnectionsBrowserPanel = ({
  title = "Browse Data Sources",
  description = "View and manage your existing data sources",
  connections,
  isLoading,
  error,
  query,
  onQueryChange,
  onRetry,
  onSelectDatabase,
  getDatabaseHref,
  selectedDatabaseId,
  className = "",
  type,
}: ConnectionsBrowserPanelProps) => {
  const filteredConnections = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return connections;
    }

    return {
      db: connections.db.filter((item) => item.name.toLowerCase().includes(value)),
      ssh: connections.ssh.filter((item) => item.name.toLowerCase().includes(value)),
    };
  }, [connections, query]);

  return (
    <div className={`${className}`}>
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div className="flex flex-col items-start gap-0 space-y-0 justify-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mb-4 mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
        <FaMagnifyingGlass className="text-slate-400" />
        <input
          type="text"
          placeholder="Search sources..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
        />
      </div>

      {error ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          <span>{error}</span>
          <button
            onClick={onRetry}
            className="ml-2 whitespace-nowrap rounded bg-rose-400/20 px-2 py-1 transition hover:bg-rose-400/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? <div className="mb-3 text-xs text-slate-400">Loading connections...</div> : null}

      {(!type || type === "ssh") && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wider text-slate-400">SSH</h4>
            <span className="text-xs text-slate-500">{filteredConnections.ssh.length}</span>
          </div>
          <div className="max-h-[28vh] min-h-16 space-y-1 overflow-y-auto pr-1 gap-0">
            {filteredConnections.ssh.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No matching sources.</div>
            ) : (
              filteredConnections.ssh.map((item) => <ConnectionRow key={`ssh-${item.ssh_id ?? item.name}`} type="ssh" item={item} />)
            )}
          </div>
        </>
      )}

      {(!type || type === "db") && (
        <>
          <div className={`mb-2 flex items-center justify-between ${!type ? "mt-4" : ""}`}>
            <h4 className="text-xs uppercase tracking-wider text-slate-400">Databases</h4>
            <span className="text-xs text-slate-500">{filteredConnections.db.length}</span>
          </div>
          <div className="max-h-[38vh] min-h-20 space-y-1 overflow-y-auto pr-1">
            {filteredConnections.db.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No matching sources.</div>
            ) : (
              filteredConnections.db.map((item) => (
                <ConnectionRow
                  key={`db-${item.db_id ?? item.name}`}
                  type="db"
                  item={item}
                  selected={selectedDatabaseId !== undefined && selectedDatabaseId === item.db_id}
                  onSelectDatabase={onSelectDatabase}
                  getDatabaseHref={getDatabaseHref}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ConnectionsBrowserPanel;
