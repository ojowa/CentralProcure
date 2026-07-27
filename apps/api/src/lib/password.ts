import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { pool } from '../db.js';

const BCRYPT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (!hash) return false;

  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(password, hash);
  }

  const sha256Hash = createHash('sha256').update(password).digest('hex');
  if (sha256Hash === hash) {
    await upgradePasswordHash(password, hash);
    return true;
  }

  if (hash === password) {
    await upgradePasswordHash(password, hash);
    return true;
  }

  return false;
};

const upgradePasswordHash = async (password: string, _oldHash: string): Promise<void> => {
  if (!pool) return;
  try {
    const newHash = await hashPassword(password);
    await pool.query(
      'UPDATE identity.vendors SET password_hash = $1 WHERE lower(password_hash) = lower($2)',
      [newHash, _oldHash]
    );
  } catch {
    // Silently fail — password upgrade is best-effort
  }
};

export const hashPasswordSync = (password: string): string => {
  return createHash('sha256').update(password).digest('hex');
};
