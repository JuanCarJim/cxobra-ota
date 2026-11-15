'use strict';
/*
 * EL AVISO FLOTANTE (gemela de Vidaire Obras, 22-oct y 25-oct; JC: «TODOS LOS AVISOS DE LA APP SIEMPRE EN
 * VENTANAS EMERGENTES»). Ningún aviso, confirmación o error ocupa sitio en la pantalla ni empuja el contenido:
 *
 *   · Cualquier elemento `.aviso` que una pantalla pinte en línea se recoge solo (MutationObserver) y se
 *     sustituye por un indicador pequeño («⚠ 2 avisos»); el aviso, con sus botones y enlaces, pasa a un panel
 *     flotante anclado al indicador. Los avisos seguidos se juntan en un solo indicador.
 *   · Con ratón, al pasar por encima el panel se abre y al quitarlo se cierra; al pulsar se queda fijo hasta
 *     pulsar fuera o Esc. En táctil (sin hover), tocar abre y fija.
 *   · `data-aviso-texto="…"` (y las etiquetas ámbar/rojas que antes enseñaban el globo nativo del `title`)
 *     abren la misma burbuja flotante.
 *   · `alert()` ya no es una ventana del sistema: sale como aviso flotante que se va solo.
 */
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /*
   * LA GRAVEDAD (gemela de Vidaire Obras 2e8671f, 22017bb y 9f20033). Cada pantalla la dice con
   * nombres distintos (`error`, `malo`, `ok`, `hecho`…): aquí se reducen a cuatro, y el fondo la dice:
   *   mal    grave (bloquea o deja algo fuera) → rojo suave;
   *   aviso  importante                       → azul suave (el ámbar pasó a azul en Obras, 28-oct);
   *   info   solo informa                     → azul, sin fondo de alarma;
   *   bien   hecho, guardado                  → verde suave.
   * El panel toma la PEOR de lo que lleva; cada aviso de dentro conserva su tono.
   */
  const GRAVE = /\b(bloqueante|grave|malo?|error)\b/;
  const BIEN = /\b(bien|ok|hecho|exito)\b/;
  const INFO = /\b(info|neutra)\b/;
  const IMPORTANTE = /\b(advertencia|importante)\b/;
  const ORDEN = ['mal', 'aviso', 'info', 'bien'];
  function nivelDe(clases) {
    const c = String(clases || '');
    if (GRAVE.test(c)) return 'mal';
    if (IMPORTANTE.test(c)) return 'aviso';
    if (BIEN.test(c)) return 'bien';
    if (INFO.test(c)) return 'info';
    return 'aviso';
  }
  /** La peor gravedad de una lista de niveles (vacía → 'aviso'). */
  function peorDe(niveles) {
    const n = [...niveles];
    return ORDEN.find((x) => n.includes(x)) || 'aviso';
  }
  function textoCuenta(n) { return `${n} ${n === 1 ? 'aviso' : 'avisos'}`; }
  /** El símbolo del indicador según la gravedad. */
  function iconoDe(nivel) { return nivel === 'bien' ? '✓' : nivel === 'info' ? 'ℹ' : '⚠'; }

  /* alert() no trae clase: la gravedad se lee del texto. */
  function nivelDeTexto(texto) {
    const t = String(texto == null ? '' : texto);
    if (/error|no se pudo|fall[óoa]|no se puede|imposible/i.test(t)) return 'mal';
    if (/^\s*(✓|hecho|guardad[oa]s?|listo|programad[oa]s?|exportad[oa]s?|copiad[oa]s?|enviad[oa]s?)(?=[\s.,:;!]|$)/i.test(t)) return 'bien';
    return 'aviso';
  }
  if (typeof document === 'undefined' || !document || typeof document.addEventListener !== 'function') {
    const api = { nivelDe, peorDe, iconoDe, nivelDeTexto, textoCuenta };
    if (typeof module !== 'undefined') module.exports = api;
    return;
  }

  const conRaton = () => { try { return window.matchMedia('(hover: hover)').matches; } catch { return true; } };

  /* ── El panel de un indicador ─────────────────────────────────────── */
  let cierre = null;
  function colocar(raiz) {
    const boton = raiz.querySelector(':scope > .avisoFlotBoton');
    const panel = raiz.querySelector(':scope > .avisoFlotPanel');
    const r = boton.getBoundingClientRect();
    const ancho = Math.min(560, window.innerWidth - 16);
    panel.style.width = `${ancho}px`;
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8))}px`;
    panel.style.top = `${r.bottom + 2}px`;
    panel.style.maxHeight = `${Math.max(120, window.innerHeight - r.bottom - 16)}px`;
  }
  function abrir(raiz, fijo) {
    clearTimeout(cierre);
    for (const o of document.querySelectorAll('.avisoFlot.abierto')) if (o !== raiz) cerrar(o);
    cerrarBurbuja();
    raiz.querySelector(':scope > .avisoFlotPanel').hidden = false;
    raiz.querySelector(':scope > .avisoFlotBoton').setAttribute('aria-expanded', 'true');
    raiz.classList.add('abierto');
    if (fijo) raiz.classList.add('fijo');
    colocar(raiz);
  }
  function cerrar(raiz) {
    raiz.querySelector(':scope > .avisoFlotPanel').hidden = true;
    raiz.querySelector(':scope > .avisoFlotBoton').setAttribute('aria-expanded', 'false');
    raiz.classList.remove('abierto', 'fijo');
  }
  function cerrarTodos() { for (const o of document.querySelectorAll('.avisoFlot.abierto')) cerrar(o); }

  function crearIndicador(avisos) {
    const raiz = document.createElement('span');
    raiz.className = 'avisoFlot';
    raiz.innerHTML = `<button type="button" class="avisoFlotBoton" aria-haspopup="dialog" aria-expanded="false"></button>
      <div class="avisoFlotPanel" role="dialog" aria-label="Avisos" hidden><div class="avisoFlotCuerpo"></div></div>`;
    raiz.querySelector('.avisoFlotCuerpo').append(...avisos);
    actualizar(raiz);
    return raiz;
  }
  /* La cuenta y el tono salen de lo que el panel lleva ahora (puede cambiar si la pantalla toca un aviso). */
  function actualizar(raiz) {
    const vivos = [...raiz.querySelectorAll('.avisoFlotCuerpo > .aviso')].filter((a) => !a.hidden && a.textContent.trim());
    raiz.hidden = vivos.length === 0;
    if (!vivos.length) { cerrar(raiz); return; }
    const peor = peorDe(vivos.map((a) => nivelDe(a.className)));
    for (const n of ORDEN) raiz.classList.toggle(n, n === peor);
    /* Cada aviso lleva su tono, también dentro de un panel de otra gravedad. */
    for (const a of vivos) a.setAttribute('data-gravedad', nivelDe(a.className));
    raiz.querySelector('.avisoFlotBoton').textContent = `${iconoDe(peor)} ${textoCuenta(vivos.length)}`;
  }

  /* ── Recoger los avisos en línea ──────────────────────────────────── */
  /* Solo las franjas: «aviso» también es el tono de una etiqueta, un KPI o una celda, y esos no se tocan. */
  const FRANJA = ':is(div, p, section, aside).aviso:not([class*="cmp-"]):not(.kpi):not(.chip):not(.kpi-valor):not(.punto-boca)';
  const DENTRO_DE_TABLA = 'td, th, tr, .avisoFlotCuerpo, .avisoBurbuja, button, label, select';
  function recoger() {
    const sueltos = [...document.querySelectorAll(FRANJA)].filter((a) => !a.hidden && !a.closest(DENTRO_DE_TABLA) && a.textContent.trim());
    const hechos = new Set();
    for (const a of sueltos) {
      if (hechos.has(a)) continue;
      const tanda = [a];
      let s = a.nextElementSibling;
      while (s && sueltos.includes(s)) { tanda.push(s); s = s.nextElementSibling; }
      tanda.forEach((x) => hechos.add(x));
      const marca = document.createComment('aviso');
      a.before(marca);
      marca.replaceWith(crearIndicador(tanda));
    }
    for (const raiz of document.querySelectorAll('.avisoFlot')) actualizar(raiz);
    // Un indicador al que ya no le queda nada se va.
    for (const raiz of document.querySelectorAll('.avisoFlot[hidden]')) if (!raiz.querySelector('.aviso')) raiz.remove();
    convertirTitulos();
  }

  /* ── La burbuja de un elemento (en lugar del `title` nativo) ──────── */
  const ETIQUETAS_DE_AVISO = '[title]:is(.cmp-m, .cmp-res, .cmp-res-mini, .chip, .etiqueta, .estado, .pildora, .badge, .tag, .kpi-valor, .punto-boca):is(.aviso, .mal, .malo)';
  function convertirTitulos() {
    for (const el of document.querySelectorAll(ETIQUETAS_DE_AVISO)) {
      el.setAttribute('data-aviso-texto', el.getAttribute('title'));
      el.setAttribute('data-aviso-nivel', nivelDe(el.className));
      el.removeAttribute('title');
    }
  }
  let burbuja = null, burbujaDe = null, burbujaFija = false;
  function laBurbuja() {
    if (!burbuja) {
      burbuja = document.createElement('div');
      burbuja.className = 'avisoBurbuja';
      burbuja.setAttribute('role', 'tooltip');
      burbuja.hidden = true;
      document.body.appendChild(burbuja);
    }
    return burbuja;
  }
  function colocarBurbuja(el, b) {
    const r = el.getBoundingClientRect();
    b.style.left = '0px'; b.style.top = '0px';
    b.style.maxWidth = `${Math.min(420, window.innerWidth - 16)}px`;
    const w = b.offsetWidth, h = b.offsetHeight;
    const abajo = r.bottom + 4;
    b.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    b.style.top = `${abajo + h + 8 <= window.innerHeight ? abajo : Math.max(8, r.top - h - 4)}px`;
  }
  function abrirBurbuja(el, fija) {
    const texto = el.getAttribute('data-aviso-texto');
    if (!texto) return;
    cerrarTodos();
    const b = laBurbuja();
    b.textContent = texto;
    b.className = `avisoBurbuja ${el.getAttribute('data-aviso-nivel') || 'aviso'}${fija ? ' fija' : ''}`;
    b.hidden = false;
    burbujaDe = el; burbujaFija = Boolean(fija);
    colocarBurbuja(el, b);
  }
  function cerrarBurbuja() {
    if (burbuja) burbuja.hidden = true;
    burbujaDe = null; burbujaFija = false;
  }

  /* ── Avisos que llegan por alert() ────────────────────────────────── */
  function aviso(texto, { nivel = 'aviso', ms } = {}) {
    let caja = document.getElementById('avisoToasts');
    if (!caja) {
      caja = document.createElement('div');
      caja.id = 'avisoToasts';
      document.body.appendChild(caja);
    }
    const t = document.createElement('div');
    t.className = `avisoToast ${nivel}`;
    t.setAttribute('role', 'status');
    t.innerHTML = '<div class="avisoToastTexto"></div><button type="button" class="avisoFlotCerrar" aria-label="Cerrar">×</button>';
    t.querySelector('.avisoToastTexto').textContent = String(texto == null ? '' : texto);
    let reloj = null;
    const quitar = () => { clearTimeout(reloj); t.remove(); };
    const armar = () => { clearTimeout(reloj); if (!t.classList.contains('fijo')) reloj = setTimeout(quitar, ms || Math.min(15000, 4500 + String(texto).length * 40)); };
    t.querySelector('.avisoFlotCerrar').addEventListener('click', quitar);
    t.addEventListener('mouseenter', () => clearTimeout(reloj));
    t.addEventListener('mouseleave', armar);
    t.addEventListener('click', () => t.classList.add('fijo'));
    caja.appendChild(t);
    armar();
    return t;
  }
  window.alert = (texto) => { aviso(texto, { nivel: nivelDeTexto(texto) }); };

  /* ── Los oyentes ──────────────────────────────────────────────────── */
  document.addEventListener('mouseover', (e) => {
    if (!conRaton()) return;
    const raiz = e.target.closest && e.target.closest('.avisoFlot');
    if (raiz) { clearTimeout(cierre); if (!raiz.classList.contains('abierto')) abrir(raiz, false); return; }
    if (burbujaFija) return;
    const el = e.target.closest && e.target.closest('[data-aviso-texto]');
    if (el && el !== burbujaDe) abrirBurbuja(el, false);
  });
  document.addEventListener('mouseout', (e) => {
    if (!conRaton()) return;
    const raiz = e.target.closest && e.target.closest('.avisoFlot');
    if (raiz && !raiz.classList.contains('fijo') && !(e.relatedTarget && raiz.contains(e.relatedTarget))) {
      clearTimeout(cierre);
      cierre = setTimeout(() => { if (!raiz.classList.contains('fijo')) cerrar(raiz); }, 220);
    }
    if (!burbujaFija && burbujaDe && !(e.relatedTarget && burbujaDe.contains(e.relatedTarget)) && e.target.closest && e.target.closest('[data-aviso-texto]') === burbujaDe) cerrarBurbuja();
  });
  document.addEventListener('click', (e) => {
    const raiz = e.target.closest && e.target.closest('.avisoFlot');
    if (raiz && e.target.closest('.avisoFlotBoton')) {
      if (raiz.classList.contains('fijo')) cerrar(raiz); else abrir(raiz, true);
    } else if (!raiz) {
      cerrarTodos();
    }
    const el = e.target.closest && e.target.closest('[data-aviso-texto]');
    const accion = el && e.target.closest('button, a, input, select, textarea');
    if (el && !accion) {
      if (burbujaFija && burbujaDe === el) cerrarBurbuja(); else abrirBurbuja(el, true);
    } else if (!(e.target.closest && e.target.closest('.avisoBurbuja'))) cerrarBurbuja();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarTodos(); cerrarBurbuja(); } });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.avisoFlot.abierto').forEach(colocar);
    if (burbujaDe && burbuja && !burbuja.hidden) colocarBurbuja(burbujaDe, burbuja);
  });
  window.addEventListener('scroll', (e) => {
    const dentro = e.target.closest && e.target.closest('.avisoFlotPanel');
    if (!dentro) { for (const o of document.querySelectorAll('.avisoFlot.abierto:not(.fijo)')) cerrar(o); }
    if (burbujaDe && !(e.target.closest && e.target.closest('.avisoBurbuja'))) cerrarBurbuja();
  }, true);

  let pendiente = false;
  let observador = null;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      observador.disconnect();
      try { recoger(); } finally { observar(); }
    });
  }
  function observar() {
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  function arrancar() {
    observador = new MutationObserver(programar);
    recoger();
    observar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();

  window.AVISO_FLOTANTE = { aviso, abrir, cerrar, cerrarTodos, nivelDe, peorDe, iconoDe, nivelDeTexto, textoCuenta, abrirBurbuja, cerrarBurbuja, recoger: recoger };
})();
