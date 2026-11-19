'use strict';
/*
 * EN QUÉ PLANTA ESTOY, SIN NADA DEL CLIENTE (18-nov-2026, JC en obra: «Planta es lo que necesito»).
 * Dos señales del propio teléfono, combinadas:
 *   1. Barómetro: en cada punto por contexto (placa leída, ficha abierta, equipo o sala tocados) se fija
 *      «presión P0 = planta X». Después, el cambio de altura (fórmula barométrica) se pasa a planta con las cotas de los
 *      IfcBuildingStorey del modelo; sin cotas, con una altura de planta por defecto. La presión deriva con el tiempo
 *      (el tiempo que hace, el aire acondicionado): pasadas 2 h sin recalibrar deja de fiarse.
 *   2. Wifi conectado (BSSID): en cada punto por contexto se apunta «BSSID → planta». Si después se ve un BSSID conocido,
 *      se propone esa planta. La tabla es local, por obra.
 * La app NUNCA cambia de planta sola: solo propone «Parece que estás en N10 · Cambiar». Si las dos señales no coinciden,
 * no dice nada.
 * Solo lógica: sirve en Node (pruebas) y en el navegador (window.PLANTA_AUTO). La capa es renderer/movil/plantaAutoCapa.js
 * y la lectura nativa, cxobra/nativo/PlantaPlugin.swift y .java.
 */
(function () {
  const CADUCA_MS = 2 * 3600 * 1000;
  const ALTURA_PLANTA_M = 4.5;
  /* Lo que se tolera entre la altura medida y la cota de la planta: un 35 % de la distancia a la planta vecina. */
  const HOLGURA = 0.35;
  const MAX_BSSID = 400;
  const VOTOS_MAX = 20;
  const CUOTA_BSSID = 0.75;
  /* Un aviso que el usuario ha cerrado no vuelve a salir para esa misma planta en este rato. */
  const SILENCIO_MS = 15 * 60 * 1000;

  const nivel = (p) => String(p == null ? '' : p).trim().toUpperCase();

  /** Diferencia de altura (m) entre dos presiones (hPa): positiva si p está más alto que p0. */
  function alturaEntre(p0, p) {
    const a = Number(p0); const b = Number(p);
    if (!(a > 0) || !(b > 0)) return null;
    return 44330 * (1 - Math.pow(b / a, 1 / 5.255));
  }

  /** Orden de una planta por su nombre cuando no hay cota: N00, N10, N20…; S1/S2 o «Sótano 1» por debajo; P1, «Planta 2»… */
  function ordenDeNombre(nombre) {
    const n = nivel(nombre);
    let m = n.match(/^N\s*(-?\d+)/); if (m) return Number(m[1]);
    m = n.match(/^(?:S|SÓTANO|SOTANO)\s*-?(\d+)/); if (m) return -100 * Number(m[1]);
    m = n.match(/^(?:P|PLANTA|NIVEL|L)\s*(-?\d+)/); if (m) return 10 * Number(m[1]);
    if (/^(PB|BAJA|PLANTA BAJA)$/.test(n)) return 0;
    return null;
  }

  /**
   * Las plantas en orden de abajo arriba, con su cota en metros si la hay. Admite cotas en milímetros (lo que exporta
   * Revit): si entre la más baja y la más alta hay más de 300, se dividen entre 1000.
   *   plantas: [{ planta, cota? }]
   */
  function ordenar(plantas) {
    const ps = (plantas || []).filter((x) => x && nivel(x.planta)).map((x) => ({ planta: x.planta, cota: Number.isFinite(Number(x.cota)) && x.cota !== null && x.cota !== '' ? Number(x.cota) : null }));
    const conCota = ps.filter((x) => x.cota !== null);
    if (conCota.length >= 2) {
      const span = Math.max(...conCota.map((x) => x.cota)) - Math.min(...conCota.map((x) => x.cota));
      if (span > 300) for (const x of conCota) x.cota /= 1000;
    }
    const todasConCota = ps.length > 0 && conCota.length === ps.length;
    const clave = (x) => (todasConCota ? x.cota : ordenDeNombre(x.planta));
    const ordenables = ps.every((x) => clave(x) !== null);
    if (ordenables) ps.sort((a, b) => clave(a) - clave(b));
    return { plantas: ps, conCota: todasConCota && conCota.length >= 2, ordenables };
  }

  /** La calibración: «esta presión = esta planta», con su hora. */
  function calibrar(planta, presion, en = Date.now()) {
    const p = Number(presion);
    if (!nivel(planta) || !(p > 300 && p < 1200)) return null;
    return { planta: String(planta), presion: p, en };
  }

  /**
   * La planta que dice el barómetro.
   *   { cal, presion, plantas, ahora, alturaPlanta }
   * → { estado: 'ok', planta, dh } | { estado: 'sinCalibrar' | 'caducada' | 'sinDato' | 'dudoso' | 'fuera', dh? }
   */
  function porBarometro({ cal, presion, plantas, ahora = Date.now(), alturaPlanta = ALTURA_PLANTA_M } = {}) {
    if (!cal || !(cal.presion > 0)) return { estado: 'sinCalibrar' };
    if (ahora - cal.en > CADUCA_MS) return { estado: 'caducada' };
    const dh = alturaEntre(cal.presion, presion);
    if (dh === null) return { estado: 'sinDato' };
    const o = ordenar(plantas);
    const i0 = o.plantas.findIndex((x) => nivel(x.planta) === nivel(cal.planta));
    if (i0 < 0 || !o.ordenables) return { estado: 'sinDato', dh };
    if (o.conCota) {
      const z = o.plantas[i0].cota + dh;
      let mejor = 0;
      o.plantas.forEach((x, i) => { if (Math.abs(x.cota - z) < Math.abs(o.plantas[mejor].cota - z)) mejor = i; });
      const m = o.plantas[mejor];
      const vecina = [o.plantas[mejor - 1], o.plantas[mejor + 1]].filter(Boolean).map((x) => Math.abs(x.cota - m.cota));
      const hueco = vecina.length ? Math.min(...vecina) : alturaPlanta;
      if (Math.abs(z - m.cota) > HOLGURA * hueco) return { estado: Math.abs(z - m.cota) > hueco ? 'fuera' : 'dudoso', dh };
      return { estado: 'ok', planta: m.planta, dh };
    }
    const h = Number(alturaPlanta) > 0 ? Number(alturaPlanta) : ALTURA_PLANTA_M;
    /* Igual que con cotas: la planta más cercana que existe y, si se aleja más de una planta entera de ella
       (por encima de la última o por debajo de la primera), 'fuera'; si solo se sale de la holgura, 'dudoso'. */
    const pasos = dh / h;
    const j = Math.min(o.plantas.length - 1, Math.max(0, i0 + Math.round(pasos)));
    const desvio = Math.abs(pasos - (j - i0));
    if (desvio > HOLGURA) return { estado: desvio > 1 ? 'fuera' : 'dudoso', dh };
    return { estado: 'ok', planta: o.plantas[j].planta, dh };
  }

  /** BSSID limpio (minúsculas, con dos puntos) o null: Android da 02:00:00:00:00:00 sin permiso. */
  function bssidLimpio(b) {
    const s = String(b || '').trim().toLowerCase().replace(/-/g, ':');
    if (!/^[0-9a-f]{1,2}(:[0-9a-f]{1,2}){5}$/.test(s)) return null;
    const n = s.split(':').map((x) => x.padStart(2, '0')).join(':');
    if (n === '02:00:00:00:00:00' || n === '00:00:00:00:00:00' || n === 'ff:ff:ff:ff:ff:ff') return null;
    return n;
  }

  /**
   * Aprende «BSSID → planta». Tabla: { [bssid]: { v: { [planta]: votos }, en } }. Devuelve una tabla nueva.
   * Los votos se topan (VOTOS_MAX: lo viejo pesa menos) y, por encima de MAX_BSSID, se olvida lo que lleva más tiempo sin verse.
   */
  function aprender(tabla, bssid, planta, en = Date.now()) {
    const b = bssidLimpio(bssid);
    const t = { ...(tabla || {}) };
    if (!b || !nivel(planta)) return t;
    const fila = { v: { ...((t[b] && t[b].v) || {}) }, en };
    const k = String(planta);
    fila.v[k] = (fila.v[k] || 0) + 1;
    const total = Object.values(fila.v).reduce((s, n) => s + n, 0);
    if (total > VOTOS_MAX) for (const p of Object.keys(fila.v)) { fila.v[p] = Math.floor(fila.v[p] / 2); if (!fila.v[p]) delete fila.v[p]; }
    if (!fila.v[k]) fila.v[k] = 1;
    t[b] = fila;
    const claves = Object.keys(t);
    if (claves.length > MAX_BSSID) claves.sort((a, c) => t[a].en - t[c].en).slice(0, claves.length - MAX_BSSID).forEach((x) => delete t[x]);
    return t;
  }

  /** La planta que dice el wifi: la que se llevan al menos el 75 % de los votos de ese BSSID. */
  function porWifi(tabla, bssid) {
    const b = bssidLimpio(bssid);
    if (!b) return { estado: 'sinDato' };
    const f = tabla && tabla[b];
    if (!f || !f.v) return { estado: 'desconocido' };
    const filas = Object.entries(f.v).sort((a, c) => c[1] - a[1]);
    const total = filas.reduce((s, x) => s + x[1], 0);
    if (!total) return { estado: 'desconocido' };
    if (filas[0][1] / total < CUOTA_BSSID) return { estado: 'dudoso' };
    return { estado: 'ok', planta: filas[0][0], votos: filas[0][1] };
  }

  /**
   * ¿Se avisa? { elegida, baro, wifi, plantas, silencio: { planta, en }, ahora }
   * → null o { planta, por: ['barometro'|'wifi'], texto }.
   * Reglas: al menos una señal buena; si las dos son buenas y no coinciden, nada; nada si ya es la elegida, si no es una
   * planta de la lista o si el usuario cerró ese mismo aviso hace menos de 15 min.
   */
  function decidir({ elegida, baro, wifi, plantas, silencio, ahora = Date.now() } = {}) {
    const buenas = [['barometro', baro], ['wifi', wifi]].filter(([, s]) => s && s.estado === 'ok' && nivel(s.planta));
    if (!buenas.length) return null;
    const niveles = new Set(buenas.map(([, s]) => nivel(s.planta)));
    if (niveles.size > 1) return null;
    const p = buenas[0][1].planta;
    if (nivel(p) === nivel(elegida)) return null;
    const lista = (plantas || []).map((x) => (typeof x === 'string' ? x : x && x.planta));
    const real = lista.find((x) => nivel(x) === nivel(p));
    if (!real) return null;
    if (silencio && nivel(silencio.planta) === nivel(p) && ahora - silencio.en < SILENCIO_MS) return null;
    return { planta: real, por: buenas.map(([k]) => k), texto: `Parece que estás en ${real}` };
  }

  const API = { CADUCA_MS, ALTURA_PLANTA_M, SILENCIO_MS, alturaEntre, ordenDeNombre, ordenar, calibrar, porBarometro, bssidLimpio, aprender, porWifi, decidir };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.PLANTA_AUTO = API;
})();
