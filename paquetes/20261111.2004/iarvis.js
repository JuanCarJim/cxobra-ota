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
  /* 8-nov (JC): la conversación se borra sola tras 2 horas sin actividad: al abrir el chat pasado
     ese tiempo, empieza vacía. Lo anterior sigue en la nube (para que Iarvis aprenda), no se enseña. */
  const CHARLA = 'vidaire.iarvis.charla';
  const CADUCA_MS = 2 * 60 * 60 * 1000;
  const NOMBRES_PANTALLA = {
    presupuestos: 'Presupuestos', presupuestoObra: 'Presupuesto de obra', medObra: 'Medición real de obra', certificaciones: 'Certificaciones',
    compras: 'Compras', comparativos: 'Comparativos', gantt: 'Gantt', commissioning: 'Commissioning', documentacion: 'Documentación',
    balanceo: 'Balanceo', reclamaciones: 'Reclamaciones', incidencias: 'Incidencias', partes: 'Partes', actas: 'Actas', tareas: 'Tareas',
    pedidos: 'Pedidos', documentacionProyecto: 'Documentos del proyecto', planosObra: 'Planos', facturasProveedor: 'Facturas',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I = { panel: null, boton: null, lista: null, adaptador: null, ir: null, contexto: () => ({}), movil: false, ficheros: [], filas: [], ocupado: false, deEstaVez: new Set(), idsEstaVez: new Set(), verAnteriores: false, pdfs: {}, ultima: 0, volver: null };

  function leerCharla() {
    try {
      const c = JSON.parse(localStorage.getItem(CHARLA) || 'null');
      if (c && Number(c.ultima) && Date.now() - Number(c.ultima) < CADUCA_MS) return c;
    } catch { /* sin almacenamiento */ }
    return null;
  }
  function guardarCharla() {
    try { localStorage.setItem(CHARLA, JSON.stringify({ ultima: I.ultima, ids: [...I.idsEstaVez].slice(-60) })); } catch { /* sin almacenamiento */ }
  }
  /** Hay actividad: la conversación sigue viva 2 horas más. */
  function actividad() { I.ultima = Date.now(); guardarCharla(); }
  /** Al abrir: pasadas 2 horas sin actividad, conversación vacía. */
  function caducar() {
    if (I.ultima && Date.now() - I.ultima < CADUCA_MS) return;
    const c = leerCharla();
    I.deEstaVez = new Set();
    I.idsEstaVez = new Set(c && Array.isArray(c.ids) ? c.ids : []);
    I.ultima = c ? Number(c.ultima) : 0;
  }
  /** Para las pruebas: el estado de la conversación de esta vez. */
  const _charla = { leerCharla, caducar, actividad, CADUCA_MS, pintarPropuestas: (f) => pintarPropuestas(f), tarjetaArchivo: (a, id, o) => tarjetaArchivo(a, id, o), iconoDe: (a) => iconoDe(a), pintarAcciones: (f) => pintarAcciones(f) };

  function adaptadorDelPuente() {
    const p = window.puente;
    if (!p || !p.iarvisPreguntar) return null;
    return {
      preguntar: (d) => p.iarvisPreguntar(d), historial: () => p.iarvisHistorial(), valorar: (id, v) => p.iarvisValorar(id, v),
      estado: (id) => p.iarvisEstado(id), adjuntar: (n, b, t) => p.iarvisAdjuntar(n, b, t),
      /* 8-nov: el botón «hacer» (guardar la respuesta del claim) también en el escritorio. */
      hacer: p.iarvisHacer ? (a) => p.iarvisHacer(a) : undefined,
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
  /*
   * 10-nov (JC): LA MINIATURA DEL ARCHIVO en el chat, en los dos sentidos (lo que saca Iarvis y lo
   * que adjunta el usuario): la primera página del PDF o la imagen reducida si se puede; si no, el
   * icono del tipo. Con el nombre y el tamaño; al pulsarla se abre (y en la web, además, se descarga).
   *   - escritorio: la miniatura la da el proceso principal (nativeImage, como notas:miniatura);
   *   - web: se pinta aquí con los bytes (pdf.js de renderer/recortePdf.js, o un lienzo para las fotos).
   * Las miniaturas pintadas se guardan en una caché pequeña por archivo (memoria + localStorage).
   */
  const CLAVE_MINIS = 'vidaire.iarvis.miniaturas';
  const MAX_MINIS = 40;
  I.archivos = I.archivos || {};
  I.minis = I.minis || (() => { try { return JSON.parse(localStorage.getItem(CLAVE_MINIS) || '{}') || {}; } catch { return {}; } })();
  I.bytesLocales = I.bytesLocales || new Map();
  function guardarMini(clave, url) {
    if (!clave || !url) return;
    I.minis[clave] = url;
    const claves = Object.keys(I.minis);
    for (const k of claves.slice(0, Math.max(0, claves.length - MAX_MINIS))) delete I.minis[k];
    try { localStorage.setItem(CLAVE_MINIS, JSON.stringify(I.minis)); } catch { /* lleno: se queda en memoria */ }
  }
  const extDe = (n) => { const m = /\.([a-z0-9]{1,5})$/i.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
  /** El icono del tipo: PDF, XLS, DOC, IMG, EML… (y la clase que le da el color). */
  function iconoDe(a) {
    const mime = String(a.mime || a.tipoMime || (/\//.test(String(a.tipo || '')) ? a.tipo : '') || '');
    const ext = extDe(a.nombre);
    if (/pdf/.test(mime) || ext === 'pdf') return { txt: 'PDF', clase: 'pdf' };
    if (/sheet|excel|csv/.test(mime) || /^(xlsx?|xlsm|csv|ods)$/.test(ext)) return { txt: 'XLS', clase: 'xls' };
    if (/word|officedocument\.wordprocessing/.test(mime) || /^(docx?|odt|rtf)$/.test(ext)) return { txt: 'DOC', clase: 'doc' };
    if (/^image\//.test(mime) || /^(jpe?g|png|gif|webp|heic|heif|tiff?|bmp)$/.test(ext)) return { txt: 'IMG', clase: 'img' };
    if (/message|outlook/.test(mime) || /^(eml|msg)$/.test(ext)) return { txt: 'EML', clase: 'eml' };
    if (/^(dwg|dxf|ifc|rvt)$/.test(ext)) return { txt: ext.toUpperCase(), clase: 'cad' };
    if (/zip|compressed/.test(mime) || /^(zip|rar|7z)$/.test(ext)) return { txt: 'ZIP', clase: 'otro' };
    return { txt: (ext || 'ARCH').toUpperCase().slice(0, 4), clase: 'otro' };
  }
  const claveMini = (a) => String(a.ruta || (a.nombre && a.tamano ? `${a.nombre}:${a.tamano}` : '') || '');
  /** La tarjeta del archivo (un solo componente para los dos sentidos). `origen`: 'iarvis' | 'usuario'. */
  function tarjetaArchivo(a, id, origen) {
    I.archivos[id] = { ...a, origen };
    const ic = iconoDe(a);
    const mini = a.miniatura || I.minis[claveMini(a)];
    const disponible = origen === 'usuario' ? Boolean(a.ruta || I.bytesLocales.has(claveMini(a))) : Boolean(a.ruta || a.base64 || I.pdfs[id]);
    const donde = origen === 'iarvis' && a.ruta ? ' · Descargas › Vidaire Iarvis' : '';
    const titulo = disponible ? `Abrir «${a.nombre || ''}»` : 'Pídemelo otra vez para sacarlo de nuevo.';
    return `<button type="button" class="iaArchivoMini${disponible ? '' : ' iaNoDisponible'}" data-ia-archivo="${esc(id)}" title="${esc(titulo)}"${disponible ? '' : ' disabled'}>
      <span class="iaMiniVista iaMini-${ic.clase}" data-ia-vista="${esc(id)}">${mini ? `<img src="${esc(mini)}" alt="">` : `<span class="iaMiniIcono">${esc(ic.txt)}</span>`}</span>
      <span class="iaMiniNombre">${esc(a.nombre || 'Archivo')}<small>${esc(ic.txt)}${a.tamano ? ` · ${kb(a.tamano)}` : ''}${donde}</small></span></button>`;
  }
  const deBase64 = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const aDataUrl = (bytes, mime) => new Promise((ok) => {
    try { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(new Blob([bytes], { type: mime })); } catch { ok(null); }
  });
  /** La miniatura pintada aquí: la primera página del PDF o la foto reducida (JPEG pequeño en data:, que la CSP deja). */
  async function pintarMiniatura(bytes, a) {
    const ic = iconoDe(a);
    const lienzo = document.createElement('canvas');
    try {
      if (ic.clase === 'pdf') {
        if (typeof cargarPdfjsRp !== 'function') return null; // eslint-disable-line no-undef
        const lib = await cargarPdfjsRp(); // eslint-disable-line no-undef
        const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        const pagina = await doc.getPage(1);
        const v0 = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: 240 / Math.max(v0.width, v0.height) });
        lienzo.width = Math.ceil(vista.width); lienzo.height = Math.ceil(vista.height);
        await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
        try { doc.destroy(); } catch { /* nada */ }
      } else if (ic.clase === 'img') {
        const url = await aDataUrl(bytes, a.mime || 'image/jpeg');
        if (!url) return null;
        const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
        const k = 240 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        lienzo.width = Math.max(1, Math.round(img.naturalWidth * Math.min(1, k))); lienzo.height = Math.max(1, Math.round(img.naturalHeight * Math.min(1, k)));
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      } else return null;
      return lienzo.toDataURL('image/jpeg', 0.7);
    } catch { return null; }
  }
  /** Rellena las miniaturas que faltan en lo pintado (sin bloquear el chat). */
  async function rellenarMiniaturas() {
    const raiz = I.panel || I.lista;
    if (!raiz) return;
    for (const z of raiz.querySelectorAll('[data-ia-vista]')) {
      if (z.querySelector('img')) continue;
      const a = I.archivos[z.getAttribute('data-ia-vista')];
      if (!a || a.sinMini) continue;
      a.sinMini = true; // una vez por archivo y sesión
      const clave = claveMini(a);
      let url = I.minis[clave] || null;
      if (!url && a.ruta && a.origen === 'iarvis' && window.puente && window.puente.iarvisMiniatura) {
        try { url = await window.puente.iarvisMiniatura(a.ruta); } catch { url = null; }
      }
      if (!url) {
        const local = I.bytesLocales.get(clave);
        const pdf = I.pdfs[z.getAttribute('data-ia-vista')];
        const bytes = local ? local.bytes : (a.base64 || (pdf && pdf.base64)) ? deBase64(a.base64 || pdf.base64) : null;
        if (bytes) url = await pintarMiniatura(bytes, a);
      }
      if (!url) continue;
      guardarMini(clave, url);
      for (const v of raiz.querySelectorAll(`[data-ia-vista="${CSS && CSS.escape ? CSS.escape(z.getAttribute('data-ia-vista')) : z.getAttribute('data-ia-vista')}"]`)) {
        v.innerHTML = `<img src="${esc(url)}" alt="">`;
      }
    }
  }
  /** En la web: abrir en otra pestaña y, además, descargarlo (JC: «se abre y se descarga»). */
  function abrirYBajar(bytes, nombre, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    if (/pdf|^image\//.test(String(mime || ''))) window.open(url, '_blank');
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre || 'archivo';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const avisar = (t) => { if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar(t); };
  async function abrirArchivo(id) {
    const a = I.archivos[id];
    if (!a) return;
    const mime = a.mime || (/\//.test(String(a.tipo || '')) ? a.tipo : '') || 'application/octet-stream';
    if (a.origen === 'iarvis') {
      if (a.ruta && window.puente && window.puente.iarvisAbrirPdf) {
        const r = await window.puente.iarvisAbrirPdf(a.ruta, false);
        if (r && !r.ok) avisar(r.error || 'No se ha podido abrir.');
        return;
      }
      const b = a.base64 || (I.pdfs[id] && I.pdfs[id].base64);
      if (b) abrirYBajar(deBase64(b), a.nombre, mime || 'application/pdf');
      return;
    }
    /* Lo que adjuntó el usuario: se baja de SU carpeta de la nube (el escritorio lo abre; la web lo abre y lo descarga);
       sin conexión, con los bytes de esta vez si están. */
    const local = I.bytesLocales.get(claveMini(a));
    if (!window.puente || !window.puente.iarvisAbrirAdjunto) { if (local) abrirYBajar(local.bytes, a.nombre, local.mime || mime); return; }
    const r = await window.puente.iarvisAbrirAdjunto({ ruta: a.ruta, nombre: a.nombre, tipo: mime });
    if (r && r.ok && r.base64) abrirYBajar(deBase64(r.base64), a.nombre, r.mime || mime);
    else if (r && !r.ok) { if (local) abrirYBajar(local.bytes, a.nombre, local.mime || mime); else avisar(r.error || 'No se ha podido abrir.'); }
  }
  /** Las miniaturas de lo adjuntado (en la pregunta y en la caja antes de mandar). */
  function tarjetasAdjuntos(lista, prefijo) {
    return (lista || []).map((a, i) => tarjetaArchivo({ ...a, mime: a.mime || (/\//.test(String(a.tipoMime || '')) ? a.tipoMime : '') }, `${prefijo}:${i}`, 'usuario')).join('');
  }

  /** Lo que Iarvis ha hecho con la app: el PDF, ir a una pantalla, proponer o aplicar. */
  function pintarAcciones(f) {
    const acc = Array.isArray(f.acciones) ? f.acciones : [];
    if (!acc.length) return '';
    const pdfs = acc.filter((a) => a.tipo === 'pdf').map((a, i) => {
      const id = `${f.id}:${i}`;
      if (a.base64) I.pdfs[id] = a;
      const guardado = I.pdfs[id];
      return tarjetaArchivo(guardado && !a.base64 ? { ...a, base64: guardado.base64 } : a, id, 'iarvis');
    }).join('');
    const botones = acc.filter((a) => a.tipo !== 'pdf').map((a) => {
      const datos = esc(JSON.stringify(a));
      const prin = a.tipo === 'proponer' || a.tipo === 'aplicar' || (a.tipo === 'hacer' && a.hacer !== 'rechazar');
      return `<button class="${prin ? 'iaBotonPrin' : 'iaBotonSec'}" data-ia-accion="${datos}">${esc(a.texto || 'Abrir')}</button>`;
    }).join('');
    return `${pdfs ? `<div class="iaArchivos">${pdfs}</div>` : ''}${botones ? `<div class="iaAcciones">${botones}</div>` : ''}`;
  }

  /*
   * 9-nov (JC): mientras contesta, la brújula de Iarvis latiendo y un verbo que rota cada
   * ~1,7 s en el idioma de la app (shared/ia/verbosEspera.js); si está haciendo algo concreto
   * («Leyendo la placa…», «Buscando la UTA-01…»), dice eso. Con prefers-reduced-motion no se
   * mueve (iarvis.css): solo el verbo.
   */
  const idiomaApp = () => { try { return (I.contexto && (I.contexto() || {}).idioma) || document.documentElement.lang || 'es'; } catch { return 'es'; } };
  function verboDe(f, n = 0) {
    const E = window.IARVIS_ESPERA;
    if (!E) return 'Pensando…';
    const fijo = E.haciendo(idiomaApp(), f && f.haciendo);
    if (fijo) return fijo;
    const l = E.verbos(idiomaApp());
    return l[n % l.length];
  }
  function pintarPensando(f) {
    const brujula = (window.ARRANQUE_LOGO && window.ARRANQUE_LOGO.BRUJULA) || '<span aria-hidden="true">🧭</span>';
    return `<div class="iaRespuesta iaEspera iaPensando" role="status" aria-live="polite"><span class="iaBrujulaViva" aria-hidden="true">${brujula}</span><span class="iaVerbo" data-ia-verbo="${f && f.haciendo ? 'fijo' : 'rota'}">${esc(verboDe(f, 0))}</span></div>`;
  }
  let vueltaVerbo = 0;
  /* Sin temporizador (el banco de carga de pantallaCarga.test.js), el verbo se queda quieto. */
  if (typeof setInterval === 'function') setInterval(() => {
    const vivos = document.querySelectorAll('.iaVerbo[data-ia-verbo="rota"]');
    if (!vivos.length) return;
    vueltaVerbo += 1;
    for (const v of vivos) v.textContent = verboDe(null, vueltaVerbo);
  }, (window.IARVIS_ESPERA && window.IARVIS_ESPERA.CADA) || 1700);

  function pintarRespuesta(f) {
    if (!f.respuesta) return pintarPensando(f);
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
    /* 9-nov: si la respuesta ya hace algo con las fotos (la tarjeta de la ficha), sin nota aparte. */
    if (!A || !adj.length || f.fotosEnTarjeta) return '';
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
    const adj = (f.adjuntos || []).length ? `<div class="iaAdjuntos iaArchivos">${tarjetasAdjuntos(f.adjuntos, `adj:${f.id || I.filas.indexOf(f)}`)}</div>` : '';
    return `<div class="iaPregunta">${esc(f.pregunta)}${adj}</div>${pintarRespuesta(f)}`;
  }

  function pintar() {
    if (!I.lista) return;
    /* 8-nov (JC): solo la conversación de esta vez; lo de otras veces no se enseña (sigue en la nube). */
    const ahora = I.filas.filter((f) => I.deEstaVez.has(f) || (f.id && I.idsEstaVez.has(f.id)));
    const bienvenida = ahora.length ? '' : `<div class="iaBienvenida"><h3>${saludo()}</h3><p>Pídeme lo que necesites de la obra: lo busco en la app y te lo doy. También te explico cómo se hace cualquier cosa.</p><div class="iaSugerencias">${sugerencias()}</div></div>`;
    I.lista.innerHTML = `${bienvenida}${[...ahora].reverse().map(pintarFila).join('')}`;
    I.lista.scrollTop = I.lista.scrollHeight;
    rellenarMiniaturas();
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
    caducar();
    actividad();
    const botonMandar = I.panel.querySelector('.iaMandar');
    botonMandar.disabled = true;
    const adjuntos = I.ficheros.slice();
    I.ficheros = [];
    pintarFicheros();
    caja.value = '';
    const nFotos = adjuntos.filter((a) => /^image\//.test(String(a.tipo || a.mime || '')) || /\.(jpe?g|png|heic|heif|webp)$/i.test(String(a.nombre || ''))).length;
    const provisional = { id: null, pregunta, adjuntos, estado: 'respondiendo', respuesta: null, haciendo: window.IARVIS_ESPERA ? window.IARVIS_ESPERA.adivinar(pregunta, { fotos: nFotos }) : null };
    I.filas = [provisional, ...I.filas];
    I.deEstaVez.add(provisional);
    pintar();
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    let r;
    try {
      r = await I.adaptador.preguntar({ pregunta, pantalla: ctx.pantalla, obraId: ctx.obraId, obraNombre: ctx.obraNombre, mirando: ctx.mirando, idioma: ctx.idioma, adjuntos });
    } catch { r = { estado: 'fallo', respuesta: 'Iarvis no ha podido contestar ahora. Vuelve a preguntármelo.' }; }
    Object.assign(provisional, r || {});
    if (provisional.id) I.idsEstaVez.add(provisional.id);
    actividad();
    pintar();
    I.ocupado = false;
    botonMandar.disabled = false;
    /* Un solo equipo que abrir: se abre ya (8-nov, Iarvis que actúa). */
    if (provisional.abrirYa && provisional.abrirYa.tipo === 'ir') accion(provisional.abrirYa);
    if (provisional.id && provisional.estado === 'pendiente' && !provisional.enCola) sondear(provisional.id);
  }

  function pintarFicheros() {
    const z = I.panel && I.panel.querySelector('.iaFicheros');
    if (!z) return;
    z.innerHTML = I.ficheros.length ? `<div class="iaArchivos">${tarjetasAdjuntos(I.ficheros, 'caja')}</div>` : '';
    rellenarMiniaturas();
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
      if (r && r.ok) {
        /* 10-nov: los bytes de esta vez se quedan en memoria para la miniatura (y para abrirlo sin red). */
        const mime = r.adjunto.tipo || t.mime || archivo.type || '';
        I.bytesLocales.set(claveMini(r.adjunto), { bytes, mime });
        I.ficheros.push({ ...r.adjunto, mime, tipo: t.tipo });
      }
      else if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar((r && r.aviso) || 'No se ha podido subir.');
      else if (z) z.textContent = (r && r.aviso) || 'No se ha podido subir.';
    }
    pintarFicheros();
  }

  function blobDe(a) {
    const bin = atob(a.base64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: a.mime || 'application/pdf' }));
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
      /* 8-nov: «Abrir el estudio» del claim (electron/data/iarvisClaim.js). */
      if (a.destino === 'reclamaciones' && window.PANTALLA_RECLAMACIONES && window.PANTALLA_RECLAMACIONES.estado) {
        const E = window.PANTALLA_RECLAMACIONES.estado;
        if (a.vista) E.vista = String(a.vista);
        if (a.recId) { E.recId = String(a.recId); if (a.obraId) E.obraId = String(a.obraId); }
      }
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
      actividad();
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
      actividad();
      I.ocupado = false;
      pintar();
    }
  }

  function construirPanel() {
    const p = document.createElement('aside');
    p.className = `iaPanel${I.movil ? ' iaMovil' : ''}`;
    p.setAttribute('aria-label', 'Iarvis');
    p.innerHTML = `
      ${I.movil
    /* 8-nov (JC): en el móvil, SOLO el chat: una cabecera mínima con «‹» para volver y «Iarvis». */
    ? '<div class="iaCabecera"><button class="iaVolver" title="Volver" aria-label="Volver">‹</button><h2>Iarvis</h2></div>'
    : '<div class="iaCabecera"><span class="iaMarca" aria-hidden="true">I</span><div class="iaTitulo"><h2>Iarvis</h2><span class="iaAviso">Usa la app por ti · solo lo que tu puesto ve</span></div><button class="iaFlotar" title="Soltar como ventana (o anclar a la columna)" aria-label="Soltar o anclar">⧉</button><button class="iaNueva" title="Empezar de cero" aria-label="Conversación nueva">＋</button><button class="iaCerrar" title="Cerrar (Esc)" aria-label="Cerrar">×</button></div>'}
      <div class="iaLista" role="log" aria-live="polite"></div>
      <div class="iaEntrada">
        <div class="iaFicheros"></div>
        <div class="iaFila">
          <button class="iaClip" title="Adjuntar un archivo" aria-label="Adjuntar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.2 4.2l-8 8a1.5 1.5 0 0 1-2.1-2.1l7.3-7.3"/></svg></button>
          ${I.movil ? '<button class="iaCamara" title="Foto con la cámara" aria-label="Cámara"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg></button>' : ''}
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
    /* 10-nov (JC): adjuntar también arrastrando al panel o pegando (Cmd+V) un archivo. */
    const conArchivos = (e) => Boolean(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
    p.addEventListener('dragover', (e) => { if (!conArchivos(e)) return; e.preventDefault(); p.classList.add('iaSoltar'); });
    p.addEventListener('dragleave', (e) => { if (!p.contains(e.relatedTarget)) p.classList.remove('iaSoltar'); });
    p.addEventListener('drop', (e) => {
      p.classList.remove('iaSoltar');
      if (!conArchivos(e)) return;
      e.preventDefault();
      const lista = [...(e.dataTransfer.files || [])];
      if (lista.length && I.adaptador) adjuntar(lista);
    });
    p.querySelector('textarea').addEventListener('paste', (e) => {
      const lista = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (!lista.length || !I.adaptador) return;
      e.preventDefault();
      adjuntar(lista);
    });
    const cerrarB = p.querySelector('.iaCerrar');
    if (cerrarB) cerrarB.addEventListener('click', cerrar);
    p.addEventListener('click', async (e) => {
      const sug = e.target.closest('[data-ia-sugerencia]');
      if (sug) { mandar(sug.getAttribute('data-ia-sugerencia')); return; }
      if (e.target.closest('.iaVolver')) { if (I.volver) I.volver(); else if (history.length > 1) history.back(); return; }
      if (e.target.closest('.iaNueva')) { I.deEstaVez = new Set(); I.idsEstaVez = new Set(); I.ultima = 0; try { localStorage.removeItem(CHARLA); } catch { /* nada */ } pintar(); return; }
      const arch = e.target.closest('[data-ia-archivo]');
      if (arch) { abrirArchivo(arch.getAttribute('data-ia-archivo')); return; }
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
    engancharArrastre(p);
    return p;
  }

  /* 10-nov (JC): Iarvis como ventana que se arrastra: encima de la tabla, junto a la ficha lateral del hecho, o fuera de en medio.
     Anclada = la columna de siempre (empuja el contenido); suelta = ventana fija arrastrable y redimensionable que no empuja nada. */
  const CLAVE_POS = 'vidaire.iarvis.ventana';
  function leerPos() { try { return JSON.parse(localStorage.getItem(CLAVE_POS) || 'null'); } catch { return null; } }
  function guardarPos(o) { try { localStorage.setItem(CLAVE_POS, JSON.stringify(o)); } catch { /* sin almacenamiento */ } }
  function encajar(p, x, y, w, h) {
    const W = window.innerWidth, H = window.innerHeight;
    w = Math.max(300, Math.min(w, W - 16)); h = Math.max(280, Math.min(h, H - 16));
    x = Math.max(8, Math.min(x, W - w - 8)); y = Math.max(8, Math.min(y, H - 80));
    Object.assign(p.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, right: 'auto', bottom: 'auto' });
    return { x, y, w, h };
  }
  function soltar(r) {
    const p = I.panel; if (!p || I.movil) return;
    const rect = r || p.getBoundingClientRect();
    p.classList.add('iaFlota');
    document.body.classList.remove('iaAbierto');
    const pos = encajar(p, rect.left - (r ? 0 : 24), r ? rect.top : Math.max(8, rect.top + 24), Math.min(rect.width, 420), Math.min(rect.height, window.innerHeight - 80));
    guardarPos({ flota: true, ...pos });
  }
  function anclar() {
    const p = I.panel; if (!p || I.movil) return;
    p.classList.remove('iaFlota');
    ['left', 'top', 'width', 'height', 'right', 'bottom'].forEach((k) => { p.style[k] = ''; });
    if (!p.hidden) document.body.classList.add('iaAbierto');
    guardarPos({ flota: false });
  }
  function engancharArrastre(p) {
    const cab = p.querySelector('.iaCabecera'); if (!cab || I.movil) return;
    const flot = p.querySelector('.iaFlotar');
    if (flot) flot.addEventListener('click', () => (p.classList.contains('iaFlota') ? anclar() : soltar()));
    let a = null;
    cab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      if (window.innerWidth < 900) return;
      if (!p.classList.contains('iaFlota')) soltar(p.getBoundingClientRect());
      const r = p.getBoundingClientRect();
      a = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { cab.setPointerCapture(e.pointerId); } catch { /* */ }
      e.preventDefault();
    });
    cab.addEventListener('pointermove', (e) => {
      if (!a) return;
      const r = p.getBoundingClientRect();
      encajar(p, e.clientX - a.dx, e.clientY - a.dy, r.width, r.height);
    });
    const fin = () => { if (!a) return; a = null; const r = p.getBoundingClientRect(); guardarPos({ flota: true, x: r.left, y: r.top, w: r.width, h: r.height }); };
    cab.addEventListener('pointerup', fin); cab.addEventListener('pointercancel', fin);
    /* El tamaño que le dé con la esquina también se recuerda. */
    if (window.ResizeObserver) new ResizeObserver(() => { if (a || !p.classList.contains('iaFlota') || p.hidden) return; const r = p.getBoundingClientRect(); guardarPos({ flota: true, x: r.left, y: r.top, w: r.width, h: r.height }); }).observe(p);
  }

  function abrir() {
    if (!I.panel) return;
    I.panel.hidden = false;
    /* 9-nov (JC): el panel empuja el contenido en vez de tapar lo que hay debajo (iarvis.css › body.iaAbierto). */
    const g = !I.movil && window.innerWidth >= 900 ? leerPos() : null;
    if (g && g.flota) { I.panel.classList.add('iaFlota'); encajar(I.panel, g.x, g.y, g.w, g.h); }
    else if (!I.movil) document.body.classList.add('iaAbierto');
    /* 8-nov: el botón vive en la cabecera y no se esconde; solo se le quita el punto. */
    if (I.boton) { I.boton.classList.remove('conPunto'); I.boton.setAttribute('aria-expanded', 'true'); }
    caducar();
    /* 8-nov: el saludo sale ya; el historial de la nube puede tardar y el panel se quedaba en blanco. */
    pintar();
    cargarHistorial();
    const t = I.panel.querySelector('textarea');
    if (t) t.focus();
  }
  function cerrar() {
    if (I.movil || !I.panel) return;
    I.panel.hidden = true;
    document.body.classList.remove('iaAbierto');
    if (I.boton) I.boton.setAttribute('aria-expanded', 'false');
  }

  /** Escritorio y web: botón en la cabecera (flotante si no hay cabecera) + panel. */
  function instalar({ adaptador, ir, contexto } = {}) {
    I.adaptador = adaptador || adaptadorDelPuente();
    if (!I.adaptador || I.boton) return;
    I.ir = ir || null;
    I.contexto = contexto || (() => ({}));
    /*
     * 8-nov (JC): ya no es la píldora flotante «Iarvis» de abajo a la derecha:
     * un botón pequeño y redondo con su brújula (shared/arranqueLogo.js › BRUJULA,
     * la misma del móvil, renderer/movil/carcasa.js › botonIarvis) en la cabecera,
     * junto al selector de rol. Pulsarlo abre o cierra el chat.
     */
    I.boton = document.createElement('button');
    I.boton.id = 'iarvisBoton';
    I.boton.type = 'button';
    I.boton.title = 'Hablar con Iarvis';
    I.boton.setAttribute('aria-label', 'Hablar con Iarvis');
    I.boton.setAttribute('aria-expanded', 'false');
    I.boton.innerHTML = `${(window.ARRANQUE_LOGO && window.ARRANQUE_LOGO.BRUJULA) || '<span aria-hidden="true">🧭</span>'}<span class="iaPunto"></span>`;
    I.boton.addEventListener('click', () => (I.panel && !I.panel.hidden ? cerrar() : abrir()));
    I.panel = construirPanel();
    I.panel.hidden = true;
    const cab = document.querySelector('.cabecera .derecha');
    if (cab) { I.boton.classList.add('enCabecera'); cab.prepend(I.boton); document.body.append(I.panel); } else {
      document.body.append(I.boton, I.panel);
      document.body.classList.add('conIarvis');
    }
  }

  /** Móvil: el panel dentro de su pestaña. */
  function montarEn(elemento, { adaptador, ir, contexto, volver } = {}) {
    I.movil = true;
    I.adaptador = adaptador;
    I.ir = ir || null;
    I.volver = volver || null;
    I.contexto = contexto || (() => ({}));
    if (!I.panel) I.panel = construirPanel();
    elemento.replaceChildren(I.panel);
    I.panel.hidden = false;
    caducar();
    pintar();
    cargarHistorial();
  }

  window.IARVIS = { instalar, montarEn, abrir, cerrar, estado: I, _charla };
})();
