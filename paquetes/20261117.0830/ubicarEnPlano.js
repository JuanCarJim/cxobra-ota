/* UBICAR EQUIPOS EN EL PLANO DEL MODELO, TAMBIÉN DESDE EL MÓVIL (17-nov-2026, JC: «Los equipos sin ubicar debemos de ser
 * capaces de ubicarlos desde el móvil in situ»).
 *
 * Es la misma colocación a mano del escritorio (Commissioning › Plano, franja «Por ubicar»): se guarda en
 * equiposObra.posicionPlano ({ ifc, x, y, por, en, origen: 'manual' }) con electron/obra/data/planosIfc.colocarEnModelo, y
 * al leer la pone en su sitio planosEdificio.ubicarAMano (marca u 'm'). Aquí solo lo que comparten la ruta del móvil, la
 * lista que sale al teléfono y su pantalla, para no repetir la regla en cada sitio:
 *   · quién puede ubicar (el mismo permiso que el escritorio: planoEquipos › editar, y nunca en modo obra);
 *   · qué equipos de una planta están «por ubicar» (sin marca en el plano del modelo, o en la franja «sin sala» al pie);
 *   · quién y cuándo los colocó a mano, y cuáles trae el modelo con su bloque (esos no se mueven a mano);
 *   · el punto del plano (fracción 0..1) que corresponde a un toque en pantalla, o nada si cae fuera del dibujo.
 * Sirve en Node y en el navegador (window.UBICAR_PLANO).
 */
(function () {
  'use strict';

  /** Quien coloca a mano en el escritorio coloca en el móvil: planoEquipos › editar (shared/roles.js), fuera del modo obra. */
  function puedeUbicar(puede, rol, { modoObra = false } = {}) {
    return !modoObra && typeof puede === 'function' && Boolean(puede(rol, 'planoEquipos', 'editar'));
  }

  /** Una marca del plano del modelo es un sitio de verdad si no es la franja «sin sala, por confirmar» (u 'b') del pie. */
  const enSuSitio = (m) => Boolean(m && m.e && m.x != null && m.y != null && m.u !== 'b');

  /**
   * Los equipos de una planta que siguen por ubicar en el plano del modelo: los que no tienen marca o solo la de la franja.
   * `marcas`: las del plano (planosIfc.calcular). Devuelve los ids, en el orden de `equipos`.
   */
  function porUbicar(equipos = [], marcas = []) {
    const ya = new Set((marcas || []).filter(enSuSitio).map((m) => m.e));
    return (equipos || []).filter((e) => e && e.id && !ya.has(e.id)).map((e) => e.id);
  }

  /** Quién y cuándo colocó a mano cada equipo (marcas u 'm' de planosEdificio.ubicarAMano): { equipoId: { por, en } }. */
  function aMano(marcas = [], ids = null) {
    const r = {};
    for (const m of marcas || []) {
      if (!m || m.u !== 'm' || !m.e || (ids && !ids.has(m.e)) || r[m.e]) continue;
      r[m.e] = { por: String(m.por || '').slice(0, 80), en: String(m.en || '').slice(0, 40) };
    }
    return r;
  }

  /* Las vías que no son el bloque del modelo: a mano (m), por sala (s), por TAG (t), por el plano PDF (f) y la franja (b). */
  const VIAS_SUELTAS = new Set(['m', 's', 't', 'f', 'b']);
  /**
   * Los equipos que el modelo IFC trae con su bloque dibujado: su sitio es el del modelo y no se mueven a mano (calcular
   * coloca a mano solo lo que no tiene bloque). Devuelve sus ids.
   */
  function delModelo(marcas = [], ids = null) {
    const r = new Set();
    for (const m of marcas || []) if (m && m.e && (!ids || ids.has(m.e)) && !VIAS_SUELTAS.has(m.u)) r.add(m.e);
    return [...r];
  }

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  /** «Ubicado a mano por Ana · 17-nov 08:10» (hora local). */
  function dichoAMano(m) {
    if (!m) return '';
    const d = m.en ? new Date(m.en) : null;
    const dd = (n) => String(n).padStart(2, '0');
    const cuando = d && !Number.isNaN(d.getTime()) ? ` · ${d.getDate()}-${MESES[d.getMonth()]} ${dd(d.getHours())}:${dd(d.getMinutes())}` : '';
    return `Ubicado a mano${m.por ? ` por ${m.por}` : ''}${cuando}`;
  }

  /**
   * El punto del plano bajo un toque: `caja` es el rectángulo del dibujo en pantalla (getBoundingClientRect del lienzo).
   * Devuelve [x, y] en fracción del plano, o null si el toque cae fuera (el hueco bajo un plano apaisado no es un sitio).
   */
  function puntoDelToque(caja, cx, cy) {
    if (!caja || !(caja.width > 0) || !(caja.height > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    const x = (cx - caja.left) / caja.width;
    const y = (cy - caja.top) / caja.height;
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
    const r6 = (v) => Math.round(v * 1e6) / 1e6;
    return [r6(x), r6(y)];
  }

  /* ── 17-nov (v2, JC: «Por nombre de equipo será difícil ubicarlo, hay que poder acceder a toda la info posible de proyecto de
     ese equipo para poder ubicarlo bien»): las pistas para encontrarlo en obra. Solo lo que la base trae de verdad: un campo
     vacío no sale. ── */
  const limpio = (v, n = 160) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const json = (v) => { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return null; } };
  const ORIGEN = { listado: 'Listado de equipos', plano: 'Plano', pedido: 'Pedido', presupuesto: 'Presupuesto', ifc: 'Modelo IFC', albaran: 'Albarán', manual: 'Alta a mano' };

  /**
   * Las pistas de un equipo por ubicar, de su fila de equiposObra: zona, sala por arquitectura (código gris), a qué sirve
   * (equipo asociado, sistema, circuito), de dónde salió (listado, plano, pedido…), su pedido y albarán, sus notas y la
   * partida del presupuesto cuando el modelo casa con una sola. `partidas`: partidasDeObra (codigo, resumen, codigos).
   * Devuelve solo las claves con dato.
   */
  function pistaDe(f, { partidas = null } = {}) {
    if (!f) return {};
    const r = {};
    const zona = limpio(f.zona, 60); if (zona) r.zona = zona;
    const gris = limpio(f.salaGris, 40);
    if (gris) r.salaGris = { codigo: gris, ...(limpio(f.salaGrisNombre, 80) ? { nombre: limpio(f.salaGrisNombre, 80) } : {}), ...(f.salaGrisEstado && f.salaGrisEstado !== 'asignada' ? { estado: limpio(f.salaGrisEstado, 30) } : {}) };
    const cod = limpio(f.codSala, 40); if (cod && cod !== gris) r.codSala = cod;
    const sirve = [['Va con', f.equipoAsociado], ['Sistema', f.sistema], ['Circuito', f.circuito], ['Red', f.instalacion]].map(([k, v]) => [k, limpio(v, 80)]).filter(([, v]) => v);
    if (sirve.length) r.sirve = sirve.map(([k, v]) => ({ k, v }));
    const den = limpio(f.denominacion, 120);
    if (den && den !== limpio(f.tag, 120) && den !== limpio(f.modelo, 120)) r.denominacion = den;
    const fa = json(f.fuenteAlta);
    const tipo = (fa && fa.tipo) || f.origenAlta || '';
    if (tipo || (fa && fa.nombre)) r.origen = { tipo: ORIGEN[tipo] || limpio(tipo, 30), ...(fa && fa.nombre ? { nombre: limpio(fa.nombre, 140) } : {}) };
    const compra = json(f.compraEquipo);
    const alb = (json(f.albaranesEquipo) || []).find((a) => a && a.albaran);
    const ped = compra && compra.pedido;
    if (ped || alb) {
      r.compra = {
        ...(ped && ped.numero ? { pedido: limpio(ped.numero, 40) } : alb && alb.pedido ? { pedido: limpio(alb.pedido, 40) } : {}),
        ...((ped && ped.proveedor) || (alb && alb.proveedor) ? { proveedor: limpio((ped && ped.proveedor) || alb.proveedor, 60) } : {}),
        ...(alb ? { albaran: limpio(alb.albaran, 40), ...(alb.fecha ? { fecha: limpio(alb.fecha, 10) } : {}) } : {}),
        ...(ped && ped.enlace && /^https:\/\//.test(ped.enlace) ? { enlace: String(ped.enlace).slice(0, 400) } : {}),
      };
    }
    /* Las notas sin importes: para encontrar el equipo no hacen falta, y el móvil lo ve también quien no ve dinero. */
    const notas = limpio(String(f.notas || '').replace(/\s*\(?\s*-?[\d.]+(,\d+)?\s*€(\s*ud\.)?\s*\)?/g, ''), 400); if (notas) r.notas = notas;
    if (Array.isArray(partidas) && f.modelo) {
      const mod = limpio(f.modelo, 80).toUpperCase().replace(/\s+/g, '');
      const casan = partidas.filter((p) => (p.codigos || []).some((c) => String(c).toUpperCase().replace(/\s+/g, '') === mod));
      if (casan.length === 1) r.partida = { codigo: limpio(casan[0].codigo, 30), resumen: limpio(casan[0].resumen, 140) };
      else if (casan.length > 1) r.partidas = casan.length;
    }
    return r;
  }

  /** La línea corta bajo el TAG en la lista «por ubicar»: sala (nombre y código), zona y a qué va. */
  function lineaPista(e) {
    const p = (e && e.pista) || {};
    const sala = p.salaGris ? [p.salaGris.nombre, p.salaGris.codigo].filter(Boolean).join(' ') : limpio(e && e.sala, 80);
    const va = p.sirve && p.sirve[0] ? `${p.sirve[0].k.toLowerCase()} ${p.sirve[0].v}` : '';
    return [sala, p.zona, va].filter(Boolean).join(' · ');
  }

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** El buscador de la lista «por ubicar»: TAG, tipo, modelo, sala (nombre o código), zona, denominación o a qué va. */
  function casaBusqueda(e, q, tipo = '') {
    const t = norm(q).trim();
    if (!t) return true;
    const p = (e && e.pista) || {};
    const campos = [e.tag, tipo, e.tipo, e.marca, e.modelo, e.sala, p.zona, p.codSala, p.denominacion, p.salaGris && p.salaGris.codigo, p.salaGris && p.salaGris.nombre, ...(p.sirve || []).map((s) => s.v)];
    const todo = norm(campos.filter(Boolean).join(' | '));
    return t.split(/\s+/).every((w) => todo.includes(w));
  }

  /**
   * El rótulo de su sala en el plano del modelo (plano.salas: { t, x, y, w?, h?, codigo? }): por el código gris, o por el
   * nombre si en la planta solo hay una sala con ese nombre. null si no está o es ambigua.
   */
  function salaEnPlano(salas = [], e, { cerca = [] } = {}) {
    const p = (e && e.pista) || {};
    const cods = [p.salaGris && p.salaGris.codigo, p.codSala].filter(Boolean);
    const lista = (salas || []).filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.y));
    for (const c of cods) { const s = lista.filter((x) => x.codigo && x.codigo === c); if (s.length === 1) return s[0]; }
    const nombre = norm((p.salaGris && p.salaGris.nombre) || '').trim();
    if (!nombre) return null;
    const s = lista.filter((x) => norm(x.t).trim() === nombre);
    if (s.length === 1) return s[0];
    /* Varias salas con ese nombre (tres «Sala DAS» en N00): la que tiene dentro a uno de su conjunto ya ubicado. */
    const dentro = (r, [x, y]) => r.w > 0 && r.h > 0 && Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2;
    const con = s.filter((r) => (cerca || []).some((pt) => Array.isArray(pt) && dentro(r, pt)));
    return con.length === 1 ? con[0] : null;
  }

  /**
   * Los ya ubicados que sirven de referencia: los de su misma sala, su conjunto (UE/UI), o los que van con él o con su mismo
   * equipo asociado. `equipos`: los de la planta con x/y; `fuera`: ids de la franja (no cuentan). Hasta `max`.
   */
  function hermanos(equipos = [], e, { fuera = [], max = 6 } = {}) {
    if (!e) return [];
    const no = new Set(fuera); no.add(e.id);
    const p = e.pista || {};
    const sala = p.salaGris && p.salaGris.codigo;
    const asociado = p.sirve && (p.sirve.find((s) => s.k === 'Va con') || {}).v;
    const conj = new Set((e.miembros || []).map((m) => m.id));
    const r = [];
    for (const x of equipos || []) {
      if (!x || no.has(x.id) || x.x == null || x.y == null) continue;
      const q = x.pista || {};
      const motivo = conj.has(x.id) ? 'su conjunto'
        : asociado && (x.tag === asociado || (q.sirve || []).some((s) => s.k === 'Va con' && s.v === asociado)) ? `con ${asociado}`
          : (q.sirve || []).some((s) => s.k === 'Va con' && s.v === e.tag) ? 'va con él'
            : sala && ((q.salaGris && q.salaGris.codigo === sala) || String(x.sala || '').includes(sala)) ? 'misma sala' : '';
      if (motivo) r.push({ id: x.id, tag: x.tag, motivo });
      if (r.length >= max) break;
    }
    return r;
  }

  const API = { puedeUbicar, enSuSitio, porUbicar, aMano, delModelo, dichoAMano, puntoDelToque, pistaDe, lineaPista, casaBusqueda, salaEnPlano, hermanos };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.UBICAR_PLANO = API;
})();
