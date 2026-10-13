// Encabezado de dos filas, pie de página, cajón del carrito, aviso de demostración y notificaciones.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { fmtMoney } from '../lib/format.js';
import { IMAGES } from '../lib/images.js';
import { waLink } from '../lib/whatsapp.js';
import { Icon, Img, QtyControl } from './ui.jsx';

export function Logo({ compact = false }) {
  const { settings } = useStore();
  const src = settings?.logoUrl || IMAGES.logo;
  return (
    <Link to="/" className={`logo ${compact ? 'logo-compact' : ''}`} aria-label={`${settings?.businessName || 'Ferremateriales Panamá'} — inicio`}>
      <img src={src} alt="" width="210" height="56" />
    </Link>
  );
}

function SearchBox({ id = 'search', onDone }) {
  const { t } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') || '');
  useEffect(() => { if (loc.pathname !== '/tienda') return; setQ(new URLSearchParams(loc.search).get('q') || ''); }, [loc]);
  return (
    <form role="search" className="search" onSubmit={(e) => { e.preventDefault(); nav(`/tienda${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); onDone?.(); }}>
      <label htmlFor={id} className="sr-only">{t('search')}</label>
      <Icon.search size={17} />
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} autoComplete="off" />
    </form>
  );
}

function LangToggle() {
  const { lang, setLang, t } = useStore();
  return (
    <div className="lang" role="group" aria-label={t('lang')}>
      <Icon.globe size={16} />
      {['es', 'en'].map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? 'is-on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

export function Header() {
  const { t, cartCount, favorites, setDrawerOpen, user } = useStore();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); setMobileSearch(false); }, [loc.pathname, loc.search]);
  const isStaff = user && user.role !== 'customer';
  const links = [
    ['/tienda', t('navShop')], ['/categorias', t('navCategories')], ['/ofertas', t('navOffers')],
    ['/tienda?cat=materiales-construccion', t('navMaterials')], ['/nosotros', t('navAbout')],
  ];
  return (
    <header className="site-header">
      <div className="container header-row1">
        <div className="h-left">
          <button type="button" className="icon-btn only-mobile" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon.menu /></button>
          <span className="hide-sm"><LangToggle /></span>
          <div className="only-desktop"><SearchBox id="search-desktop" /></div>
        </div>
        <Logo />
        <div className="h-right">
          <button type="button" className="icon-btn only-mobile" aria-label={t('search')} aria-expanded={mobileSearch} onClick={() => setMobileSearch((s) => !s)}><Icon.search /></button>
          <Link to="/favoritos" className="h-action hide-sm" aria-label={`${t('favorites')} (${favorites.length})`}>
            <Icon.heart size={19} /><span className="only-desktop">{t('favorites')}</span>
            {favorites.length > 0 && <span className="count count-soft">{favorites.length}</span>}
          </Link>
          <button type="button" className="h-action" onClick={() => setDrawerOpen(true)} aria-label={`${t('cart')}: ${cartCount} productos`}>
            <Icon.cart size={19} /><span className="only-desktop">{t('cart')}</span>
            <span className="count" key={cartCount}>{cartCount}</span>
          </button>
          <Link to={isStaff ? '/personal' : user ? '/mis-pedidos' : '/cuenta'} className="h-action h-account" aria-label={user ? (isStaff ? 'Espacio del personal' : `${t('account')}: ${user.name}`) : t('login')}>
            <Icon.user size={18} /><span className="only-desktop">{user ? (isStaff ? 'Personal' : user.name.split(' ')[0]) : t('login')}</span>
          </Link>
        </div>
      </div>
      {mobileSearch && <div className="container mobile-search"><SearchBox id="search-mobile" /></div>}
      <div className="container header-row2">
        <nav aria-label="Principal" className={`nav-pill nav-main ${menu ? 'is-open' : ''}`}>
          {links.map(([to, label]) => {
            const [path, qs] = to.split('?');
            const cat = new URLSearchParams(loc.search).get('cat');
            const active = loc.pathname === path && (qs ? `?${qs}` === loc.search : !(path === '/tienda' && cat === 'materiales-construccion'));
            return <Link key={label} to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{label}</Link>;
          })}
        </nav>
        <nav aria-label="Ayuda" className={`nav-pill nav-util ${menu ? 'is-open' : ''}`}>
          <NavLink to="/entregas-y-politicas"><Icon.truck size={16} /> {t('navDelivery')}</NavLink>
          <NavLink to="/preguntas-frecuentes">{t('navFaq')}</NavLink>
          <NavLink to="/ayuda"><Icon.help size={16} /> {t('navHelp')}</NavLink>
          <NavLink to="/favoritos" className="only-mobile-flex"><Icon.heart size={16} /> {t('favorites')} ({favorites.length})</NavLink>
          <span className="only-mobile-flex menu-lang"><LangToggle /></span>
        </nav>
      </div>
    </header>
  );
}

export function DemoBar() {
  const { demoMode, t } = useStore();
  if (!demoMode) return null;
  return (
    <div className="demo-bar" role="note">
      <span className="demo-tag">DEMO</span> {t('demoNotice')} <Link to="/ayuda#demo">{t('demoMore')}</Link>
    </div>
  );
}

export function Footer() {
  const { t, settings } = useStore();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p>{t('footerAbout')}</p>
          <p className="footer-note"><Icon.truck size={16} /> {settings?.deliveryMessage}. <em>{settings?.deliveryDisclaimer}</em></p>
        </div>
        <nav aria-label={t('footerShop')}>
          <h3>{t('footerShop')}</h3>
          <Link to="/tienda">{t('navShop')}</Link><Link to="/categorias">{t('navCategories')}</Link>
          <Link to="/ofertas">{t('navOffers')}</Link><Link to="/favoritos">{t('favorites')}</Link><Link to="/carrito">{t('cart')}</Link>
        </nav>
        <nav aria-label={t('footerHelp')}>
          <h3>{t('footerHelp')}</h3>
          <Link to="/ayuda">{t('navHelp')}</Link><Link to="/preguntas-frecuentes">{t('navFaq')}</Link>
          <Link to="/entregas-y-politicas">{t('navDelivery')}</Link><Link to="/mis-pedidos">Mis pedidos</Link>
        </nav>
        <nav aria-label={t('footerCompany')}>
          <h3>{t('footerCompany')}</h3>
          <Link to="/nosotros">{t('navAbout')}</Link><Link to="/personal">Acceso del personal</Link>
        </nav>
        <div>
          <h3>{t('footerContact')}</h3>
          <ul className="contact-list">
            {(settings?.whatsappNumbers || []).map((n, i) => (
              <li key={n}><a href={waLink(settings, 'Hola, Ferremateriales. Tengo una consulta.', i)} target="_blank" rel="noopener noreferrer"><Icon.whatsapp size={17} /> WhatsApp {n}</a></li>
            ))}
            {settings?.instagram && <li><a href={`https://www.instagram.com/${settings.instagram}/`} target="_blank" rel="noopener noreferrer"><Icon.instagram size={17} /> @{settings.instagram}</a></li>}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {year} {settings?.businessName}. {t('rights')}</span>
        <Link to="/privacidad">{t('privacy')}</Link>
        <Link to="/terminos">{t('terms')}</Link>
      </div>
    </footer>
  );
}

/** Cajón del carrito accesible: foco atrapado, Escape para cerrar y retorno del foco. */
export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, cartLines, t } = useStore();
  const panel = useRef(null);
  const lastFocus = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    if (!drawerOpen) return;
    lastFocus.current = document.activeElement;
    document.body.classList.add('no-scroll');
    const id = requestAnimationFrame(() => panel.current?.querySelector('button, a')?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      if (e.key === 'Tab') {
        const f = panel.current.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      lastFocus.current?.focus?.();
    };
  }, [drawerOpen, setDrawerOpen]);
  if (!drawerOpen) return null;
  const subtotal = cartLines.reduce((s, l) => s + l.variant.priceCents * l.qty, 0);
  const go = (to) => { setDrawerOpen(false); nav(to); };
  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <aside ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <h2 id="drawer-title">{t('cart')} <span className="muted">({cartLines.length})</span></h2>
          <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Cerrar carrito"><Icon.close /></button>
        </div>
        {cartLines.length === 0 ? (
          <div className="drawer-empty">
            <Icon.cart size={40} />
            <p>Tu carrito está vacío.</p>
            <button type="button" className="btn btn-primary" onClick={() => go('/tienda')}>Explorar la tienda</button>
          </div>
        ) : (
          <>
            <ul className="drawer-lines">
              {cartLines.map(({ variant: v, qty }) => (
                <li key={v.id} className="line">
                  <Img src={v.product.image} alt="" className="line-img" width={72} height={72} />
                  <div className="line-info">
                    <Link to={`/producto/${v.product.slug}`} onClick={() => setDrawerOpen(false)} className="line-name">{v.product.name}</Link>
                    <span className="muted small">{[v.label, v.sku].filter(Boolean).join(' · ')}</span>
                    <span className="small"><strong>{fmtMoney(v.priceCents * qty)}</strong> <span className="muted">({fmtMoney(v.priceCents)} / {v.unitName})</span></span>
                  </div>
                  <QtyControl variant={v} size="sm" />
                </li>
              ))}
            </ul>
            <div className="drawer-foot">
              <div className="row-between"><span>Subtotal (sin impuestos)</span><strong>{fmtMoney(subtotal)}</strong></div>
              <p className="muted small">Impuestos y entrega se muestran en el resumen. Agregar al carrito no reserva existencias.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={() => go('/carrito')}>Ver carrito y enviar pedido</button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setDrawerOpen(false)}>Seguir comprando</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  return (
    <div className="toast-region" aria-live="polite" role="status">
      {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.kind === 'error' ? <Icon.alert size={18} /> : <Icon.check size={18} />}<span>{toast.message}</span></div>}
    </div>
  );
}

export function StoreLayout() {
  const loc = useLocation();
  useEffect(() => { if (!loc.hash) window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <DemoBar />
      <Header />
      <main id="main" tabIndex={-1}><Outlet /></main>
      <Footer />
      <CartDrawer />
      <Toast />
    </>
  );
}

export { Img };
