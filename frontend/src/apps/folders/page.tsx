import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowUp,
  HiOutlineArrowPath,
  HiOutlineSquares2X2,
  HiOutlineBars3,
  HiChevronRight,
  HiOutlineXMark,
} from "react-icons/hi2";
import { TbArrowsSort } from "react-icons/tb";
import { FaFolder, FaFolderOpen, FaFile } from "react-icons/fa";
import {
  listServerDirectory,
  readServerFile,
  getServerFilesRoot,
  deleteServerEntry,
  deleteServerEntries,
  renameServerEntry,
  setServerEntryPermissions,
  setServerEntriesPermissions,
  compressServerEntries,
  downloadServerEntry,
  downloadServerEntriesArchive,
  fetchServerFileBlob,
  type ServerFileEntry,
} from "../../api/files";
import { getPreferences } from "../../api/settings";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/ToastContainer";

type SortMode = "name" | "updated" | "size";
type ViewMode = "list" | "grid";
type PreviewKind = "none" | "text" | "image" | "pdf" | "unsupported" | "too-large";
type ContextMenuState = { x: number; y: number; entryPath: string } | null;
type ModalState = "none" | "confirm-delete" | "rename" | "permissions" | "compress";

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

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function getPreviewKind(entry: ServerFileEntry): PreviewKind {
  const ext = getFileExtension(entry.name);
  const imageExt = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
  const textExt = new Set([
    "txt", "md", "json", "js", "ts", "tsx", "jsx", "css", "html", "xml", "yml", "yaml", "log", "env", "sh", "sql", "py", "go", "java", "c", "cpp", "h", "hpp", "conf", "ini",
  ]);

  if (ext === "pdf") return "pdf";
  if (imageExt.has(ext)) return "image";
  if (textExt.has(ext)) return "text";
  return "unsupported";
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

type ActionModalProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  busy?: boolean;
  danger?: boolean;
  children?: React.ReactNode;
};

function ActionModal({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  busy,
  danger,
  children,
}: ActionModalProps) {
  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">{children}</div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || busy}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "bg-red-500/80 text-white hover:bg-red-500"
                : "bg-white text-zinc-900 hover:bg-white/90"
            }`}
          >
            {busy ? "Working..." : submitLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

export default function FilesPage() {
  const { toasts, showToast, removeToast } = useToast();

  const [nav, setNav] = useState<{ history: string[]; index: number }>({ history: ["/"], index: 0 });
  const currentPath = nav.history[nav.index];
  const canGoBack = nav.index > 0;
  const canGoForward = nav.index < nav.history.length - 1;
  const canGoUp = currentPath !== "/";

  useEffect(() => {
    void getServerFilesRoot()
      .then((root) => {
        setNav({ history: [root], index: 0 });
      })
      .catch(() => {
        // keep fallback
      });
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
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [actionBusy, setActionBusy] = useState(false);

  const [previewKind, setPreviewKind] = useState<PreviewKind>("none");
  const [previewText, setPreviewText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [previewMaxMb, setPreviewMaxMb] = useState(150);

  const [showHidden, setShowHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("files:showHidden") === "true";
    } catch {
      return false;
    }
  });

  const toggleShowHidden = useCallback(() => {
    setShowHidden((v) => {
      const next = !v;
      try {
        localStorage.setItem("files:showHidden", String(next));
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  const [pathBarValue, setPathBarValue] = useState("/");
  const [pathBarEditing, setPathBarEditing] = useState(false);
  const [pathBarError, setPathBarError] = useState(false);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const breadcrumbsRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<{ name: string; path: string }[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);

  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);
  const dragRef = useRef<{
    mouseDown: boolean;
    moved: boolean;
    startPath: string | null;
    mode: "add" | "remove";
    visited: Set<string>;
  }>({
    mouseDown: false,
    moved: false,
    startPath: null,
    mode: "add",
    visited: new Set<string>(),
  });

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  const [modalState, setModalState] = useState<ModalState>("none");
  const [modalPaths, setModalPaths] = useState<string[]>([]);
  const [renameValue, setRenameValue] = useState("");
  const [permissionsValue, setPermissionsValue] = useState("755");
  const [compressName, setCompressName] = useState("");

  useEffect(() => {
    void getPreferences()
      .then((prefs) => {
        const raw = prefs.filesPreviewMaxMb;
        const value = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(value) && value > 0) {
          setPreviewMaxMb(Math.floor(value));
        }
      })
      .catch(() => {
        // fallback value kept
      });
  }, []);

  useEffect(() => {
    if (!pathBarEditing) {
      setSuggestions([]);
      setSuggestionIdx(-1);
      return;
    }
    const val = pathBarValue.replace(/\\/g, "/");
    const lastSlash = val.lastIndexOf("/");
    const parentDir = lastSlash <= 0 ? "/" : val.slice(0, lastSlash);
    const fragment = val.slice(lastSlash + 1);
    const timer = setTimeout(async () => {
      try {
        const data = await listServerDirectory(parentDir);
        const dirs = data.filter((e) => e.isDirectory && e.name.toLowerCase().startsWith(fragment.toLowerCase()));
        setSuggestions(dirs.map((e) => ({ name: e.name, path: e.path })));
        setSuggestionIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [pathBarValue, pathBarEditing]);

  const acceptSuggestion = useCallback((p: string) => {
    const filled = p.endsWith("/") ? p : `${p}/`;
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
  }, []);

  const cancelPathBar = useCallback(() => {
    setPathBarEditing(false);
    setPathBarValue(currentPath);
    setPathBarError(false);
  }, [currentPath]);

  const handlePathBarBlur = useCallback(() => {
    setTimeout(() => {
      setSuggestions([]);
      setSuggestionIdx(-1);
      cancelPathBar();
    }, 120);
  }, [cancelPathBar]);

  useEffect(() => {
    if (!pathBarEditing) {
      setPathBarValue(currentPath);
      setPathBarError(false);
      requestAnimationFrame(() => {
        if (breadcrumbsRef.current) {
          breadcrumbsRef.current.scrollLeft = breadcrumbsRef.current.scrollWidth;
        }
      });
    }
  }, [currentPath, pathBarEditing]);

  const refresh = useCallback(async () => {
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
  }, [currentPath]);

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
          setSelectedPaths([]);
          setSelectionAnchorIndex(null);
          setContextMenu(null);
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
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const hiddenEntries = useMemo(() => entries.filter((e) => e.name.startsWith(".")), [entries]);

  const sortedEntries = useMemo(() => {
    const visible = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));
    const cloned = [...visible];
    cloned.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      if (sortMode === "size") return b.size - a.size || a.name.localeCompare(b.name);
      if (sortMode === "updated") {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime() || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return cloned;
  }, [entries, sortMode, showHidden]);

  const entryIndexByPath = useMemo(() => {
    const map = new Map<string, number>();
    sortedEntries.forEach((entry, idx) => map.set(entry.path, idx));
    return map;
  }, [sortedEntries]);

  const entriesByPath = useMemo(() => {
    const map = new Map<string, ServerFileEntry>();
    entries.forEach((entry) => map.set(entry.path, entry));
    return map;
  }, [entries]);

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
  const selectedCount = selectedPaths.length;
  const selectedActionPaths = selectedPaths.length > 0
    ? selectedPaths
    : selectedEntryPath
    ? [selectedEntryPath]
    : [];

  const previewMaxBytes = useMemo(() => previewMaxMb * 1024 * 1024, [previewMaxMb]);

  useEffect(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    setPreviewText("");
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewKind("none");
    setPreviewLoading(false);

    if (!selectedEntry || selectedEntry.isDirectory || selectedCount !== 1) {
      return;
    }

    if (selectedEntry.size > previewMaxBytes) {
      setPreviewKind("too-large");
      return;
    }

    const kind = getPreviewKind(selectedEntry);
    if (kind === "unsupported") {
      setPreviewKind("unsupported");
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    if (kind === "text") {
      void readServerFile(selectedEntry.path, previewMaxBytes)
        .then((data) => {
          if (cancelled) return;
          setPreviewText(data.content);
          setPreviewKind("text");
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setPreviewError(err instanceof Error ? err.message : "Preview unavailable.");
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    void fetchServerFileBlob(selectedEntry.path)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        previewObjectUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewKind(kind);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : "Preview unavailable.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewMaxBytes, selectedEntry, selectedCount]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      dragRef.current.mouseDown = false;
      dragRef.current.startPath = null;
      dragRef.current.visited.clear();
      window.setTimeout(() => {
        dragRef.current.moved = false;
      }, 0);
    };

    const closeContext = () => setContextMenu(null);
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        if (modalState !== "none") {
          setModalState("none");
        }
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("click", closeContext);
    document.addEventListener("scroll", closeContext, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("click", closeContext);
      document.removeEventListener("scroll", closeContext, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [modalState]);

  const runAction = async (task: () => Promise<void>, successMessage: string) => {
    try {
      setActionBusy(true);
      await task();
      await refresh();
      showToast({
        type: "success",
        title: successMessage,
        duration: 3500,
      });
    } catch (err) {
      showToast({
        type: "error",
        title: "Action failed",
        subtitle: err instanceof Error ? err.message : "Unknown error",
        duration: 5000,
      });
    } finally {
      setActionBusy(false);
      setContextMenu(null);
      setModalState("none");
    }
  };

  const openModal = (type: ModalState, paths: string[]) => {
    if (paths.length === 0) return;
    setContextMenu(null);
    setModalPaths(paths);

    if (type === "rename") {
      const entry = entriesByPath.get(paths[0]);
      setRenameValue(entry?.name ?? "");
    }

    if (type === "permissions") {
      const entry = entriesByPath.get(paths[0]);
      setPermissionsValue(entry?.permissions ?? "755");
    }

    if (type === "compress") {
      setCompressName(`archive-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`);
    }

    setModalState(type);
  };

  const activatePathBar = () => {
    setPathBarValue(currentPath);
    setPathBarEditing(true);
    setTimeout(() => {
      pathInputRef.current?.select();
    }, 0);
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

  const clearSelection = () => {
    setSelectedEntryPath(null);
    setSelectedPaths([]);
    setSelectionAnchorIndex(null);
  };

  const applyRangeSelection = (targetPath: string) => {
    const targetIdx = entryIndexByPath.get(targetPath);
    if (targetIdx === undefined) return;

    const anchorIdx = selectionAnchorIndex ?? targetIdx;
    const from = Math.min(anchorIdx, targetIdx);
    const to = Math.max(anchorIdx, targetIdx);
    const rangePaths = sortedEntries.slice(from, to + 1).map((entry) => entry.path);

    setSelectedPaths(rangePaths);
    setSelectedEntryPath(targetPath);
  };

  const toggleEntrySelection = (entryPath: string, checked?: boolean) => {
    setSelectedPaths((prev) => {
      const has = prev.includes(entryPath);
      const shouldAdd = checked === undefined ? !has : checked;
      if (shouldAdd && !has) return [...prev, entryPath];
      if (!shouldAdd && has) return prev.filter((p) => p !== entryPath);
      return prev;
    });
    setSelectedEntryPath(entryPath);
    const idx = entryIndexByPath.get(entryPath);
    if (typeof idx === "number") {
      setSelectionAnchorIndex(idx);
    }
  };

  const selectOnly = (entryPath: string) => {
    setSelectedEntryPath(entryPath);
    setSelectedPaths([entryPath]);
    const idx = entryIndexByPath.get(entryPath);
    if (typeof idx === "number") {
      setSelectionAnchorIndex(idx);
    }
  };

  const handleEntryClick = (
    event: React.MouseEvent,
    entryPath: string,
    opts?: { allowToggle?: boolean },
  ) => {
    if (dragRef.current.moved) return;

    const idx = entryIndexByPath.get(entryPath);
    if (idx === undefined) return;

    if (event.shiftKey) {
      applyRangeSelection(entryPath);
      return;
    }

    if (event.metaKey || event.ctrlKey || opts?.allowToggle) {
      toggleEntrySelection(entryPath);
      return;
    }

    selectOnly(entryPath);
  };

  const startDragSelect = (entryPath: string, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;

    const target = event.target as HTMLElement;
    if (target.closest("input,button,a")) return;

    dragRef.current.mouseDown = true;
    dragRef.current.moved = false;
    dragRef.current.startPath = entryPath;
    dragRef.current.mode = selectedPaths.includes(entryPath) ? "remove" : "add";
    dragRef.current.visited.clear();
  };

  const applyDragOnPath = (entryPath: string) => {
    if (dragRef.current.visited.has(entryPath)) return;

    dragRef.current.visited.add(entryPath);
    setSelectedPaths((prev) => {
      if (dragRef.current.mode === "add") {
        if (prev.includes(entryPath)) return prev;
        return [...prev, entryPath];
      }
      return prev.filter((p) => p !== entryPath);
    });
    setSelectedEntryPath(entryPath);
  };

  const continueDragSelect = (entryPath: string) => {
    if (!dragRef.current.mouseDown) return;

    if (entryPath !== dragRef.current.startPath) {
      if (!dragRef.current.moved && dragRef.current.startPath) {
        dragRef.current.moved = true;
        applyDragOnPath(dragRef.current.startPath);
      }
      applyDragOnPath(entryPath);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, entryPath: string) => {
    event.preventDefault();

    if (!selectedPaths.includes(entryPath)) {
      selectOnly(entryPath);
    }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      entryPath,
    });
  };

  const handleOpen = (entry: ServerFileEntry) => {
    if (entry.isDirectory) {
      navigate(normalizePath(entry.path));
      return;
    }
    setSelectedEntryPath(entry.path);
    setSelectedPaths([entry.path]);
  };

  const handleDownload = (paths: string[]) => {
    if (paths.length === 0) return;
    void runAction(async () => {
      if (paths.length === 1) {
        await downloadServerEntry(paths[0]);
      } else {
        await downloadServerEntriesArchive(paths, `download-${Date.now()}`);
      }
    }, `${paths.length} item(s) downloaded`);
  };

  const submitDelete = () => {
    if (modalPaths.length === 0) return;
    void runAction(async () => {
      if (modalPaths.length === 1) {
        await deleteServerEntry(modalPaths[0]);
      } else {
        await deleteServerEntries(modalPaths);
      }
      clearSelection();
    }, `${modalPaths.length} item(s) deleted`);
  };

  const submitRename = () => {
    if (modalPaths.length !== 1 || !renameValue.trim()) return;
    const current = entriesByPath.get(modalPaths[0]);
    if (current && current.name === renameValue.trim()) {
      setModalState("none");
      return;
    }

    void runAction(async () => {
      await renameServerEntry(modalPaths[0], renameValue.trim());
    }, "Item renamed");
  };

  const submitPermissions = () => {
    if (!/^[0-7]{3,4}$/.test(permissionsValue.trim())) {
      showToast({
        type: "warning",
        title: "Invalid permissions",
        subtitle: "Use octal format, e.g. 644 or 755",
      });
      return;
    }

    void runAction(async () => {
      if (modalPaths.length === 1) {
        await setServerEntryPermissions(modalPaths[0], permissionsValue.trim());
      } else {
        await setServerEntriesPermissions(modalPaths, permissionsValue.trim());
      }
    }, "Permissions updated");
  };

  const submitCompress = () => {
    if (modalPaths.length === 0) return;
    void runAction(async () => {
      await compressServerEntries(modalPaths, compressName.trim());
    }, "Archive created");
  };

  const SORT_LABELS: Record<SortMode, string> = { name: "Name", updated: "Date", size: "Size" };
  const SORT_ORDER: SortMode[] = ["name", "updated", "size"];
  const nextSort = () => setSortMode((m) => SORT_ORDER[(SORT_ORDER.indexOf(m) + 1) % SORT_ORDER.length]);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-sm text-slate-200">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

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
          onClick={() => {
            if (canGoUp) navigate(getParentPath(currentPath));
          }}
          disabled={!canGoUp}
          title="Parent directory"
        >
          <HiOutlineArrowUp className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-700" />

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
                onChange={(e) => {
                  setPathBarValue(e.target.value);
                  setPathBarError(false);
                  setSuggestionIdx(-1);
                }}
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
                    if (pick) {
                      void navigateToSuggestion(pick.path);
                    } else {
                      void commitPathBar();
                    }
                  } else if (e.key === "Escape") {
                    if (suggestions.length > 0) {
                      setSuggestions([]);
                      setSuggestionIdx(-1);
                    } else {
                      cancelPathBar();
                    }
                  }
                }}
                onBlur={handlePathBarBlur}
                spellCheck={false}
                autoFocus
              />
              {pathBarError && <span className="ml-2 shrink-0 text-xs text-red-400">Path not found</span>}
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
                      onDoubleClick={() => {
                        void navigateToSuggestion(s.path);
                      }}
                    >
                      <FaFolder className="shrink-0 text-white/50" />
                      <span className="flex-1 truncate font-mono">{s.name}</span>
                      <span className="shrink-0 text-[10px] text-zinc-600">open</span>
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(crumb.path);
                    }}
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
          onClick={() => {
            void refresh();
          }}
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

        <div className="flex overflow-hidden rounded border border-zinc-700">
          <button
            className={`px-2 py-1 transition-colors ${
              viewMode === "list"
                ? "bg-zinc-700 text-white"
                : "text-slate-500 hover:bg-zinc-800 hover:text-slate-300"
            }`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <HiOutlineBars3 className="h-4 w-4" />
          </button>
          <button
            className={`px-2 py-1 transition-colors ${
              viewMode === "grid"
                ? "bg-zinc-700 text-white"
                : "text-slate-500 hover:bg-zinc-800 hover:text-slate-300"
            }`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <HiOutlineSquares2X2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs">
        <button
          className="rounded bg-zinc-800 px-2.5 py-1 text-slate-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionBusy || selectedActionPaths.length === 0}
          onClick={() => openModal("confirm-delete", selectedActionPaths)}
        >
          Delete
        </button>
        <button
          className="rounded bg-zinc-800 px-2.5 py-1 text-slate-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionBusy || selectedActionPaths.length === 0}
          onClick={() => handleDownload(selectedActionPaths)}
        >
          Download
        </button>
        <button
          className="rounded bg-zinc-800 px-2.5 py-1 text-slate-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionBusy || selectedActionPaths.length === 0}
          onClick={() => openModal("compress", selectedActionPaths)}
        >
          Compress
        </button>
        <button
          className="rounded bg-zinc-800 px-2.5 py-1 text-slate-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionBusy || selectedActionPaths.length !== 1}
          onClick={() => openModal("rename", selectedActionPaths)}
        >
          Rename
        </button>
        <button
          className="rounded bg-zinc-800 px-2.5 py-1 text-slate-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionBusy || selectedActionPaths.length === 0}
          onClick={() => openModal("permissions", selectedActionPaths)}
        >
          Permissions
        </button>

        <div className="ml-auto flex items-center gap-2 text-zinc-500">
          <span>{selectedActionPaths.length} selected</span>
          {selectedActionPaths.length > 0 && (
            <button className="underline hover:text-zinc-300" onClick={clearSelection}>
              clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">Loading...</div>
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
                <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700" onClick={() => navigate("/")}>
                  Go to /
                </button>
              </div>
            </div>
          ) : sortedEntries.length === 0 && hiddenEntries.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-600">Empty directory.</div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {sortedEntries.length === 0 && hiddenEntries.length > 0 ? (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-600">
                  No visible files.
                  <button
                    className="ml-1 text-zinc-400 underline-offset-2 hover:text-slate-200 hover:underline"
                    onClick={toggleShowHidden}
                  >
                    Show {hiddenEntries.length} hidden
                  </button>
                </div>
              ) : viewMode === "list" ? (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 text-left text-slate-500">
                      <tr>
                        <th className="w-10 px-2 py-2 font-medium">
                          <input
                            type="checkbox"
                            checked={sortedEntries.length > 0 && selectedPaths.length === sortedEntries.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPaths(sortedEntries.map((entry) => entry.path));
                              } else {
                                clearSelection();
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="w-20 px-4 py-2 font-medium">Type</th>
                        <th className="w-24 px-4 py-2 font-medium">Size</th>
                        <th className="w-40 px-4 py-2 font-medium">Modified</th>
                        <th className="w-28 px-4 py-2 font-medium">Permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hiddenEntries.length > 0 && (
                        <tr className="border-b border-zinc-800/40 bg-zinc-900/30">
                          <td colSpan={6} className="px-4 py-1.5">
                            <span className="text-zinc-600 italic">
                              {showHidden
                                ? `${hiddenEntries.length} hidden file${hiddenEntries.length !== 1 ? "s" : ""} visible -`
                                : `${hiddenEntries.length} hidden file${hiddenEntries.length !== 1 ? "s" : ""} -`}
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
                            selectedPaths.includes(entry.path)
                              ? "bg-blue-500/10 text-slate-100"
                              : "text-slate-300 hover:bg-zinc-800/50"
                          }`}
                          onContextMenu={(e) => handleContextMenu(e, entry.path)}
                          onMouseDown={(e) => startDragSelect(entry.path, e)}
                          onMouseEnter={() => continueDragSelect(entry.path)}
                          onClick={(e) => handleEntryClick(e, entry.path)}
                          onDoubleClick={() => handleOpen(entry)}
                        >
                          <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedPaths.includes(entry.path)}
                              onChange={(e) => toggleEntrySelection(entry.path, e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex min-w-0 items-center gap-2">
                              {entry.isDirectory ? (
                                <FaFolder className="shrink-0 text-white/70" />
                              ) : (
                                <FaFile className="shrink-0 text-white/50" />
                              )}
                              <button
                                className="truncate text-left hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpen(entry);
                                }}
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
                <div className="flex flex-1 flex-col overflow-hidden">
                  {hiddenEntries.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/60 px-4 py-1.5 text-xs">
                      <span className="italic text-zinc-600">
                        {hiddenEntries.length} hidden file{hiddenEntries.length !== 1 ? "s" : ""}
                        {showHidden ? " visible" : ""} -
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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                      {sortedEntries.map((entry) => (
                        <button
                          key={entry.path}
                          className={`relative flex flex-col items-center gap-2 rounded p-2.5 text-center transition-colors ${
                            selectedPaths.includes(entry.path)
                              ? "bg-blue-500/15 ring-1 ring-blue-400/30"
                              : "hover:bg-zinc-800"
                          }`}
                          onContextMenu={(e) => handleContextMenu(e, entry.path)}
                          onMouseDown={(e) => startDragSelect(entry.path, e)}
                          onMouseEnter={() => continueDragSelect(entry.path)}
                          onClick={(e) => handleEntryClick(e, entry.path)}
                          onDoubleClick={() => handleOpen(entry)}
                        >
                          <input
                            className="absolute left-2 top-2"
                            type="checkbox"
                            checked={selectedPaths.includes(entry.path)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleEntrySelection(entry.path, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />

                          {entry.isDirectory ? (
                            <FaFolder className="h-10 w-10 text-white/70" />
                          ) : (
                            <FaFile className="h-10 w-10 text-white/50" />
                          )}

                          <span
                            className="min-h-[2.2rem] w-full text-[11px] leading-tight text-slate-300"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                          >
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

        <aside className="w-72 shrink-0 overflow-auto border-l border-zinc-800 bg-zinc-900">
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
                <p className="max-w-full break-all text-center text-xs font-semibold text-slate-100">{selectedEntry.name}</p>
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

              {!selectedEntry.isDirectory && selectedCount === 1 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                    Preview (max {previewMaxMb} MB)
                  </p>
                  <div className="max-h-[22rem] overflow-auto rounded border border-zinc-700 bg-zinc-950 p-2">
                    {previewLoading ? (
                      <p className="text-xs text-zinc-500">Loading...</p>
                    ) : previewError ? (
                      <p className="text-xs text-red-300">{previewError}</p>
                    ) : previewKind === "text" ? (
                      <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-400">{previewText}</pre>
                    ) : previewKind === "image" && previewUrl ? (
                      <img src={previewUrl} alt={selectedEntry.name} className="h-auto max-w-full rounded" />
                    ) : previewKind === "pdf" && previewUrl ? (
                      <iframe title="PDF preview" src={previewUrl} className="h-80 w-full rounded border border-zinc-800" />
                    ) : previewKind === "too-large" ? (
                      <p className="text-xs text-zinc-500">File exceeds preview limit.</p>
                    ) : previewKind === "unsupported" ? (
                      <p className="text-xs text-zinc-500">Preview not supported for this file type.</p>
                    ) : (
                      <p className="text-xs text-zinc-600">Select a file to preview.</p>
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

      <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-0.5 text-[10px] text-zinc-500">
        <span>
          {sortedEntries.length} item{sortedEntries.length !== 1 ? "s" : ""}
        </span>
        <span>{selectedCount} selected</span>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[110] min-w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
            Quick actions ({selectedActionPaths.length})
          </div>
          <button
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-zinc-800"
            onClick={() => {
              setContextMenu(null);
              handleDownload(selectedActionPaths);
            }}
          >
            Download
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-zinc-800"
            onClick={() => openModal("compress", selectedActionPaths)}
          >
            Compress
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-zinc-800 disabled:opacity-50"
            disabled={selectedActionPaths.length !== 1}
            onClick={() => openModal("rename", selectedActionPaths)}
          >
            Rename
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-zinc-800"
            onClick={() => openModal("permissions", selectedActionPaths)}
          >
            Permissions
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-xs text-red-300 transition hover:bg-red-500/10"
            onClick={() => openModal("confirm-delete", selectedActionPaths)}
          >
            Delete
          </button>
        </div>
      )}

      {modalState === "confirm-delete" && (
        <ActionModal
          title="Delete selection"
          subtitle={`You are about to delete ${modalPaths.length} item(s). This cannot be undone.`}
          onClose={() => setModalState("none")}
          onSubmit={submitDelete}
          submitLabel="Delete"
          submitDisabled={modalPaths.length === 0}
          busy={actionBusy}
          danger
        />
      )}

      {modalState === "rename" && (
        <ActionModal
          title="Rename item"
          subtitle="Provide a new name for the selected item."
          onClose={() => setModalState("none")}
          onSubmit={submitRename}
          submitLabel="Save"
          submitDisabled={!renameValue.trim() || modalPaths.length !== 1}
          busy={actionBusy}
        >
          <div>
            <label className="mb-1 block text-xs text-slate-400">New name</label>
            <input
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
        </ActionModal>
      )}

      {modalState === "permissions" && (
        <ActionModal
          title="Update permissions"
          subtitle={`Apply octal permissions to ${modalPaths.length} item(s).`}
          onClose={() => setModalState("none")}
          onSubmit={submitPermissions}
          submitLabel="Apply"
          submitDisabled={!permissionsValue.trim()}
          busy={actionBusy}
        >
          <div>
            <label className="mb-1 block text-xs text-slate-400">Permissions (octal)</label>
            <input
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono text-slate-100 outline-none"
              value={permissionsValue}
              onChange={(e) => setPermissionsValue(e.target.value)}
              placeholder="755"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-zinc-500">Examples: 644, 755, 775</p>
          </div>
        </ActionModal>
      )}

      {modalState === "compress" && (
        <ActionModal
          title="Create archive"
          subtitle={`Compress ${modalPaths.length} item(s) into a .tar.gz archive.`}
          onClose={() => setModalState("none")}
          onSubmit={submitCompress}
          submitLabel="Create"
          submitDisabled={modalPaths.length === 0}
          busy={actionBusy}
        >
          <div>
            <label className="mb-1 block text-xs text-slate-400">Archive name</label>
            <input
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={compressName}
              onChange={(e) => setCompressName(e.target.value)}
              placeholder="archive-name"
              autoFocus
            />
          </div>
        </ActionModal>
      )}
    </div>
  );
}
