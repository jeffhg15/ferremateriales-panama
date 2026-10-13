import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/ui.jsx';

export function useLoad(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload: load, setData };
}

/** Diálogo accesible: Escape cierra, foco atrapado y devuelto al elemento anterior. */
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => ref.current?.querySelector('input, select, textarea, button')?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = ref.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon.close /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const centsFromInput = (s) => {
  if (s === '' || s == null) return NaN;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const centsToInput = (c) => (c == null ? '' : (c / 100).toFixed(2));

export function Stat({ label, value, tone = '', hint, icon }) {
  const Ico = icon ? Icon[icon] : null;
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-label">{Ico && <Ico size={16} />} {label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function VariantPicker({ products, value, onChange, id = 'variant-picker', label = 'Producto / SKU' }) {
  const [q, setQ] = useState('');
  const opts = [];
  for (const p of products || []) for (const v of p.variants) opts.push({ id: v.id, text: `${v.sku} — ${p.name}${v.label ? ' ' + v.label : ''}`, v, p });
  const filtered = q ? opts.filter((o) => o.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) : opts;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input className="input" type="search" placeholder="Filtrar por SKU o nombre…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar productos" />
      <select id={id} className="input" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || null)} size={1}>
        <option value="">Seleccione…</option>
        {filtered.slice(0, 300).map((o) => <option key={o.id} value={o.id}>{o.text}{o.p.archived ? ' (archivado)' : ''}</option>)}
      </select>
    </div>
  );
}
