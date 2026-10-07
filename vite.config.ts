import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Serves the Vercel functions in /api during `vite dev`, so the full app runs locally
 * without the Vercel CLI. Each api/<name>.ts exports Web-standard GET/POST/... handlers.
 */
function devApi(): Plugin {
  async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const name = url.pathname.replace(/^\/api\//, '').split('/')[0];
    const file = path.resolve('api', `${name}.ts`);
    if (!/^[a-z-]+$/.test(name) || !existsSync(file)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const mod = await server.ssrLoadModule(file);
    const handler = mod[req.method ?? 'GET'];
    if (typeof handler !== 'function') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? new Uint8Array(await readBody(req)) : undefined,
    });

    const response: Response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        handle(server, req, res).catch((err) => {
          server.config.logger.error(String(err?.stack ?? err));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Dev server error' }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose .env / .env.local to the API handlers (process.env), as Vercel does in production.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), devApi()],
    server: { port: 3000 },
    build: { target: 'es2022' },
  };
});
