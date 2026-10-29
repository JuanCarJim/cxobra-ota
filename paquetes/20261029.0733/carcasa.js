'use strict';
/*
 * LA CARCASA DE CX OBRA: la barra de pestañas de abajo, las secciones de cada
 * pestaña arriba, la obra elegida y la pantalla de la cuenta.
 *
 *   · ABAJO, la barra flotante de Finanzas Pro: Inicio · Commissioning
 *     · [ + ] · Incidencias · Más. El «+» no es una pestaña: abre la hoja de
 *     Añadir (Nueva NCR, Nota rápida, Escanear albarán, Medir equipo, Prueba
 *     de estanqueidad, Parte, según el rol). Una pestaña sin ninguna sección
 *     para el rol no sale.
 *   · INICIO es la primera pantalla al entrar: la obra, cómo va el
 *     commissioning y lo que espera (partes, NCR, pruebas), con atajos.
 *   · ARRIBA, si la pestaña tiene más de una sección, un selector segmentado:
 *     Incidencias = Partes | NCR | Reparaciones; Más = Notas (el bloc) |
 *     Albaranes | Inventario | Personal | Cuenta.
 *   · LA OBRA se elige una vez en la cabecera y vale para todas las secciones
 *     (se guarda en el teléfono). Al cambiarla se avisa con «movil:obra».
 *
 * Además deja en `window.CX` lo que comparten las secciones nuevas: pedir al
 * ordenador, avisos, fotos y la obra elegida.
 */
(function carcasa() {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  /* Icono de pestaña en sus dos formas, como en Finanzas Pro: de contorno
     cuando está apagada y relleno cuando está activa. Lo de dentro del
     relleno se dibuja con el color de la barra para que se lea. */
  const HUECO = 'style="stroke:var(--barra-solida)"';
  const icono = (off, on) => svg(`<g class="off">${off}</g><g class="on">${on}</g>`);

  /* Cuatro pestañas, dos a cada lado del botón de añadir: [0][1] [ + ] [2][3]. */
  const PESTANAS = [
    { id: 'inicio', nombre: 'Inicio',
      icono: icono('<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
        '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" fill="currentColor"/>'),
      /* 24-oct: «Mis tareas», las órdenes de mantenimiento de quien lleva el teléfono. */
      secciones: [['inicio', 'Inicio'], ['misTareas', 'Mis tareas']] },
    { id: 'commissioning', nombre: 'Commissioning',
      icono: icono('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/><path d="M4 19h16"/>',
        `<path d="M4 15a8 8 0 1 1 16 0z" fill="currentColor"/><path d="M12 15l4.5-4.5" ${HUECO}/><path d="M4 19h16"/>`),
      /* Sin subbarra (JC, 22-oct): Estanqueidad se abre desde Inicio y desde el «+», no como pestaña. */
      secciones: [['commissioning', 'Equipos'], ['estanqueidad', 'Estanqueidad', true]] },
    { id: 'incidencias', nombre: 'Incidencias',
      icono: icono('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
        `<path d="M12 3.5 2.8 19.5h18.4z" fill="currentColor"/><path d="M12 10v4" ${HUECO} stroke-width="2.2"/><path d="M12 16.9v.1" ${HUECO} stroke-width="2.4"/>`),
      /* 26-oct: «Reclamables», los avisos del tajo que pueden reclamarse (avisosReclamables.js). */
      secciones: [['partes', 'Partes'], ['avisos', 'Reclamables'], ['ncr', 'NCR'], ['reparaciones', 'Reparaciones']] },
    /* El avance de obra sobre planos (16-oct): el encargado marca lo hecho. */
    { id: 'avance', nombre: 'Avance',
      icono: icono('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 15.5l3.5-4 3 2.5L17 8.5"/>',
        `<rect x="3.5" y="4" width="17" height="16" rx="2" fill="currentColor"/><path d="M7 15.5l3.5-4 3 2.5L17 8.5" ${HUECO} stroke-width="2"/>`),
      secciones: [['avance', 'Avance']] },
    /* El Bloc vive en «Más», el primero; las compras, detrás. */
    { id: 'mas', nombre: 'Más',
      icono: icono('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
        '<g fill="currentColor"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></g>'),
      secciones: [['qhse', 'QHSE'], ['plano', 'Plano de equipos'], ['bloc', 'Notas'], ['albaranes', 'Albaranes'], ['inventario', 'Inventario'], ['personal', 'Personal'], ['cuenta', 'Cuenta']] },
    /* 29-oct (JC): «QHSE es una cosa aparte, no es una incidencia»: sección propia (como «Seguridad» en la web), la primera de «Más». */
  ];
  const MAS = svg('<path d="M12 5v14M5 12h14" stroke-width="2.6"/>');

  /*
   * LO QUE OFRECE EL «+»: atajos a lo que más se hace en obra. Cada uno lleva
   * a su sección y pulsa allí su botón de «nuevo» (en cuanto aparece), así que
   * el permiso lo sigue decidiendo la sección y el ordenador. Solo salen los
   * de las secciones del rol; los que van a una obra dicen cuál.
   */
  /* Lo de commissioning, lo primero: es lo que más se hace en obra (18-oct). */
  const ACCIONES = [
    { seccion: 'commissioning', nombre: 'Medir equipo', ayuda: 'Busca el equipo y mide boca a boca', obra: true, pasos: ['[data-cx-buscar]'],
      icono: svg('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/><path d="M4 19h16"/>') },
    { seccion: 'estanqueidad', nombre: 'Prueba de estanqueidad', ayuda: 'Con la foto del manómetro', obra: true, pasos: ['[data-pe="nuevo"]'],
      icono: svg('<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/>') },
    { seccion: 'ncr', nombre: 'Nueva NCR', ayuda: 'No conformidad con foto', obra: true, pasos: ['[data-ncr="nueva"]'],
      icono: svg('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>') },
    { seccion: 'reparaciones', nombre: 'Reparación', ayuda: 'Un equipo que hay que reparar', obra: true, pasos: ['[data-rp="nueva"]'],
      icono: svg('<path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6L4.5 16.5a1.4 1.4 0 0 0 2 2l5.4-5.4a3.5 3.5 0 0 0 4.6-4.6l-2.2 2.2-2-.4-.4-2z"/>') },
    { seccion: 'avance', nombre: 'Marcar avance', ayuda: 'Lo hecho hoy, sobre el plano', obra: true, pasos: ['[data-av="plano"]'],
      icono: svg('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 15.5l3.5-4 3 2.5L17 8.5"/>') },
    { seccion: 'bloc', nombre: 'Nota rápida', ayuda: 'Con foto, en tu bloc', obra: false, pasos: ['[data-bl="nueva"]', '[data-bl="camara"]'],
      icono: svg('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>') },
    { seccion: 'albaranes', nombre: 'Escanear albarán', ayuda: 'Foto del albarán; casa con su pedido', obra: false, pasos: ['[data-accion="foto"]'],
      icono: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9h8M8 12h8M8 15h5"/>') },
    { seccion: 'partes', nombre: 'Parte', ayuda: 'Parte de incidencia al jefe de obra', obra: true, pasos: ['[data-pi="nuevo"]'],
      icono: svg('<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z"/><path d="M14 3.5v5h5"/><path d="M12 11v4M12 17.5v.1"/>') },
    /* 26-oct: esperas, accesos denegados, falta de medios… (avisosReclamables.js). */
    { seccion: 'avisos', nombre: 'Algo reclamable', ayuda: 'Esperas, accesos denegados, sin grúa…', obra: true, pasos: ['[data-at="nuevo"]'],
      icono: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') },
    /* 28-oct: la inspección del sitio de cada semana (qhse.js). */
    { seccion: 'qhse', nombre: 'Inspección del sitio', ayuda: 'QHSE: la de esta semana, control de subcontratas, CAE', obra: true, pasos: ['[data-qh="nuevo"][data-p="inspeccionObra"]'],
      icono: svg('<path d="M9 4.5h6M9 4.5A1.5 1.5 0 0 0 7.5 6H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 18 6h-1.5A1.5 1.5 0 0 0 15 4.5"/><path d="M8.5 13l2.5 2.5 4.5-5"/>') },
  ];

  /* El título de cada sección, arriba: corto, que en el iPhone quepa junto a la pastilla (18-oct). */
  const TITULO = {
    inicio: 'Inicio', commissioning: 'Commissioning', partes: 'Partes', ncr: 'No conformidades', reparaciones: 'Reparaciones', avance: 'Avance de obra', albaranes: 'Albaranes',
    inventario: 'Inventario', bloc: 'Notas', personal: 'Personal', estanqueidad: 'Estanqueidad', cuenta: 'Cuenta',
    misTareas: 'Mis tareas', avisos: 'Reclamables', qhse: 'QHSE', plano: 'Plano de equipos',
  };
  /* Las que no dependen de la obra elegida no enseñan el selector. */
  const SIN_OBRA = new Set(['cuenta', 'albaranes']);

  const sesion = () => (window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion()) || null;
  const permitidas = () => { const s = sesion(); return s ? ['inicio', ...(s.secciones || []), 'cuenta'] : []; };
  const seccion = () => location.hash.slice(1);
  const pestanaDe = (s) => PESTANAS.find((p) => p.secciones.some(([id]) => id === s)) || null;

  /* ═══════════════════════════════════ Pedir al ordenador */

  async function pedir(ruta, opciones = {}) {
    const r = await fetch(ruta, { cache: 'no-store', ...opciones });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { throw new Error(t || `Error ${r.status}`); }
    if (r.status >= 400 && j && j.error && !j.pideConfirmar) throw new Error(j.error);
    return j;
  }
  const postJson = (ruta, cuerpo) => pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

  function aviso(texto, nivel = 'mal') {
    const d = document.createElement('div');
    d.className = `toast ${nivel}`;
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  /** Sube una foto (sin leerla) y devuelve su id de espera. */
  async function subirFoto(archivo) {
    const r = await pedir('api/foto?leer=0', { method: 'POST', headers: { 'Content-Type': archivo.type || 'image/jpeg' }, body: archivo });
    if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido subir la foto.');
    return r.fotoId;
  }

  /* Sacar un fichero: la hoja de compartir del teléfono (correo, AirDrop,
     Archivos); si no hay, se descarga. Va en el toque de un botón: iOS no
     abre la hoja si antes se ha esperado a la red. */
  async function sacarFichero(f, nombre) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: nombre }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* LA VISTA PREVIA del PDF, dentro de la app y a pantalla completa: se lee
     antes de mandarlo. «Compartir» abre la hoja del teléfono; «Cerrar» vuelve. */
  function vistaPdf(f, nombre) {
    const url = URL.createObjectURL(f);
    const capa = document.createElement('div');
    capa.className = 'vista-pdf';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-label', `Vista previa: ${nombre}`);
    capa.innerHTML = `
      <div class="vista-pdf-barra">
        <button type="button" class="boton secundario pequeno" data-vp="cerrar">Cerrar</button>
        <span class="vista-pdf-nombre">${esc(nombre)}</span>
        <button type="button" class="boton pequeno" data-vp="compartir">Compartir</button>
      </div>
      <iframe class="vista-pdf-hoja" title="${esc(nombre)}" src="${url}#view=FitH"></iframe>`;
    const cerrar = () => { capa.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    capa.querySelector('[data-vp="cerrar"]').onclick = cerrar;
    capa.querySelector('[data-vp="compartir"]').onclick = () => sacarFichero(f, nombre);
    document.body.append(capa);
    return capa;
  }

  /* El PDF: primero la vista previa en la app; desde ella, a compartir. */
  async function compartirPdf(ruta, nombre, boton) {
    if (boton) boton.disabled = true;
    try {
      const r = await fetch(ruta, { cache: 'no-store' });
      if (!r.ok || !String(r.headers.get('content-type') || '').includes('pdf')) {
        let msg = `Error ${r.status}`;
        try { msg = (await r.json()).error || msg; } catch { /* no era JSON */ }
        throw new Error(msg);
      }
      const f = new File([await r.blob()], nombre.replace(/[\\/:*?"<>|]+/g, '_'), { type: 'application/pdf' });
      vistaPdf(f, nombre);
    } catch (e) { aviso(e.message); } finally { if (boton) boton.disabled = false; }
  }

  /** Abre la cámara (o la galería) y devuelve el archivo elegido. */
  function elegirFoto(camara = true) {
    return new Promise((resolver) => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = 'image/*';
      if (camara) i.setAttribute('capture', 'environment');
      i.hidden = true;
      i.onchange = () => { resolver((i.files && i.files[0]) || null); i.remove(); };
      document.body.appendChild(i);
      i.click();
    });
  }

  /* Las imágenes de `api/…` piden la sesión: se traen con fetch (que la pone)
     y se enseñan desde la memoria. Se marcan con data-src. */
  function cargarImagenes(raiz) {
    for (const img of raiz.querySelectorAll('img[data-src]')) {
      const url = img.dataset.src;
      img.removeAttribute('data-src');
      /* Miniatura: mientras llega se ve el hueco (cargando) y, si no llega, «sin foto» en vez de nada. */
      img.classList.add('cargando');
      const fallo = () => { img.classList.remove('cargando'); img.classList.add('sin-foto'); img.alt = img.alt || 'Foto no disponible'; };
      fetch(url).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { img.src = URL.createObjectURL(b); img.classList.remove('cargando'); } else fallo(); }).catch(fallo);
    }
  }

  /* Un sello con hora (creadoEn, en UTC) se enseña con el día LOCAL: a la 01:20 del 15 ya es 15. */
  const fechaEs = (d) => {
    if (!d) return '';
    let t = String(d);
    if (/^\d{4}-\d{2}-\d{2}T/.test(t) && Number.isFinite(Date.parse(t))) { const x = new Date(t); t = new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString(); }
    return t.slice(0, 10).split('-').reverse().join('/');
  };
  const cifra = (v, dec = 0) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—'
    : Number(v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

  /* ═══════════════════════════════════ La obra elegida */

  let obras = [];
  let obraId = null;
  try { obraId = localStorage.getItem('movil.obra'); } catch { /* sin almacenamiento */ }
  /* Las secciones de antes guardaban cada una la suya: ahora es la misma. */
  const CLAVES_VIEJAS = ['partes.obra', 'personal.obra', 'estanqueidad.obra'];
  if (!obraId) { try { obraId = CLAVES_VIEJAS.map((k) => localStorage.getItem(k)).find(Boolean) || null; } catch { /* sin almacenamiento */ } }

  function ponerObra(id, avisar = true) {
    obraId = id || null;
    try {
      if (obraId) { localStorage.setItem('movil.obra', obraId); for (const k of CLAVES_VIEJAS) localStorage.setItem(k, obraId); }
    } catch { /* sin almacenamiento */ }
    const sel = document.getElementById('obra-movil');
    if (sel && sel.value !== obraId) sel.value = obraId || '';
    if (avisar) window.dispatchEvent(new CustomEvent('movil:obra', { detail: obraId }));
  }

  const obrasListas = (async () => {
    if (!sesion() || !(sesion().secciones || []).length) return [];
    try {
      const r = await pedir('api/obras');
      obras = (r && r.obras) || [];
    } catch { obras = []; }
    if (!obras.some((o) => o.id === obraId)) obraId = obras[0] ? obras[0].id : null;
    const sel = document.getElementById('obra-movil');
    if (sel) {
      sel.innerHTML = obras.length ? obras.map((o) => `<option value="${esc(o.id)}">${esc(o.codigo)} · ${esc(o.nombre)}</option>`).join('') : '<option value="">Sin obras</option>';
      sel.disabled = obras.length < 2;
    }
    ponerObra(obraId, false);
    pintar();
    return obras;
  })();

  /* ═══════════════════════════════════ Listas sin scroll infinito
     Una lista larga se agrupa (planta, estado, sistema…) con la cabecera
     plegada y su contador; dentro de cada grupo salen POR_GRUPO filas y un
     «Ver más» con tope. Si solo hay un grupo, o se está buscando, se abre. */
  const POR_GRUPO = 20;
  const listas = new Map(); /* clave → { abiertos, cuantos, repintar } */
  function estadoLista(clave) {
    if (!listas.has(clave)) listas.set(clave, { abiertos: new Map(), cuantos: new Map(), repintar: null });
    return listas.get(clave);
  }
  /**
   * @param clave  nombre de la lista (guarda qué grupos están abiertos)
   * @param filas  las filas ya filtradas
   * @param o.grupo(f) → título del grupo ('' = sin agrupar)
   * @param o.fila(f) → html de la fila
   * @param o.envolver(html) → contenedor de las filas (por defecto <ul class="lista-ios">)
   * @param o.buscando  si hay texto en el buscador (abre los grupos)
   * @param o.repintar  la función que vuelve a pintar la pantalla
   * @param o.orden    orden de los grupos (array de títulos); los demás, detrás
   * @param o.subgrupo(f) → subencabezado dentro del grupo (opcional); o.subOrden(a,b) ordena los subgrupos;
   *        o.subCabecera(filas, titulo) → html del subencabezado
   * @param o.cabecera(filas, titulo) → html de dentro del <summary> (por defecto título + contador)
   */
  function listaAgrupada(clave, filas, o) {
    const st = estadoLista(clave);
    st.repintar = o.repintar;
    const envolver = o.envolver || ((h) => `<ul class="lista-ios">${h}</ul>`);
    const grupos = new Map();
    for (const f of filas) {
      const g = (o.grupo ? o.grupo(f) : '') || '';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(f);
    }
    const orden = [...grupos.keys()];
    if (o.orden) orden.sort((a, b) => ((i) => (i < 0 ? 1e6 : i))(o.orden.indexOf(a)) - ((i) => (i < 0 ? 1e6 : i))(o.orden.indexOf(b)));
    const solo = orden.length === 1;
    /* Sin agrupar: las primeras y un «Ver más». */
    if (!o.grupo) {
      const tope = st.cuantos.get('') || POR_GRUPO;
      const mas = filas.length - tope;
      return envolver(filas.slice(0, tope).map(o.fila).join(''))
        + (mas > 0 ? `<button class="ver-mas" data-lista-mas="${esc(clave)}" data-grupo="">Ver ${Math.min(mas, POR_GRUPO)} más <small>(quedan ${mas})</small></button>` : '');
    }
    return orden.map((g) => {
      const fs = grupos.get(g);
      const tope = st.cuantos.get(g) || POR_GRUPO;
      const mas = fs.length - tope;
      let cuerpo;
      if (o.subgrupo) {
        /* Dentro del grupo, por subgrupo (p. ej. planta): se pagina por equipos, el subencabezado cuenta el subgrupo entero. */
        const subs = new Map();
        for (const f of fs) { const k = o.subgrupo(f) || ''; if (!subs.has(k)) subs.set(k, []); subs.get(k).push(f); }
        const claves = [...subs.keys()]; if (o.subOrden) claves.sort(o.subOrden);
        let resto = tope; const partes = [];
        for (const k of claves) {
          if (resto <= 0) break;
          const todas = subs.get(k), vis = todas.slice(0, resto); resto -= vis.length;
          /* El subencabezado se pliega con un toque (clave: obra + lista + grupo + subgrupo; por defecto desplegado). */
          const idSub = `sub/${(typeof window !== 'undefined' && window.CX && window.CX.obraId && window.CX.obraId()) || ''}/${clave}/${g}/${k}`;
          partes.push(`<div class="subgrupo-lista" data-plg-caja="${esc(idSub)}"><div class="subgrupo-cab plg-h"><button type="button" class="plg-cab" data-plg="${esc(idSub)}" aria-expanded="true"><b class="plg-flecha" aria-hidden="true">▸</b>${o.subCabecera ? o.subCabecera(todas, k) : `<span>${esc(k)}</span><b>${cifra(todas.length)}</b>`}</button></div><div class="plg-cuerpo">${envolver(vis.map(o.fila).join(''))}</div></div>`);
        }
        cuerpo = partes.join('');
      } else cuerpo = envolver(fs.slice(0, tope).map(o.fila).join(''));
      cuerpo += (mas > 0 ? `<button class="ver-mas" data-lista-mas="${esc(clave)}" data-grupo="${esc(g)}">Ver ${Math.min(mas, POR_GRUPO)} más <small>(quedan ${mas})</small></button>` : '');
      const abierto = st.abiertos.has(g) ? st.abiertos.get(g) : (solo || o.buscando);
      return `<details class="grupo-lista" data-lista="${esc(clave)}" data-grupo="${esc(g)}" ${abierto ? 'open' : ''}>
        <summary>${o.cabecera ? o.cabecera(fs, g) : `<span>${esc(g || 'Todo')}</span><b class="contador">${cifra(fs.length)}</b>`}</summary>${cuerpo}</details>`;
    }).join('');
  }
  document.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d || !d.matches || !d.matches('details[data-lista]')) return;
    estadoLista(d.dataset.lista).abiertos.set(d.dataset.grupo, d.open);
  }, true);
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-lista-mas]');
    if (!b) return;
    const st = estadoLista(b.dataset.listaMas);
    const g = b.dataset.grupo;
    st.cuantos.set(g, (st.cuantos.get(g) || POR_GRUPO) + POR_GRUPO);
    st.abiertos.set(g, true);
    if (st.repintar) { const y = window.scrollY; st.repintar(); window.scrollTo(0, y); }
  });
  /** Al cambiar de obra o de filtro, las listas vuelven a su tope. */
  function reiniciarLista(clave) { const st = estadoLista(clave); st.cuantos.clear(); }

  /*
   * BLOQUES QUE SE PLIEGAN (28-oct, JC: «todas esas tarjetas deben de poder plegarse
   * y desplegarse»). Una sola pieza para todo el móvil:
   *   · cabecera(id, titulo, extra): el botón de la cabecera (aria-expanded) con el
   *     chevron ▸ (cerrado) / ▾ (abierto) a la izquierda; va dentro de un <h2>/<div>.
   *   · caja con data-plg-caja="id" (+ data-plg-defecto="plegado" si nace plegada) y
   *     su contenido en un hijo directo con class="plg-cuerpo".
   *   · auto: cualquier <section data-plegable> cuyo primer hijo sea un <h2> se
   *     convierte sola (la cabecera pasa a botón y el resto al cuerpo).
   * El estado (id → plegada o no) se recuerda por persona en este teléfono, con
   * try/catch; lo que no se ha tocado sale como nace (desplegado salvo defecto).
   */
  const plegable = (() => {
    const clave = () => { const s = sesion() || {}; return `cx.plegado.${s.email || s.nombre || 'anonimo'}.${s.rol || ''}`; };
    const leer = () => { try { const v = JSON.parse(localStorage.getItem(clave()) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
    const guardar = (m) => { try { localStorage.setItem(clave(), JSON.stringify(m)); } catch { /* sin almacén: no se recuerda */ } };
    const ident = (caja) => `${seccion()}/${caja.dataset.plgCaja}`;
    const cabecera = (id, titulo, extra = '') => `<button type="button" class="plg-cab" data-plg="${esc(id)}" aria-expanded="true"><b class="plg-flecha" aria-hidden="true">▸</b><em>${titulo}</em>${extra !== '' ? `<span>${extra}</span>` : ''}</button>`;
    function poner(caja, plegada) {
      caja.classList.toggle('plegado', plegada);
      for (const c of caja.children) if (c.classList.contains('plg-cuerpo')) c.hidden = plegada;
      const b = caja.querySelector(':scope > .plg-h .plg-cab, :scope > .plg-cab');
      if (b) b.setAttribute('aria-expanded', String(!plegada));
    }
    function preparar(caja) {
      if (caja.dataset.plgOk) return;
      caja.dataset.plgOk = '1';
      if (caja.hasAttribute('data-plegable') && !caja.dataset.plgCaja) {
        const h = caja.firstElementChild;
        if (!h || h.tagName !== 'H2') { delete caja.dataset.plgOk; return; }
        caja.dataset.plgCaja = caja.id || h.textContent.trim().slice(0, 30).toLowerCase().replace(/\W+/g, '-');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'plg-cab'; b.dataset.plg = caja.dataset.plgCaja;
        b.innerHTML = `<b class="plg-flecha" aria-hidden="true">▸</b><em></em>`;
        const em = b.querySelector('em');
        while (h.firstChild) em.appendChild(h.firstChild);
        h.classList.add('plg-h'); h.appendChild(b);
        const cuerpo = document.createElement('div');
        cuerpo.className = 'plg-cuerpo';
        while (h.nextSibling) cuerpo.appendChild(h.nextSibling);
        caja.appendChild(cuerpo);
      }
      const m = leer();
      const v = m[ident(caja)];
      poner(caja, typeof v === 'boolean' ? v : caja.dataset.plgDefecto === 'plegado');
    }
    function activar(raiz = document) {
      for (const c of raiz.querySelectorAll('[data-plg-caja]:not([data-plg-ok]), [data-plegable]:not([data-plg-ok])')) preparar(c);
    }
    function alternar(b) {
      const caja = b.closest('[data-plg-caja]');
      if (!caja) return;
      const plegada = !caja.classList.contains('plegado');
      poner(caja, plegada);
      const m = leer(); m[ident(caja)] = plegada; guardar(m);
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.plg-cab');
      if (b) { e.preventDefault(); alternar(b); }
    });
    let pendiente = false;
    new MutationObserver(() => {
      if (pendiente) return;
      pendiente = true;
      Promise.resolve().then(() => { pendiente = false; activar(document); });
    }).observe(document.documentElement, { childList: true, subtree: true });
    return { cabecera, activar, alternar };
  })();

  window.CX = {
    plegable,
    esc, pedir, postJson, aviso, subirFoto, elegirFoto, cargarImagenes, fechaEs, cifra, compartirPdf,
    listaAgrupada, reiniciarLista,
    obra: () => obras.find((o) => o.id === obraId) || null,
    obraId: () => obraId,
    obras: () => obras,
    obrasListas: () => obrasListas,
    activa: (s) => seccion() === s,
    abrirAnadir: () => abrirHoja(),
    volverAObra: () => { pintar(); },
    /* Ir a otra sección y pulsar sus botones (los atajos del Inicio); también lo
       usa Commissioning para abrir un parte ya relleno. */
    hacer: (a) => hacer(a),
    cabeza, menu,
  };

  /*
   * LA CABECERA DE TRABAJO (15-oct-2026, JC: «quita el título gigante»).
   * Con una ficha o un equipo abiertos, arriba va lo que se está midiendo:
   * el TAG, la sala y el progreso, en una barra fina que no se va al bajar;
   * la pastilla de sync se queda a la derecha. cabeza(null) vuelve a la normal.
   */
  let seccionTrabajo = null;
  function cabeza(info) {
    const t = document.getElementById('titulo-seccion');
    const barra = document.querySelector('.barra');
    if (!t || !barra) return;
    let sub = document.getElementById('cabeza-sub');
    if (!info) {
      document.body.classList.remove('modo-trabajo');
      if (sub) sub.remove();
      pintar();
      return;
    }
    document.body.classList.add('modo-trabajo');
    seccionTrabajo = seccion();
    t.textContent = info.titulo || '';
    if (!sub) {
      sub = document.createElement('div');
      sub.id = 'cabeza-sub';
      sub.className = 'cabeza-sub-trabajo';
      barra.append(sub);
    }
    sub.innerHTML = `<span class="donde">${esc(info.sub || '')}</span>${info.progreso ? `<span class="donde"> · </span><span class="progreso-cab"><i style="width:${Math.max(0, Math.min(100, info.pct || 0))}%"></i></span><b class="cifra">${esc(info.progreso)}</b>` : ''}`;
  }

  /*
   * UN MENÚ PEQUEÑO desde abajo (la hoja de «Añadir», en chico): devuelve el
   * id de la opción elegida, o null si se cierra sin elegir.
   *   menu({ titulo, sub, opciones: [{ id, nombre, ayuda, activa }] })
   */
  function menu({ titulo, sub = '', opciones = [] }) {
    return new Promise((listo) => {
      const fondo = document.createElement('div');
      fondo.className = 'hoja-fondo';
      const h = document.createElement('div');
      h.className = 'hoja hoja-menu';
      h.setAttribute('role', 'dialog');
      h.setAttribute('aria-label', titulo);
      h.innerHTML = `<div class="asa"></div><h3>${esc(titulo)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
        <ul>${opciones.map((o, i) => `<li><button type="button" class="opcion-menu${o.activa ? ' activa' : ''}" data-op="${i}" ${o.activa ? 'aria-current="true"' : ''}>
          <span><b>${esc(o.nombre)}</b>${o.ayuda ? `<small>${esc(o.ayuda)}</small>` : ''}</span>${o.activa ? '<i aria-hidden="true">✓</i>' : ''}</button></li>`).join('')}</ul>
        <button type="button" class="boton secundario cancelar" data-op="cerrar">Cancelar</button>`;
      document.body.append(fondo, h);
      let hecho = false;
      const cerrar = (v) => {
        if (hecho) return;
        hecho = true;
        h.classList.remove('abierta'); fondo.classList.remove('abierta');
        document.removeEventListener('keydown', esc_);
        setTimeout(() => { h.remove(); fondo.remove(); }, 240);
        listo(v);
      };
      const esc_ = (ev) => { if (ev.key === 'Escape') cerrar(null); };
      document.addEventListener('keydown', esc_);
      fondo.onclick = () => cerrar(null);
      h.onclick = (ev) => {
        const b = ev.target.closest('[data-op]');
        if (!b) return;
        cerrar(b.dataset.op === 'cerrar' ? null : opciones[Number(b.dataset.op)].id);
      };
      requestAnimationFrame(() => { fondo.classList.add('abierta'); h.classList.add('abierta'); });
    });
  }

  /* ═══════════════════════════════════ Las pestañas */

  function pintar() {
    /* En modo Mantenimiento (cxobra/mantenimiento/pantallas/mantenimiento.js) la barra, el título y las secciones son suyos. */
    if (window.VIDAIRE_MODO && window.VIDAIRE_MODO() === 'mant') return;
    const s = seccion();
    /* La cabecera de trabajo es de su sección: al irse a otra, la normal. */
    if (document.body.classList.contains('modo-trabajo') && s !== seccionTrabajo) {
      document.body.classList.remove('modo-trabajo');
      const cs = document.getElementById('cabeza-sub');
      if (cs) cs.remove();
    }
    const ok = new Set(permitidas());
    const actual = pestanaDe(s);
    const abajo = document.getElementById('barra-inferior');
    if (abajo) {
      const boton = (p) => {
        const visibles = p.secciones.filter(([id]) => ok.has(id));
        if (!visibles.length) return '';
        /* Al volver a una pestaña, la última sección que se usó en ella (las sin subbarra, no). */
        const propias = visibles.filter(([, , oculta]) => !oculta);
        let destino = (propias[0] || visibles[0])[0];
        try { const u = localStorage.getItem(`movil.pestana.${p.id}`); if (u && propias.some(([id]) => id === u)) destino = u; } catch { /* nada */ }
        if (actual === p && propias.some(([id]) => id === s)) destino = s;
        return `<a href="#${destino}" class="pestana-${p.id}${actual === p ? ' activa' : ''}" ${actual === p ? 'aria-current="page"' : ''}>${p.icono}<span>${esc(p.nombre)}</span></a>`;
      };
      const centro = accionesDisponibles().length
        ? '<div class="barra-centro"><button type="button" class="boton-anadir" id="boton-anadir" aria-label="Añadir" aria-haspopup="dialog">' + MAS + '</button><span>Añadir</span></div>'
        : '';
      abajo.innerHTML = `<div class="barra-pastilla">${PESTANAS.slice(0, 2).map(boton).join('')}${centro}${PESTANAS.slice(2).map(boton).join('')}</div>`;
      const b = document.getElementById('boton-anadir');
      if (b) b.onclick = abrirHoja;
      abajo.hidden = !sesion();
    }
    const seg = document.getElementById('segmentos');
    if (seg) {
      const visibles = actual ? actual.secciones.filter(([id, , oculta]) => ok.has(id) && !oculta) : [];
      seg.hidden = visibles.length < 2;
      seg.innerHTML = visibles.map(([id, nombre]) => `<a href="#${id}" class="${id === s ? 'activa' : ''}" ${id === s ? 'aria-current="page"' : ''}>${esc(nombre)}</a>`).join('');
    }
    const t = document.getElementById('titulo-seccion');
    /* En Inicio, el saludo hace de título (15-oct-2026, JC). */
    const nombrePila = sesion() && sesion().nombre ? String(sesion().nombre).trim().split(/\s+/).slice(0, 2).join(' ') : '';
    if (t && !document.body.classList.contains('modo-trabajo')) t.textContent = s === 'inicio' && nombrePila ? `Hola, ${nombrePila}` : (TITULO[s] || 'Vidaire Cx');
    document.title = `${TITULO[s] || 'Inicio'} · Vidaire Cx`;
    const caja = document.getElementById('obra-movil-caja');
    /* En Inicio la obra se elige en su tarjeta: arriba sobraría. */
    if (caja) caja.hidden = !sesion() || SIN_OBRA.has(s) || s === 'inicio' || !obras.length;
    if (actual) { try { localStorage.setItem(`movil.pestana.${actual.id}`, s); } catch { /* nada */ } }
    if (s === 'cuenta') cuenta();
    if (s === 'inicio') inicio();
    pastillaSync();
  }

  /* ═══════════════════════════════════ El «+»: la hoja de Añadir */

  /* Nombre corto para la rejilla (dos líneas como mucho). */
  const CORTO = { estanqueidad: 'Estanqueidad', albaranes: 'Albarán', avisos: 'Reclamable', qhse: 'Inspección QHSE', avance: 'Avance' };

  const accionesDisponibles = () => { const ok = new Set(permitidas()); return ACCIONES.filter((a) => ok.has(a.seccion)); };

  function cerrarHoja() {
    const h = document.getElementById('hoja-anadir');
    const f = document.getElementById('hoja-fondo');
    if (!h) return;
    h.classList.remove('abierta');
    f.classList.remove('abierta');
    setTimeout(() => { h.remove(); f.remove(); }, 240);
  }

  function abrirHoja() {
    if (document.getElementById('hoja-anadir')) return;
    const o = window.CX.obra();
    const lista = accionesDisponibles();
    const fondo = document.createElement('div');
    fondo.className = 'hoja-fondo';
    fondo.id = 'hoja-fondo';
    const h = document.createElement('div');
    h.className = 'hoja';
    h.id = 'hoja-anadir';
    h.setAttribute('role', 'dialog');
    h.setAttribute('aria-label', 'Añadir');
    h.innerHTML = `<div class="asa"></div>
      <h3>Añadir</h3>
      <p class="sub">${o ? `En ${esc(o.codigo)} · ${esc(o.nombre)}` : 'Sin obra elegida'}</p>
      <ul class="rejilla-anadir">${lista.map((a, i) => {
        const falta = a.obra && !o;
        return `<li><button class="accion-rapida" data-rapida="${i}" ${falta ? 'disabled' : ''} title="${esc(falta ? 'Elige antes una obra' : a.ayuda)}"><span class="ico">${a.icono}</span><b>${esc(CORTO[a.seccion] || a.nombre)}</b></button></li>`;
      }).join('')}</ul>
      <button class="boton secundario cancelar" data-rapida="cerrar">Cancelar</button>`;
    document.body.append(fondo, h);
    fondo.onclick = cerrarHoja;
    h.onclick = (ev) => {
      const b = ev.target.closest('[data-rapida]');
      if (!b) return;
      cerrarHoja();
      if (b.dataset.rapida !== 'cerrar') hacer(lista[Number(b.dataset.rapida)]);
    };
    requestAnimationFrame(() => { fondo.classList.add('abierta'); h.classList.add('abierta'); });
  }
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarHoja(); });

  /** Espera a que la sección pinte `selector` (lo pinta tras pedir sus datos). */
  function esperar(selector, ms = 5000) {
    return new Promise((ok) => {
      const fin = Date.now() + ms;
      (function mirar() {
        const el = document.querySelector(`#app ${selector}`);
        if (el || Date.now() > fin) ok(el || null);
        else setTimeout(mirar, 80);
      })();
    });
  }

  /** Lleva a la sección de la acción y pulsa sus botones uno tras otro. */
  async function hacer(a) {
    if (!a) return;
    if (seccion() !== a.seccion) location.hash = a.seccion;
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
    for (const sel of a.pasos) {
      const el = await esperar(sel);
      if (!el) return;
      if (el.matches('input, textarea, select')) { el.focus(); el.scrollIntoView({ block: 'center' }); } else el.click();
    }
  }

  /* ═══════════════════════════════════ Inicio
     La primera pantalla: la obra elegida, cómo va su commissioning y lo
     que espera, todo a la vista y cada cifra lleva a lo suyo. Lo que el
     rol no puede ver no se pide ni se enseña. */

  /*
   * «HOY» Y «ESTA SEMANA» (22-oct, JC: «tenía hoy puestas en marcha y balanceos
   * de UTAs y en el móvil no los veo»). Lo mismo que el inicio del escritorio
   * (electron/data/agenda.js · miAgendaInicio): cada sesión de la planificación
   * con su tipo y el nombre de sus equipos («Puesta en marcha · UTA-PALCO»).
   * Cada TAG abre su ficha. Lo de días anteriores sin terminar va plegado al
   * pie de «Hoy», sin empujar nada. Filas densas, sin tarjetas.
   */
  const NOMBRE_TIPO = { tarea: 'Tarea', ncr: 'NC' };
  const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diaCorto = (f) => { const d = new Date(`${f}T12:00:00`); return `${DIA_CORTO[d.getDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}`; };
  const ORDEN_FRANJA = { 'Mañana': 0, 'Todo el día': 1, 'Tarde': 2 };
  const tipoSesion = (s) => s.tarea || (s.ambito === 'commissioning' ? 'Commissioning' : 'Incidencias');
  /* El mismo orden que la agenda del escritorio: día, franja y texto. */
  const ordenSesiones = (a, b) => a.fecha.localeCompare(b.fecha) || (ORDEN_FRANJA[a.franja] ?? 3) - (ORDEN_FRANJA[b.franja] ?? 3)
    || tipoSesion(a).localeCompare(tipoSesion(b), 'es') || String((a.items[0] || {}).texto || '').localeCompare(String((b.items[0] || {}).texto || ''), 'es', { numeric: true });

  function filaSesion(s, conDia) {
    const items = s.items.map((i) => {
      const t = esc(i.tag || i.texto);
      const cls = `ag-equipo${i.hecho ? ' hecho' : ''}`;
      return i.abrir ? `<a class="${cls}" href="#${esc(i.abrir.seccion)}" data-ir-abrir="${esc(i.abrir.id)}">${i.hecho ? '✓ ' : ''}${t}</a>` : `<span class="${cls}">${t}</span>`;
    });
    const detalle = [s.franja, s.encargado ? 'eres el encargado' : null, s.empresa, s.socotec ? 'con Socotec' : null].filter(Boolean).join(' · ');
    const hecho = s.items.length && s.hechos === s.items.length;
    return `<div class="ag-fila${hecho ? ' hecha' : ''}">
      ${conDia ? `<span class="ag-dia">${esc(diaCorto(s.fecha))}</span>` : ''}
      <div class="ag-que"><b>${esc(tipoSesion(s))}</b> · ${items.join(', ') || 'sin equipos'}
        ${detalle || s.notas ? `<small>${esc([detalle, s.notas].filter(Boolean).join(' · '))}</small>` : ''}</div>
      <span class="ag-cuenta">${cifra(s.hechos)}/${cifra(s.items.length)}</span>
    </div>`;
  }
  function filaDia(i, hoy) {
    const dentro = `<span class="ag-dia${i.vencida ? ' vencida' : ''}">${i.vencida ? esc(diaCorto(i.fecha)) : esc(NOMBRE_TIPO[i.tipo] || '')}</span>
      <div class="ag-que"><b>${esc(i.texto)}</b>${i.sub || i.obra ? `<small>${esc([i.vencida ? NOMBRE_TIPO[i.tipo] : '', i.obra, i.sub].filter(Boolean).join(' · '))}</small>` : ''}</div>`;
    return i.abrir
      ? `<a class="ag-fila" href="#${esc(i.abrir.seccion)}" data-ir-abrir="${esc(i.abrir.id)}">${dentro}</a>`
      : `<div class="ag-fila">${dentro}</div>`;
  }

  /** Los bloques «Hoy» y «Esta semana»: { hoy, semana } en HTML (vacíos si no hay datos). */
  function bloquesAgenda(plan, dia, obraIdActual, plegados = new Set()) {
    const planOk = plan && plan.ok;
    const diaOk = dia && dia.ok;
    if (!planOk && !diaOk) return { hoy: '', semana: '', nHoy: 0, nSemana: 0 };
    const hoy = planOk ? plan.hoy : dia.hoy;
    const sesiones = (planOk ? plan.sesiones : []).slice().sort(ordenSesiones);
    const items = (diaOk ? dia.items : []).filter((i) => !obraIdActual || !i.obraId || i.obraId === obraIdActual);
    const deHoy = sesiones.filter((s) => s.fecha === hoy);
    const atrasadas = sesiones.filter((s) => s.fecha < hoy);
    const finSemana = planOk && plan.semanaHasta ? plan.semanaHasta : null;
    const semana = sesiones.filter((s) => s.fecha > hoy && (!finSemana || s.fecha <= finSemana));
    const itemsHoy = items.filter((i) => !i.vencida);
    const vencidos = items.filter((i) => i.vencida);
    const nAtras = atrasadas.length + vencidos.length;
    const nHoy = deHoy.length + itemsHoy.length;
    const pie = nAtras ? `<details class="ag-atras" data-plegar-atras${plegados.has('atras') ? ' open' : ''}>
        <summary>${cifra(nAtras)} sin terminar de días anteriores</summary>
        ${atrasadas.map((s) => filaSesion(s, true)).join('')}${vencidos.map((i) => filaDia(i, hoy)).join('')}
      </details>` : '';
    const cab = (id, texto, resumen) => `<h2 class="titulo-grupo ag-titulo plg-h">${plegable.cabecera(id, texto, resumen)}</h2>`;
    const htmlHoy = `<section class="ag-bloque" data-bloque-ini="hoy" data-plg-caja="hoy">
        ${cab('hoy', 'Hoy', `${esc(diaCorto(hoy))}${nHoy ? ` · ${cifra(nHoy)}` : ''}${nAtras ? ` · ${cifra(nAtras)} atrasadas` : ''}`)}
        <div class="ag-cuerpo plg-cuerpo">
        ${deHoy.map((s) => filaSesion(s, false)).join('')}${itemsHoy.map((i) => filaDia(i, hoy)).join('')}
        ${nHoy ? '' : '<p class="ag-vacio">Hoy no hay nada planificado.</p>'}
        ${pie}
        </div>
      </section>`;
    const htmlSemana = `<section class="ag-bloque" data-bloque-ini="semana" data-plg-caja="semana">
        ${cab('semana', planOk && plan.semanaQueViene ? 'Esta semana y la que viene' : 'Esta semana', semana.length ? cifra(semana.length) : '')}
        <div class="ag-cuerpo plg-cuerpo">
        ${semana.map((s) => filaSesion(s, true)).join('') || '<p class="ag-vacio">Nada más planificado esta semana.</p>'}
        </div>
      </section>`;
    return { hoy: htmlHoy, semana: htmlSemana, nHoy, nSemana: semana.length };
  }

  /*
   * QUÉ BLOQUES VER (22-oct, JC): una línea de casillas arriba; lo que cada
   * persona quita se recuerda para ella en este teléfono. Se guarda lo oculto,
   * no lo visible, para que un bloque nuevo salga sin tocar nada.
   */
  /* 28-oct (JC): «en lugar de commissioning, un resumen de commissioning,
     incidencias, reparaciones… escueto». El id sigue siendo 'cx' para que
     quien lo había quitado lo siga teniendo quitado. */
  const BLOQUES_INICIO = [['hoy', 'Hoy'], ['utas', 'UTAs hoy'], ['semana', 'Semana'], ['cx', 'Resumen'], ['marcha', 'En marcha'], ['pendiente', 'Pendiente']];

  /*
   * RESUMEN DE LA OBRA (28-oct, JC; tarea ca2a4a48): una fila por área con 2-4
   * cifras grandes, cada una lleva a su pestaña ya filtrada. Sin tarjetas: el
   * nombre del área en teal y las cifras debajo, en el color de lo que dicen
   * (verde lo hecho, ámbar lo que falta, rojo lo vencido, gris si es cero).
   * Recibe lo ya pedido por el Inicio (nada nuevo al servidor):
   *   r.t        totales de commissioning (por conjunto si los hay)
   *   r.bocas    [medidas, totales]
   *   r.pruebas  pruebas de estanqueidad de la obra (o null)
   *   r.ncr      filas de NCR (o null) · r.rep filas de reparaciones (o null)
   * Una celda: [etiqueta, valor, tono, href, { seg | filtro }, sub].
   */
  function resumenObra(r) {
    const t = r.t;
    const celda = ([etq, v, tono, href, ir = {}, sub]) => {
      const n = Number(v) || 0;
      const attr = ir.seg ? ` data-ir-seg="${esc(ir.seg)}"` : ir.filtro ? ` data-ir-filtro="${esc(ir.filtro)}"` : '';
      return `<a class="res-cifra ${n ? tono : 'cero'}" href="#${href}"${attr}><b>${cifra(n)}</b><span>${esc(etq)}${sub ? ` <i>${esc(sub)}</i>` : ''}</span></a>`;
    };
    const fila = (nombre, extra, celdas) => (celdas.length ? `<div class="res-area" data-plg-caja="res-${esc(nombre)}">
        <div class="res-nombre plg-h">${plegable.cabecera(`res-${nombre}`, esc(nombre), extra ? esc(extra) : '')}</div>
        <div class="res-cifras plg-cuerpo n${celdas.length}">${celdas.map(celda).join('')}</div></div>` : '');
    const filas = [];
    if (t) {
      filas.push(fila('Commissioning', `${cifra(t.equipos)} equipos${t.unidades && t.unidades !== t.equipos ? ` · ${cifra(t.unidades)} unid.` : ''}`, [
        ['Completos', t.completos, 'bien', 'commissioning', { seg: 'completos' }],
        ...(t.enMarcha !== undefined ? [['En marcha', t.enMarcha, 'info', 'commissioning', { seg: 'enMarcha' }]] : []),
        ['Falta doc.', t.faltaDocumentacion, 'aviso', 'commissioning', { seg: 'faltaDoc' }],
        ['Falta ficha', t.faltaFichas, 'aviso', 'commissioning', { seg: 'faltaFichas' }],
      ]));
      const mal = r.pruebas ? r.pruebas.filter((p) => p.resultado !== 'correcta').length : 0;
      const sinMedir = r.bocas && r.bocas[1] ? r.bocas[1] - r.bocas[0] : null;
      filas.push(fila('Ensayos', '', [
        ['Falta balanceo', t.faltaBalanceo ?? t.faltaEnsayo, 'aviso', 'commissioning', { seg: t.faltaBalanceo !== undefined ? 'faltaBalanceo' : 'faltaEnsayo' }],
        ...(t.pideEstanqueidad ? [['Falta estanq.', (typeof window !== 'undefined' && window.KPI_CX ? window.KPI_CX.faltaEstanqueidad(t) : t.faltaEstanqueidad), 'aviso', 'estanqueidad', {}, `de ${cifra(t.pideEstanqueidad)}`]] : []),
        ...(mal ? [['Estanq. mal', mal, 'mal', 'estanqueidad']] : []),
        ...(sinMedir !== null ? [['Bocas sin medir', sinMedir, 'aviso', 'commissioning', { seg: 'todos' }, `de ${cifra(r.bocas[1])}`]] : []),
      ]));
    }
    if (r.ncr) {
      /* Las de la lista de NCR por defecto: abiertas y nuestras (ncr.js). */
      const ab = r.ncr.filter((f) => f.activa && f.alcance === 'nuestra');
      filas.push(fila('Incidencias (NCR)', '', [
        ['Abiertas', ab.length, 'info', 'ncr', { filtro: 'ncr:abiertas' }],
        ['Vencidas', ab.filter((f) => f.vencida).length, 'mal', 'ncr', { filtro: 'ncr:vencidas' }],
        ['Urgentes (A)', ab.filter((f) => f.prioridad === 'A').length, 'mal', 'ncr', { filtro: 'ncr:urgentes' }],
      ]));
    }
    if (r.rep) {
      /* Pendientes: abiertas sin terminar; por revisar: terminadas que esperan al jefe de obra. */
      const ab = r.rep.filter((f) => f.activa);
      filas.push(fila('Reparaciones', '', [
        ['Pendientes', ab.filter((f) => f.estado !== 'terminada').length, 'info', 'reparaciones', { filtro: 'rp:pendientes' }],
        ['Vencidas', ab.filter((f) => f.vencida).length, 'mal', 'reparaciones', { filtro: 'rp:vencidas' }],
        ['Por revisar', ab.filter((f) => f.estado === 'terminada').length, 'aviso', 'reparaciones', { filtro: 'rp:revisar' }],
      ]));
    }
    const cuerpo = filas.join('');
    return cuerpo ? `<section class="ag-bloque" data-bloque-ini="cx" data-plg-caja="cx">
        <h2 class="titulo-grupo ag-titulo plg-h">${plegable.cabecera('cx', 'Resumen', esc(r.codigo || ''))}</h2>
        <div class="res-obra plg-cuerpo">${cuerpo}</div>
      </section>` : '';
  }
  /* fin resumenObra */
  const claveOcultos = () => { const s = sesion() || {}; return `cx.inicio.ocultos.${s.email || s.nombre || 'anonimo'}.${s.rol || ''}`; };
  /* Bloques plegados con un toque en su título (recordado por persona; 'atras' = lo atrasado desplegado). */
  const clavePlegados = () => claveOcultos().replace('.ocultos.', '.plegados.');
  const leerPlegados = () => {
    try { const v = JSON.parse(localStorage.getItem(clavePlegados()) || '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch { return new Set(); }
  };
  const guardarPlegados = (set) => {
    try { if (set.size) localStorage.setItem(clavePlegados(), JSON.stringify([...set])); else localStorage.removeItem(clavePlegados()); } catch { /* sin almacén */ }
  };
  const leerOcultos = () => {
    try { const v = JSON.parse(localStorage.getItem(claveOcultos()) || '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch { return new Set(); }
  };
  const guardarOcultos = (set) => {
    try { if (set.size) localStorage.setItem(claveOcultos(), JSON.stringify([...set])); else localStorage.removeItem(claveOcultos()); } catch { /* sin almacén: se ve todo */ }
  };

  async function inicio() {
    const yo = sesion();
    const app = document.getElementById('app');
    if (!yo || !app) return;
    await obrasListas;
    if (seccion() !== 'inicio') return;
    const o = window.CX.obra();
    const ok = new Set(permitidas());
    if (!o) { app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    app.innerHTML = '<p class="cargando">Cargando…</p>';
    const q = encodeURIComponent(o.id);
    const traer = (sec, ruta) => (ok.has(sec) ? pedir(ruta).catch(() => null) : Promise.resolve(null));
    const tocaPlan = ok.has('commissioning') || ok.has('reparaciones') || ok.has('ncr');
    const [cx, pe, pi, ncr, rp, plan, dia, mt] = await Promise.all([
      traer('commissioning', `api/commissioning?obra=${q}`), traer('estanqueidad', 'api/estanqueidad'),
      traer('partes', 'api/partes'), traer('ncr', `api/ncr?obra=${q}`), traer('reparaciones', `api/reparaciones?obra=${q}`),
      tocaPlan ? pedir(`api/mi-planificacion?obra=${q}`).catch(() => null) : null,
      pedir('api/mi-dia').catch(() => null),
      traer('misTareas', 'api/mistareas'),
    ]);
    if (seccion() !== 'inicio' || window.CX.obraId() !== o.id) return;
    // Como la lista de Commissioning: si hay conjuntos (split = UE + UI), se cuenta por conjunto.
    const tc = cx && cx.ok && cx.totalesConjuntos && cx.totalesConjuntos.conjuntos ? cx.totalesConjuntos : null;
    const t = cx && cx.ok && cx.totales ? (tc ? { ...cx.totales, ...tc, equipos: tc.conjuntos } : cx.totales) : null;
    const bocas = cx && cx.equipos ? cx.equipos.reduce((a, e) => [a[0] + (e.medidas || 0), a[1] + (e.bocas || 0)], [0, 0]) : [0, 0];
    const pruebas = pe && pe.recientes ? pe.recientes.filter((p) => p.obraId === o.id) : null;
    const partes = pi && pi.recientes ? pi.recientes.filter((p) => p.obraId === o.id && p.estado !== 'cerrado') : null;
    /* Las órdenes de mantenimiento que me tocan (de todas mis obras). */
    const misOrdenes = mt && mt.ok && mt.tareas.length ? mt.tareas : null;
    const fila = (href, nombre, valor, aviso) => `<a class="fila-dato${aviso ? ' aviso' : ''}" href="#${href}"><span>${esc(nombre)}</span><strong>${valor} ›</strong></a>`;
    /* El resumen (28-oct): commissioning, ensayos, NCR y reparaciones en cifras. */
    const cxHtml = resumenObra({ t, bocas, pruebas, ncr: ncr && ncr.ok ? ncr.filas : null, rep: rp && rp.filas ? rp.filas : null, codigo: o.codigo });
    /* Lo que queda fuera del resumen: lo mío (partes y órdenes de mantenimiento). */
    const pendienteHtml = partes || misOrdenes ? `<section class="ag-bloque" data-bloque-ini="pendiente" data-plg-caja="pendiente">
        <h2 class="titulo-grupo ag-titulo plg-h">${plegable.cabecera('pendiente', 'Pendiente')}</h2>
        <div class="grupo ini-pend plg-cuerpo">
        ${partes ? fila('partes', 'Partes abiertos', cifra(partes.length)) : ''}
        ${misOrdenes ? fila('misTareas', 'Mis tareas de mantenimiento', cifra(misOrdenes.length), misOrdenes.some((f) => f.atrasada)) : ''}
        </div>
      </section>` : '';
    const ag = bloquesAgenda(plan, dia, o.id, leerPlegados());
    const PN = window.CX.panelNcn; /* el panel de NCN (panelNcn.js) */
    const bloques = { hoy: ag.hoy, utas: PN ? PN.htmlUtasHoy(plan, { esc, cifra }) : '', semana: ag.semana, cx: cxHtml, marcha: PN ? PN.htmlPuestosEnMarcha(cx, { esc, cifra }) : '', pendiente: pendienteHtml };
    const hay = BLOQUES_INICIO.filter(([id]) => bloques[id]);
    const ocultos = leerOcultos();
    app.innerHTML = `
      <section class="grupo inicio-obra">
        <label class="fila-dato selector-obra"><span>Obra</span>
          <select data-inicio-obra aria-label="Obra">${obras.map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select>
        </label>
      </section>
      ${hay.length > 1 ? `<div class="ver-bloques" role="group" aria-label="Qué bloques ver"><span>Ver</span>${hay
        .map(([id, nombre]) => `<button type="button" data-ver-bloque="${id}" aria-pressed="${!ocultos.has(id)}" class="${ocultos.has(id) ? '' : 'activa'}">${esc(nombre)}</button>`).join('')}</div>` : ''}
      ${hay.filter(([id]) => !ocultos.has(id)).map(([id]) => bloques[id]).join('')}
      ${hay.length && hay.every(([id]) => ocultos.has(id)) ? '<p class="ag-vacio">Has quitado todos los bloques: toca uno arriba para verlo.</p>' : ''}`;
    for (const b of app.querySelectorAll('[data-ver-bloque]')) {
      b.onclick = () => {
        const set = leerOcultos();
        if (set.has(b.dataset.verBloque)) set.delete(b.dataset.verBloque); else set.add(b.dataset.verBloque);
        guardarOcultos(set);
        inicio();
      };
    }
    plegable.activar(app);
    for (const d of app.querySelectorAll('[data-plegar-atras]')) {
      d.ontoggle = () => { const set = leerPlegados(); if (d.open) set.add('atras'); else set.delete('atras'); guardarPlegados(set); };
    }
    /* Sin botón «Añadir…»: ya está el + de la barra (15-oct, JC). */
    /* Un TAG de «Hoy» o «Esta semana» abre su ficha: el módulo lo recoge al cargar. */
    for (const a of app.querySelectorAll('[data-ir-abrir]')) a.onclick = () => { try { sessionStorage.setItem('cx.abrir', a.dataset.irAbrir); } catch { /* nada */ } };
    for (const a of app.querySelectorAll('[data-ir-seg]')) a.onclick = () => { try { sessionStorage.setItem('cx.segmento', a.dataset.irSeg); } catch { /* nada */ } };
    /* «ncr:vencidas», «rp:revisar»…: la pestaña lo recoge al cargar (ncr.js, reparaciones.js). */
    for (const a of app.querySelectorAll('[data-ir-filtro]')) a.onclick = () => { try { const [k, v] = a.dataset.irFiltro.split(':'); sessionStorage.setItem(`${k}.filtro`, v); } catch { /* nada */ } };
  }
  window.addEventListener('movil:obra', () => { if (seccion() === 'inicio') inicio(); });

  /* ═══════════════════════════════════ La cuenta */

  function cuenta() {
    const yo = sesion();
    if (!yo) return;
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="grupo">
        <div class="fila-dato"><span>Nombre</span><strong>${esc(yo.nombre)}</strong></div>
        <div class="fila-dato"><span>Rol</span><strong>${esc(yo.rolNombre || yo.rol || '')}</strong></div>
        <div class="fila-dato"><span>Obra</span><strong>${esc(window.CX.obra() ? `${window.CX.obra().codigo} · ${window.CX.obra().nombre}` : '—')}</strong></div>
        <div class="fila-dato"><span>Datos</span><strong>${yo.local ? 'En este teléfono' : 'En el ordenador de la oficina'}</strong></div>
      </section>
      <p class="nota">${yo.local
        ? (sincro() ? 'Se guarda en este teléfono (funciona sin red) y se envía a la oficina en cuanto hay conexión.' : 'Todo se guarda en este teléfono; funciona sin red.')
        : 'Los datos están en el ordenador de la oficina y se llega a él por la wifi: con el ordenador apagado o fuera de su red, la app no puede traer ni guardar nada.'}</p>
      ${yo.local && window.cxObra && window.cxObra.traerDatos ? conLaOficina() : ''}
      ${yo.local && !(window.cxObra && window.cxObra.salir) ? '' : '<button class="boton peligro" id="cx-salir">Salir</button>'}
      <p class="nota pie">Vidaire Cx${window.cxObra && window.cxObra.ota ? ` · versión ${esc(window.cxObra.ota.info().version)}${window.cxObra.ota.info().lista ? ` (la ${esc(window.cxObra.ota.info().lista)} entra al volver a abrir)` : ''}` : ''}</p>`;
    const b = document.getElementById('cx-salir');
    if (b) b.onclick = () => {
      if (!yo.local) { window.ACCESO_MOVIL.salir(); return; }
      const ejemplo = window.cxObra.estado().ejemplo;
      if (confirm(ejemplo ? '¿Salir del ejemplo? Se borra y vuelves a la entrada.' : '¿Salir? Tus datos se quedan en el teléfono y al volver te pedirá la contraseña.')) window.cxObra.salir();
    };
    const traer = document.getElementById('cx-traer');
    if (traer) traer.onclick = () => window.cxObra.traerDatos().then((r) => { if (r && r.ok) location.reload(); else if (r && r.error) aviso(r.error); });
    const enviar = document.getElementById('cx-enviar');
    if (enviar) enviar.onclick = () => window.cxObra.enviarOficina().then((r) => { if (r && r.error) aviso(r.error); else if (r && r.ok) { aviso(r.texto, 'bien'); cuenta(); } });
    const vistos = document.getElementById('cx-conflictos-vistos');
    if (vistos) vistos.onclick = () => { sincro().conflictosVistos(); cuenta(); };
    const ya = document.getElementById('cx-sync-ya');
    if (ya) ya.onclick = async () => {
      ya.disabled = true;
      const r = await sincro().ahora();
      ya.disabled = false;
      if (r && r.error) aviso(r.error.sinRed ? 'Sin conexión: se enviará al volver la red.' : r.error.message);
      else aviso('Sincronizado con la oficina.', 'bien');
      cuenta();
    };
  }

  /* Vidaire Cx nativa: CON LA OFICINA, AL MOMENTO (cxobra/sync.js). Lo que se
     guarda aquí sube enseguida y lo de la oficina baja solo; sin red, se
     queda en el teléfono y sube al volver. El fichero .cxobra sigue como
     plan B. */
  const sincro = () => (window.cxObra && window.cxObra.sync && window.cxObra.sync.activa ? window.cxObra.sync : null);
  const hora = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return `${hoy ? 'hoy' : fechaEs(iso)} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  };
  /* «Conectando» solo los primeros segundos (revisión UX 18-oct): si no entra,
     la pastilla gris para siempre no decía nada. Después, lo que pasa. */
  const ARRANQUE = Date.now();
  const PACIENCIA = 15000;
  setTimeout(() => { pastillaSync(); }, PACIENCIA + 100);
  /* SIN COBERTURA (29-oct-2026, JC: «a veces no hay cobertura en las obras»):
     «Sin conexión · 3 pendientes» y, cuando ha subido, «Sincronizado». Corto
     para que a 390 px no se coma el saludo; el detalle, al pulsarla.
     Azul sin red, verde al día (nada de amarillo: colores teal/verde/azul). */
  const cambios = (n) => `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`;
  function textoSync(e) {
    const n = e.pendientes || 0;
    const pend = n ? ` · ${cambios(n)}` : '';
    /* Sin «Entrar en la nube» (15-oct-2026, JC: «siempre conectado»): entra solo. */
    if (!e.entrado || e.estado === 'sin-sesion') {
      if (Date.now() - ARRANQUE < PACIENCIA) return ['', 'Conectando'];
      return e.estado === 'sin-sesion' && e.entrado ? ['sin-sesion', 'Sin sesión'] : ['sin-red', `Solo en el móvil${pend}`];
    }
    if (e.estado === 'sin-red') return ['sin-red', `Sin conexión${pend}`];
    if (e.estado === 'error') return ['error', `No sincroniza${pend}`];
    if (e.estado === 'al-dia') return n ? ['sin-red', cambios(n)] : ['al-dia', 'Sincronizado'];
    return ['', 'Conectando'];
  }
  let ultimaClase = null;
  function pastillaSync() {
    const s = sincro();
    const fila = document.querySelector('.barra-fila');
    if (!s || !fila || !sesion()) return;
    let b = document.getElementById('cx-sync');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = 'cx-sync';
      b.className = 'sync-pastilla';
      b.onclick = () => { if (location.hash !== '#cuenta') location.hash = 'cuenta'; else cuenta(); };
      fila.insertBefore(b, document.getElementById('quien'));
    }
    const e = s.estado();
    /* Mientras da la vuelta se queda lo que había (sin parpadear cada 30 s). */
    if (e.estado === 'sincronizando' && ultimaClase !== null) { b.classList.add('girando'); return; }
    const [clase, texto] = textoSync(e);
    ultimaClase = clase;
    b.className = `sync-pastilla ${clase}`;
    b.textContent = texto;
    b.setAttribute('aria-label', `Sincronización con la oficina: ${texto}`);
  }
  window.addEventListener('cxobra:sync', () => {
    pastillaSync();
    if (seccion() === 'cuenta' && !document.querySelector('#app input:focus')) {
      const g = document.getElementById('cx-sync-grupo');
      if (g) g.outerHTML = grupoSync();
    }
  });

  function grupoSync() {
    const s = sincro();
    if (!s) return '';
    const e = s.estado();
    const [, texto] = textoSync(e);
    return `
      <section class="grupo" id="cx-sync-grupo">
        <div class="fila-dato"><span>Con la oficina</span><strong>${esc(texto)}</strong></div>
        <div class="fila-dato"><span>Último dato recibido</span><strong>${esc(hora(e.ultimoRecibido))}</strong></div>
        <div class="fila-dato"><span>Última comprobación</span><strong>${esc(hora(e.ultimaBajada))}</strong></div>
        <div class="fila-dato"><span>Pendiente de enviar</span><strong>${e.pendientes || 0} cambio${e.pendientes === 1 ? '' : 's'}</strong></div>
        <div class="fila-dato"><span>Aviso al momento</span><strong>${e.tiempoReal ? 'Conectado' : 'Cada 30 segundos'}</strong></div>
        ${e.error && e.estado === 'error' ? `<div class="fila-dato"><span>Error</span><strong>${esc(e.error)}</strong></div>` : ''}
      </section>
      ${conflictosSync(e)}`;
  }

  /* Lo que perdió al mezclar un cambio de aquí con otro de la oficina en la
     misma ficha (shared/sync/fusion.js): no se tira, se enseña aquí. */
  function conflictosSync(e) {
    const s = sincro();
    if (!s || !s.conflictos || !e.conflictos) return '';
    const corto = (v) => { const t = String(v == null ? '—' : v); return t.startsWith('data:') ? '(imagen)' : t.length > 80 ? `${t.slice(0, 80)}…` : t; };
    const filas = s.conflictos().slice(0, 30).map((c) => `
        <li><strong>${esc(c.tabla)} · ${esc(c.campo)}</strong><br>
          <span class="tenue">Se queda ${c.gana === 'aqui' ? 'lo de este teléfono' : 'lo de la oficina'} (el cambio más reciente): «${esc(corto(c.valorQueGana))}». Lo otro era «${esc(corto(c.valorQuePierde))}».</span></li>`).join('');
    return `
      <section class="grupo" id="cx-conflictos">
        <div class="fila-dato"><span>Cambiado aquí y en la oficina a la vez</span><strong>${e.conflictos}</strong></div>
        <ul class="lista-conflictos">${filas}</ul>
        <button class="boton secundario" id="cx-conflictos-vistos">Entendido</button>
      </section>`;
  }

  function conLaOficina() {
    const e = window.cxObra.estado();
    const dia = (iso) => (iso ? fechaEs(iso) : '—');
    const s = sincro();
    const fichero = `
      <section class="grupo">
        <div class="fila-dato"><span>Datos de la oficina</span><strong>${e.ejemplo ? 'De ejemplo' : dia(e.recibido)}</strong></div>
        <div class="fila-dato"><span>Enviado a la oficina</span><strong>${dia(e.enviado)}</strong></div>
        ${s ? '' : `<div class="fila-dato"><span>Pendiente de enviar</span><strong>${e.pendientes} cambio${e.pendientes === 1 ? '' : 's'}</strong></div>`}
      </section>
      <button class="boton${s ? ' secundario' : ''}" id="cx-enviar"${e.ejemplo ? ' disabled' : ''}>Enviar a la oficina en un fichero</button>
      <button class="boton secundario" id="cx-traer">Traer mis datos de un fichero</button>
      <p class="nota">El fichero prepara lo que has hecho (NCR, notas, albaranes, mediciones, partes, fichajes) para mandarlo por AirDrop o correo; en el ordenador se abre en Personas › La app del móvil. Las fotos van dentro.</p>`;
    if (!s) return fichero;
    const est = s.estado();
    return `
      <h2 class="titulo-grupo">Con la oficina, al momento</h2>
      ${grupoSync()}
      ${!est.entrado ? '<p class="nota aviso">Este teléfono aún no ha podido entrar en la oficina: lo que hagas se queda guardado aquí y se enviará cuando entre. Si sigue así, pulsa «Sincronizar ahora» con cobertura.</p>' : ''}
      <button class="boton" id="cx-sync-ya">Sincronizar ahora</button>
      <p class="nota">Lo que guardas aquí llega al ordenador de la oficina al momento, y lo de la oficina llega solo. Sin cobertura se guarda en el teléfono y se envía al volver la red.</p>
      <details class="grupo-plegable"><summary>Sin red: por fichero (plan B)</summary>${fichero}</details>`;
  }

  /* ═══════════════════════════════════ Arranque */

  document.getElementById('obra-movil').addEventListener('change', (ev) => ponerObra(ev.target.value));
  document.addEventListener('change', (ev) => { if (ev.target.matches('[data-inicio-obra]')) ponerObra(ev.target.value); });
  window.addEventListener('hashchange', pintar);
  pintar();
})();
