'use strict';
/*
 * RECORRIDOS DE ZONA EN EL TELÉFONO (18-nov-2026, JC: «que la app cree reportes
 * como el correo de los puntos a liberar del parking»).
 *
 *   Nuevo recorrido → zona (la fecha y quién lo hace, solos)
 *   + Punto → foto (cámara o galería) · qué hay que liberar · quién lo libera → Guardar
 *   Cada punto, plegado en su fila: se abre para ver la foto, cambiarlo o darlo por liberado.
 *   PDF → el informe para mandarlo (lo comparte la persona; la app no envía nada).
 *
 * Reglas: shared/recorridos/recorridos.js; rutas: electron/movil/rutasRecorridos.js.
 * Acciones con data-rz.
 */
(function recorridos() {
  const $app = document.getElementById('app');
  const CX = () => window.CX;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const activa = () => location.hash === '#recorridos';
  const aviso = (t, n = 'mal') => (CX() ? CX().aviso(t, n) : alert(t));
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const nuevoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

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
      .rz td.rz-cod { width: 32%; font-weight: 600; font-variant-numeric: tabular-nums; }
      .rz .rz-sub { display: block; font-size: 13px; color: var(--texto-suave, var(--textoSuave)); font-weight: 400; }
      .rz .rz-kpis { display: flex; gap: 14px; margin: 8px 0 4px; font-size: 14px; color: var(--texto-suave, var(--textoSuave)); flex-wrap: wrap; }
      .rz .rz-kpis b { font-size: 18px; color: var(--acento-fuerte); font-variant-numeric: tabular-nums; margin-right: 3px; }
      .rz .rz-est { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
      .rz .rz-pend { background: var(--info-fondo); color: var(--info); }
      .rz .rz-lib { background: var(--bien-fondo); color: var(--bien); }
      .rz details.rz-punto { border-bottom: 1px solid var(--panel3); }
      .rz details.rz-punto > summary { list-style: none; display: grid; grid-template-columns: 30px 52px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; cursor: pointer; }
      .rz details.rz-punto > summary::-webkit-details-marker { display: none; }
      .rz .rz-n { width: 26px; height: 26px; border-radius: 50%; background: var(--acento-relleno); color: var(--sobre-relleno); display: grid; place-items: center; font-weight: 700; font-size: 14px; }
      .rz .rz-n.pend { background: var(--granate, #8a2b3a); color: #fff; }
      .rz .rz-mini { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; background: var(--panel3); }
      .rz .rz-txt { font-size: 15px; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .rz .rz-fotos { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 8px; }
      .rz .rz-fotos img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; flex: none; }
      .rz .rz-otra { flex: none; width: 96px; height: 96px; border-radius: 10px; border: 2px dashed var(--acento-fuerte); background: var(--panel); color: var(--acento-fuerte); font-size: 14px; font-weight: 600; }
      .rz textarea, .rz input { width: 100%; box-sizing: border-box; font-size: 17px; }
      .rz .rz-campo { margin: 10px 0; }
      .rz .rz-campo label { display: block; font-size: 14px; font-weight: 600; color: var(--acento-fuerte); margin-bottom: 4px; }
      .rz .rz-pista { font-size: 13px; color: var(--texto-suave, var(--textoSuave)); margin: 3px 0 0; }
      .rz .rz-fila { display: flex; gap: 8px; align-items: center; margin: 8px 0; flex-wrap: wrap; }
      .rz .rz-fila .boton { width: fit-content; }
      .rz .rz-pie { position: fixed; left: 0; right: 0; bottom: calc(var(--hueco-barra, 104px) + env(safe-area-inset-bottom, 0px) - 8px); padding: 8px 16px; background: var(--panel); z-index: 5; }
      .rz .rz-pie .boton { width: 100%; min-height: 54px; font-size: 18px; border-radius: 14px; }
      .rz .rz-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .rz .rz-dos .boton { width: 100%; min-height: 48px; }
    `;
    document.head.append(s);
  }

  let datos = null;   /* GET api/recorridos */
  let pagina = 1;
  let ficha = null;   /* GET api/recorrido */
  let alta = null;    /* el recorrido que se abre */
  let punto = null;   /* el punto que se está añadiendo */

  /* La foto, a lo sumo 1280 px y ~200 KB en JPEG (como en los reportes QHSE). */
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
  /* Cada foto empieza a subir en cuanto se elige: al pulsar Guardar ya está arriba. */
  async function anadirFoto(destino, camara) {
    const archivos = await window.AUTOGUARDADO.elegirFotos(camara);
    if (!archivos.length) return false;
    const r = await window.AUTOGUARDADO.porLotes(archivos.slice(0, 4 - destino.length), async (a) => {
      const l = await aligerar(a);
      if (!l) throw new Error('No se ha podido leer la foto.');
      destino.push({ vista: l.vista, subida: CX().subirFoto(l.blob).catch((e) => { aviso(e.message); return null; }) });
    }, 'Subiendo');
    return r.hechas > 0;
  }
  const idsDe = async (fotos) => (await Promise.all(fotos.map((f) => f.subida))).filter(Boolean);
  const fotoUrl = (id, p, i) => `api/recorrido/foto?id=${encodeURIComponent(id)}&punto=${encodeURIComponent(p)}&i=${i}`;

  /* ─────────────────────────── La lista de recorridos */

  async function cargar() {
    const obraId = CX().obraId ? CX().obraId() : '';
    try { datos = await CX().pedir(`api/recorridos?pagina=${pagina}${obraId ? `&obraId=${encodeURIComponent(obraId)}` : ''}`); } catch (e) { datos = { ok: false, error: e.message }; }
  }
  async function lista() {
    if (!activa()) return;
    if (ficha || alta || punto) { pintar(); return; }
    if (!datos) $app.innerHTML = '<div class="rz"><p class="rz-pista">Cargando…</p></div>';
    await cargar();
    if (activa() && !ficha && !alta && !punto) pintarLista();
  }
  function pintar() { if (punto) pintarPunto(); else if (alta) pintarAlta(); else if (ficha) pintarFicha(); else pintarLista(); }

  function pintarLista() {
    if (!datos || datos.ok === false) { $app.innerHTML = `<div class="rz"><p class="aviso-dato mal">${esc((datos && datos.error) || 'No se ha podido leer.')}</p></div>`; return; }
    const k = datos.kpis || {};
    const filas = (datos.filas || []).map((r) => `<tr data-rz-abrir="${esc(r.id)}"><td class="rz-cod">${esc(fechaEs(r.fecha))}<span class="rz-sub">${esc(r.codigo || '')}</span></td>
      <td><b>${esc(r.zona)}</b><span class="rz-sub">${esc(r.autor || '')} · ${r.puntos} ${r.puntos === 1 ? 'punto' : 'puntos'}</span></td>
      <td style="width:26%">${r.pendientes ? `<span class="rz-est rz-pend">${r.pendientes} por liberar</span>` : r.puntos ? '<span class="rz-est rz-lib">Liberado</span>' : ''}</td></tr>`).join('');
    const pag = datos.paginas > 1 ? `<div class="rz-fila"><button type="button" class="boton secundario" data-rz="antes" ${datos.pagina <= 1 ? 'disabled' : ''}>‹ Anteriores</button>
      <span class="rz-pista">Página ${datos.pagina} de ${datos.paginas}</span><button type="button" class="boton secundario" data-rz="despues" ${datos.pagina >= datos.paginas ? 'disabled' : ''}>Siguientes ›</button></div>` : '';
    $app.innerHTML = `<div class="rz">
      ${datos.puedeCrear ? '<button type="button" class="boton rz-nuevo" data-rz="nuevo">+ Nuevo recorrido</button>' : ''}
      <div class="rz-kpis"><span><b>${k.recorridos || 0}</b>recorridos</span><span><b>${k.pendientes || 0}</b>puntos por liberar</span><span><b>${k.liberados || 0}</b>liberados</span></div>
      <h2>Recorridos</h2>
      ${filas ? `<table><thead><tr><th>Fecha</th><th>Zona</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>${pag}` : '<p class="rz-pista">Aún no hay recorridos. Pulsa «Nuevo recorrido», pon la zona y añade cada punto con su foto.</p>'}
    </div>`;
  }

  /* ─────────────────────────── Abrir un recorrido */

  function pintarAlta() {
    $app.innerHTML = `<div class="rz">
      <h2>Nuevo recorrido de zona</h2>
      <div class="rz-campo"><label for="rz-zona">Zona</label><input id="rz-zona" data-rz-zona value="${esc(alta.zona || '')}" placeholder="p. ej. Parking UP5" enterkeyhint="done"></div>
      <div class="rz-campo"><label for="rz-fecha">Fecha</label><input id="rz-fecha" type="date" data-rz-fecha value="${esc(alta.fecha)}"></div>
      <p class="rz-pista">La obra es la de arriba; quién lo hace, tú. Luego añades cada punto con su foto.</p>
      <div class="rz-fila"><button type="button" class="boton secundario" data-rz="cancelar">Cancelar</button></div>
      <div class="rz-pie"><button type="button" class="boton" data-rz="abrirNuevo" ${alta.guardando ? 'disabled' : ''}>${alta.guardando ? 'Abriendo…' : 'Empezar el recorrido'}</button></div>
    </div>`;
  }
  async function crearRecorrido() {
    alta.zona = ($app.querySelector('[data-rz-zona]') || {}).value || '';
    alta.fecha = ($app.querySelector('[data-rz-fecha]') || {}).value || hoy();
    if (!alta.zona.trim()) { aviso('Pon la zona.'); return; }
    alta.guardando = true; pintarAlta();
    const r = await CX().postJson('api/recorrido', { id: alta.id, obraId: alta.obraId, zona: alta.zona, fecha: alta.fecha }).catch((e) => ({ ok: false, error: e.message }));
    if (!r || r.ok === false) { alta.guardando = false; aviso((r && r.error) || 'No se ha podido abrir.'); pintarAlta(); return; }
    alta = null; datos = null;
    await abrir(r.id);
  }

  /* ─────────────────────────── La ficha: los puntos, plegados */

  async function abrir(id, abierto = null) {
    try { ficha = await CX().pedir(`api/recorrido?id=${encodeURIComponent(id)}`); } catch (e) { aviso(e.message); ficha = null; return; }
    if (!ficha || ficha.ok === false) { aviso((ficha && ficha.error) || 'No se encuentra.'); ficha = null; return; }
    ficha.abierto = abierto;
    pintarFicha();
  }

  function pintarFicha() {
    const f = ficha; const r = f.recorrido; const c = f.cuentas;
    const ed = f.puedeEditar;
    const puntos = f.puntos.map((p) => {
      const lib = p.estado === 'liberado';
      const fotos = (p.fotos || []).map((_x, i) => `<img data-src="${fotoUrl(r.id, p.id, i)}" alt="Foto del punto ${p.n}">`).join('');
      return `<details class="rz-punto" data-rz-p="${esc(p.id)}" ${f.abierto === p.id ? 'open' : ''}>
        <summary><span class="rz-n ${lib ? '' : 'pend'}">${p.n}</span>${(p.fotos || []).length ? `<img class="rz-mini" data-src="${fotoUrl(r.id, p.id, 0)}" alt="">` : '<span class="rz-mini"></span>'}
          <span><span class="rz-txt">${esc(p.texto)}</span><span class="rz-sub">${esc(p.industrial || 'Sin industrial')}</span></span>
          <span class="rz-est ${lib ? 'rz-lib' : 'rz-pend'}">${lib ? 'Liberado' : 'Pendiente'}</span></summary>
        <div class="rz-fotos">${fotos}${ed && (p.fotos || []).length < 4 ? `<button type="button" class="rz-otra" data-rz="fotoPunto" data-p="${esc(p.id)}">+ Foto</button>` : ''}</div>
        ${ed ? `<div class="rz-campo"><label>Qué hay que liberar</label><textarea rows="2" data-rz-c="texto">${esc(p.texto)}</textarea></div>
          <div class="rz-campo"><label>Lo libera</label><input data-rz-c="industrial" value="${esc(p.industrial || '')}" list="rz-industriales"></div>
          <div class="rz-campo"><label>Dónde</label><input data-rz-c="ubicacion" value="${esc(p.ubicacion || '')}" placeholder="Sala, eje o tramo"></div>
          <div class="rz-campo"><label>Equipo (TAG, para situarlo en el plano)</label><input data-rz-c="tag" value="${esc(p.tag || '')}" autocapitalize="characters"></div>
          <div class="rz-fila"><button type="button" class="boton" data-rz="guardarPunto" data-p="${esc(p.id)}">Guardar</button>
            <button type="button" class="boton secundario" data-rz="estado" data-p="${esc(p.id)}" data-e="${lib ? 'pendiente' : 'liberado'}">${lib ? 'Volver a pendiente' : 'Dar por liberado'}</button>
            <button type="button" class="boton secundario" data-rz="subir" data-p="${esc(p.id)}" ${p.n === 1 ? 'disabled' : ''}>↑</button>
            <button type="button" class="boton secundario" data-rz="quitar" data-p="${esc(p.id)}">Quitar</button></div>`
        : `<p>${esc(p.ubicacion || '')}${p.tag ? ` · ${esc(p.tag)}` : ''}</p>`}
      </details>`;
    }).join('');
    const industriales = [...new Set(f.puntos.map((p) => p.industrial).filter(Boolean))];
    $app.innerHTML = `<div class="rz">
      <div class="rz-fila"><button type="button" class="boton secundario" data-rz="lista">‹ Recorridos</button>
        ${f.puedeExportar ? '<button type="button" class="boton secundario" data-rz="pdf">PDF para mandar</button>' : ''}</div>
      <h2>${esc(r.zona)}</h2>
      <p class="rz-pista">${esc(fechaEs(r.fecha))} · ${esc(r.autor || '')} · ${esc(f.obra.codigo)} · ${esc(r.codigo || '')}</p>
      <div class="rz-kpis"><span><b>${c.puntos}</b>puntos</span><span><b>${c.pendientes}</b>por liberar</span><span><b>${c.liberados}</b>liberados</span></div>
      ${puntos || '<p class="rz-pista">Sin puntos todavía. Pulsa «+ Punto»: foto, qué hay que liberar y quién lo libera.</p>'}
      <datalist id="rz-industriales">${industriales.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      ${ed ? '<div class="rz-pie"><button type="button" class="boton" data-rz="punto">+ Punto</button></div>' : ''}
    </div>`;
    CX().cargarImagenes($app);
  }

  /* ─────────────────────────── Añadir un punto */

  async function empezarPunto(camara) {
    punto = { id: nuevoId(), fotos: [], texto: '', industrial: '', ubicacion: '', tag: '', guardando: false };
    pintarPunto();
    if (camara != null && await anadirFoto(punto.fotos, camara)) pintarPunto();
  }
  function volcarPunto() {
    if (!punto) return;
    for (const el of $app.querySelectorAll('[data-rz-n]')) punto[el.dataset.rzN] = el.value;
  }
  function pintarPunto() {
    const n = punto; const sig = ficha ? ficha.puntos.length + 1 : 1;
    const industriales = ficha ? [...new Set(ficha.puntos.map((p) => p.industrial).filter(Boolean))] : [];
    $app.innerHTML = `<div class="rz">
      <h2>Punto ${sig} · ${esc(ficha ? ficha.recorrido.zona : '')}</h2>
      <div class="rz-fotos">${n.fotos.map((f) => (f.vista ? `<img src="${f.vista}" alt="Foto">` : '<span class="rz-pista">Foto</span>')).join('')}</div>
      ${n.fotos.length < 4 ? '<div class="rz-dos"><button type="button" class="boton secundario" data-rz="camara">📷 Cámara</button><button type="button" class="boton secundario" data-rz="galeria">Galería</button></div>' : ''}
      <div class="rz-campo"><label for="rz-texto">Qué hay que liberar</label>
        <textarea id="rz-texto" rows="3" data-rz-n="texto" placeholder="p. ej. Retirar la bandeja de cables para seguir con el conducto">${esc(n.texto)}</textarea>
        <p class="rz-pista">Para dictar, pulsa el micrófono del teclado.</p></div>
      <div class="rz-campo"><label for="rz-ind">Lo libera</label><input id="rz-ind" data-rz-n="industrial" value="${esc(n.industrial)}" list="rz-ind-l" placeholder="Electricidad, PCI, saneamiento, andamios…">
        <datalist id="rz-ind-l">${industriales.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="rz-campo"><label for="rz-ubi">Dónde</label><input id="rz-ubi" data-rz-n="ubicacion" value="${esc(n.ubicacion)}" placeholder="Sala, eje o tramo"></div>
      <div class="rz-campo"><label for="rz-tag">Equipo (TAG, opcional)</label><input id="rz-tag" data-rz-n="tag" value="${esc(n.tag)}" autocapitalize="characters" placeholder="Para situarlo en el plano del informe"></div>
      <div class="rz-fila"><button type="button" class="boton secundario" data-rz="cancelarPunto">Cancelar</button></div>
      <div class="rz-pie"><button type="button" class="boton" data-rz="guardarNuevo" ${n.guardando ? 'disabled' : ''}>${n.guardando ? 'Guardando…' : 'Guardar el punto'}</button></div>
    </div>`;
  }
  async function guardarNuevo() {
    volcarPunto();
    const n = punto;
    if (!n || n.guardando) return;
    if (!String(n.texto || '').trim()) { aviso('Escribe qué hay que liberar.'); return; }
    n.guardando = true; pintarPunto();
    try {
      const fotos = await idsDe(n.fotos);
      const r = await CX().postJson('api/recorrido/punto', { recorridoId: ficha.recorrido.id, id: n.id, texto: n.texto, industrial: n.industrial, ubicacion: n.ubicacion, tag: n.tag, fotos });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar.');
      punto = null;
      aviso(`Punto ${r.n || ''} guardado.`, 'bien');
      await abrir(ficha.recorrido.id);
    } catch (e) { n.guardando = false; aviso(e.message); pintarPunto(); }
  }

  async function enviar(ruta, cuerpo, ok, abierto) {
    const r = await CX().postJson(ruta, { recorridoId: ficha.recorrido.id, ...cuerpo }).catch((e) => ({ ok: false, error: e.message }));
    if (!r || r.ok === false) { aviso((r && r.error) || 'No se ha podido guardar.'); return; }
    if (ok) aviso(ok, 'bien');
    await abrir(ficha.recorrido.id, abierto);
  }

  /* ─────────────────────────── Eventos */

  $app.addEventListener('click', async (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const fila = t.closest('[data-rz-abrir]');
    if (fila) { await abrir(fila.dataset.rzAbrir); return; }
    const b = t.closest('[data-rz]');
    if (!b) return;
    const acc = b.dataset.rz; const pid = b.dataset.p;
    if (acc === 'nuevo') {
      const obraId = CX().obraId();
      if (!obraId) { aviso('Elige la obra arriba.'); return; }
      alta = { id: nuevoId(), obraId, zona: '', fecha: hoy() }; pintarAlta();
    } else if (acc === 'cancelar') { alta = null; await lista(); }
    else if (acc === 'abrirNuevo') await crearRecorrido();
    else if (acc === 'antes' || acc === 'despues') { pagina = Math.max(1, pagina + (acc === 'antes' ? -1 : 1)); datos = null; await lista(); }
    else if (acc === 'lista') { ficha = null; datos = null; await lista(); }
    else if (acc === 'punto') await empezarPunto(true);
    else if (acc === 'camara' || acc === 'galeria') { volcarPunto(); if (await anadirFoto(punto.fotos, acc === 'camara')) pintarPunto(); }
    else if (acc === 'cancelarPunto') { punto = null; pintarFicha(); }
    else if (acc === 'guardarNuevo') await guardarNuevo();
    else if (acc === 'pdf') await CX().compartirPdf(`api/recorrido/pdf?id=${encodeURIComponent(ficha.recorrido.id)}`, `Recorrido ${ficha.recorrido.codigo || ''} ${ficha.recorrido.zona || ''}.pdf`, b);
    else if (acc === 'guardarPunto') {
      const caja = b.closest('[data-rz-p]'); const c = {};
      for (const el of caja.querySelectorAll('[data-rz-c]')) c[el.dataset.rzC] = el.value;
      await enviar('api/recorrido/punto/editar', { puntoId: pid, ...c }, 'Guardado.', pid);
    } else if (acc === 'estado') await enviar('api/recorrido/punto/editar', { puntoId: pid, estado: b.dataset.e }, b.dataset.e === 'liberado' ? 'Punto liberado.' : 'Vuelve a pendiente.', pid);
    else if (acc === 'subir') await enviar('api/recorrido/punto/mover', { puntoId: pid, dir: -1 }, null, pid);
    else if (acc === 'quitar') { if (window.confirm('¿Quitar este punto del recorrido?')) await enviar('api/recorrido/punto/quitar', { puntoId: pid }, 'Punto quitado.'); }
    else if (acc === 'fotoPunto') {
      const fotos = [];
      if (!(await anadirFoto(fotos, false))) return;
      await enviar('api/recorrido/punto/foto', { puntoId: pid, fotos: await idsDe(fotos) }, 'Foto añadida.', pid);
    }
  });

  window.addEventListener('hashchange', () => { if (activa()) lista(); else volcarPunto(); });
  window.addEventListener('movil:obra', () => { if (activa() && !alta && !punto) { ficha = null; datos = null; pagina = 1; lista(); } });
  /* El «+» › «Recorrido de zona» abre el alta. */
  window.RECORRIDOS_MOVIL = { nuevo: () => { const obraId = CX().obraId(); if (obraId) { alta = { id: nuevoId(), obraId, zona: '', fecha: hoy() }; pintarAlta(); } } };
  if (activa()) lista();
})();
