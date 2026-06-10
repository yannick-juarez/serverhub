import type { Request, Response } from 'express';
import {
  applyDomains,
  getSystemSettings,
  startBuildScript,
  startInstallScript,
  updateSystemSettings,
} from './system.service';

function ensureAdmin(req: Request, res: Response): boolean {
  if (!req.user?.is_admin) {
    res.status(403).json({ success: false, error: 'Only admin can manage system settings.' });
    return false;
  }

  return true;
}

export async function handleGetSystemSettings(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const data = await getSystemSettings();
  res.json({ success: true, data });
}

export async function handlePatchSystemSettings(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const body = (req.body ?? {}) as {
    domains?: unknown;
    email?: unknown;
    appPort?: unknown;
  };

  const data = await updateSystemSettings({
    domains: Array.isArray(body.domains) ? body.domains.filter((item): item is string => typeof item === 'string') : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    appPort: typeof body.appPort === 'number' ? body.appPort : undefined,
  });

  res.json({ success: true, data });
}

export async function handleRunBuild(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const data = await startBuildScript();
  res.json({ success: true, data });
}

export async function handleRunInstall(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const body = (req.body ?? {}) as {
    domains?: unknown;
    email?: unknown;
    appPort?: unknown;
  };

  const data = await startInstallScript({
    domains: Array.isArray(body.domains) ? body.domains.filter((item): item is string => typeof item === 'string') : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    appPort: typeof body.appPort === 'number' ? body.appPort : undefined,
  });

  res.json({ success: true, data });
}

export async function handleApplyDomains(req: Request, res: Response): Promise<void> {
  if (!ensureAdmin(req, res)) return;

  const body = (req.body ?? {}) as {
    domains?: unknown;
    email?: unknown;
    appPort?: unknown;
    requestCertificate?: unknown;
    autoInstallPackages?: unknown;
  };

  const domains = Array.isArray(body.domains) ? body.domains.filter((item): item is string => typeof item === 'string') : [];

  const data = await applyDomains({
    domains,
    email: typeof body.email === 'string' ? body.email : undefined,
    appPort: typeof body.appPort === 'number' ? body.appPort : undefined,
    requestCertificate: body.requestCertificate === true,
    autoInstallPackages: body.autoInstallPackages === true,
  });

  res.json({ success: true, data });
}
