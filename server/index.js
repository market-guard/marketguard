import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { createApp } from './app.js';

// Persist a local signing key so a server restart doesn't invalidate active sessions.
// Production requires an explicitly managed secret.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('Set JWT_SECRET before starting in production.');
  mkdirSync('data', { recursive: true });
  const keyPath = resolve('data/.session-key');
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(48).toString('hex'), { mode: 0o600 });
  process.env.JWT_SECRET = readFileSync(keyPath, 'utf8').trim();
}
const app = createApp();
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT) || 3000;
app.listen(port, '127.0.0.1', () => console.log(`\n  Marketguard is running at http://localhost:${port}\n`));
