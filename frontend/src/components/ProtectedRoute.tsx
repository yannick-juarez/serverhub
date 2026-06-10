import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";

import { ReactNode, useEffect, useMemo, useState } from "react";

import Header from "./Header";
import SideDock from "./SideDock";
import Footer from "./Footer";

import { getStoredWorkspaceSettings, WORKSPACE_SETTINGS_UPDATED_EVENT, type WorkspaceSettings } from "../data/workspaces";

const ProtectedRoute = ({ children, opaque = true }: { children: ReactNode, opaque?: boolean }) => {
  opaque = opaque ?? true;

  const token = Cookies.get("token");

  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => getStoredWorkspaceSettings());

  useEffect(() => {
    const sync = () => setWorkspaceSettings(getStoredWorkspaceSettings());
    window.addEventListener(WORKSPACE_SETTINGS_UPDATED_EVENT, sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WORKSPACE_SETTINGS_UPDATED_EVENT, sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const selectedWorkspace = useMemo(
    () =>
      workspaceSettings.workspaces.find((ws) => ws.id === localStorage.getItem("selectedWorkspaceId")) ||
      workspaceSettings.workspaces[0],
    [workspaceSettings],
  );
  const selectedBanner = useMemo(
    () => workspaceSettings.banners.find((banner) => banner.id === selectedWorkspace?.bannerId) ?? null,
    [workspaceSettings.banners, selectedWorkspace?.bannerId],
  );

  const isFooterVisible = false;

  if (!token) {
    return <Navigate to="/login" />;
  }

  return <div className="h-screen w-screen">
    <div className="flex flex-col gap-0 h-full w-screen">
      { selectedBanner &&
        <div className={`w-full ${selectedBanner.background} z-50 text-xs text-center fixed ${selectedBanner.foreground}`}>
            {selectedBanner.label}
        </div>
      }
      <div className="flex flex-row w-full">
        <SideDock className={selectedBanner ? "mt-4 h-[calc(100vh-1rem)]" : "h-screen"} />
        <div className={`overflow-y-auto flex flex-col w-full ${selectedBanner ? "pt-4" : ""}`}>
          <Header opaque={opaque} />
          <div className={`${selectedBanner 
            ? isFooterVisible ? 'h-[calc(100vh-70px)]' : 'h-[calc(100vh-52px)]'
            : isFooterVisible ? 'h-[calc(100vh-52px)]' : 'h-screen'
            } overflow-y-auto`}>
            {children}
          </div>
          {isFooterVisible && <Footer />}
        </div>
      </div>
    </div>
  </div>;
}

export default ProtectedRoute;