'use strict';
/*
 * LOS EQUIPOS CON INCIDENCIA EN EL PLANO (14-nov-2026, JC: «Si hay algún equipo con incidencia deberá verse en otro
 * color»). UNA sola regla para el plano del escritorio, el de la web y el del móvil Cx.
 *
 *   · QUÉ ES «CON INCIDENCIA»: el equipo lleva al menos una incidencia ABIERTA del registro de incidencias y
 *     reparaciones —abierta o en curso—. Las terminadas por el encargado y las cerradas por el jefe de obra ya están
 *     resueltas y no van en naranja (18-nov-2026, JC: «hay equipos con incidencias que ya han sido cerradas o
 *     terminadas que siguen viéndose en naranja»); las anuladas no cuentan. Cuenta el equipo de la incidencia y los que lleve en `equiposIds`.
 *   · EL COLOR: naranja intenso, distinto de los de los estados (rojo, azul, verde, gris). Mismo estilo que ellos:
 *     el contorno del color y el interior del mismo color, suave y semitransparente. Nunca amarillo ni negro.
 *   · LA INCIDENCIA MANDA sobre el color del estado: el bloque se pinta naranja, tenga el estado que tenga. El estado
 *     no se pierde: se sigue contando en su casilla de la leyenda y se lee en el panel del equipo.
 *   · SIN COLOR TAMBIÉN SE DISTINGUE: lleva el distintivo «!».
 *
 * Contraste (WCAG): el naranja #e0671f da 3,4:1 sobre blanco y 3,0:1 sobre el arena del plano: vale para contornos y
 * figuras (≥ 3:1), no para letra. La letra y las cifras van en el tono oscuro #a8440b (6,0:1 sobre blanco, 5,4:1 sobre el arena).
 *
 * INCIDENCIA RESUELTA, FALTAN LOS DATOS (15-nov-2026, JC: «si la incidencia de ese equipo se ha resuelto, tiene que
 * verse en azul, en espera de que se tomen los datos, pero con el signo de exclamación […] ahora en azul»):
 *   · RESUELTA = TERMINADA por el encargado o CERRADA por el jefe de obra (18-nov-2026, JC: «deberían verse en azul
 *     por estar terminada o cerrada la incidencia y/o en verde porque se les tomó datos de puesta en marcha»).
 *   · DATOS TOMADOS = una toma de datos de Cx COMPLETA o FIRMADA de ESA unidad con el día de la toma igual o posterior
 *     al del cierre (el día de la toma es el de shared/commissioning/fechaPM.js, sin las fechas solo de garantía; la
 *     fechaPuestaMarcha no se mira), o el equipo validado en Commissioning tras esa incidencia («Validado tras
 *     incidencia»: equiposObra.revalidadoTras = su código). El día del cierre: fechaCierre (si falta, fechaTerminada).
 *   · EL COLOR: cerrada y sin datos tomados → AZUL (#1f63c6, el azul del sistema de colorBloque) con el «!» en azul;
 *     cerrada y con los datos tomados → el color de su estado, sin «!» (verde si el Cx está hecho).
 *   · Manda la abierta: con una sin cerrar y otra resuelta, naranja. Pasa al conjunto igual que la abierta; cada
 *     unidad mira su propia toma de datos; la exterior, además, la de las unidades de la incidencia (18-nov: la
 *     exterior de un split no tiene hoja de toma propia, la lleva su interior).
 *   · Contraste: #1f63c6 da 5,8:1 sobre blanco (vale para figura y para letra).
 *
 * INCIDENCIA DE TERCEROS (18-nov-2026, JC: «si tiene una incidencia por terceros, que salga en otro color, en naranja
 * no»): la abierta marcada «de terceros» (incidencias.responsable = 'terceros': otro industrial o el cliente) pinta el
 * equipo en MORADO (#7b3fb0) con su «!» morado y su casilla en la leyenda. El naranja queda para las abiertas nuestras
 * (o sin marcar). Manda la nuestra: con una nuestra y otra de terceros, naranja. Resuelta, sigue la regla de arriba.
 *   · Contraste: #7b3fb0 da 7,0:1 sobre blanco (figura y letra); no se confunde con el azul #1f63c6 ni con el verde.
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
/* Abiertas: las que siguen sin resolver en obra (18-nov, JC: la terminada ya no va en naranja). */
const ABIERTAS = ['abierta', 'enCurso'];
/* Resueltas: terminada por el encargado o cerrada por el jefe de obra (18-nov, JC). */
const RESUELTAS = ['terminada', 'cerrada'];
const NOMBRE_ESTADO = { abierta: 'Abierta', enCurso: 'En curso', terminada: 'Por revisar', cerrada: 'Cerrada' };
const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
/* Resuelta y sin los datos tomados (15-nov). */
const COLOR_RESUELTA = '#1f63c6';
const CLAVE_RESUELTA = 'incResuelta';
const NOMBRE_RESUELTA = 'Resuelta, faltan datos';
/* Abierta de terceros (18-nov). */
const COLOR_TERCEROS = '#7b3fb0';
const CLAVE_TERCEROS = 'incTerceros';
const NOMBRE_TERCEROS = 'Incidencia de terceros';

/* La partición de conjuntos de siempre (shared/commissioning/conjuntos.js), en Node y en la pantalla. */
const conjuntosCx = () => {
  try { if (typeof require === 'function') return require('./conjuntos'); } catch { /* sin require */ }
  return typeof window !== 'undefined' ? window.CONJUNTOS_CX || null : null;
};
const leerLista = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const estaAbierta = (i) => Boolean(i && !i.borrado && ABIERTAS.includes(i.estado));
const deTerceros = (i) => Boolean(i && i.responsable === 'terceros');
const estaResuelta = (i) => Boolean(i && !i.borrado && RESUELTAS.includes(i.estado));
const dia = (v) => { const t = String(v || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };
/** El día en que se resolvió: el del cierre; si no consta, el de terminada. */
const diaCierre = (i) => (i ? dia(i.fechaCierre) || dia(i.fechaTerminada) : null);

/** Lo que el plano enseña de una incidencia: nada de dinero ni de horas. */
const breve = (i) => ({ id: i.id, codigo: i.codigo || '', titulo: i.titulo || '', estado: i.estado, estadoNombre: NOMBRE_ESTADO[i.estado] || i.estado, prioridad: i.prioridad || null,
  ...(deTerceros(i) ? { terceros: true, empresa: String(i.responsableEmpresa || '').trim() || null } : {}) });

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
  return repartir(incidencias, equipos, estaAbierta, breve);
}

function repartir(incidencias, equipos, vale, resumen) {
  const mapa = new Map();
  const poner = (id, x) => {
    if (!mapa.has(id)) mapa.set(id, []);
    if (!mapa.get(id).some((y) => y.id === x.id)) mapa.get(id).push(x);
  };
  const propias = [];
  for (const i of incidencias || []) {
    if (!vale(i)) continue;
    for (const id of new Set([i.equipoId, ...leerLista(i.equiposIds)].filter(Boolean))) {
      poner(id, resumen(i));
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
      for (const u of unidades) if (u.id !== id) poner(u.id, { ...resumen(i), enUnidad });
    }
  }
  const peso = (x) => (x.prioridad in ORDEN_PRIORIDAD ? ORDEN_PRIORIDAD[x.prioridad] : 1);
  for (const l of mapa.values()) l.sort((a, b) => peso(a) - peso(b) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  return mapa;
}

/**
 * Las incidencias RESUELTAS (cerradas) de cada equipo que esperan la toma de datos (15-nov, JC). La misma partición de
 * conjuntos que `porEquipo`; cada unidad, con su toma.
 * @param {object[]} incidencias  filas del registro (con fechaCierre / fechaTerminada)
 * @param {object[]} [equipos]    filas de los equipos, para el conjunto
 * @param {object} [datos]
 *   tomaDe(id)       → 'AAAA-MM-DD' de la ÚLTIMA toma de datos completa o firmada de esa unidad, o null
 *   validadoTras(id) → el código de la incidencia tras la que se validó en Commissioning (revalidadoTras), o null
 * @returns {Map<string, object[]>} id del equipo → sus resueltas a falta de datos (con `cierre`)
 */
function resueltasPorEquipo(incidencias = [], equipos = null, { tomaDe = () => null, validadoTras = () => null } = {}) {
  /* 18-nov (JC): la EXTERIOR de un split o un VRF no lleva toma de datos propia —la hoja de puesta en marcha es la de la
     interior—: vale también la toma de las unidades de la incidencia. La interior sigue mirando solo la suya. */
  const unidadesDe = (i) => [...new Set([i.equipoId, ...leerLista(i.equiposIds)].filter(Boolean))];
  const CJ = Array.isArray(equipos) && equipos.length ? conjuntosCx() : null;
  const filaDe = new Map((CJ ? equipos : []).map((e) => [e.id, e]));
  const exterior = (id) => Boolean(CJ && filaDe.has(id) && CJ.esExterior(filaDe.get(id)));
  const m = repartir(incidencias, equipos, estaResuelta, (i) => ({ ...breve(i), cierre: diaCierre(i), unidades: unidadesDe(i) }));
  const salida = new Map();
  for (const [id, l] of m) {
    const resuelve = (x) => (exterior(id) ? [id, ...(x.unidades || [])] : [id]).some((u) => {
      const toma = dia(tomaDe(u));
      const validada = validadoTras(u);
      return (toma && x.cierre && toma >= x.cierre) || (validada && validada === x.codigo);
    });
    const faltan = l.filter((x) => !resuelve(x)).map(({ unidades, ...x }) => x);
    if (faltan.length) salida.set(id, faltan);
  }
  return salida;
}

/** ¿Lleva incidencia abierta NUESTRA (naranja)? Vale el recuento (`inc`, las nuestras), la lista (`incidencias`, se
 *  descuentan las de terceros) o el propio número. */
const nuestra = (i) => !(i && i.terceros);
function tiene(x) {
  if (typeof x === 'number') return x > 0;
  if (Array.isArray(x)) return x.some(nuestra);
  return Boolean(x && ((Number(x.inc) || 0) > 0 || (Array.isArray(x.incidencias) && x.incidencias.some(nuestra))));
}

/** ¿Lleva solo abiertas DE TERCEROS (morado)? Vale el recuento (`incTer`) o la lista (`incidencias`). La nuestra manda. */
function tieneTerceros(x) {
  if (tiene(x)) return false;
  if (Array.isArray(x)) return x.some((i) => i && i.terceros);
  return Boolean(x && typeof x === 'object' && ((Number(x.incTer) || 0) > 0 || (Array.isArray(x.incidencias) && x.incidencias.some((i) => i && i.terceros))));
}

/** ¿Lleva incidencia resuelta a falta de datos? Vale el recuento (`incRes`), la lista (`resueltas`) o el propio número. */
function tieneResuelta(x) {
  if (typeof x === 'number') return x > 0;
  if (Array.isArray(x)) return x.length > 0;
  return Boolean(x && ((Number(x.incRes) || 0) > 0 || (Array.isArray(x.resueltas) && x.resueltas.length > 0)));
}
/** Azul con «!»: resuelta, faltan datos, y ninguna abierta (la abierta manda). */
const pendienteDatos = (x, resueltas = x) => !tiene(x) && !tieneTerceros(x) && tieneResuelta(resueltas);

/**
 * El color que le toca al bloque: la incidencia abierta manda sobre el estado; después, la resuelta a falta de datos.
 * @param {string} estado  la clave del estado del bloque (la de cada plano: 'pedido', 'cxHecho'…)
 * @param {*} incidencias  lo que entiende `tiene` (la marca entera vale para los dos)
 * @param {*} [resueltas]  lo que entiende `tieneResuelta`; por defecto, lo mismo que `incidencias`
 * @returns {{ clave: string, estado: string, incidencia: boolean, resuelta: boolean, distintivo: string }}
 */
function colorDe(estado, incidencias, resueltas = incidencias) {
  const inc = tiene(incidencias);
  const ter = !inc && tieneTerceros(incidencias);
  const res = !inc && !ter && tieneResuelta(resueltas);
  return { clave: inc ? CLAVE : ter ? CLAVE_TERCEROS : res ? CLAVE_RESUELTA : estado, estado, incidencia: inc, ...(ter ? { terceros: true } : {}), resuelta: res, distintivo: inc || ter || res ? DISTINTIVO : '' };
}

/** Cuántos equipos de la lista llevan incidencia abierta (la cifra de «Con incidencia N»). */
const recuento = (lista = []) => (lista || []).filter(tiene).length;

/** El filtro de la leyenda: los que llevan incidencia. */
const filtrar = (lista = []) => (lista || []).filter(tiene);

/** Cuántos van en azul con «!» (resuelta, faltan datos) y el filtro de su casilla. */
const recuentoResueltas = (lista = []) => (lista || []).filter((x) => pendienteDatos(x)).length;
const filtrarResueltas = (lista = []) => (lista || []).filter((x) => pendienteDatos(x));

/** Cuántos van en morado (solo abiertas de terceros) y el filtro de su casilla (18-nov). */
const recuentoTerceros = (lista = []) => (lista || []).filter(tieneTerceros).length;
const filtrarTerceros = (lista = []) => (lista || []).filter(tieneTerceros);

/** «En la exterior UE-01» / «En la interior UI-01»: dónde está la incidencia que llega del conjunto. */
const dondeEsta = (x) => (x && x.enUnidad ? `En la ${x.enUnidad.exterior ? 'exterior' : 'interior'} ${x.enUnidad.tag}`.trim() : '');

/** «1 incidencia abierta» / «3 incidencias abiertas». */
const frase = (n) => `${n} ${n === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`;

/** «1 incidencia resuelta, faltan datos» / «2 incidencias resueltas, faltan datos». */
const fraseResuelta = (n) => `${n} ${n === 1 ? 'incidencia resuelta' : 'incidencias resueltas'}, faltan datos`;

/**
 * Reglas CSS para un plano que pinta el símbolo con `currentColor` y su interior en `.cuerpo` (el del móvil Cx).
 * `sel`: el selector del bloque con incidencia; `selRes`: el de la resuelta a falta de datos (va después: la abierta
 * manda porque el bloque no lleva las dos clases). Lleva también las variables, por si la hoja de tokens no las trae.
 */
function css(sel = '.marca-boca.bq-incidencia', selRes = '.marca-boca.bq-incResuelta', selTer = '.marca-boca.bq-incTerceros') {
  return `:root{--incidencia:${COLOR};--incidenciaTexto:${COLOR_TEXTO};--incResuelta:${COLOR_RESUELTA};--incTerceros:${COLOR_TERCEROS}}`
    + `${selRes}{color:${COLOR_RESUELTA};--bq:${COLOR_RESUELTA}}${selRes} .cuerpo{fill:${COLOR_RESUELTA};fill-opacity:${RELLENO}}.bq-punto-incResuelta{background:${COLOR_RESUELTA}}`
    + `${selTer}{color:${COLOR_TERCEROS};--bq:${COLOR_TERCEROS}}${selTer} .cuerpo{fill:${COLOR_TERCEROS};fill-opacity:${RELLENO}}.bq-punto-incTerceros{background:${COLOR_TERCEROS}}`
    + `${sel}{color:${COLOR};--bq:${COLOR}}${sel} .cuerpo{fill:${COLOR};fill-opacity:${RELLENO}}.bq-punto-incidencia{background:${COLOR}}`;
}

const API = { COLOR, COLOR_TEXTO, RELLENO, DISTINTIVO, CLAVE, NOMBRE, ABIERTAS, RESUELTAS, NOMBRE_ESTADO, COLOR_RESUELTA, CLAVE_RESUELTA, NOMBRE_RESUELTA,
  COLOR_TERCEROS, CLAVE_TERCEROS, NOMBRE_TERCEROS, deTerceros, tieneTerceros, recuentoTerceros, filtrarTerceros,
  estaAbierta, estaResuelta, diaCierre, porEquipo, resueltasPorEquipo, tiene, tieneResuelta, pendienteDatos, colorDe, recuento, filtrar,
  recuentoResueltas, filtrarResueltas, frase, fraseResuelta, dondeEsta, css };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.INCIDENCIA_PLANO = API;
})();
