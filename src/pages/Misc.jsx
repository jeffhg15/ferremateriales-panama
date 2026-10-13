import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { waLink } from '../lib/whatsapp.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, Icon, Img, Reveal, Spinner, StaggerGrid } from '../components/ui.jsx';

export function Categories() {
  const { catalog, lang, t } = useStore();
  if (!catalog) return <div className="container page"><Spinner /></div>;
  return (
    <div className="container page">
      <Reveal immediate className="page-head"><h1>{t('navCategories')}</h1><p className="muted">Explora el catálogo por departamento.</p></Reveal>
      <StaggerGrid className="cat-grid cat-grid-lg">
        {catalog.categories.map((c) => {
          const subs = [...new Set(catalog.products.filter((p) => p.categoryId === c.id).map((p) => p.subcategory).filter(Boolean))];
          return (
            <Link key={c.id} to={`/tienda?cat=${c.slug}`} className={`cat-tile tint-${c.tint}`}>
              <span className="cat-img"><Img src={c.image} alt="" width={160} height={160} /></span>
              <span className="cat-name">{lang === 'en' ? c.nameEn : c.name}</span>
              <span className="cat-count">{c.productCount} {c.productCount === 1 ? t('product') : t('products')}</span>
              {subs.length > 0 && <span className="cat-subs">{subs.join(' · ')}</span>}
            </Link>
          );
        })}
      </StaggerGrid>
    </div>
  );
}

export function Favorites() {
  const { catalog, favorites, index } = useStore();
  if (!catalog) return <div className="container page"><Spinner /></div>;
  const list = favorites.map((id) => index.products.get(id)).filter(Boolean);
  return (
    <div className="container page">
      <h1>Favoritos</h1>
      <p className="muted">Guardados en este dispositivo.</p>
      {list.length === 0
        ? <Empty title="Aún no tienes favoritos" action={<Link className="btn btn-primary" to="/tienda">Explorar la tienda</Link>}>Toca el corazón de cualquier producto para guardarlo aquí.</Empty>
        : <StaggerGrid className="product-grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</StaggerGrid>}
    </div>
  );
}

const Draft = () => (
  <div className="alert alert-warn" role="note"><Icon.alert size={18} /><div><strong>Contenido en borrador.</strong> Este texto es provisional y debe ser revisado y aprobado por Ferremateriales antes de publicarse.</div></div>
);

export function InfoPage({ kind }) {
  const { settings, demoMode } = useStore();
  const wa = (i = 0) => waLink(settings, 'Hola, Ferremateriales. Tengo una consulta.', i);
  const pages = {
    nosotros: {
      title: 'Nosotros',
      body: (
        <>
          <Draft />
          <p>{settings?.businessName} ofrece ferretería, plomería, electricidad y materiales de construcción en Panamá, con atención por WhatsApp e Instagram (@{settings?.instagram}).</p>
          <p>Trabajamos para que contratistas, maestros de obra y familias encuentren en un solo lugar lo necesario para construir, reparar y transformar.</p>
          <p className="muted small">Pendiente de la empresa: historia, dirección, horario de atención y fotografías del local.</p>
        </>
      ),
    },
    entregas: {
      title: 'Entregas y políticas',
      body: (
        <>
          <Draft />
          <h2>Retiro y entrega</h2>
          <p><strong>{settings?.deliveryMessage}.</strong> {settings?.deliveryDisclaimer}</p>
          <p>Al elegir entrega, el pedido se envía como solicitud: el personal confirma cobertura y costo antes de prepararlo. El total final aparece como “Por confirmar” hasta entonces.</p>
          <h2>Pagos</h2>
          <p>{settings?.paymentInstructions}</p>
          <h2>Existencias y reservas</h2>
          <p>Agregar productos al carrito no los reserva. Al enviar el pedido verificamos y reservamos todas las líneas juntas; si alguna ya no está disponible, el pedido no se crea y le indicamos qué ajustar.</p>
          <h2>Cancelaciones y devoluciones</h2>
          <p>Puede cancelar en línea mientras el pedido esté “Recibido”. Después, contáctenos. Las devoluciones de pedidos completados se revisan en tienda; solo reingresa al inventario la mercancía en condición de reventa.</p>
        </>
      ),
    },
    faq: {
      title: 'Preguntas frecuentes',
      body: (
        <>
          <Draft />
          {[
            ['¿Necesito una cuenta para comprar?', 'Puede explorar y armar su carrito sin cuenta. Para enviar el pedido y consultar su estado necesita una cuenta de cliente.'],
            ['¿Pago en línea?', 'No. Esta tienda registra pedidos; el pago se coordina con el personal y se marca como confirmado solo cuando ellos lo verifican.'],
            ['¿Cuánto cuesta la entrega?', `${settings?.deliveryMessage}. ${settings?.deliveryDisclaimer} Fuera de esa área, el costo se confirma por pedido.`],
            ['¿Escribir por WhatsApp crea un pedido?', 'No. WhatsApp sirve para consultas; el pedido solo se crea al enviarlo desde el carrito.'],
            ['¿Los precios incluyen impuestos?', 'Los precios se muestran sin impuestos; el resumen del pedido detalla el impuesto configurado para cada producto.'],
          ].map(([q, a]) => <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>)}
        </>
      ),
    },
    ayuda: {
      title: 'Ayuda',
      body: (
        <>
          <p>Escríbanos por WhatsApp para consultas sobre productos, cotizaciones o el estado de su pedido.</p>
          <div className="row-wrap">
            {(settings?.whatsappNumbers || []).map((n, i) => <a key={n} className="btn btn-primary" href={wa(i)} target="_blank" rel="noopener noreferrer"><Icon.whatsapp size={18} /> {n}</a>)}
          </div>
          <p><Link to="/mis-pedidos">Consultar mis pedidos</Link> · <Link to="/preguntas-frecuentes">Preguntas frecuentes</Link> · <Link to="/entregas-y-politicas">Entregas y políticas</Link></p>
          {demoMode && (
            <section id="demo" className="panel">
              <h2>Acerca de esta demostración</h2>
              <ul className="bullets">
                <li>La tienda y el inventario funcionan con un servidor real: base de datos SQLite, cuentas con contraseña y permisos verificados en el servidor.</li>
                <li>Los productos, precios, existencias, impuestos, proveedores y pedidos son <strong>datos de demostración</strong>; no son precios vigentes.</li>
                <li>Las imágenes de producto son ilustraciones temporales hasta recibir fotografías del negocio.</li>
                <li>No se procesan pagos ni se envían mensajes automáticamente.</li>
              </ul>
            </section>
          )}
        </>
      ),
    },
    privacidad: {
      title: 'Política de privacidad',
      body: (<><Draft /><p>Usamos su nombre, teléfono, correo y dirección únicamente para gestionar sus pedidos y comunicarnos con usted. No vendemos sus datos. El carrito y los favoritos se guardan en su dispositivo.</p><p className="muted small">Pendiente: revisión legal y datos del responsable del tratamiento.</p></>),
    },
    terminos: {
      title: 'Términos y condiciones',
      body: (<><Draft /><p>Los pedidos enviados en línea son solicitudes sujetas a confirmación de existencias, cobertura de entrega y pago coordinado con el personal. Los precios pueden cambiar sin previo aviso; los pedidos conservan el precio registrado al enviarse.</p><p className="muted small">Pendiente: revisión legal.</p></>),
    },
  };
  const page = pages[kind];
  return (
    <div className="container page narrow prose">
      <h1>{page.title}</h1>
      {page.body}
    </div>
  );
}

export function NotFound() {
  return <div className="container page"><Empty title="Página no encontrada" action={<Link className="btn btn-primary" to="/">Volver al inicio</Link>}>El enlace puede estar incompleto o la página fue movida.</Empty></div>;
}
