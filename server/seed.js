// Datos de demostración. Precios, costos y existencias son DE DEMOSTRACIÓN: no son precios vigentes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tx } from './db.js';
import { createUser } from './auth.js';
import { DEFAULT_SETTINGS, placeOrder, changeOrderStatus, receiveFromSupplier } from './domain.js';

const P = (name) => `/img/products/${name}.svg`;

export const CATEGORIES = [
  { slug: 'materiales-construccion', name: 'Materiales de construcción', nameEn: 'Building materials', image: P('cemento-gris'), tint: 'cyan' },
  { slug: 'herramientas', name: 'Herramientas', nameEn: 'Tools', image: P('taladro'), tint: 'yellow' },
  { slug: 'plomeria', name: 'Plomería', nameEn: 'Plumbing', image: P('llave-fregadero'), tint: 'blue' },
  { slug: 'electricidad', name: 'Electricidad', nameEn: 'Electrical', image: P('cable-thhn'), tint: 'red' },
  { slug: 'pinturas', name: 'Pinturas', nameEn: 'Paint', image: P('pintura-latex'), tint: 'mint' },
  { slug: 'puertas-ventanas', name: 'Puertas y ventanas', nameEn: 'Doors & windows', image: P('puerta-bano-aluminio'), tint: 'peach' },
];

const UNITS = [
  ['saco', 'saco', 'sacos'], ['unidad', 'unidad', 'unidades'], ['metro', 'metro', 'metros'], ['caja', 'caja', 'cajas'],
  ['galon', 'galón', 'galones'], ['lamina', 'lámina', 'láminas'], ['rollo', 'rollo', 'rollos'], ['cubeta', 'cubeta', 'cubetas'],
  ['juego', 'juego', 'juegos'],
];

// tax: 1 = ITBMS 7 % (demo), 2 = Exento (demo)
// v(sku, label, unit, price, cost, stock, reorder, specs, step)
const v = (sku, label, unit, price, cost, stock, reorder, specs = {}, step = 1, tax = 1) => ({ sku, label, unit, price, cost, stock, reorder, specs, step, tax });

export const PRODUCTS = [
  // Materiales de construcción
  { name: 'Cemento gris uso general', brand: 'Tipo GU · 42.5 kg', cat: 0, sub: 'Cemento y agregados', img: 'cemento-gris', featured: 1, merch: 1, offer: true,
    desc: 'Cemento gris de uso general para concreto, repello y mampostería.', variants: [v('CEM-GU-425', '42.5 kg', 'saco', 795, 640, 120, 30, { Peso: '42.5 kg', Tipo: 'GU' })] },
  { name: 'Arena lavada', brand: 'Saco de 40 kg', cat: 0, sub: 'Cemento y agregados', img: 'arena-lavada', featured: 6, merch: 4,
    desc: 'Arena lavada para mezclas de concreto y repello.', variants: [v('ARE-LAV-40', '40 kg', 'saco', 375, 250, 80, 20, { Peso: '40 kg' })] },
  { name: 'Piedra triturada 3/4"', brand: 'Saco de 40 kg', cat: 0, sub: 'Cemento y agregados', img: 'piedra-triturada', merch: 6,
    desc: 'Agregado grueso para concreto estructural.', variants: [v('PIE-34-40', '3/4" · 40 kg', 'saco', 425, 290, 60, 15, { Granulometría: '3/4"', Peso: '40 kg' })] },
  { name: 'Bloque de cemento', brand: 'Bloque hueco', cat: 0, sub: 'Bloques', img: 'bloque-4', featured: 9, merch: 3, variantLabel: 'Espesor',
    desc: 'Bloque hueco de concreto para paredes. Precio por unidad.', variants: [
      v('BLO-4', '4"', 'unidad', 65, 42, 1500, 300, { Espesor: '4"', Medida: '4 × 8 × 16"' }, 10),
      v('BLO-6', '6"', 'unidad', 85, 58, 900, 200, { Espesor: '6"', Medida: '6 × 8 × 16"' }, 10)] },
  { name: 'Varilla corrugada', brand: 'Acero grado 40 · 6 m', cat: 0, sub: 'Acero', img: 'varilla', featured: 3, merch: 2, variantLabel: 'Diámetro',
    desc: 'Varilla de acero corrugada para refuerzo de concreto. Largo de 6 m.', variants: [
      v('VAR-38-6', '3/8"', 'unidad', 495, 380, 200, 40, { Diámetro: '3/8"', Largo: '6 m', Grado: '40' }),
      v('VAR-12-6', '1/2"', 'unidad', 875, 690, 150, 30, { Diámetro: '1/2"', Largo: '6 m', Grado: '40' }),
      v('VAR-58-6', '5/8"', 'unidad', 1350, 1080, 0, 10, { Diámetro: '5/8"', Largo: '6 m', Grado: '40' })] },
  { name: 'Alambre de amarre #16', brand: 'Rollo de 2 kg', cat: 0, sub: 'Acero', img: 'alambre-amarre',
    desc: 'Alambre recocido para amarre de varillas.', variants: [v('ALA-16-2', '2 kg', 'rollo', 450, 310, 45, 10, { Calibre: '#16', Peso: '2 kg' })] },
  { name: 'Malla electrosoldada', brand: '6 × 6" · 2.4 × 6 m', cat: 0, sub: 'Acero', img: 'malla',
    desc: 'Malla de acero para losas y pisos.', variants: [v('MAL-66-24', '2.4 × 6 m', 'lamina', 3895, 3100, 25, 5, { Abertura: '6 × 6"', Medida: '2.4 × 6 m' })] },
  { name: 'Lámina de zinc acanalada', brand: 'Calibre 26', cat: 0, sub: 'Techos', img: 'zinc', featured: 4, merch: 5, variantLabel: 'Largo',
    desc: 'Lámina de zinc galvanizado para techos.', variants: [
      v('ZIN-26-8', "8'", 'lamina', 1095, 860, 60, 15, { Largo: "8'", Calibre: '26' }),
      v('ZIN-26-10', "10'", 'lamina', 1375, 1080, 40, 10, { Largo: "10'", Calibre: '26' }),
      v('ZIN-26-12', "12'", 'lamina', 1650, 1300, 8, 10, { Largo: "12'", Calibre: '26' })] },
  { name: 'Teja PVC estilo colonial', brand: 'Color terracota', cat: 0, sub: 'Techos', img: 'teja-pvc', featured: 8, variantLabel: 'Largo',
    desc: 'Lámina de teja PVC con acabado colonial, liviana y resistente a la corrosión.', variants: [
      v('TEJ-PVC-29', '2.90 m', 'lamina', 3250, 2500, 30, 8, { Largo: '2.90 m', Color: 'Terracota' }),
      v('TEJ-PVC-58', '5.80 m', 'lamina', 6400, 4950, 12, 4, { Largo: '5.80 m', Color: 'Terracota' })] },
  { name: 'Clavos de techo con arandela', brand: 'Caja de 1 lb', cat: 0, sub: 'Techos', img: 'clavos-techo',
    desc: 'Clavos galvanizados con arandela para fijación de láminas.', variants: [v('CLA-TEC-1', '2½" · 1 lb', 'caja', 325, 210, 70, 15, { Largo: '2½"' })] },
  { name: 'Pegamento para cerámica', brand: 'Saco de 20 kg', cat: 0, sub: 'Acabados', img: 'pegamento-ceramica',
    desc: 'Adhesivo en polvo para cerámica de pisos y paredes.', variants: [v('PEG-CER-20', '20 kg', 'saco', 695, 490, 50, 12, { Peso: '20 kg' })] },
  { name: 'Repello listo', brand: 'Saco de 40 kg', cat: 0, sub: 'Acabados', img: 'repello',
    desc: 'Mezcla seca para repello, solo agregar agua.', variants: [v('REP-LIS-40', '40 kg', 'saco', 650, 470, 0, 10, { Peso: '40 kg' })] },

  // Herramientas
  { name: 'Taladro percutor inalámbrico', brand: '20 V · con batería', cat: 1, sub: 'Eléctricas', img: 'taladro', featured: 2, merch: 7, offer: true,
    desc: 'Taladro percutor de 20 V con batería, cargador y estuche.', variants: [v('TAL-20V-1', '20 V', 'unidad', 8995, 6500, 9, 3, { Voltaje: '20 V', Mandril: '1/2"' })] },
  { name: 'Martillo de uña', brand: '16 oz · mango de fibra', cat: 1, sub: 'Manuales', img: 'martillo', featured: 10,
    desc: 'Martillo de uña curva con mango antivibración.', variants: [v('MAR-16', '16 oz', 'unidad', 995, 640, 25, 6, { Peso: '16 oz' })] },
  { name: 'Nivel de aluminio', brand: '3 burbujas', cat: 1, sub: 'Medición', img: 'nivel', variantLabel: 'Largo',
    desc: 'Nivel de aluminio con tres burbujas.', variants: [
      v('NIV-24', '24"', 'unidad', 1150, 760, 14, 4, { Largo: '24"' }),
      v('NIV-48', '48"', 'unidad', 1895, 1290, 6, 3, { Largo: '48"' })] },
  { name: 'Cinta métrica', brand: 'Carcasa reforzada', cat: 1, sub: 'Medición', img: 'cinta-metrica', variantLabel: 'Largo',
    desc: 'Cinta métrica con freno y gancho magnético.', variants: [
      v('CIN-5M', '5 m', 'unidad', 595, 380, 30, 8, { Largo: '5 m' }),
      v('CIN-8M', '8 m', 'unidad', 895, 590, 18, 6, { Largo: '8 m' })] },
  { name: 'Carretilla de construcción', brand: '6 pies³ · llanta neumática', cat: 1, sub: 'Obra', img: 'carretilla', merch: 9,
    desc: 'Carretilla de bandeja metálica para obra.', variants: [v('CAR-6P', '6 pies³', 'unidad', 7495, 5600, 7, 2, { Capacidad: '6 pies³' })] },
  { name: 'Pala cuadrada', brand: 'Mango de madera', cat: 1, sub: 'Obra', img: 'pala',
    desc: 'Pala cuadrada de acero templado.', variants: [v('PAL-CUA', 'Cuadrada', 'unidad', 1250, 820, 20, 5, { Tipo: 'Cuadrada' })] },
  { name: 'Caja de herramientas', brand: 'Plástica · 19"', cat: 1, sub: 'Almacenamiento', img: 'caja-herramientas',
    desc: 'Caja plástica con bandeja removible.', variants: [v('CAJ-HER-19', '19"', 'unidad', 1595, 1050, 12, 3, { Largo: '19"' })] },
  { name: 'Desbrozadora a gasolina', brand: 'Motor 2 tiempos', cat: 1, sub: 'Jardín', img: 'desbrozadora', variantLabel: 'Cilindrada',
    desc: 'Desbrozadora para jardín y terrenos.', variants: [
      v('DES-43CC', '43 cc', 'unidad', 14250, 10500, 4, 2, { Cilindrada: '43 cc' }),
      v('DES-52CC', '52 cc', 'unidad', 14950, 11200, 3, 2, { Cilindrada: '52 cc' })] },

  // Plomería
  { name: 'Tubo PVC presión', brand: 'SDR 26 · 6 m', cat: 2, sub: 'Tuberías', img: 'tubo-pvc', featured: 5, merch: 8, variantLabel: 'Diámetro',
    desc: 'Tubo PVC para agua potable a presión. Largo de 6 m.', variants: [
      v('PVC-P-12', '1/2"', 'unidad', 395, 260, 90, 20, { Diámetro: '1/2"', Largo: '6 m' }),
      v('PVC-P-34', '3/4"', 'unidad', 575, 390, 70, 15, { Diámetro: '3/4"', Largo: '6 m' }),
      v('PVC-P-1', '1"', 'unidad', 825, 570, 40, 10, { Diámetro: '1"', Largo: '6 m' })] },
  { name: 'Tubo PVC sanitario', brand: '6 m', cat: 2, sub: 'Tuberías', img: 'tubo-pvc-sanitario', variantLabel: 'Diámetro',
    desc: 'Tubo PVC para drenaje sanitario.', variants: [
      v('PVC-S-2', '2"', 'unidad', 950, 650, 30, 8, { Diámetro: '2"', Largo: '6 m' }),
      v('PVC-S-4', '4"', 'unidad', 1895, 1300, 20, 6, { Diámetro: '4"', Largo: '6 m' })] },
  { name: 'Codo PVC 90°', brand: 'Presión', cat: 2, sub: 'Accesorios', img: 'codo-pvc', variantLabel: 'Diámetro',
    desc: 'Codo de 90° para tubería PVC a presión.', variants: [
      v('COD-90-12', '1/2"', 'unidad', 45, 22, 300, 60, { Diámetro: '1/2"' }),
      v('COD-90-34', '3/4"', 'unidad', 65, 34, 250, 50, { Diámetro: '3/4"' })] },
  { name: 'Tee PVC', brand: 'Presión', cat: 2, sub: 'Accesorios', img: 'tee-pvc', variantLabel: 'Diámetro',
    desc: 'Tee para derivaciones en tubería PVC.', variants: [
      v('TEE-12', '1/2"', 'unidad', 55, 28, 200, 40, { Diámetro: '1/2"' }),
      v('TEE-34', '3/4"', 'unidad', 80, 42, 160, 40, { Diámetro: '3/4"' })] },
  { name: 'Soldadura líquida PVC', brand: '237 ml', cat: 2, sub: 'Accesorios', img: 'soldadura-pvc',
    desc: 'Cemento solvente para unir tubería y accesorios PVC.', variants: [v('SOL-PVC-237', '237 ml', 'unidad', 425, 280, 40, 10, { Contenido: '237 ml' })] },
  { name: 'Llave de fregadero cuello alto', brand: 'Acabado cromado', cat: 2, sub: 'Grifería', img: 'llave-fregadero', featured: 7, merch: 10, offer: true,
    desc: 'Llave de fregadero con cuello giratorio y dos manijas.', variants: [v('LLF-CRO', 'Cromado', 'unidad', 1695, 1100, 15, 4, { Acabado: 'Cromado' })] },
  { name: 'Llave de lavamanos', brand: 'Monomando', cat: 2, sub: 'Grifería', img: 'llave-lavamanos',
    desc: 'Llave monomando para lavamanos.', variants: [v('LLL-MONO', 'Cromado', 'unidad', 2250, 1500, 10, 3, { Acabado: 'Cromado' })] },
  { name: 'Inodoro de una pieza', brand: 'Descarga sencilla', cat: 2, sub: 'Sanitarios', img: 'inodoro-blanco', variantLabel: 'Color',
    desc: 'Inodoro de una pieza con asiento incluido.', variants: [
      v('INO-1P-BLA', 'Blanco', 'unidad', 6995, 5100, 6, 2, { Color: 'Blanco' }),
      v('INO-1P-NEG', 'Negro', 'unidad', 7650, 5600, 3, 2, { Color: 'Negro' })] },
  { name: 'Cinta teflón', brand: '1/2" × 10 m', cat: 2, sub: 'Accesorios', img: 'teflon',
    desc: 'Cinta selladora para roscas.', variants: [v('TEF-12-10', '1/2"', 'unidad', 50, 20, 400, 80, { Ancho: '1/2"', Largo: '10 m' }, 1, 1)] },

  // Electricidad
  { name: 'Cable THHN', brand: 'Cobre · se vende por metro', cat: 3, sub: 'Cables', img: 'cable-thhn', variantLabel: 'Calibre',
    desc: 'Cable de cobre THHN para instalaciones residenciales. Se vende por metro.', variants: [
      v('THHN-12-R', '#12 rojo', 'metro', 85, 55, 500, 100, { Calibre: '#12', Color: 'Rojo' }),
      v('THHN-12-N', '#12 negro', 'metro', 85, 55, 450, 100, { Calibre: '#12', Color: 'Negro' }),
      v('THHN-14-B', '#14 blanco', 'metro', 65, 40, 300, 100, { Calibre: '#14', Color: 'Blanco' })] },
  { name: 'Tomacorriente doble', brand: '15 A · 125 V', cat: 3, sub: 'Dispositivos', img: 'tomacorriente',
    desc: 'Tomacorriente doble polarizado con placa.', variants: [v('TOM-DOB-15', '15 A', 'unidad', 275, 160, 80, 20, { Amperaje: '15 A', Voltaje: '125 V' })] },
  { name: 'Interruptor sencillo', brand: '15 A · con placa', cat: 3, sub: 'Dispositivos', img: 'interruptor',
    desc: 'Interruptor sencillo de pared.', variants: [v('INT-SEN-15', '15 A', 'unidad', 225, 130, 90, 20, { Amperaje: '15 A' })] },
  { name: 'Bombillo LED', brand: 'Luz blanca · E27', cat: 3, sub: 'Iluminación', img: 'bombillo-led', variantLabel: 'Potencia',
    desc: 'Bombillo LED de bajo consumo, rosca E27.', variants: [
      v('LED-9W', '9 W', 'unidad', 195, 95, 120, 30, { Potencia: '9 W', Rosca: 'E27' }),
      v('LED-12W', '12 W', 'unidad', 250, 125, 100, 30, { Potencia: '12 W', Rosca: 'E27' })] },
  { name: 'Breaker de 1 polo', brand: 'Enchufable', cat: 3, sub: 'Protección', img: 'breaker', variantLabel: 'Amperaje',
    desc: 'Interruptor termomagnético de un polo.', variants: [
      v('BRK-1P-15', '15 A', 'unidad', 695, 450, 20, 5, { Amperaje: '15 A' }),
      v('BRK-1P-20', '20 A', 'unidad', 695, 450, 25, 5, { Amperaje: '20 A' }),
      v('BRK-1P-30', '30 A', 'unidad', 750, 490, 2, 5, { Amperaje: '30 A' })] },

  // Pinturas
  { name: 'Pintura de látex interior', brand: 'Blanco mate', cat: 4, sub: 'Látex', img: 'pintura-latex', featured: 6, merch: 11, variantLabel: 'Capacidad',
    desc: 'Pintura de látex lavable para interiores, acabado mate.', variants: [
      v('LAT-INT-GAL', 'Galón', 'galon', 1895, 1300, 40, 10, { Capacidad: '1 galón', Color: 'Blanco' }),
      v('LAT-INT-CUB', 'Cubeta 5 gal', 'cubeta', 7995, 5700, 12, 4, { Capacidad: '5 galones', Color: 'Blanco' })] },
  { name: 'Pintura de esmalte', brand: 'Acabado brillante', cat: 4, sub: 'Esmaltes', img: 'pintura-esmalte', variantLabel: 'Color',
    desc: 'Esmalte sintético para metal y madera.', variants: [
      v('ESM-ROJ-GAL', 'Rojo', 'galon', 2450, 1700, 10, 4, { Color: 'Rojo', Capacidad: '1 galón' }),
      v('ESM-BLA-GAL', 'Blanco', 'galon', 2450, 1700, 14, 4, { Color: 'Blanco', Capacidad: '1 galón' })] },
  { name: 'Impermeabilizante para techo', brand: 'Acrílico', cat: 4, sub: 'Impermeabilizantes', img: 'impermeabilizante',
    desc: 'Recubrimiento acrílico elastomérico para techos.', variants: [v('IMP-TEC-CUB', 'Cubeta 5 gal', 'cubeta', 8950, 6400, 8, 3, { Capacidad: '5 galones' })] },
  { name: 'Rodillo con bandeja', brand: '9" · juego', cat: 4, sub: 'Accesorios', img: 'rodillo',
    desc: 'Juego de rodillo de 9" con bandeja plástica.', variants: [v('ROD-9-BAN', '9"', 'juego', 650, 400, 25, 6, { Ancho: '9"' })] },
  { name: 'Brocha', brand: 'Cerda natural', cat: 4, sub: 'Accesorios', img: 'brocha', variantLabel: 'Ancho',
    desc: 'Brocha de cerda natural para esmaltes y látex.', variants: [
      v('BRO-2', '2"', 'unidad', 195, 110, 40, 10, { Ancho: '2"' }),
      v('BRO-3', '3"', 'unidad', 275, 160, 35, 10, { Ancho: '3"' })] },

  // Puertas y ventanas
  { name: 'Puerta de baño de aluminio', brand: 'Vidrio esmerilado', cat: 5, sub: 'Puertas', img: 'puerta-bano-aluminio', featured: 4, merch: 12, variantLabel: 'Medida',
    desc: 'Puerta de aluminio con vidrio esmerilado decorado, ideal para baños.', variants: [
      v('PBA-70-210', '70 × 210 cm', 'unidad', 8500, 6200, 5, 2, { Ancho: '70 cm', Alto: '210 cm' }),
      v('PBA-80-210', '80 × 210 cm', 'unidad', 9250, 6800, 3, 2, { Ancho: '80 cm', Alto: '210 cm' })] },
  { name: 'Puerta de seguridad metálica', brand: 'Acabado negro', cat: 5, sub: 'Puertas', img: 'puerta-seguridad', featured: 5, variantLabel: 'Apertura',
    desc: 'Puerta de acero con cerradura de seguridad y manija de barra.', variants: [
      v('PSE-90-IZQ', '90 × 210 cm · izquierda', 'unidad', 22500, 16800, 2, 1, { Medida: '90 × 210 cm', Apertura: 'Izquierda' }),
      v('PSE-90-DER', '90 × 210 cm · derecha', 'unidad', 22500, 16800, 3, 1, { Medida: '90 × 210 cm', Apertura: 'Derecha' })] },
  { name: 'Puerta de madera tipo tablero', brand: 'Para pintar', cat: 5, sub: 'Puertas', img: 'puerta-madera', variantLabel: 'Ancho',
    desc: 'Puerta interior de madera, lista para pintar o barnizar.', variants: [
      v('PMA-70', '70 cm', 'unidad', 6450, 4700, 6, 2, { Ancho: '70 cm', Alto: '210 cm' }),
      v('PMA-80', '80 cm', 'unidad', 6950, 5100, 5, 2, { Ancho: '80 cm', Alto: '210 cm' }),
      v('PMA-90', '90 cm', 'unidad', 7450, 5500, 0, 2, { Ancho: '90 cm', Alto: '210 cm' })] },
  { name: 'Ventana corrediza de aluminio', brand: 'Vidrio claro', cat: 5, sub: 'Ventanas', img: 'ventana-corrediza', featured: 3, merch: 13, variantLabel: 'Medida',
    desc: 'Ventana corrediza de aluminio natural con vidrio claro.', variants: [
      v('VCO-60-60', '60 × 60 cm', 'unidad', 4500, 3200, 8, 2, { Medida: '60 × 60 cm' }),
      v('VCO-90-90', '90 × 90 cm', 'unidad', 6800, 4900, 6, 2, { Medida: '90 × 90 cm' }),
      v('VCO-120-120', '120 × 120 cm', 'unidad', 9500, 6900, 4, 2, { Medida: '120 × 120 cm' }),
      v('VCO-120-150', '120 × 150 cm', 'unidad', 11500, 8400, 2, 2, { Medida: '120 × 150 cm' })] },
  { name: 'Ventana de celosía', brand: 'Paletas de vidrio', cat: 5, sub: 'Ventanas', img: 'ventana-celosia', variantLabel: 'Medida',
    desc: 'Ventana de celosía con paletas de vidrio y operador manual.', variants: [
      v('VCE-60-90', '60 × 90 cm', 'unidad', 5200, 3700, 5, 2, { Medida: '60 × 90 cm' }),
      v('VCE-90-90', '90 × 90 cm', 'unidad', 6400, 4600, 4, 2, { Medida: '90 × 90 cm' })] },
];

const SUPPLIERS = [
  { name: 'Distribuidora Demo Cementos (ficticio)', contact: 'Contacto de ejemplo', phone: '', email: '', notes: 'Proveedor ficticio para la demostración.' },
  { name: 'Ferretería Mayorista Ejemplo (ficticio)', contact: 'Contacto de ejemplo', phone: '', email: '', notes: 'Proveedor ficticio para la demostración.' },
  { name: 'Aluminios y Vidrios Muestra (ficticio)', contact: 'Contacto de ejemplo', phone: '', email: '', notes: 'Proveedor ficticio para la demostración.' },
];

function credential(envName) {
  return process.env[envName] || crypto.randomBytes(9).toString('base64url');
}

/**
 * Carga los datos de demostración. Las contraseñas vienen de variables de entorno o se generan
 * aleatoriamente y se guardan en data/demo-credentials.txt (no versionado).
 */
export function seed(db, { dataDir, withDemoOrders = true, quiet = false } = {}) {
  const creds = {
    admin: { email: 'admin@demo.ferremateriales.local', name: 'Administración (demo)', role: 'admin', password: credential('SEED_ADMIN_PASSWORD') },
    inventory: { email: 'inventario@demo.ferremateriales.local', name: 'Inventario (demo)', role: 'inventory', password: credential('SEED_INVENTORY_PASSWORD') },
    orders: { email: 'pedidos@demo.ferremateriales.local', name: 'Pedidos (demo)', role: 'orders', password: credential('SEED_ORDERS_PASSWORD') },
    customer: { email: 'cliente@demo.ferremateriales.local', name: 'Cliente de prueba', role: 'customer', password: credential('SEED_CUSTOMER_PASSWORD'), phone: '6000-0000' },
  };

  const ids = {};
  tx(db, () => {
    const set = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, val] of Object.entries(DEFAULT_SETTINGS)) set.run(k, JSON.stringify(val));
    for (const [code, s, p] of UNITS) db.prepare('INSERT INTO units (code, name_singular, name_plural) VALUES (?,?,?)').run(code, s, p);
    db.prepare('INSERT INTO tax_rates (id, name, rate_bp) VALUES (1, ?, 700)').run('ITBMS 7 % (demo)');
    db.prepare('INSERT INTO tax_rates (id, name, rate_bp) VALUES (2, ?, 0)').run('Exento (demo)');
    CATEGORIES.forEach((c, i) => {
      db.prepare('INSERT INTO categories (slug, name, name_en, image, tint, sort) VALUES (?,?,?,?,?,?)').run(c.slug, c.name, c.nameEn, c.image, c.tint, i);
    });
    const catIds = db.prepare('SELECT id FROM categories ORDER BY sort').all().map((r) => r.id);
    for (const [k, c] of Object.entries(creds)) ids[k] = createUser(db, c);
    const system = { id: ids.admin, name: 'Carga inicial (demo)' };
    const slugs = new Set();
    for (const p of PRODUCTS) {
      let slug = p.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      while (slugs.has(slug)) slug += '-2';
      slugs.add(slug);
      const r = db.prepare(`INSERT INTO products (slug, name, brand, category_id, subcategory, description, image, variant_label, featured_rank, merch_rank, on_offer)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(slug, p.name, p.brand, catIds[p.cat], p.sub, p.desc, P(p.img), p.variantLabel || '', p.featured ?? null, p.merch ?? null, p.offer ? 1 : 0);
      const pid = Number(r.lastInsertRowid);
      p.variants.forEach((x, i) => {
        const vr = db.prepare(`INSERT INTO variants (product_id, sku, label, specs, unit_code, step, cost_cents, price_cents, tax_rate_id, reorder_threshold, sort)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(pid, x.sku, x.label, JSON.stringify(x.specs), x.unit, x.step, x.cost, x.price, x.tax, x.reorder, i);
        if (x.stock > 0) {
          const vid = Number(vr.lastInsertRowid);
          db.prepare('UPDATE variants SET physical = ? WHERE id = ?').run(x.stock, vid);
          db.prepare(`INSERT INTO stock_movements (variant_id, sku, product_name, type, physical_delta, reserved_delta, physical_before, physical_after,
            reserved_before, reserved_after, reason, actor_id, actor_name) VALUES (?,?,?,?,?,0,0,?,0,0,?,?,?)`)
            .run(vid, x.sku, `${p.name}${x.label ? ' — ' + x.label : ''}`, 'inicial', x.stock, x.stock, 'Existencia inicial de demostración', system.id, system.name);
        }
      });
    }
    for (const s of SUPPLIERS) db.prepare('INSERT INTO suppliers (name, contact, phone, email, notes, is_demo) VALUES (?,?,?,?,?,1)').run(s.name, s.contact, s.phone, s.email, s.notes);
  });

  if (withDemoOrders) seedDemoOrders(db, ids);

  if (dataDir) {
    const lines = Object.values(creds).map((c) => `${c.role.padEnd(10)} ${c.email}  ${c.password}`).join('\n');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'demo-credentials.txt'),
      `Cuentas de demostración (generadas ${new Date().toISOString()}). No usar en producción.\n\n${lines}\n`, { mode: 0o600 });
    if (!quiet) console.log(`[seed] Credenciales de demostración guardadas en ${path.join(dataDir, 'demo-credentials.txt')}`);
  }
  return { creds, ids };
}

/** Pedidos de demostración creados con las mismas reglas que la tienda (reservas y despachos reales). */
function seedDemoOrders(db, ids) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ids.customer);
  const staff = { id: ids.orders, name: 'Pedidos (demo)' };
  const vid = (sku) => db.prepare('SELECT id FROM variants WHERE sku = ?').get(sku).id;
  const mk = (key, items, fulfillment, steps, extra = {}) => {
    const { order } = placeOrder(db, user, {
      idempotencyKey: `demo-${key}`, customerName: 'Cliente de prueba', phone: '6000-0000', fulfillment,
      address: fulfillment === 'delivery' ? 'Dirección de ejemplo, La Chorrera (demo)' : '', notes: 'Pedido de demostración',
      items: items.map(([sku, qty]) => ({ variantId: vid(sku), qty })),
    });
    for (const s of steps) changeOrderStatus(db, staff, order.id, s, s === 'confirmado' && fulfillment === 'delivery' ? { deliveryCents: 0, note: 'Acarreo en La Chorrera (demo)' } : {});
    return order;
  };
  mk('1', [['CEM-GU-425', 20], ['VAR-12-6', 12], ['ARE-LAV-40', 10]], 'delivery', ['confirmado', 'en_preparacion', 'en_reparto', 'completado']);
  mk('2', [['BLO-4', 200], ['CEM-GU-425', 8]], 'pickup', ['confirmado', 'en_preparacion', 'listo_para_retirar', 'completado']);
  mk('3', [['ZIN-26-10', 12], ['CLA-TEC-1', 3]], 'pickup', ['confirmado', 'en_preparacion', 'listo_para_retirar', 'completado']);
  mk('4', [['PVC-P-12', 10], ['COD-90-12', 20], ['TEE-12', 8], ['SOL-PVC-237', 2]], 'pickup', ['confirmado', 'en_preparacion', 'listo_para_retirar', 'completado']);
  mk('5', [['LAT-INT-GAL', 4], ['ROD-9-BAN', 1]], 'pickup', ['confirmado']);
  mk('6', [['TAL-20V-1', 1], ['THHN-12-R', 50]], 'delivery', []);
  mk('7', [['VCO-90-90', 2]], 'pickup', ['cancelado']);
  const sup = db.prepare('SELECT id FROM suppliers ORDER BY id LIMIT 1').get().id;
  receiveFromSupplier(db, { id: ids.inventory, name: 'Inventario (demo)' }, {
    supplierId: sup, reference: 'DEMO-FAC-0001', notes: 'Recepción de demostración',
    lines: [{ variantId: vid('CEM-GU-425'), qty: 40 }, { variantId: vid('ARE-LAV-40'), qty: 20 }],
  });
}
