'use strict';
/*
 * «PARECE QUE ESTÁS EN N10 · CAMBIAR» (18-nov-2026, JC en obra: «Planta es lo que necesito»).
 * La regla es shared/commissioning/plantaAuto.js (window.PLANTA_AUTO); la lectura, el plugin nativo «Planta»
 * (cxobra/nativo/PlantaPlugin.swift y .java: barómetro + BSSID del wifi). Esto es solo la capa:
 *   · contexto(ctx): lo llama posicionPlanoCapa.js con cada punto por contexto (placa, ficha, equipo o sala). Calibra
 *     «presión = planta» y aprende «BSSID → planta» (tabla local, por obra).
 *   · montar(raiz, p, extra): lo llama posicionPlanoCapa.js al pintar el plano. Mide cada 20 s mientras el plano está a la
 *     vista y, si toca, pone un aviso discreto abajo a la izquierda. Nunca cambia de planta sola: solo al tocar «Cambiar».
 *   · En la web o con una app sin el plugin, no hace nada (ni aviso ni error).
 */
(function plantaAutoCapa() {
  const PA = window.PLANTA_AUTO;
  const C = window.CX;
  if (!PA || !C) return;
  const esc = C.esc || ((t) => String(t));
  const CADA_MS = 20000;
  const PLAZO_MS = 6000;

  let $raiz = null; let planta = null; let plantas = [];
  let reloj = null; let midiendo = false; let sinPlugin = false;
  let propuesta = null; /* { planta, por, texto } */
  let silencio = null; /* { planta, en }: el aviso que se cerró */

  const obra = () => (C.obraId && C.obraId()) || '';
  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch { return def; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const kCal = () => `cx.plantaAuto.cal.${obra()}`;
  const kWifi = () => `cx.plantaAuto.wifi.${obra()}`;
  /* La altura de planta cuando el modelo no trae cotas: 4,5 m, o la que se guarde para la obra. */
  const alturaPlanta = () => Number(leer(`cx.plantaAuto.alturaPlanta.${obra()}`, PA.ALTURA_PLANTA_M)) || PA.ALTURA_PLANTA_M;

  /* El plugin propio de Cx, sin paquete npm; como Biometría, también por el nombre de la clase en iOS. */
  function plugin() {
    const Cap = window.Capacitor;
    if (!Cap || sinPlugin) return null;
    try { if (Cap.isNativePlatform && !Cap.isNativePlatform()) return null; } catch { return null; }
    try {
      if (typeof Cap.isPluginAvailable === 'function' && Cap.isPluginAvailable('Planta')) return Cap.registerPlugin ? Cap.registerPlugin('Planta') : Cap.Plugins.Planta;
    } catch { /* sigue */ }
    if (typeof Cap.nativePromise === 'function' && Cap.getPlatform && Cap.getPlatform() === 'ios') return { medir: () => Cap.nativePromise('PlantaPlugin', 'medir', {}) };
    return null;
  }

  async function medir() {
    const P = plugin();
    if (!P) return null;
    try {
      return await Promise.race([P.medir(), new Promise((_, mal) => setTimeout(() => mal(new Error('plazo')), PLAZO_MS))]);
    } catch {
      sinPlugin = true; /* un binario sin el plugin no contesta: no se vuelve a esperar en esta sesión */
      return null;
    }
  }

  /** Un punto por contexto: «estoy en esta planta». */
  async function contexto(ctx) {
    if (!ctx || !ctx.planta) return;
    const m = await medir();
    if (!m) return;
    const cal = PA.calibrar(ctx.planta, m.presion);
    if (cal) escribir(kCal(), cal);
    if (m.bssid) escribir(kWifi(), PA.aprender(leer(kWifi(), {}), m.bssid, ctx.planta));
    if (propuesta && String(propuesta.planta).toUpperCase() === String(ctx.planta).toUpperCase()) propuesta = null;
    pintar();
  }

  async function mirar() {
    if (midiendo || !$raiz || !$raiz.isConnected || document.hidden || !planta) return;
    midiendo = true;
    try {
      const m = await medir();
      if (!m) { propuesta = null; return; }
      const baro = PA.porBarometro({ cal: leer(kCal(), null), presion: m.presion, plantas, alturaPlanta: alturaPlanta() });
      const wifi = PA.porWifi(leer(kWifi(), {}), m.bssid);
      propuesta = PA.decidir({ elegida: planta.planta, baro, wifi, plantas, silencio });
    } finally { midiendo = false; pintar(); }
  }

  function estilo() {
    if (document.getElementById('estilo-planta-auto')) return;
    const s = document.createElement('style');
    s.id = 'estilo-planta-auto';
    s.textContent = `
  .pa-aviso{position:absolute;left:8px;bottom:8px;z-index:7;display:flex;align-items:center;gap:2px;max-width:calc(100% - 64px);font:500 12px/16px system-ui,sans-serif;color:var(--texto,#262b38);background:color-mix(in srgb,var(--papel,#fff) 94%,transparent);border-left:3px solid #7c3aed;border-radius:6px;padding:3px 4px 3px 8px;box-shadow:0 1px 4px rgba(0,0,0,.15)}
  .pa-aviso span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pa-aviso button{border:0;background:none;color:#7c3aed;font:700 12px/16px system-ui,sans-serif;padding:6px;min-height:0;min-width:0;width:auto;margin:0;cursor:pointer;white-space:nowrap}`;
    document.head.appendChild(s);
  }

  function pintar() {
    if (!$raiz) return;
    const visor = $raiz.querySelector('.pe-visor');
    let av = visor && visor.querySelector('[data-pa-aviso]');
    if (!propuesta || !visor) { if (av) av.remove(); return; }
    if (!av) { av = document.createElement('div'); av.className = 'pa-aviso'; av.dataset.paAviso = '1'; av.setAttribute('role', 'status'); visor.appendChild(av); }
    av.innerHTML = `<span>${esc(propuesta.texto)}</span><button type="button" data-pa-cambiar="${esc(propuesta.planta)}">· Cambiar</button><button type="button" data-pa-cerrar aria-label="Cerrar el aviso">×</button>`;
  }

  /** Cambia de planta como si el usuario la eligiera: el desplegable de la pestaña Cx, o la pestaña de la planta. */
  function cambiar(nombre) {
    if (!$raiz) return;
    const sel = $raiz.querySelector('select[data-pe-planta-sel]');
    if (sel && [...sel.options].some((o) => o.value === nombre)) {
      sel.value = nombre;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const b = [...$raiz.querySelectorAll('[data-pe-planta]')].find((x) => x.dataset.pePlanta === nombre);
      if (b) b.click();
    }
    propuesta = null; pintar();
  }

  function montar(raiz, p, extra = {}) {
    estilo();
    $raiz = raiz; planta = p;
    if (Array.isArray(extra.plantas) && extra.plantas.length) plantas = extra.plantas;
    if (propuesta && p && String(propuesta.planta).toUpperCase() === String(p.planta || '').toUpperCase()) propuesta = null;
    pintar();
    if (!reloj && plugin()) { reloj = setInterval(mirar, CADA_MS); setTimeout(mirar, 1500); }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!$raiz || !t || !t.closest) return;
    const c = t.closest('[data-pa-cambiar]');
    if (c) { ev.stopPropagation(); cambiar(c.dataset.paCambiar); return; }
    if (t.closest('[data-pa-cerrar]')) { ev.stopPropagation(); if (propuesta) silencio = { planta: propuesta.planta, en: Date.now() }; propuesta = null; pintar(); }
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mirar(); });

  window.CX_PLANTA_AUTO = { montar, contexto, _estado: () => ({ propuesta, plantas, planta: planta && planta.planta, cal: leer(kCal(), null), wifi: leer(kWifi(), {}) }) };
})();
