// GET  /api/auth                      -> current session { user, profile }
// POST /api/auth { action: 'register' | 'login' | 'logout' | 'password' | 'delete', ... }

import { timingSafeEqual } from 'node:crypto';
import {
  DUMMY_HASH,
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from './_lib/auth.js';
import { query, queryOne } from './_lib/db.js';
import { HttpError, json, readJson, requireString, route } from './_lib/http.js';
import { loadProfile } from './_lib/rows.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
    throw new HttpError(400, '密碼至少需要 8 個字元');
  }
  return value;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * With INVITE_CODE set, sign-up requires it. Without it, only the very first account can be
 * created, so a fresh deployment is never left open to the public.
 */
async function checkInvite(code: unknown): Promise<void> {
  const invite = process.env.INVITE_CODE;
  if (invite) {
    if (typeof code !== 'string' || !safeEqual(code.trim(), invite)) throw new HttpError(403, '邀請碼不正確');
    return;
  }
  const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
  if ((row?.n ?? 0) > 0) throw new HttpError(403, '目前未開放註冊，請向管理員索取邀請碼');
}

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json({ user, profile: await loadProfile(user.id) });
});

export const POST = route(async (req) => {
  const body = await readJson(req);

  switch (body.action) {
    case 'register': {
      const email = requireString(body.email, 'Email', 254).toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email 格式不正確');
      const name = requireString(body.name, '名稱', 40);
      const password = validPassword(body.password);
      await checkInvite(body.inviteCode);

      const existing = await queryOne(`SELECT 1 FROM users WHERE lower(email) = $1`, [email]);
      if (existing) throw new HttpError(409, '此 Email 已註冊');

      const user = await queryOne<{ id: string; email: string; name: string }>(
        `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name`,
        [email, name, await hashPassword(password)],
      );
      const cookie = await createSession(req, user!.id);
      return json({ user, profile: null }, { headers: { 'set-cookie': cookie } });
    }

    case 'login': {
      const email = requireString(body.email, 'Email', 254).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      const row = await queryOne<{ id: string; email: string; name: string; password_hash: string }>(
        `SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1`,
        [email],
      );
      const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
      if (!row || !ok) throw new HttpError(401, 'Email 或密碼錯誤');
      const cookie = await createSession(req, row.id);
      const user = { id: row.id, email: row.email, name: row.name };
      return json({ user, profile: await loadProfile(row.id) }, { headers: { 'set-cookie': cookie } });
    }

    case 'logout': {
      const cookie = await destroySession(req);
      return json({ ok: true }, { headers: { 'set-cookie': cookie } });
    }

    case 'password': {
      const user = await requireUser(req);
      const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
      if (!row || !(await verifyPassword(String(body.current ?? ''), row.password_hash))) {
        throw new HttpError(400, '目前密碼不正確');
      }
      const next = validPassword(body.next);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await hashPassword(next), user.id]);
      // Sign out every other device.
      await query(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);
      const cookie = await createSession(req, user.id);
      return json({ ok: true }, { headers: { 'set-cookie': cookie } });
    }

    case 'delete': {
      const user = await requireUser(req);
      const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
      if (!row || !(await verifyPassword(String(body.password ?? ''), row.password_hash))) {
        throw new HttpError(400, '密碼不正確');
      }
      const cookie = await destroySession(req);
      await query(`DELETE FROM users WHERE id = $1`, [user.id]);
      return json({ ok: true }, { headers: { 'set-cookie': cookie } });
    }

    default:
      throw new HttpError(400, '未知的操作');
  }
});
