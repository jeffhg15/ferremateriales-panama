import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { fmtMoney, newKey } from '../lib/format.js';
import { Empty, ErrorBox, Icon, Img, QtyControl, Spinner } from '../components/ui.jsx';

export function totalsFor(lines, fulfillment) {
  const subtotal = lines.reduce((s, l) => s + l.variant.priceCents * l.qty, 0);
  const taxByRate = new Map();
  for (const l of lines) {
    const tax = Math.round((l.variant.priceCents * l.qty * l.variant.taxRateBp) / 10000);
    const k = `${l.variant.taxName}|${l.variant.taxRateBp}`;
    taxByRate.set(k, (taxByRate.get(k) || 0) + tax);
  }
  const tax = [...taxByRate.values()].reduce((a, b) => a + b, 0);
  const delivery = fulfillment === 'pickup' ? 0 : null;
  return { subtotal, taxByRate, tax, delivery, total: delivery == null ? null : subtotal + tax + delivery };
}

export default function Cart() {
  const { catalog, cartLines, user, settings, clearCart, loadCatalog, setQty, demoMode } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState(() => ({ customerName: user?.name || '', phone: user?.phone || '', fulfillment: 'pickup', address: '', notes: '' }));
  // La sesión puede cargarse después del primer render: completar datos vacíos al conocer al usuario.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, customerName: f.customerName || user.name || '', phone: f.phone || user.phone || '' }));
  }, [user]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Clave de idempotencia estable mientras el carrito no cambie: un doble clic o reintento no duplica el pedido.
  const keyRef = useRef(newKey());
  const sig = cartLines.map((l) => `${l.variantId}:${l.qty}`).join(',');
  const lastSig = useRef(sig);
  if (lastSig.current !== sig) { lastSig.current = sig; keyRef.current = newKey(); }

  const t = useMemo(() => totalsFor(cartLines, form.fulfillment), [cartLines, form.fulfillment]);
  const problems = cartLines.filter((l) => l.qty > l.variant.available || l.qty % l.variant.step !== 0);

  if (!catalog) return <div className="container page"><Spinner /></div>;
  if (!cartLines.length) {
    return <div className="container page"><Empty title="Tu carrito está vacío" action={<Link className="btn btn-primary" to="/tienda">Explorar la tienda</Link>}>Agrega materiales desde la tienda. Agregar al carrito no reserva existencias; la reserva ocurre al enviar el pedido.</Empty></div>;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const validate = () => {
    const e = {};
    if (form.customerName.trim().length < 2) e.customerName = 'Ingrese su nombre completo.';
    if (form.phone.replace(/\D/g, '').length < 7) e.phone = 'Ingrese un teléfono válido (mínimo 7 dígitos).';
    if (form.fulfillment === 'delivery' && form.address.trim().length < 8) e.address = 'Ingrese la dirección de entrega con referencias.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setServerError(null);
    if (!user) return nav('/cuenta?next=/carrito');
    if (problems.length) return setServerError({ error: 'Ajuste las cantidades marcadas antes de enviar.' });
    if (!validate()) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const { order } = await api('/orders', { method: 'POST', body: { ...form, idempotencyKey: keyRef.current, items: cartLines.map((l) => ({ variantId: l.variantId, qty: l.qty })) } });
      clearCart();
      loadCatalog();
      nav(`/pedido/${order.number}`, { state: { justPlaced: true } });
    } catch (err) {
      setServerError({ error: err.message, details: err.details });
      if (err.status === 409) loadCatalog(); // refrescar existencias tras rechazo
      if (err.status === 401) nav('/cuenta?next=/carrito');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page">
      <nav aria-label="Ruta" className="crumbs"><Link to="/">Inicio</Link> / <span>Carrito</span></nav>
      <h1>Carrito y pedido</h1>
      <div className="checkout">
        <section aria-labelledby="lines-title" className="panel">
          <h2 id="lines-title" className="panel-title">Productos ({cartLines.length})</h2>
          <ul className="cart-lines">
            {cartLines.map(({ variant: v, qty }) => {
              const over = qty > v.available;
              return (
                <li key={v.id} className={`line ${over ? 'has-problem' : ''}`}>
                  <Img src={v.product.image} alt="" className="line-img" width={84} height={84} />
                  <div className="line-info">
                    <Link to={`/producto/${v.product.slug}?sku=${v.id}`} className="line-name">{v.product.name}</Link>
                    <span className="muted small">{[v.label, `SKU ${v.sku}`].filter(Boolean).join(' · ')}</span>
                    <span className="small">{fmtMoney(v.priceCents)} / {v.unitName} · {v.taxName}</span>
                    {over && (
                      <span className="field-error" role="alert">
                        {v.available > 0 ? `Solo quedan ${v.available} disponibles.` : 'Agotado.'}{' '}
                        <button type="button" className="link-btn" onClick={() => setQty(v.id, Math.floor(v.available / v.step) * v.step)}>{v.available > 0 ? 'Ajustar' : 'Quitar'}</button>
                      </span>
                    )}
                  </div>
                  <div className="line-end">
                    {over ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty(v.id, 0)}><Icon.trash size={15} /> Quitar</button> : <QtyControl variant={v} size="sm" />}
                    <strong>{fmtMoney(v.priceCents * qty)}</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <form className="panel checkout-form" onSubmit={submit} noValidate aria-labelledby="co-title">
          <h2 id="co-title" className="panel-title">Datos del pedido</h2>
          {!user && (
            <div className="alert alert-info"><Icon.info size={18} /><div>Para enviar el pedido y consultar su estado, <Link to="/cuenta?next=/carrito">inicie sesión o cree una cuenta</Link>. Su carrito se conserva.</div></div>
          )}
          <div className="field">
            <label htmlFor="co-name">Nombre completo</label>
            <input id="co-name" className="input" value={form.customerName} onChange={set('customerName')} autoComplete="name" aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? 'e-name' : undefined} />
            {errors.customerName && <p id="e-name" className="field-error">{errors.customerName}</p>}
          </div>
          <div className="field">
            <label htmlFor="co-phone">Teléfono / WhatsApp</label>
            <input id="co-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="6000-0000" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'e-phone' : undefined} />
            {errors.phone && <p id="e-phone" className="field-error">{errors.phone}</p>}
          </div>
          <fieldset className="field">
            <legend>Entrega</legend>
            <div className="choice-row">
              <label className={`choice ${form.fulfillment === 'pickup' ? 'is-on' : ''}`}>
                <input type="radio" name="fulfillment" value="pickup" checked={form.fulfillment === 'pickup'} onChange={set('fulfillment')} />
                <Icon.store size={20} /><span><strong>Retiro en tienda</strong><small>Le avisamos cuando esté listo.</small></span>
              </label>
              <label className={`choice ${form.fulfillment === 'delivery' ? 'is-on' : ''}`}>
                <input type="radio" name="fulfillment" value="delivery" checked={form.fulfillment === 'delivery'} onChange={set('fulfillment')} />
                <Icon.truck size={20} /><span><strong>Entrega</strong><small>{settings?.deliveryMessage}. {settings?.deliveryDisclaimer}</small></span>
              </label>
            </div>
          </fieldset>
          {form.fulfillment === 'delivery' && (
            <div className="field">
              <label htmlFor="co-address">Dirección de entrega</label>
              <textarea id="co-address" className="input" rows={3} value={form.address} onChange={set('address')} autoComplete="street-address" placeholder="Corregimiento, barriada, calle, casa y referencias" aria-invalid={!!errors.address} aria-describedby={errors.address ? 'e-address' : 'h-address'} />
              {errors.address ? <p id="e-address" className="field-error">{errors.address}</p> : <p id="h-address" className="hint">El personal confirmará cobertura y costo de entrega antes de procesar el pedido.</p>}
            </div>
          )}
          <div className="field">
            <label htmlFor="co-notes">Notas (opcional)</label>
            <textarea id="co-notes" className="input" rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} placeholder="Horario preferido, detalles de la obra…" />
          </div>

          <dl className="totals" aria-label="Resumen">
            <div><dt>Subtotal</dt><dd>{fmtMoney(t.subtotal)}</dd></div>
            {[...t.taxByRate.entries()].map(([k, v]) => { const [name] = k.split('|'); return <div key={k}><dt>{name}</dt><dd>{fmtMoney(v)}</dd></div>; })}
            <div><dt>{form.fulfillment === 'pickup' ? 'Retiro en tienda' : 'Entrega'}</dt><dd>{form.fulfillment === 'pickup' ? fmtMoney(0) : <span className="tbd">Por confirmar</span>}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{t.total == null ? <span className="tbd">Por confirmar</span> : fmtMoney(t.total)}</dd></div>
          </dl>
          {demoMode && <p className="tiny muted">Impuesto configurado por producto. {settings?.taxNote}</p>}
          <div className="alert alert-soft"><Icon.info size={18} /><div>{settings?.paymentInstructions} {form.fulfillment === 'delivery' && 'El total final se confirmará cuando el personal defina el costo de entrega.'}</div></div>

          <ErrorBox error={serverError?.error} details={serverError?.details} />
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting} aria-busy={submitting}>
            {submitting ? <><span className="spinner sm" aria-hidden="true" /> Enviando pedido…</> : user ? (form.fulfillment === 'delivery' ? 'Enviar solicitud de pedido' : 'Enviar pedido') : 'Iniciar sesión para enviar'}
          </button>
          <p className="tiny muted center">Al enviar, reservamos las existencias de todos los productos o rechazamos el pedido completo si alguno ya no está disponible. No se cobra nada en línea.</p>
        </form>
      </div>
    </div>
  );
}
