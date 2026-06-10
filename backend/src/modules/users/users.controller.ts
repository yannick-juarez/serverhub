import type { Request, Response } from 'express';
import {
  createUser,
  deleteUser,
  listUsers,
  renameUser,
  updateUserRole,
  updateUserPassword,
  updateUserStatus,
} from './users.service';

export async function handleListUsers(_req: Request, res: Response): Promise<void> {
  const workspaceId = typeof _req.query.workspace_id === 'string' ? _req.query.workspace_id : undefined;
  const data = await listUsers(workspaceId);
  res.json({ success: true, data });
}

export async function handleCreateUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, workspace_id } = req.body as {
      username?: string;
      password?: string;
      workspace_id?: string;
    };
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password are required' });
      return;
    }

    const data = await createUser(username, password, workspace_id?.trim() || 'demo');
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create user';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleUpdatePassword(req: Request, res: Response): Promise<void> {
  try {
    const username = req.params.username;
    const { password } = req.body as { password?: string };

    if (!password) {
      res.status(400).json({ success: false, error: 'password is required' });
      return;
    }

    const data = await updateUserPassword(username, password);
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to update password';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleUpdateStatus(req: Request, res: Response): Promise<void> {
  try {
    const username = req.params.username;
    const { is_active: isActive } = req.body as { is_active?: boolean };
    const actorUsername = req.user?.username ?? '';

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, error: 'is_active boolean is required' });
      return;
    }

    const data = await updateUserStatus(username, isActive, actorUsername);
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to update status';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleRenameUser(req: Request, res: Response): Promise<void> {
  try {
    const username = req.params.username;
    const { username: nextUsername } = req.body as { username?: string };
    const actorUsername = req.user?.username ?? '';

    if (!nextUsername) {
      res.status(400).json({ success: false, error: 'username is required' });
      return;
    }

    const data = await renameUser(username, nextUsername, actorUsername);
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to rename user';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleUpdateRole(req: Request, res: Response): Promise<void> {
  try {
    const username = req.params.username;
    const { is_admin: isAdmin } = req.body as { is_admin?: boolean };
    const actorUsername = req.user?.username ?? '';

    if (typeof isAdmin !== 'boolean') {
      res.status(400).json({ success: false, error: 'is_admin boolean is required' });
      return;
    }

    const data = await updateUserRole(username, isAdmin, actorUsername);
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to update role';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleDeleteUser(req: Request, res: Response): Promise<void> {
  try {
    const username = req.params.username;

    await deleteUser(username);
    res.json({ success: true, message: 'user deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to delete user';
    res.status(400).json({ success: false, error: message });
  }
}
