'use strict';
/*
 * «MIS TAREAS» EN EL MÓVIL (#misTareas, junto a Inicio). 24-oct-2026, JC.
 *
 * Las órdenes de trabajo de mantenimiento de quien lleva el teléfono
 * (electron/movil/rutasMantenimiento.js):
 *
 *   1. LA LISTA, por cuándo tocan: atrasadas, hoy, esta semana y más
 *      adelante. El encargado y el jefe ven además las abiertas de la obra.
 *   2. LA FICHA: el equipo (marca, modelo, serie, gas), lo que hay que hacer,
 *      y, empezada la orden, la lista de comprobación (bien · mal · no
 *      aplica), las medidas, las fotos, las observaciones, las horas y la
 *      firma con el dedo. «Guardar» deja lo hecho; «Cerrar la orden» lo
 *      valida todo y lo apunta en el libro del equipo.
 *
 * Ni tarifas ni costes: el dinero de la orden lo pone el ordenador.
 */
(function misTareas() {
  const C = window.CX;
  if (!C) return;
  const $app = document.getElementById('app');
  const { esc, fechaEs } = C;
  const activa = () => C.activa('misTareas');
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const yoNombre = () => { const s = window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion(); return (s && s.nombre) || ''; };

  let datos = null;
  let vista = 'mias';
  let abierta = null;
  /* Lo tocado en la ficha y aún sin guardar. */
  let borrador = null;
  let sucio = false;

  const TONO_ESTADO = { pendiente: 'aviso', asignada: 'info', enCurso: 'aviso', cerrada: 'bien', anulada: 'neutra' };
  const TONO_TIPO = { preventiva: 'neutra', fgas: 'info', correctiva: 'mal' };
  const chip = (texto, tono) => `<span class="chip ${tono || 'neutra'}">${esc(texto)}</span>`;
  const VALORES = [['ok', 'Bien'], ['mal', 'Mal'], ['na', 'No aplica']];

  /* Lo propio de esta pantalla (movil.css es de todas). */
  if (!document.getElementById('estilo-mis-tareas')) {
    const st = document.createElement('style');
    st.id = 'estilo-mis-tareas';
    st.textContent = `
      .lista-ot { margin: 4px 0 12px; padding-left: 22px; line-height: 1.45; }
      .lista-ot li { padding: 2px 0; }
      .lista-check-ot { list-style: none; margin: 4px 0 12px; padding: 0; }
      .check-ot { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-bottom: 1px solid var(--linea, #d9e3e3); }
      .check-ot.mal > span { color: var(--mal); font-weight: 600; }
      .check-ot-opciones { margin: 0; width: fit-content; }
      .campos-ot { display: grid; gap: 8px; margin: 4px 0 12px; }
      .campos-ot input { width: 100%; }
      #app textarea[data-mt-campo] { width: 100%; box-sizing: border-box; }
      canvas[data-mt-firma] { display: block; width: 100%; max-width: 600px; aspect-ratio: 3 / 1; border: 1px solid var(--acento, #00796b); border-radius: 8px; background: #fff; touch-action: none; }
    `;
    document.head.append(st);
  }

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    abierta = null; borrador = null; sucio = false;
    await C.obrasListas();
    if (!activa()) return;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const q = C.obraId() ? `?obra=${encodeURIComponent(C.obraId())}` : '';
      datos = await C.pedir(`api/mistareas${q}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-mt="lista">Reintentar</button></div>`;
      return;
    }
    if (!activa() || abierta) return;
    if (vista === 'obra' && !datos.obra) vista = 'mias';
    /* Si se viene de un aviso del Inicio con una orden concreta, se abre. */
    let ir = null;
    try { ir = sessionStorage.getItem('cx.abrir'); } catch { /* sin almacenamiento */ }
    pintarLista();
    if (ir && [...datos.tareas, ...datos.cerradas, ...(datos.obra || [])].some((o) => o.id === ir)) {
      try { sessionStorage.removeItem('cx.abrir'); } catch { /* nada */ }
      abrir(ir);
    }
  }

  function cuando(o) {
    const h = datos.hoy || hoy();
    if (!o.fechaPrevista) return 'Sin fecha';
    if (o.atrasada) return 'Atrasadas';
    if (o.fechaPrevista === h) return 'Hoy';
    if (o.fechaPrevista <= masDias(h, 7)) return 'Esta semana';
    return 'Más adelante';
  }
  const ORDEN_GRUPOS = ['Atrasadas', 'Hoy', 'Esta semana', 'Más adelante', 'Sin fecha'];

  function pintarLista() {
    const filas = vista === 'cerradas' ? datos.cerradas : vista === 'obra' ? (datos.obra || []) : datos.tareas;
    const opciones = [['mias', 'Mías', datos.tareas.length], ...(datos.obra ? [['obra', 'De la obra', datos.obra.length]] : []), ['cerradas', 'Cerradas', datos.cerradas.length]];
    const grupo = vista === 'cerradas' ? (o) => (o.fechaCierre ? `Cerradas en ${fechaEs(o.fechaCierre).slice(3)}` : 'Cerradas') : cuando;
    $app.innerHTML = `
      <div class="segmentado" role="tablist">
        ${opciones.map(([id, nombre, n]) => `<button role="tab" data-mt-vista="${id}" class="${vista === id ? 'activa' : ''}" aria-selected="${vista === id}">${esc(nombre)} <small>${n}</small></button>`).join('')}
      </div>
      ${filas.length ? C.listaAgrupada(`mt-${vista}`, filas, {
        grupo, repintar: pintarLista, orden: ORDEN_GRUPOS,
        fila: (o) => `
        <li><button class="fila-ios" data-mt="ficha" data-id="${esc(o.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(o.equipoTag || o.codigo)}</strong><span>${chip(o.tipoNombre, TONO_TIPO[o.tipo])} ${chip(o.estadoNombre, TONO_ESTADO[o.estado])}</span></div>
          <div class="texto-2">${esc(o.operaciones)} operaci${o.operaciones === 1 ? 'ón' : 'ones'} · ${esc(o.especialidadNombre)}${o.carne ? ` · <strong>${esc(o.carne)}</strong>` : ''}</div>
          <div class="sub">${esc(o.codigo)}${o.planta ? ` · ${esc(o.planta)}` : ''}${o.zona ? ` · ${esc(o.zona)}` : ''}${o.minutos ? ` · ${o.minutos} min` : ''}${o.operario ? ` · ${esc(o.operario)}` : vista === 'obra' && !o.operarioId ? ' · <strong class="mal">sin asignar</strong>' : ''}${o.atrasada ? ` · <strong class="mal">atrasada (${fechaEs(o.fechaPrevista)})</strong>` : o.fechaPrevista ? ` · ${fechaEs(o.fechaPrevista)}` : ''}</div>
        </button></li>` })
    : `<p class="vacio">${vista === 'cerradas' ? 'No has cerrado ninguna orden en los últimos treinta días.' : vista === 'obra' ? 'La obra no tiene órdenes abiertas.' : 'No tienes órdenes de mantenimiento pendientes.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. La ficha */

  async function abrir(id) {
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/orden?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      borrador = {
        checklist: r.orden.checklist.map((c) => c.valor),
        medidas: r.orden.medidas.map((m) => (m.valor == null ? '' : String(m.valor))),
        observaciones: r.orden.observaciones || '',
        horas: r.orden.horas != null ? String(r.orden.horas) : (r.orden.minutos ? String(Math.round((r.orden.minutos / 60) * 4) / 4) : ''),
        firmadoPor: r.orden.firmadoPor || yoNombre(),
        firma: null,
      };
      sucio = false;
      sec = secGuardada(r.orden.id) || 'resumen';
      pintarFicha();
      window.scrollTo(0, 0);
      C.cabeza({ titulo: r.orden.equipoTag || r.orden.codigo, sub: `${r.orden.codigo} · ${r.orden.tipoNombre}`, progreso: progresoTexto(), pct: progresoPct() });
    } catch (e) { C.aviso(e.message); lista(); }
  }

  const contestadas = () => (borrador ? borrador.checklist.filter((v) => v).length : 0);
  const progresoTexto = () => (abierta && abierta.orden.estado === 'enCurso' ? `${contestadas()}/${abierta.orden.checklist.length}` : '');
  const progresoPct = () => (abierta && abierta.orden.checklist.length ? (contestadas() / abierta.orden.checklist.length) * 100 : 0);

  /* ── Subsecciones de la ficha: una pantalla de iPhone cada una, nunca lista infinita.
     La última abierta de cada orden se recuerda (localStorage, con try/catch). */
  let sec = 'resumen';
  const claveSec = (id) => `cx.mt.sec.${id}`;
  const secGuardada = (id) => { try { return localStorage.getItem(claveSec(id)) || ''; } catch { return ''; } };
  const recordarSec = (id, v) => { try { localStorage.setItem(claveSec(id), v); } catch { /* sin almacenamiento */ } };

  /* Las que no tienen nada para este tipo de orden no salen. */
  function subsecciones(o, editable) {
    const trabajo = o.estado === 'enCurso' || o.estado === 'cerrada';
    const cerrada = o.estado === 'cerrada';
    const lista = [{ id: 'resumen', nombre: 'Resumen', hecha: false }];
    if (!trabajo) return lista;
    if (o.checklist.length) lista.push({ id: 'comprobaciones', nombre: 'Comprob.', cuenta: `${contestadas()}/${o.checklist.length}`, hecha: cerrada || contestadas() === o.checklist.length });
    if (o.medidas.length) lista.push({ id: 'medidas', nombre: 'Medidas', hecha: cerrada || borrador.medidas.every((v) => v !== '') });
    lista.push({ id: 'fotos', nombre: 'Fotos', hecha: cerrada || !!borrador.firma });
    if (editable || cerrada) lista.push({ id: 'cerrar', nombre: editable ? 'Cerrar' : 'Cierre', hecha: cerrada });
    return lista;
  }

  function pintarFicha() {
    const { orden: o, equipo: e, incidencia: inc, operario, puede } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    const editable = puede.apuntar;
    const gas = e && e.gas && e.gas.refrigerante ? `${e.gas.refrigerante}${e.gas.cargaKg ? ` · ${String(e.gas.cargaKg).replace('.', ',')} kg` : ''}` : '';
    const subs = subsecciones(o, editable);
    if (!subs.some((x) => x.id === sec)) sec = subs[0].id;
    const i = subs.findIndex((x) => x.id === sec);
    const siguiente = subs[i + 1] ? `<button type="button" class="boton secundario siguiente-ot" data-mt-sec="${subs[i + 1].id}">Siguiente · ${esc(subs[i + 1].nombre)} ›</button>` : '';
    const resumen = `
      <section class="grupo compacto">
        ${dato('Orden', o.codigo)}${dato('Prevista', fechaEs(o.fechaPrevista))}${dato('Tiempo estimado', o.minutos ? `${o.minutos} min` : '')}
        ${dato('Planta', o.planta)}${dato('Zona', o.zona)}${dato('Operario', operario ? [operario.nombre, operario.empresa].filter(Boolean).join(' · ') : '')}
        ${dato('Empezada', o.fechaInicio ? fechaEs(o.fechaInicio) : '')}${dato('Cerrada', fechaEs(o.fechaCierre))}
        ${e ? `${dato('Equipo', [e.tipo, e.denominacion].filter(Boolean).join(' · '))}${dato('Marca', [e.marca, e.modelo].filter(Boolean).join(' '))}${dato('Nº de serie', e.numSerie)}
        ${dato('Sala', e.sala)}${dato('Gas', gas)}${dato('Detección de fugas', e.gas && e.gas.deteccion ? 'Sí' : '')}` : ''}
        ${inc ? `${dato(inc.codigo, inc.titulo)}` : ''}
      </section>
      ${inc && inc.descripcion ? `<p class="texto-ficha">${esc(inc.descripcion)}</p>` : ''}
      <h2>Qué hay que hacer</h2>
      <ol class="lista-ot">${o.lista.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${puede.empezar ? '<button class="boton grande" data-mt="empezar">Empezar la orden</button><p class="nota">Al empezarla se apunta la hora y se abre la lista de comprobación.</p>' : ''}`;
    const cuerpo = sec === 'resumen' ? resumen : fichaTrabajo(sec, o, editable);
    $app.innerHTML = `
      <button class="volver" data-mt="lista">‹ Mis tareas</button>
      <section class="cabeza-ficha">
        <div class="fila-principal"><h2 class="cifra">${esc(o.equipoTag || o.codigo)}</h2><span>${chip(o.tipoNombre, TONO_TIPO[o.tipo])} ${chip(o.estadoNombre, TONO_ESTADO[o.estado])}</span></div>
        <p class="texto-ficha">${esc(o.especialidadNombre)}${o.carne ? ` · necesita ${esc(o.carne)}` : ''}</p>
      </section>
      ${o.atrasada ? `<p class="nota aviso">Atrasada: tocaba el ${esc(fechaEs(o.fechaPrevista))}.</p>` : ''}
      ${subs.length > 1 ? `<div class="segmentado subsecciones-ot" role="tablist">${subs.map((x) => `<button type="button" role="tab" data-mt-sec="${x.id}" class="${x.id === sec ? 'activa' : ''}${x.hecha ? ' hecha' : ''}" aria-selected="${x.id === sec}">${x.hecha ? '<span class="visto" aria-label="completa">✓</span> ' : ''}${esc(x.nombre)}${x.cuenta ? ` <small>${x.cuenta}</small>` : ''}</button>`).join('')}</div>` : ''}
      <div class="sec-ot" data-sec="${sec}">${cuerpo}${siguiente}</div>
      ${editable ? `<div class="barra-guardar" role="status">
          <span class="estado-guardar ${sucio ? 'pendiente' : 'al-dia'}">${sucio ? 'Cambios sin guardar' : 'Todo guardado'}</span>
          <button type="button" class="boton secundario" data-mt="guardar" ${sucio ? '' : 'disabled'}>Guardar</button>
        </div>` : ''}`;
    C.cargarImagenes($app);
    if (editable && sec === 'fotos') prepararFirma();
  }

  function fichaTrabajo(que, o, editable) {
    const b = borrador;
    if (que === 'comprobaciones') {
      const lista = o.checklist.map((c, i) => {
        const v = b.checklist[i];
        return `<li class="check-ot${v === 'mal' ? ' mal' : ''}"><span>${esc(c.texto)}</span>
        ${editable ? `<div class="segmentado check-ot-opciones">${VALORES.map(([id, n]) => `<button type="button" data-mt-check="${i}" data-valor="${id}" class="${v === id ? 'activa' : ''}" aria-pressed="${v === id}" aria-label="${n}">${id === 'na' ? 'N/A' : n}</button>`).join('')}</div>`
          : `<strong>${esc((VALORES.find(([id]) => id === v) || [null, '—'])[1])}</strong>`}</li>`;
      }).join('');
      return `<ul class="lista-check-ot">${lista}</ul>`;
    }
    if (que === 'medidas') {
      const medidas = o.medidas.map((m, i) => {
        const rango = m.min !== undefined || m.max !== undefined ? ` (${m.min ?? '…'}–${m.max ?? '…'})` : '';
        const tipo = m.unidad === 'texto' || m.unidad === 'sí/no' ? 'text' : 'number';
        return editable
          ? `<label>${esc(m.nombre)}${m.unidad && tipo === 'number' ? ` · ${esc(m.unidad)}` : ''}${esc(rango)}<input type="${tipo}" ${tipo === 'number' ? 'inputmode="decimal" step="any"' : ''} data-mt-medida="${i}" value="${esc(b.medidas[i])}" placeholder="${m.unidad === 'sí/no' ? 'sí / no' : ''}"></label>`
          : `<div class="fila-dato"><span>${esc(m.nombre)}</span><strong>${m.valor == null || m.valor === '' ? '—' : esc(`${m.valor}${tipo === 'number' ? ` ${m.unidad}` : ''}`)}</strong></div>`;
      }).join('');
      return editable ? `<div class="campos-ot">${medidas}</div>` : `<section class="grupo compacto">${medidas}</section>`;
    }
    if (que === 'fotos') {
      return `
      <h2>Fotos${o.fotos.length ? ` · ${o.fotos.length}` : ''}</h2>
      ${o.fotos.length ? `<div class="fotos">${o.fotos.map((f) => `<img data-src="api/orden/foto?id=${encodeURIComponent(o.id)}&i=${f.indice}" alt="">`).join('')}</div>` : ''}
      ${editable ? `<div class="fila-botones">
          <button class="boton secundario" data-mt="camara"><i class="ic ic-camara"></i>Hacer foto</button>
          <button class="boton secundario" data-mt="galeria">De la galería</button>
        </div>` : ''}
      <h2>Observaciones</h2>
      ${editable ? `<textarea rows="2" data-mt-campo="observaciones" placeholder="Lo que has visto o cambiado; obligatorio si algo ha salido mal">${esc(b.observaciones)}</textarea>`
        : `<p class="texto-ficha">${esc(o.observaciones || '—')}</p>`}
      ${editable ? `<h2>Firma (con el dedo)</h2>
        <canvas class="firma-ot" width="600" height="200" data-mt-firma aria-label="Firma"></canvas>
        <div class="fila-botones"><button type="button" class="boton secundario" data-mt="borrar-firma">Borrar la firma</button></div>` : ''}`;
    }
    /* cerrar */
    return editable ? `
      <div class="campos">
        <label>Horas<input type="number" inputmode="decimal" step="0.25" min="0" max="24" data-mt-campo="horas" value="${esc(b.horas)}"></label>
        <label>Firma de<input data-mt-campo="firmadoPor" value="${esc(b.firmadoPor)}" autocomplete="name"></label>
      </div>
      <button class="boton grande" data-mt="cerrar">Cerrar la orden</button>
      <button class="boton secundario" data-mt="devolver">Devolverla (no la puedo hacer)</button>`
      : `<section class="grupo compacto">${o.horas != null ? `<div class="fila-dato"><span>Horas</span><strong>${esc(String(o.horas).replace('.', ','))} h</strong></div>` : ''}${o.firmadoPor ? `<div class="fila-dato"><span>Firmada por</span><strong>${esc(o.firmadoPor)}</strong></div>` : ''}</section>`;
  }

  /* ── La firma: un lienzo donde se dibuja con el dedo; se guarda en PNG. */
  function prepararFirma() {
    const lienzo = $app.querySelector('[data-mt-firma]');
    if (!lienzo || !lienzo.getContext) return;
    const ctx = lienzo.getContext('2d');
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b3b3c';
    if (borrador.firma) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = borrador.firma;
    }
    let dibujando = false;
    const punto = (ev) => { const r = lienzo.getBoundingClientRect(); return [(ev.clientX - r.left) * (lienzo.width / r.width), (ev.clientY - r.top) * (lienzo.height / r.height)]; };
    lienzo.addEventListener('pointerdown', (ev) => { ev.preventDefault(); dibujando = true; lienzo.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.moveTo(...punto(ev)); });
    lienzo.addEventListener('pointermove', (ev) => { if (!dibujando) return; ev.preventDefault(); ctx.lineTo(...punto(ev)); ctx.stroke(); });
    const fin = () => { if (!dibujando) return; dibujando = false; borrador.firma = lienzo.toDataURL('image/png'); };
    lienzo.addEventListener('pointerup', fin);
    lienzo.addEventListener('pointercancel', fin);
  }

  const recogerBorrador = () => ({
    id: abierta.orden.id,
    checklist: abierta.orden.checklist.map((c, i) => ({ texto: c.texto, valor: borrador.checklist[i] || null })),
    medidas: abierta.orden.medidas.map((m, i) => ({ id: m.id, valor: borrador.medidas[i] === '' ? null : borrador.medidas[i] })),
    observaciones: borrador.observaciones,
  });

  function repintar() {
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
    C.cabeza({ titulo: abierta.orden.equipoTag || abierta.orden.codigo, sub: `${abierta.orden.codigo} · ${abierta.orden.tipoNombre}`, progreso: progresoTexto(), pct: progresoPct() });
  }

  async function empezar(boton) {
    boton.disabled = true;
    try {
      const r = await C.postJson('api/orden/empezar', { id: abierta.orden.id });
      if (!r.ok) throw new Error(r.error);
      C.aviso('Orden empezada.', 'bien');
      await abrir(abierta.orden.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function guardar(boton) {
    if (boton) boton.disabled = true;
    try {
      const r = await C.postJson('api/orden/avance', recogerBorrador());
      if (!r.ok) throw new Error(r.error);
      sucio = false;
      C.aviso('Guardado.', 'bien');
      repintar();
      return true;
    } catch (e) { C.aviso(e.message); if (boton) boton.disabled = false; return false; }
  }

  async function cerrar(boton) {
    const faltan = borrador.checklist.filter((v) => !v).length;
    if (faltan) { C.aviso(`Faltan ${faltan} comprobaciones por contestar.`, 'aviso'); return; }
    if (!borrador.firma) { C.aviso('Firma con el dedo antes de cerrar.', 'aviso'); return; }
    if (!window.confirm('¿Cerrar la orden? Lo hecho se apunta en el libro del equipo.')) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/orden/cerrar', {
        ...recogerBorrador(), horas: borrador.horas, firmadoPor: borrador.firmadoPor, firma: borrador.firma, fecha: hoy(),
      });
      if (!r.ok) throw new Error(r.error);
      const extra = [r.avisos && r.avisos.length ? `Fuera de rango: ${r.avisos.join('; ')}` : '', r.incidencia && r.incidencia.aviso ? r.incidencia.aviso : ''].filter(Boolean).join(' · ');
      C.aviso(`Orden cerrada${extra ? `. ${extra}` : '.'}`, r.avisos && r.avisos.length ? 'aviso' : 'bien');
      C.cabeza(null);
      vista = 'mias';
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function devolver(boton) {
    const motivo = (window.prompt('¿Por qué no la puedes hacer? (falta material, no hay acceso…)') || '').trim();
    if (!motivo) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/orden/devolver', { id: abierta.orden.id, motivo });
      if (!r.ok) throw new Error(r.error);
      C.aviso('Devuelta: queda sin empezar y el encargado ve el motivo.', 'bien');
      C.cabeza(null);
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* La foto se reduce a 1600 px en JPEG antes de subirla (como en Reparaciones). */
  async function reducir(archivo) {
    try {
      const url = URL.createObjectURL(archivo);
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.naturalWidth * k); lienzo.height = Math.round(img.naturalHeight * k);
      lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
      if (!blob || (blob.size >= archivo.size && /jpe?g/i.test(archivo.type))) return archivo;
      return new File([blob], `${String(archivo.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } catch { return archivo; }
  }

  async function foto(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !abierta) return;
    try {
      /* Lo apuntado se guarda antes: la foto vuelve a pintar la ficha. */
      if (sucio && !(await guardar(null))) return;
      const r = await C.postJson('api/orden/foto', { id: abierta.orden.id, fotos: [await C.subirFoto(await reducir(archivo))] });
      if (!r.ok) throw new Error(r.error);
      C.aviso('Foto guardada.', 'bien');
      const firma = borrador.firma;
      await abrir(abierta.orden.id);
      if (borrador) { borrador.firma = firma; repintar(); }
    } catch (e) { C.aviso(e.message); }
  }

  /* ═══════════════════════════════════ Eventos */

  const salirSinGuardar = () => !sucio || window.confirm('Hay cambios sin guardar en esta orden. ¿Salir sin guardarlos?');

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const v = ev.target.closest('[data-mt-vista]');
    if (v) { vista = v.dataset.mtVista; pintarLista(); return; }
    const sc = ev.target.closest('[data-mt-sec]');
    if (sc && abierta) { sec = sc.dataset.mtSec; recordarSec(abierta.orden.id, sec); pintarFicha(); window.scrollTo(0, 0); return; }
    const c = ev.target.closest('[data-mt-check]');
    if (c && borrador) {
      const i = Number(c.dataset.mtCheck);
      borrador.checklist[i] = borrador.checklist[i] === c.dataset.valor ? null : c.dataset.valor;
      sucio = true;
      repintar();
      return;
    }
    const b = ev.target.closest('[data-mt]');
    if (!b) return;
    const a = b.dataset.mt;
    if (a === 'lista') { if (abierta && !salirSinGuardar()) return; C.cabeza(null); lista(); }
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'empezar') empezar(b);
    else if (a === 'guardar') guardar(b);
    else if (a === 'cerrar') cerrar(b);
    else if (a === 'devolver') devolver(b);
    else if (a === 'camara') foto(true);
    else if (a === 'galeria') foto(false);
    else if (a === 'borrar-firma') {
      borrador.firma = null;
      const l = $app.querySelector('[data-mt-firma]');
      if (l && l.getContext) l.getContext('2d').clearRect(0, 0, l.width, l.height);
    }
  });
  const recoger = (ev) => {
    if (!activa() || !borrador) return;
    const t = ev.target;
    if (t.dataset.mtMedida !== undefined) { borrador.medidas[Number(t.dataset.mtMedida)] = t.value; sucio = true; }
    else if (t.dataset.mtCampo) { borrador[t.dataset.mtCampo] = t.value; if (t.dataset.mtCampo === 'observaciones') sucio = true; }
    else return;
    const e = $app.querySelector('.estado-guardar');
    const g = $app.querySelector('[data-mt="guardar"]');
    if (e && sucio) { e.textContent = 'Cambios sin guardar'; e.className = 'estado-guardar pendiente'; }
    if (g && sucio) g.disabled = false;
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  window.addEventListener('beforeunload', (ev) => { if (activa() && sucio) { ev.preventDefault(); ev.returnValue = ''; } });

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
