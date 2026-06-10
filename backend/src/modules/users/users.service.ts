import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { config } from '../../config/env';
import { readStorage, updateStorage, type StoredUser } from '../storage/storage.service';

export type PublicUser = {
  user_id: string;
  workspace_id: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function isSystemAdminUsername(username: string): boolean {
  return normalizeUsername(username) === normalizeUsername(config.admin.username);
}

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

function validateAndNormalizeUsername(username: string): string {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    throw new Error('username is required');
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error('username must use 2-32 chars: letters, numbers, dot, underscore or hyphen');
  }

  return normalized;
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    user_id: user.user_id,
    workspace_id: user.workspace_id,
    username: user.username,
    is_active: user.is_active,
    is_admin: user.is_admin || isSystemAdminUsername(user.username),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function listUsers(workspaceId?: string): Promise<PublicUser[]> {
  const storage = await readStorage();
  const items = workspaceId
    ? storage.users.filter((user) => user.workspace_id === workspaceId)
    : storage.users;
  return items.map(toPublicUser);
}

export async function createUser(username: string, password: string, workspaceId = 'demo'): Promise<PublicUser> {
  const normalized = validateAndNormalizeUsername(username);

  if (!password || password.length < 6) {
    throw new Error('password must be at least 6 characters');
  }

  let created: StoredUser | null = null;

  await updateStorage(async (current) => {
    const exists = current.users.some((user) => normalizeUsername(user.username) === normalized);
    if (exists) {
      throw new Error('user already exists');
    }

    const now = new Date().toISOString();
    created = {
      user_id: randomUUID(),
      workspace_id: workspaceId,
      username: normalized,
      password_hash: await bcrypt.hash(password, 10),
      is_active: true,
      is_admin: false,
      created_at: now,
      updated_at: now,
    };

    return {
      ...current,
      users: [...current.users, created],
    };
  });

  if (!created) {
    throw new Error('unable to create user');
  }

  return toPublicUser(created);
}

export async function updateUserPassword(username: string, nextPassword: string): Promise<PublicUser> {
  const normalized = normalizeUsername(username);

  if (!nextPassword || nextPassword.length < 6) {
    throw new Error('password must be at least 6 characters');
  }

  let updated: StoredUser | null = null;

  await updateStorage(async (current) => {
    const nextUsers = await Promise.all(current.users.map(async (user) => {
      if (normalizeUsername(user.username) !== normalized) {
        return user;
      }

      updated = {
        ...user,
        password_hash: await bcrypt.hash(nextPassword, 10),
        updated_at: new Date().toISOString(),
      };

      return updated;
    }));

    if (!updated) {
      throw new Error('user not found');
    }

    return {
      ...current,
      users: nextUsers,
    };
  });

  if (!updated) {
    throw new Error('user not found');
  }

  return toPublicUser(updated);
}

export async function renameUser(
  username: string,
  nextUsername: string,
  actorUsername: string,
): Promise<PublicUser> {
  const normalizedCurrent = normalizeUsername(username);
  const normalizedNext = validateAndNormalizeUsername(nextUsername);
  const normalizedActor = normalizeUsername(actorUsername);

  if (normalizedCurrent === normalizedActor) {
    throw new Error('you cannot rename your own account while connected');
  }

  if (isSystemAdminUsername(normalizedCurrent)) {
    throw new Error('system admin username cannot be renamed');
  }

  if (normalizedCurrent === normalizedNext) {
    throw new Error('new username must be different');
  }

  let updated: StoredUser | null = null;

  await updateStorage((current) => {
    const target = current.users.find((user) => normalizeUsername(user.username) === normalizedCurrent);
    if (!target) {
      throw new Error('user not found');
    }

    const exists = current.users.some(
      (user) => user.user_id !== target.user_id && normalizeUsername(user.username) === normalizedNext,
    );
    if (exists) {
      throw new Error('user already exists');
    }

    const nextUsers = current.users.map((user) => {
      if (user.user_id !== target.user_id) {
        return user;
      }

      updated = {
        ...user,
        username: normalizedNext,
        updated_at: new Date().toISOString(),
      };

      return updated;
    });

    return {
      ...current,
      users: nextUsers,
    };
  });

  if (!updated) {
    throw new Error('user not found');
  }

  return toPublicUser(updated);
}

export async function updateUserStatus(username: string, isActive: boolean, actorUsername: string): Promise<PublicUser> {
  const normalized = normalizeUsername(username);
  const actor = normalizeUsername(actorUsername);

  if (isSystemAdminUsername(normalized) && !isActive) {
    throw new Error('system admin account cannot be disabled');
  }

  if (!isActive && normalized === actor) {
    throw new Error('you cannot disable your own account');
  }

  let updated: StoredUser | null = null;

  await updateStorage((current) => {
    const activeCount = current.users.filter((user) => user.is_active).length;

    const nextUsers = current.users.map((user) => {
      if (normalizeUsername(user.username) !== normalized) {
        return user;
      }

      if (!isActive && user.is_active && activeCount <= 1) {
        throw new Error('cannot disable last active user');
      }

      updated = {
        ...user,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      return updated;
    });

    if (!updated) {
      throw new Error('user not found');
    }

    return {
      ...current,
      users: nextUsers,
    };
  });

  if (!updated) {
    throw new Error('user not found');
  }

  return toPublicUser(updated);
}

export async function updateUserRole(username: string, isAdmin: boolean, actorUsername: string): Promise<PublicUser> {
  const normalizedTarget = normalizeUsername(username);
  const normalizedActor = normalizeUsername(actorUsername);

  if (isSystemAdminUsername(normalizedTarget) && !isAdmin) {
    throw new Error('system admin role cannot be removed');
  }

  if (!isAdmin && normalizedTarget === normalizedActor) {
    throw new Error('you cannot remove your own admin role while connected');
  }

  let updated: StoredUser | null = null;

  await updateStorage((current) => {
    const adminCount = current.users.filter((user) => user.is_admin).length;

    const nextUsers = current.users.map((user) => {
      if (normalizeUsername(user.username) !== normalizedTarget) {
        return user;
      }

      if (!isAdmin && user.is_admin && adminCount <= 1) {
        throw new Error('cannot remove admin role from the last admin user');
      }

      updated = {
        ...user,
        is_admin: isAdmin,
        updated_at: new Date().toISOString(),
      };

      return updated;
    });

    if (!updated) {
      throw new Error('user not found');
    }

    return {
      ...current,
      users: nextUsers,
    };
  });

  if (!updated) {
    throw new Error('user not found');
  }

  return toPublicUser(updated);
}

export async function deleteUser(username: string): Promise<void> {
  const normalized = normalizeUsername(username);

  if (isSystemAdminUsername(normalized)) {
    throw new Error('system admin account cannot be deleted');
  }

  await updateStorage((current) => {
    const userToDelete = current.users.find((user) => normalizeUsername(user.username) === normalized);
    if (!userToDelete) {
      throw new Error('user not found');
    }

    const activeCount = current.users.filter((user) => user.is_active).length;
    if (userToDelete.is_active && activeCount <= 1) {
      throw new Error('cannot delete last active user');
    }

    const adminCount = current.users.filter((user) => user.is_admin).length;
    if (userToDelete.is_admin && adminCount <= 1) {
      throw new Error('cannot delete last admin user');
    }

    return {
      ...current,
      users: current.users.filter((user) => normalizeUsername(user.username) !== normalized),
    };
  });
}
