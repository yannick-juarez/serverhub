import { useEffect, useMemo, useState } from "react";
import { HiOutlineCog8Tooth } from "react-icons/hi2";
import { TbArrowsExchange } from "react-icons/tb";
import {
  applySystemDomains,
  getSystemSettings,
  patchSystemSettings,
  runSystemBuild,
  type SystemApplyDomainsResponse,
  type SystemSettingsResponse,
} from "../../../api/settings";
import type { SettingsSectionDefinition } from "../types";

const BUILD_RELOAD_SECONDS = 30;

function parseDomains(raw: string): string[] {
  return [...new Set(raw
    .split(/[,\n\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

const SystemSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningBuild, setRunningBuild] = useState(false);
  const [applyingDomains, setApplyingDomains] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState<SystemSettingsResponse | null>(null);
  const [domainResult, setDomainResult] = useState<SystemApplyDomainsResponse | null>(null);

  const [domainsInput, setDomainsInput] = useState("");
  const [email, setEmail] = useState("");
  const [appPort, setAppPort] = useState("8080");
  const [requestCertificate, setRequestCertificate] = useState(true);
  const [autoInstallPackages, setAutoInstallPackages] = useState(false);

  const domainList = useMemo(() => parseDomains(domainsInput), [domainsInput]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemSettings();
      setSettings(data);
      setDomainsInput(data.domains.preferred.join("\n"));
      setEmail(data.domains.email || "");
      setAppPort(String(data.domains.appPort || 8080));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load system settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!runningBuild) {
      setBuildProgress(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const nextProgress = Math.min(100, Math.round((elapsed / BUILD_RELOAD_SECONDS) * 100));
      setBuildProgress(nextProgress);

      if (elapsed >= BUILD_RELOAD_SECONDS) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 200);

    return () => {
      window.clearInterval(timer);
    };
  }, [runningBuild]);

  const normalizedPort = Number.parseInt(appPort, 10);
  const hasValidPort = Number.isFinite(normalizedPort) && normalizedPort > 0 && normalizedPort <= 65535;

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      setDomainResult(null);

      const updated = await patchSystemSettings({
        domains: domainList,
        email,
        appPort: hasValidPort ? normalizedPort : undefined,
      });

      setSettings(updated);
      setSuccess("System preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save system preferences");
    } finally {
      setSaving(false);
    }
  };

  const executeBuild = async () => {
    if (!hasValidPort) {
      setError("App port must be between 1 and 65535.");
      return;
    }

    try {
      setRunningBuild(true);
      setError(null);
      setSuccess(null);
      setDomainResult(null);

      await runSystemBuild();
      setSuccess("Build started. Reload will happen automatically in 30 seconds.");
    } catch (err) {
      setRunningBuild(false);
      setError(err instanceof Error ? err.message : "Unable to run build.sh");
    }
  };

  const executeApplyDomains = async () => {
    if (!domainList.length) {
      setError("At least one domain is required.");
      return;
    }

    if (!hasValidPort) {
      setError("App port must be between 1 and 65535.");
      return;
    }

    try {
      setApplyingDomains(true);
      setError(null);
      setSuccess(null);

      const result = await applySystemDomains({
        domains: domainList,
        email,
        appPort: normalizedPort,
        requestCertificate,
        autoInstallPackages,
      });

      setDomainResult(result);
      setSuccess("Nginx domains applied.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply domain configuration");
    } finally {
      setApplyingDomains(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading system settings...</div>;
  }

  return (
    <>
      <h2 className="text-lg font-semibold">System</h2>
      <p className="mt-1 text-xs text-slate-400">
        Launch build workflow and manage multi-domain nginx configuration for this hub.
      </p>

      {settings ? (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Workspace root</p>
            <p className="mt-1 break-all text-sm text-slate-200">{settings.workspaceRoot}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Configured domains (nginx)</p>
            <p className="mt-1 text-sm text-slate-200">{settings.domains.configured.join(", ") || "none"}</p>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {success ? <div className="mt-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm font-semibold text-slate-100">Domain settings</p>
        <p className="mt-1 text-xs text-slate-400">Enter one domain per line or comma-separated values.</p>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <textarea
            className="min-h-28 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
            value={domainsInput}
            onChange={(event) => setDomainsInput(event.target.value)}
            placeholder="admin.example.com\nhub.example.com"
          />

          <div className="space-y-3">
            <input
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Let's Encrypt email (optional)"
            />
            <input
              type="number"
              min={1}
              max={65535}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={appPort}
              onChange={(event) => setAppPort(event.target.value)}
              placeholder="App port"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={requestCertificate}
                onChange={(event) => setRequestCertificate(event.target.checked)}
              />
              Request/refresh HTTPS certificate with certbot
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoInstallPackages}
                onChange={(event) => setAutoInstallPackages(event.target.checked)}
              />
              Auto-install nginx/certbot if missing (apt-get)
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 disabled:opacity-60"
            disabled={saving || runningBuild || applyingDomains || !hasValidPort}
            onClick={() => {
              void savePreferences();
            }}
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>

          <button
            className="rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
            disabled={saving || runningBuild || applyingDomains || !domainList.length || !hasValidPort}
            onClick={() => {
              void executeApplyDomains();
            }}
          >
            {applyingDomains ? "Applying..." : "Apply nginx domains"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm font-semibold text-slate-100">Maintenance scripts</p>
        <p className="mt-1 text-xs text-slate-400">Runs script at workspace root: ./build.sh.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 disabled:opacity-60"
            disabled={saving || runningBuild || applyingDomains}
            onClick={() => {
              void executeBuild();
            }}
          >
            <TbArrowsExchange className="h-4 w-4" />
            {runningBuild ? "Running build..." : "Run ./build.sh"}
          </button>
        </div>

        {runningBuild ? (
          <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs text-slate-200">
              <span>Build in progress...</span>
              <span>{Math.min(100, buildProgress)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-white/60 to-white transition-all duration-200"
                style={{ width: `${Math.min(100, buildProgress)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              The page will reload automatically in about {Math.max(0, BUILD_RELOAD_SECONDS - Math.floor((buildProgress / 100) * BUILD_RELOAD_SECONDS))}s.
            </p>
          </div>
        ) : null}
      </div>

      {domainResult ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
          <p className="font-semibold">Domain apply result</p>
          <p className="mt-1">Domains: {domainResult.domains.join(", ")}</p>
          <p className="mt-1">Site file: {domainResult.siteFile}</p>
          <p className="mt-1">
            Certificate: {domainResult.certificate.attempted ? (domainResult.certificate.success ? "success" : "failed") : "not requested"}
          </p>
        </div>
      ) : null}

    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "system",
  label: "System",
  description: "Build/install scripts and nginx multi-domain setup",
  component: SystemSettingsSection,
  icon: HiOutlineCog8Tooth,
  color: {
    border: "border-cyan-500/70",
    background: "bg-cyan-500/40",
    hover: { border: "hover:border-cyan-400/30", background: "hover:bg-cyan-400/30" },
    idle: { border: "border-cyan-500/20", background: "bg-cyan-500/10" },
  },
  order: 12,
};
