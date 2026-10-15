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
 *     Commissioning = Equipos | Estanqueidad (la prueba es parte del
 *     commissioning); Incidencias = Partes | NCR; Más = Notas (el bloc) |
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
      secciones: [['inicio', 'Inicio']] },
    { id: 'commissioning', nombre: 'Commissioning',
      icono: icono('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/><path d="M4 19h16"/>',
        `<path d="M4 15a8 8 0 1 1 16 0z" fill="currentColor"/><path d="M12 15l4.5-4.5" ${HUECO}/><path d="M4 19h16"/>`),
      secciones: [['commissioning', 'Equipos'], ['estanqueidad', 'Estanqueidad']] },
    { id: 'incidencias', nombre: 'Incidencias',
      icono: icono('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
        `<path d="M12 3.5 2.8 19.5h18.4z" fill="currentColor"/><path d="M12 10v4" ${HUECO} stroke-width="2.2"/><path d="M12 16.9v.1" ${HUECO} stroke-width="2.4"/>`),
      secciones: [['partes', 'Partes'], ['ncr', 'NCR']] },
    /* El Bloc vive en «Más», el primero; las compras, detrás. */
    { id: 'mas', nombre: 'Más',
      icono: icono('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
        '<g fill="currentColor"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></g>'),
      secciones: [['bloc', 'Notas'], ['albaranes', 'Albaranes'], ['inventario', 'Inventario'], ['personal', 'Personal'], ['cuenta', 'Cuenta']] },
  ];
  const MAS = svg('<path d="M12 5v14M5 12h14" stroke-width="2.6"/>');

  /*
   * LO QUE OFRECE EL «+»: atajos a lo que más se hace en obra. Cada uno lleva
   * a su sección y pulsa allí su botón de «nuevo» (en cuanto aparece), así que
   * el permiso lo sigue decidiendo la sección y el ordenador. Solo salen los
   * de las secciones del rol; los que van a una obra dicen cuál.
   */
  const ACCIONES = [
    { seccion: 'ncr', nombre: 'Nueva NCR', ayuda: 'No conformidad con foto', obra: true, pasos: ['[data-ncr="nueva"]'],
      icono: svg('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>') },
    { seccion: 'bloc', nombre: 'Nota rápida', ayuda: 'Con foto, en tu bloc', obra: false, pasos: ['[data-bl="nueva"]', '[data-bl="camara"]'],
      icono: svg('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>') },
    { seccion: 'albaranes', nombre: 'Escanear albarán', ayuda: 'Foto del albarán; casa con su pedido', obra: false, pasos: ['[data-accion="foto"]'],
      icono: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9h8M8 12h8M8 15h5"/>') },
    { seccion: 'commissioning', nombre: 'Medir equipo', ayuda: 'Busca el equipo y mide boca a boca', obra: true, pasos: ['[data-cx-buscar]'],
      icono: svg('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.5-4.5"/><circle cx="12" cy="15" r="1.4"/><path d="M4 19h16"/>') },
    { seccion: 'estanqueidad', nombre: 'Prueba de estanqueidad', ayuda: 'Con la foto del manómetro', obra: true, pasos: ['[data-pe="nuevo"]'],
      icono: svg('<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/>') },
    { seccion: 'partes', nombre: 'Parte', ayuda: 'Parte de incidencia al jefe de obra', obra: true, pasos: ['[data-pi="nuevo"]'],
      icono: svg('<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z"/><path d="M14 3.5v5h5"/><path d="M12 11v4M12 17.5v.1"/>') },
  ];

  /* El título de cada sección, arriba. */
  const TITULO = {
    inicio: 'Inicio', commissioning: 'Commissioning', partes: 'Partes de incidencia', ncr: 'No conformidades', albaranes: 'Albaranes',
    inventario: 'Inventario', bloc: 'Bloc de notas', personal: 'Personal', estanqueidad: 'Pruebas de estanqueidad', cuenta: 'Cuenta',
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

  /* El PDF, por la hoja de compartir del teléfono (correo, AirDrop, Archivos); si no hay, se descarga. */
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
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: nombre }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
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
      fetch(url).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) img.src = URL.createObjectURL(b); }).catch(() => {});
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
      const cuerpo = envolver(fs.slice(0, tope).map(o.fila).join(''))
        + (mas > 0 ? `<button class="ver-mas" data-lista-mas="${esc(clave)}" data-grupo="${esc(g)}">Ver ${Math.min(mas, POR_GRUPO)} más <small>(quedan ${mas})</small></button>` : '');
      const abierto = st.abiertos.has(g) ? st.abiertos.get(g) : (solo || o.buscando);
      return `<details class="grupo-lista" data-lista="${esc(clave)}" data-grupo="${esc(g)}" ${abierto ? 'open' : ''}>
        <summary><span>${esc(g || 'Todo')}</span><b class="contador">${cifra(fs.length)}</b></summary>${cuerpo}</details>`;
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

  window.CX = {
    esc, pedir, postJson, aviso, subirFoto, elegirFoto, cargarImagenes, fechaEs, cifra, compartirPdf,
    listaAgrupada, reiniciarLista,
    obra: () => obras.find((o) => o.id === obraId) || null,
    obraId: () => obraId,
    obras: () => obras,
    obrasListas: () => obrasListas,
    activa: (s) => seccion() === s,
    abrirAnadir: () => abrirHoja(),
  };

  /* ═══════════════════════════════════ Las pestañas */

  function pintar() {
    const s = seccion();
    const ok = new Set(permitidas());
    const actual = pestanaDe(s);
    const abajo = document.getElementById('barra-inferior');
    if (abajo) {
      const boton = (p) => {
        const visibles = p.secciones.filter(([id]) => ok.has(id));
        if (!visibles.length) return '';
        /* Al volver a una pestaña, la última sección que se usó en ella. */
        let destino = visibles[0][0];
        try { const u = localStorage.getItem(`movil.pestana.${p.id}`); if (u && visibles.some(([id]) => id === u)) destino = u; } catch { /* nada */ }
        if (actual === p) destino = s;
        return `<a href="#${destino}" class="${actual === p ? 'activa' : ''}" ${actual === p ? 'aria-current="page"' : ''}>${p.icono}<span>${esc(p.nombre)}</span></a>`;
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
      const visibles = actual ? actual.secciones.filter(([id]) => ok.has(id)) : [];
      seg.hidden = visibles.length < 2;
      seg.innerHTML = visibles.map(([id, nombre]) => `<a href="#${id}" class="${id === s ? 'activa' : ''}" ${id === s ? 'aria-current="page"' : ''}>${esc(nombre)}</a>`).join('');
    }
    const t = document.getElementById('titulo-seccion');
    /* En Inicio, el saludo hace de título (15-oct-2026, JC). */
    const nombrePila = sesion() && sesion().nombre ? String(sesion().nombre).trim().split(/\s+/).slice(0, 2).join(' ') : '';
    if (t) t.textContent = s === 'inicio' && nombrePila ? `Hola, ${nombrePila}` : (TITULO[s] || 'Cx Obra');
    document.title = `${TITULO[s] || 'Inicio'} · Cx Obra`;
    const caja = document.getElementById('obra-movil-caja');
    /* En Inicio la obra se elige en su tarjeta: arriba sobraría. */
    if (caja) caja.hidden = !sesion() || SIN_OBRA.has(s) || s === 'inicio' || !obras.length;
    if (actual) { try { localStorage.setItem(`movil.pestana.${actual.id}`, s); } catch { /* nada */ } }
    if (s === 'cuenta') cuenta();
    if (s === 'inicio') inicio();
  }

  /* ═══════════════════════════════════ El «+»: la hoja de Añadir */

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
      <ul>${lista.map((a, i) => {
        const falta = a.obra && !o;
        return `<li><button class="accion-rapida" data-rapida="${i}" ${falta ? 'disabled' : ''}><span class="ico">${a.icono}</span><span><b>${esc(a.nombre)}</b><small>${falta ? 'Elige antes una obra' : esc(a.ayuda)}</small></span></button></li>`;
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
    const [cx, pe, pi, ncr] = await Promise.all([
      traer('commissioning', `api/commissioning?obra=${q}`), traer('estanqueidad', 'api/estanqueidad'),
      traer('partes', 'api/partes'), traer('ncr', `api/ncr?obra=${q}`),
    ]);
    if (seccion() !== 'inicio' || window.CX.obraId() !== o.id) return;
    // Como la lista de Commissioning: si hay conjuntos (split = UE + UI), se cuenta por conjunto.
    const tc = cx && cx.ok && cx.totalesConjuntos && cx.totalesConjuntos.conjuntos ? cx.totalesConjuntos : null;
    const t = cx && cx.ok && cx.totales ? (tc ? { ...cx.totales, ...tc, equipos: tc.conjuntos } : cx.totales) : null;
    const hechos = t ? (t.completos || 0) : 0;
    const pct = t && t.equipos ? Math.round((hechos / t.equipos) * 100) : 0;
    const bocas = cx && cx.equipos ? cx.equipos.reduce((a, e) => [a[0] + (e.medidas || 0), a[1] + (e.bocas || 0)], [0, 0]) : [0, 0];
    const pruebas = pe && pe.recientes ? pe.recientes.filter((p) => p.obraId === o.id) : null;
    const partes = pi && pi.recientes ? pi.recientes.filter((p) => p.obraId === o.id && p.estado !== 'cerrado') : null;
    const ncrAbiertas = ncr && ncr.ok ? ncr.filas.filter((f) => f.activa) : null;
    const dato = (href, valor, texto, aviso, seg = 'todos') => `<a class="${aviso ? 'aviso' : ''}" href="#${href}" data-ir-seg="${seg}"><b>${cifra(valor)}</b><span>${esc(texto)}</span></a>`;
    /* Lo pendiente son los equipos que piden estanqueidad y no la tienen, no las
       pruebas apuntadas: sin ninguna hecha, faltan todas (15-oct, JC). */
    const textoEstanqueidad = (tt, ps) => {
      const falta = tt && tt.pideEstanqueidad ? tt.faltaEstanqueidad || 0 : null;
      const mal = ps ? ps.filter((p) => p.resultado !== 'correcta').length : 0;
      const partes = [];
      if (falta !== null) partes.push(falta ? `faltan ${cifra(falta)} de ${cifra(tt.pideEstanqueidad)}` : 'todas hechas');
      if (mal) partes.push(`${cifra(mal)} sin superar`);
      if (!partes.length) partes.push(ps && ps.length ? `${cifra(ps.length)} hechas` : 'Ninguna hecha');
      return partes.join(' · ');
    };
    const fila = (href, nombre, valor, aviso) => `<a class="fila-dato${aviso ? ' aviso' : ''}" href="#${href}"><span>${esc(nombre)}</span><strong>${valor} ›</strong></a>`;
    app.innerHTML = `
      <section class="grupo inicio-obra">
        <label class="fila-dato selector-obra"><span>Obra</span>
          <select data-inicio-obra aria-label="Obra">${obras.map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select>
        </label>
      </section>
      ${t ? `
      <h2 class="titulo-grupo">Commissioning</h2>
      <section class="grupo inicio-avance">
        <div class="fila-dato"><span>Equipos completos</span><strong>${cifra(hechos)} de ${cifra(t.equipos)} · ${pct} %</strong></div>
        <div class="progreso" aria-label="${pct} % completo"><i style="width:${pct}%"></i></div>
      </section>
      <div class="resumen-fila">
        ${dato('commissioning', t.equipos, 'equipos')}
        ${dato('commissioning', t.faltaDocumentacion, 'falta doc.', t.faltaDocumentacion, 'faltaDoc')}
        ${dato('commissioning', t.faltaEnsayo, 'falta ensayo', t.faltaEnsayo, 'faltaEnsayo')}
        ${dato('commissioning', bocas[1] - bocas[0], 'bocas por medir', bocas[1] - bocas[0])}
      </div>` : ''}
      <h2 class="titulo-grupo">Pendiente</h2>
      <section class="grupo">
        ${pruebas || (t && t.pideEstanqueidad) ? fila('estanqueidad', 'Pruebas de estanqueidad', textoEstanqueidad(t, pruebas), (t && t.faltaEstanqueidad) || (pruebas && pruebas.some((p) => p.resultado !== 'correcta'))) : ''}
        ${partes ? fila('partes', 'Partes abiertos', cifra(partes.length)) : ''}
        ${ncrAbiertas ? fila('ncr', 'No conformidades abiertas', cifra(ncrAbiertas.length)) : ''}
      </section>`;
    /* Sin botón «Añadir…»: ya está el + de la barra (15-oct, JC). */
    for (const a of app.querySelectorAll('[data-ir-seg]')) a.onclick = () => { try { sessionStorage.setItem('cx.segmento', a.dataset.irSeg); } catch { /* nada */ } };
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
        ? 'Todo se guarda en este teléfono; funciona sin red.'
        : 'Los datos están en el ordenador de la oficina y se llega a él por la wifi: con el ordenador apagado o fuera de su red, la app no puede traer ni guardar nada.'}</p>
      ${yo.local && window.cxObra && window.cxObra.traerDatos ? conLaOficina() : ''}
      ${yo.local && !(window.cxObra && window.cxObra.salir) ? '' : '<button class="boton secundario" id="cx-salir">Salir</button>'}
      <p class="nota pie">Cx Obra${window.cxObra && window.cxObra.ota ? ` · versión ${esc(window.cxObra.ota.info().version)}${window.cxObra.ota.info().lista ? ` (la ${esc(window.cxObra.ota.info().lista)} entra al volver a abrir)` : ''}` : ''}</p>`;
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
  }

  /* Cx Obra nativa: los datos llegan de la oficina en un fichero y lo hecho
     en obra vuelve igual (cxobra/puerta.js, shared/movil/paquete.js). */
  function conLaOficina() {
    const e = window.cxObra.estado();
    const dia = (iso) => (iso ? fechaEs(iso) : '—');
    return `
      <section class="grupo">
        <div class="fila-dato"><span>Datos de la oficina</span><strong>${e.ejemplo ? 'De ejemplo' : dia(e.recibido)}</strong></div>
        <div class="fila-dato"><span>Enviado a la oficina</span><strong>${dia(e.enviado)}</strong></div>
        <div class="fila-dato"><span>Pendiente de enviar</span><strong>${e.pendientes} cambio${e.pendientes === 1 ? '' : 's'}</strong></div>
      </section>
      <button class="boton" id="cx-enviar"${e.ejemplo ? ' disabled' : ''}>Enviar a la oficina</button>
      <button class="boton secundario" id="cx-traer">Traer mis datos de la oficina</button>
      <p class="nota">«Enviar» prepara un fichero con lo que has hecho (NCR, notas, albaranes, mediciones, partes, fichajes) para mandarlo por AirDrop o correo; en el ordenador se abre en Personas › La app del móvil. Las fotos van dentro.</p>`;
  }

  /* ═══════════════════════════════════ Arranque */

  document.getElementById('obra-movil').addEventListener('change', (ev) => ponerObra(ev.target.value));
  document.addEventListener('change', (ev) => { if (ev.target.matches('[data-inicio-obra]')) ponerObra(ev.target.value); });
  window.addEventListener('hashchange', pintar);
  pintar();
})();
