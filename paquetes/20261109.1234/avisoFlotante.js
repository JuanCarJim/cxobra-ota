'use strict';
/*
 * EL AVISO FLOTANTE. Norma de JC: los avisos no ocupan sitio en la pantalla.
 *
 * En vez de una banda amarilla que empuja la tabla, un indicador pequeño
 * («⚠ 2 avisos») en la fila de herramientas; al pulsarlo se abre un panel
 * flotante, anclado al indicador y por encima de todo, con el contenido íntegro
 * y sus enlaces funcionando. Se cierra con Esc, clic fuera o la X.
 *
 *   window.AVISO_FLOTANTE.html({ id, cuenta, titulo, contenido, nivel, abrirSolo })
 *
 *   id         único por pantalla: recuerda por persona que ya se abrió solo.
 *   cuenta     número que sale en el indicador (por defecto 1).
 *   etiqueta   texto del indicador; por defecto «N aviso(s)».
 *   contenido  HTML del panel (los data-… de sus enlaces los recoge la
 *              pantalla igual que antes: el panel vive dentro del lienzo).
 *   nivel      'aviso' (importante: fondo amarillo suave) o 'mal' (grave: fondo rojo suave).
 *              Si el contenido lleva algún aviso «bloqueante»/«grave», el panel toma la peor.
 *   abrirSolo  true: la primera vez que esa persona entra se abre solo
 *              (nunca desplaza nada: es flotante). 'siempre': se abre cada vez
 *              que se pinta (para errores que no se pueden pasar por alto).
 */
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function persona() {
    const s = window.SESION || {};
    return s.personaId || s.usuarioId || s.email || s.rol || 'anon';
  }
  const claveVisto = (id) => `avisoFlotante:${persona()}:${id}`;
  function yaVisto(id) { try { return localStorage.getItem(claveVisto(id)) === '1'; } catch { return false; } }
  function marcarVisto(id) { try { localStorage.setItem(claveVisto(id), '1'); } catch { /* sin almacén: vale para esta visita */ } }

  /* La gravedad del panel es la PEOR de lo que lleva: si algún aviso va marcado como grave
     (clase «bloqueante» o «grave»: lo que impide seguir o deja algo fuera), el panel es rojo
     aunque el resto sean «importantes». Cada aviso conserva su propio tono. */
  const GRAVE = /class="[^"]*\b(bloqueante|grave)\b/;
  function nivelDe(nivel, contenido) {
    return nivel === 'mal' || GRAVE.test(String(contenido || '')) ? 'mal' : 'aviso';
  }

  function html({ id, cuenta = 1, etiqueta, titulo = 'Avisos', contenido, nivel = 'aviso', abrirSolo = false }) {
    if (!contenido) return '';
    nivel = nivelDe(nivel, contenido);
    const texto = etiqueta || `${cuenta} ${cuenta === 1 ? 'aviso' : 'avisos'}`;
    const auto = abrirSolo === 'siempre' || (abrirSolo && !yaVisto(id));
    if (auto) setTimeout(() => abrirAuto(), 0);
    return `<span class="avisoFlot ${nivel === 'mal' ? 'mal' : ''}" data-aviso-flot="${esc(id)}" ${auto ? 'data-auto-abrir' : ''}>
      <button type="button" class="avisoFlotBoton" aria-haspopup="dialog" aria-expanded="false"
              title="Ver los avisos de esta pantalla">⚠ ${esc(texto)}</button>
      <div class="avisoFlotPanel" role="dialog" aria-label="${esc(titulo)}" hidden>
        <div class="avisoFlotCabecera"><strong>${esc(titulo)}</strong>
          <button type="button" class="avisoFlotCerrar" data-aviso-cerrar aria-label="Cerrar" title="Cerrar (Esc)">×</button></div>
        <div class="avisoFlotCuerpo">${contenido}</div>
      </div></span>`;
  }

  function colocar(raiz) {
    const boton = raiz.querySelector('.avisoFlotBoton');
    const panel = raiz.querySelector('.avisoFlotPanel');
    const r = boton.getBoundingClientRect();
    const ancho = Math.min(560, window.innerWidth - 16);
    const izq = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    panel.style.width = `${ancho}px`;
    panel.style.left = `${izq}px`;
    panel.style.top = `${r.bottom + 4}px`;
    panel.style.maxHeight = `${Math.max(120, window.innerHeight - r.bottom - 16)}px`;
  }
  function abrir(raiz) {
    cerrarTodos(raiz);
    raiz.querySelector('.avisoFlotPanel').hidden = false;
    raiz.querySelector('.avisoFlotBoton').setAttribute('aria-expanded', 'true');
    raiz.classList.add('abierto');
    colocar(raiz);
    marcarVisto(raiz.dataset.avisoFlot);
  }
  function cerrar(raiz) {
    raiz.querySelector('.avisoFlotPanel').hidden = true;
    raiz.querySelector('.avisoFlotBoton').setAttribute('aria-expanded', 'false');
    raiz.classList.remove('abierto');
  }
  function cerrarTodos(salvo) {
    document.querySelectorAll('.avisoFlot.abierto').forEach((r) => { if (r !== salvo) cerrar(r); });
  }
  function abrirAuto() {
    const r = document.querySelector('.avisoFlot[data-auto-abrir]');
    if (!r) return;
    r.removeAttribute('data-auto-abrir');
    if (!document.querySelector('.avisoFlot.abierto')) abrir(r);
  }

  /*
   * LA BURBUJA DE UN ELEMENTO (27-oct, en lugar del title nativo, que se corta en el borde).
   * Cualquier elemento con data-aviso-texto="…" (texto llano; los saltos de línea se respetan)
   * y, si quiere, data-aviso-nivel="mal|aviso|info": al pasar el ratón se abre; al pulsar
   * se queda fija hasta Esc, clic fuera o desplazar. Se coloca DESPUÉS de rellenarla,
   * midiendo su ancho real: nunca se sale por la derecha ni por abajo (si no cabe, va encima).
   */
  let burbuja = null;
  let burbujaDe = null;
  let burbujaFija = false;
  /* Dentro de un <dialog> modal (capa superior) la burbuja tiene que vivir en el propio
     diálogo: colgada del body quedaría DEBAJO y no se vería (28-oct). */
  function laBurbuja(el) {
    if (!burbuja) {
      burbuja = document.createElement('div');
      burbuja.className = 'avisoBurbuja';
      burbuja.setAttribute('role', 'tooltip');
      burbuja.hidden = true;
    }
    const casa = (el && el.closest && el.closest('dialog[open]')) || document.body;
    if (burbuja.parentNode !== casa) casa.appendChild(burbuja);
    return burbuja;
  }
  function colocarBurbuja(el, b) {
    const r = el.getBoundingClientRect();
    b.style.left = '0px'; b.style.top = '0px';
    b.style.maxWidth = `${Math.min(420, window.innerWidth - 16)}px`;
    const w = b.offsetWidth; const h = b.offsetHeight;
    const izq = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const abajo = r.bottom + 4;
    const top = abajo + h + 8 <= window.innerHeight ? abajo : Math.max(8, r.top - h - 4);
    b.style.left = `${izq}px`;
    b.style.top = `${top}px`;
  }
  function abrirBurbuja(el, fija) {
    const texto = el.getAttribute('data-aviso-texto');
    if (!texto) return;
    cerrarTodos(null);
    const b = laBurbuja(el);
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

  /* Los oyentes, solo donde hay un documento de verdad (las pruebas cargan el script en un contexto vacío). */
  if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
    const conRaton = () => { try { return window.matchMedia('(hover: hover)').matches; } catch { return true; } };
    document.addEventListener('mouseover', (e) => {
      if (burbujaFija || !conRaton()) return;
      const el = e.target.closest && e.target.closest('[data-aviso-texto]');
      if (el && el !== burbujaDe) abrirBurbuja(el, false);
    });
    document.addEventListener('mouseout', (e) => {
      if (burbujaFija || !burbujaDe) return;
      const hacia = e.relatedTarget;
      if (!(hacia && burbujaDe.contains(hacia))) { if (e.target.closest && e.target.closest('[data-aviso-texto]') === burbujaDe) cerrarBurbuja(); }
    });
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-aviso-texto]');
      /* Solo en lo que no hace nada al pulsar (una etiqueta, una celda): los botones siguen siendo botones. */
      /* Ni dentro ni alrededor: la cifra de una pestaña o un aviso que lleva a otra vista navegan, no fijan. */
      const accion = el && e.target.closest('button, a, input, select, textarea, [data-rc-vista]');
      if (el && !accion) {
        if (burbujaFija && burbujaDe === el) cerrarBurbuja(); else abrirBurbuja(el, true);
      } else if (!(e.target.closest && e.target.closest('.avisoBurbuja'))) cerrarBurbuja();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarBurbuja(); });
    window.addEventListener('scroll', (e) => { if (burbujaDe && !(e.target.closest && e.target.closest('.avisoBurbuja'))) cerrarBurbuja(); }, true);
    window.addEventListener('resize', () => { if (burbujaDe && burbuja && !burbuja.hidden) colocarBurbuja(burbujaDe, burbuja); });

    document.addEventListener('click', (e) => {
      const raiz = e.target.closest && e.target.closest('.avisoFlot');
      if (raiz && e.target.closest('.avisoFlotBoton')) {
        if (raiz.classList.contains('abierto')) cerrar(raiz); else abrir(raiz);
      } else if (raiz && e.target.closest('[data-aviso-cerrar]')) {
        cerrar(raiz);
      } else if (!raiz) {
        cerrarTodos(null);
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarTodos(null); });
    window.addEventListener('resize', () => document.querySelectorAll('.avisoFlot.abierto').forEach(colocar));
    window.addEventListener('scroll', (e) => { if (!(e.target.closest && e.target.closest('.avisoFlotPanel'))) cerrarTodos(null); }, true);
  }

  window.AVISO_FLOTANTE = { html, abrir, cerrar, cerrarTodos, nivelDe, abrirBurbuja, cerrarBurbuja };
  if (typeof module !== 'undefined') module.exports = window.AVISO_FLOTANTE;
})();
