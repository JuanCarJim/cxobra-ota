/*
 * EL Nº DE SERIE LEÍDO DE LA FOTO DE LA PLACA (29-oct-2026, JC: «que si al
 * hacer una foto a la placa, de ese equipo no hay número de serie,
 * automáticamente se lee de la placa y se pone su número de serie». Y luego:
 * «para todos los equipos eso»).
 *
 * Aquí solo la parte que no depende de nada: del texto que el OCR saca de la
 * foto (un renglón por línea) al nº de serie, y qué hacer con él. El OCR lo
 * hace el propio teléfono o navegador (renderer/ocrPlaca.js, Tesseract.js sin
 * red) y la escritura electron/data/lecturaPlaca.js. Sirve en Node y, tal cual,
 * como script de la pantalla (window.PLACA_SERIE).
 *
 * CÓMO SE BUSCA. Primero por su etiqueta («SERIAL NO.», «S/N», «Nº DE SERIE»,
 * «MFG. NO.», «Серийный номер»…): el valor es lo primero que parece un nº de
 * serie detrás de ella, en el mismo renglón o, si la etiqueta está sola (la
 * placa de Panasonic la pone encima), en el siguiente. Lo que NO es un nº de
 * serie se descarta aunque esté al lado: el modelo, fechas (2025.04), el
 * refrigerante (R410A), tensiones, pesos, IPX4, el TAG de obra con puntos
 * (HVAC.GS.00.F12). Si no hay etiqueta, el formato propio de la marca (p. ej.
 * Panasonic: 10 cifras o una letra y 9 cifras), y solo si sale uno.
 *
 * CONFIANZA:
 *   · 'alta'  — detrás de su etiqueta en el mismo renglón (o en el siguiente
 *               y con el formato de su marca), y todas las etiquetas dicen lo
 *               mismo. Solo esta se guarda sola.
 *   · 'media' — con etiqueta pero en el renglón de abajo, o con lecturas que
 *               no coinciden: se propone y el usuario confirma con un toque.
 *   · 'baja'  — sin etiqueta, por el formato de la marca: se propone.
 *
 * VARIAS PASADAS (combinarLecturas): el OCR del teléfono lee la foto a varios
 * tamaños y no siempre igual. Gana la lectura más segura; si dos pasadas dan el
 * mismo nº, sube un escalón; si dos lecturas seguras no coinciden, es duda.
 */
(function () {
'use strict';

const ETIQUETA = new RegExp([
  'S\\s*/\\s*N[O0]?\\.?',
  'SERIAL\\s*(?:N[O0º°]\\.?|NUMBER|NUM\\.?|#)?',
  'SER\\.?\\s*N[O0]\\.?',
  'SERIE\\s*N[O0º°]\\.?',
  'N[º°O0]?\\.?\\s*(?:DE\\s+)?S[EÉ]RIE',
  'NUM(?:ERO|\\.)?\\s*(?:DE\\s+)?S[EÉ]RIE',
  'NÚMERO\\s*(?:DE\\s+)?SERIE',
  'MFG\\.?\\s*N[O0º°]\\.?',
  'MANUFACTURING\\s*N[O0]\\.?',
  'SERIENNUMMER', 'SERIEN-?NR\\.?', 'FABR\\.?\\s*-?\\s*NR\\.?',
  'MATRICOLA', 'NUMERO\\s+DI\\s+SERIE',
  'СЕРИЙНЫЙ\\s*НОМЕР\\.?', 'СЕРІЙНИЙ\\s*НОМЕР\\.?',
].map((p) => `(?<![A-Z0-9А-ЯІЇЄ])(?:${p})`).join('|'), 'giu');

/* El formato del nº de serie de cada marca (lo que se ha visto en placas reales). */
const FORMATO_MARCA = {
  PANASONIC: /^(?:\d{9,11}|[A-Z]\d{8,10})$/,
  DAIKIN: /^(?:[A-Z]?\d{6,10}|\d{2}[A-Z]\d{5,8})$/,
  MITSUBISHI: /^\d[A-Z0-9]{6,9}$/,
  LG: /^\d{3}[A-Z0-9]{6,12}$/,
  SAMSUNG: /^[0-9A-Z]{13,16}$/,
  TOSHIBA: /^[0-9A-Z]{7,12}$/,
  CARRIER: /^(?:\d{9}[A-Z]|[A-Z]\d{10})$/,
};

const llano = (v) => String(v ?? '').trim();
const normal = (v) => llano(v).toUpperCase().replace(/[\s\-_/.]/g, '');
const marcaDe = (m) => Object.keys(FORMATO_MARCA).find((k) => normal(m).includes(k)) || null;

/* Palabras pegadas a un nº que no son el nº: unidades y medidas. */
const UNIDAD = /^(?:K?W|V|HZ|A|BAR|MPA|KG|KPA|PA|DB|M3\/H|L\/S|PH|IPX?\d+)$/i;

/* Renglones de la alimentación y de las potencias: ahí no va el nº de serie. */
const RENGLON_ELECTRICO = /POWER|VOLT|SOURCE|SUPPLY|ALIMENTACI|\bHZ\b|\d\s*V\b|\bV\s*\d|CURRENT|INPUT|\bKW\b/i;

/** ¿Este trozo de texto puede ser un nº de serie? (sin mirar dónde está). */
function pareceSerie(token, { modelo } = {}) {
  const t = llano(token).replace(/^[:#.\-]+|[:;,.]+$/g, '');
  if (t.length < 5 || t.length > 25) return false;
  if (!/^[A-Z0-9][A-Z0-9\-/]*[A-Z0-9]$/i.test(t)) return false; /* sin puntos: un TAG de obra (HVAC.GS.00.F12) o una cifra decimal */
  const cifras = (t.match(/\d/g) || []).length;
  if (cifras < 4) return false;
  if (/^R\d{2,4}[A-Z]?$/i.test(t)) return false; /* refrigerante */
  if (/^(?:19|20)\d{2}[-/]?\d{1,2}(?:[-/]?\d{1,2})?$/.test(t) && t.length <= 10 && /[-/]/.test(t)) return false; /* fecha */
  if (/^\d{1,4}-\d{1,4}(?:-\d{1,4})?$/.test(t)) return false; /* 380-400-415 */
  if (/^IPX?\d+$/i.test(t)) return false;
  if (modelo && normal(t) === normal(modelo)) return false;
  return true;
}

/** Los trozos de un renglón (separados por espacios), sin los dos puntos sueltos. */
const trozos = (s) => llano(s).split(/\s+/).filter(Boolean);

/** Lo primero que parece un nº de serie en `texto` (detrás de la etiqueta). */
function primeroQueParece(texto, opciones) {
  const ts = trozos(texto.replace(/^[\s:.#\-]+/, ''));
  for (let i = 0; i < ts.length; i += 1) {
    const t = ts[i].replace(/^[:#]+|[:;,]+$/g, '');
    if (!t) continue;
    if (UNIDAD.test(ts[i + 1] || '') && /^\d+([.,]\d+)?$/.test(t)) continue; /* «132 kg», «25 A» */
    if (pareceSerie(t, opciones)) return t.replace(/[:;,.]+$/, '');
  }
  return null;
}

/**
 * EL Nº DE SERIE DE UNA PLACA. `texto`: el texto del OCR (cadena con saltos
 * de línea o lista de renglones). `opciones`: { marca, modelo } del equipo.
 * Devuelve { valor, confianza: 'alta'|'media'|'baja'|null, candidatos, motivo }.
 */
function extraerNumeroSerie(texto, opciones = {}) {
  const lineas = (Array.isArray(texto) ? texto : String(texto ?? '').split(/\r?\n/)).map(llano).filter(Boolean);
  const marca = marcaDe(opciones.marca) || marcaDe(lineas.slice(0, 4).join(' '));
  const formato = marca ? FORMATO_MARCA[marca] : null;
  const delFormato = (v) => Boolean(formato && formato.test(normal(v)));
  const hallados = []; /* { valor, sitio: 'mismo'|'debajo' } */

  lineas.forEach((l, i) => {
    ETIQUETA.lastIndex = 0;
    let m;
    let antes = null;
    while ((m = ETIQUETA.exec(l)) !== null) {
      if (antes !== null && m.index === antes) { ETIQUETA.lastIndex += 1; continue; }
      antes = m.index;
      /* Detrás de la etiqueta, hasta la siguiente etiqueta de otra cosa (PROD. DATE…). */
      const resto = l.slice(m.index + m[0].length);
      const hasta = resto.search(/(?<![A-Z0-9А-Я])(?:PROD|DATE|MODEL|DATA|ДАТА|FECHA|TYPE|TIPO)(?![A-Z0-9А-Я])/iu);
      const v = primeroQueParece(hasta >= 0 ? resto.slice(0, hasta) : resto, opciones);
      if (v) { hallados.push({ valor: v, sitio: 'mismo' }); continue; }
      /* Sola en su renglón: el valor va debajo (en la columna de la etiqueta, que suele ser la primera cifra larga). */
      for (const sig of lineas.slice(i + 1, i + 3)) {
        const w = primeroQueParece(sig, opciones);
        if (w) { hallados.push({ valor: w, sitio: 'debajo' }); break; }
      }
    }
  });

  const distintos = [...new Set(hallados.map((h) => normal(h.valor)))];
  /* La placa de OTRO equipo (p. ej. la de la UI colgada en la UE): dice un
     modelo y no es el del equipo. Entonces nada se guarda solo. */
  const otroModelo = modeloDistinto(lineas, opciones.modelo);
  if (hallados.length) {
    const mejor = hallados.find((h) => h.sitio === 'mismo') || hallados[0];
    const unanime = distintos.length === 1;
    const alta = !otroModelo && unanime && (mejor.sitio === 'mismo' ? (!formato || delFormato(mejor.valor) || normal(mejor.valor).length >= 6) : delFormato(mejor.valor));
    return {
      valor: mejor.valor, confianza: alta ? 'alta' : 'media', candidatos: [...new Set(hallados.map((h) => h.valor))],
      motivo: otroModelo ? `La placa es de otro modelo (no dice ${llano(opciones.modelo)})`
        : !unanime ? 'La placa da más de un número' : alta ? 'Junto a su etiqueta' : 'La etiqueta está, pero el número no va pegado a ella',
    };
  }

  /* Sin etiqueta: solo por el formato de la marca, y solo si sale uno. */
  if (formato) {
    /* Sin los renglones de la alimentación: «380-400-415 V» sale a veces sin guiones (380400415). */
    const sueltos = [...new Set(lineas.filter((l) => !RENGLON_ELECTRICO.test(l)).flatMap(trozos).map((t) => t.replace(/^[:#]+|[:;,.]+$/g, ''))
      .filter((t) => pareceSerie(t, opciones) && delFormato(t)))];
    if (sueltos.length === 1) return { valor: sueltos[0], confianza: 'baja', candidatos: sueltos, motivo: 'Sin etiqueta: por el formato de la marca' };
    if (sueltos.length > 1) return { valor: null, confianza: null, candidatos: sueltos, motivo: 'Sin etiqueta y con varios números posibles' };
  }
  return { valor: null, confianza: null, candidatos: [], motivo: 'No se ve ningún nº de serie en la foto' };
}

/** ¿La placa dice un modelo que no es el del equipo? (solo si la placa trae «MODEL» y el equipo tiene modelo). */
function modeloDistinto(lineas, modelo) {
  const m = normal(modelo);
  if (m.length < 4) return false;
  const todo = normal(lineas.join(' '));
  if (!/MODEL|МОДЕЛЬ|MODELO/i.test(lineas.join(' '))) return false;
  return !todo.includes(m);
}

/*
 * ¿LA FOTO ES UNA PLACA DE CARACTERÍSTICAS? (para las fotos sin pie: JC sube
 * muchas placas sin ponerles «Placa»). Lo que solo dice una placa: modelo,
 * nº de serie, refrigerante, alimentación, potencias, presiones. Con tres
 * señales distintas, es una placa.
 */
const SEÑALES_PLACA = [
  /MODEL|МОДЕЛЬ/i, /SERIAL|S\/N|SERIE|СЕРИЙН|СЕРІЙН|MFG/i, /REFRIGERANT|R410A|R32\b|R-?407C|R-?134A|ХЛАДАГЕНТ/i,
  /POWER\s*SOURCE|POWER\s*SUPPLY|ALIMENTACI|\d\s*HZ\b/i, /\bK?W\b|KW/i, /MPA|BAR\b/i, /\bIPX?\d/i, /\bKG\b/i,
];
function pareceplaca(texto) {
  const t = (Array.isArray(texto) ? texto : String(texto ?? '').split(/\r?\n/)).join(' ');
  return SEÑALES_PLACA.filter((r) => r.test(t)).length >= 3;
}

/**
 * ¿TIENE YA Nº DE SERIE? Un número de verdad (con alguna cifra). Lo que hay
 * apuntado en su lugar y no es un número («No está visible», «Cogida a VRV»)
 * no cuenta como nº, pero tampoco se pisa solo: se propone.
 */
function estadoSerie(v) {
  const s = llano(v);
  if (!s || /^(-|—|n\/?a|sin.*)$/i.test(s)) return 'vacio';
  return /\d/.test(s) ? 'tiene' : 'nota';
}

/** ¿La foto es de la placa? Por su pie («Placa», «Placa UE»…). */
const esFotoPlaca = (pie) => /^\s*placa\b/i.test(llano(pie));

/**
 * QUÉ HACER CON UNA LECTURA. `serieActual` la del equipo, `lectura` la de
 * extraerNumeroSerie, `placa` si la foto es la de la placa (las otras fotos
 * solo proponen, y solo si el número va junto a su etiqueta).
 *   'aplicar'  — se guarda solo.
 *   'proponer' — «Nº de serie leído de la placa: XXXX — revisar».
 *   'nada'     — el equipo ya tiene nº, o la foto no dice nada.
 */
function decidir({ serieActual, lectura, placa = true }) {
  const est = estadoSerie(serieActual);
  if (est === 'tiene' || !lectura || !lectura.valor) return 'nada';
  if (!placa) return lectura.confianza === 'baja' ? 'nada' : 'proponer';
  if (est === 'vacio' && lectura.confianza === 'alta') return 'aplicar';
  return 'proponer';
}

/** El estado guardado en equiposObra.seriePlaca (JSON), o null. */
function leerEstado(v) {
  if (!v) return null;
  try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? o : null; } catch { return null; }
}

const ESCALON = { baja: 1, media: 2, alta: 3 };
const DE_ESCALON = [null, 'baja', 'media', 'alta'];

/**
 * VARIAS LECTURAS DE LA MISMA FOTO (o de la misma placa) EN UNA. `lecturas`:
 * las de extraerNumeroSerie. Gana la más segura; el mismo nº en dos pasadas
 * sube un escalón (nunca la placa de otro modelo); dos seguras distintas, duda.
 */
function combinarLecturas(lecturas) {
  const con = (lecturas || []).filter((l) => l && l.valor);
  if (!con.length) return (lecturas || []).find(Boolean) || { valor: null, confianza: null, candidatos: [], motivo: 'No se ve ningún nº de serie en la foto' };
  const grupos = new Map();
  for (const l of con) {
    const k = normal(l.valor);
    const g = grupos.get(k) || { lectura: l, veces: 0, nivel: 0, otroModelo: false };
    g.veces += 1;
    if ((ESCALON[l.confianza] || 0) > g.nivel) { g.nivel = ESCALON[l.confianza] || 0; g.lectura = l; }
    if (/otro modelo/.test(l.motivo || '')) g.otroModelo = true;
    grupos.set(k, g);
  }
  const lista = [...grupos.values()].map((g) => ({ ...g, final: g.otroModelo ? Math.min(g.nivel, 2) : Math.min(3, g.nivel + (g.veces > 1 ? 1 : 0)) }))
    .sort((a, b) => b.final - a.final || b.veces - a.veces);
  const [mejor, otro] = lista;
  let final = mejor.final;
  let motivo = mejor.lectura.motivo;
  if (otro && otro.final === 3 && final === 3) { final = 2; motivo = 'Las lecturas de la placa no coinciden'; }
  else if (mejor.veces > 1 && final > mejor.nivel) motivo = `${motivo} (igual en ${mejor.veces} lecturas)`;
  return {
    valor: mejor.lectura.valor, confianza: DE_ESCALON[final], motivo,
    candidatos: [...new Set(con.map((l) => l.valor))],
  };
}

/**
 * LAS PASADAS DEL OCR DE UNA FOTO → { lectura, placa }. `pasadas`: listas de
 * renglones (una por tamaño o giro). `placa`: si alguna pasada se lee como
 * una placa de características.
 */
function leerPasadas(pasadas, opciones = {}) {
  const ps = (Array.isArray(pasadas) ? pasadas : []).filter((p) => Array.isArray(p) || typeof p === 'string');
  return {
    lectura: combinarLecturas(ps.map((p) => extraerNumeroSerie(p, opciones))),
    placa: ps.some((p) => pareceplaca(p)),
  };
}

const API = { extraerNumeroSerie, pareceSerie, pareceplaca, estadoSerie, esFotoPlaca, decidir, leerEstado, combinarLecturas, leerPasadas, FORMATO_MARCA };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis.PLACA_SERIE = API;
})();
