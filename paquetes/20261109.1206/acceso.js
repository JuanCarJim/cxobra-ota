'use strict';
/*
 * ENTRAR EN EL MÓVIL con el correo y la contraseña de cada uno.
 *
 * Va el PRIMERO de los scripts: antes de que ninguna sección pida nada,
 *   · a todo lo que va a `api/` le pone la sesión (cabecera X-Sesion);
 *   · sin sesión, tapa la página con el formulario de entrada y deja las
 *     peticiones en espera (al entrar se recarga);
 *   · con sesión, si la dirección apunta a una sección que su rol no puede
 *     usar, le lleva a la primera que sí (las pestañas, carcasa.js).
 *
 * Esconder pestañas es solo para no enseñar lo que no va a funcionar: quien
 * decide es el ordenador, que comprueba el rol en cada petición
 * (electron/movil/servidor.js) y contesta 403 a lo que no le toca.
 */
(function acceso() {
  const CLAVE = 'cxobra.sesion';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || null; } catch { return null; } };
  const guardar = (s) => { try { if (s) localStorage.setItem(CLAVE, JSON.stringify(s)); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };
  let sesion = leer();

  /* ═══════════════════════════════════ Las peticiones llevan la sesión */

  const fetchOriginal = window.fetch.bind(window);
  const esApi = (u) => /^api\//.test(String(u)) && !/^api\/entrar\b/.test(String(u));
  window.fetch = async (url, opciones = {}) => {
    if (!esApi(url)) return fetchOriginal(url, opciones);
    if (!sesion) return new Promise(() => {}); /* espera a que entre: al entrar se recarga */
    /* Un rol sin nada en el móvil: ni se pregunta (diría 403 en cada sección). */
    if (Array.isArray(sesion.secciones) && !sesion.secciones.length && !/^api\/(yo|salir)\b/.test(String(url))) return new Promise(() => {});
    const r = await fetchOriginal(url, { ...opciones, headers: { ...(opciones.headers || {}), 'X-Sesion': sesion.token } });
    if (r.status === 401) { guardar(null); sesion = null; formulario('Tu sesión ha caducado: vuelve a entrar.'); return new Promise(() => {}); }
    return r;
  };

  /* ═══════════════════════════════════ Lo que ve su rol */

  /* Las pestañas de abajo y sus secciones las pinta carcasa.js con
     `secciones`; aquí solo se corrige la dirección si apunta a lo que no
     puede usar (la cuenta, siempre). */
  function aplicarRol() {
    const permitidas = sesion.secciones || [];
    const h = location.hash.slice(1);
    /* Al abrir la app, siempre el Inicio (la primera pantalla). */
    if (permitidas.length && h !== 'inicio') history.replaceState(null, '', '#inicio');
    if (!permitidas.length) {
      const vacia = () => { document.getElementById('app').innerHTML = '<div class="vacio"><p>Tu rol no tiene nada que hacer en el móvil: trabaja desde el ordenador.</p></div>'; };
      if (document.getElementById('app')) vacia(); else document.addEventListener('DOMContentLoaded', vacia);
    }
  }

  async function salir() {
    try { await window.fetch('api/salir', { method: 'POST' }); } catch { /* da igual: se olvida aquí */ }
    guardar(null);
    location.reload();
  }

  /* ═══════════════════════════════════ El formulario de entrada */

  function formulario(motivo) {
    let capa = document.getElementById('entrar-movil');
    if (capa) return;
    capa = document.createElement('div');
    capa.className = 'entrar-movil';
    capa.id = 'entrar-movil';
    let provisional = false;
    const pintar = (error) => {
      capa.innerHTML = `
        <form novalidate>
          <img class="marca-cx" src="iconos/icono-180.png" alt="" aria-hidden="true">
          <h1>Vidaire Cx</h1>
          <p class="nota">${esc(provisional ? 'Tu contraseña es provisional: elige la tuya (al menos 8 caracteres).' : motivo || 'Entra con tu correo y tu contraseña.')}</p>
          <label for="em-correo">Correo</label>
          <input id="em-correo" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(capa.dataset.correo || '')}">
          <label for="em-clave">Contraseña${provisional ? ' provisional' : ''}</label>
          <input id="em-clave" type="password" autocomplete="current-password">
          ${provisional ? `
            <label for="em-nueva">Contraseña nueva</label>
            <input id="em-nueva" type="password" autocomplete="new-password">
            <label for="em-repetir">Repítela</label>
            <input id="em-repetir" type="password" autocomplete="new-password">` : ''}
          ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
          <button type="submit" class="boton grande">${provisional ? 'Guardar y entrar' : 'Entrar'}</button>
        </form>`;
      const f = capa.querySelector('form');
      f.onsubmit = enviar;
    };
    async function enviar(ev) {
      ev.preventDefault();
      const v = (id) => (capa.querySelector(`#${id}`) || {}).value || '';
      capa.dataset.correo = v('em-correo');
      if (provisional && v('em-nueva') !== v('em-repetir')) return pintar('Las dos contraseñas nuevas no coinciden.');
      const boton = capa.querySelector('button[type=submit]');
      boton.disabled = true;
      let r;
      try {
        r = await (await fetchOriginal('api/entrar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: v('em-correo'), clave: v('em-clave'), ...(provisional ? { nueva: v('em-nueva') } : {}) }),
        })).json();
      } catch (e) {
        return pintar(`No se llega al ordenador: ${e.message}`);
      }
      if (!r.ok) {
        if (r.debeCambiarClave && !provisional) { provisional = true; return pintar(); }
        return pintar(r.error);
      }
      guardar({ token: r.token, nombre: r.nombre, rol: r.rol, rolNombre: r.rolNombre, secciones: r.secciones, local: Boolean(r.local) });
      const primera = (r.secciones || [])[0];
      if (primera) history.replaceState(null, '', `#${primera}`);
      location.reload();
    }
    pintar();
    /* En el teléfono no se enfoca solo: el teclado taparía el formulario. */
    const tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const poner = () => { document.body.appendChild(capa); const i = capa.querySelector('input'); if (i && !tactil) i.focus(); };
    if (document.body) poner(); else document.addEventListener('DOMContentLoaded', poner);
  }

  /* ═══════════════════════════════════ Arranque */

  if (!sesion) {
    formulario();
  } else {
    aplicarRol();
    /* El rol puede haber cambiado desde que entró: se pregunta al ordenador. */
    window.fetch('api/yo').then((r) => r.json()).then((yo) => {
      if (!yo || !yo.ok) return;
      const antes = JSON.stringify(sesion.secciones);
      sesion = { ...sesion, nombre: yo.nombre, rol: yo.rol, rolNombre: yo.rolNombre, secciones: yo.secciones, local: Boolean(yo.local) };
      guardar(sesion);
      if (JSON.stringify(yo.secciones) !== antes) location.reload();
    }).catch(() => {});
  }

  window.ACCESO_MOVIL = { salir, sesion: () => sesion };
})();
