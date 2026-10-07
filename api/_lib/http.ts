// Small helpers for Web-standard (Request -> Response) handlers.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as T;
  } catch {
    // fall through
  }
  throw new HttpError(400, '請求格式錯誤');
}

type Handler = (req: Request) => Promise<Response>;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Wraps a handler with error handling and CSRF protection: mutating requests must carry the
 * custom `x-requested-with` header, which browsers will not send cross-site without CORS approval.
 */
export function route(handler: Handler): Handler {
  return async (req) => {
    try {
      if (MUTATING.has(req.method) && req.headers.get('x-requested-with') !== 'fetch') {
        throw new HttpError(403, 'Forbidden');
      }
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
      console.error(err);
      return json({ error: '伺服器發生錯誤，請稍後再試' }, { status: 500 });
    }
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function requireDate(value: unknown, field = 'date'): string {
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `無效的日期 (${field})`);
  }
  return value;
}

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `缺少 ${field}`);
  return value.trim().slice(0, max);
}

export function optionalString(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function requireNumber(value: unknown, field: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} 超出範圍`);
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, '無效的 ID');
  return value;
}
