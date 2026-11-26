'use strict';
/*
 * VALIDAR (LA DF) Y RECEPCIONAR (LA PROPIEDAD) CADA EQUIPO O CONJUNTO
 * (JC, 21-nov-2026, nota 149df34f).
 *
 * Dos marcas por equipo o conjunto, cada una de un solo rol (shared/roles.js ›
 * MARCAS_EQUIPO):
 *   · Validado / No validado — solo la dirección facultativa.
 *   · Recepcionado / No recepcionado — solo la propiedad, y solo lo que la DF
 *     ya validó.
 * Cada marca guarda quién, cuándo y una observación (obligatoria en «No
 * validado» y «No recepcionado»: es el motivo). Nada se borra: cada marca y cada
 * «deshacer» es una fila nueva (historial). El estado de hoy sale de reproducir
 * el historial.
 *
 * Las marcas van a la CABEZA del conjunto (shared/commissioning/conjuntos.js ›
 * agrupar · cabezaId): pulsar una unidad abre el conjunto, y el conjunto se
 * valida y se recepciona entero.
 *
 * Lógica pura (sin base), para node, la pantalla del escritorio y el móvil.
 */
(function () {
  /* En el navegador del móvil no se carga roles.js: ahí solo se pinta (lo que puede cada uno lo dice el motor en `puede`). */
  const ROLES = typeof require === 'function' ? require('../roles') : (window.ROLES || { puedeMarcarEquipo: () => false });

  const TIPOS = {
    validacion: { si: 'validado', no: 'noValidado', nombre: 'Validación DF', quien: 'la dirección facultativa' },
    recepcion: { si: 'recepcionado', no: 'noRecepcionado', nombre: 'Recepción', quien: 'la propiedad' },
  };
  const ETIQUETAS = {
    validado: 'Validado', noValidado: 'No validado',
    recepcionado: 'Recepcionado', noRecepcionado: 'No recepcionado',
    sinValidar: 'Sin validar',
  };
  /* Colores de la paleta (teal, verde, azul; el granate de la casa para lo rechazado). Sin negro ni amarillo. */
  const COLORES = {
    sinValidar: null,
    validado: '#2b6cb0',
    noValidado: '#9b2c3a',
    recepcionado: '#2f855a',
    noRecepcionado: '#9b2c3a',
  };

  /* En el plano: el orden de la leyenda y el gris claro de lo que aún no tiene marca (el «sin dato» de colorBloque.js). */
  const ORDEN_PLANO = ['sinValidar', 'validado', 'noValidado', 'recepcionado', 'noRecepcionado'];
  const COLOR_PLANO = { ...COLORES, sinValidar: '#d3d6db' };

  const texto = (v) => String(v ?? '').trim();
  const orden = (a, b) => String(a.en || a.creadoEn || '').localeCompare(String(b.en || b.creadoEn || ''))
    || String(a.id || '').localeCompare(String(b.id || ''));

  /**
   * El estado de UNA marca (las filas de una tabla para un equipo): la última
   * marca que nadie ha deshecho. `historial` va en orden, con `deshecha`.
   */
  function estadoDe(filas = []) {
    const lista = [...(filas || [])].sort(orden);
    const deshechas = new Set(lista.filter((f) => f.accion === 'deshacer' && f.deshace).map((f) => f.deshace));
    const vivas = lista.filter((f) => f.accion !== 'deshacer' && !deshechas.has(f.id));
    const actual = vivas.length ? vivas[vivas.length - 1] : null;
    return {
      valor: actual ? actual.valor : null,
      actual,
      historial: lista.map((f) => ({ ...f, deshecha: f.accion !== 'deshacer' && deshechas.has(f.id) })),
    };
  }

  /** Las dos marcas de un equipo y su fase: sinValidar → validado/noValidado → recepcionado/noRecepcionado. */
  function estadoEquipo({ validaciones = [], recepciones = [] } = {}) {
    const validacion = estadoDe(validaciones);
    const recepcion = estadoDe(recepciones);
    let fase = 'sinValidar';
    if (validacion.valor) fase = validacion.valor;
    if (validacion.valor === 'validado' && recepcion.valor) fase = recepcion.valor;
    return { validacion, recepcion, fase, etiqueta: ETIQUETAS[fase], color: COLORES[fase] };
  }

  /** ¿Se puede poner esta marca? { ok } o { ok: false, error }. */
  function comprobarMarca({ rol, tipo, valor, observacion, estado } = {}) {
    const t = TIPOS[tipo];
    if (!t) return { ok: false, error: 'Marca desconocida.' };
    if (!ROLES.puedeMarcarEquipo(rol, tipo)) {
      return { ok: false, error: `${t.nombre}: solo la pone ${t.quien}.` };
    }
    if (valor !== t.si && valor !== t.no) return { ok: false, error: 'Valor de la marca desconocido.' };
    if (valor === t.no && !texto(observacion)) {
      return { ok: false, error: `Escribe el motivo de «${ETIQUETAS[valor]}».` };
    }
    const e = estado || estadoEquipo();
    if (tipo === 'recepcion' && e.validacion.valor !== 'validado') {
      return { ok: false, error: 'Este equipo no está validado por la DF: no se puede recepcionar todavía.' };
    }
    if (tipo === 'validacion' && e.recepcion.valor === 'recepcionado') {
      return { ok: false, error: 'El equipo ya está recepcionado: la propiedad tiene que deshacer la recepción antes.' };
    }
    if (e[tipo].valor === valor) return { ok: false, error: `Ya está «${ETIQUETAS[valor]}».` };
    return { ok: true };
  }

  /** ¿Se puede deshacer la marca de hoy? Deshace la última viva; queda en el historial. */
  function comprobarDeshacer({ rol, tipo, estado } = {}) {
    const t = TIPOS[tipo];
    if (!t) return { ok: false, error: 'Marca desconocida.' };
    if (!ROLES.puedeMarcarEquipo(rol, tipo)) return { ok: false, error: `${t.nombre}: solo la quita ${t.quien}.` };
    const e = estado || estadoEquipo();
    if (!e[tipo].actual) return { ok: false, error: 'No hay ninguna marca que deshacer.' };
    if (tipo === 'validacion' && e.recepcion.valor === 'recepcionado') {
      return { ok: false, error: 'El equipo ya está recepcionado: la propiedad tiene que deshacer la recepción antes.' };
    }
    return { ok: true, deshace: e[tipo].actual.id };
  }

  /** Las filas de las dos tablas, por equipo (cabeza). */
  function porEquipo(validaciones = [], recepciones = []) {
    const m = new Map();
    const de = (id) => { if (!m.has(id)) m.set(id, { validaciones: [], recepciones: [] }); return m.get(id); };
    for (const f of validaciones || []) if (f && f.equipoId) de(f.equipoId).validaciones.push(f);
    for (const f of recepciones || []) if (f && f.equipoId) de(f.equipoId).recepciones.push(f);
    const r = new Map();
    for (const [id, x] of m) r.set(id, estadoEquipo(x));
    return r;
  }

  /** Las cifras de la franja de KPI: de `total` equipos (líneas), cuántos en cada fase. */
  function cifras(estados, total) {
    const c = { validados: 0, noValidados: 0, recepcionados: 0, noRecepcionados: 0 };
    for (const e of estados || []) {
      if (!e) continue;
      if (e.validacion.valor === 'validado') c.validados += 1;
      if (e.validacion.valor === 'noValidado') c.noValidados += 1;
      if (e.fase === 'recepcionado') c.recepcionados += 1;
      if (e.fase === 'noRecepcionado') c.noRecepcionados += 1;
    }
    c.sinValidar = Math.max(0, Number(total || 0) - c.validados - c.noValidados);
    return c;
  }

  /** Una fila nueva del historial (sin id: lo pone el repositorio). */
  function filaMarca({ obraId, equipoId, tipo, valor, observacion, persona, perfil, en }) {
    return {
      obraId, equipoId, accion: 'marcar', valor, observacion: texto(observacion) || null, deshace: null,
      personaId: persona && persona.id ? persona.id : null,
      personaNombre: persona && persona.nombre ? persona.nombre : null,
      perfil: perfil || null, en: en || new Date().toISOString(), tipo,
    };
  }
  function filaDeshacer({ obraId, equipoId, tipo, deshace, observacion, persona, perfil, en }) {
    return { ...filaMarca({ obraId, equipoId, tipo, valor: null, observacion, persona, perfil, en }), accion: 'deshacer', deshace };
  }

  /** «Validado · Ana (DF) · 21/11/2026» para el panel y el PDF. */
  function linea(est) {
    if (!est || !est.actual) return null;
    const a = est.actual;
    const d = String(a.en || '').slice(0, 10).split('-').reverse().join('/');
    return [ETIQUETAS[a.valor], a.personaNombre, d].filter(Boolean).join(' · ') + (a.observacion ? ` — ${a.observacion}` : '');
  }

  const escR = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const diaR = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');

  /** La pastilla de la fase (lista, plano y panel). Sin marca: nada (lo de hoy no cambia). */
  function pastilla(fase) {
    if (!fase || fase === 'sinValidar' || !COLORES[fase]) return '';
    const c = COLORES[fase];
    return `<span class="pastillaRdf" data-rdf-fase="${fase}" style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;line-height:16px;white-space:nowrap;color:${c};border:1px solid ${c};background:#fff">${escR(ETIQUETAS[fase])}</span>`;
  }

  /**
   * EL BLOQUE DEL PANEL DEL EQUIPO (escritorio y móvil, mismo HTML): las dos
   * marcas de hoy, los botones de quien puede ponerlas, el motivo y el
   * historial plegado. `st` = lo que da electron/data/recepcionDF.js › estado.
   * Los botones llevan data-rdf-marcar="tipo:valor" y data-rdf-deshacer="tipo";
   * el motivo, data-rdf-obs.
   */
  function htmlPanel(st) {
    if (!st || !st.ok) return '';
    const puede = st.puede || {};
    const fila = (tipo) => {
      const t = TIPOS[tipo];
      const e = st[tipo] || {};
      const lin = st.lineas && st.lineas[tipo];
      const bloqueada = tipo === 'recepcion' && (st.validacion || {}).valor !== 'validado';
      const manda = tipo === 'validacion' ? puede.validar : puede.recepcionar;
      const botones = manda ? `<span class="botonesRdf">
          <button type="button" data-rdf-marcar="${tipo}:${t.si}"${bloqueada ? ' disabled title="Primero lo tiene que validar la DF"' : ''}>${escR(ETIQUETAS[t.si])}</button>
          <button type="button" data-rdf-marcar="${tipo}:${t.no}"${bloqueada ? ' disabled title="Primero lo tiene que validar la DF"' : ''}>${escR(ETIQUETAS[t.no])}</button>
          ${e.actual ? `<button type="button" class="enlace" data-rdf-deshacer="${tipo}">Deshacer</button>` : ''}</span>` : '';
      const aviso = manda && bloqueada ? ' <span class="pista">· La DF aún no lo ha validado: no se puede recepcionar.</span>' : '';
      return `<tr><th>${escR(t.nombre)}</th><td>${lin ? escR(lin) : `<span class="pista">${tipo === 'validacion' ? 'Sin validar' : 'Sin recepcionar'}</span>`}${aviso ? ` ${aviso}` : ''}</td><td>${botones}</td></tr>`;
    };
    const historial = [...((st.validacion || {}).historial || []).map((h) => ({ ...h, tipo: 'validacion' })), ...((st.recepcion || {}).historial || []).map((h) => ({ ...h, tipo: 'recepcion' }))]
      .sort((a, b) => String(b.en || '').localeCompare(String(a.en || '')));
    const hist = historial.length ? `<details class="historialRdf"><summary>Historial (${historial.length})</summary>
        <table class="hoja"><thead><tr><th>Fecha</th><th>Marca</th><th>Quién</th><th>Observación</th></tr></thead><tbody>${historial.map((h) => `<tr${h.deshecha ? ' style="text-decoration:line-through;opacity:.6"' : ''}>
          <td>${escR(diaR(h.en))} ${escR(String(h.en || '').slice(11, 16))}</td>
          <td>${h.accion === 'deshacer' ? `Deshace ${escR(TIPOS[h.tipo].nombre.toLowerCase())}` : escR(ETIQUETAS[h.valor] || h.valor)}</td>
          <td>${escR([h.personaNombre, h.perfil].filter(Boolean).join(' · '))}</td>
          <td>${escR(h.observacion || '')}</td></tr>`).join('')}</tbody></table></details>` : '';
    const obs = puede.validar || puede.recepcionar
      ? `<label class="obsRdf">Observación <span class="pista">(obligatoria en «No…»)</span><input type="text" data-rdf-obs maxlength="300" style="width:100%"></label>` : '';
    return `<section class="bloqueRdf" data-rdf-equipo="${escR(st.equipoId)}">
      <h4>Validación y recepción${(st.unidades || []).length > 1 ? ` <span class="pista">· el conjunto: ${escR(st.unidades.join(' + '))}</span>` : ''} ${pastilla(st.fase)}</h4>
      <table class="hoja datosFicha"><tbody>${fila('validacion')}${fila('recepcion')}</tbody></table>${obs}${hist}</section>`;
  }

  const API = { ORDEN_PLANO, COLOR_PLANO, pastilla, htmlPanel, TIPOS, ETIQUETAS, COLORES, estadoDe, estadoEquipo, comprobarMarca, comprobarDeshacer, porEquipo, cifras, filaMarca, filaDeshacer, linea };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.RECEPCION_DF = API;
})();
