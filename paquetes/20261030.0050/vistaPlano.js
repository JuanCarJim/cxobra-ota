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

const API = { ZOOM_MIN, ZOOM_TOPE, ZOOM_MAX, limitarZoom, anchoBase, geometria, limitarScroll, puntoEn, zoomEnPunto, centrarEn, factorRueda, zoomMaximo, cajaDe, encuadre, etiquetasSinChoque, gestos };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.VISTA_PLANO = API;
})();
