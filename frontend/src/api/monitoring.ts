import { apiRequest } from "./http";

export interface CpuInfo {
  manufacturer: string;
  brand: string;
  cores: number;
  physicalCores: number;
  speed: number;
  loadPercent: number;
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  swapTotal: number;
  swapUsed: number;
}

export interface DiskInfo {
  fs: string;
  mount: string;
  size: number;
  used: number;
  use: number;
  type: string;
}

export interface NetworkInfo {
  iface: string;
  rxSec: number;
  txSec: number;
}

export interface OsInfo {
  platform: string;
  distro: string;
  release: string;
  kernel: string;
  arch: string;
  hostname: string;
}

export interface SystemOverview {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskInfo[];
  network: NetworkInfo[];
  os: OsInfo;
}

export interface CpuLoad {
  total: number;
  cores: { core: number; load: number }[];
}

export interface Process {
  pid: number;
  name: string;
  command: string;
  cpu: number;
  mem: number;
  user: string;
  state: string;
}

export const getSystemOverview = () =>
  apiRequest<SystemOverview>("/monitoring/overview");

export const getCpuLoad = () =>
  apiRequest<CpuLoad>("/monitoring/cpu");

export const getProcesses = () =>
  apiRequest<Process[]>("/monitoring/processes");

export interface AllMonitoringData {
  overview: SystemOverview;
  cpuLoad: CpuLoad;
  processes: Process[];
}

export const getAllMonitoringData = () =>
  apiRequest<AllMonitoringData>("/monitoring/all");

export const dropCaches = () =>
  apiRequest<{ freed: number }>("/monitoring/drop-caches", { method: "POST" });
