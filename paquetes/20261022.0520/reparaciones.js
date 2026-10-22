'use strict';
/*
 * REPARACIONES DE EQUIPOS EN EL MÓVIL (#reparaciones, dentro de Incidencias).
 *
 * 16-oct-2026, JC: «tiene que estar en la app de móvil para que el jefe de
 * obra la pueda poner y el encargado la pueda hacer y poner los datos que
 * necesita».
 *
 *   1. LA LISTA de la obra, por planta: pendientes, terminadas (esperan al
 *      jefe de obra) y cerradas. El encargado ve primero las suyas.
 *   2. NUEVA: el equipo (por su TAG), qué le pasa, prioridad, a quién se le
 *      encarga y para cuándo. Lo hace el jefe de obra.
 *   3. LA FICHA: el encargo, las horas por técnico, las fotos y lo que se ha
 *      ido haciendo. Desde aquí el encargado apunta cada VISITA: los técnicos
 *      con sus horas, qué se hizo y cómo quedó (terminada, hay que volver o
 *      no se pudo hacer). El jefe de obra la cierra o la devuelve.
 *
 * El dinero (tarifas, coste y lo que se factura) no llega al teléfono: es del
 * ordenador (Commissioning › Reparaciones).
 */
(function reparaciones() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, fechaEs } = C;
  const activa = () => C.activa('reparaciones');
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  let datos = null;
  let filtro = 'abiertas';
  let porRevisar = false;
  let soloMias = null;
  /* Lo tocado en la ficha que aún no se ha guardado (botón «Guardar»). */
  let cambios = null;
  let texto = '';
  let form = null;
  let visita = null;
  let abierta = null;

  const PRIORIDAD = { alta: 'mal', media: 'aviso', baja: 'neutra' };
  const NOMBRE_PRIORIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const TONO_ESTADO = { abierta: 'aviso', enCurso: 'aviso', terminada: 'bien', cerrada: 'neutra' };
  const chipEstado = (r) => `<span class="chip ${TONO_ESTADO[r.estado] || 'neutra'}">${esc(r.estadoNombre)}</span>`;
  const chipPrioridad = (p) => `<span class="chip ${PRIORIDAD[p] || 'neutra'}">${esc(NOMBRE_PRIORIDAD[p] || p)}</span>`;
  const horasTxt = (h) => `${C.cifra(h || 0, Number.isInteger(Number(h)) ? 0 : 1)} h`;
  const RESULTADOS = [['terminada', 'Terminada'], ['volver', 'Hay que volver'], ['noRealizada', 'No realizada']];

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null; visita = null; abierta = null;
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await C.pedir(`api/reparaciones?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-rp="lista">Reintentar</button></div>`;
      return;
    }
    if (soloMias === null) soloMias = Boolean(datos.mias);
    if (!activa() || form || abierta || visita) return;
    /* Desde «Lo que me toca» del Inicio: se abre directamente esa reparación. */
    let ir = null;
    try { ir = sessionStorage.getItem('cx.abrir'); sessionStorage.removeItem('cx.abrir'); } catch { /* nada */ }
    pintarLista();
    if (ir) abrir(ir);
  }

  /* 16-oct: Abiertas | Cerradas, como en el escritorio (020e0c6). «Terminada»
     sí es un paso real (espera a que el jefe de obra la revise y la cierre):
     cuenta como abierta y se ve con el filtro «Por revisar», igual que allí. */
  const enFiltro = (f) => (filtro === 'cerradas' ? !f.activa : f.activa && (!porRevisar || f.estado === 'terminada'));

  /* Se busca sin puntos, espacios ni tildes: «s2ste0021» encuentra S2.STE.0021. */
  const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const pajar = (f) => plano([f.codigo, f.titulo, f.encargado, f.operario, f.zona, f.planta, ...(f.equipo ? [f.equipo.tag, f.equipo.sala, f.equipo.codSala, f.equipo.zona] : [])].join(' '));
  /* La sala del equipo: el código de sala (S2.STE.0053) y el del plano (10.STE.082). */
  const salaDe = (e) => (e ? [e.sala, e.codSala].filter(Boolean).join(' · ') : '');

  function pintarLista() {
    const filas = (datos.filas || []).filter((f) => !soloMias || f.encargadoId === datos.yo);
    const cuenta = (id) => { const antes = [filtro, porRevisar]; filtro = id; porRevisar = false; const n = filas.filter(enFiltro).length; [filtro, porRevisar] = antes; return n; };
    const nRevisar = filas.filter((f) => f.estado === 'terminada').length;
    if (!nRevisar) porRevisar = false;
    const q = plano(texto);
    const vistas = filas.filter(enFiltro).filter((f) => !q || pajar(f).includes(q));
    const planta = (f) => f.planta || (f.equipo && f.equipo.planta) || 'Sin planta';
    const conMias = datos.mias || datos.filas.some((f) => f.encargadoId === datos.yo);
    $app.innerHTML = `
      ${datos.puede && datos.puede.crear ? '<button class="boton grande" data-rp="nueva">＋ Nueva reparación</button>' : ''}
      <div class="segmentado" role="tablist">
        ${[['abiertas', 'Abiertas'], ['cerradas', 'Cerradas']].map(([id, nombre]) => `<button role="tab" data-rp-filtro="${id}" class="${filtro === id ? 'activa' : ''}" aria-selected="${filtro === id}">${esc(nombre)} <small>${cuenta(id)}</small></button>`).join('')}
      </div>
      ${filtro === 'abiertas' && (nRevisar || conMias) ? `<div class="filtros-rp">
        ${conMias ? `<button type="button" class="chip-filtro ${soloMias ? 'activa' : ''}" data-rp="mias" aria-pressed="${Boolean(soloMias)}">Solo las mías</button>` : ''}
        ${nRevisar ? `<button type="button" class="chip-filtro ${porRevisar ? 'activa' : ''}" data-rp="revisar" aria-pressed="${porRevisar}">Por revisar <small>${nRevisar}</small></button>` : ''}
      </div>` : ''}
      <input type="search" class="buscar" placeholder="Buscar TAG, sala, código o encargado" value="${esc(texto)}" data-rp-buscar>
      ${vistas.length ? C.listaAgrupada(`rp-${filtro}`, vistas, {
        grupo: planta, buscando: !!q, repintar: pintarLista,
        orden: [...new Set(vistas.map(planta))].sort((a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true })),
        fila: (f) => `
        <li><button class="fila-ios" data-rp="ficha" data-id="${esc(f.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(f.equipo ? f.equipo.tag : f.codigo)}</strong><span>${chipPrioridad(f.prioridad)} ${chipEstado(f)}</span></div>
          ${salaDe(f.equipo) ? `<div class="sala-rp">Sala <strong>${esc(salaDe(f.equipo))}</strong></div>` : ''}
          <div class="texto-2">${esc(f.titulo)}</div>
          <div class="sub">${esc(f.codigo)}${f.zona ? ` · ${esc(f.zona)}` : ''} · ${esc(f.operario || f.encargado || 'Sin encargado')}${f.horas ? ` · ${horasTxt(f.horas)}` : ''}${f.visitas ? ` · ${f.visitas} visita${f.visitas === 1 ? '' : 's'}` : ''}${f.vencida ? ' · <strong class="mal">vencida</strong>' : f.fechaLimite ? ` · para el ${fechaEs(f.fechaLimite)}` : ''}</div>
        </button></li>` })
    : `<p class="vacio">${q ? 'Ninguna reparación con ese texto.' : filtro === 'cerradas' ? 'No hay reparaciones cerradas.' : porRevisar ? 'Nada esperando a que el jefe de obra lo revise.' : 'No hay reparaciones abiertas.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. Nueva */

  function nueva() {
    form = { tag: '', planta: '', zona: '', operario: '', descripcion: '', prioridad: 'media', encargadoId: '', fechaLimite: '', fotos: [] };
    pintarForm();
  }

  function pintarForm() {
    const f = form;
    $app.innerHTML = `
      <button class="volver" data-rp="lista">‹ Reparaciones</button>
      <h2>Nueva reparación</h2>
      <p class="nota">${esc(C.obra() ? `${C.obra().codigo} · ${C.obra().nombre}` : '')}</p>
      <label>Equipo (TAG)<input data-rp-campo="tag" list="rp-equipos" value="${esc(f.tag)}" autocomplete="off" placeholder="Escribe el TAG del equipo"></label>
      <datalist id="rp-equipos">${(datos.equipos || []).map((e) => `<option value="${esc(e.tag)}">${esc(e.planta)}</option>`).join('')}</datalist>
      <div class="campos">
        <label>Planta<input data-rp-campo="planta" list="rp-plantas" value="${esc(f.planta)}" autocomplete="off" placeholder="N00, N10…"></label>
        <label>Zona<input data-rp-campo="zona" list="rp-zonas" value="${esc(f.zona)}" autocomplete="off" placeholder="Tribuna, Gol Norte…"></label>
      </div>
      <datalist id="rp-plantas">${(datos.plantas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="rp-zonas">${(datos.zonas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      <label>Operario<select data-rp-campo="operario"><option value="">—</option>${(datos.asignables || []).map((v) => `<option value="${esc(v)}" ${v === f.operario ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Qué le pasa<textarea rows="4" data-rp-campo="descripcion" placeholder="Qué falla y qué hay que hacer">${esc(f.descripcion)}</textarea></label>
      <label>Prioridad</label>
      <div class="segmentado">${['alta', 'media', 'baja'].map((p) => `<button data-rp-prioridad="${p}" class="${f.prioridad === p ? 'activa' : ''}">${NOMBRE_PRIORIDAD[p]}</button>`).join('')}</div>
      <div class="campos">
        <label>Encargado<select data-rp-campo="encargadoId"><option value="">—</option>${(datos.encargados || []).map((p) => `<option value="${esc(p.id)}" ${p.id === f.encargadoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        <label>Para el<input type="date" data-rp-campo="fechaLimite" value="${esc(f.fechaLimite)}" min="${hoy()}"></label>
      </div>
      <label>Fotos del antes${f.fotos.length ? ` · ${f.fotos.length}` : ''}</label>
      ${f.fotos.length ? `<div class="fotos">${f.fotos.map((a, i) => `<img src="${URL.createObjectURL(a)}" alt="" data-rp="quitar-foto" data-i="${i}">`).join('')}</div><p class="nota">Toca una foto para quitarla.</p>` : ''}
      <div class="fila-botones">
        <button class="boton secundario" data-rp="alta-camara"><i class="ic ic-camara"></i>Hacer foto</button>
        <button class="boton secundario" data-rp="alta-galeria">De la galería</button>
      </div>
      <button class="boton grande" data-rp="enviar">Dar de alta</button>`;
  }

  /* Las fotos del alta se guardan aquí y se suben al darla de alta. */
  async function fotoAlta(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !form) return;
    form.fotos.push(archivo);
    pintarForm();
  }

  async function enviar(boton) {
    const tag = form.tag.trim().toLowerCase();
    const eq = (datos.equipos || []).find((e) => String(e.tag).trim().toLowerCase() === tag);
    if (!eq) { C.aviso(tag ? 'Ese TAG no está en la tabla de equipos de la obra.' : 'Elige el equipo.', 'aviso'); return; }
    if (!form.descripcion.trim()) { C.aviso('Escribe qué le pasa.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const primera = form.descripcion.trim().split('\n')[0].slice(0, 120);
      const r = await C.postJson('api/reparacion', {
        obraId: C.obraId(), equipoId: eq.id, titulo: `${eq.tag} · ${primera}`, descripcion: form.descripcion,
        prioridad: form.prioridad, encargadoId: form.encargadoId || undefined,
        operario: form.operario || undefined, zona: form.zona || undefined, planta: form.planta || undefined, fechaLimite: form.fechaLimite || null,
      });
      if (!r.ok) throw new Error(r.error);
      let sinFoto = 0;
      for (const archivo of form.fotos) {
        try {
          const f = await C.postJson('api/reparacion/foto', { id: r.id, fotos: [await C.subirFoto(archivo)], momento: 'antes' });
          if (!f.ok) sinFoto++;
        } catch { sinFoto++; }
      }
      form = null;
      C.aviso(`${r.codigo || 'Reparación'} dada de alta${sinFoto ? `, pero ${sinFoto} foto(s) no se subieron: añádelas desde la ficha` : ''}.`, sinFoto ? 'aviso' : 'bien');
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ 3. La ficha */

  /*
   * 16-oct-2026, JC: «botón de guardar para guardar la foto y tal y que luego
   * salga en el PDF». En la ficha nada se manda al tocarlo: las fotos del
   * antes y del después, la nota, la visita (técnicos y horas) y el estado se
   * quedan en `cambios` («Cambios sin guardar») hasta pulsar «Guardar», que lo
   * guarda todo de una vez. Guardado queda en el teléfono al momento y sube a
   * la nube con sus fotos en cuanto hay red (shared/sync/archivos.js); si no
   * la hay, se reintenta solo.
   */
  const nuevosCambios = () => ({ fotos: [], nota: '', estado: null, motivo: '', visita: null });
  const hayCambios = () => Boolean(cambios && (cambios.fotos.length || cambios.nota.trim() || cambios.estado || cambios.visita));
  let guardadoA = 0;

  async function abrir(id, { conservar = false } = {}) {
    visita = null;
    if (!conservar) cambios = nuevosCambios();
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      pintarFicha();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); lista(); }
  }

  const NOMBRE_PASO = (p) => (p.id === 'cerrada' ? 'Cerrarla' : p.nombre === 'TERMINADA' ? 'Terminada' : p.nombre === 'EN CURSO' ? 'Empezada' : p.nombre);

  function barraGuardar() {
    const hay = hayCambios();
    const n = cambios ? cambios.fotos.length : 0;
    const texto = hay ? `Cambios sin guardar${n ? ` · ${n} foto${n === 1 ? '' : 's'}` : ''}` : (Date.now() - guardadoA < 6000 ? 'Guardado' : 'Todo guardado');
    return `<span class="estado-guardar ${hay ? 'pendiente' : 'al-dia'}">${esc(texto)}</span>
      <button type="button" class="boton" data-rp="guardar" ${hay ? '' : 'disabled'}>Guardar</button>`;
  }
  const refrescarBarra = () => { const b = $app.querySelector('.barra-guardar'); if (b) b.innerHTML = barraGuardar(); };

  function pintarFicha() {
    const { reparacion: r, porOperario, comentarios, pasos, puede } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    const v = cambios.visita;
    const horasV = v ? v.tecnicos.reduce((s, t) => s + (Number(String(t.horas).replace(',', '.')) || 0), 0) : 0;
    $app.innerHTML = `
      <button class="volver" data-rp="lista">‹ Reparaciones</button>
      <section class="cabeza-ficha">
        <div class="fila-principal"><h2 class="cifra">${esc(r.equipo ? r.equipo.tag : r.codigo)}</h2><span>${chipPrioridad(r.prioridad)} ${chipEstado(r)}</span></div>
        <p class="texto-ficha">${esc(r.titulo)}</p>
      </section>
      ${r.avisos.length ? `<p class="nota aviso">${esc(r.avisos.join(' · '))}</p>` : ''}
      <section class="grupo">
        ${dato('Código', r.codigo)}${dato('Planta', r.planta || (r.equipo && r.equipo.planta))}${dato('Zona', r.zona || (r.equipo && r.equipo.zona))}${dato('Operario', r.operario)}
        ${dato('Sala', r.equipo && r.equipo.sala)}${dato('Código de sala', r.equipo && r.equipo.codSala)}
        ${dato('Encargado', r.encargado || 'Sin encargado')}
        ${dato('Abierta', fechaEs(r.fechaApertura))}${dato('Para el', fechaEs(r.fechaLimite))}
        ${dato('Horas', horasTxt(r.horas))}${dato('Visitas', String(r.visitas || 0))}
      </section>
      ${puede.datos ? `<h2>Dónde y quién</h2><div class="campos">
        <label>Planta<input data-rp-dato="planta" list="rp-plantas" value="${esc(r.planta || '')}" placeholder="${esc((r.equipo && r.equipo.planta) || 'N00…')}"></label>
        <label>Zona<input data-rp-dato="zona" list="rp-zonas" value="${esc(r.zona || '')}" placeholder="${esc((r.equipo && r.equipo.zona) || 'Tribuna…')}"></label></div>
        <datalist id="rp-plantas">${(abierta.plantas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
        <datalist id="rp-zonas">${(abierta.zonas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
        <label>Operario<select data-rp-dato="operario"><option value="">—</option>${[...new Set([...(abierta.asignables || []), r.operario].filter(Boolean))].map((v) => `<option value="${esc(v)}" ${v === r.operario ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : ''}
      ${r.descripcion ? `<h2>Qué le pasa</h2><p class="texto-ficha">${esc(r.descripcion)}</p>` : ''}
      ${r.instrucciones ? `<h2>Instrucciones</h2><p class="texto-ficha">${esc(r.instrucciones)}</p>` : ''}
      ${[['antes', 'Fotos del antes'], ['despues', 'Fotos del después']].map(([m, titulo]) => {
        /* Las de antes de existir el campo cuentan como del antes. */
        const suyas = r.fotos.filter((f) => (f.momento || 'antes') === m);
        const nuevas = cambios.fotos.map((f, i) => ({ ...f, i })).filter((f) => f.momento === m);
        if (!suyas.length && !nuevas.length && !puede.foto) return '';
        return `<h2>${titulo}${suyas.length + nuevas.length ? ` · ${suyas.length + nuevas.length}` : ''}</h2>
          ${suyas.length || nuevas.length ? `<div class="fotos">${suyas.map((f) => `<img data-src="api/reparacion/foto?id=${encodeURIComponent(r.id)}&i=${f.indice}" alt="">`).join('')}${nuevas.map((f) => `<button type="button" class="foto-nueva" data-rp="quitar-nueva" data-i="${f.i}" aria-label="Quitar esta foto sin guardar"><img src="${f.url}" alt=""><span>Sin guardar</span></button>`).join('')}</div>` : ''}
          ${nuevas.length ? '<p class="nota">Toca una foto sin guardar para quitarla.</p>' : ''}
          ${puede.foto ? `<div class="fila-botones">
            <button class="boton secundario" data-rp="camara" data-momento="${m}"><i class="ic ic-camara"></i>Hacer foto</button>
            <button class="boton secundario" data-rp="galeria" data-momento="${m}">De la galería</button>
          </div>` : ''}`;
      }).join('')}
      ${puede.visita ? `<h2>Visita</h2>${v ? `<section class="grupo visita-pendiente">
          <div class="fila-dato"><span>Visita del ${esc(fechaEs(v.fecha))} · sin guardar</span><strong>${esc(RESULTADOS.find(([id]) => id === v.resultado)[1])}</strong></div>
          <div class="fila-dato"><span>${v.tecnicos.filter((t) => t.operario).map((t) => esc(t.operario)).join(', ') || 'Sin técnicos'}</span><strong>${horasTxt(horasV)}</strong></div>
          ${v.hecho ? `<p class="texto-ficha">${esc(v.hecho)}</p>` : ''}
          <div class="fila-botones"><button class="boton secundario" data-rp="editar-visita">Cambiar</button><button class="boton secundario" data-rp="quitar-visita">Quitar</button></div>
        </section>` : '<button class="boton secundario" data-rp="visita"><i class="ic ic-check"></i>Apuntar visita: técnicos y horas</button>'}` : ''}
      ${pasos.length ? `<h2>Estado</h2><div class="segmentado pasos-rp">${pasos.map((p) => `<button type="button" data-rp="paso" data-estado="${esc(p.id)}" class="${cambios.estado === p.id ? 'activa' : ''}" aria-pressed="${cambios.estado === p.id}">${esc(NOMBRE_PASO(p))}</button>`).join('')}</div>
        ${cambios.estado ? `<p class="nota">Pasará a «${esc(NOMBRE_PASO(pasos.find((p) => p.id === cambios.estado)))}» al guardar${cambios.motivo ? `: ${esc(cambios.motivo)}` : ''}.</p>` : ''}` : ''}
      <h2>Lo que se ha hecho</h2>
      ${puede.nota ? `<textarea rows="3" data-rp-nota placeholder="Escribe una nota; se guarda con el botón Guardar">${esc(cambios.nota)}</textarea>` : ''}
      ${comentarios.length ? `<ul class="historial">${[...comentarios].reverse().map((c) => `<li><span class="sub">${fechaEs(c.cuando)}${c.persona ? ` · ${esc(c.persona)}` : ''}</span> ${c.tipo === 'estado' ? `<em>${esc(c.texto)}</em>` : esc(c.texto)}</li>`).join('')}</ul>` : '<p class="vacio">Todavía nada.</p>'}
      <div class="barra-guardar" role="status">${barraGuardar()}</div>`;
    C.cargarImagenes($app);
  }

  /*
   * La foto, hecha en el momento o de la galería, se reduce a 1600 px en JPEG
   * (una del iPhone pasa de 3-5 MB a unos 300 KB: sube antes por 4G y entra en
   * el PDF). Si el teléfono no sabe reducirla, va tal cual.
   */
  async function reducir(archivo) {
    try {
      const url = URL.createObjectURL(archivo);
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
      const lado = Math.max(img.naturalWidth, img.naturalHeight);
      const k = Math.min(1, 1600 / lado);
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.naturalWidth * k); lienzo.height = Math.round(img.naturalHeight * k);
      lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
      if (!blob || (blob.size >= archivo.size && /jpe?g/i.test(archivo.type))) return archivo;
      return new File([blob], `${String(archivo.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } catch { return archivo; }
  }

  async function foto(camara = true, momento = 'antes') {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !abierta || !cambios) return;
    cambios.fotos.push({ archivo, momento, url: URL.createObjectURL(archivo) });
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
  }

  function elegirPaso(estado) {
    if (cambios.estado === estado) { cambios.estado = null; cambios.motivo = ''; }
    else {
      let motivo = '';
      if (estado === 'enCurso' && abierta.reparacion.estado !== 'abierta') {
        motivo = (window.prompt('¿Por qué se devuelve al encargado?') || '').trim();
        if (!motivo) return;
      }
      cambios.estado = estado; cambios.motivo = motivo;
    }
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
  }

  /* GUARDAR: fotos, visita, nota y estado, por ese orden. Lo que se guarda sale
     de `cambios`; si algo falla, lo demás se queda para el siguiente intento. */
  async function guardar(boton) {
    if (!hayCambios()) return;
    boton.disabled = true;
    const id = abierta.reparacion.id;
    const estado = $app.querySelector('.estado-guardar');
    if (estado) estado.textContent = 'Guardando…';
    try {
      while (cambios.fotos.length) {
        const f = cambios.fotos[0];
        const r = await C.postJson('api/reparacion/foto', { id, fotos: [await C.subirFoto(await reducir(f.archivo))], momento: f.momento });
        if (!r.ok) throw new Error(r.error);
        URL.revokeObjectURL(f.url);
        cambios.fotos.shift();
      }
      if (cambios.visita) {
        const r = await C.postJson('api/reparacion/visita', { id, ...cambios.visita });
        if (!r.ok) throw new Error(r.error);
        cambios.visita = null;
      }
      if (cambios.nota.trim()) {
        const r = await C.postJson('api/reparacion/comentar', { id, texto: cambios.nota });
        if (!r.ok) throw new Error(r.error);
        cambios.nota = '';
      }
      if (cambios.estado) {
        /* La visita «terminada» ya la ha pasado a terminada: no se repite. */
        const ahora = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
        if (!ahora.ok || ahora.reparacion.estado !== cambios.estado) {
          const r = await C.postJson('api/reparacion/estado', { id, estado: cambios.estado, comentario: cambios.motivo });
          if (!r.ok) throw new Error(r.error);
        }
        cambios.estado = null; cambios.motivo = '';
      }
      guardadoA = Date.now();
      C.aviso('Guardado. Las fotos suben a la nube en cuanto haya red.', 'bien');
      await abrir(id, { conservar: true });
      setTimeout(() => { if (abierta && abierta.reparacion.id === id) refrescarBarra(); }, 6100);
    } catch (e) {
      C.aviso(`No se ha guardado todo: ${e.message}`);
      await abrir(id, { conservar: true });
    }
  }

  /* ═══════════════════════════════════ 4. La visita (se guarda con la ficha) */

  function nuevaVisita() {
    if (cambios.visita) { visita = JSON.parse(JSON.stringify(cambios.visita)); pintarVisita(); return; }
    const ultimo = abierta.horas.length ? abierta.horas[abierta.horas.length - 1] : null;
    visita = {
      fecha: hoy(), hecho: '', resultado: '',
      tecnicos: [{ operario: ultimo ? ultimo.operario : '', empresa: ultimo ? ultimo.empresa : '', categoria: ultimo ? ultimo.categoria : 'operario', horas: '' }],
    };
    pintarVisita();
  }

  function pintarVisita() {
    const v = visita;
    const r = abierta.reparacion;
    $app.innerHTML = `
      <button class="volver" data-rp="volver-ficha">‹ ${esc(r.equipo ? r.equipo.tag : r.codigo)}</button>
      <h2>Visita</h2>
      <label>Día<input type="date" data-rp-v="fecha" value="${esc(v.fecha)}" max="${hoy()}"></label>
      <h2>Técnicos</h2>
      ${v.tecnicos.map((t, i) => `
        <section class="grupo">
          <label>Nombre<input list="rp-operarios" data-rp-t="${i}" data-k="operario" value="${esc(t.operario)}" autocomplete="off"></label>
          <label>Empresa<input list="rp-empresas" data-rp-t="${i}" data-k="empresa" value="${esc(t.empresa)}" autocomplete="off"></label>
          <div class="campos">
            <label>Categoría<select data-rp-t="${i}" data-k="categoria">${[['operario', 'Operario'], ['oficial', 'Oficial']].map(([id, n]) => `<option value="${id}" ${t.categoria === id ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label>Horas<input type="number" inputmode="decimal" step="0.5" min="0" max="24" data-rp-t="${i}" data-k="horas" value="${esc(t.horas)}"></label>
          </div>
          ${v.tecnicos.length > 1 ? `<button class="boton secundario" data-rp="quitar-tecnico" data-i="${i}">Quitar</button>` : ''}
        </section>`).join('')}
      <datalist id="rp-operarios">${(abierta.operarios || []).map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
      <datalist id="rp-empresas">${(abierta.empresas || []).map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
      <button class="boton secundario" data-rp="otro-tecnico">＋ Otro técnico</button>
      <label>Qué se ha hecho<textarea rows="3" data-rp-v="hecho" placeholder="Lo que se ha revisado o cambiado">${esc(v.hecho)}</textarea></label>
      <label>Cómo ha quedado</label>
      <div class="segmentado">${RESULTADOS.map(([id, n]) => `<button data-rp-resultado="${id}" class="${v.resultado === id ? 'activa' : ''}">${n}</button>`).join('')}</div>
      <button class="boton grande" data-rp="anotar-visita">Añadir a la ficha</button>
      <p class="nota">La visita se guarda con el botón «Guardar» de la ficha.</p>`;
  }

  function anotarVisita() {
    if (!visita.resultado) { C.aviso('Di cómo ha quedado.', 'aviso'); return; }
    const conHoras = visita.tecnicos.filter((t) => String(t.operario).trim() || String(t.horas).trim());
    if (visita.resultado !== 'noRealizada' && !conHoras.length) { C.aviso('Apunta al menos un técnico con sus horas.', 'aviso'); return; }
    cambios.visita = visita;
    visita = null;
    pintarFicha();
    const b = $app.querySelector('.visita-pendiente');
    if (b) b.scrollIntoView({ block: 'center' });
  }

  /* ═══════════════════════════════════ Eventos */

  const salirSinGuardar = () => !hayCambios() || window.confirm('Hay cambios sin guardar en esta reparación. ¿Salir sin guardarlos?');

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const f = ev.target.closest('[data-rp-filtro]');
    if (f) { filtro = f.dataset.rpFiltro; pintarLista(); return; }
    const p = ev.target.closest('[data-rp-prioridad]');
    if (p && form) { form.prioridad = p.dataset.rpPrioridad; pintarForm(); return; }
    const res = ev.target.closest('[data-rp-resultado]');
    if (res && visita) { visita.resultado = res.dataset.rpResultado; pintarVisita(); return; }
    const b = ev.target.closest('[data-rp]');
    if (!b) return;
    const a = b.dataset.rp;
    if (a === 'lista') { if (abierta && !visita && !salirSinGuardar()) return; cambios = null; lista(); }
    else if (a === 'mias') { soloMias = !soloMias; pintarLista(); }
    else if (a === 'revisar') { porRevisar = !porRevisar; pintarLista(); }
    else if (a === 'nueva') nueva();
    else if (a === 'enviar') enviar(b);
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'camara') foto(true, b.dataset.momento);
    else if (a === 'galeria') foto(false, b.dataset.momento);
    else if (a === 'quitar-nueva') { const [x] = cambios.fotos.splice(Number(b.dataset.i), 1); if (x) URL.revokeObjectURL(x.url); const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    else if (a === 'alta-camara') fotoAlta(true);
    else if (a === 'alta-galeria') fotoAlta(false);
    else if (a === 'quitar-foto') { form.fotos.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'paso') elegirPaso(b.dataset.estado);
    else if (a === 'guardar') guardar(b);
    else if (a === 'visita' || a === 'editar-visita') nuevaVisita();
    else if (a === 'quitar-visita') { cambios.visita = null; const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    else if (a === 'volver-ficha') { visita = null; pintarFicha(); }
    else if (a === 'otro-tecnico') { visita.tecnicos.push({ operario: '', empresa: visita.tecnicos[0].empresa, categoria: 'operario', horas: visita.tecnicos[0].horas }); pintarVisita(); }
    else if (a === 'quitar-tecnico') { visita.tecnicos.splice(Number(b.dataset.i), 1); pintarVisita(); }
    else if (a === 'anotar-visita') anotarVisita();
  });
  /* Planta, zona u operario de la ficha: se guarda al elegirlo (no es de lo que espera al «Guardar»). */
  async function guardarDato(campo) {
    try {
      const r = await C.postJson('api/reparacion/datos', { id: abierta.reparacion.id, [campo.dataset.rpDato]: campo.value });
      if (!r.ok) throw new Error(r.error);
      abierta.reparacion[campo.dataset.rpDato] = campo.value.trim();
      C.aviso('Guardado.', 'bien');
    } catch (e) { C.aviso(e.message); }
  }
  const recoger = (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (form && t.dataset.rpCampo) form[t.dataset.rpCampo] = t.value;
    /* Elegido el equipo, se sugieren su planta y su zona (si no se han escrito). */
    if (form && ev.type === 'change' && t.dataset.rpCampo === 'tag') {
      const eq = (datos.equipos || []).find((e) => String(e.tag).trim().toLowerCase() === t.value.trim().toLowerCase());
      if (eq && ((!form.planta && eq.planta) || (!form.zona && eq.zona))) { form.planta = form.planta || eq.planta || ''; form.zona = form.zona || eq.zona || ''; pintarForm(); }
    }
    if (abierta && ev.type === 'change' && t.dataset.rpDato) guardarDato(t);
    if (visita && t.dataset.rpV) visita[t.dataset.rpV] = t.value;
    if (visita && t.dataset.rpT !== undefined) visita.tecnicos[Number(t.dataset.rpT)][t.dataset.k] = t.value;
    if (cambios && t.hasAttribute('data-rp-nota')) { cambios.nota = t.value; refrescarBarra(); }
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  $app.addEventListener('input', (ev) => {
    if (!activa() || form || abierta || visita || !ev.target.hasAttribute('data-rp-buscar')) return;
    texto = ev.target.value;
    const pos = ev.target.selectionStart;
    pintarLista();
    const i = $app.querySelector('[data-rp-buscar]');
    i.focus(); i.setSelectionRange(pos, pos);
  });
  /* Cerrar la app o recargar con cambios sin guardar: el navegador pregunta. */
  window.addEventListener('beforeunload', (ev) => { if (activa() && hayCambios()) { ev.preventDefault(); ev.returnValue = ''; } });

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
