'use strict';
/*
 * LAS HOJAS DEL EQUIPO EN SU PANEL DEL PLANO (17-nov-2026, JC, nota 5019aeb1).
 *
 * El fallo: UE/UI-N00-SALA IT T07 tiene la toma de datos hecha (28/10/2026, 3 de 3) y la sección «Hojas» del panel
 * la presentaba como por hacer: tres botones iguales («Checklist →», «Hoja de toma de datos →», «Estanqueidad →»)
 * sacados de `acciones` (shared/commissioning/planoEquipos.js › acciones), que solo dice QUÉ hojas lleva la familia
 * y ofrece «toma de datos» según el COLOR del equipo (todo lo que no es verde: T07 está en azul por revalidar tras
 * una incidencia, no por la toma). El estado real de cada hoja —el del dossier del conjunto (electron/data/fichasPM.js
 * › dossier): en un split, la toma de la interior de referencia; el checklist más avanzado; la estanqueidad de la
 * exterior— ya llegaba en `tomas`, pero la sección no lo miraba.
 *
 * Aquí, cada hoja con su estado de un vistazo:
 *   hecha  (verde) — completa o firmada; la estanqueidad, también con la foto del manómetro (regla de la DF, 12-nov);
 *   aMedias (azul) — empezada, con cuántos datos lleva y lo primero que le falta;
 *   falta  (rojo) — sin empezar o sin ficha.
 * Con fecha (la de la toma, nunca la del fabricante) y quién. Nada se inventa: sin dato, no se escribe.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.HOJAS_EQUIPO_PANEL = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const ORDEN = ['checklist', 'datos', 'balanceo', 'estanqueidad'];
  const NOMBRE = { checklist: 'Checklist', datos: 'Toma de datos', balanceo: 'Balanceo', estanqueidad: 'Estanqueidad' };
  const TONO = { hecha: 'verde', aMedias: 'azul', falta: 'rojo' };
  const NOMBRE_ESTADO = { hecha: 'Hecha', aMedias: 'A medias', falta: 'Falta' };

  /** La hoja del panel de una toma: por su clase (checklist, fichaPM, balanceo, estanq*). */
  function idDeToma(t) {
    const c = String((t && t.clase) || '');
    if (c === 'checklist') return 'checklist';
    if (c === 'fichaPM') return 'datos';
    if (c === 'balanceo') return 'balanceo';
    if (/^estanq/i.test(c)) return 'estanqueidad';
    return null;
  }
  const fechaCorta = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10).split('-').reverse().join('/') : null);

  /** hecha | aMedias | falta de una toma. */
  function estadoDe(t, id) {
    if (!t) return 'falta';
    if (t.firmada || t.estado === 'firmada' || t.estado === 'completa') return id === 'balanceo' && t.resultado === 'noApto' ? 'aMedias' : 'hecha';
    if (id === 'estanqueidad' && (Number(t.fotos) || 0) > 0 && t.resultadoFicha !== 'noApto') return 'hecha';
    if (t.estado === 'pendiente' || (Number(t.rellenos) || 0) > 0) return 'aMedias';
    return 'falta';
  }

  /** Lo que se lee al lado del estado: fecha y quién si está hecha; cuánto lleva y qué falta si no. */
  function detalleDe(t, estado, id) {
    if (!t || t.estado === 'sinFicha') return 'Sin empezar';
    const partes = [];
    if (estado === 'hecha') {
      if (t.firmada) partes.push(t.firmadaPor ? `firmada por ${t.firmadaPor}` : 'firmada');
      const f = fechaCorta(t.fecha);
      if (f) partes.push(f);
      if (t.quien) partes.push(t.quien);
      if (id === 'estanqueidad' && !(t.estado === 'completa' || t.firmada) && t.fotos) partes.push('con foto del manómetro');
      if (id === 'balanceo' && t.obligatorios) partes.push(`${t.rellenos} de ${t.obligatorios} bocas`);
      return partes.join(' · ');
    }
    if (t.obligatorios) partes.push(`${t.rellenos} de ${t.obligatorios}${t.hoja ? ' bocas' : ' datos'}`);
    if (t.fotos) partes.push(`${t.fotos} foto${t.fotos === 1 ? '' : 's'}`);
    if (estado === 'aMedias' && t.resultado === 'noApto') partes.push('no apto');
    const f = fechaCorta(t.fecha);
    if (f && estado === 'aMedias') partes.push(f);
    return partes.length ? partes.join(' · ') : (estado === 'falta' ? 'Sin empezar' : '');
  }

  /*
   * VERSIONES DE LA HOJA (20-nov-2026, JC): tras un NO APTO se abre la v2, v3…; la fila es siempre la última
   * (la que cuenta) y dice «v2 · APTO»; las anteriores, plegadas, se pueden abrir para leerlas.
   */
  const RESULTADO_VERSION = { apto: 'APTO', noApto: 'NO APTO', aRevisar: 'A REVISAR' };
  const ESTADO_VERSION = { sinEmpezar: 'sin empezar', pendiente: 'a medias', completa: 'completa', firmada: 'firmada' };
  function textoVersion(n, resultado, estado) {
    const r = RESULTADO_VERSION[resultado] || ESTADO_VERSION[estado] || '';
    return `v${n}${r ? ` · ${r}` : ''}`;
  }
  /** «v2 · APTO» de la versión actual, o null si la hoja no ha pasado de la v1. */
  function versionDe(t) {
    const n = Number(t && t.versionToma) || 1;
    if (n < 2) return null;
    return textoVersion(n, t.resultadoFicha || (t.hoja ? null : t.resultado), t.estado);
  }
  /** Las versiones anteriores de una toma: [{ n, texto, detalle, tono }], de la v1 a la penúltima. */
  function anterioresDe(t) {
    return ((t && Array.isArray(t.versiones) ? t.versiones : [])).filter((v) => v && !v.actual).map((v) => ({
      n: v.n, texto: textoVersion(v.n, v.resultado, v.estado),
      detalle: [fechaCorta(v.fecha), v.autor, v.firmada ? 'firmada' : null, v.fotos ? `${v.fotos} foto${v.fotos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '),
      tono: v.resultado === 'noApto' ? 'rojo' : v.resultado === 'apto' ? 'verde' : 'azul',
    }));
  }

  /**
   * Las filas de la sección: [{ id, nombre, unidad, estado, tono, texto, detalle, faltan, toma }].
   * `acciones` = las hojas que lleva el equipo ([{ id }]); `tomas` = las de electron/data/planoEquipos.js › tomasDelEquipo.
   * `toma` es el índice en `tomas` (para «Abrir» y «PDF»), o null si la hoja aún no tiene ficha.
   */
  function filas({ acciones = [], tomas = [] } = {}) {
    const lleva = new Set((acciones || []).map((a) => (a && a.id) || a).filter(Boolean));
    if (lleva.has('checklist')) lleva.add('datos'); /* la toma de datos va con la familia, aunque el equipo ya esté verde */
    const porId = new Map();
    (tomas || []).forEach((t, i) => {
      const id = idDeToma(t);
      if (!id) return;
      /* 20-nov (JC, CRAC CPD N10_01: «lo que cuenta es la toma de datos del conjunto»): lo guardado antes en otra
         unidad del conjunto (conservada) ni es fila ni cuenta en «X de N»; sale aparte, en `conservadas`. */
      if (t && t.conservada) return;
      const l = porId.get(id) || [];
      l.push({ t, i });
      porId.set(id, l);
      lleva.add(id);
    });
    const fuera = [];
    for (const id of ORDEN) {
      if (!lleva.has(id)) continue;
      const ts = porId.get(id) || [null];
      for (const x of ts) {
        const t = x ? x.t : null;
        const estado = estadoDe(t, id);
        fuera.push({
          id, nombre: NOMBRE[id], unidad: t && t.unidadTag ? t.unidadTag : null,
          estado, tono: TONO[estado], texto: NOMBRE_ESTADO[estado], detalle: detalleDe(t, estado, id),
          /* Hecha (datos tomados) pero sin firmar: lo que aún le falta para firmarla, que no se esconda. */
          faltan: !t || t.firmada ? [] : (t.faltan || []), nFaltan: t && !t.firmada ? (t.nFaltan || 0) : 0,
          paraFirmar: estado === 'hecha' && Boolean(t && !t.firmada && (t.faltan || []).length),
          toma: x ? x.i : null, conPdf: Boolean(t && t.clave && t.plantilla && t.estado !== 'sinFicha' && t.clase !== 'balanceo'),
          version: versionDe(t), anteriores: anterioresDe(t),
        });
      }
    }
    return fuera;
  }

  /**
   * Lo guardado antes en otra unidad del conjunto (20-nov): se conserva y se puede abrir, pero no cuenta.
   * [{ id, nombre, unidad, estado, tono, texto, detalle, toma, conPdf }]; `toma` = índice en `tomas`.
   */
  function conservadas({ tomas = [] } = {}) {
    const fuera = [];
    (tomas || []).forEach((t, i) => {
      if (!t || !t.conservada) return;
      const id = idDeToma(t);
      if (!id) return;
      const estado = estadoDe(t, id);
      fuera.push({ id, nombre: NOMBRE[id], unidad: t.unidadTag || null, estado, tono: TONO[estado], texto: NOMBRE_ESTADO[estado],
        detalle: detalleDe(t, estado, id), toma: i, conPdf: Boolean(t.clave && t.plantilla && t.estado !== 'sinFicha' && t.clase !== 'balanceo') });
    });
    return fuera;
  }

  /** «2 de 4 hechas», para el título de la sección. */
  function resumen(fs) {
    const n = (fs || []).length;
    const h = (fs || []).filter((f) => f.estado === 'hecha').length;
    return n ? `${h} de ${n} hecha${n === 1 ? '' : 's'}` : '';
  }

  return { ORDEN, NOMBRE, TONO, idDeToma, estadoDe, detalleDe, filas, conservadas, resumen, fechaCorta, versionDe, anterioresDe, textoVersion };
});
