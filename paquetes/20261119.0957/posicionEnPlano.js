/* DÓNDE ESTOY EN EL PLANO (18-nov-2026, JC en Cx › Plano: «¿podríamos tener algún tipo de circulito que marque
 * dónde estoy?»; nota del bloc e9f5c1b6, clave posicion-en-plano-1811).
 *
 * Dos fuentes, la más reciente gana:
 *   1. GPS AL AIRE LIBRE. El punto con su círculo de precisión. Hace falta GEORREFERENCIAR el plano: los IFC de la obra de prueba no la
 *      traen (IfcSite con la latitud de Revit por defecto, sin IfcMapConversion), así que el jefe fija DOS PUNTOS DE CONTROL
 *      por plano (su sitio en el plano y sus coordenadas reales). Con ellos sale una semejanza (giro + escala + traslación,
 *      con el eje Y del dibujo hacia abajo). Si la precisión pasa de PRECISION_MAX_M o no hay señal, no se pinta un punto
 *      engañoso: se dice con un aviso discreto.
 *   2. DENTRO DEL ESTADIO, POR CONTEXTO. Al abrir un equipo (ficha, placa leída, tocarlo en el plano) o al tocar una sala, el
 *      punto se pone en el sitio conocido de ese equipo o sala, con la hora («aquí a las 9:26»), hasta que llegue algo mejor.
 *
 * El color es SUYO (JC 18-nov: «de otro color que destaque con respecto a los que tenemos de los equipos»): violeta, con aro
 * blanco, halo que palpita y el círculo de precisión muy transparente. No sale de la paleta de estados (colorBloque.js).
 * Solo lógica: sirve en Node (pruebas, rutas) y en el navegador (window.POSICION_PLANO). La capa del móvil es
 * renderer/movil/posicionPlanoCapa.js.
 */
(function () {
  'use strict';

  /* Violeta 600: 5,7:1 sobre blanco y distinto de verde, gris, naranja y azul de los estados del plano. */
  const COLOR = Object.freeze({
    punto: '#7c3aed',
    aro: '#ffffff',
    halo: 'rgba(124, 58, 237, 0.35)',
    precision: 'rgba(124, 58, 237, 0.10)',
    bordePrecision: 'rgba(124, 58, 237, 0.45)',
  });
  const PRECISION_MAX_M = 25;
  const DIST_MIN_M = 5;          /* dos puntos de control más juntos no orientan nada */
  const SEP_MIN_PLANO = 0.02;    /* ni dos toques casi en el mismo sitio del dibujo */
  const MARGEN_FUERA = 0.05;     /* un poco fuera del dibujo aún se pinta (en el borde); más, se dice «fuera del plano» */
  const R_TIERRA = 6371008.8;
  const RAD = Math.PI / 180;

  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const fin = (...v) => v.every((x) => Number.isFinite(x));

  /** Metros este/norte de (lat, lon) respecto de un origen (equirrectangular: de sobra para un estadio). */
  function aMetros(lat, lon, origen) {
    const e = (lon - origen.lon) * RAD * R_TIERRA * Math.cos(origen.lat * RAD);
    const n = (lat - origen.lat) * RAD * R_TIERRA;
    return { e, n };
  }
  function deMetros(e, n, origen) {
    return { lat: origen.lat + n / (R_TIERRA * RAD), lon: origen.lon + e / (R_TIERRA * RAD * Math.cos(origen.lat * RAD)) };
  }

  /* Números complejos, lo justo para la semejanza w = a·z + b. */
  const cx = (re, im) => ({ re, im });
  const resta = (p, q) => cx(p.re - q.re, p.im - q.im);
  const suma = (p, q) => cx(p.re + q.re, p.im + q.im);
  const por = (p, q) => cx(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re);
  const entre = (p, q) => { const d = q.re * q.re + q.im * q.im; return cx((p.re * q.re + p.im * q.im) / d, (p.im * q.re - p.re * q.im) / d); };
  const modulo = (p) => Math.hypot(p.re, p.im);

  /** Lo que se guarda de un punto de control, limpio: { lat, lon, x, y } (x, y en fracción 0..1 del dibujo). */
  function puntoLimpio(p) {
    const lat = num(p && p.lat); const lon = num(p && p.lon); const x = num(p && p.x); const y = num(p && p.y);
    if (!fin(lat, lon, x, y)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || x < 0 || x > 1 || y < 0 || y > 1) return null;
    const r6 = (v) => Math.round(v * 1e7) / 1e7;
    const out = { lat: r6(lat), lon: r6(lon), x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 };
    if (p.nombre) out.nombre = String(p.nombre).slice(0, 60);
    return out;
  }

  /**
   * La georreferencia de un plano con DOS puntos de control. `plano`: { ancho, alto } del dibujo (px de la imagen; sin
   * ellos, cuadrado). Devuelve { ok, puntos, ancho, alto, a, b, origen, pxPorM } o { ok:false, error }.
   */
  function crearGeorreferencia(puntos, plano = {}) {
    const ps = (Array.isArray(puntos) ? puntos : []).map(puntoLimpio);
    if (ps.length !== 2 || ps.some((p) => !p)) return { ok: false, error: 'Hacen falta dos puntos con su sitio en el plano y sus coordenadas.' };
    const ancho = num(plano.ancho) > 0 ? num(plano.ancho) : 1000;
    const alto = num(plano.alto) > 0 ? num(plano.alto) : ancho;
    const [p1, p2] = ps;
    const origen = { lat: p1.lat, lon: p1.lon };
    const m2 = aMetros(p2.lat, p2.lon, origen);
    if (Math.hypot(m2.e, m2.n) < DIST_MIN_M) return { ok: false, error: `Los dos puntos están a menos de ${DIST_MIN_M} m: elige dos sitios más separados.` };
    if (Math.hypot(p2.x - p1.x, (p2.y - p1.y) * (alto / ancho)) < SEP_MIN_PLANO) return { ok: false, error: 'Los dos toques en el plano están casi en el mismo sitio.' };
    /* z: metros con el norte hacia ARRIBA del dibujo (y de la imagen crece hacia abajo, por eso −n). w: px del dibujo. */
    const z1 = cx(0, 0); const z2 = cx(m2.e, -m2.n);
    const w1 = cx(p1.x * ancho, p1.y * alto); const w2 = cx(p2.x * ancho, p2.y * alto);
    const a = entre(resta(w2, w1), resta(z2, z1));
    const b = resta(w1, por(a, z1));
    return { ok: true, puntos: ps, ancho, alto, a, b, origen, pxPorM: modulo(a) };
  }

  /** De coordenadas reales al plano (fracción 0..1). */
  function geoAPlano(geo, lat, lon) {
    if (!geo || !geo.ok || !fin(num(lat), num(lon))) return null;
    const m = aMetros(num(lat), num(lon), geo.origen);
    const w = suma(por(geo.a, cx(m.e, -m.n)), geo.b);
    return { x: w.re / geo.ancho, y: w.im / geo.alto };
  }
  /** Del plano (fracción) a coordenadas reales: lo contrario (para fijar un punto mirando el plano y para las pruebas). */
  function planoAGeo(geo, x, y) {
    if (!geo || !geo.ok) return null;
    const z = entre(resta(cx(x * geo.ancho, y * geo.alto), geo.b), geo.a);
    return deMetros(z.re, -z.im, geo.origen);
  }

  /** Metros de precisión → radio del círculo, en fracción del ANCHO del dibujo (lo que pinta la capa). */
  const radioDe = (geo, metros) => (geo && geo.ok ? (metros * geo.pxPorM) / geo.ancho : 0);

  /**
   * LA POSICIÓN POR GPS sobre un plano. `coords`: { latitude, longitude, accuracy } (o lat/lon/precision); `en`: ms.
   * estado: 'ok' (se pinta), 'sinGeo' (el plano no está fijado), 'sinSenal', 'imprecisa' (> PRECISION_MAX_M),
   * 'fuera' (cae lejos del dibujo: otra zona o el plano mal fijado). Solo 'ok' trae x, y y radio.
   */
  function posicionGps(geo, coords, { en = Date.now(), maxPrecision = PRECISION_MAX_M } = {}) {
    const base = { tipo: 'gps', en };
    if (!geo || !geo.ok) return { ...base, estado: 'sinGeo', aviso: 'Este plano aún no está fijado con dos puntos: el GPS no sabe dónde caer.' };
    const lat = num(coords && (coords.latitude ?? coords.lat));
    const lon = num(coords && (coords.longitude ?? coords.lon));
    const prec = num(coords && (coords.accuracy ?? coords.precision));
    if (!fin(lat, lon)) return { ...base, estado: 'sinSenal', aviso: 'Sin señal de GPS. Dentro del estadio, abre un equipo o toca una sala y te sitúo ahí.' };
    if (!Number.isFinite(prec) || prec > maxPrecision) {
      return { ...base, estado: 'imprecisa', precision: Number.isFinite(prec) ? Math.round(prec) : null,
        aviso: `GPS impreciso${Number.isFinite(prec) ? ` (±${Math.round(prec)} m)` : ''}: no te pinto para no engañarte.` };
    }
    const p = geoAPlano(geo, lat, lon);
    const r = radioDe(geo, Math.max(prec, 1));
    const m = MARGEN_FUERA;
    if (!p || p.x < -m || p.x > 1 + m || p.y < -m || p.y > 1 + m) return { ...base, estado: 'fuera', precision: Math.round(prec), aviso: 'Estás fuera de esta planta (o el plano está mal fijado).' };
    return { ...base, estado: 'ok', x: clamp01(p.x), y: clamp01(p.y), radio: r, precision: Math.round(prec), lat, lon };
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /** «9:26», en la hora de la obra (España). */
  function hora(en) {
    const d = new Date(Number(en) || Date.now());
    try { return new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(d); } catch { return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
  }

  const ORIGENES = { ficha: 'abriste', placa: 'leíste la placa de', plano: 'tocaste', sala: 'tocaste la sala' };

  /**
   * «ESTOY AQUÍ» POR CONTEXTO. `ctx`: { equipoId?, tag?, sala?, planta?, origen, en }. `planta`: { planta, equipos, salas }
   * de la planta abierta (equipos con x, y en fracción; las del pie «sin sala» no cuentan). La sala se busca por nombre
   * o código; su x, y es ya el centro (como el rótulo del plano). estado: 'ok', 'otraPlanta' o 'sinSitio'.
   */
  function posicionPorContexto(planta, ctx = {}) {
    const en = Number(ctx.en) || Date.now();
    const base = { tipo: 'contexto', en, origen: ctx.origen || 'ficha', hora: hora(en) };
    const eqs = (planta && planta.equipos) || [];
    let sitio = null; let que = '';
    if (ctx.equipoId || ctx.tag) {
      const e = eqs.find((x) => x && ctx.equipoId && x.id === ctx.equipoId && x.x != null && !x.franja)
        || eqs.find((x) => x && ctx.tag && x.tag === ctx.tag && x.x != null && !x.franja);
      if (e) { sitio = { x: Number(e.x), y: Number(e.y) }; que = e.tag || ctx.tag || ''; }
      else que = ctx.tag || '';
    }
    if (!sitio && ctx.sala) {
      const q = String(ctx.sala).trim().toLowerCase();
      const s = ((planta && planta.salas) || []).find((r) => r && [r.t, r.codigo, r.nombre].some((v) => v && String(v).trim().toLowerCase() === q));
      if (s) {
        sitio = { x: Number(s.x), y: Number(s.y) };
        que = s.t || ctx.sala;
      } else if (!que) que = String(ctx.sala);
    }
    const verbo = ctx.sala && !ctx.equipoId && !ctx.tag ? ORIGENES.sala : ORIGENES[ctx.origen] || ORIGENES.ficha;
    const texto = `Aquí a las ${base.hora}${que ? ` · ${verbo} ${que}` : ''}`;
    if (sitio && fin(sitio.x, sitio.y)) return { ...base, estado: 'ok', x: clamp01(sitio.x), y: clamp01(sitio.y), texto, que };
    const enOtra = ctx.planta && planta && String(ctx.planta) !== String(planta.planta || '');
    return { ...base, estado: enOtra ? 'otraPlanta' : 'sinSitio', que, planta: ctx.planta || null,
      texto: enOtra ? `Tu última posición conocida está en la planta ${ctx.planta}${que ? ` (${verbo} ${que} a las ${base.hora})` : ''}.` : `${que || 'Ese sitio'} no tiene posición en este plano.` };
  }

  /**
   * CUÁL SE PINTA. Gana la más reciente que sea buena (estado 'ok'); un GPS impreciso, sin señal o fuera nunca quita una
   * posición buena: solo deja su aviso. Devuelve { punto, aviso }.
   */
  function elegir(...cands) {
    const buenas = cands.filter((c) => c && c.estado === 'ok').sort((a, b) => (b.en || 0) - (a.en || 0));
    const punto = buenas[0] || null;
    const ultima = cands.filter(Boolean).sort((a, b) => (b.en || 0) - (a.en || 0))[0] || null;
    const aviso = ultima && ultima.estado !== 'ok' ? ultima.aviso || ultima.texto || '' : '';
    return { punto, aviso };
  }

  /** Lo que se guarda de la georreferencia de un plano (configCommissioning.georreferencia[planoId]). */
  function paraGuardar(puntos, plano, { por = '', en = new Date().toISOString() } = {}) {
    const g = crearGeorreferencia(puntos, plano);
    if (!g.ok) return g;
    return { ok: true, valor: { puntos: g.puntos, ancho: g.ancho, alto: g.alto, por: String(por || '').slice(0, 80), en: String(en).slice(0, 40) } };
  }
  /** La georreferencia guardada de un plano, lista para usar (o null). `guardado`: el JSON de la columna (texto u objeto). */
  function deGuardado(guardado, planoId) {
    let o = guardado;
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
    const v = o && planoId && o[planoId];
    if (!v) return null;
    const g = crearGeorreferencia(v.puntos, v);
    return g.ok ? { ...g, por: v.por || '', en: v.en || '' } : null;
  }

  const API = { COLOR, PRECISION_MAX_M, DIST_MIN_M, aMetros, crearGeorreferencia, geoAPlano, planoAGeo, radioDe, posicionGps, posicionPorContexto, elegir, hora, paraGuardar, deGuardado, puntoLimpio };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.POSICION_PLANO = API;
})();
