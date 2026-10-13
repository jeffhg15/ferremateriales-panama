// API HTTP. Los permisos se validan aquí, en el servidor; la interfaz sólo oculta lo que no aplica.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as D from './domain.js';
import {
  sessionMiddleware, csrfGuard, requireUser, requirePerm, loginRateLimit, createUser, verifyPassword,
  startSession, endSession, publicUser, ROLE_LABELS, can,
} from './auth.js';
import { dropAll } from './db.js';
import { seed } from './seed.js';

export function createApp(db, { demoMode = false, secureCookies = false, dataDir, uploadDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));
  app.use(sessionMiddleware(db));
  app.use('/api', csrfGuard);

  const wrap = (fn) => (req, res) => {
    try {
      const out = fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e) {
      if (e instanceof D.DomainError) return res.status(e.status).json({ error: e.message, code: e.code, details: e.details });
      console.error(e);
      res.status(500).json({ error: 'Ocurrió un error inesperado. Intente de nuevo.' });
    }
  };
  const actor = (req) => ({ id: req.user.id, name: req.user.name });
  const int = (x) => (x === '' || x === null || x === undefined ? NaN : Number(x));

  // ---------- Público ----------
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', wrap((req) => ({ settings: D.getSettings(db), demoMode, user: publicUser(req.user) })));
  app.get('/api/catalog', wrap(() => D.publicCatalog(db)));

  // ---------- Cuenta ----------
  app.post('/api/auth/register', wrap((req, res) => {
    const { email, name, phone, password } = req.body || {};
    const id = createUser(db, { email, name, phone, password, role: 'customer' }); // el rol nunca viene del cliente
    startSession(db, res, id, secureCookies);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  }));
  app.post('/api/auth/login', loginRateLimit, wrap((req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(password || ''), u.password_hash)) throw new D.DomainError('Correo o contraseña incorrectos.', { status: 401 });
    startSession(db, res, u.id, secureCookies);
    return { user: publicUser(u) };
  }));
  app.post('/api/auth/logout', wrap((req, res) => { endSession(db, req, res); return { ok: true }; }));

  // ---------- Pedidos del cliente (propiedad verificada) ----------
  app.post('/api/orders', requireUser, wrap((req, res) => {
    const { order, duplicate } = D.placeOrder(db, req.user, req.body || {});
    res.status(duplicate ? 200 : 201);
    return { order, duplicate };
  }));
  app.get('/api/orders', requireUser, wrap((req) => ({ orders: D.listOrders(db, { userId: req.user.id }) })));
  const ownOrder = (req) => {
    const o = D.getOrderByNumber(db, req.params.number);
    // Mismo 404 si no existe o pertenece a otro cliente, para no revelar números ajenos.
    if (!o || o.userId !== req.user.id) throw new D.DomainError('Pedido no encontrado.', { status: 404 });
    return o;
  };
  app.get('/api/orders/:number', requireUser, wrap((req) => ({ order: ownOrder(req) })));
  app.post('/api/orders/:number/cancel', requireUser, wrap((req) => ({ order: D.customerCancel(db, req.user, ownOrder(req).id) })));

  // ---------- Personal ----------
  const staff = express.Router();
  staff.use(requirePerm('staff'));
  staff.get('/meta', wrap((req) => ({ ...D.listMeta(db), me: publicUser(req.user) })));
  staff.get('/summary', wrap(() => D.summary(db)));

  staff.get('/products', requirePerm('products'), wrap(() => ({ products: D.adminProducts(db) })));
  staff.post('/products', requirePerm('products'), wrap((req) => ({ id: D.createProduct(db, actor(req), req.body) })));
  staff.put('/products/:id', requirePerm('products'), wrap((req) => ({ id: D.updateProduct(db, actor(req), Number(req.params.id), req.body) })));
  staff.post('/products/:id/archive', requirePerm('products'), wrap((req) => { D.setArchived(db, Number(req.params.id), !!req.body.archived); return { ok: true }; }));
  staff.post('/uploads', requirePerm('products'), wrap((req) => {
    const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
    if (!m) throw new D.DomainError('Suba una imagen PNG, JPG o WebP.');
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 2 * 1024 * 1024) throw new D.DomainError('La imagen no puede superar 2 MB.');
    const name = `${crypto.randomBytes(8).toString('hex')}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return { url: `/uploads/${name}` };
  }));

  staff.post('/stock/adjust', requirePerm('stock'), wrap((req) => {
    const b = req.body || {};
    return D.adjustStock(db, actor(req), { variantId: Number(b.variantId), type: b.type, qty: int(b.qty), countedQty: int(b.countedQty), reason: b.reason, reference: b.reference });
  }));
  staff.post('/stock/receipts', requirePerm('stock'), wrap((req) => {
    const b = req.body || {};
    return D.receiveFromSupplier(db, actor(req), {
      supplierId: Number(b.supplierId), reference: b.reference, notes: b.notes,
      lines: (b.lines || []).map((l) => ({ variantId: Number(l.variantId), qty: int(l.qty) })),
    });
  }));
  staff.get('/movements', wrap((req) => {
    if (!can(req.user, 'stock') && !can(req.user, 'orders')) throw new D.DomainError('No tiene permiso.', { status: 403 });
    return { movements: D.listMovements(db, req.query) };
  }));
  staff.get('/movements.csv', (req, res) => {
    if (!can(req.user, 'stock') && !can(req.user, 'orders')) return res.status(403).end();
    const rows = D.listMovements(db, { ...req.query, limit: 100000 });
    const fmt = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'medium' });
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const head = ['ID', 'Fecha (America/Panama)', 'SKU', 'Producto', 'Tipo', 'Δ físico', 'Δ reservado', 'Físico antes', 'Físico después', 'Reservado antes', 'Reservado después', 'Motivo', 'Referencia', 'Proveedor', 'Recepción', 'Usuario'];
    const body = rows.map((m) => [m.id, fmt.format(new Date(m.createdAt)), m.sku, m.productName, m.typeLabel, m.physicalDelta, m.reservedDelta, m.physicalBefore, m.physicalAfter, m.reservedBefore, m.reservedAfter, m.reason, m.reference, m.supplierName, m.receiptId, m.actorName].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="historial-movimientos.csv"');
    res.send('﻿' + [head.map(esc).join(','), ...body].join('\r\n'));
  });

  staff.get('/suppliers', wrap((req) => {
    if (!can(req.user, 'suppliers')) throw new D.DomainError('No tiene permiso.', { status: 403 });
    return { suppliers: D.listSuppliers(db) };
  }));
  staff.post('/suppliers', requirePerm('suppliers'), wrap((req) => ({ id: D.saveSupplier(db, req.body || {}) })));

  staff.get('/orders', requirePerm('orders'), wrap((req) => ({ orders: D.listOrders(db, { q: req.query.q, status: req.query.status }) })));
  staff.get('/orders/:id', requirePerm('orders'), wrap((req) => {
    const o = D.getOrder(db, Number(req.params.id));
    if (!o) throw new D.DomainError('Pedido no encontrado.', { status: 404 });
    return { order: o };
  }));
  staff.post('/orders/:id/status', requirePerm('orders'), wrap((req) => {
    const b = req.body || {};
    const dc = b.deliveryCents === undefined || b.deliveryCents === '' ? undefined : int(b.deliveryCents);
    return { order: D.changeOrderStatus(db, actor(req), Number(req.params.id), b.status, { note: b.note, deliveryCents: dc }) };
  }));
  staff.post('/orders/:id/delivery', requirePerm('orders'), wrap((req) => ({ order: D.setDeliveryCharge(db, actor(req), Number(req.params.id), int(req.body?.deliveryCents)) })));
  staff.post('/orders/:id/payment', requirePerm('orders'), wrap((req) => ({ order: D.setPaymentStatus(db, actor(req), Number(req.params.id), req.body?.status, req.body?.note) })));
  staff.post('/orders/:id/returns', requirePerm('orders'), wrap((req) => {
    const b = req.body || {};
    return { order: D.recordReturn(db, actor(req), Number(req.params.id), { itemId: Number(b.itemId), resellable: int(b.resellable || 0), damaged: int(b.damaged || 0), reason: b.reason }) };
  }));

  // Configuración (sólo administrador)
  staff.put('/settings', requirePerm('settings'), wrap((req) => ({ settings: D.updateSettings(db, req.body || {}) })));
  staff.post('/units', requirePerm('settings'), wrap((req) => { D.saveUnit(db, req.body || {}); return { ok: true }; }));
  staff.post('/tax-rates', requirePerm('settings'), wrap((req) => { D.saveTaxRate(db, { ...req.body, rateBp: int(req.body?.rateBp) }); return { ok: true }; }));
  staff.get('/users', requirePerm('users'), wrap(() => ({
    users: db.prepare("SELECT * FROM users WHERE role <> 'customer' ORDER BY id").all().map((u) => ({ ...publicUser(u), active: !!u.active })),
    roles: Object.fromEntries(Object.entries(ROLE_LABELS).filter(([k]) => k !== 'customer')),
  })));
  staff.post('/users', requirePerm('users'), wrap((req) => {
    const b = req.body || {};
    if (!['admin', 'inventory', 'orders'].includes(b.role)) throw new D.DomainError('Seleccione un rol de personal.');
    return { id: createUser(db, b) };
  }));
  staff.put('/users/:id', requirePerm('users'), wrap((req) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    if (id === req.user.id && (b.role !== 'admin' || b.active === false)) throw new D.DomainError('No puede quitarse a sí mismo el rol de administrador ni desactivarse.');
    if (!['admin', 'inventory', 'orders'].includes(b.role)) throw new D.DomainError('Rol inválido.');
    const r = db.prepare("UPDATE users SET role = ?, active = ? WHERE id = ? AND role <> 'customer'").run(b.role, b.active === false ? 0 : 1, id);
    if (!r.changes) throw new D.DomainError('Usuario no encontrado.', { status: 404 });
    if (b.active === false) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return { ok: true };
  }));

  // Restablecer datos: sólo en modo demostración y sólo administrador.
  staff.post('/demo/reset', requirePerm('demo_reset'), wrap((req, res) => {
    if (!demoMode) throw new D.DomainError('Disponible solo en modo demostración.', { status: 403 });
    if (req.body?.confirm !== 'RESTABLECER') throw new D.DomainError('Escriba RESTABLECER para confirmar.');
    dropAll(db);
    seed(db, { dataDir, quiet: true });
    res.clearCookie('fm_session', { path: '/' });
    return { ok: true, message: 'Datos de demostración restablecidos. Las contraseñas se regeneraron (vea data/demo-credentials.txt o sus variables SEED_*).' };
  }));

  app.use('/api/staff', staff);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  if (uploadDir) app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
  return app;
}
