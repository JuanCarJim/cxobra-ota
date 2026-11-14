'use strict';
/*
 * 🧭 HABLAR CON IARVIS (7-nov-2026, JC: «una buena forma de hablar con Iarvis, desde el
 * móvil, desde la web y desde la app de escritorio, en todas las apps de Vidaire»).
 *
 * UN SOLO COMPONENTE para todas: en el escritorio y la web, un botón pequeño abajo a la
 * derecha que abre un panel lateral; en el móvil, el mismo panel dentro de su pestaña.
 * Historial de cada persona, «útil / no útil» en cada respuesta (de ahí aprende Iarvis),
 * enlaces a las pantallas ([[pantalla:id]]) y adjuntos de cualquier tipo.
 *
 * No habla con ninguna nube ni modelo: usa un ADAPTADOR con
 *   preguntar(datos) · historial() · valorar(id, v) · estado(id) · adjuntar(nombre, bytes, tipo)
 * En el escritorio y la web es window.puente (electron/ipc/canalesIarvis.js); en el móvil
 * lo arma cxobra con shared/ia/conversaciones.js. Nada de esto lanza errores a la vista:
 * sin motor, el chat dice «Iarvis no está configurado todavía»; sin red, que contestará luego.
 *
 *   IARVIS.instalar({ ir, contexto })                       escritorio y web (app.js)
 *   IARVIS.montarEn(elemento, { adaptador, ir, contexto, movil: true })   móvil
 *     contexto() → { pantalla, obraId, obraNombre, mirando }
 *
 * Adjuntos: se detecta el tipo por el contenido (shared/ia/adjuntos.js), se sube al cubo y
 * Iarvis propone adónde va. NADA entra en la app sin pulsar «Confirmar», y entonces se abre la
 * pantalla con su importador de siempre (con sus validaciones y el alcance del rol).
 */
(function () {
  const ESPERA_SONDEO = 8000;
  const SONDEOS = 15;
  /* 8-nov (JC): la conversación se borra sola tras 2 horas sin actividad: al abrir el chat pasado
     ese tiempo, empieza vacía. Lo anterior sigue en la nube (para que Iarvis aprenda), no se enseña. */
  const CHARLA = 'vidaire.iarvis.charla';
  const CADUCA_MS = 2 * 60 * 60 * 1000;
  const NOMBRES_PANTALLA = {
    presupuestos: 'Presupuestos', costsPlan: 'Costs Plan', presupuestoObra: 'Presupuesto de obra', medObra: 'Medición real de obra', certificaciones: 'Certificaciones',
    compras: 'Compras', comparativos: 'Comparativos', gantt: 'Gantt', commissioning: 'Commissioning', documentacion: 'Documentación',
    balanceo: 'Balanceo', reclamaciones: 'Reclamaciones', incidencias: 'Incidencias', partes: 'Partes', actas: 'Actas', tareas: 'Tareas',
    pedidos: 'Pedidos', documentacionProyecto: 'Documentos del proyecto', planosObra: 'Planos y modelo IFC', facturasProveedor: 'Facturas',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I = { panel: null, boton: null, lista: null, adaptador: null, ir: null, contexto: () => ({}), movil: false, ficheros: [], locales: [], filas: [], ocupado: false, deEstaVez: new Set(), idsEstaVez: new Set(), verAnteriores: false, pdfs: {}, ultima: 0, volver: null };

  function leerCharla() {
    try {
      const c = JSON.parse(localStorage.getItem(CHARLA) || 'null');
      if (c && Number(c.ultima) && Date.now() - Number(c.ultima) < CADUCA_MS) return c;
    } catch { /* sin almacenamiento */ }
    return null;
  }
  function guardarCharla() {
    try { localStorage.setItem(CHARLA, JSON.stringify({ ultima: I.ultima, ids: [...I.idsEstaVez].slice(-60) })); } catch { /* sin almacenamiento */ }
  }
  /** Hay actividad: la conversación sigue viva 2 horas más. */
  function actividad() { I.ultima = Date.now(); guardarCharla(); }
  /** Al abrir: pasadas 2 horas sin actividad, conversación vacía. */
  function caducar() {
    if (I.ultima && Date.now() - I.ultima < CADUCA_MS) return;
    const c = leerCharla();
    I.deEstaVez = new Set();
    I.idsEstaVez = new Set(c && Array.isArray(c.ids) ? c.ids : []);
    I.ultima = c ? Number(c.ultima) : 0;
  }
  /** Para las pruebas: el estado de la conversación de esta vez. */
  const _charla = { leerCharla, caducar, actividad, CADUCA_MS, pintarPropuestas: (f) => pintarPropuestas(f), tarjetaArchivo: (a, id, o) => tarjetaArchivo(a, id, o), iconoDe: (a) => iconoDe(a), pintarAcciones: (f) => pintarAcciones(f), formato: (t) => formato(t), pintarRespuesta: (f) => pintarRespuesta(f) };

  function adaptadorDelPuente() {
    const p = window.puente;
    if (!p || !p.iarvisPreguntar) return null;
    return {
      preguntar: (d) => p.iarvisPreguntar(d), historial: () => p.iarvisHistorial(), valorar: (id, v) => p.iarvisValorar(id, v),
      estado: (id) => p.iarvisEstado(id), adjuntar: (n, b, t) => p.iarvisAdjuntar(n, b, t),
      /* 8-nov: el botón «hacer» (guardar la respuesta del claim) también en el escritorio. */
      hacer: p.iarvisHacer ? (a) => p.iarvisHacer(a) : undefined,
      /* 11-nov: «Empezar de cero» también para la memoria de Iarvis (shared/ia/charla.js). */
      nueva: p.iarvisNueva ? () => p.iarvisNueva() : undefined,
    };
  }

  function trozos(texto) {
    const C = window.IarvisConversaciones;
    return C ? C.trozos(texto) : [{ texto }];
  }

  /*
   * 8-nov (JC): «**negrita**» y listas «- » como texto con formato, no con asteriscos.
   * 12-nov (JC: «el aspecto del chat de Iarvis se puede mejorar»): markdown pequeño y seguro —todo pasa
   * por esc() antes—: párrafos, **negrita**, `código`, títulos «### », listas «- » y «1. », y tablas
   * pequeñas «| a | b |» con su fila «|---|». Las cifras de una tabla van a la derecha y en cifra tabular.
   */
  const RE_VINETA = /^\s*[-•*·]\s+/;
  const RE_NUMERO = /^\s*\d{1,2}[.)]\s+/;
  const RE_FILA = /^\s*\|.*\|\s*$/;
  const RE_SEPARA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const enLinea = (t) => esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const celdas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const esCifra = (c) => /^[-+]?[\d.,\s]+\s*(€|%|m2|m²|ud|uds|h)?$/i.test(c.replace(/\*\*/g, '')) && /\d/.test(c);
  function tabla(lineas) {
    const cab = celdas(lineas[0]);
    const filas = lineas.slice(2).map(celdas);
    const num = cab.map((_, i) => filas.length > 0 && filas.every((f) => !f[i] || esCifra(f[i])));
    const th = cab.map((c, i) => `<th${num[i] ? ' class="iaNum"' : ''}>${enLinea(c)}</th>`).join('');
    const tr = filas.map((f) => `<tr>${cab.map((_, i) => `<td${num[i] ? ' class="iaNum"' : ''}>${enLinea(f[i] || '')}</td>`).join('')}</tr>`).join('');
    return `<div class="iaTablaCaja"><table class="iaTabla"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  /*
   * 12-nov (JC: «que la respuesta sea formato moderno, minimalista y excepcionalmente atractivo»):
   * LO QUE IARVIS YA ESCRIBE, PINTADO PARA LEERSE DE UN VISTAZO.
   *   - Los importes dentro de una frase («30,00 €/m²») en cifra tabular y un poco más firmes.
   *   - Un punto de lista con forma de ELEMENTO —«código «nombre» (ud) — coste … · venta …», «**INC-012** · FC-03 ·
   *     título — Abierta, 4 d», «Nombre: venta 1.200,00 €, coste 900,00 €»— se pinta como una fila limpia: el código en
   *     monoespaciada pequeña, el nombre destacado, las cifras grandes y tabulares («sin dato» atenuado) y lo demás
   *     (la ruta «›», la fase, el origen) en una línea tenue truncada con el texto entero en title.
   *   - Solo si TODOS los puntos de la lista encajan; si no, la lista de siempre. Nunca se pierde texto: cada trozo
   *     de la línea va a algún sitio, y todo pasa por esc().
   */
  const RE_IMPORTE_TXT = /(^|[\s(>«:])([-−+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s?€(?:\/[^\s,;:)<.]+)?)/g;
  /*
   * 14-nov (JC: «mejorar la presentación del chat de Iarvis»): los códigos sueltos en prosa (salas, TAG, avisos
   * N00/N10, P-14, UTA-12, INC-012) van en chips de monoespaciada, no mezclados con la frase. Solo lo que es
   * letras en mayúscula + número; no toca lo que ya va en <code> ni dentro de una etiqueta.
   */
  const RE_CODIGO_TXT = /(^|[\s(«,;:])((?:[A-Z]{1,4}-\d{1,4}(?:-\d{1,4})*|[A-Z]{1,3}\d{2,4}|[A-Z]{2,5}-[A-Z]{1,3}\d{1,3})[a-z]?)(?=$|[\s).,;:»])/g;
  function chipear(html) {
    let dentroCode = false;
    return html.split(/(<[^>]+>)/).map((trozo) => {
      if (trozo[0] === '<') { if (/^<code\b/.test(trozo)) dentroCode = true; else if (/^<\/code>/.test(trozo)) dentroCode = false; return trozo; }
      return dentroCode ? trozo : trozo.replace(RE_CODIGO_TXT, '$1<code class="iaChip">$2</code>');
    }).join('');
  }
  const enTexto = (t) => chipear(enLinea(t).replace(RE_IMPORTE_TXT, '$1<span class="iaImporte">$2</span>'));
  const RE_HAY_CIFRA = /\d\s?€|\bsin dato\b/;
  const RE_AVISO = /\b(vencid[ao]s?|retrasad[ao]s?|bloquead[ao]s?|sin dato|falta\w*)\b/i;
  const sinAst = (t) => String(t).replace(/\*\*/g, '');
  const esCodigo = (c) => c.length >= 3 && c.length <= 32 && /\d/.test(c) && /[A-Za-z.\-/_]/.test(c) && !/€|,\d/.test(c);
  /** Un trozo de cifra: «coste 30,00 €/m²» → etiqueta · valor · unidad; si no es una cifra, el texto tal cual. */
  function cifra(seg) {
    const m = sinAst(seg).trim().match(/^(\D*?)\s*([-−+]?\d[\d.]*(?:,\d+)?\s?(?:€|%)|sin dato)(\/\S+)?$/);
    if (!m) return `<span class="iaCifra iaCifraTxt">${enLinea(seg)}</span>`;
    return `<span class="iaCifra${m[2] === 'sin dato' ? ' iaSinDato' : ''}">${m[1] ? `<span class="iaCifraEt">${esc(m[1].trim())}</span>` : ''}<span class="iaCifraVal">${esc(m[2])}</span>${m[3] ? `<span class="iaCifraUd">${esc(m[3])}</span>` : ''}</span>`;
  }
  const trocear = (t) => String(t).split(/\s+·\s+|,\s+/).map((x) => x.trim()).filter(Boolean);
  /** Un punto de lista como elemento, o null si no tiene esa forma. */
  function elemento(x) {
    const [l0, ...resto] = x.lineas;
    let m = l0.match(/^(.*?\S)\s+[—–]\s+(.+)$/);
    if (!m) { m = l0.match(/^([^:]{2,80}?):\s+(.+)$/); if (!m || !RE_HAY_CIFRA.test(m[2])) return null; }
    const [, cabeza, derecha] = m;
    const conCifras = RE_HAY_CIFRA.test(derecha);
    const e = { n: x.n, codigo: '', tags: [], nombre: '', cifras: [], estado: [], totales: [], metas: [] };
    let r = cabeza.trim();
    const c = r.match(/^\*\*([^*]{1,32})\*\*(?=\s|$)/) || r.match(/^([A-Za-z0-9][\w.\-/]{1,31})(?=\s|$)/);
    if (c && esCodigo(c[1])) { e.codigo = c[1]; r = r.slice(c[0].length).replace(/^\s*·\s*/, '').trim(); }
    const q = r.match(/^(.*?)«([^»]+)»\s*(?:\(([^)]{1,12})\))?\s*(.*)$/);
    if (q) {
      e.tags = trocear(q[1]);
      e.nombre = q[2];
      if (q[3]) e.tags.push(q[3]);
      if (q[4]) e.tags.push(q[4]);
    } else if (r) {
      const p = r.split(/\s+·\s+/);
      e.nombre = p.pop();
      e.tags = p;
    }
    if (!e.nombre && !e.codigo) return null;
    /* Las cifras con € (o «sin dato») van en grande; lo demás de la derecha («12 partes», «96 h»), arriba en tenue. */
    if (conCifras) for (const s of trocear(derecha)) (RE_HAY_CIFRA.test(s) ? e.cifras : e.tags).push(s);
    else if (e.codigo && derecha.length <= 48) e.estado = trocear(derecha);
    else return null;
    for (const l of resto) {
      const t = l.match(/^(.*?)\s*→\s*(.+)$/);
      if (t && RE_HAY_CIFRA.test(t[2])) e.totales.push({ et: t[1], cifras: trocear(t[2]) });
      else e.metas.push(l);
    }
    return e;
  }
  /** Lo de debajo: una ruta «a › b › c» en una línea tenue (lo último, siempre a la vista); otra cosa, como nota. */
  function metaDe(l) {
    const k = l.lastIndexOf('›');
    if (k < 0) return `<div class="iaElNota">${enTexto(l)}</div>`;
    const ini = l.slice(0, k).trim();
    const fin = l.slice(k + 1).trim();
    return `<div class="iaElMeta" title="${esc(sinAst(l))}"><span class="iaElMetaIni">${enLinea(ini)}</span><span class="iaElMetaFin">› ${enLinea(fin)}</span></div>`;
  }
  const ini = (n) => (n ? ` start="${n + 1}"` : '');
  function listaElementos(els, tag, elegida, desde = 0) {
    const fila = (e) => {
      const marcada = tag === 'ol' && elegida && e.n === elegida;
      const cab = [
        e.n ? `<span class="iaElN">${esc(e.n)}</span>` : '',
        e.codigo ? `<code class="iaElCod">${esc(e.codigo)}</code>` : '',
        ...e.tags.map((t) => `<span class="iaElTag">${enLinea(t)}</span>`),
        marcada ? '<span class="iaElSello">La que encaja</span>' : '',
        e.estado.length ? `<span class="iaElEstado">${e.estado.map((s) => `<span${RE_AVISO.test(s) ? ' class="iaAviso"' : ''}>${enLinea(s)}</span>`).join('')}</span>` : '',
      ].join('');
      const cifras = e.cifras.length ? `<div class="iaElCifras">${e.cifras.map(cifra).join('')}</div>` : '';
      const totales = e.totales.map((t) => `<div class="iaElCifras iaElTotal">${t.et ? `<span class="iaElTotEt">${enLinea(t.et)} →</span>` : ''}${t.cifras.map(cifra).join('')}</div>`).join('');
      return `<li class="iaEl${marcada ? ' iaElegida' : ''}">${cab ? `<div class="iaElCab">${cab}</div>` : ''}${e.nombre ? `<div class="iaElNombre">${enLinea(e.nombre)}</div>` : ''}${cifras}${totales}${e.metas.map(metaDe).join('')}</li>`;
    };
    return `<${tag} class="iaElementos"${tag === 'ol' ? ini(desde) : ''}>${els.map(fila).join('')}</${tag}>`;
  }
  /*
   * 14-nov: las listas largas se pliegan. Hasta 6 puntos, enteras; con más, los 4 primeros y el resto tras
   * «Ver todo (+N)» (details/summary, sin JS; en móvil y en el panel). Nunca se pierde un punto.
   */
  const UMBRAL_PLEGAR = 6;
  const VISIBLES = 4;
  function plegada(items, pintar) {
    if (items.length <= UMBRAL_PLEGAR) return pintar(items, 0);
    return `${pintar(items.slice(0, VISIBLES), 0)}<details class="iaMas"><summary><span class="iaMasVer">Ver todo (+${items.length - VISIBLES})</span><span class="iaMasMenos">Ver menos</span></summary>${pintar(items.slice(VISIBLES), VISIBLES)}</details>`;
  }
  function formato(texto) {
    const lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let parrafo = [];
    const cerrarParrafo = () => { if (parrafo.length) out.push(`<p>${parrafo.map(enTexto).join('<br>')}</p>`); parrafo = []; };
    /* «La que encaja es la 1»: esa fila se marca (la respuesta, arriba y a la vista). */
    const elegida = (String(texto || '').match(/\b(?:la que encaja|la buena|la que vale|recomiendo)\s+(?:es\s+)?la\s+(\d{1,2})\b/i) || [])[1] || '';
    for (let i = 0; i < lineas.length;) {
      const l = lineas[i];
      if (!l.trim()) { cerrarParrafo(); i++; continue; }
      if (RE_FILA.test(l) && RE_SEPARA.test(lineas[i + 1] || '')) {
        cerrarParrafo();
        const t = [];
        while (i < lineas.length && RE_FILA.test(lineas[i])) t.push(lineas[i++]);
        out.push(tabla(t));
        continue;
      }
      const tit = l.match(/^\s*#{1,4}\s+(.+)$/);
      if (tit) { cerrarParrafo(); out.push(`<h4 class="iaTit">${enLinea(tit[1])}</h4>`); i++; continue; }
      const lista = RE_VINETA.test(l) ? [RE_VINETA, 'ul'] : RE_NUMERO.test(l) ? [RE_NUMERO, 'ol'] : null;
      if (lista) {
        const [re, tag] = lista;
        cerrarParrafo();
        const items = [];
        /* Una línea sangrada justo debajo de un punto sigue siendo ese punto. */
        while (i < lineas.length && (re.test(lineas[i]) || (items.length && /^\s{2,}\S/.test(lineas[i]) && !RE_VINETA.test(lineas[i]) && !RE_NUMERO.test(lineas[i])))) {
          if (re.test(lineas[i])) items.push({ n: (lineas[i].match(/^\s*(\d{1,2})[.)]/) || [])[1] || '', lineas: [lineas[i].replace(re, '')] });
          else items[items.length - 1].lineas.push(lineas[i].trim());
          i++;
        }
        /* 12-nov: si TODOS los puntos son elementos (código · nombre — cifras), filas limpias; si no, la lista de siempre. */
        const els = items.map(elemento);
        if (els.every(Boolean)) out.push(plegada(els, (parte, d) => listaElementos(parte, tag, elegida, d)));
        else out.push(plegada(items, (parte, d) => `<${tag}${tag === 'ol' ? ini(d) : ''}>${parte.map((x) => `<li>${enTexto(x.lineas.join(' '))}</li>`).join('')}</${tag}>`));
        continue;
      }
      parrafo.push(l);
      i++;
    }
    cerrarParrafo();
    return out.join('');
  }

  function textoConEnlaces(texto) {
    return trozos(texto).map((t) => (t.pantalla
      ? `<button class="iaIr" data-ia-ir="${esc(t.pantalla)}">${esc(NOMBRES_PANTALLA[t.pantalla] || t.pantalla)} →</button>`
      : formato(t.texto))).join('');
  }

  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  /*
   * 10-nov (JC): LA MINIATURA DEL ARCHIVO en el chat, en los dos sentidos (lo que saca Iarvis y lo
   * que adjunta el usuario): la primera página del PDF o la imagen reducida si se puede; si no, el
   * icono del tipo. Con el nombre y el tamaño; al pulsarla se abre (y en la web, además, se descarga).
   *   - escritorio: la miniatura la da el proceso principal (nativeImage, como notas:miniatura);
   *   - web: se pinta aquí con los bytes (pdf.js de renderer/recortePdf.js, o un lienzo para las fotos).
   * Las miniaturas pintadas se guardan en una caché pequeña por archivo (memoria + localStorage).
   */
  const CLAVE_MINIS = 'vidaire.iarvis.miniaturas';
  const MAX_MINIS = 40;
  I.archivos = I.archivos || {};
  I.minis = I.minis || (() => { try { return JSON.parse(localStorage.getItem(CLAVE_MINIS) || '{}') || {}; } catch { return {}; } })();
  I.bytesLocales = I.bytesLocales || new Map();
  function guardarMini(clave, url) {
    if (!clave || !url) return;
    I.minis[clave] = url;
    const claves = Object.keys(I.minis);
    for (const k of claves.slice(0, Math.max(0, claves.length - MAX_MINIS))) delete I.minis[k];
    try { localStorage.setItem(CLAVE_MINIS, JSON.stringify(I.minis)); } catch { /* lleno: se queda en memoria */ }
  }
  const extDe = (n) => { const m = /\.([a-z0-9]{1,5})$/i.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
  /** El icono del tipo: PDF, XLS, DOC, IMG, EML… (y la clase que le da el color). */
  function iconoDe(a) {
    const mime = String(a.mime || a.tipoMime || (/\//.test(String(a.tipo || '')) ? a.tipo : '') || '');
    const ext = extDe(a.nombre);
    if (/pdf/.test(mime) || ext === 'pdf') return { txt: 'PDF', clase: 'pdf' };
    if (/sheet|excel|csv/.test(mime) || /^(xlsx?|xlsm|csv|ods)$/.test(ext)) return { txt: 'XLS', clase: 'xls' };
    if (/word|officedocument\.wordprocessing/.test(mime) || /^(docx?|odt|rtf)$/.test(ext)) return { txt: 'DOC', clase: 'doc' };
    if (/^image\//.test(mime) || /^(jpe?g|png|gif|webp|heic|heif|tiff?|bmp)$/.test(ext)) return { txt: 'IMG', clase: 'img' };
    if (/message|outlook/.test(mime) || /^(eml|msg)$/.test(ext)) return { txt: 'EML', clase: 'eml' };
    if (/^(dwg|dxf|ifc|rvt)$/.test(ext)) return { txt: ext.toUpperCase(), clase: 'cad' };
    if (/zip|compressed/.test(mime) || /^(zip|rar|7z)$/.test(ext)) return { txt: 'ZIP', clase: 'otro' };
    return { txt: (ext || 'ARCH').toUpperCase().slice(0, 4), clase: 'otro' };
  }
  const claveMini = (a) => String(a.ruta || (a.nombre && a.tamano ? `${a.nombre}:${a.tamano}` : '') || '');
  /** La tarjeta del archivo (un solo componente para los dos sentidos). `origen`: 'iarvis' | 'usuario'. */
  function tarjetaArchivo(a, id, origen) {
    I.archivos[id] = { ...a, origen };
    const ic = iconoDe(a);
    const mini = a.miniatura || I.minis[claveMini(a)];
    const disponible = origen === 'usuario' ? Boolean(a.ruta || I.bytesLocales.has(claveMini(a))) : Boolean(a.ruta || a.base64 || a.nubeRuta || I.pdfs[id]);
    const donde = origen === 'iarvis' && a.ruta ? ' · Descargas › Vidaire Iarvis' : '';
    const titulo = disponible ? `Abrir «${a.nombre || ''}»` : 'Pídemelo otra vez para sacarlo de nuevo.';
    return `<button type="button" class="iaArchivoMini${disponible ? '' : ' iaNoDisponible'}" data-ia-archivo="${esc(id)}" title="${esc(titulo)}"${disponible ? '' : ' disabled'}>
      <span class="iaMiniVista iaMini-${ic.clase}" data-ia-vista="${esc(id)}">${mini ? `<img src="${esc(mini)}" alt="">` : `<span class="iaMiniIcono">${esc(ic.txt)}</span>`}</span>
      <span class="iaMiniNombre">${esc(a.nombre || 'Archivo')}<small>${esc(ic.txt)}${a.tamano ? ` · ${kb(a.tamano)}` : ''}${donde}</small></span></button>`;
  }
  const deBase64 = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const aDataUrl = (bytes, mime) => new Promise((ok) => {
    try { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(new Blob([bytes], { type: mime })); } catch { ok(null); }
  });
  /** La miniatura pintada aquí: la primera página del PDF o la foto reducida (JPEG pequeño en data:, que la CSP deja). */
  async function pintarMiniatura(bytes, a) {
    const ic = iconoDe(a);
    const lienzo = document.createElement('canvas');
    try {
      if (ic.clase === 'pdf') {
        if (typeof cargarPdfjsRp !== 'function') return null; // eslint-disable-line no-undef
        const lib = await cargarPdfjsRp(); // eslint-disable-line no-undef
        const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        const pagina = await doc.getPage(1);
        const v0 = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: 240 / Math.max(v0.width, v0.height) });
        lienzo.width = Math.ceil(vista.width); lienzo.height = Math.ceil(vista.height);
        await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
        try { doc.destroy(); } catch { /* nada */ }
      } else if (ic.clase === 'img') {
        const url = await aDataUrl(bytes, a.mime || 'image/jpeg');
        if (!url) return null;
        const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
        const k = 240 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        lienzo.width = Math.max(1, Math.round(img.naturalWidth * Math.min(1, k))); lienzo.height = Math.max(1, Math.round(img.naturalHeight * Math.min(1, k)));
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      } else return null;
      return lienzo.toDataURL('image/jpeg', 0.7);
    } catch { return null; }
  }
  /** Rellena las miniaturas que faltan en lo pintado (sin bloquear el chat). */
  async function rellenarMiniaturas() {
    const raiz = I.panel || I.lista;
    if (!raiz) return;
    for (const z of raiz.querySelectorAll('[data-ia-vista]')) {
      if (z.querySelector('img')) continue;
      const a = I.archivos[z.getAttribute('data-ia-vista')];
      if (!a || a.sinMini) continue;
      a.sinMini = true; // una vez por archivo y sesión
      const clave = claveMini(a);
      let url = I.minis[clave] || null;
      if (!url && a.ruta && a.origen === 'iarvis' && window.puente && window.puente.iarvisMiniatura) {
        try { url = await window.puente.iarvisMiniatura(a.ruta); } catch { url = null; }
      }
      if (!url) {
        const local = I.bytesLocales.get(clave);
        const pdf = I.pdfs[z.getAttribute('data-ia-vista')];
        const bytes = local ? local.bytes : (a.base64 || (pdf && pdf.base64)) ? deBase64(a.base64 || pdf.base64) : null;
        if (bytes) url = await pintarMiniatura(bytes, a);
      }
      if (!url) continue;
      guardarMini(clave, url);
      for (const v of raiz.querySelectorAll(`[data-ia-vista="${CSS && CSS.escape ? CSS.escape(z.getAttribute('data-ia-vista')) : z.getAttribute('data-ia-vista')}"]`)) {
        v.innerHTML = `<img src="${esc(url)}" alt="">`;
      }
    }
  }
  /** En la web: abrir en otra pestaña y, además, descargarlo (JC: «se abre y se descarga»). */
  function abrirYBajar(bytes, nombre, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    if (/pdf|^image\//.test(String(mime || ''))) window.open(url, '_blank');
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre || 'archivo';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const avisoBreve = (t) => { if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar(t); };
  async function abrirArchivo(id) {
    const a = I.archivos[id];
    if (!a) return;
    const mime = a.mime || (/\//.test(String(a.tipo || '')) ? a.tipo : '') || 'application/octet-stream';
    if (a.origen === 'iarvis') {
      if (a.ruta && window.puente && window.puente.iarvisAbrirPdf) {
        const r = await window.puente.iarvisAbrirPdf(a.ruta, false);
        if (r && !r.ok && !(a.nubeRuta && window.puente.iarvisAbrirAdjunto)) avisoBreve(r.error || 'No se ha podido abrir.');
        if (!r || r.ok || !a.nubeRuta) return;
      }
      const b = a.base64 || (I.pdfs[id] && I.pdfs[id].base64);
      if (b) { abrirYBajar(deBase64(b), a.nombre, mime || 'application/pdf'); return; }
      /* Ya sin los bytes (historial, otra sesión, borrado de Descargas): la copia guardada en su carpeta de la nube. */
      if (a.nubeRuta && window.puente && window.puente.iarvisAbrirAdjunto) {
        const r2 = await window.puente.iarvisAbrirAdjunto({ ruta: a.nubeRuta, nombre: a.nombre, tipo: mime });
        if (r2 && r2.ok && r2.base64) abrirYBajar(deBase64(r2.base64), a.nombre, r2.mime || mime);
        else if (r2 && !r2.ok) avisoBreve(r2.error || 'No se ha podido abrir.');
      }
      return;
    }
    /* Lo que adjuntó el usuario: se baja de SU carpeta de la nube (el escritorio lo abre; la web lo abre y lo descarga);
       sin conexión, con los bytes de esta vez si están. */
    const local = I.bytesLocales.get(claveMini(a));
    if (!window.puente || !window.puente.iarvisAbrirAdjunto) { if (local) abrirYBajar(local.bytes, a.nombre, local.mime || mime); return; }
    const r = await window.puente.iarvisAbrirAdjunto({ ruta: a.ruta, nombre: a.nombre, tipo: mime });
    if (r && r.ok && r.base64) abrirYBajar(deBase64(r.base64), a.nombre, r.mime || mime);
    else if (r && !r.ok) { if (local) abrirYBajar(local.bytes, a.nombre, local.mime || mime); else avisoBreve(r.error || 'No se ha podido abrir.'); }
  }
  /** Las miniaturas de lo adjuntado (en la pregunta y en la caja antes de mandar). */
  function tarjetasAdjuntos(lista, prefijo) {
    return (lista || []).map((a, i) => tarjetaArchivo({ ...a, mime: a.mime || (/\//.test(String(a.tipoMime || '')) ? a.tipoMime : '') }, `${prefijo}:${i}`, 'usuario')).join('');
  }

  /** Lo que Iarvis ha hecho con la app: el PDF, ir a una pantalla, proponer o aplicar. */
  function pintarAcciones(f) {
    /* 11-nov (hablar con Iarvis): los pasos que el chat propuso (propuesta.pasos, shared/ia/charla.js ·
       pasosDe). Cada botón solo abre la tarjeta «¿Lo hago?» de la app; nada se escribe sin confirmar. */
    const pasos = f.propuesta && Array.isArray(f.propuesta.pasos)
      ? f.propuesta.pasos.filter((a) => a && a.tipo === 'hacer' && !a.confirmado && (a.hacer === 'proponerRegistro' || a.hacer === 'catalogo')) : [];
    const acc = [...(Array.isArray(f.acciones) ? f.acciones : []), ...pasos];
    if (!acc.length) return '';
    const pdfs = acc.filter((a) => a.tipo === 'pdf').map((a, i) => {
      const id = `${f.id}:${i}`;
      if (a.base64) I.pdfs[id] = a;
      const guardado = I.pdfs[id];
      return tarjetaArchivo(guardado && !a.base64 ? { ...a, base64: guardado.base64 } : a, id, 'iarvis');
    }).join('');
    const botones = acc.filter((a) => a.tipo !== 'pdf').map((a) => {
      const datos = esc(JSON.stringify(a));
      const prin = a.tipo === 'proponer' || a.tipo === 'aplicar' || (a.tipo === 'hacer' && a.hacer !== 'rechazar' && !a.secundario);
      return `<button class="${prin ? 'iaBotonPrin' : 'iaBotonSec'}" data-ia-accion="${datos}">${esc(a.texto || 'Abrir')}</button>`;
    }).join('');
    return `${pdfs ? `<div class="iaArchivos">${pdfs}</div>` : ''}${botones ? `<div class="iaAcciones">${botones}</div>` : ''}`;
  }

  /*
   * 9-nov (JC): mientras contesta, la brújula de Iarvis latiendo y un verbo que rota cada
   * ~1,7 s en el idioma de la app (shared/ia/verbosEspera.js); si está haciendo algo concreto
   * («Leyendo la placa…», «Buscando la UTA-01…»), dice eso. Con prefers-reduced-motion no se
   * mueve (iarvis.css): solo el verbo.
   */
  const idiomaApp = () => { try { return (I.contexto && (I.contexto() || {}).idioma) || document.documentElement.lang || 'es'; } catch { return 'es'; } };
  function verboDe(f, n = 0) {
    const E = window.IARVIS_ESPERA;
    if (!E) return 'Pensando…';
    const fijo = E.haciendo(idiomaApp(), f && f.haciendo);
    if (fijo) return fijo;
    const l = E.verbos(idiomaApp());
    return l[n % l.length];
  }
  function pintarPensando(f) {
    const brujula = (window.ARRANQUE_LOGO && window.ARRANQUE_LOGO.BRUJULA) || '<span aria-hidden="true">🧭</span>';
    return `<div class="iaRespuesta iaEspera iaPensando" role="status" aria-live="polite"><span class="iaBrujulaViva" aria-hidden="true">${brujula}</span><span class="iaVerbo" data-ia-verbo="${f && f.haciendo ? 'fijo' : 'rota'}">${esc(verboDe(f, 0))}</span></div>`;
  }
  let vueltaVerbo = 0;
  /* Sin temporizador (el banco de carga de pantallaCarga.test.js), el verbo se queda quieto. */
  if (typeof setInterval === 'function') setInterval(() => {
    const vivos = document.querySelectorAll('.iaVerbo[data-ia-verbo="rota"]');
    if (!vivos.length) return;
    vueltaVerbo += 1;
    for (const v of vivos) v.textContent = verboDe(null, vueltaVerbo);
  }, (window.IARVIS_ESPERA && window.IARVIS_ESPERA.CADA) || 1700);

  /* 12-nov: «útil / no útil» con dos trazos finos en vez de los emojis 👍 👎 (el chat va sin emojis). */
  const svgPulgar = (abajo) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${abajo ? 'iaPulgarAbajo' : 'iaPulgar'}"><path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 2.6 1.9L13 9h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>`;
  const ICONO_UTIL = svgPulgar(false);
  const ICONO_NO_UTIL = svgPulgar(true);

  function pintarRespuesta(f) {
    if (!f.respuesta) return pintarPensando(f);
    const espera = f.estado === 'pendiente' || f.estado === 'respondiendo';
    const valorable = f.estado === 'respondida' && f.id;
    const pie = valorable ? `<div class="iaPie">
      <button data-ia-valorar="util" data-id="${esc(f.id)}" class="${f.valoracion === 'util' ? 'elegida' : ''}" title="Me ha servido" aria-label="Me ha servido">${ICONO_UTIL}</button>
      <button data-ia-valorar="no_util" data-id="${esc(f.id)}" class="${f.valoracion === 'no_util' ? 'elegida' : ''}" title="No me ha servido" aria-label="No me ha servido">${ICONO_NO_UTIL}</button></div>` : '';
    return `<div class="iaRespuesta${espera ? ' iaEspera' : ''}">${textoConEnlaces(f.respuesta)}${pintarAcciones(f)}${pintarPropuestas(f)}${pie}</div>`;
  }

  function pintarPropuestas(f) {
    const A = window.IarvisAdjuntos;
    const adj = Array.isArray(f.adjuntos) ? f.adjuntos : [];
    /* 9-nov: si la respuesta ya hace algo con las fotos (la tarjeta de la ficha), sin nota aparte. */
    if (!A || !adj.length || f.fotosEnTarjeta) return '';
    return adj.map((a) => {
      const d = A.proponerDestino(a.tipo);
      /* 12-nov (Iarvis mete el presupuesto): el Excel o el BC3 entra en el presupuesto de la obra. */
      if ((a.tipo === 'excel' || a.tipo === 'bc3') && window.IARVIS_PPTO) return `<div class="iaPropuesta">«${esc(a.nombre)}»: meterlo en el presupuesto de la obra.<button data-ia-meter="${esc(claveMini(a))}" data-nombre="${esc(a.nombre)}">Meter en el presupuesto</button></div>`;
      if (d.estado === 'importa') return `<div class="iaPropuesta">«${esc(a.nombre)}»: ${esc(d.accion)}.<button data-ia-confirmar="${esc(d.pantalla)}">Confirmar</button></div>`;
      if (d.estado === 'lee') return `<div class="iaPropuesta">«${esc(a.nombre)}»: ${esc(d.accion)}.</div>`;
      return `<div class="iaPropuesta">«${esc(a.nombre)}»: guardado. Esta app aún no importa este tipo (${esc(a.tipo)}); queda apuntado.</div>`;
    }).join('');
  }

  /* 8-nov (JC: «no me gusta que se abra así»): se abre LIMPIO —saludo y atajos— y lo de
     otras veces queda plegado en «Conversaciones anteriores». */
  function sugerencias() {
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    const mes = new Date().toLocaleDateString('es-ES', { month: 'long' });
    const delineante = window.SESION && window.SESION.rol === 'delineante';
    const lista = delineante
      ? ['¿Qué falla en mis planos?', '¿Qué tengo que volver a mandar?', '¿Cómo subo un IFC o un plano de AutoCAD?']
      : ctx.obraId
      ? [`Planificación de commissioning de ${mes}`, '¿Qué hay planificado esta semana?', 'Planificación de las UTAs del mes que viene', '¿Cómo certifico una partida?']
      : ['¿Cómo elijo la obra en la que trabajo?', '¿Qué puedo hacer con mi puesto?', '¿Cómo subo un documento?'];
    return lista.map((t) => `<button class="iaSugerencia" data-ia-sugerencia="${esc(t)}">${esc(t)}</button>`).join('');
  }

  function saludo() {
    const h = new Date().getHours();
    const nombre = (window.ESTADO_SESION && window.ESTADO_SESION.nombre) || '';
    return `${h < 6 || h >= 21 ? 'Buenas noches' : h < 14 ? 'Buenos días' : 'Buenas tardes'}${nombre ? `, ${esc(nombre.split(' ')[0])}` : ''}`;
  }

  function pintarFila(f) {
    if (f.proactiva) return `${pintarRespuesta(f)}${(f.enviar || []).length ? `<div class="iaSugerencias">${f.enviar.map((s) => `<button data-ia-sugerencia="${esc(s.enviar)}">${esc(s.texto)}</button>`).join('')}</div>` : ''}`;
    const adj = (f.adjuntos || []).length ? `<div class="iaAdjuntos iaArchivos">${tarjetasAdjuntos(f.adjuntos, `adj:${f.id || I.filas.indexOf(f)}`)}</div>` : '';
    if (f.pregunta == null && f.comentario) return pintarRespuesta(f);
    return `<div class="iaPregunta">${esc(f.pregunta)}${adj}</div>${pintarRespuesta(f)}`;
  }

  function pintar() {
    if (!I.lista) return;
    /* 8-nov (JC): solo la conversación de esta vez; lo de otras veces no se enseña (sigue en la nube). */
    const ahora = I.filas.filter((f) => I.deEstaVez.has(f) || (f.id && I.idsEstaVez.has(f.id)));
    const bienvenida = ahora.length ? '' : `<div class="iaBienvenida"><h3>${saludo()}</h3><p>Pídeme lo que necesites de la obra: lo busco en la app y te lo doy. También te explico cómo se hace cualquier cosa.</p><div class="iaSugerencias">${sugerencias()}</div></div>`;
    I.lista.innerHTML = `${bienvenida}${[...ahora].reverse().map(pintarFila).join('')}`;
    I.lista.scrollTop = I.lista.scrollHeight;
    rellenarMiniaturas();
  }

  async function cargarHistorial() {
    if (!I.adaptador) return;
    try {
      const h = await I.adaptador.historial();
      /* Lo que Iarvis pregunta tras una acción no se guarda en el historial: se queda en el chat. */
      if (Array.isArray(h)) { const suyas = I.filas.filter((f) => f.proactiva); I.filas = suyas.length ? [...suyas, ...h].sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || ''))) : h; }
    } catch { /* se queda lo que hay */ }
    pintar();
  }

  async function sondear(id) {
    for (let i = 0; i < SONDEOS; i++) {
      await new Promise((r) => setTimeout(r, ESPERA_SONDEO));
      let f = null;
      try { f = await I.adaptador.estado(id); } catch { /* sin red */ }
      if (f && f.estado !== 'pendiente' && f.estado !== 'respondiendo') {
        I.filas = I.filas.map((x) => (x.id === id ? { ...x, ...f } : x));
        pintar();
        if (I.boton && (!I.panel || I.panel.hidden)) I.boton.classList.add('conPunto');
        return;
      }
    }
  }

  /* 9-nov: contestar «sí» o «no» a la última tarjeta de un hecho es lo mismo que pulsar sus botones. */
  const SI = /^(s[ií]|confirmo|confirmado|hazlo|adelante|ok|vale|de acuerdo)[.!]?$/i;
  const NO = /^(no|cancela|cancelar|d[eé]jalo)[.!]?$/i;
  function tarjetaAbierta() {
    const f = I.filas[0];
    if (!f || !(I.deEstaVez.has(f) || (f.id && I.idsEstaVez.has(f.id))) || !Array.isArray(f.acciones)) return null;
    const confirmar = f.acciones.find((a) => a.hacer === 'hecho' && a.texto === 'Confirmar');
    return confirmar ? { confirmar, cancelar: f.acciones.find((a) => a.hacer === 'rechazar') } : null;
  }

  async function mandar(textoDado) {
    const caja = I.panel.querySelector('textarea');
    const pregunta = (typeof textoDado === 'string' ? textoDado : caja.value).trim();
    if (!pregunta || I.ocupado || !I.adaptador) return;
    const carta = tarjetaAbierta();
    if (carta && (SI.test(pregunta) || (NO.test(pregunta) && carta.cancelar))) { caja.value = ''; accion(SI.test(pregunta) ? carta.confirmar : carta.cancelar); return; }
    I.ocupado = true;
    caducar();
    actividad();
    const botonMandar = I.panel.querySelector('.iaMandar');
    botonMandar.disabled = true;
    const adjuntos = I.ficheros.slice();
    const archivos = I.locales.slice();
    I.ficheros = [];
    I.locales = [];
    pintarFicheros();
    caja.value = '';
    const nFotos = adjuntos.filter((a) => /^image\//.test(String(a.tipo || a.mime || '')) || /\.(jpe?g|png|heic|heif|webp)$/i.test(String(a.nombre || ''))).length;
    const provisional = { id: null, pregunta, adjuntos, estado: 'respondiendo', respuesta: null, haciendo: window.IARVIS_ESPERA ? window.IARVIS_ESPERA.adivinar(pregunta, { fotos: nFotos }) : null };
    I.filas = [provisional, ...I.filas];
    I.deEstaVez.add(provisional);
    pintar();
    const hoja = adjuntos.find((a) => a.tipo === 'excel' || a.tipo === 'bc3');
    if (hoja && window.IARVIS_PPTO && /presupuest|ppto|m[eé]te|importa/i.test(pregunta)) {
      Object.assign(provisional, { estado: 'respondida', respuesta: `Lo meto en el presupuesto de la obra: «${hoja.nombre}».`, fotosEnTarjeta: true });
      pintar();
      I.ocupado = false;
      botonMandar.disabled = false;
      meterHoja(claveMini(hoja), hoja.nombre);
      return;
    }
    let ctx = {};
    try { ctx = I.contexto() || {}; } catch { /* sin contexto */ }
    let r = adjuntos.length || archivos.length ? null : navegarLocal(pregunta);
    if (!r) {
      try {
        r = await I.adaptador.preguntar({ pregunta, pantalla: ctx.pantalla, obraId: ctx.obraId, obraNombre: ctx.obraNombre, presupuestoId: ctx.presupuestoId, mirando: ctx.mirando || (ctx.hechoAbierto ? `Caso abierto en pantalla: ${ctx.hechoAbierto.reclamacionCodigo || ''} ${ctx.hechoAbierto.codigo || ''} ${ctx.hechoAbierto.titulo || ''}`.trim() : undefined), idioma: ctx.idioma, hechoAbierto: ctx.hechoAbierto, correoAbierto: ctx.correoAbierto, adjuntos, archivos });
      } catch { r = { estado: 'fallo', respuesta: 'Iarvis no ha podido contestar ahora. Vuelve a preguntármelo.' }; }
    }
    Object.assign(provisional, r || {});
    if (provisional.id) I.idsEstaVez.add(provisional.id);
    actividad();
    pintar();
    I.ocupado = false;
    botonMandar.disabled = false;
    /* Un solo equipo que abrir: se abre ya (8-nov, Iarvis que actúa). */
    if (provisional.abrirYa && (provisional.abrirYa.tipo === 'ir' || provisional.abrirYa.tipo === 'navegar')) accion(provisional.abrirYa);
    if (provisional.id && provisional.estado === 'pendiente' && !provisional.enCola) sondear(provisional.id);
  }

  function pintarFicheros() {
    const z = I.panel && I.panel.querySelector('.iaFicheros');
    if (!z) return;
    z.innerHTML = I.ficheros.length ? `<div class="iaArchivos">${tarjetasAdjuntos(I.ficheros, 'caja')}</div>` : '';
    rellenarMiniaturas();
  }

  /** El resumen local de un adjunto (shared/ia/lectorDocumentos.js), con lo que su rol puede ver. */
  async function leerAdjunto(nombre, bytes) {
    const LD = window.IarvisLectorDocumentos;
    if (!LD || bytes.length > 25 * 1024 * 1024) return null;
    const clase = LD.claseDe(nombre, bytes);
    if (!['pdf', 'excel', 'correo', 'texto'].includes(clase)) return null;
    const perm = LD.permisosDe(window.SESION && window.SESION.rol);
    const lectura = await LD.leerDocumento({ bytes, nombre }, { hoy: new Date().toISOString().slice(0, 10), verDinero: perm.verDinero, verClaim: perm.verClaim });
    return lectura && lectura.resumen ? lectura.resumen : null;
  }

  async function adjuntar(lista) {
    const A = window.IarvisAdjuntos;
    for (const archivo of lista) {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const t = A ? A.detectarTipo(bytes, archivo.name) : { tipo: 'desconocido', mime: archivo.type };
      /* 11-nov: un presupuesto (BC3, Excel, ODS, CSV) se queda también en local: Iarvis lo lee y propone crearlo. */
      if (/\.(bc3|xlsx?|ods|csv|tsv|txt)$/i.test(archivo.name) && bytes.length <= 25 * 1024 * 1024) I.locales.push({ nombre: archivo.name, bytes });
      const z = I.panel.querySelector('.iaFicheros');
      if (z) z.textContent = `Subiendo «${archivo.name}»…`;
      let r;
      try { r = await I.adaptador.adjuntar(archivo.name, bytes, t.mime || archivo.type || 'application/octet-stream'); } catch { r = { ok: false, aviso: 'No se ha podido subir.' }; }
      if (r && r.ok) {
        /* 11-nov (JC: «hiper necesario»): Iarvis LEE el documento en local (PDF, Excel, .eml, texto): qué es, quién,
           fechas, importes, papeles citados. El `resumen` viaja con el adjunto hasta el modelo; sin dinero ni claim
           si el rol no los ve. Es una propuesta: nada se archiva ni se mueve sin confirmar. */
        let resumen = null;
        if (z) z.textContent = `Leyendo «${archivo.name}»…`;
        try { resumen = await leerAdjunto(archivo.name, bytes); } catch { resumen = null; }
        const mime = r.adjunto.tipo || t.mime || archivo.type || '';
        I.bytesLocales.set(claveMini(r.adjunto), { bytes, mime });
        I.ficheros.push({ ...r.adjunto, mime, tipo: t.tipo, ...(resumen ? { resumen } : {}) });
      }
      else if ((t.tipo === 'excel' || t.tipo === 'bc3') && window.IARVIS_PPTO) {
        /* 12-nov: sin nube, el Excel o el BC3 se queda aquí para meterlo en el presupuesto. */
        const local = { nombre: archivo.name, tamano: bytes.length, tipo: t.tipo, mime: t.mime || archivo.type || '', local: true };
        I.bytesLocales.set(claveMini(local), { bytes, mime: local.mime });
        I.ficheros.push(local);
      }
      else if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar((r && r.aviso) || 'No se ha podido subir.');
      else if (z) z.textContent = (r && r.aviso) || 'No se ha podido subir.';
    }
    pintarFicheros();
  }

  function blobDe(a) {
    const bin = atob(a.base64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: a.mime || 'application/pdf' }));
  }
  async function abrirPdf(id, ruta, enCarpeta) {
    if (ruta && window.puente && window.puente.iarvisAbrirPdf) {
      const r = await window.puente.iarvisAbrirPdf(ruta, enCarpeta);
      if (r && !r.ok && window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar(r.error || 'No se ha podido abrir.');
      return;
    }
    const a = I.pdfs[id];
    if (a) window.open(blobDe(a), '_blank');
  }
  function bajarPdf(id) {
    const a = I.pdfs[id];
    if (!a) return;
    const enlace = document.createElement('a');
    enlace.href = blobDe(a);
    enlace.download = a.nombre || 'Planificación.pdf';
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
  }

  /* Lo que un botón «ir» de Iarvis puede dejar para la sección que abre (renderer/movil/*). */
  const CLAVES_SESION = new Set(['cx.segmento', 'ncr.filtro', 'rp.filtro', 'cx.planoEquipos.planta', 'reparaciones.prefill', 'partes.prefill']);

  /*
   * 11-nov (JC): «llévame a los planos IFC». En el escritorio y la web, Iarvis abre la pantalla y la
   * pestaña que se le pide, buscando solo en lo que el rol de la persona alcanza (shared/ia/navegar.js,
   * sobre la lista del «¿Qué quieres hacer?»). Se contesta aquí mismo, sin la nube. El móvil tiene su
   * propio «ir a» con sus secciones (shared/ia/catalogo.js).
   */
  const navegador = () => (!I.movil && window.IarvisNavegar && window.BUSCADOR_CASILLA ? window.IarvisNavegar : null);
  function navegarLocal(pregunta) {
    const N = navegador();
    if (!N) return null;
    try { return N.contestar(pregunta, window.BUSCADOR_CASILLA.lista(), { propio: (window.MENU_ACTUAL && window.MENU_ACTUAL.organizacion) || '' }); } catch { return null; }
  }

  /** Los botones de las respuestas de la app: ir a una pantalla, proponer, aplicar. */
  async function accion(a, boton) {
    if (a.tipo === 'navegar') {
      const N = navegador();
      const f = N && N.sitioPorId(window.BUSCADOR_CASILLA.lista(), a.id);
      if (!f) { if (window.AVISOS && window.AVISOS.mostrar) window.AVISOS.mostrar('Esa pantalla no está en tu puesto.'); return; }
      cerrar();
      await window.BUSCADOR_CASILLA.llevar(f);
      return;
    }
    if (a.tipo === 'ir') {
      /* El equipo que abrir (commissioning lo recoge al cargar) y el formulario de estanqueidad
         empezado (si no había otro a medias): renderer/movil/commissioning.js y estanqueidad.js. */
      try {
        if (a.equipoId) sessionStorage.setItem('cx.abrir', String(a.equipoId));
        if (a.borrador && typeof a.borrador === 'object') {
          if (!localStorage.getItem('estanqueidad.borrador')) {
            const d = new Date();
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
            localStorage.setItem('estanqueidad.borrador', JSON.stringify({ fecha: local.slice(0, 10), horaInicio: local.slice(11, 16), ...a.borrador }));
          }
          sessionStorage.setItem('estanqueidad.seguir', '1');
        }
        /* 8-nov · Iarvis que hace de todo: la NCR, reparación o tarea que abrir, y lo que la sección
           lee al cargar (solo estas claves: nada que el servidor no sepa ya). */
        if (a.abrir) sessionStorage.setItem('cx.abrir', String(a.abrir));
        if (a.sesion && typeof a.sesion === 'object') {
          for (const [k, v] of Object.entries(a.sesion)) if (CLAVES_SESION.has(k)) sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      } catch { /* sin almacenamiento: abre la pantalla sin más */ }
      /* La hoja del equipo (toma de datos, checklist, estanqueidad, balanceo) y los «nuevo» de una sección. */
      if (a.accionEquipo && a.equipoId && I.movil) {
        if (I.ir) I.ir(a.destino || 'commissioning');
        const ir = () => (typeof window.CX_COMMISSIONING_IR === 'function' ? window.CX_COMMISSIONING_IR(String(a.equipoId), String(a.accionEquipo)) : null);
        setTimeout(ir, 400);
        return;
      }
      if (Array.isArray(a.pasos) && a.pasos.length && I.movil && typeof window.CX_ACCION_RAPIDA === 'function') {
        window.CX_ACCION_RAPIDA({ seccion: a.destino, pasos: a.pasos.map(String).slice(0, 4) });
        return;
      }
      /* 12-nov: «Abrir el plano» por edificio y estado (electron/data/iarvisPlanos.js). */
      if (a.planoEstado && window.PANTALLA_PLANOS_ESTADO) window.PANTALLA_PLANOS_ESTADO.preparar(a.planoEstado);
      if (a.censo && window.PANTALLA_CENSO_EQUIPOS) window.PANTALLA_CENSO_EQUIPOS.preparar(a.censo);
      if (a.vista && a.destino === 'commissioning' && window.PANTALLA_COMMISSIONING && window.PANTALLA_COMMISSIONING.prepararVista) window.PANTALLA_COMMISSIONING.prepararVista(a.vista, a.obraId, undefined, a.planoEstado ? 'estado' : a.censo ? 'censo' : undefined, a.filtroDf);
      /* 12-nov: «Abrir su ficha de mantenimiento» (electron/data/iarvisFichaMantenimiento.js). */
      if (a.destino === 'mantenimiento' && window.PANTALLA_MANTENIMIENTO) {
        if (a.obraId) window.PANTALLA_MANTENIMIENTO.elegirObra(a.obraId);
        if (a.vista && window.PANTALLA_MANTENIMIENTO.prepararVista) window.PANTALLA_MANTENIMIENTO.prepararVista(a.vista);
        if (a.fichaMant && window.PANTALLA_MANTENIMIENTO.pedirFicha) window.PANTALLA_MANTENIMIENTO.pedirFicha(a.fichaMant.equipoId);
      }
      /* 12-nov: «Abrir la medición del modelo» (electron/data/iarvisMedicionIfc.js). */
      if (a.desglose && a.destino === 'desglosePresupuesto' && window.PANTALLA_DESGLOSE && window.PANTALLA_DESGLOSE.preparar) window.PANTALLA_DESGLOSE.preparar({ ...a.desglose, obraId: a.obraId });
      /* 8-nov: «Abrir el estudio» del claim (electron/data/iarvisClaim.js). */
      if (a.destino === 'reclamaciones' && window.PANTALLA_RECLAMACIONES && window.PANTALLA_RECLAMACIONES.estado) {
        const E = window.PANTALLA_RECLAMACIONES.estado;
        if (a.vista) E.vista = String(a.vista);
        if (a.recId) { E.recId = String(a.recId); if (a.obraId) E.obraId = String(a.obraId); }
      }
      if (I.ir) I.ir(a.destino);
      /* Acoplado al lado (pantalla ancha) no tapa la ficha: se queda abierto para seguir repasando. */
      if (!I.movil && window.innerWidth < 1100) cerrar();
      return;
    }
    /* Iarvis que actúa (8-nov): marcar instalado, aprobar, guardar la foto como prueba… */
    if (a.tipo === 'hacer' && I.adaptador && I.adaptador.hacer) {
      if (I.ocupado) return;
      /* 8-nov · la firma con Iarvis: antes, Face ID, huella o PIN en el teléfono (renderer/movil/verificarIdentidad.js). */
      if (a.verificar) {
        const metodo = typeof window.CX_VERIFICAR === 'function' ? await window.CX_VERIFICAR({ motivo: 'Confirma que eres tú para firmar' }) : null;
        if (!metodo) {
          const f = { id: null, pregunta: a.texto || 'Sí', estado: 'respondida', respuesta: 'Sin Face ID, huella o PIN no firmo.' };
          I.filas = [f, ...I.filas]; I.deEstaVez.add(f); pintar();
          return;
        }
        a = { ...a, parametros: { ...(a.parametros || {}), verificacion: metodo } };
      }
      I.ocupado = true;
      if (boton) boton.disabled = true;
      const provisional = { id: null, pregunta: a.texto || 'Hecho', estado: 'respondiendo', respuesta: null };
      I.filas = [provisional, ...I.filas];
      I.deEstaVez.add(provisional);
      pintar();
      let r;
      try { r = await I.adaptador.hacer(a); } catch { r = { estado: 'fallo', respuesta: 'No he podido hacerlo ahora.' }; }
      Object.assign(provisional, r || {});
      if (provisional.id) I.idsEstaVez.add(provisional.id);
      actividad();
      I.ocupado = false;
      pintar();
      /* 9-nov: lo que Iarvis cambia en un hecho se ve solo en la pantalla, sin recargar. */
      if (provisional.refrescar) document.dispatchEvent(new CustomEvent('reclamaciones:correo-cambiado'));
      return;
    }
    const proponer = (I.adaptador && I.adaptador.proponer) || (window.puente && window.puente.iarvisProponer && ((x) => window.puente.iarvisProponer(x)));
    if ((a.tipo === 'proponer' || a.tipo === 'aplicar') && proponer) {
      if (I.ocupado) return;
      I.ocupado = true;
      if (boton) boton.disabled = true;
      const provisional = { id: null, pregunta: a.tipo === 'aplicar' ? 'Aplícalo' : 'Planifiquémoslo juntos', estado: 'respondiendo', respuesta: null };
      I.filas = [provisional, ...I.filas];
      I.deEstaVez.add(provisional);
      pintar();
      let r;
      try { r = await proponer({ obraId: a.obraId, desde: a.desde, hasta: a.hasta, periodo: a.periodo, aplicar: a.tipo === 'aplicar' }); } catch (e) { r = { estado: 'fallo', respuesta: 'No he podido hacerlo ahora.' }; }
      Object.assign(provisional, r || {});
      if (provisional.id) I.idsEstaVez.add(provisional.id);
      actividad();
      I.ocupado = false;
      pintar();
    }
  }

  function construirPanel() {
    const p = document.createElement('aside');
    p.className = `iaPanel${I.movil ? ' iaMovil' : ''}`;
    p.setAttribute('aria-label', 'Iarvis');
    p.innerHTML = `
      ${I.movil
    /* 8-nov (JC): en el móvil, SOLO el chat: una cabecera mínima con «‹» para volver y «Iarvis». */
    ? '<div class="iaCabecera"><button class="iaVolver" title="Volver" aria-label="Volver">‹</button><h2>Iarvis</h2></div>'
    : '<div class="iaCabecera"><span class="iaMarca" aria-hidden="true">I</span><div class="iaTitulo"><h2>Iarvis</h2><span class="iaAviso">Usa la app por ti · solo lo que tu puesto ve</span></div><button class="iaAnclar" type="button" aria-pressed="false" title="Anclar: queda fijo a la derecha" aria-label="Anclar Iarvis"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v6"/></svg></button><button class="iaFlotar" title="Soltar como ventana (o anclar a la columna)" aria-label="Soltar o anclar">⧉</button><button class="iaNueva" title="Empezar de cero" aria-label="Conversación nueva">＋</button><button class="iaCerrar" title="Cerrar (Esc)" aria-label="Cerrar">×</button></div>'}
      <div class="iaSobre" hidden></div>
      <div class="iaLista" role="log" aria-live="polite"></div>
      <div class="iaEntrada">
        <div class="iaFicheros"></div>
        <div class="iaFila">
          <button class="iaClip" title="Adjuntar un archivo" aria-label="Adjuntar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.2 4.2l-8 8a1.5 1.5 0 0 1-2.1-2.1l7.3-7.3"/></svg></button>
          ${I.movil ? '<button class="iaCamara" title="Foto con la cámara" aria-label="Cámara"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg></button>' : ''}
          <textarea rows="1" placeholder="${I.movil ? 'Escribe o pulsa el micrófono del teclado para dictar' : 'Pregunta a Iarvis…'}"></textarea>
          <button class="iaMandar" title="Mandar (Intro)" aria-label="Mandar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        </div>
        <input type="file" class="iaArchivo" multiple hidden>
        <input type="file" class="iaFoto" accept="image/*" capture="environment" hidden>
      </div>`;
    I.lista = p.querySelector('.iaLista');
    p.querySelector('.iaMandar').addEventListener('click', () => mandar());
    p.querySelector('textarea').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !I.movil) { e.preventDefault(); mandar(); } });
    p.querySelector('.iaClip').addEventListener('click', () => p.querySelector('.iaArchivo').click());
    const cam = p.querySelector('.iaCamara');
    if (cam) cam.addEventListener('click', () => p.querySelector('.iaFoto').click());
    for (const sel of ['.iaArchivo', '.iaFoto']) {
      p.querySelector(sel).addEventListener('change', (e) => { adjuntar([...e.target.files]); e.target.value = ''; });
    }
    /* 10-nov (JC): adjuntar también arrastrando al panel o pegando (Cmd+V) un archivo. */
    const conArchivos = (e) => Boolean(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
    p.addEventListener('dragover', (e) => { if (!conArchivos(e)) return; e.preventDefault(); p.classList.add('iaSoltar'); });
    p.addEventListener('dragleave', (e) => { if (!p.contains(e.relatedTarget)) p.classList.remove('iaSoltar'); });
    p.addEventListener('drop', (e) => {
      p.classList.remove('iaSoltar');
      if (!conArchivos(e)) return;
      e.preventDefault();
      const lista = [...(e.dataTransfer.files || [])];
      if (lista.length && I.adaptador) adjuntar(lista);
    });
    p.querySelector('textarea').addEventListener('paste', (e) => {
      const lista = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (!lista.length || !I.adaptador) return;
      e.preventDefault();
      adjuntar(lista);
    });
    const cerrarB = p.querySelector('.iaCerrar');
    if (cerrarB) cerrarB.addEventListener('click', cerrar);
    p.addEventListener('click', async (e) => {
      const sug = e.target.closest('[data-ia-sugerencia]');
      if (sug) { mandar(sug.getAttribute('data-ia-sugerencia')); return; }
      if (e.target.closest('.iaAnclar')) { anclar(!I.anclado); return; }
      if (e.target.closest('.iaVolver')) { if (I.volver) I.volver(); else if (history.length > 1) history.back(); return; }
      if (e.target.closest('.iaNueva')) { I.deEstaVez = new Set(); I.idsEstaVez = new Set(); I.ultima = 0; try { localStorage.removeItem(CHARLA); } catch { /* nada */ } if (I.adaptador && I.adaptador.nueva) Promise.resolve().then(() => I.adaptador.nueva()).catch(() => { /* sin red: la siguiente caduca sola */ }); pintar(); return; }
      const arch = e.target.closest('[data-ia-archivo]');
      if (arch) { abrirArchivo(arch.getAttribute('data-ia-archivo')); return; }
      const pdf = e.target.closest('[data-ia-pdf]');
      if (pdf) { abrirPdf(pdf.getAttribute('data-ia-pdf'), pdf.getAttribute('data-ruta'), false); return; }
      const carpeta = e.target.closest('[data-ia-pdf-carpeta]');
      if (carpeta) { abrirPdf(null, carpeta.getAttribute('data-ia-pdf-carpeta'), true); return; }
      const bajar = e.target.closest('[data-ia-pdf-bajar]');
      if (bajar) { bajarPdf(bajar.getAttribute('data-ia-pdf-bajar')); return; }
      const acc = e.target.closest('[data-ia-accion]');
      if (acc) { let a = null; try { a = JSON.parse(acc.getAttribute('data-ia-accion')); } catch { /* roto */ } if (a) accion(a, acc); return; }
      const ir = e.target.closest('[data-ia-ir]');
      if (ir && I.ir) { I.ir(ir.getAttribute('data-ia-ir')); if (!I.movil) cerrar(); return; }
      const meter = e.target.closest('[data-ia-meter]');
      if (meter) { meterHoja(meter.getAttribute('data-ia-meter'), meter.getAttribute('data-nombre')); return; }
      const conf = e.target.closest('[data-ia-confirmar]');
      if (conf && I.ir) { I.ir(conf.getAttribute('data-ia-confirmar')); if (!I.movil) cerrar(); return; }
      const v = e.target.closest('[data-ia-valorar]');
      if (v) {
        const id = v.getAttribute('data-id');
        const val = v.getAttribute('data-ia-valorar');
        I.filas = I.filas.map((f) => (f.id === id ? { ...f, valoracion: val } : f));
        pintar();
        try { await I.adaptador.valorar(id, val); } catch { /* se queda pintado */ }
      }
    });
    p.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !I.movil) cerrar(); });
    engancharArrastre(p);
    return p;
  }

  /* 10-nov (JC): Iarvis como ventana que se arrastra: encima de la tabla, junto a la ficha lateral del hecho, o fuera de en medio.
     Anclada = la columna de siempre (empuja el contenido); suelta = ventana fija arrastrable y redimensionable que no empuja nada. */
  const CLAVE_POS = 'vidaire.iarvis.ventana';
  function leerPos() { try { return JSON.parse(localStorage.getItem(CLAVE_POS) || 'null'); } catch { return null; } }
  function guardarPos(o) { try { localStorage.setItem(CLAVE_POS, JSON.stringify(o)); } catch { /* sin almacenamiento */ } }
  function encajar(p, x, y, w, h) {
    const W = window.innerWidth, H = window.innerHeight;
    w = Math.max(300, Math.min(w, W - 16)); h = Math.max(280, Math.min(h, H - 16));
    x = Math.max(8, Math.min(x, W - w - 8)); y = Math.max(8, Math.min(y, H - 80));
    Object.assign(p.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, right: 'auto', bottom: 'auto' });
    return { x, y, w, h };
  }
  function soltar(r) {
    const p = I.panel; if (!p || I.movil) return;
    const rect = r || p.getBoundingClientRect();
    if (I.anclado) anclar(false); /* soltarla como ventana le quita la chincheta */
    p.classList.add('iaFlota');
    document.body.classList.remove('iaAbierto');
    const pos = encajar(p, rect.left - (r ? 0 : 24), r ? rect.top : Math.max(8, rect.top + 24), Math.min(rect.width, 420), Math.min(rect.height, window.innerHeight - 80));
    guardarPos({ flota: true, ...pos });
  }
  function aColumna() {
    const p = I.panel; if (!p || I.movil) return;
    p.classList.remove('iaFlota');
    ['left', 'top', 'width', 'height', 'right', 'bottom'].forEach((k) => { p.style[k] = ''; });
    if (!p.hidden) document.body.classList.add('iaAbierto');
    guardarPos({ flota: false });
  }
  function engancharArrastre(p) {
    const cab = p.querySelector('.iaCabecera'); if (!cab || I.movil) return;
    const flot = p.querySelector('.iaFlotar');
    if (flot) flot.addEventListener('click', () => (p.classList.contains('iaFlota') ? aColumna() : soltar()));
    let a = null;
    cab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      if (window.innerWidth < 900) return;
      if (!p.classList.contains('iaFlota')) soltar(p.getBoundingClientRect());
      const r = p.getBoundingClientRect();
      a = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { cab.setPointerCapture(e.pointerId); } catch { /* */ }
      e.preventDefault();
    });
    cab.addEventListener('pointermove', (e) => {
      if (!a) return;
      const r = p.getBoundingClientRect();
      encajar(p, e.clientX - a.dx, e.clientY - a.dy, r.width, r.height);
    });
    const fin = () => { if (!a) return; a = null; const r = p.getBoundingClientRect(); guardarPos({ flota: true, x: r.left, y: r.top, w: r.width, h: r.height }); };
    cab.addEventListener('pointerup', fin); cab.addEventListener('pointercancel', fin);
    /* El tamaño que le dé con la esquina también se recuerda. */
    if (window.ResizeObserver) new ResizeObserver(() => { if (a || !p.classList.contains('iaFlota') || p.hidden) return; const r = p.getBoundingClientRect(); guardarPos({ flota: true, x: r.left, y: r.top, w: r.width, h: r.height }); }).observe(p);
  }


  /*
   * 9-nov (JC: «debe poder anclarse y desanclarse para que quede fijo»). Anclado es una columna propia a la derecha
   * (iarvis.css › body.iaAnclado): no tapa nada, no se cierra al cambiar de pantalla o de hecho. Se recuerda por persona.
   */
  const CLAVE_ANCLADO = 'vidaire.iarvis.anclado';
  const claveAnclado = (id) => `${CLAVE_ANCLADO}.${id || 'sin-persona'}`;
  function leerAnclado(id) { try { return localStorage.getItem(claveAnclado(id)) === '1'; } catch { return false; } }
  function guardarAnclado(id, v) { try { localStorage.setItem(claveAnclado(id), v ? '1' : '0'); } catch { /* sin almacenamiento */ } }
  function pantallaAncha() { try { return window.matchMedia('(min-width: 900px)').matches; } catch { return true; } }
  function anclar(v, { guardar = true } = {}) {
    if (I.movil || !I.panel) return;
    I.anclado = Boolean(v);
    if (I.anclado && I.panel.classList.contains('iaFlota')) aColumna(); /* la chincheta la deja en la columna */
    document.body.classList.toggle('iaAnclado', I.anclado);
    const b = I.panel.querySelector('.iaAnclar');
    if (b) { b.setAttribute('aria-pressed', String(I.anclado)); b.title = I.anclado ? 'Desanclar: vuelve a flotar' : 'Anclar: queda fijo a la derecha'; }
    if (guardar) guardarAnclado(I.personaId, I.anclado);
    if (I.anclado && I.panel.hidden) abrir({ foco: false });
  }
  /** Al saber quién entra: su chincheta. */
  function alEntrar(personaId) {
    I.personaId = personaId;
    if (!I.panel || I.movil) return;
    const v = leerAnclado(personaId);
    if (v === Boolean(I.anclado)) return;
    anclar(v, { guardar: false });
    if (!v) cerrar();
  }

  /** La franja «Sobre: …» de la cabecera: qué caso tiene delante Iarvis. */
  function contextoCambiado() {
    const z = I.panel && I.panel.querySelector('.iaSobre');
    if (!z) return;
    let h = null;
    try { h = (I.contexto() || {}).hechoAbierto || null; } catch { /* sin contexto */ }
    z.hidden = !h;
    z.innerHTML = h ? `Sobre: <b>${esc([h.reclamacionCodigo, h.codigo].filter(Boolean).join(' · ') || 'este caso')}</b> ${esc(h.titulo || '')}` : '';
  }

  /*
   * 9-nov (JC: «para cada cosa importante que haga el usuario, Iarvis le hable para preguntarle»). La función única:
   * catálogo en shared/ia/preguntasAccion.js. Sin IA; la acción ya está hecha y contestar es opcional.
   */
  function accionImportante(clave, datos = {}) {
    const P = window.IARVIS_PREGUNTAS;
    if (!P || !I.panel || I.movil) return null;
    const q = P.preguntar(clave, datos, { activo: P.activo(I.personaId) });
    if (!q) return null;
    let delante = null;
    try { delante = (I.contexto() || {}).hechoAbierto || null; } catch { /* sin contexto */ }
    const sobreElAbierto = Boolean(datos.hechoId && delante && delante.id === datos.hechoId);
    const sug = q.sugerencias || [];
    const f = {
      id: null, proactiva: true, local: true, estado: 'respondida', creado: new Date().toISOString(), hechoId: datos.hechoId || null,
      respuesta: `${q.texto}\n${q.pregunta}`,
      /* Lo que se pulsa queda en el rastro de supervisión; a la ficha no va nada. */
      acciones: datos.hechoId ? sug.filter((s) => s.anotar).map((s) => ({ tipo: 'hacer', hacer: 'hecho', op: 'anotar', hechoId: datos.hechoId, valores: { clave, respuesta: s.anotar }, frase: q.pregunta, confirmado: true, texto: s.texto })) : [],
      enviar: sobreElAbierto ? sug.filter((s) => s.enviar) : [],
    };
    /* «Guardar y validar» son dos acciones seguidas: del mismo hecho, sale la última. */
    const prev = I.filas[0];
    const seguida = prev && prev.proactiva && prev.hechoId && prev.hechoId === f.hechoId && Date.now() - new Date(prev.creado).getTime() < 2000;
    /* Primero se caduca la charla vieja y después se añade: con la conversación vacía (primer aviso al entrar), caducar() después borraba el aviso de «esta vez». */
    caducar();
    I.filas = [f, ...(seguida ? I.filas.slice(1) : I.filas)];
    I.deEstaVez.add(f);
    actividad();
    if (I.panel.hidden) abrir({ foco: false }); else pintar();
    return f;
  }

  /** Para las pantallas: avisa sin que un fallo de Iarvis estropee lo que hizo el usuario. */
  function avisar(clave, datos) { try { return accionImportante(clave, datos); } catch (e) { console.error('[iarvis] pregunta:', e.message); return null; } }

  function abrir({ foco = true } = {}) {
    if (!I.panel) return;
    I.panel.hidden = false;
    /* 9-nov (JC): el panel empuja el contenido en vez de tapar lo que hay debajo (iarvis.css › body.iaAbierto). */
    const g = !I.movil && window.innerWidth >= 900 ? leerPos() : null;
    if (g && g.flota) { I.panel.classList.add('iaFlota'); encajar(I.panel, g.x, g.y, g.w, g.h); }
    else if (!I.movil) document.body.classList.add('iaAbierto');
    /* 8-nov: el botón vive en la cabecera y no se esconde; solo se le quita el punto. */
    if (I.boton) { I.boton.classList.remove('conPunto'); I.boton.setAttribute('aria-expanded', 'true'); }
    caducar();
    /* 8-nov: el saludo sale ya; el historial de la nube puede tardar y el panel se quedaba en blanco. */
    pintar();
    cargarHistorial();
    contextoCambiado();
    const t = I.panel.querySelector('textarea');
    if (t && foco) t.focus();
  }
  function cerrar() {
    if (I.movil || !I.panel || (I.anclado && pantallaAncha())) return;
    I.panel.hidden = true;
    document.body.classList.remove('iaAbierto');
    if (I.boton) I.boton.setAttribute('aria-expanded', 'false');
  }

  /*
   * 11-nov (comodidad, tanda 4): Iarvis desde cualquier pantalla también con el teclado, ⌘I (Ctrl+I).
   * ⌘J es del Bloc de notas (blocPantalla.js) y ⌘K del buscador de funciones (buscadorFunciones.js).
   * En un texto con formato (contenteditable) ⌘I sigue siendo la cursiva. Lo que Iarvis puede ver y
   * hacer no cambia: el rol y la organización los aplica el proceso principal (electron/ipc/canalesIarvis.js).
   */
  function atajoIarvis(e) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return false;
    if (String(e.key || '').toLowerCase() !== 'i') return false;
    if (e.target && e.target.isContentEditable) return false;
    if (!I.panel || !I.boton || I.movil) return false;
    e.preventDefault();
    if (I.panel.hidden) abrir(); else cerrar();
    return true;
  }

  /** Escritorio y web: botón en la cabecera (flotante si no hay cabecera) + panel. */
  function instalar({ adaptador, ir, contexto } = {}) {
    I.adaptador = adaptador || adaptadorDelPuente();
    if (!I.adaptador || I.boton) return;
    I.ir = ir || null;
    I.contexto = contexto || (() => ({}));
    /*
     * 8-nov (JC): ya no es la píldora flotante «Iarvis» de abajo a la derecha:
     * un botón pequeño y redondo con su brújula (shared/arranqueLogo.js › BRUJULA,
     * la misma del móvil, renderer/movil/carcasa.js › botonIarvis) en la cabecera,
     * junto al selector de rol. Pulsarlo abre o cierra el chat.
     */
    I.boton = document.createElement('button');
    I.boton.id = 'iarvisBoton';
    I.boton.type = 'button';
    I.boton.title = 'Hablar con Iarvis (⌘I)';
    I.boton.setAttribute('aria-label', 'Hablar con Iarvis');
    I.boton.setAttribute('aria-expanded', 'false');
    I.boton.innerHTML = `${(window.ARRANQUE_LOGO && window.ARRANQUE_LOGO.BRUJULA) || '<span aria-hidden="true">🧭</span>'}<span class="iaPunto"></span>`;
    I.boton.addEventListener('click', () => {
      if (I.panel && !I.panel.hidden && I.anclado && pantallaAncha()) { const t = I.panel.querySelector('textarea'); if (t) t.focus(); return; }
      if (I.panel && !I.panel.hidden) cerrar(); else abrir();
    });
    I.panel = construirPanel();
    I.panel.hidden = true;
    const cab = document.querySelector('.cabecera .derecha');
    if (cab) { I.boton.classList.add('enCabecera'); cab.prepend(I.boton); document.body.append(I.panel); } else {
      document.body.append(I.boton, I.panel);
      document.body.classList.add('conIarvis');
    }
    if (I.personaId) alEntrar(I.personaId);
    document.addEventListener('keydown', atajoIarvis);
  }

  /** Móvil: el panel dentro de su pestaña. */
  function montarEn(elemento, { adaptador, ir, contexto, volver } = {}) {
    I.movil = true;
    I.adaptador = adaptador;
    I.ir = ir || null;
    I.volver = volver || null;
    I.contexto = contexto || (() => ({}));
    if (!I.panel) I.panel = construirPanel();
    elemento.replaceChildren(I.panel);
    I.panel.hidden = false;
    caducar();
    pintar();
    cargarHistorial();
  }

  /* 12-nov (Iarvis mete el presupuesto): una frase de Iarvis sin pregunta delante. */
  function comentar(texto) {
    const f = { id: null, pregunta: null, comentario: true, estado: 'respondida', respuesta: String(texto || '') };
    I.filas = [f, ...I.filas];
    I.deEstaVez.add(f);
    pintar();
  }
  function meterHoja(clave, nombre) {
    const b = I.bytesLocales.get(clave);
    window.IARVIS_PPTO.meterAdjunto({ nombre, bytes: b && b.bytes });
  }

  /* 11-nov: otras pantallas (la ficha del hecho del claim) le hacen una pregunta ya escrita (preguntar). */
  window.IARVIS = { instalar, montarEn, abrir, cerrar, comentar, preguntar: mandar, anclar, alEntrar, contextoCambiado, accionImportante, avisar, estado: I, _charla, _atajo: atajoIarvis };
})();
