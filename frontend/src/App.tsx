import { Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { apps } from "./apps/index";
import SettingsPage from "./core/settings/page";
import ApplicationsPage from "./core/applications/page";
import UpdatingPage from "./pages/Updating";
import { getPreferences, type PreferencesResponse } from "./api/settings";
import { getAppEnabledMap, isAppEnabled } from "./core/applications/preferences";

function App() {
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      try {
        const data = await getPreferences();
        if (!cancelled) {
          setPreferences(data);
        }
      } catch {
        if (!cancelled) {
          setPreferences(null);
        }
      }
    };

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledMap = useMemo(() => getAppEnabledMap(preferences), [preferences]);

  const appRoutes = apps.flatMap((app) => {
    if (!isAppEnabled(app.id, enabledMap)) {
      return [];
    }

    const AppPage = app.page;
    const routes = app.routes?.length ? app.routes : [app.to];

    return routes.map((path) => ({
      key: `${app.id}:${path}`,
      path,
      element: app.requiresAuth === false ? (
        <Suspense fallback={<div className="h-full w-full p-6 text-sm text-white/70">Loading app...</div>}>
          <AppPage />
        </Suspense>
      ) : (
        <ProtectedRoute>
          <Suspense fallback={<div className="h-full w-full p-6 text-sm text-white/70">Loading app...</div>}>
            <AppPage />
          </Suspense>
        </ProtectedRoute>
      ),
    }));
  });

  return (
    <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/settings" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <ApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apps"
          element={
            <ProtectedRoute>
              <ApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/:section"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/updating" element={<UpdatingPage />} />
        {appRoutes.map((appRoute) => (
          <Route key={appRoute.key} path={appRoute.path} element={appRoute.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;