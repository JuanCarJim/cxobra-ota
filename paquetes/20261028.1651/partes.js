'use strict';
/*
 * OBRA › PARTES DE INCIDENCIA EN EL MÓVIL: el encargado cuenta lo que ha
 * pasado y le llega al jefe de obra (y a los técnicos de la obra).
 *
 *   1. LA LISTA: «Nuevo parte» y los últimos partes de sus obras, con cómo
 *      están (enviado, visto por el jefe de obra, cerrado).
 *   2. EL PARTE: qué ha pasado (robo, avance de obra, daños, seguridad u
 *      otro), cuándo, dónde, cómo de grave, lo que ha pasado y las fotos.
 *        · Robo: si se ha denunciado y QUÉ SE HAN LLEVADO, cosa a cosa:
 *          material, herramienta o maquinaria, cuánto y en qué unidad
 *          («3 taladros», «120 m de tubo»). El material se elige, si se
 *          puede, de la lista de la obra: así el ordenador sabe valorarlo.
 *        · Avance de obra: la causa, la subcontrata y los días que se pierden.
 *        · Daños: lo que se ha roto, con la misma lista de cosas.
 *   3. ENVIADO: con su código. El valor de lo robado (venta y coste) lo
 *      calcula el ordenador y solo lo ve el jefe de obra: aquí no sale dinero.
 *
 * Las acciones van con data-pi (las de albaranes usan data-accion y las del
 * personal data-per). Las reglas y los catálogos, en partesIncidencia.js
 * (window.PARTES_MOTOR), el mismo archivo que usa el ordenador.
 */
(function partes() {
  const PM = window.PARTES_MOTOR;
  const $app = document.getElementById('app');
  const $camara = document.getElementById('camara-parte');
  const $galeria = document.getElementById('galeria-parte');

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Un sello con hora (creadoEn, en UTC) se enseña con el día LOCAL: a la 01:20 del 15 ya es 15. */
  const fechaEs = (d) => {
    if (!d) return '';
    let t = String(d);
    if (/^\d{4}-\d{2}-\d{2}T/.test(t) && Number.isFinite(Date.parse(t))) { const x = new Date(t); t = new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString(); }
    return t.slice(0, 10).split('-').reverse().join('/');
  };
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const ahoraHora = () => new Date().toTimeString().slice(0, 5);
  const activa = () => location.hash === '#partes';
  const CLASE_ESTADO = { nuevo: 'aviso', visto: 'bien', cerrado: 'neutra' };
  const chipEstado = (e) => `<span class="chip ${CLASE_ESTADO[e] || 'neutra'}">${esc((PM.ESTADOS[e] || {}).nombre || e)}</span>`;

  let datos = null;
  let form = null;
  let obraId = null;

  /*
   * AUTOGUARDADO (28-oct-2026, JC: un encargado metía fotos, pulsó atrás y lo
   * perdió todo). El parte a medias se guarda en el teléfono con cada tecla
   * y cada foto (autoguardado.js); la foto, además, se sube al momento. Al
   * volver se sigue donde estaba; si se cerró la app, la lista ofrece
   * seguir con él. Solo se borra cuando el servidor confirma el envío. No se
   * crea en el servidor antes de enviarlo: le saldría al jefe de obra a medias.
   */
  const AG = window.AUTOGUARDADO;
  const CLAVE = 'parte';
  const vacio = () => ({ obraId: null, tipo: '', fecha: hoy(), hora: ahoraHora(), zona: '', titulo: '', descripcion: '', gravedad: 'media',
    denuncia: 'no', atestado: '', causa: '', proveedorId: '', diasRetraso: '', lineas: [], fotos: [] });
  const conContenido = (f) => Boolean(f && (f.tipo || String(f.titulo || '').trim() || String(f.descripcion || '').trim() || String(f.zona || '').trim()
    || (f.fotos || []).length || (f.lineas || []).some((l) => String(l.descripcion || '').trim())));
  function estadoMarca() {
    if (!form) return ['movil', ''];
    if (form.fotos.some((x) => x.subiendo)) return ['guardando', 'Subiendo foto…'];
    if (form.fotos.some((x) => !x.id)) return ['sinRed', 'Sin conexión: la foto se subirá al enviar'];
    return conContenido(form) ? ['movil', 'Guardado en el móvil · se envía con el botón'] : ['movil', 'Se guarda solo mientras escribes'];
  }
  function persistir() {
    if (!form) return;
    if (conContenido(form)) {
      if (!AG.guardar(CLAVE, { ...form, fotos: AG.fotosParaGuardar(form.fotos) })) { AG.pintarMarca($app, 'error', 'No se ha podido guardar en el móvil'); return; }
    } else AG.borrar(CLAVE);
    if (activa()) AG.pintarMarca($app, ...estadoMarca());
  }
  async function recuperar() {
    const b = AG.leer(CLAVE);
    if (!conContenido(b)) return false;
    const { _en, ...resto } = b;
    form = { ...vacio(), ...resto, fotos: await AG.restaurarFotos(b.fotos) };
    return true;
  }
  const pintarActual = () => (form.tipo && PM.TIPOS[form.tipo] ? pintarForm() : pintarTipo());
  async function seguir() {
    if (await recuperar() && activa()) pintarActual();
  }
  /* La obra es la elegida en la cabecera (carcasa.js), la misma para todas. */
  try { obraId = localStorage.getItem('movil.obra') || localStorage.getItem('partes.obra'); } catch { /* sin almacenamiento */ }
  window.addEventListener('movil:obra', (ev) => { obraId = ev.detail; if (activa() && !form && datos) pintarLista(); });

  async function pedir(ruta, opciones = {}) {
    const r = await fetch(ruta, { cache: 'no-store', ...opciones });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { throw new Error(t || `Error ${r.status}`); }
    if (r.status >= 400 && j && j.error) throw new Error(j.error);
    return j;
  }
  const postJson = (ruta, cuerpo) => pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

  function aviso(texto, nivel = 'mal') {
    const d = document.createElement('div');
    d.className = `toast ${nivel}`;
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  const obras = () => (datos && datos.obras) || [];
  const obra = () => obras().find((o) => o.id === (form ? form.obraId : obraId)) || obras()[0] || null;

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await pedir('api/partes');
      document.getElementById('quien').textContent = datos.quien || '';
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-pi="lista">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintarLista();
  }

  function pintarLista() {
    const o = obra();
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas en las que dar partes.</p>'; return; }
    const puede = datos.puede && datos.puede.crear;
    const mios = (datos.recientes || []).filter((p) => p.obraId === o.id);
    const b = AG.leer(CLAVE);
    const borrador = conContenido(b) ? `<section class="borrador-pendiente" role="status">
        <p><strong>Tienes un parte sin terminar</strong><br><small>${esc([(PM.TIPOS[b.tipo] || {}).nombre, b.titulo, (b.fotos || []).length ? `${b.fotos.length} foto${b.fotos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Sin título')}</small></p>
        <div class="fila-botones"><button class="boton" data-pi="seguir">Seguir con él</button><button class="boton secundario" data-pi="descartar">Descartar</button></div>
      </section>` : '';
    $app.innerHTML = `${borrador}
      ${window.CX && window.CX.obras().length ? '' : obras().length > 1 ? `<label class="elegir-obra">Obra<select data-pi-cambio="obra">${obras().map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select></label>` : `<p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>`}
      ${puede ? `<section class="acciones">
        <button class="boton grande" data-pi="nuevo"><i class="ic ic-aviso"></i>Nuevo parte de incidencia</button>
        <p class="nota centrada">Robos, problemas de avance, daños, seguridad… Le llega al jefe de obra.</p>
      </section>` : '<p class="nota">Tu rol puede ver los partes, pero no darlos.</p>'}
      <h2>Últimos partes <span class="cuenta">${mios.length}</span></h2>
      ${mios.length ? window.CX.listaAgrupada('partes', mios, {
        envolver: (h) => `<ul class="recientes">${h}</ul>`, repintar: pintarLista,
        grupo: mios.length > 20 ? (p) => (PM.TIPOS[p.tipo] || {}).nombre || p.tipo : null,
        fila: (p) => `<li>
        <div><strong>${esc(p.codigo)}</strong> · ${esc((PM.TIPOS[p.tipo] || {}).nombre || p.tipo)}<br><small>${esc(p.titulo)} · ${esc(fechaEs(p.fecha))}</small></div>
        ${chipEstado(p.estado)}</li>` }) : '<p class="vacio">Todavía no hay partes en esta obra.</p>'}`;
  }

  /* ═══════════════════════════════════ 2. El parte */

  async function nuevo() {
    const o = obra();
    if (!o) return;
    /* Un parte sin terminar no se pisa: se sigue con él (o se descarta en la lista). */
    if (await recuperar()) {
      try { sessionStorage.removeItem('partes.prefill'); } catch { /* nada */ }
      aviso('Sigues con el parte que tenías sin terminar.', 'aviso');
      if (activa()) pintarActual();
      return;
    }
    form = { ...vacio(), obraId: o.id };
    /* Un parte que viene ya relleno de otra sección (Commissioning: «Avisar con
       un parte» de un modelo sin dar de alta): se salta la pregunta del tipo. */
    const previo = prefill();
    if (previo) {
      for (const k of ['tipo', 'titulo', 'descripcion', 'gravedad', 'zona']) if (typeof previo[k] === 'string' && previo[k]) form[k] = previo[k];
      if (form.tipo && PM.TIPOS[form.tipo]) { persistir(); pintarForm(); return; }
      form.tipo = '';
    }
    pintarTipo();
  }
  function prefill() {
    try {
      const t = sessionStorage.getItem('partes.prefill');
      if (!t) return null;
      sessionStorage.removeItem('partes.prefill');
      return JSON.parse(t);
    } catch { return null; }
  }

  /* Primero el tipo, con botones grandes: es lo que decide el resto. */
  function pintarTipo() {
    $app.innerHTML = `
      <button class="volver" data-pi="lista">‹ Partes</button>
      <h2>¿Qué ha pasado?</h2>
      <div class="tipos-parte">${Object.entries(PM.TIPOS).map(([id, t]) => `
        <button class="tipo-parte" data-pi="tipo" data-id="${esc(id)}"><b>${esc(t.icono)} ${esc(t.nombre)}</b><small>${esc(t.ayuda)}</small></button>`).join('')}
      </div>`;
  }

  const lineaVacia = (clase) => ({ clase, descripcion: '', cantidad: '', unidad: clase === 'material' ? '' : 'ud', ref: null });

  function pintarForm() {
    const o = obra();
    const f = form;
    const t = PM.TIPOS[f.tipo];
    const conCosas = f.tipo === 'robo' || f.tipo === 'danos';
    const opcion = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;
    $app.innerHTML = `
      <button class="volver" data-pi="cambiar-tipo">‹ ${esc(t.icono)} ${esc(t.nombre)} <small>(cambiar)</small></button>
      <p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>
      ${AG.marca(...estadoMarca())}
      <label>En pocas palabras<input data-pi-campo="titulo" value="${esc(f.titulo)}" maxlength="120" placeholder="${esc(t.ejemplo)}" autocomplete="off"></label>
      <div class="campos">
        <label>Día<input type="date" data-pi-campo="fecha" value="${esc(f.fecha)}" max="${hoy()}"></label>
        <label>Hora (aprox.)<input type="time" data-pi-campo="hora" value="${esc(f.hora)}"></label>
        <label>Dónde<input data-pi-campo="zona" value="${esc(f.zona)}" placeholder="Planta, zona, almacén…" autocomplete="off"></label>
        <label>Gravedad<select data-pi-campo="gravedad">${Object.entries(PM.GRAVEDADES).map(([id, g]) => opcion(id, g.nombre, f.gravedad)).join('')}</select></label>
      </div>
      ${f.tipo === 'robo' ? `<div class="campos">
        <label>¿Denunciado?<select data-pi-campo="denuncia">${Object.entries(PM.DENUNCIA).map(([id, n]) => opcion(id, n, f.denuncia)).join('')}</select></label>
        <label>Nº de atestado<input data-pi-campo="atestado" value="${esc(f.atestado)}" placeholder="si lo hay" autocomplete="off"></label>
      </div>` : ''}
      ${f.tipo === 'avance' ? `<label>Por qué se retrasa<select data-pi-campo="causa"><option value="">Elige…</option>${Object.entries(PM.CAUSAS_AVANCE).map(([id, n]) => opcion(id, n, f.causa)).join('')}</select></label>
      <div class="campos">
        <label>Subcontrata<select data-pi-campo="proveedorId"><option value="">—</option>${o.subcontratas.map((s) => opcion(s.id, s.nombre, f.proveedorId)).join('')}</select></label>
        <label>Días que se pierden<input data-pi-campo="diasRetraso" value="${esc(f.diasRetraso)}" inputmode="decimal" placeholder="aprox."></label>
      </div>` : ''}
      ${f.tipo === 'danos' ? `<label>Quién lo ha hecho (si se sabe)<select data-pi-campo="proveedorId"><option value="">No se sabe / nadie de la obra</option>${o.subcontratas.map((s) => opcion(s.id, s.nombre, f.proveedorId)).join('')}</select></label>` : ''}
      ${conCosas ? cosas(o, f) : ''}
      <label class="notas">Qué ha pasado<textarea data-pi-campo="descripcion" rows="4" placeholder="${esc(t.pista)}">${esc(f.descripcion)}</textarea></label>
      <h2>Fotos <span class="cuenta">${f.fotos.length}</span></h2>
      <div class="fotos">${f.fotos.map((x, i) => (x.url ? `<img src="${esc(x.url)}" alt="Foto del parte" data-pi="ver-foto" data-i="${i}">` : `<span class="foto-sin-vista" data-pi="ver-foto" data-i="${i}">Foto</span>`)).join('')}
        <button class="anadir-foto" data-pi="foto" aria-label="Hacer una foto">＋</button></div>
      <button class="enlace" data-pi="galeria">o elegir una de la galería</button>
      <button class="boton grande" data-pi="enviar">Enviar al jefe de obra</button>
      <p class="nota centrada">Se guarda en el ordenador de la obra y le sale al jefe de obra, que lo puede imprimir y mandar por correo.</p>
      <datalist id="pi-material">${(o.catalogo || []).map((c) => `<option value="${esc(c.descripcion)}">${esc(c.unidad || '')}</option>`).join('')}</datalist>`;
  }

  function cosas(o, f) {
    const titulo = f.tipo === 'robo' ? 'Qué se han llevado' : 'Qué se ha roto';
    return `<h2>${titulo} <span class="cuenta">${f.lineas.length}</span></h2>
      ${f.lineas.map((l, i) => `<div class="linea cosa">
        <div class="cabeza-sub"><select data-pi-linea="${i}" data-campo="clase" aria-label="Qué es">${Object.entries(PM.CLASES).map(([id, n]) => `<option value="${id}" ${id === l.clase ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
          <button class="enlace" data-pi="quitar-linea" data-i="${i}">Quitar</button></div>
        <label>${l.clase === 'material' ? 'Material (empieza a escribir y elige de la lista de la obra)' : 'Qué'}<input data-pi-linea="${i}" data-campo="descripcion" value="${esc(l.descripcion)}" ${l.clase === 'material' ? 'list="pi-material"' : ''} placeholder="${l.clase === 'material' ? 'Tubo de cobre 22 mm…' : l.clase === 'herramienta' ? 'Taladro percutor…' : 'Plataforma elevadora…'}" autocomplete="off"></label>
        ${l.clase === 'material' ? `<small class="${l.ref ? 'bien' : ''}">${l.ref ? '✓ De la lista de la obra: se podrá valorar.' : (o.catalogo || []).length ? 'Si no está en la lista, escríbelo igual: el jefe de obra lo casará.' : ''}</small>` : ''}
        <div class="campos"><label>Cuántos<input data-pi-linea="${i}" data-campo="cantidad" value="${esc(l.cantidad)}" inputmode="decimal"></label>
          <label>Unidad<input data-pi-linea="${i}" data-campo="unidad" value="${esc(l.unidad)}" placeholder="ud, m, kg…" autocomplete="off"></label></div>
      </div>`).join('')}
      <div class="fila-botones">
        <button class="boton secundario" data-pi="linea" data-clase="material">+ Material</button>
        <button class="boton secundario" data-pi="linea" data-clase="herramienta">+ Herramienta</button>
      </div>
      <button class="enlace" data-pi="linea" data-clase="maquinaria">+ Maquinaria u otra cosa</button>`;
  }

  /* Al escribir el material: si es uno de la lista de la obra, queda casado. */
  function casar(l) {
    if (l.clase !== 'material') { l.ref = null; return; }
    const o = obra();
    const c = (o.catalogo || []).find((x) => x.descripcion === l.descripcion);
    l.ref = c ? c.ref : null;
    if (c && c.unidad && !l.unidad) l.unidad = c.unidad;
  }

  /* La foto: primero al teléfono (no se pierde) y al momento al ordenador. */
  async function foto(archivo) {
    if (!archivo || !form) return;
    const f = form;
    const x = await AG.fotoNueva(archivo, { id: null });
    x.subiendo = true;
    f.fotos.push(x);
    if (form === f) { persistir(); if (activa()) pintarForm(); }
    await subir(x);
    if (form === f) persistir();
  }
  async function subir(x) {
    x.subiendo = true;
    try {
      const blob = x.archivo || await AG.leerFoto(x.local);
      if (!blob) throw new Error('La foto no se ha podido recuperar del teléfono: hazla de nuevo.');
      const r = await pedir('api/foto?leer=0', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
      if (!r.ok) throw new Error(r.error);
      x.id = r.fotoId;
      return true;
    } catch (e) {
      x.id = null;
      if (!AG.sinRed(e)) aviso(e.message);
      return false;
    } finally { x.subiendo = false; }
  }
  /* Tocar una foto: en grande, para reemplazarla o quitarla (y se guarda sola). */
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
        if (form === f) { persistir(); if (activa()) pintarForm(); }
      },
      reemplazar: async (archivo) => {
        const x = await AG.fotoNueva(archivo, { id: null });
        x.subiendo = true;
        const k = f.fotos.indexOf(viejo);
        if (k < 0) f.fotos.push(x); else f.fotos.splice(k, 1, x);
        soltar(viejo);
        if (form === f) { persistir(); if (activa()) pintarForm(); }
        await subir(x);
        if (form === f) persistir();
      },
    });
  }

  /* Antes de enviar, las que no llegaron (o todas, si el ordenador ya no las tiene). */
  async function subirFaltan(todas) {
    for (const x of form.fotos) {
      if (!todas && x.id) continue;
      if (!(await subir(x))) throw new Error('No se ha podido subir una foto. El parte sigue guardado en el móvil: vuelve a enviarlo con conexión.');
    }
  }

  async function enviar(boton) {
    const f = form;
    boton.disabled = true;
    try {
      await subirFaltan(false);
      const cuerpo = () => ({ ...f, fotos: f.fotos.map((x) => x.id) });
      let r = await postJson('api/parte', cuerpo());
      /* El ordenador se reinició y olvidó las fotos en espera: se suben otra vez desde el teléfono. */
      if (!r.ok && /fotos ya no está/i.test(String(r.error || ''))) { await subirFaltan(true); r = await postJson('api/parte', cuerpo()); }
      if (!r.ok) throw new Error(r.error);
      form = null;
      AG.borrar(CLAVE);
      $app.innerHTML = `
        <section class="resultado bien"><div class="icono">✓</div><h1>${esc(r.codigo)}</h1>
          <p>Parte enviado</p><p class="sub">${esc(r.avisados && r.avisados.length ? `Le sale a ${r.avisados.join(', ')}.` : 'Le sale al jefe de obra en la aplicación.')}</p></section>
        ${r.sinCasar ? `<p class="nota aviso">${r.sinCasar === 1 ? 'Un material no está' : `${r.sinCasar} materiales no están`} en la lista de la obra: el jefe de obra lo${r.sinCasar === 1 ? '' : 's'} casará para valorarlo${r.sinCasar === 1 ? '' : 's'}.</p>` : ''}
        <button class="boton grande" data-pi="nuevo">Otro parte</button>
        <button class="boton secundario" data-pi="lista">Volver a la lista</button>`;
      datos = await pedir('api/partes').catch(() => datos);
    } catch (e) {
      persistir();
      aviso(AG.sinRed(e) ? 'Sin conexión: el parte sigue guardado en el móvil. Vuelve a enviarlo con conexión.' : e.message);
      boton.disabled = false;
    }
  }

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-pi]');
    if (!b) return;
    const a = b.dataset.pi;
    if (a === 'lista') lista();
    else if (a === 'nuevo') { if (datos) nuevo(); }
    else if (a === 'seguir') seguir();
    else if (a === 'descartar') { if (window.confirm('¿Descartar el parte sin terminar? Se borra lo escrito y sus fotos.')) { AG.borrar(CLAVE); form = null; pintarLista(); } }
    else if (a === 'tipo') {
      form.tipo = b.dataset.id;
      if ((form.tipo === 'robo' || form.tipo === 'danos') && !form.lineas.length) form.lineas.push(lineaVacia('material'));
      persistir();
      pintarForm();
    } else if (a === 'cambiar-tipo') pintarTipo();
    else if (a === 'linea') { form.lineas.push(lineaVacia(b.dataset.clase)); persistir(); pintarForm(); }
    else if (a === 'quitar-linea') { form.lineas.splice(Number(b.dataset.i), 1); persistir(); pintarForm(); }
    else if (a === 'ver-foto') verFoto(Number(b.dataset.i));
    else if (a === 'foto') $camara.click();
    else if (a === 'galeria') $galeria.click();
    else if (a === 'enviar') enviar(b);
  });
  const recoger = (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (t.dataset.piCambio === 'obra' && ev.type === 'change') {
      obraId = t.value;
      try { localStorage.setItem('partes.obra', obraId); } catch { /* sin almacenamiento */ }
      pintarLista();
      return;
    }
    if (!form) return;
    if (t.dataset.piCampo) form[t.dataset.piCampo] = t.value;
    if (t.dataset.piLinea !== undefined) {
      const l = form.lineas[Number(t.dataset.piLinea)];
      if (!l) return;
      l[t.dataset.campo] = t.value;
      if (t.dataset.campo === 'descripcion' || t.dataset.campo === 'clase') {
        const antes = l.ref;
        casar(l);
        /* Repintar solo al cambiar lo que se ve: no quitarle el foco mientras escribe. */
        if (t.dataset.campo === 'clase' || (ev.type === 'change' && antes !== l.ref)) pintarForm();
      }
    }
    if (t.dataset.piCampo || t.dataset.piLinea !== undefined) persistir();
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  for (const input of [$camara, $galeria]) {
    /* De la galería, varias a la vez (tarea 368b6690). */
    input.addEventListener('change', async () => {
      const archivos = Array.from(input.files || []);
      input.value = '';
      for (const archivo of archivos) await foto(archivo);
    });
  }

  /* Atrás (botón, gesto o navegador) y vuelta: el parte a medias sigue ahí. */
  window.addEventListener('hashchange', () => {
    if (!activa()) { persistir(); return; }
    if (form && datos) pintarActual();
    else lista();
  });
  AG.alSalir(persistir);
  window.addEventListener('online', () => { if (form) for (const x of form.fotos) if (!x.id && !x.subiendo) subir(x).then(persistir); });
  if (activa()) lista();
})();
