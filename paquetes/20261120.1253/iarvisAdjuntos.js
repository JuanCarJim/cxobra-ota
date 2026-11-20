'use strict';
/*
 * LOS ADJUNTOS DEL CHAT CON IARVIS (7-nov-2026, JC: «adjuntar en el chat CUALQUIER documento»).
 *
 *   detectarTipo(bytes, nombre) → { tipo, nombre, mime, como }   por el CONTENIDO (firma), y el
 *                                 nombre solo para desempatar (un .xlsx y un .docx son ZIP los dos)
 *   proponerDestino(tipo)       → { pantalla, accion, importador, estado } adónde iría y con qué
 *
 * La regla: Iarvis lee y PROPONE; nada entra en la app sin que la persona pulse «Confirmar», y
 * entonces entra por el MISMO importador de la pantalla (con sus validaciones y su alcance por
 * rol). Por eso aquí no se importa nada: se dice a qué pantalla e importador va.
 *
 * Estado de cada tipo (`estado`):
 *   'importa'  hay importador en la app: se abre su pantalla con el archivo para confirmar
 *   'lee'      Iarvis lo lee y lo resume (PDF, imagen), sin destino automático
 *   'pendiente' no hay lector todavía: se guarda y se dice; la entrada queda aquí (PENDIENTES)
 *
 * Reglas firmes que respeta cualquier destino: el presupuesto base de estudios no se toca (un
 * BC3 entra como presupuesto NUEVO o versión, nunca encima de la base); los equipos nuevos entran
 * «por confirmar»; los impresos oficiales se rellenan tal cual; ninguna observación inventada.
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisAdjuntos = API;
})(() => {
  const empieza = (b, firma, desde = 0) => firma.every((x, i) => b[desde + i] === x);
  const ascii = (b, desde, n) => String.fromCharCode(...b.slice(desde, desde + n));
  const ext = (nombre) => (String(nombre || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

  /** El texto del principio (para formatos de texto: BC3, IFC, CSV, EML, XML). */
  function cabecera(b, n = 2048) {
    try { return new TextDecoder('latin1').decode(b.slice(0, n)); } catch { return ascii(b, 0, Math.min(n, b.length)); }
  }

  /** Los nombres de los ficheros de un ZIP (sin descomprimir): para distinguir xlsx, docx, ifczip… */
  function nombresZip(b) {
    const nombres = [];
    for (let i = 0; i < b.length - 30 && nombres.length < 60; i++) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 3 && b[i + 3] === 4) {
        const largo = b[i + 26] | (b[i + 27] << 8);
        nombres.push(ascii(b, i + 30, Math.min(largo, 200)));
        i += 29 + largo;
      }
    }
    return nombres;
  }

  /* ¿Lleva estos caracteres en algún sitio entre desde y hasta? (sin pasar el buffer a texto). */
  function contiene(b, texto, desde = 0, hasta = b.length, ancho = 1) {
    const c = [...texto].map((x) => x.charCodeAt(0));
    const paso = c.length * ancho;
    for (let i = Math.max(0, desde); i <= Math.min(b.length, hasta) - paso; i++) {
      let ok = true;
      for (let j = 0; j < c.length && ok; j++) {
        if (b[i + j * ancho] !== c[j]) ok = false;
        else if (ancho === 2 && b[i + j * 2 + 1] !== 0) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }

  /*
   * ¿LLEVA MACROS? (10-nov: los documentos de la obra no admiten macros, ni con
   * el nombre cambiado). En los Office nuevos, la parte xl|word|ppt/vbaProject.bin:
   * los primeros nombres del ZIP y su directorio central, al final del archivo.
   * En los antiguos (OLE2), el flujo _VBA_PROJECT, que se nombra en UTF-16.
   */
  function llevaMacros(b, ole) {
    if (ole) return contiene(b, '_VBA_PROJECT', 0, Math.min(b.length, 16 * 1024 * 1024), 2);
    if (nombresZip(b).some((x) => /vbaProject\.bin$/i.test(x))) return true;
    return contiene(b, 'vbaProject.bin', Math.max(0, b.length - 512 * 1024));
  }

  /* Programas: Windows (MZ), Linux (ELF), macOS (Mach-O, y el universal CAFEBABE, que es también una clase de Java). */
  const EJECUTABLES = [
    [[0x7f, 0x45, 0x4c, 0x46], 'ELF'],
    [[0xfe, 0xed, 0xfa, 0xce], 'Mach-O'], [[0xfe, 0xed, 0xfa, 0xcf], 'Mach-O'],
    [[0xce, 0xfa, 0xed, 0xfe], 'Mach-O'], [[0xcf, 0xfa, 0xed, 0xfe], 'Mach-O'],
    [[0xca, 0xfe, 0xba, 0xbe], 'Mach-O universal / Java'],
  ];

  function detectarTipo(bytes, nombre = '') {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const e = ext(nombre);
    const r = (tipo, mime, como) => ({ tipo, nombre, mime, como });
    if (!b.length) return r('vacio', 'application/octet-stream', 'vacío');
    /* Windows: «MZ» y, donde dice el byte 0x3C, «PE\0\0» (o el aviso del DOS): un texto que empiece por MZ no es un programa. */
    if (empieza(b, [0x4d, 0x5a]) && b.length >= 64) {
      const pe = b[0x3c] | (b[0x3d] << 8) | (b[0x3e] << 16);
      if ((pe > 0 && pe < b.length - 4 && ascii(b, pe, 4) === 'PE\u0000\u0000') || contiene(b, 'This program cannot', 0, Math.min(b.length, 1024))) {
        return r('ejecutable', 'application/octet-stream', 'firma Windows (MZ/PE)');
      }
    }
    for (const [firma, como] of EJECUTABLES) if (empieza(b, firma)) return r('ejecutable', 'application/octet-stream', `firma ${como}`);
    if (b[0] === 0x23 && b[1] === 0x21) return r('ejecutable', 'text/x-shellscript', 'guion #!');
    /* AutoCAD: AC1012…AC1032 (la versión va en los dos últimos). */
    if (ascii(b, 0, 4) === 'AC10') return r('dwg', 'image/vnd.dwg', `firma ${ascii(b, 0, 6)}`);
    if (empieza(b, [0x25, 0x50, 0x44, 0x46])) return r('pdf', 'application/pdf', 'firma %PDF');
    if (empieza(b, [0x89, 0x50, 0x4e, 0x47])) return r('imagen', 'image/png', 'firma PNG');
    if (empieza(b, [0xff, 0xd8, 0xff])) return r('imagen', 'image/jpeg', 'firma JPEG');
    if (ascii(b, 0, 4) === 'GIF8') return r('imagen', 'image/gif', 'firma GIF');
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return r('imagen', 'image/webp', 'firma WEBP');
    if (ascii(b, 4, 8) === 'ftypheic' || ascii(b, 4, 8) === 'ftypheix' || ascii(b, 4, 8) === 'ftypmif1') return r('imagen', 'image/heic', 'firma HEIC');
    /* OLE2 (Office antiguo): .msg de Outlook, .mpp de Project, .xls, .doc. */
    if (empieza(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      const m = llevaMacros(b, true);
      const conMacros = (x) => (m ? { ...x, macros: true, como: `${x.como} + macros` } : x);
      if (e === 'msg') return r('correo-msg', 'application/vnd.ms-outlook', 'OLE2 + .msg');
      if (e === 'mpp') return r('project', 'application/vnd.ms-project', 'OLE2 + .mpp');
      if (e === 'xls') return conMacros(r('excel', 'application/vnd.ms-excel', 'OLE2 + .xls'));
      if (e === 'doc') return conMacros(r('word', 'application/msword', 'OLE2 + .doc'));
      return conMacros(r('ole', 'application/x-ole-storage', 'OLE2'));
    }
    if (empieza(b, [0x50, 0x4b, 0x03, 0x04])) {
      const n = nombresZip(b);
      const conMacros = (x) => (llevaMacros(b, false) ? { ...x, macros: true, como: `${x.como} + vbaProject.bin` } : x);
      if (n.some((x) => x.startsWith('xl/'))) return conMacros(r('excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'ZIP con xl/'));
      if (n.some((x) => x.startsWith('word/'))) return conMacros(r('word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'ZIP con word/'));
      if (n.some((x) => x.startsWith('ppt/'))) return conMacros(r('powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'ZIP con ppt/'));
      if (n.some((x) => /\.ifc$/i.test(x)) || e === 'ifczip') return r('ifc', 'application/x-step', 'ZIP con .ifc');
      return r('zip', 'application/zip', 'ZIP');
    }
    const t = cabecera(b);
    if (/^ISO-10303-21;/.test(t.trimStart())) return r('ifc', 'application/x-step', 'cabecera ISO-10303-21');
    if (/^~V\|/m.test(t) || (e === 'bc3' && /^~[A-Z]\|/m.test(t))) return r('bc3', 'text/plain', 'registro ~V| (FIEBDC-3)');
    if (/<Project[\s>][\s\S]*schemas\.microsoft\.com\/project/i.test(t)) return r('project', 'application/xml', 'XML de MS Project');
    if (/^(Received|From|Return-Path|Message-ID|MIME-Version|Date|Subject|To):/im.test(t.slice(0, 600)) && (e === 'eml' || /^MIME-Version:/im.test(t))) return r('correo-eml', 'message/rfc822', 'cabeceras de correo');
    /* Lo que el navegador ejecutaría si se abriera dentro de la app: siempre como descarga. */
    const inicio = t.trimStart().slice(0, 400).toLowerCase();
    if (/^(<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>])/.test(inicio)) return r('html', 'text/html', 'etiquetas HTML');
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/.test(inicio) || (e === 'svg' && /<svg[\s>]/.test(t.slice(0, 2000).toLowerCase()))) return r('svg', 'image/svg+xml', 'etiqueta <svg>');
    if (e === 'csv' || e === 'tsv') return r('csv', 'text/csv', 'texto separado');
    if (e === 'xml') return r('xml', 'application/xml', 'XML');
    if (e === 'txt') return r('texto', 'text/plain', 'texto');
    return r('desconocido', 'application/octet-stream', 'sin firma conocida');
  }

  /*
   * Adónde va cada tipo. `pantalla` es el destino de ir() en renderer/app.js (el mismo id que abre la pantalla) y
   * `importador` el fichero que ya lo lee: la pantalla lo usa con sus validaciones y su alcance.
   */
  const DESTINOS = {
    bc3: { pantalla: 'presupuestos', accion: 'Importarlo como presupuesto nuevo (o versión) — la base de estudios no se toca', importador: 'shared/presupuesto/bc3.js parsearBC3', estado: 'importa' },
    excel: { pantalla: 'pedidos', accion: 'Iarvis lo lee (hojas, columnas, totales, fechas); reconocer las columnas y llevarlo a su tabla (equipos «por confirmar», mediciones, compras…)', importador: 'shared/importacion/reconocer.js + shared/ia/lectorDocumentos.js', estado: 'importa' },
    csv: { pantalla: 'pedidos', accion: 'Conciliarlo en Pedidos (la conciliación de esa pantalla)', importador: 'shared/compras/conciliacion.js leerCsv', estado: 'importa' },
    'correo-msg': { pantalla: 'reclamaciones', accion: 'Leer el correo y sus adjuntos y guardarlo como prueba del claim', importador: 'electron/lectura/correoMsg.js (electron/data/reclamaciones.js)', estado: 'importa' },
    zip: { pantalla: 'documentacion', accion: 'Abrir el paquete y clasificar cada documento', importador: 'electron/data/fuenteDocumentos.js', estado: 'importa' },
    pdf: { pantalla: 'documentacion', accion: 'Iarvis lo lee y lo resume; clasificarlo en la documentación de la obra', importador: 'shared/importacion/pdf.js leerPdf + shared/importacion/clasificarDocumento.js', estado: 'lee' },
    imagen: { pantalla: 'documentacion', accion: 'Iarvis la mira (foto, plano escaneado) y dice qué es', importador: null, estado: 'lee' },
    project: { pantalla: 'gantt', accion: 'Pasar las tareas y fechas al Gantt', importador: null, estado: 'pendiente' },
    ifc: { pantalla: 'commissioning', accion: 'Sacar los equipos del modelo, todos «por confirmar»', importador: null, estado: 'pendiente' },
    word: { pantalla: 'documentacion', accion: 'Guardarlo en la documentación', importador: null, estado: 'pendiente' },
    'correo-eml': { pantalla: 'reclamaciones', accion: 'Iarvis lo lee: qué es, quién, fechas, importes, papeles citados y si huele a claim', importador: 'shared/ia/lectorDocumentos.js', estado: 'lee' },
  };

  /*
   * LO QUE FALTA (entradas claras para quien lo haga, por orden de JC: Project primero):
   *   project     .mpp (OLE2) y .xml de Project → tareas, fechas y dependencias al Gantt
   *   ifc         ISO-10303-21 → IfcFlowTerminal/IfcEnergyConversionDevice… como equipos «por confirmar»
   *   word        .docx → texto (word/document.xml) para resumirlo
   */
  const PENDIENTES = Object.entries(DESTINOS).filter(([, d]) => d.estado === 'pendiente').map(([t]) => t);

  function proponerDestino(tipo) {
    return DESTINOS[tipo] || { pantalla: 'documentacion', accion: 'Guardarlo en la documentación', importador: null, estado: 'pendiente' };
  }

  /** Lo que Sonnet puede leer directamente (bloques de la API de Claude). */
  const LEE_CLAUDE = { pdf: 'document', imagen: 'image' };

  return { detectarTipo, proponerDestino, nombresZip, llevaMacros, DESTINOS, PENDIENTES, LEE_CLAUDE };
});
