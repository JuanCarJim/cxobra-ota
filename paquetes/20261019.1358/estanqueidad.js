'use strict';
/*
 * OBRA › PRUEBAS DE ESTANQUEIDAD EN EL MÓVIL: el encargado apunta la prueba
 * de presión de un tramo y hace la foto del manómetro; al jefe de obra le
 * sale el informe en PDF, guardado en la documentación de la obra.
 *
 *   1. LA LISTA: «Nueva prueba» y las últimas de sus obras, con el resultado.
 *   2. LA PRUEBA, en el orden en que se hace:
 *        · qué instalación (botones grandes): trae la presión, la duración y
 *          la caída admisible que se suelen pedir (orientativas: manda el
 *          pliego, se pueden cambiar);
 *        · AL EMPEZAR: la hora, lo que marca el manómetro y su foto;
 *        · AL ACABAR: lo que marca, su foto y si se han visto fugas. La
 *          duración sale sola de la hora de empezar.
 *      El veredicto se ve en vivo (correcta, no superada, sin terminar).
 *      Mientras dura la prueba (pueden ser horas) se puede cerrar el
 *      navegador: lo escrito queda guardado en el teléfono.
 *   3. ENVIADA: con su código y dónde ha quedado el informe.
 *
 * Las acciones van con data-pe. Las reglas, en pruebasEstanqueidad.js
 * (window.ESTANQUEIDAD_MOTOR), el mismo archivo que usa el ordenador.
 */
(function estanqueidad() {
  const EM = window.ESTANQUEIDAD_MOTOR;
  const $app = document.getElementById('app');
  const $camara = document.getElementById('camara-prueba');
  const $galeria = document.getElementById('galeria-prueba');
  const BORRADOR = 'estanqueidad.borrador';

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
  const activa = () => location.hash === '#estanqueidad';
  const CLASE_RESULTADO = { correcta: 'bien', noSuperada: 'mal', sinTerminar: 'neutra' };
  const chipResultado = (r) => `<span class="chip ${CLASE_RESULTADO[r] || 'neutra'}">${esc((EM.RESULTADOS[r] || {}).nombre || r)}</span>`;
  const coma = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

  let datos = null;
  let form = null;
  let momentoFoto = 'inicio';
  let reloj = null;
  const vistas = new Map(); /* fotoId → url para enseñarla (no sobrevive a recargar) */
  let obraId = null;
  /* La obra es la elegida en la cabecera (carcasa.js), la misma para todas. */
  try { obraId = localStorage.getItem('movil.obra') || localStorage.getItem('estanqueidad.obra'); } catch { /* sin almacenamiento */ }
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

  /* El borrador: la prueba a medias, en el teléfono, por si se cierra el navegador. */
  function guardarBorrador() {
    try { if (form) localStorage.setItem(BORRADOR, JSON.stringify(form)); else localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ }
  }
  function leerBorrador() {
    try { return JSON.parse(localStorage.getItem(BORRADOR) || 'null'); } catch { return null; }
  }

  const obras = () => (datos && datos.obras) || [];
  const obra = () => obras().find((o) => o.id === (form ? form.obraId : obraId)) || obras()[0] || null;

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    pararReloj();
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await pedir('api/estanqueidad');
      document.getElementById('quien').textContent = datos.quien || '';
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-pe="lista">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintarLista();
  }

  function pintarLista() {
    form = null;
    const o = obra();
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas en las que dar pruebas.</p>'; return; }
    const puede = datos.puede && datos.puede.crear;
    const borrador = leerBorrador();
    const mias = (datos.recientes || []).filter((p) => p.obraId === o.id);
    $app.innerHTML = `
      ${window.CX && window.CX.obras().length ? '' : obras().length > 1 ? `<label class="elegir-obra">Obra<select data-pe-cambio="obra">${obras().map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select></label>` : `<p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>`}
      ${borrador && puede ? `<section class="acciones">
        <button class="boton grande" data-pe="seguir">⏱ Seguir con la prueba de ${esc((EM.INSTALACIONES[borrador.instalacion] || {}).nombre || 'la instalación')}</button>
        <p class="nota centrada">${esc(borrador.tramo || 'Sin tramo')} · empezada a las ${esc(borrador.horaInicio || '—')}. <button class="enlace" data-pe="descartar">Descartarla</button></p>
      </section>` : ''}
      ${puede ? `<section class="acciones">
        <button class="boton grande ${borrador ? 'secundario' : ''}" data-pe="nuevo"><i class="ic ic-gota"></i>Nueva prueba de estanqueidad</button>
        <p class="nota centrada">Los datos de la prueba y la foto del manómetro. Al jefe de obra le llega el informe hecho.</p>
      </section>` : '<p class="nota">Tu rol puede ver las pruebas, pero no darlas.</p>'}
      <h2>Últimas pruebas <span class="cuenta">${mias.length}</span></h2>
      ${mias.length ? window.CX.listaAgrupada('estanqueidad', mias, {
        envolver: (h) => `<ul class="recientes">${h}</ul>`, repintar: pintarLista,
        grupo: mias.length > 20 ? (p) => (EM.INSTALACIONES[p.instalacion] || {}).nombre || p.instalacion : null,
        fila: (p) => `<li>
        <div><strong>${esc(p.codigo)}</strong> · ${esc((EM.INSTALACIONES[p.instalacion] || {}).nombre || p.instalacion)}<br><small>${esc(p.tramo)} · ${esc(fechaEs(p.fecha))}</small></div>
        <span class="derecha">${chipResultado(p.resultado)}<button class="enlace" data-pe="pdf" data-id="${esc(p.id)}" data-codigo="${esc(p.codigo)}" aria-label="Informe PDF de ${esc(p.codigo)}">PDF</button></span></li>` }) : '<p class="vacio">Todavía no hay pruebas en esta obra.</p>'}`;
  }

  /* ═══════════════════════════════════ 2. La prueba */

  function nuevo() {
    const o = obra();
    if (!o) return;
    form = {
      obraId: o.id, instalacion: '', tramo: '', proveedorId: '', fecha: hoy(), horaInicio: ahoraHora(), unidad: 'bar', fluido: 'agua',
      presionTrabajo: '', presionPrueba: '', caidaAdmisible: '', duracionMin: '', minutosPedidos: null,
      presionInicial: '', presionFinal: '', fugas: false, manometro: '', observaciones: '', duracionAMano: false, fotos: [],
    };
    pintarInstalacion();
  }

  function pintarInstalacion() {
    $app.innerHTML = `
      <button class="volver" data-pe="lista">‹ Pruebas</button>
      <h2>¿Qué instalación se prueba?</h2>
      <div class="tipos-parte">${Object.entries(EM.INSTALACIONES).map(([id, i]) => `
        <button class="tipo-parte" data-pe="instalacion" data-id="${esc(id)}"><b>${esc(i.icono)} ${esc(i.nombre)}</b><small>${esc(i.norma)} · ${esc(cuanto(i))}</small></button>`).join('')}
      </div>`;
  }
  const cuanto = (i) => `${i.minutos >= 60 ? `${i.minutos / 60} h` : `${i.minutos} min`}${i.factor > 1 ? `, ${String(i.factor).replace('.', ',')} × la de trabajo${i.minimo ? ` (mín. ${i.minimo} ${i.unidad})` : ''}` : ''}`;

  function elegirInstalacion(id) {
    const i = EM.INSTALACIONES[id];
    form.instalacion = id;
    form.unidad = i.unidad;
    form.fluido = i.fluido;
    form.caidaAdmisible = coma(i.caida);
    form.minutosPedidos = i.minutos;
    pintarForm();
  }

  /* Los minutos desde la hora de empezar (del mismo día; si pasa de medianoche, del siguiente). */
  function minutosDesde(hora) {
    if (!/^\d{2}:\d{2}$/.test(hora || '')) return null;
    const [h, m] = hora.split(':').map(Number);
    const ahora = new Date();
    let min = ahora.getHours() * 60 + ahora.getMinutes() - (h * 60 + m);
    if (min < 0) min += 1440;
    return min;
  }

  function duracion() {
    if (form.duracionAMano) return form.duracionMin;
    const m = minutosDesde(form.horaInicio);
    return m === null ? '' : String(m);
  }

  function veredicto() {
    return EM.veredicto({
      presionPrueba: form.presionPrueba, presionInicial: form.presionInicial, presionFinal: form.presionFinal,
      caidaAdmisible: form.caidaAdmisible, fugas: form.fugas,
    });
  }

  function htmlVeredicto() {
    const v = veredicto();
    const r = EM.RESULTADOS[v.resultado];
    const m = Number(duracion());
    const corta = form.minutosPedidos && m > 0 && m < form.minutosPedidos && v.resultado === 'correcta'
      ? ` · Ojo: lleva ${m} min y se suelen pedir ${form.minutosPedidos}.` : '';
    return `<strong>${esc(r.nombre)}</strong>${v.caida !== null ? ` · caída ${esc(EM.cifra(v.caida))} ${esc(form.unidad)}` : ''}${v.motivos.length ? ` · ${esc(v.motivos.join(' '))}` : ''}${esc(corta)}`;
  }

  function fotoDe(momento) {
    const f = form.fotos.filter((x) => x.momento === momento).slice(-1)[0];
    if (!f) return '';
    const url = vistas.get(f.id);
    return url ? `<img src="${esc(url)}" alt="Foto del manómetro">` : '<span class="sin-vista" title="Foto guardada"><i class="ic ic-camara"></i></span>';
  }

  function pintarForm() {
    const o = obra();
    const f = form;
    const i = EM.INSTALACIONES[f.instalacion];
    const opcion = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;
    const sugerida = EM.presionSugerida(f.instalacion, f.presionTrabajo);
    const otras = f.fotos.filter((x) => x.momento === 'otra');
    $app.innerHTML = `
      <button class="volver" data-pe="cambiar-instalacion">‹ ${esc(i.icono)} ${esc(i.nombre)} <small>(cambiar)</small></button>
      <p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>
      <label>Tramo o zona<input data-pe-campo="tramo" value="${esc(f.tramo)}" maxlength="160" placeholder="Montante 2, planta 3 · circuito primario…" autocomplete="off"></label>
      <div class="campos">
        <label>Empresa<select data-pe-campo="proveedorId"><option value="">—</option>${(o.subcontratas || []).map((s) => opcion(s.id, s.nombre, f.proveedorId)).join('')}</select></label>
        <label>Fluido<select data-pe-campo="fluido">${Object.entries(EM.FLUIDOS).map(([id, n]) => opcion(id, n, f.fluido)).join('')}</select></label>
        <label>Presión de trabajo<input data-pe-campo="presionTrabajo" value="${esc(f.presionTrabajo)}" inputmode="decimal" placeholder="${esc(f.unidad)}"></label>
        <label>Presión de prueba<input data-pe-campo="presionPrueba" value="${esc(f.presionPrueba)}" inputmode="decimal" placeholder="${sugerida ? esc(coma(sugerida)) : esc(f.unidad)}"></label>
        <label>Caída admisible<input data-pe-campo="caidaAdmisible" value="${esc(f.caidaAdmisible)}" inputmode="decimal"></label>
        <label>Unidad<select data-pe-campo="unidad">${Object.keys(EM.UNIDADES).map((u) => opcion(u, u, f.unidad)).join('')}</select></label>
      </div>
      ${sugerida && !f.presionPrueba ? `<button class="enlace" data-pe="sugerida">Usar ${esc(coma(sugerida))} ${esc(f.unidad)} (lo que se suele pedir)</button>` : ''}
      <p class="nota">Orientativo (${esc(i.norma)}): ${esc(cuanto(i))}. Si el pliego dice otra cosa, manda el pliego.</p>

      <section class="linea momento">
        <h2>Al empezar</h2>
        <div class="campos">
          <label>Hora<input type="time" data-pe-campo="horaInicio" value="${esc(f.horaInicio)}"></label>
          <label>Marca el manómetro<input data-pe-campo="presionInicial" value="${esc(f.presionInicial)}" inputmode="decimal" placeholder="${esc(f.unidad)}"></label>
        </div>
        <div class="foto-manometro">${fotoDe('inicio')}<button class="boton secundario" data-pe="foto" data-momento="inicio"><i class="ic ic-camara"></i>${fotoDe('inicio') ? 'Repetir la foto' : 'Foto del manómetro'}</button></div>
      </section>

      <section class="linea momento">
        <h2>Al acabar <span class="reloj" id="pe-reloj"></span></h2>
        <div class="campos">
          <label>Marca el manómetro<input data-pe-campo="presionFinal" value="${esc(f.presionFinal)}" inputmode="decimal" placeholder="${esc(f.unidad)}"></label>
          <label>Duración (min)<input data-pe-campo="duracionMin" value="${esc(duracion())}" inputmode="numeric"></label>
        </div>
        <div class="foto-manometro">${fotoDe('final')}<button class="boton secundario" data-pe="foto" data-momento="final"><i class="ic ic-camara"></i>${fotoDe('final') ? 'Repetir la foto' : 'Foto del manómetro'}</button></div>
        <label class="marca"><input type="checkbox" data-pe-campo="fugas" ${f.fugas ? 'checked' : ''}> Se han visto fugas o goteos</label>
      </section>

      <div class="veredicto-vivo ${esc(veredicto().resultado)}" id="pe-veredicto">${htmlVeredicto()}</div>

      <label>Manómetro (nº de serie o calibración)<input data-pe-campo="manometro" value="${esc(f.manometro)}" placeholder="opcional" autocomplete="off"></label>
      <label class="notas">Observaciones<textarea data-pe-campo="observaciones" rows="3" placeholder="Lo que se ha reparado, purgas, temperatura…">${esc(f.observaciones)}</textarea></label>
      <h2>Otras fotos <span class="cuenta">${otras.length}</span></h2>
      <div class="fotos">${otras.map((x) => (vistas.get(x.id) ? `<img src="${esc(vistas.get(x.id))}" alt="Foto">` : '<span class="sin-vista"><i class="ic ic-camara"></i></span>')).join('')}
        <button class="anadir-foto" data-pe="foto" data-momento="otra" aria-label="Hacer otra foto">＋</button></div>
      <button class="enlace" data-pe="galeria">o elegir una foto de la galería</button>
      <button class="boton grande" data-pe="enviar">Enviar al jefe de obra</button>
      <p class="nota centrada">Se hace el informe en PDF y se guarda en la documentación de la obra. Puedes cerrar el navegador mientras dura la prueba: queda guardada en el teléfono.</p>`;
    arrancarReloj();
  }

  /* Lo que lleva la prueba, cada 30 s (y la duración, si no se ha escrito a mano). */
  function arrancarReloj() {
    pararReloj();
    const pintar = () => {
      const r = document.getElementById('pe-reloj');
      if (!r || !form) { pararReloj(); return; }
      const m = minutosDesde(form.horaInicio);
      r.textContent = m === null ? '' : `· lleva ${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`}${form.minutosPedidos ? ` de ${form.minutosPedidos >= 60 ? `${form.minutosPedidos / 60} h` : `${form.minutosPedidos} min`}` : ''}`;
      const d = document.querySelector('[data-pe-campo="duracionMin"]');
      if (d && !form.duracionAMano && document.activeElement !== d) d.value = duracion();
    };
    pintar();
    reloj = setInterval(pintar, 30000);
  }
  function pararReloj() { if (reloj) clearInterval(reloj); reloj = null; }

  async function foto(archivo) {
    if (!archivo || !form) return;
    try {
      const r = await pedir('api/foto?leer=0', { method: 'POST', headers: { 'Content-Type': archivo.type || 'image/jpeg' }, body: archivo });
      if (!r.ok) throw new Error(r.error);
      /* La del manómetro se sustituye; las otras se suman. */
      if (momentoFoto !== 'otra') form.fotos = form.fotos.filter((x) => x.momento !== momentoFoto);
      form.fotos.push({ id: r.fotoId, momento: momentoFoto });
      vistas.set(r.fotoId, URL.createObjectURL(archivo));
      guardarBorrador();
      pintarForm();
    } catch (e) { aviso(e.message); }
  }

  async function enviar(boton) {
    const f = form;
    boton.disabled = true;
    try {
      const r = await postJson('api/estanqueidad', { ...f, duracionMin: duracion() });
      if (!r.ok) throw new Error(r.error);
      form = null;
      guardarBorrador();
      pararReloj();
      const clase = r.resultado === 'correcta' ? 'bien' : r.resultado === 'noSuperada' ? 'mal' : 'aviso';
      const inf = r.informe || {};
      $app.innerHTML = `
        <section class="resultado ${clase}"><div class="icono">${r.resultado === 'correcta' ? '✓' : r.resultado === 'noSuperada' ? '✕' : '…'}</div><h1>${esc(r.codigo)}</h1>
          <p>Prueba ${esc((EM.RESULTADOS[r.resultado] || {}).nombre.toLowerCase())}</p>
          <p class="sub">${esc(r.avisados && r.avisados.length ? `Le sale a ${r.avisados.join(', ')}.` : 'Le sale al jefe de obra en la aplicación.')}</p></section>
        ${(r.motivos || []).length ? `<p class="nota aviso">${esc(r.motivos.join(' '))}</p>` : ''}
        <p class="nota">${inf.ok ? `Informe en PDF guardado en la documentación de la obra${inf.nube === 'subido' ? ' y en su carpeta de la nube' : ''}.` : 'El informe en PDF lo hará el ordenador del jefe de obra.'}</p>
        <button class="boton grande secundario" data-pe="pdf" data-id="${esc(r.id)}" data-codigo="${esc(r.codigo)}"><i class="ic ic-doc"></i>Informe PDF</button>
        <button class="boton grande" data-pe="nuevo">Otra prueba</button>
        <button class="boton secundario" data-pe="lista">Volver a la lista</button>`;
      datos = await pedir('api/estanqueidad').catch(() => datos);
    } catch (e) {
      aviso(e.message);
      boton.disabled = false;
    }
  }

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-pe]');
    if (!b) return;
    const a = b.dataset.pe;
    if (a === 'lista') lista();
    else if (a === 'nuevo') { if (datos) nuevo(); }
    else if (a === 'seguir') {
      form = leerBorrador();
      if (form && EM.INSTALACIONES[form.instalacion]) pintarForm(); else nuevo();
    } else if (a === 'descartar') {
      if (!confirm('¿Descartar la prueba a medias?')) return;
      form = null; guardarBorrador(); pintarLista();
    } else if (a === 'instalacion') { elegirInstalacion(b.dataset.id); guardarBorrador(); }
    else if (a === 'cambiar-instalacion') pintarInstalacion();
    else if (a === 'sugerida') {
      form.presionPrueba = coma(EM.presionSugerida(form.instalacion, form.presionTrabajo));
      guardarBorrador(); pintarForm();
    } else if (a === 'foto') { momentoFoto = b.dataset.momento || 'otra'; $camara.click(); }
    else if (a === 'galeria') { momentoFoto = 'otra'; $galeria.click(); }
    else if (a === 'enviar') enviar(b);
    else if (a === 'pdf' && window.CX) window.CX.compartirPdf(`api/informe?tipo=estanqueidad&id=${encodeURIComponent(b.dataset.id)}`, `Prueba de estanqueidad ${b.dataset.codigo || ''}.pdf`, b);
  });
  const recoger = (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (t.dataset.peCambio === 'obra' && ev.type === 'change') {
      obraId = t.value;
      try { localStorage.setItem('estanqueidad.obra', obraId); } catch { /* sin almacenamiento */ }
      pintarLista();
      return;
    }
    if (!form || !t.dataset.peCampo) return;
    const campo = t.dataset.peCampo;
    form[campo] = t.type === 'checkbox' ? t.checked : t.value;
    if (campo === 'duracionMin') form.duracionAMano = t.value.trim() !== '';
    guardarBorrador();
    /* Repintar solo lo que cambia: no quitarle el foco mientras escribe. */
    const v = document.getElementById('pe-veredicto');
    if (v) { v.className = `veredicto-vivo ${veredicto().resultado}`; v.innerHTML = htmlVeredicto(); }
    if (ev.type === 'change' && (campo === 'unidad' || campo === 'presionTrabajo')) pintarForm();
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

  window.addEventListener('hashchange', () => { if (activa()) lista(); else pararReloj(); });
  if (activa()) lista();
})();
