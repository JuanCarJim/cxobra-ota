'use strict';
/*
 * EL ESTADO Y EL COLOR DE UN EQUIPO EN CUALQUIER PLANO, Y SU LEYENDA (18-nov-2026, JC: «es incoherente cómo se ven los
 * equipos con sus colores en la web y en el móvil, eso no puede ser»). UNA sola función para la web, el escritorio
 * (Commissioning › Plano › Por edificio y estado) y el móvil Cx (Plano de equipos).
 *
 * Antes el plano de la web pintaba con los estados del 9-nov (planosEdificio.estadoDe: no pedido / pedido azul /
 * instalado verde / «certificado» verde relleno) y el móvil con los del 13-nov (colorBloque): el mismo equipo salía azul
 * «pedido» en uno y gris claro «sin dato» en el otro. Valen los del 13-nov, que ya decían ser los de todos los planos:
 *   - el estado del equipo: shared/commissioning/colorBloque.js (certificado azul, Cx hecho verde, instalado sin Cx gris,
 *     no instalado gris claro con contorno discontinuo —18-nov, nunca rojo—, sin dato gris claro);
 *   - encima, la incidencia: shared/commissioning/incidenciaPlano.js (abierta naranja «!», de terceros morado «!»,
 *     resuelta a falta de datos azul «!»; terminada o cerrada con datos tomados, su color sin «!»).
 * Aquí no se inventa ningún estado: solo se juntan los dos en un sitio. Lo que no es un equipo de la obra (el modelo
 * le da código y ninguna ficha casa: «sin ficha»; o solo trae su referencia comercial: «solo en el modelo») no es un
 * estado del equipo y lo sigue diciendo el plano del modelo (planosEdificio.ESTADOS).
 */
(function () {
const enNode = typeof module !== 'undefined' && module.exports;
const CB = enNode ? require('./colorBloque') : window.COLOR_BLOQUE;
const IP = enNode ? require('./incidenciaPlano') : window.INCIDENCIA_PLANO;

const ESTADOS = CB.ESTADOS_BLOQUE;
const ORDEN = CB.ORDEN_BLOQUE;
const NOMBRE = Object.fromEntries(ESTADOS.map((x) => [x.id, x.nombre]));
/* 14-nov (JC en el iPhone, chips cortados a 390 px): los nombres cortos. */
const CORTO = { certificado: 'Certificado', cxHecho: 'Cx hecho', tomaHecha: 'Toma hecha', instalado: 'Instalado', noInstalado: 'No instalado', sinDato: 'Sin dato' };
const esEstado = (k) => ORDEN.includes(k);

/** La clave del estado de un equipo ya calculado: `bloque` (móvil) o `estado` (marca del plano del modelo). */
function estadoDe(x) {
  if (!x) return 'sinDato';
  if (esEstado(x.bloque)) return x.bloque;
  if (esEstado(x.estado)) return x.estado;
  return 'sinDato';
}

/**
 * El estado y el color con que se pinta un equipo. `x`: el equipo del plano (con `bloque` o `estado`, y sus
 * `incidencias`/`resueltas` o los recuentos `inc`/`incTer`/`incRes`). Devuelve la clave que se pinta (`clave`: el estado
 * o la incidencia que manda), el color, el nombre y el «!».
 */
function colorEquipo(x) {
  const estado = estadoDe(x);
  const c = IP.colorDe(estado, x);
  const hex = c.clave === IP.CLAVE ? IP.COLOR : c.clave === IP.CLAVE_TERCEROS ? IP.COLOR_TERCEROS : c.clave === IP.CLAVE_RESUELTA ? IP.COLOR_RESUELTA : CB.COLOR_BLOQUE[estado].hex;
  const nombre = c.clave === IP.CLAVE ? IP.NOMBRE : c.clave === IP.CLAVE_TERCEROS ? IP.NOMBRE_TERCEROS : c.clave === IP.CLAVE_RESUELTA ? IP.NOMBRE_RESUELTA : NOMBRE[estado];
  return { estado, clave: c.clave, hex, nombre, corto: CORTO[estado], distintivo: c.distintivo, incidencia: c.incidencia, terceros: Boolean(c.terceros), resuelta: c.resuelta };
}

/**
 * EL ESTADO DE UN EQUIPO DEL PLANO A PARTIR DE SUS DATOS (26-nov-2026, JC: «Aquí salen en azul equipos que no me salen en
 * azul en el móvil»). La regla de TODAS las apps: la web y el escritorio de Obras y del Gestor y el móvil Cx la llaman desde
 * planoEquipos.reglaBloque; antes cada repo llevaba su copia y se habían separado (el Gestor ya exigía el Cx completo).
 * `f`: la fila del equipo; `e`: su línea de Cx (planoEquipos.estados: color, completo, miembros). `montaje`: su fila de
 * equiposObra (estado, fechaInstalacion, instalacionVerificadaEn); `tomaDe`: Map equipoId → fecha de la toma PM completa;
 * `cert`: su certificación (vidaEquipo.certificacion o su estado: en el móvil, certificacionAlMovil).
 */
function estadoDelEquipo(f, e = {}, { montaje = null, tomaDe = new Map(), cert = null } = {}) {
  /* 15-nov (regla de JC: «con Cx hecho no le puede faltar nada»): verde por estar en marcha no es Cx hecho; solo con todas
     sus hojas y documentos completos (e.completo, la regla de la entrega a la DF). Lo demás, empezado. */
  const hecho = e.color === 'verde' && e.completo !== false;
  const ids = Array.isArray(e.miembros) && e.miembros.length ? e.miembros.map((m) => m.id) : [f.id];
  const tomaHecha = !hecho && CB.tomaHechaConjunto(ids, tomaDe);
  return CB.estadoBloque(montaje || f, { cxHecho: hecho, tomaHecha, cxEmpezado: e.color === 'azul' || (e.color === 'verde' && !hecho), cert });
}

/** Las cifras de la leyenda de una lista de equipos: por estado y las tres de incidencia. */
function cuentas(lista = []) {
  return { bloques: CB.recuentoBloques(lista, estadoDe), conIncidencia: IP.recuento(lista), incTerceros: IP.recuentoTerceros(lista), incResuelta: IP.recuentoResueltas(lista) };
}

/**
 * LA LEYENDA (la misma en la web y en el móvil): los cinco estados, en su orden y con su cifra, y detrás las tres de
 * incidencia. Cada casilla: { id, nombre, corto, hex, n, incidencia }. Las de incidencia, solo si tienen alguna o si
 * `todas` (la web enseña «Con incidencia 0» siempre).
 */
function leyenda(lista = [], { todas = false } = {}) {
  const c = cuentas(lista);
  const est = ESTADOS.map((x) => ({ id: x.id, nombre: x.nombre, corto: CORTO[x.id], hex: x.hex, nota: x.nota || '', n: c.bloques[x.id] || 0, incidencia: false }));
  const inc = [
    { id: IP.CLAVE, nombre: IP.NOMBRE, corto: IP.NOMBRE, hex: IP.COLOR, n: c.conIncidencia },
    { id: IP.CLAVE_TERCEROS, nombre: IP.NOMBRE_TERCEROS, corto: IP.NOMBRE_TERCEROS, hex: IP.COLOR_TERCEROS, n: c.incTerceros },
    { id: IP.CLAVE_RESUELTA, nombre: IP.NOMBRE_RESUELTA, corto: IP.NOMBRE_RESUELTA, hex: IP.COLOR_RESUELTA, n: c.incResuelta },
  ].map((x) => ({ ...x, nota: '', incidencia: true, distintivo: IP.DISTINTIVO })).filter((x) => todas || x.n > 0);
  return [...est, ...inc];
}

/* Los grises claros llevan el contorno más oscuro, y «no instalado» discontinuo: colorBloque. */
const contornoDe = CB.contornoDe;
/**
 * Las reglas CSS del plano del modelo de la web y el escritorio (planosEstado.css trae la forma; el color, de aquí):
 * el punto de la leyenda (`.pesPunto.<estado>`), el bloque del plano (`.pesBloque.<estado>`) y su símbolo
 * (`.pesSimbolo.<estado>`). Mismo contorno y mismo relleno suave (colorBloque.RELLENO_BLOQUE) que el móvil.
 */
function cssPlanoModelo() {
  const a = CB.RELLENO_BLOQUE;
  /* Con :where(), una sola clase de peso: la incidencia (.pesBloque.conIncidencia…) y lo dudoso siguen mandando. */
  return ESTADOS.map((x) => `.pesPunto:where(.${x.id}){border-color:${contornoDe(x)};background:${x.hex};border-width:1.5px;border-style:${x.trazo ? 'dashed' : 'solid'}}`
    + `.pesBloque:where(.${x.id}){stroke:${contornoDe(x)};fill:${x.hex};fill-opacity:${a}${x.trazo ? `;stroke-dasharray:${x.trazo}` : ''}}`
    + `.pesSimbolo:where(.${x.id}){color:${contornoDe(x)}}.pesRacimoTira:where(.${x.id}){fill:${x.hex}}`).join('');
}

const API = { ESTADOS, ORDEN, NOMBRE, CORTO, esEstado, estadoDe, estadoDelEquipo, colorEquipo, cuentas, leyenda, cssPlanoModelo };
if (enNode) module.exports = API;
if (typeof window !== 'undefined') window.ESTADO_EQUIPO_PLANO = API;
})();
