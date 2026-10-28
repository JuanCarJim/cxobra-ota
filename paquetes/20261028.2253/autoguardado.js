'use strict';
/*
 * AUTOGUARDADO DEL MÓVIL (28-oct-2026, JC: un encargado subía fotos a una
 * incidencia, pulsó atrás y lo perdió todo. «Autoguardado automático»).
 *
 * Lo que se teclea o se fotografía en un formulario del móvil se queda en el
 * teléfono AL MOMENTO, sin pulsar nada:
 *   · los campos, en un borrador (localStorage, `cx.borrador.<clave>`), que
 *     sobrevive a atrás, al gesto, a cambiar de pestaña y a cerrar la app;
 *   · cada foto, en cuanto se elige, en IndexedDB (`cx-borradores`): aunque
 *     la subida falle o el ordenador olvide la foto en espera, se vuelve a
 *     subir desde aquí.
 * Al volver a la pantalla se recupera («Tienes … sin terminar»). Se borra
 * solo cuando el servidor confirma el alta.
 *
 * El indicador (marca) dice la verdad: «Guardado» solo cuando el servidor lo
 * ha confirmado; lo que solo está en el teléfono dice «Guardado en el móvil»;
 * sin red, «Sin conexión, se guardará».
 *
 * Sin IndexedDB (navegador privado, pruebas) las fotos quedan en memoria:
 * sobreviven a atrás, no a cerrar la app.
 */
(function autoguardado() {
  const PREF = 'cx.borrador.';
  const memoria = new Map();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Los borradores (campos) */
  function guardar(clave, datos) {
    try { localStorage.setItem(PREF + clave, JSON.stringify({ ...datos, _en: Date.now() })); return true; } catch { return false; }
  }
  function leer(clave) {
    try { const t = localStorage.getItem(PREF + clave); return t ? JSON.parse(t) : null; } catch { return null; }
  }
  /* Borra el borrador y sus fotos guardadas en el teléfono. */
  function borrar(clave) {
    const b = leer(clave);
    try { localStorage.removeItem(PREF + clave); } catch { /* sin almacenamiento */ }
    if (b && Array.isArray(b.fotos)) for (const f of b.fotos) if (f && f.local) borrarFoto(f.local);
  }

  /* Quita solo el borrador (las fotos siguen en el teléfono). */
  function olvidar(clave) {
    try { localStorage.removeItem(PREF + clave); } catch { /* sin almacenamiento */ }
  }

  /* ── Las fotos (IndexedDB) */
  let base = null;
  function idb() {
    if (base) return base;
    base = new Promise((ok) => {
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB) { ok(null); return; }
        const r = indexedDB.open('cx-borradores', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('fotos');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
        r.onblocked = () => ok(null);
      } catch { ok(null); }
    });
    return base;
  }
  function tx(modo, fn) {
    return idb().then((db) => new Promise((ok) => {
      if (!db) { ok(undefined); return; }
      try {
        const t = db.transaction('fotos', modo);
        const peticion = fn(t.objectStore('fotos'));
        t.oncomplete = () => ok(peticion ? peticion.result : true);
        t.onerror = () => ok(undefined);
        t.onabort = () => ok(undefined);
      } catch { ok(undefined); }
    }));
  }
  async function guardarFoto(blob) {
    const k = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    memoria.set(k, blob);
    const r = await tx('readwrite', (s) => s.put(blob, k));
    if (r !== undefined) memoria.delete(k);
    return k;
  }
  async function leerFoto(k) {
    if (!k) return null;
    if (memoria.has(k)) return memoria.get(k);
    return (await tx('readonly', (s) => s.get(k))) || null;
  }
  function borrarFoto(k) {
    memoria.delete(k);
    return tx('readwrite', (s) => s.delete(k));
  }
  /* Una foto recién elegida: ya guardada en el teléfono. */
  async function fotoNueva(archivo, extra = {}) {
    let url = '';
    try { url = URL.createObjectURL(archivo); } catch { /* sin vista */ }
    return { ...extra, local: await guardarFoto(archivo), url, archivo };
  }
  /* Las fotos de un borrador, otra vez con su archivo y su vista. */
  async function restaurarFotos(lista) {
    const fuera = [];
    for (const x of lista || []) {
      const archivo = await leerFoto(x.local);
      let url = '';
      if (archivo) { try { url = URL.createObjectURL(archivo); } catch { /* sin vista */ } }
      fuera.push({ ...x, archivo, url });
    }
    return fuera;
  }
  /* Lo que se guarda de cada foto en el borrador (sin el archivo ni la vista). */
  const fotosParaGuardar = (lista) => (lista || []).map(({ archivo, url, subiendo, ...resto }) => resto);

  /* Un id para un alta que se crea desde el teléfono (partes y NCR, 28-oct): el
     mismo en cada reintento, así el servidor nunca la duplica. */
  function nuevoId() {
    try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return `m${crypto.randomUUID().replace(/-/g, '')}`; } catch { /* sin crypto */ }
    return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
  }

  /* ── El indicador */
  const TEXTO = { guardando: 'Guardando…', guardado: 'Guardado', movil: 'Guardado en el móvil', sinRed: 'Sin conexión, se guardará', error: 'No se ha guardado', pendiente: 'Sin guardar' };
  const marca = (estado, texto) => `<span class="autoguardado ${esc(estado)}" role="status" aria-live="polite">${esc(texto || TEXTO[estado] || '')}</span>`;
  function pintarMarca(raiz, estado, texto) {
    const el = raiz && raiz.querySelector ? raiz.querySelector('.autoguardado') : null;
    if (!el) return;
    el.className = `autoguardado ${estado}`;
    el.textContent = texto || TEXTO[estado] || '';
  }
  /* ¿El fallo es de no llegar al servidor (y no un «no» del servidor)? */
  const sinRed = (e) => (typeof navigator !== 'undefined' && navigator && navigator.onLine === false)
    || Boolean(e && (e.name === 'TypeError' || /failed to fetch|load failed|network/i.test(String(e.message || ''))));

  /* Al irse de la app (gesto de inicio, bloquear, cerrar): una última vez. */
  function alSalir(fn) {
    try { window.addEventListener('pagehide', fn); } catch { /* nada */ }
    try {
      if (document && document.addEventListener) {
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') fn(); });
      }
    } catch { /* nada */ }
  }

  /*
   * ELEGIR FOTOS (28-oct, tarea 368b6690): de la galería, varias a la vez;
   * con la cámara, una. Devuelve la lista (vacía si se cancela).
   */
  function elegirFotos(camara = false) {
    return new Promise((ok) => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = 'image/*';
      if (camara) i.setAttribute('capture', 'environment');
      else i.multiple = true;
      i.hidden = true;
      i.onchange = () => { ok(Array.from(i.files || [])); i.remove(); };
      document.body.appendChild(i);
      i.click();
    });
  }

  /*
   * VER UNA FOTO EN GRANDE (28-oct, JC): tocar una foto la abre a pantalla
   * completa. Si aún es del formulario (no está guardada en la ficha), con
   * «Hacer otra» / «Otra de la galería» se REEMPLAZA y con «Quitar» se quita;
   * quien llama guarda el cambio (autoguardado). Atrás o «Cerrar» la cierran.
   */
  let visor = null;
  function cerrarVisor() {
    if (!visor) return;
    try { visor.remove(); } catch { /* nada */ }
    visor = null;
  }
  function verFoto({ url, reemplazar = null, quitar = null } = {}) {
    if (!url && !reemplazar && !quitar) return;
    cerrarVisor();
    const d = document.createElement('div');
    d.className = 'visor-foto';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Foto');
    d.innerHTML = `${url ? `<img src="${esc(url)}" alt="Foto en grande">` : '<p style="color:#fff">Esta foto no se puede enseñar en este teléfono.</p>'}
      <div class="visor-botones">
        ${reemplazar ? '<button type="button" data-visor="camara">Hacer otra</button><button type="button" data-visor="galeria">Otra de la galería</button>' : ''}
        ${quitar ? '<button type="button" data-visor="quitar">Quitar</button>' : ''}
        <button type="button" data-visor="cerrar">Cerrar</button>
      </div>`;
    d.addEventListener('click', async (ev) => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-visor]') : null;
      if (!b) { if (ev.target === d) cerrarVisor(); return; }
      const a = b.dataset.visor;
      if (a === 'cerrar') cerrarVisor();
      else if (a === 'quitar') { cerrarVisor(); quitar(); }
      else if (a === 'camara' || a === 'galeria') {
        const [archivo] = await elegirFotos(a === 'camara');
        if (!archivo) return;
        cerrarVisor();
        await reemplazar(archivo);
      }
    });
    document.body.appendChild(d);
    visor = d;
  }
  try { window.addEventListener('hashchange', cerrarVisor); } catch { /* nada */ }
  /* Las fotos ya guardadas en la ficha (incidencias): tocarlas las abre en grande. */
  try {
    if (document && document.addEventListener) {
      document.addEventListener('click', (ev) => {
        if (!/^#(partes|ncr|reparaciones)$/.test(String((typeof location !== 'undefined' && location.hash) || ''))) return;
        const img = ev.target && ev.target.closest ? ev.target.closest('img') : null;
        if (!img || !img.closest('.fotos') || img.closest('[data-pi],[data-ncr],[data-rp],.visor-foto')) return;
        verFoto({ url: img.currentSrc || img.src });
      });
    }
  } catch { /* nada */ }

  /* Los estilos, aquí para no tocar movil.css. */
  try {
    if (document && document.createElement && document.head) {
      const s = document.createElement('style');
      s.textContent = `
.autoguardado { display: inline-block; font-size: 12.5px; color: var(--textoTenue); margin: 2px 0 6px; }
.autoguardado.guardado { color: var(--bien); }
.autoguardado.guardando { color: var(--acento); }
.autoguardado.sinRed, .autoguardado.pendiente { color: var(--aviso); font-weight: 600; }
.autoguardado.error { color: var(--mal); font-weight: 600; }
.borrador-pendiente { border-left: 3px solid var(--aviso); background: var(--aviso-fondo); padding: 8px 12px; border-radius: 8px; margin: 8px 0 12px; width: fit-content; max-width: 100%; }
.borrador-pendiente p { margin: 0 0 6px; }
#app .borrador-pendiente .fila-botones { margin: 0; }
.visor-foto { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
.visor-foto img { max-width: 100%; max-height: calc(100% - 72px); object-fit: contain; border-radius: 6px; }
.visor-botones { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.visor-botones button { font: inherit; font-size: 15px; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.12); color: #fff; min-height: 44px; }
.fotos img, .fotos .foto-sin-vista { cursor: zoom-in; }
.foto-sin-vista { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 6px; background: var(--panel3); color: var(--textoTenue); font-size: 11px; }`;
      document.head.appendChild(s);
    }
  } catch { /* sin documento (pruebas) */ }

  window.AUTOGUARDADO = {
    guardar, leer, borrar, olvidar, guardarFoto, leerFoto, borrarFoto, fotoNueva, restaurarFotos, fotosParaGuardar,
    marca, pintarMarca, sinRed, alSalir, TEXTO, elegirFotos, verFoto, cerrarVisor, nuevoId,
  };
})();
