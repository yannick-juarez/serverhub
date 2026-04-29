import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { FaFileCsv } from "react-icons/fa";
import { HiOutlineFolderArrowDown, HiOutlineXMark } from "react-icons/hi2";
import { HiOutlineDatabase } from "react-icons/hi";
import { TbApi } from "react-icons/tb";
import { IoIosGlobe, IoMdGitBranch } from "react-icons/io";
import { LuTable } from "react-icons/lu";
import { Scrollbar } from "smooth-scrollbar-react";
import { fetchConnections, type Connection, type ConnectionsResponse, type DatabaseConnection, type SSHConnection } from "../../api/connections";
import { uploadSampleFiles } from "../../api/upload";
import useDocumentTitle from "../../hooks/useDocumentTitle";

// ── Data source catalogue ──────────────────────────────────────────────────────
interface DataSource {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  showBrowse?: boolean;
  comingSoon?: boolean;
  beta?: boolean;
}

interface DataSourceGroup {
  name: string;
  description: string;
  sources: DataSource[];
}

const dataSourceGroups: DataSourceGroup[] = [
  {
    name: "Web Services",
    description: "Connect to external web services and APIs to fetch data in real-time",
    sources: [
      {
        id: "rest-api",
        icon: <TbApi className="text-2xl" />,
        title: "REST API",
        description: "Integrate with web services and APIs to fetch data in real-time",
        showBrowse: true,
      },
      {
        id: "web-scraper",
        icon: <IoIosGlobe className="text-2xl" />,
        title: "Web Scraper",
        description: "Extract data from web pages and websites (social media, news sites, etc.)",
        showBrowse: true,
      },
    ],
  },
  {
    name: "Databases",
    description: "Connect to relational databases and data warehouses to access structured data",
    sources: [
      {
        id: "database",
        icon: <HiOutlineDatabase className="text-xl mb-1" />,
        title: "Database",
        description: "Connect to relational databases (MySQL, PostgreSQL, SQL Server)",
      },
    ],
  },
  {
    name: "Files & Storage",
    description: "Import data from files and cloud storage services for analysis and processing",
    sources: [
      {
        id: "table-file",
        icon: <LuTable className="text-2xl" />,
        title: "Table File",
        description: "Import data from CSV, Excel, and other tabular file formats",
        showBrowse: true,
        beta: true,
      },
      {
        id: "ftp-sftp",
        icon: <HiOutlineFolderArrowDown className="text-2xl" />,
        title: "FTP / SFTP",
        description: "Transfer files using standard or SSL encrypted FTP protocols",
        comingSoon: true,
      },
      {
        id: "git-source",
        icon: <IoMdGitBranch className="text-2xl" />,
        title: "Git Source",
        description: "Connect to Git repositories and fetch data from version control systems",
        showBrowse: true,
      },
    ],
  },
];

// ── DataSourceCard ─────────────────────────────────────────────────────────────
interface DataSourceCardProps {
  source: DataSource;
  onCreate: (source: DataSource) => void;
}

const DataSourceCard = ({ source, onCreate }: DataSourceCardProps) => (
  <div className="group relative flex h-full flex-col justify-between rounded-lg border border-white/10 bg-black/35 p-4 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-white/20">
    <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/5 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className="flex flex-row items-start justify-between gap-3">
      <div className="flex items-center gap-3 text-slate-200">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg">
          {source.icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{source.title}</h3>
          <p className="text-xs text-slate-400">{source.description}</p>
        </div>
      </div>
      {(source.comingSoon ?? source.beta) ? (
        <div className="absolute right-2 top-2 flex gap-2">
          {source.comingSoon ? (
            <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200">
              Coming soon
            </span>
          ) : null}
          {source.beta ? (
            <span className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
              Experimental
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
    <div className="relative mt-4 flex gap-2">
      <button
        disabled={source.comingSoon}
        onClick={() => onCreate(source)}
        className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:opacity-40"
      >
        {source.id === "table-file" ? "New Table File" : "Create"}
      </button>
      {source.showBrowse ? (
        <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
          Browse
        </button>
      ) : null}
    </div>
  </div>
);

// ── ConnectionPanel ────────────────────────────────────────────────────────────
interface ConnectionPanelProps {
  connections: Connection[];
  type: "ssh" | "db";
}

const ConnectionPanel = ({ connections, type }: ConnectionPanelProps) => (
  <div className="flex flex-col gap-2">
    {connections.map((item) => {
      const key =
        type === "ssh"
          ? (item as SSHConnection).ssh_id ?? item.name
          : (item as DatabaseConnection).db_id ?? item.name;
      return (
        <div
          key={`${type}-${key}`}
          className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-1 pr-3 transition hover:bg-white/10"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
                {type === "ssh" ? (
                  <HiOutlineFolderArrowDown className="h-4 w-4" />
                ) : (
                  <HiOutlineDatabase className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.name}</p>
                <p className="text-xs uppercase text-slate-400">{type}</p>
              </div>
            </div>
            {type === "db" ? (
              <a
                href={`/database/${(item as DatabaseConnection).db_id ?? ""}`}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Browse
              </a>
            ) : (
              <button className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                Connect
              </button>
            )}
          </div>
        </div>
      );
    })}
    {connections.length === 0 ? (
      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
        No matching sources.
      </div>
    ) : null}
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SourcesPage() {
  useDocumentTitle("SOURCES - SERVERHUB");

  const [existingQuery, setExistingQuery] = useState("");
  const [isBrowsePanelOpen, setIsBrowsePanelOpen] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDestination, setUploadDestination] = useState("/");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [connections, setConnections] = useState<ConnectionsResponse>({ db: [], ssh: [] });
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");

  const loadConnections = async () => {
    setIsLoadingConnections(true);
    setConnectionsError("");
    try {
      const data = await fetchConnections();
      setConnections(data);
    } catch {
      setConnectionsError("Unable to load connections.");
    } finally {
      setIsLoadingConnections(false);
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  const isCsvFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
  };

  const handleFileSelected = (files: File[] | null) => {
    setUploadError("");
    setUploadSuccess("");
    if (!files || !files.length) { setSelectedFiles([]); return; }
    const invalid = files.find((f) => !isCsvFile(f));
    if (invalid) { setSelectedFiles([]); setUploadError("Only CSV files are supported for now."); return; }
    setSelectedFiles(files);
  };

  const openUploadModal = () => {
    setUploadDestination("/");
    setSelectedFiles([]);
    setUploadError("");
    setUploadSuccess("");
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setIsUploadModalOpen(false);
    setIsDragActive(false);
  };

  const handleCreateSource = (source: DataSource) => {
    if (source.id === "table-file") openUploadModal();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    handleFileSelected(Array.from(event.dataTransfer.files ?? []));
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(Array.from(event.target.files ?? []));
  };

  const submitUpload = async () => {
    setUploadError("");
    setUploadSuccess("");
    if (!selectedFiles.length) { setUploadError("Please choose one or more CSV files."); return; }
    setIsUploading(true);
    try {
      const response = await uploadSampleFiles({ files: selectedFiles, destination: uploadDestination.trim() || "/" });
      setUploadSuccess(`Uploaded ${response.count} file${response.count > 1 ? "s" : ""} to /api/samples${response.destination}`);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredConnections = useMemo(() => {
    const q = existingQuery.trim().toLowerCase();
    if (!q) return connections;
    return {
      db: connections.db.filter((c) => c.name.toLowerCase().includes(q)),
      ssh: connections.ssh.filter((c) => c.name.toLowerCase().includes(q)),
    };
  }, [existingQuery, connections]);

  const totalSources = connections.db.length + connections.ssh.length;
  const experimentalCount = dataSourceGroups.flatMap((g) => g.sources).filter((s) => s.beta).length;
  const comingSoonCount = dataSourceGroups.flatMap((g) => g.sources).filter((s) => s.comingSoon).length;

  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-36 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/60" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {/* Top bar */}
        <div className="flex flex-col gap-4 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Data Sources</p>
            <h1 className="text-2xl font-semibold">Create a Data Source</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{totalSources} existing sources</span>
            {experimentalCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{experimentalCount} experimental</span>
            ) : null}
            {comingSoonCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{comingSoonCount} coming soon</span>
            ) : null}
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <button
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 md:flex-none"
              onClick={() => setIsBrowsePanelOpen((prev) => !prev)}
            >
              {isBrowsePanelOpen ? "Hide sources" : "Browse sources"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-row">
          {/* Source catalogue */}
          <Scrollbar
            className="min-w-0 flex-1 overflow-y-auto px-6 py-6"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          >
            <div className="mx-auto flex flex-col gap-4">
              {dataSourceGroups.map((group) => (
                <section
                  key={group.name}
                  className="rounded-lg border border-gray-500/30 bg-gray-900/30 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{group.name}</h2>
                      <p className="text-sm text-slate-400">{group.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {group.sources.length} source{group.sources.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.sources.map((source) => (
                      <DataSourceCard key={source.id} source={source} onCreate={handleCreateSource} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Scrollbar>

          {/* Existing sources panel */}
          {isBrowsePanelOpen ? (
            <div className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-black/20 px-3 py-3">
              <div className="flex flex-row items-start justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-semibold">Browse Sources</h3>
                  <p className="text-xs text-slate-400">Your existing connections</p>
                </div>
                <button
                  className="m-1 text-slate-400 transition hover:text-slate-200"
                  onClick={() => setIsBrowsePanelOpen(false)}
                >
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
                <FaMagnifyingGlass className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sources…"
                  value={existingQuery}
                  onChange={(e) => setExistingQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                />
              </div>

              {connectionsError ? (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                  <span>{connectionsError}</span>
                  <button
                    className="ml-2 whitespace-nowrap rounded px-2 py-1 bg-rose-400/20 hover:bg-rose-400/30 transition"
                    onClick={() => { void loadConnections(); }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {isLoadingConnections ? (
                <div className="mb-3 text-xs text-slate-400">Loading connections…</div>
              ) : null}

              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-wider text-slate-400">SSH</h4>
                <span className="text-xs text-slate-500">{filteredConnections.ssh.length}</span>
              </div>
              <ConnectionPanel connections={filteredConnections.ssh} type="ssh" />

              <div className="mb-1 mt-4 flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-wider text-slate-400">Databases</h4>
                <span className="text-xs text-slate-500">{filteredConnections.db.length}</span>
              </div>
              <ConnectionPanel connections={filteredConnections.db} type="db" />
            </div>
          ) : null}
        </div>
      </div>

      {/* CSV upload modal */}
      {isUploadModalOpen ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={closeUploadModal}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-white/20 bg-black/90 px-5 py-4 shadow-[0_0px_250px_rgba(180,180,180,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">New Table File</h3>
                <p className="text-sm text-slate-400">Upload a CSV file and store it under /api/samples.</p>
              </div>
              <button className="text-slate-400 transition hover:text-slate-200" onClick={closeUploadModal}>
                <HiOutlineXMark className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Destination
              </label>
              <input
                type="text"
                placeholder="/here"
                value={uploadDestination}
                onChange={(e) => setUploadDestination(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
              />
              <p className="mt-1 text-xs text-slate-500">Files will be accessible via /api/samples{uploadDestination || "/"}</p>
            </div>

            <div
              className={`rounded-xl border border-dashed p-6 text-center transition ${
                isDragActive ? "border-white/40 bg-white/10" : "border-white/20 bg-white/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
            >
              <FaFileCsv className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-200">Drag & drop CSV files here</p>
              <p className="mt-1 text-xs text-slate-500">Only CSV is enabled for now (multi-upload supported).</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                className="mt-4 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </button>
            </div>

            {selectedFiles.length > 0 ? (
              <div className="mt-3 space-y-1">
                {selectedFiles.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100">
                    <FaFileCsv className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            ) : null}

            {uploadError ? (
              <p className="mt-3 text-sm text-rose-300">{uploadError}</p>
            ) : null}
            {uploadSuccess ? (
              <p className="mt-3 text-sm text-emerald-300">{uploadSuccess}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                onClick={closeUploadModal}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-50"
                disabled={isUploading || !selectedFiles.length}
                onClick={() => { void submitUpload(); }}
              >
                {isUploading ? "Uploading…" : `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ""} file${selectedFiles.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
