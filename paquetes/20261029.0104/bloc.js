'use strict';
/*
 * BLOC DE NOTAS EN EL MÓVIL (#bloc).
 *
 * Las notas son de cada uno (las mismas que su bloc del escritorio). Salen
 * las de la obra elegida y las generales; las fijadas, arriba. Una nota puede
 * llevar fotos: el ordenador las guarda en la carpeta del bloc de quien
 * escribe y las marca en el texto como «[foto:xxxx.jpg]»; aquí esas marcas
 * no se ven en el texto, se ven como fotos debajo.
 */
(function bloc() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc } = C;
  const activa = () => C.activa('bloc');
  const RE_FOTO = /\[foto:[A-Za-z0-9_-]{8,40}\.(?:jpg|png|heic|heif|webp)\]/g;
  const sinFotos = (t) => String(t || '').replace(RE_FOTO, '').replace(/\n{3,}/g, '\n\n').trim();

  let notas = [];
  let editando = null;
  /*
   * AUTOGUARDADO (JC, 28-oct: «en toda la app»): la nota se guarda sola
   * (~1,2 s sin escribir, al volver a la lista, al salir de la app). Mientras,
   * vive en el teléfono (`cx.borrador.bloc.nota`, fotos en IndexedDB): si se
   * cierra la app o no hay red, al volver al bloc se recupera y se manda.
   */
  const AG = window.AUTOGUARDADO || null;
  const COLA = window.COLA_GUARDADO || null;
  const CLAVE = 'bloc.nota.';
  const ESPERA = 1200;
  let reloj = null;
  let enVuelo = null;

  const cuando = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    return d.toDateString() === hoy.toDateString()
      ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  async function lista() {
    if (editando) await guardarYa();
    editando = null;
    await C.obrasListas();
    if (!activa()) return;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/bloc${C.obraId() ? `?obra=${encodeURIComponent(C.obraId())}` : ''}`);
      if (!r.ok) throw new Error(r.error);
      notas = r.notas || [];
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-bl="lista">Reintentar</button></div>`;
      return;
    }
    if (activa() && !editando) pintarLista();
  }

  function pintarLista() {
    const orden = [...notas].sort((a, b) => (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0) || String(b.modificadoEn).localeCompare(String(a.modificadoEn)));
    $app.innerHTML = `
      <button class="boton grande" data-bl="nueva">＋ Nueva nota</button>
      ${orden.length ? C.listaAgrupada('bloc', orden, { repintar: pintarLista,
        grupo: orden.length > 20 ? (n) => (n.fijada ? 'Fijadas' : n.obra || 'General') : null,
        fila: (n) => {
        const t = sinFotos(n.texto);
        const [primera, ...resto] = t.split('\n');
        return `<li><button class="fila-ios" data-bl="abrir" data-id="${esc(n.id)}">
          <div class="fila-principal"><strong>${n.fijada ? '<i class="ic ic-chincheta"></i>' : ''}${esc(primera || (n.fotos.length ? 'Foto' : 'Nota'))}</strong><span class="sub">${esc(cuando(n.modificadoEn))}</span></div>
          ${resto.join(' ').trim() ? `<div class="texto-2 sub">${esc(resto.join(' ').trim())}</div>` : ''}
          <div class="sub">${esc(n.obra || 'General')}${n.fotos.length ? ` · ${n.fotos.length} foto${n.fotos.length === 1 ? '' : 's'}` : ''}</div>
        </button></li>`;
      } }) : '<p class="vacio">Sin notas todavía. Lo que apuntes aquí también sale en el bloc del ordenador.</p>'}`;
  }

  function abrir(n) {
    editando = n
      ? { id: n.id, texto: sinFotos(n.texto), marcas: n.texto.match(RE_FOTO) || [], fotos: n.fotos, fijada: Boolean(n.fijada), deObra: Boolean(n.obraId), nuevas: [], obraId: n.obraId || null }
      : { id: null, texto: '', marcas: [], fotos: [], fijada: false, deObra: Boolean(C.obraId()), nuevas: [], obraId: C.obraId() || null };
    editando.estado = '';
    editando.clave = `${CLAVE}${n ? n.id : `n${Date.now().toString(36)}`}`;
    pintarEditor();
    if (!n) { const t = $app.querySelector('textarea'); if (t) t.focus(); }
  }

  function pintarEditor() {
    const e = editando;
    const o = C.obra();
    $app.innerHTML = `
      <div class="barra-editor">
        <button class="volver" data-bl="lista">‹ Notas</button>
        ${marca(e)}
      </div>
      <textarea class="editor-nota" rows="12" data-bl-texto placeholder="Escribe aquí…">${esc(e.texto)}</textarea>
      ${e.fotos.length || e.nuevas.length ? `<div class="fotos">
        ${e.fotos.map((f) => `<img data-src="api/bloc/foto?f=${encodeURIComponent(f)}" alt="">`).join('')}
        ${e.nuevas.map((x) => (x.url ? `<img src="${esc(x.url)}" alt="">` : '<span class="foto-sin-vista">guardada en el móvil</span>')).join('')}
      </div>` : ''}
      <div class="fila-botones">
        <button class="boton secundario" data-bl="camara"><i class="ic ic-camara"></i>Foto</button>
        <button class="boton secundario" data-bl="galeria">De la galería</button>
      </div>
      <section class="grupo">
        <label class="fila-dato interruptor"><span>Fijada arriba</span><input type="checkbox" data-bl-fijada ${e.fijada ? 'checked' : ''}></label>
        ${o ? `<label class="fila-dato interruptor"><span>De la obra ${esc(o.codigo)}</span><input type="checkbox" data-bl-obra ${e.deObra ? 'checked' : ''}></label>` : ''}
      </section>
      ${e.id ? '<button class="boton peligro" data-bl="borrar">Borrar nota</button>' : ''}`;
    C.cargarImagenes($app);
  }

  const TEXTO = { guardando: 'Guardando…', guardado: 'Guardado', movil: 'Guardado en el móvil', sinRed: 'Sin conexión, se guardará', error: 'No se ha guardado' };
  const marca = (e) => `<span class="autoguardado ${esc(e.estado || '')}" role="status" aria-live="polite">${esc(TEXTO[e.estado] || '')}</span>`;
  function pintarMarca(e) {
    const el = $app.querySelector && $app.querySelector('.barra-editor .autoguardado');
    if (el && e === editando) { el.className = `autoguardado ${e.estado || ''}`; el.textContent = TEXTO[e.estado] || ''; }
  }

  async function foto(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !editando) return;
    const e = editando;
    const x = AG ? await AG.fotoNueva(archivo, { id: null }) : { id: null, archivo, url: URL.createObjectURL(archivo) };
    e.nuevas.push(x);
    cambio(e);
    if (e === editando) pintarEditor();
  }

  /* Lo que queda en el teléfono: el texto, las marcas y las fotos sin mandar. */
  function apuntar(e) {
    if (!AG) return;
    if (!e.sucia) { AG.borrar(e.clave); return; }
    AG.guardar(e.clave, { id: e.id, texto: e.texto, marcas: e.marcas, fotos: AG.fotosParaGuardar(e.nuevas), fijada: e.fijada, deObra: e.deObra, obraId: e.obraId });
  }
  function cambio(e) {
    e.sucia = true;
    e.estado = 'movil';
    apuntar(e);
    pintarMarca(e);
    clearTimeout(reloj);
    reloj = setTimeout(() => { reloj = null; mandar(e); }, ESPERA);
  }
  /* Manda la nota al ordenador. Devuelve true si queda guardada. */
  async function mandar(e) {
    if (enVuelo) { await enVuelo.catch(() => {}); if (!e.sucia) return true; }
    const texto = [e.texto.trim(), ...e.marcas].filter(Boolean).join('\n');
    if (!texto && !e.nuevas.length) { e.sucia = false; apuntar(e); return true; }
    const vuelo = (async () => {
      const antes = e.texto;
      const nuevas = [...e.nuevas];
      e.estado = 'guardando'; pintarMarca(e);
      try {
        for (const x of nuevas) {
          if (x.id) continue;
          const blob = x.archivo || (AG && x.local ? await AG.leerFoto(x.local) : null);
          if (!blob) { e.nuevas = e.nuevas.filter((y) => y !== x); continue; }
          x.archivo = blob;
          x.id = await C.subirFoto(blob);
        }
        const cuerpo = () => ({ id: e.id || undefined, texto, fijada: e.fijada, obraId: e.deObra ? (e.obraId || C.obraId()) : null, fotos: nuevas.filter((x) => x.id).map((x) => x.id) });
        let r = await C.postJson('api/bloc', cuerpo());
        if (!r.ok && /ya no está/i.test(String(r.error || ''))) {
          /* El ordenador olvidó las fotos en espera: se suben otra vez desde el teléfono. */
          for (const x of nuevas) { const blob = x.archivo || (AG && x.local ? await AG.leerFoto(x.local) : null); if (blob) x.id = await C.subirFoto(blob); }
          r = await C.postJson('api/bloc', cuerpo());
        }
        if (!r.ok) throw new Error(r.error);
        e.id = r.id;
        if (nuevas.length) {
          /* Las fotos ya son de la nota: se traen sus marcas para no mandarlas otra vez. */
          e.nuevas = e.nuevas.filter((x) => !nuevas.includes(x));
          for (const x of nuevas) { if (AG && x.local) AG.borrarFoto(x.local); }
          try {
            const l = await C.pedir(`api/bloc${C.obraId() ? `?obra=${encodeURIComponent(C.obraId())}` : ''}`);
            const n = l.ok && (l.notas || []).find((y) => y.id === e.id);
            if (n) { e.marcas = n.texto.match(RE_FOTO) || []; e.fotos = n.fotos; notas = l.notas; }
          } catch { /* se verán al volver a la lista */ }
        }
        e.sucia = e.texto !== antes || e.nuevas.length > 0;
        e.estado = e.sucia ? 'movil' : 'guardado';
        apuntar(e);
        pintarMarca(e);
        if (nuevas.length && e === editando && activa() && !escribiendo()) pintarEditor();
        return true;
      } catch (err) {
        e.estado = AG && AG.sinRed(err) ? 'sinRed' : 'error';
        pintarMarca(e);
        if (e.estado === 'error') C.aviso(err.message);
        if (COLA) COLA.masTarde();
        return false;
      }
    })();
    enVuelo = vuelo;
    try { return await vuelo; } finally { if (enVuelo === vuelo) enVuelo = null; }
  }
  const escribiendo = () => { const a = document.activeElement; return Boolean(a && /^(INPUT|TEXTAREA)$/.test(String(a.tagName || ''))); };
  function guardarYa() {
    clearTimeout(reloj); reloj = null;
    const e = editando;
    return e && e.sucia ? mandar(e) : Promise.resolve(true);
  }
  /* La cola: una nota que quedó en el teléfono (app cerrada o sin red) se manda sola. */
  async function enviarPendiente(clave, b) {
    if (editando && editando.clave === clave) return editando.sucia ? mandar(editando) : true;
    const e = { clave, id: b.id || null, texto: b.texto || '', marcas: b.marcas || [], fotos: [], fijada: Boolean(b.fijada), deObra: Boolean(b.deObra), obraId: b.obraId || null, nuevas: AG ? await AG.restaurarFotos(b.fotos || []) : [], sucia: true };
    e.nuevas = e.nuevas.filter((x) => x.id || x.archivo);
    return mandar(e);
  }

  async function borrar(boton) {
    if (!window.confirm('¿Borrar esta nota y sus fotos?')) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/bloc/borrar', { id: editando.id });
      if (!r.ok) throw new Error(r.error);
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-bl]');
    if (!b) return;
    const a = b.dataset.bl;
    if (a === 'lista') lista();
    else if (a === 'nueva') abrir(null);
    else if (a === 'abrir') abrir(notas.find((n) => n.id === b.dataset.id));
    else if (a === 'camara') foto(true);
    else if (a === 'galeria') foto(false);
    else if (a === 'guardar') guardarYa();
    else if (a === 'borrar') borrar(b);
  });
  $app.addEventListener('input', (ev) => { if (activa() && editando && ev.target.hasAttribute('data-bl-texto')) { editando.texto = ev.target.value; cambio(editando); } });
  $app.addEventListener('change', (ev) => {
    if (!activa() || !editando) return;
    if (ev.target.hasAttribute('data-bl-fijada')) { editando.fijada = ev.target.checked; cambio(editando); }
    if (ev.target.hasAttribute('data-bl-obra')) { editando.deObra = ev.target.checked; cambio(editando); }
  });
  if (AG) AG.alSalir(() => { guardarYa(); });
  if (COLA) COLA.registrar(CLAVE, enviarPendiente);

  window.addEventListener('movil:obra', () => { if (activa() && !editando) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); else if (editando) { guardarYa(); editando = null; } });
  if (activa()) lista();
})();
