import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import * as D from '../server/domain.js';
import { createUser } from '../server/auth.js';

let db, customer, staff, vid;

const stock = (id) => {
  const v = db.prepare('SELECT physical, reserved FROM variants WHERE id = ?').get(id);
  return { physical: v.physical, reserved: v.reserved, available: v.physical - v.reserved };
};
let n = 0;
const order = (qty, fulfillment = 'pickup', variantId = vid, user = customer) => D.placeOrder(db, user, {
  idempotencyKey: `k${++n}`, customerName: 'Prueba', phone: '6000-1111', fulfillment,
  address: fulfillment === 'delivery' ? 'Calle de prueba 123, La Chorrera' : '', items: [{ variantId, qty }],
}).order;
const advance = (o, ...steps) => steps.reduce((_, s) => D.changeOrderStatus(db, staff, o.id, s, s === 'confirmado' && o.fulfillment === 'delivery' ? { deliveryCents: 0 } : {}), null);

beforeEach(() => {
  db = openDb(':memory:');
  seed(db, { withDemoOrders: false, quiet: true });
  customer = db.prepare("SELECT * FROM users WHERE role = 'customer'").get();
  const s = db.prepare("SELECT * FROM users WHERE role = 'orders'").get();
  staff = { id: s.id, name: s.name };
  // SKU de prueba con 20 unidades físicas y 0 reservadas.
  vid = db.prepare("SELECT id FROM variants WHERE sku = 'TAL-20V-1'").get().id;
  D.adjustStock(db, staff, { variantId: vid, type: 'conteo', countedQty: 20, reason: 'Preparar prueba' });
});

test('ejemplo del enunciado: reservar, completar una sola vez', () => {
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
  const o = order(3);
  assert.deepEqual(stock(vid), { physical: 20, reserved: 3, available: 17 });
  advance(o, 'confirmado', 'en_preparacion', 'listo_para_retirar', 'completado');
  assert.deepEqual(stock(vid), { physical: 17, reserved: 0, available: 17 });
  assert.throws(() => D.changeOrderStatus(db, staff, o.id, 'completado'), /ya está en estado/);
  assert.deepEqual(stock(vid), { physical: 17, reserved: 0, available: 17 });
  const despachos = db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE order_id = ? AND type = 'despacho'").get(o.id).n;
  assert.equal(despachos, 1);
});

test('cancelar libera la reserva exactamente una vez', () => {
  const o = order(3);
  D.changeOrderStatus(db, staff, o.id, 'cancelado');
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
  assert.throws(() => D.changeOrderStatus(db, staff, o.id, 'cancelado'));
  assert.throws(() => D.changeOrderStatus(db, staff, o.id, 'completado'));
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
});

test('agregar al carrito no reserva: sólo el envío explícito crea pedido', () => {
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
});

test('rechaza sobre-existencia, cero, negativos e incrementos inválidos', () => {
  assert.throws(() => order(21), (e) => e.code === 'stock' && /solo hay 20/.test(e.details[0]));
  assert.throws(() => order(0), (e) => e.code === 'stock');
  assert.throws(() => order(-2), (e) => e.code === 'stock');
  assert.throws(() => order(1.5), (e) => e.code === 'stock');
  const blo = db.prepare("SELECT id, step FROM variants WHERE sku = 'BLO-4'").get();
  assert.equal(blo.step, 10);
  assert.throws(() => order(15, 'pickup', blo.id), (e) => /múltiplos de 10/.test(e.details[0]));
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
});

test('pedido con varias líneas: todo o nada', () => {
  const agotado = db.prepare("SELECT id FROM variants WHERE sku = 'VAR-58-6'").get().id;
  assert.throws(() => D.placeOrder(db, customer, {
    idempotencyKey: 'multi', customerName: 'Prueba', phone: '6000-1111', fulfillment: 'pickup',
    items: [{ variantId: vid, qty: 2 }, { variantId: agotado, qty: 1 }],
  }), (e) => e.code === 'stock');
  assert.deepEqual(stock(vid), { physical: 20, reserved: 0, available: 20 });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
});

test('envío duplicado con la misma clave no crea otro pedido ni reserva doble', () => {
  const input = { idempotencyKey: 'same', customerName: 'Prueba', phone: '6000-1111', fulfillment: 'pickup', items: [{ variantId: vid, qty: 2 }] };
  const a = D.placeOrder(db, customer, input);
  const b = D.placeOrder(db, customer, input);
  assert.equal(a.order.id, b.order.id);
  assert.equal(b.duplicate, true);
  assert.deepEqual(stock(vid), { physical: 20, reserved: 2, available: 18 });
});

test('pedidos simultáneos no sobrevenden', () => {
  const other = createUser(db, { email: 'otro@example.test', name: 'Otro', password: 'contrasena-larga' });
  const u2 = db.prepare('SELECT * FROM users WHERE id = ?').get(other);
  order(15);
  assert.throws(() => order(10, 'pickup', vid, u2), (e) => e.code === 'stock');
  order(5, 'pickup', vid, u2);
  assert.deepEqual(stock(vid), { physical: 20, reserved: 20, available: 0 });
  assert.throws(() => order(1), (e) => e.code === 'stock');
});

test('cambiar precio del catálogo no altera pedidos existentes', () => {
  const o = order(1);
  const before = o.items[0].unitPriceCents;
  db.prepare('UPDATE variants SET price_cents = price_cents * 2 WHERE id = ?').run(vid);
  const again = D.getOrder(db, o.id);
  assert.equal(again.items[0].unitPriceCents, before);
  assert.equal(again.subtotalCents, before);
});

test('transiciones inválidas según tipo de entrega', () => {
  const p = order(1, 'pickup');
  advance(p, 'confirmado', 'en_preparacion');
  assert.throws(() => D.changeOrderStatus(db, staff, p.id, 'en_reparto'), /No se puede pasar/);
  const d = order(1, 'delivery');
  assert.equal(d.totalCents, null, 'entrega sin costo definido: total por confirmar');
  assert.throws(() => D.changeOrderStatus(db, staff, d.id, 'confirmado'), /cargo de entrega/);
  D.changeOrderStatus(db, staff, d.id, 'confirmado', { deliveryCents: 500 });
  assert.equal(D.getOrder(db, d.id).totalCents, d.subtotalCents + d.taxCents + 500);
  assert.throws(() => D.changeOrderStatus(db, staff, d.id, 'listo_para_retirar'));
});

test('devoluciones: sólo lo revendible reingresa; no excede lo despachado', () => {
  const o = order(4);
  advance(o, 'confirmado', 'en_preparacion', 'listo_para_retirar', 'completado');
  assert.deepEqual(stock(vid), { physical: 16, reserved: 0, available: 16 });
  const itemId = o.items[0].id;
  D.recordReturn(db, staff, o.id, { itemId, resellable: 2, damaged: 1, reason: 'Cliente devolvió' });
  assert.deepEqual(stock(vid), { physical: 18, reserved: 0, available: 18 });
  assert.throws(() => D.recordReturn(db, staff, o.id, { itemId, resellable: 2, reason: 'otra' }), /Solo quedan 1/);
  const dan = db.prepare("SELECT physical_delta FROM stock_movements WHERE order_id = ? AND type = 'devolucion_danada'").get(o.id);
  assert.equal(dan.physical_delta, 0);
  const activo = order(1);
  assert.throws(() => D.recordReturn(db, staff, activo.id, { itemId: activo.items[0].id, resellable: 1, reason: 'x' }), /completados/);
});

test('ajustes: requieren motivo, no dejan negativo ni por debajo de lo reservado, y quedan en el historial', () => {
  assert.throws(() => D.adjustStock(db, staff, { variantId: vid, type: 'entrada', qty: 5, reason: '' }), /motivo/);
  D.adjustStock(db, staff, { variantId: vid, type: 'entrada', qty: 5, reason: 'Compra' });
  assert.equal(stock(vid).physical, 25);
  order(10);
  assert.throws(() => D.adjustStock(db, staff, { variantId: vid, type: 'conteo', countedQty: 8, reason: 'Conteo' }), /por debajo de lo reservado/);
  assert.throws(() => D.adjustStock(db, staff, { variantId: vid, type: 'danio', qty: 16, reason: 'Golpe' }), /por debajo de lo reservado/);
  D.adjustStock(db, staff, { variantId: vid, type: 'danio', qty: 15, reason: 'Golpe' });
  assert.deepEqual(stock(vid), { physical: 10, reserved: 10, available: 0 });
  const last = db.prepare('SELECT * FROM stock_movements WHERE variant_id = ? ORDER BY id DESC LIMIT 1').get(vid);
  assert.equal(last.physical_before, 25);
  assert.equal(last.physical_after, 10);
});

test('el historial de movimientos es inmutable', () => {
  assert.throws(() => db.exec("UPDATE stock_movements SET reason = 'x'"), /inmutable/);
  assert.throws(() => db.exec('DELETE FROM stock_movements'), /inmutable/);
});

test('recepción de proveedor con varias líneas crea movimientos vinculados', () => {
  const sup = db.prepare('SELECT id FROM suppliers LIMIT 1').get().id;
  const { receiptId } = D.receiveFromSupplier(db, staff, { supplierId: sup, reference: 'FAC-1', lines: [{ variantId: vid, qty: 4 }] });
  assert.equal(stock(vid).physical, 24);
  const m = db.prepare('SELECT * FROM stock_movements WHERE receipt_id = ?').get(receiptId);
  assert.equal(m.type, 'recepcion');
  assert.equal(m.supplier_id, sup);
});

test('seed: al menos 30 SKUs distintos y conteos por categoría coherentes', () => {
  const c = D.publicCatalog(db);
  const skus = c.products.flatMap((p) => p.variants.map((v) => v.sku));
  assert.ok(new Set(skus).size >= 30);
  for (const cat of c.categories) assert.equal(cat.productCount, c.products.filter((p) => p.categoryId === cat.id).length);
  assert.ok(!('costCents' in c.products[0].variants[0]), 'el catálogo público no expone costos');
});
