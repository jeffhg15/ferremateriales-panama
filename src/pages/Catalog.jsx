import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { norm } from '../lib/format.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, Icon, Reveal, Spinner, StaggerGrid } from '../components/ui.jsx';

const SORTS = {
  featured: 'Destacados',
  bestsellers: 'Más vendidos',
  'price-asc': 'Precio: menor a mayor',
  'price-desc': 'Precio: mayor a menor',
  'name-asc': 'Nombre: A–Z',
};

export function matchesQuery(p, category, q) {
  if (!q) return true;
  const hay = norm([p.name, p.brand, p.subcategory, category?.name, category?.nameEn, ...p.variants.flatMap((v) => [v.sku, v.label])].join(' '));
  return norm(q).split(' ').every((w) => hay.includes(w));
}

export default function Catalog({ offersOnly = false }) {
  const { catalog, index, lang } = useStore();
  const [sp, setSp] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const q = sp.get('q') || '';
  const catSlug = sp.get('cat') || '';
  const avail = sp.get('disp') === '1';
  const min = sp.get('min') || '';
  const max = sp.get('max') || '';
  const sort = SORTS[sp.get('sort')] ? sp.get('sort') : 'featured';
  const specFilters = [...sp.entries()].filter(([k]) => k.startsWith('f_')).map(([k, v]) => [k.slice(2), v]);
  const category = catalog?.categories.find((c) => c.slug === catSlug);

  const update = (patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v === '' || v == null || v === false) next.delete(k); else next.set(k, v); }
    setSp(next, { replace: true });
  };
  useEffect(() => { if (catSlug && catalog && !category) update({ cat: '' }); }, [catSlug, catalog]); // categoría inválida

  // Especificaciones disponibles en la categoría seleccionada (p. ej., Diámetro, Largo, Capacidad).
  const specOptions = useMemo(() => {
    if (!catalog || !category) return [];
    const map = new Map();
    for (const p of catalog.products.filter((x) => x.categoryId === category.id)) {
      for (const v of p.variants) for (const [k, val] of Object.entries(v.specs)) {
        if (!map.has(k)) map.set(k, new Set());
        map.get(k).add(val);
      }
    }
    return [...map.entries()].filter(([, s]) => s.size > 1).map(([k, s]) => [k, [...s].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))]);
  }, [catalog, category]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const minC = min !== '' ? Math.round(Number(min) * 100) : null;
    const maxC = max !== '' ? Math.round(Number(max) * 100) : null;
    let list = catalog.products.filter((p) => {
      if (offersOnly && !p.onOffer) return false;
      if (category && p.categoryId !== category.id) return false;
      if (!matchesQuery(p, index.categories.get(p.categoryId), q)) return false;
      return p.variants.some((v) => (!avail || v.available > 0)
        && (minC == null || v.priceCents >= minC) && (maxC == null || v.priceCents <= maxC)
        && specFilters.every(([k, val]) => v.specs[k] === val));
    });
    const price = (p) => Math.min(...p.variants.map((v) => v.priceCents));
    const sorters = {
      featured: (a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999) || (a.merchRank ?? 999) - (b.merchRank ?? 999) || a.id - b.id,
      bestsellers: (a, b) => b.soldQty - a.soldQty || (a.merchRank ?? 999) - (b.merchRank ?? 999),
      'price-asc': (a, b) => price(a) - price(b),
      'price-desc': (a, b) => price(b) - price(a),
      'name-asc': (a, b) => a.name.localeCompare(b.name, 'es'),
    };
    return list.sort(sorters[sort]);
  }, [catalog, index, q, category, avail, min, max, sort, offersOnly, sp]);

  if (!catalog) return <div className="container page"><Spinner label="Cargando catálogo…" /></div>;
  const title = offersOnly ? 'Ofertas' : q ? `Resultados para “${q}”` : category ? (lang === 'en' ? category.nameEn : category.name) : 'Tienda';
  const activeCount = [catSlug, avail, min, max, ...specFilters].filter(Boolean).length;

  return (
    <div className="container page">
      <Reveal immediate className="page-head">
        <nav aria-label="Ruta" className="crumbs"><Link to="/">Inicio</Link> / <span>{offersOnly ? 'Ofertas' : 'Tienda'}</span></nav>
        <h1>{title}</h1>
        {offersOnly && <p className="muted">Productos seleccionados por la tienda. No se muestran descuentos ni vigencias hasta que el negocio los confirme; consulte disponibilidad por WhatsApp.</p>}
        <p className="muted" aria-live="polite">{results.length} {results.length === 1 ? 'producto' : 'productos'}</p>
      </Reveal>
      <div className="catalog">
        <button type="button" className="btn btn-ghost only-mobile filter-toggle" aria-expanded={showFilters} aria-controls="filters" onClick={() => setShowFilters((s) => !s)}>
          <Icon.filter size={16} /> Filtros {activeCount > 0 && <span className="count">{activeCount}</span>}
        </button>
        <aside id="filters" className={`filters ${showFilters ? 'is-open' : ''}`} aria-label="Filtros">
          <div className="filter-group">
            <label htmlFor="f-q" className="flabel">Buscar</label>
            <input id="f-q" className="input" type="search" value={q} placeholder="Nombre, marca, SKU…" onChange={(e) => update({ q: e.target.value })} />
          </div>
          {!offersOnly && (
            <fieldset className="filter-group">
              <legend className="flabel">Categoría</legend>
              <label className="radio"><input type="radio" name="cat" checked={!catSlug} onChange={() => setSp(new URLSearchParams({ ...(q && { q }), ...(sort !== 'featured' && { sort }) }), { replace: true })} /> Todas</label>
              {catalog.categories.map((c) => (
                <label key={c.id} className="radio">
                  <input type="radio" name="cat" checked={catSlug === c.slug} onChange={() => { const n = new URLSearchParams(sp); [...n.keys()].filter((k) => k.startsWith('f_')).forEach((k) => n.delete(k)); n.set('cat', c.slug); setSp(n, { replace: true }); }} />
                  {lang === 'en' ? c.nameEn : c.name} <span className="muted">({c.productCount})</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="filter-group">
            <span className="flabel">Disponibilidad</span>
            <label className="check"><input type="checkbox" checked={avail} onChange={(e) => update({ disp: e.target.checked ? '1' : '' })} /> Solo disponibles</label>
          </div>
          <fieldset className="filter-group">
            <legend className="flabel">Precio (B/.)</legend>
            <div className="price-range">
              <label><span className="sr-only">Precio mínimo</span><input className="input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Mín." value={min} onChange={(e) => update({ min: e.target.value })} /></label>
              <span aria-hidden="true">–</span>
              <label><span className="sr-only">Precio máximo</span><input className="input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Máx." value={max} onChange={(e) => update({ max: e.target.value })} /></label>
            </div>
          </fieldset>
          {specOptions.map(([k, vals]) => (
            <div className="filter-group" key={k}>
              <label className="flabel" htmlFor={`spec-${k}`}>{k}</label>
              <select id={`spec-${k}`} className="input" value={sp.get(`f_${k}`) || ''} onChange={(e) => update({ [`f_${k}`]: e.target.value })}>
                <option value="">Todos</option>
                {vals.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
          {!category && !offersOnly && <p className="tiny muted">Seleccione una categoría para filtrar por especificaciones (diámetro, largo, capacidad…).</p>}
          {activeCount > 0 && <button type="button" className="link-btn" onClick={() => setSp(new URLSearchParams(q ? { q } : {}), { replace: true })}>Limpiar filtros</button>}
        </aside>
        <div className="catalog-main">
          <div className="catalog-bar">
            <label htmlFor="sort" className="muted small">Ordenar por</label>
            <select id="sort" className="input input-pill" value={sort} onChange={(e) => update({ sort: e.target.value === 'featured' ? '' : e.target.value })}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {results.length === 0 ? (
            <Empty title="No encontramos productos" action={<button className="btn btn-primary" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Ver todo el catálogo</button>}>
              Pruebe con otra palabra (la búsqueda ignora acentos y mayúsculas) o quite algunos filtros.
            </Empty>
          ) : (
            <StaggerGrid className="product-grid grid-4" key={`${catSlug}|${sort}|${avail}`} base={0} step={50}>
              {results.map((p) => <ProductCard key={p.id} product={p} />)}
            </StaggerGrid>
          )}
        </div>
      </div>
    </div>
  );
}
