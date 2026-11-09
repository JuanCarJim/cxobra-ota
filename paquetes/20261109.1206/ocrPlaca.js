/*
 * LEER LA FOTO DE LA PLACA EN EL PROPIO TELÉFONO O NAVEGADOR (29-oct-2026,
 * JC: «Lo suyo es que la app y la web y todo funcione sin mi Mac,
 * autónomamente»).
 *
 * Tesseract.js (OCR en WebAssembly) empaquetado con la app: el motor, el
 * worker y el idioma inglés van en la carpeta `ocr/` junto a la pantalla
 * (electron/movil/servidor.js › ARCHIVOS, cxobra/construir.js, web/construir.js).
 * Sin red y sin mandar la foto a nadie. Se carga solo la primera vez que hace
 * falta (unos 6 MB: el motor de este navegador y el idioma), no al abrir la app.
 *
 * La foto se lee a varios tamaños (el OCR no siempre lee igual): primero a
 * 2400 px, luego entera y luego a 1600; en cuanto una pasada da el nº junto a
 * su etiqueta (shared/commissioning/placaSerie.js › 'alta'), para. Devuelve
 * los renglones de cada pasada; quien decide qué se guarda es el motor
 * (electron/data/lecturaPlaca.js › lecturaDelCliente), con las mismas reglas.
 *
 *   OCR_PLACA.leer(blob, { marca, modelo, base }) → { pasadas: [[renglón…]…] }
 *   OCR_PLACA.disponible() → si este navegador puede (Worker y WebAssembly)
 */
(function () {
  'use strict';
  /* La carpeta de los ficheros del OCR, junto a este script. */
  const BASE = (() => {
    try {
      const s = document.currentScript && document.currentScript.src;
      return s ? s.replace(/[^/]*$/, '') : '';
    } catch { return ''; }
  })();
  const TAMAÑOS = [2400, 0, 1600]; /* 0: la foto entera (hasta 4032 px) */
  const MAXIMO = 4032;

  let cargando = null;
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => mal(new Error('No se ha podido cargar el lector de placas.'));
      document.head.appendChild(s);
    });
  }
  /* El worker de Tesseract, uno para toda la sesión. */
  let worker = null;
  async function elWorker(base) {
    if (worker) return worker;
    if (!cargando) {
      cargando = (async () => {
        const b = base || BASE;
        if (!window.Tesseract) await cargarScript(`${b}ocr/tesseract.min.js`);
        const abs = (r) => new URL(r, location.href).href;
        worker = await window.Tesseract.createWorker('eng', 1, {
          workerPath: abs(`${b}ocr/worker.min.js`),
          /* Con SIMD (todo navegador de 2023 en adelante) el rápido; si no, el normal. */
          corePath: abs(`${b}ocr/${conSimd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'}`),
          langPath: abs(`${b}ocr`),
          gzip: true,
          /* El idioma ya va con la app: no se guarda otra copia en el navegador. */
          cacheMethod: 'none',
          workerBlobURL: false,
        });
        return worker;
      })().catch((e) => { cargando = null; worker = null; throw e; });
    }
    return cargando;
  }

  function conSimd() {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
    } catch { return false; }
  }

  /* La foto, derecha (según su EXIF) y al tamaño pedido, en un lienzo. */
  async function lienzo(blob, lado) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const mayor = Math.max(bmp.width, bmp.height);
    const objetivo = Math.min(lado || mayor, MAXIMO, mayor);
    const k = objetivo / mayor;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c;
  }

  async function leer(blob, { marca = '', modelo = '', base = '' } = {}) {
    if (!disponible()) throw new Error('Este navegador no puede leer fotos.');
    const w = await elWorker(base);
    const PS = window.PLACA_SERIE;
    const pasadas = [];
    for (const lado of TAMAÑOS) {
      const c = await lienzo(blob, lado);
      const { data } = await w.recognize(c);
      const lineas = String(data.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
      pasadas.push(lineas);
      if (PS && PS.leerPasadas(pasadas, { marca, modelo }).lectura.confianza === 'alta') break;
      /* La primera pasada no parece una placa ni da nada: no merece la pena seguir. */
      if (PS && pasadas.length === 1 && !PS.pareceplaca(lineas) && !PS.extraerNumeroSerie(lineas, { marca, modelo }).valor) break;
    }
    return { pasadas };
  }

  function disponible() {
    return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof createImageBitmap === 'function';
  }

  /*
   * EL ALBARÁN DEL PROVEEDOR (29-oct, JC: «Que puedan crearlos también y/o
   * escanearlos»): el mismo OCR, una pasada a 2400 px, devuelto como los
   * trozos de Vision ({ t, x, y, w, h } de 0 a 1, arriba a la izquierda) para
   * que shared/compras/albaranes.js › filasDeTrozos lo lea igual. Cada renglón
   * se parte donde hay un hueco ancho entre palabras: así quedan las columnas
   * (descripción, cantidad, unidad) como celdas, igual que con Vision.
   */
  async function trozos(blob, { base = '' } = {}) {
    if (!disponible()) throw new Error('Este navegador no puede leer fotos.');
    const w = await elWorker(base);
    const c = await lienzo(blob, 2400);
    const { data } = await w.recognize(c, {}, { text: true, blocks: true });
    const W = c.width || 1;
    const H = c.height || 1;
    const salida = [];
    const renglones = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) renglones.push(l.words || []);
    for (const palabras of renglones) {
      const ps = palabras.filter((x) => x && String(x.text || '').trim() && x.bbox).sort((a, b) => a.bbox.x0 - b.bbox.x0);
      let actual = null;
      for (const p of ps) {
        const alto = Math.max(1, p.bbox.y1 - p.bbox.y0);
        if (actual && p.bbox.x0 - actual.x1 <= alto * 1.2) {
          actual.t += ` ${p.text.trim()}`;
          actual.x1 = Math.max(actual.x1, p.bbox.x1);
          actual.y0 = Math.min(actual.y0, p.bbox.y0);
          actual.y1 = Math.max(actual.y1, p.bbox.y1);
        } else {
          if (actual) salida.push(actual);
          actual = { t: p.text.trim(), x0: p.bbox.x0, x1: p.bbox.x1, y0: p.bbox.y0, y1: p.bbox.y1 };
        }
      }
      if (actual) salida.push(actual);
    }
    return salida.map((s) => ({ t: s.t, x: s.x0 / W, y: s.y0 / H, w: (s.x1 - s.x0) / W, h: Math.max(1, s.y1 - s.y0) / H }));
  }

  window.OCR_PLACA = { leer, disponible, trozos };
})();
