import { LuTable } from "react-icons/lu";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { Scrollbar } from "smooth-scrollbar-react";
import { ExplorerSchema } from "../../api/db";
import { SelectedTable } from "./types";
import CollapsibleSection from "../../ui/CollapsibleSection";

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
            <h3 className="text-lg font-semibold text-white">Tables</h3>
            <p className="text-sm text-slate-400">Browse schemas and tables</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
          <FaMagnifyingGlass className="text-slate-400" />
          <input
            type="text"
            placeholder="Filter schemas and tables..."
            value={schemaFilter}
            onChange={(e) => onSchemaFilterChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      <div className={`px-4 py-1 mt-2 flex items-center justify-between`}>
          <h4 className="text-xs uppercase tracking-wider text-slate-400">Schemas</h4>
          <span className="text-xs text-slate-500">{filteredSchemas.length}</span>
      </div>
      <Scrollbar className="flex-1 space-y-2 overflow-y-auto px-2">
        {isLoadingExplorer ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">Loading explorer...</div>
        ) : null}
        {explorerError ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{explorerError}</div>
        ) : null}

        {filteredSchemas.map((schema) => (
          <CollapsibleSection
            key={schema.name}
            title={
              <div className="flex w-full items-center justify-between">
                <span>{schema.name}</span>
                <span className="text-xs text-slate-400">{schema.tables.length} tables</span>
              </div>
            }
            bodyClassName="space-y-0 pb-2"
            defaultOpen={schema.tables.length > 0}
            className="bg-gray-400/5"
          >
            {schema.tables.map((table) => {
              const isSelected = selectedTable?.schema === schema.name && selectedTable?.table === table.name;

              return (
                <button
                  key={`${schema.name}-${table.name}`}
                  onClick={() => onSelectTable(schema.name, table.name)}
                  className={`flex w-full items-center justify-between text-left text-xs border transition py-1 px-2 ${
                    isSelected
                      ? "border-white/5 bg-white/5  text-white"
                      : "border-transparent bg-black/10 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LuTable className="text-sm opacity-50" />
                    {table.name}
                  </span>
                </button>
              );
            })}
          </CollapsibleSection>
        ))}

        {!isLoadingExplorer && !explorerError && explorerSchemas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No schemas or tables found.</div>
        ) : null}
        {!isLoadingExplorer && !explorerError && explorerSchemas.length > 0 && filteredSchemas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">No matches found for &quot;{schemaFilter}&quot;</div>
        ) : null}
      </Scrollbar>
    </aside>
  );
};

export default TablesPanel;
