'use strict';
/*
 * EL INICIO DEL MÓVIL SEGÚN EL ROL (8-nov-2026, JC eligió la opción C: «Mi obra» para quien
 * manda y «Mi día» para quien ejecuta; nota del bloc 1108-inicio-movil-por-rol). Aquí, sin
 * tocar el DOM, está la cuenta de cada bloque; carcasa.js solo pide los datos y pinta.
 *
 *   · «Mi obra» (director, jefe de obra, de producción, de departamento…): lo de hoy o el
 *     próximo día con trabajo, las atrasadas, el avance, incidencias y pruebas pendientes.
 *   · «Mi día» (encargado, operario, subcontrata): el día, lo que le toca y sus atrasadas.
 *     Sin cifras de la obra.
 * Los datos ya llegan recortados por el alcance del rol (las rutas del ordenador filtran en
 * el repositorio): aquí nadie ve lo que su puesto no ve porque no se le pide ni se le cuenta.
 * Sirve en el navegador (window.CX.inicioRol) y en node (module.exports) para las pruebas.
 */
(function inicioRol(raiz) {
  /* Quien ejecuta ve «Mi día»; todo el que lleva algo (obra, producción, departamento) ve «Mi obra». */
  const ROLES_MI_DIA = new Set(['encargadoObra', 'operario', 'encargadoMantenimiento', 'operarioMantenimiento', 'subcontrata', 'operarioSubcontrata', 'tecnicoQhse']);
  const tipoDeInicio = (rol) => (ROLES_MI_DIA.has(rol) ? 'dia' : 'obra');

  const PM_HECHA = new Set(['enMarcha', 'hecha']);
  const DIA3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const diaDe = (f) => new Date(`${f}T12:00:00`).getDay();
  const corto = (f) => `${DIA3[diaDe(f)]} ${f.slice(8, 10)}`;
  const cortoFecha = (f) => `${corto(f)}/${f.slice(5, 7)}`;
  const largo = (f) => `${DIA_LARGO[diaDe(f)]} ${f.slice(8, 10)}`;
  const esc0 = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const tipoSesion = (s) => String(s.tarea || (s.ambito === 'commissioning' ? 'Commissioning' : 'Incidencias')).toLowerCase();

  /** Las sesiones y los avisos de la persona en esta obra, ya separados en hoy / futuro / atrasado. */
  function repartir(plan, dia, obraId) {
    const planOk = Boolean(plan && plan.ok);
    const diaOk = Boolean(dia && dia.ok);
    const hoy = planOk ? plan.hoy : diaOk ? dia.hoy : null;
    const sesiones = planOk ? (plan.sesiones || []) : [];
    const items = (diaOk ? dia.items || [] : []).filter((i) => !obraId || !i.obraId || i.obraId === obraId);
    return { hoy, sesiones, items };
  }

  /** Un equipo por entrada (o la sesión sola si no lleva equipos). */
  function entradasDe(s, fecha) {
    const que = tipoSesion(s);
    if (!(s.items || []).length) return [{ clave: `s:${s.id}`, tag: s.tarea || que, que, sub: s.empresa || '', franja: s.franja || '', fecha, abrir: null, hecho: false }];
    return s.items.map((i) => ({ clave: `${s.id}:${i.id}`, tag: i.tag || i.texto, que, sub: i.sub || '', franja: s.franja || '', fecha, abrir: i.abrir || null, hecho: Boolean(i.hecho) }));
  }

  /** Lo de un día: sesiones, entradas (equipos y avisos) y reparto por turno. */
  function delDia(sesiones, items, fecha) {
    const ss = sesiones.filter((s) => s.fecha === fecha);
    const entradas = ss.flatMap((s) => entradasDe(s, fecha));
    const avisos = items.filter((i) => !i.vencida && i.fecha === fecha).map((i) => ({
      clave: `${i.tipo}:${i.id}`, tag: i.texto, que: i.tipo === 'ncr' ? 'no conformidad' : 'tarea', sub: i.sub || '', franja: '', fecha, abrir: i.abrir || null, hecho: false, aviso: true,
    }));
    const cuenta = (f) => entradas.filter((e) => e.franja === f).length;
    return { fecha, sesiones: ss, entradas: [...entradas, ...avisos], equipos: entradas.length, avisos: avisos.length, manana: cuenta('Mañana'), tarde: cuenta('Tarde'), todoDia: cuenta('Todo el día') };
  }

  /**
   * El bloque destacado: hoy si hay trabajo; si no, el próximo día que lo tenga.
   * { hoy, vacioHoy, dia: lo de hoy o del próximo día (null si no hay nada), esHoy }
   */
  function bloqueDelDia(plan, dia, obraId) {
    const { hoy, sesiones, items } = repartir(plan, dia, obraId);
    if (!hoy) return { hoy: null, vacioHoy: true, dia: null, esHoy: false, semana: [] };
    const deHoy = delDia(sesiones, items, hoy);
    if (deHoy.entradas.length) return { hoy, vacioHoy: false, dia: deHoy, esHoy: true, semana: sesiones.filter((s) => s.fecha > hoy) };
    const futuras = [...new Set([...sesiones.map((s) => s.fecha), ...items.map((i) => i.fecha)].filter((f) => f > hoy && (sesiones.some((s) => s.fecha === f) || items.some((i) => !i.vencida && i.fecha === f))))].sort();
    const siguiente = futuras.length ? delDia(sesiones, items, futuras[0]) : null;
    return { hoy, vacioHoy: true, dia: siguiente && siguiente.entradas.length ? siguiente : null, esHoy: false, semana: sesiones.filter((s) => s.fecha > hoy) };
  }

  /**
   * Las atrasadas: un equipo sin terminar de un día anterior, o un aviso vencido, es UNA.
   * (Las sesiones que ya acabaron el servidor no las manda; si llegan con todo hecho no cuentan.)
   */
  function atrasadas(plan, dia, obraId) {
    const { hoy, sesiones, items } = repartir(plan, dia, obraId);
    if (!hoy) return [];
    const deSesiones = sesiones.filter((s) => s.fecha < hoy).flatMap((s) => entradasDe(s, s.fecha)).filter((e) => !e.hecho);
    const vencidos = items.filter((i) => i.vencida).map((i) => ({
      clave: `${i.tipo}:${i.id}`, tag: i.texto, que: i.tipo === 'ncr' ? 'no conformidad' : 'tarea', sub: i.sub || '', franja: '', fecha: i.fecha, abrir: i.abrir || null, hecho: false, aviso: true,
    }));
    const vistas = new Set();
    return [...deSesiones, ...vencidos].filter((e) => (vistas.has(e.clave) ? false : vistas.add(e.clave)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.tag).localeCompare(String(b.tag), 'es', { numeric: true }));
  }

  /**
   * El avance: equipos puestos en marcha sobre el total de la obra. SOLO los confirmados, igual
   * que los KPI de Commissioning del escritorio (los de planos y pedidos «por confirmar» no
   * cuentan: commit 1cf56de5). Con conjuntos (split = UE + UI) se cuenta por conjunto.
   */
  function avance(cx) {
    if (!cx || !cx.ok) return null;
    const lista = cx.conjuntos && cx.conjuntos.length ? cx.conjuntos : (cx.equipos || []);
    const firmes = lista.filter((e) => !e.porConfirmar);
    const hechos = firmes.filter((e) => PM_HECHA.has(e.estadoPM)).length;
    return { hechos, total: firmes.length, porcentaje: firmes.length ? Math.round((hechos / firmes.length) * 100) : 0, porConfirmar: lista.length - firmes.length };
  }

  /** Incidencias abiertas (NCR activas y nuestras, como la lista por defecto) y pruebas que faltan. */
  function cifras({ cx, ncr }) {
    const filas = ncr && ncr.ok && Array.isArray(ncr.filas) ? ncr.filas : null;
    const t = cx && cx.ok && cx.totales ? (cx.totalesConjuntos && cx.totalesConjuntos.conjuntos ? { ...cx.totales, ...cx.totalesConjuntos } : cx.totales) : null;
    let pruebas = null;
    if (t) {
      const balanceo = Number(t.faltaBalanceo !== undefined ? t.faltaBalanceo : t.faltaEnsayo) || 0;
      const KPI_CX = (typeof window !== 'undefined' && window.KPI_CX) || (typeof require === 'function' ? require('../../shared/commissioning/kpiCx') : null);
      const estanq = t.pideEstanqueidad ? (KPI_CX ? KPI_CX.faltaEstanqueidad(t) : Number(t.faltaEstanqueidad) || 0) : 0;
      pruebas = balanceo + estanq;
    }
    return { incidencias: filas ? filas.filter((f) => f.activa && f.alcance === 'nuestra').length : null, pruebas };
  }

  /* ───────────────────────── HTML (sin tarjetas: filas finas) */

  const MAX_FILAS = 3;

  function filaEntrada(e, h, { cuando = 'fecha' } = {}) {
    const dentro = `<i class="marca${cuando === 'franja' ? ' ok' : ''}"></i>
      <span class="eq">${h.esc(e.tag)}<small>${h.esc([e.que, cuando === 'franja' ? e.sub : ''].filter(Boolean).join(' · '))}</small></span>
      <span class="cuando${cuando === 'franja' ? ' t' : ''}">${h.esc(cuando === 'fecha' ? cortoFecha(e.fecha) : (e.franja || ''))}</span>`;
    return e.abrir
      ? `<a class="ini-fila" href="#${h.esc(e.abrir.seccion)}" data-ir-abrir="${h.esc(e.abrir.id)}">${dentro}</a>`
      : `<div class="ini-fila">${dentro}</div>`;
  }

  /** Cabecera con cifra, las primeras filas y «Las N ›» que despliega el resto. */
  function listaCorta(id, titulo, entradas, h, opciones) {
    if (!entradas.length) return '';
    const primeras = entradas.slice(0, MAX_FILAS).map((e) => filaEntrada(e, h, opciones)).join('');
    const resto = entradas.slice(MAX_FILAS);
    return `<section class="ini-bloque" data-bloque-ini="${id}">
        <div class="ini-titulo"><span>${h.esc(titulo)}</span><b class="num">${h.cifra(entradas.length)}</b></div>
        ${primeras}
        ${resto.length ? `<details class="ini-mas"><summary>Las ${h.cifra(entradas.length)} ›</summary>${resto.map((e) => filaEntrada(e, h, opciones)).join('')}</details>` : ''}
      </section>`;
  }

  function turnos(d) {
    const partes = [];
    if (d.manana) partes.push(`${d.manana} mañana`);
    if (d.tarde) partes.push(`${d.tarde} tarde`);
    if (d.todoDia) partes.push(`${d.todoDia} todo el día`);
    return partes.join(' · ');
  }
  function turnosB(d) {
    const m = d.manana || d.todoDia; const t = d.tarde || d.todoDia;
    return m && t ? 'mañana y tarde' : m ? 'mañana' : t ? 'tarde' : '';
  }
  const trabajoDe = (d) => [d.equipos ? plural(d.equipos, 'equipo', 'equipos') : '', d.avisos ? plural(d.avisos, 'aviso', 'avisos') : ''].filter(Boolean).join(' · ');

  /** El bloque destacado de «Mi obra». */
  function htmlDiaObra(b, h) {
    if (!b.hoy) return '';
    const cabeza = b.esHoy ? `Hoy, ${cortoFecha(b.hoy)}` : `Hoy, ${cortoFecha(b.hoy)}, nada planificado`;
    let grande;
    let detalle = '';
    if (!b.dia) grande = 'Nada planificado en los próximos días';
    else if (b.esHoy) { grande = trabajoDe(b.dia); detalle = turnos(b.dia); } else { grande = `Próximo: ${corto(b.dia.fecha)} · ${trabajoDe(b.dia)}`; detalle = turnos(b.dia); }
    const filas = b.dia ? b.dia.sesiones.map((s) => h.filaSesion(s, false)).join('') + b.dia.entradas.filter((e) => e.aviso).map((e) => filaEntrada({ ...e, fecha: e.fecha }, h, { cuando: 'franja' })).join('') : '';
    const resto = (b.semana || []).filter((s) => !b.dia || s.fecha !== b.dia.fecha);
    return `<section class="ini-bloque ini-destacado" data-bloque-ini="dia">
        <div class="tenue">${h.esc(cabeza)}</div>
        <div class="ini-grande">${h.esc(grande)}</div>
        ${detalle || b.dia ? `<details class="ini-mas"><summary><span class="tenue">${h.esc(detalle)}</span> <span class="mas">Ver el día ›</span></summary>${filas}</details>` : ''}
        ${resto.length ? `<details class="ini-mas"><summary><span class="mas">Y después, ${h.cifra(resto.length)} ${resto.length === 1 ? 'sesión' : 'sesiones'} ›</span></summary>${resto.map((s) => h.filaSesion(s, true)).join('')}</details>` : ''}
      </section>`;
  }

  /** El bloque del día de «Mi día»: el día y luego «Lo que te toca». */
  function htmlDiaMio(b, h) {
    if (!b.hoy) return '';
    const cabeza = `Hoy, ${cortoFecha(b.hoy)}${b.esHoy ? '' : ', nada planificado'}`;
    const grande = !b.dia ? 'Nada planificado en los próximos días'
      : `${b.esHoy ? 'Hoy' : largo(b.dia.fecha).replace(/^./, (c) => c.toUpperCase())}${turnosB(b.dia) ? ` · ${turnosB(b.dia)}` : ''}`;
    const titulo = !b.dia ? '' : b.esHoy ? 'Lo que te toca hoy' : `Lo que te toca el ${DIA_LARGO[diaDe(b.dia.fecha)]}`;
    return `<section class="ini-bloque ini-destacado" data-bloque-ini="dia">
        <div class="tenue">${h.esc(cabeza)}</div>
        <div class="ini-grande">${h.esc(grande)}</div>
      </section>${b.dia ? listaCorta('toca', titulo, b.dia.entradas, h, { cuando: 'franja' }) : ''}`;
  }

  function htmlAtrasadas(lista, h, titulo) {
    return listaCorta('atras', titulo, lista, h, { cuando: 'fecha' });
  }

  function htmlAvance(a, h) {
    if (!a) return '';
    return `<a class="ini-bloque ini-avance" data-bloque-ini="avance" href="#commissioning" data-ir-seg="enMarcha">
        <div class="ini-titulo"><span>Avance</span><b class="num">${h.cifra(a.hechos)} / ${h.cifra(a.total)}</b></div>
        <div class="barra-av" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${a.porcentaje}"><i style="width:${a.porcentaje}%"></i></div>
        <div class="tenue">equipos puestos en marcha · ${a.porcentaje} %</div>
      </a>`;
  }

  function htmlCifras(c, h) {
    const celdas = [];
    if (c.incidencias !== null) celdas.push(`<a class="ini-kpi" href="#ncr" data-ir-filtro="ncr:abiertas"><b>${h.cifra(c.incidencias)}</b><span>incidencias abiertas</span></a>`);
    if (c.pruebas !== null) celdas.push(`<a class="ini-kpi" href="#commissioning" data-ir-seg="faltaBalanceo"><b>${h.cifra(c.pruebas)}</b><span>pruebas pendientes</span></a>`);
    return celdas.length ? `<section class="ini-kpis" data-bloque-ini="cifras">${celdas.join('')}</section>` : '';
  }

  const api = { ROLES_MI_DIA, tipoDeInicio, bloqueDelDia, atrasadas, avance, cifras, htmlDiaObra, htmlDiaMio, htmlAtrasadas, htmlAvance, htmlCifras, esc0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* Se carga ANTES que carcasa.js (que crea window.CX): se deja a mano y carcasa lo recoge. */
  if (raiz) raiz.CXInicioRol = api;
  if (raiz && raiz.CX) raiz.CX.inicioRol = api;
})(typeof window !== 'undefined' ? window : null);
