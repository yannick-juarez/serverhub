import { useEffect, useMemo, useState } from "react";
import { HiOutlineRectangleGroup } from "react-icons/hi2";
import { getPreferences, patchPreferences } from "../../../api/settings";
import {
  BANNER_BACKGROUND_OPTIONS,
  BANNER_FOREGROUND_OPTIONS,
  parseWorkspaceSettingsFromPreferences,
  saveWorkspaceSettings,
  toWorkspacePreferencePatch,
  type Workspace,
  type WorkspaceBanner,
} from "../../../data/workspaces";
import type { SettingsSectionDefinition } from "../types";

const BACKGROUND_OPTION_LABELS: Record<string, string> = {
  "bg-red-500": "Red",
  "bg-orange-500": "Orange",
  "bg-amber-500": "Amber",
  "bg-yellow-500": "Yellow",
  "bg-lime-500": "Lime",
  "bg-green-500": "Green",
  "bg-teal-500": "Teal",
  "bg-cyan-500": "Cyan",
  "bg-sky-500": "Sky",
  "bg-blue-500": "Blue",
  "bg-indigo-500": "Indigo",
  "bg-pink-500": "Pink",
  "bg-zinc-700": "Charcoal",
  "bg-black": "Black",
};

const FOREGROUND_OPTION_LABELS: Record<string, string> = {
  "text-white": "White",
  "text-black": "Black",
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BannersSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [banners, setBanners] = useState<WorkspaceBanner[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newBackground, setNewBackground] = useState<string>(BANNER_BACKGROUND_OPTIONS[0]);
  const [newForeground, setNewForeground] = useState<string>(BANNER_FOREGROUND_OPTIONS[0]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, WorkspaceBanner>>({});

  const sortedBanners = useMemo(
    () => [...banners].sort((a, b) => a.name.localeCompare(b.name)),
    [banners],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const preferences = await getPreferences();
      const settings = parseWorkspaceSettingsFromPreferences(preferences);
      setBanners(settings.banners);
      setWorkspaces(settings.workspaces);
      setDrafts(
        Object.fromEntries(settings.banners.map((banner) => [banner.id, { ...banner }])) as Record<string, WorkspaceBanner>,
      );
      saveWorkspaceSettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const persist = async (nextBanners: WorkspaceBanner[], nextWorkspaces: Workspace[]) => {
    const patch = toWorkspacePreferencePatch({ banners: nextBanners, workspaces: nextWorkspaces });
    const updated = await patchPreferences(patch);
    const normalized = parseWorkspaceSettingsFromPreferences(updated);
    setBanners(normalized.banners);
    setWorkspaces(normalized.workspaces);
    setDrafts(
      Object.fromEntries(normalized.banners.map((banner) => [banner.id, { ...banner }])) as Record<string, WorkspaceBanner>,
    );
    saveWorkspaceSettings(normalized);
  };

  const createBanner = async () => {
    const id = slugify(newName || newLabel);
    if (!id) {
      setError("Banner name is required.");
      return;
    }

    if (banners.some((banner) => banner.id === id)) {
      setError("A banner with this name already exists.");
      return;
    }

    const candidate: WorkspaceBanner = {
      id,
      name: newName.trim() || "New banner",
      label: newLabel.trim() || "Workspace banner",
      background: newBackground,
      foreground: newForeground,
    };

    try {
      setSavingKey("create");
      setError(null);
      await persist([...banners, candidate], workspaces);
      setNewName("");
      setNewLabel("");
      setNewBackground(BANNER_BACKGROUND_OPTIONS[0]);
      setNewForeground(BANNER_FOREGROUND_OPTIONS[0]);
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create banner");
    } finally {
      setSavingKey(null);
    }
  };

  const saveBanner = async (bannerId: string) => {
    const draft = drafts[bannerId];
    if (!draft) return;

    const nextName = draft.name.trim();
    const nextLabel = draft.label.trim();
    if (!nextName || !nextLabel) {
      setError("Banner name and label are required.");
      return;
    }

    const nextBanners = banners.map((banner) =>
      banner.id === bannerId
        ? {
            ...banner,
            name: nextName,
            label: nextLabel,
            background: draft.background,
            foreground: draft.foreground,
          }
        : banner,
    );

    try {
      setSavingKey(`save:${bannerId}`);
      setError(null);
      await persist(nextBanners, workspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save banner");
    } finally {
      setSavingKey(null);
    }
  };

  const deleteBanner = async (bannerId: string) => {
    const confirmed = window.confirm("Delete this banner?");
    if (!confirmed) return;

    const nextBanners = banners.filter((banner) => banner.id !== bannerId);
    const nextWorkspaces = workspaces.map((workspace) =>
      workspace.bannerId === bannerId ? { ...workspace, bannerId: null } : workspace,
    );

    try {
      setSavingKey(`delete:${bannerId}`);
      setError(null);
      await persist(nextBanners, nextWorkspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete banner");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading banners...</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Banners</h2>
          <p className="mt-1 text-xs text-slate-400">Create, edit and delete workspace banners used across the app.</p>
        </div>
        <button
          className="shrink-0 self-start rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? "Cancel" : "+ Add banner"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      {showCreateForm ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_180px_140px_auto]">
            <input
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Banner name"
            />
            <input
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Banner label"
            />
            <select
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newBackground}
              onChange={(event) => setNewBackground(event.target.value)}
            >
              {BANNER_BACKGROUND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {BACKGROUND_OPTION_LABELS[option] ?? option}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newForeground}
              onChange={(event) => setNewForeground(event.target.value)}
            >
              {BANNER_FOREGROUND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {FOREGROUND_OPTION_LABELS[option] ?? option}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
              disabled={savingKey === "create" || (!newName.trim() && !newLabel.trim())}
              onClick={() => {
                void createBanner();
              }}
            >
              {savingKey === "create" ? "Creating..." : "Create banner"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Background</th>
              <th className="px-3 py-2">Text</th>
              <th className="px-3 py-2">Preview</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedBanners.map((banner) => {
              const draft = drafts[banner.id] ?? banner;
              const saveKey = `save:${banner.id}`;
              const deleteKey = `delete:${banner.id}`;

              return (
                <tr key={banner.id} className="bg-black/10 text-slate-200">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={draft.name}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [banner.id]: { ...draft, name: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={draft.label}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [banner.id]: { ...draft, label: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={draft.background}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [banner.id]: { ...draft, background: event.target.value },
                        }))
                      }
                    >
                      {BANNER_BACKGROUND_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {BACKGROUND_OPTION_LABELS[option] ?? option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={draft.foreground}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [banner.id]: { ...draft, foreground: event.target.value },
                        }))
                      }
                    >
                      {BANNER_FOREGROUND_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {FOREGROUND_OPTION_LABELS[option] ?? option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-1 text-xs ${draft.background} ${draft.foreground}`}>
                      {draft.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={savingKey === saveKey}
                        onClick={() => {
                          void saveBanner(banner.id);
                        }}
                      >
                        {savingKey === saveKey ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="rounded-lg border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                        disabled={savingKey === deleteKey}
                        onClick={() => {
                          void deleteBanner(banner.id);
                        }}
                      >
                        {savingKey === deleteKey ? "Deleting..." : "Delete"}
                      </button>
                    </div>
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
  key: "banners",
  label: "Banners",
  description: "Create, edit and remove workspace banners",
  component: BannersSettingsSection,
  icon: HiOutlineRectangleGroup,
  color: {
    border: "border-pink-500/70",
    background: "bg-pink-500/40",
    hover: { border: "hover:border-pink-400/30", background: "hover:bg-pink-400/30" },
    idle: { border: "border-pink-500/20", background: "bg-pink-500/10" },
  },
  order: 8,
};
