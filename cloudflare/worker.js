const SESSION_COOKIE = 'hd_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function testerKey(email) {
  return `tester:${normalizeEmail(email)}`;
}

async function getTester(env, email) {
  return env.TESTERS.get(testerKey(email), { type: 'json' });
}

async function putTester(env, tester) {
  await env.TESTERS.put(testerKey(tester.email), JSON.stringify(tester));
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const result = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    result[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return result;
}

async function makeSession(env, email) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    email: normalizeEmail(email),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  })));
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

async function readSession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const [payload, suppliedSig] = token.split('.');
  if (!payload || !suppliedSig) return null;
  const expectedSig = await hmac(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(suppliedSig, expectedSig)) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    const tester = await getTester(env, data.email);
    if (!tester || tester.status === 'Disabled') return null;
    return tester;
  } catch {
    return null;
  }
}

function requireAdmin(request, env) {
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  return env.ADMIN_TOKEN && timingSafeEqual(supplied, expected);
}

async function registerTester(request, env) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  if (!name || !validEmail(email)) return json({ error: 'Valid name and email are required.' }, 400);

  const token = randomToken();
  const now = new Date().toISOString();
  const previous = await getTester(env, email);
  const tester = {
    id: previous?.id || crypto.randomUUID(),
    name,
    email,
    status: 'Setup',
    tokenHash: await sha256(token),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    activatedAt: previous?.activatedAt || null,
    disabledAt: null
  };
  await putTester(env, tester);

  const url = new URL(request.url);
  const inviteUrl = `${url.origin}/access?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return json({
    tester: { id: tester.id, name, email, status: tester.status, createdAt: tester.createdAt, updatedAt: tester.updatedAt },
    inviteUrl
  }, 201);
}

async function disableTester(request, env) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }
  const email = normalizeEmail(body.email);
  const tester = await getTester(env, email);
  if (!tester) return json({ error: 'Tester not found.' }, 404);
  tester.status = 'Disabled';
  tester.disabledAt = new Date().toISOString();
  tester.updatedAt = tester.disabledAt;
  await putTester(env, tester);
  return json({ tester: { name: tester.name, email: tester.email, status: tester.status } });
}

async function listTesters(request, env) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  const listed = await env.TESTERS.list({ prefix: 'tester:' });
  const testers = [];
  for (const key of listed.keys) {
    const tester = await env.TESTERS.get(key.name, { type: 'json' });
    if (!tester) continue;
    const { tokenHash, ...safe } = tester;
    testers.push(safe);
  }
  testers.sort((a, b) => a.name.localeCompare(b.name));
  return json({ testers });
}

async function access(request, env) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email'));
  const token = url.searchParams.get('token') || '';
  const tester = await getTester(env, email);
  if (!tester || tester.status === 'Disabled' || !token) {
    return new Response('This Help Desk invitation is invalid or no longer active.', { status: 403 });
  }
  const suppliedHash = await sha256(token);
  if (!timingSafeEqual(suppliedHash, tester.tokenHash || '')) {
    return new Response('This Help Desk invitation is invalid or no longer active.', { status: 403 });
  }

  if (tester.status !== 'Active') {
    tester.status = 'Active';
    tester.activatedAt = tester.activatedAt || new Date().toISOString();
    tester.updatedAt = new Date().toISOString();
    await putTester(env, tester);
  }

  const session = await makeSession(env, email);
  return new Response(null, {
    status: 302,
    headers: {
      location: '/',
      'set-cookie': `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`,
      'cache-control': 'no-store'
    }
  });
}

async function proxyToOrigin(request, env) {
  if (!env.ORIGIN_URL) return new Response('Help Desk origin is not configured.', { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(env.ORIGIN_URL);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');
  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
  return fetch(new Request(target.toString(), init));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') return json({ ok: true, service: 'ai-help-desk-access-gateway' });
    if (url.pathname === '/access' && request.method === 'GET') return access(request, env);
    if (url.pathname === '/admin/testers' && request.method === 'POST') return registerTester(request, env);
    if (url.pathname === '/admin/testers' && request.method === 'GET') return listTesters(request, env);
    if (url.pathname === '/admin/testers/disable' && request.method === 'POST') return disableTester(request, env);

    const tester = await readSession(request, env);
    if (!tester) {
      return new Response('AI Help Desk access is limited to approved testers. Use the private invitation link you received.', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    return proxyToOrigin(request, env);
  }
};
