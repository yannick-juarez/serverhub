import { spawn, execFile } from 'child_process';
import { createHash } from 'crypto';
import cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import type { CronJob } from '../../types';

const MANAGED_MARKER = '# POLARSTAR-CRON:';
const ALLOWED_MACROS = new Set(['@reboot', '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly']);

type CrontabEntry =
  | { kind: 'raw'; raw: string }
  | { kind: 'managed'; job: CronJob };

function isValidSchedule(schedule: string): boolean {
  if (schedule.startsWith('@')) {
    return ALLOWED_MACROS.has(schedule.toLowerCase());
  }
  return cron.validate(schedule);
}

function parseExternalJobFromRawLine(rawLine: string, index: number): CronJob | null {
  let workingLine = rawLine.trim();
  if (!workingLine.length) {
    return null;
  }

  let enabled = true;
  if (workingLine.startsWith('#')) {
    enabled = false;
    workingLine = workingLine.replace(/^#\s*/, '');
  }

  if (!workingLine.length || workingLine.includes(MANAGED_MARKER)) {
    return null;
  }

  let schedule = '';
  let command = '';

  if (workingLine.startsWith('@')) {
    const parts = workingLine.split(/\s+/);
    schedule = parts[0] ?? '';
    command = parts.slice(1).join(' ').trim();
  } else {
    const parts = workingLine.split(/\s+/);
    if (parts.length < 6) {
      return null;
    }

    schedule = parts.slice(0, 5).join(' ');
    command = parts.slice(5).join(' ').trim();
  }

  if (!schedule || !command || !isValidSchedule(schedule)) {
    return null;
  }

  const digest = createHash('sha1').update(`${index}:${rawLine}`).digest('hex').slice(0, 12);
  const commandName = command.split(/\s+/)[0]?.split('/').pop() ?? 'job';

  return {
    id: `external:${index}:${digest}`,
    name: `External: ${commandName}`,
    schedule,
    command,
    enabled,
    managed: false,
  };
}

function encodeName(name: string): string {
  return Buffer.from(name, 'utf8').toString('base64url');
}

function decodeName(encoded: string, fallbackId: string): string {
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8').trim();
    return decoded || `Job ${fallbackId}`;
  } catch {
    return `Job ${fallbackId}`;
  }
}

function parseManagedJobFromLine(line: string): CronJob | null {
  let workingLine = line;
  let enabled = true;

  if (/^\s*#\s*/.test(workingLine)) {
    enabled = false;
    workingLine = workingLine.replace(/^\s*#\s*/, '');
  }

  const markerIndex = workingLine.lastIndexOf(MANAGED_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const metadata = workingLine.slice(markerIndex + MANAGED_MARKER.length).trim();
  const separatorIndex = metadata.indexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  const id = metadata.slice(0, separatorIndex).trim();
  const encodedName = metadata.slice(separatorIndex + 1).trim();
  const name = decodeName(encodedName, id);

  const scheduleAndCommand = workingLine.slice(0, markerIndex).trim();
  if (!scheduleAndCommand) {
    return null;
  }

  let schedule = '';
  let command = '';

  if (scheduleAndCommand.startsWith('@')) {
    const pieces = scheduleAndCommand.split(/\s+/);
    schedule = pieces[0] ?? '';
    command = pieces.slice(1).join(' ').trim();
  } else {
    const pieces = scheduleAndCommand.split(/\s+/);
    if (pieces.length < 6) {
      return null;
    }

    schedule = pieces.slice(0, 5).join(' ');
    command = pieces.slice(5).join(' ').trim();
  }

  if (!id || !schedule || !command) {
    return null;
  }

  return {
    id,
    name,
    schedule,
    command,
    enabled,
  };
}

function parseEntries(crontabContent: string): CrontabEntry[] {
  if (!crontabContent.length) {
    return [];
  }

  return crontabContent.split('\n').map((line) => {
    const managed = parseManagedJobFromLine(line);
    if (!managed) {
      return { kind: 'raw', raw: line };
    }
    return { kind: 'managed', job: managed };
  });
}

function formatManagedJob(job: CronJob): string {
  const base = `${job.schedule.trim()} ${job.command.trim()}`.trim();
  const marker = `${MANAGED_MARKER}${job.id}:${encodeName(job.name.trim())}`;
  return job.enabled ? `${base} ${marker}` : `# ${base} ${marker}`;
}

function formatEntries(entries: CrontabEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.kind === 'raw') {
        return entry.raw;
      }
      return formatManagedJob(entry.job);
    })
    .join('\n')
    .replace(/\n+$/, '');
}

function readCrontab(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('crontab', ['-l'], (error, stdout, stderr) => {
      if (error) {
        const noCrontab = /no crontab for/i.test(stderr ?? '');
        if (noCrontab) {
          resolve('');
          return;
        }
        reject(new Error(stderr?.trim() || error.message || 'Unable to read system crontab'));
        return;
      }

      resolve(stdout ?? '');
    });
  });
}

function writeCrontab(content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('crontab', ['-']);
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(error.message));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || 'Unable to write system crontab'));
    });

    child.stdin.write(content.length ? `${content}\n` : '');
    child.stdin.end();
  });
}

function validateJobInput(job: Pick<CronJob, 'name' | 'schedule' | 'command'>): void {
  const name = job.name.trim();
  const schedule = job.schedule.trim();
  const command = job.command.trim();

  if (!name) {
    throw new Error('Job name is required');
  }

  if (!schedule) {
    throw new Error('Cron schedule is required');
  }

  if (!isValidSchedule(schedule)) {
    throw new Error('Invalid cron schedule');
  }

  if (!command) {
    throw new Error('Job command is required');
  }
}

async function readEntries(): Promise<CrontabEntry[]> {
  const crontabContent = await readCrontab();
  return parseEntries(crontabContent);
}

async function persistEntries(entries: CrontabEntry[]): Promise<void> {
  const content = formatEntries(entries);
  await writeCrontab(content);
}

export async function listJobs(): Promise<CronJob[]> {
  const entries = await readEntries();
  const jobs: CronJob[] = [];

  entries.forEach((entry, index) => {
    if (entry.kind === 'managed') {
      jobs.push({ ...entry.job, managed: true });
      return;
    }

    const externalJob = parseExternalJobFromRawLine(entry.raw, index);
    if (externalJob) {
      jobs.push(externalJob);
    }
  });

  return jobs;
}

export async function createJob(data: Pick<CronJob, 'name' | 'schedule' | 'command' | 'enabled'>): Promise<CronJob> {
  const job: CronJob = {
    id: uuid(),
    name: data.name.trim(),
    schedule: data.schedule.trim(),
    command: data.command.trim(),
    enabled: data.enabled ?? true,
    managed: true,
  };

  validateJobInput(job);

  const entries = await readEntries();
  entries.push({ kind: 'managed', job });
  await persistEntries(entries);

  return job;
}

export async function updateJob(id: string, patch: Partial<CronJob>): Promise<CronJob> {
  const entries = await readEntries();
  const entry = entries.find((item): item is Extract<CrontabEntry, { kind: 'managed' }> => item.kind === 'managed' && item.job.id === id);

  if (!entry) {
    throw new Error('Job not found');
  }

  const nextJob: CronJob = {
    ...entry.job,
    ...patch,
    id: entry.job.id,
    name: (patch.name ?? entry.job.name).trim(),
    schedule: (patch.schedule ?? entry.job.schedule).trim(),
    command: (patch.command ?? entry.job.command).trim(),
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : entry.job.enabled,
    managed: true,
  };

  validateJobInput(nextJob);

  entry.job = nextJob;
  await persistEntries(entries);
  return nextJob;
}

export async function deleteJob(id: string): Promise<void> {
  const entries = await readEntries();
  const filtered = entries.filter((entry) => entry.kind !== 'managed' || entry.job.id !== id);

  if (filtered.length === entries.length) {
    throw new Error('Job not found');
  }

  await persistEntries(filtered);
}
