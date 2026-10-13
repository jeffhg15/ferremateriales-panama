// Pruebas HTTP de permisos y propiedad: un cliente no accede a acciones de personal ni a pedidos ajenos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';

let server, base, creds;

before(async () => {
  const db = openDb(':memory:');
  ({ creds } = seed(db, { withDemoOrders: true, quiet: true }));
  const app = createApp(db, { demoMode: true });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  return async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-requested-with': 'fm-app', ...(cookie ? { cookie } : {}), ...headers },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

test('cliente no puede acceder a rutas de personal', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { email: creds.customer.email, password: creds.customer.password })).status, 200);
  for (const [m, p] of [['GET', '/api/staff/summary'], ['GET', '/api/staff/products'], ['GET', '/api/staff/orders'], ['POST', '/api/staff/stock/adjust'], ['PUT', '/api/staff/settings'], ['POST', '/api/staff/demo/reset']]) {
    assert.equal((await c(m, p, {})).status, 403, `${m} ${p}`);
  }
});

test('registro ignora cualquier rol enviado por el cliente', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/register', { email: 'nuevo@example.test', name: 'Nuevo', password: 'contrasena-larga', role: 'admin' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'customer');
  assert.equal((await c('GET', '/api/staff/summary')).status, 403);
});

test('un cliente no puede ver pedidos de otro cliente', async () => {
  const owner = client();
  await owner('POST', '/api/auth/login', { email: creds.customer.email, password: creds.customer.password });
  const mine = await owner('GET', '/api/orders');
  assert.ok(mine.body.orders.length > 0);
  const number = mine.body.orders[0].number;
  assert.equal((await owner('GET', `/api/orders/${number}`)).status, 200);
  const intruder = client();
  await intruder('POST', '/api/auth/register', { email: 'intruso@example.test', name: 'Intruso', password: 'contrasena-larga' });
  assert.equal((await intruder('GET', `/api/orders/${number}`)).status, 404);
  assert.equal((await intruder('POST', `/api/orders/${number}/cancel`)).status, 404);
  assert.equal((await intruder('GET', '/api/orders')).body.orders.length, 0);
});

test('personal de pedidos no puede ajustar inventario ni configuración', async () => {
  const c = client();
  await c('POST', '/api/auth/login', { email: creds.orders.email, password: creds.orders.password });
  assert.equal((await c('GET', '/api/staff/orders')).status, 200);
  assert.equal((await c('POST', '/api/staff/stock/adjust', { variantId: 1, type: 'entrada', qty: 1, reason: 'x' })).status, 403);
  assert.equal((await c('PUT', '/api/staff/settings', { businessName: 'X' })).status, 403);
});

test('personal de inventario no gestiona pedidos', async () => {
  const c = client();
  await c('POST', '/api/auth/login', { email: creds.inventory.email, password: creds.inventory.password });
  assert.equal((await c('GET', '/api/staff/products')).status, 200);
  assert.equal((await c('GET', '/api/staff/orders')).status, 403);
});

test('mutaciones sin encabezado de la app son rechazadas (CSRF)', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/login', { email: creds.customer.email, password: creds.customer.password }, { 'x-requested-with': '' });
  assert.equal(r.status, 403);
});

test('pedido anónimo requiere sesión', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/orders', { items: [] })).status, 401);
});
