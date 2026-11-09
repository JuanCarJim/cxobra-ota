'use strict';
/*
 * 🔒 PARA ENTRAR EN Cx, FACE ID O HUELLA (8-nov-2026, nota 1108-cx-entrar; JC: «para entrar en la
 * app haga falta Face ID o huella»).
 *
 * Va justo detrás de verificarIdentidad.js y ANTES que acceso.js y que cualquier sección:
 *   · Al abrir la app con la sesión ya guardada, y al volver de segundo plano tras más de
 *     5 minutos, tapa la página con una pantalla marino y arena (el logo, ningún dato) y pide
 *     Face ID o huella con el plugin nativo «Biometria» (cxobra/nativo/BiometriaPlugin.*).
 *   · Sin biometría (aparato sin ella, sin configurar, o app anterior a la build 5, sin el
 *     plugin): el PIN de este teléfono, el mismo que el de firmar con Iarvis; si no hay, se crea.
 *   · En el navegador (sin Capacitor) no hay biometría: el PIN si ya hay uno; si no, basta el
 *     login de siempre. PENDIENTE: pasarlo a WebAuthn / passkeys.
 *   · Cancelar, o fallar 3 veces, deja la pantalla quieta con «Reintentar» y «Cerrar sesión»
 *     (vuelve al correo y la contraseña). Nunca se entra sin verificar.
 *   · Mientras está bloqueada, TODA petición a `api/` espera (las secciones no reciben datos y la
 *     entrada del fichaje automático, jornada.js, no sale hasta después de verificar).
 *   · Al irse a segundo plano se pone la tapa (lo que sale en el selector de apps).
 *   · Todo es local: funciona sin conexión.
 *
 *   window.CX_BLOQUEO = { esperar(), bloqueada(), bloquear(), metodo() }
 */
(function bloqueo() {
  const LIMITE_MS = 5 * 60 * 1000;
  const INTENTOS = 3;
  const MAX_FALLOS_PIN = 9; /* tres rondas de PIN mal: se cierra la sesión y hay que entrar con contraseña */
  const CLAVE_SESION = 'cxobra.sesion';
  const CLAVE_VISTO = 'cx.bloqueo.visto';    /* sessionStorage: última vez abierta y a la vista */
  const CLAVE_FALLOS = 'cx.bloqueo.fallosPin';
  const ID = () => window.CX_IDENTIDAD || null;
  const ahora = () => Date.now();
  const ss = {
    leer: (k) => { try { return window.sessionStorage.getItem(k); } catch { return null; } },
    poner: (k, v) => { try { window.sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const ls = {
    leer: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
    poner: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
    quitar: (k) => { try { window.localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
  };
  const sesion = () => { try { const s = JSON.parse(ls.leer(CLAVE_SESION) || 'null'); return s && s.token ? s : null; } catch { return null; } };

  /* ¿Hace falta verificar aquí? En la app nativa siempre; en el navegador solo si ya hay PIN. */
  const exige = () => {
    const id = ID();
    if (!id) return false;
    return id.nativa() || id.pinExiste();
  };

  let estado = 'abierta';      /* 'abierta' | 'bloqueada' */
  let enCurso = false;
  let metodo = null;
  let ocultoDesde = null;
  let liberar = null;
  let espera = Promise.resolve();

  const marcarVisto = () => { if (estado === 'abierta') ss.poner(CLAVE_VISTO, String(ahora())); };
  const vistoHacePoco = () => { const t = Number(ss.leer(CLAVE_VISTO)); return Number.isFinite(t) && t > 0 && ahora() - t < LIMITE_MS; };

  /* ═══════════════════════════════════ Las peticiones esperan */

  const fetchOriginal = window.fetch ? window.fetch.bind(window) : null;
  if (fetchOriginal) {
    window.fetch = async (url, opciones) => {
      const u = String(typeof url === 'string' ? url : (url && url.url) || '');
      if (estado === 'bloqueada' && /^api\//.test(u) && !/^api\/entrar\b/.test(u)) await espera;
      return fetchOriginal(url, opciones);
    };
  }

  /* ═══════════════════════════════════ La pantalla */

  const ESTILO = `
  .cx-bloqueo {
    --bq-fondo: var(--vd-marino); --bq-letra: var(--vd-arena);
    --bq-tenue: var(--vd-arena-tinte); --bq-error: var(--vd-granate-tinte);
    position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
    background: var(--bq-fondo); color: var(--bq-letra); padding: max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
    font-family: var(--fuente-texto, -apple-system, system-ui, sans-serif); text-align: center; visibility: visible !important;
  }
  :root[data-tema='oscuro'] .cx-bloqueo { --bq-fondo: var(--vd-crema); --bq-tenue: var(--vd-gris-calido); --bq-error: var(--vd-granate); }
  @media (prefers-color-scheme: dark) { :root:not([data-tema='claro']):not([data-tema='oscuro']) .cx-bloqueo { --bq-fondo: var(--vd-tinta); --bq-tenue: var(--vd-arena-tinte); --bq-error: var(--vd-granate-tinte); } }
  .cx-bloqueo .cx-bq-caja { width: 100%; max-width: 320px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .cx-bloqueo .cx-bq-logo { width: 84px; height: 84px; border-radius: 20px; }
  .cx-bloqueo h1 { margin: 4px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; color: var(--bq-letra); }
  .cx-bloqueo .cx-bq-nota { margin: 0; font-size: 15px; line-height: 1.4; color: var(--bq-tenue); min-height: 21px; }
  .cx-bloqueo .cx-bq-error { margin: 0; font-size: 14px; color: var(--bq-error); }
  .cx-bloqueo form { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .cx-bloqueo input { width: 100%; font-size: 24px; letter-spacing: 8px; text-align: center; padding: 10px; border-radius: 12px;
    border: 1px solid var(--bq-letra); background: transparent; color: var(--bq-letra); }
  .cx-bloqueo button { width: 100%; min-height: 48px; border-radius: 12px; font-size: 17px; font-weight: 600; border: 1px solid var(--bq-letra); cursor: pointer; }
  .cx-bloqueo .cx-bq-principal { background: var(--bq-letra); color: var(--bq-fondo); }
  .cx-bloqueo .cx-bq-segundo { background: transparent; color: var(--bq-letra); }
  .cx-bloqueo .cx-bq-salir { background: transparent; border: 0; color: var(--bq-tenue); font-weight: 500; font-size: 15px; text-decoration: underline; min-height: 40px; }
  html.cx-tapada body > :not(#cx-bloqueo) { visibility: hidden !important; }
  html.cx-tapada, html.cx-tapada body { overflow: hidden !important; }
  `;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function capa() {
    let c = document.getElementById('cx-bloqueo');
    if (c) return c;
    if (!document.getElementById('cx-bloqueo-estilo')) {
      const st = document.createElement('style');
      st.id = 'cx-bloqueo-estilo';
      st.textContent = ESTILO;
      (document.head || document.documentElement).appendChild(st);
    }
    c = document.createElement('div');
    c.id = 'cx-bloqueo';
    c.className = 'cx-bloqueo';
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-modal', 'true');
    c.setAttribute('aria-label', 'Vidaire Cx bloqueada');
    (document.body || document.documentElement).appendChild(c);
    return c;
  }

  /* modo: 'tapa' (solo el logo) · 'verificando' · 'pin' · 'crear-pin' · 'quieta' */
  function pintar(modo, { nota = '', error = '' } = {}) {
    document.documentElement.classList.add('cx-tapada');
    const c = capa();
    c.dataset.modo = modo;
    const cabeza = `<img class="cx-bq-logo" src="iconos/icono-180.png" alt="" aria-hidden="true"><h1>Vidaire Cx</h1>`;
    let cuerpo = '';
    if (modo === 'verificando') cuerpo = `<p class="cx-bq-nota">${esc(nota || 'Confirma que eres tú…')}</p>`;
    if (modo === 'pin' || modo === 'crear-pin') {
      const crear = modo === 'crear-pin';
      cuerpo = `<p class="cx-bq-nota">${esc(nota || (crear ? 'Crea un PIN de este teléfono para entrar (4 a 8 cifras).' : 'Escribe tu PIN para entrar.'))}</p>
        ${error ? `<p class="cx-bq-error" role="alert">${esc(error)}</p>` : ''}
        <form novalidate data-bq-pin>
          <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" aria-label="PIN" data-bq-a>
          ${crear ? '<input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" aria-label="Repite el PIN" placeholder="Repítelo" data-bq-b>' : ''}
          <button type="submit" class="cx-bq-principal">Entrar</button>
          <button type="button" class="cx-bq-segundo" data-bq-cancelar>Cancelar</button>
        </form>`;
    }
    if (modo === 'quieta') {
      cuerpo = `<p class="cx-bq-nota">${esc(nota)}</p>
        ${error ? `<p class="cx-bq-error" role="alert">${esc(error)}</p>` : ''}
        <button type="button" class="cx-bq-principal" data-bq-reintentar>Reintentar</button>
        <button type="button" class="cx-bq-salir" data-bq-salir>Cerrar sesión y entrar con usuario y contraseña</button>`;
    }
    c.innerHTML = `<div class="cx-bq-caja">${cabeza}${cuerpo}</div>`;
    const reintentar = c.querySelector('[data-bq-reintentar]');
    if (reintentar) reintentar.addEventListener('click', () => verificar());
    const salir = c.querySelector('[data-bq-salir]');
    if (salir) salir.addEventListener('click', () => cerrarSesion());
    return c;
  }

  function quitarTapa() {
    const c = document.getElementById('cx-bloqueo');
    if (c) c.remove();
    document.documentElement.classList.remove('cx-tapada');
  }

  /* ═══════════════════════════════════ Verificar */

  function quieta(nota, error) { enCurso = false; pintar('quieta', { nota, error }); }

  function pedirPin(crear, error) {
    return new Promise((resolver) => {
      const c = pintar(crear ? 'crear-pin' : 'pin', { error });
      const f = c.querySelector('[data-bq-pin]');
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const a = (c.querySelector('[data-bq-a]') || {}).value || '';
        const b = crear ? ((c.querySelector('[data-bq-b]') || {}).value || '') : null;
        resolver({ a, b });
      });
      c.querySelector('[data-bq-cancelar]').addEventListener('click', () => resolver(null));
      const tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const i = c.querySelector('[data-bq-a]');
      if (i && i.focus && !tactil) setTimeout(() => i.focus(), 30);
    });
  }

  async function porPin() {
    const id = ID();
    if (!id || !window.crypto || !crypto.subtle) return quieta('Este aparato no puede comprobar el PIN.', '');
    if (!id.pinExiste()) {
      let error = '';
      for (;;) {
        const r = await pedirPin(true, error);
        if (!r) return quieta('Has cancelado. Sin verificar no se entra.', '');
        if (!id.pinValido(r.a)) { error = 'El PIN tiene que ser de 4 a 8 cifras.'; continue; }
        if (r.a !== r.b) { error = 'Los dos PIN no coinciden.'; continue; }
        await id.crearPin(r.a);
        return desbloquear('pin');
      }
    }
    let error = '';
    for (let n = 0; n < INTENTOS; n++) {
      const r = await pedirPin(false, error);
      if (!r) return quieta('Has cancelado. Sin verificar no se entra.', '');
      if (await id.comprobarPin(r.a)) return desbloquear('pin');
      const total = Number(ls.leer(CLAVE_FALLOS) || 0) + 1;
      ls.poner(CLAVE_FALLOS, String(total));
      if (total >= MAX_FALLOS_PIN) return cerrarSesion(); /* demasiados PIN mal: al correo y la contraseña */
      error = `PIN incorrecto (${n + 1} de ${INTENTOS}).`;
    }
    return quieta('PIN incorrecto 3 veces.', '');
  }

  async function verificar() {
    if (enCurso || estado !== 'bloqueada') return;
    enCurso = true;
    const id = ID();
    if (id && id.nativa()) {
      pintar('verificando');
      let fallos = 0;
      while (fallos < INTENTOS) {
        const r = await id.biometria('Entra en Vidaire Cx');
        if (r === 'ok') return desbloquear('biometria');
        if (r === 'cancelado') return quieta('Has cancelado. Sin verificar no se entra.', '');
        if (r !== 'fallo') break; /* sin biometría o sin plugin (antes de la build 5): al PIN */
        fallos += 1;
        pintar('verificando', { nota: `No te ha reconocido (${fallos} de ${INTENTOS}).` });
      }
      if (fallos >= INTENTOS) return quieta('No te ha reconocido 3 veces.', '');
    }
    return porPin();
  }

  function desbloquear(como) {
    metodo = como;
    estado = 'abierta';
    enCurso = false;
    ls.quitar(CLAVE_FALLOS);
    quitarTapa();
    marcarVisto();
    const l = liberar; liberar = null;
    if (l) l();
    try { window.dispatchEvent(new CustomEvent('cx:desbloqueada', { detail: { metodo: como } })); } catch { /* sin eventos */ }
  }

  function bloquear() {
    if (estado !== 'bloqueada') {
      estado = 'bloqueada';
      metodo = null;
      espera = new Promise((r) => { liberar = r; });
    }
    pintar('tapa');
    if (document.visibilityState !== 'hidden') verificar();
  }

  /* Cerrar sesión SIN pasar por la espera: la petición va directa y no se espera a la red. */
  async function cerrarSesion() {
    const s = sesion();
    if (s && fetchOriginal) {
      try {
        await Promise.race([
          fetchOriginal('api/salir', { method: 'POST', headers: { 'X-Sesion': s.token } }).catch(() => null),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      } catch { /* da igual: se olvida aquí */ }
    }
    ls.quitar(CLAVE_SESION);
    ls.quitar(CLAVE_FALLOS);
    location.reload();
  }

  /* ═══════════════════════════════════ Segundo plano */

  const modo = () => { const c = document.getElementById('cx-bloqueo'); return c ? c.dataset.modo : null; };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      /* La tapa, para el selector de apps (lo que está bloqueado ya no enseña nada). */
      if (estado === 'abierta') { marcarVisto(); ocultoDesde = ahora(); if (sesion() && exige()) pintar('tapa'); }
      return;
    }
    if (estado === 'bloqueada') { if (!enCurso && modo() === 'tapa') verificar(); return; }
    const fuera = ocultoDesde != null ? ahora() - ocultoDesde : 0;
    ocultoDesde = null;
    if (sesion() && exige() && fuera > LIMITE_MS) bloquear();
    else { quitarTapa(); marcarVisto(); }
  });
  const alSalir = () => marcarVisto();
  window.addEventListener('pagehide', alSalir);
  window.addEventListener('beforeunload', alSalir);
  setInterval(() => { if (document.visibilityState !== 'hidden') marcarVisto(); }, 30000);
  /* Entrar con correo y contraseña ya es verificar: tras la recarga no se vuelve a pedir. */
  document.addEventListener('submit', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('#entrar-movil')) ss.poner(CLAVE_VISTO, String(ahora()));
  }, true);

  /* ═══════════════════════════════════ Arranque */

  if (sesion() && exige() && !vistoHacePoco()) bloquear();
  else marcarVisto();

  window.CX_BLOQUEO = {
    esperar: () => espera,
    bloqueada: () => estado === 'bloqueada',
    bloquear,
    metodo: () => metodo,
  };
})();
