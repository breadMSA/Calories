// Password hashing and cookie-based sessions.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query, queryOne } from './db.js';
import { HttpError } from './http.js';
import type { User } from '../../shared/types.js';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

const COOKIE = 'sid';
const SESSION_DAYS = 60;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

/** A fixed hash used to keep login timing uniform when the account does not exist. */
export const DUMMY_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(KEY_LEN).toString('base64');

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookieAttributes(req: Request, maxAge: number): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Creates a session and returns the Set-Cookie header value. */
export async function createSession(req: Request, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS],
  );
  // Opportunistically prune expired sessions.
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  return `${COOKIE}=${token}; ${cookieAttributes(req, SESSION_DAYS * 86400)}`;
}

export async function destroySession(req: Request): Promise<string> {
  const token = readCookie(req, COOKIE);
  if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  return `${COOKIE}=; ${cookieAttributes(req, 0)}`;
}

export async function currentUser(req: Request): Promise<User | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const row = await queryOne<{ id: string; email: string; name: string }>(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row ? { id: row.id, email: row.email, name: row.name } : null;
}

export async function requireUser(req: Request): Promise<User> {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, '請先登入');
  return user;
}
