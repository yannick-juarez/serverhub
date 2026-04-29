import { HiOutlineFolderArrowDown } from "react-icons/hi2";
import { HiOutlineDatabase } from "react-icons/hi";
import { TbApi } from "react-icons/tb";
import { IoIosGlobe } from "react-icons/io";
import { IoMdGitBranch } from "react-icons/io";
import { LuTable } from "react-icons/lu";

import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { Scrollbar } from "smooth-scrollbar-react";
import { uploadSampleFiles } from "../api/upload";
import { FaFileCsv } from "react-icons/fa";

import { fetchConnections, ConnectionsResponse, Connection, DatabaseConnection, SSHConnection } from "../api/connections";

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
                title: "FTP/SFTP",
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

interface DataSourceCardProps {
    source: DataSource;
    onCreate: (source: DataSource) => void;
}

const DataSourceCard = ({ source, onCreate }: DataSourceCardProps) => (
    <div className="group relative flex h-full flex-col justify-between rounded-lg border border-white/10 bg-black/35 p-4 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-white/20">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/5 to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-slate-200 mt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg">
                    {source.icon}
                </div>
                <div>
                    <h3 className="text-sm font-semibold">{source.title}</h3>
                    <p className="text-xs text-slate-400">{source.description}</p>
                </div>
            </div>

            {(source.comingSoon || source.beta) && (
                <div className="absolute right-2 top-2 flex gap-2">
                    {source.comingSoon && (
                        <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200">
                            Coming soon
                        </span>
                    )}
                    {source.beta && (
                        <span className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
                            Experimental
                        </span>
                    )}
                </div>
            )}
        </div>
        <div className="relative mt-4 flex gap-2">
            <button
                onClick={() => onCreate(source)}
                className="flex-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white"
            >
                {source.id === "table-file" ? "New Table File" : "Create"}
            </button>
            {source.showBrowse && (
                <button className="flex-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                    Browse
                </button>
            )}
        </div>
    </div>
);

const DataSourcesPage = () => {
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

    useEffect(() => {
        const loadConnections = async () => {
            setIsLoadingConnections(true);
            setConnectionsError("");
            try {
                const data = await fetchConnections();
                setConnections(data);
            } catch (error) {
                console.error("Error fetching connections:", error);
                setConnectionsError("Unable to load connections.");
            } finally {
                setIsLoadingConnections(false);
            }
        };
        loadConnections();
    }, []);

    const isCsvFile = (file: File) => {
        const lowerName = file.name.toLowerCase();
        return lowerName.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
    };

    const handleFileSelected = (files: File[] | null) => {
        setUploadError("");
        setUploadSuccess("");

        if (!files || files.length === 0) {
            setSelectedFiles([]);
            return;
        }

        const invalidFile = files.find((file) => !isCsvFile(file));
        if (invalidFile) {
            setSelectedFiles([]);
            setUploadError("Only CSV files are supported for now.");
            return;
        }

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
        if (isUploading) {
            return;
        }
        setIsUploadModalOpen(false);
        setIsDragActive(false);
    };

    const handleCreateSource = (source: DataSource) => {
        if (source.id === "table-file") {
            openUploadModal();
        }
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragActive(false);
        const files = Array.from(event.dataTransfer.files || []);
        handleFileSelected(files);
    };

    const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        handleFileSelected(files);
    };

    const submitUpload = async () => {
        setUploadError("");
        setUploadSuccess("");

        if (!selectedFiles.length) {
            setUploadError("Please choose one or more CSV files.");
            return;
        }

        setIsUploading(true);
        try {
            const response = await uploadSampleFiles({
                files: selectedFiles,
                destination: uploadDestination.trim() || "/",
            });
            setUploadSuccess(`Uploaded ${response.count} file${response.count > 1 ? "s" : ""} to /api/samples${response.destination}`);
            setSelectedFiles([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed.";
            setUploadError(message);
        } finally {
            setIsUploading(false);
        }
    };

    const filteredExistingSources = useMemo(() => {
        const query = existingQuery.trim().toLowerCase();
        if (!query) {
            return connections;
        }
        return {
            db: connections.db.filter((item) => item.name.toLowerCase().includes(query)),
            ssh: connections.ssh.filter((item) => item.name.toLowerCase().includes(query)),
        };
    }, [existingQuery, connections]);

    interface ConnectionPanelProps {
        connections: Connection[];
        type: "ssh" | "db";
    }

    const ConnectionPanel = ({ connections, type }: ConnectionPanelProps) => {
        return (
            <Scrollbar className="max-h-[calc(100vh-340px)] min-h-20 flex flex-col gap-2 pr-1">
                {connections.map((item: Connection) => (
                    <div key={`${type}-${type === "ssh" ? (item as SSHConnection).ssh_id : type === "db" ? (item as DatabaseConnection).db_id : item.name}`} className="rounded-lg border border-white/10 bg-white/5 p-1 pr-3 hover:bg-white/10 transition cursor-pointer">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
                                    {type === "ssh" ? (
                                        <HiOutlineFolderArrowDown className="h-4 w-4" />
                                    ) : type === "db" ? (
                                        <HiOutlineDatabase className="h-4 w-4" />
                                    ) : type === "table-file" ? (
                                        <LuTable className="h-4 w-4" />
                                    ) : null}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">{item.name}</p>
                                    <p className="text-xs text-slate-400 uppercase">{type}</p>
                                </div>
                            </div>
                            {type === "ssh" ? (
                                <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                                    Connect
                                </button>
                            ) : type === "db" ? (
                                <a href={`/database/${(item as DatabaseConnection).db_id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                                    Browse
                                </a>
                            ) : type === "table-file" ? (
                                <button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                                    View
                                </button>
                            ) : null}
                        </div>
                    </div>
                ))}
                {connections.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                        No matching sources.
                    </div>
                ) : null}
            </Scrollbar>
        );
    };

    return (
        <div className="relative h-full w-full overflow-hidden text-white">
            <div className="absolute inset-0">
                <div className="absolute -left-28 -top-36 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/60" />
            </div>
            <div className="relative z-10 flex h-full flex-col">
                <div className="flex flex-col gap-4 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Data Sources</p>
                        <h1 className="text-2xl font-semibold">Create a Data Source</h1>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">6 sources</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">2 experimental</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">1 coming soon</span>
                    </div>
                    <div className="flex w-full gap-2 md:w-auto">
                        <button
                            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 md:flex-none"
                            onClick={() => setIsBrowsePanelOpen((prev) => !prev)}
                        >
                            {isBrowsePanelOpen ? "Hide sources" : "Browse sources"}
                        </button>
                        <button className="flex-1 rounded-lg bg-white/90 border border-black px-4 py-2 text-sm font-semibold text-black transition hover:bg-white md:flex-none">
                            New source
                        </button>
                    </div>
                </div>
                <div className="flex flex-row h-full">
                    <Scrollbar
                        className="flex-1 min-w-0 overflow-y-auto px-6 py-6"
                        style={{
                            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
                            backgroundSize: "26px 26px",
                        }}
                    >
                        <div className="mx-auto flex flex-col gap-3">
                            {dataSourceGroups.map((group) => (
                                <section
                                    key={group.name}
                                    className="rounded-lg border border-gray-500/30 bg-gray-900/30 backdrop-blur-sm px-4 py-3 mb-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">{group.name}</h2>
                                            <p className="text-sm text-slate-400">{group.description}</p>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                            {group.sources.length} sources
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
                    {/* Right panel - Existing sources browser */}
                    {isBrowsePanelOpen && <div className="w-1/4 border-l border-white/10 bg-black/20 px-3 py-3 overflow-y-auto">
                        <div className="border-b border-white/10 pb-3 flex flex-row items-start justify-between">
                            <div className="">
                                <h3 className="text-lg font-semibold">Browse Data Sources</h3>
                                <p className="text-sm text-slate-400">View and manage your existing data sources</p>
                            </div>
                            {/* close button */}
                            <button className="text-slate-400 hover:text-slate-200 transition m-1" onClick={() => setIsBrowsePanelOpen(false)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {/* Search bar */}
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
                            <FaMagnifyingGlass className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search sources..."
                                value={existingQuery}
                                onChange={(event) => setExistingQuery(event.target.value)}
                                className="flex-1 outline-none bg-transparent text-sm text-slate-200 placeholder:text-slate-500"
                            />
                        </div>
                        {connectionsError ? (
                            <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                                <span>{connectionsError}</span>
                                <button
                                    onClick={() => {
                                        setIsLoadingConnections(true);
                                        setConnectionsError("");
                                        fetchConnections()
                                            .then(setConnections)
                                            .catch(() => setConnectionsError("Unable to load connections."))
                                            .finally(() => setIsLoadingConnections(false));
                                    }}
                                    className="ml-2 whitespace-nowrap rounded px-2 py-1 bg-rose-400/20 hover:bg-rose-400/30 transition"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : null}
                        {isLoadingConnections ? <div className="mb-3 text-xs text-slate-400">Loading connections...</div> : null}

                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs uppercase tracking-wider text-slate-400">SSH</h4>
                            <span className="text-xs text-slate-500">{filteredExistingSources.ssh.length}</span>
                        </div>
                        <ConnectionPanel connections={filteredExistingSources.ssh} type="ssh" />

                        <div className="mb-2 mt-4 flex items-center justify-between">
                            <h4 className="text-xs uppercase tracking-wider text-slate-400">Databases</h4>
                            <span className="text-xs text-slate-500">{filteredExistingSources.db.length}</span>
                        </div>
                        <ConnectionPanel connections={filteredExistingSources.db} type="db" />
                    </div>}
                </div>
                {isUploadModalOpen && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={closeUploadModal}>
                        <div
                            className="w-full max-w-2xl rounded-xl border border-white/20 bg-black/90 px-5 py-3 shadow-[0_0px_250px_rgba(180,180,180,0.3)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold">New Table File</h3>
                                    <p className="text-sm text-slate-400">Upload a CSV file and store it under /api/samples.</p>
                                </div>
                                <button
                                    className="text-slate-400 hover:text-slate-200 transition"
                                    onClick={closeUploadModal}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="mb-4">
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Destination</label>
                                <input
                                    type="text"
                                    placeholder="/here"
                                    value={uploadDestination}
                                    onChange={(event) => setUploadDestination(event.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
                                />
                                <p className="mt-1 text-xs text-slate-500">Your workspace - (Future feature: specify a project)</p>
                            </div>

                            <div
                                className={`rounded-xl border border-dashed p-6 text-center transition ${isDragActive ? "border-white/40 bg-white/10" : "border-white/20 bg-white/5"}`}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragActive(true);
                                }}
                                onDragLeave={() => setIsDragActive(false)}
                                onDrop={handleDrop}
                            >
                                <p className="text-sm text-slate-200">Drag & drop a CSV file here</p>
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
                                    Choose file
                                </button>
                                {selectedFiles.length > 0 && (
                                    <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
                                        <div className="mb-2 flex items-center gap-2">
                                            <FaFileCsv className="text-emerald-400 w-5 h-5" />
                                            <p className="text-xs font-medium text-emerald-200">{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected</p>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                            {selectedFiles.map((file) => (
                                                <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-xs text-emerald-200/90">
                                                    <span className="truncate">{file.name}</span>
                                                    <span className="text-emerald-300/70">{(file.size / 1024).toFixed(2)} KB</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {uploadError && (
                                <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                                    {uploadError}
                                </div>
                            )}
                            {uploadSuccess && (
                                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                                    {uploadSuccess}
                                </div>
                            )}

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                                    onClick={closeUploadModal}
                                    disabled={isUploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded-lg border border-black bg-white/90 px-4 py-2 text-sm font-semibold text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={submitUpload}
                                    disabled={isUploading}
                                >
                                    {isUploading ? "Uploading..." : "Upload"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataSourcesPage;