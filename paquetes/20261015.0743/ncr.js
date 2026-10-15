'use strict';
/*
 * NO CONFORMIDADES (NCR) EN EL MÓVIL (#ncr, dentro de Incidencias).
 *
 *   1. LA LISTA de la obra: abiertas, cerradas o todas, con su estado, la
 *      prioridad y dónde están.
 *   2. EL ALTA RÁPIDA: qué pasa, dónde (planta y zona), disciplina,
 *      prioridad y las fotos hechas con la cámara. El ordenador le pone el
 *      código y la fecha de detección.
 *   3. LA FICHA: los datos, las fotos, los pasos a los que puede ir (el
 *      flujo del escritorio, shared/ncr/motor.js), cerrar y añadir fotos de la
 *      resolución.
 */
(function ncr() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, fechaEs } = C;
  const activa = () => C.activa('ncr');

  let datos = null;
  let filtro = 'abiertas';
  let texto = '';
  let form = null;
  let abierta = null;

  const PRIORIDAD = { A: 'mal', B: 'aviso', C: 'neutra' };
  const chipEstado = (n) => `<span class="chip ${n.activa ? 'aviso' : 'bien'}">${esc(n.estadoNombre)}</span>`;
  const chipPrioridad = (p) => (p ? `<span class="chip ${PRIORIDAD[p] || 'neutra'}">${esc(p)}</span>` : '');

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null; abierta = null;
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await C.pedir(`api/ncr?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-ncr="lista">Reintentar</button></div>`;
      return;
    }
    if (activa() && !form && !abierta) pintarLista();
  }

  function pintarLista() {
    const filas = datos.filas || [];
    const abiertas = filas.filter((f) => f.activa).length;
    const q = texto.trim().toLowerCase();
    const vistas = filas.filter((f) => (filtro === 'todas' ? true : filtro === 'abiertas' ? f.activa : !f.activa))
      .filter((f) => !q || `${f.codigo} ${f.descripcion || ''} ${f.planta || ''} ${f.zona || ''}`.toLowerCase().includes(q));
    $app.innerHTML = `
      ${datos.puede && datos.puede.crear ? '<button class="boton grande" data-ncr="nueva">＋ Nueva NCR</button>' : ''}
      <div class="segmentado" role="tablist">
        ${[['abiertas', `Abiertas ${abiertas}`], ['cerradas', `Cerradas ${filas.length - abiertas}`], ['todas', 'Todas']].map(([id, nombre]) => `<button role="tab" data-ncr-filtro="${id}" class="${filtro === id ? 'activa' : ''}" aria-selected="${filtro === id}">${esc(nombre)}</button>`).join('')}
      </div>
      <input type="search" class="buscar" placeholder="Buscar código, texto o planta" value="${esc(texto)}" data-ncr-buscar>
      ${vistas.length ? C.listaAgrupada(`ncr-${filtro}`, vistas, {
        grupo: (f) => f.planta || 'Sin planta', buscando: !!q, repintar: pintarLista,
        orden: [...new Set(vistas.map((f) => f.planta || 'Sin planta'))].sort((a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true })),
        fila: (f) => `
        <li><button class="fila-ios" data-ncr="ficha" data-id="${esc(f.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(f.codigo)}</strong><span>${chipPrioridad(f.prioridad)} ${chipEstado(f)}</span></div>
          <div class="texto-2">${esc(f.descripcion)}</div>
          <div class="sub">${esc([f.planta, f.zona, f.disciplina].filter(Boolean).join(' · '))}${f.fechaDeteccion ? ` · ${fechaEs(f.fechaDeteccion)}` : ''}${f.fotos ? ` · ${f.fotos} foto${f.fotos === 1 ? '' : 's'}` : ''}</div>
        </button></li>` }) : `<p class="vacio">${q ? 'Ninguna NCR con ese texto.' : filtro === 'abiertas' ? 'No hay NCR abiertas en esta obra.' : 'No hay NCR.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. El alta */

  function nueva() {
    form = { descripcion: '', planta: '', zona: '', disciplina: '', prioridad: 'B', fotos: [] };
    pintarForm();
  }

  function pintarForm() {
    const f = form;
    const plantas = (datos && datos.plantas) || [];
    $app.innerHTML = `
      <button class="volver" data-ncr="lista">‹ NCR</button>
      <h2>Nueva NCR</h2>
      <p class="nota">${esc(C.obra() ? `${C.obra().codigo} · ${C.obra().nombre}` : '')}</p>
      <div class="fila-botones">
        <button class="boton" data-ncr="camara"><i class="ic ic-camara"></i>Foto</button>
        <button class="boton secundario" data-ncr="galeria">De la galería</button>
      </div>
      ${f.fotos.length ? `<div class="fotos">${f.fotos.map((x, i) => `<button class="foto-quitar" data-ncr="quitar-foto" data-i="${i}" aria-label="Quitar foto"><img src="${esc(x.url)}" alt=""></button>`).join('')}</div>` : ''}
      <label>Qué pasa<textarea rows="4" data-ncr-campo="descripcion" placeholder="Describe la no conformidad">${esc(f.descripcion)}</textarea></label>
      <div class="campos">
        <label>Planta${plantas.length
          ? `<select data-ncr-campo="planta"><option value="">—</option>${plantas.map((p) => `<option ${p === f.planta ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`
          : `<input data-ncr-campo="planta" value="${esc(f.planta)}">`}</label>
        <label>Zona<input data-ncr-campo="zona" value="${esc(f.zona)}" autocomplete="off"></label>
      </div>
      <label>Disciplina<select data-ncr-campo="disciplina"><option value="">—</option>${((datos && datos.disciplinas) || []).map((d) => `<option ${d === f.disciplina ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label>Prioridad</label>
      <div class="segmentado">${['A', 'B', 'C'].map((p) => `<button data-ncr-prioridad="${p}" class="${f.prioridad === p ? 'activa' : ''}">${p}${p === 'A' ? ' · urgente' : p === 'C' ? ' · leve' : ''}</button>`).join('')}</div>
      <button class="boton grande" data-ncr="enviar">Dar de alta</button>`;
  }

  async function foto(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo) return;
    try {
      const id = await C.subirFoto(archivo);
      if (form) { form.fotos.push({ id, url: URL.createObjectURL(archivo) }); pintarForm(); }
      else if (abierta) {
        const r = await C.postJson('api/ncr/foto', { id: abierta.ncr.id, fotos: [id], tipo: abierta.ncr.activa ? 'deteccion' : 'resolucion' });
        if (!r.ok) throw new Error(r.error);
        C.aviso('Foto añadida.', 'bien');
        abrir(abierta.ncr.id);
      }
    } catch (e) { C.aviso(e.message); }
  }

  async function enviar(boton) {
    if (!form.descripcion.trim()) { C.aviso('Escribe qué pasa.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/ncr', { obraId: C.obraId(), ...form, fotos: form.fotos.map((x) => x.id) });
      if (!r.ok) throw new Error(r.error);
      form = null;
      C.aviso(`${r.codigo || 'NCR'} dada de alta.${r.avisoFotos ? ` ${r.avisoFotos}` : ''}`, r.avisoFotos ? 'aviso' : 'bien');
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ 3. La ficha */

  async function abrir(id) {
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/ncr/ficha?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      pintarFicha();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); lista(); }
  }

  function pintarFicha() {
    const { ncr: n, pasos, puedeCerrar, puedeFoto, equipos, historial } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    $app.innerHTML = `
      <button class="volver" data-ncr="lista">‹ NCR</button>
      <section class="cabeza-ficha">
        <div class="fila-principal"><h2 class="cifra">${esc(n.codigo)}</h2><span>${chipPrioridad(n.prioridad)} ${chipEstado(n)}</span></div>
        <p class="texto-ficha">${esc(n.descripcion)}</p>
      </section>
      <section class="grupo">
        ${dato('Planta', n.planta)}${dato('Zona', n.zona)}${dato('Disciplina', n.disciplina)}
        ${dato('Responsable', n.industrialResponsable)}${dato('Acción inicial', n.accionInicial)}
        ${dato('Detectada', fechaEs(n.fechaDeteccion))}${dato('Prevista', fechaEs(n.fechaPrevista))}${dato('Cerrada', fechaEs(n.fechaCierre))}
        ${equipos.length ? dato('Equipos', equipos.map((e) => e.tag).join(', ')) : ''}
      </section>
      ${n.fotos.length ? `<h2>Fotos</h2><div class="fotos">${n.fotos.map((f) => `<img data-src="api/ncr/foto?id=${encodeURIComponent(n.id)}&i=${f.indice}" alt="${esc(f.tipo || '')}">`).join('')}</div>` : ''}
      ${puedeFoto ? '<button class="boton secundario" data-ncr="camara"><i class="ic ic-camara"></i>Añadir foto</button>' : ''}
      ${pasos.length || puedeCerrar ? `<h2>Cambiar estado</h2>
        ${pasos.filter((p) => p.id !== 'cerrada').map((p) => `<button class="boton secundario" data-ncr="paso" data-estado="${esc(p.id)}">Pasar a «${esc(p.nombre)}»</button>`).join('')}
        ${puedeCerrar ? '<button class="boton grande" data-ncr="cerrar"><i class="ic ic-check"></i>Cerrar NCR</button>' : ''}` : ''}
      ${historial.length ? `<h2>Historial</h2><ul class="historial">${historial.map((h) => `<li><span class="sub">${fechaEs(h.cuando)}${h.persona ? ` · ${esc(h.persona)}` : ''}</span> ${esc(h.campo)}: ${esc(h.antes || '—')} → <strong>${esc(h.despues || '—')}</strong></li>`).join('')}</ul>` : ''}`;
    C.cargarImagenes($app);
  }

  async function cambiar(estado, boton, confirmar = false) {
    boton.disabled = true;
    try {
      const r = await C.postJson('api/ncr/estado', { id: abierta.ncr.id, estado, confirmar });
      if (r.pideConfirmar) {
        boton.disabled = false;
        if (window.confirm(`${(r.avisos || []).join('\n')}\n\n¿Cerrarla igualmente?`)) return cambiar(estado, boton, true);
        return;
      }
      if (!r.ok) throw new Error(r.error);
      C.aviso(estado === 'cerrada' ? 'NCR cerrada.' : 'Estado cambiado.', 'bien');
      abrir(abierta.ncr.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ Eventos */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const f = ev.target.closest('[data-ncr-filtro]');
    if (f) { filtro = f.dataset.ncrFiltro; pintarLista(); return; }
    const p = ev.target.closest('[data-ncr-prioridad]');
    if (p && form) { form.prioridad = p.dataset.ncrPrioridad; pintarForm(); return; }
    const b = ev.target.closest('[data-ncr]');
    if (!b) return;
    const a = b.dataset.ncr;
    if (a === 'lista') lista();
    else if (a === 'nueva') nueva();
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'camara') foto(true);
    else if (a === 'galeria') foto(false);
    else if (a === 'quitar-foto') { form.fotos.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'enviar') enviar(b);
    else if (a === 'paso') cambiar(b.dataset.estado, b);
    else if (a === 'cerrar') cambiar('cerrada', b);
  });
  const recoger = (ev) => { if (activa() && form && ev.target.dataset.ncrCampo) form[ev.target.dataset.ncrCampo] = ev.target.value; };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  $app.addEventListener('input', (ev) => {
    if (!activa() || form || abierta || !ev.target.hasAttribute('data-ncr-buscar')) return;
    texto = ev.target.value;
    const pos = ev.target.selectionStart;
    pintarLista();
    const i = $app.querySelector('[data-ncr-buscar]');
    i.focus(); i.setSelectionRange(pos, pos);
  });

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
