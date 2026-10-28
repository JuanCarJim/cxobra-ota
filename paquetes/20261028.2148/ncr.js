'use strict';
/*
 * NO CONFORMIDADES (NCR) EN EL MÓVIL (#ncr, dentro de Incidencias).
 *
 *   1. LA LISTA de la obra: abiertas, cerradas o todas, con su estado, la
 *      prioridad y dónde están.
 *   2. EL ALTA RÁPIDA: qué pasa, dónde (planta y zona), disciplina,
 *      prioridad y las fotos hechas con la cámara. El ordenador le pone el
 *      código y la fecha de detección. Se guarda sola en el ordenador mientras
 *      se escribe («sin terminar») y «Terminar el alta» la da de alta.
 *   3. LA FICHA: los datos, las fotos, los pasos a los que puede ir (el
 *      flujo del escritorio, shared/ncr/motor.js), cerrar y añadir fotos de la
 *      resolución.
 */
(function ncr() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, fechaEs } = C;
  const activa = () => C.activa('ncr');

  let datos = null;
  let filtro = 'abiertas';
  /* El alcance (26-oct-2026): por defecto solo lo NUESTRO (climatización y fontanería). */
  let alcance = 'nuestras';
  const ALC = { nuestras: 'Nuestras', deOtros: 'De otros', sinClasificar: 'Sin clasificar', todas: 'Todas' };
  const dentro = (f, a) => a === 'todas' || (a === 'nuestras' ? f.alcance === 'nuestra' : a === 'deOtros' ? f.alcance === 'deOtros' : !f.alcance);
  let texto = '';
  let form = null;
  let abierta = null;
  /* Desde una cifra del Inicio (28-oct): «vencidas» o «urgentes», sobre las abiertas nuestras. */
  let solo = null;
  const SOLO = { vencidas: ['Solo vencidas', (f) => f.vencida], urgentes: ['Solo urgentes (A)', (f) => f.prioridad === 'A'] };

  const PRIORIDAD = { A: 'mal', B: 'aviso', C: 'neutra' };
  const chipEstado = (n) => `<span class="chip ${n.activa ? 'aviso' : 'bien'}">${esc(n.estadoNombre)}</span>`;
  const chipPrioridad = (p) => (p ? `<span class="chip ${PRIORIDAD[p] || 'neutra'}">${esc(p)}</span>` : '');

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    if (form && pendiente(form)) guardarServidor(form);
    form = null; abierta = null;
    try {
      const v = sessionStorage.getItem('ncr.filtro');
      if (v) { sessionStorage.removeItem('ncr.filtro'); filtro = 'abiertas'; alcance = 'nuestras'; solo = SOLO[v] ? v : null; texto = ''; }
    } catch { /* nada */ }
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await C.pedir(`api/ncr?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-ncr="lista">Reintentar</button></div>`;
      return;
    }
    if (activa() && !form && !abierta) pintarLista();
  }

  function pintarLista() {
    const todasLasFilas = datos.filas || [];
    const filas = todasLasFilas.filter((f) => dentro(f, alcance));
    const abiertas = filas.filter((f) => f.activa).length;
    const fuera = todasLasFilas.filter((f) => f.activa && !dentro(f, 'nuestras'));
    const deOtros = fuera.filter((f) => f.alcance === 'deOtros').length;
    const sinClas = fuera.length - deOtros;
    const q = texto.trim().toLowerCase();
    const vistas = filas.filter((f) => (filtro === 'todas' ? true : filtro === 'abiertas' ? f.activa : !f.activa))
      .filter((f) => !solo || SOLO[solo][1](f))
      .filter((f) => !q || `${f.codigo} ${f.descripcion || ''} ${f.planta || ''} ${f.zona || ''}`.toLowerCase().includes(q));
    const b = AG.leer(clave());
    $app.innerHTML = `
      ${conContenido(b) ? `<section class="borrador-pendiente" role="status">
        <p><strong>Tienes una NCR sin terminar</strong><br><small>${esc([b.codigo, String(b.descripcion || '').slice(0, 60), (b.fotos || []).length ? `${b.fotos.length} foto${b.fotos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Sin texto')}</small>
        <br><small>${pendiente(b) ? 'Aún no ha llegado entera al ordenador: se subirá sola con conexión.' : b.enServidor ? 'Guardada en el ordenador como «sin terminar».' : 'Solo en este teléfono.'}</small></p>
        <div class="fila-botones"><button class="boton" data-ncr="seguir">Seguir con ella</button><button class="boton secundario" data-ncr="descartar">Descartar</button></div>
      </section>` : ''}
      ${datos.puede && datos.puede.crear ? '<button class="boton grande" data-ncr="nueva">＋ Nueva NCR</button>' : ''}
      <div class="segmentado" role="tablist">
        ${[['abiertas', `Abiertas ${abiertas}`], ['cerradas', `Cerradas ${filas.length - abiertas}`], ['todas', 'Todas']].map(([id, nombre]) => `<button role="tab" data-ncr-filtro="${id}" class="${filtro === id ? 'activa' : ''}" aria-selected="${filtro === id}">${esc(nombre)}</button>`).join('')}
      </div>
      <div class="segmentado" role="tablist" aria-label="Alcance">
        ${Object.entries(ALC).map(([id, nombre]) => `<button role="tab" data-ncr-alcance="${id}" class="${alcance === id ? 'activa' : ''}" aria-selected="${alcance === id}">${esc(nombre)}</button>`).join('')}
      </div>
      ${solo ? `<div class="filtros-rp"><button type="button" class="chip-filtro activa" data-ncr-solo aria-pressed="true">${esc(SOLO[solo][0])} ✕</button></div>` : ''}
      ${alcance === 'nuestras' && fuera.length ? `<p class="nota">+${deOtros} de otros · ${sinClas} sin clasificar (abiertas, no cuentan)</p>` : ''}
      <input type="search" class="buscar" placeholder="Buscar código, texto o planta" value="${esc(texto)}" data-ncr-buscar>
      ${vistas.length ? C.listaAgrupada(`ncr-${filtro}`, vistas, {
        grupo: (f) => f.planta || 'Sin planta', buscando: !!q, repintar: pintarLista,
        orden: [...new Set(vistas.map((f) => f.planta || 'Sin planta'))].sort((a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true })),
        fila: (f) => `
        <li><button class="fila-ios" data-ncr="${f.enAlta && f.mio ? 'retomar' : 'ficha'}" data-id="${esc(f.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(f.codigo)}</strong><span>${chipPrioridad(f.prioridad)} ${f.enAlta ? '<span class="chip aviso">Sin terminar</span>' : chipEstado(f)}</span></div>
          <div class="texto-2">${esc(f.descripcion)}</div>
          <div class="sub">${f.alcance === 'deOtros' ? '<span class="chip neutra">De otros</span> ' : !f.alcance && f.sugerida ? `<span class="chip aviso">Sugerida: ${f.sugerida === 'nuestra' ? 'nuestra' : 'de otros'}</span> ` : !f.alcance && f.dudosa ? '<span class="chip aviso">Dudosa</span> ' : ''}${esc([f.planta, f.zona, f.disciplina].filter(Boolean).join(' · '))}${f.fechaDeteccion ? ` · ${fechaEs(f.fechaDeteccion)}` : ''}${f.fotos ? ` · ${f.fotos} foto${f.fotos === 1 ? '' : 's'}` : ''}</div>
        </button></li>` }) : `<p class="vacio">${q ? 'Ninguna NCR con ese texto.' : filtro === 'abiertas' ? 'No hay NCR abiertas en esta obra.' : 'No hay NCR.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. El alta */

  /*
   * AUTOGUARDADO (28-oct-2026, JC: con atrás se perdían las fotos de una
   * incidencia). La NCR a medias queda en el teléfono con cada tecla y cada
   * foto (autoguardado.js), por obra. Atrás y vuelta: sigue ahí; si se cerró
   * la app, la lista ofrece seguir con ella.
   *
   * Y SE MANDA SOLA (28-oct-2026, JC: «se manda solo y si no está terminada,
   * pues sigue en lista de abiertos»). Con qué pasa o una foto ya se crea en
   * el ordenador como «sin terminar» (api/ncr/alta, con el id que pone el
   * teléfono: reintentar no la duplica) y cada cambio y cada foto se guardan
   * solos. Sin conexión la sube la cola (colaGuardado.js) al volver la red.
   * «Terminar el alta» la da de alta de verdad: ahí entra en los avisos.
   */
  const AG = window.AUTOGUARDADO;
  const clave = () => `ncr.${C.obraId() || ''}`;
  const conContenido = (f) => Boolean(f && (String(f.descripcion || '').trim() || String(f.zona || '').trim() || f.planta || f.disciplina || (f.fotos || []).length));
  const vacia = () => ({ descripcion: '', planta: '', zona: '', disciplina: '', prioridad: 'B', fotos: [], clave: clave(), obraId: C.obraId(),
    idAlta: AG.nuevoId(), enServidor: false, codigo: '', cambios: 0, subidos: 0, terminar: false });
  /* Lo mínimo para existir en el ordenador: qué pasa o una foto. */
  const minimo = (f) => Boolean(f && (String(f.descripcion || '').trim() || (f.fotos || []).length));
  const pendiente = (f) => Boolean(f && minimo(f) && (!f.enServidor || (f.cambios || 0) !== (f.subidos || 0) || f.terminar
    || (f.fotos || []).some((x) => !x.enServidor)));
  const kDe = (x) => x.k || x.local;
  function estadoMarca() {
    const f = form;
    if (!f) return ['movil', ''];
    if (!minimo(f)) return ['movil', 'Se guarda solo mientras escribes'];
    if (f.guardando || f.fotos.some((x) => x.subiendo)) return ['guardando'];
    if (f.estadoRed === 'sinRed') return ['sinRed'];
    if (f.estadoRed === 'error') return ['error', `No se ha guardado${f.error ? `: ${f.error}` : ''}`];
    if (pendiente(f)) return ['guardando'];
    return ['guardado'];
  }
  const paraGuardar = (f) => {
    const { guardando, estadoRed, error, descartado, terminado, ...resto } = f;
    return { ...resto, fotos: AG.fotosParaGuardar(f.fotos).map(({ fallo, ...x }) => x) };
  };
  function persistir() {
    if (!form) return;
    if (conContenido(form)) {
      if (!AG.guardar(form.clave, paraGuardar(form))) { AG.pintarMarca($app, 'error', 'No se ha podido guardar en el móvil'); return; }
    } else if (!form.enServidor) AG.borrar(form.clave);
    if (activa()) AG.pintarMarca($app, ...estadoMarca());
  }
  let reloj = null;
  function programar(ms = 1200) {
    clearTimeout(reloj);
    reloj = setTimeout(() => { if (form && pendiente(form)) guardarServidor(form); }, ms);
  }
  function cambio(alMomento) {
    if (!form) return;
    form.cambios = (form.cambios || 0) + 1;
    persistir();
    if (alMomento) { clearTimeout(reloj); guardarServidor(form); } else programar();
  }
  async function recuperar() {
    const b = AG.leer(clave());
    if (!conContenido(b)) return false;
    const { _en, ...resto } = b;
    form = { ...vacia(), ...resto, clave: clave(), fotos: await AG.restaurarFotos(b.fotos) };
    if (!b.idAlta) persistir();
    return true;
  }

  /* ── El alta en el ordenador: una petición cada vez. */
  const CAMPOS = ['obraId', 'descripcion', 'planta', 'zona', 'disciplina', 'prioridad'];
  let cadena = Promise.resolve(null);
  let enCola = 0;
  function guardarServidor(f, opciones = {}) {
    if (!opciones.terminar && enCola > 0) return cadena;
    enCola += 1;
    cadena = cadena.then(() => { enCola -= 1; return mandarAlta(f, opciones); }, () => { enCola -= 1; return mandarAlta(f, opciones); });
    return cadena;
  }
  function pintarEstado(f) { if (form === f && activa()) AG.pintarMarca($app, ...estadoMarca()); }
  function guardarLocal(f) {
    if (form === f) { persistir(); return; }
    const b = AG.leer(f.clave);
    if (!b || b.idAlta !== f.idAlta) return;
    if (f.terminado) AG.borrar(f.clave); else AG.guardar(f.clave, paraGuardar(f));
  }
  async function mandarAlta(f, { terminar = false } = {}) {
    if (!f || f.terminado || f.descartado) return { ok: true };
    if (!minimo(f)) return { ok: false, minimo: false };
    if (!f.idAlta) f.idAlta = AG.nuevoId();
    if (!f.obraId) f.obraId = C.obraId();
    const version = f.cambios || 0;
    f.guardando = true;
    pintarEstado(f);
    try {
      for (const x of f.fotos) if (!x.enServidor && !x.id && !(await subir(x))) throw x.fallo || new Error('No se ha podido subir una foto.');
      const cuerpo = () => ({
        ...Object.fromEntries(CAMPOS.map((c) => [c, f[c]])), idAlta: f.idAlta, terminar: terminar || Boolean(f.terminar),
        fotos: f.fotos.filter((x) => !x.enServidor && x.id).map((x) => ({ k: kDe(x), fotoId: x.id })), fotosK: f.fotos.map(kDe).filter(Boolean),
      });
      let r = await C.postJson('api/ncr/alta', cuerpo());
      /* El ordenador olvidó las fotos en espera: se suben otra vez desde el teléfono. */
      if (r && r.ok && r.faltan && r.faltan.length) {
        for (const x of f.fotos) if (r.faltan.includes(kDe(x))) { x.id = null; if (!(await subir(x))) throw x.fallo || new Error('No se ha podido subir una foto.'); }
        r = await C.postJson('api/ncr/alta', cuerpo());
      }
      if (!r || !r.ok) throw Object.assign(new Error((r && r.error) || 'No se ha guardado.'), { delServidor: true });
      f.enServidor = true;
      f.codigo = r.codigo || f.codigo;
      const ya = new Set(r.fotosK || []);
      for (const x of f.fotos) if (ya.has(kDe(x))) x.enServidor = true;
      f.subidos = version;
      if (r.enAlta === false) { f.terminado = true; f.terminar = false; }
      f.estadoRed = (r.faltan && r.faltan.length) ? 'error' : null;
      f.error = f.estadoRed ? 'falta subir una foto' : '';
      return r;
    } catch (e) {
      const red = !e.delServidor && AG.sinRed(e);
      f.estadoRed = red ? 'sinRed' : 'error';
      f.error = e.message;
      return { ok: false, sinRed: red, error: e.message };
    } finally {
      f.guardando = false;
      guardarLocal(f);
      pintarEstado(f);
      if (form === f && !f.terminado && !f.estadoRed && pendiente(f)) programar(300);
    }
  }

  async function terminar(boton) {
    const f = form;
    if (!f) return;
    if (!String(f.descripcion || '').trim()) { C.aviso('Escribe qué pasa.', 'aviso'); return; }
    boton.disabled = true;
    f.terminar = true;
    f.cambios = (f.cambios || 0) + 1;
    persistir();
    const r = await guardarServidor(f, { terminar: true });
    if (r && r.ok && f.terminado) {
      AG.borrar(f.clave);
      if (form === f) form = null;
      C.aviso(`${r.codigo || f.codigo || 'NCR'} dada de alta.`, 'bien');
      await lista();
      return;
    }
    boton.disabled = false;
    if (r && r.sinRed) { C.aviso('Sin conexión: la NCR queda guardada en el móvil y se dará de alta sola al volver la conexión.', 'aviso'); return; }
    f.terminar = false;
    persistir();
    C.aviso((r && r.error) || 'Falta subir alguna foto: vuelve a intentarlo.');
  }

  async function descartar() {
    if (!window.confirm('¿Descartar la NCR sin terminar? Se borra lo escrito y sus fotos.')) return;
    await cadena;
    const b = form || AG.leer(clave());
    if (b && b.enServidor && b.idAlta) {
      try {
        const r = await C.postJson('api/ncr/alta', { idAlta: b.idAlta, descartar: true });
        if (!r.ok) throw new Error(r.error);
      } catch (e) { C.aviso(AG.sinRed(e) ? 'Sin conexión: se podrá descartar al volver la conexión.' : e.message); return; }
    }
    if (b) b.descartado = true;
    AG.borrar(clave());
    form = null;
    lista();
  }

  /* Seguir con una NCR sin terminar que está en el ordenador (también desde otro teléfono). */
  async function retomar(id) {
    const b = AG.leer(clave());
    if (b && b.idAlta === id) { await recuperar(); if (activa()) pintarForm(); return; }
    if (b && conContenido(b) && (pendiente(b) || !b.enServidor)) {
      C.aviso('Tienes otra NCR sin terminar en este teléfono: sigue con ella o descártala antes.', 'aviso');
      return;
    }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/ncr/alta?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      const { fotos: fotosSrv, ...resto } = r.ncr;
      const fotos = [];
      for (const x of fotosSrv || []) {
        let blob = null;
        try {
          const res = await fetch(`api/ncr/foto?id=${encodeURIComponent(id)}&i=${x.i}`, { cache: 'no-store' });
          if ((res.status || 200) < 400 && res.blob) blob = await res.blob();
        } catch { /* sin vista */ }
        fotos.push(blob ? await AG.fotoNueva(blob, { k: x.k, enServidor: true, id: null }) : { k: x.k, enServidor: true, id: null, local: null, url: '' });
      }
      if (b) AG.borrar(clave());
      form = { ...vacia(), ...resto, prioridad: resto.prioridad || 'B', enServidor: true, cambios: 0, subidos: 0, fotos };
      persistir();
      if (activa()) pintarForm();
    } catch (e) { C.aviso(e.message); lista(); }
  }

  async function nueva() {
    if (await recuperar()) { C.aviso('Sigues con la NCR que tenías sin terminar.', 'aviso'); if (activa()) pintarForm(); return; }
    form = vacia();
    pintarForm();
  }

  function pintarForm() {
    const f = form;
    const plantas = (datos && datos.plantas) || [];
    $app.innerHTML = `
      <button class="volver" data-ncr="lista">‹ NCR</button>
      <h2>${f.codigo ? `${esc(f.codigo)} · sin terminar` : 'Nueva NCR'}</h2>
      <p class="nota">${esc(C.obra() ? `${C.obra().codigo} · ${C.obra().nombre}` : '')}</p>
      ${AG.marca(...estadoMarca())}
      <div class="fila-botones">
        <button class="boton" data-ncr="camara"><i class="ic ic-camara"></i>Foto</button>
        <button class="boton secundario" data-ncr="galeria">De la galería</button>
      </div>
      ${f.fotos.length ? `<div class="fotos">${f.fotos.map((x, i) => `<button type="button" class="foto-quitar" data-ncr="ver-foto" data-i="${i}" aria-label="Ver la foto en grande, reemplazarla o quitarla">${x.url ? `<img src="${esc(x.url)}" alt="">` : '<span class="foto-sin-vista">Foto</span>'}</button>`).join('')}</div>` : ''}
      <label>Qué pasa<textarea rows="4" data-ncr-campo="descripcion" placeholder="Describe la no conformidad">${esc(f.descripcion)}</textarea></label>
      <div class="campos">
        <label>Planta${plantas.length
          ? `<select data-ncr-campo="planta"><option value="">—</option>${plantas.map((p) => `<option ${p === f.planta ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`
          : `<input data-ncr-campo="planta" value="${esc(f.planta)}">`}</label>
        <label>Zona<input data-ncr-campo="zona" value="${esc(f.zona)}" autocomplete="off"></label>
      </div>
      <label>Disciplina<select data-ncr-campo="disciplina"><option value="">—</option>${((datos && datos.disciplinas) || []).map((d) => `<option ${d === f.disciplina ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label>Prioridad</label>
      <div class="segmentado">${['A', 'B', 'C'].map((p) => `<button data-ncr-prioridad="${p}" class="${f.prioridad === p ? 'activa' : ''}">${p}${p === 'A' ? ' · urgente' : p === 'C' ? ' · leve' : ''}</button>`).join('')}</div>
      <button class="boton grande" data-ncr="terminar">Terminar el alta</button>
      <p class="nota centrada">Se guarda sola en el ordenador mientras la escribes y sale en la lista como «sin terminar». Al terminarla queda dada de alta.</p>
      <button class="enlace" data-ncr="descartar">Descartar esta NCR</button>`;
  }

  /* La foto del alta: primero al teléfono (no se pierde) y al momento al ordenador. */
  async function subir(x) {
    x.subiendo = true;
    try {
      const blob = x.archivo || await AG.leerFoto(x.local);
      if (!blob) throw new Error('La foto no se ha podido recuperar del teléfono: hazla de nuevo.');
      x.id = await C.subirFoto(blob);
      return true;
    } catch (e) {
      x.id = null;
      x.fallo = e;
      return false;
    } finally { x.subiendo = false; }
  }

  /* Con la cámara, una; de la galería, varias a la vez (tarea 368b6690). */
  async function foto(camara) {
    const archivos = camara ? [await C.elegirFoto(true)].filter(Boolean) : await AG.elegirFotos(false);
    if (!archivos.length) return;
    if (form) {
      const f = form;
      for (const archivo of archivos) f.fotos.push(await AG.fotoNueva(archivo, { id: null }));
      f.cambios = (f.cambios || 0) + 1;
      if (form === f) { persistir(); if (activa()) pintarForm(); }
      await guardarServidor(f);
      return;
    }
    try {
      const ids = [];
      for (const archivo of archivos) ids.push(await C.subirFoto(archivo));
      if (abierta) {
        const r = await C.postJson('api/ncr/foto', { id: abierta.ncr.id, fotos: ids, tipo: abierta.ncr.activa ? 'deteccion' : 'resolucion' });
        if (!r.ok) throw new Error(r.error);
        C.aviso(ids.length === 1 ? 'Foto añadida.' : `${ids.length} fotos añadidas.`, 'bien');
        abrir(abierta.ncr.id);
      }
    } catch (e) { C.aviso(e.message); }
  }

  /* Tocar una foto del alta: en grande, para reemplazarla o quitarla (y se guarda sola). */
  function verFoto(i) {
    const f = form;
    const viejo = f && f.fotos[i];
    if (!viejo) return;
    const soltar = (x) => { if (x.local) AG.borrarFoto(x.local); if (x.url) { try { URL.revokeObjectURL(x.url); } catch { /* nada */ } } };
    AG.verFoto({
      url: viejo.url,
      quitar: () => {
        const k = f.fotos.indexOf(viejo);
        if (k < 0) return;
        f.fotos.splice(k, 1);
        soltar(viejo);
        f.cambios = (f.cambios || 0) + 1;
        if (form === f) { persistir(); if (activa()) pintarForm(); }
        guardarServidor(f);
      },
      reemplazar: async (archivo) => {
        const x = await AG.fotoNueva(archivo, { id: null });
        const k = f.fotos.indexOf(viejo);
        if (k < 0) f.fotos.push(x); else f.fotos.splice(k, 1, x);
        soltar(viejo);
        f.cambios = (f.cambios || 0) + 1;
        if (form === f) { persistir(); if (activa()) pintarForm(); }
        await guardarServidor(f);
      },
    });
  }

  /* ═══════════════════════════════════ 3. La ficha */

  async function abrir(id) {
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/ncr/ficha?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      pintarFicha();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); lista(); }
  }

  function pintarFicha() {
    const { ncr: n, pasos, puedeCerrar, puedeFoto, equipos, historial } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    $app.innerHTML = `
      <button class="volver" data-ncr="lista">‹ NCR</button>
      <section class="cabeza-ficha">
        <div class="fila-principal"><h2 class="cifra">${esc(n.codigo)}</h2><span>${chipPrioridad(n.prioridad)} ${chipEstado(n)}</span></div>
        <p class="texto-ficha">${esc(n.descripcion)}</p>
      </section>
      <section class="grupo">
        ${dato('Alcance', n.alcance === 'nuestra' ? 'Nuestra' : n.alcance === 'deOtros' ? `De otros${n.alcanceDe ? ` · ${n.alcanceDe}` : ''}` : n.sugerida ? `Sin clasificar (sugerida: ${n.sugerida === 'nuestra' ? 'nuestra' : 'de otros'})` : n.dudosa ? 'Sin clasificar (dudosa)' : 'Sin clasificar')}${dato('Motivo del alcance', n.alcanceMotivo)}
        ${dato('Planta', n.planta)}${dato('Zona', n.zona)}${dato('Disciplina', n.disciplina)}
        ${dato('Responsable', n.industrialResponsable)}${dato('Acción inicial', n.accionInicial)}
        ${dato('Detectada', fechaEs(n.fechaDeteccion))}${dato('Prevista', fechaEs(n.fechaPrevista))}${dato('Cerrada', fechaEs(n.fechaCierre))}
        ${equipos.length ? dato('Equipos', equipos.map((e) => e.tag).join(', ')) : ''}
      </section>
      ${n.fotos.length ? `<h2>Fotos</h2><div class="fotos">${n.fotos.map((f) => `<img data-src="api/ncr/foto?id=${encodeURIComponent(n.id)}&i=${f.indice}" alt="${esc(f.tipo || '')}">`).join('')}</div>` : ''}
      ${puedeFoto ? '<button class="boton secundario" data-ncr="camara"><i class="ic ic-camara"></i>Añadir foto</button>' : ''}
      ${puedeFoto ? `<h2>Alcance</h2>
        ${n.alcance !== 'deOtros' ? '<button class="boton secundario" data-ncr="alcance" data-alcance="deOtros">No es nuestra</button>' : ''}
        ${n.alcance !== 'nuestra' ? '<button class="boton secundario" data-ncr="alcance" data-alcance="nuestra">Sí es nuestra</button>' : ''}` : ''}
      ${pasos.length || puedeCerrar ? `<h2>Cambiar estado</h2>
        ${pasos.filter((p) => p.id !== 'cerrada').map((p) => `<button class="boton secundario" data-ncr="paso" data-estado="${esc(p.id)}">Pasar a «${esc(p.nombre)}»</button>`).join('')}
        ${puedeCerrar ? '<button class="boton grande" data-ncr="cerrar"><i class="ic ic-check"></i>Cerrar NCR</button>' : ''}` : ''}
      ${historial.length ? `<h2>Historial</h2><ul class="historial">${historial.map((h) => `<li><span class="sub">${fechaEs(h.cuando)}${h.persona ? ` · ${esc(h.persona)}` : ''}</span> ${esc(h.campo)}: ${esc(h.antes || '—')} → <strong>${esc(h.despues || '—')}</strong></li>`).join('')}</ul>` : ''}`;
    C.cargarImagenes($app);
  }

  async function cambiar(estado, boton, confirmar = false) {
    boton.disabled = true;
    try {
      const r = await C.postJson('api/ncr/estado', { id: abierta.ncr.id, estado, confirmar });
      if (r.pideConfirmar) {
        boton.disabled = false;
        if (window.confirm(`${(r.avisos || []).join('\n')}\n\n¿Cerrarla igualmente?`)) return cambiar(estado, boton, true);
        return;
      }
      if (!r.ok) throw new Error(r.error);
      C.aviso(estado === 'cerrada' ? 'NCR cerrada.' : 'Estado cambiado.', 'bien');
      abrir(abierta.ncr.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function marcarAlcance(modo, boton) {
    let motivo = '';
    let de = '';
    if (modo === 'deOtros') {
      motivo = (window.prompt('¿Por qué no es nuestra?') || '').trim();
      if (!motivo) return;
      de = (window.prompt('¿A quién corresponde? (gremio o empresa)') || '').trim();
    }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/ncr/alcance', { id: abierta.ncr.id, alcance: modo, motivo, de });
      if (!r.ok) throw new Error(r.error);
      C.aviso(modo === 'deOtros' ? 'Marcada como de otros.' : 'Marcada como nuestra.', 'bien');
      abrir(abierta.ncr.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ Eventos */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const f = ev.target.closest('[data-ncr-filtro]');
    if (f) { filtro = f.dataset.ncrFiltro; solo = null; pintarLista(); return; }
    if (ev.target.closest('[data-ncr-solo]')) { solo = null; pintarLista(); return; }
    const al = ev.target.closest('[data-ncr-alcance]');
    if (al) { alcance = al.dataset.ncrAlcance; pintarLista(); return; }
    const p = ev.target.closest('[data-ncr-prioridad]');
    if (p && form) { form.prioridad = p.dataset.ncrPrioridad; cambio(true); pintarForm(); return; }
    const b = ev.target.closest('[data-ncr]');
    if (!b) return;
    const a = b.dataset.ncr;
    if (a === 'lista') lista();
    else if (a === 'nueva') nueva();
    else if (a === 'seguir') nueva();
    else if (a === 'descartar') descartar();
    else if (a === 'retomar') retomar(b.dataset.id);
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'camara') foto(true);
    else if (a === 'galeria') foto(false);
    else if (a === 'ver-foto') verFoto(Number(b.dataset.i));
    else if (a === 'quitar-foto') { const [x] = form.fotos.splice(Number(b.dataset.i), 1); if (x && x.local) AG.borrarFoto(x.local); cambio(true); pintarForm(); }
    else if (a === 'terminar' || a === 'enviar') terminar(b);
    else if (a === 'paso') cambiar(b.dataset.estado, b);
    else if (a === 'cerrar') cambiar('cerrada', b);
    else if (a === 'alcance') marcarAlcance(b.dataset.alcance, b);
  });
  const recoger = (ev) => { if (activa() && form && ev.target.dataset.ncrCampo) { form[ev.target.dataset.ncrCampo] = ev.target.value; cambio(ev.type === 'change'); } };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  $app.addEventListener('input', (ev) => {
    if (!activa() || form || abierta || !ev.target.hasAttribute('data-ncr-buscar')) return;
    texto = ev.target.value;
    const pos = ev.target.selectionStart;
    pintarLista();
    const i = $app.querySelector('[data-ncr-buscar]');
    i.focus(); i.setSelectionRange(pos, pos);
  });

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  /* Atrás (botón, gesto o navegador) y vuelta: la NCR a medias sigue ahí. */
  const alIrse = () => { persistir(); if (form && pendiente(form)) guardarServidor(form); };
  window.addEventListener('hashchange', () => {
    if (!activa()) { alIrse(); return; }
    if (form && datos) pintarForm();
    else lista();
  });
  AG.alSalir(alIrse);
  window.addEventListener('online', () => { if (form && pendiente(form)) guardarServidor(form); });
  /* Lo que quedó en el teléfono lo sube la cola sola al volver la red (una por obra). */
  if (window.COLA_GUARDADO) {
    window.COLA_GUARDADO.registrar('ncr.', async (claveB, b) => {
      if (form && form.idAlta === b.idAlta) {
        if (!pendiente(form)) return true;
        const r = await guardarServidor(form, { terminar: Boolean(form.terminar) });
        return Boolean(r && r.ok) && !pendiente(form);
      }
      if (!pendiente(b)) return true;
      const f = { ...vacia(), ...b, clave: claveB, fotos: await AG.restaurarFotos(b.fotos) };
      const r = await guardarServidor(f, { terminar: Boolean(f.terminar) });
      return Boolean(r && r.ok) && !pendiente(f);
    });
  }
  if (activa()) lista();
})();
