import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, defaultVariant } from '../store.jsx';
import { fmtMoney } from '../lib/format.js';
import { IMAGES } from '../lib/images.js';
import { waLink } from '../lib/whatsapp.js';
import ProductCard from '../components/ProductCard.jsx';
import { Icon, Img, PillLink, Reveal, SectionHead, Spinner, StaggerGrid } from '../components/ui.jsx';

const byRank = (key) => (a, b) => (a[key] ?? 999) - (b[key] ?? 999) || a.id - b.id;

export default function Home() {
  const { catalog, t, lang, settings, viewed, cart, loadError, reload } = useStore();
  const [weekCat, setWeekCat] = useState('all');

  const data = useMemo(() => {
    if (!catalog) return null;
    const ps = catalog.products;
    const featured = [...ps].filter((p) => p.featuredRank != null).sort(byRank('featuredRank'));
    const fill = (list, n) => [...list, ...[...ps].sort(byRank('merchRank')).filter((p) => !list.includes(p))].slice(0, n);
    const matCat = catalog.categories.find((c) => c.slug === 'materiales-construccion')?.id;
    const best = ps.filter((p) => p.categoryId === matCat).sort((a, b) => b.soldQty - a.soldQty || (a.merchRank ?? 999) - (b.merchRank ?? 999)).slice(0, 5);
    const viewedCats = Object.entries(viewed).sort((a, b) => b[1] - a[1]).map(([id]) => Number(id));
    const inCart = new Set(Object.keys(cart).map((id) => catalog.products.find((p) => p.variants.some((v) => v.id === Number(id)))?.id));
    let rec = [];
    for (const cid of viewedCats) rec.push(...ps.filter((p) => p.categoryId === cid && !inCart.has(p.id)).sort(byRank('merchRank')));
    rec = [...new Set(rec)];
    const recBasis = rec.length ? 'viewed' : 'default';
    // Respaldo determinista: uno por categoría en orden de la tienda.
    const det = catalog.categories.map((c) => ps.filter((p) => p.categoryId === c.id).sort(byRank('merchRank'))[1] || null).filter(Boolean);
    return {
      featured: fill(featured, 10), best, rec: [...rec, ...det.filter((p) => !rec.includes(p) && !inCart.has(p.id)), ...ps].filter((p, i, a) => a.indexOf(p) === i).slice(0, 5),
      recBasis, heroProduct: ps.find((p) => p.slug === 'cemento-gris-uso-general') || featured[0],
    };
  }, [catalog, viewed, cart]);

  const weekly = useMemo(() => {
    if (!catalog) return [];
    const list = catalog.products.filter((p) => weekCat === 'all' || p.categoryId === weekCat);
    return [...list].sort((a, b) => b.soldQtyWeek - a.soldQtyWeek || (a.merchRank ?? 999) - (b.merchRank ?? 999) || a.id - b.id).slice(0, 5);
  }, [catalog, weekCat]);

  const catName = (c) => (lang === 'en' ? c.nameEn : c.name);

  return (
    <div className="home">
      {/* B. Hero */}
      <section className="container hero-wrap" aria-labelledby="hero-title">
        <div className="hero">
          <h1 id="hero-title" className="sr-only">{settings?.businessName || 'Ferremateriales Panamá'}: {t('heroText')}</h1>
          <div className="hero-word" aria-hidden="true"><span>Ferremateriales</span></div>
          <Icon.spark className="hero-spark s1" size={22} />
          <Icon.spark className="hero-spark s2" size={16} />
          <Icon.spark className="hero-spark s3" size={20} />
          <div className="hero-figure">
            <img src={IMAGES.heroWorker} alt="Trabajador de construcción con casco, saco de cemento y cubeta de pintura" width="520" height="640" fetchpriority="high" />
          </div>
          <Link to="/entregas-y-politicas" className="hero-badge"><Icon.truck size={15} /> {t('deliveryBadge')}</Link>
          <div className="hero-copy">
            <p className="hero-kicker">Panamá · @{settings?.instagram}</p>
            <p className="hero-text">{t('heroText')}</p>
            <PillLink to="/tienda" variant="dark">{t('shopNow')}</PillLink>
          </div>
          {data?.heroProduct && (() => {
            const p = data.heroProduct; const v = defaultVariant(p);
            return (
              <Link to={`/producto/${p.slug}`} className="hero-product">
                <span className="hero-product-tag">{t('featuredCard')}</span>
                <Img src={p.image} alt={p.name} eager width={180} height={180} />
                <span className="hero-product-name">{p.name}</span>
                <span className="hero-product-price">{fmtMoney(v.priceCents)} <small>/ {v.unitName}</small></span>
              </Link>
            );
          })()}
        </div>
      </section>

      {loadError && (
        <div className="container"><div className="alert alert-error" role="alert"><Icon.alert size={18} /><div><strong>No se pudo cargar el catálogo.</strong> {loadError} <button className="link-btn" onClick={reload}>Reintentar</button></div></div></div>
      )}
      {!data && !loadError && <div className="container"><Spinner label="Cargando catálogo…" /></div>}

      {data && (
        <>
          {/* C. Categorías populares */}
          <section className="container section" aria-labelledby="cats-title">
            <SectionHead id="cats-title" title={t('popularCategories')} to="/categorias" />
            <StaggerGrid className="cat-grid">
              {catalog.categories.map((c) => (
                <Link key={c.id} to={`/tienda?cat=${c.slug}`} className={`cat-tile tint-${c.tint}`}>
                  <span className="cat-img"><Img src={c.image} alt="" width={160} height={160} /></span>
                  <span className="cat-name">{catName(c)}</span>
                  <span className="cat-count">{c.productCount} {c.productCount === 1 ? t('product') : t('products')}</span>
                </Link>
              ))}
            </StaggerGrid>
          </section>

          {/* D. Productos destacados */}
          <section className="container section" aria-labelledby="feat-title">
            <SectionHead id="feat-title" title={t('featuredProducts')} to="/tienda?sort=featured" />
            <StaggerGrid className="product-grid">
              {data.featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </StaggerGrid>
          </section>

          {/* E. Banner de entrega */}
          <section className="container section">
            <Reveal className="banner banner-delivery">
              <div className="banner-art art-delivery" aria-hidden="true">
                {IMAGES.deliveryBanner.map((src, i) => <img key={i} src={src} alt="" className={`a${i}`} width="400" height="400" loading="lazy" />)}
              </div>
              <div className="banner-copy">
                <h2>{t('bannerDeliveryTitle')}</h2>
                <p>{t('bannerDeliveryText')}</p>
                <PillLink to="/tienda?cat=materiales-construccion">{t('bannerDeliveryCta')}</PillLink>
              </div>
              <img src={IMAGES.deliveryDecor} alt="" aria-hidden="true" className="banner-decor" width="400" height="400" loading="lazy" />
            </Reveal>
          </section>

          {/* F. Tres tarjetas promocionales */}
          <section className="container section-tight" aria-label="Promociones">
            <StaggerGrid className="promo-grid" base={80} step={140}>
              <PromoCard tone="cyan" title={t('promo1Title')} text={t('promo1Text')} img={IMAGES.promoOffers} to="/ofertas" />
              <PromoCard tone="red" title={t('promo2Title')} text={t('promo2Text')} img={IMAGES.promoDelivery} to="/entregas-y-politicas" />
              <PromoCard tone="yellow" title={t('promo3Title')} text={t('promo3Text')} img={IMAGES.promoHome} to="/tienda?cat=pinturas" />
            </StaggerGrid>
          </section>

          {/* G. Más vendidos de la semana */}
          <section className="container section" aria-labelledby="week-title">
            <SectionHead id="week-title" title={t('weeklyBest')} to={weekCat === 'all' ? '/tienda?sort=bestsellers' : `/tienda?sort=bestsellers&cat=${catalog.categories.find((c) => c.id === weekCat)?.slug}`} sub={t('weeklyBasis')} />
            <Reveal className="chips" role="group" aria-label="Filtrar por categoría">
              <button type="button" className={`chip ${weekCat === 'all' ? 'is-on' : ''}`} aria-pressed={weekCat === 'all'} onClick={() => setWeekCat('all')}>{t('allCats')}</button>
              {catalog.categories.map((c) => (
                <button key={c.id} type="button" className={`chip ${weekCat === c.id ? 'is-on' : ''}`} aria-pressed={weekCat === c.id} onClick={() => setWeekCat(c.id)}>{catName(c)}</button>
              ))}
            </Reveal>
            <StaggerGrid className="product-grid swap" key={weekCat} base={40} step={60}>
              {weekly.map((p) => <ProductCard key={p.id} product={p} />)}
            </StaggerGrid>
          </section>

          {/* H. Materiales más vendidos */}
          <section className="container section" aria-labelledby="best-title">
            <SectionHead id="best-title" title={t('bestMaterials')} to="/tienda?sort=bestsellers&cat=materiales-construccion" sub={t('bestBasis')} />
            <StaggerGrid className="product-grid">
              {data.best.map((p) => <ProductCard key={p.id} product={p} />)}
            </StaggerGrid>
          </section>

          {/* I. Segundo banner */}
          <section className="container section">
            <Reveal className="banner banner-project">
              <div className="banner-copy">
                <h2>{t('projectTitle')}</h2>
                <p>{t('projectText')}</p>
                <div className="banner-ctas">
                  <Link to="/tienda" className="store-badge"><Icon.grid size={20} /><span><small>Catálogo</small>{t('exploreMaterials')}</span></Link>
                  <a href={waLink(settings, 'Hola, Ferremateriales. Quiero consultar materiales para un proyecto.')} target="_blank" rel="noopener noreferrer" className="store-badge"><Icon.whatsapp size={20} /><span><small>{settings?.whatsappNumbers?.[0]}</small>{t('askWhatsapp')}</span></a>
                </div>
                <p className="tiny muted">Consultar por WhatsApp no crea pedidos ni reserva existencias.</p>
              </div>
              <div className="banner-art art-project" aria-hidden="true">
                {IMAGES.projectBanner.map((src, i) => <img key={i} src={src} alt="" className={`b${i}`} width="400" height="400" loading="lazy" />)}
              </div>
            </Reveal>
          </section>

          {/* J. Recomendados para ti */}
          <section className="container section" aria-labelledby="rec-title">
            <SectionHead id="rec-title" title={t('recommended')} to="/tienda" sub={data.recBasis === 'viewed' ? t('recommendedBasisViewed') : t('recommendedBasisDefault')} />
            <StaggerGrid className="product-grid">
              {data.rec.map((p) => <ProductCard key={p.id} product={p} />)}
            </StaggerGrid>
          </section>
        </>
      )}
    </div>
  );
}

function PromoCard({ tone, title, text, img, to, style }) {
  return (
    <Link to={to} className={`promo promo-${tone}`} style={style}>
      <h3>{title}</h3>
      <span className="promo-blob" aria-hidden="true"><img src={img} alt="" width="400" height="400" loading="lazy" /></span>
      <p>{text}</p>
      <span className="promo-arrow" aria-hidden="true"><Icon.arrow size={16} /></span>
    </Link>
  );
}
