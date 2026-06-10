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

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'filesPreviewMaxMb')) {
    const requested = nextPatch.filesPreviewMaxMb;
    const numeric = typeof requested === 'number' ? requested : Number(requested);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error('filesPreviewMaxMb must be a positive number');
    }

    // Keep a server-side guardrail for preview memory usage.
    nextPatch.filesPreviewMaxMb = Math.min(Math.max(Math.floor(numeric), 1), 300);
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
