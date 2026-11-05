'use strict';
/*
 * LO QUE MIDE UNA MARCA DEL PLANO (16-oct-2026, JC: «que de lo que marque el
 * encargado, el programa sea capaz de medir esos metros o equipos»).
 *
 * Los puntos de una marca van en coordenadas relativas a la imagen (0..1 en
 * ancho y en alto). Con el tamaño de la imagen en píxeles (ancho, alto) y la
 * escala del plano (los metros que mide su ancho), un píxel vale
 * escala / ancho metros en las dos direcciones.
 *
 *   trazo  → metros (la suma de sus tramos)        unidad 'm'
 *   zona   → metros cuadrados (el polígono)        unidad 'm2'
 *   punto  → 1 unidad                              unidad 'ud'
 *
 * Sin escala, un trazo o una zona no miden: `cantidad` null.
 *
 * Lo que VALE una marca (cantidadMarca): lo tecleado si lo hay; si no, lo
 * medido más los metros `extra` de subidas y bajadas (solo en trazos).
 */

const UNIDAD_TIPO = { trazo: 'm', zona: 'm2', punto: 'ud' };
const red2 = (n) => Math.round(n * 100) / 100;

function leerPuntos(puntos) {
  let p = puntos;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = []; } }
  return (Array.isArray(p) ? p : [])
    .map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: Number(q && q.x), y: Number(q && q.y) }))
    .filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
}

/** { cantidad, unidad } de una marca sobre un plano { ancho, alto, escala }. */
function medirMarca(marca, plano = {}) {
  const tipo = marca && marca.tipo;
  const unidad = UNIDAD_TIPO[tipo] || null;
  if (tipo === 'punto') return { cantidad: 1, unidad };
  const ancho = Number(plano.ancho) || 0;
  const alto = Number(plano.alto) || 0;
  const escala = Number(plano.escala) || 0;
  if (!unidad || !(ancho > 0 && alto > 0 && escala > 0)) return { cantidad: null, unidad };
  const m = escala / ancho;
  const pts = leerPuntos(marca.puntos).map((q) => ({ x: q.x * ancho * m, y: q.y * alto * m }));
  if (tipo === 'trazo') {
    let l = 0;
    for (let i = 1; i < pts.length; i += 1) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { cantidad: pts.length > 1 ? red2(l) : null, unidad };
  }
  if (pts.length < 3) return { cantidad: null, unidad };
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]; const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return { cantidad: red2(Math.abs(a) / 2), unidad };
}

/**
 * Lo que vale una marca para medir: lo que tecleó el encargado si lo puso;
 * si no, lo que mide en el plano.
 */
function cantidadMarca(marca, plano) {
  const t = marca && marca.cantidad;
  if (t !== null && t !== undefined && t !== '' && Number.isFinite(Number(t))) return Number(t);
  const medido = medirMarca(marca, plano).cantidad;
  /* Las subidas y bajadas no se ven en planta (JC, 16-oct): el encargado
     pone a ojo los metros de más y se suman a lo medido. */
  const extra = Number(marca && marca.extra);
  if (Number.isFinite(extra) && extra > 0 && marca.tipo === 'trazo') return red2((medido || 0) + extra);
  return medido;
}

/* ═══════════════ De los metros del trazo a la unidad de la partida (16-oct-2026)
 *
 * JC: «hay que tener en cuenta para la certificación las tuberías, el número,
 * los diámetros distintos, tipo de conducto y tal cuando el encargado lo
 * marque». Las partidas van por diámetro y material, y cada una se mide en
 * su unidad. Lo que vale una marca PARA SU PARTIDA:
 *
 *   recorrido = lo tecleado, o lo medido + subidas y bajadas   (cantidadMarca)
 *   m    → recorrido × nº de tubos/circuitos en paralelo
 *   m2   → recorrido × nº × perímetro de la sección (chapa de conducto):
 *          rectangular 2·(a+b), circular π·Ø, en metros
 *   kg   → recorrido × nº × kg por metro, solo si se sabe; si no, no se inventa
 *   ud   → solo los puntos (cada uno, sus unidades)
 *   zona → m2 tal cual
 * Si falta un dato (la sección, el peso, la escala) o la unidad no casa con
 * lo marcado, NO hay cantidad: sale con `falta` para que alguien lo complete.
 */

/** La unidad de una partida, en limpio: m, m2, m3, ud, kg o lo que traiga. */
function unidadMedNormal(u) {
  const t = String(u ?? '').trim().toLowerCase().replace(/\.$/, '').replace('²', '2').replace('³', '3').replace(/\s+/g, '');
  if (!t) return null;
  if (['m', 'ml', 'm.l', 'mts', 'metro', 'metros', 'mlineal'].includes(t)) return 'm';
  if (['m2', 'm^2', 'metro2'].includes(t)) return 'm2';
  if (['m3', 'm^3'].includes(t)) return 'm3';
  if (['ud', 'u', 'un', 'uds', 'und', 'unidad', 'unidades', 'pza', 'pz'].includes(t)) return 'ud';
  if (['kg', 'kgs', 'kilo', 'kilos'].includes(t)) return 'kg';
  return t;
}

/** Nº de tubos/circuitos en paralelo: un entero de 1 a 50 (1 si no se sabe). */
function paralelosDe(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 1;
}

const mm = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 10) / 10 : null; };

/**
 * La sección de un conducto: { forma: 'rect', ancho, alto } o
 * { forma: 'circ', diametro } en mm, y `kgm` (kg por metro) si se sabe. Lee
 * un objeto, su JSON o un texto («400x300», «400×300», «Ø250», «250»).
 */
function leerSeccion(s) {
  let x = s;
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'string') {
    const t = x.trim();
    if (t.startsWith('{')) {
      try { x = JSON.parse(t); } catch { return null; }
    } else {
      const r = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i.exec(t);
      if (r) return mm(r[1]) && mm(r[2]) ? { forma: 'rect', ancho: mm(r[1]), alto: mm(r[2]) } : null;
      const c = /^(?:Ø|ø|di[aá]m(?:etro)?\.?|d)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?$/i.exec(t);
      return c && mm(c[1]) ? { forma: 'circ', diametro: mm(c[1]) } : null;
    }
  }
  if (!x || typeof x !== 'object') return null;
  const kgm = Number(x.kgm) > 0 && Number(x.kgm) < 10000 ? Number(x.kgm) : null;
  let r = null;
  if (x.forma === 'circ' && mm(x.diametro)) r = { forma: 'circ', diametro: mm(x.diametro) };
  else if (x.forma === 'rect' && mm(x.ancho) && mm(x.alto)) r = { forma: 'rect', ancho: mm(x.ancho), alto: mm(x.alto) };
  if (kgm) r = { ...(r || {}), kgm };
  return r;
}

/** El perímetro de la sección, en metros (null si no hay sección). */
function perimetro(sec) {
  const s = leerSeccion(sec);
  if (!s) return null;
  if (s.forma === 'rect') return (2 * (s.ancho + s.alto)) / 1000;
  if (s.forma === 'circ') return (Math.PI * s.diametro) / 1000;
  return null;
}

/** «400×300» o «Ø250» para enseñar una sección. */
function textoSeccion(sec) {
  const s = leerSeccion(sec);
  if (!s) return '';
  if (s.forma === 'rect') return `${s.ancho}×${s.alto}`;
  if (s.forma === 'circ') return `Ø${s.diametro}`;
  return '';
}

/**
 * Lo que vale una marca en la unidad de su partida.
 * { cantidad, unidad, recorrido, paralelos, falta } — `falta`: 'escala'
 * (no mide), 'seccion' (m² sin sección), 'peso' (kg sin kg/m) o 'unidad'
 * (lo marcado no se mide en la unidad de esa partida).
 */
function cantidadPartida(marca, plano, unidadPartida) {
  const tipo = marca && marca.tipo;
  const natural = UNIDAD_TIPO[tipo] || null;
  const unidad = unidadMedNormal(unidadPartida) || natural;
  const n = tipo === 'trazo' ? paralelosDe(marca.paralelos) : 1;
  const base = cantidadMarca(marca, plano);
  const res = (cantidad, falta = null) => ({ cantidad, unidad, recorrido: base, paralelos: n, falta });
  if (base === null || base === undefined || !Number.isFinite(Number(base))) return res(null, 'escala');
  if (tipo === 'punto') return unidad === 'ud' ? res(red2(base)) : res(null, 'unidad');
  if (tipo === 'zona') return unidad === 'm2' ? res(red2(base)) : res(null, 'unidad');
  if (tipo !== 'trazo') return res(null, 'unidad');
  if (unidad === 'm') return res(red2(base * n));
  if (unidad === 'm2') {
    const p = perimetro(marca.seccion);
    return p ? res(red2(base * n * p)) : res(null, 'seccion');
  }
  if (unidad === 'kg') {
    const s = leerSeccion(marca.seccion);
    return s && s.kgm ? res(red2(base * n * s.kgm)) : res(null, 'peso');
  }
  return res(null, 'unidad');
}

const FALTA = {
  escala: 'el plano no tiene escala: no mide',
  seccion: 'la partida va en m² y falta la sección del conducto',
  peso: 'la partida va en kg y falta el peso por metro',
  unidad: 'lo marcado no se mide en la unidad de esa partida',
};

const UD_TEXTO = { m2: 'm²', m3: 'm³' };

/** La cuenta en palabras: «12,5 m × 2 × 1,4 m de perímetro (400×300) = 35 m²». */
function explicarCuenta(marca, plano, unidadPartida) {
  const r = cantidadPartida(marca, plano, unidadPartida);
  if (r.falta) return FALTA[r.falta];
  const f = (x) => String(red2(x)).replace('.', ',');
  const u = UD_TEXTO[r.unidad] || r.unidad;
  if (marca.tipo !== 'trazo') return `${f(r.cantidad)} ${u}`;
  const partes = [`${f(r.recorrido)} m`];
  if (r.paralelos > 1) partes.push(`${r.paralelos}`);
  if (r.unidad === 'm2') partes.push(`${f(perimetro(marca.seccion))} m de perímetro (${textoSeccion(marca.seccion)})`);
  if (r.unidad === 'kg') partes.push(`${f(leerSeccion(marca.seccion).kgm)} kg/m`);
  return partes.length > 1 ? `${partes.join(' × ')} = ${f(r.cantidad)} ${u}` : `${f(r.cantidad)} ${u}`;
}

/*
 * LA MEDIDA DE UNA PARTIDA, LEÍDA DE SU TEXTO: «Tubería acero negro DN50»
 * → DN50; «Conducto circular Ø250» → Ø250; «Bandeja 300×60» → 300×60;
 * «Cable RZ1-K 5G6» → 5G6. Para el botón grande de la tablet y la etiqueta
 * del trazo en el plano. Sin medida en el texto: ''.
 */
function medidaDeTexto(texto) {
  const t = String(texto || '');
  let r = /\bDN\s*(\d{1,4})\b/i.exec(t);
  if (r) return `DN${r[1]}`;
  r = /(?:Ø|ø|\bdi[aá]m(?:etro)?\.?\s*)\s*(\d{1,4}(?:[.,]\d+)?)/i.exec(t);
  if (r) return `Ø${r[1]}`;
  r = /\b(\d{1,2})\s*G\s*(\d{1,3}(?:[.,]\d+)?)\b/.exec(t);
  if (r) return `${r[1]}G${r[2]}`;
  r = /\b(\d{2,4})\s*[x×]\s*(\d{2,4})\b/.exec(t);
  if (r) return `${r[1]}×${r[2]}`;
  r = /\b(\d{1,2})\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)\s*mm2?\b/i.exec(t);
  if (r) return `${r[1]}×${r[2]}`;
  r = /(\d+(?:\s+\d\/\d)?|\d\/\d)\s*(?:"|''|”|pulg)/i.exec(t);
  if (r) return `${r[1].replace(/\s+/, ' ')}"`;
  r = /\b(\d{2,3})\s*mm\b/i.exec(t);
  if (r) return `${r[1]} mm`;
  return '';
}

/** La sección que se deduce del texto de la partida (para no teclearla). */
function seccionDeTexto(texto) {
  const t = String(texto || '');
  const c = /(?:Ø|ø|\bdi[aá]m(?:etro)?\.?\s*)\s*(\d{2,4})/i.exec(t);
  if (c) return { forma: 'circ', diametro: Number(c[1]) };
  const r = /\b(\d{2,4})\s*[x×]\s*(\d{2,4})\b/.exec(t);
  if (r) return { forma: 'rect', ancho: Number(r[1]), alto: Number(r[2]) };
  return null;
}

/** ¿Se puede medir una partida de esa unidad con una capa de ese tipo? */
function unidadCasa(tipo, unidad) {
  const u = unidadMedNormal(unidad);
  if (tipo === 'trazo') return ['m', 'm2', 'kg'].includes(u);
  if (tipo === 'zona') return u === 'm2';
  if (tipo === 'punto') return u === 'ud';
  return false;
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.AVANCE_MEDIR = API;
})({
  medirMarca, cantidadMarca, leerPuntos, UNIDAD_TIPO,
  unidadNormal: unidadMedNormal, paralelosDe, leerSeccion, perimetro, textoSeccion, cantidadPartida, explicar: explicarCuenta, FALTA,
  medidaDeTexto, seccionDeTexto, unidadCasa,
});
