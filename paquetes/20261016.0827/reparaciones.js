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
  let filtro = 'pendientes';
  let soloMias = null;
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
    if (activa() && !form && !abierta && !visita) pintarLista();
  }

  const enFiltro = (f) => (filtro === 'pendientes' ? f.activa && f.estado !== 'terminada'
    : filtro === 'terminadas' ? f.estado === 'terminada' : !f.activa);

  function pintarLista() {
    const filas = (datos.filas || []).filter((f) => !soloMias || f.encargadoId === datos.yo);
    const cuenta = (id) => { const antes = filtro; filtro = id; const n = filas.filter(enFiltro).length; filtro = antes; return n; };
    const q = texto.trim().toLowerCase();
    const vistas = filas.filter(enFiltro)
      .filter((f) => !q || `${f.codigo} ${f.titulo} ${f.equipo ? f.equipo.tag : ''} ${f.encargado || ''}`.toLowerCase().includes(q));
    const planta = (f) => (f.equipo && f.equipo.planta) || 'Sin planta';
    $app.innerHTML = `
      ${datos.puede && datos.puede.crear ? '<button class="boton grande" data-rp="nueva">＋ Nueva reparación</button>' : ''}
      <div class="segmentado" role="tablist">
        ${[['pendientes', 'Pendientes'], ['terminadas', 'Terminadas'], ['cerradas', 'Cerradas']].map(([id, nombre]) => `<button role="tab" data-rp-filtro="${id}" class="${filtro === id ? 'activa' : ''}" aria-selected="${filtro === id}">${esc(nombre)} ${cuenta(id)}</button>`).join('')}
      </div>
      ${datos.mias || datos.filas.some((f) => f.encargadoId === datos.yo) ? `<label class="interruptor"><input type="checkbox" data-rp-mias ${soloMias ? 'checked' : ''}> Solo las mías</label>` : ''}
      <input type="search" class="buscar" placeholder="Buscar TAG, código o encargado" value="${esc(texto)}" data-rp-buscar>
      ${vistas.length ? C.listaAgrupada(`rp-${filtro}`, vistas, {
        grupo: planta, buscando: !!q, repintar: pintarLista,
        orden: [...new Set(vistas.map(planta))].sort((a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true })),
        fila: (f) => `
        <li><button class="fila-ios" data-rp="ficha" data-id="${esc(f.id)}">
          <div class="fila-principal"><strong class="cifra">${esc(f.equipo ? f.equipo.tag : f.codigo)}</strong><span>${chipPrioridad(f.prioridad)} ${chipEstado(f)}</span></div>
          <div class="texto-2">${esc(f.titulo)}</div>
          <div class="sub">${esc(f.codigo)} · ${esc(f.encargado || 'Sin encargado')}${f.horas ? ` · ${horasTxt(f.horas)}` : ''}${f.visitas ? ` · ${f.visitas} visita${f.visitas === 1 ? '' : 's'}` : ''}${f.vencida ? ' · <strong class="mal">vencida</strong>' : f.fechaLimite ? ` · para el ${fechaEs(f.fechaLimite)}` : ''}</div>
        </button></li>` })
    : `<p class="vacio">${q ? 'Ninguna reparación con ese texto.' : filtro === 'pendientes' ? 'No hay reparaciones pendientes.' : filtro === 'terminadas' ? 'Nada esperando a que el jefe de obra lo cierre.' : 'No hay reparaciones cerradas.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. Nueva */

  function nueva() {
    form = { tag: '', descripcion: '', prioridad: 'media', encargadoId: '', fechaLimite: '', fotos: [] };
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
        prioridad: form.prioridad, encargadoId: form.encargadoId || undefined, fechaLimite: form.fechaLimite || null,
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

  async function abrir(id) {
    visita = null;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/reparacion?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      abierta = r;
      pintarFicha();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); lista(); }
  }

  function pintarFicha() {
    const { reparacion: r, porOperario, comentarios, pasos, puede } = abierta;
    const dato = (nombre, valor) => (valor ? `<div class="fila-dato"><span>${esc(nombre)}</span><strong>${esc(valor)}</strong></div>` : '');
    $app.innerHTML = `
      <button class="volver" data-rp="lista">‹ Reparaciones</button>
      <section class="cabeza-ficha">
        <div class="fila-principal"><h2 class="cifra">${esc(r.equipo ? r.equipo.tag : r.codigo)}</h2><span>${chipPrioridad(r.prioridad)} ${chipEstado(r)}</span></div>
        <p class="texto-ficha">${esc(r.titulo)}</p>
      </section>
      ${r.avisos.length ? `<p class="nota aviso">${esc(r.avisos.join(' · '))}</p>` : ''}
      ${puede.visita ? '<button class="boton grande" data-rp="visita"><i class="ic ic-check"></i>Apuntar visita</button>' : ''}
      <section class="grupo">
        ${dato('Código', r.codigo)}${dato('Planta', r.equipo && r.equipo.planta)}${dato('Encargado', r.encargado || 'Sin encargado')}
        ${dato('Abierta', fechaEs(r.fechaApertura))}${dato('Para el', fechaEs(r.fechaLimite))}
        ${dato('Horas', horasTxt(r.horas))}${dato('Visitas', String(r.visitas || 0))}
      </section>
      ${r.descripcion ? `<h2>Qué le pasa</h2><p class="texto-ficha">${esc(r.descripcion)}</p>` : ''}
      ${r.instrucciones ? `<h2>Instrucciones</h2><p class="texto-ficha">${esc(r.instrucciones)}</p>` : ''}
      ${porOperario.length ? `<h2>Horas por técnico</h2><section class="grupo">${porOperario.map((o) => dato(`${o.operario} · ${o.empresa}`, horasTxt(o.horas))).join('')}</section>` : ''}
      ${[['antes', 'Fotos del antes'], ['despues', 'Fotos del después']].map(([m, titulo]) => {
        /* Las de antes de existir el campo cuentan como del antes. */
        const suyas = r.fotos.filter((f) => (f.momento || 'antes') === m);
        if (!suyas.length && !puede.foto) return '';
        return `<h2>${titulo}${suyas.length ? ` · ${suyas.length}` : ''}</h2>
          ${suyas.length ? `<div class="fotos">${suyas.map((f) => `<img data-src="api/reparacion/foto?id=${encodeURIComponent(r.id)}&i=${f.indice}" alt="">`).join('')}</div>` : ''}
          ${puede.foto ? `<div class="fila-botones">
            <button class="boton secundario" data-rp="camara" data-momento="${m}"><i class="ic ic-camara"></i>Hacer foto</button>
            <button class="boton secundario" data-rp="galeria" data-momento="${m}">De la galería</button>
          </div>` : ''}`;
      }).join('')}
      ${pasos.length ? `<h2>Estado</h2>${pasos.map((p) => `<button class="boton ${p.id === 'cerrada' ? 'grande' : 'secundario'}" data-rp="paso" data-estado="${esc(p.id)}">${p.id === 'cerrada' ? 'Cerrar reparación' : esc(p.nombre === 'TERMINADA' ? 'Darla por terminada' : p.nombre === 'EN CURSO' ? 'Empezar' : p.nombre)}</button>`).join('')}` : ''}
      <h2>Lo que se ha hecho</h2>
      <div class="campos"><input data-rp-comentario placeholder="Añadir una nota" autocomplete="off"><button class="boton secundario" data-rp="comentar">Añadir</button></div>
      ${comentarios.length ? `<ul class="historial">${[...comentarios].reverse().map((c) => `<li><span class="sub">${fechaEs(c.cuando)}${c.persona ? ` · ${esc(c.persona)}` : ''}</span> ${c.tipo === 'estado' ? `<em>${esc(c.texto)}</em>` : esc(c.texto)}</li>`).join('')}</ul>` : '<p class="vacio">Todavía nada.</p>'}`;
    C.cargarImagenes($app);
  }

  /* La foto, hecha en el momento o de la galería del teléfono. */
  async function foto(camara = true, momento = 'antes') {
    const archivo = await C.elegirFoto(camara);
    if (!archivo) return;
    try {
      const id = await C.subirFoto(archivo);
      const r = await C.postJson('api/reparacion/foto', { id: abierta.reparacion.id, fotos: [id], momento });
      if (!r.ok) throw new Error(r.error);
      C.aviso('Foto añadida.', 'bien');
      abrir(abierta.reparacion.id);
    } catch (e) { C.aviso(e.message); }
  }

  async function cambiar(estado, boton) {
    let comentario = '';
    if (estado === 'enCurso' && abierta.reparacion.estado !== 'abierta') {
      comentario = window.prompt('¿Por qué se devuelve al encargado?') || '';
      if (!comentario.trim()) return;
    }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/reparacion/estado', { id: abierta.reparacion.id, estado, comentario });
      if (!r.ok) throw new Error(r.error);
      C.aviso(estado === 'cerrada' ? 'Reparación cerrada.' : 'Hecho.', 'bien');
      abrir(abierta.reparacion.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function comentar(boton) {
    const i = $app.querySelector('[data-rp-comentario]');
    if (!i || !i.value.trim()) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/reparacion/comentar', { id: abierta.reparacion.id, texto: i.value });
      if (!r.ok) throw new Error(r.error);
      abrir(abierta.reparacion.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ 4. La visita */

  function nuevaVisita() {
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
      <button class="boton grande" data-rp="guardar-visita">Guardar visita</button>`;
  }

  async function guardarVisita(boton) {
    if (!visita.resultado) { C.aviso('Di cómo ha quedado.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/reparacion/visita', { id: abierta.reparacion.id, ...visita });
      if (!r.ok) throw new Error(r.error);
      C.aviso(visita.resultado === 'terminada' ? 'Visita guardada: queda terminada para el jefe de obra.' : 'Visita guardada.', 'bien');
      abrir(abierta.reparacion.id);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ Eventos */

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
    if (a === 'lista') lista();
    else if (a === 'nueva') nueva();
    else if (a === 'enviar') enviar(b);
    else if (a === 'ficha') abrir(b.dataset.id);
    else if (a === 'camara') foto(true, b.dataset.momento);
    else if (a === 'galeria') foto(false, b.dataset.momento);
    else if (a === 'alta-camara') fotoAlta(true);
    else if (a === 'alta-galeria') fotoAlta(false);
    else if (a === 'quitar-foto') { form.fotos.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'paso') cambiar(b.dataset.estado, b);
    else if (a === 'comentar') comentar(b);
    else if (a === 'visita') nuevaVisita();
    else if (a === 'volver-ficha') { visita = null; pintarFicha(); }
    else if (a === 'otro-tecnico') { visita.tecnicos.push({ operario: '', empresa: visita.tecnicos[0].empresa, categoria: 'operario', horas: visita.tecnicos[0].horas }); pintarVisita(); }
    else if (a === 'quitar-tecnico') { visita.tecnicos.splice(Number(b.dataset.i), 1); pintarVisita(); }
    else if (a === 'guardar-visita') guardarVisita(b);
  });
  const recoger = (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (form && t.dataset.rpCampo) form[t.dataset.rpCampo] = t.value;
    if (visita && t.dataset.rpV) visita[t.dataset.rpV] = t.value;
    if (visita && t.dataset.rpT !== undefined) visita.tecnicos[Number(t.dataset.rpT)][t.dataset.k] = t.value;
    if (ev.type === 'change' && t.hasAttribute('data-rp-mias')) { soloMias = t.checked; pintarLista(); }
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

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
