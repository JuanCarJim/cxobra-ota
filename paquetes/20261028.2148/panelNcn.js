'use strict';
/*
 * EL PANEL DE LA OBRA (NCN) EN EL MÓVIL (28-oct, JC: «el panel de NCN también
 * en el móvil»; tarea dd0c5ec6). Dos bloques del Inicio, con los mismos datos
 * que el panel del escritorio:
 *   · «UTAs hoy»: las puestas en marcha y los balanceos de UTAs que tocan hoy,
 *     cada equipo con su TAG (la misma regla del escritorio: shared/commissioning,
 *     familia TROX_UTA) y marcado si ya está hecho.
 *   · «Puestos en marcha»: lo ya puesto en marcha (estadoPM enMarcha o hecha),
 *     por tipo de equipo, con el nombre de cada uno; tocar uno abre su ficha.
 * Qué bloques ver lo decide el selector «Ver» del Inicio (carcasa.js); este
 * fichero solo pinta. Sirve en el navegador (window.CX.panelNcn) y en node
 * (module.exports) para las pruebas.
 */
(function panelNcn(raiz) {
  const FAMILIA_UTA = 'TROX_UTA';
  const TIPOS = {
    TROX_UTA: 'UTAs', CARRIER_ROOFTOPS: 'Rooftops', CARRIER_CHILLERS: 'Enfriadoras / bombas de calor',
    AIRLAN_FANCOIL: 'Fan coils', AIRLAN_HRU: 'Recuperadores', PANASONIC_VRF: 'VRF', PANASONIC_SPLIT: 'Splits',
    PANASONIC_CRACS: 'CRAC', WILO_GP: 'Grupos de presión', WILO_PUMPS: 'Bombas',
    SP_VENTILACION: 'Ventiladores', SP_PARKING: 'Ventiladores', SP_PRESURIZACION: 'Ventiladores',
  };
  const MAX_FILAS = 40;
  const PM_HECHA = new Set(['enMarcha', 'hecha']);
  const esc0 = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, cifra) => (cifra ? cifra(v) : String(v));
  const tipoDe = (familia) => TIPOS[familia] || (familia ? String(familia).replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'Sin tipología');
  const cmp = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });

  /** Lo de hoy en UTAs: [{ tarea, equipos: [{ id, tag, hecho, sub }] }] por tarea (Puesta en marcha, Balanceo…). */
  function utasDeHoy(plan) {
    if (!plan || !plan.ok) return [];
    const por = new Map();
    for (const s of plan.sesiones || []) {
      if (s.fecha !== plan.hoy || s.ambito !== 'commissioning') continue;
      const tarea = s.tarea || 'Commissioning';
      for (const i of s.items || []) {
        if (i.familia !== FAMILIA_UTA) continue;
        if (!por.has(tarea)) por.set(tarea, new Map());
        por.get(tarea).set(i.id, { id: i.id, tag: i.tag || i.texto, hecho: Boolean(i.hecho), sub: i.sub || '', franja: s.franja || '' });
      }
    }
    return [...por].map(([tarea, m]) => ({ tarea, equipos: [...m.values()].sort((a, b) => cmp(a.tag, b.tag)) }))
      .sort((a, b) => cmp(a.tarea, b.tarea));
  }

  /** Lo ya puesto en marcha, por tipo: [{ tipo, equipos: [{ id, nombre, planta, hecha }] }], los tipos con más primero. */
  function puestosEnMarcha(cx) {
    if (!cx || !cx.ok) return [];
    const lista = cx.conjuntos && cx.conjuntos.length ? cx.conjuntos : (cx.equipos || []);
    const por = new Map();
    for (const e of lista) {
      if (!PM_HECHA.has(e.estadoPM)) continue;
      const tipo = tipoDe(e.familia);
      if (!por.has(tipo)) por.set(tipo, []);
      por.get(tipo).push({ id: e.id, nombre: e.nombre || e.tag, planta: e.planta || '', hecha: e.estadoPM === 'hecha' });
    }
    return [...por].map(([tipo, equipos]) => ({ tipo, equipos: equipos.sort((a, b) => cmp(a.nombre, b.nombre)) }))
      .sort((a, b) => b.equipos.length - a.equipos.length || cmp(a.tipo, b.tipo));
  }

  function enlace(e, esc, extra) {
    return `<a class="ag-equipo${e.hecho || e.hecha ? ' hecho' : ''}" href="#commissioning" data-ir-abrir="${esc(e.id)}">${e.hecho ? '✓ ' : ''}${esc(e.tag || e.nombre)}${extra ? ` <small>${esc(extra)}</small>` : ''}</a>`;
  }

  /** El bloque «UTAs hoy» (data-bloque-ini="utas"); '' si hoy no hay UTAs. */
  function htmlUtasHoy(plan, { esc = esc0, cifra } = {}) {
    const g = utasDeHoy(plan);
    if (!g.length) return '';
    const total = g.reduce((n, x) => n + x.equipos.length, 0);
    return `<section class="ag-bloque" data-bloque-ini="utas">
        <h2 class="titulo-grupo ag-titulo">UTAs hoy <span>${num(total, cifra)}</span></h2>
        ${g.map((x) => `<div class="ag-fila"><div class="ag-que"><b>${esc(x.tarea)}</b> · ${x.equipos.map((e) => enlace(e, esc)).join(', ')}</div>
          <span class="ag-cuenta">${num(x.equipos.filter((e) => e.hecho).length, cifra)}/${num(x.equipos.length, cifra)}</span></div>`).join('')}
      </section>`;
  }

  /** El bloque «Puestos en marcha» (data-bloque-ini="marcha"); '' si aún no hay ninguno. */
  function htmlPuestosEnMarcha(cx, { esc = esc0, cifra } = {}) {
    const g = puestosEnMarcha(cx);
    if (!g.length) return '';
    const total = g.reduce((n, x) => n + x.equipos.length, 0);
    return `<section class="ag-bloque" data-bloque-ini="marcha">
        <h2 class="titulo-grupo ag-titulo">Puestos en marcha <span>${num(total, cifra)}</span></h2>
        ${g.map((x) => `<details class="ag-atras"><summary>${esc(x.tipo)} · ${num(x.equipos.length, cifra)}</summary>
          <div class="ag-fila"><div class="ag-que">${x.equipos.slice(0, MAX_FILAS).map((e) => enlace(e, esc, e.planta)).join(', ')}${x.equipos.length > MAX_FILAS ? ` y ${num(x.equipos.length - MAX_FILAS, cifra)} más` : ''}</div></div>
        </details>`).join('')}
      </section>`;
  }

  const api = { utasDeHoy, puestosEnMarcha, htmlUtasHoy, htmlPuestosEnMarcha, FAMILIA_UTA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz && raiz.CX) raiz.CX.panelNcn = api;
})(typeof window !== 'undefined' ? window : null);
