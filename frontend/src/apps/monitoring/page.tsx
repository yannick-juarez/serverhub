import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  CpuChipIcon,
  ServerStackIcon,
  CircleStackIcon,
  SignalIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import {
  getAllMonitoringData,
  dropCaches,
  type SystemOverview,
  type CpuLoad,
  type Process,
} from "../../api/monitoring";

const REFRESH_INTERVAL = 5000;

const LIMIT_OPTIONS: { label: string; value: number }[] = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
  { label: "ALL", value: 0 },
];

type SortCol = "pid" | "name" | "user" | "state" | "cpu" | "mem";
type SortDir = "asc" | "desc";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatBytesPerSec(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bps;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
}

function arcColor(load: number): string {
  return load > 85 ? "#ef4444" : load > 60 ? "#f97316" : "#22c55e";
}

function loadBarColor(pct: number, defaultColor = "slate"): string {
  if (pct > 85) return "rose";
  if (pct > 60) return "orange";
  return defaultColor;
}

function LoadBar({ percent, color = "slate" }: { percent: number; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: "bg-slate-400",
    green: "bg-green-500",
    blue: "bg-blue-400",
    emerald: "bg-emerald-500",
    amber: "bg-amber-400",
    orange: "bg-orange-400",
    rose: "bg-rose-500",
  };
  const bar = colorMap[color] ?? "bg-slate-400";
  const pct = Math.min(Math.max(percent, 0), 100);
  const textColor = pct > 85 ? "text-rose-400" : pct > 60 ? "text-orange-400" : "text-white/70";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums w-10 text-right ${textColor}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function CoreGauge({ load, core }: { load: number; core: number }) {
  const r = 18;
  const cx = 24;
  const cy = 24;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(load, 0), 100) / 100);
  const color = arcColor(load);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="white" fontFamily="ui-monospace,monospace">
          {load.toFixed(0)}%
        </text>
      </svg>
      <span className="text-[10px] text-white/50">C{core}</span>
    </div>
  );
}

function Card({
  icon,
  title,
  headerRight,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-700/10 backdrop-blur-md p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/70">
          <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest">{title}</h2>
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

export default function MonitoringPage() {
  useDocumentTitle("MONITORING - INTERFACE");

  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [cpuLoad, setCpuLoad] = useState<CpuLoad | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>("cpu");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [limit, setLimit] = useState(20);
  const [coresOpen, setCoresOpen] = useState(false);
  const [wipingRam, setWipingRam] = useState(false);
  const [wipeResult, setWipeResult] = useState<string | null>(null);

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await getAllMonitoringData();
      setOverview(data.overview);
      setCpuLoad(data.cpuLoad);
      setProcesses(data.processes);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch monitoring data");
    } finally {
      setLoadingOverview(false);
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" || col === "user" || col === "state" ? "asc" : "desc");
    }
  };

  const sortedProcesses = useMemo(() => {
    const sorted = [...processes].sort((a, b) => {
      const av = a[sortCol as keyof Process];
      const bv = b[sortCol as keyof Process];
      if (typeof av === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv as string)
          : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return limit === 0 ? sorted : sorted.slice(0, limit);
  }, [processes, sortCol, sortDir, limit]);

  const memPct = overview
    ? parseFloat(((overview.memory.used / overview.memory.total) * 100).toFixed(1))
    : 0;
  const swapPct =
    overview && overview.memory.swapTotal > 0
      ? parseFloat(((overview.memory.swapUsed / overview.memory.swapTotal) * 100).toFixed(1))
      : 0;

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronUpDownIcon className="w-3 h-3 inline ml-0.5 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUpIcon className="w-3 h-3 inline ml-0.5 text-white/60" />
      : <ChevronDownIcon className="w-3 h-3 inline ml-0.5 text-white/60" />;
  }

  return (
    <div className="relative h-full w-full overflow-auto text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/60" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md md:flex-row md:items-center md:justify-between shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">
              {overview ? overview.os.hostname : "Monitoring"}
            </p>
            <h1 className="text-2xl font-semibold">System Monitoring</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-white/40">
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-4">
          {loadingOverview ? (
            <div className="flex h-64 items-center justify-center text-white/40 text-sm">Loading monitoring data…</div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center text-rose-400 text-sm">{error}</div>
          ) : overview ? (
            <div className="flex flex-col gap-4">
              {/* Row 1 – CPU + Memory + Disks + Network */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* CPU Overview */}
                <Card icon={<CpuChipIcon />} title="CPU">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-white/80 truncate">
                      {overview.cpu.manufacturer} {overview.cpu.brand}
                    </span>
                    <span className="text-xs text-white/40 shrink-0">{overview.cpu.speed} GHz</span>
                  </div>
                  <div>
                    <button
                      className="w-full flex items-center justify-between mb-1 group"
                      onClick={() => setCoresOpen((o) => !o)}
                    >
                      <span className="text-xs text-white/50 group-hover:text-white/70 transition">Overall load</span>
                      <ChevronDownIcon
                        className={`w-3 h-3 text-white/30 group-hover:text-white/50 transition-transform ${
                          coresOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <LoadBar percent={overview.cpu.loadPercent} color={loadBarColor(overview.cpu.loadPercent, "green")} />
                  </div>
                  {cpuLoad && coresOpen && (
                    <div className="flex flex-wrap gap-2 justify-start pt-1 border-t border-white/5">
                      {cpuLoad.cores.map(({ core, load }) => (
                        <CoreGauge key={core} core={core} load={load} />
                      ))}
                    </div>
                  )}
                </Card>

                {/* Memory */}
                <Card
                  icon={<CircleStackIcon />}
                  title="Memory"
                  headerRight={
                    <button
                      disabled={wipingRam}
                      onClick={async () => {
                        setWipingRam(true);
                        setWipeResult(null);
                        try {
                          const res = await dropCaches();
                          setWipeResult(`Freed ${formatBytes(res.freed)}`);
                          setTimeout(() => setWipeResult(null), 4000);
                          await fetchAll();
                        } catch {
                          setWipeResult("Failed");
                          setTimeout(() => setWipeResult(null), 3000);
                        } finally {
                          setWipingRam(false);
                        }
                      }}
                      className="flex flex-col items-center gap-0 rounded px-2 py-0.5 text-[10px] font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {wipingRam ? (
                        <ArrowPathIcon className="w-2.5 h-2.5 animate-spin" />
                      ) : null}
                      {wipeResult ?? "Wipe cache"}
                    </button>
                  }
                >
                  <div className="flex flex-col gap-0">
                    <div className="flex justify-between text-xs text-white/50">
                        <span>RAM</span>
                        <span>{formatBytes(overview.memory.used)} / {formatBytes(overview.memory.total)}</span>
                    </div>
                    <LoadBar percent={memPct} color={loadBarColor(memPct, "emerald")} />
                  </div>
                  {overview.memory.swapTotal > 0 && (
                    <div className="flex flex-col gap-0">
                      <div className="flex justify-between text-xs text-white/50">
                        <span>Swap</span>
                        <span>{formatBytes(overview.memory.swapUsed)} / {formatBytes(overview.memory.swapTotal)}</span>
                      </div>
                      <LoadBar percent={swapPct} color={loadBarColor(swapPct, "slate")} />
                    </div>
                  )}
                </Card>

                {/* Disks */}
                <Card icon={<CircleStackIcon />} title="Disks">
                  <div className="flex flex-col gap-2.5">
                    {overview.disks.map((disk) => (
                      <div key={disk.mount}>
                        <div className="flex justify-between text-xs text-white/50 mb-0.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{disk.mount}</span>
                            <span className="text-white/25 shrink-0">{disk.fs} · {disk.type}</span>
                          </span>
                          <span className="shrink-0 pl-2">{formatBytes(disk.used)} / {formatBytes(disk.size)}</span>
                        </div>
                        <LoadBar percent={disk.use} color={loadBarColor(disk.use, "blue")} />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Network */}
                <Card icon={<SignalIcon />} title="Network">
                  <div className="flex flex-col gap-2">
                    {overview.network.filter((n) => n.iface !== "lo").map((n) => (
                      <div key={n.iface}>
                        <div className="text-xs font-medium text-white/80 mb-0.5">{n.iface}</div>
                        <div className="grid grid-cols-2 gap-x-4 text-xs">
                          <div><span className="text-white/50">↓ </span><span className="text-emerald-400">{formatBytesPerSec(n.rxSec)}</span></div>
                          <div><span className="text-white/50">↑ </span><span className="text-cyan-400">{formatBytesPerSec(n.txSec)}</span></div>
                        </div>
                      </div>
                    ))}
                    {overview.network.filter((n) => n.iface !== "lo").length === 0 && (
                      <span className="text-xs text-white/40">No active interfaces</span>
                    )}
                  </div>
                </Card>
              </div>

              {/* Row 3 – Processes table */}
              <Card
                icon={<ServerStackIcon />}
                title="Top Processes"
                headerRight={
                  <div className="flex items-center gap-1">
                    {LIMIT_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setLimit(opt.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                          limit === opt.value
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "text-white/40 hover:text-white/70 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/50 border-b border-white/10">
                        {([
                          ["pid", "PID", "text-left"],
                          ["name", "Name", "text-left"],
                          ["user", "User", "text-left"],
                          ["state", "State", "text-left"],
                          ["cpu", "CPU %", "text-right"],
                          ["mem", "MEM %", "text-right"],
                        ] as [SortCol, string, string][]).map(([col, label, align]) => (
                          <th
                            key={col}
                            className={`pb-1.5 pr-3 font-medium cursor-pointer select-none hover:text-white/80 transition ${align} last:pr-0`}
                            onClick={() => handleSort(col)}
                          >
                            {label}
                            <SortIcon col={col} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProcesses.map((p) => (
                        <tr key={p.pid} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="py-1 pr-3 text-white/40">{p.pid}</td>
                          <td className="py-1 pr-3 text-white/90 max-w-[140px] truncate">{p.name}</td>
                          <td className="py-1 pr-3 text-white/50">{p.user}</td>
                          <td className="py-1 pr-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              p.state === "running"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/5 text-white/40"
                            }`}>
                              {p.state}
                            </span>
                          </td>
                          <td className="py-1 pr-3 text-right tabular-nums text-white">{p.cpu.toFixed(1)}</td>
                          <td className="py-1 text-right tabular-nums text-white/60">{p.mem.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
