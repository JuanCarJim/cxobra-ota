'use strict';
/*
 * 🧭 IARVIS EN EL MÓVIL (#iarvis, 7-nov-2026). La misma conversación que el escritorio y la
 * web (renderer/iarvis.js, montado aquí a pantalla completa; se abre con la brújula de la cabecera), sobre la misma tabla
 * (ia_mensajes de cxobra-sync) con shared/ia/conversaciones.js.
 *
 * Audios: el micrófono junto a «Mandar» (renderer/movil/iarvisVoz.js, 12-nov): se pasa a texto en el
 * teléfono y llega aquí como una pregunta más, con `entrada: 'voz'` en el contexto.
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
    /* 11-nov · sugerencias de los usuarios (shared/ia/sugerencias.js): el chat las confirma y, con el «sí»,
       pasan al equipo de desarrollo. Solo se INSERTAN en la nube (RLS); el rol lo pone la base. */
    const SG = window.IarvisSugerencias || null;
    const sugerencias = SG ? SG.crearSugerencias({ nube: N.nube, app: 'cx', almacen }) : null;
    /* 8-nov (JC: «Iarvis tiene que estar en el móvil también»): lo de la planificación se contesta
       aquí, con la copia del teléfono y el alcance de su rol (electron/movil/rutasPlanificacion.js);
       lo demás sigue a la nube. Sin PDF en el teléfono: resumen y «Abrir la planificación». */
    const LOCALES = 'iarvis-respuestas-locales';
    const leerLocales = () => { try { return JSON.parse(almacen.getItem(LOCALES) || '[]'); } catch { return []; } };
    const escribirLocales = (l) => { try { almacen.setItem(LOCALES, JSON.stringify(l.slice(0, 60))); } catch { /* lleno */ } };
    const guardarLocal = (f) => escribirLocales([f, ...leerLocales().filter((x) => x.id !== f.id)]);
    /* 13-nov: escalar cuando duda (shared/ia/escalado.js), criterio fino (juicio.js) y encargos (encargo.js). */
    const ESC = window.IarvisEscalado || null;
    const JUI = window.IarvisJuicio || null;
    const ENC = window.IarvisEncargo || null;
    const limpia = (r) => (ESC && r && typeof r.respuesta === 'string' ? { ...r, respuesta: ESC.quitarMarcas(r.respuesta) } : r);
    const alNube = (d) => conv.preguntar({
        pregunta: d.pregunta,
        obraId: d.obraId || null,
        adjuntos: d.adjuntos || [],
        /* 8-nov: con los datos de la obra abierta (`datos_obra`) que ha sacado el teléfono (rutasPlanificacion.js). */
        contexto: { app: 'cx', pantalla: d.pantalla || '', ...(window.CX_VOZ && window.CX_VOZ.esDeVoz(d.pregunta) ? { entrada: 'voz' } : {}), ...(d.obraId ? { obra_id: String(d.obraId), obra: String(d.obraNombre || '').slice(0, 160) } : {}), ...(d.idioma ? { idioma: d.idioma } : {}), ...(d.contexto && typeof d.contexto === 'object' ? { ...d.contexto, app: 'cx' } : {}), ...(ESC ? { escalado: 1 } : {}), ...(d.sinApp ? { sinApp: 1 } : {}) },
      });
    /* El motor de IA, solo para ELEGIR la acción (sin él, o sin desplegar: null, y se queda la
       respuesta de las reglas con las opciones más cercanas). */
    const alMotor = async (pregunta, obraId, sinHerramienta = null) => {
      try {
        const r = await N.nube.llamarFuncion('iarvis', '', JSON.stringify({ modo: 'accion', pregunta: String(pregunta || '').slice(0, 2000), obra_id: obraId || null, ...(ESC ? { escalado: 1 } : {}), ...(ESC && sinHerramienta ? { sin_herramienta: String(sinHerramienta).slice(0, 300) } : {}) }), ESC ? 25000 : 12000);
        const j = await r.json().catch(() => null);
        if (j && j.accion && j.accion.id) return j.accion;
        /* 11-nov: «varias» = lo pedido son varios pasos; lo propone la conversación, en orden. */
        if (j && j.estado === 'varias') return { varias: true };
        /* 13-nov: el motor duda (UNA pregunta) o no hay herramienta (dicho y anotado): eso es la respuesta. */
        if (ESC && j && (j.estado === 'aclarar' || j.estado === 'sin_herramienta') && j.texto) return { dicho: ESC.quitarMarcas(String(j.texto)).slice(0, 800) };
        return null;
      } catch { return null; }
    };
    /* Los renglones de la placa de las fotos adjuntas (máx. 3 fotos, 25 s): '' si no toca o no se puede. */
    const leerPlacas = async (pregunta, fotos) => {
      try {
        const E = window.IARVIS_ESPERA; const O = window.OCR_PLACA; const AGx = window.AUTOGUARDADO;
        const adiv = E && E.adivinar(pregunta, { fotos: fotos.length });
        if (!adiv || adiv.que !== 'leerPlaca' || !O || !O.disponible() || !AGx || !AGx.leerFoto) return '';
        const vistos = new Set(); const lineas = [];
        const trabajo = (async () => {
          for (const f of fotos.filter((x) => x.local).slice(0, 3)) {
            const b = await AGx.leerFoto(f.local);
            if (!b) continue;
            const { pasadas } = await O.leer(b);
            for (const l of [].concat(...(pasadas || []))) { const t = String(l || '').trim(); if (t && !vistos.has(t)) { vistos.add(t); lineas.push(t); } }
          }
        })();
        await Promise.race([trabajo, new Promise((ok) => setTimeout(ok, 25000))]);
        return lineas.slice(0, 80).join('\n');
      } catch { return ''; }
    };
    let ultimaNube = null;
    adaptador = {
      preguntar: async (d) => {
        if (SG && !d.sinSugerencia) {
          const sug = SG.detectar(d.pregunta);
          if (sug) return SG.filaConfirmacion({ pregunta: d.pregunta, texto: sug.texto, pantalla: d.pantalla, obraId: d.obraId, obraNombre: d.obraNombre });
        }
        /* 13-nov · «arregla el botón de…»: en el teléfono no se programa. Va a la nube marcado como encargo y el
           SERVIDOR decide: en cola para el ordenador de desarrollo, o la negativa de siempre. */
        if (ENC && !d.soloApp && ENC.detectar(d.pregunta)) return conv.preguntar({ pregunta: d.pregunta, obraId: d.obraId || null, contexto: { app: 'cx', pantalla: d.pantalla || '', encargo: 1 } });
        let r = null;
        try {
          /* Las fotos del chat, ya en el teléfono (adjuntar): por si es «métela como prueba de…». */
          const fotos = (d.adjuntos || []).filter((x) => x && (x.fotoId || x.local)).map((x) => ({ fotoId: x.fotoId || null, local: x.local || null }));
          /* 9-nov · «esto es la UTA-01» + fotos: la placa se lee AQUÍ, en el teléfono y sin red
             (renderer/ocrPlaca.js), y los renglones van con la pregunta para rellenar la ficha. */
          const placa = await leerPlacas(d.pregunta, fotos);
          /* 12-nov (JC): la última respuesta de la nube va con la siguiente, para que la conversación
             recuerde lo corregido (shared/ia/coherencia.js en el servidor del teléfono). */
          r = await C.postJson('api/iarvis/preguntar', { pregunta: d.pregunta, obraId: d.obraId || null, obraNombre: d.obraNombre || '', fotos, pantalla: d.pantalla || '', idioma: d.idioma || '', ...(placa ? { placa } : {}), ...(ultimaNube ? { anterior: ultimaNube } : {}) });
          ultimaNube = null;
          /* 8-nov · las reglas no lo entienden pero parece algo que hacer: se le pregunta al motor
             (edge function `iarvis`, modo «accion») qué acción del catálogo es. El servidor elige con
             el rol que lee de la nube; lo que vuelva se resuelve en el teléfono con confirmación. */
          if (r && r.local && r.fila && r.fila.preguntarMotor) {
            /* 13-nov: si las reglas ya saben que no hay herramienta («borra…»), el motor solo lo anota y lo dice: una
               acción «parecida» que eligiera no se ejecuta (queda el texto del teléfono, sin anotar). */
            const sinH = r.fila.sinHerramienta || null;
            const elegida = d.soloApp ? null : await alMotor(d.pregunta, d.obraId, sinH);
            if (elegida && elegida.dicho) { const f = { id: null, pregunta: d.pregunta, estado: 'respondida', local: true, respuesta: elegida.dicho }; guardarLocal(f); return f; }
            /* 11-nov: varios pasos: los propone la conversación con la nube, en orden y con botón. */
            if (elegida && elegida.varias && !sinH) return alNube({ ...d, adjuntos: (d.adjuntos || []).filter((x) => x && !x.soloLocal) });
            if (elegida && !elegida.varias && !sinH) {
              const r2 = await C.postJson('api/iarvis/accion', { accion: { hacer: 'catalogo', id: elegida.id, parametros: elegida.parametros || {}, pregunta: d.pregunta, obraId: d.obraId || null, fotos } });
              if (r2 && r2.fila) { guardarLocal(r2.fila); return r2.fila; }
            }
          }
          if (d.soloApp) return r && r.local && r.fila && !r.fila.preguntarMotor ? r.fila : null;
          if (r && r.local && r.fila) {
            /* 13-nov · criterio fino: la lectura del modelo fuerte si la app la pide (o el automático duda). */
            const f = r.fila.juicio && JUI ? await JUI.conLectura(conv, r.fila, { app: 'cx', pantalla: d.pantalla || '', obraId: d.obraId || null }) : r.fila;
            if (!f.enNube) guardarLocal(f);
            return f;
          }
        } catch { /* sin motor local: a la nube, como antes */ }
        if (d.soloApp) return null;
        const paraNube = { ...d, contexto: r && r.contexto, adjuntos: (d.adjuntos || []).filter((x) => x && !x.soloLocal) };
        /* 12-nov: la última respuesta de la nube se recuerda para «¿seguro?» y las correcciones. */
        const recordar = (f) => { if (f && f.estado === 'respondida' && f.respuesta) ultimaNube = { pregunta: String(d.pregunta || '').slice(0, 2000), respuesta: String(f.respuesta).slice(0, 4000) }; return f; };
        const n = await alNube(paraNube);
        /* 13-nov · escalado: «esto lo hace la app» ([[app:frase]]) → se vuelve a preguntar al teléfono con esa frase,
           una sola vez; si no lo resuelve, la nube contesta sabiéndolo. */
        const frase = ESC && n && n.estado === 'respondida' ? ESC.fraseDeApp(n.respuesta) : null;
        if (!frase) return recordar(limpia(n));
        let deApp = null;
        try { deApp = await adaptador.preguntar({ ...d, pregunta: frase, soloApp: true, sinSugerencia: true, adjuntos: [] }); } catch { deApp = null; }
        if (deApp && deApp.respuesta) {
          const f = { ...deApp, pregunta: d.pregunta, respuesta: `Entiendo que pides: «${frase}».\n\n${deApp.respuesta}` };
          guardarLocal(f);
          return f;
        }
        return recordar(limpia(await alNube({ ...paraNube, sinApp: true })));
      },
      /* 8-nov (nota 1108-iarvis-cx-acciones): el botón «hacer» de una respuesta (marcar instalado,
         aprobar, guardar la foto como prueba) lo hace el teléfono con su copia y el alcance del rol. */
      hacer: async (a) => {
        if (a && sugerencias && (a.hacer === 'sugerencia' || (a.hacer === 'rechazar' && a.sugerencia))) {
          const g = a.sugerencia || {};
          if (a.hacer === 'rechazar') return adaptador.preguntar({ pregunta: String(g.texto || ''), pantalla: g.pantalla, obraId: g.obraId, obraNombre: g.obraNombre, sinSugerencia: true });
          return SG.filaResultado(await sugerencias.enviar({ texto: g.texto, pantalla: g.pantalla, obraId: g.obraId, obraNombre: g.obraNombre }), a.texto);
        }
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
      /* 11-nov: «Empezar de cero» también para la memoria de Iarvis (shared/ia/charla.js). */
      nueva: () => conv.nuevaConversacion(),
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
    if (sugerencias) sugerencias.reintentar().catch(() => {});
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
