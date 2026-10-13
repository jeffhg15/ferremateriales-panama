// Reglas de negocio: catálogo, pedidos, reservas y movimientos de inventario.
// Toda operación que cambia existencias pasa por applyMovement() dentro de tx().
import { tx } from './db.js';

export class DomainError extends Error {
  constructor(message, { status = 400, code = 'invalid', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const ORDER_STATUSES = {
  recibido: 'Recibido',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  listo_para_retirar: 'Listo para retirar',
  en_reparto: 'En reparto',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const PAYMENT_STATUSES = {
  pendiente: 'Pendiente de confirmación',
  confirmado: 'Pago confirmado por el personal',
  anulado: 'Anulado',
};

// Transiciones permitidas por tipo de entrega. "completado" es el evento de despacho de existencias.
export const FLOWS = {
  pickup: {
    recibido: ['confirmado', 'cancelado'],
    confirmado: ['en_preparacion', 'cancelado'],
    en_preparacion: ['listo_para_retirar', 'cancelado'],
    listo_para_retirar: ['completado', 'cancelado'],
    completado: [],
    cancelado: [],
  },
  delivery: {
    recibido: ['confirmado', 'cancelado'],
    confirmado: ['en_preparacion', 'cancelado'],
    en_preparacion: ['en_reparto', 'cancelado'],
    en_reparto: ['completado', 'cancelado'],
    completado: [],
    cancelado: [],
  },
};

export const MOVEMENT_TYPES = {
  entrada: 'Entrada de mercancía',
  recepcion: 'Recepción de proveedor',
  danio: 'Daño / merma',
  conteo: 'Corrección por conteo físico',
  devolucion: 'Devolución revendible',
  devolucion_danada: 'Devolución dañada (sin reingreso)',
  reserva: 'Reserva por pedido',
  liberacion: 'Liberación por cancelación',
  despacho: 'Despacho por pedido completado',
  inicial: 'Existencia inicial',
};

const now = () => new Date().toISOString();
const isInt = (n) => Number.isInteger(n);

// ---------- Configuración ----------

export const DEFAULT_SETTINGS = {
  businessName: 'Ferremateriales Panamá',
  logoUrl: '',
  instagram: 'ferremateriales.s.a',
  whatsappNumbers: ['6982-8698', '6982-3389'],
  whatsappCountryCode: '507',
  deliveryMessage: 'Acarreo gratis en área de La Chorrera',
  deliveryDisclaimer: 'Sujeto a cobertura y confirmación.',
  paymentInstructions:
    'El pago se coordina con nuestro personal después de confirmar tu pedido. No se procesa ningún pago en línea.',
  taxNote: 'Configuración de impuestos de demostración: verifique las tasas con su contador antes de operar.',
};

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = JSON.parse(r.value);
  return out;
}

export function updateSettings(db, patch) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const errors = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.includes(k)) continue;
    if (k === 'whatsappNumbers') {
      if (!Array.isArray(v) || v.some((n) => !/^[\d\s-]{7,15}$/.test(String(n)))) errors.push('Números de WhatsApp inválidos.');
    } else if (typeof v !== 'string') errors.push(`Valor inválido para ${k}.`);
  }
  if (patch.businessName !== undefined && !String(patch.businessName).trim()) errors.push('El nombre del negocio es obligatorio.');
  if (errors.length) throw new DomainError(errors[0], { details: errors });
  const up = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  tx(db, () => {
    for (const [k, v] of Object.entries(patch)) if (allowed.includes(k)) up.run(k, JSON.stringify(v));
  });
  return getSettings(db);
}

// ---------- Catálogo ----------

function variantRow(v) {
  return {
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    label: v.label,
    specs: JSON.parse(v.specs || '{}'),
    unitCode: v.unit_code,
    unitName: v.unit_singular,
    unitPlural: v.unit_plural,
    step: v.step,
    priceCents: v.price_cents,
    taxRateId: v.tax_rate_id,
    taxRateBp: v.rate_bp,
    taxName: v.tax_name,
    available: v.physical - v.reserved,
    reorderThreshold: v.reorder_threshold,
    active: !!v.active,
  };
}

const VARIANT_SELECT = `
  SELECT v.*, u.name_singular AS unit_singular, u.name_plural AS unit_plural, t.rate_bp, t.name AS tax_name
  FROM variants v JOIN units u ON u.code = v.unit_code JOIN tax_rates t ON t.id = v.tax_rate_id`;

/** Catálogo público: sólo productos no archivados y variantes activas. No expone costos. */
export function publicCatalog(db) {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort').all();
  const products = db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY id').all();
  const variants = db.prepare(`${VARIANT_SELECT} WHERE v.active = 1 ORDER BY v.product_id, v.sort, v.id`).all();
  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push(variantRow(v));
  }
  const ranks = salesRanking(db);
  const weekRanks = salesRanking(db, { sinceDays: 7 });
  const list = products
    .filter((p) => byProduct.has(p.id))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      categoryId: p.category_id,
      subcategory: p.subcategory,
      description: p.description,
      image: p.image,
      variantLabel: p.variant_label,
      featuredRank: p.featured_rank,
      merchRank: p.merch_rank,
      onOffer: !!p.on_offer,
      soldQty: ranks.get(p.id) || 0,
      soldQtyWeek: weekRanks.get(p.id) || 0,
      variants: byProduct.get(p.id),
    }));
  const counts = new Map();
  for (const p of list) counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
  return {
    categories: categories.map((c) => ({
      id: c.id, slug: c.slug, name: c.name, nameEn: c.name_en, image: c.image, tint: c.tint, productCount: counts.get(c.id) || 0,
    })),
    products: list,
  };
}

/** Cantidad vendida por producto en pedidos no cancelados (base: pedidos registrados en este sistema). */
export function salesRanking(db, { sinceDays } = {}) {
  const params = [];
  let where = "o.status <> 'cancelado'";
  if (sinceDays) {
    where += ' AND o.created_at >= ?';
    params.push(new Date(Date.now() - sinceDays * 86400000).toISOString());
  }
  const rows = db.prepare(`
    SELECT v.product_id, SUM(i.qty) AS qty FROM order_items i
    JOIN orders o ON o.id = i.order_id JOIN variants v ON v.id = i.variant_id
    WHERE ${where} GROUP BY v.product_id`).all(...params);
  return new Map(rows.map((r) => [r.product_id, r.qty]));
}

// ---------- Movimientos ----------

function getVariantForUpdate(db, variantId) {
  const v = db.prepare(`SELECT v.*, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`).get(variantId);
  if (!v) throw new DomainError('El producto no existe.', { status: 404, code: 'not_found' });
  return v;
}

/**
 * Único punto que modifica existencias. Valida invariantes y registra el movimiento inmutable.
 * Debe llamarse dentro de tx().
 */
function applyMovement(db, { variantId, type, physicalDelta = 0, reservedDelta = 0, reason, reference = '', supplierId = null, receiptId = null, orderId = null, actor }) {
  if (!db.__inTx) throw new Error('applyMovement requiere una transacción');
  const v = getVariantForUpdate(db, variantId);
  const physAfter = v.physical + physicalDelta;
  const resAfter = v.reserved + reservedDelta;
  if (physAfter < 0) throw new DomainError(`${v.sku}: las existencias físicas no pueden quedar negativas.`, { code: 'negative_stock' });
  if (resAfter < 0) throw new DomainError(`${v.sku}: la reserva no puede quedar negativa.`, { code: 'negative_reserved' });
  if (resAfter > physAfter) {
    throw new DomainError(
      `${v.sku}: las existencias físicas (${physAfter}) quedarían por debajo de lo reservado para pedidos activos (${resAfter}). Cancele o complete esos pedidos antes de ajustar.`,
      { code: 'below_reserved' },
    );
  }
  // Actualización condicionada a los valores leídos (control optimista adicional al bloqueo de escritura).
  const r = db.prepare('UPDATE variants SET physical = ?, reserved = ? WHERE id = ? AND physical = ? AND reserved = ?')
    .run(physAfter, resAfter, v.id, v.physical, v.reserved);
  if (r.changes !== 1) throw new DomainError('Las existencias cambiaron durante la operación. Intente de nuevo.', { status: 409, code: 'conflict' });
  db.prepare(`INSERT INTO stock_movements
    (variant_id, sku, product_name, type, physical_delta, reserved_delta, physical_before, physical_after, reserved_before, reserved_after,
     reason, reference, supplier_id, receipt_id, order_id, actor_id, actor_name, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    v.id, v.sku, `${v.product_name}${v.label ? ' — ' + v.label : ''}`, type, physicalDelta, reservedDelta,
    v.physical, physAfter, v.reserved, resAfter, reason, reference, supplierId, receiptId, orderId, actor?.id ?? null, actor?.name ?? 'Sistema', now(),
  );
  return { before: { physical: v.physical, reserved: v.reserved }, after: { physical: physAfter, reserved: resAfter } };
}

function requirePositiveInt(n, label) {
  if (!isInt(n) || n <= 0) throw new DomainError(`${label}: ingrese una cantidad entera mayor que cero.`);
}

/** Ajustes manuales de inventario: entrada, daño, conteo físico. */
export function adjustStock(db, actor, { variantId, type, qty, countedQty, reason, reference = '' }) {
  reason = String(reason || '').trim();
  if (!reason) throw new DomainError('Indique el motivo del movimiento.');
  return tx(db, () => {
    const v = getVariantForUpdate(db, variantId);
    if (type === 'entrada') {
      requirePositiveInt(qty, 'Cantidad');
      return applyMovement(db, { variantId, type, physicalDelta: qty, reason, reference, actor });
    }
    if (type === 'danio') {
      requirePositiveInt(qty, 'Cantidad');
      return applyMovement(db, { variantId, type, physicalDelta: -qty, reason, reference, actor });
    }
    if (type === 'conteo') {
      if (!isInt(countedQty) || countedQty < 0) throw new DomainError('Conteo físico: ingrese un número entero igual o mayor que cero.');
      const delta = countedQty - v.physical;
      if (delta === 0) throw new DomainError('El conteo coincide con las existencias registradas; no hay nada que corregir.');
      return applyMovement(db, { variantId, type, physicalDelta: delta, reason, reference, actor });
    }
    throw new DomainError('Tipo de movimiento no válido.');
  });
}

/** Recepción de proveedor con varias líneas; todo o nada. */
export function receiveFromSupplier(db, actor, { supplierId, reference, notes = '', lines }) {
  reference = String(reference || '').trim();
  if (!reference) throw new DomainError('Indique la referencia (factura o guía) de la recepción.');
  if (!Array.isArray(lines) || !lines.length) throw new DomainError('Agregue al menos una línea a la recepción.');
  return tx(db, () => {
    const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!s) throw new DomainError('Seleccione un proveedor válido.');
    const r = db.prepare('INSERT INTO supplier_receipts (supplier_id, reference, notes, actor_id, actor_name, created_at) VALUES (?,?,?,?,?,?)')
      .run(s.id, reference, notes, actor.id, actor.name, now());
    const receiptId = Number(r.lastInsertRowid);
    const results = [];
    for (const l of lines) {
      requirePositiveInt(l.qty, 'Cantidad recibida');
      results.push(applyMovement(db, {
        variantId: l.variantId, type: 'recepcion', physicalDelta: l.qty,
        reason: `Recepción de ${s.name}`, reference, supplierId: s.id, receiptId, actor,
      }));
    }
    return { receiptId, results };
  });
}

// ---------- Pedidos ----------

const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

export function computeTotals(lines, deliveryCents) {
  const subtotal = lines.reduce((s, l) => s + l.line_subtotal_cents, 0);
  const tax = lines.reduce((s, l) => s + l.line_tax_cents, 0);
  return { subtotal, tax, delivery: deliveryCents, total: deliveryCents == null ? null : subtotal + tax + deliveryCents };
}

/**
 * Envío explícito de pedido: revalida todas las líneas y reserva todo junto, o rechaza el pedido completo.
 * La clave de idempotencia evita pedidos duplicados por doble envío.
 */
export function placeOrder(db, user, input) {
  const errors = [];
  const customerName = String(input.customerName || '').trim();
  const phone = String(input.phone || '').trim();
  const fulfillment = input.fulfillment;
  const address = String(input.address || '').trim();
  const notes = String(input.notes || '').trim().slice(0, 1000);
  const key = String(input.idempotencyKey || '').trim();
  if (!key || key.length > 100) errors.push('Falta el identificador de envío. Recargue la página e intente de nuevo.');
  if (customerName.length < 2) errors.push('Ingrese su nombre completo.');
  if (cleanPhone(phone).replace('+', '').length < 7) errors.push('Ingrese un teléfono válido.');
  if (!['pickup', 'delivery'].includes(fulfillment)) errors.push('Seleccione retiro en tienda o entrega.');
  if (fulfillment === 'delivery' && address.length < 8) errors.push('Ingrese la dirección de entrega con suficiente detalle.');
  if (!Array.isArray(input.items) || !input.items.length) errors.push('Su carrito está vacío.');
  if (errors.length) throw new DomainError(errors[0], { details: errors });

  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ?').get(user.id, key);
    if (existing) return { order: getOrder(db, existing.id), duplicate: true };

    // Agrupar líneas repetidas del mismo SKU.
    const merged = new Map();
    for (const it of input.items) {
      const id = Number(it.variantId);
      merged.set(id, (merged.get(id) || 0) + Number(it.qty));
    }
    const lineErrors = [];
    const lines = [];
    for (const [variantId, qty] of merged) {
      const v = db.prepare(`${VARIANT_SELECT.replace('FROM variants v', ', p.name AS product_name, p.archived FROM variants v JOIN products p ON p.id = v.product_id')} WHERE v.id = ?`).get(variantId);
      if (!v || !v.active || v.archived) { lineErrors.push(`Un producto del carrito ya no está disponible (${v?.sku || variantId}).`); continue; }
      const label = `${v.product_name}${v.label ? ' — ' + v.label : ''}`;
      if (!isInt(qty) || qty <= 0) { lineErrors.push(`${label}: cantidad inválida.`); continue; }
      if (qty % v.step !== 0) { lineErrors.push(`${label}: se vende en múltiplos de ${v.step}.`); continue; }
      const available = v.physical - v.reserved;
      if (qty > available) {
        lineErrors.push(available > 0 ? `${label}: solo hay ${available} disponible(s).` : `${label}: agotado.`);
        continue;
      }
      const sub = v.price_cents * qty;
      lines.push({
        variant: v, qty, name: v.product_name,
        line_subtotal_cents: sub, line_tax_cents: Math.round((sub * v.rate_bp) / 10000),
      });
    }
    if (lineErrors.length) {
      throw new DomainError('No se pudo enviar el pedido. Revise las existencias de su carrito.', { status: 409, code: 'stock', details: lineErrors });
    }
    const delivery = fulfillment === 'pickup' ? 0 : null; // Entrega: costo por confirmar por el personal.
    const totals = computeTotals(lines, delivery);
    const ts = now();
    const res = db.prepare(`INSERT INTO orders (number, user_id, idempotency_key, customer_name, phone, fulfillment, address, notes,
      subtotal_cents, tax_cents, delivery_cents, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(`TMP-${key}`, user.id, key, customerName, phone, fulfillment, fulfillment === 'delivery' ? address : '', notes,
        totals.subtotal, totals.tax, delivery, ts, ts);
    const orderId = Number(res.lastInsertRowid);
    const number = `FM-${ts.slice(2, 4)}${ts.slice(5, 7)}-${String(orderId).padStart(5, '0')}`;
    db.prepare('UPDATE orders SET number = ? WHERE id = ?').run(number, orderId);
    const ins = db.prepare(`INSERT INTO order_items (order_id, variant_id, sku, name, variant_label, unit_code, unit_name, unit_price_cents,
      tax_rate_bp, tax_name, qty, line_subtotal_cents, line_tax_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const actor = { id: user.id, name: user.name };
    for (const l of lines) {
      const v = l.variant;
      ins.run(orderId, v.id, v.sku, l.name, v.label, v.unit_code, l.qty === 1 ? v.unit_singular : v.unit_plural, v.price_cents,
        v.rate_bp, v.tax_name, l.qty, l.line_subtotal_cents, l.line_tax_cents);
      applyMovement(db, { variantId: v.id, type: 'reserva', reservedDelta: l.qty, reason: `Reserva del pedido ${number}`, reference: number, orderId, actor });
    }
    logEvent(db, orderId, 'status', null, 'recibido', 'Pedido enviado por el cliente', actor);
    return { order: getOrder(db, orderId), duplicate: false };
  });
}

function logEvent(db, orderId, kind, from, to, note, actor) {
  db.prepare('INSERT INTO order_events (order_id, kind, from_value, to_value, note, actor_id, actor_name, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(orderId, kind, from, to, note || '', actor?.id ?? null, actor?.name ?? 'Sistema', now());
}

export function getOrder(db, id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  const events = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(id);
  const totals = computeTotals(items, o.delivery_cents);
  return {
    id: o.id, number: o.number, userId: o.user_id, customerName: o.customer_name, phone: o.phone,
    fulfillment: o.fulfillment, address: o.address, notes: o.notes, status: o.status, statusLabel: ORDER_STATUSES[o.status],
    paymentStatus: o.payment_status, paymentLabel: PAYMENT_STATUSES[o.payment_status], stockState: o.stock_state,
    createdAt: o.created_at, updatedAt: o.updated_at,
    subtotalCents: totals.subtotal, taxCents: totals.tax, deliveryCents: o.delivery_cents, totalCents: totals.total,
    nextStatuses: FLOWS[o.fulfillment][o.status] || [],
    items: items.map((i) => ({
      id: i.id, variantId: i.variant_id, sku: i.sku, name: i.name, variantLabel: i.variant_label, unitCode: i.unit_code, unitName: i.unit_name,
      unitPriceCents: i.unit_price_cents, taxRateBp: i.tax_rate_bp, taxName: i.tax_name, qty: i.qty,
      lineSubtotalCents: i.line_subtotal_cents, lineTaxCents: i.line_tax_cents,
      returnedResellable: i.returned_resellable, returnedDamaged: i.returned_damaged,
    })),
    events: events.map((e) => ({ id: e.id, kind: e.kind, from: e.from_value, to: e.to_value, note: e.note, actorName: e.actor_name, createdAt: e.created_at })),
  };
}

export function getOrderByNumber(db, number) {
  const o = db.prepare('SELECT id FROM orders WHERE number = ?').get(number);
  return o ? getOrder(db, o.id) : null;
}

export function listOrders(db, { userId, q, status } = {}) {
  const where = [];
  const params = [];
  if (userId) { where.push('user_id = ?'); params.push(userId); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (q) {
    where.push('(number LIKE ? OR customer_name LIKE ? OR phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db.prepare(`SELECT id FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`).all(...params);
  return rows.map((r) => getOrder(db, r.id));
}

/** Cambio de estado validado. Cancelar libera la reserva una vez; completar despacha una vez. */
export function changeOrderStatus(db, actor, orderId, to, { note = '', deliveryCents } = {}) {
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new DomainError('Pedido no encontrado.', { status: 404, code: 'not_found' });
    if (o.status === to) throw new DomainError(`El pedido ya está en estado "${ORDER_STATUSES[to]}". No se realizaron cambios.`, { status: 409, code: 'same_status' });
    const allowed = FLOWS[o.fulfillment][o.status] || [];
    if (!allowed.includes(to)) {
      throw new DomainError(`No se puede pasar de "${ORDER_STATUSES[o.status]}" a "${ORDER_STATUSES[to] || to}" en un pedido de ${o.fulfillment === 'pickup' ? 'retiro' : 'entrega'}.`, { status: 409, code: 'transition' });
    }
    if (deliveryCents !== undefined && deliveryCents !== null) setDeliveryChargeInTx(db, actor, o, deliveryCents);
    if (to === 'confirmado' && o.fulfillment === 'delivery') {
      const fresh = db.prepare('SELECT delivery_cents FROM orders WHERE id = ?').get(o.id);
      if (fresh.delivery_cents == null) throw new DomainError('Defina el cargo de entrega (puede ser B/. 0.00) antes de confirmar un pedido con entrega.');
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    if (to === 'cancelado') {
      if (o.stock_state !== 'reserved') throw new DomainError('La reserva de este pedido ya fue procesada.', { status: 409 });
      for (const i of items) {
        applyMovement(db, { variantId: i.variant_id, type: 'liberacion', reservedDelta: -i.qty, reason: `Cancelación del pedido ${o.number}`, reference: o.number, orderId: o.id, actor });
      }
      db.prepare("UPDATE orders SET stock_state = 'released' WHERE id = ? AND stock_state = 'reserved'").run(o.id);
    }
    if (to === 'completado') {
      if (o.stock_state !== 'reserved') throw new DomainError('Las existencias de este pedido ya fueron despachadas.', { status: 409 });
      for (const i of items) {
        applyMovement(db, { variantId: i.variant_id, type: 'despacho', physicalDelta: -i.qty, reservedDelta: -i.qty, reason: `Pedido ${o.number} completado`, reference: o.number, orderId: o.id, actor });
      }
      db.prepare("UPDATE orders SET stock_state = 'fulfilled' WHERE id = ? AND stock_state = 'reserved'").run(o.id);
    }
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(to, now(), o.id);
    logEvent(db, o.id, 'status', o.status, to, note, actor);
    return getOrder(db, o.id);
  });
}

/** El cliente sólo puede cancelar su propio pedido mientras está en "Recibido". */
export function customerCancel(db, user, orderId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id);
  if (!o) throw new DomainError('Pedido no encontrado.', { status: 404, code: 'not_found' });
  if (o.status !== 'recibido') throw new DomainError('Este pedido ya fue confirmado por la tienda. Contáctenos para cancelarlo.', { status: 409 });
  return changeOrderStatus(db, { id: user.id, name: user.name }, orderId, 'cancelado', { note: 'Cancelado por el cliente' });
}

function setDeliveryChargeInTx(db, actor, o, cents) {
  if (o.fulfillment !== 'delivery') throw new DomainError('Solo los pedidos con entrega tienen cargo de entrega.');
  if (['completado', 'cancelado'].includes(o.status)) throw new DomainError('No se puede cambiar el cargo de un pedido cerrado.');
  if (!isInt(cents) || cents < 0) throw new DomainError('El cargo de entrega debe ser un monto igual o mayor que cero.');
  db.prepare('UPDATE orders SET delivery_cents = ?, updated_at = ? WHERE id = ?').run(cents, now(), o.id);
  logEvent(db, o.id, 'delivery', o.delivery_cents == null ? null : String(o.delivery_cents), String(cents), 'Cargo de entrega definido', actor);
}

export function setDeliveryCharge(db, actor, orderId, cents) {
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new DomainError('Pedido no encontrado.', { status: 404 });
    setDeliveryChargeInTx(db, actor, o, cents);
    return getOrder(db, o.id);
  });
}

/** Estado de pago separado del estado de entrega; sólo lo cambia el personal manualmente. */
export function setPaymentStatus(db, actor, orderId, status, note = '') {
  if (!PAYMENT_STATUSES[status]) throw new DomainError('Estado de pago no válido.');
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new DomainError('Pedido no encontrado.', { status: 404 });
    if (o.payment_status === status) throw new DomainError('El pago ya tiene ese estado.', { status: 409 });
    if (status === 'confirmado' && o.delivery_cents == null) throw new DomainError('Defina el cargo de entrega antes de confirmar el pago del total.');
    if (status === 'confirmado' && !String(note).trim()) throw new DomainError('Indique cómo se verificó el pago (p. ej., referencia de transferencia o efectivo en caja).');
    db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run(status, now(), o.id);
    logEvent(db, o.id, 'payment', o.payment_status, status, note, actor);
    return getOrder(db, o.id);
  });
}

/** Devolución de un pedido completado: sólo lo revendible vuelve a existencias; lo dañado se registra aparte. */
export function recordReturn(db, actor, orderId, { itemId, resellable = 0, damaged = 0, reason }) {
  reason = String(reason || '').trim();
  if (!reason) throw new DomainError('Indique el motivo de la devolución.');
  if (!isInt(resellable) || !isInt(damaged) || resellable < 0 || damaged < 0 || resellable + damaged === 0) {
    throw new DomainError('Indique cantidades enteras: al menos una unidad revendible o dañada.');
  }
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new DomainError('Pedido no encontrado.', { status: 404 });
    if (o.status !== 'completado' || o.stock_state !== 'fulfilled') throw new DomainError('Solo se registran devoluciones de pedidos completados. Para pedidos activos, use la cancelación.');
    const i = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemId, o.id);
    if (!i) throw new DomainError('Línea de pedido no encontrada.', { status: 404 });
    const remaining = i.qty - i.returned_resellable - i.returned_damaged;
    if (resellable + damaged > remaining) throw new DomainError(`Solo quedan ${remaining} unidad(es) elegibles para devolución en esta línea.`);
    if (resellable) {
      applyMovement(db, { variantId: i.variant_id, type: 'devolucion', physicalDelta: resellable, reason, reference: o.number, orderId: o.id, actor });
    }
    if (damaged) {
      applyMovement(db, { variantId: i.variant_id, type: 'devolucion_danada', reason: `${reason} (${damaged} dañada(s), sin reingreso)`, reference: o.number, orderId: o.id, actor });
    }
    db.prepare('UPDATE order_items SET returned_resellable = returned_resellable + ?, returned_damaged = returned_damaged + ? WHERE id = ?').run(resellable, damaged, i.id);
    logEvent(db, o.id, 'return', null, `${i.sku}: ${resellable} revendible(s), ${damaged} dañada(s)`, reason, actor);
    return getOrder(db, o.id);
  });
}

// ---------- Administración de productos ----------

export function adminProducts(db) {
  const products = db.prepare(`SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id`).all();
  const variants = db.prepare(`${VARIANT_SELECT} ORDER BY v.product_id, v.sort, v.id`).all();
  const referenced = new Set(db.prepare('SELECT DISTINCT variant_id FROM order_items').all().map((r) => r.variant_id));
  return products.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, categoryId: p.category_id, categoryName: p.category_name,
    subcategory: p.subcategory, description: p.description, image: p.image, variantLabel: p.variant_label,
    featuredRank: p.featured_rank, merchRank: p.merch_rank, onOffer: !!p.on_offer, archived: !!p.archived,
    variants: variants.filter((v) => v.product_id === p.id).map((v) => ({
      ...variantRow(v), costCents: v.cost_cents, physical: v.physical, reserved: v.reserved, referencedByOrders: referenced.has(v.id),
    })),
  }));
}

const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function validateProduct(db, p) {
  const errors = [];
  if (!String(p.name || '').trim()) errors.push('El nombre es obligatorio.');
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(p.categoryId)) errors.push('Seleccione una categoría.');
  if (!String(p.image || '').trim()) errors.push('Seleccione una imagen.');
  if (errors.length) throw new DomainError(errors[0], { details: errors });
}

function validateVariant(db, v, { requireStock }) {
  const errors = [];
  if (!/^[A-Z0-9][A-Z0-9-]{2,30}$/.test(String(v.sku || ''))) errors.push('SKU inválido: use mayúsculas, números y guiones (3–31 caracteres).');
  if (!db.prepare('SELECT 1 FROM units WHERE code = ?').get(v.unitCode)) errors.push('Seleccione una unidad de venta.');
  if (!db.prepare('SELECT 1 FROM tax_rates WHERE id = ?').get(v.taxRateId)) errors.push('Seleccione un impuesto.');
  for (const [k, label] of [['priceCents', 'Precio'], ['costCents', 'Costo'], ['reorderThreshold', 'Punto de reorden']]) {
    if (!isInt(v[k]) || v[k] < 0) errors.push(`${label}: ingrese un valor válido.`);
  }
  if (!isInt(v.step) || v.step < 1) errors.push('Incremento de venta: entero mayor o igual a 1.');
  if (requireStock && (!isInt(v.initialStock ?? 0) || (v.initialStock ?? 0) < 0)) errors.push('Existencia inicial inválida.');
  if (errors.length) throw new DomainError(errors[0], { details: errors });
}

export function createProduct(db, actor, p) {
  validateProduct(db, p);
  const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [];
  if (!variants.length) throw new DomainError('Agregue al menos una variante (SKU).');
  for (const v of variants) validateVariant(db, v, { requireStock: true });
  return tx(db, () => {
    let slug = slugify(p.name);
    let n = 1;
    while (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) slug = `${slugify(p.name)}-${++n}`;
    const r = db.prepare(`INSERT INTO products (slug, name, brand, category_id, subcategory, description, image, variant_label, featured_rank, merch_rank, on_offer)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(slug, p.name.trim(), p.brand || '', p.categoryId, p.subcategory || '', p.description || '', p.image,
      p.variantLabel || '', p.featuredRank ?? null, p.merchRank ?? null, p.onOffer ? 1 : 0);
    const productId = Number(r.lastInsertRowid);
    variants.forEach((v, idx) => insertVariant(db, actor, productId, v, idx));
    return productId;
  });
}

function insertVariant(db, actor, productId, v, sort) {
  if (db.prepare('SELECT 1 FROM variants WHERE sku = ?').get(v.sku)) throw new DomainError(`El SKU ${v.sku} ya existe.`);
  const r = db.prepare(`INSERT INTO variants (product_id, sku, label, specs, unit_code, step, cost_cents, price_cents, tax_rate_id, reorder_threshold, active, sort)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(productId, v.sku, v.label || '', JSON.stringify(v.specs || {}), v.unitCode, v.step, v.costCents, v.priceCents,
    v.taxRateId, v.reorderThreshold, v.active === false ? 0 : 1, sort);
  const id = Number(r.lastInsertRowid);
  if (v.initialStock > 0) applyMovement(db, { variantId: id, type: 'inicial', physicalDelta: v.initialStock, reason: 'Existencia inicial al crear el SKU', actor });
  return id;
}

/** Edita datos del producto y variantes. Las existencias NO se editan aquí: sólo mediante movimientos. */
export function updateProduct(db, actor, id, p) {
  validateProduct(db, p);
  return tx(db, () => {
    const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!cur) throw new DomainError('Producto no encontrado.', { status: 404 });
    db.prepare(`UPDATE products SET name=?, brand=?, category_id=?, subcategory=?, description=?, image=?, variant_label=?, featured_rank=?, merch_rank=?, on_offer=? WHERE id=?`)
      .run(p.name.trim(), p.brand || '', p.categoryId, p.subcategory || '', p.description || '', p.image, p.variantLabel || '',
        p.featuredRank ?? null, p.merchRank ?? null, p.onOffer ? 1 : 0, id);
    for (const [idx, v] of (p.variants || []).entries()) {
      if (v.id) {
        validateVariant(db, v, { requireStock: false });
        const ex = db.prepare('SELECT * FROM variants WHERE id = ? AND product_id = ?').get(v.id, id);
        if (!ex) throw new DomainError('Variante no encontrada.');
        if (ex.sku !== v.sku && db.prepare('SELECT 1 FROM order_items WHERE variant_id = ?').get(v.id)) {
          throw new DomainError(`El SKU ${ex.sku} aparece en pedidos y no puede renombrarse. Cree una variante nueva.`);
        }
        if (ex.sku !== v.sku && db.prepare('SELECT 1 FROM variants WHERE sku = ? AND id <> ?').get(v.sku, v.id)) throw new DomainError(`El SKU ${v.sku} ya existe.`);
        db.prepare(`UPDATE variants SET sku=?, label=?, specs=?, unit_code=?, step=?, cost_cents=?, price_cents=?, tax_rate_id=?, reorder_threshold=?, active=?, sort=? WHERE id=?`)
          .run(v.sku, v.label || '', JSON.stringify(v.specs || {}), v.unitCode, v.step, v.costCents, v.priceCents, v.taxRateId, v.reorderThreshold, v.active === false ? 0 : 1, idx, v.id);
      } else {
        validateVariant(db, v, { requireStock: true });
        insertVariant(db, actor, id, v, idx);
      }
    }
    return id;
  });
}

/** Archivar oculta el producto de la tienda sin borrar historial ni pedidos que lo referencian. */
export function setArchived(db, id, archived) {
  const r = db.prepare('UPDATE products SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
  if (!r.changes) throw new DomainError('Producto no encontrado.', { status: 404 });
}

// ---------- Proveedores ----------

export function listSuppliers(db) {
  const s = db.prepare('SELECT * FROM suppliers ORDER BY name').all();
  const receipts = db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM stock_movements m WHERE m.receipt_id = r.id) AS line_count,
      (SELECT COALESCE(SUM(physical_delta),0) FROM stock_movements m WHERE m.receipt_id = r.id) AS unit_count
    FROM supplier_receipts r ORDER BY r.id DESC`).all();
  return s.map((x) => ({
    id: x.id, name: x.name, contact: x.contact, phone: x.phone, email: x.email, notes: x.notes, isDemo: !!x.is_demo, active: !!x.active,
    receipts: receipts.filter((r) => r.supplier_id === x.id).map((r) => ({
      id: r.id, reference: r.reference, notes: r.notes, actorName: r.actor_name, createdAt: r.created_at, lineCount: r.line_count, unitCount: r.unit_count,
    })),
  }));
}

export function saveSupplier(db, s) {
  const name = String(s.name || '').trim();
  if (!name) throw new DomainError('El nombre del proveedor es obligatorio.');
  if (s.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) throw new DomainError('Correo del proveedor inválido.');
  if (s.id) {
    const r = db.prepare('UPDATE suppliers SET name=?, contact=?, phone=?, email=?, notes=?, active=? WHERE id=?')
      .run(name, s.contact || '', s.phone || '', s.email || '', s.notes || '', s.active === false ? 0 : 1, s.id);
    if (!r.changes) throw new DomainError('Proveedor no encontrado.', { status: 404 });
    return s.id;
  }
  return Number(db.prepare('INSERT INTO suppliers (name, contact, phone, email, notes) VALUES (?,?,?,?,?)')
    .run(name, s.contact || '', s.phone || '', s.email || '', s.notes || '').lastInsertRowid);
}

// ---------- Historial y resumen ----------

export function listMovements(db, { sku, type, from, to, orderNumber, limit = 1000 } = {}) {
  const where = [];
  const params = [];
  if (sku) { where.push('(m.sku LIKE ? OR m.product_name LIKE ?)'); params.push(`%${sku}%`, `%${sku}%`); }
  if (type) { where.push('m.type = ?'); params.push(type); }
  if (from) { where.push('m.created_at >= ?'); params.push(from); }
  if (to) { where.push('m.created_at <= ?'); params.push(to); }
  if (orderNumber) { where.push('m.reference LIKE ?'); params.push(`%${orderNumber}%`); }
  return db.prepare(`SELECT m.*, s.name AS supplier_name FROM stock_movements m LEFT JOIN suppliers s ON s.id = m.supplier_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC LIMIT ?`).all(...params, limit)
    .map((m) => ({
      id: m.id, variantId: m.variant_id, sku: m.sku, productName: m.product_name, type: m.type, typeLabel: MOVEMENT_TYPES[m.type] || m.type,
      physicalDelta: m.physical_delta, reservedDelta: m.reserved_delta, physicalBefore: m.physical_before, physicalAfter: m.physical_after,
      reservedBefore: m.reserved_before, reservedAfter: m.reserved_after, reason: m.reason, reference: m.reference,
      supplierName: m.supplier_name, receiptId: m.receipt_id, orderId: m.order_id, actorName: m.actor_name, createdAt: m.created_at,
    }));
}

export function summary(db) {
  const v = db.prepare(`SELECT v.physical, v.reserved, v.reorder_threshold FROM variants v JOIN products p ON p.id = v.product_id WHERE v.active = 1 AND p.archived = 0`).all();
  const activeSkus = v.length;
  const unavailable = v.filter((x) => x.physical - x.reserved <= 0).length;
  const low = v.filter((x) => x.physical - x.reserved > 0 && x.physical - x.reserved <= x.reorder_threshold).length;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('completado','cancelado')").get().n;
  const awaitingDelivery = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE fulfillment = 'delivery' AND delivery_cents IS NULL AND status NOT IN ('completado','cancelado')").get().n;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const sales = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(subtotal_cents + tax_cents + COALESCE(delivery_cents,0)),0) AS cents
    FROM orders WHERE status = 'completado' AND updated_at >= ?`).get(since);
  const lowItems = db.prepare(`SELECT v.id, v.sku, p.name, v.label, v.physical, v.reserved, v.reorder_threshold FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.active = 1 AND p.archived = 0 AND v.physical - v.reserved <= v.reorder_threshold ORDER BY (v.physical - v.reserved) LIMIT 12`).all();
  return {
    activeSkus, lowStock: low, unavailable, pendingOrders: pending, awaitingDelivery,
    completedSales30d: { orders: sales.n, cents: sales.cents, basis: 'Pedidos en estado Completado en los últimos 30 días (total con impuestos y entrega).' },
    lowItems: lowItems.map((x) => ({ id: x.id, sku: x.sku, name: x.name, label: x.label, available: x.physical - x.reserved, reorderThreshold: x.reorder_threshold })),
    recentMovements: listMovements(db, { limit: 8 }),
  };
}

export function listMeta(db) {
  return {
    units: db.prepare('SELECT code, name_singular AS nameSingular, name_plural AS namePlural FROM units ORDER BY name_singular').all(),
    taxRates: db.prepare('SELECT id, name, rate_bp AS rateBp FROM tax_rates ORDER BY id').all(),
    categories: db.prepare('SELECT id, slug, name FROM categories ORDER BY sort').all(),
    orderStatuses: ORDER_STATUSES, paymentStatuses: PAYMENT_STATUSES, movementTypes: MOVEMENT_TYPES, flows: FLOWS,
  };
}

export function saveUnit(db, u) {
  const code = String(u.code || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,20}$/.test(code) || !u.nameSingular?.trim() || !u.namePlural?.trim()) throw new DomainError('Complete código, nombre singular y plural de la unidad.');
  db.prepare('INSERT INTO units (code, name_singular, name_plural) VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET name_singular=excluded.name_singular, name_plural=excluded.name_plural')
    .run(code, u.nameSingular.trim(), u.namePlural.trim());
}

export function saveTaxRate(db, t) {
  if (!String(t.name || '').trim() || !isInt(t.rateBp) || t.rateBp < 0 || t.rateBp > 10000) throw new DomainError('Ingrese nombre y una tasa entre 0 % y 100 %.');
  if (t.id) db.prepare('UPDATE tax_rates SET name=?, rate_bp=? WHERE id=?').run(t.name.trim(), t.rateBp, t.id);
  else db.prepare('INSERT INTO tax_rates (name, rate_bp) VALUES (?,?)').run(t.name.trim(), t.rateBp);
}
