'use strict';
/*
 * COMPRAS › INVENTARIO EN EL MÓVIL (#inventario).
 *
 * Lo pedido de la obra, línea a línea, en tres columnas:
 *   PEDIDO    lo que dicen los pedidos;
 *   LLEGADO   lo que suman los albaranes recepcionados;
 *   INSTALADO lo certificado en la última certificación (si la obra no tiene
 *             presupuesto de costes enlazado, no se sabe: sale «—»).
 * Sin un euro: es para el encargado que tiene el material delante. Las
 * cuentas son las del escritorio (electron/data/inventario.js).
 */
(function inventario() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, cifra } = C;
  const activa = () => C.activa('inventario');

  let datos = null;
  let filtro = 'todo';
  let texto = '';

  const ESTADO = { pedido: ['neutra', 'Pedido'], parcial: ['aviso', 'Parcial'], enObra: ['info', 'En obra'], instalado: ['bien', 'Instalado'] };
  const FILTROS = [['todo', 'Todo'], ['porLlegar', 'Por llegar'], ['enObra', 'En obra'], ['instalado', 'Instalado']];
  const pasa = (f) => (filtro === 'todo' ? true : filtro === 'porLlegar' ? f.estado === 'pedido' || f.estado === 'parcial' : f.estado === filtro);
  const num = (v) => (v === null || v === undefined ? '—' : cifra(v, Number.isInteger(Number(v)) ? 0 : 2));

  async function cargar() {
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await C.pedir(`api/inventario?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-inv="cargar">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintar();
  }

  function pintar() {
    const r = datos.resumen || {};
    const q = texto.trim().toLowerCase();
    const filas = (datos.filas || []).filter(pasa).filter((f) => !q || `${f.descripcion} ${f.referencia || ''} ${f.pedido || ''} ${f.proveedor || ''}`.toLowerCase().includes(q));
    /* Agrupadas por pedido, en el orden en que llegan. */
    const grupos = new Map();
    for (const f of filas) {
      const k = f.pedidoId || (f.sinPedir ? 'sin' : '?');
      if (!grupos.has(k)) grupos.set(k, { titulo: f.sinPedir ? 'Llegado sin pedido' : `${f.pedido || ''} · ${f.pedidoTitulo || ''}`, proveedor: f.proveedor, filas: [] });
      grupos.get(k).filas.push(f);
    }
    const u = datos.ultimaCertificacion;
    $app.innerHTML = `
      <div class="resumen-fila">
        <div><b>${cifra(r.pedido + r.parcial)}</b><span>por llegar</span></div>
        <div><b>${cifra(r.enObra)}</b><span>en obra</span></div>
        <div class="bien"><b>${cifra(r.instalado)}</b><span>instalado</span></div>
        <div><b>${cifra(r.filas)}</b><span>líneas</span></div>
      </div>
      <p class="nota">${u ? `Instalado según la certificación nº ${esc(u.numero)}${u.periodo ? ` (${esc(u.periodo)})` : ''}.` : datos.sinCostsPlan ? 'La obra no tiene presupuesto de costes enlazado: lo instalado no se sabe todavía.' : 'Aún no hay ninguna certificación: lo instalado sale en cuanto se certifique.'}</p>
      <div class="segmentado">${FILTROS.map(([id, n]) => `<button data-inv-filtro="${id}" class="${filtro === id ? 'activa' : ''}">${esc(n)}</button>`).join('')}</div>
      <input type="search" class="buscar" placeholder="Buscar material, referencia o pedido" value="${esc(texto)}" data-inv-buscar>
      ${filas.length ? C.listaAgrupada(`inv-${filtro}`, filas, {
        grupo: (f) => { const g = grupos.get(f.pedidoId || (f.sinPedir ? 'sin' : '?')); return g.proveedor ? `${g.titulo} · ${g.proveedor}` : g.titulo; },
        buscando: !!q, repintar: pintar,
        envolver: (h) => `<div class="tabla-inv"><div class="cab"><span>Material</span><span>Pedido</span><span>Llegado</span><span>Instal.</span></div>${h}</div>`,
        fila: (f) => {
            const [clase, nombre] = ESTADO[f.estado] || ['neutra', f.estado];
            return `<div class="fila-inv">
              <div class="mat"><strong>${esc(f.descripcion)}</strong><small>${esc([f.referencia, f.unidad].filter(Boolean).join(' · '))} <span class="chip ${clase}">${esc(nombre)}</span></small></div>
              <b>${num(f.cantidadPedida)}</b>
              <b class="${f.faltaLlegar ? 'aviso' : ''}">${num(f.llegado)}</b>
              <b class="${f.estado === 'instalado' ? 'bien' : ''}">${num(f.instalado)}</b>
            </div>`;
          } }) : `<p class="vacio">${q || filtro !== 'todo' ? 'Nada con ese filtro.' : 'Esta obra no tiene pedidos.'}</p>`}`;
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const f = ev.target.closest('[data-inv-filtro]');
    if (f) { filtro = f.dataset.invFiltro; pintar(); return; }
    if (ev.target.closest('[data-inv="cargar"]')) cargar();
  });
  $app.addEventListener('input', (ev) => {
    if (!activa() || !ev.target.hasAttribute('data-inv-buscar')) return;
    texto = ev.target.value;
    const pos = ev.target.selectionStart;
    pintar();
    const i = $app.querySelector('[data-inv-buscar]');
    i.focus(); i.setSelectionRange(pos, pos);
  });

  window.addEventListener('movil:obra', () => { if (activa()) cargar(); });
  window.addEventListener('hashchange', () => { if (activa()) cargar(); });
  if (activa()) cargar();
})();
