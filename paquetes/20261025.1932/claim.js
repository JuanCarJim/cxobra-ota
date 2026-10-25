'use strict';
/*
 * REPORTAR AL CLAIM EN EL MÓVIL (#claim, dentro de Incidencias) — 24-oct-2026.
 *
 * JC: «una sección en el móvil para que puedan ponerse estos reportes con las
 * fotos y todo». Lo que para el claim a LIMAK se rascaba días después de
 * WhatsApp y correos, se cuenta EN EL MOMENTO desde la obra:
 *
 *   · motivo (los mismos de la reclamación) y quién lo provoca,
 *   · zona o planta, qué pasa (escrito o dictado) y fotos con la cámara,
 *   · personas paradas y subcontrata, y el CRONÓMETRO «empieza la espera /
 *     termina»: horas-persona = personas × tiempo (también a mano),
 *   · si se avisó al cliente: a quién, cuándo, por dónde y el pantallazo.
 *
 * Al enviar, el ordenador lo convierte en un hecho PROPUESTO de la reclamación
 * abierta de la obra (o lo deja en la bandeja «sin reclamación» hasta que el
 * jefe de obra lo asigne); validarlo o descartarlo se hace en el ordenador.
 *
 * SIN COBERTURA NO SE PIERDE NADA: si el envío falla por la red, el reporte
 * (con sus fotos) se guarda en el propio teléfono (IndexedDB) y se reintenta
 * solo al volver la conexión; el mismo reporte nunca llega dos veces.
 */
(function claim() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc } = C;
  const activa = () => C.activa('claim');
  const CRONO = 'claim.cronometro';

  const ahoraLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const cuandoEs = (t) => {
    if (!t) return '';
    const d = new Date(t);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.toLocaleDateString('es-ES')} ${d.toTimeString().slice(0, 5)}`;
  };
  const idNuevo = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  let datos = null;     // lista del servidor
  let opciones = null;  // motivos, causas, medios…
  let form = null;
  let enCola = [];      // reportes guardados en el teléfono, sin enviar
  let reloj = null;

  /* ═══════════════════════════════════ La cola en el teléfono (IndexedDB) */

  const cola = {
    abrir() {
      return new Promise((ok, mal) => {
        if (!window.indexedDB) { mal(new Error('sin IndexedDB')); return; }
        const q = indexedDB.open('cx-claim', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('cola', { keyPath: 'clienteId' });
        q.onsuccess = () => ok(q.result);
        q.onerror = () => mal(q.error);
      });
    },
    async hacer(modo, fn) {
      const db = await this.abrir();
      return new Promise((ok, mal) => {
        const t = db.transaction('cola', modo);
        const r = fn(t.objectStore('cola'));
        t.oncomplete = () => { db.close(); ok(r && r.result); };
        t.onerror = () => { db.close(); mal(t.error); };
      });
    },
    guardar(x) { return this.hacer('readwrite', (s) => s.put(x)); },
    quitar(id) { return this.hacer('readwrite', (s) => s.delete(id)); },
    todos() { return this.hacer('readonly', (s) => s.getAll()).then((l) => l || []); },
  };

  async function refrescarCola() {
    try { enCola = await cola.todos(); } catch { enCola = []; }
  }

  /* Manda un reporte (sus fotos primero). Devuelve la respuesta del ordenador. */
  async function mandar(r) {
    const ids = [];
    for (const f of r.fotos) ids.push(await C.subirFoto(f));
    const captura = r.captura ? await C.subirFoto(r.captura) : '';
    return C.postJson('api/claim', { ...r.datos, fotos: ids, captura });
  }

  const sinRed = (e) => e instanceof TypeError || /failed to fetch|load failed|network/i.test(String(e && e.message));
  let vaciando = false;

  /* Reintenta lo que quedó en el teléfono; lo que el ordenador rechaza con un motivo se deja a la vista. */
  async function vaciarCola() {
    if (vaciando) return;
    vaciando = true;
    try {
      await refrescarCola();
      let enviados = 0;
      for (const r of enCola) {
        try {
          const j = await mandar(r);
          if (j && j.ok) { await cola.quitar(r.clienteId); enviados += 1; }
          else if (j) { r.error = j.error || 'El ordenador no lo ha aceptado.'; await cola.guardar(r); }
        } catch (e) {
          if (sinRed(e)) break;
          r.error = e.message; await cola.guardar(r);
        }
      }
      await refrescarCola();
      if (enviados) C.aviso(enviados === 1 ? 'Un reporte guardado se ha enviado.' : `${enviados} reportes guardados se han enviado.`, 'bien');
      if (enviados && activa() && !form) lista();
    } finally { vaciando = false; }
  }
  window.addEventListener('online', () => { vaciarCola(); });

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null; pararReloj();
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    await refrescarCola();
    try {
      const q = encodeURIComponent(C.obraId());
      [datos, opciones] = await Promise.all([C.pedir(`api/claim?obra=${q}`), C.pedir(`api/claim/opciones?obra=${q}`)]);
      if (!datos.ok) throw new Error(datos.error);
      if (!opciones.ok) throw new Error(opciones.error);
    } catch (e) {
      if (!activa()) return;
      /* Sin red también se puede reportar: el reporte se guarda en el teléfono. */
      if (sinRed(e)) { datos = datos || { filas: [], bandeja: 0 }; opciones = opciones || null; pintarLista(true); return; }
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cl="lista">Reintentar</button></div>`;
      return;
    }
    if (!activa() || form) return;
    pintarLista(false);
    vaciarCola();
  }

  const ESTADO = { enHecho: ['bien', 'En la reclamación'], bandeja: ['aviso', 'Sin reclamación'], descartado: ['neutra', 'Descartado'] };

  function pintarLista(sinConexion) {
    const mias = datos.filas || [];
    const puedeVer = !opciones || opciones.puede;
    $app.innerHTML = `
      <section class="acciones">
        <button class="boton grande" data-cl="nuevo">Reportar al claim</button>
        <p class="nota centrada">${opciones && opciones.reclamacion
          ? `Entra como hecho propuesto en ${esc(opciones.reclamacion.codigo)}. El jefe de obra lo valida.`
          : 'Esta obra no tiene reclamación abierta: queda en la bandeja y el jefe de obra lo asigna.'}</p>
      </section>
      ${sinConexion ? '<p class="nota aviso">Sin conexión con el ordenador. Puedes reportar igual: se guarda en el teléfono y se envía solo al volver la cobertura.</p>' : ''}
      ${enCola.length ? `<h2>Guardados en el teléfono <span class="cuenta">${enCola.length}</span></h2>
        <ul class="recientes">${enCola.map((r) => `<li><div><strong>${esc(r.titulo || 'Reporte')}</strong><br><small>${esc(cuandoEs(r.datos.reportadoEn))} · ${r.fotos.length} fotos${r.error ? ` · ${esc(r.error)}` : ''}</small></div>
          <span class="chip aviso">${r.error ? 'Revisar' : 'Por enviar'}</span></li>`).join('')}</ul>
        <button class="boton secundario" data-cl="reenviar">Enviar ahora</button>` : ''}
      <h2>${puedeVer && opciones && opciones.puede.validar ? 'Reportes de la obra' : 'Mis reportes'} <span class="cuenta">${mias.length}</span></h2>
      ${datos.bandeja && opciones && opciones.puede.validar ? `<p class="nota aviso">${datos.bandeja === 1 ? 'Un reporte espera' : `${datos.bandeja} reportes esperan`} reclamación: se asignan en el ordenador (Reclamaciones › Del móvil).</p>` : ''}
      ${mias.length ? `<ul class="recientes">${mias.map((r) => {
        const [tono, txt] = ESTADO[r.estado] || ['neutra', r.estado];
        return `<li><div><strong>${esc(r.motivoNombre)}</strong>${r.zona ? ` · ${esc(r.zona)}` : ''}<br>
          <small>${esc(cuandoEs(r.reportadoEn))}${r.autor ? ` · ${esc(r.autor)}` : ''}${r.nFotos ? ` · ${r.nFotos} fotos` : ''}${r.horasPersona ? ` · ${C.cifra(r.horasPersona, 1)} h-p` : ''}</small></div>
          <span class="chip ${tono}">${esc(txt)}</span></li>`;
      }).join('')}</ul>` : '<p class="vacio">Todavía no has reportado nada en esta obra.</p>'}`;
  }

  /* ═══════════════════════════════════ 2. El reporte */

  function nuevo() {
    if (!opciones) { C.aviso('Sin conexión con el ordenador: vuelve a abrir la sección con cobertura una vez para cargar los motivos.', 'aviso'); return; }
    let crono = null;
    try { crono = JSON.parse(localStorage.getItem(CRONO) || 'null'); } catch { /* sin almacenamiento */ }
    form = {
      clienteId: idNuevo(), obraId: C.obraId(), motivo: '', causa: 'cliente', zona: '', descripcion: '', subcontrata: '',
      personas: '', horasPersona: '', manual: false, inicio: crono && crono.obraId === C.obraId() ? crono.inicio : null, fin: null,
      avisado: false, avisadoA: '', avisadoCuando: ahoraLocal(), avisadoMedio: 'whatsapp', fotos: [], captura: null,
      reportadoEn: new Date().toISOString(),
    };
    pintarForm();
  }

  const opcion = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;
  const pastilla = (campo, v, txt, sel) => `<button type="button" class="opcion ${v === sel ? 'activa' : ''}" data-cl="elegir" data-campo="${campo}" data-v="${esc(v)}" aria-pressed="${v === sel}">${esc(txt)}</button>`;

  function pintarForm() {
    const f = form;
    const hayVoz = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    $app.innerHTML = `
      <button class="volver" data-cl="lista">‹ Reportes</button>
      <p class="nota">${esc((C.obra() || {}).codigo || '')} · ${esc((C.obra() || {}).nombre || '')}</p>
      <h2>Motivo</h2>
      <div class="opciones">${opciones.motivos.map((m) => pastilla('motivo', m.id, m.nombre, f.motivo)).join('')}</div>
      <h2>Quién lo provoca</h2>
      <div class="opciones">${opciones.causas.map((c) => pastilla('causa', c.id, c.nombre, f.causa)).join('')}</div>
      <div class="campos">
        <label>Zona o planta<input data-cl-campo="zona" value="${esc(f.zona)}" placeholder="P2, sala de máquinas…" autocomplete="off"></label>
        <label>Subcontrata afectada<input data-cl-campo="subcontrata" value="${esc(f.subcontrata)}" list="cl-sub" autocomplete="off"></label>
      </div>
      <datalist id="cl-sub">${opciones.subcontratas.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      <label class="notas">Qué está pasando${hayVoz ? ' <button type="button" class="enlace" data-cl="dictar">🎤 Dictar</button>' : ''}
        <textarea data-cl-campo="descripcion" rows="4" placeholder="Qué pasa, quién lo ha pedido, qué impide hacer…">${esc(f.descripcion)}</textarea></label>
      <h2>Fotos <span class="cuenta">${f.fotos.length}</span></h2>
      <div class="fotos">${f.fotos.map((x, i) => `<button type="button" class="miniatura" data-cl="quitar-foto" data-i="${i}" aria-label="Quitar la foto"><img src="${esc(x.url)}" alt="Foto del reporte"></button>`).join('')}
        <button class="anadir-foto" data-cl="foto" aria-label="Hacer una foto">＋</button></div>
      <button class="enlace" data-cl="galeria">o elegir de la galería</button>
      <h2>Gente parada</h2>
      <div class="campos">
        <label>Personas paradas<input data-cl-campo="personas" value="${esc(f.personas)}" inputmode="decimal" placeholder="nº"></label>
        <label>Horas-persona<input data-cl-campo="horasPersona" value="${esc(f.horasPersona)}" inputmode="decimal" placeholder="personas × horas"></label>
      </div>
      <div class="cronometro" id="cl-crono">${cronoHtml()}</div>
      <h2>¿Se avisó al cliente?</h2>
      <div class="opciones">${pastilla('avisado', 'no', 'No', f.avisado ? 'si' : 'no')}${pastilla('avisado', 'si', 'Sí', f.avisado ? 'si' : 'no')}</div>
      ${f.avisado ? `<div class="campos">
          <label>A quién<input data-cl-campo="avisadoA" value="${esc(f.avisadoA)}" placeholder="Nombre y cargo" autocomplete="off"></label>
          <label>Cuándo<input type="datetime-local" data-cl-campo="avisadoCuando" value="${esc(f.avisadoCuando)}" max="${ahoraLocal()}"></label>
        </div>
        <div class="opciones">${opciones.medios.map((m) => pastilla('avisadoMedio', m.id, m.nombre, f.avisadoMedio)).join('')}</div>
        <div class="fotos">${f.captura ? `<button type="button" class="miniatura" data-cl="quitar-captura" aria-label="Quitar el pantallazo"><img src="${esc(f.captura.url)}" alt="Pantallazo del aviso"></button>` : ''}
          <button class="anadir-foto" data-cl="captura" aria-label="Adjuntar el pantallazo del mensaje">＋</button></div>
        <p class="nota">Adjunta el pantallazo del mensaje, si lo hay.</p>` : ''}
      <button class="boton grande" data-cl="enviar">Enviar el reporte</button>
      <p class="nota centrada">Fecha, hora y autor se ponen solos. Sin cobertura se guarda en el teléfono.</p>`;
    arrancarReloj();
  }

  /* ═══════════════════════════════════ El cronómetro */

  const transcurridoMs = () => (form && form.inicio ? (form.fin ? Date.parse(form.fin) : Date.now()) - Date.parse(form.inicio) : 0);
  const hms = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  function cronoHtml() {
    const f = form;
    if (!f.inicio) return '<button type="button" class="boton secundario" data-cl="empieza">Empieza la espera</button>';
    return `<span class="tiempo" id="cl-tiempo">${hms(transcurridoMs())}</span>
      ${f.fin ? `<button type="button" class="boton secundario" data-cl="reinicia">Empezar de nuevo</button>`
        : '<button type="button" class="boton" data-cl="termina">Termina la espera</button>'}`;
  }
  function arrancarReloj() {
    pararReloj();
    if (form && form.inicio && !form.fin) reloj = setInterval(() => { const e = document.getElementById('cl-tiempo'); if (e) e.textContent = hms(transcurridoMs()); else pararReloj(); }, 1000);
  }
  function pararReloj() { if (reloj) { clearInterval(reloj); reloj = null; } }
  function recalcularHoras() {
    const p = Number(String(form.personas).replace(',', '.'));
    if (form.manual || !form.inicio || !(p > 0)) return;
    form.horasPersona = String(Math.round(p * (transcurridoMs() / 3600000) * 100) / 100).replace('.', ',');
  }
  const guardarCrono = () => { try { if (form.inicio && !form.fin) localStorage.setItem(CRONO, JSON.stringify({ obraId: form.obraId, inicio: form.inicio })); else localStorage.removeItem(CRONO); } catch { /* sin almacenamiento */ } };

  /* ═══════════════════════════════════ Dictado */

  function dictar() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'es-ES'; r.interimResults = false;
    r.onresult = (ev) => {
      const t = Array.from(ev.results).map((x) => x[0].transcript).join(' ').trim();
      if (t) { form.descripcion = `${form.descripcion ? `${form.descripcion} ` : ''}${t}`; pintarForm(); }
    };
    r.onerror = () => C.aviso('No se ha podido dictar: escríbelo con el teclado.', 'aviso');
    try { r.start(); C.aviso('Habla ahora…', 'aviso'); } catch { /* ya estaba escuchando */ }
  }

  /* ═══════════════════════════════════ Enviar */

  async function enviar(boton) {
    const f = form;
    if (!f.motivo) { C.aviso('Elige el motivo.'); return; }
    if (!f.descripcion.trim() && !f.fotos.length) { C.aviso('Cuenta qué pasa o haz una foto.'); return; }
    if (f.inicio && !f.fin) { f.fin = new Date().toISOString(); recalcularHoras(); }
    const reporte = {
      clienteId: f.clienteId,
      titulo: (opciones.motivos.find((m) => m.id === f.motivo) || {}).nombre,
      datos: {
        clienteId: f.clienteId, obraId: f.obraId, motivo: f.motivo, causa: f.causa, zona: f.zona, descripcion: f.descripcion, subcontrata: f.subcontrata,
        personas: f.personas, horasPersona: f.horasPersona, inicioEspera: f.inicio, finEspera: f.fin, reportadoEn: f.reportadoEn,
        avisado: f.avisado, avisadoA: f.avisadoA, avisadoCuando: f.avisado && f.avisadoCuando ? new Date(f.avisadoCuando).toISOString() : null, avisadoMedio: f.avisadoMedio,
      },
      fotos: f.fotos.map((x) => x.blob), captura: f.avisado && f.captura ? f.captura.blob : null,
    };
    boton.disabled = true;
    try {
      const r = await mandar(reporte);
      if (!r.ok) throw new Error(r.error);
      terminado(r, false);
    } catch (e) {
      if (!sinRed(e)) { C.aviso(e.message); boton.disabled = false; return; }
      /* Sin cobertura: al teléfono, y se manda solo cuando vuelva. */
      try { await cola.guardar(reporte); terminado(null, true); } catch { C.aviso('Sin cobertura y no se puede guardar en el teléfono: no cierres esta pantalla.'); boton.disabled = false; }
    }
  }

  function terminado(r, guardado) {
    try { localStorage.removeItem(CRONO); } catch { /* sin almacenamiento */ }
    pararReloj();
    form = null;
    $app.innerHTML = `
      <section class="resultado ${guardado ? 'aviso' : 'bien'}"><div class="icono">${guardado ? '⏳' : '✓'}</div>
        <h1>${guardado ? 'Guardado en el teléfono' : 'Reporte enviado'}</h1>
        <p class="sub">${guardado ? 'No hay cobertura con el ordenador. Se enviará solo, con sus fotos, cuando vuelva.'
          : r.estado === 'enHecho' ? `Ya es un hecho propuesto en ${esc(r.reclamacion || 'la reclamación')}. El jefe de obra lo validará.`
            : 'La obra no tiene reclamación abierta: queda en la bandeja y el jefe de obra lo asignará.'}</p></section>
      <button class="boton grande" data-cl="nuevo">Otro reporte</button>
      <button class="boton secundario" data-cl="lista">Volver a la lista</button>`;
  }

  /* ═══════════════════════════════════ Los clics */

  const $camara = document.getElementById('camara-claim');
  const $galeria = document.getElementById('galeria-claim');
  const $captura = document.getElementById('captura-claim');

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-cl]');
    if (!b) return;
    const a = b.dataset.cl;
    if (a === 'lista') lista();
    else if (a === 'reenviar') vaciarCola().then(() => { if (activa() && !form) lista(); });
    else if (a === 'nuevo') nuevo();
    else if (!form) return;
    else if (a === 'elegir') {
      const c = b.dataset.campo;
      if (c === 'avisado') form.avisado = b.dataset.v === 'si';
      else form[c] = b.dataset.v;
      pintarForm();
    } else if (a === 'foto') $camara.click();
    else if (a === 'galeria') $galeria.click();
    else if (a === 'captura') $captura.click();
    else if (a === 'quitar-foto') { form.fotos.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'quitar-captura') { form.captura = null; pintarForm(); }
    else if (a === 'dictar') dictar();
    else if (a === 'empieza') { form.inicio = new Date().toISOString(); form.fin = null; guardarCrono(); pintarForm(); }
    else if (a === 'termina') { form.fin = new Date().toISOString(); recalcularHoras(); guardarCrono(); pintarForm(); }
    else if (a === 'reinicia') { form.inicio = null; form.fin = null; form.manual = false; form.horasPersona = ''; guardarCrono(); pintarForm(); }
    else if (a === 'enviar') enviar(b);
  });
  $app.addEventListener('input', (ev) => {
    if (!activa() || !form) return;
    const k = ev.target.dataset.clCampo;
    if (!k) return;
    form[k] = ev.target.value;
    if (k === 'horasPersona') form.manual = ev.target.value.trim() !== '';
    if (k === 'personas' && form.fin) { recalcularHoras(); const h = $app.querySelector('[data-cl-campo="horasPersona"]'); if (h) h.value = form.horasPersona; }
  });
  const recoger = (input, aCampo) => input && input.addEventListener('change', () => {
    const archivo = input.files && input.files[0];
    input.value = '';
    if (!archivo || !form) return;
    const x = { blob: archivo, url: URL.createObjectURL(archivo) };
    if (aCampo === 'captura') form.captura = x; else form.fotos.push(x);
    pintarForm();
  });
  recoger($camara); recoger($galeria); recoger($captura, 'captura');

  window.addEventListener('hashchange', () => { if (activa()) lista(); else pararReloj(); });
  if (activa()) lista(); else vaciarCola();
})();
