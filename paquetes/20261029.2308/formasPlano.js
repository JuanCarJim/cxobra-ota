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

const API = { PROPIAS, prefijo, formaDe, definicion, leerMedida, formaMaterial, svgMaterial, svgForma, leyendaFormas, partirSala };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FORMAS_PLANO = API;
})();
