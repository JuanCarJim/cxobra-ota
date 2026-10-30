'use strict';
/*
 * LA FORMA DE CADA MATERIAL EN EL PLANO (29-oct-2026, JC con la planta N60:
 * «cada equipo y material resaltado en el plano tiene que tener la forma del
 * elemento al que se refiere, igual que los difusores y rejillas en Balanceo»).
 *
 * Los difusores, rejillas, toberas y lineales usan LOS MISMOS dibujos que
 * Balanceo de caudales (shared/commissioning/simbolosBoca.js), no una copia.
 * Lo que Balanceo no tiene (compuertas, VAV, filtros, válvulas, detectores,
 * actuadores, sondas) se dibuja aquí con el mismo lenguaje: caja `.cuerpo`,
 * trazos en `currentColor`. El color lo pone la pantalla según el estado.
 *
 * El tamaño y la proporción salen de la medida del plano cuando la hay
 * («325x75» → una rejilla alargada; «Ø355» → algo más grande que un Ø160):
 * es un tamaño RELATIVO, porque el plano no trae la escala. La orientación,
 * si algún día el plano la da (`giro`, en grados); si no, horizontal.
 */

/* Dentro de una función: en la web y el móvil todos los scripts comparten el ámbito global. */
(function () {
const SB = (typeof module !== 'undefined' && module.exports)
  ? require('./simbolosBoca')
  : (typeof window !== 'undefined' ? window.SIMBOLOS_BOCA : null);

const L = (pares) => pares.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');

/* Las formas propias de esta pantalla, en su caja ancho × alto. */
const PROPIAS = {
  compuertaCF: { nombre: 'Compuerta cortafuegos', ancho: 24, alto: 16, rect: true,
    trazos: `<rect class="cuerpo" x="1" y="1" width="22" height="14" rx="1"/>${L([[1, 15, 23, 1]])}<path class="lleno" d="M1 15L1 7.5L12 15Z"/>` },
  compuertaRegulacion: { nombre: 'Compuerta de regulación', ancho: 24, alto: 16, rect: true,
    trazos: `<rect class="cuerpo" x="1" y="1" width="22" height="14" rx="1"/>${L([[6, 13, 18, 3]])}<circle class="lleno" cx="12" cy="8" r="1.7"/>` },
  compuertaSobrepresion: { nombre: 'Compuerta de sobrepresión', ancho: 24, alto: 16, rect: true,
    trazos: `<rect class="cuerpo" x="1" y="1" width="22" height="14" rx="1"/>${L([[4, 12, 8, 4], [10, 12, 14, 4], [16, 12, 20, 4]])}` },
  vav: { nombre: 'Regulador VAV', ancho: 30, alto: 16, rect: true,
    trazos: `<rect class="cuerpo" x="7" y="1" width="22" height="14" rx="1"/><path d="M1 4.5h6M1 11.5h6"/>${L([[13, 12, 23, 4]])}<circle class="lleno" cx="18" cy="8" r="1.6"/>` },
  filtro: { nombre: 'Filtro', ancho: 24, alto: 16, rect: true,
    trazos: '<rect class="cuerpo" x="1" y="1" width="22" height="14" rx="1"/><path d="M4 3l3 10 3-10 3 10 3-10 3 10 3-10"/>' },
  detector: { nombre: 'Detector', ancho: 22, alto: 22,
    trazos: '<circle class="cuerpo" cx="11" cy="11" r="9.5"/><circle cx="11" cy="11" r="5"/><circle class="lleno" cx="11" cy="11" r="1.8"/>' },
  valvula: { nombre: 'Válvula', ancho: 24, alto: 16,
    trazos: '<path class="cuerpo" d="M2 2L12 8L2 14Z"/><path class="cuerpo" d="M22 2L12 8L22 14Z"/>' },
  actuador: { nombre: 'Actuador', ancho: 22, alto: 22,
    trazos: '<circle class="cuerpo" cx="11" cy="11" r="9.5"/><path d="M6.5 15V7l4.5 5 4.5-5v8"/>' },
  sonda: { nombre: 'Sonda', ancho: 18, alto: 24,
    trazos: '<circle class="cuerpo" cx="9" cy="17" r="5.5"/><path d="M9 11.5V2"/><circle class="lleno" cx="9" cy="17" r="2"/>' },
};

/* Familias de Balanceo que se estiran con la medida (las rectangulares). */
const RECTANGULARES_BOCA = new Set(['lineal', 'rejillaH', 'rejillaV', 'rejaRetorno', 'rejillaP']);

/* Los nombres que se leen en la leyenda (los de Balanceo, en su sitio). */
const NOMBRE_BOCA = { rejillaV: 'Rejilla exterior (lamas)', rejillaP: 'Rejilla intumescente / de paso', rejaRetorno: 'Reja de retorno', rejillaH: 'Rejilla de lamas' };

/** El prefijo del código CAD o del TAG («DR_04_DD03» → DR; «N60-RR-014» → RR). */
function prefijo(m) {
  const c = String((m && m.codigo) || '').toUpperCase();
  const a = c.match(/^([A-Z]{1,4})(?=[_\-\s.\d]|$)/);
  if (a) return a[1];
  const t = String((m && m.tag) || '').toUpperCase().split(/[-_\s]/).find((p) => /^[A-Z]{1,4}$/.test(p) && !/^N\d/.test(p));
  return t || '';
}

/**
 * LA FORMA de un material: el id de la forma (de Balanceo o propia) según su
 * tipo y el prefijo del código. Un difusor rotacional es redondo, uno lineal
 * alargado, una reja de retorno rectangular con lamas, una compuerta con su
 * hoja, un VAV con su caja y su boca, etc.
 */
function formaDe(m) {
  const tipo = String((m && m.tipo) || '');
  const pre = prefijo(m);
  switch (tipo) {
    case 'difusor':
      if (pre === 'DC') return 'conos';
      if (pre === 'DF' || pre === 'DIF' || pre === 'DT') return 'cuadrado';
      return 'rotacionalR';
    case 'difusorLineal': return 'lineal';
    case 'tobera': return 'tobera';
    case 'rejilla':
      if (pre === 'RR' || pre === 'RET' || pre === 'RA') return 'rejaRetorno';
      if (pre === 'EXT') return 'extraccion';
      return 'rejillaH';
    case 'rejaExterior': return 'rejillaV';
    case 'rejillaIntumescente': return 'rejillaP';
    case 'compuertaCortafuegos': return 'compuertaCF';
    case 'compuertaRegulacion': return 'compuertaRegulacion';
    case 'compuertaSobrepresion': return 'compuertaSobrepresion';
    case 'vav': case 'filtro': case 'detector': case 'valvula': case 'actuador': case 'sonda': return tipo;
    default: return 'generico';
  }
}

/** La caja, el nombre y los trazos de una forma. */
function definicion(forma) {
  if (PROPIAS[forma]) return { ...PROPIAS[forma], id: forma };
  const fam = SB && SB.FAMILIAS && SB.FAMILIAS[forma] ? forma : 'generico';
  const f = (SB && SB.FAMILIAS && SB.FAMILIAS[fam]) || { nombre: 'Terminal de aire', ancho: 22, alto: 22 };
  return { id: fam, nombre: NOMBRE_BOCA[fam] || f.nombre, ancho: f.ancho, alto: f.alto, rect: RECTANGULARES_BOCA.has(fam), trazos: SB && SB.trazos ? SB.trazos(fam) : '' };
}

/** La medida del plano: «Ø315» → { d: 315 }; «325x75» → { a: 325, b: 75 }; si no, null. */
function leerMedida(texto) {
  const t = String(texto || '').replace(/\s+/g, '').replace(',', '.');
  let r = t.match(/^(?:Ø|ø|D|DN)(\d+(?:\.\d+)?)/i);
  if (r) return { d: Number(r[1]) };
  r = t.match(/^(\d+(?:\.\d+)?)[x×X*](\d+(?:\.\d+)?)/);
  if (r) return { a: Number(r[1]), b: Number(r[2]) };
  r = t.match(/^(\d{2,4})(?:mm)?$/);
  if (r) return { d: Number(r[1]) };
  return null;
}

const ALTO_BASE = 13; /* px del lado corto a zoom 1 */
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * EL DIBUJO DE UN MATERIAL EN EL PLANO: { forma, nombre, ancho, alto, w, h, giro, trazos }.
 * w × h en px de pantalla a zoom 1 (la pantalla lo multiplica por su escala).
 */
function formaMaterial(m) {
  const forma = formaDe(m);
  const def = definicion(forma);
  const car = (m && m.caracteristicas) || {};
  const med = leerMedida(car.Medida || car.Cuello || car.Longitud || car.DN);
  let k = 1;
  let ratio = null;
  if (med && med.d) k = limitar(med.d / 250, 0.8, 1.5);
  if (med && med.a && med.b) {
    const largo = Math.max(med.a, med.b); const corto = Math.min(med.a, med.b);
    k = limitar(largo / 450, 0.8, 1.7);
    if (def.rect) ratio = limitar(largo / corto, 1.2, 5);
  }
  /* El lado corto mide ALTO_BASE × k; el largo, el de la proporción del dibujo o la de la medida. */
  const corto = ALTO_BASE * k;
  const r0 = Math.max(def.ancho, def.alto) / Math.min(def.ancho, def.alto);
  const largo = corto * (ratio || r0);
  const apaisado = def.ancho >= def.alto;
  const w = apaisado ? largo : corto; const h = apaisado ? corto : largo;
  const giro = Number(m && m.giro);
  return {
    forma: def.id, nombre: def.nombre, ancho: def.ancho, alto: def.alto,
    w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10,
    giro: Number.isFinite(giro) ? giro : 0, trazos: def.trazos,
  };
}

/*
 * EL TAMAÑO REAL (30-oct, coordinador tras mirar la N60 al 676 %: «las formas
 * siguen siendo enormes respecto al plano; tienen que ir en coordenadas del
 * plano, con su tamaño real aproximado»). La cara de cada elemento en mm,
 * ancho × alto en la orientación del dibujo, cuando el plano no da la medida.
 */
const REAL_MM = {
  rotacional: [600, 600], rotacionalR: [600, 600], cuadrado: [600, 600], conos: [450, 450],
  lineal: [1200, 100], tobera: [250, 250], extraccion: [300, 300], generico: [400, 400],
  rejillaH: [400, 200], rejaRetorno: [600, 300], rejillaV: [1000, 500], rejillaP: [400, 200],
  compuertaCF: [400, 300], compuertaRegulacion: [400, 300], compuertaSobrepresion: [300, 200],
  vav: [900, 350], filtro: [600, 600], detector: [100, 100], valvula: [200, 120], actuador: [150, 150], sonda: [80, 110],
};
const CARA_REDONDA = new Set(['rotacional', 'rotacionalR', 'cuadrado', 'conos']);

/**
 * El tamaño real aproximado de un material en mm: { w, h } en la orientación
 * del dibujo. «400x200» se toma tal cual; «Ø160» es el cuello (la cara de un
 * difusor rotacional es mayor); en un lineal, la longitud.
 */
function tamanoReal(m) {
  const forma = formaDe(m);
  const def = definicion(forma);
  const [bw, bh] = REAL_MM[def.id] || REAL_MM[forma] || REAL_MM.generico;
  const car = (m && m.caracteristicas) || {};
  if (def.id === 'lineal') {
    const lon = leerMedida(car.Longitud || car.Medida);
    const l = lon && (lon.a ? Math.max(lon.a, lon.b) : lon.d);
    return { w: limitar(l || bw, 300, 6000), h: bh };
  }
  const med = leerMedida(car.Medida || car.Cuello || car.DN);
  if (med && med.a && med.b) {
    const largo = Math.max(med.a, med.b); const corto = Math.min(med.a, med.b);
    return bw >= bh ? { w: largo, h: corto } : { w: corto, h: largo };
  }
  if (med && med.d) {
    if (CARA_REDONDA.has(def.id)) { const c = Math.max(bw, med.d * 2.5); return { w: c, h: c }; }
    if (def.id === 'tobera') { const c = Math.max(150, med.d * 1.3); return { w: c, h: c }; }
    const k = limitar(med.d / 250, 0.6, 2);
    return { w: Math.round(bw * k), h: Math.round(bh * k) };
  }
  return { w: bw, h: bh };
}

/*
 * LA ESCALA DEL PLANO en mm por píxel de la imagen. La imagen no trae la
 * escala, así que se estima con lo que hay dentro: los difusores de un techo
 * van a unos 3,8 m unos de otros (la mediana de la distancia al vecino más
 * cercano); sin difusores, cualquier terminal a unos 2,2 m. En la N60 de Nou
 * Camp Nou las dos cuentas dan 73 y 76 mm/px, coherente con una hoja A0 a
 * 1:300. Si un plano trae `mmPorPx` (una cota medida), manda esa.
 */
const ESPACIO_DIFUSORES_MM = 3800;
const ESPACIO_TERMINALES_MM = 2200;

function medianaVecino(puntos) {
  if (puntos.length < 2) return 0;
  const d = puntos.map((a) => {
    let min = Infinity;
    for (const b of puntos) if (b !== a) { const k = Math.hypot(a[0] - b[0], a[1] - b[1]); if (k > 0 && k < min) min = k; }
    return min;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  return d.length ? d[d.length >> 1] : 0;
}

/** { mmPorPx, origen } de un plano { ancho, alto, mmPorPx? } con sus materiales colocados. */
function escalaPlano(plano, materiales) {
  if (!plano || !(plano.ancho > 0)) return { mmPorPx: 0, origen: 'sin plano' };
  if (Number(plano.mmPorPx) > 0) return { mmPorPx: Number(plano.mmPorPx), origen: 'cota' };
  const alto = plano.alto > 0 ? plano.alto : plano.ancho;
  const pts = (materiales || []).filter((m) => m && m.x !== null && m.x !== undefined && m.y !== null && m.y !== undefined)
    .map((m) => [Number(m.x) * plano.ancho, Number(m.y) * alto, String(m.tipo || '')]);
  const dif = pts.filter((p) => /^difusor/.test(p[2]));
  if (dif.length >= 8) { const md = medianaVecino(dif); if (md > 0) return { mmPorPx: ESPACIO_DIFUSORES_MM / md, origen: 'difusores' }; }
  if (pts.length >= 8) { const md = medianaVecino(pts); if (md > 0) return { mmPorPx: ESPACIO_TERMINALES_MM / md, origen: 'terminales' }; }
  /* Sin nada que medir: una hoja A1 (841 mm) a 1:100. */
  return { mmPorPx: (841 * 100) / plano.ancho, origen: 'supuesta' };
}

/**
 * La caja de un material EN EL PLANO: ancho como fracción del ancho del plano
 * (wf) y la proporción ancho/alto (ar). Así crece igual que el plano al acercar.
 */
function cajaEnPlano(m, plano, mmPorPx) {
  const r = tamanoReal(m);
  const wf = plano && plano.ancho > 0 && mmPorPx > 0 ? r.w / mmPorPx / plano.ancho : 0;
  return { wf, ar: r.w / r.h, wmm: r.w, hmm: r.h };
}

/*
 * LOS EQUIPOS A SU TAMAÑO (30-oct, JC: «hay que poder ampliar más y reducir el
 * tamaño de los iconos»). Un lado típico en mm de cada clase de icono
 * (planoEquipos.ICONOS), visto en planta: una unidad interior de conductos
 * ronda 0,8 m, un recuperador 1,4 m, un extractor de baño 0,45 m, una UTA 3 m.
 * El icono es cuadrado, así que basta un lado.
 */
const EQUIPO_MM = {
  uta: 3000, hru: 1400, fancoil: 800, vrfInt: 800, splitInt: 900, vrfExt: 1300, splitExt: 900,
  rooftop: 2500, crac: 1200, chiller: 4000, bomba: 600, ventilador: 450, agua: 500, generico: 600,
};
/** La caja de un equipo en el plano: { wf, ar: 1, mm } (wf, fracción del ancho del plano). */
function cajaEquipo(icono, plano, mmPorPx) {
  const mm = EQUIPO_MM[icono] || EQUIPO_MM.generico;
  const wf = plano && plano.ancho > 0 && mmPorPx > 0 ? mm / mmPorPx / plano.ancho : 0;
  return { wf, ar: 1, mm };
}

/** El SVG de un material (se estira a w × h sin engordar el trazo). */
function svgMaterial(m, { clase = 'peForma' } = {}) {
  const f = formaMaterial(m);
  return `<svg class="${clase}" data-forma="${f.forma}" viewBox="0 0 ${f.ancho} ${f.alto}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${f.trazos}</g></svg>`;
}

/** El SVG de una forma para la leyenda, con su proporción. */
function svgForma(forma, { clase = 'peForma' } = {}) {
  const d = definicion(forma);
  return `<svg class="${clase}" data-forma="${d.id}" viewBox="0 0 ${d.ancho} ${d.alto}" style="aspect-ratio:${d.ancho}/${d.alto}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d.trazos}</g></svg>`;
}

/** La leyenda de las formas que salen en una lista de materiales: [{ forma, nombre, n }], de más a menos. */
function leyendaFormas(materiales) {
  const n = new Map();
  for (const m of materiales || []) { const f = formaDe(m); n.set(f, (n.get(f) || 0) + 1); }
  return [...n.entries()].map(([forma, k]) => ({ forma: definicion(forma).id, nombre: definicion(forma).nombre, n: k })).sort((a, b) => b.n - a.n);
}

/**
 * LA SALA PARTIDA en nombre y código (29-oct, JC: «Cuarto Eléctrico ·
 * P3.STE.0007» en una línea y el código debajo en gris). Si solo hay código,
 * el nombre queda vacío.
 */
function partirSala(sala) {
  const t = String(sala || '').trim();
  if (!t) return { nombre: '', codigo: '' };
  const i = t.lastIndexOf(' · ');
  if (i > 0) return { nombre: t.slice(0, i).trim(), codigo: t.slice(i + 3).trim() };
  if (/^[A-Z]\d?\.[A-Z]{2,4}\.\d{2,5}$/i.test(t) || /^[A-Z]{1,3}\d?[.-][A-Z]{2,4}[.-]\d{2,5}$/i.test(t)) return { nombre: '', codigo: t };
  return { nombre: t, codigo: '' };
}

const API = { PROPIAS, REAL_MM, EQUIPO_MM, cajaEquipo, prefijo, formaDe, definicion, leerMedida, formaMaterial, tamanoReal, escalaPlano, cajaEnPlano, svgMaterial, svgForma, leyendaFormas, partirSala };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FORMAS_PLANO = API;
})();
