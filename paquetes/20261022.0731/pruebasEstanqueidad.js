'use strict';
/*
 * LAS PRUEBAS DE ESTANQUEIDAD (pruebas de presión) de las instalaciones: el
 * encargado apunta desde el móvil la prueba que hace (qué tramo, a qué
 * presión, cuánto tiempo, lo que marcaba el manómetro al empezar y al
 * acabar) y hace la foto del manómetro; al jefe de obra le sale el informe
 * hecho, en PDF, guardado en la documentación de la obra. Aquí están las
 * reglas, sin base ni pantalla: el catálogo de instalaciones, qué hace falta
 * para darla, el veredicto y el informe. Lo usan el ordenador
 * (electron/data/pruebasEstanqueidad.js) y la página del móvil
 * (renderer/movil/estanqueidad.js).
 *
 * LOS VALORES DE CADA INSTALACIÓN SON ORIENTATIVOS: lo que suele pedirse
 * (RITE IT 2.2.2, CTE DB HS 4, RIPCI y UNE-EN 12845, UNE 60670-8,
 * UNE-EN 1610). Manda lo que diga el pliego o el proyecto: el encargado los
 * cambia si no coinciden.
 *
 * EL VEREDICTO sale de los números, no de quien la da:
 *   · no superada si se ven fugas, si el manómetro no llegó a la presión de
 *     prueba o si la caída pasa de la admisible;
 *   · si falta un dato para saberlo (la presión final), queda «sin terminar».
 */
(function () {

const llano = (v) => String(v ?? '').trim();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const redondear = (n, d = 3) => Math.round((Number(n) + Number.EPSILON) * 10 ** d) / 10 ** d;
const fechaEs = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const cifra = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 }));

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

/*
 * Cada instalación con lo que se suele pedir: `factor` × la presión de
 * trabajo con un `minimo`, `minutos` de duración y la `caida` que se admite
 * (en la unidad de la instalación). `fluido` el habitual.
 */
const INSTALACIONES = {
  fontaneria: { nombre: 'Fontanería (agua fría)', icono: '🚰', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 10, minutos: 120, caida: 0.2,
    norma: 'CTE DB HS 4 · UNE-EN 806-4' },
  acs:        { nombre: 'Agua caliente sanitaria', icono: '♨️', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 10, minutos: 120, caida: 0.2,
    norma: 'RITE IT 2.2.2.4 · CTE DB HS 4' },
  clima:      { nombre: 'Calefacción / climatización (agua)', icono: '🌡', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 6, minutos: 120, caida: 0.2,
    norma: 'RITE IT 2.2.2.4' },
  frigorifica:{ nombre: 'Frigorífica (refrigerante)', icono: '❄️', unidad: 'bar', fluido: 'nitrogeno', factor: 1.1, minimo: 0, minutos: 1440, caida: 0,
    norma: 'RD 552/2019 · UNE-EN 378-2' },
  pci:        { nombre: 'Protección contra incendios (BIE, hidrantes)', icono: '🧯', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 10, minutos: 120, caida: 0,
    norma: 'RIPCI (RD 513/2017)' },
  rociadores: { nombre: 'Rociadores', icono: '💦', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 15, minutos: 120, caida: 0,
    norma: 'UNE-EN 12845' },
  gas:        { nombre: 'Gas', icono: '🔥', unidad: 'mbar', fluido: 'aire', factor: 1, minimo: 0, minutos: 15, caida: 0,
    norma: 'UNE 60670-8' },
  saneamiento:{ nombre: 'Saneamiento', icono: '🕳', unidad: 'mbar', fluido: 'agua', factor: 1, minimo: 0, minutos: 30, caida: 0,
    norma: 'UNE-EN 1610 · CTE DB HS 5' },
  aire:       { nombre: 'Aire comprimido', icono: '💨', unidad: 'bar', fluido: 'aire', factor: 1.5, minimo: 0, minutos: 60, caida: 0,
    norma: 'Pliego de la obra' },
  otra:       { nombre: 'Otra instalación', icono: '🔧', unidad: 'bar', fluido: 'agua', factor: 1.5, minimo: 0, minutos: 60, caida: 0,
    norma: 'Pliego de la obra' },
};

const FLUIDOS = { agua: 'Agua', aire: 'Aire', nitrogeno: 'Nitrógeno', otro: 'Otro' };
const UNIDADES = { bar: 'bar', mbar: 'mbar', kPa: 'kPa' };

const RESULTADOS = {
  correcta:     { nombre: 'Correcta', ayuda: 'Sin fugas y sin caída por encima de la admisible.' },
  noSuperada:   { nombre: 'No superada', ayuda: 'Hay que reparar y repetir la prueba.' },
  sinTerminar:  { nombre: 'Sin terminar', ayuda: 'Falta la lectura final del manómetro.' },
};

const ESTADOS = {
  nuevo: { nombre: 'Enviada', ayuda: 'Le ha llegado al jefe de obra; aún no la ha abierto.' },
  visto: { nombre: 'Vista', ayuda: 'El jefe de obra la ha visto.' },
};

/* Las fotos: la del manómetro al empezar, al acabar y otras (el tramo, la placa…). */
const MOMENTOS_FOTO = { inicio: 'Manómetro al empezar', final: 'Manómetro al acabar', otra: 'Otra foto' };

/** La presión de prueba que se suele pedir para una presión de trabajo. */
function presionSugerida(instalacion, presionTrabajo) {
  const i = INSTALACIONES[instalacion];
  const pt = numero(presionTrabajo);
  if (!i || pt === null || pt <= 0) return null;
  return redondear(Math.max(pt * i.factor, i.minimo), 2);
}

/* ═══════════════════════════════════════════ El veredicto */

/**
 * LO QUE SALE DE LOS NÚMEROS: `{ resultado, caida, motivos }`. Las presiones
 * van todas en la misma unidad.
 */
function veredicto({ presionPrueba, presionInicial, presionFinal, caidaAdmisible, fugas = false } = {}) {
  const pp = numero(presionPrueba);
  const pi = numero(presionInicial);
  const pf = numero(presionFinal);
  const adm = numero(caidaAdmisible) ?? 0;
  const motivos = [];
  const caida = pi !== null && pf !== null ? redondear(pi - pf) : null;
  if (fugas) motivos.push('Se han visto fugas.');
  /* Un 2 % por debajo es la lectura de la aguja: no se cuenta. */
  if (pp !== null && pi !== null && pi < pp * 0.98) motivos.push(`El manómetro no llegó a la presión de prueba (${cifra(pi)} de ${cifra(pp)}).`);
  if (caida !== null && caida > adm + 1e-9) motivos.push(`La presión cayó ${cifra(caida)} y se admiten ${cifra(adm)}.`);
  if (motivos.length) return { resultado: 'noSuperada', caida, motivos };
  if (caida === null) return { resultado: 'sinTerminar', caida, motivos: ['Falta la presión al acabar.'] };
  return { resultado: 'correcta', caida, motivos: [] };
}

/* ═══════════════════════════════════════════ Dar una prueba */

/**
 * LO QUE HACE FALTA PARA DAR UNA PRUEBA, ya limpio. Devuelve `{ ok, error }`
 * o `{ ok, prueba }` con el veredicto ya puesto.
 */
function validar(datos = {}, { hoy } = {}) {
  const instalacion = llano(datos.instalacion);
  const ins = INSTALACIONES[instalacion];
  if (!ins) return { ok: false, error: 'Elige qué instalación se prueba.' };
  const tramo = llano(datos.tramo).replace(/\s+/g, ' ').slice(0, 160);
  if (tramo.length < 2) return { ok: false, error: 'Escribe qué tramo o zona se prueba (planta, montante, circuito…).' };
  const fecha = llano(datos.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return { ok: false, error: 'La fecha no es válida.' };
  if (hoy && fecha > hoy) return { ok: false, error: 'La fecha es de un día que todavía no ha llegado.' };
  const hora = /^\d{2}:\d{2}$/.test(llano(datos.horaInicio)) ? llano(datos.horaInicio) : null;
  const unidad = UNIDADES[llano(datos.unidad)] ? llano(datos.unidad) : ins.unidad;
  const fluido = FLUIDOS[llano(datos.fluido)] ? llano(datos.fluido) : ins.fluido;

  const n = (k) => numero(datos[k]);
  const presionTrabajo = n('presionTrabajo');
  const presionPrueba = n('presionPrueba');
  const presionInicial = n('presionInicial');
  const presionFinal = n('presionFinal');
  const duracion = n('duracionMin');
  const caidaAdmisible = n('caidaAdmisible') ?? ins.caida;
  const maxP = unidad === 'bar' ? 400 : 400000;
  for (const [k, v, que] of [['presionTrabajo', presionTrabajo, 'de trabajo'], ['presionPrueba', presionPrueba, 'de prueba'],
    ['presionInicial', presionInicial, 'al empezar'], ['presionFinal', presionFinal, 'al acabar']]) {
    if (v !== null && (v < 0 || v > maxP)) return { ok: false, error: `La presión ${que} no es válida.`, campo: k };
  }
  if (presionPrueba === null || presionPrueba <= 0) return { ok: false, error: 'Pon la presión de prueba.' };
  if (presionInicial === null) return { ok: false, error: 'Pon lo que marcaba el manómetro al empezar.' };
  if (duracion === null || duracion <= 0 || duracion > 10080) return { ok: false, error: 'Pon cuántos minutos ha durado la prueba.' };
  if (caidaAdmisible < 0 || caidaAdmisible > maxP) return { ok: false, error: 'La caída admisible no es válida.' };
  const fugas = datos.fugas === true || datos.fugas === 'si' || datos.fugas === 1 || datos.fugas === '1';

  const v = veredicto({ presionPrueba, presionInicial, presionFinal, caidaAdmisible, fugas });
  return {
    ok: true,
    prueba: {
      instalacion, tramo, fecha, horaInicio: hora, unidad, fluido,
      norma: llano(datos.norma).slice(0, 120) || ins.norma,
      presionTrabajo, presionPrueba, presionInicial, presionFinal,
      duracionMin: Math.round(duracion), caidaAdmisible: redondear(caidaAdmisible), caida: v.caida,
      fugas: fugas ? 1 : 0, resultado: v.resultado,
      empresa: llano(datos.empresa).slice(0, 120) || null,
      proveedorId: llano(datos.proveedorId) || null,
      manometro: llano(datos.manometro).slice(0, 120) || null,
      observaciones: llano(datos.observaciones).slice(0, 4000) || null,
    },
    motivos: v.motivos,
  };
}

/** El siguiente código de la obra: PE-0001, PE-0002… */
function siguienteCodigo(codigos = []) {
  let max = 0;
  for (const c of codigos) {
    const m = /^PE-(\d+)$/.exec(llano(c));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PE-${String(max + 1).padStart(4, '0')}`;
}

/** El nombre del PDF en la carpeta de la obra. */
function nombreInforme(prueba = {}, obra = {}) {
  const ins = (INSTALACIONES[prueba.instalacion] || {}).nombre || 'Instalación';
  return `${obra.codigo || 'Obra'} ${prueba.codigo} Prueba de estanqueidad ${ins.replace(/\s*\(.*\)$/, '')} ${prueba.tramo || ''}`
    .replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 150) + '.pdf';
}

/* ═══════════════════════════════════════════ El informe */

/*
 * La firma de arriba del documento. En el escritorio (Vidaire Obras) es la
 * de CBRE; en Vidaire Cx, la app del teléfono que va a la App Store sin marca
 * ajena, la suya. Vidaire Cx lo dice al arrancar con globalThis.CX_VARIANTE.
 */
const marcaDocumento = () => (globalThis.CX_VARIANTE === 'cxobra' ? 'Vidaire Cx' : 'CBRE · Project Management');

/** EL INFORME EN PAPEL (para el PDF). `fotos` son `{ src, momento }`. */
function html({ prueba = {}, obra = {}, emisor = {}, empresa = null, fotos = [], hoy } = {}) {
  const ins = INSTALACIONES[prueba.instalacion] || { nombre: prueba.instalacion };
  const u = prueba.unidad || 'bar';
  const dato = (que, valor) => (llano(valor) ? `<div><dt>${esc(que)}</dt><dd>${esc(valor)}</dd></div>` : '');
  const p = (v) => (v === null || v === undefined ? '—' : `${cifra(v)} ${u}`);
  const v = veredicto({ ...prueba, fugas: Boolean(prueba.fugas) });
  const res = RESULTADOS[prueba.resultado] || RESULTADOS[v.resultado];
  const clase = prueba.resultado === 'correcta' ? 'ok' : prueba.resultado === 'noSuperada' ? 'mal' : 'pendiente';
  const pie = (f) => MOMENTOS_FOTO[f.momento] || MOMENTOS_FOTO.otra;
  return `
<article class="documentoParte documentoPrueba">
  <header class="cabeceraParte">
    <div>
      <p class="marca">${esc(marcaDocumento())}</p>
      <h1>Prueba de estanqueidad · ${esc(ins.nombre)}</h1>
      <p class="ref">Referencia <strong>${esc(prueba.codigo)}</strong>${obra.codigo ? ` · Obra ${esc(obra.codigo)}` : ''}</p>
    </div>
    <p class="fecha">${esc(fechaEs(hoy))}</p>
  </header>

  <p class="veredicto ${clase}"><strong>${esc(res.nombre)}</strong>${v.motivos.length ? ` · ${esc(v.motivos.join(' '))}` : ''}</p>

  <dl class="datosParte">
    ${dato('Obra', [obra.codigo, obra.nombre].filter(Boolean).join(' · '))}
    ${dato('Instalación', ins.nombre)}
    ${dato('Tramo / zona', prueba.tramo)}
    ${dato('Fecha', [fechaEs(prueba.fecha), prueba.horaInicio].filter(Boolean).join(' a las '))}
    ${dato('Fluido de prueba', FLUIDOS[prueba.fluido] || prueba.fluido)}
    ${dato('Criterio', prueba.norma)}
    ${dato('Empresa instaladora', empresa || prueba.empresa)}
    ${dato('Manómetro', prueba.manometro)}
    ${dato('Hace la prueba', [emisor.nombre, emisor.rol].filter(Boolean).join(', '))}
  </dl>

  <section>
    <h2>Las lecturas</h2>
    <table class="tablaParte">
      <thead><tr><th>Presión de trabajo</th><th>Presión de prueba</th><th>Al empezar</th><th>Al acabar</th><th>Duración</th><th>Caída</th><th>Admisible</th><th>Fugas</th></tr></thead>
      <tbody><tr>
        <td class="num">${p(prueba.presionTrabajo)}</td>
        <td class="num">${p(prueba.presionPrueba)}</td>
        <td class="num">${p(prueba.presionInicial)}</td>
        <td class="num">${p(prueba.presionFinal)}</td>
        <td class="num">${esc(cifra(prueba.duracionMin))} min</td>
        <td class="num">${p(v.caida)}</td>
        <td class="num">${p(prueba.caidaAdmisible)}</td>
        <td>${prueba.fugas ? 'Sí' : 'No'}</td>
      </tr></tbody>
    </table>
    <p class="nota">Caída = presión al empezar − presión al acabar. La prueba se da por buena sin fugas visibles, habiendo llegado a la presión de prueba y con una caída que no pase de la admisible.</p>
  </section>

  ${llano(prueba.observaciones) ? `<section class="relato"><h2>Observaciones</h2><p>${esc(prueba.observaciones).replace(/\n/g, '<br>')}</p></section>` : ''}
  ${llano(prueba.notasJefe) ? `<section class="relato"><h2>Notas del jefe de obra</h2><p>${esc(prueba.notasJefe).replace(/\n/g, '<br>')}</p></section>` : ''}

  ${fotos.length ? `<section class="fotosParte"><h2>Fotos</h2><div class="rejilla">${fotos.map((f) => `<figure><img src="${esc(f.src)}" alt=""><figcaption>${esc(pie(f))}</figcaption></figure>`).join('')}</div></section>` : ''}

  <section class="firmas">
    <div><p>El encargado</p></div>
    <div><p>La empresa instaladora</p></div>
    <div><p>El jefe de obra</p></div>
  </section>
</article>`;
}

/* ═══════════════════════════════════════════ La lista y su resumen */

/* Mismo tramo = misma obra, misma instalación y el tramo escrito igual (sin mayúsculas ni espacios de más). */
const claveTramo = (f) => [f.obraId || '', f.instalacion || '', llano(f.tramo).toLowerCase().replace(/\s+/g, ' ')].join('|');
const momentoDe = (f) => `${f.fecha || ''}T${f.horaInicio || '00:00'}|${f.creadoEn || ''}|${f.codigo || ''}`;

/**
 * CADA PRUEBA CON SU SITUACIÓN: una no superada deja de estar pendiente en
 * cuanto el mismo tramo tiene después una prueba correcta (se reparó y se
 * repitió). `pendiente` es lo que todavía hay que hacer: las sin terminar y
 * las no superadas sin repetir.
 */
function situacion(filas = []) {
  const ultimaBuena = new Map();
  for (const f of filas) {
    if (f.resultado !== 'correcta') continue;
    const k = claveTramo(f);
    const m = momentoDe(f);
    if (!ultimaBuena.has(k) || ultimaBuena.get(k) < m) ultimaBuena.set(k, m);
  }
  return filas.map((f) => {
    const buena = ultimaBuena.get(claveTramo(f));
    const repetida = f.resultado === 'noSuperada' && Boolean(buena && buena > momentoDe(f));
    return { ...f, repetida, pendiente: f.resultado === 'sinTerminar' || (f.resultado === 'noSuperada' && !repetida) };
  });
}

/**
 * LOS NÚMEROS DE ARRIBA y los dos gráficos: cuántas superadas, no superadas
 * y sin terminar; las pendientes; las que el jefe de obra no ha abierto; las
 * que aún no tienen informe; y el reparto por instalación y por obra. Todas
 * las instalaciones salen siempre, aunque estén a cero.
 */
function resumen(filas = []) {
  const xs = situacion(filas);
  const cuenta = (fn) => xs.filter(fn).length;
  const reparto = (clave, nombres) => {
    const m = new Map(Object.entries(nombres).map(([k, nombre]) => [k, { id: k, nombre, total: 0, correcta: 0, noSuperada: 0, sinTerminar: 0, pendientes: 0 }]));
    for (const f of xs) {
      const k = f[clave] || '';
      if (!m.has(k)) m.set(k, { id: k, nombre: k || '(sin indicar)', total: 0, correcta: 0, noSuperada: 0, sinTerminar: 0, pendientes: 0 });
      const x = m.get(k);
      x.total += 1;
      if (x[f.resultado] !== undefined) x[f.resultado] += 1;
      if (f.pendiente) x.pendientes += 1;
    }
    return [...m.values()];
  };
  return {
    total: xs.length,
    correcta: cuenta((f) => f.resultado === 'correcta'),
    noSuperada: cuenta((f) => f.resultado === 'noSuperada'),
    sinTerminar: cuenta((f) => f.resultado === 'sinTerminar'),
    repetidas: cuenta((f) => f.repetida),
    pendientes: cuenta((f) => f.pendiente),
    sinVer: cuenta((f) => f.estado === 'nuevo'),
    sinInforme: cuenta((f) => !f.conPdf),
    porcentajeBuenas: xs.length ? Math.round((xs.filter((f) => f.resultado === 'correcta').length / xs.length) * 100) : null,
    porInstalacion: reparto('instalacion', Object.fromEntries(Object.entries(INSTALACIONES).map(([k, v]) => [k, v.nombre]))),
    porObra: reparto('obra', {}).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')),
    filas: xs,
  };
}

const ORDENES = {
  pendientes: { nombre: 'Pendientes primero' },
  nuevas: { nombre: 'Más nuevas' },
  antiguas: { nombre: 'Más antiguas' },
  obra: { nombre: 'Por obra' },
};

/** La lista en el orden pedido. Las filas tienen que venir de `situacion` para «pendientes». */
function ordenarPruebas(filas = [], criterio = 'pendientes') {
  const nuevas = (a, b) => momentoDe(b).localeCompare(momentoDe(a));
  const peso = (f) => (f.pendiente ? (f.resultado === 'noSuperada' ? 0 : 1) : f.estado === 'nuevo' ? 2 : 3);
  const por = {
    pendientes: (a, b) => peso(a) - peso(b) || nuevas(a, b),
    nuevas,
    antiguas: (a, b) => nuevas(b, a),
    obra: (a, b) => String(a.obra || '').localeCompare(String(b.obra || ''), 'es') || nuevas(a, b),
  }[criterio] || nuevas;
  return [...filas].sort(por);
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.ESTANQUEIDAD_MOTOR = API;
})({
  INSTALACIONES, FLUIDOS, UNIDADES, RESULTADOS, ESTADOS, MOMENTOS_FOTO,
  numero, presionSugerida, veredicto, validar, siguienteCodigo, nombreInforme, html, fechaEs, cifra,
  ORDENES, situacion, resumen, ordenarPruebas,
});

})();
