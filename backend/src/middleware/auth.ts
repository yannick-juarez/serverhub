import { Request, Response, NextFunction } from 'express';
import { resolveIsAdminByUsername, verifyToken } from '../modules/auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: { username: string; is_admin: boolean };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    const tokenIsAdmin = typeof payload.is_admin === 'boolean' ? payload.is_admin : undefined;
    const isAdmin = tokenIsAdmin ?? (await resolveIsAdminByUsername(payload.username));
    req.user = { username: payload.username, is_admin: isAdmin };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ success: false, error: 'Admin role is required.' });
    return;
  }

  next();
}
