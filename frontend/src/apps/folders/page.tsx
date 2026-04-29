
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    HiOutlineArrowLeft,
    HiOutlineArrowRight,
    HiOutlineArrowUp,
    HiOutlineArrowPath,
    HiOutlineSquares2X2,
    HiOutlineBars3,
    HiChevronRight,
} from "react-icons/hi2";
import { TbArrowsSort } from "react-icons/tb";
import { FaFolder, FaFolderOpen, FaFile } from "react-icons/fa";
import { listServerDirectory, readServerFile, getServerFilesRoot, type ServerFileEntry } from "../../api/files";

type SortMode = "name" | "updated" | "size";
type ViewMode = "list" | "grid";

function normalizePath(input: string): string {
    if (!input.trim()) return "/";
    const cleaned = input.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (cleaned === "/") return "/";
    return cleaned.startsWith("/") ? cleaned.replace(/\/+$/, "") || "/" : `/${cleaned.replace(/\/+$/, "")}`;
}

function getParentPath(path: string): string {
    const normalized = normalizePath(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/").filter(Boolean);
    parts.pop();
    return parts.length ? `/${parts.join("/")}` : "/";
}

function formatSize(size: number, isDirectory: boolean): string {
    if (isDirectory) return "--";
    if (!Number.isFinite(size) || size < 0) return "--";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function FilesPage() {
    // Navigation history stored as a single atomic state to avoid stale closure issues
    const [nav, setNav] = useState<{ history: string[]; index: number }>({ history: ["/"], index: 0 });
    const currentPath = nav.history[nav.index];
    const canGoBack = nav.index > 0;
    const canGoForward = nav.index < nav.history.length - 1;
    const canGoUp = currentPath !== "/";

    // Fetch the real filesystem root on mount and use it as starting path
    useEffect(() => {
        void getServerFilesRoot().then((root) => {
            setNav({ history: [root], index: 0 });
        }).catch(() => { /* keep "/" as fallback */ });
    }, []);

    const navigate = (path: string) => {
        const normalized = normalizePath(path);
        setNav((prev) => ({
            history: [...prev.history.slice(0, prev.index + 1), normalized],
            index: prev.index + 1,
        }));
    };

    const [entries, setEntries] = useState<ServerFileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<SortMode>("name");
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [preview, setPreview] = useState<string>("");
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Hidden files
    const [showHidden, setShowHidden] = useState<boolean>(() => {
        try { return localStorage.getItem("files:showHidden") === "true"; } catch { return false; }
    });
    const toggleShowHidden = useCallback(() => {
        setShowHidden((v) => {
            const next = !v;
            try { localStorage.setItem("files:showHidden", String(next)); } catch { /* noop */ }
            return next;
        });
    }, []);

    // Path bar
    const [pathBarValue, setPathBarValue] = useState("/");
    const [pathBarEditing, setPathBarEditing] = useState(false);
    const [pathBarError, setPathBarError] = useState(false);
    const pathInputRef = useRef<HTMLInputElement>(null);
    const breadcrumbsRef = useRef<HTMLDivElement>(null);

    // Autocomplete
    const [suggestions, setSuggestions] = useState<{ name: string; path: string }[]>([]);
    const [suggestionIdx, setSuggestionIdx] = useState(-1);

    useEffect(() => {
        if (!pathBarEditing) { setSuggestions([]); setSuggestionIdx(-1); return; }
        const val = pathBarValue.replace(/\\/g, "/");
        // Derive parent dir and typed fragment
        const lastSlash = val.lastIndexOf("/");
        const parentDir = lastSlash <= 0 ? "/" : val.slice(0, lastSlash);
        const fragment = val.slice(lastSlash + 1);
        const timer = setTimeout(async () => {
            try {
                const data = await listServerDirectory(parentDir);
                const dirs = data.filter(
                    (e) => e.isDirectory && e.name.toLowerCase().startsWith(fragment.toLowerCase())
                );
                setSuggestions(dirs.map((e) => ({ name: e.name, path: e.path })));
                setSuggestionIdx(-1);
            } catch {
                setSuggestions([]);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [pathBarValue, pathBarEditing]);

    const acceptSuggestion = useCallback((p: string) => {
        // Fill the path bar with the suggestion + trailing slash for further completion
        const filled = p.endsWith("/") ? p : p + "/";
        setPathBarValue(filled);
        setPathBarError(false);
        setSuggestions([]);
        setSuggestionIdx(-1);
        pathInputRef.current?.focus();
    }, []);

    const navigateToSuggestion = useCallback(async (p: string) => {
        try {
            await listServerDirectory(p);
            setSuggestions([]);
            setSuggestionIdx(-1);
            setPathBarEditing(false);
            setPathBarError(false);
            navigate(p);
        } catch {
            setPathBarError(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // onBlur: delay to let mousedown on suggestion fire first
    const handlePathBarBlur = useCallback(() => {
        setTimeout(() => { setSuggestions([]); setSuggestionIdx(-1); cancelPathBar(); }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync path bar when not editing + scroll breadcrumbs to end
    useEffect(() => {
        if (!pathBarEditing) {
            setPathBarValue(currentPath);
            setPathBarError(false);
            // Scroll breadcrumb bar to the rightmost item
            requestAnimationFrame(() => {
                if (breadcrumbsRef.current) {
                    breadcrumbsRef.current.scrollLeft = breadcrumbsRef.current.scrollWidth;
                }
            });
        }
    }, [currentPath, pathBarEditing]);

    // Load directory on path change
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await listServerDirectory(currentPath);
                if (!cancelled) {
                    setEntries(data);
                    setSelectedEntryPath(null);
                    setPreview("");
                    setPreviewError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Cannot load folder.");
                    setEntries([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [currentPath]);

    const hiddenEntries = useMemo(() => entries.filter((e) => e.name.startsWith(".")), [entries]);

    const sortedEntries = useMemo(() => {
        const visible = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));
        const cloned = [...visible];
        cloned.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            if (sortMode === "size") return b.size - a.size || a.name.localeCompare(b.name);
            if (sortMode === "updated") return new Date(b.modified).getTime() - new Date(a.modified).getTime() || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });
        return cloned;
    }, [entries, sortMode, showHidden]);

    const breadcrumbs = useMemo(() => {
        const normalized = normalizePath(currentPath);
        if (normalized === "/") return [{ label: "/", path: "/" }];
        const parts = normalized.split("/").filter(Boolean);
        return [
            { label: "/", path: "/" },
            ...parts.map((part, i) => ({ label: part, path: `/${parts.slice(0, i + 1).join("/")}` })),
        ];
    }, [currentPath]);

    const selectedEntry = sortedEntries.find((e) => e.path === selectedEntryPath) ?? null;

    const handleOpen = (entry: ServerFileEntry) => {
        setSelectedEntryPath(entry.path);
        if (entry.isDirectory) {
            navigate(normalizePath(entry.path));
            return;
        }
        setPreviewLoading(true);
        setPreviewError(null);
        void readServerFile(entry.path)
            .then((data) => setPreview(data.content))
            .catch((err: unknown) => {
                setPreviewError(err instanceof Error ? err.message : "Preview unavailable.");
                setPreview("");
            })
            .finally(() => setPreviewLoading(false));
    };

    const refresh = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listServerDirectory(currentPath);
            setEntries(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Cannot refresh.");
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    const activatePathBar = () => {
        setPathBarValue(currentPath);
        setPathBarEditing(true);
        setTimeout(() => { pathInputRef.current?.select(); }, 0);
    };

    const cancelPathBar = () => {
        setPathBarEditing(false);
        setPathBarValue(currentPath);
        setPathBarError(false);
    };

    const commitPathBar = async () => {
        const target = normalizePath(pathBarValue);
        if (target === currentPath) {
            setPathBarEditing(false);
            setPathBarError(false);
            return;
        }
        try {
            await listServerDirectory(target);
            setPathBarEditing(false);
            setPathBarError(false);
            navigate(target);
        } catch {
            setPathBarError(true);
        }
    };

    const SORT_LABELS: Record<SortMode, string> = { name: "Name", updated: "Date", size: "Size" };
    const SORT_ORDER: SortMode[] = ["name", "updated", "size"];
    const nextSort = () => setSortMode((m) => SORT_ORDER[(SORT_ORDER.indexOf(m) + 1) % SORT_ORDER.length]);

    return (
        <div className="flex h-full w-full flex-col bg-zinc-950 text-sm text-slate-200">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-2 py-1.5">
                <button
                    className="rounded p-1.5 text-slate-400 hover:bg-zinc-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => setNav((prev) => ({ ...prev, index: prev.index - 1 }))}
                    disabled={!canGoBack}
                    title="Back"
                >
                    <HiOutlineArrowLeft className="h-4 w-4" />
                </button>
                <button
                    className="rounded p-1.5 text-slate-400 hover:bg-zinc-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => setNav((prev) => ({ ...prev, index: prev.index + 1 }))}
                    disabled={!canGoForward}
                    title="Forward"
                >
                    <HiOutlineArrowRight className="h-4 w-4" />
                </button>
                <button
                    className="rounded p-1.5 text-slate-400 hover:bg-zinc-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => { if (canGoUp) navigate(getParentPath(currentPath)); }}
                    disabled={!canGoUp}
                    title="Parent directory"
                >
                    <HiOutlineArrowUp className="h-4 w-4" />
                </button>

                <div className="mx-1 h-5 w-px bg-zinc-700" />

                {/* Path bar — breadcrumb display or editable input */}
                <div
                    className={`relative flex flex-1 min-w-0 cursor-text items-center rounded border px-2 py-1 transition-colors ${
                        pathBarError
                            ? "border-red-500/60 bg-red-950/40"
                            : pathBarEditing
                            ? "border-blue-500/50 bg-zinc-800"
                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                    onClick={!pathBarEditing ? activatePathBar : undefined}
                >
                    {pathBarEditing ? (
                        <>
                            <input
                                ref={pathInputRef}
                                className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none"
                                value={pathBarValue}
                                onChange={(e) => { setPathBarValue(e.target.value); setPathBarError(false); setSuggestionIdx(-1); }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setSuggestionIdx((i) => Math.max(i - 1, -1));
                                    } else if (e.key === "Tab") {
                                        e.preventDefault();
                                        const pick = suggestions[suggestionIdx >= 0 ? suggestionIdx : 0];
                                        if (pick) acceptSuggestion(pick.path);
                                    } else if (e.key === "Enter") {
                                        const pick = suggestionIdx >= 0 ? suggestions[suggestionIdx] : null;
                                        if (pick) { void navigateToSuggestion(pick.path); }
                                        else { void commitPathBar(); }
                                    } else if (e.key === "Escape") {
                                        if (suggestions.length > 0) { setSuggestions([]); setSuggestionIdx(-1); }
                                        else { cancelPathBar(); }
                                    }
                                }}
                                onBlur={handlePathBarBlur}
                                spellCheck={false}
                                autoFocus
                            />
                            {pathBarError && (
                                <span className="ml-2 shrink-0 text-xs text-red-400">Path not found</span>
                            )}
                            {/* Autocomplete dropdown */}
                            {suggestions.length > 0 && (
                                <div className="absolute left-0 top-full z-50 mt-0.5 max-h-56 w-full overflow-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/60">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={s.path}
                                            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
                                                i === suggestionIdx
                                                    ? "bg-blue-500/15 text-slate-100"
                                                    : "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                                            }`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                acceptSuggestion(s.path);
                                            }}
                                            onDoubleClick={() => { void navigateToSuggestion(s.path); }}
                                        >
                                            <FaFolder className="shrink-0 text-white/50" />
                                            <span className="flex-1 truncate font-mono">{s.name}</span>
                                            <span className="shrink-0 text-[10px] text-zinc-600">↵ open</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div
                            ref={breadcrumbsRef}
                            className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                            {breadcrumbs.map((crumb, i) => (
                                <span key={crumb.path} className="flex shrink-0 items-center">
                                    {i > 0 && <HiChevronRight className="h-3 w-3 text-zinc-600" />}
                                    <button
                                        className="rounded px-1 py-0.5 text-slate-300 hover:bg-zinc-700 hover:text-white"
                                        onMouseDown={(e) => { e.preventDefault(); navigate(crumb.path); }}
                                    >
                                        {crumb.label}
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mx-1 h-5 w-px bg-zinc-700" />

                <button
                    className="rounded p-1.5 text-slate-400 hover:bg-zinc-700 hover:text-slate-100"
                    onClick={() => { void refresh(); }}
                    title="Refresh"
                >
                    <HiOutlineArrowPath className="h-4 w-4" />
                </button>

                <button
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-zinc-700 hover:text-slate-100"
                    onClick={nextSort}
                    title="Cycle sort"
                >
                    <TbArrowsSort className="h-3.5 w-3.5" />
                    {SORT_LABELS[sortMode]}
                </button>

                {/* View toggle */}
                <div className="flex overflow-hidden rounded border border-zinc-700">
                    <button
                        className={`px-2 py-1 transition-colors ${viewMode === "list" ? "bg-zinc-700 text-white" : "text-slate-500 hover:bg-zinc-800 hover:text-slate-300"}`}
                        onClick={() => setViewMode("list")}
                        title="List view"
                    >
                        <HiOutlineBars3 className="h-4 w-4" />
                    </button>
                    <button
                        className={`px-2 py-1 transition-colors ${viewMode === "grid" ? "bg-zinc-700 text-white" : "text-slate-500 hover:bg-zinc-800 hover:text-slate-300"}`}
                        onClick={() => setViewMode("grid")}
                        title="Grid view"
                    >
                        <HiOutlineSquares2X2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                {/* File area */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
                            Loading…
                        </div>
                    ) : error ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                            <p className="text-sm text-red-300">Cannot load this directory.</p>
                            <p className="text-xs text-red-200/50">{error}</p>
                            <div className="flex gap-2">
                                {canGoBack && (
                                    <button
                                        className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
                                        onClick={() => setNav((prev) => ({ ...prev, index: prev.index - 1 }))}
                                    >
                                        Go back
                                    </button>
                                )}
                                <button
                                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
                                    onClick={() => navigate("/")}
                                >
                                    Go to /
                                </button>
                            </div>
                        </div>
                    ) : sortedEntries.length === 0 && hiddenEntries.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center text-xs text-slate-600">
                            Empty directory.
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col overflow-hidden">
                            {sortedEntries.length === 0 && hiddenEntries.length > 0 ? (
                                <div className="flex flex-1 items-center justify-center text-xs text-slate-600">
                                    No visible files.{" "}
                                    <button className="ml-1 text-zinc-400 underline-offset-2 hover:text-slate-200 hover:underline" onClick={toggleShowHidden}>
                                        Show {hiddenEntries.length} hidden
                                    </button>
                                </div>
                            ) : viewMode === "list" ? (
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 text-left text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Name</th>
                                        <th className="w-20 px-4 py-2 font-medium">Type</th>
                                        <th className="w-24 px-4 py-2 font-medium">Size</th>
                                        <th className="w-40 px-4 py-2 font-medium">Modified</th>
                                        <th className="w-28 px-4 py-2 font-medium">Permissions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Hidden files row — visually part of the list */}
                                    {hiddenEntries.length > 0 && (
                                        <tr className="border-b border-zinc-800/40 bg-zinc-900/30">
                                            <td colSpan={5} className="px-4 py-1.5">
                                                <span className="text-zinc-600 italic">
                                                    {showHidden
                                                        ? `${hiddenEntries.length} hidden file${hiddenEntries.length !== 1 ? "s" : ""} visible —`
                                                        : `${hiddenEntries.length} hidden file${hiddenEntries.length !== 1 ? "s" : ""} —`}
                                                </span>{" "}
                                                <button
                                                    className="text-zinc-500 underline-offset-2 hover:text-slate-300 hover:underline"
                                                    onClick={toggleShowHidden}
                                                >
                                                    {showHidden ? "hide" : "show"}
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                    {sortedEntries.map((entry) => (
                                        <tr
                                            key={entry.path}
                                            className={`cursor-pointer border-b border-zinc-800/40 transition-colors ${
                                                selectedEntryPath === entry.path
                                                    ? "bg-blue-500/10 text-slate-100"
                                                    : "text-slate-300 hover:bg-zinc-800/50"
                                            }`}
                                            onClick={() => setSelectedEntryPath(entry.path)}
                                            onDoubleClick={() => handleOpen(entry)}
                                        >
                                            <td className="px-4 py-1.5">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    {entry.isDirectory ? (
                                                        <FaFolder className="shrink-0 text-white/70" />
                                                    ) : (
                                                        <FaFile className="shrink-0 text-white/50" />
                                                    )}
                                                    <button
                                                        className="truncate text-left hover:underline"
                                                        onClick={(e) => { e.stopPropagation(); handleOpen(entry); }}
                                                    >
                                                        {entry.name}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-1.5 text-slate-500">{entry.isDirectory ? "Folder" : "File"}</td>
                                            <td className="px-4 py-1.5 text-slate-500">{formatSize(entry.size, entry.isDirectory)}</td>
                                            <td className="px-4 py-1.5 text-slate-500">{formatDate(entry.modified)}</td>
                                            <td className="px-4 py-1.5 font-mono text-slate-600">{entry.permissions}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Grid view */
                        <div className="flex flex-1 flex-col overflow-hidden">
                            {hiddenEntries.length > 0 && (
                                <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/60 px-4 py-1.5 text-xs">
                                    <span className="italic text-zinc-600">
                                        {hiddenEntries.length} hidden file{hiddenEntries.length !== 1 ? "s" : ""}{showHidden ? " visible" : ""} —
                                    </span>
                                    <button
                                        className="text-zinc-500 underline-offset-2 hover:text-slate-300 hover:underline"
                                        onClick={toggleShowHidden}
                                    >
                                        {showHidden ? "hide" : "show"}
                                    </button>
                                </div>
                            )}
                        <div className="flex-1 overflow-auto p-4">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1">
                                {sortedEntries.map((entry) => (
                                    <button
                                        key={entry.path}
                                        className={`flex flex-col items-center gap-2 rounded p-2.5 text-center transition-colors ${
                                            selectedEntryPath === entry.path
                                                ? "bg-blue-500/15 ring-1 ring-blue-400/30"
                                                : "hover:bg-zinc-800"
                                        }`}
                                        onClick={() => setSelectedEntryPath(entry.path)}
                                        onDoubleClick={() => handleOpen(entry)}
                                    >
                                        {entry.isDirectory ? (
                                            <FaFolder className="h-10 w-10 text-white/70" />
                                        ) : (
                                            <FaFile className="h-10 w-10 text-white/50" />
                                        )}
                                        <span className="w-full truncate text-[11px] leading-tight text-slate-300">
                                            {entry.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Details panel */}
                <aside className="w-60 shrink-0 overflow-auto border-l border-zinc-800 bg-zinc-900">
                    <div className="border-b border-zinc-800 px-4 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Details</p>
                    </div>
                    {selectedEntry ? (
                        <div className="p-4">
                            <div className="mb-4 flex flex-col items-center gap-2 pt-2">
                                {selectedEntry.isDirectory ? (
                                    <FaFolderOpen className="h-12 w-12 text-white/70" />
                                ) : (
                                    <FaFile className="h-12 w-12 text-white/50" />
                                )}
                                <p className="max-w-full break-all text-center text-xs font-semibold text-slate-100">
                                    {selectedEntry.name}
                                </p>
                            </div>
                            <div className="space-y-3">
                                {(
                                    [
                                        ["Type", selectedEntry.isDirectory ? "Folder" : "File"],
                                        ["Path", selectedEntry.path],
                                        ["Size", formatSize(selectedEntry.size, selectedEntry.isDirectory)],
                                        ["Modified", formatDate(selectedEntry.modified)],
                                        ["Permissions", selectedEntry.permissions],
                                    ] as [string, string][]
                                ).map(([label, value]) => (
                                    <div key={label}>
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
                                        <p className="mt-0.5 break-all font-mono text-xs text-slate-300">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {!selectedEntry.isDirectory && (
                                <div className="mt-4">
                                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Preview</p>
                                    <div className="max-h-64 overflow-auto rounded border border-zinc-700 bg-zinc-950 p-2">
                                        {previewLoading ? (
                                            <p className="text-xs text-zinc-500">Loading…</p>
                                        ) : previewError ? (
                                            <p className="text-xs text-red-300">{previewError}</p>
                                        ) : preview ? (
                                            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-400">
                                                {preview}
                                            </pre>
                                        ) : (
                                            <p className="text-xs text-zinc-600">Double-click a file to preview.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="p-4 text-xs text-zinc-600">Select a file or folder.</p>
                    )}
                </aside>
            </div>

            {/* Status bar */}
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-0.5 text-[10px] text-zinc-500">
                <span>{sortedEntries.length} item{sortedEntries.length !== 1 ? "s" : ""}</span>
                {selectedEntry && (
                    <span>
                        {selectedEntry.name}
                        {!selectedEntry.isDirectory && ` — ${formatSize(selectedEntry.size, false)}`}
                    </span>
                )}
            </div>
        </div>
    );
}