import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { fmtDate, fmtMoney, pct } from '../lib/format.js';
import { IMAGES } from '../lib/images.js';
import { ErrorBox, Icon, Spinner } from '../components/ui.jsx';
import { Toast } from '../components/Layout.jsx';
import { Modal, Stat, useLoad } from './common.jsx';

const NAV = [
  ['/personal', 'Resumen', 'grid', 'staff', true],
  ['/personal/productos', 'Productos', 'box', 'products'],
  ['/personal/inventario', 'Inventario', 'layers', 'stock'],
  ['/personal/pedidos', 'Pedidos', 'clipboard', 'orders'],
  ['/personal/proveedores', 'Proveedores', 'users', 'suppliers'],
  ['/personal/historial', 'Historial', 'history', ['stock', 'orders']],
  ['/personal/configuracion', 'Configuración', 'settings', 'settings'],
];

export const has = (user, perm) => (Array.isArray(perm) ? perm.some((p) => user?.permissions?.includes(p)) : user?.permissions?.includes(perm));

export function StaffLayout() {
  const { user, setUser, settings, demoMode, config } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!config) return <div className="container page"><Spinner /></div>;
  if (!user) return <Navigate to="/cuenta?next=/personal" replace />;
  if (!has(user, 'staff')) {
    return (
      <div className="container page narrow">
        <div className="alert alert-error" role="alert"><Icon.alert size={18} /><div><strong>Acceso restringido.</strong> Esta área es solo para el personal autorizado de la tienda. Su cuenta es de cliente.</div></div>
        <Link className="btn btn-primary" to="/">Volver a la tienda</Link>
      </div>
    );
  }
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); setUser(null); nav('/'); };
  return (
    <div className="staff">
      <a href="#staff-main" className="skip-link">Saltar al contenido</a>
      <aside className={`staff-side ${open ? 'is-open' : ''}`}>
        <div className="staff-brand">
          <img src={settings?.logoUrl || IMAGES.logo} alt={settings?.businessName} width="170" height="46" />
          <span className="staff-tag">Personal</span>
        </div>
        <nav aria-label="Personal">
          {NAV.filter(([, , , perm]) => has(user, perm)).map(([to, label, icon, , end]) => {
            const Ico = Icon[icon];
            return <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><Ico size={18} /> {label}</NavLink>;
          })}
        </nav>
        <div className="staff-side-foot">
          <Link to="/" className="back-store"><Icon.chevronLeft size={16} /> Volver a la tienda</Link>
          <div className="staff-user"><Icon.user size={16} /> <span>{user.name}<small>{user.roleLabel}</small></span></div>
          <button type="button" className="link-btn" onClick={logout}><Icon.logout size={15} /> Cerrar sesión</button>
        </div>
      </aside>
      <div className="staff-main">
        <header className="staff-top">
          <button type="button" className="icon-btn only-mobile" aria-label="Menú del personal" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon.menu /></button>
          {demoMode && <span className="demo-pill" title="Datos de demostración">DEMO · datos de prueba</span>}
          <Link to="/" className="btn btn-ghost btn-sm"><Icon.store size={16} /> Ver tienda</Link>
        </header>
        <main id="staff-main" tabIndex={-1} className="staff-content"><Outlet /></main>
      </div>
      <Toast />
    </div>
  );
}

export function Overview() {
  const { user } = useStore();
  const { data, error } = useLoad('/staff/summary');
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  return (
    <div>
      <h1>Resumen</h1>
      <div className="stats">
        <Stat label="SKU activos" value={data.activeSkus} icon="box" />
        <Stat label="Existencia baja" value={data.lowStock} tone="tone-warn" icon="alert" hint="Disponible ≤ punto de reorden" />
        <Stat label="Agotados" value={data.unavailable} tone="tone-bad" icon="close" hint="Disponible = 0" />
        <Stat label="Pedidos pendientes" value={data.pendingOrders} tone="tone-info" icon="clipboard" hint={data.awaitingDelivery ? `${data.awaitingDelivery} con entrega por cotizar` : 'Sin entregas por cotizar'} />
        <Stat label="Ventas completadas (30 días)" value={fmtMoney(data.completedSales30d.cents)} icon="check" hint={`${data.completedSales30d.orders} pedido(s). Base: ${data.completedSales30d.basis}`} />
      </div>
      <div className="grid-2">
        <section className="panel">
          <div className="row-between"><h2 className="panel-title">Reponer pronto</h2>{has(user, 'stock') && <Link to="/personal/inventario" className="link-btn">Registrar entrada</Link>}</div>
          {data.lowItems.length === 0 ? <p className="muted">Todo por encima del punto de reorden.</p> : (
            <ul className="mini-list">
              {data.lowItems.map((x) => (
                <li key={x.id}><span><span className="mono">{x.sku}</span> {x.name} {x.label && <span className="muted">— {x.label}</span>}</span>
                  <span className={`badge ${x.available <= 0 ? 'badge-out' : 'badge-low'}`}>{x.available <= 0 ? 'Agotado' : `Disp. ${x.available}`} / reorden {x.reorderThreshold}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <div className="row-between"><h2 className="panel-title">Movimientos recientes</h2><Link to="/personal/historial" className="link-btn">Ver historial</Link></div>
          <ul className="mini-list">
            {data.recentMovements.map((m) => (
              <li key={m.id}><span><strong>{m.typeLabel}</strong> · <span className="mono">{m.sku}</span><br /><span className="muted small">{fmtDate(m.createdAt)} · {m.actorName}</span></span>
                <span className="mono small">{m.physicalDelta !== 0 && `F ${m.physicalDelta > 0 ? '+' : ''}${m.physicalDelta}`} {m.reservedDelta !== 0 && `R ${m.reservedDelta > 0 ? '+' : ''}${m.reservedDelta}`}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function History() {
  const [f, setF] = useState({ sku: '', type: '', from: '', to: '', orderNumber: '' });
  const qs = new URLSearchParams(Object.entries({
    ...f,
    from: f.from ? new Date(`${f.from}T00:00:00-05:00`).toISOString() : '',
    to: f.to ? new Date(`${f.to}T23:59:59.999-05:00`).toISOString() : '',
  }).filter(([, v]) => v)).toString();
  const { data, error } = useLoad(`/staff/movements?${qs}`);
  const meta = useLoad('/staff/meta');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div>
      <div className="row-between"><h1>Historial de movimientos</h1>
        <a className="btn btn-ghost" href={`/api/staff/movements.csv?${qs}`} download><Icon.download size={16} /> Exportar CSV</a></div>
      <p className="muted small">Registro inmutable. Horas en zona America/Panama. F = existencia física, R = reservada.</p>
      <div className="filters-row">
        <div className="field"><label htmlFor="h-sku">SKU o producto</label><input id="h-sku" className="input" value={f.sku} onChange={set('sku')} /></div>
        <div className="field"><label htmlFor="h-type">Tipo</label>
          <select id="h-type" className="input" value={f.type} onChange={set('type')}><option value="">Todos</option>
            {Object.entries(meta.data?.movementTypes || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="h-from">Desde</label><input id="h-from" className="input" type="date" value={f.from} onChange={set('from')} /></div>
        <div className="field"><label htmlFor="h-to">Hasta</label><input id="h-to" className="input" type="date" value={f.to} onChange={set('to')} /></div>
        <div className="field"><label htmlFor="h-ord">Pedido / referencia</label><input id="h-ord" className="input" value={f.orderNumber} onChange={set('orderNumber')} /></div>
      </div>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th>Fecha</th><th>SKU / producto</th><th>Tipo</th><th className="num">Δ F</th><th className="num">Δ R</th><th className="num">F antes→después</th><th className="num">R antes→después</th><th>Motivo</th><th>Vínculo</th><th>Usuario</th></tr></thead>
            <tbody>
              {data.movements.length === 0 && <tr><td colSpan={10} className="muted center">Sin movimientos con estos filtros.</td></tr>}
              {data.movements.map((m) => (
                <tr key={m.id}>
                  <td className="nowrap">{fmtDate(m.createdAt)}</td>
                  <td><span className="mono">{m.sku}</span><br /><span className="small muted">{m.productName}</span></td>
                  <td><span className={`mv mv-${m.type}`}>{m.typeLabel}</span></td>
                  <td className={`num ${m.physicalDelta > 0 ? 'pos' : m.physicalDelta < 0 ? 'neg' : ''}`}>{m.physicalDelta > 0 ? '+' : ''}{m.physicalDelta}</td>
                  <td className={`num ${m.reservedDelta > 0 ? 'pos' : m.reservedDelta < 0 ? 'neg' : ''}`}>{m.reservedDelta > 0 ? '+' : ''}{m.reservedDelta}</td>
                  <td className="num nowrap">{m.physicalBefore} → {m.physicalAfter}</td>
                  <td className="num nowrap">{m.reservedBefore} → {m.reservedAfter}</td>
                  <td className="small">{m.reason}</td>
                  <td className="small">{m.orderId ? <Link to={`/personal/pedidos?id=${m.orderId}`}>{m.reference}</Link> : m.receiptId ? `Recepción #${m.receiptId} · ${m.reference}${m.supplierName ? ` · ${m.supplierName}` : ''}` : m.reference || '—'}</td>
                  <td className="small">{m.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Suppliers() {
  const { notify, user } = useStore();
  const { data, error, reload } = useLoad('/staff/suppliers');
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    try { await api('/staff/suppliers', { method: 'POST', body: edit }); setEdit(null); notify('Proveedor guardado.'); reload(); }
    catch (x) { setErr(x.message); }
  };
  const set = (k) => (e) => setEdit((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div>
      <div className="row-between"><h1>Proveedores</h1>{has(user, 'suppliers') && <button className="btn btn-primary" onClick={() => setEdit({ name: '', contact: '', phone: '', email: '', notes: '', active: true })}><Icon.plus size={16} /> Nuevo proveedor</button>}</div>
      <p className="muted small">Los proveedores marcados “ficticio” son de demostración. Registre recepciones desde Inventario → Recepción de proveedor.</p>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="supplier-list">
          {data.suppliers.map((s) => (
            <section key={s.id} className="panel">
              <div className="row-between">
                <div><h2 className="panel-title">{s.name} {!s.active && <span className="badge badge-out">Inactivo</span>} {s.isDemo && <span className="badge">Demo</span>}</h2>
                  <p className="small muted">{[s.contact, s.phone, s.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>{s.notes && <p className="small">{s.notes}</p>}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...s })}>Editar</button>
              </div>
              <h3 className="small strong">Recepciones vinculadas ({s.receipts.length})</h3>
              {s.receipts.length === 0 ? <p className="small muted">Sin recepciones.</p> : (
                <ul className="mini-list">{s.receipts.map((r) => <li key={r.id}><span>#{r.id} · <strong>{r.reference}</strong> · {fmtDate(r.createdAt)} · {r.actorName}</span><span className="small">{r.lineCount} línea(s), {r.unitCount} unidades · <Link to={`/personal/historial`}>historial</Link></span></li>)}</ul>
              )}
            </section>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="form-grid">
            <div className="field span-2"><label htmlFor="s-name">Nombre</label><input id="s-name" className="input" value={edit.name} onChange={set('name')} required /></div>
            <div className="field"><label htmlFor="s-contact">Contacto</label><input id="s-contact" className="input" value={edit.contact} onChange={set('contact')} /></div>
            <div className="field"><label htmlFor="s-phone">Teléfono</label><input id="s-phone" className="input" value={edit.phone} onChange={set('phone')} /></div>
            <div className="field span-2"><label htmlFor="s-email">Correo</label><input id="s-email" className="input" type="email" value={edit.email} onChange={set('email')} /></div>
            <div className="field span-2"><label htmlFor="s-notes">Notas</label><textarea id="s-notes" className="input" rows={2} value={edit.notes} onChange={set('notes')} /></div>
            {edit.id && <label className="check span-2"><input type="checkbox" checked={edit.active !== false} onChange={set('active')} /> Activo</label>}
            <div className="span-2"><ErrorBox error={err} /></div>
            <div className="span-2 row-end"><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { settings, loadConfig, notify, demoMode, setUser } = useStore();
  const nav = useNavigate();
  const meta = useLoad('/staff/meta');
  const users = useLoad('/staff/users');
  const [form, setForm] = useState(() => ({ ...settings, whatsappNumbers: (settings?.whatsappNumbers || []).join(', ') }));
  const [err, setErr] = useState(null);
  const [unit, setUnit] = useState({ code: '', nameSingular: '', namePlural: '' });
  const [tax, setTax] = useState({ name: '', rate: '' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'inventory' });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const run = async (fn, ok) => { setErr(null); try { await fn(); if (ok) notify(ok); } catch (x) { setErr(x.message); notify(x.message, 'error'); } };

  const saveSettings = (e) => { e.preventDefault(); run(async () => {
    await api('/staff/settings', { method: 'PUT', body: { ...form, whatsappNumbers: form.whatsappNumbers.split(',').map((s) => s.trim()).filter(Boolean) } });
    await loadConfig();
  }, 'Configuración guardada.'); };
  const uploadLogo = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => run(async () => { const d = await api('/staff/uploads', { method: 'POST', body: { dataUrl: r.result } }); setForm((f) => ({ ...f, logoUrl: d.url })); }, 'Logo subido. Guarde para aplicarlo.');
    r.readAsDataURL(file);
  };

  return (
    <div>
      <h1>Configuración</h1>
      <ErrorBox error={err} />
      <form className="panel form-grid" onSubmit={saveSettings}>
        <h2 className="panel-title span-2">Negocio y contacto</h2>
        <div className="field"><label htmlFor="c-name">Nombre comercial</label><input id="c-name" className="input" value={form.businessName} onChange={set('businessName')} /></div>
        <div className="field"><label htmlFor="c-ig">Instagram (sin @)</label><input id="c-ig" className="input" value={form.instagram} onChange={set('instagram')} /></div>
        <div className="field"><label htmlFor="c-wa">Números de WhatsApp (separados por coma)</label><input id="c-wa" className="input" value={form.whatsappNumbers} onChange={set('whatsappNumbers')} /></div>
        <div className="field"><label htmlFor="c-cc">Código de país</label><input id="c-cc" className="input" value={form.whatsappCountryCode} onChange={set('whatsappCountryCode')} /></div>
        <div className="field span-2">
          <label htmlFor="c-logo">Logo (URL o archivo)</label>
          <div className="logo-row">
            <img src={form.logoUrl || IMAGES.logo} alt="Vista previa del logo" width="170" height="46" className="logo-preview" />
            <input id="c-logo" className="input" value={form.logoUrl} onChange={set('logoUrl')} placeholder="Vacío = logotipo de texto temporal" />
            <label className="btn btn-ghost btn-sm file-btn">Subir<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadLogo(e.target.files?.[0])} /></label>
          </div>
        </div>
        <div className="field"><label htmlFor="c-del">Mensaje de entrega</label><input id="c-del" className="input" value={form.deliveryMessage} onChange={set('deliveryMessage')} /></div>
        <div className="field"><label htmlFor="c-disc">Aviso de cobertura</label><input id="c-disc" className="input" value={form.deliveryDisclaimer} onChange={set('deliveryDisclaimer')} /></div>
        <div className="field span-2"><label htmlFor="c-pay">Instrucciones de pago</label><textarea id="c-pay" className="input" rows={2} value={form.paymentInstructions} onChange={set('paymentInstructions')} /></div>
        <div className="field span-2"><label htmlFor="c-tax">Nota de impuestos</label><input id="c-tax" className="input" value={form.taxNote} onChange={set('taxNote')} /></div>
        <div className="span-2 row-end"><button className="btn btn-primary">Guardar configuración</button></div>
      </form>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel-title">Unidades de venta</h2>
          <ul className="mini-list">{meta.data?.units.map((u) => <li key={u.code}><span className="mono">{u.code}</span><span>{u.nameSingular} / {u.namePlural}</span></li>)}</ul>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/staff/units', { method: 'POST', body: unit }); setUnit({ code: '', nameSingular: '', namePlural: '' }); meta.reload(); }, 'Unidad guardada.'); }}>
            <input className="input" aria-label="Código" placeholder="código" value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} />
            <input className="input" aria-label="Singular" placeholder="singular" value={unit.nameSingular} onChange={(e) => setUnit({ ...unit, nameSingular: e.target.value })} />
            <input className="input" aria-label="Plural" placeholder="plural" value={unit.namePlural} onChange={(e) => setUnit({ ...unit, namePlural: e.target.value })} />
            <button className="btn btn-ghost btn-sm">Agregar</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="panel-title">Impuestos</h2>
          <p className="small muted">Se asignan por SKU en Productos. Cambiar una tasa afecta solo pedidos futuros. {demoMode && 'Tasas de demostración: confírmelas con su contador.'}</p>
          <ul className="mini-list">{meta.data?.taxRates.map((x) => <TaxRow key={x.id} tax={x} onSave={(name, rateBp) => run(async () => { await api('/staff/tax-rates', { method: 'POST', body: { id: x.id, name, rateBp } }); meta.reload(); }, 'Impuesto actualizado.')} />)}</ul>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/staff/tax-rates', { method: 'POST', body: { name: tax.name, rateBp: Math.round(Number(tax.rate) * 100) } }); setTax({ name: '', rate: '' }); meta.reload(); }, 'Impuesto agregado.'); }}>
            <input className="input" aria-label="Nombre del impuesto" placeholder="Nombre" value={tax.name} onChange={(e) => setTax({ ...tax, name: e.target.value })} />
            <input className="input" aria-label="Tasa en porcentaje" placeholder="%" type="number" step="0.01" min="0" max="100" value={tax.rate} onChange={(e) => setTax({ ...tax, rate: e.target.value })} />
            <button className="btn btn-ghost btn-sm">Agregar</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Personal y permisos</h2>
        <p className="small muted">Administrador: configuración y personal. Inventario: productos, existencias y proveedores. Pedidos: gestión de pedidos. Los permisos se verifican en el servidor.</p>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th></tr></thead>
          <tbody>{users.data?.users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td>
              <td><select className="input input-sm" aria-label={`Rol de ${u.name}`} value={u.role} onChange={(e) => run(async () => { await api(`/staff/users/${u.id}`, { method: 'PUT', body: { role: e.target.value, active: u.active } }); users.reload(); }, 'Rol actualizado.')}>
                {Object.entries(users.data.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><input type="checkbox" aria-label={`Activo: ${u.name}`} checked={u.active} onChange={(e) => run(async () => { await api(`/staff/users/${u.id}`, { method: 'PUT', body: { role: u.role, active: e.target.checked } }); users.reload(); }, 'Estado actualizado.')} /></td></tr>
          ))}</tbody>
        </table></div>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/staff/users', { method: 'POST', body: staffForm }); setStaffForm({ name: '', email: '', password: '', role: 'inventory' }); users.reload(); }, 'Usuario de personal creado.'); }}>
          <input className="input" aria-label="Nombre" placeholder="Nombre" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
          <input className="input" aria-label="Correo" type="email" placeholder="Correo" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
          <input className="input" aria-label="Contraseña inicial" type="password" placeholder="Contraseña (8+)" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} autoComplete="new-password" />
          <select className="input" aria-label="Rol" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
            <option value="inventory">Personal de inventario</option><option value="orders">Personal de pedidos</option><option value="admin">Administrador</option></select>
          <button className="btn btn-ghost btn-sm">Crear</button>
        </form>
      </section>

      {demoMode && (
        <section className="panel panel-danger">
          <h2 className="panel-title">Restablecer datos de demostración</h2>
          <p className="small">Borra todos los pedidos, movimientos, productos y cuentas, y vuelve a cargar los datos de demostración. Las contraseñas de prueba se regeneran. Solo disponible en modo demostración.</p>
          <button className="btn btn-danger" onClick={() => setResetOpen(true)}>Restablecer datos de demostración</button>
        </section>
      )}
      {resetOpen && (
        <Modal title="¿Restablecer datos de demostración?" onClose={() => setResetOpen(false)}>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/staff/demo/reset', { method: 'POST', body: { confirm: resetText } }); setResetOpen(false); setUser(null); localStorage.removeItem('fm_cart'); nav('/cuenta'); window.location.reload(); }); }}>
            <p>Esta acción no se puede deshacer. Escriba <strong>RESTABLECER</strong> para confirmar.</p>
            <div className="field"><label htmlFor="reset-c">Confirmación</label><input id="reset-c" className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" /></div>
            <div className="row-end"><button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>Cancelar</button><button className="btn btn-danger" disabled={resetText !== 'RESTABLECER'}>Restablecer</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TaxRow({ tax, onSave }) {
  const [name, setName] = useState(tax.name);
  const [rate, setRate] = useState(String(tax.rateBp / 100));
  const dirty = name !== tax.name || Math.round(Number(rate) * 100) !== tax.rateBp;
  return (
    <li>
      <input className="input input-sm" aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <span className="row-wrap"><input className="input input-sm w-80" aria-label="Tasa %" type="number" step="0.01" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} /> <span className="small">{pct(Math.round(Number(rate) * 100) || 0)}</span>
        {dirty && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave(name, Math.round(Number(rate) * 100))}>Guardar</button>}</span>
    </li>
  );
}
