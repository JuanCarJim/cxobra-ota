'use strict';
/*
 * LAS FOTOS DEL EQUIPO EN LA HOJA DEL PLANO DE COMMISSIONING, EN EL MÓVIL (17-nov-2026, JC: «en el plano de commissioning
 * poner esas fotos a esos equipos»). El escritorio ya las enseña en su panel (renderer/obra/planoEquiposPantalla.js ›
 * fotosHtml); aquí la hoja de planoEquipos.js deja un hueco (PLANO_FOTOS.hueco) y este fichero lo rellena en cuanto
 * aparece, con las del equipo y las de las otras unidades de su split o VRF (api/equipo/fotos/lista, ligera).
 * Tocar una foto la abre grande; tocar otra vez, se cierra.
 */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cache = new Map();

  const css = `.pe-fotos{margin:10px 0 4px}.pe-fotos h4{margin:0 0 6px;font-size:13px}
  .pe-fotos ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .pe-fotos li{margin:0;min-width:0}.pe-fotos button{all:unset;display:block;width:100%;cursor:pointer}
  .pe-fotos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:var(--rejillaSuave,var(--borde));display:block}
  .pe-fotos .pie{font-size:11px;color:var(--textoTenue);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pe-foto-grande{position:fixed;inset:0;z-index:2000;background:rgba(20,24,32,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:8px}
  .pe-foto-grande img{max-width:100%;max-height:82vh;object-fit:contain;border-radius:6px}
  .pe-foto-grande p{color:var(--blanco);margin:0;font-size:13px;text-align:center}`;

  function ponerCss() {
    if (document.getElementById('pe-fotos-css')) return;
    const s = document.createElement('style');
    s.id = 'pe-fotos-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /** El hueco que deja la hoja del equipo; se rellena solo. */
  function hueco(e) {
    if (!e || !e.id) return '';
    const ya = cache.get(e.id);
    return `<div class="pe-fotos" data-pe-fotos="${esc(e.id)}">${ya ? lista(ya) : ''}</div>`;
  }

  function lista(fotos) {
    if (!fotos.length) return '';
    return `<h4>Fotos del equipo <span class="tenue">${fotos.length}</span></h4><ul>${fotos.map((f) => {
      const pie = [f.tag, f.pie, f.hora].filter(Boolean).join(' · ');
      return `<li><button type="button" data-pe-foto-ver="${esc(f.url)}" data-pie="${esc(pie)}"><img loading="lazy" data-src="${esc(f.url)}" alt="${esc(f.pie || 'Foto')}"></button>${pie ? `<div class="pie">${esc(pie)}</div>` : ''}</li>`;
    }).join('')}</ul>`;
  }

  async function rellenar(el) {
    const id = el.getAttribute('data-pe-fotos');
    if (!id || el.dataset.cargado === id) return;
    el.dataset.cargado = id;
    try {
      const r = await fetch(`api/equipo/fotos/lista?id=${encodeURIComponent(id)}`);
      const j = r.ok ? await r.json() : null;
      const fotos = j && j.ok && Array.isArray(j.fotos) ? j.fotos : [];
      cache.set(id, fotos);
      if (el.isConnected && el.getAttribute('data-pe-fotos') === id) { el.innerHTML = lista(fotos); cargar(el); }
    } catch { /* sin conexión: la hoja sigue sin fotos */ }
  }

  /* 19-nov: las fotos de `api/…` piden la sesión (X-Sesion): con <img src> directo el navegador no la manda y salen rotas.
     Van con data-src y las trae CX.cargarImagenes (fetch con la sesión), como el resto del móvil. */
  function cargar(raiz) {
    if (window.CX && typeof window.CX.cargarImagenes === 'function') window.CX.cargarImagenes(raiz);
  }

  function revisar(raiz) {
    for (const el of (raiz || document).querySelectorAll('[data-pe-fotos]')) rellenar(el);
  }

  function verGrande(url, pie) {
    const d = document.createElement('div');
    d.className = 'pe-foto-grande';
    d.innerHTML = `<img data-src="${esc(url)}" alt="${esc(pie || 'Foto')}">${pie ? `<p>${esc(pie)}</p>` : ''}`;
    d.addEventListener('click', () => d.remove());
    document.body.appendChild(d);
    cargar(d);
  }

  function arrancar() {
    ponerCss();
    revisar(document);
    new MutationObserver((cambios) => {
      for (const c of cambios) for (const n of c.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches('[data-pe-fotos]')) { cargar(n); rellenar(n); }
        else if (n.querySelector && n.querySelector('[data-pe-fotos]')) { cargar(n); revisar(n); }
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-pe-foto-ver]');
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      verGrande(b.getAttribute('data-pe-foto-ver'), b.getAttribute('data-pie'));
    }, true);
  }

  if (typeof window !== 'undefined') {
    window.PLANO_FOTOS = { hueco };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
  }
})();
