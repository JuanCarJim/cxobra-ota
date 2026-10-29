'use strict';
/*
 * INVENTARIO EN EL MÓVIL (#inventario), para el operario y el encargado.
 *
 *   ALMACÉN      cada material con lo que DEBERÍA haber (lo calcula la oficina
 *                y baja sin precios), lo que HAY (último recuento + entradas y
 *                devoluciones − salidas desde entonces), dónde está y un
 *                buscador. Se toca una fila para contarla o moverla.
 *   MOVIMIENTOS  los últimos recuentos y movimientos de la obra, con fecha y
 *                persona.
 *   PEDIDOS      (solo si el rol ve las compras) la tabla de siempre: pedido,
 *                llegado e instalado.
 *
 * CONTAR apunta el material en un recuento en borrador (se conserva aunque se
 * cierre la app); «Guardar recuento» lo guarda con la fecha y quien lo hizo, y
 * la sincronización lo lleva a la conciliación del almacén de la oficina.
 * ENTRADA, SALIDA A TAJO y DEVOLUCIÓN se guardan al momento. Todo se escribe en
 * la base del teléfono, así que funciona sin cobertura y se sube después.
 * Sin dinero: ni coste ni venta salen en ninguna parte.
 */
(function inventario() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, cifra } = C;
  const activa = () => C.activa('inventario');

  const POR_PAGINA = 60;
  let datos = null;       // api/inventario/almacen
  let pedidos = null;     // api/inventario (la tabla de pedidos)
  let pestana = 'almacen';
  let filtro = 'todo';
  let texto = '';
  let abierta = null;     // clave del material que se está tocando ('__nuevo' = material fuera de la lista)
  let edicion = {};       // lo escrito en el editor abierto
  let limite = POR_PAGINA;
  let ocupado = false;
  let borrador = new Map(); // clave → línea del recuento sin guardar

  const num = (v) => (v === null || v === undefined ? '—' : cifra(v, Number.isInteger(Number(v)) ? 0 : 2));
  const clave = () => `cx.inv.borrador.${C.obraId()}`;

  function leerBorrador() {
    borrador = new Map();
    try {
      const j = JSON.parse(localStorage.getItem(clave()) || '[]');
      for (const l of Array.isArray(j) ? j : []) if (l && l.clave) borrador.set(l.clave, l);
    } catch { /* sin almacenamiento: el borrador vive mientras la pantalla */ }
  }
  function guardarBorrador() {
    try {
      if (borrador.size) localStorage.setItem(clave(), JSON.stringify([...borrador.values()]));
      else localStorage.removeItem(clave());
    } catch { /* sin almacenamiento */ }
  }

  async function cargar({ quieto = false } = {}) {
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    const y = window.scrollY;
    if (!quieto) $app.innerHTML = '<p class="cargando">Cargando…</p>';
    leerBorrador();
    try {
      datos = await C.pedir(`api/inventario/almacen?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-inv="cargar">Reintentar</button></div>`;
      return;
    }
    if (!activa()) return;
    if (pestana === 'pedidos' && !datos.puede.pedidos) pestana = 'almacen';
    if (pestana === 'pedidos') await cargarPedidos();
    pintar();
    if (quieto) window.scrollTo(0, y);
  }

  async function cargarPedidos() {
    try {
      pedidos = await C.pedir(`api/inventario?obra=${encodeURIComponent(C.obraId())}`);
      if (!pedidos.ok) throw new Error(pedidos.error);
    } catch (e) {
      pedidos = { ok: false, error: e.message };
    }
  }

  /* ── Lo común */

  function cabecera() {
    const tabs = [['almacen', 'Almacén'], ['mov', 'Movimientos']];
    if (datos.puede.pedidos) tabs.push(['pedidos', 'Pedidos']);
    return `<div class="segmentado">${tabs.map(([id, n]) => `<button data-inv-pestana="${id}" class="${pestana === id ? 'activa' : ''}">${esc(n)}</button>`).join('')}</div>`;
  }

  function barraBorrador() {
    if (!borrador.size) return '';
    return `<div class="invc-borrador">
      <span><b>${cifra(borrador.size)}</b> ${borrador.size === 1 ? 'material contado' : 'materiales contados'} sin registrar</span>
      <button class="boton" data-inv="guardar" ${ocupado ? 'disabled' : ''}>Registrar recuento</button>
      <button class="boton secundario" data-inv="descartar">Descartar</button>
    </div>`;
  }

  /* ── El almacén */

  function estadoFila(f) {
    if (f.hay === null || f.deberiaHaber === null) return '';
    const d = f.hay - f.deberiaHaber;
    return Math.abs(d) < 0.001 ? 'bien' : d < 0 ? 'aviso' : 'info';
  }

  const pasa = (f) => {
    if (filtro === 'porContar') return f.contado === null && !f.fuera && !borrador.has(f.clave);
    if (filtro === 'contados') return f.contado !== null || borrador.has(f.clave);
    if (filtro === 'fuera') return f.fuera;
    return true;
  };

  function editor(f) {
    const nuevo = f === null;
    const e = edicion;
    return `<div class="invc-editor" data-inv-editor>
      ${nuevo ? `<div class="campos">
        <label>Material<input type="text" data-inv-campo="descripcion" value="${esc(e.descripcion || '')}" placeholder="Qué es"></label>
        <label>Código<input type="text" data-inv-campo="codigo" value="${esc(e.codigo || '')}" placeholder="Opcional"></label>
        <label>Unidad<input type="text" data-inv-campo="unidad" value="${esc(e.unidad || '')}" placeholder="ud, m, kg…"></label>
      </div>` : ''}
      <div class="campos">
        <label>Cantidad<input type="text" inputmode="decimal" data-inv-campo="cantidad" value="${esc(e.cantidad ?? '')}" placeholder="0"></label>
        <label>Ubicación<input type="text" data-inv-campo="ubicacion" value="${esc(e.ubicacion ?? '')}" placeholder="Dónde está"></label>
      </div>
      <label>Nota (opcional)<input type="text" data-inv-campo="notas" value="${esc(e.notas ?? '')}"></label>
      <div class="invc-botones">
        <button class="boton" data-inv="contar">Contar</button>
        <button class="boton secundario" data-inv-mov="entrada" ${ocupado ? 'disabled' : ''}>Entrada</button>
        <button class="boton secundario" data-inv-mov="salida" ${ocupado ? 'disabled' : ''}>Salida a tajo</button>
        <button class="boton secundario" data-inv-mov="devolucion" ${ocupado ? 'disabled' : ''}>Devolución</button>
      </div>
      <p class="nota">«Contar» apunta lo que hay ahora en el almacén. Entrada, salida y devolución se guardan al momento y suman o restan a lo contado.</p>
    </div>`;
  }

  function filaAlmacen(f) {
    const b = borrador.get(f.clave);
    const cls = estadoFila(f);
    const sub = [f.codigo, f.unidad, f.ubicacion].filter(Boolean).join(' · ');
    const marca = b ? `<span class="chip info">Contado: ${esc(num(b.cantidad))}</span>`
      : f.contado === null ? '<span class="chip neutra">Sin contar</span>'
        : `<span class="chip neutra">Contado ${esc(num(f.contado))} · ${esc(C.fechaEs ? C.fechaEs(f.contadoEn) : f.contadoEn)}${f.contadoPor ? ` · ${esc(f.contadoPor)}` : ''}</span>`;
    const mov = [f.entradas && `+${num(f.entradas)} entrada`, f.devoluciones && `+${num(f.devoluciones)} devuelto`, f.salidas && `−${num(f.salidas)} a tajo`].filter(Boolean).join(' · ');
    return `<div class="invc-fila ${abierta === f.clave ? 'abierta' : ''}" data-inv-fila="${esc(f.clave)}">
        <div class="mat"><strong>${esc(f.descripcion || f.codigo)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}<small>${marca}${mov ? ` <span class="tenue">${esc(mov)}</span>` : ''}${f.fuera ? ' <span class="chip aviso">Fuera de la lista</span>' : ''}</small></div>
        <b>${f.fuera ? '—' : num(f.deberiaHaber)}</b>
        <b class="${cls}">${num(f.hay)}</b>
      </div>${abierta === f.clave ? editor(f) : ''}`;
  }

  function pintarAlmacen() {
    const q = texto.trim().toLowerCase();
    const todas = datos.filas;
    const filas = todas.filter(pasa).filter((f) => !q || `${f.descripcion} ${f.codigo || ''} ${f.ubicacion || ''}`.toLowerCase().includes(q));
    const visibles = filas.slice(0, limite);
    const sinContar = todas.filter((f) => f.contado === null && !f.fuera).length;
    const FILTROS = [['todo', 'Todo'], ['porContar', 'Por contar'], ['contados', 'Contados'], ['fuera', 'Fuera de lista']];
    return `
      ${barraBorrador()}
      <div class="segmentado">${FILTROS.map(([id, n]) => `<button data-inv-filtro="${id}" class="${filtro === id ? 'activa' : ''}">${esc(n)}</button>`).join('')}</div>
      <input type="search" class="buscar" placeholder="Buscar material, código o ubicación" value="${esc(texto)}" data-inv-buscar>
      <p class="nota">${todas.length ? `${cifra(todas.length)} materiales · ${cifra(sinContar)} sin contar. Toca uno para contarlo o moverlo.` : 'La oficina aún no ha bajado la lista de esta obra: puedes contar y mover igualmente.'}</p>
      ${datos.puede.contar ? `<button class="boton secundario invc-nuevo" data-inv="nuevo">${abierta === '__nuevo' ? 'Cerrar' : '+ Material que no está en la lista'}</button>` : ''}
      ${abierta === '__nuevo' ? editor(null) : ''}
      ${visibles.length ? `<div class="invc"><div class="cab"><span>Material</span><span>Debería</span><span>Hay</span></div>${visibles.map(filaAlmacen).join('')}</div>
        ${filas.length > visibles.length ? `<button class="boton secundario" data-inv="mas">Ver ${cifra(Math.min(POR_PAGINA, filas.length - visibles.length))} más (${cifra(filas.length - visibles.length)} sin ver)</button>` : ''}`
    : `<p class="vacio">${q || filtro !== 'todo' ? 'Nada con ese filtro.' : 'Esta obra no tiene materiales todavía.'}</p>`}`;
  }

  /* ── Los movimientos */

  function pintarMovimientos() {
    const fecha = (v) => (C.fechaEs ? C.fechaEs(v) : v);
    const movs = datos.movimientos;
    const recs = datos.recuentos;
    return `
      <h3 class="invc-titulo">Movimientos</h3>
      ${movs.length ? `<div class="invc"><div class="cab cab-mov"><span>Material</span><span>Cantidad</span></div>${movs.map((m) => `<div class="invc-fila mov">
        <div class="mat"><strong>${esc(m.descripcion || m.codigo)}</strong><small><span class="chip ${m.tipo === 'salida' ? 'aviso' : m.tipo === 'entrada' ? 'bien' : 'info'}">${esc(m.tipoTexto)}</span> ${esc(fecha(m.fecha))}${m.persona ? ` · ${esc(m.persona)}` : ''}${m.ubicacion ? ` · ${esc(m.ubicacion)}` : ''}</small>${m.notas ? `<small>${esc(m.notas)}</small>` : ''}</div>
        <b>${m.tipo === 'salida' ? '−' : '+'}${num(m.cantidad)}${m.unidad ? ` <small>${esc(m.unidad)}</small>` : ''}</b>
      </div>`).join('')}</div>` : '<p class="vacio">Todavía no hay movimientos en esta obra.</p>'}
      <h3 class="invc-titulo">Recuentos</h3>
      ${recs.length ? `<div class="invc"><div class="cab cab-mov"><span>Recuento</span><span>Líneas</span></div>${recs.map((r) => `<div class="invc-fila mov">
        <div class="mat"><strong>${esc(r.nombre)}</strong><small>${esc(fecha(r.fecha))}${r.persona ? ` · ${esc(r.persona)}` : ''}</small></div>
        <b>${cifra(r.lineas)}</b>
      </div>`).join('')}</div>` : '<p class="vacio">Todavía no hay recuentos hechos desde el móvil.</p>'}`;
  }

  /* ── Los pedidos (la tabla de siempre) */

  const ESTADO = { pedido: ['neutra', 'Pedido'], parcial: ['aviso', 'Parcial'], enObra: ['info', 'En obra'], instalado: ['bien', 'Instalado'] };

  function pintarPedidos() {
    if (!pedidos || !pedidos.ok) return `<div class="vacio mal"><p>${esc((pedidos && pedidos.error) || 'No se han podido cargar los pedidos.')}</p></div>`;
    const q = texto.trim().toLowerCase();
    const filas = (pedidos.filas || []).filter((f) => !q || `${f.descripcion} ${f.referencia || ''} ${f.pedido || ''} ${f.proveedor || ''}`.toLowerCase().includes(q));
    return `
      <input type="search" class="buscar" placeholder="Buscar material, referencia o pedido" value="${esc(texto)}" data-inv-buscar>
      ${filas.length ? `<div class="invc"><div class="cab cab-ped"><span>Material</span><span>Pedido</span><span>Llegado</span><span>Instal.</span></div>${filas.slice(0, 300).map((f) => {
    const [clase, nombre] = ESTADO[f.estado] || ['neutra', f.estado];
    return `<div class="invc-fila ped">
      <div class="mat"><strong>${esc(f.descripcion)}</strong><small>${esc([f.referencia, f.unidad, f.pedido].filter(Boolean).join(' · '))} <span class="chip ${clase}">${esc(nombre)}</span></small></div>
      <b>${num(f.cantidadPedida)}</b><b class="${f.faltaLlegar ? 'aviso' : ''}">${num(f.llegado)}</b><b class="${f.estado === 'instalado' ? 'bien' : ''}">${num(f.instalado)}</b>
    </div>`;
  }).join('')}</div>` : `<p class="vacio">${q ? 'Nada con ese filtro.' : 'Esta obra no tiene pedidos.'}</p>`}`;
  }

  function pintar() {
    if (!datos) return;
    $app.innerHTML = cabecera() + (pestana === 'mov' ? pintarMovimientos() : pestana === 'pedidos' ? pintarPedidos() : pintarAlmacen());
  }

  /* ── Acciones */

  function materialAbierto() {
    if (abierta === '__nuevo') {
      return { codigo: llano(edicion.codigo), descripcion: llano(edicion.descripcion), unidad: llano(edicion.unidad), clave: null };
    }
    const f = datos.filas.find((x) => x.clave === abierta);
    return f ? { codigo: f.codigo || '', descripcion: f.descripcion || '', unidad: f.unidad || '', clave: f.clave } : null;
  }
  const llano = (v) => String(v ?? '').trim();
  const cantidadValida = (t) => {
    const s = llano(t).replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  function contar() {
    const m = materialAbierto();
    if (!m) return;
    if (!m.codigo && !m.descripcion) { C.aviso('Pon qué material es.'); return; }
    const n = cantidadValida(edicion.cantidad);
    if (n === null || n < 0) { C.aviso('Pon la cantidad contada (0 si no queda nada).'); return; }
    const k = m.clave || `nuevo:${(m.codigo || m.descripcion).toLowerCase()}|${m.unidad.toLowerCase()}`;
    borrador.set(k, { clave: k, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad, cantidad: n, ubicacion: llano(edicion.ubicacion), notas: llano(edicion.notas) });
    guardarBorrador();
    abierta = null; edicion = {};
    pintar();
  }

  async function guardarRecuento() {
    if (ocupado || !borrador.size) return;
    ocupado = true; pintar();
    try {
      const r = await C.postJson('api/inventario/recuento', { obraId: C.obraId(), lineas: [...borrador.values()] });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar el recuento.');
      borrador = new Map(); guardarBorrador();
      C.aviso('Recuento guardado', 'bien');
      ocupado = false;
      await cargar({ quieto: true });
    } catch (e) {
      ocupado = false; pintar();
      C.aviso(e.message);
    }
  }

  async function mover(tipo) {
    if (ocupado) return;
    const m = materialAbierto();
    if (!m) return;
    if (!m.codigo && !m.descripcion) { C.aviso('Pon qué material es.'); return; }
    const n = cantidadValida(edicion.cantidad);
    if (n === null || n <= 0) { C.aviso('Pon la cantidad movida.'); return; }
    ocupado = true;
    try {
      const r = await C.postJson('api/inventario/movimiento', {
        obraId: C.obraId(), tipo, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad,
        cantidad: n, ubicacion: llano(edicion.ubicacion), notas: llano(edicion.notas),
      });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar el movimiento.');
      C.aviso(tipo === 'entrada' ? 'Entrada guardada' : tipo === 'salida' ? 'Salida a tajo guardada' : 'Devolución guardada', 'bien');
      abierta = null; edicion = {};
      ocupado = false;
      await cargar({ quieto: true });
    } catch (e) {
      ocupado = false;
      C.aviso(e.message);
    }
  }

  function abrirFila(k) {
    if (abierta === k) { abierta = null; edicion = {}; pintar(); return; }
    abierta = k;
    const f = datos.filas.find((x) => x.clave === k);
    const b = borrador.get(k);
    edicion = b ? { cantidad: b.cantidad, ubicacion: b.ubicacion, notas: b.notas }
      : { cantidad: '', ubicacion: f && f.ubicacion ? f.ubicacion : '', notas: '' };
    pintar();
    const el = $app.querySelector('[data-inv-campo="cantidad"]');
    if (el) el.focus();
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const p = t.closest('[data-inv-pestana]');
    if (p) {
      pestana = p.dataset.invPestana; abierta = null; edicion = {}; texto = ''; limite = POR_PAGINA;
      if (pestana === 'pedidos') cargarPedidos().then(() => { if (activa()) pintar(); });
      else pintar();
      return;
    }
    const f = t.closest('[data-inv-filtro]');
    if (f) { filtro = f.dataset.invFiltro; limite = POR_PAGINA; pintar(); return; }
    const m = t.closest('[data-inv-mov]');
    if (m) { mover(m.dataset.invMov); return; }
    const a = t.closest('[data-inv]');
    if (a) {
      const que = a.dataset.inv;
      if (que === 'cargar') cargar();
      else if (que === 'contar') contar();
      else if (que === 'guardar') guardarRecuento();
      else if (que === 'descartar') { borrador = new Map(); guardarBorrador(); pintar(); }
      else if (que === 'mas') { limite += POR_PAGINA; pintar(); }
      else if (que === 'nuevo') { if (abierta === '__nuevo') { abierta = null; edicion = {}; } else { abierta = '__nuevo'; edicion = {}; } pintar(); }
      return;
    }
    if (t.closest('[data-inv-editor]')) return;
    const fila = t.closest('[data-inv-fila]');
    if (fila && pestana === 'almacen' && datos.puede.contar) abrirFila(fila.dataset.invFila);
  });

  $app.addEventListener('input', (ev) => {
    if (!activa()) return;
    const t = ev.target;
    if (t.hasAttribute('data-inv-campo')) { edicion[t.dataset.invCampo] = t.value; return; }
    if (!t.hasAttribute('data-inv-buscar')) return;
    texto = t.value; limite = POR_PAGINA;
    const pos = t.selectionStart;
    pintar();
    const i = $app.querySelector('[data-inv-buscar]');
    if (i) { i.focus(); i.setSelectionRange(pos, pos); }
  });

  window.addEventListener('movil:obra', () => { if (activa()) { abierta = null; edicion = {}; texto = ''; filtro = 'todo'; limite = POR_PAGINA; cargar(); } });
  window.addEventListener('hashchange', () => { if (activa()) cargar(); });
  if (activa()) cargar();
})();
