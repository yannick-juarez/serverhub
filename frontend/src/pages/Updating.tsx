import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

function sanitizeReturnPath(raw: string | null): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}

export default function UpdatingPage() {
  const location = useLocation();
  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return sanitizeReturnPath(params.get("returnTo"));
  }, [location.search]);

  useEffect(() => {
    let disposed = false;

    const checkHealth = async () => {
      try {
        const response = await fetch("/health", {
          method: "GET",
          cache: "no-store",
        });

        if (!disposed && response.ok) {
          window.location.assign(returnTo);
        }
      } catch {
        // Service may be temporarily down while updating.
      }
    };

    void checkHealth();
    const healthTimer = window.setInterval(() => {
      void checkHealth();
    }, 5000);

    const reloadTimer = window.setInterval(() => {
      window.location.reload();
    }, 60000);

    return () => {
      disposed = true;
      window.clearInterval(healthTimer);
      window.clearInterval(reloadTimer);
    };
  }, [returnTo]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-lime-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/15 bg-black/40 p-6 text-center backdrop-blur-sm">
        <p className="text-xs uppercase tracking-widest text-slate-400">ServerHub</p>
        <h1 className="mt-2 text-2xl font-semibold">Mise a jour en cours</h1>
        <p className="mt-3 text-sm text-slate-300">
          Le service est en train d'executer le build. Cette page verifiera automatiquement le retour du serveur.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Redirection automatique vers la page demandee des que le service est disponible.
        </p>
        <p className="mt-5 text-xs text-slate-500">Rechargement automatique toutes les 60 secondes.</p>
      </div>
    </div>
  );
}
