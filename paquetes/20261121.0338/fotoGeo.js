'use strict';
/*
 * LAS COORDENADAS DE UNA FOTO DE EQUIPO (19-nov-2026, JC: «las fotos que el usuario tome desde la app para equipos /
 * commissioning tienen que guardar sus coordenadas, para verificar las ubicaciones» y «que la app sitúe en el plano
 * correctamente el equipo que se ha fotografiado»).
 *
 *   · normalizar: lat, lon, precisión (m) y fecha de la toma, o null si no hay coordenadas válidas.
 *   · leerExifGps: las coordenadas que trae el propio JPEG (EXIF GPS), si las trae.
 *   · distanciaM: metros entre dos coordenadas.
 *   · decidir: con el plano calibrado (los dos puntos GPS, shared/commissioning/posicionEnPlano.js, la MISMA transformación
 *     que «Dónde estoy»), convierte lat/lon a x, y y dice si se MUEVE el equipo (precisión buena), se PROPONE (precisión mala)
 *     o no se hace nada (sin calibración / fuera del plano). Nunca inventa otra transformación.
 */
(function () {
  const PZ = (typeof module !== 'undefined' && module.exports) ? require('./posicionEnPlano') : window.POSICION_PLANO;
  /* Hasta aquí la foto es de fiar para mover el equipo; con más precisión de error solo se propone. */
  const UMBRAL_PRECISION_M = 10;
  const R = 6371008.8;

  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const fin = Number.isFinite;

  function normalizar(g) {
    if (!g) return null;
    const lat = num(g.lat ?? g.latitude); const lon = num(g.lon ?? g.longitude);
    if (!fin(lat) || !fin(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const p = num(g.precision ?? g.accuracy);
    return {
      lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7,
      precision: fin(p) && p >= 0 ? Math.round(p * 10) / 10 : null,
      tomadaEn: g.tomadaEn ? String(g.tomadaEn).slice(0, 30) : null,
      origen: g.origen === 'exif' ? 'exif' : 'dispositivo',
    };
  }

  function distanciaM(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** EXIF GPS de un JPEG (Uint8Array). { lat, lon, precision: null, tomadaEn: null, origen: 'exif' } o null. */
  function leerExifGps(bytes) {
    try {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      let o = 2;
      while (o + 4 < b.length && b[o] === 0xFF) {
        const m = b[o + 1]; const len = dv.getUint16(o + 2);
        if (m === 0xE1 && b[o + 4] === 0x45 && b[o + 5] === 0x78) { /* «Ex» de «Exif» */
          const t = o + 10; const le = b[t] === 0x49;
          const u16 = (p) => dv.getUint16(t + p, le); const u32 = (p) => dv.getUint32(t + p, le);
          const ifd = (p, f) => { const n = u16(p); for (let i = 0; i < n; i++) f(p + 2 + i * 12); };
          let gps = 0;
          ifd(u32(4), (e) => { if (u16(e) === 0x8825) gps = u32(e + 8); });
          if (!gps) return null;
          const racional = (e) => {
            const p = u32(e + 8); const v = [];
            for (let i = 0; i < 3; i++) { const d = u32(p + i * 8 + 4); v.push(d ? u32(p + i * 8) / d : 0); }
            return v[0] + v[1] / 60 + v[2] / 3600;
          };
          const ref = (e) => String.fromCharCode(b[t + e + 8]);
          let lat = null, lon = null, rl = 'N', ro = 'E';
          ifd(gps, (e) => {
            const tag = u16(e);
            if (tag === 1) rl = ref(e); else if (tag === 2) lat = racional(e);
            else if (tag === 3) ro = ref(e); else if (tag === 4) lon = racional(e);
          });
          if (lat === null || lon === null) return null;
          return normalizar({ lat: rl === 'S' ? -lat : lat, lon: ro === 'W' ? -lon : lon, origen: 'exif' });
        }
        o += 2 + len;
      }
    } catch { /* sin EXIF legible */ }
    return null;
  }

  /**
   * `geo`: la georreferencia ya creada (PZ.crearGeorreferencia / PZ.deGuardado) del plano del equipo.
   * `foto`: normalizar(...). `actual`: { x, y } del equipo en el plano, si lo tiene.
   * → { accion: 'mover' | 'proponer' | 'nada', motivo, x, y, distanciaM (de la foto al sitio actual del equipo) }.
   */
  function decidir(geo, foto, actual = null, { umbral = UMBRAL_PRECISION_M } = {}) {
    const f = normalizar(foto);
    if (!f) return { accion: 'nada', motivo: 'sinCoordenadas' };
    if (!geo || !geo.ok) return { accion: 'nada', motivo: 'sinCalibracion' };
    const p = PZ.geoAPlano(geo, f.lat, f.lon);
    if (!p || !fin(p.x) || !fin(p.y)) return { accion: 'nada', motivo: 'sinCalibracion' };
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return { accion: 'nada', motivo: 'fueraDelPlano', x: p.x, y: p.y };
    let d = null;
    if (actual && fin(actual.x) && fin(actual.y)) {
      const g = PZ.planoAGeo(geo, actual.x, actual.y);
      if (g) d = Math.round(distanciaM(f.lat, f.lon, g.lat, g.lon));
    }
    const buena = f.precision !== null && f.precision <= umbral;
    return { accion: buena ? 'mover' : 'proponer', motivo: buena ? 'precisionBuena' : 'precisionMala', x: p.x, y: p.y, distanciaM: d, precision: f.precision };
  }

  const API = { UMBRAL_PRECISION_M, normalizar, distanciaM, leerExifGps, decidir };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.FOTO_GEO = API;
})();
