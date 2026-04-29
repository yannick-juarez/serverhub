import { LuTable } from "react-icons/lu";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { Scrollbar } from "smooth-scrollbar-react";
import { ExplorerSchema } from "../../../api/db";
import { SelectedTable } from "./types";

type TablesPanelProps = {
  schemaFilter: string;
  explorerSchemas: ExplorerSchema[];
  filteredSchemas: ExplorerSchema[];
  isLoadingExplorer: boolean;
  explorerError: string;
  selectedTable: SelectedTable | null;
  onSchemaFilterChange: (value: string) => void;
  onSelectTable: (schema: string, table: string) => void;
};

const TablesPanel = ({
  schemaFilter,
  explorerSchemas,
  filteredSchemas,
  isLoadingExplorer,
  explorerError,
  selectedTable,
  onSchemaFilterChange,
  onSelectTable,
}: TablesPanelProps) => {
  return (
    <aside className="flex w-full max-w-xs flex-col overflow-hidden border-r border-white/10 bg-black/30">
      <div className="px-3 pt-3">
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Databases</h3>
            <p className="text-sm text-slate-400">phpMyAdmin-style tree</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
          <FaMagnifyingGlass className="text-slate-400" />
          <input
            type="text"
            placeholder="Filter databases and tables..."
            value={schemaFilter}
            onChange={(e) => onSchemaFilterChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      <div className={`px-4 py-1 mt-2 flex items-center justify-between`}>
          <h4 className="text-xs uppercase tracking-wider text-slate-400">Databases</h4>
          <span className="text-xs text-slate-500">{filteredSchemas.length}</span>
      </div>
      <Scrollbar className="flex-1 space-y-2 overflow-y-auto px-2">
        {isLoadingExplorer ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">Loading explorer...</div>
        ) : null}
        {explorerError ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{explorerError}</div>
        ) : null}

        {filteredSchemas.map((database) => (
          <div key={database.name} className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
            <div className="flex w-full items-center justify-between px-1 py-1">
              <span className="text-sm font-semibold text-white">{database.name}</span>
              <span className="text-[11px] text-slate-400">{database.tables.length} tables</span>
            </div>

            <div className="mt-1 rounded-md border border-white/10 bg-black/30 px-2 py-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">- tables</p>

              <div className="mt-1 space-y-1 pl-2">
                {database.tables.length === 0 ? (
                  <p className="text-[11px] text-slate-500">-- no tables</p>
                ) : (
                  database.tables.map((table) => {
                    const isSelected = selectedTable?.schema === database.name && selectedTable?.table === table.name;

                    return (
                      <button
                        key={`${database.name}-${table.name}`}
                        onClick={() => onSelectTable(database.name, table.name)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
                          isSelected
                            ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100"
                            : "border-transparent bg-black/10 text-slate-200 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-slate-500">--</span>
                        <LuTable className="text-sm opacity-60" />
                        <span className="truncate">{table.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ))}

        {!isLoadingExplorer && !explorerError && explorerSchemas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No databases or tables found.</div>
        ) : null}
        {!isLoadingExplorer && !explorerError && explorerSchemas.length > 0 && filteredSchemas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No matches found for &quot;{schemaFilter}&quot;</div>
        ) : null}
      </Scrollbar>
    </aside>
  );
};

export default TablesPanel;
