import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { config } from '../../config/env';
import type { FileEntry } from '../../types';
import { readStorage } from '../storage/storage.service';

/** Résout un chemin relatif à la racine FILES_ROOT et valide qu'il ne sort pas de la racine (path traversal). */
async function isExistingDirectory(targetPath: string): Promise<boolean> {
  const stats = await fs.stat(targetPath).catch(() => null);
  return Boolean(stats?.isDirectory());
}

async function getEffectiveFilesRoot(): Promise<string> {
  const storage = await readStorage();
  const fromPreferences = storage.preferences.filesRoot;

  if (typeof fromPreferences === 'string' && fromPreferences.trim()) {
    const preferred = path.resolve(fromPreferences);
    if (await isExistingDirectory(preferred)) {
      return preferred;
    }
  }

  const fromEnv = path.resolve(config.filesRoot);
  if (await isExistingDirectory(fromEnv)) {
    return fromEnv;
  }

  return '/';
}

async function resolveSafe(inputPath: string): Promise<string> {
  const normalized = (inputPath || '/').replace(/\\/g, '/').trim() || '/';

  // Alias explicite pour le home utilisateur
  if (normalized === '~' || normalized.startsWith('~/')) {
    const home = path.resolve(os.homedir());
    const homeRelative = normalized === '~' ? '' : normalized.slice(2);
    const resolvedHome = path.resolve(home, homeRelative);
    if (!resolvedHome.startsWith(home + path.sep) && resolvedHome !== home) {
      throw new Error('Access denied – home path traversal detected');
    }
    return resolvedHome;
  }

  const root = path.resolve(await getEffectiveFilesRoot());
  let resolved: string;
  if (path.isAbsolute(normalized)) {
    // Frontend may send back the absolute paths we returned — accept them directly
    resolved = path.normalize(normalized);
  } else {
    resolved = path.resolve(root, normalized);
  }
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Access denied – path traversal detected');
  }
  return resolved;
}

function runTar(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: 'ignore' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`tar exited with code ${code ?? -1}`));
    });
  });
}

function validatePermissionsInput(permissions: string): number {
  const trimmed = permissions.trim();
  if (!/^[0-7]{3,4}$/.test(trimmed)) {
    throw new Error('permissions must be an octal string like 644 or 755');
  }
  const parsed = Number.parseInt(trimmed, 8);
  if (!Number.isFinite(parsed)) {
    throw new Error('invalid permissions value');
  }
  return parsed;
}

function sanitizeArchiveName(input?: string): string {
  const raw = (input ?? '').trim();
  const cleaned = raw
    .replace(/\.tar\.gz$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned) {
    return `archive-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  return cleaned;
}

async function resolveAndValidateEntries(relativePaths: string[]): Promise<{ resolvedPath: string; name: string; parent: string }[]> {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    throw new Error('paths must be a non-empty array');
  }

  const resolved = await Promise.all(
    relativePaths.map(async (entryPath) => {
      if (typeof entryPath !== 'string' || !entryPath.trim()) {
        throw new Error('each path must be a non-empty string');
      }
      const resolvedPath = await resolveSafe(entryPath);
      const name = path.basename(resolvedPath);
      const parent = path.dirname(resolvedPath);
      return { resolvedPath, name, parent };
    }),
  );

  const firstParent = resolved[0]?.parent;
  if (!firstParent) {
    throw new Error('unable to resolve selected paths');
  }

  if (!resolved.every((entry) => entry.parent === firstParent)) {
    throw new Error('all selected paths must be in the same directory');
  }

  return resolved;
}

export async function getFilesRoot(): Promise<string> {
  return path.resolve(await getEffectiveFilesRoot());
}

export async function resolveFilePath(relativePath: string): Promise<string> {
  return resolveSafe(relativePath);
}

export async function listDirectory(relativePath: string): Promise<FileEntry[]> {
  const dir = await resolveSafe(relativePath);
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const result: FileEntry[] = await Promise.all(
    entries.map(async (e) => {
      const fullPath = path.join(dir, e.name);
      const stat = await fs.stat(fullPath).catch(() => null);
      return {
        name: e.name,
        path: fullPath.replace(/\\/g, '/'),
        isDirectory: e.isDirectory(),
        size: stat?.size ?? 0,
        modified: stat?.mtime.toISOString() ?? '',
        permissions: stat ? (stat.mode & 0o777).toString(8).padStart(3, '0') : '---',
      };
    }),
  );

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(relativePath: string, maxBytes?: number): Promise<{ content: string; encoding: string }> {
  const file = await resolveSafe(relativePath);
  const stat = await fs.stat(file);

  const defaultMaxBytes = 2 * 1024 * 1024;
  const upperBoundBytes = 300 * 1024 * 1024;
  const requestedMax = typeof maxBytes === 'number' && Number.isFinite(maxBytes)
    ? Math.floor(maxBytes)
    : defaultMaxBytes;
  const effectiveMax = Math.min(Math.max(requestedMax, 1), upperBoundBytes);

  if (stat.size > effectiveMax) {
    throw new Error(`File is too large to preview (> ${Math.floor(effectiveMax / (1024 * 1024))} MB)`);
  }

  const content = await fs.readFile(file, 'utf-8');
  return { content, encoding: 'utf-8' };
}

export async function writeFile(relativePath: string, content: string): Promise<void> {
  const file = await resolveSafe(relativePath);
  await fs.writeFile(file, content, 'utf-8');
}

export async function deleteEntry(relativePath: string): Promise<void> {
  const entry = await resolveSafe(relativePath);
  const stat = await fs.stat(entry);
  if (stat.isDirectory()) {
    await fs.rm(entry, { recursive: true, force: true });
  } else {
    await fs.unlink(entry);
  }
}

export async function deleteEntries(relativePaths: string[]): Promise<void> {
  for (const entryPath of relativePaths) {
    await deleteEntry(entryPath);
  }
}

export async function renameEntry(relativePath: string, newName: string): Promise<void> {
  const entry = await resolveSafe(relativePath);
  const destinationRelative = path.posix.join(path.posix.dirname(relativePath), newName);
  const dest = await resolveSafe(destinationRelative);
  await fs.rename(entry, dest);
}

export async function createDirectory(relativePath: string): Promise<void> {
  const dir = await resolveSafe(relativePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function setEntryPermissions(relativePath: string, permissions: string): Promise<void> {
  const entry = await resolveSafe(relativePath);
  const mode = validatePermissionsInput(permissions);
  await fs.chmod(entry, mode);
}

export async function setEntriesPermissions(relativePaths: string[], permissions: string): Promise<void> {
  const mode = validatePermissionsInput(permissions);
  for (const entryPath of relativePaths) {
    const entry = await resolveSafe(entryPath);
    await fs.chmod(entry, mode);
  }
}

export async function compressEntries(relativePaths: string[], archiveName?: string): Promise<string> {
  const entries = await resolveAndValidateEntries(relativePaths);
  const parentDir = entries[0].parent;
  const safeName = sanitizeArchiveName(archiveName);
  const archivePath = path.join(parentDir, `${safeName}.tar.gz`);

  await runTar(['-czf', archivePath, '-C', parentDir, ...entries.map((entry) => entry.name)]);
  return archivePath.replace(/\\/g, '/');
}

export async function buildArchiveForDownload(
  relativePaths: string[],
  archiveName?: string,
): Promise<{ archivePath: string; fileName: string; cleanupDir: string }> {
  const entries = await resolveAndValidateEntries(relativePaths);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'serverhub-files-'));
  const safeName = sanitizeArchiveName(archiveName || `download-${randomUUID().slice(0, 8)}`);
  const archivePath = path.join(tempDir, `${safeName}.tar.gz`);

  await runTar(['-czf', archivePath, '-C', entries[0].parent, ...entries.map((entry) => entry.name)]);

  return {
    archivePath,
    fileName: path.basename(archivePath),
    cleanupDir: tempDir,
  };
}
