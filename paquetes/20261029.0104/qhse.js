'use strict';
/*
 * INCIDENCIAS › QHSE (28-oct-2026, JC): lo que se pide en obra y eran Word.
 *
 *   1. LA LISTA: qué toca esta semana (la inspección del sitio, una por
 *      semana) y los formularios hechos o a medias de la obra.
 *   2. EL FORMULARIO: la cabecera ya rellena con lo que hay en obra esa
 *      semana (empresas y actividades de la planificación), cada punto con
 *      Sí / No cumple / N/A y su comentario, el plan de acción y quién lo
 *      completa. Se guarda solo como borrador; «Terminar» lo da por hecho.
 *      Sin conexión se guarda en el teléfono y sube solo (Cx Obra).
 *
 * Los formularios y las reglas, en shared/qhse/; las rutas, en
 * electron/movil/rutasQhse.js. Acciones con data-qh.
 */
(function qhse() {
  const $app = document.getElementById('app');
  const CX = () => window.CX;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const activa = () => location.hash === '#qhse';
  const aviso = (t, n = 'mal') => (CX() ? CX().aviso(t, n) : alert(t));
  const MICRO = 'Para dictar, pulsa el micrófono del teclado.';

  if (!document.getElementById('estilo-qhse')) {
    const s = document.createElement('style');
    s.id = 'estilo-qhse';
    s.textContent = `
      .qh label, .qh input, .qh select, .qh textarea { font-size: 17px; }
      .qh h2 { font-size: 18px; margin: 18px 0 6px; }
      .qh table { width: 100%; border-collapse: collapse; }
      .qh th { text-align: left; font-size: 13px; font-weight: 600; color: var(--acento-fuerte); background: none; border-bottom: 2px solid var(--acento-fuerte); padding: 6px 4px; }
      .qh td { padding: 10px 4px; border-bottom: 1px solid var(--panel3); vertical-align: top; }
      .qh .toca { margin: 10px 0; padding: 8px 0; border-bottom: 2px solid var(--acento-suave); }
      .qh .toca.hecho strong { color: var(--ok, #1a8a4a); }
      .qh .tipos { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .qh .tipos .boton, .qh .pie .boton { width: fit-content; border-radius: 999px; }
      .qh details { border-bottom: 1px solid var(--panel3); }
      .qh summary { padding: 12px 4px; font-weight: 600; font-size: 17px; color: var(--acento-fuerte); display: flex; justify-content: space-between; gap: 8px; }
      .qh .punto { padding: 10px 4px; border-top: 1px solid var(--panel3); }
      .qh .punto p { margin: 0 0 8px; font-size: 17px; }
      .qh .resp { display: flex; gap: 8px; flex-wrap: wrap; }
      .qh .resp button { min-height: 44px; min-width: 76px; border-radius: 999px; border: 2px solid var(--acento-suave); background: none; color: var(--texto); font-size: 16px; font-weight: 600; padding: 4px 14px; }
      .qh .resp button[aria-pressed="true"] { border-color: var(--acento-fuerte); background: var(--acento-suave); color: var(--acento-fuerte); }
      .qh .resp button.mal[aria-pressed="true"] { border-color: var(--mal, #b3261e); color: var(--mal, #b3261e); background: none; }
      .qh .punto input.com { width: 100%; margin-top: 8px; }
      .qh .campos label { display: block; margin: 10px 0; }
      .qh .campos input, .qh .campos select, .qh .campos textarea { width: 100%; }
      .qh .pie { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
      .qh .plan-fila { padding: 10px 0; border-bottom: 1px solid var(--panel3); }
      .qh .plan-fila input, .qh .plan-fila textarea { width: 100%; margin-bottom: 6px; }
      .qh .avisos p { margin: 6px 0; padding-left: 8px; border-left: 3px solid var(--acento-fuerte); font-size: 15px; }
      .qh .avisos p.alto { border-left-color: #1f5fa8; font-weight: 600; }
      .qh td .boton { min-height: 40px; padding: 4px 12px; border-radius: 999px; }
      .qh .estado-v { color: #1f5fa8; font-weight: 700; }
      .qh .fotos { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .qh .fotos figure { margin: 0; position: relative; }
      .qh .fotos img { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; }
      .qh .fotos button { position: absolute; top: 2px; right: 2px; min-height: 28px; border-radius: 999px; border: none; background: rgba(0,0,0,.55); color: #fff; }
      .qh .guardado { font-size: 14px; color: var(--textoSuave); }
    `;
    document.head.appendChild(s);
  }

  /*
   * AUTOGUARDADO EN EL TELÉFONO (28-oct-2026, JC: un encargado pulsó atrás y
   * lo perdió todo; «autoguardado… y de cualquier formulario de alta»). Cada
   * cambio queda AL MOMENTO en un borrador del teléfono (autoguardado.js:
   * `cx.borrador.qhse.<obra>|<clave>`), antes de la espera de 1,5 s que lo
   * manda al ordenador. Así sobrevive a atrás, al gesto de inicio y a que se
   * cierre la app: la cola (colaGuardado.js) lo manda sola al volver, y si
   * aún no ha llegado, al entrar en QHSE se sigue con él sin preguntar. El
   * borrador se borra cuando el ordenador confirma lo último escrito.
   */
  const AG = window.AUTOGUARDADO || null;
  const COLA = window.COLA_GUARDADO || null;
  const PREF = 'qhse.';
  const claveDe = (f) => `${PREF}${f.obraId}|${f.clave}`;
  const aBorrador = (f) => ({ id: f.id, clave: f.clave, obraId: f.obraId, plantilla: f.plantilla, fecha: f.fecha, proveedorId: f.proveedorId, datos: f.datos });
  function apuntar(f) { if (AG && f && f.estado !== 'hecho') AG.guardar(claveDe(f), aBorrador(f)); }
  /* Lo que quedó en el teléfono de esta obra sin llegar al ordenador. */
  function borradorDe(obraId, id = null) {
    if (!AG || !COLA) return null;
    for (const k of COLA.claves(`${PREF}${obraId}|`)) {
      const b = AG.leer(k);
      if (b && b.datos && b.plantilla && (!id || b.id === id)) return b;
    }
    return null;
  }

  let datos = null;
  let form = null; /* { id, clave, obraId, plantilla, fecha, datos, estado, proveedorId } */
  let sucio = false;
  let guardando = Promise.resolve();
  let temporizador = null;
  let estadoGuardado = '';

  const obras = () => (datos && datos.obras) || [];
  const obraElegida = () => (CX() && CX().obraId && CX().obraId()) || (() => { try { return localStorage.getItem('movil.obra'); } catch { return null; } })();
  const obra = () => obras().find((o) => o.id === (form ? form.obraId : obraElegida())) || obras()[0] || null;
  const plantilla = (id) => (datos.formularios || []).find((p) => p.id === id);
  window.addEventListener('movil:obra', () => { if (activa() && !form && datos) pintarLista(); });

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    if (form) await volcar();
    form = null;
    /* Lo que quedó en el teléfono (app cerrada a medias): primero se manda. */
    if (COLA) { try { await COLA.vaciar(); } catch { /* sigue en el teléfono */ } }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await CX().pedir('api/qhse');
      if (datos && datos.ok === false) throw new Error(datos.error);
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-qh="lista">Reintentar</button></div>`;
      return;
    }
    if (!activa()) return;
    /* Si algo no ha podido llegar, se sigue con ello tal cual, sin preguntar. */
    const o = obra();
    const b = o && borradorDe(o.id);
    if (b && plantilla(b.plantilla)) {
      form = { ...b, estado: 'borrador' };
      estadoGuardado = 'Guardado en el móvil';
      pintarForm();
      aviso('Sigues con el formulario que tenías a medias.', 'aviso');
      return;
    }
    pintarLista();
  }

  /* Una fila por actividad (y subcontrata): la más antigua; las demás, contadas. */
  function agrupa(plan) {
    const m = new Map();
    plan.forEach((x, i) => {
      const k = `${x.actividad}|${x.proveedorId || x.contratista || ''}`;
      const g = m.get(k);
      if (g) g.mas += 1; else m.set(k, { x, i, mas: 0 });
    });
    return [...m.values()];
  }

  function pintarLista() {
    const o = obra();
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas.</p>'; return; }
    const puede = datos.puede && datos.puede.crear;
    const suyos = (datos.controles || []).filter((c) => c.obraId === o.id);
    const semana = `${fechaEs(o.semana.desde)} al ${fechaEs(o.semana.hasta)}`;
    $app.innerHTML = `<div class="qh">
      <div class="toca ${o.toca ? '' : 'hecho'}">
        <strong>Esta semana</strong>
        <p class="nota">Semana del ${esc(semana)}${o.actividades.length ? ` · en obra: ${esc(o.actividades.slice(0, 4).join('; '))}${o.actividades.length > 4 ? '…' : ''}` : ''}</p>
      </div>
      ${(o.plan || []).length ? `<table><thead><tr><th>Toca</th><th>Vence</th><th></th></tr></thead><tbody>
        ${agrupa(o.plan).map(({ x, i, mas }) => `<tr><td><strong>${esc(x.nombre)}</strong>${x.contratista ? `<br><small>${esc(x.contratista)}</small>` : ''}${mas ? `<br><small>y ${mas} más vencida${mas === 1 ? '' : 's'}</small>` : ''}</td>
          <td class="${x.estado === 'vencida' ? 'estado-v' : ''}">${esc(fechaEs(x.vence))}${x.estado === 'vencida' ? '<br><small>vencida</small>' : ''}</td>
          <td>${puede && x.puedeRellenar ? `<button class="boton" data-qh="toca" data-i="${i}">Rellenar</button>` : ''}</td></tr>`).join('')}
      </tbody></table>` : '<p class="nota">Nada pendiente del plan esta semana.</p>'}
      ${(o.avisos || []).length ? `<h2>Avisos <span class="cuenta">${o.avisos.length}</span></h2><div class="avisos">${o.avisos.map((x) => `<p class="${esc(x.nivel || '')}">${esc(x.texto)}</p>`).join('')}</div>` : ''}
      ${puede ? `<div class="tipos">${(datos.formularios || []).map((p) => `<button class="boton ${p.id === 'inspeccionObra' && o.toca ? '' : 'secundario'}" data-qh="nuevo" data-p="${esc(p.id)}">${esc(p.nombre)}</button>`).join('')}</div>` : '<p class="nota">Tu rol puede ver estos formularios, pero no rellenarlos.</p>'}
      <h2>Formularios de ${esc(o.codigo)} <span class="cuenta">${suyos.length}</span></h2>
      ${suyos.length ? `<table><thead><tr><th>Código</th><th>Fecha</th><th>Estado</th><th>No cumple</th></tr></thead><tbody>
        ${suyos.map((c) => `<tr data-qh="abrir" data-id="${esc(c.id)}" role="button" tabindex="0">
          <td><strong>${esc(c.nombre)}</strong><br><small>${esc(c.codigo)}${c.contratista ? ` · ${esc(c.contratista)}` : ''}</small></td>
          <td>${esc(fechaEs(c.fecha))}</td><td>${c.estado === 'hecho' ? 'Hecho' : 'Borrador'}</td><td>${c.noCumplen || 0}</td></tr>`).join('')}
      </tbody></table>` : '<p class="vacio">Todavía no hay formularios en esta obra.</p>'}
    </div>`;
  }

  /* ═══════════════════════════════════ 2. El formulario */

  function nuevo(pid, extra = {}) {
    const o = obra();
    const p = plantilla(pid);
    if (!o || !p) return;
    const base = JSON.parse(JSON.stringify(o.inicial[pid]));
    if (extra.actividad) base.actividad = extra.actividad;
    if (extra.contratista) { base.cabecera = base.cabecera || {}; base.cabecera.contratista = extra.contratista; }
    form = { id: null, clave: AG ? AG.nuevoId() : `m${Date.now().toString(36)}`, obraId: o.id, plantilla: pid, fecha: datos.hoy, estado: 'borrador', proveedorId: extra.proveedorId || null, datos: base, adjuntos: [] };
    estadoGuardado = '';
    pintarForm();
  }

  async function abrir(id) {
    try {
      const r = await CX().pedir(`api/qhse/abrir?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      form = { id: r.id, clave: r.id, obraId: r.obraId, plantilla: r.plantilla, fecha: r.fecha, estado: r.estado, proveedorId: r.proveedorId, datos: r.datos, adjuntos: r.adjuntos || [] };
      /* Lo escrito en este teléfono que aún no llegó manda sobre lo del ordenador. */
      const b = r.estado === 'hecho' ? null : borradorDe(r.obraId, r.id);
      if (b) { form.datos = b.datos; form.proveedorId = b.proveedorId; form.clave = b.clave || r.id; }
      const p = plantilla(r.plantilla);
      form.datos.cabecera = form.datos.cabecera || {};
      form.datos.respuestas = form.datos.respuestas || {};
      form.datos.plan = form.datos.plan || [];
      form.datos.firma = form.datos.firma || { nombre: '', cargo: '' };
      if (p.asistentes && !form.datos.asistentes) form.datos.asistentes = [];
      estadoGuardado = '';
      pintarForm();
    } catch (e) { aviso(e.message); }
  }

  const resp = (pt) => (form.datos.respuestas[pt] || {});
  function conteo(sec) {
    const hechos = sec.items.filter((_, i) => resp(`${sec.id}.${i}`).r).length;
    const nc = sec.items.filter((_, i) => resp(`${sec.id}.${i}`).r === 'nc').length;
    return `${hechos}/${sec.items.length}${nc ? ` · ${nc} no cumple` : ''}`;
  }

  function pintarForm() {
    const p = plantilla(form.plantilla);
    const o = obra();
    const f = form.datos;
    const cerrado = form.estado === 'hecho';
    const dis = cerrado ? 'disabled' : '';
    const subs = (o.subcontratas || []);
    $app.innerHTML = `<div class="qh">
      <button class="volver" data-qh="lista">‹ QHSE</button>
      <h2>${esc(p.largo)}</h2>
      <p class="nota">${esc(o.codigo)} · ${esc(p.formulario)} · ${esc(fechaEs(form.fecha))}${cerrado ? ' · Terminado' : ''}</p>
      <div class="campos">
        ${p.cabecera.map((c) => {
    const v = f.cabecera[c.clave] || '';
    if (c.opciones) return `<label>${esc(c.nombre)}<select data-qh-cab="${esc(c.clave)}" ${dis}>${c.opciones.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
    if (c.contratista) return `<label>${esc(c.nombre)}<input data-qh-cab="${esc(c.clave)}" value="${esc(v)}" list="qh-subs" autocomplete="off" ${dis}></label>`;
    if (c.largo) return `<label>${esc(c.nombre)}<textarea rows="2" data-qh-cab="${esc(c.clave)}" ${dis}>${esc(v)}</textarea></label>`;
    return `<label>${esc(c.nombre)}<input ${c.tipo === 'fecha' ? 'type="date"' : ''} data-qh-cab="${esc(c.clave)}" value="${esc(v)}" ${dis}></label>`;
  }).join('')}
        <label>Hora<input type="time" data-qh-hora value="${esc(f.hora || '')}" ${dis}></label>
        <datalist id="qh-subs">${subs.map((s) => `<option value="${esc(s.nombre)}"></option>`).join('')}</datalist>
      </div>
      ${p.asistentes ? asistentes(dis) : ''}
      ${p.secciones.map((s, si) => `<details ${si === 0 && !cerrado ? 'open' : ''}><summary><span>${esc(s.nombre)}</span><span class="cuenta" data-qh-cuenta="${esc(s.id)}">${conteo(s)}</span></summary>
        ${s.items.map((t, i) => punto(p, s, t, i, dis)).join('')}</details>`).join('')}
      <h2>${esc(p.planTitulo || 'Plan de acción')}</h2>
      <div data-qh-plan>${plan(dis)}</div>
      ${cerrado ? '' : `${p.secciones.length ? '<button class="boton secundario" data-qh="plan-nc">Traer los puntos que no cumplen</button> ' : ''}<button class="boton secundario" data-qh="plan-mas">${p.secciones.length ? '+ Añadir acción' : '+ Añadir NC'}</button>`}
      <h2>Fotos</h2>
      <div class="fotos" data-qh-fotos>${fotos()}</div>
      ${cerrado ? '' : '<label class="boton secundario" style="width:fit-content;border-radius:999px">Añadir foto<input type="file" accept="image/*" capture="environment" data-qh-foto hidden></label>'}
      <h2>${esc(p.firma)}</h2>
      <div class="campos">
        <label>Nombre<input data-qh-firma="nombre" value="${esc(f.firma.nombre)}" ${dis}></label>
        <label>Cargo<input data-qh-firma="cargo" value="${esc(f.firma.cargo)}" ${dis}></label>
      </div>
      <div class="pie">
        ${cerrado ? '' : '<button class="boton" data-qh="terminar">Terminar</button>'}
        <span class="guardado" data-qh-estado>${esc(estadoGuardado)}</span>
      </div>
    </div>`;
  }

  function punto(p, s, texto, i, dis) {
    const id = `${s.id}.${i}`;
    const r = resp(id);
    const mostrarCom = r.r === 'nc' || r.c;
    return `<div class="punto" data-qh-punto="${esc(id)}">
      <p>${esc(texto)}</p>
      <div class="resp">${p.respuestas.map((x) => `<button type="button" class="${x.mal ? 'mal' : ''}" data-qh="resp" data-p="${esc(id)}" data-v="${esc(x.id)}" aria-pressed="${r.r === x.id}" ${dis}>${esc(x.nombre)}</button>`).join('')}</div>
      <input class="com" data-qh-com="${esc(id)}" value="${esc(r.c || '')}" placeholder="Comentario${r.r === 'nc' ? ' (qué pasa)' : ''}" ${mostrarCom ? '' : 'hidden'} ${dis}>
    </div>`;
  }

  function asistentes(dis) {
    const a = form.datos.asistentes || [];
    return `<h2>Asistentes</h2><table><thead><tr><th>Nombre y apellidos</th><th>DNI</th><th>Empresa</th></tr></thead><tbody>
      ${a.map((x, i) => `<tr><td><input data-qh-as="${i}" data-c="nombre" value="${esc(x.nombre)}" ${dis}></td><td><input data-qh-as="${i}" data-c="dni" value="${esc(x.dni)}" ${dis}></td><td><input data-qh-as="${i}" data-c="empresa" value="${esc(x.empresa)}" list="qh-subs" ${dis}></td></tr>`).join('')}
    </tbody></table>${dis ? '' : '<button class="boton secundario" data-qh="as-mas">+ Asistente</button>'}`;
  }

  function plan(dis) {
    const pl = form.datos.plan || [];
    if (!pl.length) return '<p class="nota">Sin acciones.</p>';
    return pl.map((a, i) => `<div class="plan-fila">
      <textarea rows="2" data-qh-plan="${i}" data-c="problema" placeholder="Problema observado" ${dis}>${esc(a.problema)}</textarea>
      <textarea rows="2" data-qh-plan="${i}" data-c="medida" placeholder="Medida correctiva" ${dis}>${esc(a.medida)}</textarea>
      <input data-qh-plan="${i}" data-c="responsable" value="${esc(a.responsable)}" placeholder="Persona responsable" ${dis}>
      <input type="date" data-qh-plan="${i}" data-c="fecha" value="${esc(a.fecha)}" ${dis}>
      ${dis ? '' : `<button class="enlace" data-qh="plan-quitar" data-i="${i}">Quitar</button>`}</div>`).join('');
  }

  function fotos() {
    const l = (form && form.adjuntos) || [];
    if (!l.length) return '<p class="nota">Sin fotos.</p>';
    return l.map((a) => `<figure>${a.contenido ? `<img alt="${esc(a.nombre)}" src="data:${esc(a.tipo)};base64,${a.contenido}">` : `<small>${esc(a.nombre)}</small>`}${form.estado === 'hecho' ? '' : `<button type="button" data-qh="foto-quitar" data-id="${esc(a.id)}" aria-label="Quitar foto">×</button>`}</figure>`).join('');
  }
  const repintarFotos = () => { const c = $app.querySelector('[data-qh-fotos]'); if (c) c.innerHTML = fotos(); };

  /* La foto se reduce a 1200 px en JPEG antes de subir (una del iPhone pasa de 4 MB a unos 200 KB). */
  async function reducirFoto(archivo) {
    const url = URL.createObjectURL(archivo);
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
      const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8).replace(/^data:[^;]+;base64,/, '');
    } finally { URL.revokeObjectURL(url); }
  }

  async function subirFoto(archivo) {
    if (!form) return;
    try {
      /* La foto cuelga de un registro: si aún no está en el ordenador, se guarda primero. */
      sucio = true;
      await volcar();
      if (!form.id) throw new Error('Sin conexión: guarda el registro con conexión y añade la foto después.');
      const contenido = await reducirFoto(archivo);
      const r = await CX().postJson('api/qhse/adjunto', { controlId: form.id, ref: 'registro', nombre: 'foto.jpg', tipo: 'image/jpeg', contenido });
      if (!r.ok) throw new Error(r.error);
      form.adjuntos.push({ id: r.id, ref: 'registro', nombre: 'foto.jpg', tipo: 'image/jpeg', contenido });
      repintarFotos();
    } catch (e) { aviso(e.message); }
  }

  function repintarPlan() { const c = $app.querySelector('[data-qh-plan]'); if (c) c.innerHTML = plan(''); }

  /* ═══════════════════════════════════ Guardar */

  function programar() {
    sucio = true;
    apuntar(form);
    estadoGuardado = 'Guardado en el móvil';
    const e = $app.querySelector('[data-qh-estado]'); if (e) e.textContent = estadoGuardado;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { volcar(); }, 1500);
  }

  /* Un guardado detrás de otro: el primero crea la fila y los siguientes la actualizan. */
  function volcar(terminar = false) {
    clearTimeout(temporizador);
    if (!form || (!sucio && !terminar)) return guardando;
    sucio = false;
    const f = form;
    guardando = guardando.then(async () => {
      try {
        const r = await CX().postJson('api/qhse/guardar', {
          id: f.id, obraId: f.obraId, plantilla: f.plantilla, fecha: f.fecha, proveedorId: f.proveedorId, actividad: f.datos && f.datos.actividad, datos: f.datos, terminar,
        });
        if (!r.ok) throw new Error(r.error);
        f.id = r.id;
        if (terminar) f.estado = 'hecho';
        /* Llegó: el borrador del teléfono sobra, salvo que se haya seguido escribiendo. */
        if (AG) { if (terminar || !(sucio && form === f)) AG.olvidar(claveDe(f)); else apuntar(f); }
        estadoGuardado = terminar ? `Terminado · ${r.codigo}` : 'Guardado';
        const e = $app.querySelector('[data-qh-estado]'); if (e && form === f) e.textContent = estadoGuardado;
        return r;
      } catch (e) {
        sucio = true;
        apuntar(f);
        estadoGuardado = AG ? (AG.sinRed(e) ? 'Sin conexión: guardado en el móvil, se mandará solo' : 'Guardado en el móvil; no ha llegado al ordenador') : 'No se ha podido guardar';
        const el = $app.querySelector('[data-qh-estado]'); if (el) el.textContent = estadoGuardado;
        if (terminar) aviso(e.message);
        return null;
      }
    });
    return guardando;
  }

  async function terminar(boton) {
    boton.disabled = true;
    const r = await volcar(true);
    boton.disabled = false;
    if (r && r.ok) {
      aviso(r.noCumplen ? `Terminado. ${r.noCumplen} punto${r.noCumplen === 1 ? '' : 's'} no cumple${r.noCumplen === 1 ? '' : 'n'}.` : 'Terminado.', 'bien');
      pintarForm();
    }
  }

  /* ═══════════════════════════════════ Los toques */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-qh]');
    if (!b) return;
    const a = b.dataset.qh;
    if (a === 'lista') lista();
    else if (a === 'nuevo') { if (datos) nuevo(b.dataset.p); }
    else if (a === 'abrir') abrir(b.dataset.id);
    else if (a === 'toca') {
      const o = obra(); const x = o && o.plan[Number(b.dataset.i)];
      if (x && datos) nuevo(x.plantilla || 'registro', { actividad: x.actividad, contratista: x.contratista, proveedorId: x.proveedorId });
    }
    else if (!form) return;
    else if (a === 'resp') {
      const id = b.dataset.p;
      const r = form.datos.respuestas[id] || (form.datos.respuestas[id] = { r: null, c: '' });
      r.r = r.r === b.dataset.v ? null : b.dataset.v;
      const fila = b.closest('.punto');
      fila.querySelectorAll('.resp button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === r.r)));
      fila.querySelector('input.com').hidden = !(r.r === 'nc' || r.c);
      const s = plantilla(form.plantilla).secciones.find((x) => id.startsWith(`${x.id}.`));
      const cu = $app.querySelector(`[data-qh-cuenta="${s.id}"]`); if (cu) cu.textContent = conteo(s);
      programar();
    } else if (a === 'plan-mas') { form.datos.plan.push({ problema: '', responsable: '', medida: '', fecha: '' }); repintarPlan(); programar(); }
    else if (a === 'plan-quitar') { form.datos.plan.splice(Number(b.dataset.i), 1); repintarPlan(); programar(); }
    else if (a === 'plan-nc') {
      const p = plantilla(form.plantilla);
      const ya = new Set(form.datos.plan.map((x) => x.ref).filter(Boolean));
      for (const s of p.secciones) s.items.forEach((t, i) => {
        const id = `${s.id}.${i}`;
        const r = resp(id);
        if (r.r === 'nc' && !ya.has(id)) form.datos.plan.push({ ref: id, problema: `${t}${r.c ? ` — ${r.c}` : ''}`, responsable: '', medida: '', fecha: '' });
      });
      repintarPlan(); programar();
    } else if (a === 'as-mas') { form.datos.asistentes.push({ nombre: '', dni: '', empresa: '' }); pintarForm(); programar(); }
    else if (a === 'foto-quitar') {
      CX().postJson('api/qhse/quitarAdjunto', { id: b.dataset.id }).then((r) => {
        if (!r.ok) throw new Error(r.error);
        form.adjuntos = form.adjuntos.filter((x) => x.id !== b.dataset.id); repintarFotos();
      }).catch((e) => aviso(e.message));
    }
    else if (a === 'guardar') { sucio = true; volcar().then((r) => { if (r) aviso('Guardado.', 'bien'); }); }
    else if (a === 'terminar') terminar(b);
  });

  $app.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!activa() || !form || !t.matches || !t.matches('[data-qh-foto]')) return;
    const f = t.files && t.files[0]; t.value = '';
    if (f) subirFoto(f);
  });

  const recoger = (ev) => {
    if (!activa() || !form || form.estado === 'hecho') return;
    const t = ev.target;
    const d = t.dataset;
    if (d.qhCab !== undefined) {
      form.datos.cabecera[d.qhCab] = t.value;
      /* Si es una subcontrata de la obra, se guarda también su id. */
      if (d.qhCab === 'contratista') { const s = (obra().subcontratas || []).find((x) => x.nombre === t.value); form.proveedorId = s ? s.id : null; }
    } else if (d.qhHora !== undefined) form.datos.hora = t.value;
    else if (d.qhFirma) form.datos.firma[d.qhFirma] = t.value;
    else if (d.qhCom) { const r = form.datos.respuestas[d.qhCom] || (form.datos.respuestas[d.qhCom] = { r: null, c: '' }); r.c = t.value; }
    else if (d.qhPlan !== undefined) { const x = form.datos.plan[Number(d.qhPlan)]; if (x) x[d.c] = t.value; }
    else if (d.qhAs !== undefined) { const x = form.datos.asistentes[Number(d.qhAs)]; if (x) x[d.c] = t.value; }
    else return;
    programar();
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);

  window.addEventListener('hashchange', () => { if (activa()) lista(); else if (form) volcar(); });
  /* Al irse de la app (gesto, bloquear, otra app, cerrar): una última vez. */
  const alIrse = () => { if (form) { if (sucio) apuntar(form); volcar(); } };
  if (AG) AG.alSalir(alIrse); else window.addEventListener('pagehide', alIrse);

  /* La cola manda lo que quedó en el teléfono aunque QHSE no esté abierta;
     nunca el formulario que se está escribiendo (ese lo manda esta pantalla). */
  if (COLA && AG) {
    COLA.registrar(PREF, async (clave, b) => {
      if (form && claveDe(form) === clave) return false;
      if (!b || !b.plantilla || !b.obraId) { AG.olvidar(clave); return true; }
      const r = await CX().postJson('api/qhse/guardar', { id: b.id || null, obraId: b.obraId, plantilla: b.plantilla, fecha: b.fecha, proveedorId: b.proveedorId, actividad: b.datos && b.datos.actividad, datos: b.datos, terminar: false });
      if (r && r.ok) { AG.olvidar(clave); return true; }
      /* Un «no» del ordenador (ya terminado, sin permiso…): no se reintenta para siempre. */
      if (r && r.ok === false && /terminado|no se encuentra|tu rol/i.test(String(r.error || ''))) { AG.olvidar(clave); return true; }
      return false;
    });
  }
  if (activa()) lista();
})();
