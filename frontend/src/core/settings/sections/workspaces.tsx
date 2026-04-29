import { useEffect, useMemo, useState } from "react";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import { getPreferences, patchPreferences } from "../../../api/settings";
import {
  parseWorkspaceSettingsFromPreferences,
  saveWorkspaceSettings,
  toWorkspacePreferencePatch,
  type Workspace,
  type WorkspaceBanner,
} from "../../../data/workspaces";
import type { SettingsSectionDefinition } from "../types";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const WorkspacesSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [banners, setBanners] = useState<WorkspaceBanner[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const [newLabel, setNewLabel] = useState("");
  const [newBannerId, setNewBannerId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  const bannerOptions = useMemo(
    () => [{ id: "", name: "No banner" }, ...banners.map((banner) => ({ id: banner.id, name: banner.name }))],
    [banners],
  );

  const sortedWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => a.label.localeCompare(b.label)),
    [workspaces],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const preferences = await getPreferences();
      const settings = parseWorkspaceSettingsFromPreferences(preferences);
      setBanners(settings.banners);
      setWorkspaces(settings.workspaces);
      setLabelDrafts(
        Object.fromEntries(settings.workspaces.map((workspace) => [workspace.id, workspace.label])) as Record<string, string>,
      );
      setNewBannerId(settings.banners[0]?.id ?? "");
      saveWorkspaceSettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspaces");
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
    setLabelDrafts(
      Object.fromEntries(normalized.workspaces.map((workspace) => [workspace.id, workspace.label])) as Record<string, string>,
    );
    saveWorkspaceSettings(normalized);
  };

  const createWorkspace = async () => {
    const id = slugify(newLabel);
    if (!id) {
      setError("Workspace label is required.");
      return;
    }

    if (workspaces.some((workspace) => workspace.id === id)) {
      setError("A workspace with this label already exists.");
      return;
    }

    const candidate: Workspace = {
      id,
      label: newLabel.trim(),
      bannerId: newBannerId || null,
    };

    try {
      setSavingKey("create");
      setError(null);
      await persist(banners, [...workspaces, candidate]);
      setNewLabel("");
      setNewBannerId(banners[0]?.id ?? "");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setSavingKey(null);
    }
  };

  const saveWorkspace = async (workspaceId: string, nextBannerId: string) => {
    const nextLabel = (labelDrafts[workspaceId] ?? "").trim();
    if (!nextLabel) {
      setError("Workspace label is required.");
      return;
    }

    const nextWorkspaces = workspaces.map((workspace) =>
      workspace.id === workspaceId
        ? {
            ...workspace,
            label: nextLabel,
            bannerId: nextBannerId || null,
          }
        : workspace,
    );

    try {
      setSavingKey(`save:${workspaceId}`);
      setError(null);
      await persist(banners, nextWorkspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save workspace");
    } finally {
      setSavingKey(null);
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    if (workspaces.length <= 1) {
      setError("At least one workspace is required.");
      return;
    }

    const confirmed = window.confirm("Delete this workspace?");
    if (!confirmed) return;

    const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);

    const selectedWorkspaceId = localStorage.getItem("selectedWorkspaceId");
    if (selectedWorkspaceId === workspaceId) {
      localStorage.setItem("selectedWorkspaceId", nextWorkspaces[0]?.id ?? "");
    }

    try {
      setSavingKey(`delete:${workspaceId}`);
      setError(null);
      await persist(banners, nextWorkspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete workspace");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading workspaces...</div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <p className="mt-1 text-xs text-slate-400">Create, edit and delete workspaces, and select a banner with a dropdown.</p>
        </div>
        <button
          className="shrink-0 self-start rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? "Cancel" : "+ Add workspace"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      {showCreateForm ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_240px_auto]">
            <input
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Workspace label"
            />
            <select
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newBannerId}
              onChange={(event) => setNewBannerId(event.target.value)}
            >
              {bannerOptions.map((option) => (
                <option key={option.id || "none"} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
              disabled={savingKey === "create" || !newLabel.trim()}
              onClick={() => {
                void createWorkspace();
              }}
            >
              {savingKey === "create" ? "Creating..." : "Create workspace"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Banner</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedWorkspaces.map((workspace) => {
              const saveKey = `save:${workspace.id}`;
              const deleteKey = `delete:${workspace.id}`;
              const selectedBannerId = workspace.bannerId ?? "";

              return (
                <tr key={workspace.id} className="bg-black/10 text-slate-200">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={labelDrafts[workspace.id] ?? workspace.label}
                      onChange={(event) =>
                        setLabelDrafts((prev) => ({
                          ...prev,
                          [workspace.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                      value={selectedBannerId}
                      onChange={(event) => {
                        const nextBannerId = event.target.value;
                        setWorkspaces((prev) =>
                          prev.map((item) =>
                            item.id === workspace.id
                              ? {
                                  ...item,
                                  bannerId: nextBannerId || null,
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      {bannerOptions.map((option) => (
                        <option key={option.id || "none"} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={savingKey === saveKey}
                        onClick={() => {
                          const nextBannerId = workspaces.find((item) => item.id === workspace.id)?.bannerId ?? "";
                          void saveWorkspace(workspace.id, nextBannerId);
                        }}
                      >
                        {savingKey === saveKey ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="rounded-lg border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                        disabled={savingKey === deleteKey}
                        onClick={() => {
                          void deleteWorkspace(workspace.id);
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
  key: "workspaces",
  label: "Workspaces",
  description: "Manage workspace labels and banner assignment",
  component: WorkspacesSettingsSection,
  icon: HiOutlineSquares2X2,
  color: {
    border: "border-cyan-500/70",
    background: "bg-cyan-500/40",
    hover: { border: "hover:border-cyan-400/30", background: "hover:bg-cyan-400/30" },
    idle: { border: "border-cyan-500/20", background: "bg-cyan-500/10" },
  },
  order: 9,
};
