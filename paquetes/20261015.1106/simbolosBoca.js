'use strict';
/*
 * LOS SÍMBOLOS DE LAS BOCAS SOBRE EL PLANO (15-oct-2026, JC: «la boca en el
 * plano quiero que tenga la forma del tipo de reja o difusor para que quede
 * más realista»). Nada de círculos: cada boca se dibuja con el símbolo de su
 * familia, como en un plano de clima:
 *
 *   rotacional   cuadrado con el remolino de ranuras (TROX VDW-Q, rotacionales)
 *   rotacionalR  lo mismo, redondo (VDW-R)
 *   cuadrado     multidireccional: cuadrados concéntricos y las diagonales
 *   conos        circular de conos: círculos concéntricos
 *   lineal       lineal de ranuras (PureLine): alargado con sus ranuras
 *   rejillaH     rejilla de lamas horizontales (X-Grille H, WG, TR2, retorno)
 *   rejillaV     rejilla de lamas verticales (X-Grille V)
 *   rejillaP     rejilla de placa perforada (X-Grille P)
 *   tobera       tobera de largo alcance
 *   extraccion   boca de extracción (válvula): círculo con su disco
 *   generico     uno digno cuando no se sabe qué es: cuadrado con la X de
 *                «terminal de aire» de los planos
 *
 * El dibujo va en `currentColor`: el color del estado (gris sin medir, verde
 * dentro, rojo fuera) lo pone quien lo pinta con la clase. Sirve igual en el
 * escritorio (balanceoPantalla.js) y en el móvil (renderer/movil/commissioning.js).
 */

const FAMILIAS_BOCA = {
  rotacional: { nombre: 'Difusor rotacional', ancho: 24, alto: 24 },
  rotacionalR: { nombre: 'Difusor rotacional redondo', ancho: 24, alto: 24 },
  cuadrado: { nombre: 'Difusor cuadrado', ancho: 24, alto: 24 },
  conos: { nombre: 'Difusor circular de conos', ancho: 24, alto: 24 },
  lineal: { nombre: 'Difusor lineal', ancho: 44, alto: 12 },
  rejillaH: { nombre: 'Rejilla de lamas horizontales', ancho: 32, alto: 18 },
  rejillaV: { nombre: 'Rejilla de lamas verticales', ancho: 32, alto: 18 },
  rejillaP: { nombre: 'Rejilla perforada', ancho: 28, alto: 20 },
  tobera: { nombre: 'Tobera', ancho: 24, alto: 24 },
  extraccion: { nombre: 'Boca de extracción', ancho: 22, alto: 22 },
  generico: { nombre: 'Terminal de aire', ancho: 22, alto: 22 },
};

/** La familia de dibujo de un tipo del catálogo (shared/commissioning/difusores.js › TIPOS). */
function familiaBoca(tipo) {
  const t = String(tipo || '');
  if (/^trox-vdw-r/.test(t)) return 'rotacionalR';
  if (/^trox-vdw|^rotacional/.test(t)) return 'rotacional';
  if (/^cuadrado/.test(t)) return 'cuadrado';
  if (/^circularConos/.test(t)) return 'conos';
  if (/^lineal|^trox-pl\d/.test(t)) return 'lineal';
  if (/^trox-xgm-v/.test(t)) return 'rejillaV';
  if (/^trox-xgm-p/.test(t)) return 'rejillaP';
  if (/^trox-xgm|^troxXgm|^troxWg|^troxTr2|^rejilla/.test(t)) return 'rejillaH';
  if (/^tobera/.test(t)) return 'tobera';
  if (/^bocaExt/.test(t)) return 'extraccion';
  return 'generico';
}

/* Los trazos de cada familia, en su propia caja (ancho × alto de arriba). */
function trazosBoca(familia) {
  const lineas = (pares) => pares.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
  switch (familia) {
    case 'rotacional': {
      /* El remolino: ranuras en aspa, giradas, alrededor del centro. */
      const r = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        const p = (rad, ang) => [12 + rad * Math.cos(ang), 12 + rad * Math.sin(ang)].map((v) => v.toFixed(2));
        const [x1, y1] = p(3.2, a); const [x2, y2] = p(8.6, a + 0.55);
        r.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
      }
      return `<rect class="cuerpo" x="1.5" y="1.5" width="21" height="21" rx="1.5"/>${r.join('')}<circle cx="12" cy="12" r="1.6"/>`;
    }
    case 'rotacionalR': {
      const r = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        const p = (rad, ang) => [12 + rad * Math.cos(ang), 12 + rad * Math.sin(ang)].map((v) => v.toFixed(2));
        const [x1, y1] = p(3.2, a); const [x2, y2] = p(8.4, a + 0.55);
        r.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
      }
      return `<circle class="cuerpo" cx="12" cy="12" r="10.5"/>${r.join('')}<circle cx="12" cy="12" r="1.6"/>`;
    }
    case 'cuadrado':
      return `<rect class="cuerpo" x="1.5" y="1.5" width="21" height="21" rx="1"/><rect x="5.5" y="5.5" width="13" height="13"/><rect x="9" y="9" width="6" height="6"/>${lineas([[1.5, 1.5, 9, 9], [22.5, 1.5, 15, 9], [1.5, 22.5, 9, 15], [22.5, 22.5, 15, 15]])}`;
    case 'conos':
      return '<circle class="cuerpo" cx="12" cy="12" r="10.5"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.5"/>';
    case 'lineal':
      return `<rect class="cuerpo" x="1" y="1" width="42" height="10" rx="1.5"/>${lineas([[4, 4, 40, 4], [4, 6, 40, 6], [4, 8, 40, 8]])}`;
    case 'rejillaH':
      return `<rect class="cuerpo" x="1" y="1" width="30" height="16" rx="1"/>${lineas([[4, 4.5, 28, 4.5], [4, 7.5, 28, 7.5], [4, 10.5, 28, 10.5], [4, 13.5, 28, 13.5]])}`;
    case 'rejillaV':
      return `<rect class="cuerpo" x="1" y="1" width="30" height="16" rx="1"/>${lineas([[6, 4, 6, 14], [11, 4, 11, 14], [16, 4, 16, 14], [21, 4, 21, 14], [26, 4, 26, 14]])}`;
    case 'rejillaP': {
      const puntos = [];
      for (let y = 5; y <= 15; y += 3.3) for (let x = 5; x <= 23; x += 3.6) puntos.push(`<circle class="lleno" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.9"/>`);
      return `<rect class="cuerpo" x="1" y="1" width="26" height="18" rx="1"/>${puntos.join('')}`;
    }
    case 'tobera':
      return '<circle class="cuerpo" cx="12" cy="12" r="10.5"/><circle cx="12" cy="12" r="5.5"/><circle class="lleno" cx="12" cy="12" r="2.2"/>';
    case 'extraccion':
      return '<circle class="cuerpo" cx="11" cy="11" r="9.5"/><circle class="lleno" cx="11" cy="11" r="4.2"/>';
    default:
      return `<rect class="cuerpo" x="1.5" y="1.5" width="19" height="19" rx="1.5"/>${lineas([[1.5, 1.5, 20.5, 20.5], [20.5, 1.5, 1.5, 20.5]])}`;
  }
}

/**
 * EL SVG DE UNA BOCA. `tipo` es el id del catálogo; `retorno` invierte el
 * relleno (las de retorno, huecas por dentro como en los planos). El tamaño en
 * pantalla lo pone el CSS (alto); el ancho sale de la proporción.
 */
function svgBoca(tipo, { clase = '', titulo = '' } = {}) {
  const familia = familiaBoca(tipo);
  const f = FAMILIAS_BOCA[familia];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<svg class="simbolo-boca ${esc(clase)}" data-familia="${familia}" viewBox="0 0 ${f.ancho} ${f.alto}" style="aspect-ratio:${f.ancho}/${f.alto}" aria-hidden="${titulo ? 'false' : 'true'}" focusable="false">${titulo ? `<title>${esc(titulo)}</title>` : ''}<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${trazosBoca(familia)}</g></svg>`;
}

/* Los colores del estado de una boca en papel (sin las variables de la pantalla). */
const COLOR_ESTADO_BOCA = {
  ok: '#1B7F3B', dentro: '#1B7F3B',
  alto: '#C62828', bajo: '#C62828',
  sinFactor: '#A15C00', sinProyecto: '#A15C00', sinTolerancia: '#A15C00', medido: '#A15C00',
  sinMedir: '#5F6B73',
};

/**
 * EL PLANO CON SUS BOCAS EN UN SOLO SVG, para el papel (la hoja de balanceo
 * en PDF): la imagen del plano y encima cada boca con su símbolo, su nombre y
 * su caudal medido, en el color de su estado. `puntos` = los del plano (x, y
 * de 0 a 1, tipo, nombre); `estados` = { puntoId: { estado, caudal } }.
 */
function planoSvgBocas({ imagen = null, ancho = 1600, alto = 900, puntos = [], estados = {} } = {}) {
  const W = Number(ancho) > 0 ? Number(ancho) : 1600;
  const H = Number(alto) > 0 ? Number(alto) : 900;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = Math.max(W, H) * 0.024;
  const fs = h * 0.62;
  const marcas = puntos.map((p) => {
    const familia = familiaBoca(p.tipo);
    const f = FAMILIAS_BOCA[familia];
    const e = estados[p.id] || {};
    const color = COLOR_ESTADO_BOCA[e.estado] || COLOR_ESTADO_BOCA.sinMedir;
    const k = h / 24;
    const cx = Number(p.x) * W;
    const cy = Number(p.y) * H;
    const sx = cx - (f.ancho * k) / 2;
    const sy = cy - (f.alto * k) / 2;
    const texto = `${p.nombre || ''}${e.caudal !== null && e.caudal !== undefined ? ` ${Math.round(e.caudal)}` : ''}`;
    const tw = texto.length * fs * 0.6 + fs * 0.6;
    const tx = cx + (f.ancho * k) / 2 + fs * 0.25;
    return `<g color="${color}"><g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${k.toFixed(3)})" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${trazosBoca(familia)}</g>`
      + `<rect x="${tx.toFixed(1)}" y="${(cy - fs * 0.72).toFixed(1)}" width="${tw.toFixed(1)}" height="${(fs * 1.44).toFixed(1)}" rx="${(fs * 0.2).toFixed(1)}" fill="#fff" stroke="currentColor" stroke-width="${(fs * 0.09).toFixed(2)}"/>`
      + `<text x="${(tx + fs * 0.3).toFixed(1)}" y="${(cy + fs * 0.36).toFixed(1)}" font-size="${fs.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="currentColor">${esc(texto)}</text></g>`;
  }).join('');
  return `<svg class="planoBocasSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`
    + '<style>.planoBocasSvg .cuerpo{fill:#fff;fill-opacity:.85}.planoBocasSvg .lleno{fill:currentColor}</style>'
    + (imagen ? `<image href="${esc(imagen)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` : `<rect width="${W}" height="${H}" fill="#F4F6F5"/>`)
    + marcas + '</svg>';
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SIMBOLOS_BOCA = API;
})({ FAMILIAS: FAMILIAS_BOCA, familia: familiaBoca, svg: svgBoca, planoSvg: planoSvgBocas, COLOR_ESTADO: COLOR_ESTADO_BOCA });
