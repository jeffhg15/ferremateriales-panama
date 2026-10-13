// Componentes base: iconos, animación de entrada, imagen con respaldo, cantidad, encabezados de sección.
import { Children, cloneElement, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';

const I = ({ d, size = 20, fill = 'none', sw = 1.8, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);
export const Icon = {
  search: (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>,
  heart: ({ filled, ...p }) => <I fill={filled ? 'currentColor' : 'none'} d="M12 20s-7-4.4-9.3-8.6C1 8.2 3 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.5 1-1.4 2.4-2.5 4.4-2.5 3.6 0 5.6 3.7 3.9 6.9C19 15.6 12 20 12 20Z" {...p} />,
  cart: (p) => <I {...p}><path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6" /><circle cx="10" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></I>,
  user: (p) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></I>,
  arrow: (p) => <I d="M5 12h14m-6-6 6 6-6 6" {...p} />,
  arrowUpRight: (p) => <I d="M7 17 17 7M8 7h9v9" {...p} />,
  chevronDown: (p) => <I d="m6 9 6 6 6-6" {...p} />,
  chevronLeft: (p) => <I d="m15 18-6-6 6-6" {...p} />,
  plus: (p) => <I d="M12 5v14M5 12h14" {...p} />,
  minus: (p) => <I d="M5 12h14" {...p} />,
  close: (p) => <I d="M6 6l12 12M18 6 6 18" {...p} />,
  trash: (p) => <I d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" {...p} />,
  truck: (p) => <I {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></I>,
  store: (p) => <I {...p}><path d="M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" /><path d="M10 20v-5h4v5" /></I>,
  whatsapp: (p) => <I {...p}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c.3 2 1.8 3.8 4 4.6l1.2-1.2 1.8.9c-.2 1-1 1.7-2 1.7-3.4-.3-6-3-6.3-6.3 0-1 .7-1.8 1.7-2l.9 1.8z" /></I>,
  instagram: (p) => <I {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".8" fill="currentColor" /></I>,
  globe: (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></I>,
  info: (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></I>,
  help: (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17v.5" /></I>,
  check: (p) => <I d="m5 12 4.5 4.5L19 7" {...p} />,
  alert: (p) => <I {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.5" /></I>,
  filter: (p) => <I d="M4 5h16l-6 7v6l-4 2v-8z" {...p} />,
  box: (p) => <I {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></I>,
  layers: (p) => <I {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></I>,
  clipboard: (p) => <I {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></I>,
  users: (p) => <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.8.7 3 2.6 3.5 5.4" /></I>,
  history: (p) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></I>,
  settings: (p) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></I>,
  grid: (p) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></I>,
  menu: (p) => <I d="M4 7h16M4 12h16M4 17h16" {...p} />,
  download: (p) => <I d="M12 4v11m-5-5 5 5 5-5M5 20h14" {...p} />,
  logout: (p) => <I d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" {...p} />,
  spark: (p) => <I fill="currentColor" sw={0} d="M12 2c.6 5 2.6 8 8 10-5.4 2-7.4 5-8 10-.6-5-2.6-8-8-10 5.4-2 7.4-5 8-10Z" {...p} />,
};

/**
 * Entrada al hacer scroll: opacidad 0→1, desenfoque 8px→0, translateY 20px→0, una sola vez por visita.
 * Sin IntersectionObserver o con movimiento reducido, el contenido se muestra de inmediato.
 */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, immediate = false, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(immediate);
  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

/** Cuadrícula cuyos hijos aparecen escalonados de izquierda a derecha (~90 ms entre tarjetas). */
export function StaggerGrid({ className = '', base = 120, step = 90, children, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  let i = 0;
  return (
    <Tag ref={ref} className={`stagger ${shown ? 'is-in' : ''} ${className}`} {...rest}>
      {Children.map(children, (child) => child && cloneElement(child, {
        style: { ...(child.props.style || {}), '--d': `${base + step * Math.min(i++, 9)}ms` },
      }))}
    </Tag>
  );
}

/** Imagen con dimensiones reservadas y respaldo limpio si falla la carga (sin icono roto). */
export function Img({ src, alt, className = '', width = 400, height = 400, eager = false, fallbackLabel }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) {
    const initials = (fallbackLabel || alt || 'FM').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className={`img-fallback ${className}`} role="img" aria-label={alt}>{initials}</span>;
  }
  return <img src={src} alt={alt} className={className} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}

export function SectionHead({ title, to, cta, sub, id }) {
  const { t } = useStore();
  return (
    <Reveal className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {to && <PillLink to={to}>{cta || t('seeAll')}</PillLink>}
    </Reveal>
  );
}

export function PillLink({ to, children, variant = 'dark', ...rest }) {
  return (
    <Link to={to} className={`pill-link pill-${variant}`} {...rest}>
      <span>{children}</span>
      <span className="pill-dot" aria-hidden="true"><Icon.arrow size={14} /></span>
    </Link>
  );
}

export function QtyControl({ variant, size = 'md', label }) {
  const { qtyOf, inc, dec, t } = useStore();
  const qty = qtyOf(variant.id);
  const out = variant.available <= 0;
  const name = label || variant.product?.name || '';
  if (!qty) {
    return (
      <button type="button" className={`add-btn add-${size}`} onClick={() => inc(variant.id)} disabled={out} aria-label={`${out ? t('outOfStock') : t('add')}: ${name}`}>
        {out ? t('outOfStock') : <><Icon.plus size={15} /> {t('add')}</>}
      </button>
    );
  }
  const atMax = qty + variant.step > variant.available;
  return (
    <div className={`qty-pill qty-${size}`} role="group" aria-label={`Cantidad de ${name}`}>
      <button type="button" onClick={() => dec(variant.id)} aria-label={qty === variant.step ? `${t('remove')} ${name}` : t('decrease')}><Icon.minus size={14} /></button>
      <output aria-live="polite" key={qty} className="qty-num">{qty}</output>
      <button type="button" onClick={() => inc(variant.id)} aria-label={t('increase')} aria-disabled={atMax} className={atMax ? 'is-max' : ''}><Icon.plus size={14} /></button>
    </div>
  );
}

export function StockBadge({ variant }) {
  if (!variant) return null;
  const a = variant.available;
  if (a <= 0) return <span className="badge badge-out"><Icon.close size={12} sw={2.4} /> Agotado</span>;
  if (a <= variant.reorderThreshold) return <span className="badge badge-low"><Icon.alert size={12} sw={2.2} /> Quedan {a}</span>;
  return null;
}

export function Spinner({ label = 'Cargando…' }) {
  return <div className="spinner-wrap" role="status"><span className="spinner" aria-hidden="true" /><span>{label}</span></div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true"><Icon.box size={38} /></div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, details }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <Icon.alert size={18} />
      <div>
        <strong>{error}</strong>
        {details?.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
      </div>
    </div>
  );
}
