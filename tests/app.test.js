import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { analyzeListing, validateListingUrl, demoResult } from '../server/model.js';

const secret = 'testing-secret-at-least-32-characters-long';
let server, db, app, base;
before(async () => {
  db = openDatabase(':memory:'); app = createApp({ db, secret, modelConfig: {}, secureCookies: false });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { app.locals.stop(); await new Promise(r => server.close(r)); db.close(); });
async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('sign-up stores a hash, issues a 1-hour HttpOnly cookie, and restores the user', async () => {
  const { response, data, cookie } = await request('/auth/signup', { method: 'POST', body: { name: 'Test User', email: 'User@Example.com', password: 'my-test-pass-123' } });
  assert.equal(response.status, 201); assert.equal(data.user.email, 'user@example.com');
  const raw = response.headers.get('set-cookie');
  assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Lax/); assert.match(raw, /Max-Age=3600/);
  const token = jwt.verify(cookie.split('=')[1], secret);
  assert.equal(token.exp - token.iat, 3600);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(data.user.id);
  assert.match(user.password_hash, /^\$2[ab]\$/); assert.notEqual(user.password_hash, 'my-test-pass-123');
  assert.equal((await request('/auth/me', { cookie })).data.user.id, data.user.id);
  assert.deepEqual((await request('/queries', { cookie })).data.queries, []);
});

test('duplicate email, invalid signup, and wrong login fail; case-insensitive login succeeds', async () => {
  const duplicate = await request('/auth/signup', { method: 'POST', body: { name: 'Other User', email: 'USER@example.com', password: 'some-pass-123' } });
  assert.equal(duplicate.response.status, 409);
  assert.equal((await request('/auth/signup', { method: 'POST', body: { name: 'X', email: 'bad', password: 'short' } })).response.status, 400);
  assert.equal((await request('/auth/signup', { method: 'POST', body: { name: 'Long Password', email: 'long@example.com', password: 'a'.repeat(73) } })).response.status, 400);
  assert.equal((await request('/auth/signup', { method: 'POST', body: { name: 'Unicode Password', email: 'unicode@example.com', password: 'é'.repeat(40) } })).response.status, 400);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'user@example.com', password: 'incorrect-password' } })).response.status, 401);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'USER@example.com', password: 'my-test-pass-123' } })).response.status, 200);
});

test('unauthenticated access is rejected and cross-origin writes are blocked', async () => {
  assert.equal((await request('/queries')).response.status, 401);
  assert.equal((await request('/queries', { method: 'POST', body: { listing_url: 'x' }, headers: { Origin: 'https://attacker.test' } })).response.status, 403);
});

test('demo history, query persistence, thumbnail order, and ownership isolation', async () => {
  const a = await request('/auth/demo', { method: 'POST' });
  const b = await request('/auth/demo', { method: 'POST' });
  const history = await request('/queries', { cookie: a.cookie });
  assert.equal(history.data.queries.length, 6); assert.equal(history.data.queries[0].photos[0], '/images/bmw.jpg');
  const created = await request('/queries', { method: 'POST', cookie: a.cookie, body: { listing_url: 'https://www.facebook.com/marketplace/item/104827365901284/?tracking=removed' } });
  assert.equal(created.response.status, 201); assert.equal(created.data.query.source, 'demo');
  assert.equal(created.data.query.listing_url, 'https://www.facebook.com/marketplace/item/104827365901284/');
  assert.equal((await request(`/queries/${created.data.query.id}`, { cookie: a.cookie })).response.status, 200);
  assert.equal((await request(`/queries/${created.data.query.id}`, { cookie: b.cookie })).response.status, 404);
  assert.equal((await request('/queries', { cookie: a.cookie })).data.queries.length, 7);
  assert.equal((await request('/queries', { cookie: b.cookie })).data.queries.length, 6);
});

test('logout revokes tokens and absolute database expiry rejects otherwise valid JWTs', async () => {
  const demo = await request('/auth/demo', { method: 'POST' });
  await request('/auth/logout', { method: 'POST', cookie: demo.cookie });
  assert.equal((await request('/auth/me', { cookie: demo.cookie })).response.status, 401);
  const expiring = await request('/auth/demo', { method: 'POST' });
  const token = jwt.verify(expiring.cookie.split('=')[1], secret);
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1, token.sid);
  assert.equal((await request('/auth/me', { cookie: expiring.cookie })).response.status, 401);
  const expiredJwt = jwt.sign({ sid: token.sid }, secret, { subject: expiring.data.user.id, expiresIn: -1, audience: 'marketguard-web', issuer: 'marketguard' });
  assert.equal((await request('/auth/me', { cookie: `marketguard_session=${expiredJwt}` })).response.status, 401);
});

test('URL validation rejects look-alike hosts, non-listings, HTTP, userinfo, and ports', () => {
  for (const url of ['http://facebook.com/marketplace/item/123/', 'https://facebook.com.attacker.com/marketplace/item/123/', 'https://www.facebook.com/marketplace/', 'https://name@facebook.com/marketplace/item/123/', 'https://facebook.com:8080/marketplace/item/123/', 'https://localhost/marketplace/item/123/', 'not a link']) assert.throws(() => validateListingUrl(url));
  assert.equal(validateListingUrl(' https://m.facebook.com/marketplace/item/123?x=1 '), 'https://www.facebook.com/marketplace/item/123/');
});

test('live adapter sends authenticated request and validates the response without fabricating fallback', async () => {
  let captured;
  const fixture = demoResult('https://facebook.com/marketplace/item/104827365901284/');
  const upstream = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    captured = { body: JSON.parse(body), authorization: req.headers.authorization, method: req.method };
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/slow') return setTimeout(() => res.end(JSON.stringify(fixture)), 100);
    if (req.url === '/unsafe-photo') return res.end(JSON.stringify({ ...fixture, photos: ['javascript:alert(1)'] }));
    if (req.url === '/broken') return res.end(JSON.stringify({ prediction: 'invalid' }));
    if (req.url === '/error') { res.statusCode = 503; return res.end('{}'); }
    res.end(JSON.stringify({ ...fixture, prediction: 'thrust', photos: ['https://example.com/first.jpg', 'https://example.com/second.jpg'] }));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const endpoint = `http://127.0.0.1:${upstream.address().port}`;
  try {
    const url = 'https://www.facebook.com/marketplace/item/123/';
    const result = await analyzeListing(url, { MODEL_API_URL: endpoint, MODEL_API_KEY: 'test-key' });
    assert.deepEqual(captured.body, { listing_url: url }); assert.equal(captured.method, 'POST'); assert.equal(captured.authorization, 'Bearer test-key');
    assert.equal(result.source, 'model'); assert.equal(result.prediction, 'trustworthy'); assert.equal(result.photos[0], 'https://example.com/first.jpg');
    await assert.rejects(analyzeListing(url, { MODEL_API_URL: `${endpoint}/broken` }), /unexpected response/);
    await assert.rejects(analyzeListing(url, { MODEL_API_URL: `${endpoint}/error` }), /503/);
    await assert.rejects(analyzeListing(url, { MODEL_API_URL: `${endpoint}/unsafe-photo` }), /unexpected response/);
    await assert.rejects(analyzeListing(url, { MODEL_API_URL: `${endpoint}/slow`, MODEL_API_TIMEOUT_MS: '20' }), { name: 'TimeoutError' });
  } finally { await new Promise(r => upstream.close(r)); }
});

test('failed model analysis is not persisted and live results preserve the first photo', async () => {
  const liveDb = openDatabase(':memory:');
  let fail = true;
  const upstream = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.statusCode = 500; return res.end('{}'); }
    const fixture = demoResult('https://facebook.com/marketplace/item/104827365901284/');
    res.end(JSON.stringify({ ...fixture, photos: ['https://example.com/real-photo.jpg'] }));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const liveApp = createApp({ db: liveDb, secret, secureCookies: false, modelConfig: { MODEL_API_URL: `http://127.0.0.1:${upstream.address().port}` } });
  const liveServer = liveApp.listen(0, '127.0.0.1'); await once(liveServer, 'listening');
  const liveBase = `http://127.0.0.1:${liveServer.address().port}`;
  try {
    const auth = await fetch(`${liveBase}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Live Tester', email: 'live@example.com', password: 'test-pass-123' }) });
    const cookie = auth.headers.get('set-cookie').split(';')[0];
    const analyze = () => fetch(`${liveBase}/api/queries`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_url: 'https://www.facebook.com/marketplace/item/123/' }) });
    assert.equal((await analyze()).status, 502);
    assert.equal(liveDb.prepare('SELECT count(*) AS n FROM queries').get().n, 0);
    fail = false;
    const result = await (await analyze()).json();
    assert.equal(result.query.source, 'model'); assert.equal(result.query.photos[0], 'https://example.com/real-photo.jpg');
    assert.equal(liveDb.prepare('SELECT count(*) AS n FROM queries').get().n, 1);
  } finally { liveApp.locals.stop(); await new Promise(r => liveServer.close(r)); await new Promise(r => upstream.close(r)); liveDb.close(); }
});
