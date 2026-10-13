// Genera las ilustraciones SVG temporales (fondo transparente) usadas como imágenes de producto.
// Reemplácelas por fotografías reales sin cambiar código: vea src/lib/images.js y README.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/img/products');
fs.mkdirSync(OUT, { recursive: true });

let uid = 0;
const id = (p) => `${p}${++uid}`;

function svg(body, defs = '', vb = '0 0 400 400') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="400" height="400"><defs>${defs}</defs>${body}</svg>`;
}
const lin = (gid, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 0) =>
  `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
const rad = (gid, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</radialGradient>`;
const shadow = (cx = 200, cy = 360, rx = 130, ry = 16, op = 0.18) => {
  const g = id('sh');
  return { defs: rad(g, [[0, '#0B1736', op], [1, '#0B1736', 0]]), body: `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${g})"/>` };
};
function write(name, parts) {
  const defs = parts.map((p) => p.defs || '').join('');
  const body = parts.map((p) => p.body || '').join('');
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(body, defs));
}

// ---------- Plantillas ----------

function sack({ base, dark, band, label, sub, text = '#0B1736', bandText = '#fff' }) {
  const g = id('sk'); const h = id('hl');
  return [shadow(200, 362, 125, 15), {
    defs: lin(g, [[0, dark], [0.25, base], [0.7, base], [1, dark]]) + lin(h, [[0, '#fff', 0.35], [1, '#fff', 0]], 0, 0, 0, 1),
    body: `
    <path d="M92 70 Q200 52 308 70 L322 120 Q330 220 318 320 Q316 346 300 350 Q200 362 100 350 Q84 346 82 320 Q70 220 78 120 Z" fill="url(#${g})"/>
    <path d="M92 70 Q200 52 308 70 L312 86 Q200 70 88 86 Z" fill="${dark}" opacity=".55"/>
    <path d="M100 74 Q150 66 190 66 L180 330 Q140 332 104 326 Q92 220 100 74Z" fill="url(#${h})"/>
    <rect x="96" y="220" width="208" height="62" rx="6" fill="${band}"/>
    <text x="200" y="152" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="34" fill="${text}">${label}</text>
    <text x="200" y="186" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="17" fill="${text}" opacity=".75">${sub}</text>
    <text x="200" y="260" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" fill="${bandText}">FERRE</text>
    <path d="M120 320 q10 6 20 0 M260 320 q10 6 20 0" stroke="${dark}" stroke-width="3" fill="none" opacity=".4"/>`,
  }];
}

function can({ body, lid = '#C9D2DC', label = '#fff', swatch, title, sub, wide = false }) {
  const g = id('cn'); const l = id('ld');
  const x = wide ? 95 : 115; const w = wide ? 210 : 170;
  return [shadow(200, 352, w / 2 + 20, 14), {
    defs: lin(g, [[0, '#8A96A3'], [0.15, '#E8EDF2'], [0.45, '#FFFFFF'], [0.8, '#B9C3CD'], [1, '#7D8995']]) + lin(l, [[0, '#9AA5B1'], [0.5, '#F1F4F7'], [1, '#8E99A5']]),
    body: `
    <rect x="${x}" y="110" width="${w}" height="230" rx="12" fill="url(#${g})"/>
    <ellipse cx="200" cy="112" rx="${w / 2}" ry="18" fill="url(#${l})"/>
    <ellipse cx="200" cy="108" rx="${w / 2 - 14}" ry="11" fill="${lid}"/>
    <path d="M${200 - w / 2 + 30} 104 Q200 40 ${200 + w / 2 - 30} 104" stroke="#5E6B78" stroke-width="5" fill="none"/>
    <rect x="${x}" y="160" width="${w}" height="140" fill="${body}"/>
    <rect x="${x}" y="160" width="${w}" height="140" fill="url(#${g})" opacity=".25"/>
    <rect x="${x + 18}" y="178" width="${w - 36}" height="72" rx="8" fill="${label}"/>
    <circle cx="${x + 40}" cy="214" r="16" fill="${swatch}"/>
    <text x="${x + 64}" y="210" font-family="Arial Black,Arial,sans-serif" font-size="20" font-weight="900" fill="#0B1736">${title}</text>
    <text x="${x + 64}" y="232" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#0B1736" opacity=".7">${sub}</text>
    <rect x="${x}" y="268" width="${w}" height="10" fill="#fff" opacity=".35"/>`,
  }];
}

function bucket({ color, dark, title, sub }) {
  const g = id('bk');
  return [shadow(200, 356, 120, 15), {
    defs: lin(g, [[0, dark], [0.3, color], [0.65, color], [1, dark]]),
    body: `
    <path d="M100 100 L300 100 L282 340 Q200 352 118 340 Z" fill="url(#${g})"/>
    <ellipse cx="200" cy="100" rx="100" ry="16" fill="${dark}"/>
    <ellipse cx="200" cy="98" rx="92" ry="11" fill="${color}"/>
    <path d="M104 118 L296 118" stroke="${dark}" stroke-width="4"/>
    <path d="M110 108 Q200 20 290 108" stroke="#2A3340" stroke-width="5" fill="none"/>
    <rect x="125" y="170" width="150" height="110" rx="10" fill="#fff" opacity=".95"/>
    <text x="200" y="215" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="22" font-weight="900" fill="#0B1736">${title}</text>
    <text x="200" y="242" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#0B1736" opacity=".7">${sub}</text>
    <rect x="145" y="254" width="110" height="10" rx="5" fill="${color}"/>`,
  }];
}

function pipes({ color = '#E9EEF2', count = 5, ends = '#9AA6B2' }) {
  const g = id('pp');
  let body = '';
  for (let i = 0; i < count; i++) {
    const y = 120 + i * 34 - (i % 2) * 6;
    const x = 40 + (i % 2) * 18;
    body += `<g transform="rotate(-14 200 200)"><rect x="${x}" y="${y}" width="300" height="34" rx="17" fill="url(#${g})"/>
      <ellipse cx="${x + 300}" cy="${y + 17}" rx="9" ry="17" fill="${ends}"/><ellipse cx="${x + 300}" cy="${y + 17}" rx="5" ry="11" fill="#5C6773"/></g>`;
  }
  return [shadow(200, 330, 150, 16), { defs: lin(g, [[0, '#FFFFFF'], [0.35, color], [1, '#8E9BA8']], 0, 0, 0, 1), body }];
}

function elbow({ color = '#F1F4F7', shade = '#A9B4BF', tee = false }) {
  const g = id('el');
  const body = tee
    ? `<rect x="70" y="150" width="260" height="90" rx="22" fill="url(#${g})"/>
       <rect x="155" y="210" width="90" height="130" rx="20" fill="url(#${g})"/>
       <ellipse cx="72" cy="195" rx="16" ry="44" fill="${shade}"/><ellipse cx="72" cy="195" rx="9" ry="30" fill="#5C6773"/>
       <ellipse cx="328" cy="195" rx="16" ry="44" fill="${shade}"/><ellipse cx="328" cy="195" rx="9" ry="30" fill="#5C6773"/>
       <ellipse cx="200" cy="338" rx="44" ry="14" fill="${shade}"/><ellipse cx="200" cy="338" rx="30" ry="8" fill="#5C6773"/>`
    : `<path d="M110 120 h90 a110 110 0 0 1 110 110 v90 h-90 v-90 a20 20 0 0 0 -20 -20 h-90 Z" fill="url(#${g})"/>
       <ellipse cx="110" cy="165" rx="16" ry="45" fill="${shade}"/><ellipse cx="110" cy="165" rx="9" ry="31" fill="#5C6773"/>
       <ellipse cx="265" cy="320" rx="45" ry="15" fill="${shade}"/><ellipse cx="265" cy="320" rx="31" ry="9" fill="#5C6773"/>`;
  return [shadow(200, 350, 120, 14), { defs: lin(g, [[0, '#FFFFFF'], [0.5, color], [1, '#B8C2CC']], 0, 0, 1, 1), body }];
}

function faucet({ finish = 'chrome', tall = true }) {
  const g = id('fc');
  const stops = finish === 'black'
    ? [[0, '#111827'], [0.4, '#4B5563'], [0.6, '#1F2937'], [1, '#0B0F17']]
    : [[0, '#7B8794'], [0.35, '#FFFFFF'], [0.55, '#C9D1D9'], [1, '#6B7682']];
  const body = tall
    ? `<rect x="120" y="318" width="160" height="22" rx="11" fill="url(#${g})"/>
       <rect x="182" y="150" width="36" height="175" rx="12" fill="url(#${g})"/>
       <path d="M200 160 C200 40 330 40 330 140 L330 170" stroke="url(#${g})" stroke-width="28" fill="none" stroke-linecap="round"/>
       <rect x="316" y="160" width="28" height="30" rx="6" fill="#56616C"/>
       <rect x="218" y="190" width="70" height="18" rx="9" fill="url(#${g})" transform="rotate(-25 218 199)"/>
       <rect x="96" y="300" width="46" height="40" rx="10" fill="url(#${g})"/><rect x="258" y="300" width="46" height="40" rx="10" fill="url(#${g})"/>`
    : `<rect x="110" y="300" width="180" height="34" rx="14" fill="url(#${g})"/>
       <rect x="175" y="200" width="50" height="105" rx="14" fill="url(#${g})"/>
       <path d="M200 215 L120 230" stroke="url(#${g})" stroke-width="26" stroke-linecap="round"/>
       <rect x="185" y="160" width="30" height="50" rx="10" fill="url(#${g})"/>
       <rect x="200" y="160" width="95" height="20" rx="10" fill="url(#${g})" transform="rotate(-12 200 170)"/>`;
  return [shadow(200, 346, 120, 12), { defs: lin(g, stops), body }];
}

function drill() {
  const b = id('dr'); const y = id('dy'); const m = id('dm');
  return [shadow(200, 352, 130, 14), {
    defs: lin(b, [[0, '#2A2F36'], [0.5, '#4A515B'], [1, '#1A1E24']], 0, 0, 0, 1) + lin(y, [[0, '#FFE34D'], [0.5, '#FFD400'], [1, '#D9A800']], 0, 0, 0, 1) + lin(m, [[0, '#9AA3AD'], [0.5, '#F4F6F8'], [1, '#7C8691']], 0, 0, 0, 1),
    body: `
    <rect x="30" y="140" width="40" height="14" rx="4" fill="url(#${m})"/>
    <rect x="66" y="128" width="50" height="38" rx="8" fill="#2A2F36"/>
    <path d="M110 110 L280 110 Q320 110 320 150 L320 168 Q320 196 290 196 L150 196 Q110 196 110 160 Z" fill="url(#${y})"/>
    <path d="M150 196 L230 196 L250 300 L180 300 Z" fill="url(#${b})"/>
    <path d="M200 196 L236 196 L240 220 L205 220 Z" fill="#111"/>
    <rect x="150" y="296" width="140" height="56" rx="12" fill="url(#${b})"/>
    <rect x="160" y="306" width="120" height="16" rx="6" fill="url(#${y})"/>
    <rect x="270" y="122" width="40" height="40" rx="10" fill="#2A2F36"/>
    <path d="M130 120 L260 120" stroke="#fff" stroke-width="6" opacity=".45" stroke-linecap="round"/>
    <text x="200" y="168" text-anchor="middle" font-family="Arial Black,Arial" font-size="20" font-weight="900" fill="#0B1736">20V</text>`,
  }];
}

function hammer() {
  const m = id('hm'); const h = id('hh');
  return [shadow(200, 350, 120, 12), {
    defs: lin(m, [[0, '#59636E'], [0.5, '#E6EAEE'], [1, '#4B545E']], 0, 0, 0, 1) + lin(h, [[0, '#0B1736'], [0.5, '#22396B'], [1, '#0B1736']]),
    body: `<g transform="rotate(-30 200 200)">
      <rect x="185" y="140" width="34" height="220" rx="10" fill="url(#${h})"/>
      <rect x="185" y="250" width="34" height="110" rx="10" fill="#DB020A"/>
      <path d="M110 100 L250 100 Q262 100 262 112 L262 150 L110 150 Q96 150 96 136 L96 114 Q96 100 110 100Z" fill="url(#${m})"/>
      <path d="M262 112 Q320 100 330 70 Q312 130 262 150 Z" fill="url(#${m})"/>
      <rect x="80" y="108" width="22" height="34" rx="4" fill="#4B545E"/></g>`,
  }];
}

function level() {
  const a = id('lv');
  return [shadow(200, 300, 160, 12), {
    defs: lin(a, [[0, '#FFE34D'], [0.5, '#FFEB00'], [1, '#D9B800']], 0, 0, 0, 1),
    body: `<g transform="rotate(-8 200 220)"><rect x="30" y="190" width="340" height="62" rx="8" fill="url(#${a})"/>
    <rect x="30" y="190" width="340" height="10" fill="#fff" opacity=".4"/>
    <rect x="170" y="200" width="60" height="42" rx="8" fill="#0B1736"/><rect x="180" y="210" width="40" height="22" rx="10" fill="#7CF0B2"/>
    <circle cx="200" cy="221" r="6" fill="#fff" opacity=".9"/>
    <rect x="60" y="205" width="40" height="30" rx="6" fill="#0B1736"/><rect x="66" y="211" width="28" height="18" rx="9" fill="#7CF0B2"/>
    <rect x="300" y="205" width="40" height="30" rx="6" fill="#0B1736"/><rect x="306" y="211" width="28" height="18" rx="9" fill="#7CF0B2"/></g>`,
  }];
}

function tape() {
  const c = id('tp');
  return [shadow(200, 330, 120, 14), {
    defs: lin(c, [[0, '#FFE34D'], [1, '#D9A800']], 0, 0, 1, 1),
    body: `<rect x="90" y="100" width="210" height="210" rx="60" fill="url(#${c})"/>
    <circle cx="195" cy="205" r="62" fill="#0B1736"/><circle cx="195" cy="205" r="40" fill="#22396B"/><circle cx="195" cy="205" r="12" fill="#C9D1D9"/>
    <rect x="290" y="276" width="80" height="26" fill="#F7F9FB" stroke="#C9D1D9"/><path d="M300 276v10M312 276v7M324 276v10M336 276v7M348 276v10M360 276v7" stroke="#0B1736" stroke-width="2"/>
    <rect x="300" y="268" width="14" height="42" rx="4" fill="#0B1736"/>`,
  }];
}

function wheelbarrow() {
  const t = id('wb');
  return [shadow(200, 352, 150, 14), {
    defs: lin(t, [[0, '#4CE0F5'], [0.5, '#3ED4ED'], [1, '#1A9DB4']], 0, 0, 0, 1),
    body: `<path d="M40 150 L300 150 L260 250 L90 250 Z" fill="url(#${t})"/>
    <path d="M40 150 L300 150 L296 162 L46 162 Z" fill="#1A9DB4"/>
    <path d="M250 240 L370 300" stroke="#2A3340" stroke-width="10" stroke-linecap="round"/>
    <path d="M110 250 L100 330 M230 250 L240 300" stroke="#2A3340" stroke-width="9" stroke-linecap="round"/>
    <circle cx="80" cy="300" r="44" fill="#1F2937"/><circle cx="80" cy="300" r="20" fill="#9AA5B1"/>
    <rect x="356" y="290" width="30" height="16" rx="8" fill="#DB020A"/>`,
  }];
}

function shovel() {
  const m = id('sv');
  return [shadow(200, 360, 90, 10), {
    defs: lin(m, [[0, '#6B7682'], [0.5, '#E6EAEE'], [1, '#56616C']]),
    body: `<g transform="rotate(20 200 200)"><rect x="190" y="30" width="20" height="200" rx="8" fill="#B7834A"/>
    <path d="M168 30 h64 v14 h-64z" fill="#0B1736"/><rect x="176" y="14" width="48" height="22" rx="10" fill="#0B1736"/>
    <path d="M140 230 h120 v110 q-60 30 -120 0 Z" fill="url(#${m})"/><rect x="186" y="214" width="28" height="30" rx="6" fill="#56616C"/></g>`,
  }];
}

function rebar() {
  const g = id('rb');
  let body = '';
  for (let i = 0; i < 9; i++) {
    const y = 150 + (i % 3) * 22 + Math.floor(i / 3) * 8;
    const x = 30 + Math.floor(i / 3) * 10;
    body += `<g transform="rotate(-16 200 200)"><rect x="${x}" y="${y}" width="340" height="16" rx="8" fill="url(#${g})"/>
      ${Array.from({ length: 22 }, (_, k) => `<path d="M${x + 10 + k * 15} ${y + 1} l6 14" stroke="#3B3F45" stroke-width="2.4" opacity=".55"/>`).join('')}</g>`;
  }
  body += `<g transform="rotate(-16 200 200)"><rect x="110" y="140" width="14" height="96" rx="4" fill="#3B3F45"/><rect x="270" y="140" width="14" height="96" rx="4" fill="#3B3F45"/></g>`;
  return [shadow(200, 320, 160, 16), { defs: lin(g, [[0, '#A9AFB6'], [0.4, '#6E747C'], [1, '#3F444B']], 0, 0, 0, 1), body }];
}

function coil({ color = '#9AA3AD', inner = '#5C6773', label }) {
  const g = id('co');
  let rings = '';
  for (let i = 0; i < 9; i++) rings += `<ellipse cx="200" cy="${200}" rx="${140 - i * 6}" ry="${110 - i * 5}" fill="none" stroke="url(#${g})" stroke-width="7"/>`;
  return [shadow(200, 330, 140, 14), {
    defs: lin(g, [[0, color], [0.5, '#fff'], [1, inner]], 0, 0, 1, 1),
    body: rings + `<ellipse cx="200" cy="200" rx="80" ry="60" fill="${inner}" opacity=".12"/>` +
      (label ? `<rect x="150" y="270" width="100" height="40" rx="8" fill="#FFEB00"/><text x="200" y="297" text-anchor="middle" font-family="Arial Black,Arial" font-size="18" font-weight="900" fill="#0B1736">${label}</text>` : ''),
  }];
}

function spool({ wire = '#DB020A', label }) {
  const s = id('sp'); const w = id('sw');
  let turns = '';
  for (let i = 0; i < 12; i++) turns += `<rect x="${118 + i * 14}" y="140" width="13" height="130" rx="6" fill="url(#${w})"/>`;
  return [shadow(200, 340, 150, 14), {
    defs: lin(s, [[0, '#0B1736'], [1, '#22396B']]) + lin(w, [[0, wire], [0.5, '#fff', 0.9], [1, wire]], 0, 0, 1, 0),
    body: `<ellipse cx="105" cy="205" rx="30" ry="110" fill="url(#${s})"/>${turns}<ellipse cx="295" cy="205" rx="30" ry="110" fill="url(#${s})"/>
    <ellipse cx="295" cy="205" rx="10" ry="34" fill="#F7F9FB"/>
    <rect x="160" y="190" width="80" height="34" rx="8" fill="#fff"/><text x="200" y="214" text-anchor="middle" font-family="Arial Black,Arial" font-size="17" font-weight="900" fill="#0B1736">${label}</text>`,
  }];
}

function sheet({ color, dark, ribs = 9, label, tile = false }) {
  const g = id('zs');
  let ribsSvg = '';
  const w = 280 / ribs;
  for (let i = 0; i < ribs; i++) {
    ribsSvg += tile
      ? `<path d="M${60 + i * w} 110 q${w / 2} -18 ${w} 0 v200 q-${w / 2} -18 -${w} 0z" fill="url(#${g})"/>`
      : `<rect x="${60 + i * w}" y="100" width="${w}" height="220" fill="url(#${g})"/>`;
  }
  let steps = '';
  if (tile) for (let k = 1; k < 4; k++) steps += `<path d="M60 ${110 + k * 50} L340 ${110 + k * 50}" stroke="${dark}" stroke-width="5" opacity=".6"/>`;
  return [shadow(200, 340, 160, 14), {
    defs: lin(g, [[0, dark], [0.5, color], [1, dark]]),
    body: `<g transform="skewY(-6) translate(0 30)">${ribsSvg}${steps}</g>` + (label ? `<rect x="250" y="300" width="96" height="34" rx="17" fill="#0B1736"/><text x="298" y="323" text-anchor="middle" font-family="Arial Black,Arial" font-size="15" font-weight="900" fill="#fff">${label}</text>` : ''),
  }];
}

function mesh() {
  let lines = '';
  for (let i = 0; i <= 10; i++) lines += `<path d="M${60 + i * 28} 80 L${60 + i * 28} 340" stroke="#6E747C" stroke-width="4"/><path d="M60 ${80 + i * 26} L340 ${80 + i * 26}" stroke="#868C94" stroke-width="4"/>`;
  return [shadow(200, 352, 150, 12), { body: `<g transform="skewX(-10) translate(30 0)">${lines}</g>` }];
}

function block({ holes = 2, w = 230 }) {
  const f = id('bf'); const t = id('bt');
  const x = 200 - w / 2;
  return [shadow(200, 330, w / 2 + 30, 14), {
    defs: lin(f, [[0, '#A7A9AC'], [1, '#7F8387']], 0, 0, 0, 1) + lin(t, [[0, '#D3D5D8'], [1, '#B9BCC0']]),
    body: `<path d="M${x} 160 L${x + 40} 120 L${x + w + 40} 120 L${x + w} 160 Z" fill="url(#${t})"/>
    ${Array.from({ length: holes }, (_, i) => `<path d="M${x + 30 + i * (w / holes)} 152 L${x + 52 + i * (w / holes)} 130 L${x + 22 + (i + 1) * (w / holes)} 130 L${x + (i + 1) * (w / holes)} 152 Z" fill="#6A6E73"/>`).join('')}
    <rect x="${x}" y="160" width="${w}" height="140" fill="url(#${f})"/>
    <path d="M${x + w} 160 L${x + w + 40} 120 L${x + w + 40} 260 L${x + w} 300 Z" fill="#8C9094"/>`,
  }];
}

function box({ color, dark, title, sub }) {
  const f = id('bx');
  return [shadow(200, 340, 140, 14), {
    defs: lin(f, [[0, color], [1, dark]], 0, 0, 0, 1),
    body: `<path d="M90 130 L150 90 L330 90 L270 130 Z" fill="${dark}"/>
    <rect x="90" y="130" width="180" height="190" fill="url(#${f})"/>
    <path d="M270 130 L330 90 L330 280 L270 320 Z" fill="${dark}"/>
    <rect x="104" y="170" width="152" height="70" rx="8" fill="#fff"/>
    <text x="180" y="204" text-anchor="middle" font-family="Arial Black,Arial" font-size="20" font-weight="900" fill="#0B1736">${title}</text>
    <text x="180" y="226" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#0B1736" opacity=".7">${sub}</text>`,
  }];
}

function toilet({ color = '#FFFFFF', shade = '#C9D1D9' }) {
  const g = id('tl');
  const dark = color !== '#FFFFFF';
  const stops = dark ? [[0, '#05070B'], [0.4, '#2B313A'], [1, '#05070B']] : [[0, shade], [0.4, '#FFFFFF'], [1, shade]];
  return [shadow(200, 360, 120, 14), {
    defs: lin(g, stops),
    body: `<rect x="120" y="50" width="170" height="120" rx="14" fill="url(#${g})"/><rect x="112" y="40" width="186" height="20" rx="8" fill="url(#${g})"/>
    <rect x="262" y="70" width="18" height="8" rx="4" fill="#9AA5B1"/>
    <path d="M90 180 Q90 160 120 160 L300 160 Q320 160 320 180 Q320 250 250 270 L240 340 L160 340 L150 270 Q90 250 90 180 Z" fill="url(#${g})"/>
    <ellipse cx="205" cy="180" rx="110" ry="26" fill="url(#${g})"/><ellipse cx="205" cy="182" rx="80" ry="15" fill="${dark ? '#000' : '#E3E8ED'}"/>`,
  }];
}

function deviceplate({ kind }) {
  const g = id('dp');
  const inner = kind === 'outlet'
    ? `<rect x="160" y="120" width="80" height="70" rx="22" fill="#F1F4F7" stroke="#C9D1D9" stroke-width="3"/><rect x="180" y="140" width="8" height="24" rx="3" fill="#0B1736"/><rect x="212" y="140" width="8" height="24" rx="3" fill="#0B1736"/><circle cx="200" cy="176" r="6" fill="#0B1736"/>
       <rect x="160" y="210" width="80" height="70" rx="22" fill="#F1F4F7" stroke="#C9D1D9" stroke-width="3"/><rect x="180" y="230" width="8" height="24" rx="3" fill="#0B1736"/><rect x="212" y="230" width="8" height="24" rx="3" fill="#0B1736"/><circle cx="200" cy="266" r="6" fill="#0B1736"/>`
    : kind === 'switch'
      ? `<rect x="170" y="150" width="60" height="100" rx="10" fill="#F1F4F7" stroke="#C9D1D9" stroke-width="3"/><rect x="180" y="160" width="40" height="44" rx="6" fill="#fff" stroke="#C9D1D9"/>`
      : '';
  return [shadow(200, 350, 100, 12), {
    defs: lin(g, [[0, '#FFFFFF'], [1, '#D9E0E6']], 0, 0, 1, 1),
    body: `<rect x="120" y="70" width="160" height="260" rx="18" fill="url(#${g})" stroke="#C9D1D9" stroke-width="2"/><circle cx="200" cy="92" r="5" fill="#C9D1D9"/><circle cx="200" cy="308" r="5" fill="#C9D1D9"/>${inner}`,
  }];
}

function bulb() {
  const g = id('bl'); const b = id('bb');
  return [shadow(200, 360, 70, 10), {
    defs: rad(g, [[0, '#FFFFFF'], [0.7, '#F5F7FA'], [1, '#D6DDE3']], 0.4, 0.35, 0.7) + lin(b, [[0, '#9AA3AD'], [0.5, '#F4F6F8'], [1, '#7C8691']]),
    body: `<circle cx="200" cy="150" r="100" fill="url(#${g})" stroke="#E3E8ED"/>
    <path d="M140 225 Q200 260 260 225 L250 270 L150 270 Z" fill="#fff" stroke="#E3E8ED"/>
    <rect x="152" y="268" width="96" height="20" rx="4" fill="#F1F4F7" stroke="#D6DDE3"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="160" y="${288 + i * 12}" width="80" height="12" rx="5" fill="url(#${b})"/>`).join('')}
    <path d="M190 336 h20 l-4 14 h-12z" fill="#2A3340"/>
    <text x="200" y="160" text-anchor="middle" font-family="Arial Black,Arial" font-size="26" font-weight="900" fill="#3ED4ED">LED</text>`,
  }];
}

function breaker() {
  const g = id('br');
  return [shadow(200, 350, 80, 12), {
    defs: lin(g, [[0, '#2A2F36'], [0.5, '#3E4550'], [1, '#1A1E24']]),
    body: `<rect x="150" y="60" width="100" height="280" rx="10" fill="url(#${g})"/>
    <rect x="165" y="150" width="70" height="90" rx="6" fill="#111"/><rect x="178" y="160" width="44" height="40" rx="6" fill="#DB020A"/>
    <text x="200" y="110" text-anchor="middle" font-family="Arial Black,Arial" font-size="22" font-weight="900" fill="#fff">20A</text>
    <rect x="160" y="270" width="80" height="20" rx="4" fill="#9AA5B1"/><rect x="160" y="80" width="80" height="12" rx="4" fill="#9AA5B1"/>`,
  }];
}

function roller() {
  const r = id('rl');
  return [shadow(200, 350, 140, 12), {
    defs: lin(r, [[0, '#DCE3EA'], [0.5, '#FFFFFF'], [1, '#B5C0CB']], 0, 0, 0, 1),
    body: `<path d="M60 320 L110 250 L330 250 L300 320 Z" fill="#3ED4ED"/><path d="M70 314 L112 258 L320 258 L296 314Z" fill="#1A9DB4" opacity=".5"/>
    <rect x="90" y="90" width="220" height="70" rx="35" fill="url(#${r})"/>
    <path d="M310 125 h30 v80 h-110 v40" stroke="#56616C" stroke-width="10" fill="none" stroke-linejoin="round"/>
    <rect x="212" y="240" width="36" height="90" rx="14" fill="#0B1736"/>`,
  }];
}

function brush() {
  const h = id('bh');
  return [shadow(200, 350, 90, 10), {
    defs: lin(h, [[0, '#C68A4E'], [0.5, '#E4B07A'], [1, '#A86E37']]),
    body: `<g transform="rotate(-18 200 200)"><rect x="180" y="40" width="40" height="150" rx="18" fill="url(#${h})"/><circle cx="200" cy="62" r="8" fill="#8A5A2B"/>
    <rect x="150" y="186" width="100" height="50" rx="6" fill="#B9C3CD"/><rect x="150" y="196" width="100" height="10" fill="#fff" opacity=".5"/>
    <path d="M150 236 h100 l-6 110 h-88z" fill="#2A2F36"/><path d="M160 300 h80" stroke="#3ED4ED" stroke-width="40" opacity=".0"/></g>`,
  }];
}

function door({ style = 'panel', color = '#C68A4E' }) {
  const g = id('dg'); const f = id('df');
  const glass = id('gl');
  const defs = lin(g, style === 'security' ? [[0, '#1F2630'], [0.5, '#3A434F'], [1, '#1A1F27']] : style === 'aluminum' ? [[0, '#B9C3CD'], [0.5, '#F4F6F8'], [1, '#AAB4BE']] : [[0, '#9C6A3A'], [0.5, color], [1, '#8A5A2B']]) +
    lin(f, [[0, '#E6EAEE'], [1, '#B9C3CD']]) + lin(glass, [[0, '#EAF6FA'], [0.5, '#FFFFFF'], [1, '#D3E7EE']], 0, 0, 1, 1);
  let inner = '';
  if (style === 'panel') inner = `<rect x="152" y="70" width="96" height="110" rx="4" fill="none" stroke="#7A4E25" stroke-width="5"/><rect x="152" y="200" width="96" height="120" rx="4" fill="none" stroke="#7A4E25" stroke-width="5"/>`;
  if (style === 'security') inner = [0, 1, 2, 3, 4].map((i) => `<rect x="196" y="${84 + i * 50}" width="40" height="8" rx="3" fill="#E6EAEE"/>`).join('') + `<rect x="152" y="140" width="8" height="120" rx="4" fill="#C9D1D9"/>`;
  if (style === 'aluminum') inner = `<rect x="148" y="66" width="104" height="260" rx="3" fill="url(#${glass})"/><path d="M160 90 q20 -12 40 0 t40 0 M160 300 q20 -12 40 0 t40 0" stroke="#C9D1D9" stroke-width="3" fill="none"/>`;
  const knob = style === 'security' ? '' : `<circle cx="${style === 'aluminum' ? 240 : 238}" cy="210" r="7" fill="#56616C"/><rect x="232" y="206" width="20" height="6" rx="3" fill="#56616C"/>`;
  return [shadow(200, 352, 110, 12), {
    defs,
    body: `<rect x="118" y="34" width="164" height="316" rx="4" fill="url(#${f})"/><rect x="130" y="46" width="140" height="300" rx="3" fill="url(#${g})"/>${inner}${knob}`,
  }];
}

function windowArt({ kind = 'sliding' }) {
  const fr = id('wf'); const gl = id('wg');
  const defs = lin(fr, [[0, '#C9D1D9'], [0.5, '#F4F6F8'], [1, '#AEB8C2']]) + lin(gl, [[0, '#BDEFF8'], [0.45, '#ECFAFD'], [0.55, '#FFFFFF'], [1, '#A8E5F1']], 0, 0, 1, 1);
  const inner = kind === 'sliding'
    ? `<rect x="70" y="90" width="132" height="220" fill="url(#${gl})"/><rect x="198" y="90" width="132" height="220" fill="url(#${gl})"/>
       <rect x="194" y="86" width="12" height="228" fill="url(#${fr})"/><rect x="184" y="180" width="6" height="40" rx="3" fill="#56616C"/>
       <path d="M90 120 L150 110 M220 140 L300 120" stroke="#fff" stroke-width="10" opacity=".6"/>`
    : Array.from({ length: 7 }, (_, i) => `<rect x="74" y="${96 + i * 30}" width="252" height="24" rx="2" fill="url(#${gl})" transform="skewX(-8)" stroke="#C9D1D9"/>`).join('') +
      `<rect x="330" y="120" width="12" height="40" rx="4" fill="#56616C"/>`;
  return [shadow(200, 350, 160, 12), { defs, body: `<rect x="58" y="78" width="284" height="244" rx="6" fill="url(#${fr})"/>${inner}` }];
}

function toolbox() {
  const g = id('tb');
  return [shadow(200, 340, 150, 14), {
    defs: lin(g, [[0, '#FFE34D'], [1, '#D9A800']], 0, 0, 0, 1),
    body: `<rect x="60" y="150" width="280" height="170" rx="18" fill="#0B1736"/>
    <rect x="60" y="120" width="280" height="70" rx="18" fill="url(#${g})"/>
    <path d="M140 120 q0 -50 60 -50 q60 0 60 50" stroke="#0B1736" stroke-width="16" fill="none"/>
    <rect x="80" y="180" width="30" height="24" rx="5" fill="#9AA5B1"/><rect x="290" y="180" width="30" height="24" rx="5" fill="#9AA5B1"/>
    <rect x="80" y="230" width="240" height="14" rx="7" fill="#22396B"/>`,
  }];
}

function trimmer() {
  const e = id('te');
  return [shadow(200, 352, 150, 12), {
    defs: lin(e, [[0, '#FFFFFF'], [0.5, '#E8EEF2'], [1, '#B5C0CB']], 0, 0, 0, 1),
    body: `<path d="M60 70 L320 300" stroke="#56616C" stroke-width="12" stroke-linecap="round"/>
    <rect x="70" y="60" width="120" height="80" rx="20" fill="url(#${e})"/><rect x="92" y="78" width="54" height="34" rx="10" fill="#DB020A"/>
    <rect x="150" y="120" width="70" height="14" rx="7" fill="#0B1736" transform="rotate(41 185 127)"/>
    <path d="M150 170 l60 -20 M150 170 l-20 40" stroke="#0B1736" stroke-width="10" stroke-linecap="round"/>
    <circle cx="320" cy="300" r="30" fill="#3ED4ED"/><path d="M300 330 q20 10 50 -2" stroke="#0B1736" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  }];
}

function nails() {
  return box({ color: '#3ED4ED', dark: '#1A9DB4', title: 'CLAVOS', sub: 'de techo · arandela' });
}

function glue() {
  const g = id('gu');
  return [shadow(200, 350, 80, 10), {
    defs: lin(g, [[0, '#7B8794'], [0.35, '#FFFFFF'], [0.65, '#C9D1D9'], [1, '#6B7682']]),
    body: `<rect x="140" y="130" width="120" height="210" rx="10" fill="url(#${g})"/>
    <rect x="140" y="170" width="120" height="120" fill="#3ED4ED"/>
    <rect x="152" y="190" width="96" height="60" rx="6" fill="#fff"/>
    <text x="200" y="218" text-anchor="middle" font-family="Arial Black,Arial" font-size="18" font-weight="900" fill="#0B1736">PVC</text>
    <text x="200" y="238" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#0B1736">Soldadura</text>
    <rect x="160" y="100" width="80" height="34" rx="6" fill="#DB020A"/>`,
  }];
}

function teflon() {
  return coil({ color: '#FFFFFF', inner: '#C9D1D9', label: 'TEFLÓN' });
}

function pile({ color, dark, stones = false }) {
  const g = id('pl');
  let dots = '';
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < (stones ? 120 : 260); i++) {
    const x = 70 + rnd() * 260; const y = 170 + rnd() * 160;
    const top = 330 - (1 - Math.abs(x - 200) / 140) * 170;
    if (y < top) continue;
    dots += stones
      ? `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(5 + rnd() * 7).toFixed(1)}" ry="${(4 + rnd() * 5).toFixed(1)}" fill="${rnd() > 0.5 ? '#9AA0A6' : '#6E747C'}"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1 + rnd() * 1.6).toFixed(1)}" fill="${dark}" opacity=".5"/>`;
  }
  return [shadow(200, 340, 160, 14), { defs: lin(g, [[0, color], [1, dark]], 0, 0, 0, 1), body: `<path d="M50 335 Q120 300 160 200 Q200 140 240 200 Q280 300 350 335 Z" fill="url(#${g})"/>${dots}` }];
}

// ---------- Producción ----------

const ART = {
  'cemento-gris': sack({ base: '#C9CED4', dark: '#8E959D', band: '#DB020A', label: 'CEMENTO', sub: 'GRIS · USO GENERAL' }),
  'arena-lavada': sack({ base: '#E9D8B4', dark: '#BFA676', band: '#0B1736', label: 'ARENA', sub: 'LAVADA · SACO' }),
  'piedra-triturada': sack({ base: '#D3D6DA', dark: '#8E959D', band: '#3ED4ED', label: 'PIEDRA', sub: 'TRITURADA 3/4"', bandText: '#0B1736' }),
  'pegamento-ceramica': sack({ base: '#F4F6F8', dark: '#B9C3CD', band: '#3ED4ED', label: 'PEGAMENTO', sub: 'PARA CERÁMICA', bandText: '#0B1736' }),
  'repello': sack({ base: '#FFF6B8', dark: '#D9C24D', band: '#0B1736', label: 'REPELLO', sub: 'MEZCLA LISTA' }),
  'bloque-4': block({ holes: 2, w: 200 }),
  'bloque-6': block({ holes: 3, w: 240 }),
  'varilla': rebar(),
  'alambre-amarre': coil({ color: '#9AA3AD', inner: '#4B545E', label: '#16' }),
  'malla': mesh(),
  'zinc': sheet({ color: '#F1F4F7', dark: '#9AA5B1', ribs: 11 }),
  'teja-pvc': sheet({ color: '#E2704A', dark: '#A8411F', ribs: 7, tile: true }),
  'clavos-techo': nails(),
  'taladro': drill(),
  'martillo': hammer(),
  'nivel': level(),
  'cinta-metrica': tape(),
  'carretilla': wheelbarrow(),
  'pala': shovel(),
  'caja-herramientas': toolbox(),
  'desbrozadora': trimmer(),
  'tubo-pvc': pipes({}),
  'tubo-pvc-sanitario': pipes({ color: '#F4F1E8', ends: '#BDB5A0' }),
  'codo-pvc': elbow({}),
  'tee-pvc': elbow({ tee: true }),
  'soldadura-pvc': glue(),
  'llave-fregadero': faucet({ tall: true }),
  'llave-lavamanos': faucet({ tall: false }),
  'inodoro-blanco': toilet({}),
  'inodoro-negro': toilet({ color: '#111' }),
  'teflon': teflon(),
  'cable-thhn': spool({ wire: '#DB020A', label: 'THHN' }),
  'tomacorriente': deviceplate({ kind: 'outlet' }),
  'interruptor': deviceplate({ kind: 'switch' }),
  'bombillo-led': bulb(),
  'breaker': breaker(),
  'pintura-latex': can({ body: '#3ED4ED', swatch: '#FFFFFF', title: 'LÁTEX', sub: 'Interior · mate' }),
  'pintura-esmalte': can({ body: '#DB020A', swatch: '#FFEB00', title: 'ESMALTE', sub: 'Brillante' }),
  'impermeabilizante': bucket({ color: '#DB020A', dark: '#99010A', title: 'IMPERMEA-', sub: 'BILIZANTE · techo' }),
  'pintura-cubeta': bucket({ color: '#3ED4ED', dark: '#1A9DB4', title: 'LÁTEX', sub: 'Cubeta 5 gal' }),
  'rodillo': roller(),
  'brocha': brush(),
  'puerta-madera': door({ style: 'panel' }),
  'puerta-seguridad': door({ style: 'security' }),
  'puerta-bano-aluminio': door({ style: 'aluminum' }),
  'ventana-corrediza': windowArt({ kind: 'sliding' }),
  'ventana-celosia': windowArt({ kind: 'louver' }),
  'arena-pila': pile({ color: '#E9D8B4', dark: '#B39260' }),
  'piedra-pila': pile({ color: '#B9BEC4', dark: '#80868D', stones: true }),
};

for (const [name, parts] of Object.entries(ART)) write(name, parts);
console.log(`Generadas ${Object.keys(ART).length} ilustraciones en ${OUT}`);
