import type { ColumnInfo } from "../../api/db";
import type { SelectedTable } from "./types";

type InsertPanelProps = {
  selectedTable: SelectedTable | null;
  structureColumns: ColumnInfo[];
  isLoading: boolean;
  error: string;
  formData: Record<string, string>;
  insertError: string;
  insertSuccess: boolean;
  isInserting: boolean;
  isEditMode: boolean;
  onChange: (columnName: string, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
};

const InsertPanel = ({
  selectedTable,
  structureColumns,
  isLoading,
  error,
  formData,
  insertError,
  insertSuccess,
  isInserting,
  isEditMode,
  onChange,
  onSubmit,
  onReset,
}: InsertPanelProps) => {
  return (
    <>
      <div className="mb-3">
        <p className="text-sm font-semibold">{isEditMode ? 'Edit Row' : 'Insert Row'}</p>
        <p className="text-xs text-slate-400 mt-1">
          {isEditMode ? 'Modify the record in' : 'Add a new record to'} {selectedTable ? `${selectedTable.schema}.${selectedTable.table}` : "the selected table"}
        </p>
      </div>
      <div className="h-full overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">Loading structure...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">{error}</div>
        ) : structureColumns.length > 0 ? (
          <>
            {insertSuccess && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                Row {isEditMode ? 'updated' : 'inserted'} successfully!
              </div>
            )}

            {insertError && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">{insertError}</div>
            )}

            <div className="space-y-4">
              {structureColumns
                .filter((col) => !col.extra?.includes("auto_increment") && !col.column_default?.includes("nextval"))
                .map((col) => {
                  const isRequired = col.is_nullable?.toLowerCase() === "no" && !col.column_default;
                  const dataType = col.data_type?.toLowerCase() || "";

                  let inputType = "text";
                  if (
                    dataType.includes("int") ||
                    dataType.includes("decimal") ||
                    dataType.includes("numeric") ||
                    dataType.includes("float") ||
                    dataType.includes("double")
                  ) {
                    inputType = "number";
                  } else if (dataType.includes("date") || dataType.includes("time")) {
                    inputType = dataType.includes("timestamp") ? "datetime-local" : "date";
                  } else if (dataType.includes("bool")) {
                    inputType = "checkbox";
                  }

                  return (
                    <div key={col.column_name} className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{col.column_name}</span>
                        <span className="text-xs text-slate-400">({col.data_type})</span>
                        {isRequired && <span className="text-red-400">*</span>}
                        {col.column_default && (
                          <span className="text-xs text-amber-400" title={`Default: ${col.column_default}`}>
                            [default]
                          </span>
                        )}
                      </label>

                      {inputType === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={formData[col.column_name] === "true" || formData[col.column_name] === "1"}
                          onChange={(e) => onChange(col.column_name, e.target.checked ? "true" : "false")}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                        />
                      ) : col.enum_values && Array.isArray(col.enum_values) && col.enum_values.length > 0 ? (
                        <select
                          value={formData[col.column_name] || ""}
                          onChange={(e) => onChange(col.column_name, e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          <option value="">-- Select {col.column_name} --</option>
                          {col.enum_values.map((enumValue) => (
                            <option key={enumValue} value={enumValue}>
                              {enumValue}
                            </option>
                          ))}
                        </select>
                      ) : dataType.includes("text") || (col.character_maximum_length && Number(col.character_maximum_length) > 100) ? (
                        <textarea
                          value={formData[col.column_name] || ""}
                          onChange={(e) => onChange(col.column_name, e.target.value)}
                          placeholder={col.column_default ? `Default: ${col.column_default}` : ""}
                          rows={3}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      ) : (
                        <input
                          type={inputType}
                          value={formData[col.column_name] || ""}
                          onChange={(e) => onChange(col.column_name, e.target.value)}
                          placeholder={col.column_default ? `Default: ${col.column_default}` : ""}
                          step={
                            dataType.includes("float") || dataType.includes("double") || dataType.includes("decimal")
                              ? "any"
                              : undefined
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={onSubmit}
                disabled={isInserting}
                className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInserting ? (isEditMode ? "Updating..." : "Inserting...") : (isEditMode ? "Update Row" : "Insert Row")}
              </button>
              <button
                onClick={onReset}
                disabled={isInserting}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">No columns found</div>
        )}
      </div>
    </>
  );
};

export default InsertPanel;
