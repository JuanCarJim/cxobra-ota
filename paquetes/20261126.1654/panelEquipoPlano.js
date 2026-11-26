/*
 * EL PANEL DEL EQUIPO EN EL PLANO (12-nov-2026, JC: «cuando se pulsa el equipo, tiene que salir la misma ventanita
 * a la derecha que salía antes con la información del equipo, con todos los manuales, fichas técnicas, todo eso
 * tiene que seguir apareciendo»).
 *
 * Una sola maqueta para el plano por edificio y estado: al pulsar un equipo, la columna de la derecha deja de ser
 * la lista y pasa a ser SU panel — identificación, fabricante, TODOS sus documentos con su enlace, la toma de datos
 * (check list, hoja de puesta en marcha, balanceo, estanqueidad), puesta en marcha / garantía / certificación y su
 * red. El plano no se tapa: el panel ocupa la columna (o una hoja inferior con poco ancho).
 *
 * 14-nov (JC: «esa ventana … es imprescindible»): lo esencial se ve SIN desplazar — arriba el TAG, el estado de Cx (con lo que
 * le falta) y la sala con número y nombre; luego sus botones, los documentos y la toma de datos, cada uno con su «Ver PDF» o
 * «Abrir»; garantía, estado, identificación, fabricante y red van plegados con su dato clave a la vista y se abren con un clic.
 *
 *   html(d)  → el HTML del panel. `d.pesada` es lo que se pide a demanda (planoEquipos.ficha): undefined mientras
 *              carga, null si no se ha podido leer, o { documentos, tomas, vida }.
 *   documentosDe(pesada) → los documentos que de verdad se pueden abrir (con dirección).
 *
 * No inventa nada: sin documentos lo dice; un equipo que solo está en el modelo no tiene papeles de la obra.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.PANEL_EQUIPO_PLANO = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const VACIO = '<span class="pesVacio">—</span>';
  const ESTADO_TOMA = { sinFicha: 'Sin empezar', sinEmpezar: 'Sin empezar', pendiente: 'A medias', completa: 'Completa', firmada: 'Firmada' };
  const TONO_TOMA = { pendiente: 'info', completa: 'bien', firmada: 'bien' };
  const RESULTADO_BALANCEO = { apto: ['Apto', 'bien'], aptoSinBocas: ['Apto sin bocas', 'bien'], noApto: ['No apto', 'mal'] };

  /** Solo lo que se puede abrir: un documento sin dirección no es un enlace. */
  const documentosDe = (pesada) => ((pesada && Array.isArray(pesada.documentos)) ? pesada.documentos : []).filter((x) => x && x.url && (x.nombre || x.etiqueta));
  const enlace = (x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" data-pes-doc>${x.etiqueta ? `${esc(x.etiqueta)}: ` : ''}${esc(x.nombre || x.etiqueta)} ↗</a>`;
  const tono = (texto, t) => (t ? `<span class="pesTono ${t}">${esc(texto)}</span>` : `<span class="pesVacio">${esc(texto)}</span>`);
  const tabla = (filas) => `<table class="pesTablaFicha"><tbody>${filas.filter((f) => f && f[1] != null && f[1] !== '').map(([k, v, crudo]) => `<tr><th>${esc(k)}</th><td>${crudo ? v : esc(v)}</td></tr>`).join('')}</tbody></table>`;
  const bloque = (titulo, cuerpo, extra = '') => `<section class="pesBloqueFicha" ${extra}><h4>${esc(titulo)}</h4>${cuerpo}</section>`;

  /* ── LOS DOCUMENTOS, EN TABLA (13-nov, JC: «una tabla limpia, una fila por clase de documento»). Una sola pieza para el panel del
        plano, la ficha y el móvil: las filas salen de las celdas del índice de la DF (paqueteDF.celdasDeConjunto, vía
        entregaPaqueteDF.celdasEntregaDF con `tag`), en SU orden y con las columnas que tenga configuradas la entrega. ── */
  const TITULO_FILA = { ft: 'Ficha técnica', ce: 'Marcado CE', checklist: 'Check list', manual: 'Manual de instrucciones', fichaPM: 'Puesta en marcha', estanqueidad: 'Estanqueidad' };
  const ORDEN_BASE = ['ft', 'ce', 'checklist', 'manual', 'fichaPM', 'estanqueidad'];
  const CLASE_A_COLUMNA = { ft: 'ft', ce: 'ce', mi: 'manual', pm: 'fichaPM' };
  const TEXTO_VER = { pdf: 'Ver PDF', hoja: 'Ver PDF', foto: 'Ver foto' };

  /** Las filas de la tabla. `celdas` = { columnas, celdas } de celdasEntregaDF (el conjunto del equipo) o null; sin ellas, lo que sabe la ficha (fabricante). */
  function filasDocumentos(d = {}) {
    const c = d.celdas && Array.isArray(d.celdas.celdas) ? d.celdas.celdas : null;
    if (c) return c.map((x) => ({ clave: x.clave, titulo: TITULO_FILA[x.clave] || x.titulo, estado: x.estado, archivos: x.archivos || [], nota: x.nota || '', motivo: x.motivo || '', porConfirmar: Boolean(x.porConfirmar) }));
    const docs = documentosDe(d.pesada);
    return ORDEN_BASE.map((k) => {
      const clase = Object.keys(CLASE_A_COLUMNA).find((q) => CLASE_A_COLUMNA[q] === k);
      const x = clase ? docs.find((y) => y.clase === clase) : null;
      if (x) return { clave: k, titulo: TITULO_FILA[k] || k, estado: 'doc', archivos: [{ ruta: x.url, url: x.url, nombre: x.nombre || x.etiqueta, tipo: 'pdf' }], nota: x.nivel === 'tipo' ? 'del tipo, no de este modelo' : '', motivo: '', porConfirmar: false };
      return { clave: k, titulo: TITULO_FILA[k] || k, estado: clase && k !== 'fichaPM' ? 'falta' : 'noAplica', archivos: [], nota: '', motivo: clase && k !== 'fichaPM' ? 'aún no está cargado' : '', porConfirmar: false };
    });
  }
  /* ── LOS PAPELES DEL EQUIPO EN LA FICHA DEL MÓVIL (20-nov-2026, JC: «aquí también tiene que estar la ficha técnica del equipo,
        marcado CE, manual de instrucciones, puesta en marcha del fabricante si la hay»). La misma fuente que el panel del plano
        (planoEquipos.documentosEquipo: del equipo o de su modelo; la puesta en marcha, solo del equipo) y los mismos títulos;
        un conjunto trae los de todas sus unidades (`unidadTag`). Cuatro filas fijas: lo que no está sale «falta», nunca se
        deduce. La hoja del fabricante también: sin ella el equipo no pasa a «En marcha» (control.js › hojaFabricantePM). ── */
  const PAPELES_MOVIL = ['ft', 'ce', 'manual', 'fichaPM'];
  function filasDocumentosEquipo(documentos) {
    const docs = (Array.isArray(documentos) ? documentos : []).filter((x) => x && x.clase && (x.url || x.enOrdenador));
    return PAPELES_MOVIL.map((k) => {
      const clase = k === 'fichaPM' ? 'pm' : Object.keys(CLASE_A_COLUMNA).find((q) => CLASE_A_COLUMNA[q] === k);
      const archivos = docs.filter((y) => y.clase === clase).map((y) => ({ nombre: y.nombre || y.etiqueta || TITULO_FILA[k], url: y.url || '',
        nivel: y.nivel || 'equipo', unidadTag: y.unidadTag || '', enOrdenador: Boolean(y.enOrdenador && !y.url) }));
      const titulo = k === 'manual' ? 'Manual de instrucciones' : k === 'fichaPM' ? 'Puesta en marcha del fabricante' : TITULO_FILA[k];
      return { clave: k, titulo, estado: archivos.length ? 'doc' : 'falta', archivos };
    });
  }
  const nombreCorto = (a) => String((a && a.nombre) || '').replace(/\.(pdf|html?|png|jpe?g)$/i, '');
  function filaDocHtml(f, i) {
    let celda;
    if (f.estado === 'doc' && f.archivos.length) {
      const a = f.archivos[0];
      const todos = f.archivos.map((x) => x.nombre).join(' · ');
      const texto = (f.porConfirmar ? 'Por confirmar' : TEXTO_VER[a.tipo] || 'Ver PDF');
      celda = `<button type="button" class="botonMini pesVerPdf" data-pes-ver-doc="${i}" title="${esc(`${f.titulo}: ${todos}`)}" aria-label="${esc(`Ver ${f.titulo}: ${a.nombre}`)}">${esc(texto)}</button>`;
    } else if (f.estado === 'falta') celda = `<span class="pesDocFalta" title="${esc(f.motivo || 'aún no está')}">falta</span>`;
    else if (f.estado === 'pendFab') celda = `<span class="pesDocPend" title="${esc(`Pendiente del fabricante${f.motivo ? `: ${f.motivo}` : ''}`)}">pend. fab.</span>`;
    else celda = '<span class="pesVacio" title="No aplica a este tipo de equipo">—</span>';
    const pie = f.estado === 'doc' && f.archivos.length ? `<small class="pesDocArchivo" title="${esc(f.archivos.map((x) => x.nombre).join(' · '))}">${esc(nombreCorto(f.archivos[0]))}${f.archivos.length > 1 ? ` (+${f.archivos.length - 1})` : ''}${f.nota ? ` · ${esc(f.nota)}` : ''}</small>` : '';
    return `<tr data-pes-doc-fila="${esc(f.clave)}"><th scope="row">${esc(f.titulo)}${pie}</th><td class="pesDocAccion">${celda}</td></tr>`;
  }
  function documentosHtml(d) {
    if (d.sinObra) return bloque('Documentos', '<span class="pesVacio">Sin ficha en la obra: no hay documentos que enseñar.</span>', 'data-pes-docs');
    if (d.celdasPendientes) return bloque('Documentos', '<span class="pesVacio">Cargando…</span>', 'data-pes-docs');
    if (d.pesada === undefined && !(d.celdas && d.celdas.celdas)) return bloque('Documentos', '<span class="pesVacio">Cargando…</span>', 'data-pes-docs');
    if (d.pesada === null && !(d.celdas && d.celdas.celdas)) return bloque('Documentos', '<span class="pesVacio">No se han podido leer los documentos.</span>', 'data-pes-docs');
    const filas = filasDocumentos(d);
    return bloque('Documentos', `<table class="pesDocs"><thead><tr><th>Documento</th><th class="pesDocAccion">Archivo</th></tr></thead><tbody>${filas.map(filaDocHtml).join('')}</tbody></table>`, 'data-pes-docs');
  }

  /** «Exterior X · Interiores UI 01, UI 02»: el conjunto con las palabras de siempre (UE = unidad exterior, UI = unidad interior). */
  function rotuloConjunto(c) {
    if (!c) return '';
    const ext = c.exterior || '';
    const corto = (t) => (ext && String(t).startsWith(`${ext} · `) ? String(t).slice(ext.length + 3) : String(t));
    const ins = (c.interiores || []).map(corto);
    const lista = `${ins.slice(0, 6).join(', ')}${ins.length > 6 ? ` y ${ins.length - 6} más` : ''}`;
    return [ext && `Unidad exterior ${ext}`, ins.length ? `${ins.length === 1 ? 'Unidad interior' : 'Unidades interiores'} ${lista}` : null].filter(Boolean).join(' · ');
  }
  /** Cómo se llama una unidad del conjunto: «UI» + «Unidad interior» (o «UE» + «Unidad exterior»). */
  const papelDe = (m) => (m && m.papel === 'UE' ? { sigla: 'UE', nombre: 'Unidad exterior' } : { sigla: 'UI', nombre: 'Unidad interior' });

  /** El documento que se abre en el visor de la app (renderer/visorDocModal.js): los del índice por su ruta (documentoEntregaDF) y, sin ellos, por su dirección. */
  function abrirVisor(fila, ctx = {}) {
    const V = ctx.visor || (typeof window !== 'undefined' ? window.VISOR_DOC : null);
    if (!V || !fila || !fila.archivos || !fila.archivos.length) return null;
    const docs = fila.archivos.map((a) => ({ nombre: a.nombre, ruta: a.ruta, url: a.url || '' }));
    return V.abrir({ titulo: fila.titulo, subtitulo: ctx.subtitulo || '', docs, indice: 0,
      cargar: async (x) => {
        if (x.url) {
          try { const r = await fetch(x.url); if (!r.ok) throw new Error(`error ${r.status}`); return { ok: true, nombre: x.nombre, tipo: /\.html?$/i.test(x.nombre) ? 'hoja' : 'pdf', datos: new Uint8Array(await r.arrayBuffer()) }; } catch (e) { return { ok: false, error: `No se ha podido abrir el documento: ${e.message}` }; }
        }
        const P = ctx.puente;
        if (!P || !P.documentoEntregaDF) return { ok: false, error: 'No se ha podido abrir el documento.' };
        const r = await P.documentoEntregaDF(ctx.obraId, x.ruta, { enModal: true }).catch((e) => ({ ok: false, error: e.message }));
        return r && r.ok && r.datos ? { ok: true, nombre: r.nombre, tipo: r.tipo, datos: r.datos } : { ok: false, error: (r && r.error) || 'No se ha podido abrir el documento.' };
      } });
  }

  function tomasHtml(d) {
    const ts = d.pesada && Array.isArray(d.pesada.tomas) ? d.pesada.tomas : [];
    if (!ts.length) return '';
    const filas = ts.map((x, i) => {
      const estado = x.firmada ? tono('Firmada', 'bien') : tono(ESTADO_TOMA[x.estado] || 'Sin empezar', TONO_TOMA[x.estado] || null);
      const res = RESULTADO_BALANCEO[x.resultado];
      const cuenta = x.obligatorios ? `${x.rellenos} de ${x.obligatorios}${x.hoja ? ' bocas' : ''}` : '';
      const fotos = x.fotos ? `${cuenta ? ' · ' : ''}${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : '';
      return `<tr><th>${esc(x.nombre)}${x.unidadTag ? ` · ${esc(x.unidadTag)}` : ''}</th><td>${estado}${res ? ` · ${tono(res[0], res[1])}` : ''}${cuenta || fotos ? `<small>${esc(cuenta)}${esc(fotos)}</small>` : ''}</td><td class="pesAccion">${d.abrirTomas ? `<button type="button" class="botonMini" data-pes-toma="${i}">Abrir</button>` : ''}</td></tr>`;
    }).join('');
    return bloque('Toma de datos', `<table class="pesTablaFicha conAccion"><tbody>${filas}</tbody></table>`, 'data-pes-tomas');
  }
  /* LO QUE NO ES DE UN VISTAZO, PLEGADO (14-nov, JC: «se corta por abajo; Estado y Garantía solo con scroll»): el título y su
     dato clave en un renglón, y un clic lo despliega. Nada se pierde: es el mismo contenido de antes. */
  const plegado = (titulo, cuerpo, dato = '', extra = '') => `<details class="pesBloqueFicha pesPlegado" ${extra}><summary><h4>${esc(titulo)}</h4>${dato ? `<span class="pesPlegadoDato">${esc(dato)}</span>` : ''}</summary>${cuerpo}</details>`;
  function vidaHtml(d) {
    const celda = (c) => (!c || !c.texto ? VACIO : c.tono === 'gris' ? `<span class="pesVacio">${esc(c.texto)}</span>` : c.tono ? `<span class="pesTono ${esc(c.tono)}">${esc(c.texto)}</span>` : esc(c.texto));
    const bs = (d.pesada && d.pesada.vida && d.pesada.vida.bloques) || [];
    return bs.map((b) => {
      const clave = (b.filas || []).find(([, c]) => c && c.texto);
      return plegado(b.titulo, `<table class="pesTablaFicha"><tbody>${(b.filas || []).map(([k, c]) => `<tr><th>${esc(k)}</th><td>${celda(c)}</td></tr>`).join('')}</tbody></table>`, clave ? `${clave[0]}: ${clave[1].texto}` : 'Sin datos', `data-pes-vida="${esc(b.id)}"`);
    }).join('');
  }

  /* El resumen: estado de Cx (con lo que le falta, para que «Certificado» no se contradiga con un «falta» más abajo), sala con
     número y nombre, y qué equipo es. */
  function resumenHtml(d) {
    const est = d.estado || {}, faltan = (est.faltan || []).filter(Boolean);
    /* El TAG ya va arriba: del «UTA-01 · TROX · TKM 50» de la ficha aquí queda marca y modelo. */
    const tipo = d.tipo && d.codigo && String(d.tipo).startsWith(`${d.codigo} · `) ? String(d.tipo).slice(String(d.codigo).length + 3) : d.tipo || '';
    const sala = d.sala || ((d.identificacion || []).find((f) => f && f[0] === 'Recinto') || [])[1] || '';
    const estado = `<span class="pesEstadoCx"><span class="pesPunto ${esc(est.clase || '')}" aria-hidden="true"></span><b>${esc(est.nombre || '—')}</b></span>`
      + (faltan.length ? `<small class="pesFaltan">${faltan.length === 1 ? 'Falta el documento' : 'Faltan documentos'}: ${esc(faltan.join(', '))}</small>` : '')
      + (est.aclaracion ? `<small>${esc(est.aclaracion)}</small>` : '');
    return `<table class="pesTablaFicha pesResumenEq" data-pes-resumen><tbody><tr><th>Estado de Cx</th><td>${estado}</td></tr><tr><th>Sala</th><td>${sala ? `<b>${esc(sala)}</b>` : VACIO}</td></tr>${tipo ? `<tr><th>Equipo</th><td>${esc(tipo)}</td></tr>` : ''}</tbody></table>`;
  }

  /* 14-nov (JC: «si hay algún equipo con incidencia deberá verse en otro color»): arriba del panel, sus incidencias sin
     cerrar, cada una con su enlace (shared/commissioning/incidenciaPlano.js). Sin incidencias no pinta nada. */
  function incidenciasHtml(d) {
    const l = (d.incidencias || []).filter(Boolean);
    if (!l.length) return resueltasHtml(d);
    /* 18-nov (JC): si todas las abiertas son de terceros, el recuadro va en morado y lo dice. */
    const ter = l.every((i) => i.terceros);
    return `<div class="pesIncEq${ter ? ' terceros' : ''}" data-pes-incidencias role="group" aria-label="Incidencias abiertas de este equipo"><p class="pesIncEqTit"><span class="pesPunto ${ter ? 'incTerceros' : 'incidencia'}" aria-hidden="true">!</span><b>${l.length === 1 ? '1 incidencia abierta' : `${l.length} incidencias abiertas`}${ter ? ' de terceros' : ''}</b></p>
      <table class="pesTablaFicha pesIncEqTabla"><tbody>${l.map((i) => `<tr><td><button type="button" class="pesIncEnlace" data-pes-incidencia="${esc(i.id)}" title="Abrir la incidencia ${esc(i.codigo)}">${esc(i.codigo || 'Incidencia')}</button></td><td>${esc(i.titulo || '')}${i.enUnidad ? `<span class="pesIncEqDonde">${esc(`En la ${i.enUnidad.exterior ? 'exterior' : 'interior'} ${i.enUnidad.tag || ''}`.trim())}</span>` : ''}</td><td class="pesIncEqEstado">${esc(i.estadoNombre || i.estado || '')}${i.terceros ? `<span class="pesIncEqDonde">${esc(i.empresa ? `De terceros: ${i.empresa}` : 'De terceros')}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* 15-nov (JC): sin abiertas, las RESUELTAS (cerradas) que esperan la toma de datos, en azul (incidenciaPlano.js). */
  function resueltasHtml(d) {
    const l = (d.resueltas || []).filter(Boolean);
    if (!l.length) return '';
    const fecha = (t) => (t ? String(t).slice(0, 10).split('-').reverse().join('/') : '');
    return `<div class="pesIncEq resuelta" data-pes-resueltas role="group" aria-label="Incidencias resueltas a falta de la toma de datos"><p class="pesIncEqTit"><span class="pesPunto incResuelta" aria-hidden="true">!</span><b>${l.length === 1 ? 'Incidencia resuelta' : `${l.length} incidencias resueltas`}: falta tomar los datos</b></p>
      <table class="pesTablaFicha pesIncEqTabla"><tbody>${l.map((i) => `<tr><td><button type="button" class="pesIncEnlace" data-pes-incidencia="${esc(i.id)}" title="Abrir la incidencia ${esc(i.codigo)}">${esc(i.codigo || 'Incidencia')}</button></td><td>${esc(i.titulo || '')}${i.enUnidad ? `<span class="pesIncEqDonde">${esc(`En la ${i.enUnidad.exterior ? 'exterior' : 'interior'} ${i.enUnidad.tag || ''}`.trim())}</span>` : ''}</td><td class="pesIncEqEstado">${esc(`${i.estado === 'terminada' ? 'Terminada' : 'Cerrada'}${i.cierre ? ` el ${fecha(i.cierre)}` : ''}`)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ── EL CONJUNTO AL PULSAR (18-nov, JC: «al pulsar en un equipo de un conjunto, lo que se tiene que mostrar en cualquier app
        es el conjunto»; port del Gestor ada6ac1). Una sola pieza para el panel del plano (web y escritorio) y la hoja del móvil:
        el nombre del conjunto y sus unidades, cada una con su enlace para abrirla por separado. Un equipo suelto no cambia. ── */
  /** El nombre del conjunto, como el libro de Cx: «UE / UI» en un split; el de la exterior en un VRF. */
  function nombreConjunto(unidades = []) {
    const us = unidades.filter((u) => u && u.tag);
    if (us.length < 2) return '';
    const ext = us.find((u) => u.papel === 'UE') || us[0];
    return us.length === 2 ? [ext, ...us.filter((u) => u !== ext)].map((u) => u.tag).join(' / ') : ext.tag;
  }
  /**
   * e = { id, conjunto?: nombre, miembros: [{ id, tag, papel, aqui?, enPlano?, planta? }] } → null si no forma conjunto, o
   * { nombre, unidades: [{ id, tag, sigla, nombre, actual, donde }] } con la exterior primero.
   */
  function conjuntoAlPulsar(e = {}) {
    const ms = (Array.isArray(e.miembros) ? e.miembros : []).filter((m) => m && m.id && m.tag);
    if (ms.length < 2 || !ms.some((m) => m.id === e.id)) return null;
    const orden = [...ms].sort((a, b) => (a.papel === 'UE' ? 0 : 1) - (b.papel === 'UE' ? 0 : 1));
    const donde = (m) => (m.id === e.id ? '' : m.aqui ? 'en este plano' : m.enPlano ? `en ${m.planta || 'otra planta'}` : m.enPlano === false ? 'sin colocar' : '');
    return { nombre: e.conjunto || nombreConjunto(orden), unidades: orden.map((m) => ({ id: m.id, tag: m.tag, ...((p) => ({ sigla: p.sigla, nombre: p.nombre }))(papelDe(m)), actual: m.id === e.id, donde: donde(m) })) };
  }
  /** El bloque del conjunto. `atributo`: el data- del enlace de cada unidad (la web usa data-pes-unidad; el móvil, data-pe-ver). */
  function conjuntoHtml(c, { atributo = 'data-pes-unidad' } = {}) {
    if (!c) return '';
    const filas = c.unidades.map((u) => `<tr${u.actual ? ' class="actual" aria-current="true"' : ''}><td class="pesCjSigla">${esc(u.sigla)}</td><td><b>${esc(u.tag)}</b><small>${esc(u.nombre)}${u.donde ? ` · ${esc(u.donde)}` : ''}</small></td><td class="pesAccion">${u.actual ? '<span class="pesVacio">Esta</span>' : `<button type="button" class="botonMini" ${atributo}="${esc(u.id)}" title="Abrir ${esc(u.tag)}">Abrir</button>`}</td></tr>`).join('');
    return `<section class="pesConjunto" data-pes-conjunto role="group" aria-label="Conjunto ${esc(c.nombre)}"><p class="pesConjuntoTit">Conjunto <b>${esc(c.nombre)}</b> · ${c.unidades.length} unidades</p><table class="pesTablaFicha conAccion"><tbody>${filas}</tbody></table><small class="pesConjuntoNota">Hojas de Cx, estanqueidad e incidencias: las del conjunto.</small></section>`;
  }

  /* De arriba abajo: TAG, sus incidencias abiertas (15-nov, primero), su conjunto, estado de Cx y sala; sus botones; documentos y toma de datos con su botón; lo demás, plegado. */
  /* ── LOS VALORES DE PROYECTO (25-nov-2026, JC: «para cada equipo sus valores de proyecto»). Plegado, como el fabricante: los
        de la tabla de parámetros de sus tomas (planoEquipos.js › tomasDelEquipo › proyecto), cada uno con su fuente al pasar.
        Sin ninguno, lo dice: no se inventa nada (valoresProyecto.js). La suma de rejas a la que le faltan rejas sale
        marcada «(parcial)» (25-nov tarde). ── */
  const numPes = (n) => (typeof n === 'number' ? n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : String(n));
  function proyectoHtml(d) {
    const ts = d.pesada && Array.isArray(d.pesada.tomas) ? d.pesada.tomas : null;
    if (!ts) return '';
    const vistos = new Set();
    const filas = [];
    for (const t of ts) for (const v of (t && t.proyecto) || []) {
      const k = `${v.etiqueta}|${v.unidad}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      filas.push(v);
    }
    const cuerpo = filas.length
      ? `<table class="pesTablaFicha"><tbody>${filas.map((v) => `<tr title="${esc(v.fuente || '')}"><th>${esc(v.etiqueta)}</th><td>${esc(`${numPes(v.valor)}${v.unidad ? ` ${v.unidad}` : ''}`)}${v.parcial ? ' <span class="pesNota">(parcial)</span>' : ''}</td></tr>`).join('')}</tbody></table>`
      : `<p class="pesNota">${VACIO} Sin valores de proyecto en la obra para este equipo.</p>`;
    const dato = filas.length ? filas.slice(0, 2).map((v) => `${numPes(v.valor)}${v.unidad ? ` ${v.unidad}` : ''}`).join(' · ') : 'Sin datos';
    return plegado('Valores de proyecto', cuerpo, dato, 'data-pes-proyecto');
  }

  function html(d = {}) {
    const est = d.estado || {};
    const botones = (d.botones || []).filter(Boolean).map((b) => `<button type="button" class="botonMini" ${b.dato}>${esc(b.texto)}</button>`).join('');
    const identificacion = (d.identificacion || []).filter((f) => f && !(f[0] === 'Recinto' && !d.sinObra && f[1]));
    const estados = (d.estados || []).filter((f) => f && f[1] != null && f[1] !== '');
    return `<div class="pesPanelCab"><span class="pesPunto ${esc(est.clase || '')}" aria-hidden="true"></span><strong>${esc(d.codigo || 'Equipo')}</strong><button type="button" class="botonMini pesPanelCerrar" data-pes-panel-cerrar title="Cerrar y volver a la lista" aria-label="Cerrar el panel del equipo">×</button></div>
      ${incidenciasHtml(d)}
      ${conjuntoHtml(d.conjunto)}
      ${resumenHtml(d)}
      ${botones ? `<div class="pesFichaPie pesAcciones">${botones}</div>` : ''}
      ${documentosHtml(d)}
      ${tomasHtml(d)}
      ${proyectoHtml(d)}
      ${vidaHtml(d)}
      ${estados.length ? plegado('Estado', tabla(estados), estados.map((f) => `${f[0]}: ${f[1]}`).join(' · ')) : ''}
      ${identificacion.length ? plegado('Identificación', tabla(identificacion), identificacion.filter((f) => f[0] === 'Conjunto' || f[0] === 'Pedido' || f[0] === 'Familia').map((f) => f[1]).filter(Boolean).join(' · ')) : ''}
      ${plegado('Fabricante', tabla([['Marca', d.marca || VACIO, !d.marca], ['Modelo', d.modelo || VACIO, !d.modelo]]), [d.marca, d.modelo].filter(Boolean).join(' · ') || 'Sin datos')}
      ${d.red ? plegado('Su red', d.red, '', 'data-pes-sured') : ''}
      ${(d.notas || []).filter(Boolean).map((t) => `<p class="pesNota">${esc(t)}</p>`).join('')}`;
  }

  return { html, proyectoHtml, conjuntoAlPulsar, conjuntoHtml, nombreConjunto, incidenciasHtml, documentosHtml, documentosDe, filasDocumentos, filasDocumentosEquipo, rotuloConjunto, papelDe, abrirVisor, ESTADO_TOMA };
});
