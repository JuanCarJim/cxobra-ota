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

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.AVANCE_MEDIR = API;
})({ medirMarca, cantidadMarca, leerPuntos, UNIDAD_TIPO });
