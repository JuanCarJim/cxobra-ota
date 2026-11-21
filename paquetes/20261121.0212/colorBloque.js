'use strict';
/*
 * EL COLOR DE CADA BLOQUE DE EQUIPO EN EL PLANO (13-nov-2026, JC; sustituye a los del 9-nov y a «En marcha / Falta doc. /
 * Sin empezar»). UNA sola regla para el móvil Cx, la web, el escritorio y el HTML de la DF. El color va en el contorno del
 * símbolo y, suave y semitransparente, en su relleno (14-nov); la leyenda y el recuento de arriba salen de aquí.
 *
 *   AZUL  certificado ............ su partida está certificada entera (vidaEquipo.certificacion → 'certificada';
 *                                  la certificación va por partida, no por unidad: lo dice estadoEjecucionPlano).
 *   VERDE commissioning hecho .... la regla de Cx de siempre (planoEquipos.estadoEnPlano 'verde': completo, entregado a
 *                                  la DF o «En marcha» de los KPI).
 *   GRIS  instalado sin Cx ....... (validado por JC el 18-nov) consta instalado (estado instalado / en
 *                                  marcha / recepcionado, fecha de instalación o instalación verificada) o ya se ha
 *                                  empezado su commissioning (alguien ha trabajado en él: está montado).
 *   GRIS CLARO DISCONTINUO no instalado .. consta que NO está montado: acopiado en almacén, o sin pedir según el registro
 *                                  de pedidos (estadoEjecucionPlano, que ya exige que el registro esté completo). 18-nov
 *                                  (JC: «Deja en gris claro las dos»): gris claro, nunca rojo (su regla del 14-nov); se
 *                                  distingue de «sin dato» por el contorno gris oscuro discontinuo.
 *   GRIS CLARO sin dato .......... nada de lo anterior. El estado «pendiente» de la base es el valor por defecto: no
 *                                  dice que no esté montado, así que no se pinta rojo.
 * Nada se inventa: sin dato fiable, «sin dato».
 */
(function () {

const ESTADOS_BLOQUE = [
  { id: 'certificado', nombre: 'Certificado', corto: 'Azul', hex: '#1f63c6' },
  { id: 'cxHecho', nombre: 'Commissioning hecho', corto: 'Verde', hex: '#1a7f4b' },
  { id: 'instalado', nombre: 'Instalado, sin Cx', corto: 'Gris', hex: '#7d838c' },
  { id: 'noInstalado', nombre: 'No instalado', corto: 'Gris claro discontinuo', hex: '#e3e5e8', contorno: '#5b626c', trazo: '3 2', nota: 'Contorno discontinuo' },
  { id: 'sinDato', nombre: 'Sin dato', corto: 'Gris claro', hex: '#d3d6db', contorno: '#8a9099', nota: 'Ninguna fuente dice si está instalado' },
];
const ORDEN_BLOQUE = ESTADOS_BLOQUE.map((e) => e.id);
const COLOR_BLOQUE = Object.fromEntries(ESTADOS_BLOQUE.map((e) => [e.id, e]));
const MONTADOS = new Set(['instalado', 'enMarcha', 'recepcionado']);
const hay = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/** ¿Consta instalado? (la misma regla que estadoEjecucionPlano.estaInstalado). */
const constaInstalado = (e) => Boolean(e && (MONTADOS.has(e.estado) || hay(e.fechaInstalacion) || hay(e.instalacionVerificadaEn)));

/**
 * El estado del bloque. `e`: el equipo (estado, fechaInstalacion, instalacionVerificadaEn). `ctx`:
 *   cxHecho     → la regla de Cx da verde;
 *   cxEmpezado  → alguien ha trabajado ya en su commissioning (azul de la regla de Cx);
 *   cert        → la certificación del equipo (vidaEquipo.certificacion) o su estado ('certificada'…); null si no se sabe;
 *   ejecucion   → el estado de estadoEjecucionPlano ('sinPedir'…), si se tiene.
 */
function estadoBloque(e, { cxHecho = false, cxEmpezado = false, cert = null, ejecucion = null } = {}) {
  const c = cert && typeof cert === 'object' ? cert.estado : cert;
  if (c === 'certificada' || c === 'certificado' || ejecucion === 'certificado') return 'certificado';
  if (cxHecho) return 'cxHecho';
  if (constaInstalado(e) || cxEmpezado) return 'instalado';
  if ((e && e.estado === 'acopiado') || ejecucion === 'sinPedir') return 'noInstalado';
  return 'sinDato';
}

/** El recuento por estado, con todos los estados aunque salgan a cero (leyenda de arriba). */
function recuentoBloques(lista = [], de = (x) => x.bloque) {
  const c = Object.fromEntries(ORDEN_BLOQUE.map((k) => [k, 0]));
  for (const x of lista) { const k = de(x); if (k in c) c[k] += 1; }
  return c;
}

/* 14-nov (JC: «lo que quería en verde o azul o rojo era el contorno y el interior del mismo color que el contorno pero más
   suave y semitransparente»): el CONTORNO del símbolo (currentColor) en el color del estado y el interior (`.cuerpo`) del
   mismo color al 28 %, que deja ver el plano debajo. Los grises claros («sin dato», «no instalado») no se leerían como
   contorno: lo llevan más oscuro (`contorno`), y el de «no instalado» además discontinuo (`trazo`), para no fundirse. */
const RELLENO_BLOQUE = 0.28;
const contornoDe = (x) => x.contorno || x.hex;
/** El trazo discontinuo de un estado (o ''), como stroke-dasharray. */
const trazoDe = (x) => x.trazo || '';
/** Reglas CSS: contorno y relleno suave del símbolo con el color del estado. `sel`: el selector del bloque. */
function cssBloques(sel = '.marca-boca') {
  return ESTADOS_BLOQUE.map((x) => `${sel}.bq-${x.id}{color:${contornoDe(x)};--bq:${x.hex}}${sel}.bq-${x.id} .cuerpo{fill:${x.hex};fill-opacity:${RELLENO_BLOQUE}${x.trazo ? `;stroke-dasharray:${x.trazo}` : ''}}.bq-punto-${x.id}{background:${x.hex}${x.trazo ? `;border:1.5px dashed ${contornoDe(x)};box-sizing:border-box` : ''}}`).join('');
}

/* El naranja del equipo con incidencia abierta NO vive aquí: es shared/commissioning/incidenciaPlano.js (14-nov). */
const API = { ESTADOS_BLOQUE, ORDEN_BLOQUE, COLOR_BLOQUE, RELLENO_BLOQUE, estadoBloque, recuentoBloques, constaInstalado, cssBloques, contornoDe, trazoDe };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.COLOR_BLOQUE = API;
})();
