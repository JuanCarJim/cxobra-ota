'use strict';

/**
 * EL ARRANQUE DE VIDAIRE: el logo animado, sin texto (JC, 6-nov-2026:
 * «Que al abrir Vidaire salga el logo animado, no pantallas con mensajes»).
 *
 * Un único componente para todas las puertas de entrada: escritorio (Electron),
 * web, iPad y Cx. Es un SVG en línea (sin librerías ni imágenes) con la V de la
 * marca quieta y la brújula de Iarvis orbitando alrededor como un electrón.
 * Colores de marca/diseno/tokens.css (teal #13957A, verde #1A9E5C y un azul de
 * marca); nunca negro ni amarillo. Con prefers-reduced-motion se queda quieto.
 *
 * Nada de «Abriendo…», «Cargando…» ni «Conectando…»: si hay un error real, el
 * logo se queda y sale un aviso flotante discreto abajo (el mismo estilo que
 * renderer/avisoFlotante.js, que aún no está cargado cuando esto se ve).
 *
 * Sirve en Node (los constructores de web, iPad y Cx lo inyectan en el HTML) y
 * en el navegador (`window.ARRANQUE_LOGO`).
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ARRANQUE_LOGO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ID = 'arranqueIpad';
  /* Aro, marcas y borde del punto de la brújula (una sola constante; igual en scripts/generarIconoCxObra.js). */
  const COLOR_ARO = '#4C262D';

  /** La brújula (lado 32 en torno a su centro, 90,88). `viva`: la aguja busca el norte (.arq-aguja). */
  const brujula = (atributos, viva) =>
    `<svg ${atributos} viewBox="74 72 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">` +
    '<circle cx="90" cy="88" r="15" fill="#1B2A4A"/>' +
    '<circle cx="90" cy="88" r="11.59" fill="none" stroke="' + COLOR_ARO + '" stroke-width="1.09" opacity=".8"/>' +
    '<path d="M90 75.05v2.05M90 98.91v2.05M77.05 88h2.05M100.91 88h2.05" fill="none" stroke="' + COLOR_ARO + '" stroke-width="1.36" stroke-linecap="round"/>' +
    (viva ? '<g class="arq-aguja">' : '<g>') +
    '<g transform="rotate(35 90 88)"><path d="M90 77.09 L94.09 88 L85.91 88 Z" fill="#5B9BD5"/><path d="M90 98.91 L94.09 88 L85.91 88 Z" fill="#F4EAD9"/></g></g>' +
    '<circle cx="90" cy="88" r="1.77" fill="#1B2A4A" stroke="' + COLOR_ARO + '" stroke-width="0.82"/>' +
    '</svg>';

  /* 9-nov, JC: «que la brújula dé vueltas alrededor de la V como si fuera un electrón en un átomo, y más grande»
     y, al ver las capturas, «sin que se vean las trayectorias»: no se pinta ninguna órbita, solo la brújula moviéndose.
     La brújula va en dos copias que se turnan, una debajo de la V y otra encima: el relevo cae en los extremos
     de la elipse, fuera de la V, y no se nota. */
  const capa = (dentro) => `<svg class="arq-capa" viewBox="0 0 240 240" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${dentro}</svg>`;
  const electron = (clase) =>
    `<span class="arq-orbita ${clase}"><span class="arq-giro"><span class="arq-electron"><span class="arq-contra"><span class="arq-recto">` +
    brujula('class="arq-brujula"', true) +
    '</span></span></span></span></span>';

  /* El logo: spans y no divs, porque también va dentro de los <p class="cargando"> del móvil. */
  const LOGO =
    '<span class="arq-atomo" role="img" aria-label="Vidaire">' +
    electron('arq-detras') +
    capa(
      /* 8-nov, JC: «la de antes me gustaba mucho más»: la V del icono de la app (scripts/generarIconoCxObra.js):
         gruesa, degradado verde→sage→celadón, sombra y brillo. */
      '<defs><linearGradient id="arqDeg" gradientUnits="userSpaceOnUse" x1="60" y1="90.5" x2="60" y2="31.9">' +
      '<stop offset="0" stop-color="#003F2D"/><stop offset=".55" stop-color="#538184"/><stop offset="1" stop-color="#80BBAD"/>' +
      '</linearGradient>' +
      '<filter id="arqSombra" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.9" stdDeviation="2.3" flood-color="#012A2D" flood-opacity=".3"/></filter>' +
      '<filter id="arqSuave" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.4"/></filter></defs>' +
      '<g transform="translate(120 120) scale(1.3) translate(-60 -61)">' +
      '<g filter="url(#arqSombra)"><path class="arq-v" d="M27.9 31.9 L60 90.5 L92.1 31.9" fill="none" stroke="url(#arqDeg)" stroke-width="18.3" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<path d="M27.9 31.9 L60 90.5 L92.1 31.9" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.6 -1.6)" filter="url(#arqSuave)"/>' +
      '</g>'
    ) +
    electron('arq-delante') +
    '</span>';

  /* 8-nov (JC): el botón de Iarvis del móvil es SOLO esta brújula, sin la V y quieta. */
  const BRUJULA = brujula('class="arq-brujula-sola" width="34" height="34"', false);

  const CSS =
    '.arranque-ipad,.arranque-cx{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#F4F6F5;z-index:9999}' +
    /* El lado: --arq-lado si la pantalla pide otro (móvil, carga dentro de una ficha); si no, grande sin desbordar (el recorrido de la brújula ocupa el 72 % del lado: unos 2/3 del ancho en móvil). */
    '.arq-atomo{position:relative;display:block;flex:none;width:var(--arq-lado,min(90vw,62vh,560px));height:var(--arq-lado,min(90vw,62vh,560px))}' +
    '.arq-capa{position:absolute;inset:0;display:block;width:100%;height:100%}' +
    /* La elipse solo con transform (va fluida en iPhone): círculo aplastado e inclinado (.arq-orbita), que gira
       (.arq-giro) con la brújula en su borde (.arq-electron), y luego se deshace el giro (.arq-contra) y la
       inclinación (.arq-recto; 2.38095 = 1/.42) para que la brújula se vea siempre redonda y derecha. */
    '.arq-orbita{position:absolute;inset:0;display:block;transform:rotate(-28deg) scaleY(.42)}' +
    '.arq-giro{position:absolute;inset:0;display:block;animation:arqGiro 3s linear infinite}' +
    '.arq-electron{position:absolute;left:90%;top:50%;display:block;width:19.2%;height:19.2%;margin:-9.6% 0 0 -9.6%}' +
    '.arq-contra{display:block;width:100%;height:100%;animation:arqContra 3s linear infinite}' +
    '.arq-recto{display:block;width:100%;height:100%;transform:scaleY(2.38095) rotate(28deg)}' +
    '.arq-brujula{display:block;width:100%;height:100%}' +
    /* Media vuelta por debajo de la elipse (delante de la V) y media por arriba (detrás). */
    '.arq-delante{animation:arqDelante 3s step-end infinite}' +
    '.arq-detras{opacity:0;animation:arqDetras 3s step-end infinite}' +
    '@keyframes arqGiro{to{transform:rotate(360deg)}}' +
    '@keyframes arqContra{to{transform:rotate(-360deg)}}' +
    '@keyframes arqDelante{0%{opacity:1}50%,100%{opacity:0}}' +
    '@keyframes arqDetras{0%{opacity:0}50%,100%{opacity:1}}' +
    /* La aguja sigue buscando el norte y se asienta, en bucle (8-nov). */
    '.arq-aguja{transform-box:fill-box;transform-origin:center;animation:arqAguja 2.4s ease-in-out infinite}' +
    '@keyframes arqAguja{0%{transform:rotate(-40deg)}35%{transform:rotate(18deg)}55%{transform:rotate(-8deg)}70%,100%{transform:rotate(0)}}' +
    '@media (prefers-reduced-motion:reduce){.arq-aguja,.arq-giro,.arq-contra,.arq-delante,.arq-detras{animation:none}}' +
    '.arq-aviso{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 32px));' +
    'padding:9px 14px;border-radius:10px;background:#fff;color:#435254;border:1px solid #D9E0DE;' +
    'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.08);' +
    'white-space:pre-wrap;word-break:break-word}' +
    '.arq-aviso.arq-mal{border-color:#E3BDBD;color:#9C2B2B}' +
    '.arq-reintentar{margin-left:6px;border:1px solid #13957A;color:#0E7C66;background:transparent;border-radius:8px;padding:3px 10px;font:inherit;cursor:pointer}';

  /** El HTML del arranque (para los constructores, que lo meten en la página). */
  const html = (id = ID, clase = 'arranque-ipad') => `<div id="${id}" class="${clase}" aria-busy="true">${LOGO}</div>`;
  /** El <style> del arranque. */
  const estilo = () => `<style>${CSS}</style>`;

  /* ── Lo que sigue solo en el navegador ── */
  const hayDom = typeof document !== 'undefined';

  /** Pone el arranque si no está (idempotente). Devuelve el elemento. */
  function montar(id = ID, clase = 'arranque-ipad') {
    if (!hayDom) return null;
    let a = document.getElementById(id);
    if (!a) {
      if (!document.getElementById('arqEstilo')) {
        const s = document.createElement('style');
        s.id = 'arqEstilo';
        s.textContent = CSS;
        (document.head || document.documentElement).append(s);
      }
      a = document.createElement('div');
      a.id = id;
      a.className = clase;
      a.setAttribute('aria-busy', 'true');
      a.innerHTML = LOGO;
      (document.body || document.documentElement).append(a);
    }
    return a;
  }

  /** Aviso flotante discreto sobre el logo (un error real, o algo que decir). Sustituye al texto del arranque. */
  function avisar(texto, { mal = true, id = ID, clase = 'arranque-ipad', reintentar = false } = {}) {
    if (!hayDom) return;
    const a = montar(id, clase);
    let av = a.querySelector('.arq-aviso');
    if (!av) { av = document.createElement('div'); av.className = 'arq-aviso'; av.setAttribute('role', 'alert'); a.append(av); }
    av.classList.toggle('arq-mal', !!mal);
    av.textContent = String(texto ?? '');
    if (reintentar) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'arq-reintentar';
      b.textContent = 'Reintentar';
      b.addEventListener('click', () => globalThis.location.reload());
      av.append(' ', b);
    }
  }

  /** Quita el arranque. */
  function quitar(id = ID) {
    if (!hayDom) return;
    const a = document.getElementById(id);
    if (a) a.remove();
  }

  /** Escritorio: se queda hasta que la app pinta su barra o su pantalla de entrada. */
  function quitarCuandoLista(id = ID) {
    if (!hayDom) return;
    const lista = () => document.querySelector('.menu a') || document.getElementById('pantallaAcceso');
    const hecho = () => { quitar(id); };
    if (lista()) return hecho();
    const obs = new MutationObserver(() => { if (lista()) { obs.disconnect(); hecho(); } });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  return { ID, LOGO, BRUJULA, CSS, html, estilo, montar, avisar, quitar, quitarCuandoLista };
});
