// Conexión SQLite (node:sqlite) y esquema. Toda la lógica de stock vive en domain.js.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

/**
 * Ejecuta fn dentro de una transacción BEGIN IMMEDIATE (bloqueo de escritura desde el inicio),
 * de modo que las verificaciones de disponibilidad y las reservas no se intercalen con otra escritura.
 */
export function tx(db, fn) {
  if (db.__inTx) return fn();
  db.exec('BEGIN IMMEDIATE');
  db.__inTx = true;
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.__inTx = false;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','inventory','orders')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  code TEXT PRIMARY KEY,
  name_singular TEXT NOT NULL,
  name_plural TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  rate_bp INTEGER NOT NULL CHECK (rate_bp >= 0 AND rate_bp <= 10000)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image TEXT NOT NULL,
  tint TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL REFERENCES categories(id),
  subcategory TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  featured_rank INTEGER,
  merch_rank INTEGER,
  on_offer INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Cada variante es un SKU con su propio precio y existencias.
-- "Disponible" no se almacena: siempre es physical - reserved.
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '{}',
  unit_code TEXT NOT NULL REFERENCES units(code),
  step INTEGER NOT NULL DEFAULT 1 CHECK (step >= 1),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  tax_rate_id INTEGER NOT NULL REFERENCES tax_rates(id),
  physical INTEGER NOT NULL DEFAULT 0 CHECK (physical >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  reorder_threshold INTEGER NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  CHECK (reserved <= physical)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS supplier_receipts (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  reference TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('pickup','delivery')),
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'recibido',
  payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente','confirmado','anulado')),
  -- Estado de existencias del pedido: garantiza que reservar, liberar y despachar ocurran una sola vez.
  stock_state TEXT NOT NULL DEFAULT 'reserved' CHECK (stock_state IN ('reserved','released','fulfilled')),
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  delivery_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, idempotency_key)
);

-- Instantánea de nombre, SKU, unidad y precio al momento del pedido.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  unit_code TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  tax_rate_bp INTEGER NOT NULL,
  tax_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_subtotal_cents INTEGER NOT NULL,
  line_tax_cents INTEGER NOT NULL,
  returned_resellable INTEGER NOT NULL DEFAULT 0,
  returned_damaged INTEGER NOT NULL DEFAULT 0,
  CHECK (returned_resellable + returned_damaged <= qty)
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT NOT NULL DEFAULT '',
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL,
  physical_delta INTEGER NOT NULL,
  reserved_delta INTEGER NOT NULL,
  physical_before INTEGER NOT NULL,
  physical_after INTEGER NOT NULL,
  reserved_before INTEGER NOT NULL,
  reserved_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  supplier_id INTEGER REFERENCES suppliers(id),
  receipt_id INTEGER REFERENCES supplier_receipts(id),
  order_id INTEGER REFERENCES orders(id),
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mov_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_mov_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

-- El historial de movimientos es inmutable.
CREATE TRIGGER IF NOT EXISTS stock_movements_no_update BEFORE UPDATE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'El historial de movimientos es inmutable'); END;
CREATE TRIGGER IF NOT EXISTS stock_movements_no_delete BEFORE DELETE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'El historial de movimientos es inmutable'); END;
CREATE TRIGGER IF NOT EXISTS order_events_no_update BEFORE UPDATE ON order_events
BEGIN SELECT RAISE(ABORT, 'El historial de pedidos es inmutable'); END;
`;

function migrate(db) {
  db.exec(SCHEMA);
}

/** Borra todas las tablas (solo para "Restablecer datos de demostración" y pruebas). */
export function dropAll(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  const objs = db.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'").all();
  for (const o of objs.filter((o) => o.type === 'trigger')) db.exec(`DROP TRIGGER IF EXISTS "${o.name}"`);
  for (const o of objs.filter((o) => o.type === 'table')) db.exec(`DROP TABLE IF EXISTS "${o.name}"`);
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
}
