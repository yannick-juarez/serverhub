import type { ColumnInfo } from "../../../api/db";
import type { SelectedTable } from "./types";

type StructurePanelProps = {
  selectedTable: SelectedTable | null;
  structureColumns: ColumnInfo[];
  isLoading: boolean;
  error: string;
};

const StructurePanel = ({ selectedTable, structureColumns, isLoading, error }: StructurePanelProps) => {
  return (
    <>
      <div className="mb-3">
        <p className="text-sm font-semibold">Table Structure</p>
        <p className="text-xs text-slate-400 mt-1">
          {selectedTable ? `${selectedTable.schema}.${selectedTable.table}` : "No table selected"}
        </p>
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div>
      ) : null}
      <div className="h-full overflow-y-auto">
        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">
            Loading structure...
          </div>
        ) : structureColumns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 text-left font-semibold">Column</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Nullable</th>
                  <th className="px-3 py-2 text-left font-semibold">Default</th>
                  <th className="px-3 py-2 text-left font-semibold">Key</th>
                  <th className="px-3 py-2 text-left font-semibold">Extra</th>
                </tr>
              </thead>
              <tbody>
                {structureColumns.map((col, index) => (
                  <tr key={col.column_name} className={`border-b border-white/5 ${index % 2 === 0 ? "bg-black/20" : "bg-black/10"}`}>
                    <td className="px-3 py-2 font-mono text-cyan-300">{col.column_name}</td>
                    <td className="px-3 py-2 font-mono text-violet-300">
                      <div>
                        {col.data_type}
                        {col.character_maximum_length ? `(${col.character_maximum_length})` : ""}
                        {col.numeric_precision !== null && col.numeric_scale !== null ? `(${col.numeric_precision},${col.numeric_scale})` : ""}
                      </div>
                      {col.enum_values && Array.isArray(col.enum_values) && col.enum_values.length > 0 && (
                        <div className="mt-1 text-[10px] text-emerald-300">
                          [{col.enum_values.join(", ")}]
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] ${col.is_nullable === "YES" ? "bg-amber-500/20 text-amber-200" : "bg-slate-500/20 text-slate-300"}`}>
                        {col.is_nullable === "YES" ? "NULL" : "NOT NULL"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      {col.column_default || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {col.column_key ? (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            col.column_key === "PRI"
                              ? "bg-rose-500/20 text-rose-200"
                              : col.column_key === "UNI"
                              ? "bg-blue-500/20 text-blue-200"
                              : col.column_key === "MUL"
                              ? "bg-purple-500/20 text-purple-200"
                              : "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {col.column_key}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{col.extra || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">No columns found</div>
        )}
      </div>
    </>
  );
};

export default StructurePanel;
