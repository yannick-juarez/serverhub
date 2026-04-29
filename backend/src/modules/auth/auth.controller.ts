import { Request, Response } from 'express';
import { login } from './auth.service';
import type { ApiResponse } from '../../types';

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    const resp: ApiResponse = { success: false, error: 'username and password are required' };
    res.status(400).json(resp);
    return;
  }

  const token = await login(username, password);

  if (!token) {
    const resp: ApiResponse = { success: false, error: 'Invalid credentials' };
    res.status(401).json(resp);
    return;
  }

  const resp: ApiResponse<{ token: string; username: string }> = {
    success: true,
    data: { token, username },
  };
  res.json(resp);
}

export function handleMe(req: Request, res: Response): void {
  // Le middleware auth a déjà validé et attaché req.user
  const resp: ApiResponse<{ username: string }> = {
    success: true,
    data: { username: (req as Request & { user?: { username: string } }).user?.username ?? '' },
  };
  res.json(resp);
}
