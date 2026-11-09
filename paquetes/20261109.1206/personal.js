'use strict';
/*
 * OBRA › PERSONAL EN EL MÓVIL: el encargado ficha a los operarios de las
 * subcontratas con el QR de su tarjeta.
 *
 *   1. HOY: cada subcontrata con los que se esperaban y los que han venido, y
 *      sus operarios (fichado por QR, a mano o todavía no). Arriba, «Leer
 *      tarjeta».
 *   2. LA FOTO de la tarjeta (o de varias juntas) se manda al ordenador, que
 *      lee los QR y los ficha. Sale quién es y si ya lo estaba.
 *   3. A MANO: el que se ha dejado la tarjeta se ficha desde la lista, y
 *      queda marcado «a mano». El que llega nuevo se da de alta aquí; la
 *      tarjeta se imprime en el ordenador.
 *
 * Por qué una foto y no la cámara en directo: la página llega por la wifi
 * sin https, y así el navegador no deja usar la cámara en vivo. La foto sí.
 * Las acciones van con data-per (las de albaranes usan data-accion).
 */
(function personal() {
  const $app = document.getElementById('app');
  const $camara = document.getElementById('camara-qr');

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
  const fechaLarga = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
  const activa = () => location.hash === '#personal';
  const CLASE = { bien: 'bien', aviso: 'aviso', mal: 'mal', vacio: 'neutra', futuro: 'neutra' };

  /*
   * AUTOGUARDADO (JC, 28-oct: «en toda la app»): el alta de un operario vive
   * en el teléfono desde la primera letra (`cx.borrador.personal.alta.<id>`).
   * Atrás, otra pantalla o cerrar la app no la pierden: al volver a «+ Operario
   * nuevo» sale como se dejó. «Dar de alta» es el acto de darlo de alta (crea
   * una persona que ficha): se manda con un id propio, así que repetirlo sin
   * red no lo duplica, y si no hay conexión la cola lo manda sola al volver.
   */
  const AG = window.AUTOGUARDADO || null;
  const COLA = window.COLA_GUARDADO || null;
  const CLAVE = 'personal.alta.';
  let altaForm = null;

  let datos = null;
  let obraId = null;
  /* La obra es la elegida en la cabecera (carcasa.js), la misma para todas. */
  try { obraId = localStorage.getItem('movil.obra') || localStorage.getItem('personal.obra'); } catch { /* sin almacenamiento */ }
  window.addEventListener('movil:obra', (ev) => { obraId = ev.detail; if (activa() && datos) pintarHoy(); });

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

  const obra = () => ((datos && datos.obras) || []).find((o) => o.id === obraId) || ((datos && datos.obras) || [])[0] || null;

  /* ═══════════════════════════════════ 1. Hoy */

  async function cargar() {
    datos = await pedir('api/personal');
    document.getElementById('quien').textContent = datos.quien || '';
  }

  async function hoy() {
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      await cargar();
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-per="hoy">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintarHoy();
  }

  function pintarHoy() {
    const obras = datos.obras || [];
    const o = obra();
    const puede = datos.puede && datos.puede.fichar;
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas en las que fichar.</p>'; return; }
    const previsto = o.previsto;
    const estado = previsto === null ? (o.real ? 'aviso' : 'neutra') : o.real >= previsto ? 'bien' : o.real / previsto >= 0.8 ? 'aviso' : 'mal';
    $app.innerHTML = `
      ${window.CX && window.CX.obras().length ? '' : obras.length > 1 ? `<label class="elegir-obra">Obra<select data-per-cambio="obra">${obras.map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select></label>` : `<p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>`}
      <section class="hoy ${estado}">
        <div class="cifra-grande"><b>${o.real}</b>${previsto !== null ? `<span> de ${previsto}</span>` : ''}</div>
        <div>${previsto !== null ? 'han venido de los previstos' : o.real === 1 ? 'ha venido (sin previsión para hoy)' : 'han venido (sin previsión para hoy)'}</div>
        <small>${esc(fechaLarga(datos.fecha))}${o.mano ? ` · ${o.mano} a mano` : ''}</small>
      </section>
      ${puede ? `<section class="acciones">
        <button class="boton grande" data-per="leer"><i class="ic ic-tarjeta"></i>Leer tarjeta del operario</button>
        <p class="nota centrada">Puedes sacar varias tarjetas en la misma foto.</p>
      </section>` : '<p class="nota">Tu rol puede ver quién ha venido, pero no fichar.</p>'}
      <h2>Subcontratas <span class="cuenta">${o.subcontratas.length}</span></h2>
      ${o.subcontratas.length ? window.CX.listaAgrupada('personal-subs', o.subcontratas, { envolver: (h) => h, fila: (s) => tarjetaSub(s, puede), repintar: pintarHoy }) : '<p class="vacio">Aún no hay subcontratas con operarios dados de alta ni previsión en esta obra.</p>'}
      ${puede ? avisoAltasPendientes() : ''}
      ${puede ? '<button class="boton secundario" data-per="alta">+ Operario nuevo</button>' : ''}`;
  }

  /* Altas que están en el móvil sin haber llegado al ordenador. */
  function avisoAltasPendientes() {
    const p = pendientesAlta().map((x) => x.b);
    if (!p.length) return '';
    const mandando = p.filter((b) => b.listo);
    const abiertas = p.filter((b) => !b.listo && b.nombre);
    return `${mandando.length ? `<p class="nota aviso">${mandando.length === 1 ? `${esc(mandando[0].nombre)} está` : `${mandando.length} altas están`} en el móvil y se mandará${mandando.length === 1 ? '' : 'n'} sola${mandando.length === 1 ? '' : 's'} al tener conexión.</p>` : ''}
      ${abiertas.length ? `<p class="nota">Alta sin terminar: ${esc(abiertas[0].nombre)}. Pulsa «+ Operario nuevo» para seguir.</p>` : ''}`;
  }

  function tarjetaSub(s, puede) {
    /* Previsión 0 y nadie fichado no es «0 de 0»: es que no hay previsión. */
    const chip = s.previsto === null || (!s.previsto && !s.real)
      ? `<span class="chip ${s.real ? 'aviso' : 'neutra'}">${s.real} · sin previsión</span>`
      : `<span class="chip ${CLASE[s.estado] || 'neutra'}">${s.real} de ${s.previsto}</span>`;
    return `<article class="tarjeta sub">
      <div class="cabeza-sub"><strong>${esc(s.nombre)}</strong>${chip}</div>
      ${s.operarios.length ? `<ul class="operarios">${s.operarios.map((x) => `<li>
        <div><span class="nombre">${esc(x.nombre)}</span>${x.oficio ? ` <small>${esc(x.oficio)}</small>` : ''}</div>
        ${x.fichado ? `<span class="chip ${x.fichado === 'qr' ? 'bien' : 'aviso'}">${x.fichado === 'qr' ? '✓' : '✎ a mano'} ${esc(hora(x.hora))}</span>`
          : puede ? `<button class="enlace" data-per="mano" data-id="${esc(x.id)}" data-nombre="${esc(x.nombre)}">Fichar a mano</button>` : '<span class="chip neutra">No ha venido</span>'}
      </li>`).join('')}</ul>` : '<p class="nota">Sin operarios dados de alta.</p>'}
    </article>`;
  }

  /* ═══════════════════════════════════ 2. La foto de la tarjeta */

  async function fotoQr(archivo) {
    if (!archivo) return;
    $app.innerHTML = '<div class="leyendo"><div class="giro"></div><p>Leyendo la tarjeta…</p><small>El QR se lee en el ordenador de la obra.</small></div>';
    try {
      const r = await pedir('api/qr', { method: 'POST', headers: { 'Content-Type': archivo.type || 'image/jpeg' }, body: archivo });
      if (!r.ok) throw new Error(r.error);
      resultado(r.resultados);
    } catch (e) {
      $app.innerHTML = `<section class="resultado mal"><div class="icono">?</div><h1>No se ha leído</h1><p class="sub">${esc(e.message)}</p></section>
        <button class="boton grande" data-per="leer"><i class="ic ic-camara"></i>Repetir la foto</button>
        <button class="boton secundario" data-per="hoy">Volver a la lista</button>`;
    }
  }

  const QUE = {
    fichado: ['bien', '✓', 'Fichado'],
    yaFichado: ['aviso', '=', 'Ya estaba fichado hoy'],
    baja: ['mal', '✕', 'De baja en la obra'],
    otraObra: ['mal', '✕', 'No es de tus obras'],
    desconocido: ['mal', '?', 'Tarjeta que no existe'],
    noEsTarjeta: ['mal', '?', 'Ese QR no es una tarjeta de operario'],
  };

  function resultado(lista) {
    const uno = lista.length === 1 ? lista[0] : null;
    const [clase, icono, titulo] = uno ? QUE[uno.estado] || QUE.desconocido : ['bien', String(lista.filter((x) => x.estado === 'fichado').length), 'fichados'];
    $app.innerHTML = `
      <section class="resultado ${clase}">
        <div class="icono">${esc(icono)}</div>
        <h1>${esc(uno && uno.nombre ? uno.nombre : titulo)}</h1>
        ${uno ? `<p>${esc(uno.nombre ? titulo : '')}${uno.estado === 'yaFichado' ? ` a las ${esc(hora(uno.hora))}${uno.origen === 'mano' ? ' (a mano)' : ''}` : uno.estado === 'fichado' ? ` a las ${esc(hora(uno.hora))}` : ''}</p>` : `<p>${lista.length} tarjetas en la foto</p>`}
        ${uno && uno.proveedor ? `<p class="sub">${esc(uno.proveedor)}${uno.oficio ? ` · ${esc(uno.oficio)}` : ''}${uno.obra ? ` · ${esc(uno.obra)}` : ''}</p>` : ''}
      </section>
      ${uno ? '' : `<ul class="recientes">${lista.map((x) => { const [c, , t] = QUE[x.estado] || QUE.desconocido; return `<li><div><strong>${esc(x.nombre || '—')}</strong><br><small>${esc(x.proveedor || '')}</small></div><span class="chip ${c}">${esc(t)}</span></li>`; }).join('')}</ul>`}
      <button class="boton grande" data-per="leer"><i class="ic ic-camara"></i>Siguiente tarjeta</button>
      <button class="boton secundario" data-per="hoy">Volver a la lista</button>`;
    cargar().catch(() => {});
  }

  /* ═══════════════════════════════════ 3. A mano y altas */

  async function aMano(id, nombre) {
    if (!window.confirm(`¿Fichar a ${nombre} a mano? Quedará marcado «a mano», no por tarjeta.`)) return;
    try {
      const r = await postJson('api/fichar', { operarioId: id });
      if (!r.ok) throw new Error(r.error);
      aviso(`${nombre}: fichado a mano a las ${hora(r.hora)}.`, 'bien');
      await cargar();
      pintarHoy();
    } catch (e) { aviso(e.message); }
  }

  const TEXTO_MARCA = { movil: 'Guardado en el móvil', guardado: 'Guardado', sinRed: 'Sin conexión, se guardará', error: 'No se ha guardado' };
  const pendientesAlta = () => (COLA ? COLA.claves(CLAVE) : []).map((k) => ({ clave: k, b: AG ? AG.leer(k) : null })).filter((x) => x.b);
  const nuevoId = () => `op${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  function apuntarAlta() {
    if (!AG || !altaForm) return;
    AG.guardar(CLAVE + altaForm.id, { ...altaForm });
  }
  function marcaAlta(estado) {
    const el = $app.querySelector && $app.querySelector('.autoguardado');
    if (el) { el.className = `autoguardado ${estado}`; el.textContent = TEXTO_MARCA[estado] || ''; }
  }

  function alta() {
    const o = obra();
    if (!o) return;
    /* Un alta que se dejó a medias (o sin red) vuelve tal cual. */
    if (!altaForm) {
      const previo = pendientesAlta().map((x) => x.b).filter((b) => b.obraId === o.id).sort((a, b) => (b._en || 0) - (a._en || 0))[0];
      altaForm = previo ? { id: previo.id, obraId: o.id, nombre: previo.nombre || '', proveedorId: previo.proveedorId || '', oficio: previo.oficio || '', ficharHoy: previo.ficharHoy !== false, listo: false }
        : { id: nuevoId(), obraId: o.id, nombre: '', proveedorId: '', oficio: '', ficharHoy: true, listo: false };
    }
    const f = altaForm;
    const opciones = (lista) => lista.map((p) => `<option value="${esc(p.id)}" ${p.id === f.proveedorId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
    $app.innerHTML = `
      <div class="barra-editor"><button class="volver" data-per="hoy">‹ Personal</button><span class="autoguardado ${f.nombre ? 'movil' : ''}" role="status" aria-live="polite">${f.nombre ? 'Guardado en el móvil' : ''}</span></div>
      <h2>Operario nuevo</h2>
      <p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}. Solo el nombre, la empresa y el oficio: nada más.</p>
      <label>Nombre y apellido<input id="a-nombre" autocomplete="off" autocapitalize="words" value="${esc(f.nombre)}"></label>
      <label>Empresa<select id="a-empresa"><option value="">Elige…</option>
        ${o.proveedores.deObra.length ? `<optgroup label="En esta obra">${opciones(o.proveedores.deObra)}</optgroup>` : ''}
        ${o.proveedores.resto.length ? `<optgroup label="Otras">${opciones(o.proveedores.resto)}</optgroup>` : ''}
      </select></label>
      <label>Oficio (si quieres)<input id="a-oficio" autocomplete="off" placeholder="Oficial, peón, frigorista…" value="${esc(f.oficio)}"></label>
      <label class="marca"><input type="checkbox" id="a-hoy" ${f.ficharHoy ? 'checked' : ''}> Ha venido hoy: ficharlo ya (a mano)</label>
      <button class="boton grande" data-per="guardar-alta">Dar de alta</button>
      <p class="nota">Lo que escribes se guarda solo en el móvil. Su tarjeta con el QR se imprime en el ordenador: Obra › Personal › Operarios.</p>`;
    if (!f.nombre) document.getElementById('a-nombre').focus();
  }

  /* Un campo del alta cambia: queda en el teléfono al momento. */
  function cambioAlta(ev) {
    if (!activa() || !altaForm) return;
    const t = ev.target;
    const mapa = { 'a-nombre': 'nombre', 'a-empresa': 'proveedorId', 'a-oficio': 'oficio' };
    if (t.id === 'a-hoy') altaForm.ficharHoy = Boolean(t.checked);
    else if (mapa[t.id]) altaForm[mapa[t.id]] = t.value;
    else return;
    apuntarAlta();
    marcaAlta('movil');
  }

  /* Manda el alta. Devuelve true si el ordenador ya la tiene (o no hay nada que mandar). */
  async function mandarAlta(b) {
    if (!b.listo) return true;
    try {
      const r = await postJson('api/operario', { id: b.id, obraId: b.obraId, nombre: b.nombre, proveedorId: b.proveedorId, oficio: b.oficio, ficharHoy: b.ficharHoy });
      /* «Ya está dado de alta» con su id: otro envío (o un compañero) lo hizo; basta con ficharlo. */
      if (!r.ok && r.id) {
        if (b.ficharHoy) { try { await postJson('api/fichar', { operarioId: r.id, notas: 'Alta en obra, sin tarjeta todavía' }); } catch { /* ya estaba */ } }
        if (AG) AG.borrar(CLAVE + b.id);
        return { ok: true, nombre: b.nombre, yaEstaba: true };
      }
      if (!r.ok) {
        /* El ordenador dice que no vale (falta algo): vuelve a ser un borrador para corregirlo. */
        if (AG) AG.guardar(CLAVE + b.id, { ...b, listo: false, error: r.error });
        return { ok: false, error: r.error };
      }
      if (AG) AG.borrar(CLAVE + b.id);
      return r;
    } catch (e) {
      return { ok: false, sinRed: AG ? AG.sinRed(e) : true, error: e.message };
    }
  }

  async function guardarAlta(boton) {
    const f = altaForm;
    if (!f) return;
    if (!String(f.nombre).trim()) { aviso('Escribe el nombre y el apellido.', 'aviso'); return; }
    if (!f.proveedorId) { aviso('Elige la empresa del operario.', 'aviso'); return; }
    boton.disabled = true;
    f.listo = true;
    apuntarAlta();
    marcaAlta('movil');
    const r = await mandarAlta(f);
    if (r === true || r.ok) {
      altaForm = null;
      aviso(r.yaEstaba ? `${r.nombre} ya estaba dado de alta${f.ficharHoy ? ' y queda fichado hoy' : ''}.` : `${r.nombre} dado de alta${r.fichaje && r.fichaje.ok ? ' y fichado hoy a mano' : ''}. Imprime su tarjeta en el ordenador.`, 'bien');
      try { await cargar(); } catch { /* se verá al volver */ }
      if (activa()) pintarHoy();
      return;
    }
    boton.disabled = false;
    if (r.sinRed) {
      /* Sin conexión: queda en el móvil y la cola lo manda al volver la red. */
      marcaAlta('sinRed');
      aviso('Sin conexión: el alta queda guardada en el móvil y se mandará sola.', 'aviso');
      altaForm = null;
      if (COLA) COLA.masTarde();
      if (activa() && datos) pintarHoy();
      return;
    }
    f.listo = false;
    marcaAlta('error');
    aviso(r.error);
  }

  /* La cola: un alta que quedó en el teléfono (app cerrada o sin red) se manda sola. */
  async function enviarPendiente(clave, b) {
    if (altaForm && altaForm.id === b.id && !b.listo) return true;
    const r = await mandarAlta(b);
    if (r === true) return true;
    if (r.ok) { if (activa() && datos) { try { await cargar(); pintarHoy(); } catch { /* nada */ } } return true; }
    return !r.sinRed;
  }

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-per]');
    if (!b) return;
    const a = b.dataset.per;
    if (a === 'hoy') { altaForm = null; hoy(); }
    else if (a === 'leer') $camara.click();
    else if (a === 'mano') aMano(b.dataset.id, b.dataset.nombre);
    else if (a === 'alta') alta();
    else if (a === 'guardar-alta') guardarAlta(b);
  });
  $app.addEventListener('input', cambioAlta);
  $app.addEventListener('change', (ev) => {
    cambioAlta(ev);
    if (!activa() || ev.target.dataset.perCambio !== 'obra') return;
    obraId = ev.target.value;
    try { localStorage.setItem('personal.obra', obraId); } catch { /* sin almacenamiento */ }
    pintarHoy();
  });
  $camara.addEventListener('change', () => {
    const archivo = $camara.files && $camara.files[0];
    $camara.value = '';
    fotoQr(archivo);
  });

  if (COLA) COLA.registrar(CLAVE, enviarPendiente);
  window.addEventListener('hashchange', () => { if (activa()) { altaForm = null; hoy(); } });
  if (activa()) hoy();
})();
