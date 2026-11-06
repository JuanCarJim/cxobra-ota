'use strict';
/*
 * QHSE › REPORTES (5-nov-2026, JC: «una versión súper rápida de Harbour»).
 *
 * Pensado para darlo de pie en la obra, en menos de 20 segundos y con tres
 * toques después de la foto:
 *
 *   «+» › Reporte QHSE → se abre la cámara → foto
 *   1. la categoría (botones grandes)   2. ¿Qué? (dictado del teclado)   3. Guardar
 *
 * Todo lo demás —proyecto y contrato, cliente, línea de negocio, dirección,
 * fecha y hora, quién lo da y a quién se avisa— se rellena solo (y se cambia
 * en la ficha). El por qué, los pasos tomados, la clasificación y la
 * ubicación se completan luego. Los FAVORITOS son reportes de un toque.
 *
 * Reglas: shared/qhse/reportes.js; rutas: electron/movil/rutasReportesQhse.js.
 * Acciones con data-rq.
 */
(function reportesQhse() {
  const $app = document.getElementById('app');
  const CX = () => window.CX;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const activa = () => location.hash === '#reportesQhse';
  const aviso = (t, n = 'mal') => (CX() ? CX().aviso(t, n) : alert(t));
  const MICRO = 'Para dictar, pulsa el micrófono del teclado.';
  const CLASE_ESTADO = { abierto: 'rq-abierto', enCurso: 'rq-curso', cerrado: 'rq-cerrado' };

  if (!document.getElementById('estilo-rq')) {
    const s = document.createElement('style');
    s.id = 'estilo-rq';
    s.textContent = `
      .rq { padding-bottom: 90px; }
      .rq h2 { font-size: 18px; margin: 16px 0 6px; color: var(--acento-fuerte); }
      .rq .rq-nuevo { width: 100%; min-height: 54px; font-size: 18px; border-radius: 14px; }
      .rq .rq-favs { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 2px 0 6px; }
      .rq .rq-favs::-webkit-scrollbar { display: none; }
      .rq .rq-fav { flex: 0 0 auto; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-height: 44px; padding: 8px 14px; border-radius: 999px;
        border: 1px solid var(--acento-suave); background: var(--acento-suave); color: var(--acento-fuerte); font-size: 15px; font-weight: 600; }
      .rq table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .rq th { text-align: left; font-size: 13px; font-weight: 600; color: var(--acento-fuerte); background: none; border-bottom: 2px solid var(--acento-fuerte); padding: 6px 4px; }
      .rq td { padding: 10px 4px; border-bottom: 1px solid var(--panel3); vertical-align: top; font-size: 15px; overflow-wrap: anywhere; }
      .rq td.rq-cod { width: 30%; font-weight: 600; font-variant-numeric: tabular-nums; }
      .rq td .rq-sub { display: block; font-size: 13px; color: var(--texto-suave, var(--textoSuave)); }
      .rq .rq-est { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
      .rq .rq-abierto { background: #DCEBF8; color: #1F4E86; }
      .rq .rq-curso { background: var(--acento-suave); color: var(--acento-fuerte); }
      .rq .rq-cerrado { background: #DFF1E6; color: #1A6B3C; }
      .rq .rq-kpis { display: flex; gap: 14px; margin: 8px 0 4px; font-size: 14px; color: var(--texto-suave, var(--textoSuave)); }
      .rq .rq-kpis b { font-size: 18px; color: var(--acento-fuerte); font-variant-numeric: tabular-nums; margin-right: 3px; }
      .rq .rq-tipos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 6px 0 10px; }
      .rq .rq-tipos button { min-height: 44px; border-radius: 12px; border: 1px solid var(--acento-suave); background: #fff; color: var(--acento-fuerte); font-size: 14px; font-weight: 600; padding: 4px; }
      .rq .rq-tipos button.activo { background: var(--acento-fuerte); color: #fff; border-color: var(--acento-fuerte); }
      .rq .rq-fotos { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 8px; }
      .rq .rq-fotos img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; flex: none; }
      .rq .rq-otra { flex: none; width: 84px; height: 84px; border-radius: 10px; border: 2px dashed var(--acento-fuerte); background: #fff; color: var(--acento-fuerte); font-size: 14px; font-weight: 600; }
      .rq textarea, .rq input, .rq select { width: 100%; box-sizing: border-box; font-size: 17px; }
      .rq .rq-pista { font-size: 13px; color: var(--texto-suave, var(--textoSuave)); margin: 3px 0 0; }
      .rq .rq-cats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 6px 0; }
      .rq .rq-cats button { min-height: 40px; border-radius: 12px; border: 1px solid var(--acento-suave); background: #fff; color: var(--texto);
        font-size: 15px; font-weight: 600; text-align: left; padding: 4px 10px; line-height: 1.15; }
      .rq .rq-cats button.activo { background: var(--acento-fuerte); color: #fff; border-color: var(--acento-fuerte); }
      .rq .rq-auto { font-size: 13px; color: var(--texto-suave, var(--textoSuave)); border-top: 1px solid var(--panel3); padding-top: 8px; margin-top: 10px; }
      .rq .rq-pie { position: fixed; left: 0; right: 0; bottom: calc(var(--hueco-barra, 104px) + env(safe-area-inset-bottom, 0px) - 8px); padding: 8px 16px; background: #fff; z-index: 5; }
      .rq .rq-pie .boton { width: 100%; min-height: 54px; font-size: 18px; border-radius: 14px; }
      .rq .rq-campo { margin: 10px 0; }
      .rq .rq-campo label { display: block; font-size: 14px; font-weight: 600; color: var(--acento-fuerte); margin-bottom: 4px; }
      .rq .rq-fila { display: flex; gap: 8px; align-items: center; margin: 8px 0; flex-wrap: wrap; }
      .rq .rq-fila .boton { width: fit-content; }
      .rq .rq-ficha td:first-child { width: 38%; font-weight: 600; color: var(--acento-fuerte); font-size: 14px; }
    `;
    document.head.append(s);
  }

  let datos = null; /* lo de GET api/qhse/reportes */
  let nuevo = null; /* el reporte que se está dando */
  let ficha = null; /* el abierto */
  const nuevoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
  const nombre = (lista, id) => ((lista || []).find((x) => x.id === id) || {}).nombre || '';

  /* La foto, a lo sumo 1280 px y ~200 KB en JPEG: sube rápido por el 4G de la obra. */
  function aligerar(archivo) {
    return new Promise((resolver) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const probar = (q) => c.toBlob((b) => {
          if (b && b.size > 200 * 1024 && q > 0.35) probar(q - 0.1);
          else resolver(b ? { blob: new File([b], 'foto.jpg', { type: 'image/jpeg' }), vista: c.toDataURL('image/jpeg', 0.5) } : null);
        }, 'image/jpeg', q);
        probar(0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolver({ blob: archivo, vista: '' }); };
      img.src = url;
    });
  }

  /* Cada foto empieza a subir en cuanto se hace: al pulsar Guardar ya está arriba. */
  async function anadirFoto(destino, camara = true) {
    const a = await CX().elegirFoto(camara);
    if (!a) return false;
    const l = await aligerar(a);
    if (!l) { aviso('No se ha podido leer la foto.'); return false; }
    const f = { vista: l.vista, subida: CX().subirFoto(l.blob).catch((e) => { aviso(e.message); return null; }) };
    destino.push(f);
    return true;
  }
  const idsDe = async (fotos) => (await Promise.all(fotos.map((f) => f.subida))).filter(Boolean);

  async function cargar() {
    try { datos = await CX().pedir('api/qhse/reportes'); } catch (e) { datos = { ok: false, error: e.message }; }
  }

  /* ─────────────────────────── La lista */

  async function lista() {
    if (!activa()) return;
    ficha = null;
    if (nuevo) { pintarNuevo(); return; }
    if (!datos) $app.innerHTML = '<div class="rq"><p class="rq-pista">Cargando…</p></div>';
    await cargar();
    if (!activa() || nuevo || ficha) return;
    pintarLista();
  }

  function pintarLista() {
    if (!datos || datos.ok === false) { $app.innerHTML = `<div class="rq"><p class="aviso-dato mal">${esc((datos && datos.error) || 'No se ha podido leer.')}</p></div>`; return; }
    const k = datos.kpis || {};
    const favs = datos.favoritos || [];
    const filas = (datos.filas || []).map((r) => `<tr data-rq-abrir="${esc(r.id)}"><td class="rq-cod">${esc(r.codigo || '')}<span class="rq-sub">${fechaEs(r.fecha)}</span></td>
      <td>${esc(nombre(datos.categorias, r.categoria))}<span class="rq-sub">${esc(r.que || '')}</span></td>
      <td style="width:24%"><span class="rq-est ${CLASE_ESTADO[r.estado] || ''}">${esc(nombre(datos.estados, r.estado))}</span>${r.pendientes ? '<span class="rq-sub">completar</span>' : ''}</td></tr>`).join('');
    $app.innerHTML = `<div class="rq">
      ${datos.puedeCrear ? '<button type="button" class="boton rq-nuevo" data-rq="nuevo">+ Nuevo reporte</button>' : ''}
      ${favs.length ? `<h2>Favoritos</h2><div class="rq-favs">${favs.map((f) => `<button type="button" class="rq-fav" data-rq-fav="${esc(f.id)}">★ ${esc(f.nombre)}</button>`).join('')}</div>` : ''}
      <div class="rq-kpis"><span><b>${k.abiertos || 0}</b>abiertos</span><span><b>${k.cerradosMes || 0}</b>cerrados este mes</span><span><b>${k.diasMedios == null ? '–' : String(k.diasMedios).replace('.', ',')}</b>días al cierre</span></div>
      <h2>Últimos reportes</h2>
      ${filas ? `<table><thead><tr><th>Código</th><th>Qué</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>` : '<p class="rq-pista">Aún no hay reportes. Pulsa «Nuevo reporte»: foto, qué y categoría.</p>'}
    </div>`;
  }

  /* ─────────────────────────── El alta rápida */

  async function empezar(fav = null, conCamara = false) {
    const obraId = CX().obraId();
    if (!obraId) { aviso('Elige la obra arriba.'); return; }
    if (!datos) await cargar();
    nuevo = { id: nuevoId(), obraId, tipo: (fav && fav.tipo) || 'observacion', categoria: (fav && fav.categoria) || '', que: (fav && fav.que) || '',
      clasificacion: (fav && fav.clasificacion) || null, medidas: (fav && fav.medidas) || null, fotos: [], ctx: null, guardando: false };
    pintarNuevo();
    CX().pedir(`api/qhse/reporte/contexto?obraId=${encodeURIComponent(obraId)}`).then((c) => { if (nuevo) { nuevo.ctx = c; pintarAuto(); } }).catch(() => {});
    if (conCamara) { if (await anadirFoto(nuevo.fotos)) pintarNuevo(); }
  }

  function autoTexto() {
    const c = nuevo && nuevo.ctx;
    if (!c || c.ok === false) return 'Se rellenan solos la obra, el cliente, la fecha y la hora, y quién lo da.';
    const a = c.auto;
    return `Se rellena solo: ${esc(c.obra.codigo)} · ${esc(a.cliente || 'sin cliente')} · ${esc(a.lineaNegocio)} · ${fechaEs(a.fecha)} ${esc(a.hora || '')} · ${esc(a.ubicacion || '')}. Se avisará a: ${esc(c.notificarNombres.join(', ') || 'nadie')}. Lo cambias en la ficha.`;
  }
  function pintarAuto() { const el = $app.querySelector('[data-rq-auto]'); if (el) el.innerHTML = autoTexto(); }

  function volcar() {
    if (!nuevo) return;
    const q = $app.querySelector('[data-rq-que]');
    if (q) nuevo.que = q.value;
  }

  function pintarNuevo() {
    if (!nuevo || !datos) return;
    const n = nuevo;
    $app.innerHTML = `<div class="rq">
      <div class="rq-tipos">${(datos.tipos || []).map((t) => `<button type="button" class="${n.tipo === t.id ? 'activo' : ''}" data-rq-tipo="${t.id}">${esc(t.id === 'inspeccion' ? 'Inspección' : t.nombre)}</button>`).join('')}</div>
      <div class="rq-fotos">${n.fotos.map((f) => (f.vista ? `<img src="${f.vista}" alt="Foto">` : '<span class="rq-pista">Foto</span>')).join('')}
        <button type="button" class="rq-otra" data-rq="camara">${n.fotos.length ? '+ Otra' : '📷 Foto'}</button></div>
      <div class="rq-campo"><label for="rq-que">¿Qué?</label>
        <textarea id="rq-que" data-rq-que rows="2" enterkeyhint="done" placeholder="Qué has visto">${esc(n.que)}</textarea><p class="rq-pista">${MICRO}</p></div>
      <div class="rq-cats" role="group" aria-label="Categoría">${(datos.categorias || []).map((c) => `<button type="button" class="${n.categoria === c.id ? 'activo' : ''}" data-rq-cat="${c.id}">${esc(c.nombre)}</button>`).join('')}</div>
      <p class="rq-auto" data-rq-auto>${autoTexto()}</p>
      <div class="rq-fila"><button type="button" class="boton secundario" data-rq="favorito">★ Guardar como favorito</button>
        <button type="button" class="boton secundario" data-rq="cancelar">Cancelar</button></div>
      <div class="rq-pie"><button type="button" class="boton" data-rq="guardar" ${n.guardando ? 'disabled' : ''}>${n.guardando ? 'Guardando…' : 'Guardar'}</button></div>
    </div>`;
  }

  async function guardar() {
    volcar();
    const n = nuevo;
    if (!n || n.guardando) return;
    if (!n.categoria) { aviso('Elige la categoría.'); return; }
    if (!String(n.que || '').trim() && !n.fotos.length) { aviso('Pon una foto o escribe qué has visto.'); return; }
    n.guardando = true; pintarNuevo();
    try {
      const fotos = await idsDe(n.fotos);
      const cuerpo = { id: n.id, obraId: n.obraId, tipo: n.tipo, categoria: n.categoria, que: n.que, fotos };
      if (n.clasificacion) cuerpo.clasificacion = n.clasificacion;
      if (n.medidas) cuerpo.medidas = n.medidas;
      const r = await CX().postJson('api/qhse/reporte', cuerpo);
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar.');
      nuevo = null;
      aviso(`Reporte ${r.codigo || ''} guardado. Avisados QHSE y el jefe de obra.`, 'bien');
      datos = null;
      await lista();
    } catch (e) { n.guardando = false; aviso(e.message); pintarNuevo(); }
  }

  /* ─────────────────────────── La ficha: completar después */

  async function abrir(id) {
    try { ficha = await CX().pedir(`api/qhse/reporte?id=${encodeURIComponent(id)}`); } catch (e) { aviso(e.message); return; }
    if (!ficha || ficha.ok === false) { aviso((ficha && ficha.error) || 'No se encuentra.'); ficha = null; return; }
    ficha.fotosNuevas = [];
    pintarFicha();
  }

  function pintarFicha() {
    const f = ficha; const r = f.reporte; const p = f.palabras;
    const ed = f.puedeEditar;
    const filas = f.campos.filter(([k]) => !['codigo', 'tipo', 'que', 'porQue', 'medidas', 'clasificacion', 'ubicacion'].includes(k))
      .map(([k, et]) => `<tr><td>${esc(et)}</td><td>${esc(p[k] || '–')}</td></tr>`).join('');
    const clas = (f.clasificaciones || []).map((c) => `<button type="button" class="${r.clasificacion === c.id ? 'activo' : ''}" data-rq-clas="${c.id}" ${ed ? '' : 'disabled'}>${esc(c.nombre)}</button>`).join('');
    const seg = r.seguimiento.map((s) => `<tr><td>${esc(String(s.fecha || '').slice(0, 16).replace('T', ' '))}<span class="rq-sub">${esc(f.nombres[s.quien] || '')}</span></td><td>${esc(s.texto)}</td></tr>`).join('');
    const cerrado = r.estado === 'cerrado';
    $app.innerHTML = `<div class="rq">
      <div class="rq-fila"><button type="button" class="boton secundario" data-rq="lista">‹ Reportes</button>
        <span class="rq-est ${CLASE_ESTADO[r.estado] || ''}">${esc(p.estado)}</span>
        <button type="button" class="boton secundario" data-rq="pdf">PDF</button></div>
      <h2>${esc(p.tipo)} ${esc(p.codigo)} · ${esc(p.categoria)}</h2>
      ${f.pendientes.length ? `<p class="rq-pista">Por completar: ${esc(f.pendientes.join(', '))}.</p>` : ''}
      <div class="rq-fotos">${r.fotos.map((_x, i) => `<img data-src="api/qhse/reporte/foto?id=${encodeURIComponent(r.id)}&i=${i}" alt="Foto ${i + 1}">`).join('')}
        ${f.fotosNuevas.map((x) => `<img src="${x.vista}" alt="Foto nueva">`).join('')}
        ${ed ? '<button type="button" class="rq-otra" data-rq="fotoFicha">+ Foto</button>' : ''}</div>
      <div class="rq-campo"><label>¿Qué?</label><textarea data-rq-c="que" rows="2" ${ed ? '' : 'disabled'}>${esc(r.que || '')}</textarea></div>
      <div class="rq-campo"><label>¿Por qué?</label><textarea data-rq-c="porQue" rows="2" ${ed ? '' : 'disabled'} placeholder="La causa">${esc(r.porQue || '')}</textarea></div>
      <div class="rq-campo"><label>Pasos tomados</label><textarea data-rq-c="medidas" rows="2" ${ed ? '' : 'disabled'} placeholder="Qué se ha hecho ya">${esc(r.medidas || '')}</textarea><p class="rq-pista">${MICRO}</p></div>
      <div class="rq-campo"><label>Clasificación</label><div class="rq-tipos">${clas}</div></div>
      <div class="rq-campo"><label>Ubicación</label><input data-rq-c="ubicacion" value="${esc(r.ubicacion || '')}" ${ed ? '' : 'disabled'}></div>
      <div class="rq-campo"><label>Zona / planta</label><input data-rq-c="zona" value="${esc(r.zona || '')}" ${ed ? '' : 'disabled'} placeholder="p. ej. Planta 2, tribuna norte"></div>
      ${ed ? '<div class="rq-fila"><button type="button" class="boton" data-rq="completar">Guardar</button></div>' : ''}
      <h2>Seguimiento</h2>
      ${seg ? `<table><tbody>${seg}</tbody></table>` : '<p class="rq-pista">Sin seguimiento todavía.</p>'}
      ${!cerrado && ed ? '<div class="rq-campo"><input data-rq-seg placeholder="Qué se ha hecho"></div><div class="rq-fila"><button type="button" class="boton secundario" data-rq="seguimiento">Apuntar</button></div>' : ''}
      ${f.puedeCerrar && !cerrado ? `<h2>Cierre</h2><div class="rq-campo"><textarea data-rq-res rows="2" placeholder="La resolución">${esc(r.resolucion || '')}</textarea></div>
        <div class="rq-fila"><button type="button" class="boton" data-rq="cerrar">Cerrar el reporte</button></div>` : ''}
      ${cerrado ? `<h2>Resolución</h2><p>${esc(r.resolucion || '')}</p>` : ''}
      <h2>Datos</h2><table class="rq-ficha"><tbody>${filas}</tbody></table>
    </div>`;
    CX().cargarImagenes($app);
  }

  async function completar() {
    const f = ficha; const id = f.reporte.id;
    const cambios = { id };
    for (const el of $app.querySelectorAll('[data-rq-c]')) cambios[el.dataset.rqC] = el.value;
    if (f.clasNueva) cambios.clasificacion = f.clasNueva;
    cambios.fotos = await idsDe(f.fotosNuevas);
    const r = await CX().postJson('api/qhse/reporte/completar', cambios).catch((e) => ({ ok: false, error: e.message }));
    if (!r || r.ok === false) { aviso((r && r.error) || 'No se ha podido guardar.'); return; }
    aviso('Guardado.', 'bien');
    await abrir(id);
  }

  /* ─────────────────────────── Eventos */

  $app.addEventListener('click', async (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const abrirFila = t.closest('[data-rq-abrir]');
    if (abrirFila) { await abrir(abrirFila.dataset.rqAbrir); return; }
    const fav = t.closest('[data-rq-fav]');
    if (fav) { await empezar((datos.favoritos || []).find((x) => x.id === fav.dataset.rqFav), true); return; }
    const tipo = t.closest('[data-rq-tipo]');
    if (tipo && nuevo) { volcar(); nuevo.tipo = tipo.dataset.rqTipo; pintarNuevo(); return; }
    const cat = t.closest('[data-rq-cat]');
    if (cat && nuevo) { volcar(); nuevo.categoria = cat.dataset.rqCat; pintarNuevo(); return; }
    const clas = t.closest('[data-rq-clas]');
    if (clas && ficha) {
      ficha.clasNueva = clas.dataset.rqClas;
      for (const b of $app.querySelectorAll('[data-rq-clas]')) b.classList.toggle('activo', b === clas);
      return;
    }
    const b = t.closest('[data-rq]');
    if (!b) return;
    const acc = b.dataset.rq;
    if (acc === 'nuevo') await empezar(null, false);
    else if (acc === 'camara' && nuevo) { volcar(); if (await anadirFoto(nuevo.fotos)) pintarNuevo(); }
    else if (acc === 'guardar') await guardar();
    else if (acc === 'cancelar') { nuevo = null; await lista(); }
    else if (acc === 'favorito' && nuevo) {
      volcar();
      if (!nuevo.categoria) { aviso('Elige antes la categoría.'); return; }
      const nom = window.prompt('Nombre del favorito', String(nuevo.que || '').slice(0, 40));
      if (!nom) return;
      const r = await CX().postJson('api/qhse/favorito', { nombre: nom, tipo: nuevo.tipo, categoria: nuevo.categoria, que: nuevo.que, obraId: nuevo.obraId }).catch((e) => ({ ok: false, error: e.message }));
      if (r && r.ok) { aviso('Favorito guardado: la próxima vez, un toque.', 'bien'); datos = null; await cargar(); } else aviso((r && r.error) || 'No se ha podido guardar.');
    } else if (acc === 'lista') { ficha = null; await lista(); }
    else if (acc === 'fotoFicha' && ficha) { if (await anadirFoto(ficha.fotosNuevas)) pintarFicha(); }
    else if (acc === 'completar' && ficha) await completar();
    else if (acc === 'seguimiento' && ficha) {
      const el = $app.querySelector('[data-rq-seg]');
      const r = await CX().postJson('api/qhse/reporte/seguimiento', { id: ficha.reporte.id, texto: el ? el.value : '' }).catch((e) => ({ ok: false, error: e.message }));
      if (!r || r.ok === false) aviso((r && r.error) || 'No se ha podido apuntar.'); else await abrir(ficha.reporte.id);
    } else if (acc === 'cerrar' && ficha) {
      const el = $app.querySelector('[data-rq-res]');
      const r = await CX().postJson('api/qhse/reporte/cerrar', { id: ficha.reporte.id, resolucion: el ? el.value : '' }).catch((e) => ({ ok: false, error: e.message }));
      if (!r || r.ok === false) aviso((r && r.error) || 'No se ha podido cerrar.'); else { aviso('Reporte cerrado.', 'bien'); await abrir(ficha.reporte.id); }
    } else if (acc === 'pdf' && ficha) {
      await CX().compartirPdf(`api/qhse/reporte/pdf?id=${encodeURIComponent(ficha.reporte.id)}`, `Reporte QHSE ${ficha.reporte.codigo || ''}.pdf`, b);
    }
  });

  window.addEventListener('hashchange', () => { if (activa()) lista(); else { volcar(); } });
  window.addEventListener('movil:obra', () => { if (activa() && !nuevo) { datos = null; lista(); } });
  /* El «+» › «Reporte QHSE» abre la cámara directamente. */
  window.REPORTES_QHSE_MOVIL = { nuevoConFoto: () => empezar(null, true) };
  if (activa()) lista();
})();
