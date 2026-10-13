const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (cents) => (cents == null ? 'Por confirmar' : `B/. ${money.format(cents / 100)}`);
export const fmtMoneyRaw = (cents) => money.format(cents / 100);

const dt = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
export const fmtDate = (iso) => (iso ? dt.format(new Date(iso)) : '');

export const unitLabel = (v, qty = 1) => (qty === 1 ? v.unitName : v.unitPlural);

/** Normaliza texto para búsqueda: sin acentos, minúsculas, espacios simples. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const pct = (bp) => `${(bp / 100).toLocaleString('es-PA', { maximumFractionDigits: 2 })} %`;

export function stockStatus(v) {
  if (!v || v.available <= 0) return { key: 'out', label: 'Agotado' };
  if (v.available <= v.reorderThreshold) return { key: 'low', label: `Quedan ${v.available}` };
  return { key: 'in', label: 'Disponible' };
}

export function newKey() {
  return (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
