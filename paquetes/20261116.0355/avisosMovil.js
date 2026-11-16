'use strict';
/*
 * LOS AVISOS DE VIDAIRE CX, FLOTANTES (28-oct-2026, tarea 9396f194; gemela de
 * Vidaire Obras, renderer/avisoFlotante.js). JC, 25-oct: «Lo de la
 * configuración de los avisos es para todas las apps de Vidaire».
 *
 * Usa el mismo componente que el escritorio (window.AVISO_FLOTANTE) y, sin
 * tocar cada pantalla, vigila lo que se pinta:
 *
 *   · Nada del globo nativo del `title`: se pasa a data-aviso-texto y sale la
 *     burbuja común. En el móvil, tocar la etiqueta la abre y se queda hasta
 *     tocar fuera; con ratón se abre al pasar, se cierra al quitar el cursor y
 *     pulsar la fija (lo hace avisoFlotante.js).
 *   · Nada de bandas que empujen el contenido: las notas de aviso en línea
 *     (p.nota.aviso, p.nota.mal) seguidas se juntan en un indicador pequeño
 *     «⚠ N avisos» que abre el recuadro flotante con el texto íntegro.
 *     Con ratón, el recuadro también se abre al pasar y se cierra al salir;
 *     pulsar lo fija hasta pulsar fuera o Esc.
 *
 * Se quedan en línea, a propósito: la nota de una boca (.boca, va pegada a la
 * medida que la provoca) y lo que lleve data-aviso-en-linea.
 */
(function () {
  if (typeof document === 'undefined' || !document || typeof MutationObserver === 'undefined') return;
  const AF = window.AVISO_FLOTANTE;
  if (!AF) return;

  const NOTAS = 'p.nota.aviso, p.nota.mal';
  const EN_LINEA = '.avisoFlot, .avisoBurbuja, .boca, [data-aviso-en-linea]';
  /* Donde el title es el nombre del contenido y no un aviso: se deja. */
  const TITULO_PROPIO = 'iframe, svg, svg *, abbr';

  const conRaton = () => { try { return window.matchMedia('(hover: hover)').matches; } catch { return false; } };

  function huella(t) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function sinTitulo(el) {
    const t = el.getAttribute('title');
    if (t == null || el.matches(TITULO_PROPIO)) return;
    el.removeAttribute('title');
    /* Dentro del propio aviso (la X, el indicador) basta con quitar el globo. */
    if (!t.trim() || el.closest('.avisoFlot')) return;
    if (!el.hasAttribute('data-aviso-texto')) el.setAttribute('data-aviso-texto', t);
    if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
  }

  function juntarNotas(raiz) {
    const notas = [];
    if (raiz.matches && raiz.matches(NOTAS)) notas.push(raiz);
    if (raiz.querySelectorAll) notas.push(...raiz.querySelectorAll(NOTAS));
    const hechas = new Set();
    for (const p of notas) {
      if (hechas.has(p) || !p.isConnected || p.closest(EN_LINEA)) continue;
      /* Las que van seguidas, en un solo indicador. */
      const grupo = [p];
      let sig = p.nextElementSibling;
      while (sig && sig.matches(NOTAS) && !sig.closest(EN_LINEA)) { grupo.push(sig); sig = sig.nextElementSibling; }
      grupo.forEach((x) => hechas.add(x));
      const contenido = grupo.map((x) =>
        `<p class="lineaAviso${x.classList.contains('mal') ? ' bloqueante' : ''}">${x.innerHTML}</p>`).join('');
      const tmp = document.createElement('div');
      tmp.innerHTML = AF.html({
        id: `cx-${huella(grupo.map((x) => x.textContent).join('|'))}`,
        cuenta: grupo.length,
        contenido,
      });
      const aviso = tmp.firstElementChild;
      if (!aviso) continue;
      aviso.classList.add('avisoMovil');
      p.parentNode.insertBefore(aviso, p);
      grupo.forEach((x) => x.remove());
    }
  }

  function repasar(raiz) {
    if (!raiz || raiz.nodeType !== 1) return;
    juntarNotas(raiz);
    if (raiz.hasAttribute('title')) sinTitulo(raiz);
    raiz.querySelectorAll('[title]').forEach(sinTitulo);
  }

  const vigia = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'attributes') { if (c.target.nodeType === 1) sinTitulo(c.target); continue; }
      c.addedNodes.forEach(repasar);
    }
  });
  function empezar() {
    repasar(document.body);
    vigia.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
  }
  if (document.body) empezar(); else document.addEventListener('DOMContentLoaded', empezar);

  /* Con ratón, el indicador se abre al pasar y se cierra al salir; pulsar lo fija. */
  let cierre = null;
  document.addEventListener('mouseover', (e) => {
    if (!conRaton()) return;
    const raiz = e.target.closest && e.target.closest('.avisoFlot');
    if (!raiz) return;
    clearTimeout(cierre);
    if (!raiz.classList.contains('abierto')) { AF.abrir(raiz); raiz.dataset.porRaton = '1'; }
  });
  document.addEventListener('mouseout', (e) => {
    const raiz = e.target.closest && e.target.closest('.avisoFlot');
    if (!raiz || raiz.dataset.porRaton !== '1') return;
    if (e.relatedTarget && raiz.contains(e.relatedTarget)) return;
    /* Un respiro para cruzar el hueco entre el indicador y el recuadro. */
    clearTimeout(cierre);
    cierre = setTimeout(() => {
      if (raiz.dataset.porRaton === '1') { delete raiz.dataset.porRaton; AF.cerrar(raiz); }
    }, 250);
  });
  document.addEventListener('click', (e) => {
    const boton = e.target.closest && e.target.closest('.avisoFlotBoton');
    const raiz = boton && boton.closest('.avisoFlot');
    if (!raiz || raiz.dataset.porRaton !== '1') return;
    delete raiz.dataset.porRaton;
    /* Abierto al pasar: pulsar lo fija (sin esto, el clic lo cerraría). */
    if (raiz.classList.contains('abierto')) { clearTimeout(cierre); e.stopPropagation(); }
  }, true);

  window.AVISOS_MOVIL = { repasar };
})();
