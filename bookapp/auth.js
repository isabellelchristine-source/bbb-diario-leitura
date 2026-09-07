// auth.js — hashing de senha (scrypt) e sessões simples por token, tudo com node:crypto nativo.
import crypto from 'node:crypto';
import db from './db.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.run('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [token, userId, new Date().toISOString()]);
  return token;
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const row = await db.get('SELECT user_id FROM sessions WHERE token = ?', [token]);
  if (!row) return null;
  return db.get('SELECT * FROM users WHERE id = ?', [row.user_id]);
}

export async function destroySession(token) {
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    bio: u.bio,
    avatar_color: u.avatar_color,
    avatar_url: u.avatar_url,
  };
}
