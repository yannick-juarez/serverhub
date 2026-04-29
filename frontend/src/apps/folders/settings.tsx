import { useEffect, useState } from "react";
import { getPreferences, patchPreferences } from "../../api/settings";
import { app } from "./app";
import type { SettingsSectionDefinition } from "../../core/settings/types";

const FileBrowserSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesRoot, setFilesRoot] = useState("");
  const [savingRoot, setSavingRoot] = useState(false);
  const [rootMessage, setRootMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const prefs = await getPreferences();
        setFilesRoot(typeof prefs.filesRoot === "string" ? prefs.filesRoot : "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load preferences");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const saveFilesRoot = async () => {
    try {
      setSavingRoot(true);
      setRootMessage(null);
      const payloadRoot = filesRoot.trim() || "/";
      const data = await patchPreferences({ filesRoot: payloadRoot });
      setFilesRoot(typeof data.filesRoot === "string" ? data.filesRoot : payloadRoot);
      setRootMessage("Default File Browser folder updated.");
    } catch (err) {
      setRootMessage(err instanceof Error ? err.message : "Unable to save folder");
    } finally {
      setSavingRoot(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading file browser settings...</div>;
  }

  return (
    <>
      <h2 className="text-lg font-semibold">File Browser</h2>
      <p className="mt-1 text-xs text-slate-400">
        Define the default root folder used by the File Browser API. Current default from env is /var/www.
      </p>

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <input
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
          value={filesRoot}
          onChange={(event) => setFilesRoot(event.target.value)}
          placeholder="/var/www"
        />
        <button
          className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
          onClick={() => {
            void saveFilesRoot();
          }}
          disabled={savingRoot}
        >
          {savingRoot ? "Saving..." : "Save"}
        </button>
      </div>

      {rootMessage ? <p className="mt-2 text-xs text-slate-300">{rootMessage}</p> : null}
    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "file-browser",
  label: "File Browser",
  description: "Default root folder",
  component: FileBrowserSettingsSection,
  color: app.color,
  order: 20,
};
