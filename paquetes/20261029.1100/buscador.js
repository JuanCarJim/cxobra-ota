/*
 * El buscador de las listas del móvil (29-oct-2026, JC): un solo campo para
 * Commissioning y Reparaciones, con su ✕ para borrar todo, su conmutador
 * «123 / ABC» y una búsqueda que casa aunque solo se escriban números.
 *
 *  - ✕: botón propio (el de type=search no es fiable en WKWebView), 44 px de toque.
 *  - 123 / ABC: inputmode "decimal" (el teclado numérico se queda en números;
 *    iOS vuelve al de letras al teclear punto o espacio tras los números) o
 *    "text". Se recuerda en localStorage.
 *  - Normalización: «10 002», «10.002», «10002» y «002» encuentran 10.STE.002,
 *    comparando solo los dígitos con cada código (TAG, sala, código de sala).
 */
(function buscadorMovil(raiz) {
  const CLAVE = 'movil.buscador.teclado';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Letras y cifras, sin tildes ni mayúsculas. */
  const plano = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const soloDigitos = (s) => String(s == null ? '' : s).replace(/\D/g, '');
  /* ¿La búsqueda es solo un número, con sus puntos, espacios o guiones? */
  const esNumerica = (q) => /\d/.test(q) && /^[\d\s.,\-_/]+$/.test(String(q));

  /* ¿Casa la búsqueda con alguno de los textos? (los textos son campos sueltos: un campo, un código). */
  function coincide(consulta, textos) {
    const bruta = String(consulta == null ? '' : consulta).trim().toLowerCase();
    if (!bruta) return true;
    const lista = (Array.isArray(textos) ? textos : [textos]).filter((t) => t != null && t !== '').map(String);
    if (lista.some((t) => t.toLowerCase().includes(bruta))) return true;
    const q = plano(bruta);
    if (!q) return false;
    if (lista.some((t) => plano(t).includes(q))) return true;
    if (esNumerica(bruta)) {
      const d = soloDigitos(bruta);
      return lista.some((t) => soloDigitos(t).includes(d));
    }
    return false;
  }

  /* Teclado elegido: 'decimal' (123) o 'text' (ABC). */
  function modo() {
    try { return localStorage.getItem(CLAVE) === 'decimal' ? 'decimal' : 'text'; } catch { return 'text'; }
  }
  function guardarModo(m) { try { localStorage.setItem(CLAVE, m); } catch { /* sin almacenamiento */ } }

  /* El HTML del campo; `atributo` es el data-… con el que la pantalla lo reconoce (p. ej. «data-cx-buscar»). */
  function campo({ placeholder, valor, atributo }) {
    const m = modo();
    const v = valor == null ? '' : String(valor);
    return `<div class="buscar-caja"><div class="buscar-campo"><input type="search" class="buscar" placeholder="${esc(placeholder)}" value="${esc(v)}" ${atributo} inputmode="${m}" enterkeyhint="search" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false">`
      + `<button type="button" class="buscar-borrar" data-buscar-borrar aria-label="Borrar lo escrito"${v ? '' : ' hidden'}>✕</button></div>`
      + `<button type="button" class="buscar-modo" data-buscar-modo aria-label="Cambiar el teclado entre números y letras" title="Teclado"><span class="${m === 'decimal' ? 'activa' : ''}">123</span><span class="${m === 'text' ? 'activa' : ''}">ABC</span></button></div>`;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    const caja = (el) => el.closest('.buscar-caja');
    /* El toque no debe quitarle el foco al campo (si no, el teclado se cierra). */
    document.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest && ev.target.closest('[data-buscar-borrar], [data-buscar-modo]')) ev.preventDefault();
    });
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-buscar-borrar], [data-buscar-modo]');
      if (!b || !caja(b)) return;
      const i = caja(b).querySelector('input.buscar');
      if (!i) return;
      if (b.hasAttribute('data-buscar-borrar')) {
        i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        /* La pantalla repinta la lista y con ella el campo: el foco vuelve al nuevo. */
        const nuevo = document.querySelector('input.buscar[data-cx-buscar], input.buscar[data-rp-buscar]') || i;
        nuevo.focus();
        return;
      }
      const m = modo() === 'decimal' ? 'text' : 'decimal';
      guardarModo(m);
      i.setAttribute('inputmode', m);
      for (const s of b.querySelectorAll('span')) s.classList.toggle('activa', s.textContent === (m === 'decimal' ? '123' : 'ABC'));
      /* Cambiar de inputmode con el campo enfocado no actualiza el teclado: se suelta y se retoma el foco. */
      i.blur(); i.focus();
    });
  }

  const api = { plano, soloDigitos, esNumerica, coincide, campo, modo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.BUSCADOR_MOVIL = api;
})(typeof window !== 'undefined' ? window : null);
