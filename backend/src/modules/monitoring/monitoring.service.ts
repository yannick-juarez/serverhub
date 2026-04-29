import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getSystemOverview() {
  const [cpu, mem, disk, network, os, load] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.osInfo(),
    si.currentLoad(),
  ]);

  return {
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      speed: cpu.speed,
      loadPercent: parseFloat(load.currentLoad.toFixed(1)),
    },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused,
    },
    disks: disk.map((d) => ({
      fs: d.fs,
      mount: d.mount,
      size: d.size,
      used: d.used,
      use: d.use,
      type: d.type,
    })),
    network: network.map((n) => ({
      iface: n.iface,
      rxSec: n.rx_sec,
      txSec: n.tx_sec,
    })),
    os: {
      platform: os.platform,
      distro: os.distro,
      release: os.release,
      kernel: os.kernel,
      arch: os.arch,
      hostname: os.hostname,
    },
  };
}

export async function getCpuLoad() {
  const load = await si.currentLoad();
  return {
    total: parseFloat(load.currentLoad.toFixed(1)),
    cores: load.cpus.map((c, i) => ({ core: i, load: parseFloat(c.load.toFixed(1)) })),
  };
}

export async function getProcesses() {
  const proc = await si.processes();
  return proc.list
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 50)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      command: p.command,
      cpu: parseFloat(p.cpu.toFixed(1)),
      mem: parseFloat(p.mem.toFixed(1)),
      user: p.user,
      state: p.state,
    }));
}

export async function getAllMonitoringData() {
  const [cpu, mem, disk, network, os, load, proc] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.osInfo(),
    si.currentLoad(),
    si.processes(),
  ]);

  return {
    overview: {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        loadPercent: parseFloat(load.currentLoad.toFixed(1)),
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
      },
      disks: disk.map((d) => ({
        fs: d.fs,
        mount: d.mount,
        size: d.size,
        used: d.used,
        use: d.use,
        type: d.type,
      })),
      network: network.map((n) => ({
        iface: n.iface,
        rxSec: n.rx_sec,
        txSec: n.tx_sec,
      })),
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        kernel: os.kernel,
        arch: os.arch,
        hostname: os.hostname,
      },
    },
    cpuLoad: {
      total: parseFloat(load.currentLoad.toFixed(1)),
      cores: load.cpus.map((c, i) => ({ core: i, load: parseFloat(c.load.toFixed(1)) })),
    },
    processes: proc.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 50)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        command: p.command,
        cpu: parseFloat(p.cpu.toFixed(1)),
        mem: parseFloat(p.mem.toFixed(1)),
        user: p.user,
        state: p.state,
      })),
  };
}

export async function dropPageCaches(): Promise<{ freed: number }> {
  const before = await si.mem();
  await execAsync('sync && echo 3 > /proc/sys/vm/drop_caches');
  const after = await si.mem();
  return { freed: Math.max(0, after.free - before.free) };
}
