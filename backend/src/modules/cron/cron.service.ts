import { spawn, execFile } from 'child_process';
import { createHash } from 'crypto';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import type { CronJob } from '../../types';

const MANAGED_MARKER = '# POLARSTAR-CRON:';
const ALLOWED_MACROS = new Set(['@reboot', '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly']);
const CRON_D_DIR = '/etc/cron.d';

type CrontabEntry =
  | { kind: 'raw'; raw: string }
  | { kind: 'managed'; job: CronJob };

type CronDLine = {
  schedule: string;
  user: string;
  command: string;
  enabled: boolean;
};

class CronServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CronServiceError';
  }
}

type RunCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function serviceError(statusCode: number, message: string): CronServiceError {
  return new CronServiceError(statusCode, message);
}

function runCommand(command: string): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(serviceError(500, error.message || 'Unable to run job'));
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

function mapFsError(error: unknown, action: string, target: string): CronServiceError {
  const fsError = error as NodeJS.ErrnoException;
  const code = fsError?.code;

  if (code === 'EACCES' || code === 'EPERM') {
    return serviceError(403, `Permission denied while trying to ${action} ${target}`);
  }

  if (code === 'EROFS') {
    return serviceError(403, `${target} is read-only`);
  }

  if (code === 'ENOENT') {
    return serviceError(404, `${target} not found`);
  }

  return serviceError(500, `Unable to ${action} ${target}`);
}

function isValidSchedule(schedule: string): boolean {
  if (schedule.startsWith('@')) {
    return ALLOWED_MACROS.has(schedule.toLowerCase());
  }
  return cron.validate(schedule);
}

function validateScheduleAndCommand(schedule: string, command: string): void {
  if (!schedule.trim()) {
    throw serviceError(400, 'Cron schedule is required');
  }

  if (!isValidSchedule(schedule.trim())) {
    throw serviceError(400, 'Invalid cron schedule');
  }

  if (!command.trim()) {
    throw serviceError(400, 'Job command is required');
  }
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

function formatExternalJobLine(job: Pick<CronJob, 'schedule' | 'command' | 'enabled'>): string {
  const line = `${job.schedule.trim()} ${job.command.trim()}`.trim();
  return job.enabled ? line : `# ${line}`;
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
        const message = stderr?.trim() || error.message || 'Unable to read system crontab';
        if (/permission denied|not allowed/i.test(message)) {
          reject(serviceError(403, 'Permission denied while reading current crontab'));
          return;
        }
        reject(serviceError(500, message));
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
      reject(serviceError(500, error.message || 'Unable to write current crontab'));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const message = stderr.trim() || 'Unable to write current crontab';
      if (/permission denied|not allowed/i.test(message)) {
        reject(serviceError(403, 'Permission denied while writing current crontab'));
        return;
      }
      reject(serviceError(500, message));
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
    throw serviceError(400, 'Job name is required');
  }

  validateScheduleAndCommand(schedule, command);
}

async function readEntries(): Promise<CrontabEntry[]> {
  const crontabContent = await readCrontab();
  return parseEntries(crontabContent);
}

async function persistEntries(entries: CrontabEntry[]): Promise<void> {
  const content = formatEntries(entries);
  await writeCrontab(content);
}

function parseCronDLine(rawLine: string): CronDLine | null {
  let workingLine = rawLine.trim();
  if (!workingLine.length) {
    return null;
  }

  let enabled = true;
  if (workingLine.startsWith('#')) {
    enabled = false;
    workingLine = workingLine.replace(/^#\s*/, '');
  }

  if (!workingLine.length) {
    return null;
  }

  // Skip variable assignments (e.g. SHELL=..., PATH=...)
  if (/^[A-Z_][A-Z0-9_]*=/.test(workingLine)) {
    return null;
  }

  let schedule = '';
  let user = '';
  let command = '';

  if (workingLine.startsWith('@')) {
    // @macro user command
    const parts = workingLine.split(/\s+/);
    if (parts.length < 3) {
      return null;
    }
    schedule = parts[0] ?? '';
    user = parts[1] ?? '';
    command = parts.slice(2).join(' ').trim();
  } else {
    // min hour dom month dow user command
    const parts = workingLine.split(/\s+/);
    if (parts.length < 7) {
      return null;
    }
    schedule = parts.slice(0, 5).join(' ');
    user = parts[5] ?? '';
    command = parts.slice(6).join(' ').trim();
  }

  if (!schedule || !user || !command || !isValidSchedule(schedule)) {
    return null;
  }

  return {
    schedule,
    user,
    command,
    enabled,
  };
}

function formatCronDLine(line: CronDLine): string {
  const payload = `${line.schedule.trim()} ${line.user.trim()} ${line.command.trim()}`.trim();
  return line.enabled ? payload : `# ${payload}`;
}

function parseExternalJobFromCronDLine(rawLine: string, lineIndex: number, source: string): CronJob | null {
  const parsed = parseCronDLine(rawLine);
  if (!parsed) {
    return null;
  }

  const digest = createHash('sha1').update(`${source}:${lineIndex}:${rawLine}`).digest('hex').slice(0, 12);
  const commandName = parsed.command.split(/\s+/)[0]?.split('/').pop() ?? 'job';

  return {
    id: `crond:${encodeURIComponent(source)}:${lineIndex}:${digest}`,
    name: `cron.d/${source}: ${commandName}`,
    schedule: parsed.schedule,
    command: parsed.command,
    enabled: parsed.enabled,
    managed: false,
  };
}

function parseCronDId(id: string): { source: string; lineIndex: number; digest: string } | null {
  const match = /^crond:([^:]+):(\d+):([a-f0-9]{12})$/.exec(id);
  if (!match) {
    return null;
  }

  try {
    return {
      source: decodeURIComponent(match[1]),
      lineIndex: Number(match[2]),
      digest: match[3],
    };
  } catch {
    return null;
  }
}

function parseExternalCrontabId(id: string): { lineIndex: number; digest: string } | null {
  const match = /^external:(\d+):([a-f0-9]{12})$/.exec(id);
  if (!match) {
    return null;
  }

  return {
    lineIndex: Number(match[1]),
    digest: match[2],
  };
}

async function listCronDJobs(): Promise<CronJob[]> {
  const jobs: CronJob[] = [];

  let files: string[];
  try {
    files = await readdir(CRON_D_DIR);
  } catch {
    // Directory doesn't exist or isn't readable
    return jobs;
  }

  // Sort for stable ordering
  files.sort();

  for (const fileName of files) {
    // Skip files with dots or tildes (backups, dpkg leftovers, etc.)
    if (/[.~]/.test(fileName)) {
      continue;
    }

    const filePath = join(CRON_D_DIR, fileName);
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    content.split('\n').forEach((line, lineIndex) => {
      const job = parseExternalJobFromCronDLine(line, lineIndex, fileName);
      if (job) {
        jobs.push(job);
      }
    });
  }

  return jobs;
}

function findExternalCrontabEntry(entries: CrontabEntry[], id: string): { index: number; job: CronJob } | null {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.kind !== 'raw') {
      continue;
    }

    const parsed = parseExternalJobFromRawLine(entry.raw, index);
    if (parsed && parsed.id === id) {
      return { index, job: parsed };
    }
  }

  return null;
}

async function updateExternalCrontabJob(id: string, patch: Partial<CronJob>): Promise<CronJob> {
  if (!parseExternalCrontabId(id)) {
    throw serviceError(404, 'Job not found');
  }

  const entries = await readEntries();
  const found = findExternalCrontabEntry(entries, id);
  if (!found) {
    throw serviceError(404, 'Job not found');
  }

  const schedule = (patch.schedule ?? found.job.schedule).trim();
  const command = (patch.command ?? found.job.command).trim();
  const enabled = typeof patch.enabled === 'boolean' ? patch.enabled : found.job.enabled;
  validateScheduleAndCommand(schedule, command);

  entries[found.index] = {
    kind: 'raw',
    raw: formatExternalJobLine({ schedule, command, enabled }),
  };

  await persistEntries(entries);

  const updated = parseExternalJobFromRawLine((entries[found.index] as { kind: 'raw'; raw: string }).raw, found.index);
  if (!updated) {
    throw serviceError(500, 'Unable to update external crontab entry');
  }

  return updated;
}

async function deleteExternalCrontabJob(id: string): Promise<void> {
  if (!parseExternalCrontabId(id)) {
    throw serviceError(404, 'Job not found');
  }

  const entries = await readEntries();
  const found = findExternalCrontabEntry(entries, id);
  if (!found) {
    throw serviceError(404, 'Job not found');
  }

  entries.splice(found.index, 1);
  await persistEntries(entries);
}

async function updateCronDJob(id: string, patch: Partial<CronJob>): Promise<CronJob> {
  const parsedId = parseCronDId(id);
  if (!parsedId) {
    throw serviceError(404, 'Job not found');
  }

  const { source, lineIndex } = parsedId;
  const filePath = join(CRON_D_DIR, source);
  let content: string;

  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    throw mapFsError(error, 'read', `cron file ${filePath}`);
  }

  const lines = content.split('\n');
  const rawLine = lines[lineIndex];
  if (rawLine === undefined) {
    throw serviceError(404, 'Job not found');
  }

  const listedJob = parseExternalJobFromCronDLine(rawLine, lineIndex, source);
  if (!listedJob || listedJob.id !== id) {
    throw serviceError(404, 'Job not found (entry changed, refresh and retry)');
  }

  const parsedLine = parseCronDLine(rawLine);
  if (!parsedLine) {
    throw serviceError(400, 'Selected cron.d entry is not editable');
  }

  const schedule = (patch.schedule ?? parsedLine.schedule).trim();
  const command = (patch.command ?? parsedLine.command).trim();
  const enabled = typeof patch.enabled === 'boolean' ? patch.enabled : parsedLine.enabled;
  validateScheduleAndCommand(schedule, command);

  lines[lineIndex] = formatCronDLine({
    schedule,
    command,
    user: parsedLine.user,
    enabled,
  });

  try {
    await writeFile(filePath, `${lines.join('\n')}`, 'utf8');
  } catch (error) {
    throw mapFsError(error, 'write', `cron file ${filePath}`);
  }

  const updated = parseExternalJobFromCronDLine(lines[lineIndex], lineIndex, source);
  if (!updated) {
    throw serviceError(500, 'Unable to parse updated cron.d entry');
  }

  return updated;
}

async function deleteCronDJob(id: string): Promise<void> {
  const parsedId = parseCronDId(id);
  if (!parsedId) {
    throw serviceError(404, 'Job not found');
  }

  const { source, lineIndex } = parsedId;
  const filePath = join(CRON_D_DIR, source);
  let content: string;

  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    throw mapFsError(error, 'read', `cron file ${filePath}`);
  }

  const lines = content.split('\n');
  const rawLine = lines[lineIndex];
  if (rawLine === undefined) {
    throw serviceError(404, 'Job not found');
  }

  const listedJob = parseExternalJobFromCronDLine(rawLine, lineIndex, source);
  if (!listedJob || listedJob.id !== id) {
    throw serviceError(404, 'Job not found (entry changed, refresh and retry)');
  }

  lines.splice(lineIndex, 1);

  try {
    await writeFile(filePath, `${lines.join('\n')}`, 'utf8');
  } catch (error) {
    throw mapFsError(error, 'write', `cron file ${filePath}`);
  }
}

export async function listJobs(): Promise<CronJob[]> {
  const [entries, cronDJobs] = await Promise.all([readEntries(), listCronDJobs()]);
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

  jobs.push(...cronDJobs);

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
  if (id.startsWith('crond:')) {
    return updateCronDJob(id, patch);
  }

  if (id.startsWith('external:')) {
    return updateExternalCrontabJob(id, patch);
  }

  const entries = await readEntries();
  const entry = entries.find((item): item is Extract<CrontabEntry, { kind: 'managed' }> => item.kind === 'managed' && item.job.id === id);

  if (!entry) {
    throw serviceError(404, 'Job not found');
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
  if (id.startsWith('crond:')) {
    await deleteCronDJob(id);
    return;
  }

  if (id.startsWith('external:')) {
    await deleteExternalCrontabJob(id);
    return;
  }

  const entries = await readEntries();
  const filtered = entries.filter((entry) => entry.kind !== 'managed' || entry.job.id !== id);

  if (filtered.length === entries.length) {
    throw serviceError(404, 'Job not found');
  }

  await persistEntries(filtered);
}

export async function runJob(id: string): Promise<RunCommandResult & { job: CronJob }> {
  const job = (await listJobs()).find((item) => item.id === id);

  if (!job) {
    throw serviceError(404, 'Job not found');
  }

  if (!job.command.trim()) {
    throw serviceError(400, 'Job command is required');
  }

  const result = await runCommand(job.command.trim());

  if (result.exitCode !== 0) {
    throw serviceError(500, result.stderr.trim() || `Job exited with code ${result.exitCode}`);
  }

  return {
    job,
    ...result,
  };
}
