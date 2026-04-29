import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { apps } from "./apps/index";
import SettingsPage from "./core/settings/page";
import ApplicationsPage from "./core/applications/page";

function App() {
  const appRoutes = apps.flatMap((app) => {
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
      {appRoutes.map((appRoute) => (
        <Route key={appRoute.key} path={appRoute.path} element={appRoute.element} />
      ))}
    </Routes>
  );
}

export default App;