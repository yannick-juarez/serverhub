import { HiOutlineDatabase } from "react-icons/hi";
import type { ConnectionsResponse, DatabaseConnection } from "../../../api/connections";
import type { LeftPanelTab } from "./types";
import SourcesPanel from "./SourcesPanel";

type DatabaseEmptyStateProps = {
  leftPanelTab: LeftPanelTab;
  connections: ConnectionsResponse;
  isLoadingConnections: boolean;
  connectionsError: string;
  existingQuery: string;
  onExistingQueryChange: (value: string) => void;
  onRetryConnections: () => void;
  getDatabaseHref: (connection: DatabaseConnection) => string | null;
};

const DatabaseEmptyState = ({
  leftPanelTab,
  connections,
  isLoadingConnections,
  connectionsError,
  existingQuery,
  onExistingQueryChange,
  onRetryConnections,
  getDatabaseHref,
}: DatabaseEmptyStateProps) => {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div
        className="flex flex-1 items-center justify-center px-6"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        <div className="max-w-xl rounded-xl border border-white/10 bg-black/30 p-6 text-center">
          <HiOutlineDatabase className="mx-auto text-3xl text-white" />
          <h2 className="mt-3 text-lg font-semibold">Select a database source</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use the source browser on the left to choose an existing database connection. Your last selected source is
            persisted locally.
          </p>
        </div>
      </div>
      {leftPanelTab === "sources" ? (
        <aside className="w-full max-w-sm border-r border-white/10 bg-black/30 p-3 backdrop-blur-md">
          <SourcesPanel
            connections={connections}
            isLoading={isLoadingConnections}
            error={connectionsError}
            query={existingQuery}
            onQueryChange={onExistingQueryChange}
            onRetry={onRetryConnections}
            getDatabaseHref={getDatabaseHref}
            type="db"
          />
        </aside>
      ) : null}
    </div>
  );
};

export default DatabaseEmptyState;
