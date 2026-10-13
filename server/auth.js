// Autenticación con sesiones en servidor (cookie HttpOnly) y permisos por rol.
import crypto from 'node:crypto';
import { DomainError } from './domain.js';

const COOKIE = 'fm_session';
const SESSION_DAYS = 14;

export const ROLE_LABELS = {
  customer: 'Cliente',
  admin: 'Administrador',
  inventory: 'Personal de inventario',
  orders: 'Personal de pedidos',
};

// Permisos aplicados en el servidor. El administrador tiene todos.
const PERMISSIONS = {
  admin: ['staff', 'products', 'stock', 'suppliers', 'orders', 'settings', 'users', 'demo_reset'],
  inventory: ['staff', 'products', 'stock', 'suppliers'],
  orders: ['staff', 'orders'],
  customer: [],
};

export const can = (user, perm) => !!user && (PERMISSIONS[user.role] || []).includes(perm);
export const permissionsFor = (role) => PERMISSIONS[role] || [];

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw new DomainError('La contraseña debe tener al menos 8 caracteres.');
}

export function createUser(db, { email, name, phone = '', password, role = 'customer' }) {
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DomainError('Ingrese un correo electrónico válido.');
  if (name.length < 2) throw new DomainError('Ingrese su nombre.');
  if (!ROLE_LABELS[role]) throw new DomainError('Rol inválido.');
  validatePassword(password);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new DomainError('Ya existe una cuenta con ese correo.', { status: 409 });
  const r = db.prepare('INSERT INTO users (email, name, phone, password_hash, role) VALUES (?,?,?,?,?)')
    .run(email, name, String(phone || '').trim(), hashPassword(password), role);
  return Number(r.lastInsertRowid);
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, roleLabel: ROLE_LABELS[u.role], permissions: permissionsFor(u.role) };
}

export function startSession(db, res, userId, secure) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), userId, expires.toISOString());
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, expires, path: '/' });
}

export function endSession(db, req, res) {
  const t = readCookie(req);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Middleware: adjunta req.user a partir de la cookie de sesión. */
export function sessionMiddleware(db) {
  return (req, _res, next) => {
    req.user = null;
    const t = readCookie(req);
    if (t) {
      const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sha(t), new Date().toISOString());
      if (row) req.user = row;
    }
    next();
  };
}

/**
 * Protección CSRF: las mutaciones deben llegar como JSON con un encabezado propio,
 * algo que un formulario de otro sitio no puede enviar sin CORS.
 */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'fm-app') return res.status(403).json({ error: 'Solicitud rechazada.' });
  next();
}

export const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Inicie sesión para continuar.' }));

export const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Inicie sesión para continuar.' });
  if (!can(req.user, perm)) return res.status(403).json({ error: 'No tiene permiso para realizar esta acción.' });
  next();
};

// Limitador simple en memoria para intentos de inicio de sesión.
const attempts = new Map();
export function loginRateLimit(req, res, next) {
  const key = `${req.ip}|${String(req.body?.email || '').toLowerCase()}`;
  const nowMs = Date.now();
  const rec = attempts.get(key) || { n: 0, t: nowMs };
  if (nowMs - rec.t > 15 * 60000) { rec.n = 0; rec.t = nowMs; }
  if (rec.n >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos.' });
  rec.n += 1;
  attempts.set(key, rec);
  next();
}
