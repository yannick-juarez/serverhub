import fs from 'fs/promises';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { getPreferences, patchPreferences } from '../preferences/preferences.service';

const execFileAsync = promisify(execFile);
const NGINX_SITE_NAME = 'serverhub';

export type ScriptRunResult = {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type ScriptStartResult = {
  command: string;
  cwd: string;
  pid: number;
  started: true;
};

export type SystemSettingsResult = {
  workspaceRoot: string;
  scripts: {
    build: string;
    install: string;
  };
  domains: {
    configured: string[];
    preferred: string[];
    email: string;
    appPort: number;
  };
};

export type ApplyDomainsInput = {
  domains: string[];
  email?: string;
  appPort?: number;
  requestCertificate?: boolean;
  autoInstallPackages?: boolean;
};

export type ApplyDomainsResult = {
  domains: string[];
  siteFile: string;
  certificate: {
    attempted: boolean;
    success: boolean;
  };
};

function workspaceCandidates(): string[] {
  const cwd = process.cwd();
  return [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];
}

async function resolveWorkspaceRoot(): Promise<string> {
  for (const candidate of workspaceCandidates()) {
    const buildScript = path.join(candidate, 'build.sh');
    const installScript = path.join(candidate, 'install.sh');
    const hasBuild = await fs.stat(buildScript).then(() => true).catch(() => false);
    const hasInstall = await fs.stat(installScript).then(() => true).catch(() => false);
    if (hasBuild && hasInstall) {
      return candidate;
    }
  }

  throw new Error('Unable to resolve workspace root for system scripts.');
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

function isValidDomain(value: string): boolean {
  if (!value || value.length > 253) return false;
  if (!/^[a-z0-9.-]+$/i.test(value)) return false;
  if (!value.includes('.')) return false;
  if (value.startsWith('.') || value.endsWith('.')) return false;
  if (value.includes('..')) return false;
  return true;
}

function normalizeDomains(values: string[]): string[] {
  const unique = new Set<string>();

  for (const raw of values) {
    const normalized = normalizeDomain(raw);
    if (!normalized) continue;
    if (!isValidDomain(normalized)) {
      throw new Error(`Invalid domain: ${raw}`);
    }
    unique.add(normalized);
  }

  return [...unique];
}

async function ensureCommand(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function installNginxAndCertbotIfMissing(): Promise<void> {
  const hasApt = await ensureCommand('apt-get');
  if (!hasApt) {
    throw new Error('apt-get is required to install nginx/certbot automatically.');
  }

  await execFileAsync('apt-get', ['update', '-y']);
  await execFileAsync('apt-get', ['install', '-y', 'nginx', 'certbot', 'python3-certbot-nginx']);
  await execFileAsync('systemctl', ['enable', 'nginx']);
  await execFileAsync('systemctl', ['start', 'nginx']);
}

async function configureNginx(domains: string[], appPort: number): Promise<string> {
  const siteFile = `/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf`;
  const siteLink = `/etc/nginx/sites-enabled/${NGINX_SITE_NAME}.conf`;
  const serverNames = domains.join(' ');

  const content = `server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;

  await fs.writeFile(siteFile, content, 'utf8');
  await fs.rm(siteLink, { force: true });
  await fs.symlink(siteFile, siteLink);
  await fs.rm('/etc/nginx/sites-enabled/default', { force: true });

  await execFileAsync('nginx', ['-t']);
  await execFileAsync('systemctl', ['reload', 'nginx']);

  return siteFile;
}

async function requestCertificate(domains: string[], email: string): Promise<boolean> {
  const certName = domains[0];
  const certbotArgs = ['--nginx', '--redirect', '--agree-tos', '-n'];
  certbotArgs.push('--expand');
  certbotArgs.push('--cert-name', certName);

  for (const domain of domains) {
    certbotArgs.push('-d', domain);
  }

  if (email.trim()) {
    certbotArgs.push('-m', email.trim());
  } else {
    certbotArgs.push('--register-unsafely-without-email');
  }

  await execFileAsync('certbot', certbotArgs, { maxBuffer: 1024 * 1024 * 2 });
  await execFileAsync('systemctl', ['reload', 'nginx']);

  return true;
}

async function listConfiguredDomains(): Promise<string[]> {
  const siteFile = `/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf`;
  const exists = await fs.stat(siteFile).then(() => true).catch(() => false);

  if (!exists) return [];

  const content = await fs.readFile(siteFile, 'utf8');
  const serverNameLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('server_name '));

  if (!serverNameLine) return [];

  const names = serverNameLine
    .replace(/^server_name\s+/, '')
    .replace(/;$/, '')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalizeDomains(names);
}

async function persistSystemDomainSettings(domains: string[], email: string, appPort: number): Promise<void> {
  await patchPreferences({
    systemDomains: domains,
    systemDomainEmail: email.trim(),
    systemAppPort: appPort,
  });
}

function getPreferredDomainsFromPreferences(preferences: Record<string, unknown>): string[] {
  const raw = preferences.systemDomains;

  if (!Array.isArray(raw)) return [];

  return normalizeDomains(raw.filter((item): item is string => typeof item === 'string'));
}

function getPreferredEmail(preferences: Record<string, unknown>): string {
  const raw = preferences.systemDomainEmail;
  return typeof raw === 'string' ? raw.trim() : '';
}

function getPreferredPort(preferences: Record<string, unknown>): number {
  const raw = preferences.systemAppPort;
  const asNumber = typeof raw === 'number' ? raw : Number(raw);

  if (!Number.isFinite(asNumber) || asNumber <= 0 || asNumber > 65535) {
    return 8080;
  }

  return Math.floor(asNumber);
}

export async function getSystemSettings(): Promise<SystemSettingsResult> {
  const workspaceRoot = await resolveWorkspaceRoot();
  const preferences = await getPreferences();
  const configured = await listConfiguredDomains();

  return {
    workspaceRoot,
    scripts: {
      build: path.join(workspaceRoot, 'build.sh'),
      install: path.join(workspaceRoot, 'install.sh'),
    },
    domains: {
      configured,
      preferred: getPreferredDomainsFromPreferences(preferences),
      email: getPreferredEmail(preferences),
      appPort: getPreferredPort(preferences),
    },
  };
}

export async function updateSystemSettings(input: {
  domains?: string[];
  email?: string;
  appPort?: number;
}): Promise<SystemSettingsResult> {
  const current = await getPreferences();

  const domains = input.domains ? normalizeDomains(input.domains) : getPreferredDomainsFromPreferences(current);
  const email = typeof input.email === 'string' ? input.email.trim() : getPreferredEmail(current);
  const appPort = typeof input.appPort === 'number' ? input.appPort : getPreferredPort(current);

  if (!Number.isFinite(appPort) || appPort <= 0 || appPort > 65535) {
    throw new Error('appPort must be between 1 and 65535.');
  }

  await persistSystemDomainSettings(domains, email, Math.floor(appPort));
  return getSystemSettings();
}

async function runScript(scriptName: 'build.sh' | 'install.sh', args: string[]): Promise<ScriptRunResult> {
  const workspaceRoot = await resolveWorkspaceRoot();
  const startedAt = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync('bash', [scriptName, ...args], {
      cwd: workspaceRoot,
      maxBuffer: 1024 * 1024 * 20,
      timeout: 1000 * 60 * 20,
    });

    return {
      command: `bash ${scriptName}${args.length ? ` ${args.join(' ')}` : ''}`,
      cwd: workspaceRoot,
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      signal?: NodeJS.Signals;
    };

    const stdout = err.stdout ?? '';
    const stderr = err.stderr ?? err.message;
    const exitInfo = err.code !== undefined ? ` (exit: ${String(err.code)})` : '';
    const failure = new Error(`Script ${scriptName} failed${exitInfo}: ${stderr || stdout || 'unknown error'}`);
    (failure as Error & { statusCode?: number }).statusCode = 500;
    throw failure;
  }
}

export async function runBuildScript(): Promise<ScriptRunResult> {
  return runScript('build.sh', []);
}

export async function startBuildScript(): Promise<ScriptStartResult> {
  const workspaceRoot = await resolveWorkspaceRoot();

  const child = spawn('bash', ['build.sh'], {
    cwd: workspaceRoot,
    detached: true,
    stdio: 'ignore',
  });

  if (!child.pid) {
    throw new Error('Unable to start build.sh in background.');
  }

  child.unref();

  return {
    command: 'bash build.sh',
    cwd: workspaceRoot,
    pid: child.pid,
    started: true,
  };
}

export async function runInstallScript(input?: {
  domains?: string[];
  email?: string;
  appPort?: number;
}): Promise<ScriptRunResult> {
  const args = ['--non-interactive'];

  const domains = normalizeDomains(input?.domains ?? []);
  if (domains.length > 0) {
    args.push('--domains', domains.join(','));
  }

  if (typeof input?.email === 'string' && input.email.trim()) {
    args.push('--email', input.email.trim());
  }

  if (typeof input?.appPort === 'number' && Number.isFinite(input.appPort)) {
    const port = Math.floor(input.appPort);
    if (port > 0 && port <= 65535) {
      args.push('--app-port', String(port));
    }
  }

  return runScript('install.sh', args);
}

export async function startInstallScript(input?: {
  domains?: string[];
  email?: string;
  appPort?: number;
}): Promise<ScriptStartResult> {
  const workspaceRoot = await resolveWorkspaceRoot();
  const args = ['install.sh', '--non-interactive'];

  const domains = normalizeDomains(input?.domains ?? []);
  if (domains.length > 0) {
    args.push('--domains', domains.join(','));
  }

  if (typeof input?.email === 'string' && input.email.trim()) {
    args.push('--email', input.email.trim());
  }

  if (typeof input?.appPort === 'number' && Number.isFinite(input.appPort)) {
    const port = Math.floor(input.appPort);
    if (port > 0 && port <= 65535) {
      args.push('--app-port', String(port));
    }
  }

  const child = spawn('bash', args, {
    cwd: workspaceRoot,
    detached: true,
    stdio: 'ignore',
  });

  if (!child.pid) {
    throw new Error('Unable to start install.sh in background.');
  }

  child.unref();

  return {
    command: `bash ${args.join(' ')}`,
    cwd: workspaceRoot,
    pid: child.pid,
    started: true,
  };
}

export async function applyDomains(input: ApplyDomainsInput): Promise<ApplyDomainsResult> {
  const domains = normalizeDomains(input.domains);

  if (!domains.length) {
    throw new Error('At least one domain is required.');
  }

  const appPort = typeof input.appPort === 'number' ? Math.floor(input.appPort) : 8080;
  if (!Number.isFinite(appPort) || appPort <= 0 || appPort > 65535) {
    throw new Error('appPort must be between 1 and 65535.');
  }

  const hasNginx = await ensureCommand('nginx');
  const hasCertbot = await ensureCommand('certbot');
  const shouldInstallPackages = input.autoInstallPackages === true;

  if ((!hasNginx || (input.requestCertificate && !hasCertbot)) && shouldInstallPackages) {
    await installNginxAndCertbotIfMissing();
  }

  if (!(await ensureCommand('nginx'))) {
    throw new Error('nginx is not installed. Install nginx first or enable autoInstallPackages.');
  }

  const siteFile = await configureNginx(domains, appPort);

  let certSuccess = false;
  const certAttempt = input.requestCertificate === true;
  if (certAttempt) {
    if (!(await ensureCommand('certbot'))) {
      throw new Error('certbot is not installed. Install certbot first or enable autoInstallPackages.');
    }

    certSuccess = await requestCertificate(domains, input.email ?? '');
  }

  await persistSystemDomainSettings(domains, input.email ?? '', appPort);

  return {
    domains,
    siteFile,
    certificate: {
      attempted: certAttempt,
      success: certSuccess,
    },
  };
}
