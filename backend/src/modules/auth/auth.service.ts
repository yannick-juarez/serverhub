import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import type { AuthPayload } from '../../types';
import { readStorage } from '../storage/storage.service';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Vérifie les credentials et retourne un token JWT, ou null si invalide. */
export async function login(username: string, password: string): Promise<string | null> {
  const normalizedUsername = normalizeUsername(username);
  const storage = await readStorage();
  const user = storage.users.find((item) => normalizeUsername(item.username) === normalizedUsername);

  if (user?.is_active) {
    const validFromStorage = await bcrypt.compare(password, user.password_hash);
    if (validFromStorage) {
      const payload: AuthPayload = { username: user.username };
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

  const payload: AuthPayload = { username: config.admin.username };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}

/** Vérifie et décode un token JWT. Lance une erreur si invalide. */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwt.secret) as AuthPayload;
}
