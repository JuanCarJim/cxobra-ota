'use strict';
/*
 * LA COLA DE LO QUE QUEDÓ EN EL TELÉFONO (28-oct-2026, JC: «Autoguardado…
 * en toda la app»). El autoguardado (autoguardado.js) deja cada formulario a
 * medias en un borrador del teléfono (`cx.borrador.<clave>`). Si al mandarlo
 * no hay conexión, o la app se cierra antes de que llegue, el borrador se
 * queda ahí. Esta cola lo vuelve a mandar SOLA, aunque la pantalla ya no esté
 * abierta:
 *   · al arrancar la app, al volver la red (`online`), al volver a la app
 *     (pantalla visible) y cada 30 s mientras quede algo;
 *   · cada pantalla registra qué borradores son suyos (un prefijo) y cómo se
 *     mandan: `COLA_GUARDADO.registrar('ficha.', async (clave, borrador) => ok)`.
 *     Quien manda borra el borrador cuando el servidor lo confirma y devuelve
 *     true; si devuelve false (o falla), se reintenta más tarde.
 * Lo usan commissioning.js (fichas, bocas, fotos del equipo) y
 * estanqueidad.js; incidencias puede registrarse igual.
 */
(function colaGuardado() {
  const PREF = 'cx.borrador.';
  const REINTENTO = 30000;
  const tareas = [];
  let corriendo = null;
  let reloj = null;

  function claves(prefijo) {
    const fuera = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREF + prefijo)) fuera.push(k.slice(PREF.length));
      }
    } catch { /* sin almacenamiento */ }
    return fuera;
  }
  function leer(clave) {
    try { const t = localStorage.getItem(PREF + clave); return t ? JSON.parse(t) : null; } catch { return null; }
  }
  /* ¿Queda algo de alguien en el teléfono? */
  const pendientes = () => tareas.reduce((n, t) => n + claves(t.prefijo).length, 0);

  async function pasada() {
    let quedan = 0;
    for (const t of tareas) {
      for (const clave of claves(t.prefijo)) {
        const b = leer(clave);
        if (!b) continue;
        try { if (!(await t.enviar(clave, b))) quedan += 1; } catch { quedan += 1; }
      }
    }
    return quedan;
  }
  /* Una pasada por todo lo pendiente (nunca dos a la vez). */
  function vaciar() {
    if (corriendo) return corriendo;
    clearTimeout(reloj);
    reloj = null;
    corriendo = pasada().then((quedan) => {
      corriendo = null;
      if (quedan || pendientes()) masTarde();
      return quedan;
    }, () => { corriendo = null; masTarde(); return -1; });
    return corriendo;
  }
  function masTarde(ms = REINTENTO) {
    if (reloj) return;
    reloj = setTimeout(() => { reloj = null; vaciar(); }, ms);
  }

  function registrar(prefijo, enviar) {
    tareas.push({ prefijo, enviar });
    masTarde(1500);
  }

  try { window.addEventListener('online', () => { vaciar(); }); } catch { /* nada */ }
  try {
    if (document && document.addEventListener) {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') vaciar(); });
    }
  } catch { /* nada */ }

  window.COLA_GUARDADO = { registrar, vaciar, masTarde, claves, pendientes };
})();
