import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore, defaultVariant } from '../store.jsx';
import { fmtMoney } from '../lib/format.js';
import { waLink } from '../lib/whatsapp.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, Icon, Img, QtyControl, Reveal, SectionHead, Spinner, StaggerGrid, StockBadge } from '../components/ui.jsx';

export default function Product() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const { catalog, index, favorites, toggleFavorite, trackView, settings, setQty, qtyOf, setDrawerOpen } = useStore();
  const p = index.bySlug.get(slug);
  const [variantId, setVariantId] = useState(null);
  const [qtyInput, setQtyInput] = useState('');
  const [qtyError, setQtyError] = useState('');

  useEffect(() => {
    if (!p) return;
    trackView(p.categoryId);
    const fromUrl = Number(sp.get('sku'));
    setVariantId(p.variants.some((v) => v.id === fromUrl) ? fromUrl : defaultVariant(p).id);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = p?.variants.find((x) => x.id === variantId) || (p && defaultVariant(p));
  useEffect(() => { if (v) { setQtyInput(String(qtyOf(v.id) || v.step)); setQtyError(''); } }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => (p && catalog ? catalog.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 5) : []), [p, catalog]);

  if (!catalog) return <div className="container page"><Spinner /></div>;
  if (!p) return <div className="container page"><Empty title="Producto no encontrado" action={<Link className="btn btn-primary" to="/tienda">Ir a la tienda</Link>}>Es posible que haya sido retirado del catálogo.</Empty></div>;

  const cat = index.categories.get(p.categoryId);
  const fav = favorites.includes(p.id);
  const inCart = qtyOf(v.id);
  const pick = (id) => { setVariantId(id); const n = new URLSearchParams(sp); n.set('sku', id); setSp(n, { replace: true }); };

  const applyQty = (e) => {
    e.preventDefault();
    const n = Number(qtyInput);
    if (qtyInput.trim() === '' || !Number.isFinite(n)) return setQtyError('Ingrese una cantidad.');
    if (!Number.isInteger(n) || n <= 0) return setQtyError('La cantidad debe ser un número entero mayor que cero.');
    if (n % v.step !== 0) return setQtyError(`Este producto se vende en múltiplos de ${v.step}.`);
    if (n > v.available) return setQtyError(v.available > 0 ? `Solo hay ${v.available} ${v.unitPlural} disponibles.` : 'Agotado.');
    setQtyError('');
    setQty(v.id, n);
    setDrawerOpen(true);
  };

  const specs = Object.entries(v.specs);
  return (
    <div className="container page">
      <nav aria-label="Ruta" className="crumbs"><Link to="/">Inicio</Link> / <Link to={`/tienda?cat=${cat?.slug}`}>{cat?.name}</Link> / <span>{p.name}</span></nav>
      <div className="pdp">
        <Reveal immediate className="pdp-media">
          <Img src={p.image} alt={p.name} eager width={560} height={560} />
          <button type="button" className={`fav-btn fav-lg ${fav ? 'is-on' : ''}`} onClick={() => toggleFavorite(p.id)} aria-pressed={fav} aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
            <Icon.heart size={22} filled={fav} />
          </button>
        </Reveal>
        <Reveal immediate delay={80} className="pdp-info">
          <p className="eyebrow">{cat?.name}{p.subcategory ? ` · ${p.subcategory}` : ''}</p>
          <h1>{p.name}</h1>
          <p className="muted">{p.brand}</p>
          <p className="pdp-price"><strong>{fmtMoney(v.priceCents)}</strong> <span>/ {v.unitName}</span></p>
          <p className="tiny muted">{v.taxRateBp > 0 ? `+ ${v.taxName}` : v.taxName} · Precio de demostración · SKU {v.sku}</p>

          {p.variants.length > 1 && (
            <fieldset className="variants">
              <legend>{p.variantLabel || 'Opción'}: <strong>{v.label}</strong></legend>
              <div className="variant-list">
                {p.variants.map((x) => (
                  <label key={x.id} className={`variant ${x.id === v.id ? 'is-on' : ''} ${x.available <= 0 ? 'is-out' : ''}`}>
                    <input type="radio" name="variant" checked={x.id === v.id} onChange={() => pick(x.id)} />
                    <span>{x.label}</span>
                    <small>{x.available > 0 ? fmtMoney(x.priceCents) : 'Agotado'}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="pdp-stock">
            {v.available > 0
              ? <span className="status status-ok"><Icon.check size={16} /> Disponible: {v.available} {v.available === 1 ? v.unitName : v.unitPlural}</span>
              : <span className="status status-out"><Icon.close size={16} /> Agotado — no se puede pedir esta opción</span>}
            <StockBadge variant={v} />
            {v.step > 1 && <span className="tiny muted">Se vende en múltiplos de {v.step}.</span>}
          </div>

          <form className="pdp-buy" onSubmit={applyQty} noValidate>
            <label htmlFor="qty" className="flabel">Cantidad ({v.unitPlural})</label>
            <div className="pdp-buy-row">
              <input id="qty" className="input qty-input" type="number" inputMode="numeric" min={v.step} step={v.step} max={v.available}
                value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} disabled={v.available <= 0}
                aria-invalid={!!qtyError} aria-describedby={qtyError ? 'qty-err' : undefined} />
              <button type="submit" className="btn btn-primary" disabled={v.available <= 0}>
                <Icon.cart size={18} /> {inCart ? 'Actualizar carrito' : 'Agregar al carrito'}
              </button>
            </div>
            {qtyError && <p id="qty-err" className="field-error" role="alert">{qtyError}</p>}
            {inCart > 0 && <div className="pdp-incart"><span>En tu carrito:</span> <QtyControl variant={{ ...v, product: p }} size="sm" /></div>}
          </form>

          <a className="btn btn-ghost" href={waLink(settings, `Hola, Ferremateriales. Quiero consultar por: ${p.name}${v.label ? ' — ' + v.label : ''} (SKU ${v.sku}).`)} target="_blank" rel="noopener noreferrer">
            <Icon.whatsapp size={18} /> Consultar por WhatsApp
          </a>

          <div className="pdp-desc">
            <h2>Descripción</h2>
            <p>{p.description}</p>
            {specs.length > 0 && (
              <>
                <h2>Especificaciones</h2>
                <dl className="spec-table">
                  {specs.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                  <div><dt>Unidad de venta</dt><dd>{v.unitName}</dd></div>
                  <div><dt>SKU</dt><dd>{v.sku}</dd></div>
                </dl>
              </>
            )}
          </div>
        </Reveal>
      </div>
      {related.length > 0 && (
        <section className="section" aria-labelledby="rel-title">
          <SectionHead id="rel-title" title="Productos relacionados" to={`/tienda?cat=${cat?.slug}`} />
          <StaggerGrid className="product-grid">{related.map((x) => <ProductCard key={x.id} product={x} />)}</StaggerGrid>
        </section>
      )}
    </div>
  );
}
