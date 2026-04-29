export type SelectedTable = {
  schema: string;
  table: string;
};

export type LeftPanelTab = "requests" | "tables" | "sources";

export type SortDirection = "asc" | "desc";

export type ViewPanelContent = "structure" | "insert" | "search" | null;
