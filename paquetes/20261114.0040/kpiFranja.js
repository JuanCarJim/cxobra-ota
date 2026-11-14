/*
 * EL PIE DE LOS KPI, COMO TOOLTIP (9-nov-2026, JC: «No me convencen las
 * tarjetas tan grandes»). La franja compacta (kpiFranja.css) no pinta el pie
 * ni la barra de avance de cada KPI: aquí se pasa su texto al title, para que
 * se lea al pasar el ratón (o al tocar, en el móvil). Vale para escritorio,
 * web y móvil Cx, sin tocar el HTML de ninguna pantalla: un observador mira lo
 * que se pinta y le pone el title a cada KPI nuevo una sola vez.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const KPI = [
    '.kpis:not(.kpisControl) > .kpi', '.bandaCx:not(.bandaQH) > .celdaBanda', '.franjaPm > .cifraPm',
    '.kpis-cx > .kpi-cx',
  ].map((s) => `${s}:not([data-kpi-t])`).join(', ');
  const PIE = ':scope > :is(.pie, .pieBanda, .cpPie, small)';

  function titular(el) {
    el.setAttribute('data-kpi-t', '');
    const pie = Array.from(el.querySelectorAll(PIE)).map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
    if (!pie) return;
    const t = (el.getAttribute('title') || '').trim();
    if (!t) el.setAttribute('title', pie);
    else if (!t.includes(pie)) el.setAttribute('title', `${t} · ${pie}`);
  }

  let pendiente = false;
  function repasar() {
    pendiente = false;
    document.querySelectorAll(KPI).forEach(titular);
  }
  function programar() {
    if (pendiente) return;
    pendiente = true;
    (window.requestAnimationFrame || setTimeout)(repasar);
  }
  new MutationObserver(programar).observe(document.documentElement, { childList: true, subtree: true });
  programar();
  window.KPI_FRANJA = { repasar, titular };
})();
