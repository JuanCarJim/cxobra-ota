'use strict';
/*
 * 🧭 IARVIS EN EL MÓVIL (#iarvis, 7-nov-2026). La misma conversación que el escritorio y la
 * web (renderer/iarvis.js, montado aquí a pantalla completa; se abre con la brújula de la cabecera), sobre la misma tabla
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
  /* 8-nov (JC): el chat es SOLO el chat; «‹» vuelve a la pantalla desde la que se abrió. */
  let deDonde = '';
  window.addEventListener('hashchange', (e) => {
    const antes = String(e.oldURL || '').split('#')[1] || '';
    if (location.hash === '#iarvis' && antes && antes !== 'iarvis') deDonde = antes;
  });
  const volver = () => { location.hash = `#${deDonde || 'inicio'}`; };

  function armar() {
    if (adaptador) return adaptador;
    const N = window.CX_IARVIS;
    const K = window.IarvisConversaciones;
    if (!N || !N.nube || !K) return null;
    let almacen = null;
    try { almacen = window.localStorage; } catch { /* sin almacenamiento: sin cola */ }
    const conv = K.crearConversaciones({ nube: N.nube, app: 'cx', almacen });
    /* 8-nov (JC: «Iarvis tiene que estar en el móvil también»): lo de la planificación se contesta
       aquí, con la copia del teléfono y el alcance de su rol (electron/movil/rutasPlanificacion.js);
       lo demás sigue a la nube. Sin PDF en el teléfono: resumen y «Abrir la planificación». */
    const LOCALES = 'iarvis-respuestas-locales';
    const leerLocales = () => { try { return JSON.parse(almacen.getItem(LOCALES) || '[]'); } catch { return []; } };
    const escribirLocales = (l) => { try { almacen.setItem(LOCALES, JSON.stringify(l.slice(0, 60))); } catch { /* lleno */ } };
    const guardarLocal = (f) => escribirLocales([f, ...leerLocales().filter((x) => x.id !== f.id)]);
    const alNube = (d) => conv.preguntar({
        pregunta: d.pregunta,
        obraId: d.obraId || null,
        adjuntos: d.adjuntos || [],
        contexto: { app: 'cx', pantalla: d.pantalla || '', ...(d.obraId ? { obra_id: String(d.obraId), obra: String(d.obraNombre || '').slice(0, 160) } : {}), ...(d.idioma ? { idioma: d.idioma } : {}) },
      });
    /* El motor de IA, solo para ELEGIR la acción (sin él, o sin desplegar: null, y se queda la
       respuesta de las reglas con las opciones más cercanas). */
    const alMotor = async (pregunta, obraId) => {
      try {
        const r = await N.nube.llamarFuncion('iarvis', '', JSON.stringify({ modo: 'accion', pregunta: String(pregunta || '').slice(0, 2000), obra_id: obraId || null }), 12000);
        const j = await r.json().catch(() => null);
        return j && j.accion && j.accion.id ? j.accion : null;
      } catch { return null; }
    };
    adaptador = {
      preguntar: async (d) => {
        try {
          /* Las fotos del chat, ya en el teléfono (adjuntar): por si es «métela como prueba de…». */
          const fotos = (d.adjuntos || []).filter((x) => x && (x.fotoId || x.local)).map((x) => ({ fotoId: x.fotoId || null, local: x.local || null }));
          const r = await C.postJson('api/iarvis/preguntar', { pregunta: d.pregunta, obraId: d.obraId || null, obraNombre: d.obraNombre || '', fotos });
          /* 8-nov · las reglas no lo entienden pero parece algo que hacer: se le pregunta al motor
             (edge function `iarvis`, modo «accion») qué acción del catálogo es. El servidor elige con
             el rol que lee de la nube; lo que vuelva se resuelve en el teléfono con confirmación. */
          if (r && r.local && r.fila && r.fila.preguntarMotor) {
            const elegida = await alMotor(d.pregunta, d.obraId);
            if (elegida) {
              const r2 = await C.postJson('api/iarvis/accion', { accion: { hacer: 'catalogo', id: elegida.id, parametros: elegida.parametros || {}, pregunta: d.pregunta, obraId: d.obraId || null, fotos } });
              if (r2 && r2.fila) { guardarLocal(r2.fila); return r2.fila; }
            }
          }
          if (r && r.local && r.fila) { guardarLocal(r.fila); return r.fila; }
        } catch { /* sin motor local: a la nube, como antes */ }
        return alNube({ ...d, adjuntos: (d.adjuntos || []).filter((x) => x && !x.soloLocal) });
      },
      /* 8-nov (nota 1108-iarvis-cx-acciones): el botón «hacer» de una respuesta (marcar instalado,
         aprobar, guardar la foto como prueba) lo hace el teléfono con su copia y el alcance del rol. */
      hacer: async (a) => {
        const AG0 = window.AUTOGUARDADO;
        /* Las fotos en espera del motor viven en memoria: se vuelven a subir desde el teléfono. */
        /* 8-nov: cualquier acción que lleve fotos (NCR, reparación, nota, equipo, prueba), no solo la prueba. */
        if (a && Array.isArray(a.fotos) && a.fotos.length && !(a.hacer === 'fotoPrueba' && !a.pruebaId) && AG0 && AG0.leerFoto) {
          a = { ...a, fotos: await Promise.all(a.fotos.map(async (f) => {
            if (!f || !f.local) return f;
            try { const b = await AG0.leerFoto(f.local); return b ? { ...f, fotoId: await C.subirFoto(b) } : f; } catch { return f; }
          })) };
        }
        const r = await C.postJson('api/iarvis/accion', { accion: a });
        if (r && r.fila) {
          guardarLocal(r.fila);
          const AG = window.AUTOGUARDADO;
          if (AG && AG.borrarFoto) for (const k of r.fila.fotosGuardadas || []) { try { await AG.borrarFoto(k); } catch { /* ya no está */ } }
        }
        return r && r.fila;
      },
      proponer: async (d) => {
        const r = await C.postJson('api/iarvis/proponer', d);
        if (r && r.fila && r.fila.local) guardarLocal(r.fila);
        return r.fila;
      },
      historial: async () => {
        const nube = await conv.historial();
        return [...leerLocales(), ...(Array.isArray(nube) ? nube : [])].sort((a, b) => String(b.creado || '9').localeCompare(String(a.creado || '9'))).slice(0, 60);
      },
      valorar: (id, v) => {
        const l = leerLocales();
        const i = l.findIndex((f) => f.id === id);
        if (i >= 0) { l[i].valoracion = String(v).slice(0, 10); escribirLocales(l); return { ok: true }; }
        return conv.valorar(id, v);
      },
      estado: (id) => conv.estado(id),
      /* Una foto, además de a la nube, al teléfono (por el camino de fotos de siempre: api/foto y el
         autoguardado), para poder meterla como evidencia de una prueba sin depender de la red. */
      adjuntar: async (nombre, bytes, tipo) => {
        let r = null;
        try { r = await conv.adjuntar({ nombre, bytes, tipo }); } catch { r = null; }
        if (!/^image\//.test(String(tipo || ''))) return r || { ok: false, aviso: 'No se ha podido subir.' };
        const blob = new Blob([bytes], { type: tipo });
        let local = null; let fotoId = null;
        const AG = window.AUTOGUARDADO;
        try { if (AG && AG.guardarFoto) local = await AG.guardarFoto(blob); } catch { local = null; }
        try { fotoId = await C.subirFoto(blob); } catch { fotoId = null; }
        if (!local && !fotoId) return r || { ok: false, aviso: 'No se ha podido subir.' };
        if (r && r.ok) return { ...r, adjunto: { ...r.adjunto, fotoId, local } };
        return { ok: true, adjunto: { nombre, tipo, fotoId, local, soloLocal: true } };
      },
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
      volver,
    });
  }

  window.addEventListener('hashchange', pintar);
  if (activa()) pintar();
})();
