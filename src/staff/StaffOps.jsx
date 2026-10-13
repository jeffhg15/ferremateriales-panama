import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { fmtDate, fmtMoney, norm } from '../lib/format.js';
import { ErrorBox, Icon, Img, Spinner } from '../components/ui.jsx';
import { OrderItemsTable, OrderTotals, PaymentPill, StatusPill } from '../pages/Orders.jsx';
import { Modal, VariantPicker, centsFromInput, centsToInput, useLoad } from './common.jsx';

// ---------------- Productos ----------------

const IMAGE_LIBRARY = [
  'cemento-gris', 'arena-lavada', 'piedra-triturada', 'pegamento-ceramica', 'repello', 'bloque-4', 'bloque-6', 'varilla', 'alambre-amarre', 'malla', 'zinc', 'teja-pvc',
  'clavos-techo', 'taladro', 'martillo', 'nivel', 'cinta-metrica', 'carretilla', 'pala', 'caja-herramientas', 'desbrozadora', 'tubo-pvc', 'tubo-pvc-sanitario', 'codo-pvc',
  'tee-pvc', 'soldadura-pvc', 'llave-fregadero', 'llave-lavamanos', 'inodoro-blanco', 'inodoro-negro', 'teflon', 'cable-thhn', 'tomacorriente', 'interruptor', 'bombillo-led',
  'breaker', 'pintura-latex', 'pintura-esmalte', 'impermeabilizante', 'pintura-cubeta', 'rodillo', 'brocha', 'puerta-madera', 'puerta-seguridad', 'puerta-bano-aluminio',
  'ventana-corrediza', 'ventana-celosia',
].map((n) => `/img/products/${n}.svg`);

export function Products() {
  const { notify, loadCatalog } = useStore();
  const { data, error, reload } = useLoad('/staff/products');
  const meta = useLoad('/staff/meta');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [show, setShow] = useState('active');
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const p of data.products) {
      if (cat && p.categoryId !== Number(cat)) continue;
      if (show === 'active' && p.archived) continue;
      if (show === 'archived' && !p.archived) continue;
      for (const v of p.variants) {
        if (show === 'low' && !(v.available <= v.reorderThreshold)) continue;
        if (q && !norm(`${p.name} ${p.brand} ${v.sku} ${v.label}`).includes(norm(q))) continue;
        out.push({ p, v });
      }
    }
    return out;
  }, [data, q, cat, show]);

  const archive = async (p) => {
    if (!p.archived && !window.confirm(`¿Archivar "${p.name}"? Dejará de mostrarse en la tienda. Los pedidos e historial se conservan.`)) return;
    try { await api(`/staff/products/${p.id}/archive`, { method: 'POST', body: { archived: !p.archived } }); notify(p.archived ? 'Producto reactivado.' : 'Producto archivado.'); reload(); loadCatalog(); }
    catch (e) { notify(e.message, 'error'); }
  };

  return (
    <div>
      <div className="row-between"><h1>Productos</h1><button className="btn btn-primary" onClick={() => setEditing('new')}><Icon.plus size={16} /> Nuevo producto</button></div>
      <div className="filters-row">
        <div className="field"><label htmlFor="p-q">Buscar</label><input id="p-q" className="input" type="search" placeholder="Nombre, marca o SKU" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="p-cat">Categoría</label><select id="p-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option>{meta.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="p-show">Mostrar</label><select id="p-show" className="input" value={show} onChange={(e) => setShow(e.target.value)}><option value="active">Activos</option><option value="low">Existencia baja / agotados</option><option value="archived">Archivados</option><option value="all">Todos</option></select></div>
      </div>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th>Imagen</th><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Variante / espec.</th><th>Unidad</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Físico</th><th className="num">Reservado</th><th className="num">Disponible</th><th className="num">Reorden</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={14} className="center muted">Sin resultados.</td></tr>}
              {rows.map(({ p, v }) => (
                <tr key={v.id} className={p.archived ? 'is-archived' : ''}>
                  <td><Img src={p.image} alt="" className="thumb" width={44} height={44} /></td>
                  <td className="mono">{v.sku}</td>
                  <td>{p.name}<br /><span className="small muted">{p.brand}</span></td>
                  <td className="small">{p.categoryName}</td>
                  <td className="small">{v.label || '—'}{Object.keys(v.specs).length > 0 && <><br /><span className="muted">{Object.entries(v.specs).map(([k, x]) => `${k}: ${x}`).join(' · ')}</span></>}</td>
                  <td className="small">{v.unitName}{v.step > 1 ? ` (×${v.step})` : ''}</td>
                  <td className="num">{fmtMoney(v.costCents)}</td>
                  <td className="num">{fmtMoney(v.priceCents)}</td>
                  <td className="num">{v.physical}</td>
                  <td className="num">{v.reserved}</td>
                  <td className="num"><span className={`badge ${v.available <= 0 ? 'badge-out' : v.available <= v.reorderThreshold ? 'badge-low' : 'badge-ok'}`}>{v.available}</span></td>
                  <td className="num">{v.reorderThreshold}</td>
                  <td className="small">{p.archived ? 'Archivado' : v.active ? 'Activo' : 'SKU inactivo'}</td>
                  <td className="nowrap"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Editar</button> <button className="btn btn-ghost btn-sm" onClick={() => archive(p)}>{p.archived ? 'Reactivar' : 'Archivar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && meta.data && <ProductEditor product={editing === 'new' ? null : editing} meta={meta.data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); loadCatalog(); notify('Producto guardado.'); }} />}
    </div>
  );
}

function ProductEditor({ product, meta, onClose, onSaved }) {
  const blankVariant = { sku: '', label: '', specsText: '', unitCode: 'unidad', step: '1', cost: '', price: '', taxRateId: meta.taxRates[0]?.id, reorderThreshold: '0', initialStock: '0', active: true };
  const [f, setF] = useState(() => product ? {
    ...product, featuredRank: product.featuredRank ?? '', merchRank: product.merchRank ?? '',
    variants: product.variants.map((v) => ({ ...v, specsText: Object.entries(v.specs).map(([k, x]) => `${k}: ${x}`).join('\n'), cost: centsToInput(v.costCents), price: centsToInput(v.priceCents), step: String(v.step), reorderThreshold: String(v.reorderThreshold) })),
  } : { name: '', brand: '', categoryId: meta.categories[0]?.id, subcategory: '', description: '', image: IMAGE_LIBRARY[0], variantLabel: '', featuredRank: '', merchRank: '', onOffer: false, variants: [{ ...blankVariant }] });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setV = (i, k) => (e) => setF((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : v)) }));

  const upload = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr({ error: 'La imagen no puede superar 2 MB.' }); return; }
    const r = new FileReader();
    r.onload = async () => { try { const d = await api('/staff/uploads', { method: 'POST', body: { dataUrl: r.result } }); setF((x) => ({ ...x, image: d.url })); } catch (e) { setErr({ error: e.message }); } };
    r.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    const variants = f.variants.map((v) => {
      const specs = Object.fromEntries(String(v.specsText || '').split('\n').map((l) => l.split(':')).filter((x) => x.length >= 2 && x[0].trim()).map(([k, ...rest]) => [k.trim(), rest.join(':').trim()]));
      return {
        id: v.id, sku: String(v.sku).trim().toUpperCase(), label: v.label, specs, unitCode: v.unitCode, step: Number(v.step),
        costCents: centsFromInput(v.cost), priceCents: centsFromInput(v.price), taxRateId: Number(v.taxRateId), reorderThreshold: Number(v.reorderThreshold),
        initialStock: v.id ? undefined : Number(v.initialStock || 0), active: v.active !== false,
      };
    });
    const bad = variants.find((v) => !Number.isFinite(v.priceCents) || !Number.isFinite(v.costCents));
    if (bad) { setErr({ error: `Revise costo y precio del SKU ${bad.sku || '(nuevo)'}.` }); return; }
    const body = { ...f, categoryId: Number(f.categoryId), featuredRank: f.featuredRank === '' ? null : Number(f.featuredRank), merchRank: f.merchRank === '' ? null : Number(f.merchRank), variants };
    setBusy(true);
    try { await api(product ? `/staff/products/${product.id}` : '/staff/products', { method: product ? 'PUT' : 'POST', body }); onSaved(); }
    catch (x) { setErr({ error: x.message, details: x.details }); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={product ? `Editar: ${product.name}` : 'Nuevo producto'} onClose={onClose} wide>
      <form onSubmit={save} className="form-grid">
        <div className="field span-2"><label htmlFor="e-name">Nombre</label><input id="e-name" className="input" value={f.name} onChange={set('name')} required /></div>
        <div className="field"><label htmlFor="e-brand">Marca / línea de especificación</label><input id="e-brand" className="input" value={f.brand} onChange={set('brand')} /></div>
        <div className="field"><label htmlFor="e-cat">Categoría</label><select id="e-cat" className="input" value={f.categoryId} onChange={set('categoryId')}>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="e-sub">Subcategoría</label><input id="e-sub" className="input" value={f.subcategory} onChange={set('subcategory')} placeholder="p. ej., Techos" /></div>
        <div className="field"><label htmlFor="e-vl">Nombre de la variante</label><input id="e-vl" className="input" value={f.variantLabel} onChange={set('variantLabel')} placeholder="Diámetro, Largo, Medida…" /></div>
        <div className="field span-2"><label htmlFor="e-desc">Descripción</label><textarea id="e-desc" className="input" rows={2} value={f.description} onChange={set('description')} /></div>
        <div className="field span-2">
          <span className="flabel">Imagen</span>
          <div className="image-picker">
            <Img src={f.image} alt="Imagen actual" className="thumb-lg" width={96} height={96} />
            <div className="image-picker-side">
              <label className="btn btn-ghost btn-sm file-btn"><Icon.download size={15} /> Subir foto (PNG/JPG/WebP, máx. 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label>
              <details><summary className="small">Elegir de la biblioteca</summary>
                <div className="image-lib">{IMAGE_LIBRARY.map((src) => <button type="button" key={src} className={f.image === src ? 'is-on' : ''} onClick={() => setF((x) => ({ ...x, image: src }))} aria-label={src.split('/').pop()}><img src={src} alt="" width="48" height="48" /></button>)}</div>
              </details>
            </div>
          </div>
        </div>
        <div className="field"><label htmlFor="e-fr">Orden en destacados (vacío = no)</label><input id="e-fr" className="input" type="number" min="1" value={f.featuredRank} onChange={set('featuredRank')} /></div>
        <div className="field"><label htmlFor="e-mr">Orden de merchandising</label><input id="e-mr" className="input" type="number" min="1" value={f.merchRank} onChange={set('merchRank')} /></div>
        <label className="check span-2"><input type="checkbox" checked={!!f.onOffer} onChange={set('onOffer')} /> Mostrar en “Ofertas” (sin inventar descuentos)</label>

        <h3 className="span-2">Variantes / SKU</h3>
        <p className="span-2 small muted">Las existencias no se editan aquí: use Inventario para entradas, daños y conteos. La existencia inicial solo aplica a SKU nuevos y queda registrada en el historial.</p>
        {f.variants.map((v, i) => (
          <fieldset key={v.id || `n${i}`} className="variant-edit span-2">
            <legend>{v.sku || 'Nuevo SKU'} {v.referencedByOrders && <span className="badge">en pedidos</span>}</legend>
            <div className="field"><label htmlFor={`v-sku-${i}`}>SKU</label><input id={`v-sku-${i}`} className="input mono" value={v.sku} onChange={setV(i, 'sku')} disabled={v.referencedByOrders} required /></div>
            <div className="field"><label htmlFor={`v-lab-${i}`}>Etiqueta</label><input id={`v-lab-${i}`} className="input" value={v.label} onChange={setV(i, 'label')} placeholder='1/2"' /></div>
            <div className="field"><label htmlFor={`v-unit-${i}`}>Unidad</label><select id={`v-unit-${i}`} className="input" value={v.unitCode} onChange={setV(i, 'unitCode')}>{meta.units.map((u) => <option key={u.code} value={u.code}>{u.nameSingular}</option>)}</select></div>
            <div className="field"><label htmlFor={`v-step-${i}`}>Incremento</label><input id={`v-step-${i}`} className="input" type="number" min="1" step="1" value={v.step} onChange={setV(i, 'step')} /></div>
            <div className="field"><label htmlFor={`v-cost-${i}`}>Costo (B/.)</label><input id={`v-cost-${i}`} className="input" type="number" min="0" step="0.01" value={v.cost} onChange={setV(i, 'cost')} /></div>
            <div className="field"><label htmlFor={`v-price-${i}`}>Precio (B/.)</label><input id={`v-price-${i}`} className="input" type="number" min="0" step="0.01" value={v.price} onChange={setV(i, 'price')} /></div>
            <div className="field"><label htmlFor={`v-tax-${i}`}>Impuesto</label><select id={`v-tax-${i}`} className="input" value={v.taxRateId} onChange={setV(i, 'taxRateId')}>{meta.taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`v-ro-${i}`}>Punto de reorden</label><input id={`v-ro-${i}`} className="input" type="number" min="0" value={v.reorderThreshold} onChange={setV(i, 'reorderThreshold')} /></div>
            {!v.id && <div className="field"><label htmlFor={`v-is-${i}`}>Existencia inicial</label><input id={`v-is-${i}`} className="input" type="number" min="0" value={v.initialStock} onChange={setV(i, 'initialStock')} /></div>}
            {v.id && <div className="field"><span className="flabel">Existencias</span><span className="small">Físico {v.physical} · Reservado {v.reserved} · Disponible {v.available}</span></div>}
            <div className="field span-2"><label htmlFor={`v-specs-${i}`}>Especificaciones (una por línea, “Nombre: valor”)</label><textarea id={`v-specs-${i}`} className="input" rows={2} value={v.specsText} onChange={setV(i, 'specsText')} /></div>
            <label className="check"><input type="checkbox" checked={v.active !== false} onChange={setV(i, 'active')} /> SKU activo (pedible)</label>
            {!v.id && f.variants.length > 1 && <button type="button" className="link-btn" onClick={() => setF((x) => ({ ...x, variants: x.variants.filter((_, j) => j !== i) }))}>Quitar</button>}
          </fieldset>
        ))}
        <div className="span-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...x, variants: [...x.variants, { ...blankVariant }] }))}><Icon.plus size={15} /> Agregar variante</button></div>
        <div className="span-2"><ErrorBox error={err?.error} details={err?.details} /></div>
        <div className="span-2 row-end"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </Modal>
  );
}

// ---------------- Inventario ----------------

const ADJ_TYPES = {
  entrada: { label: 'Entrada de mercancía', help: 'Suma unidades físicas (compra sin proveedor registrado, traslado, etc.).' },
  recepcion: { label: 'Recepción de proveedor', help: 'Suma unidades vinculadas a un proveedor y una referencia (factura o guía).' },
  danio: { label: 'Daño / merma', help: 'Resta unidades físicas dañadas o perdidas. No puede dejar el físico por debajo de lo reservado.' },
  conteo: { label: 'Corrección por conteo físico', help: 'Ingrese lo contado; el sistema registra la diferencia como movimiento.' },
  devolucion: { label: 'Devolución de cliente', help: 'Las devoluciones se registran desde el pedido completado para vincular cantidades y evitar duplicados.' },
};

export function Inventory() {
  const { notify, loadCatalog } = useStore();
  const products = useLoad('/staff/products');
  const suppliers = useLoad('/staff/suppliers');
  const [type, setType] = useState('entrada');
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState(null);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);

  const vmap = useMemo(() => {
    const m = new Map();
    for (const p of products.data?.products || []) for (const v of p.variants) m.set(v.id, { ...v, productName: p.name });
    return m;
  }, [products.data]);
  const v = vmap.get(variantId);
  const n = Number(qty);
  const preview = v && qty !== '' && Number.isInteger(n) ? (type === 'conteo' ? n : type === 'danio' ? v.physical - n : v.physical + n) : null;

  const reset = () => { setQty(''); setReason(''); setReference(''); setLines([]); };
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      let res;
      if (type === 'recepcion') {
        const all = lines.length ? lines : (v ? [{ variantId, qty: n }] : []);
        if (!supplierId) throw new Error('Seleccione el proveedor.');
        res = await api('/staff/stock/receipts', { method: 'POST', body: { supplierId: Number(supplierId), reference, notes: reason, lines: all } });
        setLast({ text: `Recepción #${res.receiptId} registrada (${res.results.length} línea(s)).`, rows: res.results });
      } else {
        if (!variantId) throw new Error('Seleccione un producto.');
        res = await api('/staff/stock/adjust', { method: 'POST', body: { variantId, type, qty: type === 'conteo' ? undefined : n, countedQty: type === 'conteo' ? n : undefined, reason, reference } });
        setLast({ text: `${ADJ_TYPES[type].label} registrada para ${v.sku}.`, rows: [res] });
      }
      notify('Movimiento registrado.');
      reset();
      products.reload();
      loadCatalog();
    } catch (x) { setErr({ error: x.message, details: x.details }); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h1>Inventario</h1>
      <div className="grid-2 grid-inv">
        <form className="panel" onSubmit={submit} noValidate>
          <fieldset className="field">
            <legend>Tipo de movimiento</legend>
            <div className="seg">{Object.entries(ADJ_TYPES).map(([k, x]) => <label key={k} className={type === k ? 'is-on' : ''}><input type="radio" name="adj" value={k} checked={type === k} onChange={() => { setType(k); setErr(null); }} />{x.label}</label>)}</div>
            <p className="hint">{ADJ_TYPES[type].help}</p>
          </fieldset>
          {type === 'devolucion' ? (
            <a className="btn btn-primary" href="/personal/pedidos?status=completado">Ir a pedidos completados</a>
          ) : (
            <>
              {type === 'recepcion' && (
                <div className="form-grid">
                  <div className="field"><label htmlFor="i-sup">Proveedor</label><select id="i-sup" className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Seleccione…</option>{suppliers.data?.suppliers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="i-ref">Referencia (factura / guía)</label><input id="i-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                </div>
              )}
              <VariantPicker products={products.data?.products} value={variantId} onChange={setVariantId} />
              {v && <p className="small stock-now">Actual: <strong>Físico {v.physical}</strong> · Reservado {v.reserved} · <strong>Disponible {v.available}</strong> {v.unitPlural}</p>}
              <div className="field">
                <label htmlFor="i-qty">{type === 'conteo' ? 'Cantidad contada (físico real)' : 'Cantidad'}</label>
                <input id="i-qty" className="input" type="number" min={type === 'conteo' ? 0 : 1} step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              {type === 'recepcion' && v && qty && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLines((l) => [...l, { variantId, qty: n }]); setQty(''); setVariantId(null); }}><Icon.plus size={14} /> Agregar línea</button>
              )}
              {lines.length > 0 && <ul className="mini-list">{lines.map((l, i) => <li key={i}><span className="mono">{vmap.get(l.variantId)?.sku}</span><span>+{l.qty} <button type="button" className="link-btn" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>Quitar</button></span></li>)}</ul>}
              {preview != null && type !== 'recepcion' && (
                <p className={`preview ${preview < v.reserved ? 'is-bad' : ''}`}>Físico: {v.physical} → <strong>{preview}</strong> · Disponible: {v.available} → <strong>{preview - v.reserved}</strong>
                  {preview < v.reserved && <><br />No permitido: quedaría por debajo de lo reservado ({v.reserved}) para pedidos activos.</>}</p>
              )}
              <div className="field">
                <label htmlFor="i-reason">{type === 'recepcion' ? 'Notas (opcional)' : 'Motivo (obligatorio)'}</label>
                <input id="i-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'danio' ? 'p. ej., sacos mojados' : type === 'conteo' ? 'p. ej., conteo semanal' : ''} />
              </div>
              {type !== 'recepcion' && <div className="field"><label htmlFor="i-ref2">Referencia (opcional)</label><input id="i-ref2" className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>}
              <ErrorBox error={err?.error} details={err?.details} />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Registrando…' : 'Registrar movimiento'}</button>
            </>
          )}
        </form>
        <section className="panel">
          <h2 className="panel-title">Último registro</h2>
          {!last ? <p className="muted small">Cada registro crea un movimiento inmutable con existencias antes y después.</p> : (
            <>
              <p className="status status-ok"><Icon.check size={16} /> {last.text}</p>
              <ul className="mini-list">{last.rows.map((r, i) => <li key={i}><span>Físico {r.before.physical} → <strong>{r.after.physical}</strong></span><span>Reservado {r.before.reserved} → {r.after.reserved}</span></li>)}</ul>
            </>
          )}
          <h2 className="panel-title">Reglas</h2>
          <ul className="bullets small">
            <li>Disponible = físico − reservado (no se guarda por separado).</li>
            <li>Agregar al carrito no reserva; enviar el pedido sí.</li>
            <li>Completar un pedido descuenta físico y reservado una sola vez.</li>
            <li>Cancelar libera la reserva una sola vez.</li>
            <li>No se permite físico negativo ni por debajo de lo reservado.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

// ---------------- Pedidos ----------------

export function OrdersAdmin() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const status = sp.get('status') || '';
  const selected = Number(sp.get('id')) || null;
  const { data, error, reload } = useLoad(`/staff/orders?${new URLSearchParams({ ...(q && { q }), ...(status && { status }) })}`);
  const meta = useLoad('/staff/meta');
  return (
    <div>
      <h1>Pedidos</h1>
      <div className="filters-row">
        <div className="field"><label htmlFor="o-q">Buscar</label><input id="o-q" className="input" type="search" placeholder="Número, cliente o teléfono" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="o-st">Estado</label><select id="o-st" className="input" value={status} onChange={(e) => { const n = new URLSearchParams(sp); if (e.target.value) n.set('status', e.target.value); else n.delete('status'); setSp(n); }}>
          <option value="">Todos</option>{Object.entries(meta.data?.orderStatuses || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table table-compact table-click">
            <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th className="num">Líneas</th><th className="num">Total</th><th>Pago</th><th>Estado</th></tr></thead>
            <tbody>
              {data.orders.length === 0 && <tr><td colSpan={8} className="center muted">Sin pedidos.</td></tr>}
              {data.orders.map((o) => (
                <tr key={o.id} className={selected === o.id ? 'is-selected' : ''}>
                  <td><button className="link-btn mono" onClick={() => { const n = new URLSearchParams(sp); n.set('id', o.id); setSp(n); }}>{o.number}</button></td>
                  <td className="nowrap small">{fmtDate(o.createdAt)}</td>
                  <td>{o.customerName}<br /><span className="small muted">{o.phone}</span></td>
                  <td className="small">{o.fulfillment === 'pickup' ? 'Retiro' : 'Entrega'}</td>
                  <td className="num">{o.items.length}</td>
                  <td className="num">{o.totalCents == null ? <span className="tbd">Por confirmar</span> : fmtMoney(o.totalCents)}</td>
                  <td><PaymentPill status={o.paymentStatus} label={o.paymentStatus === 'confirmado' ? 'Confirmado' : o.paymentStatus === 'anulado' ? 'Anulado' : 'Pendiente'} /></td>
                  <td><StatusPill status={o.status} label={o.statusLabel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <OrderAdminDetail id={selected} onClose={() => { const n = new URLSearchParams(sp); n.delete('id'); setSp(n); }} onChanged={reload} meta={meta.data} />}
    </div>
  );
}

function OrderAdminDetail({ id, onClose, onChanged, meta }) {
  const { notify, loadCatalog } = useStore();
  const { data, error, setData } = useLoad(`/staff/orders/${id}`);
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState('');
  const [payNote, setPayNote] = useState('');
  const [ret, setRet] = useState({ itemId: '', resellable: '0', damaged: '0', reason: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const o = data?.order;
  useEffect(() => { if (o) setDelivery(o.deliveryCents == null ? '' : centsToInput(o.deliveryCents)); }, [o?.deliveryCents]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (path, body, msg) => {
    setErr(null); setBusy(true);
    try { const d = await api(`/staff/orders/${id}/${path}`, { method: 'POST', body }); setData(d); notify(msg); onChanged(); loadCatalog(); setNote(''); }
    catch (x) { setErr({ error: x.message, details: x.details }); }
    finally { setBusy(false); }
  };
  const transition = (to) => {
    const label = meta?.orderStatuses?.[to] || to;
    if (to === 'cancelado' && !window.confirm('¿Cancelar el pedido? Se liberará la reserva de existencias.')) return;
    if (to === 'completado' && !window.confirm('¿Marcar como completado? Se descontarán las existencias físicas entregadas. Esta acción no se repite.')) return;
    const body = { status: to, note };
    if (to === 'confirmado' && o.fulfillment === 'delivery' && o.deliveryCents == null) {
      const c = centsFromInput(delivery);
      if (!Number.isFinite(c)) { setErr({ error: 'Ingrese el cargo de entrega (puede ser 0.00) antes de confirmar.' }); return; }
      body.deliveryCents = c;
    }
    act('status', body, `Estado actualizado: ${label}.`);
  };

  return (
    <Modal title={o ? `Pedido ${o.number}` : 'Pedido'} onClose={onClose} wide>
      <ErrorBox error={error} />
      {!o ? <Spinner /> : (
        <div className="order-admin">
          <div className="order-meta">
            <div><span className="muted small">Estado</span><StatusPill status={o.status} label={o.statusLabel} /></div>
            <div><span className="muted small">Pago</span><PaymentPill status={o.paymentStatus} label={o.paymentLabel} /></div>
            <div><span className="muted small">Entrega</span><strong>{o.fulfillment === 'pickup' ? 'Retiro en tienda' : 'Entrega'}</strong></div>
            <div><span className="muted small">Existencias</span><strong>{{ reserved: 'Reservadas', released: 'Liberadas', fulfilled: 'Despachadas' }[o.stockState]}</strong></div>
          </div>
          <div className="grid-2">
            <div>
              <h3>Cliente</h3>
              <p className="small">{o.customerName} · {o.phone}<br />{o.fulfillment === 'delivery' && <>Dirección: {o.address}<br /></>}{o.notes && <>Notas: {o.notes}</>}</p>
            </div>
            <div>
              <h3>Acciones de estado</h3>
              {o.nextStatuses.length === 0 ? <p className="small muted">Pedido cerrado. {o.status === 'completado' && 'Para devoluciones use el formulario de abajo.'}</p> : (
                <>
                  <div className="field"><label htmlFor="ad-note">Nota para el registro (opcional)</label><input id="ad-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                  <div className="row-wrap">{o.nextStatuses.map((s) => <button key={s} className={`btn btn-sm ${s === 'cancelado' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={() => transition(s)}>{s === 'cancelado' ? 'Cancelar pedido' : `Pasar a: ${meta?.orderStatuses?.[s]}`}</button>)}</div>
                </>
              )}
            </div>
          </div>
          {o.fulfillment === 'delivery' && !['completado', 'cancelado'].includes(o.status) && (
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); const c = centsFromInput(delivery); if (!Number.isFinite(c)) return setErr({ error: 'Monto inválido.' }); act('delivery', { deliveryCents: c }, 'Cargo de entrega actualizado.'); }}>
              <label htmlFor="ad-del" className="small strong">Cargo de entrega (B/.)</label>
              <input id="ad-del" className="input w-120" type="number" min="0" step="0.01" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="Por confirmar" />
              <button className="btn btn-ghost btn-sm" disabled={busy}>Guardar cargo</button>
            </form>
          )}
          <h3>Productos (precios al momento del pedido)</h3>
          <OrderItemsTable order={o} />
          <OrderTotals order={o} />
          <div className="grid-2">
            <form className="panel-sub" onSubmit={(e) => { e.preventDefault(); act('payment', { status: o.paymentStatus === 'confirmado' ? 'pendiente' : 'confirmado', note: payNote }, 'Estado de pago actualizado.'); setPayNote(''); }}>
              <h3>Pago (manual)</h3>
              <p className="small muted">No hay pasarela de pago. Marque como confirmado solo tras verificar el pago.</p>
              <div className="field"><label htmlFor="ad-pay">{o.paymentStatus === 'confirmado' ? 'Motivo para revertir' : 'Cómo se verificó (obligatorio)'}</label><input id="ad-pay" className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Transferencia ref. …, efectivo en caja…" /></div>
              <button className="btn btn-ghost btn-sm" disabled={busy || o.status === 'cancelado'}>{o.paymentStatus === 'confirmado' ? 'Revertir a pendiente' : 'Confirmar pago'}</button>
            </form>
            {o.status === 'completado' && (
              <form className="panel-sub" onSubmit={(e) => { e.preventDefault(); act('returns', { itemId: Number(ret.itemId), resellable: Number(ret.resellable), damaged: Number(ret.damaged), reason: ret.reason }, 'Devolución registrada.'); setRet({ itemId: '', resellable: '0', damaged: '0', reason: '' }); }}>
                <h3>Registrar devolución</h3>
                <div className="field"><label htmlFor="r-item">Línea</label><select id="r-item" className="input" value={ret.itemId} onChange={(e) => setRet({ ...ret, itemId: e.target.value })}><option value="">Seleccione…</option>
                  {o.items.map((i) => { const left = i.qty - i.returnedResellable - i.returnedDamaged; return <option key={i.id} value={i.id} disabled={left <= 0}>{i.sku} — {i.name} (elegibles: {left})</option>; })}</select></div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="r-res">Revendibles (reingresan)</label><input id="r-res" className="input" type="number" min="0" value={ret.resellable} onChange={(e) => setRet({ ...ret, resellable: e.target.value })} /></div>
                  <div className="field"><label htmlFor="r-dam">Dañadas (sin reingreso)</label><input id="r-dam" className="input" type="number" min="0" value={ret.damaged} onChange={(e) => setRet({ ...ret, damaged: e.target.value })} /></div>
                </div>
                <div className="field"><label htmlFor="r-why">Motivo</label><input id="r-why" className="input" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} /></div>
                <button className="btn btn-ghost btn-sm" disabled={busy}>Registrar devolución</button>
              </form>
            )}
          </div>
          <ErrorBox error={err?.error} details={err?.details} />
          <h3>Registro del pedido</h3>
          <ol className="timeline">
            {o.events.map((e) => (
              <li key={e.id}><span className="small muted">{fmtDate(e.createdAt)}</span> · <strong>{e.kind === 'status' ? `${e.from ? meta?.orderStatuses?.[e.from] + ' → ' : ''}${meta?.orderStatuses?.[e.to]}` : e.kind === 'payment' ? `Pago: ${e.from} → ${e.to}` : e.kind === 'delivery' ? `Cargo de entrega: ${fmtMoney(Number(e.to))}` : `Devolución: ${e.to}`}</strong> · {e.actorName}{e.note ? ` — ${e.note}` : ''}</li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
