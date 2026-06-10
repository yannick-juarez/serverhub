import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import type { AuthPayload } from '../../types';
import { readStorage } from '../storage/storage.service';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function isSystemAdminUsername(username: string): boolean {
  return normalizeUsername(username) === normalizeUsername(config.admin.username);
}

/** Vérifie les credentials et retourne un token JWT, ou null si invalide. */
export async function login(username: string, password: string): Promise<string | null> {
  const normalizedUsername = normalizeUsername(username);
  const storage = await readStorage();
  const user = storage.users.find((item) => normalizeUsername(item.username) === normalizedUsername);

  if (user) {
    const validFromStorage = await bcrypt.compare(password, user.password_hash);
    if (validFromStorage && (user.is_active || isSystemAdminUsername(user.username))) {
      const payload: AuthPayload = { username: user.username, is_admin: user.is_admin || isSystemAdminUsername(user.username) };
      return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
    }
  }

  // Fallback compatibilite: login via .env si l'utilisateur admin existe encore uniquement cote env
  const envAdmin = normalizeUsername(config.admin.username);
  if (normalizedUsername !== envAdmin) return null;

  const validFromEnv = password === config.admin.password
    ? true
    : await bcrypt.compare(password, config.admin.password);

  if (!validFromEnv) return null;

  const payload: AuthPayload = { username: config.admin.username, is_admin: true };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}

export async function resolveIsAdminByUsername(username: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  if (isSystemAdminUsername(normalized)) {
    return true;
  }

  const storage = await readStorage();
  const found = storage.users.find((item) => normalizeUsername(item.username) === normalized);
  if (found) {
    return Boolean(found.is_admin);
  }

  return false;
}

/** Vérifie et décode un token JWT. Lance une erreur si invalide. */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwt.secret) as AuthPayload;
}
