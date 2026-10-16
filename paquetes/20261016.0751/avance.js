'use strict';
/*
 * EL AVANCE DE OBRA EN EL MÓVIL (#avance).
 *
 * 16-oct-2026, JC: «lo que quiero es que el encargado marque en el plano lo
 * ejecutado por fecha y que esa info le llegue al jefe de obra».
 *
 *   1. LA LISTA: la banda (pendientes de revisar, hoy, la semana y lo medido
 *      esta semana) y tres pestañas: los planos, el material fuera de
 *      presupuesto y, al jefe de obra, lo que tiene por revisar.
 *   2. EL PLANO: las capas (tubería, conductos, equipos, bandejas…) con su
 *      interruptor para verlas o no, y una para marcar. Se marca con el dedo
 *      según el tipo de la capa: un trazo (tocar punto a punto, en metros),
 *      una zona (m²) o un punto (1 unidad). «Mover» deja desplazar el plano
 *      y tocar una marca para verla. Las marcas se colorean por capa o por
 *      día, y se ven las de hoy, las de la semana o todas.
 *   3. AL GUARDAR, una hoja: lo medido, los metros de subidas y bajadas que
 *      no se ven en planta, la cantidad a mano si se prefiere, la partida,
 *      una nota y la foto.
 *   4. MATERIAL FUERA DE PRESUPUESTO: qué, cuánto y una foto. Aceptarlo (con
 *      su coste) es del ordenador: aquí no llega ningún precio.
 */
(function avance() {
  const C = window.CX;
  const MED = window.AVANCE_MEDIR;
  const PL = window.AVANCE_PLANO;
  const $app = document.getElementById('app');
  const { esc, fechaEs } = C;
  const activa = () => C.activa('avance');
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const haceDias = (n) => { const d = new Date(`${hoy()}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const NS = 'http://www.w3.org/2000/svg';

  let datos = null;          // GET api/avance
  let pestana = 'planos';
  let materiales = null;
  let pendientes = null;
  let formMaterial = null;

  /* El plano abierto. */
  let plano = null;          // planoLigero
  let urlImagen = null;
  let marcas = [];
  let capaActiva = null;
  let ocultas = new Set();
  let modo = 'marcar';       // marcar | mover
  let colorPor = 'capa';     // capa | dia
  let periodo = 'semana';    // hoy | semana | todo
  let fecha = hoy();
  let zoom = 1;
  let dibujo = [];           // puntos {x,y} relativos
  let hoja = null;           // { ... } la hoja de guardar o la de una marca

  const UNIDAD = { m: 'm', m2: 'm²', ud: 'ud' };
  const cant = (n, u) => (n === null || n === undefined ? '—' : `${C.cifra(n, Number.isInteger(Number(n)) ? 0 : 2)} ${UNIDAD[u] || u || ''}`.trim());
  const TONO_MARCA = { pendiente: 'aviso', vista: 'bien', certificada: 'neutra', descartada: 'mal' };
  const chipMarca = (m) => `<span class="chip ${TONO_MARCA[m.estado] || 'neutra'}">${esc((PL.ESTADOS_MARCA[m.estado] || {}).nombre || m.estado)}</span>`;
  const TONO_MAT = { pendiente: 'aviso', aceptado: 'bien', rechazado: 'mal' };

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    cerrarPlano();
    formMaterial = null;
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const o = encodeURIComponent(C.obraId());
      const [d, m] = await Promise.all([C.pedir(`api/avance?obra=${o}`), C.pedir(`api/avance/materiales?obra=${o}`)]);
      if (!d.ok) throw new Error(d.error);
      datos = d;
      materiales = m.ok ? m.materiales : [];
      pendientes = null;
      if (d.puede.aprobar) {
        const p = await C.pedir(`api/avance/marcas?obra=${o}&estado=pendiente`);
        pendientes = p.ok ? p.marcas : [];
      }
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-av="lista">Reintentar</button></div>`;
      return;
    }
    if (activa() && !plano && !formMaterial) pintarLista();
  }

  function banda() {
    const r = datos.resumen || {};
    const medido = Object.entries(r.medidoSemana || {}).map(([u, n]) => cant(n, u)).join(' · ') || '—';
    return `<div class="av-banda">
      <div><strong class="cifra">${r.pendientes || 0}</strong><span>por revisar</span></div>
      <div><strong class="cifra">${r.hoy || 0}</strong><span>hoy</span></div>
      <div><strong class="cifra">${r.semana || 0}</strong><span>en 7 días</span></div>
      <div class="ancho"><strong class="cifra">${esc(medido)}</strong><span>medido en 7 días</span></div>
    </div>`;
  }

  function pintarLista() {
    const tabs = [['planos', `Planos ${datos.planos.length}`], ['material', `Fuera de ppto ${materiales.filter((m) => m.estado === 'pendiente').length || ''}`.trim()]];
    if (pendientes) tabs.push(['revisar', `Por revisar ${pendientes.length}`]);
    let cuerpo = '';
    if (pestana === 'planos') {
      cuerpo = datos.planos.length
        ? `<ul class="lista-ios">${datos.planos.map((p) => `
          <li><button class="fila-ios" data-av="plano" data-id="${esc(p.id)}">
            <div class="fila-principal"><strong>${esc(p.nombre)}</strong><span class="sub">${esc(p.planta)}</span></div>
            <div class="sub">${esc((PL.DISCIPLINAS[p.disciplina] || PL.DISCIPLINAS.otra).nombre)} · ${p.capas.map((c) => esc(c.nombre)).join(', ')}${p.escala ? '' : ' · <strong class="mal">sin escala: no mide</strong>'}</div>
          </button></li>`).join('')}</ul>`
        : '<p class="vacio">Todavía no hay planos. Los sube el jefe de obra desde el ordenador (Planificación › Avance de obra).</p>';
    } else if (pestana === 'material') {
      cuerpo = `${datos.puede.crear ? '<button class="boton grande" data-av="material-nuevo">＋ Material no previsto</button>' : ''}
        <p class="nota">Lo que has tenido que poner y no estaba en el presupuesto. El jefe de obra lo acepta y entra como coste y como posible orden de cambio.</p>
        ${materiales.length ? `<ul class="lista-ios">${materiales.map((m) => `
          <li><div class="fila-ios">
            <div class="fila-principal"><strong>${esc(m.descripcion)}</strong><span class="chip ${TONO_MAT[m.estado] || 'neutra'}">${esc(m.estadoNombre)}</span></div>
            <div class="sub">${fechaEs(m.fecha)} · ${cant(m.cantidad, m.unidad)}${m.persona ? ` · ${esc(m.persona)}` : ''}${m.fotos ? ` · ${m.fotos} foto${m.fotos === 1 ? '' : 's'}` : ''}</div>
            ${m.nota ? `<div class="texto-2">${esc(m.nota)}</div>` : ''}${m.motivo ? `<div class="texto-2 mal">${esc(m.motivo)}</div>` : ''}
          </div></li>`).join('')}</ul>` : '<p class="vacio">Nada apuntado.</p>'}`;
    } else {
      cuerpo = pendientes.length
        ? `<button class="boton secundario" data-av="todas-vistas">Dar todas por vistas</button>
          <ul class="lista-ios">${pendientes.map((m) => `
          <li><div class="fila-ios">
            <div class="fila-principal"><strong><span class="av-punto" style="background:${esc(m.color)}"></span>${esc(m.capaNombre)} · ${cant(m.vale, m.unidad)}</strong><span class="sub">${fechaEs(m.fecha)}</span></div>
            <div class="sub">${esc(m.plano)}${m.persona ? ` · ${esc(m.persona)}` : ''}${m.extra ? ` · +${C.cifra(m.extra, 1)} m de subidas` : ''}${m.fotos ? ` · ${m.fotos} foto${m.fotos === 1 ? '' : 's'}` : ''}</div>
            ${m.nota ? `<div class="texto-2">${esc(m.nota)}</div>` : ''}
            <div class="campos"><button class="boton secundario" data-av="ver-en-plano" data-plano="${esc(m.planoId)}" data-id="${esc(m.id)}">En el plano</button>
              <button class="boton secundario" data-av="revisar" data-estado="descartada" data-id="${esc(m.id)}">Descartar</button>
              <button class="boton" data-av="revisar" data-estado="vista" data-id="${esc(m.id)}">Vista</button></div>
          </div></li>`).join('')}</ul>`
        : '<p class="vacio">Nada por revisar.</p>';
    }
    $app.innerHTML = `${banda()}
      <div class="segmentado" role="tablist">${tabs.map(([id, n]) => `<button role="tab" data-av-pestana="${id}" class="${pestana === id ? 'activa' : ''}" aria-selected="${pestana === id}">${esc(n)}</button>`).join('')}</div>
      ${cuerpo}`;
  }

  async function revisar(ids, estado, boton) {
    if (boton) boton.disabled = true;
    try {
      const r = await C.postJson('api/avance/revisar', { ids, estado });
      if (!r.ok) throw new Error(r.error);
      C.aviso(estado === 'vista' ? 'Dado por visto.' : 'Descartado.', 'bien');
      if (plano) { await cargarMarcas(); hoja = null; pintarPlano(); } else lista();
    } catch (e) { C.aviso(e.message); if (boton) boton.disabled = false; }
  }

  /* ═══════════════════════════════════ 4. Material fuera de presupuesto */

  function pintarMaterial() {
    const f = formMaterial;
    $app.innerHTML = `
      <button class="volver" data-av="lista">‹ Avance</button>
      <h2>Material no previsto</h2>
      <label>Qué material<input data-av-mat="descripcion" value="${esc(f.descripcion)}" placeholder="Codos DN50, soportes, manguitos…" autocomplete="off"></label>
      <div class="campos">
        <label>Cantidad<input type="number" inputmode="decimal" step="any" min="0" data-av-mat="cantidad" value="${esc(f.cantidad)}"></label>
        <label>Unidad<select data-av-mat="unidad">${['ud', 'm', 'm2', 'kg', 'l'].map((u) => `<option value="${u}" ${f.unidad === u ? 'selected' : ''}>${UNIDAD[u] || u}</option>`).join('')}</select></label>
      </div>
      <label>Día<input type="date" data-av-mat="fecha" value="${esc(f.fecha)}" max="${hoy()}"></label>
      <label>Por qué hizo falta<textarea rows="3" data-av-mat="nota" placeholder="Dónde y por qué">${esc(f.nota)}</textarea></label>
      <label class="interruptor"><input type="checkbox" data-av-mat-foto ${f.foto ? 'checked' : ''}> Añadir una foto al guardar</label>
      <button class="boton grande" data-av="material-guardar">Guardar</button>`;
  }

  async function guardarMaterial(boton) {
    const f = formMaterial;
    if (!f.descripcion.trim()) { C.aviso('Di qué material.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/avance/material', { obraId: C.obraId(), ...f });
      if (!r.ok) throw new Error(r.error);
      if (f.foto) await fotoA('api/avance/material/foto', r.id);
      C.aviso('Apuntado: le llega al jefe de obra.', 'bien');
      pestana = 'material';
      lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function fotoA(ruta, id) {
    const archivo = await C.elegirFoto(true);
    if (!archivo) return;
    const fotoId = await C.subirFoto(archivo);
    const r = await C.postJson(ruta, { id, fotos: [fotoId] });
    if (!r.ok) throw new Error(r.error);
  }

  /* ═══════════════════════════════════ 2. El plano */

  function cerrarPlano() {
    if (urlImagen) URL.revokeObjectURL(urlImagen);
    plano = null; urlImagen = null; marcas = []; dibujo = []; hoja = null;
  }

  async function abrirPlano(id, marcaId = null) {
    const p = datos.planos.find((x) => x.id === id);
    if (!p) return;
    cerrarPlano();
    plano = p;
    ocultas = new Set();
    capaActiva = (p.capas[0] || {}).id || null;
    modo = datos.puede.crear ? 'marcar' : 'mover';
    fecha = hoy();
    zoom = 1;
    $app.innerHTML = '<p class="cargando">Cargando el plano…</p>';
    try {
      const r = await fetch(`api/avance/plano?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error('No se ha podido traer la imagen del plano.');
      urlImagen = URL.createObjectURL(await r.blob());
      await cargarMarcas();
    } catch (e) { C.aviso(e.message); lista(); return; }
    if (!activa() || plano !== p) return;
    if (marcaId) { periodo = 'todo'; modo = 'mover'; const m = marcas.find((x) => x.id === marcaId); if (m) hoja = { tipo: 'ver', marca: m }; }
    pintarPlano();
    window.scrollTo(0, 0);
  }

  async function cargarMarcas() {
    const r = await C.pedir(`api/avance/marcas?obra=${encodeURIComponent(C.obraId())}&plano=${encodeURIComponent(plano.id)}`);
    if (!r.ok) throw new Error(r.error);
    marcas = r.marcas;
  }

  const capa = (id) => plano.capas.find((c) => c.id === id) || null;
  const desdePeriodo = () => (periodo === 'hoy' ? fecha : periodo === 'semana' ? haceDias(6) : '');
  const visibles = () => marcas.filter((m) => m.estado !== 'descartada' && !ocultas.has(m.capa)
    && (!desdePeriodo() || (m.fecha >= desdePeriodo() && m.fecha <= (periodo === 'hoy' ? fecha : '9999'))));

  function colores() {
    if (colorPor === 'capa') return (m) => m.color;
    const porDia = PL.coloresPorDia(visibles().map((m) => m.fecha));
    return (m) => porDia[m.fecha] || '#5f6368';
  }

  function leyenda() {
    if (colorPor === 'capa') return '';
    const porDia = PL.coloresPorDia(visibles().map((m) => m.fecha));
    const dias = Object.entries(porDia);
    return dias.length ? `<div class="av-leyenda">${dias.map(([d, c]) => `<span><i style="background:${c}"></i>${fechaEs(d)}</span>`).join('')}</div>` : '';
  }

  function pintarPlano() {
    const c = capa(capaActiva);
    const marcando = modo === 'marcar' && c;
    const medidoDibujo = marcando && c.tipo !== 'punto' && dibujo.length ? MED.medirMarca({ tipo: c.tipo, puntos: dibujo }, plano).cantidad : null;
    $app.innerHTML = `
      <button class="volver" data-av="lista">‹ Avance</button>
      <div class="fila-principal"><h2>${esc(plano.nombre)}</h2><span class="sub">${esc(plano.planta)}</span></div>
      ${plano.escala ? '' : '<p class="nota aviso">Este plano no tiene escala: se marca, pero no mide. El jefe de obra la pone en el ordenador.</p>'}
      <div class="av-capas">${plano.capas.map((k) => `
        <button class="av-capa ${k.id === capaActiva ? 'activa' : ''} ${ocultas.has(k.id) ? 'oculta' : ''}" data-av-capa="${esc(k.id)}" style="--c:${esc(k.color)}">
          <span class="av-ojo" data-av-ojo="${esc(k.id)}" aria-label="${ocultas.has(k.id) ? 'Enseñar' : 'Ocultar'}">${ocultas.has(k.id) ? '○' : '●'}</span>${esc(k.nombre)}
        </button>`).join('')}</div>
      <div class="av-barra">
        ${datos.puede.crear ? `<div class="segmentado mini">${[['marcar', 'Marcar'], ['mover', 'Mover']].map(([id, n]) => `<button data-av-modo="${id}" class="${modo === id ? 'activa' : ''}">${n}</button>`).join('')}</div>` : ''}
        <label class="mini">Día<input type="date" data-av-fecha value="${esc(fecha)}" max="${hoy()}"></label>
        <div class="segmentado mini">${[['hoy', 'Ese día'], ['semana', '7 días'], ['todo', 'Todo']].map(([id, n]) => `<button data-av-periodo="${id}" class="${periodo === id ? 'activa' : ''}">${n}</button>`).join('')}</div>
        <div class="segmentado mini">${[['capa', 'Color por capa'], ['dia', 'Por día']].map(([id, n]) => `<button data-av-color="${id}" class="${colorPor === id ? 'activa' : ''}">${n}</button>`).join('')}</div>
        <div class="segmentado mini"><button data-av-zoom="-1">−</button><button data-av-zoom="1">＋</button></div>
      </div>
      ${leyenda()}
      ${marcando ? `<p class="nota">${c.tipo === 'punto' ? `Toca en el plano cada ${esc(c.nombre.toLowerCase())} hecho.` : c.tipo === 'trazo' ? `Toca punto a punto el recorrido de ${esc(c.nombre.toLowerCase())}${medidoDibujo !== null ? ` · <strong>${cant(medidoDibujo, 'm')}</strong>` : ''}` : `Toca las esquinas de la zona${medidoDibujo !== null ? ` · <strong>${cant(medidoDibujo, 'm2')}</strong>` : ''}`}</p>` : ''}
      ${marcando && dibujo.length && c.tipo !== 'punto' ? `<div class="campos"><button class="boton secundario" data-av="deshacer">Deshacer</button><button class="boton secundario" data-av="borrar-dibujo">Borrar</button><button class="boton" data-av="terminar">Terminar</button></div>` : ''}
      <div class="av-lienzo ${marcando ? 'marcando' : ''}" data-av-lienzo>
        <div class="av-hoja-plano" style="width:${Math.round(zoom * 100)}%">
          <img src="${urlImagen}" alt="" draggable="false">
          <svg viewBox="0 0 ${plano.ancho || 1000} ${plano.alto || 1000}" preserveAspectRatio="none" data-av-svg></svg>
        </div>
      </div>
      <p class="sub">${visibles().length} marca${visibles().length === 1 ? '' : 's'} a la vista${modo === 'mover' ? ' · toca una para verla' : ''}</p>
      ${hoja ? pintarHoja() : ''}`;
    dibujarSvg();
  }

  function dibujarSvg() {
    const svg = $app.querySelector('[data-av-svg]');
    if (!svg) return;
    const W = plano.ancho || 1000; const H = plano.alto || 1000;
    const grosor = Math.max(W, H) / 220 / zoom;
    const color = colores();
    const pts = (lista) => lista.map((q) => `${(q.x * W).toFixed(1)},${(q.y * H).toFixed(1)}`).join(' ');
    let html = '';
    for (const m of visibles()) {
      const col = color(m);
      const atenuada = m.estado === 'certificada' ? ' opacity=".45"' : '';
      if (m.tipo === 'punto' && m.puntos[0]) {
        html += `<circle data-av-marca="${esc(m.id)}" cx="${m.puntos[0].x * W}" cy="${m.puntos[0].y * H}" r="${grosor * 2.4}" fill="${col}" stroke="#fff" stroke-width="${grosor / 2}"${atenuada}/>`;
      } else if (m.tipo === 'zona') {
        html += `<polygon data-av-marca="${esc(m.id)}" points="${pts(m.puntos)}" fill="${col}" fill-opacity=".28" stroke="${col}" stroke-width="${grosor}"${atenuada}/>`;
      } else {
        html += `<polyline data-av-marca="${esc(m.id)}" points="${pts(m.puntos)}" fill="none" stroke="${col}" stroke-width="${grosor * 1.6}" stroke-linecap="round" stroke-linejoin="round"${atenuada}/>`;
      }
    }
    const c = capa(capaActiva);
    if (dibujo.length && c) {
      if (c.tipo === 'zona' && dibujo.length > 2) html += `<polygon points="${pts(dibujo)}" fill="${c.color}" fill-opacity=".2" stroke="${c.color}" stroke-width="${grosor}" stroke-dasharray="${grosor * 3}"/>`;
      else html += `<polyline points="${pts(dibujo)}" fill="none" stroke="${c.color}" stroke-width="${grosor * 1.6}" stroke-dasharray="${grosor * 3}" stroke-linecap="round"/>`;
      for (const q of dibujo) html += `<circle cx="${q.x * W}" cy="${q.y * H}" r="${grosor * 1.4}" fill="#fff" stroke="${c.color}" stroke-width="${grosor / 1.5}"/>`;
    }
    svg.innerHTML = html;
  }

  /* Un toque en el plano: en «Marcar», un punto más; en «Mover», la marca que haya. */
  function tocarPlano(ev) {
    const svg = $app.querySelector('[data-av-svg]');
    if (!svg) return;
    if (modo === 'mover') {
      const el = ev.target.closest('[data-av-marca]');
      const m = el && marcas.find((x) => x.id === el.dataset.avMarca);
      if (m) { hoja = { tipo: 'ver', marca: m }; pintarPlano(); }
      return;
    }
    const c = capa(capaActiva);
    if (!c || !datos.puede.crear) return;
    const r = svg.getBoundingClientRect();
    const q = { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
    if (c.tipo === 'punto') { dibujo = [q]; abrirHojaGuardar(); return; }
    dibujo.push(q);
    pintarPlano();
  }

  /* ═══════════════════════════════════ 3. La hoja */

  function abrirHojaGuardar() {
    const c = capa(capaActiva);
    const minimo = c.tipo === 'punto' ? 1 : c.tipo === 'trazo' ? 2 : 3;
    if (dibujo.length < minimo) { C.aviso(c.tipo === 'trazo' ? 'Toca al menos dos puntos.' : 'Toca al menos tres esquinas.', 'aviso'); return; }
    hoja = { tipo: 'guardar', nota: '', extra: '', extraNota: '', cantidad: '', lineaId: c.lineaIds.length === 1 ? c.lineaIds[0] : '', foto: false };
    pintarPlano();
  }

  function pintarHoja() {
    if (hoja.tipo === 'ver') {
      const m = hoja.marca;
      const mia = m.personaId === datos.yo;
      return `<div class="hoja-fondo abierta" data-av="cerrar-hoja"></div><div class="hoja abierta" role="dialog">
        <div class="asa"></div>
        <h3><span class="av-punto" style="background:${esc(m.color)}"></span>${esc(m.capaNombre)} · ${cant(m.vale, m.unidad)}</h3>
        <p class="sub">${fechaEs(m.fecha)}${m.persona ? ` · ${esc(m.persona)}` : ''} · ${chipMarca(m)}</p>
        <section class="grupo">
          ${m.medido !== null && m.tipo !== 'punto' ? `<div class="fila-dato"><span>Medido en el plano</span><strong>${cant(m.medido, m.unidad)}</strong></div>` : ''}
          ${m.extra ? `<div class="fila-dato"><span>Subidas y bajadas${m.extraNota ? ` (${esc(m.extraNota)})` : ''}</span><strong>+${cant(m.extra, 'm')}</strong></div>` : ''}
          ${m.cantidad !== null ? `<div class="fila-dato"><span>Puesto a mano</span><strong>${cant(m.cantidad, m.unidad)}</strong></div>` : ''}
          ${m.codigo ? `<div class="fila-dato"><span>Partida</span><strong>${esc(m.codigo)} ${esc(m.resumen)}</strong></div>` : ''}
          ${m.vistaPor ? `<div class="fila-dato"><span>Revisada por</span><strong>${esc(m.vistaPor)}</strong></div>` : ''}
        </section>
        ${m.nota ? `<p class="texto-ficha">${esc(m.nota)}</p>` : ''}
        ${m.fotos ? `<div class="fotos">${Array.from({ length: m.fotos }, (_, i) => `<img data-src="api/avance/foto?id=${encodeURIComponent(m.id)}&i=${i}" alt="">`).join('')}</div>` : ''}
        ${(mia && m.estado === 'pendiente') || datos.puede.aprobar ? `<button class="boton secundario" data-av="foto-marca">Añadir foto</button>` : ''}
        ${datos.puede.aprobar && m.estado !== 'certificada' ? `<div class="campos">
          ${m.estado !== 'descartada' ? '<button class="boton secundario" data-av="revisar-hoja" data-estado="descartada">Descartar</button>' : ''}
          ${m.estado !== 'vista' ? '<button class="boton" data-av="revisar-hoja" data-estado="vista">Vista</button>' : '<button class="boton secundario" data-av="revisar-hoja" data-estado="pendiente">Volver a pendiente</button>'}
        </div>` : ''}
        <button class="boton cancelar" data-av="cerrar-hoja">Cerrar</button>
      </div>`;
    }
    const c = capa(capaActiva);
    const medido = MED.medirMarca({ tipo: c.tipo, puntos: dibujo }, plano);
    const partidas = (datos.partidas || []).filter((p) => !c.lineaIds.length || c.lineaIds.includes(p.lineaId));
    return `<div class="hoja-fondo abierta" data-av="cerrar-hoja"></div><div class="hoja abierta" role="dialog">
      <div class="asa"></div>
      <h3>${esc(c.nombre)}${c.tipo === 'punto' ? '' : ` · ${cant(medido.cantidad, medido.unidad)}`}</h3>
      <p class="sub">${fechaEs(fecha)} · ${esc(plano.nombre)}</p>
      ${c.tipo === 'trazo' ? `<div class="campos">
        <label>Subidas y bajadas (m)<input type="number" inputmode="decimal" step="any" min="0" data-av-h="extra" value="${esc(hoja.extra)}" placeholder="0"></label>
        <label>Dónde<input data-av-h="extraNota" value="${esc(hoja.extraNota)}" placeholder="Bajantes a equipos…"></label>
      </div>` : ''}
      <label>${c.tipo === 'punto' ? 'Cuántas unidades (si es más de una)' : 'O la cantidad a mano, si la sabes'}<input type="number" inputmode="decimal" step="any" min="0" data-av-h="cantidad" value="${esc(hoja.cantidad)}" placeholder="${c.tipo === 'punto' ? '1' : 'Lo medido'}"></label>
      ${partidas.length > 1 || (!c.lineaIds.length && partidas.length) ? `<label>Partida<select data-av-h="lineaId"><option value="">—</option>${partidas.map((p) => `<option value="${esc(p.lineaId)}" ${p.lineaId === hoja.lineaId ? 'selected' : ''}>${esc(p.codigo)} ${esc(p.resumen)}</option>`).join('')}</select></label>` : ''}
      <label>Nota<textarea rows="2" data-av-h="nota" placeholder="Tramo, local, lo que haga falta">${esc(hoja.nota)}</textarea></label>
      <label class="interruptor"><input type="checkbox" data-av-h-foto ${hoja.foto ? 'checked' : ''}> Añadir una foto al guardar</label>
      <button class="boton grande" data-av="guardar-marca">Guardar</button>
      <button class="boton cancelar" data-av="cerrar-hoja">Cancelar</button>
    </div>`;
  }

  async function guardarMarca(boton) {
    boton.disabled = true;
    const h = hoja;
    try {
      const r = await C.postJson('api/avance/marca', {
        planoId: plano.id, capa: capaActiva, fecha, puntos: dibujo, nota: h.nota, extra: h.extra, extraNota: h.extraNota,
        cantidad: h.cantidad, lineaId: h.lineaId || undefined,
      });
      if (!r.ok) throw new Error(r.error);
      if (h.foto) { try { await fotoA('api/avance/foto', r.id); } catch (e) { C.aviso(e.message); } }
      dibujo = []; hoja = null;
      await cargarMarcas();
      C.aviso('Marcado: le llega al jefe de obra.', 'bien');
      pintarPlano();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ Eventos */

  $app.addEventListener('click', async (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const pe = t.closest('[data-av-pestana]');
    if (pe) { pestana = pe.dataset.avPestana; pintarLista(); return; }
    const ojo = t.closest('[data-av-ojo]');
    if (ojo) { const id = ojo.dataset.avOjo; if (ocultas.has(id)) ocultas.delete(id); else ocultas.add(id); pintarPlano(); return; }
    const ca = t.closest('[data-av-capa]');
    if (ca) { capaActiva = ca.dataset.avCapa; ocultas.delete(capaActiva); dibujo = []; pintarPlano(); return; }
    const mo = t.closest('[data-av-modo]');
    if (mo) { modo = mo.dataset.avModo; dibujo = []; pintarPlano(); return; }
    const pr = t.closest('[data-av-periodo]');
    if (pr) { periodo = pr.dataset.avPeriodo; pintarPlano(); return; }
    const co = t.closest('[data-av-color]');
    if (co) { colorPor = co.dataset.avColor; pintarPlano(); return; }
    const zo = t.closest('[data-av-zoom]');
    if (zo) { zoom = Math.min(4, Math.max(1, zoom + Number(zo.dataset.avZoom) * 0.5)); pintarPlano(); return; }
    if (plano && !hoja && t.closest('[data-av-svg]')) { tocarPlano(ev); return; }
    const b = t.closest('[data-av]');
    if (!b) return;
    const a = b.dataset.av;
    if (a === 'lista') lista();
    else if (a === 'plano') abrirPlano(b.dataset.id);
    else if (a === 'ver-en-plano') abrirPlano(b.dataset.plano, b.dataset.id);
    else if (a === 'revisar') revisar([b.dataset.id], b.dataset.estado, b);
    else if (a === 'todas-vistas') revisar(pendientes.map((m) => m.id), 'vista', b);
    else if (a === 'revisar-hoja') revisar([hoja.marca.id], b.dataset.estado, b);
    else if (a === 'material-nuevo') { formMaterial = { descripcion: '', cantidad: '1', unidad: 'ud', fecha: hoy(), nota: '', foto: false }; pintarMaterial(); }
    else if (a === 'material-guardar') guardarMaterial(b);
    else if (a === 'deshacer') { dibujo.pop(); pintarPlano(); }
    else if (a === 'borrar-dibujo') { dibujo = []; pintarPlano(); }
    else if (a === 'terminar') abrirHojaGuardar();
    else if (a === 'cerrar-hoja') { if (hoja && hoja.tipo === 'guardar' && capa(capaActiva).tipo === 'punto') dibujo = []; hoja = null; pintarPlano(); }
    else if (a === 'guardar-marca') guardarMarca(b);
    else if (a === 'foto-marca') {
      try { await fotoA('api/avance/foto', hoja.marca.id); await cargarMarcas(); hoja = { tipo: 'ver', marca: marcas.find((m) => m.id === hoja.marca.id) }; C.aviso('Foto añadida.', 'bien'); pintarPlano(); } catch (e) { C.aviso(e.message); }
    }
  });

  const recoger = (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (formMaterial && t.dataset.avMat) formMaterial[t.dataset.avMat] = t.value;
    if (formMaterial && t.hasAttribute('data-av-mat-foto')) formMaterial.foto = t.checked;
    if (hoja && t.dataset.avH) hoja[t.dataset.avH] = t.value;
    if (hoja && t.hasAttribute('data-av-h-foto')) hoja.foto = t.checked;
    if (ev.type === 'change' && t.hasAttribute('data-av-fecha') && t.value) { fecha = t.value; pintarPlano(); }
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  /* Las fotos de la hoja de una marca se traen con la sesión. */
  new MutationObserver(() => { if (activa() && $app.querySelector('img[data-src]')) C.cargarImagenes($app); }).observe($app, { childList: true, subtree: true });

  window.addEventListener('movil:obra', () => { if (activa()) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); else cerrarPlano(); });
  if (activa()) lista();
})();
