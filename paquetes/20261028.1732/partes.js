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
 *   3. TERMINADO: con su código. Mientras se escribe ya está en el ordenador
 *      (se guarda solo); al terminarlo le avisa al jefe de obra. El valor de lo robado (venta y coste) lo
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
   * y cada foto (autoguardado.js). Al volver se sigue donde estaba; si se
   * cerró la app, la lista ofrece seguir con él.
   *
   * Y SE MANDA SOLO (28-oct-2026, JC: «un parte o una NCR no llega al jefe de
   * obra hasta que pulsas enviar. Se manda solo y si no está terminada, pues
   * sigue en lista de abiertos»). En cuanto tiene lo mínimo (qué ha pasado y
   * algo escrito o una foto) se crea en el ordenador como «sin terminar», y
   * desde ahí cada cambio y cada foto se guardan solos (api/parte/alta). El id
   * lo pone el teléfono (`idAlta`): reintentar nunca lo duplica. Sin conexión
   * se queda en el teléfono y lo sube la cola (colaGuardado.js) al volver la
   * red. «Terminar el parte» lo cierra y ahí le avisa al jefe de obra (una
   * vez); hasta entonces lo ve en la lista como «sin terminar», sin aviso.
   */
  const AG = window.AUTOGUARDADO;
  const CLAVE = 'parte';
  const vacio = () => ({ obraId: null, tipo: '', fecha: hoy(), hora: ahoraHora(), zona: '', titulo: '', descripcion: '', gravedad: 'media',
    denuncia: 'no', atestado: '', causa: '', proveedorId: '', diasRetraso: '', lineas: [], fotos: [],
    idAlta: AG.nuevoId(), enServidor: false, codigo: '', cambios: 0, subidos: 0, terminar: false });
  const conContenido = (f) => Boolean(f && (f.tipo || String(f.titulo || '').trim() || String(f.descripcion || '').trim() || String(f.zona || '').trim()
    || (f.fotos || []).length || (f.lineas || []).some((l) => String(l.descripcion || '').trim())));
  /* Lo mínimo para existir en el ordenador: qué ha pasado y algo más. */
  const minimo = (f) => Boolean(f && f.tipo && PM.TIPOS[f.tipo] && conContenido({ ...f, tipo: '' }));
  /* ¿Queda algo por llegar al ordenador? */
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
  /* Lo que se guarda en el teléfono (sin los archivos ni el estado de la red). */
  const paraGuardar = (f) => {
    const { guardando, estadoRed, error, descartado, terminado, ...resto } = f;
    return { ...resto, fotos: AG.fotosParaGuardar(f.fotos).map(({ fallo, ...x }) => x) };
  };
  function persistir() {
    if (!form) return;
    if (conContenido(form)) {
      if (!AG.guardar(CLAVE, paraGuardar(form))) { AG.pintarMarca($app, 'error', 'No se ha podido guardar en el móvil'); return; }
    } else if (!form.enServidor) AG.borrar(CLAVE);
    if (activa()) AG.pintarMarca($app, ...estadoMarca());
  }
  /* Un cambio de lo escrito: al teléfono ya, y al ordenador enseguida. */
  function cambio(alMomento) {
    if (!form) return;
    form.cambios = (form.cambios || 0) + 1;
    persistir();
    if (alMomento) { clearTimeout(reloj); guardarServidor(form); } else programar();
  }
  let reloj = null;
  function programar(ms = 1200) {
    clearTimeout(reloj);
    reloj = setTimeout(() => { if (form && pendiente(form)) guardarServidor(form); }, ms);
  }
  async function recuperar() {
    const b = AG.leer(CLAVE);
    if (!conContenido(b)) return false;
    const { _en, ...resto } = b;
    form = { ...vacio(), ...resto, fotos: await AG.restaurarFotos(b.fotos) };
    /* Un borrador de antes del 28-oct no traía su id: se le pone uno. */
    if (!b.idAlta) persistir();
    return true;
  }

  /* ── El alta en el ordenador: una petición cada vez; si hay cambios mientras, otra detrás. */
  const CAMPOS = ['obraId', 'tipo', 'fecha', 'hora', 'zona', 'titulo', 'descripcion', 'gravedad', 'denuncia', 'atestado', 'causa', 'proveedorId', 'diasRetraso', 'lineas'];
  let cadena = Promise.resolve(null);
  let enCola = 0;
  function guardarServidor(f, opciones = {}) {
    if (!opciones.terminar && enCola > 0) return cadena;
    enCola += 1;
    cadena = cadena.then(() => { enCola -= 1; return mandarAlta(f, opciones); }, () => { enCola -= 1; return mandarAlta(f, opciones); });
    return cadena;
  }
  function pintarEstado(f) { if (form === f && activa()) AG.pintarMarca($app, ...estadoMarca()); }
  /* Lo que sabe el teléfono de este parte, al día (aunque ya no esté en pantalla). */
  function guardarLocal(f) {
    if (form === f) { persistir(); return; }
    const b = AG.leer(CLAVE);
    if (!b || b.idAlta !== f.idAlta) return;
    if (f.terminado) AG.borrar(CLAVE); else AG.guardar(CLAVE, paraGuardar(f));
  }
  async function mandarAlta(f, { terminar = false } = {}) {
    if (!f || f.terminado || f.descartado) return { ok: true };
    if (!minimo(f)) return { ok: false, minimo: false };
    if (!f.idAlta) f.idAlta = AG.nuevoId();
    if (!f.obraId) f.obraId = (obra() || {}).id || obraId;
    const version = f.cambios || 0;
    f.guardando = true;
    pintarEstado(f);
    try {
      for (const x of f.fotos) if (!x.enServidor && !x.id && !(await subir(x))) throw x.fallo || new Error('No se ha podido subir una foto.');
      const cuerpo = () => ({
        ...Object.fromEntries(CAMPOS.map((c) => [c, f[c]])), idAlta: f.idAlta, terminar: terminar || Boolean(f.terminar),
        fotos: f.fotos.filter((x) => !x.enServidor && x.id).map((x) => ({ k: kDe(x), fotoId: x.id })), fotosK: f.fotos.map(kDe).filter(Boolean),
      });
      let r = await postJson('api/parte/alta', cuerpo());
      /* El ordenador se reinició y olvidó las fotos en espera: se suben otra vez desde el teléfono. */
      if (r && r.ok && r.faltan && r.faltan.length) {
        for (const x of f.fotos) if (r.faltan.includes(kDe(x))) { x.id = null; if (!(await subir(x))) throw x.fallo || new Error('No se ha podido subir una foto.'); }
        r = await postJson('api/parte/alta', cuerpo());
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

  /* ── Terminar el parte: se valida entero y le avisa al jefe de obra. */
  async function terminar(boton) {
    const f = form;
    if (!f) return;
    const v = PM.validar({ ...f }, { hoy: hoy() });
    if (!v.ok) { aviso(v.error, 'aviso'); return; }
    boton.disabled = true;
    f.terminar = true;
    f.cambios = (f.cambios || 0) + 1;
    persistir();
    const r = await guardarServidor(f, { terminar: true });
    if (r && r.ok && f.terminado) {
      if (form === f) form = null;
      AG.borrar(CLAVE);
      $app.innerHTML = `
        <section class="resultado bien"><div class="icono">✓</div><h1>${esc(r.codigo || f.codigo)}</h1>
          <p>Parte terminado</p><p class="sub">${esc(r.avisados && r.avisados.length ? `Le sale a ${r.avisados.join(', ')}.` : 'Le sale al jefe de obra en la aplicación.')}</p></section>
        ${r.sinCasar ? `<p class="nota aviso">${r.sinCasar === 1 ? 'Un material no está' : `${r.sinCasar} materiales no están`} en la lista de la obra: el jefe de obra lo${r.sinCasar === 1 ? '' : 's'} casará para valorarlo${r.sinCasar === 1 ? '' : 's'}.</p>` : ''}
        <button class="boton grande" data-pi="nuevo">Otro parte</button>
        <button class="boton secundario" data-pi="lista">Volver a la lista</button>`;
      datos = await pedir('api/partes').catch(() => datos);
      return;
    }
    boton.disabled = false;
    if (r && r.sinRed) { aviso('Sin conexión: el parte queda guardado en el móvil y se terminará solo al volver la conexión.', 'aviso'); return; }
    f.terminar = false;
    persistir();
    aviso((r && r.error) || 'Falta subir alguna foto: vuelve a intentarlo.');
  }

  /* Descartar el parte a medias: del teléfono y, si ya estaba, del ordenador. */
  async function descartar() {
    if (!window.confirm('¿Descartar el parte sin terminar? Se borra lo escrito y sus fotos.')) return;
    await cadena;
    const b = form || AG.leer(CLAVE);
    if (b && b.enServidor && b.idAlta) {
      try {
        const r = await postJson('api/parte/alta', { idAlta: b.idAlta, descartar: true });
        if (!r.ok) throw new Error(r.error);
      } catch (e) { aviso(AG.sinRed(e) ? 'Sin conexión: se podrá descartar al volver la conexión.' : e.message); return; }
    }
    if (b) b.descartado = true;
    AG.borrar(CLAVE);
    form = null;
    lista();
  }

  /* Seguir con un parte sin terminar que está en el ordenador (también desde otro teléfono). */
  async function retomar(id) {
    const b = AG.leer(CLAVE);
    if (b && b.idAlta === id) { await recuperar(); if (activa()) pintarActual(); return; }
    if (b && conContenido(b) && (pendiente(b) || !b.enServidor)) {
      aviso('Tienes otro parte sin terminar en este teléfono: sigue con él o descártalo antes.', 'aviso');
      return;
    }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await pedir(`api/parte/alta?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      const { fotos: fotosSrv, ...resto } = r.parte;
      const fotos = [];
      for (const x of fotosSrv || []) {
        let blob = null;
        try {
          const res = await fetch(`api/parte/foto?id=${encodeURIComponent(id)}&i=${x.i}`, { cache: 'no-store' });
          if ((res.status || 200) < 400 && res.blob) blob = await res.blob();
        } catch { /* sin vista */ }
        fotos.push(blob ? await AG.fotoNueva(blob, { k: x.k, enServidor: true, id: null }) : { k: x.k, enServidor: true, id: null, local: null, url: '' });
      }
      if (b) AG.borrar(CLAVE);
      form = { ...vacio(), ...resto, enServidor: true, cambios: 0, subidos: 0, fotos };
      persistir();
      if (activa()) pintarActual();
    } catch (e) { aviso(e.message); lista(); }
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
    if (form && pendiente(form)) guardarServidor(form);
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
        <p><strong>Tienes un parte sin terminar</strong><br><small>${esc([b.codigo, (PM.TIPOS[b.tipo] || {}).nombre, b.titulo, (b.fotos || []).length ? `${b.fotos.length} foto${b.fotos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Sin título')}</small>
        <br><small>${pendiente(b) ? 'Aún no ha llegado entero al ordenador: se subirá solo con conexión.' : b.enServidor ? 'Guardado en el ordenador: el jefe de obra lo ve como «sin terminar».' : 'Solo en este teléfono.'}</small></p>
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
        ${p.enAlta ? `<span class="chip aviso">Sin terminar</span>${p.mio ? `<button class="boton secundario" data-pi="retomar" data-id="${esc(p.id)}">Seguir</button>` : ''}` : chipEstado(p.estado)}</li>` }) : '<p class="vacio">Todavía no hay partes en esta obra.</p>'}`;
  }

  /* ═══════════════════════════════════ 2. El parte */

  async function nuevo() {
    const o = obra();
    if (!o) return;
    /* Un parte sin terminar no se pisa: se sigue con él (o se descarta). */
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
      if (form.tipo && PM.TIPOS[form.tipo]) { cambio(true); pintarForm(); return; }
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
      <button class="boton grande" data-pi="terminar">Terminar el parte</button>
      <p class="nota centrada">Se guarda solo en el ordenador de la obra mientras lo escribes: el jefe de obra lo ve como «sin terminar». Al terminarlo le avisa, y lo puede imprimir y mandar por correo.</p>
      <button class="enlace" data-pi="descartar">Descartar este parte</button>
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
    f.fotos.push(x);
    if (form === f) { persistir(); if (activa()) pintarForm(); }
    f.cambios = (f.cambios || 0) + 1;
    await guardarServidor(f);
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
      x.fallo = e;
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

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-pi]');
    if (!b) return;
    const a = b.dataset.pi;
    if (a === 'lista') lista();
    else if (a === 'nuevo') { if (datos) nuevo(); }
    else if (a === 'seguir') seguir();
    else if (a === 'descartar') descartar();
    else if (a === 'retomar') retomar(b.dataset.id);
    else if (a === 'tipo') {
      form.tipo = b.dataset.id;
      if ((form.tipo === 'robo' || form.tipo === 'danos') && !form.lineas.length) form.lineas.push(lineaVacia('material'));
      cambio(true);
      pintarForm();
    } else if (a === 'cambiar-tipo') pintarTipo();
    else if (a === 'linea') { form.lineas.push(lineaVacia(b.dataset.clase)); cambio(true); pintarForm(); }
    else if (a === 'quitar-linea') { form.lineas.splice(Number(b.dataset.i), 1); cambio(true); pintarForm(); }
    else if (a === 'ver-foto') verFoto(Number(b.dataset.i));
    else if (a === 'foto') $camara.click();
    else if (a === 'galeria') $galeria.click();
    else if (a === 'terminar' || a === 'enviar') terminar(b);
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
    /* Al teléfono con cada tecla; al ordenador al salir del campo (o al parar de escribir). */
    if (t.dataset.piCampo || t.dataset.piLinea !== undefined) cambio(ev.type === 'change');
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
  const alIrse = () => { persistir(); if (form && pendiente(form)) guardarServidor(form); };
  window.addEventListener('hashchange', () => {
    if (!activa()) { alIrse(); return; }
    if (form && datos) pintarActual();
    else lista();
  });
  AG.alSalir(alIrse);
  window.addEventListener('online', () => { if (form && pendiente(form)) guardarServidor(form); });

  /* Lo que se quedó en el teléfono (sin conexión, o la app cerrada antes de
     llegar) lo sube la cola sola al volver la red, aunque no se abra Partes. */
  if (window.COLA_GUARDADO) {
    window.COLA_GUARDADO.registrar(CLAVE, async (clave, b) => {
      if (clave !== CLAVE) return true; /* otro borrador que empieza igual: no es nuestro */
      if (form && form.idAlta === b.idAlta) {
        if (!pendiente(form)) return true;
        const r = await guardarServidor(form, { terminar: Boolean(form.terminar) });
        return Boolean(r && r.ok) && !pendiente(form);
      }
      if (!pendiente(b)) return true;
      const f = { ...vacio(), ...b, fotos: await AG.restaurarFotos(b.fotos) };
      const r = await guardarServidor(f, { terminar: Boolean(f.terminar) });
      return Boolean(r && r.ok) && !pendiente(f);
    });
  }
  if (activa()) lista();
})();
