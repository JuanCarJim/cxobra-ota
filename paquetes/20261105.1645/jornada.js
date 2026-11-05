'use strict';
/*
 * EL REGISTRO DE JORNADA EN EL MÓVIL (#jornada). 5-nov-2026, JC: «fichar
 * desde el teléfono, pedir días y ver la respuesta».
 *
 * Al abrir Cx se ficha la entrada sola (la primera vez del día laborable,
 * con la hora real del teléfono); aquí se ve el día, se ficha la salida o el
 * cambio de obra con un buscador, se mira el mes (el registro propio, que la
 * ley obliga a enseñar) y se piden días. Quien tiene gente a cargo contesta
 * desde aquí también, aunque lo normal es hacerlo en el ordenador.
 *
 * Las reglas son las de shared/personal/jornada.js, las mismas del escritorio.
 * Nada se borra ni se reescribe: corregir una hora se hace en el ordenador y
 * deja quién, cuándo y por qué.
 */
(function jornada() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc } = C;
  const activa = () => C.activa('jornada');

  let vista = 'hoy';
  let hoy = null;
  let mes = null;
  let elMes = null;
  let solicitudes = [];
  let bandeja = [];
  let buscar = '';
  let obras = [];
  let ocupado = false;

  const hm = (min) => { const m = Math.max(0, Math.round(Number(min) || 0)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const obraTxt = (o) => (o ? `${o.codigo || ''} ${o.nombre || ''}`.trim() : 'Oficina');
  const fechaCorta = (f) => { const [a, m, d] = String(f || '').split('-'); return d ? `${d}/${m}/${a.slice(2)}` : ''; };
  const diaSemana = (f) => ['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(`${f}T12:00:00`).getDay()] || '';
  const ESTADO = { enCurso: ['bien', 'Dentro'], fichado: ['info', 'Fichado'], sinCerrar: ['mal', 'Sin cerrar'], sinFichar: ['neutra', 'Sin fichar'], ausencia: ['info', ''], festivo: ['neutra', 'Festivo'], finde: ['neutra', ''] };
  const etiqueta = (d) => {
    const [cl, txt] = ESTADO[d.estado] || ['neutra', d.estado];
    const t = d.marca && (d.estado === 'ausencia' || d.estado === 'festivo') ? d.marca.nombre : txt;
    return t ? `<span class="jo-et ${cl}">${esc(t)}</span>` : '';
  };
  const ESTADO_SOL = { pendiente: 'aviso', aprobada: 'bien', rechazada: 'mal', anulada: 'neutra' };

  /* ─────────────────────────── datos */
  async function cargar() {
    const [h, s] = await Promise.all([C.pedir('api/jornada/hoy'), C.pedir('api/jornada/solicitudes')]);
    if (h && h.ok) hoy = h; else throw new Error((h && h.error) || 'No se pudo leer el día.');
    solicitudes = (s && s.solicitudes) || [];
    if (hoy.porContestar) { const b = await C.pedir('api/jornada/bandeja'); bandeja = (b && b.bandeja) || []; } else bandeja = [];
  }
  async function cargarMes() {
    const r = await C.pedir(`api/jornada/mes${elMes ? `?mes=${encodeURIComponent(elMes)}` : ''}`);
    if (!r || !r.ok) throw new Error((r && r.error) || 'No se pudo leer el mes.');
    mes = r; elMes = r.mes;
  }
  async function cargarObras() {
    const r = await C.pedir(`api/jornada/obras?q=${encodeURIComponent(buscar)}`);
    obras = (r && r.obras) || [];
  }

  async function abrir() {
    if (!activa()) return;
    try {
      await cargar();
      if (vista === 'mes') await cargarMes();
      if (vista === 'hoy') await cargarObras();
      pintar();
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-jo="recargar">Reintentar</button></div>`;
    }
  }

  /* ─────────────────────────── pintar */
  function barra() {
    const v = [['hoy', 'Hoy'], ['mes', 'Mi registro'], ['dias', 'Pedir días']];
    if (bandeja.length) v.push(['equipo', `Por contestar (${bandeja.length})`]);
    return `<nav class="jo-vistas">${v.map(([id, n]) => `<button type="button" data-jo-vista="${id}" class="${id === vista ? 'activa' : ''}">${esc(n)}</button>`).join('')}</nav>`;
  }

  function pintarHoy() {
    const d = hoy.dia;
    const dentro = hoy.dentro;
    const enObra = hoy.obraEnCurso;
    const tramos = d.tramos.map((t) => `<tr><td>${esc(t.desdeLocal)}</td><td>${t.hastaLocal ? esc(t.hastaLocal) : '<span class="jo-et bien">ahora</span>'}</td><td>${esc(obraTxt(t.obra))}</td><td class="num">${hm(t.minutos)}</td></tr>`).join('');
    const desc = (d.descuentos || []).map((x) => `${esc(x.nombre)} ${x.minutos} min${x.resta ? '' : ' (retribuido)'}`).join(' · ');
    const filasObras = obras.map((o) => `<tr data-jo-obra="${esc(o.id)}" class="${hoy.obraPropuesta && hoy.obraPropuesta.id === o.id ? 'propuesta' : ''}"><td>${esc(o.codigo || '')}</td><td>${esc(o.nombre || '')}</td><td class="jo-accion">${dentro ? (enObra && enObra.id === o.id ? '<span class="jo-et bien">aquí</span>' : '<button class="boton secundario" data-jo="cambiar">Cambiar</button>') : '<button class="boton" data-jo="entrar">Entrar</button>'}</td></tr>`).join('');
    return `
      <section class="jo-bloque">
        <p class="jo-linea"><b>${esc(fechaCorta(d.fecha))}</b> ${etiqueta(d)} ${dentro ? `en <b>${esc(obraTxt(enObra))}</b>` : ''}</p>
        <p class="jo-linea">Trabajado <b>${hm(d.netoMin)}</b> de ${hm(d.previstoMin)}${desc ? ` · descontado: ${desc}` : ''}</p>
        ${(d.avisos || []).map((a) => `<p class="jo-aviso">${esc(a)}</p>`).join('')}
        <div class="jo-botones">
          ${dentro ? '<button class="boton grande" data-jo="salir">Fichar salida</button>' : `<button class="boton grande" data-jo="entrarSin">Fichar entrada${hoy.obraPropuesta ? ` en ${esc(hoy.obraPropuesta.codigo || '')}` : hoy.nObras ? '' : ' (oficina)'}</button>`}
        </div>
      </section>
      ${tramos ? `<table class="jo-tabla"><thead><tr><th>Entrada</th><th>Salida</th><th>Obra</th><th class="num">Horas</th></tr></thead><tbody>${tramos}</tbody></table>` : ''}
      ${hoy.nObras ? `
      <section class="jo-bloque">
        <input type="search" class="jo-buscar" data-jo-buscar placeholder="Buscar obra por código o nombre" value="${esc(buscar)}" autocomplete="off">
        <table class="jo-tabla"><thead><tr><th>Código</th><th>Obra</th><th></th></tr></thead><tbody>${filasObras || '<tr><td colspan="3" class="vacio">Ninguna obra con ese texto.</td></tr>'}</tbody></table>
      </section>` : ''}`;
  }

  function pintarMes() {
    if (!mes) return '<p class="vacio">Cargando…</p>';
    const filas = mes.dias.map((d) => {
      const ent = d.tramos[0] ? d.tramos[0].desdeLocal : '';
      const ult = d.tramos[d.tramos.length - 1];
      const sal = ult ? (ult.hastaLocal || '…') : '';
      const corr = d.corregido ? ' <span class="jo-et aviso" title="Hora corregida; el original se conserva">corregido</span>' : '';
      return `<tr class="${d.estado === 'finde' ? 'finde' : ''}"><td>${diaSemana(d.fecha)} ${esc(d.fecha.slice(8))}</td><td>${esc(ent)}</td><td>${esc(sal)}</td><td class="num">${d.netoMin ? hm(d.netoMin) : ''}</td><td>${etiqueta(d)}${corr}</td></tr>`;
    }).join('');
    const t = mes.total;
    return `
      <div class="jo-mes">
        <button class="boton secundario" data-jo="mesAntes" aria-label="Mes anterior">‹</button>
        <b>${esc(mes.mes)}</b>
        <button class="boton secundario" data-jo="mesDespues" aria-label="Mes siguiente">›</button>
      </div>
      <table class="jo-tabla"><thead><tr><th>Día</th><th>Entra</th><th>Sale</th><th class="num">Horas</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3">Total (${t.dias} días)</td><td class="num">${hm(t.netoMin)}</td><td>de ${hm(t.previstoMin)}</td></tr></tfoot></table>
      ${t.porObra.length ? `<table class="jo-tabla"><thead><tr><th>Obra</th><th class="num">Horas</th></tr></thead><tbody>${t.porObra.map((p) => `<tr><td>${esc(obraTxt(p.obra))}</td><td class="num">${hm(p.minutos)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="pista">Para corregir una hora, en el ordenador (Jornada → Mi registro): queda quién, cuándo y por qué, y la hora original no se borra.</p>`;
  }

  function pintarDias() {
    const hoyF = hoy ? hoy.fecha : '';
    const filas = solicitudes.map((s) => `<tr><td>${esc(s.tipoNombre)}</td><td>${esc(fechaCorta(s.desde))}${s.hasta && s.hasta !== s.desde ? `–${esc(fechaCorta(s.hasta))}` : ''}</td><td class="num">${s.dias ?? ''}</td>
      <td><span class="jo-et ${ESTADO_SOL[s.estado] || 'neutra'}">${esc(s.estadoNombre)}</span>${s.respuesta ? `<br><small>${esc(s.respondidaPorNombre || '')}: ${esc(s.respuesta)}</small>` : ''}</td>
      <td>${s.estado === 'pendiente' ? `<button class="boton secundario" data-jo="anular" data-id="${esc(s.id)}">Anular</button>` : ''}</td></tr>`).join('');
    return `
      <section class="jo-bloque jo-form">
        <label>Qué<select data-jo-campo="tipo">
          <option value="vacaciones">Vacaciones</option><option value="asuntosPropios">Asuntos propios</option><option value="permiso">Permiso retribuido</option>
          <option value="medico">Médico</option><option value="formacion">Formación</option><option value="otro">Otro</option></select></label>
        <label>Desde<input type="date" data-jo-campo="desde" value="${esc(hoyF)}"></label>
        <label>Hasta<input type="date" data-jo-campo="hasta" value="${esc(hoyF)}"></label>
        <label>Motivo<input type="text" data-jo-campo="motivo" maxlength="300" placeholder="Obligatorio en un permiso"></label>
        <button class="boton grande" data-jo="pedir">Pedir</button>
      </section>
      <table class="jo-tabla"><thead><tr><th>Qué</th><th>Fechas</th><th class="num">Días</th><th>Respuesta</th><th></th></tr></thead>
        <tbody>${filas || '<tr><td colspan="5" class="vacio">Aún no has pedido días.</td></tr>'}</tbody></table>`;
  }

  function pintarEquipo() {
    const filas = bandeja.map((s) => `<tr><td>${esc(s.nombre)}</td><td>${esc(s.tipoNombre)}${s.motivo ? `<br><small>${esc(s.motivo)}</small>` : ''}</td><td>${esc(fechaCorta(s.desde))}${s.hasta && s.hasta !== s.desde ? `–${esc(fechaCorta(s.hasta))}` : ''} (${s.dias ?? '?'})</td>
      <td class="jo-accion"><input type="text" data-jo-resp="${esc(s.id)}" placeholder="Respuesta (obligatoria si rechazas)">
        <button class="boton" data-jo="aprobar" data-id="${esc(s.id)}">Aprobar</button>
        <button class="boton secundario" data-jo="rechazar" data-id="${esc(s.id)}">Rechazar</button></td></tr>`).join('');
    return `<table class="jo-tabla"><thead><tr><th>Quién</th><th>Qué</th><th>Fechas</th><th></th></tr></thead><tbody>${filas || '<tr><td colspan="4" class="vacio">Nada por contestar.</td></tr>'}</tbody></table>`;
  }

  function pintar() {
    if (!activa() || !hoy) return;
    const cuerpo = vista === 'mes' ? pintarMes() : vista === 'dias' ? pintarDias() : vista === 'equipo' ? pintarEquipo() : pintarHoy();
    const foco = document.activeElement && document.activeElement.hasAttribute('data-jo-buscar');
    $app.innerHTML = `<div class="jo">${barra()}${cuerpo}</div>`;
    if (foco) { const i = $app.querySelector('[data-jo-buscar]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  /* ─────────────────────────── acciones */
  async function hacer(fn) {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await fn();
      if (r && r.ok === false) throw new Error(r.error || 'No se pudo.');
      await abrir();
      return r;
    } catch (e) { C.aviso(e.message); } finally { ocupado = false; }
  }
  const fichar = (tipo, obraId) => hacer(() => C.postJson('api/jornada/fichar', { tipo, obraId: obraId || null }));
  const mover = (n) => { const [a, m] = elMes.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); elMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; abrir(); };

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const v = ev.target.closest('[data-jo-vista]');
    if (v) { vista = v.dataset.joVista; abrir(); return; }
    const b = ev.target.closest('[data-jo]');
    if (!b) return;
    const a = b.dataset.jo;
    const fila = b.closest('[data-jo-obra]');
    const obraId = fila ? fila.dataset.joObra : null;
    if (a === 'recargar') abrir();
    else if (a === 'entrar') fichar('entrada', obraId);
    else if (a === 'entrarSin') fichar('entrada', hoy.obraPropuesta ? hoy.obraPropuesta.id : null);
    else if (a === 'cambiar') fichar('entrada', obraId); /* entrar en otra obra cierra el tramo de la anterior */
    else if (a === 'salir') fichar('salida', hoy.obraEnCurso ? hoy.obraEnCurso.id : null);
    else if (a === 'mesAntes') mover(-1);
    else if (a === 'mesDespues') mover(1);
    else if (a === 'pedir') {
      const campo = (n) => { const el = $app.querySelector(`[data-jo-campo="${n}"]`); return el ? el.value : ''; };
      hacer(() => C.postJson('api/jornada/pedir', { tipo: campo('tipo'), desde: campo('desde'), hasta: campo('hasta') || campo('desde'), motivo: campo('motivo') }))
        .then((r) => { if (r && r.ok) C.aviso('Pedido. Te avisará tu responsable.', 'bien'); });
    } else if (a === 'anular') hacer(() => C.postJson('api/jornada/anular', { id: b.dataset.id }));
    else if (a === 'aprobar' || a === 'rechazar') {
      const r = $app.querySelector(`[data-jo-resp="${CSS.escape(b.dataset.id)}"]`);
      hacer(() => C.postJson('api/jornada/contestar', { id: b.dataset.id, decision: a === 'aprobar' ? 'aprobada' : 'rechazada', respuesta: r ? r.value : '' }));
    }
  });
  let reloj = null;
  $app.addEventListener('input', (ev) => {
    if (!activa() || !ev.target.hasAttribute('data-jo-buscar')) return;
    buscar = ev.target.value;
    clearTimeout(reloj);
    reloj = setTimeout(async () => { await cargarObras(); pintar(); }, 200);
  });

  /*
   * LA ENTRADA SOLA al abrir Cx (y al volver a ella otro día): la decide el
   * propio motor (solo la primera vez del día laborable, ni de vacaciones ni
   * en festivo), así que aquí basta con avisarle cada vez que se abre.
   */
  async function conectar() {
    const ses = window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion();
    if (!ses || !(ses.secciones || []).includes('jornada')) return false;
    try {
      const r = await C.postJson('api/jornada/conectar', {});
      if (r && r.fichado) C.aviso('Entrada fichada al abrir Cx.', 'bien');
    } catch (_) { /* sin conexión con el motor: ya lo hará la próxima vez */ }
    return true;
  }
  (function esperarSesion(n) {
    conectar().then((hecho) => { if (!hecho && n < 120) setTimeout(() => esperarSesion(n + 1), 1000); });
  })(0);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conectar(); });

  window.addEventListener('hashchange', () => { if (activa()) abrir(); });
  if (activa()) abrir();
})();
