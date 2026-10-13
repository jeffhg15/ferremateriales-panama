import { Link } from 'react-router-dom';
import { useStore, defaultVariant } from '../store.jsx';
import { fmtMoney } from '../lib/format.js';
import { Icon, Img, QtyControl, StockBadge } from './ui.jsx';

export default function ProductCard({ product, style }) {
  const { favorites, toggleFavorite, t } = useStore();
  const v = defaultVariant(product);
  const fav = favorites.includes(product.id);
  const multi = product.variants.length > 1;
  const spec = [multi ? v.label : null, product.brand].filter(Boolean).join(' · ');
  return (
    <article className="pcard" style={style}>
      <button type="button" className={`fav-btn ${fav ? 'is-on' : ''}`} onClick={() => toggleFavorite(product.id)}
        aria-pressed={fav} aria-label={fav ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}>
        <Icon.heart size={18} filled={fav} />
      </button>
      <div className="pcard-badges"><StockBadge variant={v} /></div>
      <Link to={`/producto/${product.slug}`} className="pcard-link">
        <div className="pcard-img"><Img src={product.image} alt={product.name} /></div>
        <h3 className="pcard-name">{product.name}</h3>
      </Link>
      <p className="pcard-spec">{spec}</p>
      <p className="pcard-price">
        <strong>{fmtMoney(v.priceCents)}</strong><span>/ {v.unitName}</span>
      </p>
      {multi && <p className="pcard-opts">{product.variants.length} {t('options')} · <Link to={`/producto/${product.slug}`}>elegir</Link></p>}
      <div className="pcard-action"><QtyControl variant={{ ...v, product }} size="sm" label={`${product.name}${multi ? ' ' + v.label : ''}`} /></div>
    </article>
  );
}
