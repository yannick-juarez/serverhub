import cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import type { CronJob } from '../../types';
import { execFile } from 'child_process';

interface InternalJob extends CronJob {
  _task?: cron.ScheduledTask;
}

const jobs = new Map<string, InternalJob>();

function spawnJob(job: InternalJob): void {
  job._task?.stop();

  if (!job.enabled) return;

  job._task = cron.schedule(job.schedule, () => {
    job.lastRun = new Date().toISOString();
    // Exécution sans shell pour éviter l'injection de commandes
    const parts = job.command.split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);
    execFile(bin, args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) console.error(`[cron:${job.id}] error:`, err.message);
      else console.log(`[cron:${job.id}] stdout:`, stdout.slice(0, 500));
    });
  });
}

export function listJobs(): Omit<InternalJob, '_task'>[] {
  return [...jobs.values()].map(({ _task: _, ...rest }) => rest);
}

export function createJob(data: Pick<CronJob, 'name' | 'schedule' | 'command' | 'enabled'>): CronJob {
  if (!cron.validate(data.schedule)) throw new Error('Invalid cron schedule');
  const job: InternalJob = { id: uuid(), ...data };
  jobs.set(job.id, job);
  spawnJob(job);
  return job;
}

export function updateJob(id: string, patch: Partial<CronJob>): CronJob {
  const job = jobs.get(id);
  if (!job) throw new Error('Job not found');
  if (patch.schedule && !cron.validate(patch.schedule)) throw new Error('Invalid cron schedule');
  Object.assign(job, patch);
  spawnJob(job);
  return job;
}

export function deleteJob(id: string): void {
  const job = jobs.get(id);
  if (!job) throw new Error('Job not found');
  job._task?.stop();
  jobs.delete(id);
}
