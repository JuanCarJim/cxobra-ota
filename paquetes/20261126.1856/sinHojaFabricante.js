'use strict';

/**
 * FAMILIAS QUE NO LLEVAN HOJA DE PUESTA EN MARCHA DEL FABRICANTE (26-nov-2026, JC: «en ventiladores no hay hoja de
 * puesta en marcha del fabricante, por lo que tienes que actualizar esa información en la app»).
 *
 * UN SOLO SITIO: lo que aquí diga que una familia no requiere la hoja lo respetan el estado de PM (control.js ›
 * estadoPMDerivado), la documentación propia («Falta documentación»), los KPI de Cx, la planificación, el Gantt, la
 * Entrega a la DF, el móvil e Iarvis. Para esas familias la PM queda completa con la ficha PM de Cx (más la checklist,
 * que ya cuenta aparte) y nunca se avisa de que falta la hoja del fabricante.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.SIN_HOJA_FABRICANTE = api;
})(typeof window !== 'undefined' ? window : null, function () {
const FAMILIAS = new Set([
  'SP_VENTILACION', 'SP_PARKING', 'SP_PRESURIZACION',
  /* El catálogo genérico por tipo del Gestor. */
  'VENTILACION', 'VENTILACION_PARKING', 'PRESURIZACION',
]);
const PLANTILLAS_PM = new Set(['VENTILADOR_AXIAL', 'VENTILADOR_EXTRACTOR', 'VENT_COMPLETO']);

const clave = (v) => String(v == null ? '' : v).trim().toUpperCase();

/** ¿La familia (o el equipo, o el conjunto) no requiere la hoja de PM del fabricante? Acepta un código o un objeto. */
function sinHojaFabricante(x) {
  if (x == null) return false;
  if (typeof x !== 'object') return FAMILIAS.has(clave(x));
  if (Array.isArray(x.miembros) && x.miembros.length) return x.miembros.every(sinHojaFabricante);
  return FAMILIAS.has(clave(x.familia)) || FAMILIAS.has(clave(x.codigoFamilia)) || PLANTILLAS_PM.has(clave(x.plantillaPM));
}

/** El texto del punto del checklist que dice «Se adjunta informe de puesta en marcha del fabricante…». */
const esPuntoInformeFabricante = (etiqueta) => /informe de puesta en marcha del fabricante/i.test(String(etiqueta || ''));

return { FAMILIAS_SIN_HOJA_FABRICANTE: FAMILIAS, sinHojaFabricante, esPuntoInformeFabricante };
});
