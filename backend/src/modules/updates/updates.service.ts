import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getPreferences } from '../preferences/preferences.service';

const execFileAsync = promisify(execFile);

type GithubTagPayload = {
  name: string;
  commit?: {
    sha?: string;
    url?: string;
  };
  zipball_url?: string;
  tarball_url?: string;
};

export type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string | null;
  repository: {
    owner: string;
    repo: string;
    source: 'preferences' | 'environment' | 'default';
  };
};

export type UpdateInstallResult = {
  previousVersion: string;
  currentVersion: string;
  updated: boolean;
  restartRequired: boolean;
  branch: string;
  repositoryRoot: string;
};

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

function compareSemver(left: string, right: string): number {
  const l = normalizeVersion(left).split('.').map((item) => Number.parseInt(item, 10) || 0);
  const r = normalizeVersion(right).split('.').map((item) => Number.parseInt(item, 10) || 0);
  const maxLength = Math.max(l.length, r.length);

  for (let i = 0; i < maxLength; i += 1) {
    const lv = l[i] ?? 0;
    const rv = r[i] ?? 0;
    if (lv > rv) return 1;
    if (lv < rv) return -1;
  }

  return 0;
}

function workspaceCandidates(): string[] {
  const cwd = process.cwd();
  return [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];
}

async function resolveWorkspaceRoot(): Promise<string> {
  for (const candidate of workspaceCandidates()) {
    const backendPkg = path.join(candidate, 'backend', 'package.json');
    const frontendPkg = path.join(candidate, 'frontend', 'package.json');
    const backendExists = await fs.stat(backendPkg).then(() => true).catch(() => false);
    const frontendExists = await fs.stat(frontendPkg).then(() => true).catch(() => false);
    if (backendExists && frontendExists) {
      return candidate;
    }
  }

  throw new Error('Unable to resolve workspace root for updates.');
}

async function readCurrentVersion(): Promise<string> {
  const workspaceRoot = await resolveWorkspaceRoot();
  const backendPackagePath = path.join(workspaceRoot, 'backend', 'package.json');
  const content = await fs.readFile(backendPackagePath, 'utf8');
  const parsed = JSON.parse(content) as { version?: string };

  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new Error('Current backend version is missing from backend/package.json');
  }

  return normalizeVersion(parsed.version);
}

async function getRepositoryInfo(): Promise<{
  owner: string;
  repo: string;
  source: 'preferences' | 'environment' | 'default';
}> {
  const preferences = await getPreferences();
  const prefOwner = typeof preferences.updatesRepoOwner === 'string' ? preferences.updatesRepoOwner.trim() : '';
  const prefRepo = typeof preferences.updatesRepoName === 'string' ? preferences.updatesRepoName.trim() : '';

  if (prefOwner && prefRepo) {
    return {
      owner: prefOwner,
      repo: prefRepo,
      source: 'preferences',
    };
  }

  const envOwner = (process.env.UPDATES_REPO_OWNER ?? '').trim();
  const envRepo = (process.env.UPDATES_REPO_NAME ?? '').trim();

  if (!envOwner || !envRepo) {
    return {
      owner: 'yannick-juarez',
      repo: 'serverhub',
      source: 'default',
    };
  }

  return {
    owner: envOwner,
    repo: envRepo,
    source: 'environment',
  };
}

function isSemverLikeTag(tag: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(tag) || /^\d+\.\d+$/.test(tag);
}

function buildTagUrl(owner: string, repo: string, tag: string): string {
  return `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(tag)}`;
}

async function fetchLatestGithubTag(owner: string, repo: string): Promise<{ name: string; html_url: string }> {
  const githubToken = (process.env.GITHUB_TOKEN ?? '').trim();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch GitHub tags: HTTP ${response.status} ${text}`);
  }

  const payload = (await response.json()) as GithubTagPayload[];
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('No tags found in target GitHub repository.');
  }

  const semverTags = payload
    .map((tag) => tag.name)
    .filter((tagName) => isSemverLikeTag(normalizeVersion(tagName)));

  if (semverTags.length === 0) {
    throw new Error('No semver-like tags found in target GitHub repository. Expected tags like v1.0.2 or 1.0.2.');
  }

  const latestTag = semverTags.reduce((best, current) => {
    if (!best) return current;
    return compareSemver(normalizeVersion(current), normalizeVersion(best)) > 0 ? current : best;
  }, '');

  return {
    name: latestTag,
    html_url: buildTagUrl(owner, repo, latestTag),
  };
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = await readCurrentVersion();
  const repository = await getRepositoryInfo();
  const latestTag = await fetchLatestGithubTag(repository.owner, repository.repo);
  const latestVersion = normalizeVersion(latestTag.name);

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
    releaseUrl: latestTag.html_url,
    releaseName: latestTag.name,
    publishedAt: null,
    repository,
  };
}

async function ensureGitRepository(workspaceRoot: string): Promise<void> {
  const gitFolder = path.join(workspaceRoot, '.git');
  const exists = await fs.stat(gitFolder).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error('Workspace is not a git repository. Automatic install requires git.');
  }
}

export async function installUpdate(): Promise<UpdateInstallResult> {
  const updateInfo = await checkForUpdates();
  if (!updateInfo.hasUpdate) {
    return {
      previousVersion: updateInfo.currentVersion,
      currentVersion: updateInfo.currentVersion,
      updated: false,
      restartRequired: false,
      branch: 'n/a',
      repositoryRoot: await resolveWorkspaceRoot(),
    };
  }

  const workspaceRoot = await resolveWorkspaceRoot();
  await ensureGitRepository(workspaceRoot);

  const originResult = await execFileAsync('git', ['-C', workspaceRoot, 'remote', 'get-url', 'origin']);
  const originUrl = originResult.stdout.trim();
  const expectedRepoPattern = new RegExp(`github\\.com[:/]${updateInfo.repository.owner}/${updateInfo.repository.repo}(?:\\.git)?$`, 'i');
  if (!expectedRepoPattern.test(originUrl)) {
    throw new Error(`Git origin (${originUrl}) does not match target repository ${updateInfo.repository.owner}/${updateInfo.repository.repo}.`);
  }

  const status = await execFileAsync('git', ['-C', workspaceRoot, 'status', '--porcelain']);
  if (status.stdout.trim()) {
    throw new Error('Local workspace has uncommitted changes. Commit/stash them before installing update.');
  }

  const branchResult = await execFileAsync('git', ['-C', workspaceRoot, 'rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchResult.stdout.trim();
  if (!branch || branch === 'HEAD') {
    throw new Error('Cannot install update from detached HEAD state. Checkout a branch first.');
  }

  await execFileAsync('git', ['-C', workspaceRoot, 'fetch', '--tags', 'origin']);
  await execFileAsync('git', ['-C', workspaceRoot, 'pull', '--ff-only', 'origin', branch]);

  const currentVersion = await readCurrentVersion();

  return {
    previousVersion: updateInfo.currentVersion,
    currentVersion,
    updated: compareSemver(currentVersion, updateInfo.currentVersion) >= 0,
    restartRequired: true,
    branch,
    repositoryRoot: workspaceRoot,
  };
}
