'use strict';
/*
 * LOS PARTES DE INCIDENCIA: lo que el encargado cuenta desde el móvil (un
 * robo, un problema de avance de obra, daños, seguridad…) y le llega al jefe
 * de obra y a los técnicos de la obra, que lo imprimen en PDF y lo mandan por
 * correo. Aquí están las reglas, sin base ni pantalla: los catálogos, qué
 * hace falta para dar un parte, el código, CÓMO SE VALORA LO ROBADO y el
 * documento. Lo usan el ordenador (electron/data/partesIncidencia.js) y la
 * página del móvil (renderer/movil/partes.js).
 *
 * CÓMO SE VALORA UN MATERIAL ROBADO. Cada material se casa con una partida del
 * presupuesto de la obra, y de ella salen dos números por unidad:
 *
 *   · LA VENTA: lo que la partida le vende al cliente, solo la parte del
 *     material (la proporción de material de la matriz de venta, o de la de
 *     estudio, o la típica del banco de precios; si la partida es solo de
 *     suministro, entera).
 *
 *   · EL COSTE, según cómo lo ofertó el industrial que lo tiene que instalar:
 *       1. si separó SUMINISTRO y MONTAJE, su precio de suministro;
 *          (si la partida es solo de suministro, su precio es eso mismo);
 *       2. si lo dio JUNTO, el material sale del REPOSITORIO DE PRECIOS (el
 *          banco: su precio de referencia × la parte de material típica,
 *          primero el del proyecto y luego el de la casa);
 *       3. sin nada de eso, el material de nuestro propio estudio;
 *       4. y si ni eso, queda sin valorar para que el jefe de obra lo ponga.
 *     Lo que el jefe de obra escriba a mano manda sobre todo lo anterior.
 *
 * Las herramientas y la maquinaria no están en el presupuesto: su coste lo
 * pone el jefe de obra (lo que cuesta reponerlas) y no tienen venta.
 */
(function () {

const llano = (v) => String(v ?? '').trim();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const redondear = (n, d = 2) => Math.round((Number(n) + Number.EPSILON) * 10 ** d) / 10 ** d;
const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const euros = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—'
  : `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const cifra = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 });

/** Un número escrito a la española («1.250,5», «3»), o null. */
function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let t = llano(v).replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : null;
}

/* ═══════════════════════════════════════════ Los catálogos */

const TIPOS = {
  robo:      { nombre: 'Robo', icono: '🔓', ayuda: 'Material, herramienta o maquinaria que falta.',
    ejemplo: 'Robo de tubo de cobre en planta 2', pista: 'Cómo se ha visto, si había forzado, quién lo descubrió…' },
  avance:    { nombre: 'Avance de obra', icono: '⏱', ayuda: 'Algo que retrasa o para un tajo.',
    ejemplo: 'Sin poder montar falso techo en P3', pista: 'Qué tajo, por qué está parado, qué hace falta para seguir…' },
  danos:     { nombre: 'Daños', icono: '💥', ayuda: 'Algo roto o estropeado (vandalismo, golpes, agua…).',
    ejemplo: 'Rotura de bandeja en patinillo norte', pista: 'Qué se ha roto, cómo, si hay que rehacer algo…' },
  seguridad: { nombre: 'Seguridad', icono: '⛑', ayuda: 'Accidente, casi accidente o algo inseguro.',
    ejemplo: 'Hueco sin proteger en forjado P4', pista: 'Qué ha pasado, si hay heridos, qué se ha hecho ya…' },
  otros:     { nombre: 'Otra cosa', icono: '📝', ayuda: 'Lo que no encaja en lo anterior.',
    ejemplo: 'Corte de agua en la obra', pista: 'Qué ha pasado y a quién afecta…' },
};

const GRAVEDADES = {
  baja:  { nombre: 'Baja', orden: 1 },
  media: { nombre: 'Media', orden: 2 },
  alta:  { nombre: 'Alta', orden: 3 },
  grave: { nombre: 'Muy grave: para la obra', orden: 4 },
};

const DENUNCIA = { no: 'No, todavía no', si: 'Sí, denunciado', noProcede: 'No hace falta' };

const CAUSAS_AVANCE = {
  falta_material: 'Falta material',
  falta_personal: 'Falta personal de la subcontrata',
  interferencia: 'Otro gremio no ha terminado / interfiere',
  falta_definicion: 'Falta definición o plano',
  propiedad: 'Cambio o decisión de la propiedad / DF',
  clima: 'Tiempo',
  otra: 'Otra causa',
};

const CLASES = { material: 'Material', herramienta: 'Herramienta', maquinaria: 'Maquinaria', otro: 'Otra cosa' };

const ESTADOS = {
  nuevo:   { nombre: 'Enviado', ayuda: 'Le ha llegado al jefe de obra; aún no lo ha abierto.' },
  visto:   { nombre: 'Visto', ayuda: 'El jefe de obra lo ha visto.' },
  cerrado: { nombre: 'Cerrado', ayuda: 'Resuelto; la valoración queda congelada.' },
};

/* Con cosas (lo robado, lo roto): estos dos tipos. */
const conCosas = (tipo) => tipo === 'robo' || tipo === 'danos';

/* ═══════════════════════════════════════════ Dar un parte */

/**
 * LO QUE HACE FALTA PARA DAR UN PARTE, ya limpio. Devuelve `{ ok, error }` o
 * `{ ok, parte, lineas }`. `hoy` es el día del ordenador: no se da un parte
 * de algo que no ha pasado todavía.
 */
function validar(datos = {}, { hoy } = {}) {
  const tipo = llano(datos.tipo);
  if (!TIPOS[tipo]) return { ok: false, error: 'Elige qué ha pasado (robo, avance de obra, daños…).' };
  const titulo = llano(datos.titulo).replace(/\s+/g, ' ').slice(0, 120);
  if (titulo.length < 4) return { ok: false, error: 'Escribe en pocas palabras qué ha pasado.' };
  const fecha = llano(datos.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return { ok: false, error: 'La fecha no es válida.' };
  if (hoy && fecha > hoy) return { ok: false, error: 'La fecha es de un día que todavía no ha llegado.' };
  const hora = /^\d{2}:\d{2}$/.test(llano(datos.hora)) ? llano(datos.hora) : null;
  const gravedad = GRAVEDADES[llano(datos.gravedad)] ? llano(datos.gravedad) : 'media';
  const parte = {
    tipo, titulo, fecha, hora, gravedad,
    zona: llano(datos.zona).slice(0, 120) || null,
    descripcion: llano(datos.descripcion).slice(0, 4000) || null,
    denuncia: null, atestado: null, causa: null, proveedorId: null, diasRetraso: null,
  };
  if (tipo === 'robo') {
    parte.denuncia = DENUNCIA[llano(datos.denuncia)] ? llano(datos.denuncia) : 'no';
    parte.atestado = llano(datos.atestado).slice(0, 60) || null;
  }
  if (tipo === 'avance') {
    parte.causa = CAUSAS_AVANCE[llano(datos.causa)] ? llano(datos.causa) : null;
    if (!parte.causa) return { ok: false, error: 'Elige por qué se retrasa.' };
    const d = numero(datos.diasRetraso);
    if (d !== null && (d < 0 || d > 365)) return { ok: false, error: 'Los días que se pierden van de 0 a 365.' };
    parte.diasRetraso = d;
  }
  if (tipo === 'avance' || tipo === 'danos') parte.proveedorId = llano(datos.proveedorId) || null;

  const lineas = [];
  if (conCosas(tipo)) {
    const entrada = Array.isArray(datos.lineas) ? datos.lineas : [];
    for (const [i, l] of entrada.entries()) {
      const descripcion = llano(l && l.descripcion).replace(/\s+/g, ' ').slice(0, 200);
      const cantidad = numero(l && l.cantidad);
      if (!descripcion && cantidad === null) continue; /* una línea vacía se ignora */
      const n = i + 1;
      if (!descripcion) return { ok: false, error: `En la cosa ${n}, escribe qué es.` };
      if (cantidad === null || cantidad <= 0) return { ok: false, error: `En «${descripcion}», pon cuántos (un número mayor que cero).` };
      if (cantidad > 1e6) return { ok: false, error: `En «${descripcion}», la cantidad es demasiado grande.` };
      const clase = CLASES[llano(l.clase)] ? llano(l.clase) : 'otro';
      lineas.push({
        clase, descripcion, cantidad: redondear(cantidad, 3),
        unidad: llano(l.unidad).slice(0, 12) || (clase === 'material' ? null : 'ud'),
        lineaId: clase === 'material' ? llano(l.ref || l.lineaId) || null : null,
      });
    }
    if (tipo === 'robo' && !lineas.length) return { ok: false, error: 'Pon al menos una cosa de lo que se han llevado (qué y cuántos).' };
    if (lineas.length > 60) return { ok: false, error: 'Como mucho 60 cosas en un parte.' };
  }
  return { ok: true, parte, lineas };
}

/** El siguiente código de la obra: PI-0001, PI-0002… */
function siguienteCodigo(codigos = []) {
  let max = 0;
  for (const c of codigos) {
    const m = /^PI-(\d+)$/.exec(llano(c));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PI-${String(max + 1).padStart(4, '0')}`;
}

/* ═══════════════════════════════════════════ La valoración */

const positivo = (v) => { const n = numero(v); return n !== null && n > 0 ? n : null; };

/**
 * LA PARTE DE MATERIAL DE UN PRECIO, en tanto por uno, de unos componentes
 * `{ material, auxiliares, transporte, manoObra, subcontrata }` (en euros o en
 * tanto por uno: da igual, se normaliza). null si no hay desglose.
 */
function fraccionMaterial(componentes) {
  if (!componentes) return null;
  const claves = ['material', 'auxiliares', 'transporte', 'manoObra', 'subcontrata'];
  const total = claves.reduce((s, k) => s + (Number(componentes[k]) || 0), 0);
  if (!(total > 0)) return null;
  return (Number(componentes.material) || 0) / total;
}

/**
 * VALORAR UNA COSA ROBADA (o rota). Lo que entra:
 *   cantidad     — cuántas;
 *   clase        — material, herramienta, maquinaria u otro;
 *   prestacion   — de la partida casada: 'SUM' (solo suministro), 'SYM' o 'MON';
 *   venta        — { unitario, fraccion } de la partida: su precio de venta y
 *                  la parte de material de su matriz de venta (o de estudio);
 *   oferta       — { proveedor, precio, precioSuministro } del industrial
 *                  adjudicado para esa partida, si lo hay;
 *   banco        — { valor, fraccion, fase, deDonde } del repositorio de precios;
 *   estudio      — coste de material por unidad de nuestro estudio;
 *   manual       — { coste, venta } que ha escrito el jefe de obra.
 * Sale `{ precioVenta, costeUnitario, importeVenta, importeCoste, origenCoste, explicacion }`.
 */
function valorar({ cantidad, clase = 'material', prestacion = 'SYM', venta = null, oferta = null, banco = null, estudio = null, manual = {} } = {}) {
  const q = numero(cantidad) || 0;
  const porque = [];
  let coste = null;
  let origenCoste = null;
  const costeManual = positivo(manual && manual.coste);
  const ventaManual = positivo(manual && manual.venta);

  if (costeManual !== null) {
    coste = costeManual; origenCoste = 'manual';
    porque.push('Coste puesto a mano por el jefe de obra.');
  } else if (clase !== 'material') {
    porque.push('Las herramientas y la maquinaria no están en el presupuesto: pon lo que cuesta reponerlas.');
  } else {
    const sumOferta = oferta ? positivo(oferta.precioSuministro) : null;
    const precioOferta = oferta ? positivo(oferta.precio) : null;
    const quien = (oferta && oferta.proveedor) || 'El industrial';
    if (sumOferta !== null) {
      coste = sumOferta; origenCoste = 'ofertaSuministro';
      porque.push(`${quien} separa suministro y montaje: su suministro, ${euros(sumOferta)}/ud.`);
    } else if (precioOferta !== null && prestacion === 'SUM') {
      coste = precioOferta; origenCoste = 'ofertaSuministro';
      porque.push(`La partida es solo de suministro: precio de ${quien}, ${euros(precioOferta)}/ud.`);
    } else {
      if (precioOferta !== null) porque.push(`${quien} da suministro y montaje juntos (${euros(precioOferta)}/ud): el material sale del banco de precios.`);
      const bv = banco ? positivo(banco.valor) : null;
      const bf = banco && Number(banco.fraccion) > 0 ? Number(banco.fraccion) : null;
      if (bv !== null && (bf !== null || prestacion === 'SUM')) {
        const f = prestacion === 'SUM' ? 1 : bf;
        coste = bv * f; origenCoste = 'banco';
        porque.push(`Banco de precios${banco.deDonde === 'proyecto' ? ' del proyecto' : banco.deDonde === 'casa' ? ' de la casa' : ''}: ${euros(bv)}/ud${f < 1 ? `, de ello material el ${Math.round(f * 100)} %` : ''}.`);
      } else if (positivo(estudio) !== null) {
        coste = positivo(estudio); origenCoste = 'estudio';
        porque.push(`Sin oferta separada ni banco: el material de nuestro estudio, ${euros(coste)}/ud.`);
      } else {
        porque.push('Sin precio para el material: pon el coste a mano.');
      }
    }
  }

  let precioVenta = null;
  if (ventaManual !== null) {
    precioVenta = ventaManual;
    porque.push('Venta puesta a mano.');
  } else if (clase === 'material' && venta && positivo(venta.unitario) !== null) {
    const u = positivo(venta.unitario);
    let f = venta.fraccion !== null && venta.fraccion !== undefined && Number(venta.fraccion) > 0 ? Number(venta.fraccion) : null;
    if (f === null && prestacion === 'SUM') f = 1;
    if (f === null && banco && Number(banco.fraccion) > 0) f = Number(banco.fraccion);
    if (f === null) {
      precioVenta = u;
      porque.push(`Venta: la partida entera, ${euros(u)}/ud (no separa el material del montaje).`);
    } else {
      precioVenta = u * Math.min(1, f);
      porque.push(f >= 1 ? `Venta: ${euros(u)}/ud.` : `Venta: el material de la partida, el ${Math.round(f * 100)} % de ${euros(u)}/ud.`);
    }
  }

  precioVenta = precioVenta === null ? null : redondear(precioVenta, 4);
  coste = coste === null ? null : redondear(coste, 4);
  return {
    precioVenta, costeUnitario: coste,
    importeVenta: precioVenta === null ? null : redondear(precioVenta * q),
    importeCoste: coste === null ? null : redondear(coste * q),
    origenCoste, explicacion: porque.join(' '),
  };
}

const ORIGENES = {
  ofertaSuministro: 'Suministro del industrial',
  banco: 'Banco de precios',
  estudio: 'Nuestro estudio',
  manual: 'A mano',
};

/** Las sumas de un parte: venta, coste y cuántas cosas quedan sin valorar. */
function totales(lineas = []) {
  let venta = 0; let coste = 0; let sinCoste = 0; let sinVenta = 0;
  for (const l of lineas) {
    if (l.importeCoste === null || l.importeCoste === undefined) sinCoste += 1; else coste += Number(l.importeCoste);
    if (l.clase === 'material') { if (l.importeVenta === null || l.importeVenta === undefined) sinVenta += 1; else venta += Number(l.importeVenta); }
  }
  return { venta: redondear(venta), coste: redondear(coste), sinCoste, sinVenta, n: lineas.length };
}

/* ═══════════════════════════════════════════ El documento */

const REPERCUSIONES_PARTE = { si: 'Sí, todo', no: 'No', parcial: 'Parcial' };

/**
 * LO QUE CUESTA EL PARTE Y LO QUE SE LE PASA AL CLIENTE: lo robado o roto
 * (la valoración), el coste extra (reponer, cerrajero, vigilancia…) y la
 * repercusión «si / no / parcial» con su importe. Solo en la copia con dinero.
 */
function cuentasParte(parte = {}, tot = { venta: 0, coste: 0 }) {
  const extra = Number(parte.costeExtra) || 0;
  const coste = redondear((Number(tot.coste) || 0) + extra);
  const modo = REPERCUSIONES_PARTE[parte.repercusion] ? parte.repercusion : 'no';
  const repercutido = modo === 'si' ? redondear((Number(tot.venta) || 0) + extra)
    : modo === 'parcial' ? (parte.importeRepercutido === null || parte.importeRepercutido === undefined ? null : redondear(Number(parte.importeRepercutido)))
    : 0;
  return { extra: redondear(extra), coste, repercusion: modo, repercutido, queda: repercutido === null ? null : redondear(coste - repercutido) };
}

function repercusionHtml(parte, tot) {
  const c = cuentasParte(parte, tot);
  if (!c.extra && c.repercusion === 'no' && !parte.repercusion) return '';
  return `<section class="costeParte"><h2>Coste y repercusión al cliente</h2>
    <table class="tablaParte">
      <tbody>
        <tr><td>Valoración de lo robado o roto (coste)</td><td class="num">${euros(tot.coste)}</td></tr>
        <tr><td>Coste extra${llano(parte.costeExtraConcepto) ? ` <small>(${esc(parte.costeExtraConcepto)})</small>` : ''}</td><td class="num">${euros(c.extra)}</td></tr>
        <tr><td><strong>Coste total</strong></td><td class="num"><strong>${euros(c.coste)}</strong></td></tr>
        <tr><td>Se repercute al cliente: ${esc(REPERCUSIONES_PARTE[c.repercusion])}</td><td class="num">${c.repercutido === null ? 'sin importe' : euros(c.repercutido)}</td></tr>
        <tr><td>Queda a cargo de la obra</td><td class="num">${c.queda === null ? '—' : euros(c.queda)}</td></tr>
      </tbody>
    </table>
    ${c.repercusion === 'si' ? '<p class="nota">Repercusión total: la venta de lo valorado más el coste extra.</p>' : ''}
  </section>`;
}

/*
 * La firma de arriba del documento. En el escritorio (Vidaire Obras) es la
 * de CBRE; en Vidaire Cx, la app del teléfono que va a la App Store sin marca
 * ajena, la suya. Vidaire Cx lo dice al arrancar con globalThis.CX_VARIANTE.
 */
const marcaDocumento = () => (globalThis.CX_VARIANTE === 'cxobra' ? 'Vidaire Cx' : 'CBRE · Project Management');

/**
 * EL PARTE EN PAPEL (para el PDF). Con `conDinero` sale la valoración (venta y
 * coste de cada cosa y el total): la copia para el jefe de obra. Sin él, la
 * que puede ver cualquiera (la aseguradora, la denuncia, la subcontrata).
 */
function html({ parte = {}, lineas = [], obra = {}, emisor = {}, proveedor = null, fotos = [], conDinero = false, hoy, comentarios = [] } = {}) {
  /* La conversación, la misma de las incidencias y las NCR (se busca aquí para no atar este fichero al bundle móvil). */
  const CV = typeof require !== 'undefined' ? require('../conversacion/motor') : window.CONVERSACION_FICHA;
  const vigente = parte.resultadoVigente && CV.RESULTADOS[parte.resultadoVigente.resultado] ? CV.RESULTADOS[parte.resultadoVigente.resultado].nombre : '';
  const t = TIPOS[parte.tipo] || { nombre: parte.tipo };
  const dato = (que, valor) => (llano(valor) ? `<div><dt>${esc(que)}</dt><dd>${esc(valor)}</dd></div>` : '');
  const tot = totales(lineas);
  const filas = lineas.map((l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(CLASES[l.clase] || l.clase)}</td>
        <td>${esc(l.descripcion)}${l.partida ? `<br><small>Partida ${esc(l.partida)}</small>` : ''}</td>
        <td class="num">${esc(cifra(l.cantidad))}</td>
        <td>${esc(l.unidad || '')}</td>
        ${conDinero ? `<td class="num">${l.clase === 'material' ? euros(l.importeVenta) : '—'}</td>
        <td class="num">${euros(l.importeCoste)}</td>
        <td><small>${esc(ORIGENES[l.origenCoste] || (l.importeCoste === null || l.importeCoste === undefined ? 'Sin valorar' : ''))}</small></td>` : ''}
      </tr>`).join('');
  return `
<article class="documentoParte">
  <header class="cabeceraParte">
    <div>
      <p class="marca">${esc(marcaDocumento())}</p>
      <h1>Parte de incidencia · ${esc(t.nombre)}</h1>
      <p class="ref">Referencia <strong>${esc(parte.codigo)}</strong>${obra.codigo ? ` · Obra ${esc(obra.codigo)}` : ''}</p>
    </div>
    <p class="fecha">${esc(fechaEs(hoy))}</p>
  </header>

  <dl class="datosParte">
    ${dato('Obra', [obra.codigo, obra.nombre].filter(Boolean).join(' · '))}
    ${dato('Qué ha pasado', parte.titulo)}
    ${dato('Cuándo', [fechaEs(parte.fecha), parte.hora].filter(Boolean).join(' a las '))}
    ${dato('Dónde', parte.zona)}
    ${dato('Gravedad', (GRAVEDADES[parte.gravedad] || {}).nombre)}
    ${parte.tipo === 'robo' ? dato('Denuncia', [DENUNCIA[parte.denuncia], parte.atestado ? `atestado ${parte.atestado}` : ''].filter(Boolean).join(' · ')) : ''}
    ${parte.tipo === 'avance' ? dato('Causa', CAUSAS_AVANCE[parte.causa]) : ''}
    ${parte.tipo === 'avance' && parte.diasRetraso !== null && parte.diasRetraso !== undefined ? dato('Días que se pierden', cifra(parte.diasRetraso)) : ''}
    ${proveedor ? dato(parte.tipo === 'danos' ? 'Causante' : 'Subcontrata', proveedor) : ''}
    ${dato('Lo da', [emisor.nombre, emisor.rol].filter(Boolean).join(', '))}
    ${dato('Estado', (ESTADOS[parte.estado] || {}).nombre)}
    ${dato('Reparación', vigente)}
  </dl>

  ${llano(parte.descripcion) ? `<section class="relato"><h2>Lo que ha pasado</h2><p>${esc(parte.descripcion).replace(/\n/g, '<br>')}</p></section>` : ''}

  ${CV.papel(comentarios, { estilo: 'parte', resultados: Object.fromEntries(Object.entries(CV.RESULTADOS).map(([k, v]) => [k, v.nombre])) })}

  ${lineas.length ? `<section>
    <h2>${parte.tipo === 'robo' ? 'Lo que se han llevado' : 'Lo que se ha roto'}</h2>
    <table class="tablaParte">
      <thead><tr><th class="num">#</th><th>Qué es</th><th>Descripción</th><th class="num">Cantidad</th><th>Ud.</th>
        ${conDinero ? '<th class="num">Venta</th><th class="num">Coste</th><th>Coste según</th>' : ''}</tr></thead>
      <tbody>${filas}</tbody>
      ${conDinero ? `<tfoot><tr><td colspan="5">Total${tot.sinCoste ? ` <small>(${tot.sinCoste} sin valorar)</small>` : ''}</td>
        <td class="num">${euros(tot.venta)}</td><td class="num">${euros(tot.coste)}</td><td></td></tr></tfoot>` : ''}
    </table>
    ${conDinero ? '<p class="nota">Venta: lo que vale el material en el presupuesto de la obra. Coste: el precio de suministro del industrial si lo separa del montaje; si lo da junto, el del banco de precios.</p>' : ''}
  </section>` : ''}

  ${conDinero ? repercusionHtml(parte, tot) : ''}

  ${llano(parte.notasJefe) ? `<section class="relato"><h2>Notas del jefe de obra</h2><p>${esc(parte.notasJefe).replace(/\n/g, '<br>')}</p></section>` : ''}

  ${fotos.length ? `<section class="fotosParte"><h2>Fotos</h2><div class="rejilla">${fotos.map((f) => `<figure><img src="${esc(f.src)}" alt=""></figure>`).join('')}</div></section>` : ''}
</article>`;
}

/** El correo: asunto y texto (el PDF va adjunto a mano: mailto no adjunta). */
function correo({ parte = {}, obra = {}, lineas = [], conDinero = false } = {}) {
  const t = TIPOS[parte.tipo] || { nombre: parte.tipo };
  const asunto = `Parte de incidencia ${parte.codigo} · ${t.nombre} · ${[obra.codigo, obra.nombre].filter(Boolean).join(' ')}`;
  const tot = totales(lineas);
  const cuerpo = [
    'Buenos días:',
    '',
    `Os paso el parte de incidencia ${parte.codigo} de la obra ${[obra.codigo, obra.nombre].filter(Boolean).join(' · ')}.`,
    '',
    `· Qué ha pasado: ${parte.titulo}`,
    `· Cuándo: ${[fechaEs(parte.fecha), parte.hora].filter(Boolean).join(' a las ')}`,
    parte.zona ? `· Dónde: ${parte.zona}` : null,
    `· Gravedad: ${(GRAVEDADES[parte.gravedad] || {}).nombre || ''}`,
    lineas.length ? `· ${parte.tipo === 'robo' ? 'Lo robado' : 'Lo dañado'}: ${lineas.map((l) => `${cifra(l.cantidad)} ${l.unidad || ''} ${l.descripcion}`.replace(/\s+/g, ' ')).join('; ')}` : null,
    conDinero && lineas.length ? `· Valoración: venta ${euros(tot.venta)} · coste ${euros(tot.coste)}${tot.sinCoste ? ` (${tot.sinCoste} sin valorar)` : ''}` : null,
    '',
    'Va adjunto el parte en PDF.',
    '',
    'Un saludo.',
  ].filter((x) => x !== null).join('\n');
  return { asunto, cuerpo };
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.PARTES_MOTOR = API;
})({
  TIPOS, GRAVEDADES, DENUNCIA, CAUSAS_AVANCE, CLASES, ESTADOS, ORIGENES,
  conCosas, numero, validar, siguienteCodigo, fraccionMaterial, valorar, totales, html, correo, fechaEs, euros,
  REPERCUSIONES_PARTE, cuentasParte,
});

})();
