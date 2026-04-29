import { useState } from "react";
import { HiOutlineArrowPath, HiOutlineCloudArrowDown } from "react-icons/hi2";
import {
  checkPlatformUpdates,
  installPlatformUpdate,
  type UpdateCheckResponse,
  type UpdateInstallResponse,
} from "../../../api/settings";
import type { SettingsSectionDefinition } from "../types";

function formatDate(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const UpdatesSettingsSection = () => {
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkData, setCheckData] = useState<UpdateCheckResponse | null>(null);
  const [installData, setInstallData] = useState<UpdateInstallResponse | null>(null);

  const handleCheck = async () => {
    try {
      setChecking(true);
      setError(null);
      setInstallData(null);
      const data = await checkPlatformUpdates();
      setCheckData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check updates");
    } finally {
      setChecking(false);
    }
  };

  const handleInstall = async () => {
    try {
      setInstalling(true);
      setError(null);
      const data = await installPlatformUpdate();
      setInstallData(data);
      const refreshed = await checkPlatformUpdates();
      setCheckData(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to install update");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold">Platform Updates</h2>
      <p className="mt-1 text-xs text-slate-400">
        Checks GitHub tags against your current backend version and installs updates with a safe fast-forward pull.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 disabled:opacity-60"
          onClick={() => {
            void handleCheck();
          }}
          disabled={checking || installing}
        >
          <HiOutlineArrowPath className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check updates"}
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
          onClick={() => {
            void handleInstall();
          }}
          disabled={installing || checking || !checkData?.hasUpdate}
        >
          <HiOutlineCloudArrowDown className="h-4 w-4" />
          {installing ? "Installing..." : "Install update"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {checkData ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Current version</p>
              <p className="mt-1 text-sm font-semibold text-white">{checkData.currentVersion}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Latest version</p>
              <p className="mt-1 text-sm font-semibold text-white">{checkData.latestVersion}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Repository</p>
              <p className="mt-1 text-sm text-slate-200">
                {checkData.repository.owner}/{checkData.repository.repo} ({checkData.repository.source})
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Published</p>
              <p className="mt-1 text-sm text-slate-200">{formatDate(checkData.publishedAt)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            {checkData.hasUpdate ? (
              <p className="text-emerald-300">
                Update available: {checkData.currentVersion} -&gt; {checkData.latestVersion}
              </p>
            ) : (
              <p className="text-slate-200">You are up to date.</p>
            )}
            <a
              className="mt-2 inline-block text-xs text-cyan-300 underline"
              href={checkData.releaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              View release: {checkData.releaseName}
            </a>
          </div>
        </div>
      ) : null}

      {installData ? (
        <div className="mt-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p>
            Installation result: {installData.previousVersion} -&gt; {installData.currentVersion} ({installData.updated ? "updated" : "no change"})
          </p>
          <p className="mt-1 text-xs text-emerald-100/80">
            Branch: {installData.branch} | restart required: {installData.restartRequired ? "yes" : "no"}
          </p>
        </div>
      ) : null}
    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "updates",
  label: "Updates",
  description: "Check and install platform updates",
  component: UpdatesSettingsSection,
  icon: HiOutlineArrowPath,
  color: {
    border: "border-emerald-500/70",
    background: "bg-emerald-500/40",
    hover: { border: "hover:border-emerald-400/30", background: "hover:bg-emerald-400/30" },
    idle: { border: "border-emerald-500/20", background: "bg-emerald-500/10" },
  },
  order: 11,
};
