'use strict';
/*
 * ACERCAR Y MOVERSE POR UN PLANO (29-oct-2026, JC con las fotos de la planta
 * N60: «se ve diminuto y no se puede navegar»).
 *
 * Las cuentas, sin pantalla, para que el escritorio, la web y el móvil hagan
 * lo mismo y se puedan probar:
 *
 *   - El plano entero (zoom 1) cabe en el marco sin recortarse: la anchura
 *     base es la menor entre la del marco y la que deja su alto («contain»).
 *     Si sobra hueco, el plano queda centrado.
 *   - Acercar con la rueda, el pellizco o el doble clic deja QUIETO el punto
 *     del plano que está bajo el cursor o los dedos.
 *   - Ir a un elemento lo deja en el centro del marco.
 *   - El zoom máximo sale de la resolución de la imagen: hasta el doble de su
 *     tamaño real; más allá solo se ven píxeles.
 *
 * Y un control de gestos para el DOM (`gestos`) que usa la pantalla del
 * escritorio y de la web: rueda (o pellizco del trackpad) centrada en el
 * cursor, arrastrar para moverse, doble clic para acercar y dos dedos en una
 * pantalla táctil. Un arrastre no cuenta como clic: no abre lo que hay debajo.
 */

/* Dentro de una función: en la web y el móvil todos los scripts comparten el ámbito global. */
(function () {
const ZOOM_MIN = 1;
const ZOOM_TOPE = 12;
/* El zoom de la pantalla (30-oct, JC: «hay que poder ampliar más»): hasta ×30. Más allá del nítido (zoomMaximo) se avisa. */
const ZOOM_MAX = 30;
/* Cuánto se puede ampliar por encima del tamaño real de la imagen. */
const SOBRE_REAL = 2;
const ARRASTRE_MIN = 6;

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** El zoom dentro de [1, max]. */
function limitarZoom(z, max = ZOOM_TOPE) {
  const n = Number(z);
  return limitar(Number.isFinite(n) ? n : ZOOM_MIN, ZOOM_MIN, Math.max(ZOOM_MIN, max));
}

/** La anchura del plano entero (zoom 1) en un marco W × H; ratio = ancho / alto de la imagen. */
function anchoBase(W, H, ratio) {
  const r = Number(ratio) > 0 ? Number(ratio) : 1;
  if (!(W > 0)) return 0;
  if (!(H > 0)) return W;
  return Math.min(W, H * r);
}

/** Dónde queda el lienzo con un zoom: ancho, alto y el hueco a la izquierda y arriba si no llena el marco. */
function geometria(zoom, marco) {
  const lw = anchoBase(marco.W, marco.H, marco.ratio) * zoom;
  const lh = lw / (Number(marco.ratio) > 0 ? Number(marco.ratio) : 1);
  return { lw, lh, ox: Math.max(0, (marco.W - lw) / 2), oy: Math.max(0, (marco.H - lh) / 2) };
}

/** El desplazamiento posible (scroll) del marco con un zoom. */
function limitarScroll(sl, st, zoom, marco) {
  const g = geometria(zoom, marco);
  return { sl: limitar(sl, 0, Math.max(0, g.lw - marco.W)), st: limitar(st, 0, Math.max(0, g.lh - marco.H)) };
}

/** El punto del plano (0..1) que está en (px, py) del marco. */
function puntoEn(vista, px, py, marco) {
  const g = geometria(vista.zoom, marco);
  return { fx: (vista.sl + px - g.ox) / (g.lw || 1), fy: (vista.st + py - g.oy) / (g.lh || 1) };
}

/**
 * Cambia el zoom dejando quieto el punto del plano que está en (px, py) del
 * marco. vista = { zoom, sl, st }; marco = { W, H, ratio }. Devuelve la vista nueva.
 */
function zoomEnPunto(vista, nuevo, px, py, marco, max = ZOOM_TOPE) {
  const zoom = limitarZoom(nuevo, max);
  const { fx, fy } = puntoEn(vista, px, py, marco);
  const g = geometria(zoom, marco);
  const s = limitarScroll(fx * g.lw + g.ox - px, fy * g.lh + g.oy - py, zoom, marco);
  return { zoom, sl: s.sl, st: s.st };
}

/** La vista con el punto (fx, fy) del plano en el centro del marco, con al menos `zoomMin`. */
function centrarEn(vista, fx, fy, marco, { zoomMin = 3, max = ZOOM_TOPE } = {}) {
  const zoom = limitarZoom(Math.max(vista.zoom || 1, zoomMin), max);
  const g = geometria(zoom, marco);
  const s = limitarScroll(fx * g.lw + g.ox - marco.W / 2, fy * g.lh + g.oy - marco.H / 2, zoom, marco);
  return { zoom, sl: s.sl, st: s.st };
}

/** El factor de zoom de un giro de rueda; con Ctrl (el pellizco del trackpad) va más vivo. */
function factorRueda(deltaY, { ctrl = false, modo = 0 } = {}) {
  const px = Number(deltaY) * (modo === 1 ? 16 : modo === 2 ? 400 : 1);
  return Math.exp(-limitar(px, -400, 400) * (ctrl ? 0.01 : 0.0018));
}

/** El zoom NÍTIDO máximo: hasta SOBRE_REAL veces el tamaño real de la imagen (lado en px), nunca menos de 4. */
function zoomMaximo(anchoImagen, marco, densidad = 1) {
  const base = anchoBase(marco.W, marco.H, marco.ratio);
  if (!(anchoImagen > 0) || !(base > 0)) return 8;
  const real = anchoImagen / (base * (Number(densidad) > 0 ? Number(densidad) : 1));
  return limitar(real * SOBRE_REAL, 4, ZOOM_TOPE);
}

/*
 * ENCUADRAR (30-oct): «Entero» deja lo dibujado (la caja de los elementos
 * colocados, con un margen) encajado y centrado en el marco, en vez de la
 * hoja entera con su blanco alrededor.
 */
/** La caja (0..1) de unos puntos { x, y } con un margen; null si hay menos de dos. */
function cajaDe(puntos, margen = 0.06) {
  const ps = (puntos || []).filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && p.x !== null && p.y !== null);
  if (ps.length < 2) return null;
  let x0 = 1; let y0 = 1; let x1 = 0; let y1 = 0;
  for (const p of ps) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const mx = Math.max(0.02, (x1 - x0) * margen); const my = Math.max(0.02, (y1 - y0) * margen);
  return { x0: limitar(x0 - mx, 0, 1), y0: limitar(y0 - my, 0, 1), x1: limitar(x1 + mx, 0, 1), y1: limitar(y1 + my, 0, 1) };
}

/** La vista con la caja encajada entera y centrada en el marco. Sin caja, el plano entero. */
function encuadre(caja, marco, max = ZOOM_TOPE) {
  if (!caja) return { zoom: 1, sl: 0, st: 0 };
  const g1 = geometria(1, marco);
  const bw = Math.max(1e-6, caja.x1 - caja.x0) * g1.lw; const bh = Math.max(1e-6, caja.y1 - caja.y0) * g1.lh;
  const zoom = limitarZoom(Math.min(marco.W / bw, marco.H / bh), max);
  return centrarEn({ zoom }, (caja.x0 + caja.x1) / 2, (caja.y0 + caja.y1) / 2, marco, { zoomMin: zoom, max });
}

/*
 * LAS ETIQUETAS SIN PISARSE (30-oct): de una lista { id, x, y, w, h } en px
 * del lienzo, por orden de prioridad, se quedan las que no chocan con una ya
 * puesta. Devuelve el Set de ids que se enseñan.
 */
function etiquetasSinChoque(cajas, celda = 80) {
  const rejilla = new Map();
  const puestas = new Set();
  const clave = (i, j) => `${i},${j}`;
  for (const c of cajas || []) {
    const i0 = Math.floor(c.x / celda); const i1 = Math.floor((c.x + c.w) / celda);
    const j0 = Math.floor(c.y / celda); const j1 = Math.floor((c.y + c.h) / celda);
    let choca = false;
    for (let i = i0; i <= i1 && !choca; i++) {
      for (let j = j0; j <= j1 && !choca; j++) {
        for (const o of rejilla.get(clave(i, j)) || []) {
          if (c.x < o.x + o.w && o.x < c.x + c.w && c.y < o.y + o.h && o.y < c.y + c.h) { choca = true; break; }
        }
      }
    }
    if (choca) continue;
    puestas.add(c.id);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = clave(i, j); if (!rejilla.has(k)) rejilla.set(k, []); rejilla.get(k).push(c); }
  }
  return puestas;
}

/**
 * LOS GESTOS sobre un marco con scroll. op = {
 *   zoom(): el zoom actual; max(): el máximo; ratio(): ancho/alto de la imagen;
 *   aplicar(zoom): redimensiona el lienzo a ese zoom (sin tocar el scroll);
 *   activo?(): false para no hacer nada (p. ej. mientras se coloca un equipo);
 * }. Devuelve { irA(zoom, px, py), centrar(fx, fy, opciones), quitar() }.
 */
function gestos(marco, op) {
  const medidas = () => ({ W: marco.clientWidth, H: marco.clientHeight, ratio: op.ratio() });
  const vista = () => ({ zoom: op.zoom(), sl: marco.scrollLeft, st: marco.scrollTop });
  const poner = (v) => { op.aplicar(v.zoom); marco.scrollLeft = v.sl; marco.scrollTop = v.st; };
  const irA = (z, px, py) => poner(zoomEnPunto(vista(), z, px, py, medidas(), op.max()));
  const relativo = (ev) => { const r = marco.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const punteros = new Map();
  let arrastre = null; let pinza = null; let movido = false;

  function rueda(ev) {
    ev.preventDefault();
    const [px, py] = relativo(ev);
    irA(op.zoom() * factorRueda(ev.deltaY, { ctrl: ev.ctrlKey, modo: ev.deltaMode }), px, py);
  }
  function abajo(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 1) { arrastre = { x: ev.clientX, y: ev.clientY, sl: marco.scrollLeft, st: marco.scrollTop, id: ev.pointerId }; movido = false; }
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const r = marco.getBoundingClientRect();
      pinza = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: op.zoom(), cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
      arrastre = null; movido = true;
    }
  }
  function mover(ev) {
    if (!punteros.has(ev.pointerId)) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const r = marco.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - r.left; const cy = (a.y + b.y) / 2 - r.top;
      const v = zoomEnPunto(vista(), pinza.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinza.d), pinza.cx, pinza.cy, medidas(), op.max());
      poner({ zoom: v.zoom, ...limitarScroll(v.sl + pinza.cx - cx, v.st + pinza.cy - cy, v.zoom, medidas()) });
      pinza.cx = cx; pinza.cy = cy; pinza.zoom = v.zoom; pinza.d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      ev.preventDefault();
      return;
    }
    if (!arrastre || arrastre.id !== ev.pointerId) return;
    const dx = ev.clientX - arrastre.x; const dy = ev.clientY - arrastre.y;
    if (!movido && Math.abs(dx) + Math.abs(dy) < ARRASTRE_MIN) return;
    if (!movido) { movido = true; marco.classList.add('arrastrando'); try { marco.setPointerCapture(ev.pointerId); } catch { /* sin captura */ } }
    marco.scrollLeft = arrastre.sl - dx; marco.scrollTop = arrastre.st - dy;
  }
  function arriba(ev) {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    if (!punteros.size) { arrastre = null; marco.classList.remove('arrastrando'); }
  }
  /* Tras arrastrar, el clic que suelta el botón no abre lo que hay debajo. */
  function clic(ev) { if (movido) { ev.stopPropagation(); ev.preventDefault(); movido = false; } }
  function doble(ev) {
    if (ev.target.closest && ev.target.closest('button,a,input,select')) return;
    const [px, py] = relativo(ev);
    irA(op.zoom() >= op.max() * 0.95 ? 1 : op.zoom() * 2, px, py);
  }
  const activo = (fn) => (ev) => { if (!op.activo || op.activo()) fn(ev); };
  const oyentes = [['wheel', activo(rueda), { passive: false }], ['pointerdown', activo(abajo)], ['pointermove', mover, { passive: false }],
    ['pointerup', arriba], ['pointercancel', arriba], ['click', clic, true], ['dblclick', activo(doble)]];
  for (const [n, f, o] of oyentes) marco.addEventListener(n, f, o);
  return {
    irA,
    centrar: (fx, fy, opciones) => poner(centrarEn(vista(), fx, fy, medidas(), { max: op.max(), ...opciones })),
    encuadrar: (caja) => poner(encuadre(caja, medidas(), op.max())),
    quitar: () => { for (const [n, f, o] of oyentes) marco.removeEventListener(n, f, o); },
  };
}

/*
 * LOS RÓTULOS DEL PLANO SIN AMONTONARSE (13-nov, JC: «eso así no puede ser», con los nombres de sala y los TAG
 * pisándose). En px del lienzo y por capas:
 *  1) el TAG del equipo tocado, siempre; 2) los símbolos de los equipos y materiales, que ningún rótulo tapa;
 *  3) los demás TAG, por prioridad; el que choca con lo ya puesto no sale (sale al tocar su equipo);
 *  4) los nombres de sala, por debajo: solo si caben en su sala (`hueco`, px) y no chocan con nada de lo anterior
 *     ni con otra sala; las grandes primero (pri más baja). Así una sala pequeña solo enseña su nombre al acercar.
 *     Una sala puede traer `alt` ([{x, y}], otros sitios dentro de ella) por si en el suyo tapa algo.
 * Devuelve { tags: Set, salas: Set, movidas?: { id: {x, y} } } con los ids que se enseñan y las salas que cambian de sitio.
 */
function rotulosSinChoque({ tags = [], obstaculos = [], salas = [] } = {}, celda = 80, { salasPrimero = false } = {}) {
  const rejilla = new Map();
  const clave = (i, j) => `${i},${j}`;
  const rango = (c) => [Math.floor(c.x / celda), Math.floor((c.x + c.w) / celda), Math.floor(c.y / celda), Math.floor((c.y + c.h) / celda)];
  const choca = (c) => {
    const [i0, i1, j0, j1] = rango(c);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (const o of rejilla.get(clave(i, j)) || []) if (c.x < o.x + o.w && o.x < c.x + c.w && c.y < o.y + o.h && o.y < c.y + c.h) return true;
      }
    }
    return false;
  };
  const poner = (c) => { const [i0, i1, j0, j1] = rango(c); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = clave(i, j); if (!rejilla.has(k)) rejilla.set(k, []); rejilla.get(k).push(c); } };
  const porPri = (l) => [...l].sort((a, b) => (a.pri || 0) - (b.pri || 0));
  const salida = { tags: new Set(), salas: new Set() };
  const ordenTags = porPri(tags);
  /* El tocado va antes que nada; los demás TAG no tapan el símbolo de otro equipo. */
  /* 13-nov (JC: «TAG sin cortar en el borde y sin solaparse»): un TAG puede traer otros sitios (`alt`, p. ej. a la izquierda
     del bloque); si va en uno de ellos, su id sale en `salida.izq` cuando ese sitio lleva `izq`. */
  salida.izq = new Set();
  const ponTag = (c) => {
    const q = [c, ...(c.alt || []).map((a) => ({ ...c, ...a }))].find((x) => !choca(x));
    if (!q) return;
    salida.tags.add(c.id); poner(q);
    if (q.izq) salida.izq.add(c.id);
  };
  for (const c of ordenTags.filter((t) => t.pri === 0)) ponTag(c);
  for (const c of obstaculos) poner(c);
  const ponTags = () => { for (const c of ordenTags.filter((t) => t.pri !== 0)) ponTag(c); };
  /* 13-nov (JC: «es súper importante el nombre de la sala»): con salasPrimero, los nombres de sala van antes que los TAG. */
  if (!salasPrimero) ponTags();
  for (const c of porPri(salas)) {
    if (c.hueco !== undefined && !(c.hueco >= c.w)) continue;
    /* Si en su sitio tapa algo, prueba los otros sitios que da (más arriba o más abajo dentro de su sala). */
    const sitio = [c, ...(c.alt || []).map((a) => ({ ...c, x: a.x, y: a.y }))].find((q) => !choca(q));
    if (!sitio) continue;
    salida.salas.add(c.id); poner(sitio);
    if (sitio !== c) salida.movidas = Object.assign(salida.movidas || {}, { [c.id]: { x: sitio.x, y: sitio.y } });
  }
  if (salasPrimero) ponTags();
  return salida;
}

/*
 * El hueco de cada nombre de sala, como fracción del ancho del plano: la distancia al rótulo de sala más cercano
 * (aspecto = alto/ancho del plano). Sin el contorno de la sala, es lo que mide su tamaño: en un pasillo de cuartos
 * pequeños los rótulos están juntos; en una sala grande, solos.
 */
function huecoSalas(salas, aspecto = 1) {
  const n = (salas || []).length;
  const r = new Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(salas[i].x - salas[j].x, (salas[i].y - salas[j].y) * aspecto);
      if (d < r[i]) r[i] = d;
      if (d < r[j]) r[j] = d;
    }
  }
  return r.map((d) => (Number.isFinite(d) ? d : 1));
}


/*
 * EL TAG DE CADA EQUIPO Y EL NOMBRE DE CADA SALA SOBRE EL PLANO DE COMMISSIONING (13-nov-2026, JC: «cada equipo con su TAG
 * y cada sala con su nombre; es súper importante el nombre de la sala»). Una sola regla para la web, el escritorio, el
 * móvil de Cx y el HTML de entrega a la DF:
 *  - los bloques tienen tamaño fijo en pantalla (sw, px); el plano crece al acercar y los rótulos se separan solos;
 *  - el TAG del equipo tocado, siempre; ningún rótulo tapa un bloque;
 *  - después los NOMBRES DE SALA (las salas grandes primero; una sala pequeña, al acercar, cuando cabe en su recinto);
 *  - y por último los demás TAG que no chocan con nada. Con poco zoom lo que choca se oculta; al acercar sale todo.
 * equipos/materiales: [{ id, x, y (fracción del plano), sw (px), tag, elegido, pri? }]; salas: [{ t, x, y, w?, h? }] (fracción).
 * lw, lh: ancho y alto del lienzo en px. ancho(texto, 'tag'|'elegido'|'sala'): px del texto (si no, por letras).
 * Devuelve { tags: Set('eq:<id>' | id de material), salas: Set(índice), sitio: Map(índice → {x, y} centro en px) }.
 */
const LETRA_PX = { tag: 6, elegido: 7.4, sala: 6.2 };
const ALTO_SALA = 14;
function colocarRotulos({ lw, lh, equipos = [], materiales = [], salas = [], huecos = null, ancho = null } = {}) {
  const mide = ancho || ((t, k) => String(t || '').length * (LETRA_PX[k] || 6));
  const tags = []; const obstaculos = [];
  const mete = (q, id, priDef) => {
    if (!q || q.x === null || q.x === undefined || q.y === null || q.y === undefined) return;
    const el = Boolean(q.elegido); const sw = Number(q.sw) || 12;
    const cx = q.x * lw; const cy = q.y * lh;
    obstaculos.push({ x: cx - sw / 2, y: cy - sw / 2, w: sw, h: sw });
    if (!q.tag) return;
    const w = mide(q.tag, el ? 'elegido' : 'tag') + (el ? 10 : 6); const sep = el ? 8 : 2;
    const der = { x: cx + sw / 2 + sep, izq: false }; const izq = { x: cx - sw / 2 - sep - w, izq: true };
    /* A la derecha del bloque; si se sale del plano por la derecha o choca, a la izquierda (nunca cortado en el borde). */
    const sale = (o) => o.x < 0 || o.x + w > lw;
    const orden = sale(der) && !sale(izq) ? [izq, der] : [der, izq];
    const sitios = orden.filter((o) => !sale(o));
    const [pri0, ...alt] = sitios.length ? sitios : [orden[0]];
    tags.push({ id, x: pri0.x, izq: pri0.izq, alt, y: cy - (el ? 8 : 6), w, h: el ? 16 : 12, pri: el ? 0 : (q.pri !== undefined ? q.pri : priDef) });
  };
  for (const e of equipos) mete(e, `eq:${e.id}`, 1.5);
  for (const m of materiales) mete(m, m.id, 3);
  const hueco = huecos || huecoSalas(salas, lh / (lw || 1));
  const cajasSala = [];
  salas.forEach((r, i) => {
    if (!r || !r.t || r.x === null || r.x === undefined) return;
    const w = mide(r.t, 'sala') + 4;
    /* 13-nov: el nombre nunca cortado en el borde del plano: se mete dentro (y sus sitios alternativos también). */
    const cx = (v) => Math.min(Math.max(0, v), Math.max(0, lw - w)); const cy = (v) => Math.min(Math.max(0, v), Math.max(0, lh - ALTO_SALA));
    const x = cx(r.x * lw - w / 2); const y = cy(r.y * lh - ALTO_SALA / 2);
    if (r.w > 0 && r.h > 0) {
      /* Con el recinto del modelo: el nombre sale si cabe dentro de la sala en pantalla; si tapa algo, prueba arriba, abajo o a los lados. */
      const dy = Math.min((r.h * lh) / 3, 40); const dx = Math.min(Math.max(0, r.w * lw - w) / 3, 60);
      const alt = [[0, -dy], [0, dy], [-dx, 0], [dx, 0]].filter(([a, b]) => a || b).map(([a, b]) => ({ x: cx(x + a), y: cy(y + b) }));
      cajasSala.push({ id: i, x, y, w, h: ALTO_SALA, hueco: r.h * lh >= 10 ? r.w * lw * 1.25 : 0, pri: -(r.w * r.h), alt });
    } else {
      /* Sin recinto: el hueco con la sala vecina más cercana mide su tamaño. Si en su sitio tapa un bloque, prueba encima,
         debajo y a los lados, un poco más lejos cada vez (13-nov: en una sala llena de equipos el nombre no salía nunca). */
      const alt = [];
      for (const d of [1, 2, 3]) alt.push({ x, y: cy(y - 14 * d) }, { x, y: cy(y + 14 * d) }, { x: cx(x - w / 2 - 12 * d), y }, { x: cx(x + w / 2 + 12 * d), y });
      cajasSala.push({ id: i, x, y, w, h: ALTO_SALA, hueco: (hueco[i] || 0) * lw * 2, pri: -(hueco[i] || 0), alt });
    }
  });
  const ver = rotulosSinChoque({ tags, obstaculos, salas: cajasSala }, 80, { salasPrimero: true });
  const sitio = new Map();
  for (const c of cajasSala) {
    if (!ver.salas.has(c.id)) continue;
    const m = ver.movidas && ver.movidas[c.id];
    sitio.set(c.id, { x: (m ? m.x : c.x) + c.w / 2, y: (m ? m.y : c.y) + c.h / 2 });
  }
  return { tags: ver.tags, salas: ver.salas, sitio, izq: ver.izq || new Set() };
}

/*
 * EL TAMAÑO DE CADA BLOQUE DE EQUIPO EN PANTALLA (13-nov, JC en el iPhone: «si hago zoom los equipos tienen que modificar su
 * tamaño para adaptarse, si no es imposible que sepa yo en qué sala estoy»). El bloque no crece con el plano: mide `max` px
 * de pantalla a cualquier zoom, y si su vecino más cercano está más cerca, encoge (hasta `min`) para no pisarlo. Así, al
 * acercar, las salas crecen y los equipos se separan; muros y nombres de sala siguen a la vista.
 * puntos: [{ id, x, y }] en fracción del plano; lw, lh: el lienzo en px. Devuelve Map id → px. Autónoma (va con toString al HTML de la DF).
 */
function tamBloques(puntos, { lw, lh, max = 22, min = 10, hueco = 3 } = {}) {
  const ps = [];
  for (const q of puntos || []) if (q && q.x !== null && q.x !== undefined && q.y !== null && q.y !== undefined) ps.push({ id: q.id, X: q.x * lw, Y: q.y * lh });
  const lado = max + hueco; const rejilla = new Map(); const clave = (i, j) => `${i}|${j}`;
  for (const q of ps) { const k = clave(Math.floor(q.X / lado), Math.floor(q.Y / lado)); if (!rejilla.has(k)) rejilla.set(k, []); rejilla.get(k).push(q); }
  const tam = new Map();
  for (const q of ps) {
    const i0 = Math.floor(q.X / lado); const j0 = Math.floor(q.Y / lado); let d = Infinity;
    for (let i = i0 - 1; i <= i0 + 1; i += 1) for (let j = j0 - 1; j <= j0 + 1; j += 1) {
      for (const o of rejilla.get(clave(i, j)) || []) if (o !== q) d = Math.min(d, Math.max(Math.abs(o.X - q.X), Math.abs(o.Y - q.Y)));
    }
    tam.set(q.id, Math.round(Math.max(min, Math.min(max, d - hueco))));
  }
  return tam;
}

/*
 * DE DÓNDE SALE EL NOMBRE DE CADA SALA (nunca se inventa). De más a menos fiable:
 *   1. «modelo»: el nombre (LongName) de cada IfcSpace que trae el plano del IFC (<g data-capa="nombres">), con su recinto;
 *   2. «codigos+equipos»: el código de sala del modelo (<g data-capa="salas">) con el nombre que llevan los equipos de esa
 *      sala en su campo sala («Sala DAS · 00.STE.036»);
 *   3. «plano»: los nombres leídos del plano PDF/CAD de la planta (ya en fracción del plano);
 *   4. «equipos»: el nombre del campo sala de los equipos, en el centro de los equipos de esa sala;
 *   5. «codigos»: solo el código, si nada trae nombre.
 * svg: el SVG del plano del modelo (viewBox 0 0 ancho alto); equipos: [{ x, y, sala }] en fracción; partir: formasPlano.partirSala.
 */
const RE_NOMBRE_SALA = /<text x="([-0-9.]+)" y="([-0-9.]+)" data-w="(\d+)" data-h="(\d+)">([^<>]*)<\/text>/g;
const RE_CODIGO_SALA = /<text x="([-0-9.]+)" y="([-0-9.]+)">([^<>]*)<\/text>/g;
const desEsc = (t) => String(t).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const r4 = (v) => Math.round(v * 10000) / 10000;
const llano = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const RE_COD = /^[A-Z0-9]{1,4}[.-][A-Z]{2,4}[.-]\d{2,5}$/i;
const partirSimple = (s) => {
  const t = String(s || '').trim().replace(/\s*\(por confirmar\)$/i, ''); const i = t.lastIndexOf(' · ');
  if (i > 0) {
    const a = t.slice(0, i).trim(); const b = t.slice(i + 3).trim();
    return RE_COD.test(a) && !RE_COD.test(b) ? { nombre: b, codigo: a } : { nombre: a, codigo: b };
  }
  return RE_COD.test(t) ? { nombre: '', codigo: t } : { nombre: t, codigo: '' };
};
function salasDelSvg(svg, ancho, alto) {
  const nombres = []; const codigos = [];
  if (!svg || !(ancho > 0) || !(alto > 0)) return { nombres, codigos };
  const s = String(svg);
  const g = /<g data-capa="salas">([\s\S]*?)<\/g>/.exec(s);
  for (const m of s.matchAll(RE_NOMBRE_SALA)) {
    const t = desEsc(m[5]).trim();
    if (t) nombres.push({ t, x: r4(Number(m[1]) / ancho), y: r4(Number(m[2]) / alto), w: r4(Number(m[3]) / ancho), h: r4(Number(m[4]) / alto) });
  }
  for (const m of (g ? g[1] : '').matchAll(RE_CODIGO_SALA)) {
    const t = desEsc(m[3]).trim();
    if (t) codigos.push({ t, x: r4(Number(m[1]) / ancho), y: r4(Number(m[2]) / alto) });
  }
  return { nombres, codigos };
}
function salasDeEquipos(equipos, partir = partirSimple) {
  const grupos = new Map();
  for (const e of equipos || []) {
    if (!e || !e.sala || e.x === null || e.x === undefined || e.y === null || e.y === undefined) continue;
    const s = partir(e.sala); const t = s.nombre || s.codigo;
    if (!t) continue;
    const k = llano(s.codigo) || llano(t);
    if (!grupos.has(k)) grupos.set(k, { t, codigo: s.codigo || '', xs: [], ys: [] });
    grupos.get(k).xs.push(e.x); grupos.get(k).ys.push(e.y);
  }
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  return [...grupos.values()].map((g) => ({ t: g.t, codigo: g.codigo, x: r4(media(g.xs)), y: r4(media(g.ys)), conNombre: true }));
}
function salasParaPlano({ svg = null, ancho = 0, alto = 0, salasPlano = [], equipos = [], partir = partirSimple } = {}) {
  const { nombres, codigos } = salasDelSvg(svg, ancho, alto);
  if (nombres.length) return { salas: nombres, fuente: 'modelo' };
  const nombreDe = new Map();
  for (const e of equipos || []) { const s = partir(e && e.sala); if (s.nombre && s.codigo) nombreDe.set(llano(s.codigo), s.nombre); }
  const renombradas = codigos.map((c) => (nombreDe.has(llano(c.t)) ? { ...c, t: nombreDe.get(llano(c.t)), codigo: c.t } : c));
  if (renombradas.some((c) => c.codigo)) {
    /* 13-nov: las salas de los equipos que el modelo no trae (el IFC no tiene todos los recintos) se añaden por el sitio de sus equipos. */
    const ya = new Set(codigos.map((c) => llano(c.t)));
    const resto = salasDeEquipos(equipos, partir).filter((r) => partir(r.t).nombre && !ya.has(llano(r.codigo || '')) && !renombradas.some((c) => c.t === r.t && Math.hypot(c.x - r.x, c.y - r.y) < 0.05));
    return { salas: [...renombradas, ...resto.map(({ t, x, y }) => ({ t, x, y }))], fuente: 'codigos+equipos' };
  }
  const delPlano = (salasPlano || []).filter((r) => r && r.t && !partir(r.t).codigo);
  if (delPlano.length) return { salas: delPlano.map((r) => ({ t: r.t, x: r.x, y: r.y })), fuente: 'plano' };
  const deEq = salasDeEquipos(equipos, partir).filter((r) => partir(r.t).nombre);
  if (deEq.length) return { salas: deEq.map(({ t, x, y }) => ({ t, x, y })), fuente: 'equipos' };
  return { salas: codigos, fuente: codigos.length ? 'codigos' : null };
}

const API = { ZOOM_MIN, ZOOM_TOPE, ZOOM_MAX, limitarZoom, anchoBase, geometria, limitarScroll, puntoEn, zoomEnPunto, centrarEn, factorRueda, zoomMaximo, cajaDe, encuadre, etiquetasSinChoque, rotulosSinChoque, huecoSalas, colocarRotulos, tamBloques, LETRA_PX, ALTO_SALA, salasDelSvg, salasDeEquipos, salasParaPlano, gestos };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.VISTA_PLANO = API;
})();
