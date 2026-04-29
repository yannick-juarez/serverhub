import ConnectionsBrowserPanel from "../ConnectionsBrowserPanel";
import type { ConnectionsResponse, DatabaseConnection } from "../../api/connections";

type SourcesPanelProps = {
  connections: ConnectionsResponse;
  isLoading: boolean;
  error: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  selectedDatabaseId?: string | null;
  getDatabaseHref: (connection: DatabaseConnection) => string | null;
  type?: "db" | "ssh";
};

const SourcesPanel = ({
  connections,
  isLoading,
  error,
  query,
  onQueryChange,
  onRetry,
  selectedDatabaseId,
  getDatabaseHref,
  type,
}: SourcesPanelProps) => {
  return (
    <ConnectionsBrowserPanel
      className="h-full"
      title="Source Browser"
      description="Switch database connection"
      connections={connections}
      isLoading={isLoading}
      error={error}
      query={query}
      onQueryChange={onQueryChange}
      onRetry={onRetry}
      getDatabaseHref={getDatabaseHref}
      selectedDatabaseId={selectedDatabaseId}
      type={type}
    />
  );
};

export default SourcesPanel;
