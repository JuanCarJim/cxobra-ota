'use strict';
/*
 * COMPRAS › ALBARANES EN EL MÓVIL.
 *
 *   1. LA LISTA: lo que espera cada obra (pedidos con lo que falta de cada
 *      línea) y los últimos albaranes. Arriba, «Fotografiar albarán».
 *   2. LA FOTO se manda al ordenador, que la lee y propone el pedido y el
 *      formulario relleno. Sin foto (o si no se lee), el mismo formulario a
 *      mano, eligiendo el pedido.
 *   3. EL FORMULARIO: cada línea del pedido con lo pedido, lo ya recibido y
 *      lo que llega ahora (lo leído, corregible), y cómo quedaría. Lo que no
 *      casa con ninguna línea va aparte: se asigna a una línea o queda como
 *      «no pedido».
 *   4. EL RESULTADO: recepcionado, recepción parcial o con diferencias, y qué
 *      falta o sobra.
 *
 * Todas las reglas están en el ordenador; aquí solo se enseña y se recoge.
 * La vista previa usa el mismo motor (albaranes.js), así que dice lo mismo.
 */
(function movil() {
  const A = window.ALBARANES_MOTOR;
  const $app = document.getElementById('app');
  const $camara = document.getElementById('camara');
  const $galeria = document.getElementById('galeria');

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cifra = (v) => (v === null || v === undefined || v === '' ? '—' : A.cifra(v));
  /* Un sello con hora (creadoEn, en UTC) se enseña con el día LOCAL: a la 01:20 del 15 ya es 15. */
  const fechaEs = (d) => {
    if (!d) return '';
    let t = String(d);
    if (/^\d{4}-\d{2}-\d{2}T/.test(t) && Number.isFinite(Date.parse(t))) { const x = new Date(t); t = new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString(); }
    return t.slice(0, 10).split('-').reverse().join('/');
  };
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const CLASE = { pendiente: 'neutra', parcial: 'aviso', diferencias: 'mal', recepcionado: 'bien' };
  const chip = (estado) => `<span class="chip ${CLASE[estado] || 'neutra'}">${esc((A.RECEPCION[estado] || {}).nombre || estado)}</span>`;

  let datos = null;     /* la lista */
  let form = null;      /* el albarán que se está rellenando */

  async function pedir(ruta, opciones = {}) {
    const r = await fetch(ruta, { cache: 'no-store', ...opciones });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { throw new Error(t || `Error ${r.status}`); }
    if (r.status >= 400 && j && j.error) throw new Error(j.error);
    return j;
  }
  const postJson = (ruta, cuerpo) => pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

  function aviso(texto, nivel = 'mal') {
    const d = document.createElement('div');
    d.className = `toast ${nivel}`;
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await pedir('api/albaranes');
      if (seccion() !== 'albaranes') return; /* se ha cambiado de sección mientras cargaba */
    } catch (e) {
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-accion="recargar">Reintentar</button></div>`;
      return;
    }
    document.getElementById('quien').textContent = datos.quien || '';
    pintarAlbaranes();
  }

  function pintarAlbaranes() {
    if (seccion() !== 'albaranes' || form || !datos) return;
    const puede = datos.puede && datos.puede.registrar;
    const pedidos = datos.pedidos || [];
    $app.innerHTML = `
      ${puede ? `<section class="acciones">
        <button class="boton grande" data-accion="foto"><i class="ic ic-camara"></i>Fotografiar albarán</button>
        <div class="fila-botones">
          <button class="boton secundario" data-accion="galeria">Elegir foto o PDF</button>
          <button class="boton secundario" data-accion="mano">Rellenar a mano</button>
        </div>
      </section>` : '<p class="nota">Tu rol puede ver los albaranes, pero no registrarlos.</p>'}
      <h2>Esperan material <span class="cuenta">${pedidos.length}</span></h2>
      ${pedidos.length ? window.CX.listaAgrupada('alb-pedidos', pedidos, { envolver: (h) => h, fila: tarjetaPedido, repintar: pintarAlbaranes }) : '<p class="vacio">No hay pedidos esperando material en tus obras.</p>'}
      <h2>Últimos albaranes</h2>
      ${(datos.recientes || []).length ? window.CX.listaAgrupada('alb-recientes', datos.recientes, {
        envolver: (h) => `<ul class="recientes">${h}</ul>`, repintar: pintarAlbaranes, fila: (a) => `
        <li><div><strong>${esc(a.codigo)}</strong> · ${esc(a.titulo)}<br>
          <small>${esc(a.numero ? `Albarán ${a.numero}` : 'Sin número')} · ${fechaEs(a.fecha)}${a.registradoPor ? ` · ${esc(a.registradoPor)}` : ''}</small></div>
          ${a.estado ? chip(a.estado) : ''}</li>` }) : '<p class="vacio">Ninguno en los últimos 30 días.</p>'}`;
  }

  function tarjetaPedido(p) {
    const faltan = p.lineas.filter((l) => l.estado === 'pendiente' || l.estado === 'parcial');
    return `<article class="tarjeta" data-accion="abrir" data-id="${esc(p.id)}" tabindex="0" role="button">
      <div class="cabeza"><strong>${esc(p.codigo)}</strong>${chip(p.recepcion)}</div>
      <div class="titulo">${esc(p.titulo)}</div>
      <div class="sub">${esc(p.proveedor || 'Sin proveedor')} · ${esc(p.obra)}${p.fechaPrevista ? ` · prevista ${fechaEs(p.fechaPrevista)}` : ''}</div>
      ${faltan.length ? `<ul class="faltan">${faltan.slice(0, 4).map((l) => `<li>${esc(l.descripcion)} <span>faltan ${cifra(l.falta)} ${esc(l.unidad || '')}</span></li>`).join('')}${faltan.length > 4 ? `<li class="mas">y ${faltan.length - 4} más</li>` : ''}</ul>` : ''}
    </article>`;
  }

  /* ═══════════════════════════════════ 2. La foto */

  async function subirFoto(archivo, leer) {
    const tipo = archivo.type || (archivo.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    /* Con la obra elegida arriba: si el albarán no dice de qué obra es, desempata. */
    const obra = leer && window.CX && window.CX.obraId() ? `&obra=${encodeURIComponent(window.CX.obraId())}` : '';
    return pedir(`api/foto?leer=${leer ? 1 : 0}${obra}`, { method: 'POST', headers: { 'Content-Type': tipo }, body: archivo });
  }

  async function fotoNueva(archivo) {
    if (!archivo) return;
    if (form) {
      /* Otra foto del mismo albarán (la segunda hoja): solo se guarda. */
      try {
        const r = await subirFoto(archivo, false);
        if (r.ok === false) throw new Error(r.error);
        form.fotos.push({ id: r.fotoId, url: URL.createObjectURL(archivo) });
        pintarFormulario();
      } catch (e) { aviso(e.message); }
      return;
    }
    $app.innerHTML = '<div class="leyendo"><div class="giro"></div><p>Leyendo el albarán…</p><small>La foto se lee en el ordenador de la obra.</small></div>';
    try {
      const r = await subirFoto(archivo, true);
      if (r.ok === false) throw new Error(r.error);
      const foto = { id: r.fotoId, url: URL.createObjectURL(archivo) };
      if (!r.leida) {
        aviso(r.error || 'No se ha podido leer: rellénalo a mano.', 'aviso');
        elegirPedido({ fotos: [foto] });
        return;
      }
      if (!r.pedidoId) {
        aviso('No se sabe a qué pedido va: elígelo.', 'aviso');
        elegirPedido({ fotos: [foto], lectura: r.lectura, texto: r.texto, opciones: r.opciones });
        return;
      }
      nuevoFormulario({ pedidoId: r.pedidoId, propuesta: r.propuesta, lectura: r.lectura, texto: r.texto, opciones: r.opciones, fotos: [foto], repetido: r.repetido });
    } catch (e) {
      aviso(e.message);
      lista();
    }
  }

  /* Sin pedido claro: la lista de pedidos para elegir. */
  function elegirPedido(base) {
    const pedidos = (datos && datos.pedidos) || [];
    const sugeridos = new Set((base.opciones || []).map((o) => o.pedidoId));
    const orden = [...pedidos].sort((a, b) => (sugeridos.has(b.id) ? 1 : 0) - (sugeridos.has(a.id) ? 1 : 0));
    $app.innerHTML = `
      <button class="volver" data-accion="lista">‹ Albaranes</button>
      <h2>¿De qué pedido es?</h2>
      ${base.lectura && base.lectura.numero ? `<p class="nota">Leído: albarán ${esc(base.lectura.numero)}${base.lectura.fecha ? ` del ${fechaEs(base.lectura.fecha)}` : ''}</p>` : ''}
      ${orden.length ? orden.map((p) => {
        const o = (base.opciones || []).find((x) => x.pedidoId === p.id);
        const por = o && o.motivos && o.motivos.length ? `<p class="casado-por">Coincide: ${o.motivos.map((m) => `<span class="chip bien">${esc(m)}</span>`).join(' ')}${o.repetido ? ' <span class="chip mal">nº ya registrado</span>' : ''}</p>` : '';
        return tarjetaPedido(p).replace('data-accion="abrir"', 'data-accion="elegir"').replace(/<\/article>$/, `${por}</article>`);
      }).join('') : '<p class="vacio">No hay pedidos esperando material.</p>'}`;
    elegirPedido.base = base;
  }

  async function abrirPedido(pedidoId, base = {}) {
    $app.innerHTML = '<p class="cargando">Preparando el formulario…</p>';
    try {
      const r = await postJson('api/formulario', { pedidoId, lectura: base.lectura ? { lineas: base.lectura.lineas } : {} });
      if (!r.ok) throw new Error(r.error);
      nuevoFormulario({ ...base, pedidoId, propuesta: r.propuesta });
    } catch (e) { aviso(e.message); lista(); }
  }

  /* ═══════════════════════════════════ 3. El formulario */

  function nuevoFormulario({ pedidoId, propuesta, lectura = null, texto = '', opciones = [], fotos = [], repetido = false }) {
    const p = ((datos && datos.pedidos) || []).find((x) => x.id === pedidoId) || { id: pedidoId, codigo: '', titulo: '' };
    form = {
      pedido: p, lectura, texto, opciones, fotos, repetido,
      numero: (lectura && lectura.numero) || '',
      fecha: (lectura && lectura.fecha) || hoy(),
      notas: '',
      lineas: propuesta.lineas.map((l) => ({ ...l, llega: l.cantidad === null ? '' : String(l.cantidad).replace('.', ','), unidadLlega: l.unidadLeida || '' })),
      extras: propuesta.extras.map((x) => ({ ...x, destino: '', llega: String(x.cantidad ?? '').replace('.', ',') })),
    };
    pintarFormulario();
  }

  /* Por qué se ha elegido ese pedido: lo que se ha leído y casa con él. */
  function casadoPor(f) {
    const o = (f.opciones || []).find((x) => x.pedidoId === f.pedido.id);
    if (!o || !o.motivos || !o.motivos.length) return '';
    return `<p class="casado-por">Casado por: ${o.motivos.map((m) => `<span class="chip bien">${esc(m)}</span>`).join(' ')}</p>`;
  }

  /* Lo que se mandaría, y cómo quedaría el pedido (el mismo motor que el ordenador). */
  function lineasAMandar() {
    const fuera = form.lineas.filter((l) => String(l.llega).trim() !== '').map((l) => ({ lineaPedido: l.indice, cantidad: l.llega, unidad: l.unidadLlega || null, descripcion: l.leida || null }));
    for (const x of form.extras) {
      if (x.destino === 'quitar' || String(x.llega).trim() === '') continue;
      fuera.push({ lineaPedido: x.destino === '' ? null : Number(x.destino), cantidad: x.llega, unidad: x.unidad || null, descripcion: x.descripcion, referencia: x.referencia || null });
    }
    return fuera;
  }

  function vistaPrevia() {
    const lineasPedido = form.lineas.map((l) => ({ descripcion: l.descripcion, referencia: l.referencia, unidad: l.unidad, cantidad: l.pedida }));
    const previos = [{ id: 'antes', fecha: '0000-00-00', lineas: form.lineas.filter((l) => l.recibida > 0).map((l) => ({ lineaPedido: l.indice, cantidad: l.recibida })) }];
    const limpias = A.limpiarLineas(lineasAMandar(), lineasPedido.length);
    if (limpias.error) return { error: limpias.error };
    return A.resultadoAlbaran(lineasPedido, previos.filter((x) => x.lineas.length), { id: 'nuevo', fecha: form.fecha, lineas: limpias.lineas });
  }

  const ESTADO_LINEA = { pendiente: ['neutra', 'No llega'], parcial: ['aviso', 'Falta'], completa: ['bien', 'Completa'], exceso: ['mal', 'De más'], unidad: ['mal', 'Otra unidad'] };

  function pintarFormulario() {
    const f = form;
    const prev = vistaPrevia();
    const porLinea = prev.recepcion ? prev.recepcion.lineas : [];
    const opcionesLinea = f.lineas.map((l) => `<option value="${l.indice}">${esc(l.descripcion)}</option>`).join('');
    $app.innerHTML = `
      <button class="volver" data-accion="lista">‹ Albaranes</button>
      <section class="pedido-elegido">
        <div class="cabeza"><strong>${esc(f.pedido.codigo)}</strong><button class="enlace" data-accion="cambiar">Cambiar de pedido</button></div>
        <div class="titulo">${esc(f.pedido.titulo)}</div>
        <div class="sub">${esc(f.pedido.proveedor || '')}${f.pedido.obra ? ` · ${esc(f.pedido.obra)}` : ''}</div>
        ${casadoPor(f)}
        ${f.repetido ? '<p class="nota aviso">Este nº de albarán ya está registrado en este pedido: mira que no sea el mismo papel dos veces.</p>' : ''}
        ${f.lectura && f.lectura.faltan && f.lectura.faltan.length ? `<p class="nota aviso">No se ha podido leer ${esc(f.lectura.faltan.join(', '))}: complétalo.</p>` : ''}
      </section>
      <div class="campos">
        <label>Nº de albarán<input id="f-numero" value="${esc(f.numero)}" autocomplete="off" inputmode="text"></label>
        <label>Fecha<input id="f-fecha" type="date" value="${esc(f.fecha)}" max="${hoy()}"></label>
      </div>
      <h2>¿Qué ha llegado?</h2>
      <p class="nota">Lo leído ya está puesto. Corrige lo que no cuadre con lo que tienes delante; deja en blanco lo que no ha llegado.</p>
      ${f.lineas.map((l, i) => {
        const r = porLinea[l.indice] || {};
        const [clase, nombre] = ESTADO_LINEA[r.estado] || ESTADO_LINEA.pendiente;
        return `<div class="linea">
          <div class="desc">${esc(l.descripcion)}${l.referencia ? ` <small>${esc(l.referencia)}</small>` : ''}</div>
          ${l.leida && A.normal(l.leida) !== A.normal(l.descripcion) ? `<div class="leida">En el albarán: «${esc(l.leida)}»</div>` : ''}
          <div class="numeros">
            <span>Pedido <b>${cifra(l.pedida)}</b></span>
            <span>Ya recibido <b>${cifra(l.recibida)}</b></span>
            <label class="llega">Llega ahora<input data-linea="${i}" inputmode="decimal" value="${esc(l.llega)}" placeholder="0"><em>${esc(l.unidad || '')}</em></label>
          </div>
          ${String(l.llega).trim() !== '' || l.recibida > 0 ? `<div class="estado-linea"><span class="chip ${clase}">${nombre}${r.estado === 'parcial' ? ` ${cifra(r.falta)}` : r.estado === 'exceso' ? ` ${cifra(r.deMas)}` : ''}</span>
            ${l.unidadLlega && A.chocanUnidades(l.unidad, l.unidadLlega) ? `<small class="mal">El albarán dice «${esc(l.unidadLlega)}»</small>` : ''}</div>` : ''}
        </div>`;
      }).join('')}
      ${f.extras.length ? `<h2>En el albarán y no en el pedido</h2>
        ${f.extras.map((x, i) => `<div class="linea extra">
          <div class="desc">${esc(x.descripcion)}${x.referencia ? ` <small>${esc(x.referencia)}</small>` : ''}</div>
          <div class="numeros">
            <label class="llega">Cantidad<input data-extra="${i}" inputmode="decimal" value="${esc(x.llega)}"><em>${esc(x.unidad || '')}</em></label>
            <label>Es<select data-destino="${i}">
              <option value="">No estaba pedido</option>${opcionesLinea}<option value="quitar">No es material (quitar)</option>
            </select></label>
          </div></div>`).join('')}` : ''}
      <button class="boton secundario" data-accion="otra-linea">+ Algo que no estaba en el pedido</button>
      <h2>Fotos del albarán</h2>
      <div class="fotos">${f.fotos.map((x) => `<img src="${esc(x.url)}" alt="Foto del albarán">`).join('')}
        <button class="anadir-foto" data-accion="foto" aria-label="Añadir otra foto">＋</button></div>
      <label class="notas">Notas<textarea id="f-notas" rows="2" placeholder="Bultos dañados, faltas que dice el transportista…">${esc(f.notas)}</textarea></label>
      <section class="resumen ${prev.error ? 'mal' : CLASE[prev.estado] || 'neutra'}">
        ${prev.error ? esc(prev.error) : `<div>Con este albarán el pedido queda: ${chip(prev.estado)}</div>
          ${prev.avisos.length ? `<ul>${prev.avisos.map((a) => `<li class="${a.nivel}">${esc(a.texto)}</li>`).join('')}</ul>` : ''}`}
      </section>
      <button class="boton grande" data-accion="registrar" ${prev.error ? 'disabled' : ''}>Registrar albarán</button>`;
    for (const [i, x] of f.extras.entries()) {
      const s = $app.querySelector(`[data-destino="${i}"]`);
      if (s) s.value = x.destino;
    }
  }

  function leerCampos() {
    if (!form) return;
    const v = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
    form.numero = v('f-numero');
    form.fecha = v('f-fecha') || hoy();
    form.notas = v('f-notas');
  }

  function otraLinea() {
    const descripcion = window.prompt('¿Qué ha llegado que no estaba en el pedido?');
    if (!descripcion || !descripcion.trim()) return;
    form.extras.push({ descripcion: descripcion.trim(), referencia: null, unidad: null, destino: '', llega: '1' });
    pintarFormulario();
  }

  async function registrar(boton) {
    leerCampos();
    const lineas = lineasAMandar();
    if (!lineas.length) { aviso('Pon la cantidad de al menos una línea.'); return; }
    boton.disabled = true;
    boton.textContent = 'Registrando…';
    try {
      const r = await postJson('api/albaran', {
        pedidoId: form.pedido.id, numero: form.numero, fecha: form.fecha, notas: form.notas,
        lineas, fotos: form.fotos.map((x) => x.id), textoLeido: form.texto || null,
      });
      if (!r.ok) throw new Error(r.error);
      resultado(r);
    } catch (e) {
      aviso(e.message);
      boton.disabled = false;
      boton.textContent = 'Registrar albarán';
    }
  }

  /* ═══════════════════════════════════ 4. El resultado */

  const TITULO = {
    recepcionado: ['✓', 'Pedido recepcionado', 'Ha llegado todo lo pedido.'],
    parcial: ['◐', 'Recepción parcial', 'Lo que ha llegado está bien, pero falta material.'],
    diferencias: ['!', 'Con diferencias', 'No cuadra con el pedido: se avisa al jefe de obra.'],
  };

  function resultado(r) {
    const [icono, titulo, sub] = TITULO[r.estado] || ['·', r.estado, ''];
    const f = form;
    form = null;
    $app.innerHTML = `
      <section class="resultado ${CLASE[r.estado]}">
        <div class="icono">${icono}</div>
        <h1>${esc(titulo)}</h1>
        <p>${esc(r.codigo)} · ${esc(f.pedido.titulo)}</p>
        <p class="sub">${esc(sub)}</p>
      </section>
      ${r.avisos.length ? `<ul class="avisos">${r.avisos.map((a) => `<li class="${a.nivel}">${esc(a.texto)}</li>`).join('')}</ul>` : ''}
      <table class="tabla-resultado"><thead><tr><th>Línea</th><th>Pedido</th><th>Recibido</th><th></th></tr></thead><tbody>
        ${r.lineas.map((l) => { const [c, n] = ESTADO_LINEA[l.estado] || ESTADO_LINEA.pendiente; return `<tr><td>${esc(l.descripcion)}</td><td>${cifra(l.pedida)}</td><td>${cifra(l.recibida)}</td><td><span class="chip ${c}">${n}</span></td></tr>`; }).join('')}
      </tbody></table>
      <button class="boton grande" data-accion="foto"><i class="ic ic-camara"></i>Otro albarán</button>
      <button class="boton secundario" data-accion="lista">Volver a la lista</button>`;
    datos = null;
    pedir('api/albaranes').then((d) => { datos = d; }).catch(() => {});
  }

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const accion = b.dataset.accion;
    if (form) leerCampos();
    if (accion === 'recargar' || accion === 'lista') lista();
    else if (accion === 'foto') $camara.click();
    else if (accion === 'galeria') $galeria.click();
    else if (accion === 'mano') elegirPedido({ fotos: [] });
    else if (accion === 'abrir') abrirPedido(b.dataset.id, { fotos: [] });
    else if (accion === 'elegir') abrirPedido(b.dataset.id, elegirPedido.base || { fotos: [] });
    else if (accion === 'cambiar') { const f = form; form = null; elegirPedido({ fotos: f.fotos, lectura: f.lectura, texto: f.texto, opciones: f.opciones }); }
    else if (accion === 'otra-linea') otraLinea();
    else if (accion === 'registrar') registrar(b);
  });

  $app.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!form) return;
    if (t.dataset.linea !== undefined) form.lineas[Number(t.dataset.linea)].llega = t.value;
    else if (t.dataset.extra !== undefined) form.extras[Number(t.dataset.extra)].llega = t.value;
    else return;
  });
  /* Al salir de una cantidad, se recalcula cómo queda (sin perder el foco mientras se escribe). */
  $app.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!form) return;
    if (t.dataset.destino !== undefined) form.extras[Number(t.dataset.destino)].destino = t.value;
    if (t.dataset.linea !== undefined || t.dataset.extra !== undefined || t.dataset.destino !== undefined) { leerCampos(); pintarFormulario(); }
  });
  $app.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.closest('[data-accion="abrir"],[data-accion="elegir"]')) ev.target.click();
  });

  for (const input of [$camara, $galeria]) {
    input.addEventListener('change', () => {
      const archivo = input.files && input.files[0];
      input.value = '';
      fotoNueva(archivo);
    });
  }

  /* ═══════════════════════════════════ La sección */

  /* Las pestañas y el título los pone carcasa.js; aquí solo se mira si la
     dirección es la de Albaranes. */
  function seccion() { return location.hash.slice(1); }
  window.addEventListener('hashchange', () => { if (seccion() === 'albaranes') lista(); });
  if (seccion() === 'albaranes') lista();
})();
