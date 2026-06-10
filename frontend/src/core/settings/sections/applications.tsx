import { useEffect, useMemo, useState } from "react";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import { apps } from "../../../apps";
import { getPreferences, patchPreferences, type PreferencesResponse } from "../../../api/settings";
import {
  APP_ENABLED_PREF_KEY,
  APP_VISIBILITY_PREF_KEY,
  getAppEnabledMap,
  getAppVisibilityMap,
  isAppEnabled,
  isAppVisible,
  type AppFlagMap,
} from "../../applications/preferences";
import type { SettingsSectionDefinition } from "../types";

const ApplicationsSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);

  const appItems = useMemo(
    () => apps.filter((app) => !app.isInternal).sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const visibilityMap = useMemo(() => getAppVisibilityMap(preferences), [preferences]);
  const enabledMap = useMemo(() => getAppEnabledMap(preferences), [preferences]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPreferences();
        if (!cancelled) {
          setPreferences(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load app settings");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveMaps = async (nextVisibilityMap: AppFlagMap, nextEnabledMap: AppFlagMap, actionKey: string) => {
    try {
      setSavingKey(actionKey);
      setError(null);

      const data = await patchPreferences({
        [APP_VISIBILITY_PREF_KEY]: nextVisibilityMap,
        [APP_ENABLED_PREF_KEY]: nextEnabledMap,
      });
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save app settings");
    } finally {
      setSavingKey(null);
    }
  };

  const toggleVisibility = async (appId: string, nextVisible: boolean) => {
    const nextVisibilityMap: AppFlagMap = {
      ...visibilityMap,
      [appId]: nextVisible,
    };

    await saveMaps(nextVisibilityMap, enabledMap, `visible:${appId}`);
  };

  const toggleEnabled = async (appId: string, nextEnabled: boolean) => {
    const nextEnabledMap: AppFlagMap = {
      ...enabledMap,
      [appId]: nextEnabled,
    };

    await saveMaps(visibilityMap, nextEnabledMap, `enabled:${appId}`);
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading applications settings...</div>;
  }

  return (
    <>
      <h2 className="text-lg font-semibold">Applications</h2>
      <p className="mt-1 text-xs text-slate-400">
        General app settings before the store system: hide apps in navigation and disable app access.
      </p>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">App</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Visible</th>
              <th className="px-3 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {appItems.map((app) => {
              const visible = isAppVisible(app.id, visibilityMap);
              const enabled = isAppEnabled(app.id, enabledMap);

              return (
                <tr key={app.id} className="bg-black/10 text-slate-200">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/5">
                        {app.icon}
                      </span>
                      <span className="text-sm font-medium">{app.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{app.to}</td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={visible}
                        disabled={savingKey === `visible:${app.id}`}
                        onChange={(event) => {
                          void toggleVisibility(app.id, event.target.checked);
                        }}
                      />
                      {visible ? "yes" : "no"}
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={savingKey === `enabled:${app.id}`}
                        onChange={(event) => {
                          void toggleEnabled(app.id, event.target.checked);
                        }}
                      />
                      {enabled ? "yes" : "no"}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "applications",
  label: "Applications",
  description: "General app visibility and enable/disable rules",
  component: ApplicationsSettingsSection,
  icon: HiOutlineSquares2X2,
  color: {
    border: "border-teal-500/70",
    background: "bg-teal-500/40",
    hover: { border: "hover:border-teal-400/30", background: "hover:bg-teal-400/30" },
    idle: { border: "border-teal-500/20", background: "bg-teal-500/10" },
  },
  group: "apps",
  order: 0,
};
