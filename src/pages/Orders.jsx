import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { fmtDate, fmtMoney } from '../lib/format.js';
import { waLink } from '../lib/whatsapp.js';
import { Empty, ErrorBox, Icon, Spinner } from '../components/ui.jsx';

const STATUS_ICON = { recibido: 'clipboard', confirmado: 'check', en_preparacion: 'box', listo_para_retirar: 'store', en_reparto: 'truck', completado: 'check', cancelado: 'close' };

export function StatusPill({ status, label }) {
  const Ico = Icon[STATUS_ICON[status]] || Icon.info;
  return <span className={`status-pill st-${status}`}><Ico size={14} sw={2.2} /> {label}</span>;
}
export function PaymentPill({ status, label }) {
  return <span className={`status-pill pay-${status}`}>{status === 'confirmado' ? <Icon.check size={14} sw={2.2} /> : <Icon.info size={14} />} {label}</span>;
}

export function OrderSteps({ order }) {
  const flow = order.fulfillment === 'pickup'
    ? ['recibido', 'confirmado', 'en_preparacion', 'listo_para_retirar', 'completado']
    : ['recibido', 'confirmado', 'en_preparacion', 'en_reparto', 'completado'];
  const labels = { recibido: 'Recibido', confirmado: 'Confirmado', en_preparacion: 'En preparación', listo_para_retirar: 'Listo para retirar', en_reparto: 'En reparto', completado: 'Completado' };
  if (order.status === 'cancelado') return <p className="status status-out"><Icon.close size={16} /> Pedido cancelado. Las existencias reservadas fueron liberadas.</p>;
  const cur = flow.indexOf(order.status);
  return (
    <ol className="steps" aria-label="Progreso del pedido">
      {flow.map((s, i) => (
        <li key={s} className={i < cur ? 'done' : i === cur ? 'current' : ''} aria-current={i === cur ? 'step' : undefined}>
          <span className="step-dot" aria-hidden="true">{i < cur ? <Icon.check size={12} sw={3} /> : i + 1}</span>
          <span>{labels[s]}{i < cur ? <span className="sr-only"> (completado)</span> : ''}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderTotals({ order }) {
  const taxes = new Map();
  for (const i of order.items) {
    const k = `${i.taxName}|${i.taxRateBp}`;
    taxes.set(k, (taxes.get(k) || 0) + i.lineTaxCents);
  }
  return (
    <dl className="totals">
      <div><dt>Subtotal</dt><dd>{fmtMoney(order.subtotalCents)}</dd></div>
      {[...taxes.entries()].map(([k, v]) => { const [n] = k.split('|'); return <div key={k}><dt>{n}</dt><dd>{fmtMoney(v)}</dd></div>; })}
      <div><dt>{order.fulfillment === 'pickup' ? 'Retiro en tienda' : 'Entrega'}</dt><dd>{order.deliveryCents == null ? <span className="tbd">Por confirmar</span> : fmtMoney(order.deliveryCents)}</dd></div>
      <div className="grand"><dt>Total</dt><dd>{order.totalCents == null ? <span className="tbd">Por confirmar</span> : fmtMoney(order.totalCents)}</dd></div>
    </dl>
  );
}

export function OrderItemsTable({ order }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Producto</th><th>SKU</th><th className="num">Cant.</th><th className="num">Precio unit.</th><th className="num">Importe</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}{i.variantLabel ? <span className="muted"> — {i.variantLabel}</span> : ''}</td>
              <td className="mono">{i.sku}</td>
              <td className="num">{i.qty} {i.unitName}</td>
              <td className="num">{fmtMoney(i.unitPriceCents)}</td>
              <td className="num">{fmtMoney(i.lineSubtotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderPage() {
  const { number } = useParams();
  const { user, settings, loadCatalog } = useStore();
  const loc = useLocation();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) { nav(`/cuenta?next=/pedido/${number}`, { replace: true }); return; }
    api(`/orders/${encodeURIComponent(number)}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [number, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="container page"><Empty title="No encontramos este pedido" action={<Link className="btn btn-primary" to="/mis-pedidos">Ver mis pedidos</Link>}>{error}</Empty></div>;
  if (!order) return <div className="container page"><Spinner label="Cargando pedido…" /></div>;
  const justPlaced = loc.state?.justPlaced;

  const cancel = async () => {
    if (!window.confirm('¿Cancelar este pedido? Se liberarán las existencias reservadas.')) return;
    setBusy(true);
    try { const d = await api(`/orders/${order.number}/cancel`, { method: 'POST', body: {} }); setOrder(d.order); loadCatalog(); }
    catch (e) { setError(null); alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container page narrow">
      {justPlaced && (
        <div className="success-hero" role="status">
          <span className="success-icon" aria-hidden="true"><Icon.check size={30} sw={2.6} /></span>
          <div>
            <h1>¡Pedido enviado!</h1>
            <p>Tu número de pedido es <strong className="mono">{order.number}</strong>. Reservamos las existencias de tus productos. {order.fulfillment === 'delivery' ? 'Te contactaremos para confirmar cobertura y costo de entrega.' : 'Te avisaremos cuando esté listo para retirar.'}</p>
          </div>
        </div>
      )}
      {!justPlaced && <h1>Pedido <span className="mono">{order.number}</span></h1>}
      <div className="panel">
        <div className="order-meta">
          <div><span className="muted small">Estado</span><StatusPill status={order.status} label={order.statusLabel} /></div>
          <div><span className="muted small">Pago</span><PaymentPill status={order.paymentStatus} label={order.paymentLabel} /></div>
          <div><span className="muted small">Entrega</span><strong>{order.fulfillment === 'pickup' ? 'Retiro en tienda' : 'Entrega a domicilio'}</strong></div>
          <div><span className="muted small">Fecha</span><strong>{fmtDate(order.createdAt)}</strong></div>
        </div>
        <OrderSteps order={order} />
      </div>
      <div className="panel">
        <h2 className="panel-title">Resumen</h2>
        <OrderItemsTable order={order} />
        <OrderTotals order={order} />
        {order.fulfillment === 'delivery' && <p className="small"><strong>Dirección:</strong> {order.address}</p>}
        {order.notes && <p className="small"><strong>Notas:</strong> {order.notes}</p>}
        <p className="tiny muted">El pago se coordina con el personal; esta tienda no procesa pagos en línea. Los precios quedan registrados al momento del pedido.</p>
      </div>
      <div className="row-wrap">
        <a className="btn btn-ghost" href={waLink(settings, `Hola, Ferremateriales. Consulto por mi pedido ${order.number}.`)} target="_blank" rel="noopener noreferrer"><Icon.whatsapp size={18} /> Consultar por WhatsApp</a>
        <Link className="btn btn-ghost" to="/mis-pedidos">Mis pedidos</Link>
        {order.status === 'recibido' && <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy}>Cancelar pedido</button>}
      </div>
    </div>
  );
}

export function MyOrders() {
  const { user } = useStore();
  const nav = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!user) { nav('/cuenta?next=/mis-pedidos', { replace: true }); return; }
    api('/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null;
  return (
    <div className="container page narrow">
      <AccountBar />
      <h1>Mis pedidos</h1>
      <ErrorBox error={error} />
      {!orders && !error && <Spinner />}
      {orders?.length === 0 && <Empty title="Aún no tienes pedidos" action={<Link className="btn btn-primary" to="/tienda">Ir a la tienda</Link>} />}
      {orders?.length > 0 && (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/pedido/${o.number}`} className="order-row">
                <span className="mono strong">{o.number}</span>
                <span className="muted small">{fmtDate(o.createdAt)}</span>
                <StatusPill status={o.status} label={o.statusLabel} />
                <span className="small">{o.items.length} producto(s)</span>
                <strong>{o.totalCents == null ? 'Por confirmar' : fmtMoney(o.totalCents)}</strong>
                <Icon.arrow size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountBar() {
  const { user, setUser } = useStore();
  const nav = useNavigate();
  if (!user) return null;
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); setUser(null); nav('/'); };
  return (
    <div className="account-bar">
      <span><Icon.user size={16} /> {user.name} · <span className="muted">{user.email}</span></span>
      <button type="button" className="link-btn" onClick={logout}><Icon.logout size={15} /> Cerrar sesión</button>
    </div>
  );
}

export function AccountPage() {
  const { user, setUser, demoMode } = useStore();
  const loc = useLocation();
  const nav = useNavigate();
  const next = new URLSearchParams(loc.search).get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) nav(safeNext || (user.role === 'customer' ? '/mis-pedidos' : '/personal'), { replace: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && form.password.length < 8) return setError({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    setBusy(true);
    try {
      const d = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: mode === 'login' ? { email: form.email, password: form.password } : form });
      setUser(d.user);
    } catch (err) { setError({ error: err.message, details: err.details }); }
    finally { setBusy(false); }
  };
  return (
    <div className="container page auth">
      <div className="panel auth-card">
        <div className="tabs" role="tablist" aria-label="Cuenta">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-on' : ''} onClick={() => { setMode('login'); setError(null); }}>Iniciar sesión</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-on' : ''} onClick={() => { setMode('register'); setError(null); }}>Crear cuenta</button>
        </div>
        <form onSubmit={submit} noValidate>
          <h1 className="h2">{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta de cliente'}</h1>
          {mode === 'register' && (
            <>
              <div className="field"><label htmlFor="a-name">Nombre completo</label><input id="a-name" className="input" value={form.name} onChange={set('name')} autoComplete="name" required /></div>
              <div className="field"><label htmlFor="a-phone">Teléfono (opcional)</label><input id="a-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></div>
            </>
          )}
          <div className="field"><label htmlFor="a-email">Correo electrónico</label><input id="a-email" className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
          <div className="field">
            <label htmlFor="a-pass">Contraseña</label>
            <input id="a-pass" className="input" type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} aria-describedby="a-pass-h" />
            {mode === 'register' && <p id="a-pass-h" className="hint">Mínimo 8 caracteres.</p>}
          </div>
          <ErrorBox error={error?.error} details={error?.details} />
          <button className="btn btn-primary btn-block" disabled={busy} aria-busy={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
          <p className="tiny muted center">Las cuentas nuevas son siempre de cliente. El acceso del personal lo otorga un administrador.</p>
          {demoMode && <p className="tiny muted center">Modo demostración: las cuentas de prueba están en <code>data/demo-credentials.txt</code> del servidor.</p>}
        </form>
      </div>
    </div>
  );
}
