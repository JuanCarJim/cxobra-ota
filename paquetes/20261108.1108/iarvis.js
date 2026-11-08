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

  const I = { panel: null, boton: null, lista: null, adaptador: null, ir: null, contexto: () => ({}), movil: false, ficheros: [], filas: [], ocupado: false, deEstaVez: new Set(), idsEstaVez: new Set(), verAnteriores: false, pdfs: {} };

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

  /* 8-nov (JC): «**negrita**» y listas «- » como texto con formato, no con asteriscos. */
  function formato(texto) {
    const enLinea = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const bloques = String(texto || '').split(/\n{2,}/);
    return bloques.map((b) => {
      const lineas = b.split('\n');
      if (lineas.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      const cab = lineas[0] && !/^\s*[-•]\s+/.test(lineas[0]) && lineas.slice(1).every((l) => /^\s*[-•]\s+/.test(l)) && lineas.length > 1;
      if (cab) return `<p>${enLinea(lineas[0])}</p><ul>${lineas.slice(1).map((l) => `<li>${enLinea(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${lineas.map(enLinea).join('<br>')}</p>`;
    }).join('');
  }

  function textoConEnlaces(texto) {
    return trozos(texto).map((t) => (t.pantalla
      ? `<button class="iaIr" data-ia-ir="${esc(t.pantalla)}">${esc(NOMBRES_PANTALLA[t.pantalla] || t.pantalla)} →</button>`
      : formato(t.texto))).join('');
  }

  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  /** Lo que Iarvis ha hecho con la app: el PDF, ir a una pantalla, proponer o aplicar. */
  function pintarAcciones(f) {
    const acc = Array.isArray(f.acciones) ? f.acciones : [];
    if (!acc.length) return '';
    const pdfs = acc.filter((a) => a.tipo === 'pdf').map((a, i) => {
      const id = `${f.id}:${i}`;
      if (a.base64) I.pdfs[id] = a;
      const disponible = a.ruta || a.base64 || I.pdfs[id];
      return `<div class="iaPdf"><span class="iaPdfIcono" aria-hidden="true">PDF</span><span class="iaPdfNombre">${esc(a.nombre)}<small>${a.tamano ? kb(a.tamano) : ''}${a.ruta ? ' · en Descargas › Vidaire Iarvis' : ''}</small></span>
        ${disponible ? `<button class="iaBotonPrin" data-ia-pdf="${esc(id)}" data-ruta="${esc(a.ruta || '')}">Abrir</button>${a.ruta ? `<button data-ia-pdf-carpeta="${esc(a.ruta)}">Mostrar</button>` : `<button data-ia-pdf-bajar="${esc(id)}">Descargar</button>`}` : '<small>Pídemelo otra vez para sacarlo de nuevo.</small>'}</div>`;
    }).join('');
    const botones = acc.filter((a) => a.tipo !== 'pdf').map((a) => {
      const datos = esc(JSON.stringify(a));
      const prin = a.tipo === 'proponer' || a.tipo === 'aplicar' || (a.tipo === 'hacer' && a.hacer !== 'rechazar');
      return `<button class="${prin ? 'iaBotonPrin' : 'iaBotonSec'}" data-ia-accion="${datos}">${esc(a.texto || 'Abrir')}</button>`;
    }).join('');
    return `${pdfs}${botones ? `<div class="iaAcciones">${botones}</div>` : ''}`;
  }

  function pintarRespuesta(f) {
    if (!f.respuesta) return `<div class="iaRespuesta iaEspera"><span class="iaPuntos"><i></i><i></i><i></i></span> Mirándolo en la app…</div>`;
    const espera = f.estado === 'pendiente' || f.estado === 'respondiendo';
    const valorable = f.estado === 'respondida' && f.id;
    const pie = valorable ? `<div class="iaPie">
      <button data-ia-valorar="util" data-id="${esc(f.id)}" class="${f.valoracion === 'util' ? 'elegida' : ''}" title="Me ha servido">👍</button>
      <button data-ia-valorar="no_util" data-id="${esc(f.id)}" class="${f.valoracion === 'no_util' ? 'elegida' : ''}" title="No me ha servido">👎</button></div>` : '';
    return `<div class="iaRespuesta${espera ? ' iaEspera' : ''}">${textoConEnlaces(f.respuesta)}${pintarAcciones(f)}${pintarPropuestas(f)}${pie}</div>`;
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

  /* 8-nov (JC: «no me gusta que se abra así»): se abre LIMPIO —saludo y atajos— y lo de
     otras veces queda plegado en «Conversaciones anteriores». */
  function sugerencias() {
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    const mes = new Date().toLocaleDateString('es-ES', { month: 'long' });
    const lista = ctx.obraId
      ? [`Planificación de commissioning de ${mes}`, '¿Qué hay planificado esta semana?', 'Planificación de las UTAs del mes que viene', '¿Cómo certifico una partida?']
      : ['¿Cómo elijo la obra en la que trabajo?', '¿Qué puedo hacer con mi puesto?', '¿Cómo subo un documento?'];
    return lista.map((t) => `<button class="iaSugerencia" data-ia-sugerencia="${esc(t)}">${esc(t)}</button>`).join('');
  }

  function saludo() {
    const h = new Date().getHours();
    const nombre = (window.ESTADO_SESION && window.ESTADO_SESION.nombre) || '';
    return `${h < 6 || h >= 21 ? 'Buenas noches' : h < 14 ? 'Buenos días' : 'Buenas tardes'}${nombre ? `, ${esc(nombre.split(' ')[0])}` : ''}`;
  }

  function pintarFila(f) {
    return `<div class="iaPregunta">${esc(f.pregunta)}${(f.adjuntos || []).length ? `<div class="iaAdjuntos">📎 ${f.adjuntos.map((a) => esc(a.nombre)).join(', ')}</div>` : ''}</div>${pintarRespuesta(f)}`;
  }

  function pintar() {
    if (!I.lista) return;
    const ahora = I.filas.filter((f) => I.deEstaVez.has(f) || (f.id && I.idsEstaVez.has(f.id)));
    const antes = I.filas.filter((f) => !ahora.includes(f));
    const anteriores = antes.length
      ? `<details class="iaAnteriores"${I.verAnteriores ? ' open' : ''}><summary>Conversaciones anteriores (${antes.length})</summary>${[...antes].reverse().map(pintarFila).join('')}</details>`
      : '';
    const bienvenida = ahora.length ? '' : `<div class="iaBienvenida"><h3>${saludo()}</h3><p>Pídeme lo que necesites de la obra: lo busco en la app y te lo doy. También te explico cómo se hace cualquier cosa.</p><div class="iaSugerencias">${sugerencias()}</div></div>`;
    I.lista.innerHTML = `${anteriores}${bienvenida}${[...ahora].reverse().map(pintarFila).join('')}`;
    const det = I.lista.querySelector('.iaAnteriores');
    if (det) det.addEventListener('toggle', () => { I.verAnteriores = det.open; });
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

  async function mandar(textoDado) {
    const caja = I.panel.querySelector('textarea');
    const pregunta = (typeof textoDado === 'string' ? textoDado : caja.value).trim();
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
    I.deEstaVez.add(provisional);
    pintar();
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    let r;
    try {
      r = await I.adaptador.preguntar({ pregunta, pantalla: ctx.pantalla, obraId: ctx.obraId, obraNombre: ctx.obraNombre, mirando: ctx.mirando, idioma: ctx.idioma, adjuntos });
    } catch { r = { estado: 'pendiente', respuesta: 'Iarvis te contestará en un rato. Tu pregunta queda guardada.' }; }
    Object.assign(provisional, r || {});
    if (provisional.id) I.idsEstaVez.add(provisional.id);
    pintar();
    I.ocupado = false;
    botonMandar.disabled = false;
    /* Un solo equipo que abrir: se abre ya (8-nov, Iarvis que actúa). */
    if (provisional.abrirYa && provisional.abrirYa.tipo === 'ir') accion(provisional.abrirYa);
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

  function blobDe(a) {
    const bin = atob(a.base64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: 'application/pdf' }));
  }
  async function abrirPdf(id, ruta, enCarpeta) {
    if (ruta && window.puente && window.puente.iarvisAbrirPdf) {
      const r = await window.puente.iarvisAbrirPdf(ruta, enCarpeta);
      if (r && !r.ok && window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar(r.error || 'No se ha podido abrir.');
      return;
    }
    const a = I.pdfs[id];
    if (a) window.open(blobDe(a), '_blank');
  }
  function bajarPdf(id) {
    const a = I.pdfs[id];
    if (!a) return;
    const enlace = document.createElement('a');
    enlace.href = blobDe(a);
    enlace.download = a.nombre || 'Planificación.pdf';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
  }

  /* Lo que un botón «ir» de Iarvis puede dejar para la sección que abre (renderer/movil/*). */
  const CLAVES_SESION = new Set(['cx.segmento', 'ncr.filtro', 'rp.filtro', 'cx.planoEquipos.planta', 'reparaciones.prefill', 'partes.prefill']);

  /** Los botones de las respuestas de la app: ir a una pantalla, proponer, aplicar. */
  async function accion(a, boton) {
    if (a.tipo === 'ir') {
      /* El equipo que abrir (commissioning lo recoge al cargar) y el formulario de estanqueidad
         empezado (si no había otro a medias): renderer/movil/commissioning.js y estanqueidad.js. */
      try {
        if (a.equipoId) sessionStorage.setItem('cx.abrir', String(a.equipoId));
        if (a.borrador && typeof a.borrador === 'object') {
          if (!localStorage.getItem('estanqueidad.borrador')) {
            const d = new Date();
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
            localStorage.setItem('estanqueidad.borrador', JSON.stringify({ fecha: local.slice(0, 10), horaInicio: local.slice(11, 16), ...a.borrador }));
          }
          sessionStorage.setItem('estanqueidad.seguir', '1');
        }
        /* 8-nov · Iarvis que hace de todo: la NCR, reparación o tarea que abrir, y lo que la sección
           lee al cargar (solo estas claves: nada que el servidor no sepa ya). */
        if (a.abrir) sessionStorage.setItem('cx.abrir', String(a.abrir));
        if (a.sesion && typeof a.sesion === 'object') {
          for (const [k, v] of Object.entries(a.sesion)) if (CLAVES_SESION.has(k)) sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      } catch { /* sin almacenamiento: abre la pantalla sin más */ }
      /* La hoja del equipo (toma de datos, checklist, estanqueidad, balanceo) y los «nuevo» de una sección. */
      if (a.accionEquipo && a.equipoId && I.movil) {
        if (I.ir) I.ir(a.destino || 'commissioning');
        const ir = () => (typeof window.CX_COMMISSIONING_IR === 'function' ? window.CX_COMMISSIONING_IR(String(a.equipoId), String(a.accionEquipo)) : null);
        setTimeout(ir, 400);
        return;
      }
      if (Array.isArray(a.pasos) && a.pasos.length && I.movil && typeof window.CX_ACCION_RAPIDA === 'function') {
        window.CX_ACCION_RAPIDA({ seccion: a.destino, pasos: a.pasos.map(String).slice(0, 4) });
        return;
      }
      if (a.vista && a.destino === 'commissioning' && window.PANTALLA_COMMISSIONING && window.PANTALLA_COMMISSIONING.prepararVista) window.PANTALLA_COMMISSIONING.prepararVista(a.vista, a.obraId);
      if (I.ir) I.ir(a.destino);
      if (!I.movil) cerrar();
      return;
    }
    /* Iarvis que actúa (8-nov): marcar instalado, aprobar, guardar la foto como prueba… */
    if (a.tipo === 'hacer' && I.adaptador && I.adaptador.hacer) {
      if (I.ocupado) return;
      /* 8-nov · la firma con Iarvis: antes, Face ID, huella o PIN en el teléfono (renderer/movil/verificarIdentidad.js). */
      if (a.verificar) {
        const metodo = typeof window.CX_VERIFICAR === 'function' ? await window.CX_VERIFICAR({ motivo: 'Confirma que eres tú para firmar' }) : null;
        if (!metodo) {
          const f = { id: null, pregunta: a.texto || 'Sí', estado: 'respondida', respuesta: 'Sin Face ID, huella o PIN no firmo.' };
          I.filas = [f, ...I.filas]; I.deEstaVez.add(f); pintar();
          return;
        }
        a = { ...a, parametros: { ...(a.parametros || {}), verificacion: metodo } };
      }
      I.ocupado = true;
      if (boton) boton.disabled = true;
      const provisional = { id: null, pregunta: a.texto || 'Hecho', estado: 'respondiendo', respuesta: null };
      I.filas = [provisional, ...I.filas];
      I.deEstaVez.add(provisional);
      pintar();
      let r;
      try { r = await I.adaptador.hacer(a); } catch { r = { estado: 'fallo', respuesta: 'No he podido hacerlo ahora.' }; }
      Object.assign(provisional, r || {});
      if (provisional.id) I.idsEstaVez.add(provisional.id);
      I.ocupado = false;
      pintar();
      return;
    }
    const proponer = (I.adaptador && I.adaptador.proponer) || (window.puente && window.puente.iarvisProponer && ((x) => window.puente.iarvisProponer(x)));
    if ((a.tipo === 'proponer' || a.tipo === 'aplicar') && proponer) {
      if (I.ocupado) return;
      I.ocupado = true;
      if (boton) boton.disabled = true;
      const provisional = { id: null, pregunta: a.tipo === 'aplicar' ? 'Aplícalo' : 'Planifiquémoslo juntos', estado: 'respondiendo', respuesta: null };
      I.filas = [provisional, ...I.filas];
      I.deEstaVez.add(provisional);
      pintar();
      let r;
      try { r = await proponer({ obraId: a.obraId, desde: a.desde, hasta: a.hasta, periodo: a.periodo, aplicar: a.tipo === 'aplicar' }); } catch (e) { r = { estado: 'fallo', respuesta: 'No he podido hacerlo ahora.' }; }
      Object.assign(provisional, r || {});
      if (provisional.id) I.idsEstaVez.add(provisional.id);
      I.ocupado = false;
      pintar();
    }
  }

  function construirPanel() {
    const p = document.createElement('aside');
    p.className = `iaPanel${I.movil ? ' iaMovil' : ''}`;
    p.setAttribute('aria-label', 'Iarvis');
    p.innerHTML = `
      <div class="iaCabecera"><span class="iaMarca" aria-hidden="true">I</span><div class="iaTitulo"><h2>Iarvis</h2><span class="iaAviso">Usa la app por ti · solo lo que tu puesto ve</span></div><button class="iaNueva" title="Empezar de cero" aria-label="Conversación nueva">＋</button>${I.movil ? '' : '<button class="iaCerrar" title="Cerrar (Esc)" aria-label="Cerrar">×</button>'}</div>
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
    p.querySelector('.iaMandar').addEventListener('click', () => mandar());
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
      const sug = e.target.closest('[data-ia-sugerencia]');
      if (sug) { mandar(sug.getAttribute('data-ia-sugerencia')); return; }
      if (e.target.closest('.iaNueva')) { I.deEstaVez = new Set(); I.idsEstaVez = new Set(); I.verAnteriores = false; pintar(); return; }
      const pdf = e.target.closest('[data-ia-pdf]');
      if (pdf) { abrirPdf(pdf.getAttribute('data-ia-pdf'), pdf.getAttribute('data-ruta'), false); return; }
      const carpeta = e.target.closest('[data-ia-pdf-carpeta]');
      if (carpeta) { abrirPdf(null, carpeta.getAttribute('data-ia-pdf-carpeta'), true); return; }
      const bajar = e.target.closest('[data-ia-pdf-bajar]');
      if (bajar) { bajarPdf(bajar.getAttribute('data-ia-pdf-bajar')); return; }
      const acc = e.target.closest('[data-ia-accion]');
      if (acc) { let a = null; try { a = JSON.parse(acc.getAttribute('data-ia-accion')); } catch { /* roto */ } if (a) accion(a, acc); return; }
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
    I.verAnteriores = false;
    /* 8-nov: el saludo sale ya; el historial de la nube puede tardar y el panel se quedaba en blanco. */
    pintar();
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
