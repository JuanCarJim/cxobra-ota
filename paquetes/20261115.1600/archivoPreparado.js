'use strict';
/*
 * «PREPARAR ARCHIVO» (5-nov-2026, JC): cuando todas las hojas de un equipo
 * están listas, el móvil prepara UN PDF con todas ellas —una detrás de otra,
 * en el mismo orden numerado que en la pantalla, cada una en página nueva con
 * su formato y sus fotos— y el jefe de obra lo descarga en el ordenador o la
 * web para mandarlo. La app no manda correos.
 *
 * Aquí, la regla (la misma en el teléfono, que pinta el botón, y en la ruta
 * que genera el PDF, que lo vuelve a comprobar):
 *
 *   estadoVisible / esDefinitiva   lo que dice el chip «Definitiva/Borrador»
 *   hojasDelArchivo(fichas, op)    las hojas del PDF, en el orden de la pantalla
 *   listo(fichas, op)              { listo, faltan[] }: si sale el botón y qué falta
 *
 * Las fichas son las de `GET api/fichas` (electron/movil/rutasFichas.js).
 */
(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.ARCHIVO_PREPARADO = API;
})((() => {
  /* «A medias» sin un solo dato relleno se contradice (JC, 29-oct): sin datos, «Sin empezar».
     Y al revés: «2 de 2 datos» y «A medias» se contradicen: entera, «Completa». */
  const estadoVisible = (estado, medidos, bocasSinMedir) => {
    if (estado !== 'pendiente' || !medidos) return estado;
    if (!medidos.rellenos) return 'sinEmpezar';
    return medidos.obligatorios && medidos.rellenos >= medidos.obligatorios && !(bocasSinMedir || []).length ? 'completa' : estado;
  };
  const esDefinitiva = (x) => Boolean(x) && ['completa', 'firmada'].includes(estadoVisible(x.estado, x.medidos, x.bocasSinMedir));

  const esBalanceo = (x) => x.clase === 'balanceo';

  /**
   * Las hojas del archivo, en el orden de la ficha del equipo del móvil:
   *   1…n  las fichas numeradas (checklist, PM, estanqueidad…: ni balanceo, ni UIs, ni conservadas)
   *   n+1  la hoja de balanceo, si el equipo la tiene (la fila «BALANCEO» de la lista)
   *   …    las tomas de cada unidad interior del VRF, en su orden
   * Cada una: { tipo: 'ficha'|'balanceo', i (índice en fichas), clave, plantilla, nombre, ficha }.
   * `balanceo`: true si la pantalla enseña la fila del balanceo aunque no haya ficha de balanceo.
   */
  function hojasDelArchivo(fichas = [], { balanceo = false } = {}) {
    const todas = (fichas || []).map((x, i) => [x, i]).filter(([x]) => x && !x.conservada);
    const ficha = ([x, i]) => ({ tipo: 'ficha', i, clave: x.clave, plantilla: x.plantilla, nombre: x.nombre, ficha: x });
    const numeradas = todas.filter(([x]) => x.papel !== 'UI' && !esBalanceo(x)).map(ficha);
    const bal = todas.find(([x]) => esBalanceo(x));
    const hojaBal = bal || balanceo
      ? [{ tipo: 'balanceo', i: bal ? bal[1] : null, clave: bal ? bal[0].clave : null, plantilla: bal ? bal[0].plantilla : null, nombre: bal ? bal[0].nombre : 'Balanceo', ficha: bal ? bal[0] : null }]
      : [];
    const uis = todas.filter(([x]) => x.papel === 'UI' && !esBalanceo(x)).map(ficha);
    return [...numeradas, ...hojaBal, ...uis];
  }

  /**
   * ¿Está todo listo para preparar el archivo?
   *   bocas: { total, medidas, fuera } del plano de balanceo (el teléfono las sabe; la ruta, no hace falta)
   * Listo = al menos una hoja, todas con plantilla y definitivas (Completa o Firmada)
   * y, si hay plano de bocas, todas medidas y ninguna fuera de tolerancia.
   */
  function listo(fichas = [], { balanceo = false, bocas = null } = {}) {
    const hojas = hojasDelArchivo(fichas, { balanceo });
    const faltan = [];
    if (!hojas.length) return { listo: false, faltan: ['El equipo no tiene hojas'], hojas };
    for (const h of hojas) {
      const n = h.nombre || 'Hoja';
      if (h.tipo === 'balanceo' && !h.ficha) continue; /* sin hoja propia: cuentan las bocas */
      if (!h.plantilla) faltan.push(`${n}: sin plantilla`);
      else if (!esDefinitiva(h.ficha)) faltan.push(`${n}: en borrador`);
    }
    if (bocas && bocas.total) {
      if ((bocas.medidas || 0) < bocas.total) faltan.push(`Balanceo: ${bocas.medidas || 0} de ${bocas.total} bocas medidas`);
      if (bocas.fuera) faltan.push(`Balanceo: ${bocas.fuera} boca${bocas.fuera === 1 ? '' : 's'} fuera de tolerancia`);
    }
    return { listo: !faltan.length, faltan, hojas };
  }

  /** El nombre del PDF: «TAG - hojas del equipo.pdf». */
  const nombreArchivo = (tag) => `${String(tag || 'Equipo').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Equipo'} - hojas del equipo.pdf`;

  return { estadoVisible, esDefinitiva, hojasDelArchivo, listo, nombreArchivo };
})());
