// Registro central de imágenes de la interfaz. Reemplace las rutas por fotografías propias
// (idealmente PNG/WebP con fondo transparente) sin tocar los componentes.
// Las imágenes de cada producto se guardan en la base de datos (campo image) y se cambian
// desde Personal → Productos.
const p = (n) => `/img/products/${n}.svg`;

export const IMAGES = {
  logo: '/img/logo-wordmark.svg',
  heroWorker: '/img/hero-worker.svg',
  heroFeatured: p('cemento-gris'),
  deliveryBanner: [p('cemento-gris'), p('cemento-gris'), p('varilla'), p('zinc'), p('tubo-pvc'), p('bloque-6'), p('arena-pila')],
  deliveryDecor: p('codo-pvc'),
  projectBanner: [p('puerta-bano-aluminio'), p('ventana-corrediza'), p('pintura-latex'), p('pintura-cubeta'), p('taladro'), p('rodillo'), p('llave-fregadero')],
  promoOffers: p('caja-herramientas'),
  promoDelivery: p('carretilla'),
  promoHome: p('pintura-latex'),
};
