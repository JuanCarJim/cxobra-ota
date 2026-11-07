'use strict';
/*
 * 🧭 IARVIS EN EL MÓVIL (#iarvis, 7-nov-2026). La misma conversación que el escritorio y la
 * web (renderer/iarvis.js, montado aquí dentro de su pestaña, en «Más»), sobre la misma tabla
 * (ia_mensajes de cxobra-sync) con shared/ia/conversaciones.js.
 *
 * Dictado: el micrófono del teclado del iPhone (el panel lo dice en la caja de texto).
 * Adjuntos: 📎 Archivos y 📷 cámara, los del componente.
 *
 * La nube la pone cxobra/arranque.js en window.CX_IARVIS (la sesión de quien lleva el
 * teléfono). En la versión por la wifi de la oficina no hay nube en el teléfono: se dice.
 * El dinero que su rol no ve lo quita la edge function (supabase/functions/iarvis), con el
 * rol que lee de la nube, no el que diga el teléfono.
 */
(function iarvisMovil() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const activa = () => C.activa('iarvis');
  let adaptador = null;

  function armar() {
    if (adaptador) return adaptador;
    const N = window.CX_IARVIS;
    const K = window.IarvisConversaciones;
    if (!N || !N.nube || !K) return null;
    let almacen = null;
    try { almacen = window.localStorage; } catch { /* sin almacenamiento: sin cola */ }
    const conv = K.crearConversaciones({ nube: N.nube, app: 'cx', almacen });
    adaptador = {
      preguntar: (d) => conv.preguntar({
        pregunta: d.pregunta,
        obraId: d.obraId || null,
        adjuntos: d.adjuntos || [],
        contexto: { app: 'cx', pantalla: d.pantalla || '', ...(d.obraId ? { obra_id: String(d.obraId), obra: String(d.obraNombre || '').slice(0, 160) } : {}), ...(d.idioma ? { idioma: d.idioma } : {}) },
      }),
      historial: () => conv.historial(),
      valorar: (id, v) => conv.valorar(id, v),
      estado: (id) => conv.estado(id),
      adjuntar: (nombre, bytes, tipo) => conv.adjuntar({ nombre, bytes, tipo }),
    };
    /* Lo que quedó sin mandar (sin red) sale al volver. */
    conv.reintentar().catch(() => {});
    return adaptador;
  }

  function pintar() {
    if (!activa()) return;
    const a = armar();
    if (!a || !window.IARVIS) {
      $app.innerHTML = '<p class="vacio">🧭 Iarvis contesta desde la app Vidaire Cx con tu cuenta y desde el ordenador. En esta versión por la wifi de la oficina no está.</p>';
      return;
    }
    const sel = document.getElementById('obra-movil');
    const obraNombre = () => (sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '');
    window.IARVIS.montarEn($app, {
      adaptador: a,
      ir: (destino) => { location.hash = `#${destino}`; },
      contexto: () => ({ pantalla: 'movil', obraId: C.obraId ? C.obraId() : null, obraNombre: obraNombre(), idioma: (navigator.language || 'es').slice(0, 2) }),
      movil: true,
    });
  }

  window.addEventListener('hashchange', pintar);
  if (activa()) pintar();
})();
