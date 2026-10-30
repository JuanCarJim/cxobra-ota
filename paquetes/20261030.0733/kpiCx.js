'use strict';
/*
 * LAS CIFRAS DE «FALTA ESTANQUEIDAD» QUE EL MÓVIL ENSEÑA EN DOS SITIOS (29-oct-2026).
 * El Inicio decía «Falta estanq. 1 de 1» y Commissioning decía 0: uno leía
 * `faltaEstanqueidad` (le toca la prueba y no la tiene superada) y el otro
 * `faltaEstanqueidadEnvio` (solo los que ya esperan SOLO esa prueba, con papeles
 * y fichas hechos). Una sola cuenta para los dos: la primera, que es la verdad
 * de «cuántos equipos tienen la prueba por hacer». Si el servidor no la manda
 * (obra vieja), la segunda.
 * Lógica pura, para node y para la pantalla.
 */
(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.KPI_CX = API;
})({
  faltaEstanqueidad: (t) => Number((t && (t.faltaEstanqueidad !== undefined ? t.faltaEstanqueidad : t.faltaEstanqueidadEnvio)) || 0),
});
