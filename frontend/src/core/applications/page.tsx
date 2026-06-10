import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineSparkles, HiOutlineSquares2X2, HiOutlineWrenchScrewdriver } from "react-icons/hi2";
import { apps } from "../../apps";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import { getPreferences, type PreferencesResponse } from "../../api/settings";
import { getAppEnabledMap, getAppVisibilityMap, isAppEnabled, isAppVisible } from "./preferences";

type MarketplaceEntry = {
  id: string;
  name: string;
  type: "Application" | "Plugin";
  description: string;
  badge: string;
};

const marketplaceEntries: MarketplaceEntry[] = [
  {
    id: "plugin-monitor-plus",
    name: "Monitor Plus",
    type: "Plugin",
    description: "Advanced health probes and service-level anomaly alerts.",
    badge: "Observability",
  },
  {
    id: "app-workflow-studio",
    name: "Workflow Studio",
    type: "Application",
    description: "Visual designer for automations, triggers, and scheduled pipelines.",
    badge: "Automation",
  },
  {
    id: "plugin-secrets-vault",
    name: "Secrets Vault Connector",
    type: "Plugin",
    description: "Connect external secret providers and rotate credentials from one panel.",
    badge: "Security",
  },
  {
    id: "app-usage-insights",
    name: "Usage Insights",
    type: "Application",
    description: "Team-level usage trends, retention reports, and workspace heatmaps.",
    badge: "Analytics",
  },
];

export default function ApplicationsPage() {
  useDocumentTitle("APPLICATIONS - SERVERHUB");

  const [activeTab, setActiveTab] = useState<"launchpad" | "marketplace">("launchpad");
  const [installedPlugins, setInstalledPlugins] = useState<Record<string, boolean>>({});
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

  const launchpadApps = useMemo(() => {
    const visibilityMap = getAppVisibilityMap(preferences);
    const enabledMap = getAppEnabledMap(preferences);

    return apps
      .filter((item) => !item.isInternal)
      .filter((item) => isAppVisible(item.id, visibilityMap) && isAppEnabled(item.id, enabledMap))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [preferences]);

  const installPlugin = (pluginId: string) => {
    setInstalledPlugins((previous) => ({ ...previous, [pluginId]: true }));
  };

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col p-5 lg:p-8">
        <header className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5">
          <p className="text-xs uppercase tracking-[0.25em] text-white/60">Core</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Applications Hub</h1>
              <p className="mt-1 text-sm text-white/70">Launch your installed tools or discover new apps and plugins.</p>
            </div>
            <div className="inline-flex rounded-xl border border-white/15 bg-white/5 p-1 text-sm">
              <button
                className={`rounded-lg px-3 py-2 transition ${
                  activeTab === "launchpad" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                }`}
                onClick={() => setActiveTab("launchpad")}
              >
                Launchpad
              </button>
              <button
                className={`rounded-lg px-3 py-2 transition ${
                  activeTab === "marketplace" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                }`}
                onClick={() => setActiveTab("marketplace")}
              >
                Marketplace
              </button>
            </div>
          </div>
        </header>

        {activeTab === "launchpad" ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {launchpadApps.map((entry) => (
              <Link
                key={entry.id}
                to={entry.to}
                className="group rounded-xl border border-white/10 bg-black/40 p-4 transition hover:border-white/30 hover:bg-white/5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                    {entry.icon}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-white/50">Installed</span>
                </div>
                <h2 className="text-lg font-medium text-white group-hover:text-emerald-200">{entry.label}</h2>
                <p className="mt-2 text-sm text-white/60">Open {entry.label} and continue where you left off.</p>
              </Link>
            ))}
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {marketplaceEntries.map((entry) => {
              const isInstalled = Boolean(installedPlugins[entry.id]);
              const Icon = entry.type === "Plugin" ? HiOutlineWrenchScrewdriver : HiOutlineSquares2X2;

              return (
                <article key={entry.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80">
                      <Icon className="h-4 w-4" />
                      {entry.type}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-emerald-300">{entry.badge}</span>
                  </div>
                  <h2 className="text-lg font-medium">{entry.name}</h2>
                  <p className="mt-2 text-sm text-white/60">{entry.description}</p>
                  <button
                    className={`mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      isInstalled
                        ? "cursor-default border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                    }`}
                    disabled={isInstalled}
                    onClick={() => installPlugin(entry.id)}
                  >
                    <HiOutlineSparkles className="h-4 w-4" />
                    {isInstalled ? "Installed" : "Install"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}