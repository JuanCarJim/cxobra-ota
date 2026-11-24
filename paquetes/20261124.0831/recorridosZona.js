'use strict';
/*
 * RECORRIDO DE ZONA EN EL TELÉFONO (17-nov-2026, JC, nota 51e3cf36: como el
 * correo «CARPARK STATUS AND PENDING WORKS UP5 ZONE»).
 *
 *   «+» › Recorrido de zona → planta o zona y fecha → Crear
 *   «+ Punto» → foto (cámara o galería) → qué hay que liberar → industrial → sala → Guardar y otro
 *
 * Los puntos se numeran solos. El jefe de obra pone cada uno en pendiente,
 * liberado o hecho (aquí si tiene `editar`; si no, en el ordenador) y saca el
 * PDF desde Incidencias › Recorridos. Sin listas infinitas: los recorridos van
 * por páginas y los puntos plegados por industrial.
 *
 * Rutas: electron/movil/rutasRecorridosZona.js. Acciones con data-rz.
 */
(function recorridosZona() {
  const $app = document.getElementById('app');
  const CX = () => window.CX;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const activa = () => location.hash === '#recorridos';
  const aviso = (t, n = 'mal') => (CX() ? CX().aviso(t, n) : alert(t));
  const ESTADOS = [['pendiente', 'Pendiente'], ['liberado', 'Liberado'], ['hecho', 'Hecho']];
  const NOMBRE_ESTADO = Object.fromEntries(ESTADOS);
  const POR_GRUPO = 12;

  if (!document.getElementById('estilo-rz')) {
    const s = document.createElement('style');
    s.id = 'estilo-rz';
    s.textContent = `
      .rz { padding-bottom: 96px; }
      .rz h2 { font-size: 18px; margin: 14px 0 6px; color: var(--acento-fuerte); }
      .rz .rz-nuevo { width: 100%; min-height: 54px; font-size: 18px; border-radius: 14px; }
      .rz table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .rz th { text-align: left; font-size: 13px; font-weight: 600; color: var(--acento-fuerte); background: none; border-bottom: 2px solid var(--acento-fuerte); padding: 6px 4px; }
      .rz td { padding: 10px 4px; border-bottom: 1px solid var(--panel3); vertical-align: top; font-size: 15px; overflow-wrap: anywhere; }
      .rz td.rz-cod { width: 34%; font-weight: 600; font-variant-numeric: tabular-nums; }
      .rz .rz-sub { display: block; font-size: 13px; color: var(--texto-suave, var(--textoSuave)); font-weight: 400; }
      .rz .rz-est { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
      .rz .rz-pendiente { background: var(--aviso-fondo); color: var(--aviso); }
      .rz .rz-liberado { background: var(--info-fondo); color: var(--info); }
      .rz .rz-hecho { background: var(--bien-fondo); color: var(--bien); }
      .rz .rz-kpis { display: flex; gap: 14px; margin: 8px 0 4px; font-size: 14px; color: var(--texto-suave, var(--textoSuave)); flex-wrap: wrap; }
      .rz .rz-kpis b { font-size: 18px; color: var(--acento-fuerte); font-variant-numeric: tabular-nums; margin-right: 3px; }
      .rz .rz-cab { font-size: 14px; color: var(--texto-suave, var(--textoSuave)); margin: 4px 0 8px; }
      .rz .rz-cab b { color: var(--acento-fuerte); font-size: 16px; }
      .rz details { border-bottom: 1px solid var(--panel3); }
      .rz summary { display: flex; justify-content: space-between; gap: 8px; align-items: center; min-height: 46px; font-size: 16px; font-weight: 600; color: var(--acento-fuerte); cursor: pointer; list-style: none; }
      .rz summary::-webkit-details-marker { display: none; }
      .rz summary::before { content: '▸'; margin-right: 6px; }
      .rz details[open] summary::before { content: '▾'; }
      .rz summary .rz-n { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--texto-suave, var(--textoSuave)); }
      .rz .rz-punto { display: grid; grid-template-columns: 30px 64px minmax(0, 1fr); gap: 8px; padding: 8px 0; border-top: 1px solid var(--panel3); }
      .rz .rz-num { font-size: 18px; font-weight: 700; color: var(--acento-fuerte); font-variant-numeric: tabular-nums; }
      .rz .rz-punto img, .rz .rz-sinfoto { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: var(--panel3); display: block; }
      .rz .rz-punto p { margin: 0 0 4px; font-size: 15px; }
      .rz .rz-punto select { font-size: 15px; min-height: 36px; width: auto; }
      .rz .rz-fotos { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 8px; }
      .rz .rz-fotos img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; flex: none; }
      .rz .rz-otra { flex: none; width: 84px; height: 84px; border-radius: 10px; border: 2px dashed var(--acento-fuerte); background: var(--panel); color: var(--acento-fuerte); font-size: 14px; font-weight: 600; }
      .rz textarea, .rz input, .rz select.rz-ancho { width: 100%; box-sizing: border-box; font-size: 17px; }
      .rz .rz-campo { margin: 10px 0; }
      .rz .rz-campo label { display: block; font-size: 14px; font-weight: 600; color: var(--acento-fuerte); margin-bottom: 4px; }
      .rz .rz-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .rz .rz-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .rz .rz-chips button { min-height: 40px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--acento-suave); background: var(--panel); color: var(--texto); font-size: 14px; font-weight: 600; }
      .rz .rz-chips button.activo { background: var(--acento-relleno); color: var(--sobre-relleno); border-color: var(--acento-relleno); }
      .rz .rz-pista { font-size: 13px; color: var(--texto-suave, var(--textoSuave)); margin: 3px 0 0; }
      .rz .rz-fila { display: flex; gap: 8px; align-items: center; margin: 8px 0; flex-wrap: wrap; }
      .rz .rz-fila .boton { width: fit-content; }
      .rz .rz-pie { position: fixed; left: 0; right: 0; bottom: calc(var(--hueco-barra, 104px) + env(safe-area-inset-bottom, 0px) - 8px); padding: 8px 16px; background: var(--panel); z-index: 5; display: flex; gap: 8px; }
      .rz .rz-pie .boton { flex: 1; min-height: 54px; font-size: 17px; border-radius: 14px; }
      .rz .rz-pags { display: flex; gap: 8px; justify-content: center; align-items: center; margin: 10px 0; font-size: 14px; }
    `;
    document.head.append(s);
  }

  let datos = null; /* GET api/recorridos */
  let pagina = 1;
  let ficha = null; /* GET api/recorrido */
  let ctx = null; /* GET api/recorrido/contexto */
  let nuevo = null; /* el recorrido que se está creando */
  let punto = null; /* el punto que se está apuntando */
  const abiertos = new Set(); /* grupos desplegados */
  const pagGrupo = {};
  const nuevoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
  const chip = (e) => `<span class="rz-est rz-${esc(NOMBRE_ESTADO[e] ? e : 'pendiente')}">${esc(NOMBRE_ESTADO[e] || 'Pendiente')}</span>`;

  /* La foto, a lo sumo 1280 px y ~200 KB en JPEG (como los reportes QHSE). */
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
  async function anadirFoto(destino, camara) {
    const archivos = await window.AUTOGUARDADO.elegirFotos(camara);
    if (!archivos.length) return false;
    const r = await window.AUTOGUARDADO.porLotes(archivos.slice(0, Math.max(0, 6 - destino.length)), async (a) => {
      const l = await aligerar(a);
      if (!l) throw new Error('No se ha podido leer la foto.');
      destino.push({ vista: l.vista, subida: CX().subirFoto(l.blob).catch((e) => { aviso(e.message); return null; }) });
    }, 'Subiendo');
    return r.hechas > 0;
  }
  const idsDe = async (fotos) => (await Promise.all(fotos.map((f) => f.subida))).filter(Boolean);

  async function cargarContexto(obraId) {
    if (ctx && ctx.obra && ctx.obra.id === obraId) return ctx;
    try { ctx = await CX().pedir(`api/recorrido/contexto?obraId=${encodeURIComponent(obraId)}`); } catch { ctx = null; }
    return ctx;
  }

  /* ─────────────────────────── La lista de recorridos (por páginas) */

  async function lista() {
    if (!activa()) return;
    if (nuevo) { pintarNuevo(); return; }
    if (punto) { pintarPunto(); return; }
    if (ficha) { pintarFicha(); return; }
    if (!datos) $app.innerHTML = '<div class="rz"><p class="rz-pista">Cargando…</p></div>';
    const obraId = CX().obraId() || '';
    try { datos = await CX().pedir(`api/recorridos?obraId=${encodeURIComponent(obraId)}&pagina=${pagina}`); } catch (e) { datos = { ok: false, error: e.message }; }
    if (!activa() || nuevo || punto || ficha) return;
    pintarLista();
  }

  function pintarLista() {
    if (!datos || datos.ok === false) { $app.innerHTML = `<div class="rz"><p class="aviso-dato mal">${esc((datos && datos.error) || 'No se ha podido leer.')}</p></div>`; return; }
    const filas = (datos.filas || []).map((r) => `<tr data-rz-abrir="${esc(r.id)}">
      <td class="rz-cod">${esc(r.codigo || '')}<span class="rz-sub">${fechaEs(r.fecha)}</span></td>
      <td>${esc([r.planta, r.zona].filter(Boolean).join(' · '))}<span class="rz-sub">${esc(r.autor || '')}${r.estado === 'cerrado' ? ' · cerrado' : ''}</span></td>
      <td style="width:26%">${r.resumen.pendiente ? `<span class="rz-est rz-pendiente">${r.resumen.pendiente} pend.</span>` : '<span class="rz-est rz-hecho">Al día</span>'}<span class="rz-sub">${r.resumen.total} puntos</span></td></tr>`).join('');
    const pags = datos.paginas > 1 ? `<div class="rz-pags">
      <button type="button" class="boton secundario" data-rz="pagAnt" ${datos.pagina <= 1 ? 'disabled' : ''}>‹</button>
      <span>Página ${datos.pagina} de ${datos.paginas}</span>
      <button type="button" class="boton secundario" data-rz="pagSig" ${datos.pagina >= datos.paginas ? 'disabled' : ''}>›</button></div>` : '';
    $app.innerHTML = `<div class="rz">
      ${datos.puedeCrear ? '<button type="button" class="boton rz-nuevo" data-rz="nuevo">+ Nuevo recorrido</button>' : ''}
      <h2>Recorridos de la obra</h2>
      ${filas ? `<table><thead><tr><th>Código</th><th>Planta / zona</th><th>Puntos</th></tr></thead><tbody>${filas}</tbody></table>${pags}`
    : '<p class="rz-pista">Aún no hay recorridos. Pulsa «Nuevo recorrido»: planta o zona, y luego los puntos con su foto.</p>'}
    </div>`;
  }

  /* ─────────────────────────── Crear el recorrido */

  async function empezar() {
    const obraId = CX().obraId();
    if (!obraId) { aviso('Elige la obra arriba.'); return; }
    const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    nuevo = { id: nuevoId(), obraId, planta: '', zona: '', fecha: hoy, guardando: false };
    ficha = null; punto = null;
    pintarNuevo();
    await cargarContexto(obraId);
    if (nuevo) pintarNuevo();
  }
  function volcarNuevo() {
    if (!nuevo) return;
    for (const k of ['planta', 'zona', 'fecha']) { const el = $app.querySelector(`[data-rz-n="${k}"]`); if (el) nuevo[k] = el.value; }
  }
  function pintarNuevo() {
    const n = nuevo;
    const plantas = (ctx && ctx.plantas) || [];
    $app.innerHTML = `<div class="rz">
      <h2>Nuevo recorrido</h2>
      <div class="rz-campo"><label for="rz-planta">Planta</label>
        <input id="rz-planta" data-rz-n="planta" list="rz-plantas" value="${esc(n.planta)}" placeholder="P-1, P-5, cubierta…" autocomplete="off">
        <datalist id="rz-plantas">${plantas.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="rz-campo"><label for="rz-zona">Zona</label>
        <input id="rz-zona" data-rz-n="zona" value="${esc(n.zona)}" placeholder="Parking UP5, núcleo norte…" autocomplete="off"></div>
      <div class="rz-campo"><label for="rz-fecha">Fecha</label><input id="rz-fecha" type="date" data-rz-n="fecha" value="${esc(n.fecha)}"></div>
      <p class="rz-pista">Basta con la planta o la zona. Luego vas añadiendo los puntos.</p>
      <div class="rz-pie"><button type="button" class="boton secundario" data-rz="cancelar">Cancelar</button>
        <button type="button" class="boton" data-rz="crear" ${n.guardando ? 'disabled' : ''}>${n.guardando ? 'Creando…' : 'Crear y añadir puntos'}</button></div>
    </div>`;
  }
  async function crear() {
    volcarNuevo();
    const n = nuevo;
    if (!n || n.guardando) return;
    if (!n.planta.trim() && !n.zona.trim()) { aviso('Pon la planta o la zona.'); return; }
    n.guardando = true; pintarNuevo();
    const r = await CX().postJson('api/recorrido', { id: n.id, obraId: n.obraId, planta: n.planta, zona: n.zona, fecha: n.fecha }).catch((e) => ({ ok: false, error: e.message }));
    if (!r || r.ok === false) { n.guardando = false; aviso((r && r.error) || 'No se ha podido crear.'); pintarNuevo(); return; }
    nuevo = null; datos = null;
    aviso(`Recorrido ${r.codigo || ''} creado.`, 'bien');
    await abrir(r.id, true);
  }

  /* ─────────────────────────── El recorrido: puntos plegados por industrial */

  async function abrir(id, conPunto = false) {
    try { ficha = await CX().pedir(`api/recorrido?id=${encodeURIComponent(id)}`); } catch (e) { aviso(e.message); return; }
    if (!ficha || ficha.ok === false) { aviso((ficha && ficha.error) || 'No se encuentra.'); ficha = null; return; }
    if (!abiertos.size && ficha.grupos[0]) abiertos.add(ficha.grupos[0].industrial);
    if (conPunto && ficha.puede.anadir) { await empezarPunto(); return; }
    pintarFicha();
  }

  function pintarFicha() {
    if (!ficha) return;
    const r = ficha.recorrido;
    const n = r.resumen;
    const editar = ficha.puede.editar;
    const filaPunto = (p) => `<div class="rz-punto">
      <div class="rz-num">${esc(p.numero)}</div>
      ${p.fotos.length ? `<img data-src="api/recorrido/foto?id=${encodeURIComponent(p.id)}&i=0" alt="Foto del punto ${esc(p.numero)}">` : '<span class="rz-sinfoto"></span>'}
      <div><p>${esc(p.descripcion || '(solo foto)')}</p>
        <span class="rz-sub">${[p.sala ? `Sala ${esc(p.sala)}` : '', p.fotos.length > 1 ? `${p.fotos.length} fotos` : ''].filter(Boolean).join(' · ')}</span>
        ${editar ? `<select data-rz-estado="${esc(p.id)}" aria-label="Estado del punto ${esc(p.numero)}">${ESTADOS.map(([id, nom]) => `<option value="${id}" ${p.estado === id ? 'selected' : ''}>${nom}</option>`).join('')}</select>` : chip(p.estado)}
      </div></div>`;
    const grupos = ficha.grupos.map((g) => {
      const pg = pagGrupo[g.industrial] || 1;
      const paginas = Math.max(1, Math.ceil(g.puntos.length / POR_GRUPO));
      const trozo = g.puntos.slice((pg - 1) * POR_GRUPO, pg * POR_GRUPO);
      return `<details data-rz-grupo="${esc(g.industrial)}" ${abiertos.has(g.industrial) ? 'open' : ''}>
        <summary>${esc(g.industrial)}<span class="rz-n">${[g.pendiente ? `${g.pendiente} pend.` : '', g.liberado ? `${g.liberado} ${g.liberado === 1 ? 'liberado' : 'liberados'}` : '', g.hecho ? `${g.hecho} ${g.hecho === 1 ? 'hecho' : 'hechos'}` : ''].filter(Boolean).join(' · ')}</span></summary>
        ${trozo.map(filaPunto).join('')}
        ${paginas > 1 ? `<div class="rz-pags"><button type="button" class="boton secundario" data-rz-gpag="${esc(g.industrial)}" data-d="-1" ${pg <= 1 ? 'disabled' : ''}>‹</button><span>${pg} de ${paginas}</span><button type="button" class="boton secundario" data-rz-gpag="${esc(g.industrial)}" data-d="1" ${pg >= paginas ? 'disabled' : ''}>›</button></div>` : ''}
      </details>`;
    }).join('');
    $app.innerHTML = `<div class="rz">
      <div class="rz-fila"><button type="button" class="boton secundario" data-rz="lista">‹ Recorridos</button></div>
      <p class="rz-cab"><b>${esc(r.codigo || '')}</b> · ${esc([r.planta, r.zona].filter(Boolean).join(' · '))} · ${fechaEs(r.fecha)}${r.estado === 'cerrado' ? ' · cerrado' : ''}</p>
      <div class="rz-kpis"><span><b>${n.total}</b>puntos</span><span><b>${n.pendiente}</b>pendientes</span><span><b>${n.liberado}</b>${n.liberado === 1 ? 'liberado' : 'liberados'}</span><span><b>${n.hecho}</b>${n.hecho === 1 ? 'hecho' : 'hechos'}</span></div>
      ${grupos || '<p class="rz-pista">Aún no hay puntos. Pulsa «+ Punto»: foto, qué hay que liberar y quién.</p>'}
      ${ficha.puede.anadir ? '<div class="rz-pie"><button type="button" class="boton" data-rz="punto">+ Punto</button></div>' : ''}
    </div>`;
    CX().cargarImagenes($app);
  }

  /* ─────────────────────────── Apuntar un punto */

  async function empezarPunto() {
    if (!ficha) return;
    await cargarContexto(ficha.recorrido.obraId);
    punto = { id: nuevoId(), descripcion: '', industrial: '', empresaId: null, sala: '', fotos: [], guardando: false, otro: false };
    pintarPunto();
  }
  function volcarPunto() {
    if (!punto) return;
    for (const k of ['descripcion', 'sala', 'industrialOtro']) { const el = $app.querySelector(`[data-rz-p="${k}"]`); if (el) punto[k] = el.value; }
    if (punto.otro) { punto.industrial = punto.industrialOtro || ''; punto.empresaId = null; }
  }
  function pintarPunto() {
    if (!punto || !ficha) return;
    const p = punto;
    const inds = (ctx && ctx.industriales) || [];
    const salas = ((ctx && ctx.salas) || []).filter((s) => !ficha.recorrido.planta || !s.planta || s.planta === ficha.recorrido.planta);
    const siguiente = (ficha.puntos.reduce((m, x) => Math.max(m, x.numero || 0), 0)) + 1;
    $app.innerHTML = `<div class="rz">
      <h2>Punto ${siguiente} · ${esc(ficha.recorrido.codigo || '')}</h2>
      <div class="rz-fotos">${p.fotos.map((f) => (f.vista ? `<img src="${f.vista}" alt="Foto">` : '<span class="rz-pista">Foto</span>')).join('')}
        <button type="button" class="rz-otra" data-rz="camara">📷 Cámara</button>
        <button type="button" class="rz-otra" data-rz="galeria">Galería</button></div>
      <div class="rz-campo"><label for="rz-desc">Qué hay que liberar</label>
        <textarea id="rz-desc" data-rz-p="descripcion" rows="3" enterkeyhint="done" placeholder="Quitar la red de la estructura para poder colgar la ventilación">${esc(p.descripcion)}</textarea>
        <p class="rz-pista">Para dictar, pulsa el micrófono del teclado.</p></div>
      <div class="rz-campo"><label>Responsable (industrial)</label>
        <div class="rz-chips" role="group" aria-label="Industrial">${inds.map((i) => `<button type="button" class="${!p.otro && p.industrial === i.nombre ? 'activo' : ''}" data-rz-ind="${esc(i.nombre)}" data-emp="${esc(i.empresaId || '')}">${esc(i.nombre)}</button>`).join('')}
          <button type="button" class="${p.otro ? 'activo' : ''}" data-rz-ind="" data-otro="1">Otro…</button></div>
        ${p.otro || !inds.length ? `<input data-rz-p="industrialOtro" value="${esc(p.industrialOtro || p.industrial)}" placeholder="Nombre de la empresa" style="margin-top:6px" autocomplete="off">` : ''}</div>
      <div class="rz-campo"><label for="rz-sala">Sala (si se sabe)</label>
        <input id="rz-sala" data-rz-p="sala" list="rz-salas" value="${esc(p.sala)}" placeholder="10.104" autocomplete="off">
        <datalist id="rz-salas">${salas.slice(0, 300).map((s) => `<option value="${esc(s.sala)}">`).join('')}</datalist></div>
      <div class="rz-pie"><button type="button" class="boton secundario" data-rz="guardarOtro" ${p.guardando ? 'disabled' : ''}>Guardar y otro</button>
        <button type="button" class="boton" data-rz="guardarPunto" ${p.guardando ? 'disabled' : ''}>${p.guardando ? 'Guardando…' : 'Guardar'}</button></div>
      <div class="rz-fila"><button type="button" class="boton secundario" data-rz="cancelarPunto">Cancelar</button></div>
    </div>`;
  }
  async function guardarPunto(otro) {
    volcarPunto();
    const p = punto;
    if (!p || p.guardando) return;
    if (!String(p.descripcion || '').trim() && !p.fotos.length) { aviso('Pon una foto o escribe qué hay que liberar.'); return; }
    p.guardando = true; pintarPunto();
    try {
      const fotos = await idsDe(p.fotos);
      const r = await CX().postJson('api/recorrido/punto', { id: p.id, recorridoId: ficha.recorrido.id, descripcion: p.descripcion, industrial: p.industrial, empresaId: p.empresaId, sala: p.sala, fotos });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar.');
      aviso(`Punto ${r.numero} guardado.`, 'bien');
      if (p.industrial) abiertos.add(p.industrial);
      const recId = ficha.recorrido.id;
      punto = null;
      await abrir(recId, otro);
    } catch (e) { p.guardando = false; aviso(e.message); pintarPunto(); }
  }

  $app.addEventListener('change', async (ev) => {
    const sel = ev.target.closest && ev.target.closest('[data-rz-estado]');
    if (!sel || !activa() || !ficha) return;
    const r = await CX().postJson('api/recorrido/punto/estado', { id: sel.dataset.rzEstado, estado: sel.value }).catch((e) => ({ ok: false, error: e.message }));
    if (!r || r.ok === false) { aviso((r && r.error) || 'No se ha podido cambiar.'); }
    await abrir(ficha.recorrido.id);
  });
  $app.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d || !d.dataset || d.dataset.rzGrupo === undefined) return;
    if (d.open) abiertos.add(d.dataset.rzGrupo); else abiertos.delete(d.dataset.rzGrupo);
  }, true);

  $app.addEventListener('click', async (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const fila = t.closest('[data-rz-abrir]');
    if (fila) { abiertos.clear(); await abrir(fila.dataset.rzAbrir); return; }
    const ind = t.closest('[data-rz-ind]');
    if (ind && punto) {
      volcarPunto();
      if (ind.dataset.otro) { punto.otro = true; punto.industrial = punto.industrialOtro || ''; punto.empresaId = null; } else { punto.otro = false; punto.industrial = ind.dataset.rzInd; punto.empresaId = ind.dataset.emp || null; }
      pintarPunto(); return;
    }
    const gp = t.closest('[data-rz-gpag]');
    if (gp) { const g = gp.dataset.rzGpag; pagGrupo[g] = Math.max(1, (pagGrupo[g] || 1) + Number(gp.dataset.d)); pintarFicha(); return; }
    const b = t.closest('[data-rz]');
    if (!b) return;
    const acc = b.dataset.rz;
    if (acc === 'nuevo') await empezar();
    else if (acc === 'crear') await crear();
    else if (acc === 'cancelar') { nuevo = null; await lista(); }
    else if (acc === 'lista') { ficha = null; datos = null; await lista(); }
    else if (acc === 'pagAnt') { pagina = Math.max(1, pagina - 1); await lista(); }
    else if (acc === 'pagSig') { pagina += 1; await lista(); }
    else if (acc === 'punto') await empezarPunto();
    else if ((acc === 'camara' || acc === 'galeria') && punto) { volcarPunto(); if (await anadirFoto(punto.fotos, acc === 'camara')) pintarPunto(); }
    else if (acc === 'guardarPunto') await guardarPunto(false);
    else if (acc === 'guardarOtro') await guardarPunto(true);
    else if (acc === 'cancelarPunto') { punto = null; pintarFicha(); }
  });

  window.addEventListener('hashchange', () => { if (activa()) lista(); else { volcarNuevo(); volcarPunto(); } });
  window.addEventListener('movil:obra', () => { if (activa() && !nuevo && !punto) { datos = null; ficha = null; ctx = null; pagina = 1; lista(); } });
  window.RECORRIDOS_ZONA_MOVIL = { nuevo: () => empezar() };
  if (activa()) lista();
})();
