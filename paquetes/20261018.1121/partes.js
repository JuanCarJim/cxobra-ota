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
    $app.innerHTML = `
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

  function nuevo() {
    const o = obra();
    if (!o) return;
    form = { obraId: o.id, tipo: '', fecha: hoy(), hora: ahoraHora(), zona: '', titulo: '', descripcion: '', gravedad: 'media',
      denuncia: 'no', atestado: '', causa: '', proveedorId: '', diasRetraso: '', lineas: [], fotos: [] };
    pintarTipo();
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
      <div class="fotos">${f.fotos.map((x) => `<img src="${esc(x.url)}" alt="Foto del parte">`).join('')}
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

  async function foto(archivo) {
    if (!archivo || !form) return;
    try {
      const r = await pedir('api/foto?leer=0', { method: 'POST', headers: { 'Content-Type': archivo.type || 'image/jpeg' }, body: archivo });
      if (!r.ok) throw new Error(r.error);
      form.fotos.push({ id: r.fotoId, url: URL.createObjectURL(archivo) });
      pintarForm();
    } catch (e) { aviso(e.message); }
  }

  async function enviar(boton) {
    const f = form;
    boton.disabled = true;
    try {
      const r = await postJson('api/parte', { ...f, fotos: f.fotos.map((x) => x.id) });
      if (!r.ok) throw new Error(r.error);
      form = null;
      $app.innerHTML = `
        <section class="resultado bien"><div class="icono">✓</div><h1>${esc(r.codigo)}</h1>
          <p>Parte enviado</p><p class="sub">${esc(r.avisados && r.avisados.length ? `Le sale a ${r.avisados.join(', ')}.` : 'Le sale al jefe de obra en la aplicación.')}</p></section>
        ${r.sinCasar ? `<p class="nota aviso">${r.sinCasar === 1 ? 'Un material no está' : `${r.sinCasar} materiales no están`} en la lista de la obra: el jefe de obra lo${r.sinCasar === 1 ? '' : 's'} casará para valorarlo${r.sinCasar === 1 ? '' : 's'}.</p>` : ''}
        <button class="boton grande" data-pi="nuevo">Otro parte</button>
        <button class="boton secundario" data-pi="lista">Volver a la lista</button>`;
      datos = await pedir('api/partes').catch(() => datos);
    } catch (e) {
      aviso(e.message);
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
    else if (a === 'tipo') {
      form.tipo = b.dataset.id;
      if ((form.tipo === 'robo' || form.tipo === 'danos') && !form.lineas.length) form.lineas.push(lineaVacia('material'));
      pintarForm();
    } else if (a === 'cambiar-tipo') pintarTipo();
    else if (a === 'linea') { form.lineas.push(lineaVacia(b.dataset.clase)); pintarForm(); }
    else if (a === 'quitar-linea') { form.lineas.splice(Number(b.dataset.i), 1); pintarForm(); }
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
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  for (const input of [$camara, $galeria]) {
    input.addEventListener('change', () => {
      const archivo = input.files && input.files[0];
      input.value = '';
      foto(archivo);
    });
  }

  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
