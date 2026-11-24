'use strict';
/*
 * LA PANTALLA CX DEL MÓVIL (13-nov-2026, JC: «un buscador y los planos interactivos»).
 * Las cuentas, sin pantalla, para poder probarlas: qué equipos salen al teclear,
 * con qué estado y en qué planta, y la franja fina de recuento. Nada de DOM, nada
 * de require: dentro de una función, porque en el móvil todos los scripts comparten ámbito.
 */
(function () {
const MAX = 40;

/* El estado que dice la fila de la lista (commissioning.js › htmlLista), para que plano, fila y resultado no se contradigan. */
function estadoDe(e) {
  const hecho = Boolean(e.completo) || e.envio === 'enviada';
  if (e.bloqueadoPor) return { estado: 'Bloqueado', tono: 'mal' };
  if (e.conIncidencias) return { estado: 'Con incidencia', tono: 'aviso' };
  if (hecho) return { estado: 'Listo', tono: 'bien' };
  if (e.estadoPM === 'enMarcha') return { estado: 'En marcha', tono: 'bien' };
  return { estado: 'Pendiente', tono: 'neutra' };
}

/* Sala y planta cortas, como en la fila: «N30 · Planta Baja». */
const salaDe = (e) => String(e.local || e.planta || '').split(' · ')[0];
const plantaDe = (e) => String(e.planta || '').trim();

/* Los ids con los que el plano puede conocer al equipo: el suyo y los de sus unidades. */
const idsDe = (e) => [e.id, ...((e.unidades || []).map((u) => u.id))].filter(Boolean);

/* Los TAG de un equipo (un conjunto con sus unidades dice todos), sin repetir. */
function tagsDe(e) {
  const t = [e.tag, ...((e.unidades || []).map((u) => u.tag))].filter(Boolean);
  return [...new Set(t)];
}

/**
 * Los equipos que casan con lo tecleado.
 * @param {Array} equipos conjuntos (o equipos) de api/commissioning
 * @param {string} consulta lo tecleado
 * @param {(q:string, textos:string[])=>boolean} coincide el comparador del móvil (BUSCADOR_MOVIL.coincide)
 * @param {(e:object)=>string[]} textos los campos donde se busca (TAG, tipo, sala, planta, conjunto…)
 * @param {{pasa?:(e:object)=>boolean, max?:number}} [op]
 * @returns {{total:number, filas:Array}}
 */
function buscar(equipos, consulta, coincide, textos, op = {}) {
  const q = String(consulta || '').trim().toLowerCase();
  const pasa = op.pasa || (() => true);
  const max = op.max || MAX;
  const hay = [];
  for (const e of equipos || []) {
    if (!pasa(e)) continue;
    if (q && !coincide(q, textos(e))) continue;
    hay.push(e);
  }
  const filas = hay.slice(0, max).map((e) => ({ id: e.id, ids: idsDe(e), tags: tagsDe(e), sala: salaDe(e), planta: plantaDe(e), porConfirmar: Boolean(e.porConfirmar), ...estadoDe(e) }));
  return { total: hay.length, filas };
}

/* La franja fina de arriba: cuatro cifras, sin tarjetas. */
function franja(t) {
  t = t || {};
  return [
    { id: 'todos', et: 'Equipos', n: t.equiposKpi || t.equipos || t.conjuntos || 0 },
    { id: 'enMarcha', et: 'En marcha', n: t.enMarcha || 0 },
    { id: 'faltaDoc', et: 'Falta doc.', n: t.faltaDocumentacion || 0 },
    { id: 'incidencias', et: 'Incidencias', n: t.conIncidencias || 0 },
  ];
}

const API = { estadoDe, salaDe, plantaDe, idsDe, tagsDe, buscar, franja, MAX };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.BUSCAR_CX = API;
})();
