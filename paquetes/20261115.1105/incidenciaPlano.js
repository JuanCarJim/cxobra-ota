'use strict';
/*
 * LOS EQUIPOS CON INCIDENCIA EN EL PLANO (14-nov-2026, JC: «Si hay algún equipo con incidencia deberá verse en otro
 * color»). UNA sola regla para el plano del escritorio, el de la web y el del móvil Cx.
 *
 *   · QUÉ ES «CON INCIDENCIA»: el equipo lleva al menos una incidencia SIN CERRAR del registro de incidencias y
 *     reparaciones —abierta, en curso o terminada por el encargado y pendiente de que el jefe de obra la cierre—. Es el
 *     `activa` de shared/incidencias/motor.js y el «con incidencias» de shared/incidencias/equiposPorEstado.js. Las
 *     cerradas y las anuladas no cuentan. Cuenta el equipo de la incidencia y los que lleve en `equiposIds`.
 *   · EL COLOR: naranja intenso, distinto de los de los estados (rojo, azul, verde, gris). Mismo estilo que ellos:
 *     el contorno del color y el interior del mismo color, suave y semitransparente. Nunca amarillo ni negro.
 *   · LA INCIDENCIA MANDA sobre el color del estado: el bloque se pinta naranja, tenga el estado que tenga. El estado
 *     no se pierde: se sigue contando en su casilla de la leyenda y se lee en el panel del equipo.
 *   · SIN COLOR TAMBIÉN SE DISTINGUE: lleva el distintivo «!».
 *
 * Contraste (WCAG): el naranja #e0671f da 3,4:1 sobre blanco y 3,0:1 sobre el arena del plano: vale para contornos y
 * figuras (≥ 3:1), no para letra. La letra y las cifras van en el tono oscuro #a8440b (6,0:1 sobre blanco, 5,4:1 sobre el arena).
 *
 * Lógica pura: vale en la pantalla (window.INCIDENCIA_PLANO) y en Node.
 */
(function () {

const COLOR = '#e0671f';
const COLOR_TEXTO = '#a8440b';
const RELLENO = 0.28;
const DISTINTIVO = '!';
const CLAVE = 'incidencia';
const NOMBRE = 'Con incidencia';
/* Sin cerrar: las tres que no están cerradas ni anuladas (equiposPorEstado.ABIERTAS). */
const ABIERTAS = ['abierta', 'enCurso', 'terminada'];
const NOMBRE_ESTADO = { abierta: 'Abierta', enCurso: 'En curso', terminada: 'Por revisar' };
const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

/* La partición de conjuntos de siempre (shared/commissioning/conjuntos.js), en Node y en la pantalla. */
const conjuntosCx = () => {
  try { if (typeof require === 'function') return require('./conjuntos'); } catch { /* sin require */ }
  return typeof window !== 'undefined' ? window.CONJUNTOS_CX || null : null;
};
const leerLista = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const estaAbierta = (i) => Boolean(i && !i.borrado && ABIERTAS.includes(i.estado));

/** Lo que el plano enseña de una incidencia: nada de dinero ni de horas. */
const breve = (i) => ({ id: i.id, codigo: i.codigo || '', titulo: i.titulo || '', estado: i.estado, estadoNombre: NOMBRE_ESTADO[i.estado] || i.estado, prioridad: i.prioridad || null });

/**
 * Las incidencias sin cerrar de cada equipo.
 *
 * EL CONJUNTO ENTERO (14-nov, JC: «Si hay un equipo que es un conjunto con incidencia, entonces todo el conjunto tiene
 * incidencia»): con `equipos` (las filas de equiposObra: id, tag, denominacion, plantillaPM, equipoAsociado), la
 * incidencia de una unidad pasa a todas las unidades de su conjunto —la exterior de un split con su interior, la
 * exterior de un VRF con todas sus interiores—. Los conjuntos son los de shared/commissioning/conjuntos.js › agrupar,
 * la misma partición de Puesta en marcha, el Mapa y control.conjuntosDeEquipos; los accesorios no son equipos y no
 * se pintan. La que llega de otra unidad lleva `enUnidad` ({ id, tag, exterior }) para que el panel diga
 * «En la exterior UE-01».
 *
 * @param {object[]} incidencias  filas del registro (id, codigo, titulo, estado, prioridad, equipoId, equiposIds)
 * @param {object[]} [equipos]    filas de los equipos de la obra, para extender la incidencia a su conjunto
 * @returns {Map<string, object[]>} id del equipo → sus incidencias abiertas (las de prioridad alta primero)
 */
function porEquipo(incidencias = [], equipos = null) {
  const mapa = new Map();
  const poner = (id, x) => {
    if (!mapa.has(id)) mapa.set(id, []);
    if (!mapa.get(id).some((y) => y.id === x.id)) mapa.get(id).push(x);
  };
  const propias = [];
  for (const i of incidencias || []) {
    if (!estaAbierta(i)) continue;
    for (const id of new Set([i.equipoId, ...leerLista(i.equiposIds)].filter(Boolean))) {
      poner(id, breve(i));
      propias.push([id, i]);
    }
  }
  const CJ = Array.isArray(equipos) && equipos.length && propias.length ? conjuntosCx() : null;
  if (CJ) {
    const lineaDe = new Map();
    for (const l of CJ.agrupar(equipos)) {
      const unidades = (l.unidades || []).filter((u) => !u.accesorio);
      if (unidades.length > 1) for (const u of unidades) lineaDe.set(u.id, unidades);
    }
    for (const [id, i] of propias) {
      const unidades = lineaDe.get(id);
      if (!unidades) continue;
      const origen = unidades.find((u) => u.id === id);
      const enUnidad = { id, tag: origen.tag || '', exterior: Boolean(CJ.esExterior(origen)) };
      for (const u of unidades) if (u.id !== id) poner(u.id, { ...breve(i), enUnidad });
    }
  }
  const peso = (x) => (x.prioridad in ORDEN_PRIORIDAD ? ORDEN_PRIORIDAD[x.prioridad] : 1);
  for (const l of mapa.values()) l.sort((a, b) => peso(a) - peso(b) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  return mapa;
}

/** ¿Lleva incidencia abierta? Vale el recuento (`inc`), la lista (`incidencias`) o el propio número. */
function tiene(x) {
  if (typeof x === 'number') return x > 0;
  if (Array.isArray(x)) return x.length > 0;
  return Boolean(x && ((Number(x.inc) || 0) > 0 || (Array.isArray(x.incidencias) && x.incidencias.length > 0)));
}

/**
 * El color que le toca al bloque: la incidencia abierta manda sobre el estado.
 * @param {string} estado  la clave del estado del bloque (la de cada plano: 'pedido', 'cxHecho'…)
 * @param {*} incidencias  lo que entiende `tiene`
 * @returns {{ clave: string, estado: string, incidencia: boolean, distintivo: string }}
 */
function colorDe(estado, incidencias) {
  const inc = tiene(incidencias);
  return { clave: inc ? CLAVE : estado, estado, incidencia: inc, distintivo: inc ? DISTINTIVO : '' };
}

/** Cuántos equipos de la lista llevan incidencia abierta (la cifra de «Con incidencia N»). */
const recuento = (lista = []) => (lista || []).filter(tiene).length;

/** El filtro de la leyenda: los que llevan incidencia. */
const filtrar = (lista = []) => (lista || []).filter(tiene);

/** «En la exterior UE-01» / «En la interior UI-01»: dónde está la incidencia que llega del conjunto. */
const dondeEsta = (x) => (x && x.enUnidad ? `En la ${x.enUnidad.exterior ? 'exterior' : 'interior'} ${x.enUnidad.tag}`.trim() : '');

/** «1 incidencia abierta» / «3 incidencias abiertas». */
const frase = (n) => `${n} ${n === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`;

/**
 * Reglas CSS para un plano que pinta el símbolo con `currentColor` y su interior en `.cuerpo` (el del móvil Cx).
 * `sel`: el selector del bloque con incidencia.
 */
function css(sel = '.marca-boca.bq-incidencia') {
  return `${sel}{color:${COLOR};--bq:${COLOR}}${sel} .cuerpo{fill:${COLOR};fill-opacity:${RELLENO}}.bq-punto-incidencia{background:${COLOR}}`;
}

const API = { COLOR, COLOR_TEXTO, RELLENO, DISTINTIVO, CLAVE, NOMBRE, ABIERTAS, NOMBRE_ESTADO, estaAbierta, porEquipo, tiene, colorDe, recuento, filtrar, frase, dondeEsta, css };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.INCIDENCIA_PLANO = API;
})();
