import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LogSource } from '../../types';

const execFileAsync = promisify(execFile);

/** Sources de logs prédéfinies */
export const LOG_SOURCES: LogSource[] = [
  { id: 'syslog', label: 'Syslog', path: '/var/log/syslog' },
  { id: 'auth', label: 'Auth', path: '/var/log/auth.log' },
  { id: 'nginx-access', label: 'Nginx Access', path: '/var/log/nginx/access.log' },
  { id: 'nginx-error', label: 'Nginx Error', path: '/var/log/nginx/error.log' },
  { id: 'apache-access', label: 'Apache Access', path: '/var/log/apache2/access.log' },
  { id: 'apache-error', label: 'Apache Error', path: '/var/log/apache2/error.log' },
  { id: 'mysql', label: 'MySQL Error', path: '/var/log/mysql/error.log' },
];

function resolveLogPath(sourceId: string): string {
  const src = LOG_SOURCES.find((s) => s.id === sourceId);
  if (!src) throw new Error(`Unknown log source: ${sourceId}`);
  return src.path;
}

/** Retourne les N dernières lignes d'un log. */
export async function tailLog(sourceId: string, lines = 200): Promise<string[]> {
  const logPath = resolveLogPath(sourceId);
  const { stdout } = await execFileAsync('tail', ['-n', String(Math.min(lines, 1000)), logPath]);
  return stdout.split('\n').filter(Boolean);
}

/** Retourne les logs qui correspondent à un pattern (grep). */
export async function grepLog(sourceId: string, pattern: string, lines = 200): Promise<string[]> {
  // Validation stricte pour éviter l'injection de commandes
  if (/[;&|`$<>\\]/.test(pattern)) throw new Error('Invalid pattern characters');
  const logPath = resolveLogPath(sourceId);

  const { stdout } = await execFileAsync('grep', [
    '-m', String(Math.min(lines, 1000)),
    '--text',
    pattern,
    logPath,
  ]).catch((e: { stdout: string; code: number }) => {
    if (e.code === 1) return { stdout: '' }; // grep exit 1 = no match
    throw e;
  });

  return stdout.split('\n').filter(Boolean);
}

/** Vérifie quelles sources existent effectivement sur le système. */
export async function getAvailableSources(): Promise<(LogSource & { available: boolean })[]> {
  return Promise.all(
    LOG_SOURCES.map(async (src) => ({
      ...src,
      available: await fs.promises.access(src.path, fs.constants.R_OK).then(() => true).catch(() => false),
    })),
  );
}
