'use strict';
/*
 * EL CAMPO SIEMPRE POR ENCIMA DEL TECLADO (15-nov-2026, JC, nota acea04b2: «al escribir en cualquier campo de la app Cx,
 * que la vista haga scroll para que el campo quede por encima del teclado y no lo tape»).
 *
 * Una sola pieza para TODA la app, no campo a campo: al entrar en un campo que escribe (y cada vez que el teclado cambia
 * de alto, al abrirse, al cambiar a numérico o al girar), se mide lo que de verdad se ve (visualViewport: lo que deja el
 * teclado) y, si el campo queda debajo del teclado o tapado por la cabecera, se desplaza lo justo: primero la caja con
 * scroll que lo contiene (una hoja inferior, una lista) y lo que sobre, la página. Mientras el teclado está abierto la
 * página lleva por debajo un hueco del alto del teclado (--teclado-alto), así el último campo también puede subir.
 * Sin visualViewport (navegadores viejos), el scrollIntoView de siempre.
 *
 * No necesita el plugin Keyboard de Capacitor (iría en una compilación nativa): sale por actualización por aire.
 *
 *   desplazamiento({ arriba, abajo }, { visibleArriba, visibleAbajo }) → píxeles a mover (positivo = bajar la vista).
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz && raiz.document) { raiz.TECLADO_CAMPO = api; api.instalar(raiz); }
})(typeof window !== 'undefined' ? window : null, function () {
  const MARGEN = 16; /* aire entre el campo y el teclado */
  const NO_ESCRIBE = ['button', 'submit', 'checkbox', 'radio', 'file', 'range', 'color', 'reset', 'image', 'hidden'];
  const escribe = (el) => Boolean(el && (el.tagName === 'TEXTAREA' || el.isContentEditable
    || (el.tagName === 'INPUT' && !NO_ESCRIBE.includes(String(el.type || 'text').toLowerCase())))) && !el.disabled && !el.readOnly;

  /** Cuánto mover la vista para que [arriba, abajo] quepa en [visibleArriba, visibleAbajo]. 0 si ya cabe. */
  function desplazamiento(campo, vista, margen = MARGEN) {
    const arriba = Number(campo.arriba), abajo = Number(campo.abajo);
    const va = Number(vista.visibleArriba), vb = Number(vista.visibleAbajo);
    if (![arriba, abajo, va, vb].every(Number.isFinite) || vb <= va) return 0;
    const hueco = vb - va - 2 * margen;
    /* Más alto que lo que se ve (un textarea grande): que se vea su principio, donde está el cursor al entrar. */
    if (abajo - arriba > hueco) return Math.round(arriba - (va + margen));
    if (abajo > vb - margen) return Math.round(abajo - (vb - margen));
    if (arriba < va + margen) return Math.round(arriba - (va + margen));
    return 0;
  }

  /** El alto del teclado: lo que el visualViewport ha perdido por abajo (0 sin teclado). */
  function altoTeclado(vv, altoVentana) {
    if (!vv || !altoVentana) return 0;
    const t = Math.round(altoVentana - vv.height - Math.max(0, vv.offsetTop || 0));
    return t > 80 ? t : 0; /* menos de 80 px es la barra de Safari, no un teclado */
  }

  function instalar(w) {
    const d = w.document;
    if (!d || w.__tecladoCampo) return;
    w.__tecladoCampo = true;
    let pendiente = null;

    /* La cabecera fija tapa lo de arriba: lo visible empieza debajo de ella. */
    const altoCabecera = () => {
      const c = d.querySelector('header.barra, body > header');
      if (!c) return 0;
      const pos = w.getComputedStyle(c).position;
      return pos === 'fixed' || pos === 'sticky' ? c.getBoundingClientRect().height : 0;
    };
    const conScroll = (el) => {
      for (let p = el.parentElement; p && p !== d.body && p !== d.documentElement; p = p.parentElement) {
        const oy = w.getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
      }
      return null;
    };

    function colocar() {
      pendiente = null;
      const el = d.activeElement;
      if (!escribe(el)) return;
      const vv = w.visualViewport;
      if (!vv) { try { el.scrollIntoView({ block: 'center' }); } catch { /* sin más */ } return; }
      const r = el.getBoundingClientRect();
      /* getBoundingClientRect va en coordenadas de la ventana; lo visible es [offsetTop, offsetTop + height]. */
      const vista = { visibleArriba: vv.offsetTop + altoCabecera(), visibleAbajo: vv.offsetTop + vv.height };
      let mover = desplazamiento({ arriba: r.top, abajo: r.bottom }, vista);
      if (!mover) return;
      /* Primero la caja con scroll que lo lleva dentro (una hoja inferior, una tabla), lo que sobre a la página. */
      const caja = conScroll(el);
      if (caja) {
        const antes = caja.scrollTop;
        caja.scrollTop = antes + mover;
        mover -= caja.scrollTop - antes;
      }
      if (mover) w.scrollBy(0, mover);
    }
    const pronto = (ms) => { if (pendiente) clearTimeout(pendiente); pendiente = setTimeout(colocar, ms); };

    /* El hueco del teclado bajo la página: sin él, el último campo no tiene adónde subir. */
    const medir = () => {
      const t = altoTeclado(w.visualViewport, w.innerHeight);
      d.documentElement.style.setProperty('--teclado-alto', `${t}px`);
      d.documentElement.classList.toggle('con-teclado', t > 0);
      if (t > 0 && escribe(d.activeElement)) pronto(60);
    };
    if (!d.getElementById('estilo-teclado-campo')) {
      const st = d.createElement('style');
      st.id = 'estilo-teclado-campo';
      st.textContent = 'html.con-teclado body{padding-bottom:calc(var(--teclado-alto,0px) + 24px)}';
      (d.head || d.documentElement).appendChild(st);
    }
    /* Al entrar en el campo, el teclado aún está subiendo: se mira al poco y otra vez cuando ha terminado. */
    d.addEventListener('focusin', (ev) => { if (escribe(ev.target)) { pronto(80); setTimeout(() => { if (d.activeElement === ev.target) colocar(); }, 420); } });
    if (w.visualViewport) w.visualViewport.addEventListener('resize', medir);
    w.addEventListener('orientationchange', () => pronto(350));
    medir();
  }

  return { desplazamiento, altoTeclado, escribe, instalar, MARGEN };
});
