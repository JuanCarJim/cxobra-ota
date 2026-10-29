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
  /* Lo tocado en la ficha que aún no ha llegado al servidor (se guarda solo). */
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

  /* Desde una cifra del Inicio (28-oct): «pendientes» (sin terminar) o «vencidas», sobre las abiertas de todos. */
  let solo = null;
  const SOLO = { pendientes: ['Solo pendientes', (f) => f.estado !== 'terminada'], vencidas: ['Solo vencidas', (f) => f.vencida] };

  async function lista() {
    form = null; visita = null; abierta = null;
    try {
      const v = sessionStorage.getItem('rp.filtro');
      if (v) {
        sessionStorage.removeItem('rp.filtro');
        filtro = 'abiertas'; soloMias = false; texto = '';
        porRevisar = v === 'revisar'; solo = SOLO[v] ? v : null;
      }
    } catch { /* nada */ }
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
  const textosDe = (f) => ([f.codigo, f.titulo, f.encargado, f.operario, f.zona, f.planta, ...(f.equipo ? [...(f.equipo.unidades || [f.equipo.tag]), f.equipo.sala, f.equipo.codSala, f.equipo.zona] : [])]);
  /* La sala del equipo: el código de sala (S2.STE.0053) y el del plano (10.STE.082). */
  const salaDe = (e) => (e ? [e.sala, e.codSala].filter(Boolean).join(' · ') : '');

  function pintarLista() {
    const filas = (datos.filas || []).filter((f) => !soloMias || f.encargadoId === datos.yo);
    const cuenta = (id) => { const antes = [filtro, porRevisar]; filtro = id; porRevisar = false; const n = filas.filter(enFiltro).length; [filtro, porRevisar] = antes; return n; };
    const nRevisar = filas.filter((f) => f.estado === 'terminada').length;
    if (!nRevisar) porRevisar = false;
    const q = plano(texto);
    const vistas = filas.filter(enFiltro).filter((f) => !solo || filtro !== 'abiertas' || SOLO[solo][1](f)).filter((f) => !q || window.BUSCADOR_MOVIL.coincide(texto, textosDe(f)));
    const planta = (f) => f.planta || (f.equipo && f.equipo.planta) || 'Sin planta';
    const conMias = datos.mias || datos.filas.some((f) => f.encargadoId === datos.yo);
    $app.innerHTML = `
      ${datos.puede && datos.puede.crear ? (AG.leer(claveAlta()) ? '<div class="borrador-pendiente"><p>Tienes una reparación sin terminar (guardada en el móvil).</p><div class="fila-botones"><button class="boton" data-rp="nueva">Seguir con ella</button></div></div>' : '<button class="boton grande" data-rp="nueva">＋ Nueva reparación</button>') : ''}
      <div class="segmentado" role="tablist">
        ${[['abiertas', 'Abiertas'], ['cerradas', 'Cerradas']].map(([id, nombre]) => `<button role="tab" data-rp-filtro="${id}" class="${filtro === id ? 'activa' : ''}" aria-selected="${filtro === id}">${esc(nombre)} <small>${cuenta(id)}</small></button>`).join('')}
      </div>
      ${filtro === 'abiertas' && (nRevisar || conMias || solo) ? `<div class="filtros-rp">
        ${solo ? `<button type="button" class="chip-filtro activa" data-rp="solo" aria-pressed="true">${esc(SOLO[solo][0])} ✕</button>` : ''}
        ${conMias ? `<button type="button" class="chip-filtro ${soloMias ? 'activa' : ''}" data-rp="mias" aria-pressed="${Boolean(soloMias)}">Solo las mías</button>` : ''}
        ${nRevisar ? `<button type="button" class="chip-filtro ${porRevisar ? 'activa' : ''}" data-rp="revisar" aria-pressed="${porRevisar}">Por revisar <small>${nRevisar}</small></button>` : ''}
      </div>` : ''}
      ${window.BUSCADOR_MOVIL.campo({ placeholder: 'Buscar TAG, sala, código o encargado', valor: texto, atributo: 'data-rp-buscar' })}
      ${vistas.length ? C.listaAgrupada(`rp-${filtro}`, vistas, {
        grupo: planta, buscando: !!q, repintar: pintarLista,
        orden: [...new Set(vistas.map(planta))].sort((a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true })),
        fila: (f) => `
        <li><button class="fila-ios" data-rp="ficha" data-id="${esc(f.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(f.equipo ? (f.equipo.unidades || [f.equipo.tag]).join(' + ') : f.codigo)}</strong><span>${chipPrioridad(f.prioridad)} ${chipEstado(f)}</span></div>
          ${salaDe(f.equipo) ? `<div class="sala-rp">Sala <strong>${esc(salaDe(f.equipo))}</strong></div>` : ''}
          <div class="texto-2">${esc(f.titulo)}</div>
          <div class="sub">${esc(f.codigo)}${f.zona ? ` · ${esc(f.zona)}` : ''} · ${esc(f.operario || f.encargado || 'Sin encargado')}${f.horas ? ` · ${horasTxt(f.horas)}` : ''}${f.visitas ? ` · ${f.visitas} visita${f.visitas === 1 ? '' : 's'}` : ''}${f.vencida ? ' · <strong class="mal">vencida</strong>' : f.fechaLimite ? ` · para el ${fechaEs(f.fechaLimite)}` : ''}</div>
        </button></li>` })
    : `<p class="vacio">${q ? 'Ninguna reparación con ese texto.' : filtro === 'cerradas' ? 'No hay reparaciones cerradas.' : porRevisar ? 'Nada esperando a que el jefe de obra lo revise.' : 'No hay reparaciones abiertas.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. Nueva */

  /*
   * AUTOGUARDADO (28-oct-2026, JC: un encargado metía fotos, pulsó atrás y lo
   * perdió todo). El alta a medias y lo tocado en la ficha quedan en el
   * teléfono con cada tecla y cada foto (autoguardado.js). En la ficha, cada
   * FOTO y cada VISITA anotada se guardan solas en el servidor al momento; la
   * nota y el estado, al salir (atrás, gesto, otra pestaña, bloquear) o al
   * terminar de escribir. «Guardado» solo cuando el servidor lo confirma y
   * la ficha releída trae las fotos (como en commissioning, ee2f7fd).
   */
  const AG = window.AUTOGUARDADO;
  const claveAlta = () => `rep.alta.${C.obraId() || ''}`;
  const altaVacia = () => ({ tag: '', planta: '', zona: '', ubicacion: '', operario: '', descripcion: '', prioridad: 'media', encargadoId: '', fechaLimite: '', fotos: [] });
  const altaConContenido = (f) => Boolean(f && (String(f.tag || '').trim() || String(f.descripcion || '').trim() || String(f.zona || '').trim()
    || String(f.planta || '').trim() || f.operario || f.encargadoId || f.fechaLimite || (f.fotos || []).length));
  function persistirAlta() {
    if (!form) return;
    let ok = true;
    if (altaConContenido(form)) ok = AG.guardar(form.clave, { ...form, fotos: AG.fotosParaGuardar(form.fotos) });
    else AG.borrar(form.clave);
    if (activa()) AG.pintarMarca($app, ok ? 'movil' : 'error', ok ? (altaConContenido(form) ? 'Guardado en el móvil · se envía al dar de alta' : 'Se guarda solo mientras escribes') : 'No se ha podido guardar en el móvil');
  }

  /* Desde la ficha de commissioning (29-oct, JC): «Crear incidencia» deja el equipo, su conjunto, la planta y la sala. */
  function prefillDeCx() {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem('reparaciones.prefill') || 'null'); sessionStorage.removeItem('reparaciones.prefill'); } catch { /* nada */ }
    return p && p.tag ? p : null;
  }
  async function nueva() {
    const cx = prefillDeCx();
    if (cx) {
      /* Un alta empezada antes no se pisa en silencio: lo de la ficha manda, y la vieja se descarta. */
      form = { ...altaVacia(), clave: claveAlta(), tag: cx.tag, planta: cx.planta || '', zona: cx.zona || '', ubicacion: cx.ubicacion || '', unidades: cx.unidades || [], desdeCx: cx.volverA || '' };
      if (activa()) pintarForm();
      return;
    }
    const b = AG.leer(claveAlta());
    if (altaConContenido(b)) {
      const { _en, ...resto } = b;
      form = { ...altaVacia(), ...resto, clave: claveAlta(), fotos: await AG.restaurarFotos(b.fotos) };
      C.aviso('Sigues con la reparación que tenías sin terminar.', 'aviso');
    } else form = { ...altaVacia(), clave: claveAlta() };
    if (activa()) pintarForm();
  }

  function pintarForm() {
    const f = form;
    $app.innerHTML = `
      <button class="volver" data-rp="lista">‹ Reparaciones</button>
      <h2>Nueva reparación</h2>
      <p class="nota">${esc(C.obra() ? `${C.obra().codigo} · ${C.obra().nombre}` : '')}</p>
      ${AG.marca('movil', altaConContenido(f) ? 'Guardado en el móvil · se envía al dar de alta' : 'Se guarda solo mientras escribes')}
      ${(f.unidades || []).length > 1 ? `<label>Unidad con el problema<select data-rp-campo="tag">${f.unidades.map((u) => `<option value="${esc(u.tag)}" ${u.tag === f.tag ? 'selected' : ''}>${esc(u.papel ? `${u.papel} · ` : '')}${esc(u.tag)}</option>`).join('')}</select></label>
      <p class="nota">Una avería en la UE o en una UI bloquea el commissioning del conjunto entero.</p>` : `<label>Equipo (TAG)<input data-rp-campo="tag" list="rp-equipos" value="${esc(f.tag)}" autocomplete="off" placeholder="Escribe el TAG del equipo"></label>`}
      <datalist id="rp-equipos">${(datos.equipos || []).map((e) => `<option value="${esc(e.tag)}">${esc(e.planta)}</option>`).join('')}</datalist>
      <div class="campos">
        <label>Planta<input data-rp-campo="planta" list="rp-plantas" value="${esc(f.planta)}" autocomplete="off" placeholder="N00, N10…"></label>
        <label>Zona<input data-rp-campo="zona" list="rp-zonas" value="${esc(f.zona)}" autocomplete="off" placeholder="Tribuna, Gol Norte…"></label>
      </div>
      <datalist id="rp-plantas">${(datos.plantas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="rp-zonas">${(datos.zonas || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      ${f.ubicacion !== undefined && (f.ubicacion || f.desdeCx) ? `<label>Ubicación<input data-rp-campo="ubicacion" value="${esc(f.ubicacion)}" autocomplete="off" placeholder="Sala, local…"></label>` : ''}
      <label>Operario<select data-rp-campo="operario"><option value="">—</option>${(datos.asignables || []).map((v) => `<option value="${esc(v)}" ${v === f.operario ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Qué le pasa<textarea rows="4" data-rp-campo="descripcion" placeholder="Qué falla y qué hay que hacer">${esc(f.descripcion)}</textarea></label>
      <label>Prioridad</label>
      <div class="segmentado">${['alta', 'media', 'baja'].map((p) => `<button data-rp-prioridad="${p}" class="${f.prioridad === p ? 'activa' : ''}">${NOMBRE_PRIORIDAD[p]}</button>`).join('')}</div>
      <div class="campos">
        <label>Encargado<select data-rp-campo="encargadoId"><option value="">—</option>${(datos.encargados || []).map((p) => `<option value="${esc(p.id)}" ${p.id === f.encargadoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        <label>Para el<input type="date" data-rp-campo="fechaLimite" value="${esc(f.fechaLimite)}" min="${hoy()}"></label>
      </div>
      <label>Fotos del antes${f.fotos.length ? ` · ${f.fotos.length}` : ''}</label>
      ${f.fotos.length ? `<div class="fotos">${f.fotos.map((a, i) => (a.url ? `<img src="${esc(a.url)}" alt="" data-rp="ver-foto" data-i="${i}">` : `<span class="foto-sin-vista" data-rp="ver-foto" data-i="${i}">Foto</span>`)).join('')}</div><p class="nota">Toca una foto para verla en grande, cambiarla o quitarla.</p>` : ''}
      <div class="fila-botones">
        <button class="boton secundario" data-rp="alta-camara"><i class="ic ic-camara"></i>Hacer foto</button>
        <button class="boton secundario" data-rp="alta-galeria">De la galería</button>
      </div>
      <button class="boton grande" data-rp="enviar">Dar de alta</button>`;
  }

  /* Las fotos del alta se guardan en el teléfono al momento y se suben al darla de alta. */
  /* Con la cámara, una; de la galería, varias a la vez (tarea 368b6690). */
  const elegir = async (camara) => (camara ? [await C.elegirFoto(true)].filter(Boolean) : AG.elegirFotos(false));
  async function fotoAlta(camara) {
    const archivos = await elegir(camara);
    if (!archivos.length || !form) return;
    const f = form;
    for (const archivo of archivos) f.fotos.push(await AG.fotoNueva(archivo));
    if (form === f) { persistirAlta(); if (activa()) pintarForm(); }
  }
  const soltarFoto = (x) => { if (!x) return; if (x.local) AG.borrarFoto(x.local); if (x.url) { try { URL.revokeObjectURL(x.url); } catch { /* nada */ } } };
  /* Tocar una foto del alta: en grande, para reemplazarla o quitarla (y se guarda sola en el móvil). */
  function verFotoAlta(i) {
    const f = form;
    const viejo = f && f.fotos[i];
    if (!viejo) return;
    AG.verFoto({
      url: viejo.url,
      quitar: () => {
        const k = f.fotos.indexOf(viejo);
        if (k < 0) return;
        f.fotos.splice(k, 1);
        soltarFoto(viejo);
        if (form === f) { persistirAlta(); if (activa()) pintarForm(); }
      },
      reemplazar: async (archivo) => {
        const x = await AG.fotoNueva(archivo);
        const k = f.fotos.indexOf(viejo);
        if (k < 0) f.fotos.push(x); else f.fotos.splice(k, 1, x);
        soltarFoto(viejo);
        if (form === f) { persistirAlta(); if (activa()) pintarForm(); }
      },
    });
  }

  async function enviar(boton) {
    const tag = form.tag.trim().toLowerCase();
    const eq = (datos.equipos || []).find((e) => String(e.tag).trim().toLowerCase() === tag);
    if (!eq) { C.aviso(tag ? 'Ese TAG no está en la tabla de equipos de la obra.' : 'Elige el equipo.', 'aviso'); return; }
    if (!form.descripcion.trim()) { C.aviso('Escribe qué le pasa.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const primera = form.descripcion.trim().split('\n')[0].slice(0, 120);
      const alta = {
        obraId: C.obraId(), equipoId: eq.id, titulo: `${eq.tag} · ${primera}`, descripcion: form.descripcion,
        prioridad: form.prioridad, encargadoId: form.encargadoId || undefined,
        operario: form.operario || undefined, zona: form.zona || undefined, planta: form.planta || undefined, ubicacion: form.ubicacion || undefined, fechaLimite: form.fechaLimite || null,
      };
      let r = await C.postJson('api/reparacion', alta);
      /* El equipo ya tiene una reparación sin cerrar: se pregunta antes de abrir otra. */
      if (r.repetida && window.confirm(`${r.error}\n\n¿Es otra avería distinta y quieres abrir otra reparación?`)) {
        r = await C.postJson('api/reparacion', { ...alta, aunqueRepetida: true });
      }
      if (!r.ok) throw new Error(r.error);
      let sinFoto = 0;
      for (const x of form.fotos) {
        try {
          const archivo = x.archivo || await AG.leerFoto(x.local);
          if (!archivo) throw new Error('sin foto');
          const f = await C.postJson('api/reparacion/foto', { id: r.id, fotos: [await C.subirFoto(await reducir(archivo))], momento: 'antes' });
          if (!f.ok) sinFoto++;
        } catch { sinFoto++; }
      }
      AG.borrar(form.clave);
      form = null;
      C.aviso(`${r.codigo || 'Reparación'} dada de alta${sinFoto ? `, pero ${sinFoto} foto(s) no se subieron: añádelas desde la ficha` : ''}.`, sinFoto ? 'aviso' : 'bien');
      await lista();
    } catch (e) {
      persistirAlta();
      C.aviso(AG.sinRed(e) ? 'Sin conexión: la reparación sigue guardada en el móvil. Vuelve a darla de alta con conexión.' : e.message);
      boton.disabled = false;
    }
  }

  /* ═══════════════════════════════════ 3. La ficha */

  /*
   * 16-oct-2026, JC: «botón de guardar para guardar la foto y tal y que luego
   * salga en el PDF». En la ficha nada se manda al tocarlo: las fotos del
   * antes y del después, la nota, la visita (técnicos y horas) y el estado se
   * quedan en `cambios` y se guardan SOLOS (28-oct, JC: «ese botón ya no sirve
   * si toda la app tiene autoguardado»): al hacer la foto, al apuntar la
   * visita, al elegir el estado, a una pausa o al salir del cuadro de la nota,
   * al salir de la ficha, al ir atrás y al pasar la app a segundo plano. Sin
   * botón: solo el indicador de la cabecera. Guardado queda en el teléfono al momento y sube a
   * la nube con sus fotos en cuanto hay red (shared/sync/archivos.js); si no
   * la hay, se reintenta solo.
   */
  const nuevosCambios = () => ({ fotos: [], nota: '', estado: null, motivo: '', visita: null });
  const hayEn = (c) => Boolean(c && (c.fotos.length || c.nota.trim() || c.estado || c.visita));
  const hayCambios = () => hayEn(cambios);
  let guardadoA = 0;
  /* null | 'guardando' | 'sinRed' | 'error': lo que dice la barra mientras hay cambios. */
  let estadoBarra = null;

  /* Lo tocado en la ficha, al teléfono (también la visita que se está apuntando). */
  function persistirCambios(id = abierta && abierta.reparacion.id, c = cambios, v = visita) {
    if (!id || !c) return;
    if (hayEn(c) || v) {
      AG.guardar(`rep.${id}`, { nota: c.nota, estado: c.estado, motivo: c.motivo, visita: c.visita, visitaEnCurso: v || null, fotos: AG.fotosParaGuardar(c.fotos) });
    } else AG.olvidar(`rep.${id}`);
  }

  async function abrir(id, { conservar = false } = {}) {
    visita = null; if (!conservar) firmando = null;
    let enCurso = null;
    if (!conservar) {
      cambios = nuevosCambios();
      estadoBarra = null;
      /* Lo que se quedó a medias en esta reparación (atrás, app cerrada…). */
      const b = AG.leer(`rep.${id}`);
      if (b) {
        cambios = { ...cambios, nota: b.nota || '', estado: b.estado || null, motivo: b.motivo || '', visita: b.visita || null, fotos: await AG.restaurarFotos(b.fotos) };
        enCurso = b.visitaEnCurso || null;
      }
    }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      if (!activa()) return;
      pintarFicha();
      window.scrollTo(0, 0);
      if (enCurso) { visita = enCurso; pintarVisita(); C.aviso('Recuperada la visita que estabas apuntando.', 'aviso'); }
      /* Si quedó algo sin subir, se sube ya. */
      if (hayCambios()) guardar({ silencioso: true });
    } catch (e) { C.aviso(e.message); lista(); }
  }

  /* Relee la ficha del servidor y la repinta sin moverla ni quitar el foco a quien escribe. */
  async function recargar(id) {
    try {
      const r = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
      if (!r.ok || !abierta || abierta.reparacion.id !== id) return r;
      abierta = r;
      if (!activa() || visita) return r;
      const foco = document.activeElement;
      if (foco && $app.contains && $app.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName || '')) { refrescarBarra(); return r; }
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
      return r;
    } catch { return null; }
  }

  const NOMBRE_PASO = (p) => (p.id === 'cerrada' ? 'Cerrarla' : p.nombre === 'TERMINADA' ? 'Terminada' : p.nombre === 'EN CURSO' ? 'Empezada' : p.nombre);

  /* El indicador de la cabecera (sin botón: todo se guarda solo). */
  function marcaGuardado() {
    const hay = hayCambios();
    const e = estadoBarra === 'sinRed' && hay ? 'sinRed'
      : estadoBarra === 'error' && hay ? 'error'
      : estadoBarra === 'guardando' || hay ? 'guardando'
      : 'guardado';
    const texto = e === 'sinRed' ? 'Sin conexión: se guardará al volver' : e === 'error' ? 'No se ha guardado' : e === 'guardando' ? 'Guardando…' : 'Guardado';
    return { e, texto };
  }
  const refrescarBarra = () => {
    const el = $app.querySelector('.barra-editor .autoguardado');
    if (!el) return;
    const { e, texto } = marcaGuardado();
    el.className = `autoguardado ${e}`;
    el.textContent = texto;
  };

  /*
   * LA FIRMA DE LA REPARACIÓN (29-oct): el técnico responsable (quien tiene la
   * sesión, su nombre puesto solo) y una segunda firma (nombre a mano y cargo).
   * Se guarda en la tabla de firmas del equipo atada a esta reparación
   * (api/reparacion/firma). Sin la del técnico no se puede cerrar.
   */
  let firmando = null; /* 'jefeObra' | 'cliente' mientras se firma */
  let trazadoRep = false;
  const ROTULO_FIRMA = { jefeObra: 'Técnico responsable', cliente: 'Segunda firma' };
  function htmlFirmasRep() {
    const fs = abierta.firmas || {};
    const puedeFirmar = abierta.puede && abierta.puede.nota && ['abierta', 'enCurso', 'terminada'].includes(abierta.reparacion.estado);
    const fila = (rol) => {
      const f = fs[rol];
      const fecha = f && f.fecha ? fechaEs(f.fecha) : '';
      const valor = f
        ? `<span class="firma-hecha"><img src="${esc(f.imagen)}" alt="Firma de ${esc(f.nombre)}"><span class="tenue">${esc([f.nombre, f.cargo, fecha].filter(Boolean).join(' · '))}</span></span>${puedeFirmar ? ` <button class="enlace" data-rp="firmar" data-rol="${rol}">Volver a firmar</button>` : ''}`
        : (puedeFirmar ? `<button class="enlace" data-rp="firmar" data-rol="${rol}">Firmar</button>` : '<span class="no">Sin firmar</span>');
      return `<div class="fd firma-fd"><span class="et">${ROTULO_FIRMA[rol]}</span><span class="firma-valor">${valor}</span></div>`;
    };
    return `<h2>Firma del equipo</h2><section class="grupo">${fila('jefeObra')}${fila('cliente')}</section>
      ${abierta.firmada ? '' : '<p class="nota aviso">Sin la firma del técnico responsable la reparación no se puede cerrar.</p>'}
      ${firmando ? htmlLienzoRep() : ''}`;
  }
  function htmlLienzoRep() {
    const previa = (abierta.firmas || {})[firmando];
    /* Los campos, del componente común (firmaDoble.js): el técnico con el nombre de la sesión; la otra, nombre y cargo. */
    const FD = window.CX_FIRMA;
    const campos = FD ? FD.htmlCampos(firmando, { previa: previa || (firmando === 'jefeObra' ? { nombre: abierta.yoNombre || '' } : null) })
      : `<label class="campo"><span>Nombre de quien firma</span><input type="text" maxlength="80" data-firma-nombre value="${esc(previa ? previa.nombre : (firmando === 'jefeObra' ? (abierta.yoNombre || '') : ''))}"></label>`;
    return `<section class="firma-lienzo" data-firma="${firmando}">
      <h3 class="banda">${ROTULO_FIRMA[firmando]}</h3>
      ${campos}
      <canvas width="600" height="200" data-firma-lienzo aria-label="Firme aquí con el dedo"></canvas>
      <p class="nota">Firme dentro del recuadro con el dedo.</p>
      <div class="fila-botones">
        <button class="boton" data-rp="guardar-firma">Firmar</button>
        <button class="boton secundario" data-rp="limpiar-firma">Borrar trazo</button>
        <button class="boton secundario" data-rp="cancelar-firma">Cancelar</button>
        ${previa ? '<button class="enlace mal" data-rp="quitar-firma">Quitar la firma guardada</button>' : ''}
      </div>
    </section>`;
  }
  function prepararLienzoRep() {
    const cv = $app.querySelector('[data-firma-lienzo]');
    if (!cv) return;
    if (window.CX_FIRMA) window.CX_FIRMA.enlazar($app.querySelector('.firma-lienzo'));
    const cx = cv.getContext('2d');
    cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#0F5F56';
    trazadoRep = false;
    let ultimo = null;
    const punto = (ev) => { const r = cv.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * cv.width, y: ((ev.clientY - r.top) / r.height) * cv.height }; };
    cv.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (cv.dataset.guardada) return; try { cv.setPointerCapture(ev.pointerId); } catch { /* sin captura */ } ultimo = punto(ev); cx.beginPath(); cx.arc(ultimo.x, ultimo.y, 1.5, 0, Math.PI * 2); cx.fillStyle = cx.strokeStyle; cx.fill(); trazadoRep = true; });
    cv.addEventListener('pointermove', (ev) => { if (!ultimo) return; ev.preventDefault(); const p = punto(ev); cx.beginPath(); cx.moveTo(ultimo.x, ultimo.y); cx.lineTo(p.x, p.y); cx.stroke(); ultimo = p; });
    const fin = () => { ultimo = null; };
    cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('pointerleave', fin);
    /* Su firma ya hecha, puesta (solo el técnico responsable): «Firmar» la acepta sin trazar. */
    if (window.CX_FIRMA) window.CX_FIRMA.aplicar(cv, firmando, { pintado: () => trazadoRep }).then((puesta) => { if (puesta) trazadoRep = true; });
  }
  async function guardarFirmaRep(boton, quitar = false) {
    if (!abierta || !firmando) return;
    const FD = window.CX_FIRMA;
    const raiz = $app.querySelector('.firma-lienzo');
    const leido = FD ? FD.leer(raiz) : { nombre: (($app.querySelector('[data-firma-nombre]') || {}).value || '').trim(), cargo: '' };
    const nombre = leido.nombre; const cargo = leido.cargo || '';
    const cv = $app.querySelector('[data-firma-lienzo]');
    if (!quitar) {
      const falta = FD ? FD.falta(firmando, leido) : (nombre.trim() ? null : 'Falta el nombre de quien firma.');
      if (falta) { C.aviso(falta); return; }
      if (!trazadoRep || !cv) { C.aviso('Firme en el recuadro antes de guardar.'); return; }
    }
    const propia = quitar || !FD ? {} : FD.alFirmar(cv, nombre);
    if (propia.error) { C.aviso(propia.error); return; }
    boton.disabled = true;
    try {
      const id = abierta.reparacion.id;
      const r = await C.postJson('api/reparacion/firma', quitar ? { id, rol: firmando, quitar: true }
        : { id, rol: firmando, nombre: nombre.trim(), cargo, ...(propia.usarGuardada ? { usarGuardada: true } : { imagen: cv.toDataURL('image/png') }) });
      if (!r.ok) throw new Error(r.error);
      abierta.firmas = r.firmas; abierta.firmada = r.firmada;
      C.aviso(quitar ? 'Firma quitada' : 'Firma guardada', 'bien');
      firmando = null;
      const y = window.scrollY; pintarFicha(); window.scrollTo(0, y);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  function pintarFicha() {
    const { reparacion: r, porOperario, comentarios, pasos, puede } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    const v = cambios.visita;
    const horasV = v ? v.tecnicos.reduce((s, t) => s + (Number(String(t.horas).replace(',', '.')) || 0), 0) : 0;
    $app.innerHTML = `
      <div class="barra-editor"><button class="volver" data-rp="lista">‹ Reparaciones</button><span class="autoguardado ${marcaGuardado().e}" role="status" aria-live="polite">${esc(marcaGuardado().texto)}</span></div>
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
          ${suyas.length || nuevas.length ? `<div class="fotos">${suyas.map((f) => `<img data-src="api/reparacion/foto?id=${encodeURIComponent(r.id)}&i=${f.indice}" alt="">`).join('')}${nuevas.map((f) => `<button type="button" class="foto-nueva" data-rp="ver-nueva" data-i="${f.i}" aria-label="Ver esta foto en grande, reemplazarla o quitarla"><img src="${f.url}" alt=""><span>Sin guardar</span></button>`).join('')}</div>` : ''}
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
      ${htmlFirmasRep()}
      ${pasos.length ? `<h2>Estado</h2><div class="segmentado pasos-rp">${pasos.map((p) => `<button type="button" data-rp="paso" data-estado="${esc(p.id)}" class="${cambios.estado === p.id ? 'activa' : ''}" aria-pressed="${cambios.estado === p.id}">${esc(NOMBRE_PASO(p))}</button>`).join('')}</div>
        ${cambios.estado ? `<p class="nota">Pasará a «${esc(NOMBRE_PASO(pasos.find((p) => p.id === cambios.estado)))}»${cambios.motivo ? `: ${esc(cambios.motivo)}` : ''}.</p>` : ''}` : ''}
      <h2>Lo que se ha hecho</h2>
      ${puede.nota ? `<textarea rows="3" data-rp-nota placeholder="Escribe una nota; se guarda sola">${esc(cambios.nota)}</textarea>` : ''}
      ${comentarios.length ? `<ul class="historial">${[...comentarios].reverse().map((c) => `<li><span class="sub">${fechaEs(c.cuando)}${c.persona ? ` · ${esc(c.persona)}` : ''}</span> ${c.tipo === 'estado' ? `<em>${esc(c.texto)}</em>` : esc(c.texto)}</li>`).join('')}</ul>` : '<p class="vacio">Todavía nada.</p>'}`;
    C.cargarImagenes($app);
    if (firmando) prepararLienzoRep();
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

  /* La foto: al teléfono al momento y, sin esperar a nadie, al servidor. */
  async function foto(camara = true, momento = 'antes') {
    const archivos = await elegir(camara);
    if (!archivos.length || !abierta || !cambios) return;
    const c = cambios;
    for (const archivo of archivos) c.fotos.push(await AG.fotoNueva(archivo, { momento }));
    persistirCambios(abierta.reparacion.id, c);
    if (c === cambios && activa() && !visita) {
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    }
    return guardar({ silencioso: true, completo: false });
  }

  /*
   * Tocar una foto de la ficha que aún no ha llegado al servidor: en grande,
   * para reemplazarla o quitarla; el reemplazo se guarda solo. Las ya
   * guardadas se ven en grande (autoguardado.js) pero no se cambian aquí.
   */
  function verNueva(i) {
    const c = cambios;
    const viejo = c && c.fotos[i];
    if (!viejo) return;
    const repintar = () => { if (c === cambios && activa() && !visita) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); } };
    AG.verFoto({
      url: viejo.url,
      quitar: () => {
        const k = c.fotos.indexOf(viejo);
        if (k < 0) { C.aviso('Esa foto ya estaba guardada en la ficha.', 'aviso'); return; }
        c.fotos.splice(k, 1);
        soltarFoto(viejo);
        persistirCambios(abierta && abierta.reparacion.id, c);
        repintar();
      },
      reemplazar: async (archivo) => {
        const x = await AG.fotoNueva(archivo, { momento: viejo.momento });
        const k = c.fotos.indexOf(viejo);
        if (k < 0) { c.fotos.push(x); C.aviso('Esa foto ya estaba guardada en la ficha: se añade la nueva.', 'aviso'); } else { c.fotos.splice(k, 1, x); soltarFoto(viejo); }
        if (!abierta) return;
        persistirCambios(abierta.reparacion.id, c);
        repintar();
        await guardar({ silencioso: true, completo: false });
      },
    });
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
    persistirCambios();
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
    /* El cambio de estado se guarda solo, como todo lo demás (28-oct). */
    guardar({ silencioso: true });
  }

  /*
   * GUARDAR: fotos, visita, nota y estado, por ese orden. Lo que se guarda sale
   * de `cambios`; si algo falla, lo demás se queda (y en el teléfono) para el
   * siguiente intento. `completo: false` (lo que se lanza solo al hacer una
   * foto o anotar una visita) deja la nota y el estado para el final: no se
   * manda media nota mientras se escribe. Solo uno a la vez; lo que llegue
   * mientras, detrás.
   */
  let relojNota = null;
  let enMarcha = null;
  let detras = null;
  function guardar(op = {}) {
    if (enMarcha) {
      detras = { silencioso: true, completo: Boolean((detras && detras.completo) || op.completo !== false) };
      return enMarcha;
    }
    enMarcha = guardarYa(op).finally(() => {
      enMarcha = null;
      const o = detras;
      detras = null;
      if (o && hayEn(cambios)) guardar(o);
    });
    return enMarcha;
  }

  async function guardarYa({ boton = null, silencioso = false, completo = true } = {}) {
    /* Se fija a qué reparación va ANTES de esperar a nada: aunque se salga, va a la suya. */
    const c = cambios;
    if (!abierta || !c) return false;
    const id = abierta.reparacion.id;
    const pendiente = () => c.fotos.length || c.visita || (completo && (c.estado || c.nota.trim()));
    if (!pendiente()) return true;
    if (boton) boton.disabled = true;
    const fotosAntes = abierta.reparacion.fotos.length;
    const subidas = [];
    estadoBarra = 'guardando';
    refrescarBarra();
    try {
      while (c.fotos.length) {
        const f = c.fotos[0];
        const blob = f.archivo || await AG.leerFoto(f.local);
        if (!blob) { c.fotos.splice(c.fotos.indexOf(f), 1); persistirCambios(id, c); C.aviso('Una foto no se ha podido recuperar del teléfono: hazla de nuevo.'); continue; }
        const r = await C.postJson('api/reparacion/foto', { id, fotos: [await C.subirFoto(await reducir(blob))], momento: f.momento });
        if (!r.ok) throw new Error(r.error);
        /* Por identidad: mientras subía, la pudieron reemplazar o quitar. */
        const k = c.fotos.indexOf(f);
        if (k >= 0) c.fotos.splice(k, 1);
        subidas.push(f);
        persistirCambios(id, c);
      }
      if (c.visita) {
        const r = await C.postJson('api/reparacion/visita', { id, ...c.visita });
        if (!r.ok) throw new Error(r.error);
        c.visita = null;
        persistirCambios(id, c);
      }
      if (completo && c.nota.trim()) {
        const enviado = c.nota;
        const r = await C.postJson('api/reparacion/comentar', { id, texto: enviado });
        if (!r.ok) throw new Error(r.error);
        /* Lo escrito mientras se mandaba se queda para la próxima. */
        c.nota = c.nota.startsWith(enviado) ? c.nota.slice(enviado.length).trimStart() : c.nota;
        const ta = $app.querySelector('[data-rp-nota]');
        if (ta && c === cambios && ta.value === enviado) ta.value = '';
        persistirCambios(id, c);
      }
      if (completo && c.estado) {
        /* La visita «terminada» ya la ha pasado a terminada: no se repite. */
        const ahora = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
        if (!ahora.ok || ahora.reparacion.estado !== c.estado) {
          const r = await C.postJson('api/reparacion/estado', { id, estado: c.estado, comentario: c.motivo });
          if (!r.ok) throw new Error(r.error);
        }
        c.estado = null; c.motivo = '';
        persistirCambios(id, c);
      }
      /* «Guardado» solo si la ficha releída del servidor trae las fotos. */
      const leida = abierta && abierta.reparacion.id === id ? await recargar(id) : await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`).catch(() => null);
      if (subidas.length && (!leida || !leida.ok || leida.reparacion.fotos.length < fotosAntes + subidas.length)) {
        c.fotos.unshift(...subidas.splice(0));
        persistirCambios(id, c);
        throw new Error('el servidor no tiene todas las fotos');
      }
      for (const f of subidas) { if (f.local) AG.borrarFoto(f.local); if (f.url) { try { URL.revokeObjectURL(f.url); } catch { /* nada */ } } }
      if (c === cambios) { estadoBarra = null; guardadoA = Date.now(); refrescarBarra(); }
      if (!silencioso) C.aviso('Guardado. Las fotos suben a la nube en cuanto haya red.', 'bien');
      setTimeout(() => { if (abierta && abierta.reparacion.id === id) refrescarBarra(); }, 6100);
      return true;
    } catch (e) {
      const red = AG.sinRed(e);
      persistirCambios(id, c);
      if (c === cambios) { estadoBarra = red ? 'sinRed' : 'error'; refrescarBarra(); }
      if (!red || !silencioso) C.aviso(red ? 'Sin conexión: queda guardado en el móvil y se guardará en cuanto haya red.' : `No se ha guardado todo: ${e.message}`);
      if (abierta && abierta.reparacion.id === id) await recargar(id);
      return false;
    } finally {
      if (boton) boton.disabled = false;
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
      <div class="barra-editor"><button class="volver" data-rp="visita-lista">‹ Reparaciones</button><button class="volver" data-rp="volver-ficha">Ficha ${esc(r.equipo ? r.equipo.tag : r.codigo)}</button></div>
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
      <p class="nota">Al volver a la ficha, la visita se añade y se guarda sola.</p>`;
  }

  /* Sin botón «Añadir a la ficha» (29-oct, JC: «sobra»): al volver, la visita
     se añade sola. Si no se ha escrito nada, se vuelve sin más; si está a
     medias, se avisa de lo que falta y se puede salir sin añadirla. */
  function visitaVacia(v) {
    return !v.resultado && !String(v.hecho).trim() && !v.tecnicos.some((t) => String(t.horas).trim());
  }
  // aLista: sale de la visita directamente al listado de reparaciones, con la
  // visita añadida y guardada igual que al volver a la ficha.
  function volverDeVisita(aLista = false) {
    const salir = () => { if (aLista) { alSalirDeFicha(); cambios = null; lista(); } else pintarFicha(); };
    if (!visita || visitaVacia(visita)) { visita = null; persistirCambios(); salir(); return; }
    const falta = faltaEnVisita(visita);
    if (falta && !window.confirm(`${falta}\n\n¿Salir sin añadir la visita?`)) return;
    if (falta) { visita = null; persistirCambios(); salir(); return; }
    if (!aLista) { anotarVisita(); return; }
    cambios.visita = visita;
    visita = null;
    persistirCambios();
    salir();
  }
  function faltaEnVisita(v) {
    if (!v.resultado) return 'Falta decir cómo ha quedado.';
    const conHoras = v.tecnicos.filter((t) => String(t.operario).trim() || String(t.horas).trim());
    if (v.resultado !== 'noRealizada' && !conHoras.length) return 'Falta al menos un técnico con sus horas.';
    return null;
  }
  function anotarVisita() {
    const falta = faltaEnVisita(visita);
    if (falta) { C.aviso(falta, 'aviso'); return; }
    cambios.visita = visita;
    visita = null;
    persistirCambios();
    guardar({ silencioso: true, completo: false });
    pintarFicha();
    const b = $app.querySelector('.visita-pendiente');
    if (b) b.scrollIntoView({ block: 'center' });
  }

  /* ═══════════════════════════════════ Eventos */

  /* Salir de la ficha: lo pendiente se guarda solo (y ya está en el teléfono). */
  function alSalirDeFicha() {
    if (!abierta || !cambios) return;
    persistirCambios();
    if (hayCambios()) guardar({ silencioso: true });
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const f = ev.target.closest('[data-rp-filtro]');
    if (f) { filtro = f.dataset.rpFiltro; pintarLista(); return; }
    const p = ev.target.closest('[data-rp-prioridad]');
    if (p && form) { form.prioridad = p.dataset.rpPrioridad; persistirAlta(); pintarForm(); return; }
    const res = ev.target.closest('[data-rp-resultado]');
    if (res && visita) { visita.resultado = res.dataset.rpResultado; persistirCambios(); pintarVisita(); return; }
    const b = ev.target.closest('[data-rp]');
    if (!b) return;
    const a = b.dataset.rp;
    if (a === 'lista') { alSalirDeFicha(); cambios = null; lista(); }
    else if (a === 'mias') { soloMias = !soloMias; pintarLista(); }
    else if (a === 'revisar') { porRevisar = !porRevisar; solo = null; pintarLista(); }
    else if (a === 'solo') { solo = null; pintarLista(); }
    else if (a === 'nueva') nueva();
    else if (a === 'enviar') enviar(b);
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'camara') foto(true, b.dataset.momento);
    else if (a === 'galeria') foto(false, b.dataset.momento);
    else if (a === 'quitar-nueva') { const [x] = cambios.fotos.splice(Number(b.dataset.i), 1); if (x) { if (x.url) URL.revokeObjectURL(x.url); if (x.local) AG.borrarFoto(x.local); } persistirCambios(); const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    else if (a === 'alta-camara') fotoAlta(true);
    else if (a === 'alta-galeria') fotoAlta(false);
    else if (a === 'ver-foto') verFotoAlta(Number(b.dataset.i));
    else if (a === 'ver-nueva') verNueva(Number(b.dataset.i));
    else if (a === 'quitar-foto') { const [x] = form.fotos.splice(Number(b.dataset.i), 1); if (x && x.local) AG.borrarFoto(x.local); persistirAlta(); pintarForm(); }
    else if (a === 'paso') elegirPaso(b.dataset.estado);
    else if (a === 'visita' || a === 'editar-visita') nuevaVisita();
    else if (a === 'quitar-visita') { cambios.visita = null; persistirCambios(); const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    else if (a === 'volver-ficha') volverDeVisita();
    else if (a === 'visita-lista') volverDeVisita(true);
    else if (a === 'otro-tecnico') { visita.tecnicos.push({ operario: '', empresa: visita.tecnicos[0].empresa, categoria: 'operario', horas: visita.tecnicos[0].horas }); persistirCambios(); pintarVisita(); }
    else if (a === 'quitar-tecnico') { visita.tecnicos.splice(Number(b.dataset.i), 1); persistirCambios(); pintarVisita(); }
    else if (a === 'anotar-visita') anotarVisita();
    else if (a === 'firmar') { firmando = b.dataset.rol; const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); const l = $app.querySelector('.firma-lienzo'); if (l && l.scrollIntoView) l.scrollIntoView({ block: 'center' }); }
    else if (a === 'guardar-firma') guardarFirmaRep(b);
    else if (a === 'quitar-firma') guardarFirmaRep(b, true);
    else if (a === 'limpiar-firma') { const cv = $app.querySelector('[data-firma-lienzo]'); if (cv) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); if (window.CX_FIRMA) window.CX_FIRMA.soltar(cv); trazadoRep = false; } }
    else if (a === 'cancelar-firma') { firmando = null; const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
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
    if (form && t.dataset.rpCampo) { form[t.dataset.rpCampo] = t.value; persistirAlta(); }
    /* Elegido el equipo, se sugieren su planta y su zona (si no se han escrito). */
    if (form && ev.type === 'change' && t.dataset.rpCampo === 'tag') {
      const eq = (datos.equipos || []).find((e) => String(e.tag).trim().toLowerCase() === t.value.trim().toLowerCase());
      if (eq && ((!form.planta && eq.planta) || (!form.zona && eq.zona))) { form.planta = form.planta || eq.planta || ''; form.zona = form.zona || eq.zona || ''; pintarForm(); }
    }
    if (abierta && ev.type === 'change' && t.dataset.rpDato) guardarDato(t);
    if (visita && t.dataset.rpV) { visita[t.dataset.rpV] = t.value; persistirCambios(); }
    if (visita && t.dataset.rpT !== undefined) { visita.tecnicos[Number(t.dataset.rpT)][t.dataset.k] = t.value; persistirCambios(); }
    if (cambios && t.hasAttribute('data-rp-nota')) {
      cambios.nota = t.value;
      if (estadoBarra === 'error') estadoBarra = null;
      persistirCambios();
      refrescarBarra();
      /* Al terminar de escribir (sale del cuadro), la nota va sola al servidor. */
      if (ev.type === 'change' && abierta) guardar({ silencioso: true });
      /* Y si se hace una pausa larga escribiendo, también (autoguardado con espera). */
      clearTimeout(relojNota);
      if (abierta && cambios.nota.trim()) relojNota = setTimeout(() => { if (abierta && hayCambios()) guardar({ silencioso: true }); }, 4000);
    }
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

  window.addEventListener('movil:obra', () => { if (activa()) { alSalirDeFicha(); lista(); } });
  /*
   * Atrás (botón, gesto o navegador) o a otra pestaña: lo pendiente se guarda
   * solo; al volver se sigue en la misma pantalla (alta, ficha o visita).
   */
  window.addEventListener('hashchange', () => {
    if (!activa()) { alSalirDeFicha(); if (form) persistirAlta(); return; }
    let desdeInicio = false;
    try { desdeInicio = Boolean(sessionStorage.getItem('rp.filtro') || sessionStorage.getItem('cx.abrir')); } catch { /* nada */ }
    if (!desdeInicio && datos && form) pintarForm();
    else if (!desdeInicio && abierta && cambios) {
      if (visita) pintarVisita();
      else { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); recargar(abierta.reparacion.id); }
    } else lista();
  });
  AG.alSalir(() => { if (form) persistirAlta(); alSalirDeFicha(); });
  window.addEventListener('online', () => { if (abierta && hayCambios()) guardar({ silencioso: true }); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && activa() && abierta && hayCambios()) guardar({ silencioso: true }); });
  if (activa()) lista();
})();
