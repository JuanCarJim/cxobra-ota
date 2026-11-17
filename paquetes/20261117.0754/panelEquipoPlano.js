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
  const TITULO_FILA = { ft: 'Ficha técnica', ce: 'Marcado CE', checklist: 'Check list', manual: 'Manual de instrucciones', fichaPM: 'Puesta en marcha', estanqueidad: 'Estanqueidad', balanceo: 'Balanceo de caudales' };
  const ORDEN_BASE = ['ft', 'ce', 'checklist', 'manual', 'fichaPM', 'estanqueidad'];
  const CLASE_A_COLUMNA = { ft: 'ft', ce: 'ce', mi: 'manual', pm: 'fichaPM' };
  const TEXTO_VER = { pdf: 'Ver PDF', hoja: 'Ver PDF', foto: 'Ver foto' };

  /** Las filas de la tabla. `celdas` = { columnas, celdas } de celdasEntregaDF (el conjunto del equipo) o null; sin ellas, lo que sabe la ficha (fabricante). */
  function filasDocumentos(d = {}) {
    return conHojasDeLaApp(filasSinHojas(d), d.pesada && Array.isArray(d.pesada.tomas) ? d.pesada.tomas : []);
  }
  /* 15-nov (JC: «Check list —» con el checklist hecho en la app, 36/36): una fila sin PDF cuya hoja
     se rellenó en la app enlaza a ESA hoja («Ver hoja») con su estado, en vez de «—» o «falta». El PDF subido sigue mandando.
     Vale para check list, puesta en marcha (ficha de PM), estanqueidad y balanceo; `toma` es su índice en pesada.tomas. */
  const HOJAS_DE_FILA = { checklist: ['checklist'], fichaPM: ['fichaPM'], estanqueidad: ['estanqAgua', 'estanqRefrigerante'], balanceo: ['balanceo'] };
  const SIN_EMPEZAR = new Set(['sinFicha', 'sinEmpezar']);
  const PESO_TOMA = { firmada: 4, completa: 3, pendiente: 2 };
  const pesoToma = (t) => (t.firmada ? 4 : PESO_TOMA[t.estado] || (t.hoja && t.rellenos ? 2 : 0));
  function conHojasDeLaApp(filas, tomas) {
    if (!tomas.length) return filas;
    const mejor = (clases) => {
      let i = -1;
      tomas.forEach((t, j) => { if (t && clases.includes(t.clase) && (i < 0 || pesoToma(t) > pesoToma(tomas[i]))) i = j; });
      return i;
    };
    const salida = filas.map((f) => {
      const clases = HOJAS_DE_FILA[f.clave];
      if (!clases || f.estado === 'doc') return f;
      const i = mejor(clases);
      if (i < 0) return f;
      const t = tomas[i];
      const empezada = !SIN_EMPEZAR.has(t.estado) || pesoToma(t) > 0;
      /* Una hoja sin empezar no tapa un «falta»: solo sustituye al «—» (su tipo sí la pide). */
      if (!empezada && f.estado !== 'noAplica') return f;
      const queda = t.estado === 'pendiente' && Array.isArray(t.faltan) && t.faltan.length ? `falta ${t.faltan[0]}${t.faltan.length > 1 ? ` y ${t.faltan.length - 1} más` : ''}` : '';
      return { ...f, estado: 'hoja', toma: i, hecha: pesoToma(t) >= 3, empezada, hojaEstado: t.firmada ? 'Firmada' : (ESTADO_TOMA[t.estado] || (empezada ? 'A medias' : 'Sin empezar')), cuenta: [t.obligatorios ? `${t.rellenos} de ${t.obligatorios}${t.hoja ? ' bocas' : ''}` : '', queda].filter(Boolean).join(' · ') };
    });
    /* El balanceo no tiene columna en el índice: si su hoja existe en la app, sale como una fila más. */
    if (!salida.some((f) => f.clave === 'balanceo')) {
      const i = mejor(HOJAS_DE_FILA.balanceo);
      if (i >= 0 && pesoToma(tomas[i]) > 0) {
        const extra = conHojasDeLaApp([{ clave: 'balanceo', titulo: TITULO_FILA.balanceo, estado: 'noAplica', archivos: [], nota: '', motivo: '', porConfirmar: false }], tomas)[0];
        salida.push(extra);
      }
    }
    return salida;
  }
  function filasSinHojas(d) {
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
  const nombreCorto = (a) => String((a && a.nombre) || '').replace(/\.(pdf|html?|png|jpe?g)$/i, '');
  function filaDocHtml(f, i) {
    let celda;
    if (f.estado === 'doc' && f.archivos.length) {
      const a = f.archivos[0];
      const todos = f.archivos.map((x) => x.nombre).join(' · ');
      const texto = (f.porConfirmar ? 'Por confirmar' : TEXTO_VER[a.tipo] || 'Ver PDF');
      celda = `<button type="button" class="botonMini pesVerPdf" data-pes-ver-doc="${i}" title="${esc(`${f.titulo}: ${todos}`)}" aria-label="${esc(`Ver ${f.titulo}: ${a.nombre}`)}">${esc(texto)}</button>`;
    } else if (f.estado === 'hoja') {
      celda = `<button type="button" class="botonMini pesVerPdf" data-pes-toma="${esc(f.toma)}" title="${esc(`${f.titulo}: hoja rellenada en la app · ${f.hojaEstado}`)}" aria-label="${esc(`Ver la hoja de ${f.titulo}`)}">${f.empezada ? 'Ver hoja' : 'Abrir'}</button>`;
    } else if (f.estado === 'falta') celda = `<span class="pesDocFalta" title="${esc(f.motivo || 'aún no está')}">falta</span>`;
    else if (f.estado === 'pendSP') celda = `<span class="pesDocPend" title="${esc(`Está en SharePoint: ${f.motivo || 'falta descargarlo'}`)}">pend. desc.</span>`;
    else if (f.estado === 'pendFab') celda = `<span class="pesDocPend" title="${esc(`Pendiente del fabricante${f.motivo ? `: ${f.motivo}` : ''}`)}">pend. fab.</span>`;
    else celda = '<span class="pesVacio" title="No aplica a este tipo de equipo">—</span>';
    const pie = f.estado === 'hoja' ? `<small class="pesDocArchivo">Hoja de la app · <span class="pesTono ${f.hecha ? 'bien' : f.empezada ? 'info' : ''}">${esc(f.hojaEstado)}</span>${f.cuenta ? ` · ${esc(f.cuenta)}` : ''}</small>`
      : f.estado === 'doc' && f.archivos.length ? `<small class="pesDocArchivo" title="${esc(f.archivos.map((x) => x.nombre).join(' · '))}">${esc(nombreCorto(f.archivos[0]))}${f.archivos.length > 1 ? ` (+${f.archivos.length - 1})` : ''}${f.nota ? ` · ${esc(f.nota)}` : ''}</small>` : '';
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

  /* 15-nov (JC: «al pulsar un equipo del mapa en Cx tienen que salir sus hojas: check list, toma de datos de puesta en marcha,
     estanqueidad, balanceo…»): a qué pantalla lleva cada hoja en Vidaire Cx. La hoja de balanceo va a SU pantalla (bocas del
     plano); las demás, a su ficha exacta por plantilla y clave («hoja:plantilla|clave»); sin plantilla, a la pestaña que toca. */
  function accionToma(t) {
    if (!t) return null;
    if (t.clase === 'balanceo') return 'balanceo';
    if (t.plantilla && t.clave) return `hoja:${t.plantilla}|${t.clave}`;
    if (t.pestana === 'estanqueidad') return 'estanqueidad';
    if (t.clase === 'checklist') return 'checklist';
    return 'datos';
  }
  /** «hoja:plantilla|clave» → { plantilla, clave }; cualquier otra cosa → null. */
  function leerAccionHoja(a) {
    const m = /^hoja:([^|]+)\|(.+)$/.exec(String(a || ''));
    return m ? { plantilla: m[1], clave: m[2] } : null;
  }

  /* 15-nov (JC: «tiene checklist, tiene ficha de PM (toma de datos), balanceo de caudales…»): cada hoja con el nombre de su
     TIPO, siempre igual; el modelo de la plantilla («Ventilador-extractor») va debajo como detalle. */
  const TIPO_HOJA = { checklist: 'Checklist', fichaPM: 'Ficha de PM (toma de datos)', balanceo: 'Balanceo de caudales', estanqAgua: 'Estanqueidad', estanqRefrigerante: 'Estanqueidad', equilibrado: 'Equilibrado hidráulico' };
  const nombreHoja = (x) => (x && TIPO_HOJA[x.clase]) || (x && x.nombre) || 'Hoja';
  function detalleHoja(x) {
    if (!x || !TIPO_HOJA[x.clase] || !x.nombre) return '';
    const n = String(x.nombre).trim();
    const llano = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    /* Si el nombre solo repite el tipo («Checklist ventilador», «Hoja de balanceo»), se queda lo que añade. */
    const sobra = { checklist: /^check\s*-?\s*list( de instalacion)?\s*/, balanceo: /^(hoja de )?balanceo( de caudales)?\s*/, estanqAgua: /^(prueba de )?estanqueidad\s*/, estanqRefrigerante: /^(prueba de )?estanqueidad\s*/, fichaPM: /^(toma de datos|ficha de pm|puesta en marcha)( de puesta en marcha)?\s*/, equilibrado: /^equilibrado hidraulico\s*/ }[x.clase];
    const resto = n.slice(llano(n).match(sobra) ? llano(n).match(sobra)[0].length : 0).trim();
    return resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : '';
  }

  function tomasHtml(d) {
    const ts = d.pesada && Array.isArray(d.pesada.tomas) ? d.pesada.tomas : [];
    if (!ts.length) return '';
    const filas = ts.map((x, i) => {
      const estado = x.firmada ? tono('Firmada', 'bien') : tono(ESTADO_TOMA[x.estado] || 'Sin empezar', TONO_TOMA[x.estado] || null);
      const res = RESULTADO_BALANCEO[x.resultado];
      const cuenta = x.obligatorios ? `${x.rellenos} de ${x.obligatorios}${x.hoja ? ' bocas' : ''}` : '';
      const fotos = x.fotos ? `${cuenta ? ' · ' : ''}${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : '';
      const det = detalleHoja(x);
      /* «A medias» con «3 de 3» se contradice si no se dice qué le queda (15-nov): lo que le falta, debajo. */
      const queda = x.estado === 'pendiente' && Array.isArray(x.faltan) && x.faltan.length ? `<small>Falta: ${esc(x.faltan.join(', '))}</small>` : '';
      return `<tr><th>${esc(nombreHoja(x))}${x.unidadTag ? ` · ${esc(x.unidadTag)}` : ''}${det ? `<small>${esc(det)}</small>` : ''}</th><td>${estado}${res ? ` · ${tono(res[0], res[1])}` : ''}${cuenta || fotos ? `<small>${esc(cuenta)}${esc(fotos)}</small>` : ''}${queda}</td><td class="pesAccion">${d.abrirTomas ? `<button type="button" class="botonMini" data-pes-toma="${i}">Abrir</button>` : ''}</td></tr>`;
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
    return `<div class="pesIncEq" data-pes-incidencias role="group" aria-label="Incidencias abiertas de este equipo"><p class="pesIncEqTit"><span class="pesPunto incidencia" aria-hidden="true">!</span><b>${l.length === 1 ? '1 incidencia abierta' : `${l.length} incidencias abiertas`}</b></p>
      <table class="pesTablaFicha pesIncEqTabla"><tbody>${l.map((i) => `<tr><td><button type="button" class="pesIncEnlace" data-pes-incidencia="${esc(i.id)}" title="Abrir la incidencia ${esc(i.codigo)}">${esc(i.codigo || 'Incidencia')}</button></td><td>${esc(i.titulo || '')}${i.enUnidad ? `<span class="pesIncEqDonde">${esc(`En la ${i.enUnidad.exterior ? 'exterior' : 'interior'} ${i.enUnidad.tag || ''}`.trim())}</span>` : ''}</td><td class="pesIncEqEstado">${esc(i.estadoNombre || i.estado || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* 15-nov (JC): sin abiertas, las RESUELTAS (cerradas) que esperan la toma de datos, en azul (incidenciaPlano.js). */
  function resueltasHtml(d) {
    const l = (d.resueltas || []).filter(Boolean);
    if (!l.length) return '';
    const fecha = (t) => (t ? String(t).slice(0, 10).split('-').reverse().join('/') : '');
    return `<div class="pesIncEq resuelta" data-pes-resueltas role="group" aria-label="Incidencias resueltas a falta de la toma de datos"><p class="pesIncEqTit"><span class="pesPunto incResuelta" aria-hidden="true">!</span><b>${l.length === 1 ? 'Incidencia resuelta' : `${l.length} incidencias resueltas`}: falta tomar los datos</b></p>
      <table class="pesTablaFicha pesIncEqTabla"><tbody>${l.map((i) => `<tr><td><button type="button" class="pesIncEnlace" data-pes-incidencia="${esc(i.id)}" title="Abrir la incidencia ${esc(i.codigo)}">${esc(i.codigo || 'Incidencia')}</button></td><td>${esc(i.titulo || '')}${i.enUnidad ? `<span class="pesIncEqDonde">${esc(`En la ${i.enUnidad.exterior ? 'exterior' : 'interior'} ${i.enUnidad.tag || ''}`.trim())}</span>` : ''}</td><td class="pesIncEqEstado">${esc(i.cierre ? `Cerrada el ${fecha(i.cierre)}` : 'Cerrada')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* De arriba abajo: TAG, sus incidencias abiertas, estado de Cx y sala; sus botones; documentos y toma de datos con su botón; lo demás, plegado. */
  function html(d = {}) {
    const est = d.estado || {};
    const botones = (d.botones || []).filter(Boolean).map((b) => `<button type="button" class="botonMini" ${b.dato}>${esc(b.texto)}</button>`).join('');
    const identificacion = (d.identificacion || []).filter((f) => f && !(f[0] === 'Recinto' && !d.sinObra && f[1]));
    const estados = (d.estados || []).filter((f) => f && f[1] != null && f[1] !== '');
    return `<div class="pesPanelCab"><span class="pesPunto ${esc(est.clase || '')}" aria-hidden="true"></span><strong>${esc(d.codigo || 'Equipo')}</strong><button type="button" class="botonMini pesPanelCerrar" data-pes-panel-cerrar title="Cerrar y volver a la lista" aria-label="Cerrar el panel del equipo">×</button></div>
      ${incidenciasHtml(d)}
      ${resumenHtml(d)}
      ${botones ? `<div class="pesFichaPie pesAcciones">${botones}</div>` : ''}
      ${documentosHtml(d)}
      ${tomasHtml(d)}
      ${vidaHtml(d)}
      ${estados.length ? plegado('Estado', tabla(estados), estados.map((f) => `${f[0]}: ${f[1]}`).join(' · ')) : ''}
      ${identificacion.length ? plegado('Identificación', tabla(identificacion), identificacion.filter((f) => f[0] === 'Conjunto' || f[0] === 'Pedido' || f[0] === 'Familia').map((f) => f[1]).filter(Boolean).join(' · ')) : ''}
      ${plegado('Fabricante', tabla([['Marca', d.marca || VACIO, !d.marca], ['Modelo', d.modelo || VACIO, !d.modelo]]), [d.marca, d.modelo].filter(Boolean).join(' · ') || 'Sin datos')}
      ${d.red ? plegado('Su red', d.red, '', 'data-pes-sured') : ''}
      ${(d.notas || []).filter(Boolean).map((t) => `<p class="pesNota">${esc(t)}</p>`).join('')}`;
  }

  return { html, incidenciasHtml, documentosHtml, tomasHtml, accionToma, leerAccionHoja, documentosDe, filasDocumentos, rotuloConjunto, papelDe, abrirVisor, ESTADO_TOMA, TIPO_HOJA, nombreHoja, detalleHoja };
});
