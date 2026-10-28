'use strict';
/*
 * INCIDENCIAS › RECLAMABLES (26-oct-2026, JC): «Este tipo de reclamaciones
 * [un retraso por falta de medios de elevación, una espera, un acceso
 * denegado…] los encargados desde el móvil las deben de poder contemplar y
 * crear, para que llegue la información del día, motivo y, si tiene en cuenta
 * costes, número de operarios y empresa a la que pertenecen, y que el jefe de
 * obra pueda gestionarlo en el ordenador.»
 *
 *   1. LA LISTA: «Avisar de algo reclamable» y los avisos de la obra, con
 *      cómo están (recibido, faltan datos, tramitado, descartado) y lo que
 *      contesta el jefe de obra; si pide datos, se le contesta aquí.
 *   2. EL AVISO, con letra grande: el día (hoy), dónde, qué ha pasado (botones
 *      grandes), por qué (LIMAK, otro, no sé) y, si ha costado, quién estaba
 *      parado: la empresa (la nuestra o una subcontrata), cuántos operarios y
 *      cuántas horas o jornadas; o la máquina de alquiler. Fotos y PDF.
 *   3. ENVIADO, con su código. Sin conexión se guarda en el teléfono y sube
 *      solo (Cx Obra). Ni un euro: la tarifa la pone el jefe de obra.
 *
 * Las reglas, en shared/reclamaciones/avisos.js; las rutas, en
 * electron/movil/rutasAvisos.js. Acciones con data-at.
 */
(function avisosReclamables() {
  const $app = document.getElementById('app');
  const CX = () => window.CX;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const activa = () => location.hash === '#avisos';
  const aviso = (t, n = 'mal') => (CX() ? CX().aviso(t, n) : alert(t));
  const CLASE = { recibido: 'info', masDatos: 'aviso', tramitado: 'bien', descartado: 'neutra' };
  const MICRO = 'Para dictar, pulsa el micrófono del teclado.';

  /* La cámara y la galería, propias (fotos o PDF). */
  const entrada = (id, captura) => {
    let i = document.getElementById(id);
    if (!i) {
      i = document.createElement('input');
      i.type = 'file'; i.id = id; i.hidden = true; i.accept = captura ? 'image/*' : 'image/*,application/pdf';
      if (captura) i.setAttribute('capture', 'environment');
      document.body.appendChild(i);
    }
    return i;
  };
  const $camara = entrada('camara-aviso', true);
  const $galeria = entrada('galeria-aviso', false);

  /* Letra grande y botones de dedo: lo justo, con los colores de la app. */
  if (!document.getElementById('estilo-avisos')) {
    const s = document.createElement('style');
    s.id = 'estilo-avisos';
    s.textContent = `
      .at label, .at input, .at select, .at textarea, .at .nota { font-size: 18px; }
      .at h2 { font-size: 19px; }
      .at-opciones { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 14px; }
      .at-op { min-height: 64px; font-size: 17px; font-weight: 600; border-radius: 12px; border: 2px solid var(--acento-suave); background: var(--panel, #fff); color: var(--texto); padding: 8px; text-align: center; }
      .at-op[aria-pressed="true"] { border-color: var(--acento-fuerte); background: var(--acento-suave); color: var(--acento-fuerte); }
      .at-op small { display: block; font-weight: 400; font-size: 13px; color: var(--textoSuave); }
      .at-tres { grid-template-columns: 1fr 1fr 1fr; }
      .at-linea { padding: 12px 14px; margin: 10px 0; border-left: 4px solid var(--acento-fuerte); background: var(--panel3); border-radius: 10px; }
      .at-linea .fila { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .at-num { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
      .at-num input { font-size: 22px; text-align: center; }
      .at-lista li { display: block; padding: 12px 0; border-bottom: 1px solid var(--panel3); }
      .at-lista .cab { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
      .at-com { margin: 6px 0 0 10px; padding: 6px 10px; border-left: 3px solid var(--acento-suave); font-size: 15px; }
      .at-com.pide { border-left-color: var(--aviso); }
      .at-arch { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .at-arch span { padding: 6px 10px; border-radius: 8px; background: var(--acento-suave); color: var(--acento-fuerte); font-size: 14px; }
    `;
    document.head.appendChild(s);
  }

  let datos = null;
  let form = null;
  let abierto = null;

  const obras = () => (datos && datos.obras) || [];
  const obraElegida = () => (CX() && CX().obraId && CX().obraId()) || (() => { try { return localStorage.getItem('movil.obra'); } catch { return null; } })();
  const obra = () => obras().find((o) => o.id === (form ? form.obraId : obraElegida())) || obras()[0] || null;
  window.addEventListener('movil:obra', () => { if (activa() && !form && datos) pintarLista(); });

  /* ═══════════════════════════════════ 1. La lista */

  async function lista() {
    form = null;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      datos = await CX().pedir('api/avisos-reclamables');
      if (datos && datos.ok === false) throw new Error(datos.error);
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-at="lista">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintarLista();
  }

  function chip(a) { return `<span class="chip ${CLASE[a.estado] || 'neutra'}">${esc(a.estadoNombre)}</span>`; }

  function pintarLista() {
    const o = obra();
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas en las que avisar.</p>'; return; }
    const puede = datos.puede && datos.puede.crear;
    const suyos = (datos.avisos || []).filter((a) => a.obraId === o.id);
    const faltan = suyos.filter((a) => a.estado === 'masDatos' && !a.contestado).length;
    $app.innerHTML = `<div class="at">
      ${puede ? `<section class="acciones">
        <button class="boton grande" data-at="nuevo">Avisar de algo que puede reclamarse</button>
        <p class="nota centrada">Una espera, un acceso denegado, sin grúa ni plataforma… Le llega al jefe de obra con el día, el motivo y la gente parada.</p>
      </section>` : '<p class="nota">Tu rol puede ver los avisos, pero no darlos.</p>'}
      ${faltan ? `<p class="nota aviso">El jefe de obra te pide datos en ${faltan === 1 ? 'un aviso' : `${faltan} avisos`}: tócalo para contestar.</p>` : ''}
      <h2>Avisos de ${esc(o.codigo)} <span class="cuenta">${suyos.length}</span></h2>
      ${suyos.length ? `<ul class="at-lista">${suyos.map((a) => `<li>
        <div class="cab" data-at="abrir" data-id="${esc(a.id)}" role="button" tabindex="0">
          <div><strong>${esc(a.categoriaNombre)}</strong> · ${esc(fechaEs(a.fecha))}${a.zona ? ` · ${esc(a.zona)}` : ''}<br>
          <small>${esc(a.codigo)}${a.operarios ? ` · ${a.operarios} operario${a.operarios === 1 ? '' : 's'}` : ''}${a.empresas ? ` · ${esc(a.empresas)}` : ''}${a.mio ? '' : ` · ${esc(a.quien || '')}`}</small></div>
          ${chip(a)}</div>
        ${abierto === a.id ? detalle(a) : ''}</li>`).join('')}</ul>` : '<p class="vacio">Todavía no hay avisos en esta obra.</p>'}
    </div>`;
  }

  function detalle(a) {
    return `<div class="detalle">
      <p>${esc(a.motivo)}</p>
      <p class="nota">${esc(a.estadoAyuda || '')}${a.motivoDescarte ? `<br>Motivo: ${esc(a.motivoDescarte)}` : ''}</p>
      <p class="nota">Por: ${esc(a.causaNombre)}</p>
      ${a.lineas.map((l) => `<p class="nota">· ${esc(l.texto)}</p>`).join('')}
      ${a.nFotos ? `<p class="nota">${a.nFotos} foto${a.nFotos === 1 ? '' : 's'} o archivo${a.nFotos === 1 ? '' : 's'}</p>` : ''}
      ${a.comentarios.map((c) => `<div class="at-com ${c.pideDatos ? 'pide' : ''}"><b>${esc(c.mio ? 'Tú' : c.quien || '')}</b>${c.pideDatos ? ' (pide datos)' : ''}: ${esc(c.texto)}</div>`).join('')}
      ${a.estado !== 'tramitado' && a.estado !== 'descartado' && datos.puede.crear ? `
        <label>${a.estado === 'masDatos' ? 'Contesta al jefe de obra' : 'Añadir algo'}<textarea data-at-respuesta="${esc(a.id)}" rows="3" placeholder="${MICRO}"></textarea></label>
        <button class="boton secundario" data-at="contestar" data-id="${esc(a.id)}">Enviar</button>` : ''}
    </div>`;
  }

  async function contestar(id, boton) {
    const t = $app.querySelector(`[data-at-respuesta="${CSS.escape(id)}"]`);
    const texto = t ? t.value.trim() : '';
    if (texto.length < 2) { aviso('Escribe algo.'); return; }
    boton.disabled = true;
    try {
      const r = await CX().postJson('api/aviso-reclamable/comentario', { avisoId: id, texto });
      if (!r.ok) throw new Error(r.error);
      aviso('Enviado al jefe de obra.', 'bien');
      await lista();
    } catch (e) { aviso(e.message); boton.disabled = false; }
  }

  /* ═══════════════════════════════════ 2. El aviso */

  const lineaPersonal = () => ({ tipo: 'personal', empresa: 'propia', empresaNombre: '', operarios: '', modo: 'horas', horas: '', jornadas: '' });
  const lineaMaquina = () => ({ tipo: 'maquinaria', maquina: '', unidades: '1', dias: '1', empresaNombre: '' });

  function nuevo() {
    const o = obra();
    if (!o) return;
    form = { obraId: o.id, fecha: hoy(), zona: '', categoria: '', motivo: '', causa: '', causaOtro: '', conCostes: null, lineas: [], archivos: [] };
    pintarForm();
  }

  const op = (accion, valor, actual, texto, ayuda) => `<button type="button" class="at-op" data-at="${accion}" data-v="${esc(valor)}" aria-pressed="${valor === actual}">${esc(texto)}${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</button>`;

  function pintarForm() {
    const o = obra();
    const f = form;
    $app.innerHTML = `<div class="at">
      <button class="volver" data-at="lista">‹ Reclamables</button>
      <p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>
      <div class="campos">
        <label>Día<input type="date" data-at-campo="fecha" value="${esc(f.fecha)}" max="${hoy()}"></label>
        <label>Dónde<input data-at-campo="zona" value="${esc(f.zona)}" placeholder="Nivel, zona, eje…" autocomplete="off"></label>
      </div>
      <h2>¿Qué ha pasado?</h2>
      <div class="at-opciones">${datos.categorias.map((c) => op('categoria', c.id, f.categoria, c.corto || c.nombre)).join('')}</div>
      <label>Cuéntalo en una frase${f.categoria === 'otros' ? '' : ' (si quieres)'}<textarea data-at-campo="motivo" rows="3" placeholder="${MICRO}">${esc(f.motivo)}</textarea></label>
      <h2>¿Por culpa de quién?</h2>
      <div class="at-opciones at-tres">${datos.causas.map((c) => op('causa', c.id, f.causa, c.nombre)).join('')}</div>
      ${f.causa === 'otro' ? `<label>¿Quién?<input data-at-campo="causaOtro" value="${esc(f.causaOtro)}" placeholder="Otro gremio, la propiedad…" autocomplete="off"></label>` : ''}
      <h2>¿Ha costado gente o máquinas paradas?</h2>
      <div class="at-opciones">${op('costes', 'si', f.conCostes === true ? 'si' : f.conCostes === false ? 'no' : '', 'Sí')}${op('costes', 'no', f.conCostes === true ? 'si' : f.conCostes === false ? 'no' : '', 'No')}</div>
      ${f.conCostes ? lineas(o, f) : ''}
      <h2>Fotos y papeles <span class="cuenta">${f.archivos.length}</span></h2>
      <div class="at-arch">${f.archivos.map((a, i) => `<span>${esc(a.nombre)} <button class="enlace" data-at="quitar-archivo" data-i="${i}" aria-label="Quitar">✕</button></span>`).join('')}</div>
      <div class="fila-botones">
        <button class="boton secundario" data-at="camara">Hacer foto</button>
        <button class="boton secundario" data-at="galeria">Elegir foto o PDF</button>
      </div>
      <button class="boton grande" data-at="enviar">Enviar al jefe de obra</button>
      <p class="nota centrada">Si no hay cobertura se guarda en el teléfono y se manda solo.</p>
      <datalist id="at-empresas">${(o.subcontratas || []).map((s) => `<option value="${esc(s.nombre)}"></option>`).join('')}</datalist>
    </div>`;
  }

  function lineas(o, f) {
    const subs = o.subcontratas || [];
    return `${f.lineas.map((l, i) => l.tipo === 'maquinaria' ? `<div class="at-linea">
        <div class="fila"><strong>Máquina de alquiler</strong><button class="enlace" data-at="quitar-linea" data-i="${i}">Quitar</button></div>
        <label>Qué máquina<input data-at-linea="${i}" data-campo="maquina" value="${esc(l.maquina)}" placeholder="Plataforma tijera, grúa…" autocomplete="off"></label>
        <div class="at-num">
          <label>Cuántas<input data-at-linea="${i}" data-campo="unidades" value="${esc(l.unidades)}" inputmode="numeric"></label>
          <label>Días parada<input data-at-linea="${i}" data-campo="dias" value="${esc(l.dias)}" inputmode="decimal"></label>
        </div>
        <label>De qué empresa (si se sabe)<input data-at-linea="${i}" data-campo="empresaNombre" value="${esc(l.empresaNombre)}" list="at-empresas" autocomplete="off"></label>
      </div>` : `<div class="at-linea">
        <div class="fila"><strong>Gente parada</strong><button class="enlace" data-at="quitar-linea" data-i="${i}">Quitar</button></div>
        <label>Empresa<select data-at-linea="${i}" data-campo="empresa">
          <option value="propia" ${l.empresa === 'propia' ? 'selected' : ''}>Nuestra empresa</option>
          ${subs.map((s) => `<option value="${esc(s.id)}" ${l.empresa === s.id ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}
          <option value="otra" ${l.empresa === 'otra' ? 'selected' : ''}>Otra (la escribo)</option></select></label>
        ${l.empresa === 'otra' ? `<label>Nombre de la empresa<input data-at-linea="${i}" data-campo="empresaNombre" value="${esc(l.empresaNombre)}" autocomplete="off"></label>` : ''}
        <div class="at-num">
          <label>Operarios<input data-at-linea="${i}" data-campo="operarios" value="${esc(l.operarios)}" inputmode="numeric" placeholder="0"></label>
          ${l.modo === 'horas'
    ? `<label>Horas paradas<input data-at-linea="${i}" data-campo="horas" value="${esc(l.horas)}" inputmode="decimal" placeholder="0"></label>`
    : `<label>Jornadas<input data-at-linea="${i}" data-campo="jornadas" value="${esc(l.jornadas)}" inputmode="decimal" placeholder="0"></label>`}
        </div>
        <button class="enlace" data-at="modo" data-i="${i}">${l.modo === 'horas' ? 'Contar por jornadas enteras' : 'Contar por horas'}</button>
      </div>`).join('')}
      <div class="fila-botones">
        <button class="boton secundario" data-at="linea-personal">+ Gente parada</button>
        <button class="boton secundario" data-at="linea-maquina">+ Máquina</button>
      </div>`;
  }

  /* Del formulario a lo que entiende shared/reclamaciones/avisos.js. */
  function paraEnviar() {
    const f = form;
    const o = obra();
    const subs = new Map((o.subcontratas || []).map((s) => [s.id, s.nombre]));
    return {
      obraId: f.obraId, fecha: f.fecha, zona: f.zona, categoria: f.categoria, motivo: f.motivo,
      causa: f.causa || 'nose', causaOtro: f.causaOtro, conCostes: f.conCostes === true,
      lineas: f.conCostes ? f.lineas.map((l) => (l.tipo === 'maquinaria'
        ? { tipo: 'maquinaria', maquina: l.maquina, unidades: l.unidades, dias: l.dias, empresaNombre: l.empresaNombre }
        : {
          tipo: 'personal', propia: l.empresa === 'propia',
          proveedorId: subs.has(l.empresa) ? l.empresa : null,
          empresaNombre: subs.has(l.empresa) ? subs.get(l.empresa) : l.empresa === 'otra' ? l.empresaNombre : null,
          operarios: l.operarios, ...(l.modo === 'horas' ? { horas: l.horas } : { jornadas: l.jornadas }),
        })) : [],
      fotos: f.archivos.map((a) => a.id),
    };
  }

  async function enviar(boton) {
    if (!form.categoria) { aviso('Elige qué ha pasado.'); return; }
    if (form.conCostes === null) { aviso('Di si ha costado gente o máquinas paradas.'); return; }
    boton.disabled = true;
    try {
      const r = await CX().postJson('api/aviso-reclamable', paraEnviar());
      if (!r.ok) throw new Error(r.error);
      form = null;
      $app.innerHTML = `<div class="at">
        <section class="resultado bien"><div class="icono">✓</div><h1>${esc(r.codigo)}</h1>
          <p>Aviso enviado</p><p class="sub">${esc(r.avisados && r.avisados.length ? `Le sale a ${r.avisados.join(', ')}.` : 'Le sale al jefe de obra en la aplicación.')}</p></section>
        <button class="boton grande" data-at="nuevo">Otro aviso</button>
        <button class="boton secundario" data-at="lista">Volver a la lista</button></div>`;
      datos = await CX().pedir('api/avisos-reclamables').catch(() => datos);
    } catch (e) {
      aviso(e.message);
      boton.disabled = false;
    }
  }

  async function archivo(a) {
    if (!a || !form) return;
    try {
      const id = await CX().subirFoto(a);
      form.archivos.push({ id, nombre: a.name || (a.type === 'application/pdf' ? 'documento.pdf' : 'foto') });
      pintarForm();
    } catch (e) { aviso(e.message); }
  }

  /* ═══════════════════════════════════ Los toques */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-at]');
    if (!b) return;
    const a = b.dataset.at;
    const v = b.dataset.v;
    if (a === 'lista') lista();
    else if (a === 'nuevo') { if (datos) nuevo(); }
    else if (a === 'abrir') { abierto = abierto === b.dataset.id ? null : b.dataset.id; pintarLista(); }
    else if (a === 'contestar') contestar(b.dataset.id, b);
    else if (!form) return;
    else if (a === 'categoria') { form.categoria = v; pintarForm(); }
    else if (a === 'causa') { form.causa = v; pintarForm(); }
    else if (a === 'costes') {
      form.conCostes = v === 'si';
      if (form.conCostes && !form.lineas.length) form.lineas.push(lineaPersonal());
      pintarForm();
    } else if (a === 'linea-personal') { form.lineas.push(lineaPersonal()); pintarForm(); }
    else if (a === 'linea-maquina') { form.lineas.push(lineaMaquina()); pintarForm(); }
    else if (a === 'quitar-linea') { form.lineas.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'modo') { const l = form.lineas[Number(b.dataset.i)]; if (l) { l.modo = l.modo === 'horas' ? 'jornadas' : 'horas'; pintarForm(); } }
    else if (a === 'quitar-archivo') { form.archivos.splice(Number(b.dataset.i), 1); pintarForm(); }
    else if (a === 'camara') $camara.click();
    else if (a === 'galeria') $galeria.click();
    else if (a === 'enviar') enviar(b);
  });
  const recoger = (ev) => {
    if (!activa() || !form) return;
    const t = ev.target;
    if (t.dataset.atCampo) form[t.dataset.atCampo] = t.value;
    if (t.dataset.atLinea !== undefined) {
      const l = form.lineas[Number(t.dataset.atLinea)];
      if (!l) return;
      l[t.dataset.campo] = t.value;
      if (t.dataset.campo === 'empresa' && ev.type === 'change') pintarForm();
    }
  };
  $app.addEventListener('input', recoger);
  $app.addEventListener('change', recoger);
  for (const input of [$camara, $galeria]) {
    input.addEventListener('change', () => {
      const a = input.files && input.files[0];
      input.value = '';
      archivo(a);
    });
  }

  window.addEventListener('hashchange', () => { if (activa()) { abierto = null; lista(); } });
  if (activa()) lista();
})();
