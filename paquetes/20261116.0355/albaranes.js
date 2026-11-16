'use strict';
/*
 * LOS ALBARANES: leer la foto y compararla con el pedido. Sin base ni pantalla.
 *
 * Cuando llega material a obra, el encargado hace una foto al albarán (o lo
 * rellena a mano). Aquí se decide todo lo que pasa después:
 *
 *   1. LEER LA FOTO. El texto lo saca el reconocimiento del sistema (Vision en
 *      el Mac) en trozos con su posición; aquí se juntan en filas, se busca la
 *      cabecera de la tabla y se sacan el número de albarán, la fecha, la
 *      referencia del pedido (PED-0012) y las líneas: referencia, descripción,
 *      cantidad y unidad.
 *   2. CASAR cada línea del albarán con una del pedido: primero por la
 *      referencia; si no, por las palabras de la descripción (las cifras
 *      cuentan: «2 kW» no es «4 kW»).
 *   3. LA RECEPCIÓN del pedido, sumando TODOS sus albaranes línea a línea:
 *        · RECEPCIONADO: cada línea ha llegado entera, sin nada de más ni nada
 *          que no se pidiera. El pedido queda cerrado.
 *        · PARCIAL: lo que ha llegado está bien, pero falta algo.
 *        · CON DIFERENCIAS: ha llegado más de lo pedido, algo que no estaba en
 *          el pedido o en otra unidad. Lo mira el jefe de obra.
 *
 * LA LECTURA PROPONE, LA PERSONA DECIDE: lo leído rellena el formulario y el
 * encargado lo corrige antes de guardar. Lo que se guarda es lo que él
 * confirma, con la línea del pedido a la que va cada una ya elegida; por eso
 * la recepción no vuelve a casar nada, solo suma.
 */

(function iniciarMotorAlbaranes() {

const RECEPCION = {
  pendiente:     { nombre: 'Sin recibir',            clase: 'neutra' },
  parcial:       { nombre: 'Recepción parcial',      clase: 'aviso' },
  diferencias:   { nombre: 'Con diferencias',        clase: 'mal' },
  recepcionado:  { nombre: 'Recepcionado',           clase: 'bien' },
};

const ESTADO_LINEA = {
  pendiente: { nombre: 'Sin llegar',       clase: 'neutra' },
  parcial:   { nombre: 'Falta',            clase: 'aviso' },
  completa:  { nombre: 'Completa',         clase: 'bien' },
  exceso:    { nombre: 'De más',           clase: 'mal' },
  unidad:    { nombre: 'Otra unidad',      clase: 'mal' },
};

const TOLERANCIA = 1e-6;
const UMBRAL_PARECIDO = 0.5;

const llano = (v) => String(v ?? '').trim();
const redondear = (v, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Mayúsculas, sin acentos y con un solo espacio. */
function normal(v) {
  return llano(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/**
 * Un número como sale en un albarán: «12», «12,00», «1.200», «1.200,50»,
 * «12.5». Con coma, los puntos son de miles; sin coma, un punto seguido de
 * exactamente tres cifras también (1.200 son mil doscientas, no 1,2).
 */
function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let t = llano(v).replace(/\s/g, '');
  if (!/^[-+]?\d[\d.,]*$/.test(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* ═══════════════════════════════════════════════ Las unidades */

const SINONIMOS = {
  ud: ['UD', 'UDS', 'U', 'UN', 'UND', 'UNI', 'UNID', 'UNIDAD', 'UNIDADES', 'PZ', 'PZA', 'PZAS', 'PIEZA', 'PIEZAS', 'PCS', 'PC', 'EA', 'UDES'],
  m: ['M', 'ML', 'MT', 'MTS', 'METRO', 'METROS', 'M.L.', 'MTR'],
  m2: ['M2', 'M²', 'METROS2'],
  m3: ['M3', 'M³'],
  kg: ['KG', 'KGS', 'KILO', 'KILOS', 'KILOGRAMOS'],
  l: ['L', 'LT', 'LTS', 'LITRO', 'LITROS'],
  caja: ['CJ', 'CJA', 'CAJA', 'CAJAS'],
  rollo: ['RL', 'ROLLO', 'ROLLOS', 'BOBINA', 'BOBINAS'],
  juego: ['JGO', 'JUEGO', 'JUEGOS', 'KIT', 'KITS', 'SET'],
  par: ['PAR', 'PARES'],
  paquete: ['PAQ', 'PAQUETE', 'PAQUETES', 'PQ', 'PACK'],
  saco: ['SACO', 'SACOS'],
  bote: ['BOTE', 'BOTES'],
  barra: ['BARRA', 'BARRAS', 'TRAMO', 'TRAMOS'],
};
const UNIDAD_DE = new Map(Object.entries(SINONIMOS).flatMap(([u, xs]) => xs.map((x) => [x.replace(/\./g, ''), u])));

/** La unidad como la entiende la app («Uds.» → ud), o null si no hay. */
function unidad(v) {
  const t = normal(v).replace(/[.\s]/g, '');
  if (!t) return null;
  return UNIDAD_DE.get(t) || t.toLowerCase();
}
const esUnidad = (v) => UNIDAD_DE.has(normal(v).replace(/[.\s]/g, ''));

/** Dos unidades chocan solo si las dos están y son distintas. */
const chocanUnidades = (a, b) => Boolean(unidad(a) && unidad(b) && unidad(a) !== unidad(b));

/* ═══════════════════════════════════════════════ Casar líneas */

const VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'CON', 'PARA', 'Y', 'EN', 'A', 'X', 'POR', 'SIN', 'O', 'UN', 'UNA', 'AL']);

/** Las palabras que cuentan de una descripción (las cifras también). */
function palabras(v) {
  return new Set(normal(v).replace(/(\d),(\d)/g, '$1.$2').split(/[^A-Z0-9.]+/)
    .map((p) => p.replace(/^\.+|\.+$/g, ''))
    .filter((p) => p && !VACIAS.has(p) && (p.length > 1 || /\d/.test(p))));
}

/** Cuánto se parecen dos descripciones, de 0 a 1 (Dice sobre las palabras). */
function parecido(a, b) {
  const x = palabras(a); const y = palabras(b);
  if (!x.size || !y.size) return 0;
  let comunes = 0;
  for (const p of x) if (y.has(p)) comunes += 1;
  return (2 * comunes) / (x.size + y.size);
}

/** La referencia solo con letras y cifras, y O→0 (la trampa del OCR). */
const ref = (v) => normal(v).replace(/[^A-Z0-9]/g, '').replace(/O/g, '0');

/**
 * Lo que se parece una línea del albarán a una del pedido, de 0 a 1. La
 * referencia igual es casi seguro; la referencia del pedido escrita dentro
 * de la descripción del albarán, también.
 */
function puntuar(lineaPedido, lineaAlbaran) {
  const rp = ref(lineaPedido.referencia);
  const ra = ref(lineaAlbaran.referencia);
  if (rp && ra && rp === ra) return 1;
  if (rp && rp.length >= 4 && ref(lineaAlbaran.descripcion).includes(rp)) return 0.95;
  const p = parecido(lineaPedido.descripcion, lineaAlbaran.descripcion);
  /* Referencias distintas y escritas las dos: tiene que parecerse mucho. */
  return rp && ra ? p * 0.8 : p;
}

/**
 * CASAR las líneas del albarán con las del pedido. Cada línea del albarán va
 * a la línea del pedido que más se le parezca (si pasa del umbral); primero
 * se asignan los parecidos más claros. Varias líneas del albarán pueden ir a
 * la misma del pedido (el proveedor parte una partida en dos).
 * Devuelve las del albarán con `lineaPedido` (índice) o null y `parecido`.
 */
function casar(lineasPedido = [], lineasAlbaran = []) {
  const pares = [];
  lineasAlbaran.forEach((a, j) => {
    lineasPedido.forEach((p, i) => {
      const s = puntuar(p, a);
      if (s >= UMBRAL_PARECIDO) pares.push({ i, j, s });
    });
  });
  pares.sort((x, y) => y.s - x.s || x.i - y.i);
  const asignada = new Map();
  const usadas = new Set();
  /* Primera pasada: una línea del pedido para cada una del albarán, sin repetir. */
  for (const { i, j, s } of pares) {
    if (asignada.has(j) || usadas.has(i)) continue;
    asignada.set(j, { i, s });
    usadas.add(i);
  }
  /* Segunda: lo que queda puede ir a una línea ya usada (partidas partidas). */
  for (const { i, j, s } of pares) if (!asignada.has(j)) asignada.set(j, { i, s });
  return lineasAlbaran.map((a, j) => {
    const x = asignada.get(j);
    return { ...a, lineaPedido: x ? x.i : null, parecido: x ? redondear(x.s, 2) : 0 };
  });
}

/* ═══════════════════════════════════════════════ La recepción */

const cantidadDe = (v) => {
  const n = typeof v === 'number' ? v : numero(v);
  return n === null || !Number.isFinite(n) ? null : n;
};

/**
 * LA RECEPCIÓN DEL PEDIDO con todos sus albaranes. `albaranes` son
 * { id, fecha, numero, lineas: [{ lineaPedido, descripcion, referencia,
 * unidad, cantidad }] }; `lineaPedido` es el índice de la línea del pedido o
 * null si lo entregado no estaba pedido.
 *
 * Devuelve el estado (pendiente / parcial / diferencias / recepcionado), cada
 * línea del pedido con lo pedido, lo recibido y lo que falta, lo que llegó
 * sin pedirse y la fecha en que quedó completo.
 */
function recepcion(lineasPedido = [], albaranes = []) {
  const lineas = lineasPedido.map((l, i) => ({
    indice: i, descripcion: l.descripcion, referencia: l.referencia || null, unidad: l.unidad || null,
    pedida: cantidadDe(l.cantidad), recibida: 0, otraUnidad: [], albaranes: [],
  }));
  const extras = [];
  const ordenados = [...albaranes].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  for (const a of ordenados) {
    for (const la of a.lineas || []) {
      const q = cantidadDe(la.cantidad);
      if (q === null || q <= 0) continue;
      const l = la.lineaPedido === null || la.lineaPedido === undefined ? null : lineas[Number(la.lineaPedido)];
      if (!l) {
        extras.push({ albaranId: a.id || null, numero: a.numero || null, fecha: a.fecha || null, descripcion: la.descripcion, referencia: la.referencia || null, unidad: la.unidad || null, cantidad: q });
        continue;
      }
      if (chocanUnidades(l.unidad, la.unidad)) {
        l.otraUnidad.push({ albaranId: a.id || null, cantidad: q, unidad: la.unidad });
        continue;
      }
      l.recibida = redondear(l.recibida + q);
      if (a.id && !l.albaranes.includes(a.id)) l.albaranes.push(a.id);
    }
  }
  for (const l of lineas) {
    l.falta = l.pedida === null ? null : redondear(Math.max(0, l.pedida - l.recibida));
    l.deMas = l.pedida === null ? null : redondear(Math.max(0, l.recibida - l.pedida));
    if (l.otraUnidad.length) l.estado = 'unidad';
    else if (l.recibida <= TOLERANCIA) l.estado = 'pendiente';
    else if (l.pedida === null) l.estado = 'completa';
    else if (l.recibida > l.pedida + TOLERANCIA) l.estado = 'exceso';
    else if (l.recibida < l.pedida - TOLERANCIA) l.estado = 'parcial';
    else l.estado = 'completa';
  }
  const hayAlbaranes = albaranes.length > 0;
  const diferencias = lineas.some((l) => l.estado === 'exceso' || l.estado === 'unidad') || extras.length > 0;
  const completas = lineas.length > 0 && lineas.every((l) => l.estado === 'completa');
  let est;
  if (!hayAlbaranes) est = 'pendiente';
  else if (diferencias) est = 'diferencias';
  else if (completas) est = 'recepcionado';
  else est = 'parcial';
  const fechas = ordenados.map((a) => a.fecha).filter(Boolean);
  return {
    estado: est,
    lineas,
    extras,
    nAlbaranes: albaranes.length,
    completas: lineas.filter((l) => l.estado === 'completa').length,
    pendientes: lineas.filter((l) => l.estado === 'pendiente' || l.estado === 'parcial').length,
    fechaCompleta: est === 'recepcionado' && fechas.length ? fechas[fechas.length - 1] : null,
    ultimaEntrega: fechas.length ? fechas[fechas.length - 1] : null,
  };
}

/**
 * LO QUE HA TRAÍDO ESTE ALBARÁN, frente a lo que faltaba antes de él: para
 * decirle al encargado, al guardar, qué coincide, qué falta y qué sobra.
 */
function resultadoAlbaran(lineasPedido = [], previos = [], nuevo = {}) {
  const antes = recepcion(lineasPedido, previos);
  const despues = recepcion(lineasPedido, [...previos, nuevo]);
  const avisos = [];
  for (const l of despues.lineas) {
    const a = antes.lineas[l.indice];
    const trae = redondear(l.recibida - a.recibida);
    if (l.estado === 'unidad' && l.otraUnidad.length > a.otraUnidad.length) {
      avisos.push({ nivel: 'mal', texto: `«${l.descripcion}»: llega en otra unidad (${l.otraUnidad.map((x) => `${cifra(x.cantidad)} ${x.unidad || ''}`.trim()).join(', ')}) y se pidió en ${l.unidad || 'otra'}` });
    } else if (l.estado === 'exceso' && trae > 0) {
      avisos.push({ nivel: 'mal', texto: `«${l.descripcion}»: llegan ${cifra(l.deMas)} ${l.unidad || ''} de más`.trim() });
    } else if (l.estado === 'parcial' && trae > 0) {
      avisos.push({ nivel: 'aviso', texto: `«${l.descripcion}»: faltan ${cifra(l.falta)} ${l.unidad || ''} de ${cifra(l.pedida)}`.trim() });
    }
  }
  for (const x of despues.extras.slice(antes.extras.length)) {
    avisos.push({ nivel: 'mal', texto: `«${x.descripcion}» (${cifra(x.cantidad)} ${x.unidad || ''}) no está en el pedido`.replace(' )', ')') });
  }
  const sinLlegar = despues.lineas.filter((l) => l.estado === 'pendiente');
  if (sinLlegar.length && despues.estado !== 'pendiente') {
    avisos.push({ nivel: 'aviso', texto: `Sin llegar todavía: ${sinLlegar.map((l) => `«${l.descripcion}»`).join(', ')}` });
  }
  return { antes: antes.estado, estado: despues.estado, recepcion: despues, avisos };
}

const cifra = (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('es-ES', { maximumFractionDigits: 3 }));

/* ═══════════════════════════════════════════════ Leer la foto */

/**
 * LOS TROZOS DE TEXTO EN FILAS. Cada trozo es { t, x, y, w, h } (la caja
 * de 0 a 1, origen arriba a la izquierda). Dos trozos van en la misma fila
 * si se solapan en vertical más de la mitad del más bajo. Cada fila sale con
 * sus celdas ordenadas de izquierda a derecha.
 */
function filasDeTrozos(trozos = []) {
  const ts = trozos.filter((t) => llano(t.t)).map((t) => ({ t: llano(t.t), x: +t.x || 0, y: +t.y || 0, w: +t.w || 0, h: +t.h || 0.01 }))
    .sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const filas = [];
  for (const t of ts) {
    const centro = t.y + t.h / 2;
    let fila = null;
    for (let i = filas.length - 1; i >= Math.max(0, filas.length - 3); i -= 1) {
      const f = filas[i];
      const solape = Math.min(f.y + f.h, t.y + t.h) - Math.max(f.y, t.y);
      if (solape > 0.5 * Math.min(f.h, t.h) || (centro >= f.y && centro <= f.y + f.h)) { fila = f; break; }
    }
    if (fila) {
      fila.celdas.push(t);
      const abajo = Math.max(fila.y + fila.h, t.y + t.h);
      fila.y = Math.min(fila.y, t.y);
      fila.h = abajo - fila.y;
    } else {
      filas.push({ y: t.y, h: t.h, celdas: [t] });
    }
  }
  return filas.map((f) => {
    const celdas = f.celdas.sort((a, b) => a.x - b.x);
    return { y: f.y, h: f.h, celdas, texto: celdas.map((c) => c.t).join(' ') };
  });
}

/** Texto plano (un PDF con texto, o lo pegado) en filas: una por renglón, partidas por tabuladores o 2+ espacios. */
function filasDeTexto(texto = '') {
  return String(texto).split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).map((l, i) => {
    const partes = l.split(/\t| {2,}/).map((p) => p.trim()).filter(Boolean);
    let x = 0;
    const celdas = partes.map((p) => { const c = { t: p, x: x / 100, y: i / 100, w: p.length / 100, h: 0.01 }; x += p.length + 2; return c; });
    return { y: i / 100, h: 0.01, celdas, texto: partes.join(' ') };
  });
}

/* Las columnas de la tabla de líneas, por lo que dice su cabecera. */
const COLUMNAS = {
  referencia: /^(REF(ERENCIA)?|COD(IGO)?|ARTICULO|ART|CODIGO ARTICULO|REF\.? ?PROV(EEDOR)?|MATERIAL|N[ºO°] ?ART(ICULO)?)\.?$/,
  descripcion: /^(DESCRIPCION|CONCEPTO|DENOMINACION|DESIGNACION|ARTICULO DESCRIPCION|DETALLE|PRODUCTO|DESCRIPCION DEL ARTICULO)\.?$/,
  cantidad: /^(CANT(IDAD)?|CTD|QTY|UDS|UNIDADES|N[ºO°] ?UDS|SERVIDO|SERVIDA|ENTREGADO|ENTREGADA|CANT\.? SERVIDA|CANTIDAD SERVIDA|CANTIDAD ENTREGADA)\.?$/,
  unidad: /^(UD|UNIDAD|U\.?M\.?|UM|MEDIDA|UD\.? ?MEDIDA)\.?$/,
  precio: /^(PRECIO|P\.? ?UNIT(ARIO)?|PVP|TARIFA|PRECIO UNIT(ARIO)?|IMPORTE|TOTAL|DTO|DESCUENTO|NETO|%)\.?$/,
};

function tipoCabecera(t) {
  const n = normal(t).replace(/[:]/g, '').trim();
  for (const [k, re] of Object.entries(COLUMNAS)) if (re.test(n)) return k;
  return null;
}

/**
 * Las columnas de una celda de cabecera. El OCR a veces junta dos títulos
 * («Cantidad Ud.»): si cada palabra es un título, se reparte el ancho de la
 * celda entre ellas según sus letras.
 */
function columnasDeCelda(c) {
  const tipo = tipoCabecera(c.t);
  if (tipo) return [{ tipo, x: c.x, fin: c.x + c.w }];
  const partes = llano(c.t).split(/\s+/);
  if (partes.length < 2) return [];
  const tipos = partes.map(tipoCabecera);
  if (tipos.some((t) => !t)) return [];
  const letras = partes.reduce((s, p) => s + p.length + 1, -1);
  let x = c.x;
  return partes.map((p, k) => {
    const ancho = (c.w * (p.length + (k < partes.length - 1 ? 1 : 0))) / letras;
    const col = { tipo: tipos[k], x, fin: x + ancho };
    x += ancho;
    return col;
  });
}

/** La fila de cabecera de la tabla: la que tiene descripción y cantidad (o tres columnas conocidas). */
function buscarCabecera(filas) {
  for (let i = 0; i < filas.length; i += 1) {
    const columnas = filas[i].celdas.flatMap(columnasDeCelda);
    const hay = new Set(columnas.map((c) => c.tipo));
    if ((hay.has('descripcion') && hay.has('cantidad')) || hay.size >= 3) return { indice: i, columnas };
  }
  return null;
}

/* Lo que no es una línea de material: pies, totales, datos de la empresa. */
const NO_ES_LINEA = /^(TOTAL|SUBTOTAL|SUMA|BASE IMPONIBLE|BASE|I\.?V\.?A|IMPORTE|FIRMA|RECIBI|RECIBIDO|CONFORME|FECHA|ALBARAN|PAGINA|PAG\.?|C\.?I\.?F|N\.?I\.?F|TEL|TFNO|TELEFONO|FAX|E-?MAIL|WWW|DIRECCION|DOMICILIO|CLIENTE|PEDIDO|SU PEDIDO|N\/? ?PEDIDO|OBSERVACIONES|TRANSPORTISTA|MATRICULA|PORTES|FORMA DE PAGO|ENTREGA|LUGAR|OBRA|ATT|SR|SRA|REG(ISTRO)? MERC|INSCRITA|HOJA|BULTOS|PESO|CONDUCTOR|DNI)\b/;

const esReferencia = (t) => {
  const s = llano(t);
  return /^[A-Z0-9][A-Z0-9./_-]{2,24}$/i.test(s) && /\d/.test(s) && (/[A-Z]/i.test(s) || /[-./_]/.test(s) || s.length >= 5);
};

/**
 * Una fila sin cabecera: busca la cantidad (la cifra suelta, o la primera si
 * hay cantidad × precio = importe), la unidad pegada a ella, la referencia al
 * principio y la descripción con el resto.
 */
function lineaSinCabecera(fila) {
  const celdas = fila.celdas.flatMap((c) => partirCelda(c.t).map((t) => ({ ...c, t })));
  const nums = celdas.map((c, k) => ({ k, n: numero(c.t) })).filter((x) => x.n !== null);
  if (!nums.length) return null;
  let cantidadK = null;
  if (nums.length >= 3) {
    /* cantidad × precio ≈ importe (con o sin descuento entre medias). */
    for (let a = 0; a < nums.length && cantidadK === null; a += 1) {
      for (let b = a + 1; b < nums.length && cantidadK === null; b += 1) {
        const total = nums[nums.length - 1].n;
        if (b !== nums.length - 1 && Math.abs(nums[a].n * nums[b].n - total) <= Math.max(0.02, total * 0.005)) cantidadK = nums[a].k;
      }
    }
  }
  const resto = (k) => celdas.filter((_, i) => i !== k);
  if (cantidadK === null) {
    /* La cifra que no forma parte de una referencia ni de la descripción: la última si no hay precios, si no la primera. */
    const sueltas = nums.filter((x) => !(x.k === 0 && esReferencia(celdas[0].t) && nums.length > 1));
    if (!sueltas.length) return null;
    const conDecimalesCaros = sueltas.filter((x) => /,\d{2}$/.test(celdas[x.k].t));
    cantidadK = sueltas.length === 1 ? sueltas[0].k
      : conDecimalesCaros.length >= 2 ? sueltas[0].k : sueltas[sueltas.length - 1].k;
  }
  const cantidad = numero(celdas[cantidadK].t);
  let ud = null;
  const vecinas = [celdas[cantidadK + 1], celdas[cantidadK - 1]].filter(Boolean);
  for (const v of vecinas) if (esUnidad(v.t)) { ud = v.t; break; }
  let quedan = resto(cantidadK).filter((c) => !(ud && c.t === ud));
  /* Lo que va después de la cantidad son precios e importes: fuera. */
  const tras = celdas.slice(cantidadK + 1).filter((c) => numero(c.t) !== null);
  quedan = quedan.filter((c) => !tras.includes(c));
  let referencia = null;
  if (quedan.length > 1 && esReferencia(quedan[0].t)) { referencia = quedan[0].t; quedan = quedan.slice(1); }
  const descripcion = quedan.map((c) => c.t).join(' ').replace(/\s+/g, ' ').trim();
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(descripcion)) return null;
  return { referencia, descripcion, cantidad, unidad: ud };
}

/** «12 UDS» o «12,00 m» pegados en una celda: separa la cifra de la unidad. */
function partirCelda(t) {
  const m = llano(t).match(/^(\d[\d.,]*)\s*([A-Za-z²³.]{1,9})$/);
  if (m && esUnidad(m[2])) return [m[1], m[2]];
  const n = llano(t).match(/^([A-Za-z²³.]{1,9})\s+(\d[\d.,]*)$/);
  if (n && esUnidad(n[1])) return [n[1], n[2]];
  return [t];
}

/** Una fila con cabecera: cada celda a la columna con la que más se solapa. */
function lineaConCabecera(fila, columnas) {
  const v = { referencia: [], descripcion: [], cantidad: [], unidad: [], precio: [] };
  for (const c of fila.celdas) {
    let mejor = null; let solapeMejor = -Infinity;
    for (const col of columnas) {
      const s = Math.min(c.x + c.w, col.fin) - Math.max(c.x, col.x);
      const dist = s > 0 ? s : -Math.min(Math.abs(c.x - col.x), Math.abs(c.x + c.w - col.fin));
      if (dist > solapeMejor) { solapeMejor = dist; mejor = col; }
    }
    if (mejor) v[mejor.tipo].push(c.t);
  }
  let cantidad = null; let ud = v.unidad.join(' ') || null;
  for (const t of v.cantidad) {
    for (const p of partirCelda(t)) {
      const n = numero(p);
      if (n !== null && cantidad === null) cantidad = n;
      else if (esUnidad(p) && !ud) ud = p;
    }
  }
  const descripcion = v.descripcion.join(' ').replace(/\s+/g, ' ').trim();
  if (cantidad === null || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(descripcion)) return null;
  return { referencia: v.referencia.join(' ').trim() || null, descripcion, cantidad, unidad: ud };
}

/* La cabecera del albarán: número, fecha y la referencia de nuestro pedido. */
const MESES = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };

function fechaEn(t) {
  const n = normal(t);
  let m = n.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mes = Number(m[2]); const d = Number(m[1]);
    if (mes >= 1 && mes <= 12 && d >= 1 && d <= 31) return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = n.match(/\b(\d{1,2}) DE ([A-Z]+) DE (\d{4})\b/);
  if (m && MESES[m[2]]) return `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  m = n.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** El valor que sigue a una etiqueta («Albarán nº: A-2201»), en la misma fila o justo debajo. */
function valorTras(filas, re, valido) {
  for (let i = 0; i < filas.length; i += 1) {
    const f = filas[i];
    for (let k = 0; k < f.celdas.length; k += 1) {
      const n = normal(f.celdas[k].t);
      const m = n.match(re);
      if (!m) continue;
      const enLaCelda = llano(normal(f.celdas[k].t).slice(m.index + m[0].length)).replace(/^[:.#\sº°]+/, '');
      const candidatos = [enLaCelda.split(' ')[0], ...(f.celdas.slice(k + 1, k + 3).map((c) => llano(c.t).replace(/^[:.#\sº°]+/, '').split(' ')[0]))];
      const debajo = filas[i + 1] && filas[i + 1].celdas.find((c) => Math.abs(c.x - f.celdas[k].x) < 0.08);
      if (debajo) candidatos.push(llano(debajo.t).split(' ')[0]);
      for (const c of candidatos) if (c && valido(c)) return c;
    }
  }
  return null;
}

const pareceNumeroDoc = (t) => /^[A-Z0-9][A-Z0-9/_.-]{2,24}$/i.test(t) && /\d/.test(t) && !fechaEn(t);

/**
 * LEER UN ALBARÁN de sus filas (de la foto o de un PDF). Devuelve lo que se
 * ha sacado y lo que no se ha podido leer, para que la pantalla lo diga.
 */
function leer(filas = []) {
  const todo = filas.map((f) => f.texto).join('\n');
  const numeroAlb = valorTras(filas, /ALBARAN( DE ENTREGA)?( N[ºO°.]*| NUM(ERO)?\.?)?/, pareceNumeroDoc)
    || valorTras(filas, /^N[ºO°.]? ?(DE )?ALBARAN/, pareceNumeroDoc)
    || valorTras(filas, /^(DOCUMENTO|DOC\.?) ?N[ºO°.]*/, pareceNumeroDoc);
  let fecha = null;
  for (const f of filas) if (/FECHA/.test(normal(f.texto))) { fecha = fechaEn(f.texto); if (!fecha) { const i = filas.indexOf(f); fecha = filas[i + 1] ? fechaEn(filas[i + 1].texto) : null; } if (fecha) break; }
  if (!fecha) for (const f of filas) { fecha = fechaEn(f.texto); if (fecha) break; }
  const ped = normal(todo).match(/PED[\s_-]*0*(\d{1,6})(?!\d)/);
  const codigoPedido = ped ? `PED-${String(Number(ped[1])).padStart(4, '0')}` : null;
  const suPedido = valorTras(filas, /(SU|S\/|V\/|VUESTRO|REF\.? ?CLIENTE|N\/? ?REF|PEDIDO CLIENTE|SU REF(ERENCIA)?)\.? ?(PEDIDO|N[ºO°.]*|REF\.?)?/, pareceNumeroDoc);
  const cab = buscarCabecera(filas);
  const lineas = [];
  const desde = cab ? cab.indice + 1 : 0;
  for (let i = desde; i < filas.length; i += 1) {
    const f = filas[i];
    const n = normal(f.texto);
    if (NO_ES_LINEA.test(n) || NO_ES_LINEA.test(normal(f.celdas[0] ? f.celdas[0].t : ''))) {
      /* Con cabecera, el primer total cierra la tabla. */
      if (cab && lineas.length && /^(TOTAL|SUBTOTAL|SUMA|BASE)/.test(n)) break;
      continue;
    }
    const l = cab ? lineaConCabecera(f, cab.columnas) : lineaSinCabecera(f);
    if (l && l.cantidad > 0) lineas.push(l);
  }
  const faltan = [];
  if (!numeroAlb) faltan.push('el número de albarán');
  if (!fecha) faltan.push('la fecha');
  if (!lineas.length) faltan.push('las líneas');
  return { numero: numeroAlb, fecha, codigoPedido, suPedido, lineas, conCabecera: Boolean(cab), faltan, texto: todo };
}

/* ═══════════════════════════════════════════════ ¿De qué pedido es? */

/**
 * ¿A QUÉ PEDIDO VA ESTE ALBARÁN? Por la referencia PED- escrita en él (la
 * pide la solicitud de precio), por el número de pedido del proveedor, por
 * su nombre en el papel y por cuántas líneas casan. Devuelve los pedidos
 * ordenados con su puntuación y el motivo; el primero es la propuesta.
 */
function elegirPedido(lectura = {}, pedidos = [], { obraId = null } = {}) {
  const texto = normal(lectura.texto || '');
  const textoRef = ref(lectura.texto || '');
  const numAlbaran = ref(lectura.numero || '');
  return pedidos.map((p) => {
    let puntos = 0; const motivos = [];
    if (lectura.codigoPedido && normal(p.codigo) === lectura.codigoPedido) { puntos += 100; motivos.push(`cita ${p.codigo}`); }
    const np = ref(p.numPedidoProveedor);
    if (np && np.length >= 3 && textoRef.includes(np)) { puntos += 60; motivos.push(`su pedido ${p.numPedidoProveedor}`); }
    /* El número de PROYECTO (el código de la obra) que el proveedor pone en
       el albarán («Obra: OB-24-031», «Ref. obra…»). */
    const no = ref(p.obraCodigo);
    if (no && no.length >= 3 && textoRef.includes(no)) { puntos += 40; motivos.push(`obra ${p.obraCodigo}`); }
    const prov = normal(p.proveedor).replace(/\b(S\.?L\.?U?|S\.?A\.?U?|SOCIEDAD LIMITADA|SOCIEDAD ANONIMA)\b\.?/g, '').trim();
    if (prov && prov.length >= 4 && texto.includes(prov)) { puntos += 25; motivos.push(p.proveedor); }
    const lineasPedido = Array.isArray(p.lineas) ? p.lineas : [];
    const casadas = casar(lineasPedido, lectura.lineas || []).filter((l) => l.lineaPedido !== null).length;
    if (casadas) { puntos += Math.round((30 * casadas) / Math.max(1, (lectura.lineas || []).length)); motivos.push(`${casadas} línea${casadas === 1 ? '' : 's'} casan`); }
    /* La obra que el encargado tiene elegida en el móvil desempata (no basta sola). */
    if (puntos > 0 && obraId && p.obraId === obraId) { puntos += 10; motivos.push('la obra elegida'); }
    /* Ese número de albarán ya está registrado en este pedido: se avisa. */
    const repetido = Boolean(numAlbaran && (p.albaranes || []).some((a) => ref(a.numero) === numAlbaran));
    return { pedidoId: p.id, codigo: p.codigo, puntos, motivos, ...(repetido ? { repetido: true } : {}) };
  }).filter((x) => x.puntos > 0).sort((a, b) => b.puntos - a.puntos);
}

/**
 * EL FORMULARIO YA RELLENO para un pedido: cada línea del pedido con lo que
 * falta por llegar y lo que dice el albarán que llega ahora, y aparte lo leído
 * que no casa con nada. Lo que se enseña al encargado para que lo confirme.
 */
function propuesta(lineasPedido = [], previos = [], lectura = {}) {
  const r = recepcion(lineasPedido, previos);
  const casadas = casar(lineasPedido, lectura.lineas || []);
  const llega = new Map();
  const leidas = new Map();
  for (const l of casadas) {
    if (l.lineaPedido === null) continue;
    llega.set(l.lineaPedido, redondear((llega.get(l.lineaPedido) || 0) + (l.cantidad || 0)));
    if (!leidas.has(l.lineaPedido)) leidas.set(l.lineaPedido, l);
  }
  return {
    lineas: r.lineas.map((l) => ({
      indice: l.indice, descripcion: l.descripcion, referencia: l.referencia, unidad: l.unidad,
      pedida: l.pedida, recibida: l.recibida, falta: l.falta,
      cantidad: llega.has(l.indice) ? llega.get(l.indice) : null,
      unidadLeida: leidas.has(l.indice) ? leidas.get(l.indice).unidad || null : null,
      leida: leidas.has(l.indice) ? leidas.get(l.indice).descripcion : null,
    })),
    extras: casadas.filter((l) => l.lineaPedido === null).map((l) => ({ descripcion: l.descripcion, referencia: l.referencia || null, unidad: l.unidad || null, cantidad: l.cantidad })),
  };
}

/* ═══════════════════════════════════════════════ Lo que se guarda */

/**
 * Las líneas del albarán tal y como las manda la pantalla: { error } o
 * { lineas } limpias. Una línea con cantidad 0 o vacía no ha llegado y no se
 * guarda; una que no está en el pedido necesita descripción.
 */
function limpiarLineas(lineas = [], nLineasPedido = 0) {
  const fuera = [];
  for (const [n, e] of (Array.isArray(lineas) ? lineas : []).entries()) {
    const txt = llano(e && e.cantidad);
    if (!txt) continue;
    const cantidad = numero(txt);
    if (cantidad === null || cantidad < 0) return { error: `Línea ${n + 1}: la cantidad no se entiende.` };
    if (cantidad === 0) continue;
    if (cantidad > 1e7) return { error: `Línea ${n + 1}: la cantidad es demasiado grande.` };
    const lp = e.lineaPedido === null || e.lineaPedido === undefined || e.lineaPedido === '' ? null : Number(e.lineaPedido);
    if (lp !== null && (!Number.isInteger(lp) || lp < 0 || lp >= nLineasPedido)) return { error: `Línea ${n + 1}: no se encuentra esa línea en el pedido.` };
    const descripcion = llano(e.descripcion).slice(0, 500);
    if (lp === null && !descripcion) return { error: `Línea ${n + 1}: di qué ha llegado.` };
    fuera.push({
      lineaPedido: lp, descripcion: descripcion || null, referencia: llano(e.referencia).slice(0, 120) || null,
      unidad: llano(e.unidad).slice(0, 20) || null, cantidad,
    });
  }
  if (fuera.length > 300) return { error: 'Como mucho 300 líneas por albarán.' };
  return { lineas: fuera };
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.ALBARANES_MOTOR = API;
})({
  RECEPCION, ESTADO_LINEA, UMBRAL_PARECIDO,
  numero, normal, unidad, esUnidad, chocanUnidades, palabras, parecido, puntuar, casar,
  recepcion, resultadoAlbaran, filasDeTrozos, filasDeTexto, buscarCabecera, leer, fechaEn,
  elegirPedido, propuesta, limpiarLineas, cifra,
});

})();
