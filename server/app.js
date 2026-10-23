import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { openDatabase } from './db.js';
import { analyzeListing, validateListingUrl, demoResult, samples } from './model.js';

const HOUR = 3600000;
const COOKIE = 'marketguard_session';
const credentials = z.object({
  email: z.email('Enter a valid email address.').max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8, 'Use at least 8 characters for your password.').max(72, 'Use a password of at most 72 bytes.').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Use a password of at most 72 bytes.'),
});
const signup = credentials.extend({ name: z.string().trim().min(2, 'Enter your name (at least 2 characters).').max(80) });
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, is_demo: Boolean(u.is_demo) });
const serializeQuery = q => ({ id: q.id, listing_url: q.listing_url, created_at: q.created_at, ...JSON.parse(q.result_json) });

export function createApp({ db = openDatabase(), secret = process.env.JWT_SECRET || randomBytes(48).toString('hex'), modelConfig = process.env, secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.db = db;
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };
  app.use(express.json({ limit: '12kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
    }
    next();
  });

  // Small in-memory limiter is sufficient for a single-process local PoC.
  const attempts = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.reset < now) attempts.delete(key);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }, 60000);
  sweep.unref();
  app.locals.stop = () => clearInterval(sweep);
  function limit(max) {
    return (req, res, next) => {
      const key = `${req.ip}:${req.path}`;
      let entry = attempts.get(key);
      if (!entry || entry.reset < Date.now()) entry = { count: 0, reset: Date.now() + 60000 };
      attempts.set(key, entry);
      if (++entry.count > max) return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
      next();
    };
  }
  function startSession(res, user) {
    const id = randomUUID();
    const expires = Date.now() + HOUR;
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, user.id, expires);
    const token = jwt.sign({ sid: id }, secret, { subject: user.id, expiresIn: '1h', algorithm: 'HS256', issuer: 'marketguard', audience: 'marketguard-web' });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: HOUR });
    return { user: publicUser(user), expires_at: new Date(expires).toISOString() };
  }
  function auth(req, res, next) {
    try {
      const token = jwt.verify(req.cookies[COOKIE], secret, { algorithms: ['HS256'], issuer: 'marketguard', audience: 'marketguard-web' });
      const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(token.sid, token.sub, Date.now());
      if (!session) throw new Error('Expired session');
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(token.sub);
      if (!req.user) throw new Error('Unknown user');
      req.session = session;
      next();
    } catch {
      res.clearCookie(COOKIE, cookieOptions);
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
  }
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/signup', limit(10), async (req, res) => {
    const data = signup.parse(req.body);
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(data.email)) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    const password = await bcrypt.hash(data.password, 12);
    const user = { id: randomUUID(), name: data.name, email: data.email, is_demo: 0 };
    try { db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(user.id, user.name, user.email, password); }
    catch (error) { if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists.' }); throw error; }
    res.status(201).json(startSession(res, user));
  });
  app.post('/api/auth/login', limit(12), async (req, res) => {
    const data = credentials.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(data.email);
    const valid = await bcrypt.compare(data.password, user?.password_hash || '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36JbxV9VcT1sK0enNqW0xEu');
    if (!user || !valid) return res.status(401).json({ error: 'The email or password is incorrect.' });
    res.json(startSession(res, user));
  });
  app.post('/api/auth/demo', limit(10), (req, res) => {
    const id = randomUUID();
    const user = { id, name: 'Alex Morgan', email: `demo-${id}@marketguard.local`, is_demo: 1 };
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO users (id, name, email, password_hash, is_demo) VALUES (?, ?, ?, ?, 1)').run(id, user.name, user.email, 'disabled-demo-login');
      samples.forEach((sample, index) => {
        const listing = `https://www.facebook.com/marketplace/item/${sample.item}/`;
        const timestamp = new Date(Date.now() - index * 22 * 3600000).toISOString();
        db.prepare('INSERT INTO queries (id, user_id, listing_url, result_json, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, listing, JSON.stringify(demoResult(listing)), timestamp);
      });
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json(startSession(res, user));
  });
  app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user), expires_at: new Date(req.session.expires_at).toISOString() }));
  app.post('/api/auth/logout', (req, res) => {
    try {
      const token = jwt.verify(req.cookies[COOKIE], secret, { algorithms: ['HS256'], issuer: 'marketguard', audience: 'marketguard-web' });
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token.sid);
    } catch { /* Clearing an already expired session is also successful. */ }
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ ok: true });
  });
  app.get('/api/config', auth, (req, res) => res.json({ model_mode: modelConfig.MODEL_API_URL ? 'live' : 'demo' }));
  app.get('/api/queries', auth, (req, res) => {
    const queries = db.prepare('SELECT * FROM queries WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map(serializeQuery);
    res.json({ queries });
  });
  app.get('/api/queries/:id', auth, (req, res) => {
    const query = db.prepare('SELECT * FROM queries WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!query) return res.status(404).json({ error: 'This query was not found.' });
    res.json({ query: serializeQuery(query) });
  });
  app.post('/api/queries', auth, limit(20), async (req, res) => {
    let listing;
    try { listing = validateListingUrl(req.body?.listing_url); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    let result;
    try { result = await analyzeListing(listing, modelConfig); }
    catch (error) {
      console.error('Model API failure:', error.message);
      return res.status(502).json({ error: error.name === 'TimeoutError' ? 'The model took too long to respond. Please try again.' : 'The model service could not complete this analysis. Please check its connection and response format, then try again.' });
    }
    const query = { id: randomUUID(), listing_url: listing, created_at: new Date().toISOString(), ...result };
    db.prepare('INSERT INTO queries (id, user_id, listing_url, result_json, created_at) VALUES (?, ?, ?, ?, ?)').run(query.id, req.user.id, listing, JSON.stringify(result), query.created_at);
    res.status(201).json({ query });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Check the submitted information.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
