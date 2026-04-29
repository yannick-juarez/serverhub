import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { LuCheck, LuChevronsUpDown } from "react-icons/lu";
import { useState, useMemo } from "react";
import type { ColumnInfo } from "../../../api/db";
import type { SelectedTable } from "./types";

type SearchFilter = {
  operator: string;
  value: string;
};

type SearchPanelProps = {
  selectedTable: SelectedTable | null;
  structureColumns: ColumnInfo[];
  isLoading: boolean;
  error: string;
  filters: Record<string, SearchFilter>;
  searchError: string;
  isSearching: boolean;
  onFilterChange: (columnName: string, field: "operator" | "value", value: string) => void;
  onClearFilter: (columnName: string) => void;
  onSubmit: () => void;
  onClearAll: () => void;
};

type CompactOperatorSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

const DATA_TYPE_COLOR_RULES: Array<{ pattern: RegExp; className: string }> = [
  { pattern: /(smallint|integer|bigint|serial|int)/i, className: "text-sky-300" },
  { pattern: /(numeric|decimal|real|double|float|money)/i, className: "text-cyan-300" },
  { pattern: /(varchar|character varying|char|text|citext|uuid)/i, className: "text-amber-300" },
  { pattern: /(date|time|timestamp|interval)/i, className: "text-rose-300" },
  { pattern: /(bool|boolean)/i, className: "text-emerald-300" },
  { pattern: /(json|jsonb)/i, className: "text-orange-300" },
  { pattern: /(enum)/i, className: "text-lime-300" },
  { pattern: /(bytea|binary|blob)/i, className: "text-slate-300" },
];

const DATA_TYPE_FALLBACK_CLASS = "text-gray-400";

const getDataTypeColorClass = (dataType?: string): string => {
  if (!dataType) {
    return DATA_TYPE_FALLBACK_CLASS;
  }

  const match = DATA_TYPE_COLOR_RULES.find(({ pattern }) => pattern.test(dataType));
  return match?.className ?? DATA_TYPE_FALLBACK_CLASS;
};

const CompactOperatorSelect = ({ value, options, onChange }: CompactOperatorSelectProps) => {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton className="flex w-auto min-w-14 items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white transition focus:outline-none focus:ring-1 focus:ring-gray-500 data-[open]:border-gray-400/50">
          <span className="truncate pr-2">{value}</span>
          <LuChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
        </ListboxButton>

        <ListboxOptions className="absolute left-0 top-full z-20 mt-1 max-h-96 min-w-full overflow-auto rounded-md border border-white/10 bg-black/80 p-1 shadow-xl backdrop-blur-md focus:outline-none">
          {options.map((option) => (
            <ListboxOption
              key={option}
              value={option}
              className={({ focus }) =>
                `flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs text-white ${
                  focus ? "bg-white/10" : ""
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span className="truncate">{option}</span>
                  {selected ? <LuCheck className="h-4 w-4 text-cyan-300" /> : null}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
};

const SearchPanel = ({
  selectedTable,
  structureColumns,
  isLoading,
  error,
  filters,
  searchError,
  isSearching,
  onFilterChange,
  onClearFilter,
  onSubmit,
  onClearAll,
}: SearchPanelProps) => {
  const [columnFilter, setColumnFilter] = useState("");

  const filteredColumns = useMemo(() => {
    if (!columnFilter.trim()) {
      return structureColumns;
    }
    const query = columnFilter.toLowerCase().trim();
    return structureColumns.filter((col) =>
      col.column_name.toLowerCase().includes(query)
    );
  }, [structureColumns, columnFilter]);

  return (
    <>
      <div className="mb-3">
        <p className="text-lg font-semibold">Search & Filter</p>
        <p className="text-sm text-slate-400">
          Build WHERE conditions for {selectedTable ? `${selectedTable.schema}.${selectedTable.table}` : "the selected table"}
        </p>
      </div>
      
      {structureColumns.length > 0 && (
        <div className="mb-2 border-b border-white/10 pb-3">
          <input
            type="text"
            placeholder="Filter columns..."
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      )}

      <div className="h-full overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">Loading structure...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">{error}</div>
        ) : structureColumns.length > 0 ? (
          <>
            {searchError && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">{searchError}</div>
            )}

            {filteredColumns.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">
                No columns match &quot;{columnFilter}&quot;
              </div>
            ) : (
              <div className="space-y-1">
              {filteredColumns.map((col) => {
                const filter = filters[col.column_name] || { operator: "=", value: "" };
                const dataType = col.data_type?.toLowerCase() || "";
                const dataTypeColorClass = getDataTypeColorClass(col.data_type);
                const hasFilterValue = Boolean(filter.value);

                let operators = ["=", "!=", "<", ">", "<=", ">=", "LIKE", "IS NULL", "IS NOT NULL"];
                if (col.enum_values && Array.isArray(col.enum_values) && col.enum_values.length > 0) {
                  operators = ["=", "!=", "IS NULL", "IS NOT NULL"];
                } else if (dataType.includes("char") || dataType.includes("text")) {
                  operators = ["=", "!=", "LIKE", "IS NULL", "IS NOT NULL"];
                } else if (dataType.includes("bool")) {
                  operators = ["=", "!=", "IS NULL", "IS NOT NULL"];
                }

                const needsValue = !filter.operator.includes("NULL");

                return (
                  <div key={col.column_name} className="rounded-md bg-white/[0.03] px-3 py-1">
                    <div
                      className={`grid grid-cols-1 gap-2 md:items-center ${
                        hasFilterValue
                          ? "md:grid-cols-[minmax(0,170px)_auto_minmax(0,1fr)_36px]"
                          : "md:grid-cols-[minmax(0,170px)_auto_minmax(0,1fr)]"
                      }`}
                    >
                      <label className="min-w-0 flex flex-row items-center justify-start gap-1">
                        <span className="block truncate text-sm font-medium text-white">{col.column_name}</span>
                        <span className={`block italic ${dataTypeColorClass} opacity-70`}>{col.data_type}</span>
                      </label>

                      <CompactOperatorSelect
                        value={filter.operator}
                        options={operators}
                        onChange={(value) => onFilterChange(col.column_name, "operator", value)}
                      />

                      {needsValue &&
                        (col.enum_values && Array.isArray(col.enum_values) && col.enum_values.length > 0 ? (
                          <select
                            value={filter.value}
                            onChange={(e) => onFilterChange(col.column_name, "value", e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="">-- Select --</option>
                            {col.enum_values.map((enumValue) => (
                              <option key={enumValue} value={enumValue}>
                                {enumValue}
                              </option>
                            ))}
                          </select>
                        ) : dataType.includes("bool") ? (
                          <select
                            value={filter.value}
                            onChange={(e) => onFilterChange(col.column_name, "value", e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="">-- Select --</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type={dataType.includes("int") || dataType.includes("decimal") || dataType.includes("numeric") ? "number" : "text"}
                            value={filter.value}
                            onChange={(e) => onFilterChange(col.column_name, "value", e.target.value)}
                            placeholder={filter.operator === "LIKE" ? "Search pattern..." : "Value..."}
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        ))}

                      {hasFilterValue && (
                        <button
                          onClick={() => onClearFilter(col.column_name)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-sm text-white transition hover:bg-white/10"
                          title="Clear filter"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={onSubmit}
                disabled={
                  isSearching ||
                  Object.values(filters).every((filter) => !filter.value.trim() && !filter.operator.includes("NULL"))
                }
                className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
              <button
                onClick={onClearAll}
                disabled={isSearching}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
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

export default SearchPanel;
