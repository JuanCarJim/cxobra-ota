'use strict';
/*
 * LA CARCASA DE CX OBRA: la barra de pestañas de abajo, las secciones de cada
 * pestaña arriba, la obra elegida y la pantalla de la cuenta.
 *
 *   · ABAJO, la barra flotante de Finanzas Pro, según el rol (8-nov, opción B):
 *     Inicio · X · [ + ] · Y · Más, con X e Y lo que más usa cada uno (barraRol.js).
 *     El «+» no es una pestaña: abre la hoja de Añadir (Nueva NCR, Nota rápida,
 *     Escanear albarán, Medir equipo, Prueba de estanqueidad, Parte, según el rol).
 *   · INICIO es la primera pantalla al entrar: la obra, cómo va el
 *     commissioning y lo que espera (partes, NCR, pruebas), con atajos.
 *   · ARRIBA, si la pestaña tiene más de una sección, un selector segmentado
 *     de dos como mucho: Inicio | Mis tareas, Plan | Reportes (QHSE).
 *   · «MÁS» es una lista agrupada como la barra lateral del ordenador.
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
  /* CON EL TECLADO ABIERTO el iPhone desplaza la vista hacia arriba: la
     cabecera se iba y la hora pisaba las tarjetas (29-oct, JC, al buscar).
     La cabecera baja lo que se ha desplazado la vista, siempre arriba. */
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const ajustar = () => document.documentElement.style.setProperty('--vv-arriba', `${Math.max(0, Math.round(vv.offsetTop))}px`);
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    ajustar();
  }
  /* La barra se adapta a la pantalla (8-nov, JC): con el teclado abierto se oculta. */
  (function adaptarBarra() {
    const B = document.body;
    const ESCRIBE = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      || (el.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'file', 'range', 'color', 'reset', 'image'].includes(el.type)));
    document.addEventListener('focusin', (ev) => { if (ESCRIBE(ev.target)) B.classList.add('teclado'); });
    document.addEventListener('focusout', () => setTimeout(() => { if (!ESCRIBE(document.activeElement)) B.classList.remove('teclado'); }, 120));
    if (window.visualViewport) {
      const vv = window.visualViewport;
      vv.addEventListener('resize', () => { if (vv.height > window.innerHeight - 120) B.classList.remove('teclado-vv'); else B.classList.add('teclado-vv'); });
      /* 8-nov: el chat de Iarvis mide lo que se ve (con el teclado abierto la caja sube y no queda tapada). */
      const medir = () => { B.style.setProperty('--vv-alto', Math.round(vv.height) + 'px'); if (B.classList.contains('en-iarvis')) window.scrollTo(0, 0); };
      vv.addEventListener('resize', medir); vv.addEventListener('scroll', medir); medir();
    }
  })();
  const icono = (off, on) => svg(`<g class="off">${off}</g><g class="on">${on}</g>`);

  /*
   * LA BARRA DE ABAJO DEPENDE DEL ROL (8-nov, JC, opción B): [Inicio] [X] [+] [Y] [Más].
   * Qué pestañas lleva cada rol y qué va en «Más» está en UNA tabla, barraRol.js
   * (window.CXBarraRol); aquí solo los iconos y el pintado.
   * Cada icono en sus dos formas, como en Finanzas Pro: de contorno apagado y relleno activo.
   */
  const trazo = (d) => `<path d="${d}"/>`;
  const relleno = (d, extra = '') => `<path d="${d}" fill="currentColor"${extra ? ` ${extra}` : ''}/>`;
  const D_CASA = 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z';
  const D_TRIANGULO = 'M12 3.5 2.8 19.5h18.4z';
  const D_ESCUDO = 'M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6.2z';
  const D_HOJA = 'M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z';
  const D_LLAVE = 'M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6L4.5 16.5a1.4 1.4 0 0 0 2 2l5.4-5.4a3.5 3.5 0 0 0 4.6-4.6l-2.2 2.2-2-.4-.4-2z';
  const RELOJ = icono('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    `<circle cx="12" cy="12" r="8.5" fill="currentColor"/><path d="M12 7.5V12l3 2" ${HUECO} stroke-width="2"/>`);
  const MEDIDOR = icono('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/><path d="M4 19h16"/>',
    `<path d="M4 15a8 8 0 1 1 16 0z" fill="currentColor"/><path d="M12 15l4.5-4.5" ${HUECO}/><path d="M4 19h16"/>`);
  const ICONO_PESTANA = {
    inicio: icono(trazo(D_CASA), relleno(D_CASA)),
    commissioning: MEDIDOR,
    equipos: MEDIDOR,
    avance: icono('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 15.5l3.5-4 3 2.5L17 8.5"/>',
      `<rect x="3.5" y="4" width="17" height="16" rx="2" fill="currentColor"/><path d="M7 15.5l3.5-4 3 2.5L17 8.5" ${HUECO} stroke-width="2"/>`),
    partes: icono(`${trazo(D_HOJA)}<path d="M14 3.5v5h5"/><path d="M12 11v4M12 17.5v.1"/>`,
      `${relleno(D_HOJA)}<path d="M12 11v4M12 17.5v.1" ${HUECO} stroke-width="2.2"/>`),
    ncr: icono(`${trazo(D_TRIANGULO)}<path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`,
      `${relleno(D_TRIANGULO)}<path d="M12 10v4" ${HUECO} stroke-width="2.2"/><path d="M12 16.9v.1" ${HUECO} stroke-width="2.4"/>`),
    qhse: icono(`${trazo(D_ESCUDO)}<path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>`,
      `${relleno(D_ESCUDO)}<path d="M8.8 12.2l2.2 2.2 4.2-4.4" ${HUECO} stroke-width="2"/>`),
    reclamables: RELOJ,
    jornada: RELOJ,
    reparaciones: icono(trazo(D_LLAVE), relleno(D_LLAVE)),
    albaranes: icono('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9h8M8 12h8M8 15h5"/>',
      '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9h8M8 12h8M8 15h5" stroke-width="2.4"/>'),
    personal: icono('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0z"/>',
      '<circle cx="12" cy="8" r="3.5" fill="currentColor"/><path d="M5 20a7 7 0 0 1 14 0z" fill="currentColor"/>'),
    bloc: icono('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
      `<rect x="5" y="3.5" width="14" height="17" rx="2" fill="currentColor"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4" ${HUECO} stroke-width="2"/>`),
    plano: icono('<path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
      `<path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z" fill="currentColor"/><path d="M9 4.5v13M15 6.5v13" ${HUECO}/>`),
    mas: icono('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
      '<g fill="currentColor"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></g>'),
  };
  const BR = () => window.CXBarraRol;
  const secsSesion = () => ((sesion() || {}).secciones || []);
  const pestanasDe = (rol) => BR().pestanasDe(rol, secsSesion()).map((p) => ({ ...p, icono: ICONO_PESTANA[p.id] || ICONO_PESTANA.mas }));
  const pestanas = () => pestanasDe((sesion() || {}).rol);
  const MAS = svg('<path d="M12 5v14M5 12h14" stroke-width="2.6"/>');

  /*
   * LO QUE OFRECE EL «+»: atajos a lo que más se hace en obra. Cada uno lleva
   * a su sección y pulsa allí su botón de «nuevo» (en cuanto aparece), así que
   * el permiso lo sigue decidiendo la sección y el ordenador. Solo salen los
   * de las secciones del rol; los que van a una obra dicen cuál.
   */
  /* Lo de commissioning, lo primero: es lo que más se hace en obra (18-oct). */
  const ACCIONES = [
    /* 5-nov (JC): fichar desde el teléfono; la entrada ya se ficha sola al abrir Cx. */
    { seccion: 'jornada', nombre: 'Fichar', ayuda: 'Entrada, salida o cambio de obra', obra: false, pasos: [],
      icono: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>') },
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
    { seccion: 'partes', nombre: 'Aviso', ayuda: 'Aviso de incidencia al jefe de obra', obra: true, pasos: ['[data-pi="nuevo"]'],
      icono: svg('<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z"/><path d="M14 3.5v5h5"/><path d="M12 11v4M12 17.5v.1"/>') },
    /* 26-oct: esperas, accesos denegados, falta de medios… (avisosReclamables.js). */
    { seccion: 'avisos', nombre: 'Algo reclamable', ayuda: 'Esperas, accesos denegados, sin grúa…', obra: true, pasos: ['[data-at="nuevo"]'],
      icono: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') },
    /* 5-nov (JC): el reporte QHSE en 20 s: cámara, categoría, ¿qué? y guardar (reportesQhse.js). */
    { seccion: 'reportesQhse', nombre: 'Reporte QHSE', ayuda: 'Foto, qué y categoría: observación, incidente o inspección', obra: true, pasos: ['[data-rq="nuevo"]', '[data-rq="camara"]'],
      icono: svg('<path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6.2z"/><path d="M12 8.5v4.5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/>') },
    /* 28-oct: la inspección del sitio de cada semana (qhse.js). */
    { seccion: 'qhse', nombre: 'Inspección del sitio', ayuda: 'QHSE: la de esta semana, control de subcontratas, CAE', obra: true, pasos: ['[data-qh="tipo"][data-p="inspeccionObra"]', '[data-qh="nuevo"][data-p="inspeccionObra"]'],
      icono: svg('<path d="M9 4.5h6M9 4.5A1.5 1.5 0 0 0 7.5 6H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 18 6h-1.5A1.5 1.5 0 0 0 15 4.5"/><path d="M8.5 13l2.5 2.5 4.5-5"/>') },
  ];

  /* El título de cada sección, arriba: corto, que en el iPhone quepa junto a la pastilla (18-oct). */
  const TITULO = {
    inicio: 'Inicio', commissioning: 'Cx', partes: 'Avisos', ncr: 'No conformidades', reparaciones: 'Reparaciones', avance: 'Avance de obra', albaranes: 'Albaranes',
    inventario: 'Inventario', bloc: 'Notas', personal: 'Personal', estanqueidad: 'Estanqueidad', cuenta: 'Perfil',
    misTareas: 'Mis tareas', avisos: 'Reclamables', qhse: 'QHSE', reportesQhse: 'Reportes QHSE', plano: 'Plano de equipos', planoMant: 'Plano de mantenimiento', jornada: 'Mi jornada',
    iarvis: 'Iarvis', mas: 'Más',
  };
  /* Las que no dependen de la obra elegida no enseñan el selector. */
  const SIN_OBRA = new Set(['cuenta', 'albaranes', 'jornada', 'mas']);

  const sesion = () => (window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion()) || null;
  const permitidas = () => { const s = sesion(); return s ? ['inicio', ...(s.secciones || []), 'iarvis', 'cuenta'].concat('mas') : []; }; /* 7-nov: Iarvis, todo rol (iarvisMovil.js). */
  const seccion = () => location.hash.slice(1);
  const pestanaDe = (s) => { const p = BR().pestanaDeSeccion((sesion() || {}).rol, secsSesion(), s); return p ? pestanas().find((x) => x.id === p.id) || null : null; };

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
    precalentarPlano();
  }
  /* PRECARGA (13-nov-2026, JC: «abrir en menos de 1 s»): con la obra elegida, el servidor evalúa ya en segundo plano el
     plano de la pestaña Cx; al abrirla no lo calcula. No trae datos ({ ok }); si falla, la pestaña lo calcula al abrir. */
  function precalentarPlano() {
    if (!obraId || !secsSesion().includes('commissioning')) return;
    pedir(`api/plano-equipos/precalentar?obra=${encodeURIComponent(obraId)}`).catch(() => {});
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
    /* Grupos que salen aunque no tengan filas (plantas del censo sin ninguna ficha): cabecera y una nota. */
    for (const g of o.gruposVacios || []) if (!grupos.has(g)) grupos.set(g, []);
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
        /* Dentro del grupo, por subgrupo (p. ej. planta): cada subgrupo se pagina por su cuenta
           y su «Ver más» dice lo que queda de ESE subgrupo (29-oct, JC: «N10 tiene 43 y me dice
           que quedan 126»: contaba lo que quedaba de todo el grupo). */
        const subs = new Map();
        for (const f of fs) { const k = o.subgrupo(f) || ''; if (!subs.has(k)) subs.set(k, []); subs.get(k).push(f); }
        const claves = [...subs.keys()]; if (o.subOrden) claves.sort(o.subOrden);
        const partes = [];
        for (const k of claves) {
          const claveSub = `${g}\u0001${k}`;
          const todas = subs.get(k), topeSub = st.cuantos.get(claveSub) || POR_GRUPO, vis = todas.slice(0, topeSub);
          const masSub = todas.length - vis.length;
          const verMasSub = masSub > 0 ? `<button class="ver-mas" data-lista-mas="${esc(clave)}" data-grupo="${esc(claveSub)}" data-abre="${esc(g)}">Ver ${Math.min(masSub, POR_GRUPO)} más <small>(quedan ${masSub}${k ? ` en ${esc(k)}` : ''})</small></button>` : '';
          /* El subencabezado se pliega con un toque (clave: obra + lista + grupo + subgrupo; por defecto desplegado). */
          const idSub = `sub/${(typeof window !== 'undefined' && window.CX && window.CX.obraId && window.CX.obraId()) || ''}/${clave}/${g}/${k}`;
          partes.push(`<div class="subgrupo-lista" data-plg-caja="${esc(idSub)}"><div class="subgrupo-cab plg-h"><button type="button" class="plg-cab" data-plg="${esc(idSub)}" aria-expanded="true"><b class="plg-flecha" aria-hidden="true">▸</b>${o.subCabecera ? o.subCabecera(todas, k) : `<span>${esc(k)}</span><b>${cifra(todas.length)}</b>`}</button></div><div class="plg-cuerpo">${envolver(vis.map(o.fila).join(''))}${verMasSub}</div></div>`);
        }
        cuerpo = partes.join('');
      } else cuerpo = fs.length || !o.vacio ? envolver(fs.slice(0, tope).map(o.fila).join('')) : o.vacio(g);
      if (!o.subgrupo) cuerpo += (mas > 0 ? `<button class="ver-mas" data-lista-mas="${esc(clave)}" data-grupo="${esc(g)}">Ver ${Math.min(mas, POR_GRUPO)} más <small>(quedan ${mas})</small></button>` : '');
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
    st.abiertos.set(b.dataset.abre || g, true);
    if (st.repintar) { const y = window.scrollY; st.repintar(); window.scrollTo(0, y); }
  });
  /** Al cambiar de obra o de filtro, las listas vuelven a su tope. */
  /** Abre un grupo de la lista (el de la ficha que se acaba de abrir en el iPad) y enseña hasta la fila de `hasta`. */
  function abrirGrupoLista(clave, grupo, tope = 0) { const st = estadoLista(clave); st.abiertos.set(grupo, true); if (tope > (st.cuantos.get(grupo) || POR_GRUPO)) st.cuantos.set(grupo, tope); }
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
    listaAgrupada, reiniciarLista, abrirGrupoLista,
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
    cabeza, menu, confirmar,
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

  /** Pregunta de sí / no con la hoja de abajo (sustituye al confirm nativo): true solo si pulsa el verbo. */
  async function confirmar(titulo, sub = '', si = 'Sí', no = 'No, volver') {
    const r = await menu({ titulo, sub, opciones: [{ id: 'si', nombre: si }, { id: 'no', nombre: no }] });
    return r === 'si';
  }

  /* Tecla ± para los campos que admiten negativos (data-menos): el teclado decimal de iOS no trae «−». */
  (function teclaMenos() {
    let tecla = null; let campo = null;
    const colocar = () => {
      if (!tecla) return;
      const vv = window.visualViewport;
      tecla.style.top = `${(vv ? vv.offsetTop + vv.height : window.innerHeight) - 56}px`;
    };
    const quitar = () => { if (tecla) { tecla.remove(); tecla = null; } campo = null; };
    document.addEventListener('focusin', (ev) => {
      const t = ev.target;
      if (!t || !t.matches || !t.matches('input[data-menos]') || t.disabled || t.readOnly) { quitar(); return; }
      campo = t;
      if (!tecla) {
        tecla = document.createElement('button');
        tecla.type = 'button'; tecla.className = 'tecla-menos'; tecla.textContent = '±';
        tecla.setAttribute('aria-label', 'Cambiar el signo (más / menos)');
        tecla.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!campo) return;
          const v = campo.value.trim();
          campo.value = /^[-−]/.test(v) ? v.replace(/^[-−]\s*/, '') : `-${v}`;
          campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        document.body.appendChild(tecla);
      }
      colocar();
    });
    document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('input[data-menos]')) quitar(); }, 150));
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', colocar); window.visualViewport.addEventListener('scroll', colocar); }
  })();

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
        if ((actual && actual.id === p.id) && propias.some(([id]) => id === s)) destino = s;
        return `<a href="#${destino}" class="pestana-${p.id}${(actual && actual.id === p.id) ? ' activa' : ''}" ${(actual && actual.id === p.id) ? 'aria-current="page"' : ''}>${p.icono}<span>${esc(p.nombre)}</span></a>`;
      };
      const centro = accionesDisponibles().length
        ? '<div class="barra-centro"><button type="button" class="boton-anadir" id="boton-anadir" aria-label="Añadir" aria-haspopup="dialog">' + MAS + '</button><span>Añadir</span></div>'
        : '';
      /* 9-nov (JC): «que quede el + centrado»: las pestañas, todas del mismo ancho, mitad a cada
         lado del «+»; si son impares, un hueco a la derecha mantiene el centro. */
      const hechas = pestanas().map(boton).filter(Boolean);
      const mitad = Math.ceil(hechas.length / 2);
      const izquierda = hechas.slice(0, mitad);
      const derecha = hechas.slice(mitad);
      if (centro) while (derecha.length < izquierda.length) derecha.push('<span class="pestana-hueco" aria-hidden="true"></span>');
      abajo.innerHTML = `<div class="barra-pastilla">${izquierda.join('')}${centro}${derecha.join('')}</div>`;
      const b = document.getElementById('boton-anadir');
      if (b) b.onclick = abrirHoja;
      /* 8-nov (JC): «la pantalla de Iarvis tiene que ser SOLO el chat»: sin cabecera, secciones ni barra (movil.css, body.en-iarvis). */
      document.body.classList.toggle('en-iarvis', s === 'iarvis');
      abajo.hidden = !sesion();
    }
    const seg = document.getElementById('segmentos');
    if (seg) {
      const visibles = actual ? actual.secciones.filter(([id, , oculta]) => ok.has(id) && !oculta) : [];
      seg.hidden = visibles.length < 2;
      seg.innerHTML = visibles.map(([id, nombre]) => `<a href="#${id}" class="${id === s ? 'activa' : ''}" ${id === s ? 'aria-current="page"' : ''}>${esc(nombre)}</a>`).join('');
      const act = seg.querySelector("a.activa"); if (act && act.scrollIntoView) act.scrollIntoView({ inline: "center", block: "nearest" });
    }
    const t = document.getElementById('titulo-seccion');
    /* En Inicio, el saludo hace de título (15-oct-2026, JC). */
    const nombrePila = sesion() && sesion().nombre ? String(sesion().nombre).trim().split(/\s+/).slice(0, 2).join(' ') : '';
    if (t && !document.body.classList.contains('modo-trabajo')) t.textContent = s === 'inicio' && nombrePila ? `Hola, ${nombrePila}` : (TITULO[s] || 'Vidaire Cx');
    document.title = `${TITULO[s] || 'Inicio'} · Vidaire Cx`;
    const caja = document.getElementById('obra-movil-caja');
    /* La obra se elige en la cabecera, igual en todas las pantallas (Inicio incluido, 29-oct JC). */
    if (caja) caja.hidden = !sesion() || SIN_OBRA.has(s) || !obras.length;
    if (actual) { try { localStorage.setItem(`movil.pestana.${actual.id}`, s); } catch { /* nada */ } }
    if (s === 'cuenta') cuenta();
    if (s === 'mas') mas();
    if (s === 'inicio') inicio();
    pastillaSync();
    botonIarvis(s);
  }

  /* 8-nov (JC): el botón de Iarvis es PEQUEÑO, solo su brújula (shared/arranqueLogo.js › BRUJULA),
     arriba en la cabecera junto al estado de la sincronización; en todas las pantallas menos en el chat.
     Antes era una barra ancha «Pregunta a Iarvis…» encima de la de abajo, que estorbaba. */
  function botonIarvis(s = seccion()) {
    const fila = document.querySelector('.barra-fila');
    if (!fila) return;
    let b = document.getElementById('boton-iarvis');
    if (!b) {
      b = document.createElement('a');
      b.id = 'boton-iarvis';
      b.className = 'boton-iarvis';
      b.href = '#iarvis';
      b.title = 'Iarvis';
      b.setAttribute('aria-label', 'Abrir Iarvis');
      b.innerHTML = (window.ARRANQUE_LOGO && window.ARRANQUE_LOGO.BRUJULA) || '<span aria-hidden="true">🧭</span>';
    }
    const quien = document.getElementById('quien');
    if (b.nextSibling !== quien) fila.insertBefore(b, quien);
    b.hidden = !sesion() || s === 'iarvis';
  }

  /* ═══════════════════════════════════ El «+»: la hoja de Añadir */

  /* Nombre corto para la rejilla (dos líneas como mucho). */
  const CORTO = { estanqueidad: 'Estanqueidad', albaranes: 'Albarán', avisos: 'Reclamable', qhse: 'Inspección QHSE', reportesQhse: 'Reporte QHSE', avance: 'Avance' };

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
    /* 9-nov: hasta 6 a la vista según el rol; las demás, al pie, sin perder ninguna. */
    const disponibles = accionesDisponibles();
    const porSeccion = new Map(disponibles.map((a) => [a.seccion, a]));
    const reparto = BR().accionesDe((sesion() || {}).rol, disponibles.map((a) => a.seccion));
    const lista = [...reparto.principales, ...reparto.resto].map((s) => porSeccion.get(s));
    const celda = (a, i) => {
      const falta = a.obra && !o;
      return `<li><button class="accion-rapida" data-rapida="${i}" ${falta ? 'disabled' : ''} title="${esc(falta ? 'Elige antes una obra' : a.ayuda)}"><span class="ico">${a.icono}</span><b>${esc(CORTO[a.seccion] || a.nombre)}</b></button></li>`;
    };
    const n = reparto.principales.length;
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
      <ul class="rejilla-anadir">${lista.slice(0, n).map(celda).join('')}</ul>
      ${lista.length > n ? `<button class="ver-todas" data-rapida="todas">Todas las acciones</button>
      <ul class="rejilla-anadir resto" hidden>${lista.slice(n).map((a, i) => celda(a, n + i)).join('')}</ul>` : ''}
      <button class="boton secundario cancelar" data-rapida="cerrar">Cancelar</button>`;
    document.body.append(fondo, h);
    fondo.onclick = cerrarHoja;
    h.onclick = (ev) => {
      const b = ev.target.closest('[data-rapida]');
      if (!b) return;
      if (b.dataset.rapida === 'todas') { b.hidden = true; h.querySelector('.rejilla-anadir.resto').hidden = false; return; }
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
  /* 8-nov · Iarvis («hazme un parte»): el mismo camino que el «+», sin pasar por la hoja. */
  window.CX_ACCION_RAPIDA = (a) => hacer(a);

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
  const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diaCorto = (f) => { const d = new Date(`${f}T12:00:00`); return `${DIA_CORTO[d.getDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}`; };
  const tipoSesion = (s) => s.tarea || (s.ambito === 'commissioning' ? 'Commissioning' : 'Incidencias');
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
      ${s.items.length ? `<span class="ag-cuenta">${cifra(s.hechos)}/${cifra(s.items.length)}</span>` : ''}
    </div>`;
  }
  /*
   * EL INICIO SEGÚN EL ROL (8-nov, JC: «no le veo mucho sentido» a Ver Hoy/Semana/Resumen…).
   * Quien lleva la obra ve «Mi obra» (el día, las atrasadas, el avance, incidencias y pruebas);
   * quien la ejecuta, «Mi día» (el día, lo que le toca y sus atrasadas, sin cifras de la obra).
   * La cuenta está en inicioRol.js; aquí solo se piden los datos del alcance del rol y se pinta.
   * La semana y lo puesto en marcha siguen en «Mis tareas», Commissioning y Avance.
   */
  /* 8-nov: si el inicio se pintaba antes de cargar inicioRol.js, la app arrancaba con «IR().tipoDeInicio». */
  const IR = () => window.CX.inicioRol || window.CXInicioRol;
  const esB = () => IR().tipoDeInicio((sesion() || {}).rol) === 'dia';
  const BLOQUES_INICIO = [['dia', 'Hoy'], ['atras', 'Atrasadas'], ['avance', 'Avance'], ['cifras', 'Resumen']];

  /*
   * EL INICIO PINTA SEGÚN LLEGA (5-nov-2026, JC: «la app móvil tarda muchísimo
   * en arrancar»). En Vidaire Cx el motor corre en el MISMO hilo que la
   * pantalla: las peticiones se calculan una tras otra, y con el NCN en un
   * iPhone la planificación y el commissioning son decenas de segundos. Así:
   *   · se pinta al momento lo último que se vio de esta obra con «Actualizando…»;
   *   · las peticiones van de una en una, primero las ligeras, cediendo el hilo;
   *   · cada bloque se pinta en cuanto tiene lo suyo;
   *   · «Mi día» no pide commissioning completo, ni NCR, ni estanqueidad: no los enseña.
   */
  let inicioEnCurso = null; /* { obra, promesa } */
  let inicioDatos = null; /* { obra, r, pendientes } */
  const claveInicioGuardado = (obra) => `cx.inicio.v2.${(sesion() || {}).email || (sesion() || {}).nombre || 'anonimo'}.${(sesion() || {}).rol || ''}.${obra}`;
  const leerInicioGuardado = (obra) => { try { return JSON.parse(localStorage.getItem(claveInicioGuardado(obra)) || 'null'); } catch { return null; } };
  const guardarInicio = (obra, bloques) => { try { localStorage.setItem(claveInicioGuardado(obra), JSON.stringify({ en: Date.now(), bloques })); } catch { /* sin almacén o lleno */ } };
  /* Ceder el hilo: que el navegador pinte y atienda toques antes de la siguiente petición. */
  const ceder = () => new Promise((ok) => setTimeout(ok, 0));

  function inicio() {
    const o = window.CX && window.CX.obra ? window.CX.obra() : null;
    if (inicioEnCurso && (!o || !inicioEnCurso.obra || inicioEnCurso.obra === o.id)) return inicioEnCurso.promesa;
    const promesa = inicioPedir().finally(() => { if (inicioEnCurso && inicioEnCurso.promesa === promesa) inicioEnCurso = null; });
    inicioEnCurso = { obra: o ? o.id : null, promesa };
    return promesa;
  }

  /* De qué peticiones sale cada bloque. */
  const DEPENDE_BLOQUE = { dia: ['plan', 'dia'], atras: ['plan', 'dia'], avance: ['cx'], cifras: ['cx', 'ncr'] };
  const bloquesDe = () => (esB() ? ['dia', 'atras'] : ['dia', 'atras', 'avance', 'cifras']);

  async function inicioPedir() {
    const yo = sesion();
    const app = document.getElementById('app');
    if (!yo || !app) return;
    await obrasListas;
    if (seccion() !== 'inicio') return;
    const o = window.CX.obra();
    const ok = new Set(permitidas());
    if (!o) { app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    const q = encodeURIComponent(o.id);
    const tocaPlan = ok.has('commissioning') || ok.has('reparaciones') || ok.has('ncr');
    const mando = !esB();
    /* Lo que se pide, de lo más ligero a lo más pesado: commissioning de toda la obra el último. */
    const PIDE = [
      ['dia', 'misTareas_', 'api/mi-dia'],
      ['ncr', mando ? 'ncr' : null, `api/ncr?obra=${q}`],
      ['plan', tocaPlan ? 'plan_' : null, `api/mi-planificacion?obra=${q}`],
      ['cx', mando ? 'commissioning' : null, `api/commissioning?obra=${q}`],
    ];
    const r = {};
    const pendientes = new Set();
    for (const [k, sec] of PIDE) {
      const siempre = sec === 'misTareas_' || sec === 'plan_';
      if (siempre || (sec && ok.has(sec))) pendientes.add(k); else r[k] = null;
    }
    inicioDatos = { obra: o.id, r, pendientes };
    /* Al momento: lo último que se vio aquí (si lo hay) mientras se pone al día. */
    const guardado = leerInicioGuardado(o.id);
    if (guardado && guardado.bloques) pintarInicio(o, guardado.bloques, { actualizando: true });
    else pintarInicio(o, armarBloquesInicio(o, r, pendientes), { actualizando: true });
    await ceder();
    for (const [k, , ruta] of PIDE) {
      if (!pendientes.has(k)) continue;
      r[k] = await pedir(ruta).catch(() => null);
      pendientes.delete(k);
      if (window.CX.obraId() !== o.id) return;
      /* Un bloque se repinta cuando ya tiene todo lo suyo (no en cada petición). */
      const listos = Object.entries(DEPENDE_BLOQUE).some(([, deps]) => deps.includes(k) && deps.every((d) => !pendientes.has(d)));
      if (listos || !pendientes.size) {
        const bloques = armarBloquesInicio(o, r, pendientes);
        const conGuardado = guardado && guardado.bloques && pendientes.size
          ? Object.fromEntries(Object.entries(bloques).map(([id, h]) => [id, h === null && guardado.bloques[id] !== undefined ? guardado.bloques[id] : h]))
          : bloques;
        if (seccion() === 'inicio') pintarInicio(o, conGuardado, { actualizando: pendientes.size > 0 });
        if (!pendientes.size) guardarInicio(o.id, bloques);
      }
      await ceder();
    }
  }

  /**
   * El HTML de cada bloque con lo que ya ha llegado. `null` = aún no se sabe
   * (falta alguna de sus peticiones); '' = no hay nada que enseñar.
   */
  function armarBloquesInicio(o, r, pendientes) {
    const falta = (id) => DEPENDE_BLOQUE[id].some((d) => pendientes.has(d));
    const h = { esc, cifra, filaSesion };
    const I = IR();
    const dia = falta('dia') ? null : I.bloqueDelDia(r.plan, r.dia, o.id);
    const atras = falta('atras') ? null : I.atrasadas(r.plan, r.dia, o.id);
    if (esB()) {
      return { dia: dia && (dia.hoy ? I.htmlDiaMio(dia, h) : ''), atras: atras && I.htmlAtrasadas(atras, h, 'Atrasadas tuyas') };
    }
    return {
      dia: dia && (dia.hoy ? I.htmlDiaObra(dia, h) : ''),
      atras: atras && I.htmlAtrasadas(atras, h, 'Atrasadas'),
      avance: falta('avance') ? null : I.htmlAvance(I.avance(r.cx), h),
      cifras: falta('cifras') ? null : I.htmlCifras(I.cifras({ cx: r.cx, ncr: r.ncr }), h),
    };
  }

  /* Pinta los bloques; los que aún esperan datos, con su título y «Cargando…». */
  function pintarInicio(o, bloques, { actualizando = false } = {}) {
    const app = document.getElementById('app');
    if (!app || seccion() !== 'inicio' || window.CX.obraId() !== o.id) return;
    const nombreDe = Object.fromEntries(BLOQUES_INICIO);
    const espera = (id) => `<section class="ini-bloque" data-bloque-ini="${id}"><div class="ini-titulo"><span>${esc(nombreDe[id])}</span></div><p class="ag-vacio">Cargando…</p></section>`;
    const y = window.scrollY;
    app.innerHTML = `
      ${actualizando ? '<p class="ini-actualizando" role="status">Actualizando…</p>' : ''}
      ${bloquesDe().map((id) => (bloques[id] === null || bloques[id] === undefined ? espera(id) : bloques[id])).join('')}`;
    if (y) window.scrollTo(0, y);
    try { if (!actualizando) performance.mark('cx:inicio-pintado'); else performance.mark('cx:inicio-primero'); } catch { /* nada */ }
    /* Un equipo abre su ficha: el módulo lo recoge al cargar. */
    for (const a of app.querySelectorAll('[data-ir-abrir]')) a.onclick = () => { try { sessionStorage.setItem('cx.abrir', a.dataset.irAbrir); } catch { /* nada */ } };
    for (const a of app.querySelectorAll('[data-ir-seg]')) a.onclick = () => { try { sessionStorage.setItem('cx.segmento', a.dataset.irSeg); } catch { /* nada */ } };
    /* «ncr:abiertas»: la pestaña lo recoge al cargar (ncr.js). */
    for (const a of app.querySelectorAll('[data-ir-filtro]')) a.onclick = () => { try { const [k, v] = a.dataset.irFiltro.split(':'); sessionStorage.setItem(`${k}.filtro`, v); } catch { /* nada */ } };
  }
  window.addEventListener('movil:obra', () => { if (seccion() === 'inicio') inicio(); });

  /* ═══════════════════════════════════ «Más» */

  /* 8-nov (JC, opción B): una lista agrupada como la barra lateral del ordenador, con sus
     grupos, nombres e iconos (barraRol.js › masDe). Lo que ya va abajo no se repite. */
  function mas() {
    const yo = sesion();
    const app = document.getElementById('app');
    if (!yo || !app) return;
    const grupos = BR().masDe(yo.rol, secsSesion());
    app.innerHTML = grupos.map((g) => `
      <h2 class="mas-grupo"><span class="mas-ico" aria-hidden="true">${esc(g.icono)}</span>${esc(g.nombre)}</h2>
      <ul class="mas-lista">${g.items.map((i) => `
        <li><a href="#${esc(i.id)}" class="mas-fila" data-mas="${esc(i.id)}"><span class="mas-ico" aria-hidden="true">${esc(i.icono)}</span><span class="mas-nombre">${esc(i.nombre)}</span><span class="mas-flecha" aria-hidden="true">›</span></a></li>`).join('')}
      </ul>`).join('') || '<div class="vacio"><p>Nada más para tu rol.</p></div>';
  }

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
      ${window.cxTiempos ? `<details class="nota"><summary>Tiempos de arranque</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(window.cxTiempos.texto())}</pre></details>` : ''}
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
    const noSuben = document.getElementById('cx-nosuben-vistos');
    if (noSuben) noSuben.onclick = () => { sincro().descartesVistos(); cuenta(); };
    const resubir = document.getElementById('cx-resubir');
    if (resubir) resubir.onclick = async () => {
      resubir.disabled = true;
      try {
        const r = await sincro().volverASubir();
        const quedan = (r.rechazos || []).length;
        if (r.error) aviso(r.error);
        else if (quedan) aviso(`La nube sigue sin aceptar ${quedan}: ${(r.rechazos[0] && r.rechazos[0].motivo) || 'sin motivo'}. Pulsa «Enviar a la oficina lo que no ha subido».`);
        else aviso(`Subido: ${r.subidas || 0} cambio${r.subidas === 1 ? '' : 's'}.`, 'bien');
      } catch (e) { aviso(e.message); }
      cuenta();
    };
    const rescate = document.getElementById('cx-rescate');
    if (rescate) rescate.onclick = async () => {
      rescate.disabled = true;
      const nota = document.getElementById('cx-rescate-nota');
      try {
        const r = await sincro().rescate((hechos, total) => { if (nota) nota.textContent = `Enviando ${hechos} de ${total}…`; });
        aviso(`Enviado a la oficina: ${r.filas} fila${r.filas === 1 ? '' : 's'} y ${r.fotos} foto${r.fotos === 1 ? '' : 's'}${r.fallidas ? ` (${r.fallidas} fotos no pudieron)` : ''}.`, 'bien');
      } catch (e) { aviso(e.sinRed ? 'Sin conexión: vuelve a pulsarlo con cobertura.' : e.message); }
      cuenta();
    };
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
    /* El error de verdad, no «Conectando» (5-nov-2026, JC): si la última vuelta
       falló, la pastilla lo dice mientras vuelve a intentarlo. */
    const fallo = e.error ? String(e.error).replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!e.entrado || e.estado === 'sin-sesion') {
      if (Date.now() - ARRANQUE < PACIENCIA) return fallo ? ['error', fallo] : ['', 'Conectando'];
      return e.estado === 'sin-sesion' && e.entrado ? ['sin-sesion', 'Sin sesión'] : ['sin-red', `Solo en el móvil${pend}`];
    }
    /* Con red pero sin respuesta de la nube a tiempo (6-nov-2026, JC veía «Sin
       conexión» con cobertura): «Nube lenta». Sin red de verdad, lo de siempre. */
    const sinRedDeVerdad = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (e.estado === 'sin-red') return ['sin-red', e.lenta && !sinRedDeVerdad ? `Nube lenta${pend}` : `Sin conexión${pend}`];
    if (e.estado === 'error') return ['error', fallo || `No sincroniza${pend}`];
    /* Lo pesado (firmas, imágenes de planos) sigue bajando detrás (motor.js, 5-nov-2026). */
    const t = e.trayendo;
    if (t && t.total && t.hechas < t.total) return ['', `Bajando ${Math.round((t.hechas / t.total) * 100)} %${pend}`];
    /* PASTILLA HONESTA (13-nov-2026, JC: «Sincronizado» con fichas, fotos y
       firmas sin subir desde el 6-nov): lo rechazado, lo descartado y lo que
       perdió al mezclar no cuenta como pendiente, pero tampoco ha llegado. */
    const atasco = atascos();
    if (e.estado === 'al-dia' && atasco) return ['error', `${atasco} sin subir${pend}`];
    if (e.estado === 'al-dia') return n ? ['sin-red', cambios(n)] : ['al-dia', 'Sincronizado'];
    return fallo ? ['error', fallo] : ['', 'Conectando'];
  }
  /* Lo que no ha llegado a la nube y no se reintenta solo (motor.sinSubir). */
  function atascos() {
    const s = sincro();
    if (!s || !s.sinSubir) return 0;
    try { const x = s.sinSubir(); return x ? (x.rechazos || 0) + (x.descartadas || 0) + (x.conflictos || 0) : 0; } catch { return 0; }
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
      b.onclick = () => {
        const alAtasco = () => { const a = document.getElementById('cx-atascos'); if (a && atascos()) a.scrollIntoView({ block: 'start' }); };
        if (location.hash !== '#cuenta') { location.hash = 'cuenta'; setTimeout(alAtasco, 50); } else { cuenta(); alAtasco(); }
      };
      fila.insertBefore(b, document.getElementById('quien'));
    }
    const e = s.estado();
    /* Mientras da la vuelta se queda lo que había (sin parpadear cada 30 s). */
    if (e.estado === 'sincronizando' && ultimaClase !== null) { b.classList.add('girando'); return; }
    const [clase, texto] = textoSync(e);
    ultimaClase = clase;
    b.className = `sync-pastilla ${clase}`;
    b.innerHTML = `<span class="sync-texto">${esc(texto)}</span>`;
    b.title = texto;
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
        ${atascos() ? `<div class="fila-dato"><span>Sin subir (no se reintenta solo)</span><strong>${atascos()}</strong></div>` : ''}
        <div class="fila-dato"><span>Aviso al momento</span><strong>${e.tiempoReal ? 'Conectado' : 'Cada 30 segundos'}</strong></div>
        ${e.error && e.estado === 'error' ? `<div class="fila-dato"><span>Error</span><strong>${esc(e.error)}</strong></div>` : ''}
      </section>
      ${conflictosSync(e)}
      ${noSubeSync(e)}
      ${atascosSync()}`;
  }

  /* LO QUE NO HA SUBIDO (13-nov-2026): lo que la nube rechazó, con lo que
     contestó, y los dos botones: volver a ponerlo en la cola, y la copia de
     seguridad que va a la oficina por otro camino (shared/sync/rescate.js),
     que no escribe en las tablas y no puede fallar por lo mismo. */
  function atascosSync() {
    const s = sincro();
    if (!s || !s.rescate) return '';
    const rech = s.rechazos ? s.rechazos() : [];
    const filas = rech.slice(0, 30).map((r) => `<li><strong>${esc(r.tabla)}</strong> <span class="tenue">${esc(r.id)} · ${r.intentos} intento${r.intentos === 1 ? '' : 's'}</span>${r.motivo ? `<br><span class="tenue">${esc(String(r.motivo).slice(0, 160))}</span>` : ''}</li>`).join('');
    const hay = atascos();
    return `
      <section class="grupo" id="cx-atascos">
        <div class="fila-dato"><span>La nube no lo ha aceptado</span><strong>${rech.length}</strong></div>
        ${filas ? `<ul class="lista-conflictos">${filas}</ul>` : ''}
        ${hay ? '<button class="boton" id="cx-resubir">Volver a subir</button>' : ''}
        <button class="boton${hay ? ' secundario' : ''}" id="cx-rescate">Enviar a la oficina lo que no ha subido</button>
        <p class="nota" id="cx-rescate-nota">Manda a la oficina una copia de todo lo de este teléfono que no consta en la nube (fichas, tomas de datos, fotos y firmas). No cambia nada de lo que ya hay allí.</p>
      </section>`;
  }

  /* Lo que este usuario no puede cambiar en la nube (cx_permisos; el operario
     en la ficha del equipo, la solo consulta) o que la nube rechazó 6 veces:
     no se reintenta sin fin; se dice aquí y se queda en este teléfono. */
  function noSubeSync(e) {
    const s = sincro();
    if (!s || !s.descartes || (!e.descartadas && !e.bloqueadas)) return '';
    const filas = [...s.descartes(), ...s.bloqueos()].slice(0, 30).map((d) => `<li><strong>${esc(d.tabla)}</strong> <span class="tenue">${esc(d.id)}</span></li>`).join('');
    return `
      <section class="grupo" id="cx-nosuben">
        ${e.descartadas ? `<div class="fila-dato"><span>Cambios que tu usuario no puede enviar</span><strong>${e.descartadas}</strong></div>` : ''}
        ${e.bloqueadas ? `<div class="fila-dato"><span>La oficina no los acepta (se reintenta si los cambias)</span><strong>${e.bloqueadas}</strong></div>` : ''}
        <ul class="lista-conflictos">${filas}</ul>
        <p class="nota">Se quedan solo en este teléfono. Si hace falta, pide a tu jefe de obra que los haga.</p>
        ${e.descartadas ? '<button class="boton secundario" id="cx-nosuben-vistos">Entendido</button>' : ''}
      </section>`;
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
  window.addEventListener('hashchange', pintar);
  pintar();
})();
