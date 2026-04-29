import { readStorage, updateStorage, type PlatformPreferences } from '../storage/storage.service';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

function resolveFilesRootInput(input: string): string {
  const trimmed = input.trim();

  if (trimmed === '~') {
    return os.homedir();
  }

  if (trimmed.startsWith('~/')) {
    return path.resolve(os.homedir(), trimmed.slice(2));
  }

  return path.resolve(trimmed);
}

async function ensureExistingDirectory(targetPath: string): Promise<void> {
  const stats = await fs.stat(targetPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`filesRoot does not exist or is not a directory: ${targetPath}`);
  }
}

export async function getPreferences(): Promise<PlatformPreferences> {
  const storage = await readStorage();
  return storage.preferences;
}

export async function patchPreferences(patch: Record<string, unknown>): Promise<PlatformPreferences> {
  const nextPatch = { ...patch };

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'filesRoot')) {
    const requested = nextPatch.filesRoot;

    if (typeof requested !== 'string' || !requested.trim()) {
      throw new Error('filesRoot must be a non-empty string');
    }

    const resolved = resolveFilesRootInput(requested);
    await ensureExistingDirectory(resolved);
    nextPatch.filesRoot = resolved;
  }

  let preferences: PlatformPreferences = {};

  await updateStorage((current) => {
    preferences = {
      ...current.preferences,
      ...nextPatch,
    } as PlatformPreferences;

    return {
      ...current,
      preferences,
    };
  });

  return preferences;
}
