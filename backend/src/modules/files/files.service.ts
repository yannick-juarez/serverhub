import fs from 'fs/promises';
import os from 'os';
import path from 'path';
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

export async function getFilesRoot(): Promise<string> {
  return path.resolve(await getEffectiveFilesRoot());
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

export async function readFile(relativePath: string): Promise<{ content: string; encoding: string }> {
  const file = await resolveSafe(relativePath);
  const stat = await fs.stat(file);

  // Refuse les fichiers > 2 Mo pour éviter les OOM
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error('File is too large to preview (> 2 MB)');
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
