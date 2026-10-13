// Estado compartido de la tienda: configuración, sesión, catálogo, carrito y favoritos.
// Un único origen de datos mantiene sincronizadas las cantidades en todas las secciones.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api.js';
import { DICT } from './lib/i18n.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento no disponible */ } };

export function StoreProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [cart, setCart] = useState(() => read('fm_cart', {}));
  const [favorites, setFavorites] = useState(() => read('fm_favs', []));
  const [viewed, setViewed] = useState(() => read('fm_viewed', {}));
  const [lang, setLang] = useState(() => read('fm_lang', 'es'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  useEffect(() => write('fm_cart', cart), [cart]);
  useEffect(() => write('fm_favs', favorites), [favorites]);
  useEffect(() => write('fm_viewed', viewed), [viewed]);
  useEffect(() => { write('fm_lang', lang); document.documentElement.lang = lang; }, [lang]);

  const loadConfig = useCallback(() => api('/config').then(setConfig), []);
  const loadCatalog = useCallback(() => api('/catalog').then(setCatalog), []);
  const reload = useCallback(() => {
    setLoadError(null);
    return Promise.all([loadConfig(), loadCatalog()]).catch((e) => setLoadError(e.message));
  }, [loadConfig, loadCatalog]);
  useEffect(() => { reload(); }, [reload]);

  const index = useMemo(() => {
    const variants = new Map();
    const products = new Map();
    const bySlug = new Map();
    for (const p of catalog?.products || []) {
      products.set(p.id, p);
      bySlug.set(p.slug, p);
      for (const v of p.variants) variants.set(v.id, { ...v, product: p });
    }
    const categories = new Map((catalog?.categories || []).map((c) => [c.id, c]));
    return { variants, products, bySlug, categories };
  }, [catalog]);

  const notify = useCallback((message, kind = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message, kind, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /** Fija la cantidad de un SKU en el carrito, validando incrementos y existencias. No reserva stock. */
  const setQty = useCallback((variantId, qty) => {
    const v = index.variants.get(variantId);
    if (!v) return;
    if (!Number.isInteger(qty) || qty < 0) { notify('Cantidad inválida.', 'error'); return; }
    if (qty > 0 && qty % v.step !== 0) { notify(`${v.product.name} se vende en múltiplos de ${v.step}.`, 'error'); return; }
    if (qty > v.available) {
      notify(v.available > 0 ? `Solo hay ${v.available} ${v.available === 1 ? v.unitName : v.unitPlural} disponibles de ${v.product.name}.` : `${v.product.name} está agotado.`, 'error');
      return;
    }
    setCart((c) => {
      const next = { ...c };
      if (qty === 0) delete next[variantId]; else next[variantId] = qty;
      return next;
    });
  }, [index, notify]);

  const qtyOf = useCallback((variantId) => cart[variantId] || 0, [cart]);
  const inc = useCallback((variantId) => { const v = index.variants.get(variantId); if (v) setQty(variantId, qtyOf(variantId) + v.step); }, [index, qtyOf, setQty]);
  const dec = useCallback((variantId) => { const v = index.variants.get(variantId); if (v) setQty(variantId, Math.max(0, qtyOf(variantId) - v.step)); }, [index, qtyOf, setQty]);
  const clearCart = useCallback(() => setCart({}), []);

  const cartLines = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ variant: index.variants.get(Number(id)), qty, variantId: Number(id) }))
    .filter((l) => l.variant), [cart, index]);
  const cartCount = cartLines.length;

  const toggleFavorite = useCallback((productId) => {
    setFavorites((f) => (f.includes(productId) ? f.filter((x) => x !== productId) : [...f, productId]));
  }, []);
  const trackView = useCallback((categoryId) => setViewed((v) => ({ ...v, [categoryId]: (v[categoryId] || 0) + 1 })), []);

  const setUser = useCallback((user) => setConfig((c) => ({ ...c, user })), []);
  const t = useCallback((k) => DICT[lang]?.[k] ?? DICT.es[k] ?? k, [lang]);

  const value = {
    config, settings: config?.settings, user: config?.user, demoMode: !!config?.demoMode, setUser, reload, loadCatalog, loadConfig,
    catalog, index, loadError,
    cart, cartLines, cartCount, setQty, qtyOf, inc, dec, clearCart,
    favorites, toggleFavorite, viewed, trackView,
    drawerOpen, setDrawerOpen, toast, notify, lang, setLang, t,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Variante que representa al producto en tarjetas: la primera disponible, o la primera. */
export const defaultVariant = (p) => p.variants.find((v) => v.available > 0) || p.variants[0];
