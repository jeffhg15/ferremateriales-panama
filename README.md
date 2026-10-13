# Ferremateriales Panamá — tienda en línea e inventario

Tienda en español conectada a un espacio de inventario para el personal. Un único modelo de datos (SQLite en el servidor) alimenta catálogo, carrito, pedidos y existencias.

> **Modo demostración activo por defecto.** Precios, costos, existencias, impuestos, proveedores y pedidos son datos de prueba. Las imágenes de producto son ilustraciones temporales.

## Requisitos

- Node.js **22.13 o superior** (usa el módulo integrado `node:sqlite`; probado con Node 26).
- No requiere base de datos externa ni servicios de terceros.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # opcional: ajuste puerto, contraseñas de semilla, etc.
npm run dev               # http://localhost:5173 (servidor + Vite con recarga)
```

Producción:

```bash
npm run build
npm start                 # sirve dist/ y la API en el mismo proceso
```

Al iniciar por primera vez con `DEMO_MODE=true` se cargan los datos de demostración y se crean cuatro cuentas (administrador, inventario, pedidos y un cliente). Las contraseñas se toman de `SEED_*_PASSWORD` en `.env` o se generan al azar y se guardan en `data/demo-credentials.txt` (no versionado).

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas de reglas de inventario/pedidos y de permisos HTTP (21 pruebas) |
| `npm run seed -- --reset` | Borra la base y vuelve a cargar la demostración |
| `node scripts/generate-art.mjs` | Regenera las ilustraciones SVG temporales |

## Qué incluye

**Tienda (`/`)**: página de inicio con la secuencia de la referencia (encabezado de dos filas, hero, categorías populares, destacados, banner de entrega, tres promociones, más vendidos con filtros, materiales más vendidos, banner de proyecto, recomendados, pie). Búsqueda sin acentos/mayúsculas por nombre, marca, categoría y SKU; filtros por categoría, disponibilidad, precio y especificaciones; orden por destacados, más vendidos, precio y nombre; ficha con variantes (cada una con SKU y existencia propios); favoritos; cajón de carrito accesible; carrito y pedido con retiro o entrega; confirmación con número único; historial y estado de pedidos del cliente; selector ES/EN.

**Personal (`/personal`)**: Resumen, Productos (crear/editar/archivar, reemplazar imagen), Inventario (entradas, recepciones de proveedor, daños, conteos físicos; devoluciones desde el pedido), Pedidos (estados, cargo de entrega, pago manual, devoluciones, bitácora), Proveedores, Historial (filtros, CSV, hora de America/Panama) y Configuración (negocio, logo, contactos, entrega, unidades, impuestos, personal y restablecer demostración).

## Reglas de existencias

- **Físico**: unidades en tienda. **Reservado**: comprometido por pedidos activos. **Disponible** = físico − reservado (siempre calculado, nunca guardado).
- Agregar al carrito o abrir WhatsApp **no** reserva ni crea pedidos.
- Al enviar el pedido se revalidan todas las líneas y se reservan juntas dentro de una transacción `BEGIN IMMEDIATE`; si una falla, se rechaza el pedido completo.
- Clave de idempotencia por envío: un doble clic no duplica pedidos.
- **Cancelar** libera la reserva una vez. **Completado** es el evento de despacho: resta físico y reservado una sola vez (`stock_state` lo garantiza).
- Devoluciones solo de pedidos completados; reingresa lo revendible y lo dañado se registra sin reingreso.
- No se permite físico negativo ni por debajo de lo reservado. Todo cambio crea un movimiento inmutable (triggers impiden editar/borrar el historial).
- Las líneas de pedido guardan nombre, SKU, unidad, precio e impuesto del momento.

Ejemplo verificado en `test/inventory.test.js`: 20/0/20 → pedido de 3 → 20/3/17 → completado → 17/0/17; repetir completado no cambia nada; cancelar en otra prueba devuelve 20 disponibles.

## Seguridad

- Contraseñas con `scrypt`; sesiones en servidor con cookie `HttpOnly`, `SameSite=Lax` (y `Secure` con `SECURE_COOKIES=true`).
- Permisos verificados en el servidor: **Administrador** (todo, configuración y personal), **Inventario** (productos, existencias, proveedores), **Pedidos** (pedidos). El registro público siempre crea clientes; el rol nunca viene del navegador.
- Los clientes solo ven sus propios pedidos (404 para pedidos ajenos). El catálogo público no expone costos.
- Las mutaciones exigen JSON con encabezado propio (protección CSRF) y hay límite de intentos de inicio de sesión.

## Personalización

- **Logo**: Configuración → Logo (URL o archivo). Vacío = logotipo de texto temporal `public/img/logo-wordmark.svg`.
- **Imágenes de la interfaz** (hero, banners, promociones): `src/lib/images.js`.
- **Imágenes de productos**: Personal → Productos → Editar → Subir foto. Se guardan en `data/uploads/`.
- **Contactos, mensaje de entrega, pago, impuestos y unidades**: Personal → Configuración.

### Fuentes de imágenes

Todas las imágenes actuales son **ilustraciones SVG originales generadas por `scripts/generate-art.mjs`** (productos) y `public/img/hero-worker.svg` (trabajador del hero), creadas para este proyecto, sin derechos de terceros. Son marcadores temporales: reemplácelas por fotografías reales del inventario (idealmente PNG/WebP con fondo transparente). Las capturas de Instagram se usaron solo como referencia de marca y no se incluyen.

## Pendiente por conectar o confirmar con el negocio

1. **Logo original** en alta resolución (el actual es un logotipo de texto temporal).
2. **Fotografías de productos** y de la persona del hero.
3. **Precios, costos, existencias y catálogo reales** (los actuales son de demostración).
4. **Impuestos**: confirmar con el contador la tasa ITBMS y exenciones por producto.
5. **Cobertura y tarifas de entrega** fuera de La Chorrera.
6. **Pasarela de pago** (si se desea cobro en línea). Hoy el pago se coordina manualmente y el personal lo marca como confirmado.
7. **Notificaciones** (WhatsApp Business API o correo) al cambiar el estado de un pedido.
8. **Textos legales**, dirección, horario y sección “Nosotros” (marcados como borrador).
9. **Hosting con HTTPS** y copias de seguridad de `data/ferremateriales.db`. Para varias instancias o alta concurrencia, migrar a PostgreSQL manteniendo las mismas reglas transaccionales.
