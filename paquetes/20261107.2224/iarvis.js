'use strict';
/*
 * 🧭 HABLAR CON IARVIS (7-nov-2026, JC: «una buena forma de hablar con Iarvis, desde el
 * móvil, desde la web y desde la app de escritorio, en todas las apps de Vidaire»).
 *
 * UN SOLO COMPONENTE para todas: en el escritorio y la web, un botón pequeño abajo a la
 * derecha que abre un panel lateral; en el móvil, el mismo panel dentro de su pestaña.
 * Historial de cada persona, «útil / no útil» en cada respuesta (de ahí aprende Iarvis),
 * enlaces a las pantallas ([[pantalla:id]]) y adjuntos de cualquier tipo.
 *
 * No habla con ninguna nube ni modelo: usa un ADAPTADOR con
 *   preguntar(datos) · historial() · valorar(id, v) · estado(id) · adjuntar(nombre, bytes, tipo)
 * En el escritorio y la web es window.puente (electron/ipc/canalesIarvis.js); en el móvil
 * lo arma cxobra con shared/ia/conversaciones.js. Nada de esto lanza errores a la vista:
 * sin motor, el chat dice «Iarvis no está configurado todavía»; sin red, que contestará luego.
 *
 *   IARVIS.instalar({ ir, contexto })                       escritorio y web (app.js)
 *   IARVIS.montarEn(elemento, { adaptador, ir, contexto, movil: true })   móvil
 *     contexto() → { pantalla, obraId, obraNombre, mirando }
 *
 * Adjuntos: se detecta el tipo por el contenido (shared/ia/adjuntos.js), se sube al cubo y
 * Iarvis propone adónde va. NADA entra en la app sin pulsar «Confirmar», y entonces se abre la
 * pantalla con su importador de siempre (con sus validaciones y el alcance del rol).
 */
(function () {
  const ESPERA_SONDEO = 8000;
  const SONDEOS = 15;
  const NOMBRES_PANTALLA = {
    presupuestos: 'Presupuestos', presupuestoObra: 'Presupuesto de obra', medObra: 'Med Obra', certificaciones: 'Certificaciones',
    compras: 'Compras', comparativos: 'Comparativos', gantt: 'Gantt', commissioning: 'Commissioning', documentacion: 'Documentación',
    balanceo: 'Balanceo', reclamaciones: 'Reclamaciones', incidencias: 'Incidencias', partes: 'Partes', actas: 'Actas', tareas: 'Tareas',
    pedidos: 'Pedidos', documentacionProyecto: 'Documentación del proyecto', planosObra: 'Planos', facturasProveedor: 'Facturas',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I = { panel: null, boton: null, lista: null, adaptador: null, ir: null, contexto: () => ({}), movil: false, ficheros: [], filas: [], ocupado: false };

  function adaptadorDelPuente() {
    const p = window.puente;
    if (!p || !p.iarvisPreguntar) return null;
    return {
      preguntar: (d) => p.iarvisPreguntar(d), historial: () => p.iarvisHistorial(), valorar: (id, v) => p.iarvisValorar(id, v),
      estado: (id) => p.iarvisEstado(id), adjuntar: (n, b, t) => p.iarvisAdjuntar(n, b, t),
    };
  }

  function trozos(texto) {
    const C = window.IarvisConversaciones;
    return C ? C.trozos(texto) : [{ texto }];
  }

  function pintarRespuesta(f) {
    if (!f.respuesta) return `<div class="iaRespuesta iaEspera">Iarvis está pensando…</div>`;
    const html = trozos(f.respuesta).map((t) => (t.pantalla
      ? `<button class="iaIr" data-ia-ir="${esc(t.pantalla)}">${esc(NOMBRES_PANTALLA[t.pantalla] || t.pantalla)} →</button>`
      : esc(t.texto))).join('');
    const espera = f.estado === 'pendiente' || f.estado === 'respondiendo';
    const valorable = f.estado === 'respondida' && f.id;
    const pie = valorable ? `<div class="iaPie">¿Te ha servido?
      <button data-ia-valorar="util" data-id="${esc(f.id)}" class="${f.valoracion === 'util' ? 'elegida' : ''}">Útil</button>
      <button data-ia-valorar="no_util" data-id="${esc(f.id)}" class="${f.valoracion === 'no_util' ? 'elegida' : ''}">No útil</button></div>` : '';
    return `<div class="iaRespuesta${espera ? ' iaEspera' : ''}">${html}${pintarPropuestas(f)}${pie}</div>`;
  }

  function pintarPropuestas(f) {
    const A = window.IarvisAdjuntos;
    const adj = Array.isArray(f.adjuntos) ? f.adjuntos : [];
    if (!A || !adj.length) return '';
    return adj.map((a) => {
      const d = A.proponerDestino(a.tipo);
      if (d.estado === 'importa') return `<div class="iaPropuesta">«${esc(a.nombre)}»: ${esc(d.accion)}.<button data-ia-confirmar="${esc(d.pantalla)}">Confirmar</button></div>`;
      if (d.estado === 'lee') return `<div class="iaPropuesta">«${esc(a.nombre)}»: ${esc(d.accion)}.</div>`;
      return `<div class="iaPropuesta">«${esc(a.nombre)}»: guardado. Esta app aún no importa este tipo (${esc(a.tipo)}); queda apuntado.</div>`;
    }).join('');
  }

  function pintar() {
    if (!I.lista) return;
    if (!I.filas.length) {
      I.lista.innerHTML = `<p class="iaVacio">Pregúntale a Iarvis cómo se hace algo en Vidaire, o adjunta un documento y te dice adónde va.</p>`;
      return;
    }
    I.lista.innerHTML = [...I.filas].reverse().map((f) => `<div class="iaPregunta">${esc(f.pregunta)}${(f.adjuntos || []).length ? `<div class="iaAdjuntos">📎 ${f.adjuntos.map((a) => esc(a.nombre)).join(', ')}</div>` : ''}</div>${pintarRespuesta(f)}`).join('');
    I.lista.scrollTop = I.lista.scrollHeight;
  }

  async function cargarHistorial() {
    if (!I.adaptador) return;
    try { const h = await I.adaptador.historial(); if (Array.isArray(h)) I.filas = h; } catch { /* se queda lo que hay */ }
    pintar();
  }

  async function sondear(id) {
    for (let i = 0; i < SONDEOS; i++) {
      await new Promise((r) => setTimeout(r, ESPERA_SONDEO));
      let f = null;
      try { f = await I.adaptador.estado(id); } catch { /* sin red */ }
      if (f && f.estado !== 'pendiente' && f.estado !== 'respondiendo') {
        I.filas = I.filas.map((x) => (x.id === id ? { ...x, ...f } : x));
        pintar();
        if (I.boton && (!I.panel || I.panel.hidden)) I.boton.classList.add('conPunto');
        return;
      }
    }
  }

  async function mandar() {
    const caja = I.panel.querySelector('textarea');
    const pregunta = caja.value.trim();
    if (!pregunta || I.ocupado || !I.adaptador) return;
    I.ocupado = true;
    const botonMandar = I.panel.querySelector('.iaMandar');
    botonMandar.disabled = true;
    const adjuntos = I.ficheros.slice();
    I.ficheros = [];
    pintarFicheros();
    caja.value = '';
    const provisional = { id: null, pregunta, adjuntos, estado: 'respondiendo', respuesta: null };
    I.filas = [provisional, ...I.filas];
    pintar();
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    let r;
    try {
      r = await I.adaptador.preguntar({ pregunta, pantalla: ctx.pantalla, obraId: ctx.obraId, obraNombre: ctx.obraNombre, mirando: ctx.mirando, idioma: ctx.idioma, adjuntos });
    } catch { r = { estado: 'pendiente', respuesta: 'Iarvis te contestará en un rato. Tu pregunta queda guardada.' }; }
    Object.assign(provisional, r || {});
    pintar();
    I.ocupado = false;
    botonMandar.disabled = false;
    if (provisional.id && provisional.estado === 'pendiente' && !provisional.enCola) sondear(provisional.id);
  }

  function pintarFicheros() {
    const z = I.panel && I.panel.querySelector('.iaFicheros');
    if (z) z.textContent = I.ficheros.length ? `📎 ${I.ficheros.map((a) => a.nombre).join(', ')}` : '';
  }

  async function adjuntar(lista) {
    const A = window.IarvisAdjuntos;
    for (const archivo of lista) {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const t = A ? A.detectarTipo(bytes, archivo.name) : { tipo: 'desconocido', mime: archivo.type };
      const z = I.panel.querySelector('.iaFicheros');
      if (z) z.textContent = `Subiendo «${archivo.name}»…`;
      let r;
      try { r = await I.adaptador.adjuntar(archivo.name, bytes, t.mime || archivo.type || 'application/octet-stream'); } catch { r = { ok: false, aviso: 'No se ha podido subir.' }; }
      if (r && r.ok) I.ficheros.push({ ...r.adjunto, tipo: t.tipo });
      else if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar((r && r.aviso) || 'No se ha podido subir.');
      else if (z) z.textContent = (r && r.aviso) || 'No se ha podido subir.';
    }
    pintarFicheros();
  }

  function construirPanel() {
    const p = document.createElement('aside');
    p.className = `iaPanel${I.movil ? ' iaMovil' : ''}`;
    p.setAttribute('aria-label', 'Iarvis');
    p.innerHTML = `
      <div class="iaCabecera"><h2>🧭 Iarvis</h2><span class="iaAviso">Asistente automático</span>${I.movil ? '' : '<button class="iaCerrar" title="Cerrar (Esc)" aria-label="Cerrar">×</button>'}</div>
      <div class="iaLista" role="log" aria-live="polite"></div>
      <div class="iaEntrada">
        <div class="iaFicheros"></div>
        <div class="iaFila">
          <button class="iaClip" title="Adjuntar un archivo" aria-label="Adjuntar">📎</button>
          ${I.movil ? '<button class="iaCamara" title="Foto con la cámara" aria-label="Cámara">📷</button>' : ''}
          <textarea rows="1" placeholder="${I.movil ? 'Escribe o pulsa el micrófono del teclado para dictar' : 'Pregunta a Iarvis… (Intro para mandar)'}"></textarea>
          <button class="iaMandar">Mandar</button>
        </div>
        <input type="file" class="iaArchivo" multiple hidden>
        <input type="file" class="iaFoto" accept="image/*" capture="environment" hidden>
      </div>`;
    I.lista = p.querySelector('.iaLista');
    p.querySelector('.iaMandar').addEventListener('click', mandar);
    p.querySelector('textarea').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !I.movil) { e.preventDefault(); mandar(); } });
    p.querySelector('.iaClip').addEventListener('click', () => p.querySelector('.iaArchivo').click());
    const cam = p.querySelector('.iaCamara');
    if (cam) cam.addEventListener('click', () => p.querySelector('.iaFoto').click());
    for (const sel of ['.iaArchivo', '.iaFoto']) {
      p.querySelector(sel).addEventListener('change', (e) => { adjuntar([...e.target.files]); e.target.value = ''; });
    }
    const cerrarB = p.querySelector('.iaCerrar');
    if (cerrarB) cerrarB.addEventListener('click', cerrar);
    p.addEventListener('click', async (e) => {
      const ir = e.target.closest('[data-ia-ir]');
      if (ir && I.ir) { I.ir(ir.getAttribute('data-ia-ir')); if (!I.movil) cerrar(); return; }
      const conf = e.target.closest('[data-ia-confirmar]');
      if (conf && I.ir) { I.ir(conf.getAttribute('data-ia-confirmar')); if (!I.movil) cerrar(); return; }
      const v = e.target.closest('[data-ia-valorar]');
      if (v) {
        const id = v.getAttribute('data-id');
        const val = v.getAttribute('data-ia-valorar');
        I.filas = I.filas.map((f) => (f.id === id ? { ...f, valoracion: val } : f));
        pintar();
        try { await I.adaptador.valorar(id, val); } catch { /* se queda pintado */ }
      }
    });
    p.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !I.movil) cerrar(); });
    return p;
  }

  function abrir() {
    if (!I.panel) return;
    I.panel.hidden = false;
    if (I.boton) { I.boton.hidden = true; I.boton.classList.remove('conPunto'); }
    cargarHistorial();
    const t = I.panel.querySelector('textarea');
    if (t) t.focus();
  }
  function cerrar() {
    if (I.movil || !I.panel) return;
    I.panel.hidden = true;
    if (I.boton) I.boton.hidden = false;
  }

  /** Escritorio y web: botón flotante + panel lateral. */
  function instalar({ adaptador, ir, contexto } = {}) {
    I.adaptador = adaptador || adaptadorDelPuente();
    if (!I.adaptador || I.boton) return;
    I.ir = ir || null;
    I.contexto = contexto || (() => ({}));
    I.boton = document.createElement('button');
    I.boton.id = 'iarvisBoton';
    I.boton.title = 'Hablar con Iarvis';
    I.boton.innerHTML = '<span aria-hidden="true">🧭</span> Iarvis <span class="iaPunto"></span>';
    I.boton.addEventListener('click', abrir);
    I.panel = construirPanel();
    I.panel.hidden = true;
    document.body.append(I.boton, I.panel);
    document.body.classList.add('conIarvis');
  }

  /** Móvil: el panel dentro de su pestaña. */
  function montarEn(elemento, { adaptador, ir, contexto } = {}) {
    I.movil = true;
    I.adaptador = adaptador;
    I.ir = ir || null;
    I.contexto = contexto || (() => ({}));
    if (!I.panel) I.panel = construirPanel();
    elemento.replaceChildren(I.panel);
    I.panel.hidden = false;
    cargarHistorial();
  }

  window.IARVIS = { instalar, montarEn, abrir, cerrar, estado: I };
})();
