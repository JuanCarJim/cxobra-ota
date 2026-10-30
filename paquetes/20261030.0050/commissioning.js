'use strict';
/*
 * COMMISSIONING EN EL MÓVIL (#commissioning).
 *
 *   1. LA LISTA: los equipos de la obra con lo que les falta para enviarse a
 *      la DF y cuántas bocas llevan medidas. Se busca por TAG o planta.
 *   2. LA FICHA del equipo: el total medido de cada circuito frente al caudal
 *      de proyecto, el checklist (FT, CE, manual, ficha PM, ensayo, balanceo)
 *      y las bocas una debajo de otra. En cada boca se teclea la velocidad
 *      leída en el anemómetro; el ordenador calcula Q = v · Ak y el % frente
 *      al caudal de proyecto de esa boca, y el foco salta a la siguiente:
 *      medir una planta entera con el pulgar, sin tocar nada más.
 *
 *   3. LAS FICHAS del equipo (15-oct-2026): el checklist, la hoja de
 *      puesta en marcha y el certificado de estanqueidad del circuito se
 *      rellenan aquí, con fotos hechas en el momento (con su pie y su hora),
 *      y cada una saca su informe en PDF, hecho en el propio teléfono, por la
 *      hoja de compartir. El balanceo boca a boca también tiene el suyo.
 *
 * Las cuentas son las del escritorio (shared/commissioning/difusores.js y
 * fichas.js, por electron/movil/rutasFichas.js): aquí solo se teclea y se
 * enseña.
 */
(function commissioning() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc, cifra } = C;
  const activa = () => C.activa('commissioning');

  let lista = null;
  let ficha = null;
  let pilaEquipos = []; /* las unidades por las que se ha pasado, para volver */
  /* Llegar desde el plano de equipos (29-oct, JC): al terminar se vuelve al plano, con su zoom y su sitio. */
  let origenPlano = false; /* se entró al equipo desde el plano */
  let directoPlano = false; /* … directo a una pantalla (datos, balanceo): su «atrás» es el plano */
  let hojaDirecta = false; /* … directo a una hoja (checklist, estanqueidad, balanceo): al salir de ella, el plano */
  let yLista = 0;       /* dónde estaba la lista al abrir un equipo */
  let fichasEq = null; /* las fichas que necesita el equipo abierto */
  let hoja = null;     /* la ficha que se está rellenando */
  let abriendoHoja = 0; /* hojas pidiéndose al servidor (abrirHoja a medias) */
  /* La toma de datos de la primera pantalla: clave|plantilla → la misma forma que `hoja`. */
  const tomas = new Map();
  let filtro = '';
  /* El autoguardado común del móvil (autoguardado.js) y su cola sin conexión (colaGuardado.js). */
  const AG = window.AUTOGUARDADO || null;
  const COLA = window.COLA_GUARDADO || null;
  /* Las fichas con algo aún por mandar, abiertas o no: clave del borrador → ficha. */
  const vivas = new Map();

  const ENVIO = {
    completo: ['bien', 'Completo'], enviada: ['bien', 'Enviada'], lista: ['bien', 'Lista para enviar'],
    faltaDocumentacion: ['aviso', 'Falta documentación'], faltaEnsayo: ['aviso', 'Falta balanceo o estanqueidad'],
    /* Papeles completos y fichas por hacer: no es «completo» (15-oct-2026, JC). El rótulo era «Doc. completa» y
       engañaba con una ficha a medias (29-oct, JC): ahora dice lo que falta. */
    faltaFichas: ['aviso', 'Faltan fichas'],
    /* Aún fuera de commissioning: nadie ha verificado su instalación (22-oct). */
    sinVerificar: ['neutra', 'Sin verificar'],
  };
  /* «Falta ensayo» dicho por su nombre (16-oct): ensayoFalta = ['balanceo', 'estanqueidad']. */
  const nombreEnsayoFalta = (f) => (!f || !f.length ? null : f.length === 2 ? 'Falta balanceo y estanqueidad'
    : f[0] === 'estanqueidad' ? 'Falta estanqueidad' : 'Falta balanceo');
  /* Lo que dice «Falta: …» de la tarjeta: documentos y, de los equipos con datos, las firmas (29-oct, JC). */
  const faltasDe = (e) => [...(e.completo ? [] : (e.falta || [])), ...(e.faltaFirma || [])];
  const chipEnvio = (e, completo, ensayoFalta) => {
    let [clase, nombre] = completo ? ENVIO.completo : (ENVIO[e] || ['neutra', e || 'Pendiente']);
    if (!completo && e === 'faltaEnsayo') nombre = nombreEnsayoFalta(ensayoFalta) || nombre;
    return `<span class="chip ${clase}">${esc(nombre)}</span>`;
  };
  const ESTADO_BOCA = { aRevisar: ['aviso', 'A REVISAR'], dentro: ['bien', 'OK'], ok: ['bien', 'OK'], sinFactor: ['aviso', 'Falta el Ak'], medido: ['neutra', 'Medida'], alto: ['alto', 'Alto'], bajo: ['mal', 'Bajo'], sinMedir: ['neutra', 'Sin medir'], sinProyecto: ['neutra', 'Sin Q proyecto'], sinTolerancia: ['neutra', 'Medida'] };
  const INCIDENCIA = { sinSerie: 'Sin nº de serie', modeloSinAlta: 'Modelo sin dar de alta' };
  const pct = (q, d) => (q === null || q === undefined || !d ? null : Math.round((q / d) * 100));

  /* ═══════════════════════════════════ 1. La lista */

  async function cargarLista() {
    guardarTodoYa();
    ficha = null; hoja = null; pilaEquipos = [];
    origenPlano = false; directoPlano = false; hojaDirecta = false;
    bocaAbierta = null; grandeId = null;
    document.body.classList.remove('sin-scroll');
    /* Desde una cifra del Inicio: la lista llega ya filtrada. */
    try { const v = sessionStorage.getItem('cx.segmento'); if (v) { segmento = v; sessionStorage.removeItem('cx.segmento'); AGRUPAR.forEach(([id]) => C.reiniciarLista(`cx-equipos-${id}`)); } } catch { /* nada */ }
    await C.obrasListas();
    if (!activa()) return;
    if (!C.obraId()) { $app.innerHTML = '<p class="vacio">No tienes ninguna obra abierta.</p>'; return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      lista = await C.pedir(`api/commissioning?obra=${encodeURIComponent(C.obraId())}`);
      if (!lista.ok) throw new Error(lista.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cx="lista">Reintentar</button></div>`;
      return;
    }
    if (!activa() || ficha) return;
    /* Desde «Lo que me toca» del Inicio: se abre directamente ese equipo. */
    let ir = null;
    try { ir = sessionStorage.getItem('cx.abrir'); sessionStorage.removeItem('cx.abrir'); } catch { /* nada */ }
    pintarLista();
    if (ir) abrir(ir);
  }

  /* Segmentos por estado: son las cifras de arriba, siempre a la vista; cada una filtra la lista. */
  const SEGMENTOS = [
    ['todos', 'Todos', () => true],
    ['faltaDoc', 'Falta doc.', (e) => !e.completo && e.envio !== 'enviada' && !e.docCompleta],
    ['faltaBalanceo', 'Falta balanceo', (e) => !e.completo && e.envio === 'faltaEnsayo' && (!e.ensayoFalta || e.ensayoFalta.includes('balanceo'))],
    ['faltaEstanqueidad', 'Falta estanqueidad', (e) => !e.completo && (e.ensayoFalta || []).includes('estanqueidad')],
    /* Una sola regla: la de shared/commissioning/control.js (papeles + fichas + ensayo). */
    ['completos', 'Completos', (e) => e.completo],
    ['soloDoc', 'Papeles OK', (e) => e.docCompleta && !e.completo],
    /* 22-oct (JC): «puestos en marcha» y «falta ficha», las mismas cuentas que el
       inicio del escritorio (shared/commissioning/control.js · totalesDe). */
    ['enMarcha', 'Puestos en marcha', (e) => e.estadoPM === 'enMarcha' || e.estadoPM === 'hecha'],
    ['faltaFichas', 'Falta ficha', (e) => e.envio === 'faltaFichas'],
    ['faltaEnsayo', 'Falta ensayo', (e) => e.envio === 'faltaEnsayo'],
    ['enviadas', 'Mandados a la DF', (e) => e.envio === 'enviada'],
    ['sinVerificar', 'Instalación sin verificar', (e) => e.envio === 'sinVerificar'],
  ];
  let segmento = 'todos';
  const porPlanta = (a, b) => /^Sin (planta|zona)$/.test(a) - /^Sin (planta|zona)$/.test(b) || a.localeCompare(b, 'es', { numeric: true });

  /* AGRUPAR por planta, por tipo de equipo o por marca (15-oct-2026, JC). El
     tipo sale de la familia de plantillas (PANASONIC_SPLIT → Split): la marca
     va delante y se quita. */
  const TIPOS = {
    SPLIT: 'Split', VRF: 'VRF', CRACS: 'CRAC', FANCOIL: 'Fan coil', UTA: 'UTA', HRU: 'Recuperador (HRU)',
    ROOFTOPS: 'Rooftop', CHILLERS: 'Enfriadora', PUMPS: 'Bomba', GP: 'Grupo de presión',
    VENTILACION: 'Ventilación', PARKING: 'Ventilación parking', PRESURIZACION: 'Presurización',
  };
  const tipoDe = (e) => {
    const f = String(e.familia || '').toUpperCase();
    const resto = f.includes('_') ? f.slice(f.indexOf('_') + 1) : f;
    if (TIPOS[resto]) return TIPOS[resto];
    if (resto) return resto.charAt(0) + resto.slice(1).toLowerCase().replace(/_/g, ' ');
    /* Sin familia: el grupo del equipo o, si no, el prefijo del TAG (UTA-N10-03 → UTA). */
    const pre = (/^([A-Za-z]{2,5})-/.exec(String(e.tag || '')) || [])[1];
    return e.grupo || (pre ? pre.toUpperCase() : 'Sin tipo');
  };
  const AGRUPAR = [
    ['planta', 'Planta', (e) => e.planta || 'Sin planta'],
    /* Por plantas o por zonas, según el dato que haya (28-oct-2026, JC). */
    ['zona', 'Zona', (e) => e.zona || 'Sin zona'],
    ['tipo', 'Tipo', tipoDe],
    ['marca', 'Marca', (e) => e.marca || 'Sin marca'],
  ];
  let agrupar = 'planta';
  try { agrupar = sessionStorage.getItem('cx.agrupar') || 'planta'; } catch { /* sin almacén */ }

  /* Un split (UE + UI) o un VRF (UE + sus UI) es UNA línea: su commissioning
     es conjunto (15-oct-2026, JC). Sin conjuntos (un servidor viejo), por unidades. */
  const porConjuntos = () => Array.isArray(lista.conjuntos);
  const NOMBRE_CLASE = { par: 'Split', sistema: 'VRF' };
  /* Campos sueltos (TAG, sala, código de sala…): la búsqueda por cifras compara cada código por separado (buscador.js). */
  const textosDe = (e) => [...(e.unidades || []).map((u) => u.tag), e.tag, e.nombre, e.local, e.codSala, ...(e.unidades || []).map((u) => u.codSala), e.planta, e.zona, e.marca, e.modelo, tipoDe(e)];
  function tagsFila(e) {
    const us = e.unidades || [];
    /* El split, UNA vez por su nombre (28-oct-2026, JC: «en lugar de UE y luego
       debajo UI, quiero el nombre del conjunto una vez»). Lo da el servidor
       (shared/commissioning/filaMovil.js) solo si los dos TAG dicen lo mismo:
       si no cuadran, las dos unidades como antes. */
    if (e.clase === 'par' && e.nombre) {
      return `<strong class="cifra" title="${esc(us.map((u) => u.tag).join(' / '))}">${esc(e.nombre)}</strong>`;
    }
    if (e.clase === 'par') {
      return `<div class="tags-par">${us.map((u) => `<strong class="cifra"><em>${esc(u.papel)}</em>${esc(u.tag)}</strong>`).join('')}</div>`;
    }
    if (e.clase === 'sistema') {
      const n = us.length - 1;
      return `<div class="tags-par"><strong class="cifra"><em>UE</em>${esc(us[0] ? us[0].tag : e.tag)}</strong><span class="sub">+ ${n} interior${n === 1 ? '' : 'es'}</span></div>`;
    }
    return `<strong class="cifra">${esc(e.tag)}</strong>`;
  }

  /* EL Nº DE SERIE (29-oct-2026, JC: «ponme los números de serie en los
     equipos en Vidaire Cx también»): el de cada unidad, «UE … · UI …»
     (shared/commissioning/filaMovil.js › seriesTexto; lo escribe la ruta,
     que ya lo trae limpio). Sin ninguno, nada. */
  function serieFila(e) {
    return e.serie ? `<div class="sub serie">Nº serie <span class="cifra">${esc(e.serie)}</span></div>` : '';
  }
  /* En la pantalla del equipo, cada unidad en su línea, también la que no lo tiene. */
  function htmlNumSerie(e, cj, puede) {
    const us = cj && cj.unidades && cj.unidades.length > 1 ? cj.unidades : [{ id: e.id, tag: e.tag, numSerie: e.numSerie, seriePlaca: e.seriePlaca }];
    return `<dl class="num-serie">${us.map((u) => `<dt>Nº serie${us.length > 1 ? ` <em>${esc(u.papel || '')}</em>` : ''}</dt>
      <dd class="${u.numSerie ? 'cifra' : 'aviso'}">${valorSerie(u, puede)}${us.length > 1 ? ` <small>${esc(u.tag)}</small>` : ''}${htmlSeriePlaca(u, puede)}</dd>`).join('')}</dl>`;
  }
  /* EL Nº LEÍDO DE LA FOTO DE LA PLACA (29-oct-2026, JC: «si al hacer una foto
     a la placa de ese equipo no hay número de serie, automáticamente se lee de
     la placa y se pone»). La lee el propio teléfono, sin el Mac (JC: «que
     funcione sin mi Mac, autónomamente»): renderer/ocrPlaca.js, nada más subir
     la foto; el motor decide (electron/data/lecturaPlaca.js). Aquí se dice en
     qué va y, si hay duda, se confirma o se descarta con un toque. Las fotos
     que ya estaban subidas se leen con «Leer el nº de la placa». */
  const leyendoPlaca = new Set();
  const puedeLeerPlaca = () => Boolean(window.OCR_PLACA && window.OCR_PLACA.disponible());
  function htmlSeriePlaca(u, puede) {
    const p = u.seriePlaca;
    if (u.id && leyendoPlaca.has(u.id) && !u.numSerie) return '<div class="sub tenue serie-placa">Leyendo el nº de la foto de la placa…</div>';
    if (!p) return '';
    if (p.estado === 'porLeer') {
      const f = (p.fotos || [])[0];
      const boton = puede && u.id && f && puedeLeerPlaca()
        ? ` <button type="button" class="enlace" data-cx="placa-leer" data-equipo="${esc(u.id)}" data-foto="${esc(f.id)}">Leer el nº de la placa</button>` : '';
      return p.antes === 'sinLectura'
        ? `<div class="sub tenue serie-placa">La foto de la placa no se ha podido leer: escríbelo o repite la foto.${boton}</div>`
        : boton ? `<div class="sub tenue serie-placa">${boton.trim()}</div>` : '';
    }
    if (p.estado === 'sinLectura') return '<div class="sub tenue serie-placa">La foto de la placa no se ha podido leer: escríbelo o repite la foto.</div>';
    if (p.estado === 'aplicada' || p.estado === 'confirmada') return '<div class="sub tenue serie-placa">Leído de la foto de la placa</div>';
    if (p.estado !== 'propuesta') return '';
    return `<div class="sub serie-placa">Nº de serie leído de la placa: <strong class="cifra">${esc(p.valor || '')}</strong> — revisar${puede && u.id
      ? ` <button type="button" class="boton" data-cx="placa-confirmar" data-equipo="${esc(u.id)}">Confirmar</button> <button type="button" class="enlace" data-cx="placa-descartar" data-equipo="${esc(u.id)}">Descartar</button>` : ''}</div>`;
  }
  async function responderPlaca(b, accion) {
    b.disabled = true;
    try {
      const r = await C.postJson('api/equipo/placa', { equipoId: b.dataset.equipo, accion, vista: ficha.equipo.id });
      if (!r.ok) throw new Error(r.error || 'No se ha guardado.');
      if (r.equipo && ficha.equipo.id === r.equipo.id) ficha = r;
      repintarConScroll();
      if (fichasEq && ficha) refrescarEquipo(ficha.equipo.id);
    } catch (e) { b.disabled = false; C.aviso(e.message); }
  }
  /* Lo que dice la placa de una unidad (la abierta o una del conjunto). */
  function placaDeUnidad(f, equipoId) {
    if (!f || !f.equipo) return null;
    if (f.equipo.id === equipoId) return { p: f.equipo.seriePlaca, e: f.equipo };
    const u = ((f.conjunto && f.conjunto.unidades) || []).find((y) => y.id === equipoId);
    return u ? { p: u.seriePlaca, e: u } : null;
  }
  /* Nada más subir la foto: si el equipo no tiene nº y la foto puede ser la placa, se lee aquí. */
  function leerPlacaSiToca(f, equipoId, blob) {
    const x = placaDeUnidad(f, equipoId);
    if (!x || !x.p || x.p.estado !== 'porLeer' || x.e.numSerie || !blob) return;
    const fotoId = ((x.p.fotos || [])[0] || {}).id;
    if (fotoId) leerPlaca(equipoId, fotoId, blob).catch(() => {});
  }
  /* Lee la foto en el teléfono (Tesseract) y manda los renglones; sin nada claro, no se inventa nada. */
  async function leerPlaca(equipoId, fotoId, blob = null, boton = null) {
    if (!puedeLeerPlaca() || leyendoPlaca.has(equipoId)) return;
    const vista = ficha ? ficha.equipo.id : equipoId;
    const pintar = () => { if (activa() && ficha && ficha.equipo.id === vista && !hoja) repintarConScroll(); };
    leyendoPlaca.add(equipoId);
    if (boton) boton.disabled = true;
    pintar();
    try {
      const datos = (placaDeUnidad(ficha, equipoId) || {}).e || {};
      let b = blob;
      if (!b) {
        const res = await fetch(`api/equipo/foto?id=${encodeURIComponent(fotoId)}`);
        if (!res.ok) throw new Error('No se ha podido traer la foto.');
        b = await res.blob();
      }
      const { pasadas } = await window.OCR_PLACA.leer(b, { marca: datos.marca || '', modelo: datos.modelo || '' });
      const r = await C.postJson('api/equipo/placa', { equipoId, accion: 'lectura', fotoId, pasadas, vista });
      if (!r.ok) throw new Error(r.error || 'No se ha guardado la lectura.');
      if (ficha && r.equipo && ficha.equipo.id === r.equipo.id) ficha = r;
      if (r.lectura === 'aplicada' && r.numSerie) C.aviso(`Nº de serie leído de la placa: ${r.numSerie}`);
    } catch (e) {
      if (boton) C.aviso(e.message || 'No se ha podido leer la foto.');
    } finally {
      leyendoPlaca.delete(equipoId);
      pintar();
      if (fichasEq && ficha && ficha.equipo.id === vista) refrescarEquipo(vista);
    }
  }
  /* ESCRIBIR EL Nº DE SERIE DESDE LA FICHA (29-oct-2026, JC: «desde ahí poder
     meter numeros de serie»): el valor (o «Sin nº de serie») se pulsa y sale un
     campo a 16 px (el iPhone no amplía). Se guarda en el equipo y en su toma
     (fichasPM.ponerNumSerie). Sin conexión queda en el móvil
     (`cx.borrador.serie.<equipo>`) y la cola lo manda sola. */
  function valorSerie(u, puede, prefijo = '') {
    const pendiente = AG && u.id ? AG.leer(`serie.${u.id}`) : null;
    const v = pendiente ? pendiente.numSerie : u.numSerie;
    const texto = v ? `${prefijo}${esc(v)}` : '<span class="sin-serie">Sin nº de serie</span>';
    if (!puede || !u.id) return texto;
    return `<button type="button" class="enlace serie-boton" data-cx="serie" data-equipo="${esc(u.id)}" data-valor="${esc(v || '')}" aria-label="Escribir el nº de serie de ${esc(u.tag || '')}">${texto}</button>${pendiente ? ` ${marcaAG('movil')}` : ''}`;
  }
  function abrirSerie(b) {
    const caja = document.createElement('span');
    caja.className = 'serie-edita';
    caja.innerHTML = `<input type="text" class="serie-campo" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="80" placeholder="Nº de serie" value="${esc(b.dataset.valor || '')}" data-equipo="${esc(b.dataset.equipo)}" aria-label="Nº de serie"><button type="button" class="boton serie-ok" data-cx="serie-guardar">Guardar</button><button type="button" class="enlace serie-no" data-cx="serie-cancelar">Cancelar</button>`;
    b.replaceWith(caja);
    const ins = caja.querySelector('input');
    ins.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); guardarSerie(caja); } else if (ev.key === 'Escape') { ev.preventDefault(); repintarConScroll(); }
    });
    ins.focus();
    try { ins.setSelectionRange(ins.value.length, ins.value.length); } catch { /* nada */ }
  }
  function repintarConScroll() { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
  /* El nº de serie nuevo, ya en lo que la pantalla tiene en memoria (sin esperar a la red). */
  function serieEnPantalla(equipoId, numSerie) {
    if (!ficha) return;
    if (ficha.equipo && ficha.equipo.id === equipoId) ficha.equipo.numSerie = numSerie || null;
    for (const u of (ficha.conjunto && ficha.conjunto.unidades) || []) if (u.id === equipoId) u.numSerie = numSerie || null;
  }
  async function mandarSerie(cuerpo) {
    const r = await C.postJson('api/equipo/serie', cuerpo);
    if (!r.ok) { if (AG) AG.olvidar(`serie.${cuerpo.equipoId}`); throw new Error(r.error || 'No se ha guardado el nº de serie.'); }
    if (AG) AG.olvidar(`serie.${cuerpo.equipoId}`);
    return r;
  }
  async function guardarSerie(caja) {
    const ins = caja.querySelector('input');
    const equipoId = ins.dataset.equipo;
    const numSerie = ins.value.replace(/\s+/g, ' ').trim();
    const cuerpo = { equipoId, numSerie, volver: ficha ? ficha.equipo.id : equipoId };
    /* Primero en el móvil: si no hay red o se cierra la app, no se pierde. */
    if (AG) AG.guardar(`serie.${equipoId}`, cuerpo);
    serieEnPantalla(equipoId, numSerie);
    ins.blur();
    repintarConScroll();
    try {
      const r = await mandarSerie(cuerpo);
      if (ficha && r.equipo && ficha.equipo.id === r.equipo.id) ficha = r;
      if (activa() && !hoja) repintarConScroll();
      if (fichasEq && ficha) refrescarEquipo(ficha.equipo.id);
    } catch (e) {
      if (AG && AG.sinRed(e)) { AG.guardar(`serie.${equipoId}`, cuerpo); C.aviso('Sin conexión: el nº de serie queda en el móvil y se mandará solo.'); if (COLA) COLA.masTarde(); repintarConScroll(); } else C.aviso(e.message);
    }
  }
  async function enviarSeriePendiente(clave, b) {
    if (!b || !b.equipoId) { if (AG) AG.olvidar(clave); return true; }
    try {
      const r = await mandarSerie({ equipoId: b.equipoId, numSerie: b.numSerie, volver: b.volver });
      if (ficha && r.equipo && ficha.equipo.id === r.equipo.id) {
        ficha = r;
        if (activa() && !hoja && !escribiendoEnApp()) repintarConScroll();
      }
      return true;
    } catch (e) {
      /* Un «no» del servidor (permiso, equipo borrado) ya se ha olvidado; sin red, se reintenta. */
      return !(AG && AG.sinRed(e));
    }
  }

  /* EL NÚMERO DE CADA GRUPO DICE LO HECHO (28-oct-2026, JC: «pon como estaban
     pero el número ese que aparece en el extremo como total lo pones como
     X/total»). La barra es la de siempre (título a la izquierda, número a la
     derecha); el número es «hechos/total». «Hecho» es `e.completo`, la misma
     regla de siempre (papeles + fichas + ensayo, shared/commissioning/control.js)
     que pinta el chip «Completo»: no hay otra. Los hechos van al final del grupo. */
  const hecho = (e) => !!e.completo;
  function cabeceraPlanta(fs, p) {
    return `<span>${esc(p)}</span><b aria-label="${fs.filter(hecho).length} hechos de ${fs.length}">${cifra(fs.filter(hecho).length)}/${cifra(fs.length)}</b>`;
  }
  function cabeceraGrupo(fs, g) {
    const hechos = fs.filter(hecho).length;
    return `<span>${esc(g)}</span><b class="contador" aria-label="${hechos} hechos de ${fs.length}">${cifra(hechos)}/${cifra(fs.length)}</b>`;
  }

  /* LOS KPI DE ARRIBA, COMO LOS DE VIDAIRE OBRAS (28-oct-2026, JC: «mejora la
     tarjeta de resumen… y dale el aspecto de los KPI de Vidaire Obras», los de
     Conflictos del escritorio): cada cifra en su caja clara con el filete de
     color arriba (teal hecho, azul lo que falta, gris neutro), etiqueta en
     mayúsculas, cifra grande tabular, una línea de contexto y, donde cabe, la
     barra fina de avance. Siguen siendo los filtros de la lista (data-cx-seg).
     «X de N con la instalación verificada» deja de ser una frase suelta: es el
     KPI «Verificados», que pulsado enseña los que faltan por verificar. */
  function kpisCx(t, conj) {
    const total = (conj ? t.conjuntos : t.equipos) || 0;
    const pct = (n) => (total ? Math.round(((n || 0) / total) * 100) : 0);
    const celdas = [
      { id: 'todos', et: conj && t.unidades !== t.conjuntos ? 'Conjuntos' : 'Equipos', n: total, tono: 'neutro',
        pie: conj && t.unidades && t.unidades !== t.conjuntos ? `${cifra(t.unidades)} unidades` : 'en la obra' },
      t.sinVerificar !== undefined && t.instaladas !== undefined
        ? { id: 'sinVerificar', et: 'Verificados', n: t.instaladas, tono: t.sinVerificar ? 'falta' : 'bien', barra: pct(t.instaladas),
          pie: t.sinVerificar ? `${cifra(t.sinVerificar)} sin verificar` : 'instalación verificada', titulo: 'Pulsa para ver los que faltan por verificar' }
        : null,
      t.enMarcha !== undefined ? { id: 'enMarcha', et: 'En marcha', n: t.enMarcha, tono: 'bien', barra: pct(t.enMarcha), pie: `${pct(t.enMarcha)} % puestos en marcha` } : null,
      { id: 'completos', et: 'Completos', n: t.completos, tono: 'bien', barra: pct(t.completos), pie: `${pct(t.completos)} % del total` },
      { id: 'soloDoc', et: 'Papeles OK', n: t.soloDoc || 0, tono: 'neutro', pie: 'faltan fichas o pruebas' },
      { id: 'faltaDoc', et: 'Sin doc.', n: t.faltaDocumentacion || 0, tono: 'falta', pie: 'papeles por subir' },
      { id: 'faltaFichas', et: 'Sin ficha', n: t.faltaFichas || 0, tono: 'falta', pie: 'fichas por rellenar' },
      { id: 'faltaBalanceo', et: 'Balanceo', n: t.faltaBalanceo || 0, tono: 'falta', pie: 'equipos por medir' },
      { id: 'faltaEstanqueidad', et: 'Estanq.', n: (window.KPI_CX ? window.KPI_CX.faltaEstanqueidad(t) : t.faltaEstanqueidadEnvio || 0), tono: 'falta', pie: 'prueba por hacer' },
    ].filter(Boolean);
    return `<div class="kpis-cx" role="tablist" aria-label="Resumen del commissioning">${celdas.map((c) => {
      const tono = c.tono === 'falta' && !c.n ? 'bien' : c.tono;
      const activa = segmento === c.id;
      return `<button role="tab" data-cx-seg="${c.id}" aria-selected="${activa}" class="kpi-cx ${tono}${activa ? ' activa' : ''}"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>
        <span class="et">${esc(c.et)}</span><b class="cifra">${cifra(c.n)}</b>
        ${c.barra !== undefined ? `<i class="barra" aria-hidden="true"><i style="width:${c.barra}%"></i></i>` : ''}
        <span class="pie">${c.pie}</span><span class="ir" aria-hidden="true">›</span></button>`;
    }).join('')}</div>`;
  }

  /* Bajo los KPI ya no va «544 conjuntos con 778 unidades: … van en una línea
     con su exterior» (28-oct-2026, JC: «ese texto fuera»); la de la instalación
     verificada se queda, que lleva el enlace «Ver cuáles». */
  function pintarLista() {
    /* La ficha del equipo escondía el selector de arriba: vuelve. */
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = seg.children.length < 2;
    const conj = porConjuntos();
    const t = conj ? { ...(lista.totales || {}), ...(lista.totalesConjuntos || {}) } : (lista.totales || {});
    const q = filtro.trim().toLowerCase();
    const todos = (conj ? lista.conjuntos : lista.equipos) || [];
    const [, , pasa] = SEGMENTOS.find(([id]) => id === segmento) || SEGMENTOS[0];
    /* Los hechos, al final de su grupo (orden estable: lo demás no se mueve). */
    const equipos = todos.filter(pasa).filter((e) => !q || window.BUSCADOR_MOVIL.coincide(q, textosDe(e)))
      .sort((a, b) => hecho(a) - hecho(b));
    /* Zona solo se ofrece si algún equipo la tiene; si ninguno trae planta pero
       sí zona, se agrupa por zona (y los desplegables por tipo, también). */
    const hayPlanta = todos.some((e) => e.planta);
    const hayZona = todos.some((e) => e.zona);
    const opciones = AGRUPAR.filter(([id]) => id !== 'zona' || hayZona);
    let modo = opciones.some(([id]) => id === agrupar) ? agrupar : 'planta';
    if (modo === 'planta' && !hayPlanta && hayZona) modo = 'zona';
    const [, , grupoDe] = AGRUPAR.find(([id]) => id === modo) || AGRUPAR[0];
    const sin = (g) => g.startsWith('Sin ');
    const grupos = [...new Set(equipos.map(grupoDe))].sort(modo === 'planta' || modo === 'zona' ? porPlanta
      : (a, b) => sin(a) - sin(b) || a.localeCompare(b, 'es', { numeric: true }));
    const subPor = !hayPlanta && hayZona ? 'zona' : 'planta';
    $app.innerHTML = `
      ${kpisCx(t, conj)}
      ${window.BUSCADOR_MOVIL.campo({ placeholder: 'Buscar TAG, sala, planta, tipo o marca', valor: filtro, atributo: 'data-cx-buscar' })}
      <div class="agrupar" role="group" aria-label="Agrupar por"><span>Agrupar por</span>${opciones
        .map(([id, texto]) => `<button data-cx-agrupar="${id}" aria-pressed="${modo === id}" class="${modo === id ? 'activa' : ''}">${texto}</button>`).join('')}</div>
      <p class="leyenda-franja" aria-label="Franja de estado de cada equipo"><span><i class="m-firma"></i>Falta firma</span><span><i class="m-docs"></i>Faltan docs</span><span><i class="m-ambos"></i>Ambos</span><span><i class="m-completo"></i>Completo</span></p>
      ${window.CX_PLANO_EQUIPOS ? '<button class="enlace" data-cx="plano-equipos">Ver los equipos en el plano</button>' : ''}
      ${equipos.length ? C.listaAgrupada(`cx-equipos-${modo}`, equipos, {
        grupo: grupoDe, orden: grupos, buscando: !!q, repintar: pintarLista, cabecera: cabeceraGrupo,
        /* «Por plantas pero en los desplegables de los equipos» (JC, 28-oct): al agrupar por tipo o marca, cada grupo sale por planta. */
        ...(modo === 'planta' || modo === 'zona' ? {} : { subgrupo: subPor === 'zona' ? (e) => e.zona || 'Sin zona' : (e) => e.planta || 'Sin planta', subOrden: porPlanta, subCabecera: cabeceraPlanta }),
        fila: (e) => `
        <li${e.franja ? ` class="franja-${e.franja}"` : ''}><button class="fila-ios" data-cx="equipo" data-id="${esc(e.id)}">
          <div class="fila-principal">
            ${tagsFila(e)}
            ${chipEnvio(e.envio, e.completo, e.ensayoFalta)}
          </div>
          <div class="sub">${[NOMBRE_CLASE[e.clase], e.planta, e.local, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean)
            /* Cada trozo entero: a 390 px se parte entre trozos, no en «U-|71PZH3E5». */
            .map((x) => `<span class="trozo">${esc(x)}</span>`).join(' · ') || 'Sin datos'}</div>
          ${serieFila(e)}
          ${e.bocas ? `<div class="progreso" aria-label="${e.medidas} de ${e.bocas} bocas medidas"><i style="width:${Math.round((e.medidas / e.bocas) * 100)}%"></i></div>
          <div class="sub">${cifra(e.medidas)} de ${cifra(e.bocas)} bocas medidas</div>` : e.conPlano === false ? '' : '<div class="sub">Sin plano de bocas</div>'}
          ${e.bloqueadoPor ? `<div class="sub aviso">Bloqueado por ${esc(e.bloqueadoPor.codigo)}</div>` : faltasDe(e).length ? `<div class="sub aviso">Falta: ${esc(faltasDe(e).join(', '))}</div>` : ''}
        </button></li>` }) : `<p class="vacio">${q || segmento !== 'todos' ? 'Ningún equipo con ese filtro.' : 'Esta obra no tiene equipos dados de alta.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. La ficha */

  /* Vuelta al plano de equipos tal y como se dejó (planoEquipos.js guarda la vista). */
  function volverAlPlano() {
    origenPlano = false; directoPlano = false; hojaDirecta = false;
    ficha = null; hoja = null; fichasEq = null; pilaEquipos = [];
    document.body.classList.remove('sin-scroll');
    if (window.CX_PLANO_EQUIPOS) window.CX_PLANO_EQUIPOS.volver($app); else cargarLista();
  }

  /*
   * IR DESDE EL PLANO A LO QUE EL EQUIPO NECESITA (29-oct, JC). El plano dice
   * qué botones salen (shared/commissioning/planoEquipos.js, con las reglas de
   * siempre); aquí cada uno abre la pantalla que ya existía, sin formularios
   * nuevos: «datos» (la toma de datos de las fichas, con lo que falta a la
   * vista), «checklist» y «estanqueidad» (su hoja), «balanceo» (como el botón
   * del equipo) y «equipo» (la ficha completa).
   */
  async function irA(id, accion) {
    origenPlano = true; directoPlano = accion !== 'equipo'; hojaDirecta = false;
    ficha = null; fichasEq = null;
    await abrir(id);
    if (!ficha || ficha.equipo.id !== id || accion === 'equipo') return;
    await cargarFichas(id);
    if (!ficha || ficha.equipo.id !== id) return;
    const fs = (fichasEq && fichasEq.fichas) || [];
    const buscar = (clases) => fs.findIndex((x) => clases.includes(x.clase) && !x.conservada && x.plantilla);
    if (accion === 'balanceo') {
      const i = hojaUnicaBalanceo();
      if (i >= 0) { balDirecto = true; hojaDirecta = true; abrirHoja(i); return; }
      pestanaEq = 'balanceo'; pintarFicha(); window.scrollTo(0, 0);
    } else if (accion === 'checklist' || accion === 'estanqueidad') {
      const i = buscar(accion === 'checklist' ? ['checklist'] : ['estanqRefrigerante', 'estanqAgua']);
      if (i >= 0) { hojaDirecta = true; abrirHoja(i); return; }
      C.aviso(accion === 'checklist' ? 'Este equipo aún no tiene el checklist.' : 'Este equipo aún no tiene la ficha de estanqueidad.');
    } else if (accion === 'datos') {
      document.body.classList.remove('sin-scroll');
      pestanaEq = 'fichas'; pintarFicha(); window.scrollTo(0, 0);
      await cargarTomas(id);
      /* Al primer dato que falta. */
      setTimeout(() => {
        const campos = [...document.querySelectorAll('#toma-datos input, #toma-datos select, #toma-datos textarea')];
        const vacio = campos.find((c) => c.type !== 'hidden' && c.type !== 'checkbox' && !c.disabled && !String(c.value || '').trim());
        if (vacio) vacio.scrollIntoView({ block: 'center' });
      }, 120);
    }
  }
  window.CX_COMMISSIONING_IR = (id, accion) => irA(id, accion);

  async function abrir(id, { quieto = false } = {}) {
    /* quieto: se repinta el mismo equipo (llegó algo de la oficina) sin moverse de donde estaba. */
    const y = window.scrollY;
    if (!quieto) $app.innerHTML = '<p class="cargando">Cargando el equipo…</p>';
    try {
      const r = await C.pedir(`api/equipo?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      /*
       * EL REPINTADO EN SILENCIO NO CIERRA UNA HOJA (JC, 28-oct). Tras guardar la
       * toma de datos de un split, la nube trae algo, se repinta el equipo en
       * silencio y, si mientras se esperaba la respuesta se había abierto el
       * checklist, aquí se anulaba la hoja: lo marcado se perdía sin aviso y la
       * pantalla del equipo decía «Todo guardado». Con una hoja abierta (o
       * abriéndose) solo se refresca el equipo de fondo; la hoja sigue.
       */
      if (quieto && (hoja || abriendoHoja)) {
        if (ficha && ficha.equipo.id === r.equipo.id) ficha = r;
        return;
      }
      if (!ficha || ficha.equipo.id !== r.equipo.id) { pestanaEq = 'equipo'; circuitoBal = 'impulsion'; balDirecto = false; firmando = firmaAMedias(r.equipo.id); }
      ficha = r;
      hoja = null;
      fichasEq = null;
      /* Lo leído antes puede haber cambiado (llegó algo de la oficina): se vuelve
         a pedir. Lo tecleado y sin guardar se queda. */
      for (const [k, t] of tomas) if (!t.cambiada) tomas.delete(k);
      pintarFicha();
      window.scrollTo(0, quieto ? y : 0);
      cargarFichas(id);
    } catch (e) { C.aviso(e.message); cargarLista(); }
  }

  /* El equipo otra vez del servidor, sin tocar lo demás (fichas, tomas, pestaña). */
  async function refrescarEquipo(id) {
    try {
      const r = await C.pedir(`api/equipo?id=${encodeURIComponent(id)}`);
      if (!r.ok || !ficha || ficha.equipo.id !== id) return;
      ficha = r;
      if (activa() && !hoja && !abriendoHoja && !firmando && !escribiendoEnApp()) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    } catch { /* sin red: se queda lo que había y las fotos de la cola */ }
  }

  async function cargarFichas(id) {
    try {
      const r = await C.pedir(`api/fichas?equipo=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      fichasEq = r;
    } catch (e) { fichasEq = { ok: false, error: e.message, fichas: [] }; }
    if (activa() && ficha && !hoja && !firmando && ficha.equipo.id === id && !escribiendoEnApp()) {
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    }
    cargarTomas(id);
  }

  function totalCircuito(c, nombre, tol) {
    if (!c || c.estado === 'sinPuntos') return '';
    /* El total contra lo mismo que la hoja de balanceo (el resumen lo dice). */
    const diseno = c.disenoReferencia ?? c.disenoPuntos ?? c.disenoEquipo ?? null;
    const p = c.desviacion === null || c.desviacion === undefined ? null : pct(c.suma, diseno);
    const clase = (c.estado === 'ok' || c.estado === 'dentro') ? 'bien' : c.estado === 'alto' ? 'alto' : c.estado === 'bajo' ? 'mal' : 'neutra';
    /* Con bocas por medir no hay juicio del total (puede faltar caudal), salvo por arriba: si lo medido ya pasa
       el proyecto más su tolerancia, va morado aunque falten bocas (25-oct, JC: el total medido en color). */
    const tolT = tol && tol.total ? tol.total : 0.1;
    const yaPasa = c.estado === 'incompleto' && diseno && c.suma !== null && c.suma !== undefined && c.suma > diseno * (1 + tolT);
    const claseTotal = yaPasa ? 'alto' : clase;
    return `<div class="total-circuito ${claseTotal}">
      <div class="fila-principal"><strong>${esc(nombre)}</strong><span class="chip ${claseTotal}">${p === null ? `${c.medidos}/${c.puntos} medidas` : `${p} %`}</span></div>
      <div class="cifras-total">
        <div><span>Medido</span><b>${cifra(c.suma)}</b><em>m³/h</em></div>
        <div><span>Proyecto</span><b>${cifra(diseno)}</b><em>m³/h</em></div>
        <div><span>Bocas</span><b>${cifra(c.medidos)}/${cifra(c.puntos)}</b></div>
      </div>
      ${c.faltan ? `<div class="sub">Faltan ${c.faltan} boca${c.faltan === 1 ? '' : 's'} por medir.</div>` : ''}
    </div>`;
  }

  /*
   * EL TAG SIEMPRE A LA VISTA (15-oct-2026): una franja fina pegada debajo
   * de la cabecera con volver, el TAG y lo que se está viendo; se queda
   * arriba al bajar por la hoja. Toda la franja vuelve atrás, no solo la
   * flecha (JC, 16-oct): se pulsa el TAG y se sale a la pantalla anterior.
   */
  function tagFijo(tag, que, volver, extra = '') {
    requestAnimationFrame(altoBarra);
    return `<div class="tag-fijo" data-cx="${esc(volver)}" role="button" aria-label="Volver">
      <span class="volver" aria-hidden="true">‹</span>
      <strong class="cifra">${esc(tag)}</strong>
      <span class="que">${esc(que || '')}</span>
      ${extra ? `<span class="extra">${extra}</span>` : ''}
    </div>`;
  }
  /* La franja se pega justo debajo de la cabecera de la app, mida lo que mida. */
  function altoBarra() {
    const b = document.querySelector('header.barra');
    if (b) document.documentElement.style.setProperty('--alto-barra', `${b.offsetHeight}px`);
  }

  /* Los estados llegan como códigos ('enMarcha', 'aptoSinBocas'): se dicen con palabras. */
  const NOMBRE_ESTADO = {
    pendiente: 'Pendiente', programada: 'Programada', enProceso: 'En proceso', enMarcha: 'En marcha', hecha: 'Hecha',
    conReservas: 'Con reservas', pendienteFichaPM: 'Pendiente de ficha PM', faltaHojaFabricante: 'Falta hoja del fabricante', apto: 'Apto', aptoSinBocas: 'Apto (sin bocas)', noApto: 'No apto', noAplica: 'No aplica',
  };
  const nombreEstado = (v) => NOMBRE_ESTADO[v] || v;

  /*
   * INCIDENCIAS DEL EQUIPO (29-oct, JC): con una incidencia abierta no se toman datos
   * (la regla manda el servidor; aquí solo se explica y se ocultan los controles),
   * al terminarla o cerrarla el equipo pide «Validado tras incidencia», y desde la ficha
   * se abre una incidencia nueva ya rellena.
   */
  const bloqueosDe = (f) => ((f && f.incidenciaEquipo && f.incidenciaEquipo.bloqueo) || []);
  const fechaCorta = (v) => esc(String(v || '').slice(0, 10).split('-').reverse().join('/'));
  function htmlIncidenciaEquipo(f) {
    const inc = f.incidenciaEquipo;
    if (!inc) return '';
    const bl = inc.bloqueo || [];
    const lineas = bl.map((b) => `<p class="nota inc-aviso bloqueo-inc">Bloqueado por <button type="button" class="enlace" data-cx="ir-incidencia" data-id="${esc(b.id)}">${esc(b.codigo)}${b.titulo ? ` · ${esc(b.titulo)}` : ''}</button>. No se pueden tomar datos hasta que se termine o se cierre.</p>`);
    if (inc.revalidar) {
      lineas.push(`<p class="nota inc-aviso revalidar-inc">Revalidar tras ${esc(inc.revalidar.tras)}${inc.revalidar.desde ? ` <span class="tenue">· desde el ${fechaCorta(inc.revalidar.desde)}</span>` : ''}${inc.puedeValidar ? ` <button type="button" class="boton secundario" data-cx="validar-tras-inc">Validado tras incidencia</button>` : ''}</p>`);
    } else if (inc.ultimaValidacion) {
      const u = inc.ultimaValidacion;
      lineas.push(`<p class="nota tenue">Validado tras ${esc(u.tras)}${u.en ? ` el ${fechaCorta(u.en)}` : ''}${u.por ? ` · ${esc(u.por)}` : ''}</p>`);
    }
    if (inc.puedeCrear) lineas.push('<div class="fila-botones"><button type="button" class="boton secundario" data-cx="crear-incidencia">Crear incidencia</button></div>');
    return lineas.length ? `<section id="incidencias-equipo">${lineas.join('')}</section>` : '';
  }
  /* «Crear incidencia»: el alta de reparaciones, ya con el equipo, su conjunto, planta y sala. */
  function crearIncidencia() {
    const e = ficha && ficha.equipo;
    if (!e) return;
    const cj = ficha.conjunto;
    const sala = ((cj && cj.unidades) || []).map((u) => u.sala).find(Boolean) || e.sala || '';
    const prefill = {
      equipoId: e.id, tag: e.tag, planta: e.planta || '', zona: e.zona || '', ubicacion: sala || '',
      unidades: ((cj && cj.unidades) || []).map((u) => ({ id: u.id, tag: u.tag, papel: u.papel })),
      volverA: e.id,
    };
    try { sessionStorage.setItem('reparaciones.prefill', JSON.stringify(prefill)); } catch { /* sin almacén */ }
    if (C.hacer) C.hacer({ seccion: 'reparaciones', pasos: ['[data-rp="nueva"]'] });
    else location.hash = 'reparaciones';
  }
  async function validarTrasIncidencia(boton) {
    if (!ficha) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/equipo/revalidar', { equipoId: ficha.equipo.id });
      if (!r.ok) throw new Error(r.error);
      C.aviso(`Validado tras ${r.tras}.`, 'bien');
      await abrir(ficha.equipo.id, { quieto: true });
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }
  function irIncidencia(id) {
    try { sessionStorage.setItem('cx.abrir', id); } catch { /* sin almacén */ }
    location.hash = 'reparaciones';
  }

  function checklist(k, med, puede = false) {
    if (!k) return '';
    /* Sin fila «Ensayo» (16-oct, JC): el balanceo y la estanqueidad salen solo
       si el equipo los lleva. Un split o una enfriadora no llevan balanceo de bocas. */
    const req = k.ensayoRequerido || 'ninguno';
    const sinBal = med && !med.plano && (!k.balanceoEstado || k.balanceoEstado === 'pendiente');
    const pideBal = (req === 'balanceo' || req === 'ambos') && !sinBal;
    const pideEst = req === 'estanqueidad' || req === 'ambos' || Boolean(k.estanqueidad);
    const si = (v) => (v ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');
    const est = k.estanqueidad
      ? (typeof k.estanqueidad === 'object' ? (k.estanqueidad.resultado || k.estanqueidad.estado || '✓') : k.estanqueidad)
      : (k.estanqueidadEstado || 'pendiente');
    const fila = (n, v) => `<div class="fd"><span class="et">${n}</span>${v}</div>`;
    return `<h3 class="banda">Documentación y estado</h3>
      <section class="hoja-tabla rejilla-datos estado-eq">
        ${fila('Instalación', k.instalada
          ? `<strong>Verificada</strong>${k.instalacionVerificadaEn ? ` <span class="tenue">${esc(String(k.instalacionVerificadaEn).slice(0, 10).split('-').reverse().join('/'))}${k.instalacionVerificadaPor ? ` · ${esc(k.instalacionVerificadaPor)}` : ''}</span>` : ''}`
          : (puede ? '<button class="enlace" data-cx="verificar-instalacion">Marcar verificada</button>' : '<span class="no">Sin verificar</span>'))}
        ${fila('Ficha técnica', si(k.ft))}
        ${fila('Certificado CE', si(k.ce))}
        ${fila('Manual', si(k.manual))}
        ${fila('Ficha PM', si(k.fichaPM))}
        ${pideBal ? fila('Balanceo', `<strong>${esc(nombreEstado(k.balanceoEstado || 'pendiente'))}</strong>`) : ''}
        ${pideEst ? fila('Estanqueidad', `<strong>${esc(nombreEstado(est))}</strong>`) : ''}
        ${fila('Puesta en marcha', `<strong class="${TONO_PM[k.estadoPM] || ''}">${esc(k.estadoPM ? nombreEstado(k.estadoPM) : '—')}</strong>`)}
        ${htmlFechasEquipo(k, puede, fila)}
        ${htmlFirmas(puede)}
      </section>
      ${firmando ? htmlLienzoFirma() : ''}
      ${htmlIncidenciasEquipo(k.incidencias || [])}`;
  }

  /* «En marcha» solo con la ficha PM hecha y la hoja del fabricante en el
     SharePoint (29-oct, JC); sin amarillo: el aviso, en azul. */
  const TONO_PM = { enMarcha: 'ok', faltaHojaFabricante: 'aviso', conReservas: 'aviso' };
  /* La fecha de puesta en marcha (para el mantenimiento) y la garantía, que
     cuenta desde la entrega a DF (29-oct, JC). Las corrige quien edita la ficha. */
  /* Desde el 29-oct también en la app del teléfono (Vidaire Cx, sin el Mac):
     la fecha y la garantía son campos de obra del equipo (paquete.js ›
     CAMPOS_VUELTA) y suben a la nube por cx_filas (migración 0014). */
  function htmlFechasEquipo(k, puedeFicha, fila) {
    const puede = puedeFicha;
    const fpm = k.fechaPuestaMarcha ? String(k.fechaPuestaMarcha).slice(0, 10) : '';
    const g = k.garantia || { texto: 'Garantía: sin empezar (pendiente de entrega a DF)' };
    const textoG = esc(String(g.texto || '').replace(/^Garantía:\s*/, ''));
    const anios = k.garantiaAnios ?? '';
    return `${fila('Fecha de puesta en marcha', puede
      ? `<input type="date" class="fecha-eq" data-cx-fechas="fechaPuestaMarcha" value="${esc(fpm)}" aria-label="Fecha de puesta en marcha">`
      : `<strong>${fpm ? fechaCorta(fpm) : '—'}</strong>`)}
      ${fila('Garantía', `<span class="garantia-eq"><span class="${g.estado === 'sinEmpezar' ? 'tenue' : g.estado === 'vencida' ? 'aviso' : ''}">${textoG}</span>${puede
        ? ` <input type="number" class="anios-eq" inputmode="decimal" min="0" max="50" step="0.5" data-cx-fechas="garantiaAnios" value="${esc(String(anios))}" placeholder="años" aria-label="Años de garantía"> <span class="tenue">años</span>`
        : (anios ? ` <span class="tenue">· ${esc(String(anios))} años</span>` : '')}</span>`)}`;
  }
  async function guardarFechasEquipo(campo, valor) {
    try {
      const r = await C.postJson('api/equipo/fechas', { equipoId: ficha.equipo.id, [campo]: valor === '' ? null : valor });
      if (!r.ok) throw new Error(r.error);
      await abrir(ficha.equipo.id, { quieto: true });
    } catch (e) { C.aviso(e.message); }
  }

  /*
   * LAS FIRMAS DEL EQUIPO (JC, 28-oct-2026): la del jefe de obra y la del
   * cliente, con el dedo, en el propio móvil. Se guardan con el equipo (en un
   * split o un VRF, para todo el conjunto) y salen en los PDF del checklist,
   * la ficha de PM, el balanceo y la estanqueidad. Volver a firmar sustituye.
   */
  /* Los campos de las dos firmas son la pieza común renderer/movil/firmaDoble.js:
     técnico responsable (quien ha entrado) y la otra con su cargo (Cliente, DF, DEO, otro). */
  const FD = window.CX_FIRMA || { /* sin la pieza (pruebas que cargan solo este fichero) */
    rotulo: (r) => (r === 'jefeObra' ? 'Técnico responsable' : 'Firma de conformidad'),
    textoHecha: (f) => (f ? [f.nombre, f.cargo].filter(Boolean).join(' · ') : ''),
    htmlCampos: () => '<input type="text" data-firma-nombre>', enlazar: () => {},
    leer: (r) => ({ nombre: (((r && r.querySelector('[data-firma-nombre]')) || {}).value || '').trim(), cargo: null }),
    falta: (rol, c) => (c.nombre ? null : 'Falta el nombre de quien firma.'),
  };
  const ROTULO_FIRMA = { jefeObra: FD.rotulo('jefeObra'), cliente: FD.rotulo('cliente') };
  let firmando = null; /* 'jefeObra' | 'cliente' mientras se firma */
  let trazado = false;
  let firmaSinPintar = null; /* la firma a medias recuperada, mientras se pinta en el lienzo */
  function htmlFirmas(puede) {
    const fs = (ficha && ficha.firmas) || {};
    return ['jefeObra', 'cliente'].map((rol) => {
      const f = fs[rol];
      const fecha = f && f.fecha ? String(f.fecha).slice(0, 10).split('-').reverse().join('/') : '';
      const valor = f
        ? `<span class="firma-hecha"><img src="${esc(f.imagen)}" alt="Firma de ${esc(f.nombre)}"><span class="tenue">${esc(FD.textoHecha(f) || fecha)}</span></span>${puede ? ` <button class="enlace" data-cx="firmar" data-rol="${rol}">Volver a firmar</button>` : ''}`
        : (puede ? `<button class="enlace" data-cx="firmar" data-rol="${rol}">Firmar</button>` : '<span class="no">Sin firmar</span>');
      return `<div class="fd firma-fd"><span class="et">${ROTULO_FIRMA[rol]}</span><span class="firma-valor">${valor}</span></div>`;
    }).join('');
  }
  function htmlLienzoFirma() {
    const previa = ((ficha && ficha.firmas) || {})[firmando];
    const medias = AG && ficha ? AG.leer(claveFirma(ficha.equipo.id, firmando)) : null;
    return `<section class="firma-lienzo" data-firma="${firmando}">
      <h3 class="banda">${ROTULO_FIRMA[firmando]}</h3>
      ${FD.htmlCampos(firmando, { previa, medias })}
      <canvas width="600" height="200" data-firma-lienzo aria-label="Firme aquí con el dedo"></canvas>
      <p class="nota">Firme dentro del recuadro con el dedo. ${marcaAG(AG && ficha && AG.leer(claveFirma(ficha.equipo.id, firmando)) ? 'movil' : '')}</p>
      <div class="fila-botones">
        <button class="boton" data-cx="guardar-firma">Firmar</button>
        <button class="boton secundario" data-cx="limpiar-firma">Borrar trazo</button>
        <button class="boton secundario" data-cx="cancelar-firma">Cancelar</button>
        ${previa ? '<button class="enlace mal" data-cx="quitar-firma">Quitar la firma guardada</button>' : ''}
      </div>
    </section>`;
  }
  function prepararLienzo() {
    const cv = $app.querySelector('[data-firma-lienzo]');
    if (!cv) return;
    FD.enlazar($app.querySelector('.firma-lienzo'));
    const cx = cv.getContext('2d');
    cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#0F5F56';
    trazado = false;
    let ultimo = null;
    const punto = (ev) => { const r = cv.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * cv.width, y: ((ev.clientY - r.top) / r.height) * cv.height }; };
    cv.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (cv.dataset.guardada) return; try { cv.setPointerCapture(ev.pointerId); } catch { /* sin captura */ } ultimo = punto(ev); cx.beginPath(); cx.arc(ultimo.x, ultimo.y, 1.5, 0, Math.PI * 2); cx.fillStyle = cx.strokeStyle; cx.fill(); trazado = true; });
    cv.addEventListener('pointermove', (ev) => {
      if (!ultimo) return;
      ev.preventDefault();
      const p = punto(ev);
      cx.beginPath(); cx.moveTo(ultimo.x, ultimo.y); cx.lineTo(p.x, p.y); cx.stroke();
      ultimo = p;
    });
    const fin = () => { if (ultimo) apuntarFirma(); ultimo = null; };
    /* Lo firmado a medias (atrás, otra pestaña, app cerrada) vuelve al lienzo. */
    const b = AG && ficha ? AG.leer(claveFirma(ficha.equipo.id, firmando)) : null;
    if (b && b.imagen && typeof Image !== 'undefined') {
      const img = new Image();
      firmaSinPintar = b.imagen;
      img.onload = () => { try { cx.drawImage(img, 0, 0, cv.width, cv.height); } catch { /* nada */ } firmaSinPintar = null; };
      img.src = b.imagen;
      trazado = true;
    }
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', fin);
    /* Su firma ya hecha, puesta (solo el técnico responsable y si no hay nada a medias). */
    if (!(b && b.imagen)) FD.aplicar(cv, firmando, { pintado: () => trazado }).then((puesta) => { if (puesta) trazado = true; });
  }
  /*
   * LA FIRMA A MEDIAS NO SE PIERDE (JC, 28-oct): el nombre y el trazo se
   * apuntan en el teléfono al levantar el dedo o al escribir; al volver al
   * equipo, el lienzo sale abierto con lo que había. Guardarla sigue siendo
   * un gesto de quien firma («Guardar firma»): no se firma sola.
   */
  const claveFirma = (equipoId, rol) => `firma.${equipoId}.${rol}`;
  function firmaAMedias(equipoId) {
    if (!AG) return null;
    return ['jefeObra', 'cliente'].find((rol) => AG.leer(claveFirma(equipoId, rol))) || null;
  }
  function apuntarFirma() {
    if (!AG || !ficha || !firmando) return;
    const cv = $app.querySelector('[data-firma-lienzo]');
    const { nombre, cargo } = FD.leer($app.querySelector('.firma-lienzo'));
    let imagen = null;
    try { imagen = firmaSinPintar || (trazado && cv ? cv.toDataURL('image/png') : null); } catch { /* sin lienzo */ }
    if (!imagen && !nombre.trim()) { AG.olvidar(claveFirma(ficha.equipo.id, firmando)); return; }
    AG.guardar(claveFirma(ficha.equipo.id, firmando), { nombre, cargo, imagen });
    const m = $app.querySelector('.firma-lienzo .autoguardado');
    if (m) { m.className = 'autoguardado movil'; m.textContent = TEXTO_AG.movil; }
  }
  function abrirFirma(rol) {
    firmando = rol;
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
    const sec = $app.querySelector('.firma-lienzo');
    if (sec) sec.scrollIntoView({ block: 'center' });
  }
  function cerrarFirma({ olvidar = false } = {}) {
    if (olvidar && AG && ficha && firmando) AG.olvidar(claveFirma(ficha.equipo.id, firmando));
    firmando = null;
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
  }
  async function guardarFirma(boton, quitar = false) {
    if (!ficha || !firmando) return;
    const campos = FD.leer($app.querySelector('.firma-lienzo'));
    const { nombre, cargo } = campos;
    const cv = $app.querySelector('[data-firma-lienzo]');
    if (!quitar) {
      const f = FD.falta(firmando, campos);
      if (f) { C.aviso(f); return; }
      if (!trazado || !cv) { C.aviso('Firme en el recuadro antes de guardar.'); return; }
    }
    const propia = quitar ? {} : FD.alFirmar(cv, nombre);
    if (propia.error) { C.aviso(propia.error); return; }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/equipo/firma', quitar
        ? { equipoId: ficha.equipo.id, rol: firmando, quitar: true }
        : { equipoId: ficha.equipo.id, rol: firmando, nombre: nombre.trim(), cargo: firmando === 'cliente' ? cargo : undefined, ...(propia.usarGuardada ? { usarGuardada: true } : { imagen: cv.toDataURL('image/png') }) });
      if (!r.ok) throw new Error(r.error);
      ficha.firmas = r.firmas;
      C.aviso(quitar ? 'Firma quitada' : 'Firma guardada', 'bien');
      cerrarFirma({ olvidar: true });
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  /*
   * «MODELO SIN DAR DE ALTA» CON ACCIÓN (revisión UX 18-oct, 4): el aviso
   * decía el problema y no quién lo arregla. Lo da de alta la oficina, en el
   * ordenador (Commissioning › «Dar de alta los modelos que faltan»); desde
   * aquí se le avisa con un parte de incidencia ya relleno con el equipo.
   */
  function htmlIncidenciasEquipo(inc) {
    if (!inc.length) return '';
    const resto = inc.filter((i) => i !== 'modeloSinAlta');
    return `${resto.length ? `<p class="nota aviso">${esc(resto.map((i) => INCIDENCIA[i] || i).join(' · '))}</p>` : ''}
      ${inc.includes('modeloSinAlta') ? `<p class="nota aviso">${INCIDENCIA.modeloSinAlta}: lo da de alta la oficina en el ordenador (Commissioning › «Dar de alta los modelos que faltan»). <button class="enlace" data-cx="avisar-modelo">Avisar con un parte</button></p>` : ''}`;
  }
  function avisarModelo() {
    const e = ficha && ficha.equipo;
    if (!e) return;
    const modelo = [e.marca, e.modelo].filter(Boolean).join(' ') || 'sin marca ni modelo en la lista';
    const prefill = {
      tipo: 'otros',
      titulo: `Dar de alta el modelo ${modelo}`.slice(0, 120),
      descripcion: `El equipo ${e.tag || ''}${e.planta ? ` (${e.planta})` : ''} es ${modelo} y ese modelo no está dado de alta en Commissioning: no se le puede enlazar la ficha técnica, el CE ni el manual. Hay que darlo de alta en el ordenador (Commissioning › «Dar de alta los modelos que faltan»).`,
      gravedad: 'baja',
    };
    try { sessionStorage.setItem('partes.prefill', JSON.stringify(prefill)); } catch { /* sin almacén */ }
    if (C.hacer) C.hacer({ seccion: 'partes', pasos: ['[data-pi="nuevo"]'] });
    else location.hash = 'partes';
  }

  /*
   * LA FICHA DEL EQUIPO, sin pestañas (15-oct-2026, JC: «Estanqueidad y
   * balanceo muévelas a fichas del equipo»). La estanqueidad es una ficha más
   * de la lista; el balanceo, una fila de esa lista que abre las bocas y su
   * hoja. Mientras se ve un equipo, el selector de arriba se esconde.
   */
  let pestanaEq = 'equipo';
  let circuitoBal = 'impulsion'; /* en el balanceo: 'impulsion' | 'retorno' */
  const esRetorno = (b) => b.circuito === 'retorno';
  const pestanaDeFicha = (x) => (x.clase === 'balanceo' ? 'balanceo' : 'equipo');
  let balDirecto = false; /* la hoja de balanceo se abrió directamente: al salir, al equipo */
  /* Hay bocas que medir en el teléfono: un plano subido sin bocas dibujadas no
     enseña nada en la pantalla del balanceo (ni plano ni lista), así que cuenta
     como sin plano. */
  const hayBocas = (f) => (f && f.planos ? f.planos : []).some((p) => (p.bocas || []).length);
  /* Índice de la única hoja de balanceo (con plantilla) si el equipo no tiene bocas que medir; si no, -1.
     Con bocas la pantalla del balanceo es trabajo de verdad (el plano y su lista de bocas),
     no un paso intermedio: se queda (JC, 29-oct). */
  function hojaUnicaBalanceo() {
    if (!ficha || !fichasEq || fichasEq.ok === false || hayBocas(ficha)) return -1;
    const hs = (fichasEq.fichas || []).map((x, i) => [x, i]).filter(([x]) => !x.conservada && x.clase === 'balanceo');
    return hs.length === 1 && hs[0][0].plantilla ? hs[0][1] : -1;
  }
  function tieneBalanceo(f) {
    /* Lo que se mide de su familia manda (15-oct-2026): un split no enseña un
       balanceo vacío y un fan coil de conductos sí lo enseña. Un plano que ya
       tenga bocas se enseña siempre. */
    if (f.planos.length) return true;
    if (f.medicion) return Boolean(f.medicion.plano);
    const fs = (fichasEq && fichasEq.fichas) || [];
    const req = f.checklist ? f.checklist.ensayoRequerido : null;
    return fs.some((x) => x.clase === 'balanceo') || f.planos.length > 0 || req === 'balanceo' || req === 'ambos';
  }

  /*
   * SIN PLANO EN EL TELÉFONO (15-oct-2026, JC: «Sí que hay plano de bocas»).
   * El plano se dibuja en el ordenador y llega por la nube: si este teléfono
   * aún no ha entrado o no tiene red, no se dice «no tiene plano», se dice
   * qué falta para que llegue.
   */
  function sinPlano() {
    const s = window.cxObra && window.cxObra.sync && window.cxObra.sync.activa ? window.cxObra.sync : null;
    const e = s ? s.estado() : null;
    if (e && (!e.entrado || e.estado === 'sin-sesion')) {
      /* Sin botón de entrar (15-oct-2026, JC: «siempre conectado»): el teléfono entra solo. */
      return `<p class="cargando">Conectando con la oficina para traer el plano…</p>
        <button class="boton secundario" data-cx="nube-ahora">Volver a intentarlo</button>`;
    }
    if (e && (e.estado === 'sin-red' || e.estado === 'error')) {
      return `<p class="nota aviso">${e.estado === 'sin-red' ? 'Sin conexión con la oficina' : 'No se ha podido hablar con la oficina'}: si el plano ya está dibujado en el ordenador, llegará en cuanto vuelva la red.</p>
        <button class="boton secundario" data-cx="nube-ahora">Volver a intentarlo</button>`;
    }
    if (e && e.estado === 'sincronizando') return '<p class="cargando">Trayendo los datos de la oficina…</p>';
    return `<p class="vacio">Este equipo todavía no tiene plano de bocas en la oficina: se dibuja en el ordenador (Commissioning › Balanceo) y aparece aquí solo.</p>
      ${s ? '<button class="boton secundario" data-cx="nube-ahora">Comprobar ahora</button>' : ''}`;
  }

  function pintarFicha() {
    const f = ficha;
    const e = f.equipo;
    const puede = f.puedeMedir;
    /* Con una incidencia abierta: se ven las hojas y se hacen fotos, pero no se toman datos. */
    const puedeToma = puede && !bloqueosDe(f).length;
    if (pestanaEq === 'balanceo' && !tieneBalanceo(f)) pestanaEq = 'equipo';
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = true;
    const med = f.medicion || {};
    /* Impulsión | Retorno (16-oct-2026, JC): dos botones arriba y la lista
       de bocas solo del circuito elegido. Si el equipo solo tiene un
       circuito, no hay botones y sale todo. El plano, en cambio, enseña
       siempre todas (19-oct-2026, JC: «Faltan las rejas de retorno»): las
       del otro circuito, apagadas; tocar una cambia de circuito y la abre. */
    const todas = f.planos.flatMap((p) => p.bocas);
    const nRet = todas.filter(esRetorno).length;
    const hayDos = nRet > 0 && nRet < todas.length;
    const circ = hayDos ? circuitoBal : null;
    const delCircuito = (b) => !circ || (circ === 'retorno') === esRetorno(b);
    const nombreRet = med.retorno || 'Retorno';
    const cuenta = (ret) => { const bs = todas.filter((b) => esRetorno(b) === ret); return `${bs.filter((b) => b.caudal !== null && b.caudal !== undefined).length}/${bs.length}`; };
    const planosVistos = f.planos.map((p) => ({ ...p, todas: p.bocas, bocas: p.bocas.filter(delCircuito) })).filter((p) => p.bocas.length);
    const balanceo = () => `
      ${hayDos ? `<div class="segmentado circuito-bal" role="tablist" aria-label="Circuito">${[['impulsion', 'Impulsión', cuenta(false)], ['retorno', nombreRet, cuenta(true)]]
        .map(([id, n, c]) => `<button role="tab" data-cx="circuito-bal" data-circuito="${id}" aria-selected="${circ === id}" class="${circ === id ? 'activa' : ''}">${esc(n)} <small>${c}</small></button>`).join('')}</div>` : ''}
      ${htmlCrono()}
      ${circ !== 'retorno' ? totalCircuito(f.circuitos && f.circuitos.impulsion, 'Impulsión', f.tolerancias) : ''}
      ${circ !== 'impulsion' ? totalCircuito(f.circuitos && f.circuitos.retorno, nombreRet, f.tolerancias) : ''}
      ${med.velocidad ? `<p class="nota">Una medida por boca, con el equipo a velocidad ${esc(med.velocidad)}.</p>` : ''}
      ${f.planos.length ? planosVistos.map((p) => `
        <h2>${esc(p.nombre)} <span class="cuenta">${p.bocas.length} boca${p.bocas.length === 1 ? '' : 's'}${circ ? ` de ${circ === 'retorno' ? esc(nombreRet.toLowerCase()) : 'impulsión'}` : ''}</span></h2>
        ${htmlPlano(p, circ ? delCircuito : null)}
        <ul class="bocas">${p.bocas.map((b) => htmlBoca(p, b, puedeToma, f.tolerancias)).join('')}</ul>`).join('') : sinPlano()}
      ${bloqueosDe(f).length ? htmlIncidenciaEquipo(f) : (puede || !f.planos.length ? '' : '<p class="nota">Tu rol puede ver las medidas, pero no tomarlas.</p>')}
      ${f.planos.length ? '<button class="boton secundario" data-cx="pdf-balanceo"><i class="ic ic-doc"></i>Informe del balanceo (PDF)</button>' : ''}
      ${htmlFichas('balanceo', 'Hoja de balanceo')}`;
    /*
     * LA PANTALLA DEL EQUIPO (JC, 28-oct-2026): solo «Fotos del equipo» y
     * «Documentación y estado», y la LISTA numerada de fichas del equipo
     * directamente (checklist, toma de datos, estanqueidad…): cada fila abre su ficha.
     * El conjunto (split, VRF) es un solo commissioning: no salen sus unidades.
     */
    const cuerpo = pestanaEq === 'balanceo' ? balanceo()
      : pestanaEq === 'fichas' ? `${htmlNotaConjunto(f.conjunto)}
      ${htmlIncidenciaEquipo(f)}
      ${htmlFichas('equipo', 'Fichas del equipo')}
      ${htmlTomaDatos()}
      ${htmlConservadas()}`
      : `${htmlNotaConjunto(f.conjunto)}
      ${htmlNumSerie(e, f.conjunto, puede)}
      ${htmlIncidenciaEquipo(f)}
      ${htmlFichas('equipo', 'Fichas del equipo')}
      ${htmlUnidadesInteriores(f, puede)}
      ${htmlFotosEquipo(f, puede)}
      ${checklist(f.checklist, f.medicion, puede)}`;
    const sub = [e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    $app.innerHTML = `
      ${pestanaEq === 'balanceo' ? tagFijo(e.tag, tituloMedicion(f), 'ficha-equipo')
        : pestanaEq === 'fichas' ? tagFijo(e.tag, 'Fichas del equipo', 'ficha-equipo')
        : tagFijo(e.tag, sub, 'atras')}
      <div class="densa">${cuerpo}</div>`;
    C.cargarImagenes($app);
    cargarFotosLocales($app);
    if (firmando) prepararLienzo();
    if (pestanaEq === 'balanceo') { restaurarBocas(); restaurarPlano(); latirCrono(); }
    else { bocaAbierta = null; grandeId = null; document.body.classList.remove('sin-scroll'); }
  }

  /* «Balanceo de caudales», «Caudales de extracción»… según lo que se mide. */
  const tituloMedicion = (f) => (f.medicion && f.medicion.titulo) || 'Balanceo de caudales';
  const claseMarca = (estado) => (estado === 'dentro' || estado === 'ok' ? 'bien' : estado === 'alto' ? 'alto' : estado === 'bajo' ? 'mal' : 'neutra');

  /*
   * EL PLANO CON SUS BOCAS (15-oct-2026, JC: «la imagen del plano con las
   * bocas»): encima de la lista, una marca por boca donde está de verdad,
   * gris sin medir, verde dentro de tolerancia y roja fuera; cambia mientras
   * se teclea. Tocar una lleva a su boca y pone el foco en M1. «Ampliar» lo
   * abre a pantalla completa, con zoom de dos dedos.
   */
  /* La forma de su tipo de difusor o reja (shared/commissioning/simbolosBoca.js). */
  const simbolo = (b) => (window.SIMBOLOS_BOCA ? window.SIMBOLOS_BOCA.svg(b.tipoId, { titulo: b.tipo || '' }) : '');

  function htmlPlano(p, delCircuito) {
    const conSitio = (p.todas || p.bocas).filter((b) => b.x !== null && b.x !== undefined && b.y !== null && b.y !== undefined);
    if (!p.imagen || !conSitio.length) return '';
    return `<figure class="plano-bocas" data-plano-fig="${esc(p.id)}">
      <div class="plano-marco"><div class="plano-lienzo">
        <img data-src="api/equipo/plano?id=${encodeURIComponent(p.id)}" alt="Plano ${esc(p.nombre)}">
        ${conSitio.map((b) => { const otro = delCircuito && !delCircuito(b); return `<button class="marca-boca ${claseMarca(b.estado)}${esRetorno(b) ? ' ret' : ''}${otro ? ' otro-circuito' : ''}" style="left:${(b.x * 100).toFixed(2)}%;top:${(b.y * 100).toFixed(2)}%"
          data-cx="ir-boca" data-boca="${esc(claveBoca(p.id, b.id))}"${otro ? ` data-circuito="${esRetorno(b) ? 'retorno' : 'impulsion'}"` : ''} aria-label="Ir a la boca ${esc(b.nombre)}">${simbolo(b)}<span class="rotulo-boca">${esc(b.nombre)}</span></button>`; }).join('')}
      </div></div>
      <figcaption><span class="leyenda"><i class="neutra"></i>Sin medir <i class="bien"></i>Dentro <i class="mal"></i>Por debajo <i class="alto"></i>Por encima</span>
        <span class="zoom-botones"><button class="enlace" data-cx="zoom-menos" aria-label="Alejar">−</button><button class="enlace" data-cx="zoom-mas" aria-label="Acercar">+</button>
        <button class="enlace" data-cx="plano-grande">Ampliar</button></span></figcaption>
    </figure>`;
  }

  /*
   * ZOOM DE PELLIZCO EN EL PLANO (16-oct-2026, JC: «el plano con zoom de
   * pellizco»). Dos dedos acercan y alejan sobre el punto que se pellizca; con
   * zoom, un dedo arrastra el plano (sin zoom, un dedo sigue moviendo la
   * página). Las marcas no crecen: se separan, y así se leen los rótulos que
   * antes se pisaban. El zoom de cada plano se conserva al guardar una boca.
   */
  const vistas = new Map();   /* planoId → { s, x, y } */
  let grandeId = null;        /* el plano abierto a pantalla completa */
  let bocaAbierta = null;     /* la boca cuya tarjeta está abierta abajo */
  const ZOOM_MAX = 8;

  function limitarVista(fig, v) {
    const marco = fig.querySelector('.plano-marco');
    const lz = fig.querySelector('.plano-lienzo');
    if (!marco || !lz) return v;
    const grande = fig.classList.contains('grande');
    v.s = Math.min(ZOOM_MAX, Math.max(1, v.s));
    const mw = marco.clientWidth, mh = marco.clientHeight;
    const w = lz.offsetWidth * v.s, h = lz.offsetHeight * v.s;
    v.x = w > mw ? Math.min(0, Math.max(mw - w, v.x)) : (mw - w) / 2;
    v.y = h > mh ? Math.min(0, Math.max(mh - h, v.y)) : grande ? (mh - h) / 2 : 0;
    return v;
  }
  function aplicarVista(fig) {
    const id = fig.dataset.planoFig;
    const v = limitarVista(fig, vistas.get(id) || { s: 1, x: 0, y: 0 });
    vistas.set(id, v);
    const lz = fig.querySelector('.plano-lienzo');
    lz.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    lz.style.setProperty('--esc', String(v.s));
    fig.querySelector('.plano-marco').classList.toggle('con-zoom', v.s > 1.001);
  }
  /* Zoom a escala s, quieto el punto (cx, cy) del marco. */
  function zoomEn(fig, s, cx, cy) {
    const id = fig.dataset.planoFig;
    const v = vistas.get(id) || { s: 1, x: 0, y: 0 };
    const s2 = Math.min(ZOOM_MAX, Math.max(1, s));
    const px = (cx - v.x) / v.s, py = (cy - v.y) / v.s;
    vistas.set(id, { s: s2, x: cx - px * s2, y: cy - py * s2 });
    aplicarVista(fig);
  }
  function zoomBoton(boton, factor) {
    const fig = boton.closest('.plano-bocas');
    if (!fig) return;
    const m = fig.querySelector('.plano-marco');
    const v = vistas.get(fig.dataset.planoFig) || { s: 1 };
    zoomEn(fig, v.s * factor, m.clientWidth / 2, m.clientHeight / 2);
  }

  /* Los gestos: con eventos táctiles (en el iPhone, los de puntero los corta
     la página en cuanto empieza a desplazarse) y, en el ordenador, rueda y ratón. */
  let gesto = null;
  let movido = false;
  const relativo = (marco, x, y) => { const r = marco.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  function empezarGesto(marco, toques) {
    const fig = marco.closest('.plano-bocas');
    const v = { ...(vistas.get(fig.dataset.planoFig) || { s: 1, x: 0, y: 0 }) };
    if (toques.length >= 2) {
      const [a, b] = toques;
      gesto = { fig, marco, tipo: 'pellizco', d0: dist(a, b) || 1, v0: v,
        c0: relativo(marco, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    } else {
      gesto = { fig, marco, tipo: 'arrastre', x0: toques[0].clientX, y0: toques[0].clientY, v0: v };
    }
  }
  function moverGesto(toques) {
    const g = gesto;
    if (g.tipo === 'pellizco' && toques.length >= 2) {
      const [a, b] = toques;
      const s2 = Math.min(ZOOM_MAX, Math.max(1, g.v0.s * (dist(a, b) / g.d0)));
      const c = relativo(g.marco, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      const px = (g.c0.x - g.v0.x) / g.v0.s, py = (g.c0.y - g.v0.y) / g.v0.s;
      vistas.set(g.fig.dataset.planoFig, { s: s2, x: c.x - px * s2, y: c.y - py * s2 });
      movido = true;
      aplicarVista(g.fig);
      return true;
    }
    if (g.tipo === 'arrastre') {
      const dx = toques[0].clientX - g.x0, dy = toques[0].clientY - g.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) movido = true;
      if (g.v0.s <= 1.001 && !g.fig.classList.contains('grande')) return false; /* sin zoom: se mueve la página */
      vistas.set(g.fig.dataset.planoFig, { s: g.v0.s, x: g.v0.x + dx, y: g.v0.y + dy });
      aplicarVista(g.fig);
      return true;
    }
    return false;
  }
  $app.addEventListener('touchstart', (ev) => {
    const marco = activa() && ev.target.closest && ev.target.closest('.plano-marco');
    if (!marco) return;
    if (ev.touches.length === 1) movido = false;
    empezarGesto(marco, [...ev.touches]);
  }, { passive: true });
  $app.addEventListener('touchmove', (ev) => {
    if (!gesto) return;
    if (moverGesto([...ev.touches]) && ev.cancelable) ev.preventDefault();
  }, { passive: false });
  const finToque = (ev) => {
    if (!gesto) return;
    if (ev.touches.length) empezarGesto(gesto.marco, [...ev.touches]); else { gesto = null; soltarGesto(); }
  };
  /* El clic que llega justo al soltar un gesto se ignora; el siguiente toque ya vale. */
  let ignorarClicHasta = 0;
  function soltarGesto() { if (movido) ignorarClicHasta = Date.now() + 350; movido = false; }
  $app.addEventListener('touchend', finToque);
  $app.addEventListener('touchcancel', finToque);
  $app.addEventListener('mousedown', (ev) => {
    const marco = activa() && ev.button === 0 && ev.target.closest('.plano-marco');
    if (!marco) return;
    movido = false;
    empezarGesto(marco, [ev]);
    const mover = (e) => { if (gesto) moverGesto([e]); };
    const soltar = () => { gesto = null; soltarGesto(); window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
  });
  $app.addEventListener('wheel', (ev) => {
    const marco = activa() && ev.target.closest('.plano-marco');
    if (!marco) return;
    const fig = marco.closest('.plano-bocas');
    const v = vistas.get(fig.dataset.planoFig) || { s: 1 };
    if (!ev.ctrlKey && v.s <= 1.001 && !fig.classList.contains('grande')) return;
    ev.preventDefault();
    const c = relativo(marco, ev.clientX, ev.clientY);
    zoomEn(fig, v.s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.002)), c.x, c.y);
  }, { passive: false });
  /* Tras arrastrar o pellizcar, soltar encima de una marca no la abre. */
  $app.addEventListener('click', (ev) => {
    if (Date.now() < ignorarClicHasta && ev.target.closest && ev.target.closest('.plano-marco')) { ev.stopPropagation(); ev.preventDefault(); }
    ignorarClicHasta = 0;
  }, true);

  /*
   * UNA SOLA BOCA EN EL LISTADO (23-oct-2026, JC: «si pulsas un difusor, que
   * salga solo ese en el listado»). Al pulsar una marca del plano el listado
   * se filtra a esa boca (la misma ficha de siempre, un único formulario, se
   * guarda igual) con una barra «Solo I17 · Anterior · Siguiente · Ver todas».
   */
  const bocaVisible = () => $app.querySelector('.densa li[data-boca]:not(.fuera-filtro)');
  function abrirHojaBoca(clave, { foco = false } = {}) {
    quitarFiltroBoca();
    const li = $app.querySelector(`.densa li[data-boca="${CSS.escape(clave)}"]`);
    if (!li) { bocaAbierta = null; return; }
    bocaAbierta = clave;
    const ul = li.closest('ul');
    for (const x of ul.querySelectorAll('li[data-boca]')) x.classList.toggle('fuera-filtro', x !== li);
    const nombre = (li.querySelector('.boca-cabeza strong') || {}).textContent || '';
    const barra = document.createElement('div');
    barra.className = 'filtro-boca';
    barra.innerHTML = `<span class="solo">Solo <b></b></span>
      <button class="enlace" data-cx="boca-anterior" aria-label="Boca anterior">‹</button>
      <button class="enlace" data-cx="boca-siguiente" aria-label="Boca siguiente">›</button>
      <button class="enlace" data-cx="cerrar-boca">Ver todas</button>`;
    barra.querySelector('b').textContent = nombre;
    ul.before(barra);
    for (const m of $app.querySelectorAll('.marca-boca.elegida')) m.classList.remove('elegida');
    const marca = $app.querySelector(`.marca-boca[data-boca="${CSS.escape(clave)}"]`);
    if (marca) marca.classList.add('elegida');
    if (foco) {
      const c = casillas(li)[0];
      if (c) { try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); } }
      barra.scrollIntoView({ block: 'nearest' });
    }
  }
  function quitarFiltroBoca() {
    for (const f of $app.querySelectorAll('.filtro-boca')) f.remove();
    for (const x of $app.querySelectorAll('li.fuera-filtro')) x.classList.remove('fuera-filtro');
  }
  function cerrarHojaBoca({ seguir = false } = {}) {
    if (!seguir) bocaAbierta = null;
    /* Lo tecleado se guarda al salir: quitar el foco dispara el guardado. */
    const li = bocaVisible();
    if (li && li.contains(document.activeElement)) document.activeElement.blur();
    quitarFiltroBoca();
    for (const m of $app.querySelectorAll('.marca-boca.elegida')) m.classList.remove('elegida');
  }
  /* La boca de al lado, en el orden de la lista. */
  function bocaVecina(paso) {
    const claves = [...$app.querySelectorAll('.densa li[data-boca]')].map((x) => x.dataset.boca);
    const sig = claves[claves.indexOf(bocaAbierta) + paso];
    if (sig) abrirHojaBoca(sig, { foco: true });
  }

  function irABoca(clave) {
    abrirHojaBoca(clave, { foco: true });
  }

  /* Tras repintar la ficha: el zoom de cada plano, la pantalla completa y la tarjeta abierta, como estaban. */
  function restaurarPlano() {
    for (const fig of $app.querySelectorAll('.plano-bocas[data-plano-fig]')) {
      if (fig.dataset.planoFig === grandeId) {
        fig.classList.add('grande');
        const b = fig.querySelector('[data-cx="plano-grande"]');
        if (b) b.textContent = 'Cerrar';
      }
      aplicarVista(fig);
      /* La imagen llega después: con su alto ya puesto, se vuelve a encajar. */
      const img = fig.querySelector('img');
      if (img) img.addEventListener('load', () => aplicarVista(fig), { once: true });
    }
    if (!grandeId) document.body.classList.remove('sin-scroll');
    if (bocaAbierta) abrirHojaBoca(bocaAbierta);
  }

  function planoGrande(boton) {
    const fig = boton.closest('.plano-bocas');
    if (!fig) return;
    if (fig.classList.contains('grande')) { cerrarPlanoGrande(fig); return; }
    fig.classList.add('grande');
    grandeId = fig.dataset.planoFig;
    boton.textContent = 'Cerrar';
    document.body.classList.add('sin-scroll');
    /* Se abre ya acercado (al 250 %, como antes), sobre el centro. */
    const m = fig.querySelector('.plano-marco');
    vistas.set(grandeId, { s: 1, x: 0, y: 0 });
    aplicarVista(fig);
    zoomEn(fig, 2.5, m.clientWidth / 2, m.clientHeight / 2);
  }
  function cerrarPlanoGrande(fig) {
    fig.classList.remove('grande');
    grandeId = null;
    const b = fig.querySelector('[data-cx="plano-grande"]');
    if (b) b.textContent = 'Ampliar';
    document.body.classList.remove('sin-scroll');
    vistas.set(fig.dataset.planoFig, { s: 1, x: 0, y: 0 });
    aplicarVista(fig);
  }

  /*
   * EL CONJUNTO (split, VRF) ES UN SOLO COMMISSIONING (JC, 28-oct-2026): sin
   * fichas de unidad exterior ni interior; en las fichas, una línea lo dice.
   */
  function htmlNotaConjunto(cj) {
    if (!cj || !cj.unidades || cj.unidades.length < 2) return '';
    const que = cj.clase === 'par' ? 'Split' : 'VRF';
    return `<p class="nota nota-conjunto">${que}: un solo commissioning para ${esc(cj.unidades.map((u) => u.tag).join(' + '))}. ${chipEnvio(cj.envio, cj.completo, cj.ensayoFalta)}</p>
      ${cj.falta && cj.falta.length && !cj.completo ? `<p class="nota aviso">Falta en el conjunto: ${esc(cj.falta.join(', '))}</p>` : ''}`;
  }

  /* La entrada a las fichas: lo que lleva el equipo y cuántas están hechas. */
  function htmlEntradaFichas() {
    const ok = fichasEq && fichasEq.ok !== false;
    const fs = ok ? (fichasEq.fichas || []).filter((x) => !x.conservada) : [];
    const bal = ficha && tieneBalanceo(ficha) && !fs.some((x) => x.clase === 'balanceo') ? [tituloMedicion(ficha)] : [];
    const nombres = [...fs.map((x) => x.nombre), ...bal];
    const hechas = fs.filter((x) => x.estado === 'completa' || x.estado === 'firmada').length;
    const chip = ok && fs.length ? `<span class="chip ${hechas === fs.length ? 'bien' : 'neutra'}">${hechas}/${fs.length}</span>` : '';
    const sub = !fichasEq ? 'Cargando las fichas…'
      : !ok ? fichasEq.error
      : nombres.length ? nombres.map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' · ')
      : 'Este equipo no tiene familia asignada: se le pone en el ordenador (Puesta en marcha).';
    return `<section id="fichas-equipo" data-plegable>
      <h2>Fichas del equipo <span class="cuenta">${ok ? nombres.length : ''}</span></h2>
      <ul class="lista-ios"><li><button class="fila-ios" data-cx="ver-fichas">
        <div class="fila-principal"><strong>${ok && nombres.length ? `${hechas} de ${fs.length} hechas` : 'Abrir'}</strong><span>${chip}</span></div>
        <div class="sub">${esc(sub)}</div>
      </button></li></ul>
    </section>`;
  }

  /*
   * LAS FOTOS DEL EQUIPO: un toque en «Placa» o «Vista general» abre la
   * cámara y la foto se guarda ya, con ese pie y la hora. Sin pasos de más.
   */
  const PIES_FOTO = ['Placa', 'Vista general', 'Otra'];
  /*
   * TODAS LAS FOTOS DEL EQUIPO (29-oct-2026, JC: «acabo de hacer una foto del
   * equipo tras el checklist y al volver no aparece ninguna foto»). El servidor
   * manda las de todas las unidades del conjunto y las de sus fichas, cada una
   * con su origen; aquí se suman las que siguen en la cola del teléfono (foto
   * del equipo sin subir o foto de una ficha aún en su borrador), con su
   * miniatura sacada del propio teléfono.
   */
  const unidadesDe = (f) => (f.conjunto && f.conjunto.unidades && f.conjunto.unidades.length ? f.conjunto.unidades.map((u) => u.id) : [f.equipo.id]);
  function fotosEnCola(f) {
    if (!COLA || !AG || !f || !f.equipo) return [];
    const fuera = [];
    for (const id of unidadesDe(f)) {
      for (const k of COLA.claves(`fotoEquipo.${id}.`)) {
        const b = AG.leer(k);
        for (const x of (b && b.fotos) || []) if (x && x.local) fuera.push({ local: x.local, pie: x.pie || '', hora: x.hora || '', origen: 'equipo', ficha: null });
      }
    }
    for (const r of f.fichasConFotos || []) {
      const b = AG.leer(claveBorrador(r));
      for (const x of (b && b.fotos) || []) if (x && x.local) fuera.push({ local: x.local, pie: x.pie || '', hora: x.hora || '', origen: 'ficha', ficha: r.nombre });
    }
    return fuera;
  }
  /* De dónde viene cada foto: «Checklist split», «UE»… (nada si es de este mismo equipo). */
  const origenFoto = (x) => [x.ficha ? fichaCorta(x.ficha) : null, x.unidad].filter(Boolean).join(' · ');
  const fichaCorta = (n) => { const t = String(n || '').trim(); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); };
  function htmlFotosEquipo(f, puede) {
    const fotos = f.fotos || [];
    const enCola = fotosEnCola(f);
    const total = fotos.length + enCola.length;
    const pieDe = (x) => esc([x.pie, x.hora].filter(Boolean).join(' · ') || 'Foto');
    const marca = (x) => { const o = origenFoto(x); return o ? `<span class="origen-foto">${esc(o)}</span>` : ''; };
    /* La localización en plano (29-oct-2026, JC): el recorte del plano, delante de las fotos hechas. */
    const loc = (f.localizacion || []).map((x) => `<li class="localizacion-plano"><img data-src="${esc(x.url)}" alt="Localización en plano">
        <div class="pie"><span>${esc(x.pie || 'Localización en plano')}</span></div></li>`).join('');
    return `<h2>Fotos del equipo <span class="cuenta">${total}</span></h2>
      ${enCola.length ? `<p class="nota">${marcaAG('sinRed')} ${enCola.length === 1 ? 'Una foto está' : `${enCola.length} fotos están`} solo en el móvil: se subirá${enCola.length === 1 ? '' : 'n'} sola${enCola.length === 1 ? '' : 's'} al volver la conexión.</p>` : ''}
      ${total || loc ? `<ul class="fotos-equipo">${loc}${fotos.map((x) => `<li><img data-src="${esc(x.url || `api/equipo/foto?id=${encodeURIComponent(x.id)}`)}" alt="${esc(x.pie || 'Foto')}">
        <div class="pie"><span>${pieDe(x)}</span>${marca(x)}${puede && (x.origen || 'equipo') === 'equipo' ? `<button class="enlace mal" data-cx="quitar-foto-equipo" data-id="${esc(x.id)}">Quitar</button>` : ''}</div></li>`).join('')}${enCola.map((x) => `<li class="en-movil"><img data-local="${esc(x.local)}" alt="${esc(x.pie || 'Foto')}">
        <div class="pie"><span>${pieDe(x)}</span>${marca(x)}<span class="origen-foto">En el móvil</span></div></li>`).join('')}</ul>` : ''}
      ${puede ? `<div class="fila-botones fotos-rapidas">
        ${PIES_FOTO.map((pie) => `<button class="boton secundario" data-cx="foto-equipo" data-pie="${esc(pie)}"><i class="ic ic-camara"></i>${esc(pie)}</button>`).join('')}
        <button class="boton secundario" data-cx="foto-equipo" data-pie="" data-galeria="1">De la galería</button>
      </div>` : ''}`;
  }
  /*
   * LAS UNIDADES INTERIORES DEL VRF (29-oct-2026, JC: «una tarjeta con las
   * unidades interiores ahí y poder asociarle toma de datos a cada una y foto.
   * La foto se coge al terminar de tomar datos y sale miniatura ahí, y la toma
   * de datos con un botón antes de la miniatura de la foto»). Entre «Fichas del
   * equipo» y «Fotos del equipo»: una fila por UI con su TAG corto, su sala, el
   * estado de su toma, el botón y, a la derecha, la miniatura de su foto (o el
   * hueco con la cámara). La foto es una foto del equipo de ESA UI (fotosEquipo
   * con su id), con la misma cola sin conexión que las demás.
   * Abierta una UI: solo su fila, y el enlace a su unidad exterior.
   */
  /* «Placa · UI 01»: el TAG corto de la UI en el pie (el largo ya lo lleva la unidad de la foto). */
  const rotuloUi = (tag) => { const m = /(?:^|[\s·-])UI\s*0*(\d+)\s*$/i.exec(String(tag || '')); return m ? `UI ${m[1].padStart(2, '0')}` : String(tag || ''); };
  const pieFotoUi = (tag) => ['Placa', rotuloUi(tag)].filter(Boolean).join(' · ');
  /* La foto de una UI: la que sigue en el teléfono sin subir (la más nueva) o la del servidor. */
  function fotoDeUi(f, equipoId) {
    if (COLA && AG) {
      const ks = COLA.claves(`fotoEquipo.${equipoId}.`).sort();
      for (let n = ks.length - 1; n >= 0; n--) {
        const b = AG.leer(ks[n]);
        const x = ((b && b.fotos) || []).find((y) => y && y.local);
        if (x) return { local: x.local, clave: ks[n], pie: x.pie || '' };
      }
    }
    const u = ((f && f.conjunto && f.conjunto.unidades) || []).find((y) => y.id === equipoId);
    return u && u.foto ? u.foto : null;
  }
  function htmlUnidadesInteriores(f, puede) {
    const cj = f.conjunto;
    if (!cj || !fichasEq || fichasEq.ok === false) return '';
    const todas = (fichasEq.fichas || []).map((x, i) => [x, i]).filter(([x]) => !x.conservada && x.papel === 'UI' && x.unidadId);
    if (!todas.length) return '';
    const abierta = todas.some(([x]) => x.unidadId === f.equipo.id);
    const filas = abierta ? todas.filter(([x]) => x.unidadId === f.equipo.id) : todas;
    const hecha = (x) => ['completa', 'firmada'].includes(estadoVisible(x.estado, x.medidos, x.bocasSinMedir));
    const completas = todas.filter(([x]) => hecha(x)).length;
    const ue = (cj.unidades || []).find((u) => u.papel === 'UE');
    const corto = (x) => rotuloUi(x.unidadTag) || 'UI';
    return `<section id="unidades-interiores" data-plegable>
      <h2>Unidades interiores <span class="cuenta">${abierta ? `${corto(filas[0][0])} de ${todas.length}` : `${completas} de ${todas.length} UIs completas`}</span></h2>
      <ul class="lista-ios filas-ui">${filas.map(([x, i]) => {
        const foto = fotoDeUi(f, x.unidadId);
        const img = foto ? (foto.local ? `<img data-local="${esc(foto.local)}" alt="Foto ${esc(corto(x))}">` : `<img data-src="${esc(foto.url)}" alt="Foto ${esc(corto(x))}">`) : '';
        const mini = foto
          ? `<button type="button" class="miniatura-ui${foto.local ? ' en-movil' : ''}" data-cx="foto-ui-grande" data-equipo="${esc(x.unidadId)}" aria-label="Ver la foto de ${esc(corto(x))}">${img}</button>`
          : puede ? `<button type="button" class="miniatura-ui hueco" data-cx="foto-equipo" data-equipo="${esc(x.unidadId)}" data-pie="${esc(pieFotoUi(x.unidadTag))}" aria-label="Hacer la foto de ${esc(corto(x))}"><i class="ic ic-camara"></i></button>`
          : '<span class="miniatura-ui hueco apagada"></span>';
        return `<li class="fila-ui">
          <div class="ui-datos"><strong>${esc(corto(x))}</strong>${chipFicha(x.estado, x.resultado, x.medidos, x.bocasSinMedir)}<span class="sub">${esc(x.unidadSala || 'Sin sala')} · ${valorSerie((cj.unidades || []).find((y) => y.id === x.unidadId) || { id: x.unidadId, tag: x.unidadTag }, puede, 'Nº serie ')}</span></div>
          <button type="button" class="boton secundario ui-toma" data-cx="hoja" data-i="${i}">${hecha(x) || bloqueosDe(f).length ? 'Ver datos' : 'Toma de datos'}</button>
          ${mini}
        </li>`;
      }).join('')}</ul>
      ${abierta && ue ? `<p class="nota">Ud. exterior asociada: <button type="button" class="enlace" data-cx="equipo" data-id="${esc(ue.id)}">${esc(ue.tag)}</button></p>` : ''}
      ${abierta ? '' : `<div class="ver-hoja"><button type="button" class="enlace" data-cx="pdf-uis">Ver hoja de la UE y las UIs</button><span class="chip ${completas === todas.length ? 'bien' : 'aviso'}">${completas === todas.length ? 'Definitiva' : 'Borrador'}</span></div>`}
    </section>`;
  }
  /* La foto de una UI en grande, con rehacer, otra foto y quitar. */
  function fotoUiGrande(equipoId) {
    const foto = fotoDeUi(ficha, equipoId);
    if (!foto) return;
    const fila = ((fichasEq && fichasEq.fichas) || []).find((x) => x.unidadId === equipoId && x.papel === 'UI');
    const tag = fila ? fila.unidadTag : '';
    cerrarFotoUi();
    const capa = document.createElement('div');
    capa.className = 'visor-foto-ui';
    capa.id = 'visor-foto-ui';
    capa.innerHTML = `<div class="visor-cabeza"><strong>${esc(tag || 'Foto')}</strong><button type="button" class="enlace" data-ui-visor="cerrar">Cerrar</button></div>
      ${foto.local ? `<img data-local="${esc(foto.local)}" alt="${esc(tag)}">` : `<img data-src="${esc(foto.url)}" alt="${esc(tag)}">`}
      ${foto.local ? '<p class="nota">Solo en el móvil: se subirá sola al volver la conexión.</p>' : ''}
      ${ficha && ficha.puedeMedir ? `<div class="fila-botones">
        <button type="button" class="boton secundario" data-ui-visor="rehacer"><i class="ic ic-camara"></i>Rehacer</button>
        <button type="button" class="boton secundario" data-ui-visor="otra"><i class="ic ic-camara"></i>Otra foto</button>
        <button type="button" class="boton secundario mal" data-ui-visor="quitar">Quitar</button>
      </div>` : ''}`;
    document.body.appendChild(capa);
    document.body.classList.add('sin-scroll');
    C.cargarImagenes(capa);
    cargarFotosLocales(capa);
    capa.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ui-visor]');
      if (!b) return;
      const que = b.dataset.uiVisor;
      if (que === 'cerrar') { cerrarFotoUi(); return; }
      if (que === 'otra') {
        C.elegirFoto(true).then((a) => { if (a) guardarFotoEquipo(a, equipoId, ['Otra', rotuloUi(tag)].filter(Boolean).join(' · ')); });
        cerrarFotoUi();
        return;
      }
      if (que === 'rehacer') {
        /* La nueva primero; la vieja se quita solo cuando la nueva ya está a salvo. */
        C.elegirFoto(true).then((a) => {
          if (!a) return;
          if (foto.local) { quitarFotoUiLocal(foto); guardarFotoEquipo(a, equipoId, pieFotoUi(tag)); return; }
          guardarFotoEquipo(a, equipoId, pieFotoUi(tag), null, { despues: () => quitarFotoUiServidor(foto.id, true) });
        });
        cerrarFotoUi();
        return;
      }
      if (que === 'quitar') {
        if (!window.confirm(`¿Quitar la foto de ${tag || 'esta unidad'}?`)) return;
        cerrarFotoUi();
        if (foto.local) { quitarFotoUiLocal(foto); if (activa() && ficha && !hoja) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); } }
        else quitarFotoUiServidor(foto.id);
      }
    });
  }
  function cerrarFotoUi() {
    const v = document.getElementById('visor-foto-ui');
    if (v) { v.remove(); document.body.classList.remove('sin-scroll'); }
  }
  function quitarFotoUiLocal(foto) {
    if (!AG || !foto.clave || fotosEquipoEnCurso.has(foto.clave)) return;
    AG.borrar(foto.clave);
    if (foto.local) AG.borrarFoto(foto.local);
  }
  async function quitarFotoUiServidor(id, callado = false) {
    try {
      const r = await C.postJson('api/equipo/fotos/quitar', { id, vista: ficha ? ficha.equipo.id : '' });
      if (!r.ok) throw new Error(r.error);
      if (ficha && r.equipo && r.equipo.id === ficha.equipo.id) ficha = r;
      if (activa() && ficha && !hoja) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    } catch (e) { if (!callado) C.aviso(e.message); }
  }

  /* Las miniaturas de las fotos que siguen en el teléfono (IndexedDB). */
  function cargarFotosLocales(raiz) {
    if (!AG) return;
    for (const img of raiz.querySelectorAll('img[data-local]')) {
      const k = img.dataset.local;
      img.removeAttribute('data-local');
      img.classList.add('cargando');
      AG.leerFoto(k).then((b) => {
        img.classList.remove('cargando');
        if (b) { try { img.src = URL.createObjectURL(b); return; } catch { /* sin vista */ } }
        img.classList.add('sin-foto');
      }, () => { img.classList.remove('cargando'); img.classList.add('sin-foto'); });
    }
  }

  /*
   * LA FOTO DEL EQUIPO, EN EL TELÉFONO ANTES QUE NADA (JC, 28-oct): se guarda
   * en el móvil al hacerla (`cx.borrador.fotoEquipo.<equipo>.<n>` + IndexedDB)
   * y luego se sube. Sin red, se queda y la cola la sube sola al volver.
   */
  const fotosEquipoEnCurso = new Set();
  async function fotoEquipo(boton) {
    if (!ficha) return;
    const archivo = await C.elegirFoto(!boton.dataset.galeria);
    if (!archivo || !ficha) return;
    /* data-equipo: la foto de una UI hecha desde la pantalla de su UE (VRF). */
    const equipoId = boton.dataset.equipo || ficha.equipo.id;
    const pie = boton.dataset.pie === 'Otra' ? '' : boton.dataset.pie;
    return guardarFotoEquipo(archivo, equipoId, pie, boton);
  }
  /* Guarda la foto en el teléfono, la sube y la une al equipo (o a la UI de un VRF). */
  async function guardarFotoEquipo(archivo, equipoId, pie, boton = null, { despues = null } = {}) {
    if (!ficha) return;
    const vista = ficha.equipo.id;
    const clave = `fotoEquipo.${equipoId}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const foto = AG ? await AG.fotoNueva(archivo, { id: null, pie, hora: ahoraEs() }) : { id: null, pie, hora: ahoraEs(), archivo };
    const apuntar = () => { if (AG) AG.guardar(clave, { equipoId, fotos: AG.fotosParaGuardar([foto]) }); };
    apuntar();
    fotosEquipoEnCurso.add(clave);
    if (boton) boton.disabled = true;
    /* Ya en el teléfono: la miniatura sale aunque no haya red. */
    /* Para todo equipo, no solo la UI de un VRF (29-oct, JC: «el contador se queda en 0»). */
    if (activa() && ficha && ficha.equipo.id === vista && !hoja) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    try {
      const r = await mandarFotoEquipo(equipoId, foto, apuntar, vista);
      if (AG) AG.borrar(clave); else if (foto.url) URL.revokeObjectURL(foto.url);
      if (ficha && ficha.equipo.id === vista) ficha = r;
      leerPlacaSiToca(r, equipoId, foto.archivo);
      if (despues) await despues();
      if (!activa() || !ficha || ficha.equipo.id !== vista || hoja) return;
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    } catch (e) {
      if (boton) boton.disabled = false;
      if (AG && AG.sinRed(e)) {
        C.aviso('Sin conexión: la foto queda guardada en el móvil y se subirá sola.');
        if (COLA) COLA.masTarde();
        if (activa() && ficha && ficha.equipo.id === vista && !hoja) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
      } else C.aviso(e.message);
    } finally { fotosEquipoEnCurso.delete(clave); }
  }
  /* Sube la foto (desde el teléfono si hace falta) y la une al equipo. */
  async function mandarFotoEquipo(equipoId, foto, apuntar = () => {}, vista = null) {
    const subir = async () => {
      const blob = foto.archivo || (AG && foto.local ? await AG.leerFoto(foto.local) : null);
      if (!blob) throw new Error('La foto ya no está en el teléfono: vuelve a hacerla.');
      foto.archivo = blob;
      foto.id = await C.subirFoto(blob);
      apuntar();
    };
    if (!foto.id) await subir();
    const unir = () => C.postJson('api/equipo/fotos', { equipoId, ...(vista ? { vista } : {}), fotos: [{ id: foto.id, pie: foto.pie, hora: foto.hora }] });
    let r = await unir();
    /* El ordenador olvidó la foto en espera (app cerrada): se vuelve a subir desde el teléfono. */
    if (!r.ok && /ya no está/i.test(String(r.error || ''))) { foto.id = null; await subir(); r = await unir(); }
    if (!r.ok) throw new Error(r.error);
    return r;
  }
  async function enviarFotoEquipoPendiente(clave, b) {
    if (fotosEquipoEnCurso.has(clave)) return false;
    const [foto] = AG ? await AG.restaurarFotos((b && b.fotos) || []) : [];
    if (!foto || !foto.archivo || !b.equipoId) { if (AG) AG.borrar(clave); return true; }
    fotosEquipoEnCurso.add(clave);
    try {
      const r = await mandarFotoEquipo(b.equipoId, foto, () => AG.guardar(clave, { equipoId: b.equipoId, fotos: AG.fotosParaGuardar([foto]) }));
      AG.borrar(clave);
      if (foto.url) { try { URL.revokeObjectURL(foto.url); } catch { /* nada */ } }
      leerPlacaSiToca(r, b.equipoId, foto.archivo);
      if (ficha && ficha.equipo.id === b.equipoId) {
        ficha = r;
        if (activa() && !hoja && !escribiendoEnApp()) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
      } else if (ficha && unidadesDe(ficha).includes(b.equipoId)) {
        /* Era de la otra unidad del split: se relee el equipo que está abierto. */
        refrescarEquipo(ficha.equipo.id);
      }
      return true;
    } catch { return false; } finally { fotosEquipoEnCurso.delete(clave); }
  }

  /* Hasta que alguien verifica la instalación, el equipo solo cuenta para la documentación (22-oct). */
  async function verificarInstalacion(boton) {
    boton.disabled = true;
    try {
      const r = await C.postJson('api/equipo/instalacion', { equipoId: ficha.equipo.id, verificada: true });
      if (!r.ok) throw new Error(r.error);
      await abrir(ficha.equipo.id, { quieto: true });
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  async function quitarFotoEquipo(boton) {
    if (!window.confirm('¿Quitar esta foto del equipo?')) return;
    try {
      const r = await C.postJson('api/equipo/fotos/quitar', { id: boton.dataset.id, vista: ficha ? ficha.equipo.id : '' });
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      if (activa()) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    } catch (e) { C.aviso(e.message); }
  }

  /*
   * EL EQUIPO DE MEDIDA (15-oct-2026, JC: «estas mediciones no han sido con
   * balómetro sino con anemómetro»). Se elige para todo el equipo de una vez,
   * arriba, y cada boca puede cambiarlo.
   *   · ANEMÓMETRO: de 1 a 4 lecturas (M1–M4, m/s); Q = v̄ × Ak × 3600. Si el
   *     aparato da su propio caudal, se apunta en «Q del aparato» y manda ese.
   *   · BALÓMETRO: se apunta el caudal, sin Ak.
   */
  const claveBoca = (plano, punto) => `${plano}|${punto}`;
  const comaD = (v, d = 2) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 10 ** d) / 10 ** d).replace('.', ','));
  const equipoDeBoca = (b) => b.equipoMedida || 'anemometro';
  /* Con el anemómetro, qué se apunta en M1–M4 (JC: «el anemómetro da todos los datos y yo meto el que quiero»). */
  const lecturaDeBoca = (b) => b.lectura || 'velocidad';

  /*
   * CON QUÉ SE COGIERON LOS DATOS DE UNA BOCA (15-oct, JC: «quiero un botón
   * chiquitito en la esquina derecha de la tarjeta y si lo pulso escojo con lo
   * que cogí los datos»). Un desplegable nativo (<details>) con tres opciones;
   * cada una guarda como los segmentados de antes (cambiarEquipo).
   */
  const INSTRUMENTOS = [
    ['anemV', 'Anem. m/s', 'Anemómetro (m/s)', 'data-cx="lectura" data-lectura="velocidad"'],
    ['anemQ', 'Anem. m³/h', 'Anemómetro (m³/h)', 'data-cx="lectura" data-lectura="caudal"'],
    ['balometro', 'Balóm. m³/h', 'Balómetro (m³/h)', 'data-cx="equipo-medida" data-equipo="balometro"'],
  ];
  function botonInstrumento(p, b, actual, puede) {
    const [, corto] = INSTRUMENTOS.find(([id]) => id === actual) || INSTRUMENTOS[0];
    if (!puede) return `<span class="instr-boca solo">${esc(corto)}</span>`;
    return `<details class="instr-boca"><summary aria-label="Con qué se midió ${esc(b.nombre)}: ${esc(corto)}. Cambiar">${esc(corto)} ▾</summary>
      <div class="instr-menu segmento" role="radiogroup" aria-label="Con qué se midió ${esc(b.nombre)}">${INSTRUMENTOS.map(([id, , largo, datos]) => `<button type="button"
        role="radio" aria-checked="${actual === id}" class="${actual === id ? 'activa' : ''}" ${datos} data-eplano="${esc(p.id)}" data-epunto="${esc(b.id)}">${esc(largo)}</button>`).join('')}</div></details>`;
  }

  function htmlBoca(p, b, puede, tol) {
    const [clase, nombre] = ESTADO_BOCA[b.estado] || ['neutra', b.estado || ''];
    const porc = pct(b.caudal, b.caudalDiseno);
    const clave = claveBoca(p.id, b.id);
    const bal = equipoDeBoca(b) === 'balometro';
    const datos = `data-plano="${esc(p.id)}" data-punto="${esc(b.id)}"`;
    const dis = puede ? '' : 'disabled';
    const enQ = !bal && lecturaDeBoca(b) === 'caudal';
    const lect = enQ ? (b.lecturasCaudal && b.lecturasCaudal.length ? b.lecturasCaudal : (b.caudalMedido === null || b.caudalMedido === undefined ? [] : [b.caudalMedido]))
      : b.lecturas && b.lecturas.length ? b.lecturas : (b.velocidad === null || b.velocidad === undefined ? [] : [b.velocidad]);
    const unidadM = enQ ? 'm³/h' : 'm/s';
    const tolB = tol && tol.boca ? Math.round(tol.boca * 100) : 10;
    const qLeido = b.caudalMedido !== null && b.caudalMedido !== undefined;
    let formula = '';
    if (!bal) {
      if (enQ) formula = qLeido ? `<div class="formula">Q̄ = media de lo apuntado = <b>${cifra(b.caudal)}</b> m³/h (sin Ak)</div>` : '';
      else if (b.velocidad === null || b.velocidad === undefined) formula = '';
      else if (!b.factor) formula = '<div class="formula aviso">Falta el Ak de este difusor (ficha del fabricante): sin él no hay caudal.</div>';
      else if (b.modoFactor === 'k') formula = `<div class="formula">v̄ ${comaD(b.velocidad)} m/s · Q = v̄ × k = ${comaD(b.velocidad)} × ${comaD(b.factor, 1)} = <b>${cifra(b.caudal)}</b> m³/h</div>`;
      else formula = `<div class="formula">v̄ ${comaD(b.velocidad)} m/s · Q = v̄ × Ak × 3600 = ${comaD(b.velocidad)} × ${comaD(b.factor, 4)} × 3600 = <b>${cifra(b.caudal)}</b> m³/h</div>`;
    }
    const fuera = (b.estado === 'alto' || b.estado === 'bajo') && porc !== null;
    /* Lo que necesita el cálculo en vivo (vivoBoca): mientras se teclea, la
       boca ya dice si va dentro o fuera, sin esperar a guardarla. */
    const vivo = `data-diseno="${b.caudalDiseno ?? ''}" data-factor="${b.factor ?? ''}" data-modo="${esc(b.modoFactor || '')}" data-tol="${tolB}" data-lectura="${enQ ? 'caudal' : 'velocidad'}"`;
    const casillaQ = (rotulo, clase2) => `<label class="q-balometro${clase2 ? ` ${clase2}` : ''}">${rotulo}
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-q="1"
              value="${qLeido ? comaD(b.caudalMedido, 1) : ''}" aria-label="${esc(rotulo)} en ${esc(b.nombre)}"></label>`;
    return `<li class="boca ${clase}" data-boca="${esc(clave)}" ${vivo}>
      <div class="boca-cabeza"><strong>${esc(b.nombre)}</strong><span class="sub">${esc(b.circuito === 'retorno' ? 'Retorno' : 'Impulsión')} · ${esc(b.tipo || '')}</span>${botonInstrumento(p, b, bal ? 'balometro' : enQ ? 'anemQ' : 'anemV', puede)}</div>
      ${bal
        ? casillaQ('Q balómetro (m³/h)')
        : `<div class="lecturas">${[0, 1, 2, 3].map((i) => `<label>M${i + 1} <small class="unidad-m">${unidadM}</small>
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-m="${i}"
              value="${lect[i] === undefined ? '' : comaD(lect[i], enQ ? 1 : 2)}" aria-label="Lectura M${i + 1} en ${unidadM} en ${esc(b.nombre)}"></label>`).join('')}</div>`}
      <label class="t-boca">Tª (°C)
        <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-t="1"
          value="${b.temperatura === null || b.temperatura === undefined ? '' : comaD(b.temperatura, 1)}" aria-label="Temperatura en ${esc(b.nombre)}, en grados"></label>
      ${bal ? '' : `<div data-vivo="formula">${formula}</div>`}
      <div class="boca-cifras">
        <div><span>Q medido</span><b data-vivo="q">${cifra(b.caudal)}</b></div>
        <div><span>Q proyecto</span><b>${cifra(b.caudalDiseno)}</b></div>
        <div><span>Desviación</span><b data-vivo="desv">${b.desviacion === null || b.desviacion === undefined ? '—' : `${b.desviacion > 0 ? '+' : ''}${comaD(b.desviacion * 100, 1)} %`}</b></div>
        <div class="porc"><span class="chip ${clase}" data-vivo="chip">${porc === null ? esc(nombre) : `${porc} %`}</span></div>
      </div>
      <p class="nota aviso" data-vivo="aviso" ${fuera ? '' : 'hidden'}>${fuera ? textoFuera(b.desviacion, tolB) : ''}</p>
      ${b.sinAk && b.metodo !== 'balometro' && b.metodo !== 'directo' ? '<p class="nota aviso">Sin Ak: apunta las velocidades (se guardan) o mide con balómetro; el caudal sale cuando se ponga el Ak.</p>' : ''}
      ${b.caudalDiseno ? '' : '<p class="nota">Esta boca no tiene caudal de proyecto: sin él no se puede saber si va bien. Se pone en el plano (ordenador › Commissioning › Balanceo).</p>'}
    </li>`;
  }

  function textoFuera(desv, tolB) {
    const d = `${desv > 0 ? '+' : ''}${comaD(desv * 100, 1)} %`;
    return `${desv > 0 ? 'Sopla de más' : 'Le falta caudal'} (${d}): fuera de ±${tolB} %, hay que regular esta boca.`;
  }
  const numVivo = (t) => { const n = Number(String(t).trim().replace(',', '.')); return String(t).trim() === '' || !Number.isFinite(n) ? null : n; };

  /* Recalcula la boca con lo tecleado, sin guardar: Q, desviación, chip y aviso.
     Es la misma cuenta que hace el motor al guardar (media de M1–M4 × Ak × 3600,
     o × k; con balómetro, su caudal). */
  function vivoBoca(li) {
    const diseno = numVivo(li.dataset.diseno || '');
    const factor = numVivo(li.dataset.factor || '');
    const tolB = Number(li.dataset.tol) || 10;
    const qIn = li.querySelector('input[data-q]');
    const mIns = li.querySelectorAll('input[data-m]');
    let q = qIn ? numVivo(qIn.value) : null;
    if (q === null && mIns.length && li.dataset.lectura === 'caudal') {
      const v = [...mIns].map((x) => numVivo(x.value)).filter((n) => n !== null && n >= 0);
      q = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      const fo = li.querySelector('[data-vivo="formula"]');
      if (fo) fo.innerHTML = q === null ? '' : `<div class="formula">Q̄ = media de lo apuntado = <b>${cifra(Math.round(q))}</b> m³/h (sin Ak)</div>`;
    } else if (q === null && mIns.length) {
      const v = [...li.querySelectorAll('input[data-m]')].map((x) => numVivo(x.value)).filter((n) => n !== null && n >= 0);
      const media = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      if (media !== null && factor) q = li.dataset.modo === 'k' ? media * factor : media * factor * 3600;
      /* La cuenta, también al momento: si no, enseña la de lo guardado. */
      const fo = li.querySelector('[data-vivo="formula"]');
      if (fo) {
        const vm = comaD(Math.round(media * 100) / 100);
        fo.innerHTML = qIn && numVivo(qIn.value) !== null ? '<div class="formula">Manda el caudal que da el aparato.</div>'
          : media === null ? ''
          : !factor ? '<div class="formula aviso">Falta el Ak de este difusor (ficha del fabricante): sin él no hay caudal.</div>'
          : li.dataset.modo === 'k' ? `<div class="formula">v̄ ${vm} m/s · Q = v̄ × k = ${vm} × ${comaD(factor, 1)} = <b>${cifra(Math.round(q))}</b> m³/h</div>`
          : `<div class="formula">v̄ ${vm} m/s · Q = v̄ × Ak × 3600 = ${vm} × ${comaD(factor, 4)} × 3600 = <b>${cifra(Math.round(q))}</b> m³/h</div>`;
      }
    }
    const desv = q !== null && diseno ? q / diseno - 1 : null;
    const fuera = desv !== null && Math.abs(desv) * 100 > tolB;
    const clase = q === null ? 'neutra' : desv === null ? 'neutra' : fuera ? (desv > 0 ? 'alto' : 'mal') : 'bien';
    const pon = (k, t) => { const el = li.querySelector(`[data-vivo="${k}"]`); if (el) el.textContent = t; return el; };
    pon('q', q === null ? '—' : cifra(Math.round(q)));
    pon('desv', desv === null ? '—' : `${desv > 0 ? '+' : ''}${comaD(desv * 100, 1)} %`);
    const chip = pon('chip', q === null ? 'Sin medir' : diseno ? `${Math.round((q / diseno) * 100)} %` : 'Sin Q proyecto');
    if (chip) chip.className = `chip ${clase}`;
    li.classList.remove('bien', 'mal', 'alto', 'aviso', 'neutra');
    li.classList.add(clase);
    /* Su marca en el plano, del mismo color. */
    const marca = $app.querySelector(`.marca-boca[data-boca="${CSS.escape(li.dataset.boca)}"]`);
    if (marca) { marca.classList.remove('bien', 'mal', 'alto', 'neutra'); marca.classList.add(clase); }
    const av = li.querySelector('[data-vivo="aviso"]');
    if (av) { av.hidden = !fuera; av.textContent = fuera ? textoFuera(desv, tolB) : ''; }
  }

  /* Las casillas de una boca, en orden. */
  const casillas = (li) => [...li.querySelectorAll('input[data-punto]')];
  const cambiada = (li) => casillas(li).some((x) => x.value.trim() !== x.defaultValue.trim());

  /* Lo tecleado en una boca: el caudal leído y/o las lecturas M1–M4. */
  function cuerpoBoca(ins) {
    const c = {};
    const qIn = ins.find((x) => x.dataset.q);
    const mIns = ins.filter((x) => x.dataset.m !== undefined);
    if (qIn) c.caudalMedido = qIn.value.trim();
    if (mIns.length) c.lecturas = mIns.map((x) => x.value.trim()).filter((v) => v !== '');
    const tIn = ins.find((x) => x.dataset.t);
    if (tIn) c.temperatura = tIn.value.trim();
    return c;
  }

  /* Guardar la boca entera; luego el foco va a `destino` (otra casilla) o a la siguiente boca sin medir. */
  async function medir(li, destino) {
    const ins = casillas(li);
    if (!ins.length) return;
    const { plano, punto } = ins[0].dataset;
    const cuerpo = { planoId: plano, puntoId: punto };
    Object.assign(cuerpo, cuerpoBoca(ins));
    ins.forEach((x) => { x.disabled = true; });
    try {
      const r = await C.postJson('api/boca', cuerpo);
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      if (!activa()) return;
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
      if (destino === 'siguiente' && bocaAbierta) {
        /* Con la tarjeta abierta desde el plano, Intro pasa a la boca siguiente en la misma tarjeta. */
        bocaVecina(1);
      } else if (destino === 'siguiente') {
        const bocas = [...$app.querySelectorAll('li[data-boca]')];
        const i = bocas.findIndex((x) => x.dataset.boca === claveBoca(plano, punto));
        const sig = bocas.slice(i + 1).find((x) => casillas(x).every((c) => c.value === '')) || bocas[i + 1];
        if (sig && casillas(sig)[0]) casillas(sig)[0].focus();
      } else if (destino) {
        const d = $app.querySelector(`input[data-plano="${CSS.escape(destino.plano)}"][data-punto="${CSS.escape(destino.punto)}"]${destino.m !== undefined ? `[data-m="${destino.m}"]` : '[data-q]'}`);
        if (d) d.focus();
      }
      if (AG) AG.olvidar(claveBorradorBoca(plano, punto));
    } catch (e) {
      /* Lo tecleado NO se borra (JC, 28-oct): se queda en la casilla y en el móvil. */
      ins.forEach((x) => { x.disabled = false; });
      apuntarBoca(li);
      if (AG && AG.sinRed(e)) { C.aviso('Sin conexión: la medida queda guardada en el móvil y se mandará sola.'); if (COLA) COLA.masTarde(); } else C.aviso(e.message);
    }
  }

  /*
   * LA BOCA A MEDIAS, EN EL TELÉFONO (JC, 28-oct: «autoguardado en toda la
   * app»): cada tecla deja la boca en `cx.borrador.boca.<plano>|<punto>`; si
   * no llega al ordenador (sin red, app cerrada), al volver se repinta lo
   * tecleado y la cola la manda sola. Se borra cuando el servidor la guarda.
   */
  const claveBorradorBoca = (plano, punto) => `boca.${plano}|${punto}`;
  const claveCasilla = (x) => (x.dataset.q ? 'q' : x.dataset.t ? 't' : `m${x.dataset.m}`);
  function apuntarBoca(li) {
    if (!AG) return;
    const ins = casillas(li);
    if (!ins.length) return;
    const { plano, punto } = ins[0].dataset;
    const clave = claveBorradorBoca(plano, punto);
    if (!cambiada(li)) { AG.olvidar(clave); return; }
    AG.guardar(clave, { planoId: plano, puntoId: punto, cuerpo: cuerpoBoca(ins), valores: Object.fromEntries(ins.map((x) => [claveCasilla(x), x.value])) });
  }
  function restaurarBocas() {
    if (!AG) return;
    for (const li of $app.querySelectorAll('li[data-boca]')) {
      const ins = casillas(li);
      if (!ins.length) continue;
      const b = AG.leer(claveBorradorBoca(ins[0].dataset.plano, ins[0].dataset.punto));
      if (!b || !b.valores) continue;
      ins.forEach((x) => { const v = b.valores[claveCasilla(x)]; if (v !== undefined) x.value = v; });
      if (cambiada(li)) { li.dataset.borrador = '1'; try { vivoBoca(li); } catch { /* nada */ } }
    }
  }
  async function enviarBocaPendiente(clave, b) {
    const foco = document.activeElement;
    if (foco && foco.dataset && foco.dataset.plano === b.planoId && foco.dataset.punto === b.puntoId) return false;
    const r = await C.postJson('api/boca', { planoId: b.planoId, puntoId: b.puntoId, ...(b.cuerpo || {}) });
    /* Un «no» del servidor (permiso, boca que ya no existe) no se reintenta para siempre. */
    AG.olvidar(clave);
    if (r.ok && ficha && r.equipo && ficha.equipo.id === r.equipo.id) {
      ficha = r;
      if (activa() && !hoja && pestanaEq === 'balanceo' && !escribiendoEnApp()) { const y = window.scrollY; pintarFicha(); window.scrollTo(0, y); }
    }
    return true;
  }

  /*
   * GUARDAR MIENTRAS SE ESCRIBE (23-oct-2026, JC: «la sincronización con el
   * ordenador debe de ser instantánea»): antes la boca solo se guardaba al
   * salir de ella, así que lo último tecleado no llegaba a la oficina hasta
   * tocar otra boca. Ahora, a los ~0,8 s sin teclear, se guarda en silencio:
   * sin bloquear las casillas ni repintar (se sigue escribiendo). Al guardar,
   * la base cambia y la sincronización sube sola (cxobra/arranque.js › tras).
   * Al salir de la boca se hace el guardado de siempre, que repinta.
   */
  const ESPERA_GUARDAR_BOCA = 800;
  const temporizadores = new WeakMap();
  function guardarBocaPronto(li) {
    clearTimeout(temporizadores.get(li));
    temporizadores.set(li, setTimeout(() => { guardarBocaEnSilencio(li); }, ESPERA_GUARDAR_BOCA));
  }
  async function guardarBocaEnSilencio(li) {
    if (!li.isConnected || !activa() || !cambiada(li)) return;
    const ins = casillas(li);
    if (!ins.length) return;
    const { plano, punto } = ins[0].dataset;
    const enviado = ins.map((x) => x.value);
    try {
      const r = await C.postJson('api/boca', { planoId: plano, puntoId: punto, ...cuerpoBoca(ins) });
      if (!r.ok) return; /* el error se dirá al salir de la boca */
      ficha = r;
      /* Lo que no ha cambiado mientras viajaba ya está guardado; lo demás sigue pendiente. */
      ins.forEach((x, i) => { if (x.value === enviado[i]) x.defaultValue = x.value; });
      li.dataset.guardada = '1';
      apuntarBoca(li);
    } catch { /* sin conexión: queda en el móvil (apuntarBoca) y la cola la manda */ if (COLA) COLA.masTarde(); }
  }

  /* El equipo de medida de una boca, o de todas: se guarda ya. Lo medido no
     se borra (con el anemómetro, un caudal apuntado sale en «Q del aparato»). */
  async function cambiarEquipo(boton, todas) {
    if (!ficha || boton.classList.contains('activa')) return;
    const elegido = boton.dataset.lectura ? { equipoMedida: 'anemometro', lectura: boton.dataset.lectura } : { equipoMedida: boton.dataset.equipo };
    const cuerpo = todas ? { equipoId: ficha.equipo.id, ...elegido }
      : { planoId: boton.dataset.eplano, puntoId: boton.dataset.epunto, ...elegido };
    /* Lo tecleado y sin guardar de esa boca va en la misma petición: no se pierde al repintar. */
    const li = todas ? null : boton.closest('li[data-boca]');
    /* (al cambiar velocidad/caudal, M1–M4 cambian de unidad: lo tecleado no se manda) */
    if (li && cambiada(li) && !boton.dataset.lectura) Object.assign(cuerpo, cuerpoBoca(casillas(li)));
    boton.closest('.segmento').querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      const r = await C.postJson(todas ? 'api/equipo/medida' : 'api/boca', cuerpo);
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      if (!activa()) return;
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    } catch (e) { C.aviso(e.message); if (activa()) pintarFicha(); }
  }

  /* ═══════════════════════════════════ 3. Las fichas del equipo */

  const ESTADO_FICHA = {
    sinFicha: ['neutra', 'Sin empezar'], sinEmpezar: ['neutra', 'Sin empezar'], pendiente: ['aviso', 'A medias'],
    completa: ['info', 'Completa'], firmada: ['bien', 'Firmada'],
  };
  const RESULTADO = { apto: ['bien', 'APTO'], aRevisar: ['aviso', 'A REVISAR'], noApto: ['mal', 'NO APTO'] };
  /* «A medias» sin un solo dato relleno se contradice (JC, 29-oct): sin datos, «Sin empezar». */
  /* Y al revés (JC, 29-oct): «2 de 2 datos» y «A medias» se contradicen: entera, «Completa». */
  const estadoVisible = (estado, medidos, bocasSinMedir) => {
    if (estado !== 'pendiente' || !medidos) return estado;
    if (!medidos.rellenos) return 'sinEmpezar';
    return medidos.obligatorios && medidos.rellenos >= medidos.obligatorios && !(bocasSinMedir || []).length ? 'completa' : estado;
  };
  const chipFicha = (estado0, resultado, medidos, bocasSinMedir) => {
    const estado = estadoVisible(estado0, medidos, bocasSinMedir);
    const [c, n] = ESTADO_FICHA[estado] || ['neutra', estado || ''];
    const r = resultado && RESULTADO[resultado];
    return `<span class="chip ${c}">${esc(n)}</span>${r ? ` <span class="chip ${r[0]}">${esc(r[1])}</span>` : ''}`;
  };
  const CLASE_FICHA = { checklist: 'Checklist', fichaPM: 'Puesta en marcha', estanqAgua: 'Estanqueidad', estanqRefrigerante: 'Estanqueidad', balanceo: 'Balanceo' };

  /* Lo que falta de una ficha, dicho con nombre: en la de balanceo, qué filas
     de caudal no tienen medido (y si son el total de la UTA por circuito,
     que no son las bocas del plano); en las demás, la cuenta de datos. */
  function textoMedidos(x) {
    const sin = x.bocasSinMedir || [];
    if (x.clase === 'balanceo' && sin.length) {
      const nombre = (b) => `${b.circuito === 'retorno' ? 'retorno' : 'impulsión'}${b.terminal ? ` (${b.terminal})` : ''}`;
      const totales = sin.every((b) => b.totalEquipo);
      const lista = sin.map(nombre).join(' y ');
      return totales
        ? `Falta el caudal medido total de la UTA: ${lista}. Va aparte de las bocas del plano`
        : `Falta el caudal medido de ${sin.length === 1 ? 'la fila' : `${sin.length} filas`}: ${lista}`;
    }
    return x.medidos && x.medidos.obligatorios ? `${x.medidos.rellenos} de ${x.medidos.obligatorios} datos` : null;
  }

  /*
   * «VER HOJA» (JC, 29-oct: «poder ver los modelos con los datos definitivos
   * cuando se rellenen»): el modelo oficial del cliente tal como se imprime y se entrega —el
   * mismo PDF que saca el escritorio, con sus firmas—, a pantalla completa y
   * con Compartir. Mientras la ficha no esté completa es un BORRADOR y lo dice
   * aquí y en el nombre del PDF (la hoja no lleva marca de agua: JC, 15-oct).
   */
  const esDefinitiva = (x) => ['completa', 'firmada'].includes(estadoVisible(x.estado, x.medidos, x.bocasSinMedir));
  function htmlVerHoja(x, i) {
    if (!x.plantilla || estadoVisible(x.estado, x.medidos, x.bocasSinMedir) === 'sinFicha') return '';
    const def = esDefinitiva(x);
    return `<div class="ver-hoja"><button type="button" class="enlace" data-cx="ver-hoja" data-i="${i}">Ver hoja</button><span class="chip ${def ? 'bien' : 'aviso'}">${def ? 'Definitiva' : 'Borrador'}</span></div>`;
  }

  async function verHoja(b) {
    const x = fichasEq && (fichasEq.fichas || [])[Number(b.dataset.i)];
    if (!x || !x.plantilla) return;
    const obra = (fichasEq.equipo && fichasEq.equipo.obraId) || (ficha && ficha.equipo.obraId);
    const q = new URLSearchParams({ tipo: 'ficha', obra, clave: x.clave, plantilla: x.plantilla });
    const tag = ficha ? ficha.equipo.tag : '';
    await compartirPdf(`api/informe?${q}`, `${[tag, x.nombre].filter(Boolean).join(' - ')}${esDefinitiva(x) ? '' : ' (BORRADOR)'}.pdf`, b);
  }

  function htmlFichas(pestana = 'equipo', titulo = 'Fichas del equipo') {
    if (!fichasEq) return `<section id="fichas-equipo"><h2>${esc(titulo)}</h2><p class="cargando">Cargando las fichas…</p></section>`;
    if (fichasEq.ok === false) return `<section id="fichas-equipo"><h2>${esc(titulo)}</h2><p class="nota aviso">${esc(fichasEq.error)}</p></section>`;
    /* Se conserva el índice de cada ficha en la lista completa: data-i lo usa abrirHoja. */
    const fs = (fichasEq.fichas || []).map((x, i) => [x, i]).filter(([x]) => !x.conservada && x.papel !== 'UI' && pestanaDeFicha(x) === pestana);
    if (!fs.length && pestana === 'balanceo') return '';
    /* El balanceo, una fila más: abre las bocas del plano y la hoja. */
    const filaBal = pestana === 'equipo' && ficha && tieneBalanceo(ficha) ? htmlFilaBalanceo(ficha) : '';
    /* Sin plano: qué se mide y dónde (un cassette, sus 3 velocidades; un split, la Tª de impulsión). */
    const med = pestana === 'equipo' && ficha && !filaBal && ficha.medicion && ficha.medicion.titulo ? ficha.medicion : null;
    const notaMed = med ? `<p class="nota">Medición de aire: ${esc(med.texto.charAt(0).toLowerCase() + med.texto.slice(1))}.</p>` : '';
    const vacio = pestana === 'equipo' && !(fichasEq.fichas || []).length
      ? 'Este equipo no tiene familia asignada: se le pone en el ordenador (Puesta en marcha).' : 'Sin fichas.';
    return `<section id="fichas-equipo" data-plegable>
      <h2>${esc(titulo)} <span class="cuenta">${fs.length + (filaBal ? 1 : 0)}</span></h2>
      ${fs.length || filaBal ? `<ul class="lista-ios numerada">${fs.map(([x, i]) => (!x.plantilla ? `
        <li><div class="fila-ios apagada">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span class="chip neutra">Sin plantilla</span></div>
          <div class="sub">${esc(x.motivo || 'Falta elegir la plantilla')} Se elige en el ordenador (Puesta en marcha).</div>
        </div></li>` : `
        <li><button class="fila-ios" data-cx="hoja" data-i="${i}">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span>${chipFicha(x.estado, x.resultado, x.medidos, x.bocasSinMedir)}</span></div>
          <div class="sub">${esc([CLASE_FICHA[x.clase] || x.clase, x.motivo, textoMedidos(x), x.fotos ? `${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))}</div>
        </button>${htmlVerHoja(x, i)}</li>`)).join('')}${filaBal}</ul>` : `<p class="vacio">${esc(vacio)}</p>`}
      ${notaMed}
    </section>`;
  }

  /* Split y VRF: lo guardado antes en otra unidad del conjunto, para leerlo (no cuenta). */
  function htmlConservadas() {
    const cs = ((fichasEq && fichasEq.ok !== false && fichasEq.fichas) || []).map((x, i) => [x, i]).filter(([x]) => x.conservada);
    if (!cs.length) return '';
    return `<section id="fichas-conservadas" data-plegable>
      <h2>Guardadas antes en otra unidad <span class="cuenta">${cs.length}</span></h2>
      <p class="nota">Se hicieron antes de juntar el conjunto: se conservan y se pueden leer; no cuentan para «completo».</p>
      <ul class="lista-ios">${cs.map(([x, i]) => `
        <li><button class="fila-ios" data-cx="hoja" data-i="${i}">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span>${chipFicha(x.estado, x.resultado, x.medidos, x.bocasSinMedir)}</span></div>
          <div class="sub">${esc([x.unidadTag, CLASE_FICHA[x.clase] || x.clase, textoMedidos(x)].filter(Boolean).join(' · '))}</div>
        </button>${htmlVerHoja(x, i)}</li>`).join('')}</ul>
    </section>`;
  }

  /*
   * EL CHIP DE LA FILA DEL BALANCEO DICE LO MISMO QUE SU SUBTÍTULO (JC, 29-oct:
   * «que no pasen esas incoherencias»). La fila junta las bocas del plano y la
   * hoja: antes el chip era solo el de la hoja, y salía «Completa» con «3 de 10
   * bocas medidas» debajo o «Sin empezar» con todas medidas.
   */
  function chipFilaBalanceo(nBocas, medidas, fuera, hoja) {
    if (fuera) return `<span class="chip mal">${fuera} fuera</span>`;
    const est = hoja ? estadoVisible(hoja.estado, hoja.medidos, hoja.bocasSinMedir) : null;
    const hojaSin = !hoja || est === 'sinEmpezar' || est === 'sinFicha';
    if (nBocas && medidas < nBocas) {
      return !medidas && hojaSin ? chipFicha('sinEmpezar') : chipFicha('pendiente');
    }
    if (hoja) return nBocas && hojaSin ? chipFicha('pendiente') : chipFicha(hoja.estado, hoja.resultado, hoja.medidos, hoja.bocasSinMedir);
    return nBocas ? '<span class="chip bien">Medido</span>' : '';
  }

  function htmlFilaBalanceo(f) {
    const bocas = f.planos.flatMap((p) => p.bocas);
    const medidas = bocas.filter((b) => b.caudal !== null && b.caudal !== undefined).length;
    const fuera = bocas.filter((b) => b.estado === 'alto' || b.estado === 'bajo').length;
    const hoja = ((fichasEq && fichasEq.fichas) || []).find((x) => x.clase === 'balanceo' && !x.conservada);
    const chip = chipFilaBalanceo(bocas.length, medidas, fuera, hoja);
    /* Sin bocas, lo que dice la fila es lo de su hoja (que es lo que abre). */
    const sub = bocas.length ? `${medidas} de ${bocas.length} bocas medidas`
      : ['Sin plano de bocas', hoja ? textoMedidos(hoja) : null].filter(Boolean).join(' · ');
    const med = f.medicion || {};
    const extra = med.velocidad ? `a velocidad ${med.velocidad}` : (bocas.length ? null : (med.texto || null));
    return `
        <li><button class="fila-ios" data-cx="ver-balanceo">
          <div class="fila-principal"><strong>${esc(tituloMedicion(f).toUpperCase())}</strong><span>${chip}</span></div>
          <div class="sub">${esc([sub, extra].filter(Boolean).join(' · '))}</div>
        </button></li>`;
  }

  const ahoraEs = () => { const d = new Date(); const d2 = (n) => String(n).padStart(2, '0'); return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()} ${d2(d.getHours())}:${d2(d.getMinutes())}`; };
  const hoyIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const coma = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
  const num = (t) => { const s = String(t ?? '').trim().replace(/\s/g, '').replace(',', '.'); return s === '' ? null : (Number.isFinite(Number(s)) ? Number(s) : NaN); };

  /* Una ficha leída del servidor, lista para teclear en ella (la hoja o la toma de datos). */
  function nuevaHoja(ref, nombre, r) {
    const h = { ref, nombre, f: r, valores: {}, cabecera: {}, observaciones: undefined, nuevas: [], quitar: new Set(), cambiada: false };
    /* Hoy y quien lleva el teléfono, de entrada (se pueden cambiar). */
    if (r.editable && !r.cabecera.fechaEnsayo) h.cabecera.fechaEnsayo = hoyIso();
    if (r.editable && !r.cabecera.realizadoPor) {
      let s = null;
      try { s = window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion(); } catch { /* sin sesión */ }
      if (s && s.nombre) h.cabecera.realizadoPor = s.nombre;
    }
    return h;
  }

  async function abrirHoja(i) {
    const x = fichasEq && fichasEq.fichas[i];
    if (!x) return;
    /* Lo tecleado en la toma de datos y sin guardar sigue en la hoja completa. */
    const t = tomas.get(claveToma(x));
    const ref = { obra: fichasEq.equipo.obraId, clave: x.clave, plantilla: x.plantilla };
    /* La misma ficha aún guardándose (se salió hace un momento): se sigue con ella, no con una copia. */
    const viva = (t && t.f && t.cambiada) ? t : vivas.get(claveBorrador(ref));
    if (viva && viva.f && viva.cambiada) {
      tomas.delete(claveToma(x));
      viva.nombre = x.nombre;
      hoja = viva;
      hoja.fotoUi = x.papel === 'UI' && x.unidadId ? { equipoId: x.unidadId, tag: x.unidadTag || '' } : null;
      pintarHoja();
      window.scrollTo(0, 0);
      return;
    }
    $app.innerHTML = '<p class="cargando">Cargando la ficha…</p>';
    abriendoHoja += 1;
    try {
      const r = await C.pedir(`api/ficha?${new URLSearchParams(ref)}`);
      if (!r.ok) throw new Error(r.error);
      hoja = await recuperarBorrador(nuevaHoja(ref, x.nombre, r));
      hoja.fotoUi = x.papel === 'UI' && x.unidadId ? { equipoId: x.unidadId, tag: x.unidadTag || '' } : null;
      pintarHoja();
      window.scrollTo(0, 0);
    } catch (e) {
      C.aviso(e.message);
      /* No se abrió: si venía directa del equipo, se queda en el equipo (no en el balanceo). */
      if (balDirecto) { balDirecto = false; pestanaEq = 'equipo'; }
      pintarFicha();
    } finally { abriendoHoja -= 1; }
  }

  /* Lo que se ve: lo tecleado ahora si lo hay; si no, lo guardado. */
  const valorDe = (p, k = 'v') => {
    const c = hoja.valores[p.codigo];
    if (c && c[k] !== undefined) return c[k];
    return k === 'v' ? p.valor : p[k];
  };
  const cabDe = (k) => (hoja.cabecera[k] !== undefined ? hoja.cabecera[k] : hoja.f.cabecera[k]);

  const BOTONES_RESP = { siNoNa: [['si', 'Sí'], ['no', 'No'], ['na', 'N/A']], siNo: [['si', 'Sí'], ['no', 'No']], okNoOk: [['ok', 'OK'], ['noOk', 'NO OK']] };
  /* El color del botón marcado: la misma regla que el PDF (reglasCx.tonoRespuesta,
     29-oct-2026). Rojo solo lo NO conforme: el «No» de un punto de chequeo, el
     «NO OK» y el «Sí» de una fuga. Un dato de la instalación («Asociado a red
     de conductos») es una respuesta, sin rojo ni verde. */
  const tonoResp = (p, k, tipoSeccion) => {
    if (k === 'noOk') return 'mal';
    if (k === 'ok') return 'bien';
    if (k === 'na') return 'neutra';
    if (p && p.tipo === 'siNo' && /fuga/i.test(String(p.codigo || ''))) return k === 'si' ? 'mal' : 'bien';
    const deChequeo = tipoSeccion ? tipoSeccion === 'checklist' : !(p && p.tipo === 'siNo');
    if (!deChequeo) return 'neutra';
    return k === 'no' ? 'mal' : 'bien';
  };
  const claseResp = (k, p, tipoSeccion) => `activa ${tonoResp(p, k, tipoSeccion)}`;

  /*
   * LA HOJA DENSA, como la hoja del PDF (15-oct-2026, JC: «no me gustan nada
   * esos listados tan largos con campos tan grandes para datos tan
   * pequeños»): etiqueta y campo en la misma fila, los parámetros en tabla
   * con Proyecto | Fabricante | Medido una sola vez arriba, Sí/No/N/A
   * pequeños dentro de la fila e impulsión y retorno lado a lado.
   */
  const obligatorioDe = (p) => (p.obligatorio ? ' <b class="obligatorio" aria-label="obligatorio">*</b>' : '');
  const unidadDe = (p) => (p.unidad ? ` <span class="tenue">${esc(p.unidad)}</span>` : '');

  /* Solo el campo, sin etiqueta: para las filas y las rejillas. */
  function inputPunto(p, ed, aria, tipoSeccion) {
    const dis = ed ? '' : 'disabled';
    const v = valorDe(p);
    const a = `aria-label="${esc(aria || p.etiqueta)}"`;
    if (BOTONES_RESP[p.tipo]) {
      return `<div class="respuestas mini">${BOTONES_RESP[p.tipo].map(([k, n]) => `<button type="button" ${dis} class="${v === k ? claseResp(k, p, tipoSeccion) : ''}" data-h-resp="${k}" data-h-punto="${esc(p.codigo)}">${n}</button>`).join('')}</div>`;
    }
    if (p.tipo === 'numero') return `<input class="cifra corto" inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${a} value="${esc(coma(v))}" data-h-punto="${esc(p.codigo)}" data-h-k="v" data-h-num>`;
    if (p.tipo === 'fecha') return `<input type="date" ${dis} ${a} value="${esc(String(v || '').slice(0, 10))}" data-h-punto="${esc(p.codigo)}" data-h-k="v">`;
    if (p.tipo === 'lista') return `<select ${dis} ${a} data-h-punto="${esc(p.codigo)}" data-h-k="v"><option value="">—</option>${(p.opciones || []).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<input autocomplete="off" enterkeyhint="next" ${dis} ${a} value="${esc(v ?? '')}" data-h-punto="${esc(p.codigo)}" data-h-k="v">`;
  }

  /* Checklists numerados como el PDF del libro (JC, 15-oct): secciones «01 ·»
     y puntos «01.01», desde el 01. Solo se ve así: el código guardado no cambia. */
  const numCheck = (n) => String(n || '').split('.').map((x) => (/^\d+$/.test(x) ? x.padStart(2, '0') : x)).join('.');
  const tituloSeccion = (s) => (s.tipo === 'checklist' && s.numero ? `${numCheck(s.numero)} · ${s.titulo}` : s.titulo);

  /* Una fila: etiqueta a la izquierda, campo (o Sí/No/N/A) a la derecha. */
  function campoPunto(s, p, ed) {
    if (s.tipo === 'parametros') return filaParametro(p, ed);
    const num = s.tipo === 'checklist' ? `<span class="num">${esc(numCheck(p.numero || p.codigo))}</span>` : '';
    const clase = BOTONES_RESP[p.tipo] ? 'fd resp' : `fd${p.tipo === 'numero' ? ' n' : ''}`;
    return `<div class="${clase}"><span class="et">${num}${esc(p.etiqueta)}${obligatorioDe(p)}${unidadDe(p)}</span>${inputPunto(p, ed, null, s.tipo)}</div>`;
  }

  const casillaParametro = (p, k, n, dis) => `<input class="cifra${k === 'm' ? ' medido' : ''}" inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis}
      aria-label="${esc(`${p.etiqueta} · ${n}`)}" value="${esc(coma(valorDe(p, k)))}" data-h-punto="${esc(p.codigo)}" data-h-k="${k}">`;
  /* La desviación y el resultado de un parámetro, como los calcula el servidor. */
  function desvParametro(p) {
    const [cr, nr] = p.resultado && RESULTADO[p.resultado] ? RESULTADO[p.resultado] : ['neutra', ''];
    return p.desv !== null && p.desv !== undefined ? `<span class="desv ${cr}">${cifra(p.desv * 100, 1)} %${nr ? ` · ${esc(nr)}` : ''}</span>` : (nr ? `<span class="desv ${cr}">${esc(nr)}</span>` : '');
  }

  function filaParametro(p, ed) {
    const dis = ed ? '' : 'disabled';
    const casilla = (k, n) => casillaParametro(p, k, n, dis);
    const desv = desvParametro(p);
    /* Caudal de aire: de dónde sale el medido (lo tecleado ahora es del equipo). */
    const tecleado = hoja.valores[p.codigo] && hoja.valores[p.codigo].m !== undefined;
    const origen = p.origen ? ` <span class="tenue">· ${esc(tecleado ? 'medido en equipo' : p.origen)}</span>` : '';
    return `<div class="pp"><span class="et">${esc(p.etiqueta)}${obligatorioDe(p)}${unidadDe(p)}${origen}${desv}</span>${casilla('p', 'Proyecto')}${casilla('f', 'Fabricante')}${casilla('m', 'Medido')}</div>`;
  }

  /* Una sección: banda fina con su título y las filas debajo. */
  function htmlSeccion(s, ed) {
    if (s.tipo === 'parametros') {
      return `<h3 class="banda">${esc(s.titulo)}</h3>
        <section class="hoja-tabla param">
          <div class="pp cab"><span></span><span>Proyecto</span><span>Fabric.</span><span>Medido</span></div>
          ${s.puntos.map((p) => filaParametro(p, ed)).join('')}
        </section>`;
    }
    const resp = s.puntos.every((p) => BOTONES_RESP[p.tipo]);
    return `<h3 class="banda">${esc(tituloSeccion(s))}</h3>
      <section class="hoja-tabla ${resp ? 'lista-resp' : 'rejilla-datos'}">${s.puntos.map((p) => campoPunto(s, p, ed)).join('')}</section>`;
  }

  /* «FILTROS IMPULSIÓN» + «FILTROS RETORNO» (o «VENTILADOR DE …»), con los
     mismos datos: una tabla con Impulsión | Retorno en columnas. */
  const LADO_RE = /^(.*?)\s+(?:DE\s+)?(IMPULSI[ÓO]N|RETORNO)$/i;
  function parejaDe(a, b) {
    if (!a || !b || a.tipo !== 'datos' || b.tipo !== 'datos') return false;
    const ma = LADO_RE.exec(a.titulo || '');
    const mb = LADO_RE.exec(b.titulo || '');
    if (!ma || !mb || ma[1].toUpperCase() !== mb[1].toUpperCase()) return false;
    if (!/^IMPULSI/i.test(ma[2]) || !/^RETORNO/i.test(mb[2])) return false;
    return a.puntos.length === b.puntos.length && a.puntos.every((p, i) => p.etiqueta === b.puntos[i].etiqueta && p.tipo === b.puntos[i].tipo);
  }
  function htmlPareja(a, b, ed) {
    const base = LADO_RE.exec(a.titulo)[1];
    return `<h3 class="banda">${esc(base)} · impulsión y retorno</h3>
      <section class="hoja-tabla pareja">
        <div class="ir cab"><span></span><span>Impulsión</span><span>Retorno</span></div>
        ${a.puntos.map((p, i) => `<div class="ir"><span class="et">${esc(p.etiqueta.replace(/\s*\(clase\)$/i, ''))}${obligatorioDe(p)}${unidadDe(p)}</span>${inputPunto(p, ed, `${p.etiqueta} · impulsión`)}${inputPunto(b.puntos[i], ed, `${p.etiqueta} · retorno`)}</div>`).join('')}
      </section>`;
  }

  /*
   * LOS DATOS DEL SISTEMA DE LA FICHA DE BALANCEO, a la manera de su Excel
   * (15-oct-2026, JC: «muy feo este formulario»): el TAG de cabecera, lo de
   * proyecto en lectura, impulsión y retorno lado a lado, la unidad dentro
   * del campo, el método de medida con un toque y lo que mide el técnico
   * grande, abajo, a mano del pulgar.
   */
  const METODOS_BAL = ['Anemómetro', 'Balómetro', 'Tubo de Pitot'];
  function htmlDatosBalanceo(s, ed) {
    const dis = ed ? '' : 'disabled';
    const pt = (c) => s.puntos.find((p) => p.codigo === c) || null;
    const usados = new Set(['equipo', 'zona_servida', 'caudal_proyecto_impulsion', 'caudal_proyecto_retorno', 'metodo_medida',
      'frecuencia_final_impulsion', 'frecuencia_final_retorno', 'presion_estatica_impulsion', 'presion_estatica_retorno',
      'caudal_medido_impulsion', 'caudal_medido_retorno']);
    const tag = (pt('equipo') && valorDe(pt('equipo'))) || (ficha && ficha.equipo.tag) || '';
    const proyecto = (c) => {
      const p = pt(c);
      if (!p) return '<span class="tenue">—</span>';
      const v = valorDe(p);
      if (v !== null && v !== undefined && v !== '' && !(hoja.valores[c] && 'v' in hoja.valores[c])) return `<span class="bal-leido cifra">${cifra(v, 0)} <small>m³/h</small></span>`;
      return ed ? `<span class="con-unidad pequeno"><input inputmode="decimal" autocomplete="off" value="${esc(coma(v))}" data-h-punto="${esc(c)}" data-h-k="v" data-h-num placeholder="—"><i>m³/h</i></span>`
        : '<span class="tenue">—</span>';
    };
    const medida = (c, unidad) => {
      const p = pt(c);
      if (!p) return '<span></span>';
      return `<span class="con-unidad"><input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} value="${esc(coma(valorDe(p)))}"
        data-h-punto="${esc(c)}" data-h-k="v" data-h-num aria-label="${esc(p.etiqueta)}"><i>${esc(p.unidad || unidad)}</i></span>`;
    };
    const metodo = pt('metodo_medida');
    const vm = metodo ? valorDe(metodo) : null;
    const otros = s.puntos.filter((p) => !usados.has(p.codigo));
    return `<h2>Datos del sistema</h2>
      <section class="grupo bal-datos">
        <div class="bal-tag"><span>Equipo (TAG)</span><strong class="cifra">${esc(tag || '—')}</strong></div>
        ${pt('zona_servida') ? `<label class="bal-zona"><span>Zona servida</span><input autocomplete="off" ${dis} value="${esc(valorDe(pt('zona_servida')) ?? '')}"
          data-h-punto="zona_servida" data-h-k="v" placeholder="p. ej. Vestuarios N10"></label>` : ''}
        <div class="bal-tabla">
          <div class="bal-cab"><span></span><span>Impulsión</span><span>Retorno</span></div>
          <div class="bal-fila proyecto"><span>Caudal proyecto</span>${proyecto('caudal_proyecto_impulsion')}${proyecto('caudal_proyecto_retorno')}</div>
          <div class="bal-sub">Lo mides tú</div>
          <div class="bal-fila"><span>Frecuencia final</span>${medida('frecuencia_final_impulsion', 'Hz')}${medida('frecuencia_final_retorno', 'Hz')}</div>
          <div class="bal-fila"><span>Presión estática</span>${medida('presion_estatica_impulsion', 'Pa')}${medida('presion_estatica_retorno', 'Pa')}</div>
          ${pt('caudal_medido_impulsion') ? `<div class="bal-fila"><span>Caudal total <small class="tenue">si procede</small></span>${medida('caudal_medido_impulsion', 'm³/h')}${medida('caudal_medido_retorno', 'm³/h')}</div>` : ''}
        </div>
        ${metodo ? `<div class="bal-metodo"><span>Método de medida</span>
          <div class="respuestas segmento">${METODOS_BAL.map((m) => `<button type="button" ${dis} class="${vm === m ? 'activa' : ''}" data-h-resp="${esc(m)}" data-h-punto="metodo_medida">${esc(m)}</button>`).join('')}</div>
          ${vm && !METODOS_BAL.includes(vm) ? `<div class="sub">Apuntado: ${esc(vm)}</div>` : ''}</div>` : ''}
        ${otros.map((p) => campoPunto(s, p, ed)).join('')}
      </section>`;
  }

  /*
   * LA HOJA POR APARTADOS (revisión UX, 18-oct): un checklist de 42 preguntas
   * era una sola página que no se acababa nunca, con «Guardar» al fondo. Si la
   * hoja es larga se parte en apartados, con una barra arriba que dice cuántos
   * obligatorios lleva cada uno (✓ si están todos) y «Siguiente» al final.
   * Las hojas cortas siguen en una página.
   */
  const PUNTOS_UNA_PAGINA = 15;
  const PUNTOS_POR_PASO = 8;
  const relleno = (s, p) => {
    const v = s.tipo === 'parametros' ? valorDe(p, 'm') : valorDe(p);
    return v !== null && v !== undefined && v !== '';
  };
  /* Los apartados: las secciones (con sus parejas), juntando las pequeñas seguidas. */
  function pasosHoja(f, ed) {
    const secs = f.secciones.filter((s) => s.tipo !== 'fotos' && (s.tipo === 'bocas' || s.puntos.length));
    const trozos = [];
    for (let i = 0; i < secs.length; i += 1) {
      const s = secs[i];
      if (s.tipo === 'bocas') trozos.push({ secs: [s], solo: true, html: `<h3 class="banda">${esc(s.titulo)}</h3><p class="nota">Las bocas se miden en la ficha del equipo (boca a boca sobre su plano) y salen en el informe del balanceo.</p>` });
      else if (s.tipo === 'datos' && f.plantilla.codigo === 'BALANCEO_CAUDALES') trozos.push({ secs: [s], solo: true, html: htmlDatosBalanceo(s, ed) });
      else if (parejaDe(s, secs[i + 1])) { trozos.push({ secs: [s, secs[i + 1]], html: htmlPareja(s, secs[i + 1], ed) }); i += 1; }
      else trozos.push({ secs: [s], html: htmlSeccion(s, ed) });
    }
    const pasos = [];
    for (const t of trozos) {
      const n = t.secs.reduce((a, s) => a + s.puntos.length, 0);
      const ult = pasos[pasos.length - 1];
      if (ult && !t.solo && !ult.solo && ult.n + n <= PUNTOS_POR_PASO) { ult.secs.push(...t.secs); ult.html += t.html; ult.n += n; }
      else pasos.push({ ...t, secs: [...t.secs], n, titulo: t.secs[0].tipo === 'checklist' && t.secs[0].numero ? tituloSeccion(t.secs[0]) : (LADO_RE.exec(t.secs[0].titulo || '') || [null, t.secs[0].titulo])[1] });
    }
    return pasos;
  }
  /* Obligatorios rellenos de un apartado: [hechos, de]. */
  function cuentaPaso(paso) {
    let hechos = 0;
    let de = 0;
    for (const s of paso.secs) for (const p of s.puntos) if (p.obligatorio) { de += 1; if (relleno(s, p)) hechos += 1; }
    return [hechos, de];
  }
  const marcaPaso = (paso) => {
    const [hechos, de] = cuentaPaso(paso);
    return !de ? '' : hechos === de ? '<b class="ok" aria-label="completo">✓</b>' : `<small>${hechos}/${de}</small>`;
  };
  function refrescarPasos() {
    if (!hoja || !hoja.pasos) return;
    $app.querySelectorAll('[data-cx="paso-hoja"][data-paso]').forEach((b) => {
      const paso = hoja.pasos[Number(b.dataset.paso)];
      const m = b.querySelector('.marca');
      if (paso && m) m.innerHTML = marcaPaso(paso);
    });
  }
  function irAPaso(i) {
    const n = $app.querySelectorAll('.paso-hoja').length;
    if (!n) return;
    hoja.paso = Math.max(0, Math.min(n - 1, i));
    $app.querySelectorAll('.paso-hoja').forEach((x, k) => { x.hidden = k !== hoja.paso; });
    $app.querySelectorAll('.pasos-hoja [data-paso]').forEach((b, k) => { b.setAttribute('aria-selected', String(k === hoja.paso)); b.classList.toggle('activa', k === hoja.paso); });
    const chip = $app.querySelector('.pasos-hoja .activa');
    if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
    window.scrollTo(0, 0);
  }
  /* El aviso discreto del autoguardado (sin botón Guardar que se pueda olvidar). */
  const TEXTO_AG = { guardando: 'Guardando…', guardado: 'Guardado', movil: 'Guardado en el móvil', sinRed: 'Sin conexión, se guardará', error: 'No se ha guardado', pendiente: 'Sin guardar' };
  const marcaAG = (estado) => `<span class="autoguardado ${esc(estado || '')}" role="status" aria-live="polite">${esc(TEXTO_AG[estado] || '')}</span>`;
  const estadoGuardar = (h) => marcaAG(h._estado || (h.cambiada ? 'movil' : ''));

  /*
   * «LO QUE FALTA» CON LA MISMA CUENTA QUE LA PASTILLA (revisión UX 18-oct, 5):
   * la pastilla de arriba dice «0/42» (medidas obligatorias) y esta lista decía
   * 44, porque metía la fecha y el «realizado por». Ahora se separan: primero
   * los datos (que se resuelven aquí mismo) y luego las medidas, que en una
   * hoja por apartados no se listan una a una («Respuesta 3.5» × 40) sino por
   * apartado, con un enlace que lleva a él.
   */
  function htmlLoQueFalta(f, pasos, vistos) {
    if (!f.faltan.length) return '';
    const datos = f.faltanDatos || [];
    const medidasLista = f.faltan.filter((x) => !datos.includes(x));
    const medidas = f.medidos ? Math.max(0, f.medidos.obligatorios - f.medidos.rellenos) : medidasLista.length;
    const partes = [];
    if (medidas) partes.push(`${medidas} medida${medidas === 1 ? '' : 's'}`);
    if (datos.length) partes.push(`${datos.length} dato${datos.length === 1 ? '' : 's'}`);
    if (!partes.length) return '';
    let liMedidas = '';
    const pendientes = pasos && medidas ? pasos.map((p, i) => [p, i, cuentaPaso(p)]).filter(([, , [h, de]]) => h < de) : [];
    if (pendientes.length) {
      liMedidas = pendientes.map(([p, i, [h, de]]) => `<li><button class="enlace" data-cx="paso-hoja" data-ir="${i}">${esc(p.titulo)}</button> <span class="tenue">${de - h} de ${de}</span></li>`).join('');
    } else if (medidas) {
      liMedidas = medidasLista.slice(0, vistos).map((x) => `<li>${esc(x)}</li>`).join('') + (medidasLista.length > vistos ? `<li class="tenue">y ${medidasLista.length - vistos} más</li>` : '');
    }
    return `<h3 class="banda">Lo que falta <span class="tenue">${partes.join(' · ')}</span></h3>
      <ul class="faltan-hoja">${datos.map((x) => `<li>${esc(x)}</li>`).join('')}${liMedidas}</ul>`;
  }

  function pintarHoja() {
    const h = hoja;
    const f = h.f;
    const ed = f.editable;
    const fotosGuardadas = f.fotos.filter((x) => !h.quitar.has(x.i));
    const total = fotosGuardadas.length + h.nuevas.length;
    const q = new URLSearchParams(h.ref);
    const pasos = pasosHoja(f, ed);
    const porPasos = pasos.length > 1 && pasos.reduce((a, p) => a + p.n, 0) > PUNTOS_UNA_PAGINA;
    h.pasos = porPasos ? pasos : null;
    const nPasos = pasos.length + 1;
    const actual = porPasos ? Math.min(h.paso || 0, nPasos - 1) : 0;
    h.paso = actual;
    const tituloPaso = (i) => (i < pasos.length ? pasos[i].titulo : 'Cierre');
    const abre = (i) => (porPasos ? `<div class="paso-hoja" ${i === actual ? '' : 'hidden'}>` : '');
    const cierra = (i) => (!porPasos ? '' : `<nav class="pasos-pie">
        ${i > 0 ? `<button class="boton secundario" data-cx="paso-hoja" data-ir="${i - 1}">‹ Anterior</button>` : '<span></span>'}
        ${i < nPasos - 1 ? `<button class="boton" data-cx="paso-hoja" data-ir="${i + 1}">Siguiente: ${esc(tituloPaso(i + 1))} ›</button>` : ''}
      </nav></div>`);
    const ensayo = `<h3 class="banda">El ensayo <span class="tenue">${esc(`${f.plantilla.codigo} v${f.plantilla.version || 1}`)}</span></h3>
      <section class="hoja-tabla rejilla-datos">
        <label class="fd"><span class="et">Fecha</span><input type="date" ${ed ? '' : 'disabled'} value="${esc(cabDe('fechaEnsayo') || '')}" data-h-cab="fechaEnsayo"></label>
        <label class="fd"><span class="et">Realizado por</span><input autocomplete="name" ${ed ? '' : 'disabled'} value="${esc(cabDe('realizadoPor') || '')}" data-h-cab="realizadoPor"></label>
      </section>`;
    const FALTAN_VISTOS = porPasos ? 6 : 30;
    $app.innerHTML = `
      ${tagFijo(h.fotoUi && h.fotoUi.tag ? h.fotoUi.tag : ficha ? ficha.equipo.tag : (f.titulo || 'Equipo'), h.nombre || f.plantilla.nombre, 'volver-equipo',
        `${chipFicha(f.estado, f.resultado, f.medidos, f.bocasSinMedir)}${f.medidos && f.medidos.obligatorios ? ` <span class="chip neutra">${f.medidos.rellenos}/${f.medidos.obligatorios}</span>` : ''}`)}
      <div class="densa">
      ${ed ? '' : `<p class="nota aviso">${f.firmada ? 'La ficha está firmada: ya no se cambia.' : 'Tu rol puede ver la ficha, pero no rellenarla.'}</p>`}
      ${porPasos ? `<nav class="pasos-hoja" role="tablist" aria-label="Apartados de la hoja">
        ${pasos.map((p, i) => `<button role="tab" class="${i === actual ? 'activa' : ''}" aria-selected="${i === actual}" data-cx="paso-hoja" data-paso="${i}"><span class="t">${esc(p.titulo)}</span><span class="marca">${marcaPaso(p)}</span></button>`).join('')}
        <button role="tab" class="${actual === pasos.length ? 'activa' : ''}" aria-selected="${actual === pasos.length}" data-cx="paso-hoja" data-paso="${pasos.length}"><span class="t">Cierre</span><span class="marca"></span></button>
      </nav>` : ''}
      ${porPasos ? pasos.map((p, i) => `${abre(i)}${i === 0 ? ensayo : ''}${p.html}${cierra(i)}`).join('') : `${ensayo}${pasos.map((p) => p.html).join('')}`}
      ${abre(nPasos - 1)}
      <h3 class="banda">Observaciones</h3>
      <textarea class="obs" rows="3" ${ed ? '' : 'disabled'} data-h-obs placeholder="Lo que haya que contar (obligatorio si algo sale «No»)">${esc(h.observaciones !== undefined ? h.observaciones : f.observaciones || '')}</textarea>
      <h3 class="banda">Fotos <span class="tenue">${total}/8</span></h3>
      ${total ? `<ul class="fotos-ficha">
        ${fotosGuardadas.map((x) => `<li><img data-src="api/ficha/foto?${q}&i=${x.i}" alt="${esc(x.nombre)}"><div class="pie"><span>${esc(x.nombre)}</span>${ed ? `<button class="enlace mal" data-cx="quitar-foto" data-i="${x.i}">Quitar</button>` : ''}</div></li>`).join('')}
        ${h.nuevas.map((x, i) => `<li class="nueva">${x.url ? `<img src="${esc(x.url)}" alt="Foto nueva">` : '<span class="foto-sin-vista">Foto</span>'}
          <div class="pie"><input placeholder="¿Qué se ve? (p. ej. placa del equipo)" value="${esc(x.pie)}" data-h-pie="${esc(x.local || i)}"><span class="tenue">${esc(x.hora)} · guardada en el móvil</span>
          <button class="enlace mal" data-cx="quitar-nueva" data-i="${esc(x.local || i)}">Quitar</button></div></li>`).join('')}
      </ul>` : '<p class="nota">Las fotos que se hagan aquí salen en el informe, con su pie y su hora.</p>'}
      ${ed && total < 8 ? `<div class="fila-botones">
        <button class="boton secundario" data-cx="foto" data-camara="1"><i class="ic ic-camara"></i>Hacer foto</button>
        <button class="boton secundario" data-cx="foto" data-camara="0">De la galería</button>
      </div>` : ''}
      ${htmlLoQueFalta(f, porPasos ? pasos : null, FALTAN_VISTOS)}
      ${f.bloqueo ? `<p class="nota inc-aviso bloqueo-inc">Bloqueado por <button type="button" class="enlace" data-cx="ir-incidencia" data-id="${esc(f.bloqueo.id)}">${esc(f.bloqueo.codigo)}${f.bloqueo.titulo ? ` · ${esc(f.bloqueo.titulo)}` : ''}</button>: la hoja solo se puede ver.</p>` : ''}
      ${f.avisos.length ? `<p class="nota aviso">${esc(f.avisos.join(' · '))}</p>` : ''}
      <div class="barra-hoja">
        <button class="boton grande secundario" data-cx="pdf-hoja"><i class="ic ic-doc"></i>Informe PDF</button>
        <button class="boton grande secundario" data-cx="pdf-hoja-obra"><i class="ic ic-doc"></i>PDF para obra</button>
      </div>
      <p class="nota">«PDF para obra» lleva lo de proyecto y deja en blanco lo medido, para rellenarlo a mano.</p>
      ${ficha ? `<div class="fila-botones">
        <button class="boton grande" data-cx="terminar-hoja">${ed ? 'Terminar y volver al equipo' : 'Volver al equipo'}</button>
      </div>` : ''}
      ${cierra(nPasos - 1)}
      </div>
      ${ed ? `<div class="barra-guardar" data-hoja-abierta>${estadoGuardar(h)}</div>` : ''}`;
    C.cargarImagenes($app);
  }

  function marcarCambiada() {
    refrescarPasos();
    cambio(hoja);
  }

  function anotar(el) {
    if (anotarEn(hoja, el)) marcarCambiada();
  }
  /* Apunta en la ficha `h` lo tecleado en `el`; dice si había algo que apuntar. */
  function anotarEn(h, el) {
    if (!h || !el.dataset) return false;
    if (el.dataset.hCab) h.cabecera[el.dataset.hCab] = el.value;
    else if (el.hasAttribute('data-h-obs')) h.observaciones = el.value;
    else if (el.dataset.hPie !== undefined) { const x = fotoNuevaDe(h, el.dataset.hPie); if (x) x.pie = el.value; }
    else if (el.dataset.hPunto) {
      const k = el.dataset.hK;
      let v = el.value;
      if (k !== 'v' || el.hasAttribute('data-h-num')) {
        const n = num(v);
        if (Number.isNaN(n)) { el.classList.add('mal'); return false; }
        el.classList.remove('mal');
        v = n;
      } else if (v === '') v = null;
      h.valores[el.dataset.hPunto] = { ...(h.valores[el.dataset.hPunto] || {}), [k]: v };
    } else return false;
    return true;
  }

  /* Una foto nueva de la ficha por su clave en el teléfono (o, sin ella, por su posición). */
  const fotoNuevaDe = (h, k) => h.nuevas.find((x) => x.local && x.local === k) || (/^\d+$/.test(String(k)) ? h.nuevas[Number(k)] : null);

  /*
   * LA FOTO, EN EL TELÉFONO ANTES QUE NADA (JC, 28-oct): se guarda en el móvil
   * (IndexedDB) en cuanto se hace y luego se sube. Si no hay red, se queda en
   * el teléfono y se sube sola después; la ficha no la pierde.
   */
  async function fotoHoja(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !hoja) return;
    const h = hoja;
    const x = AG ? await AG.fotoNueva(archivo, { id: null, pie: '', hora: ahoraEs(), t: Date.now() })
      : { id: null, pie: '', hora: ahoraEs(), t: Date.now(), archivo, url: URL.createObjectURL(archivo) };
    h.nuevas.push(x);
    cambio(h);
    if (hoja === h && activa()) {
      const y = window.scrollY;
      pintarHoja();
      window.scrollTo(0, y);
      const pies = $app.querySelectorAll('[data-h-pie]');
      if (pies.length) pies[pies.length - 1].focus();
    }
    try { await subirFotoNueva(x); escribirBorrador(h); } catch { /* se sube al guardar */ }
  }
  async function subirFotoNueva(x) {
    if (x.id) return x.id;
    const blob = x.archivo || (AG && x.local ? await AG.leerFoto(x.local) : null);
    if (!blob) throw new Error('La foto ya no está en el teléfono: vuelve a hacerla.');
    x.archivo = blob;
    x.id = await C.subirFoto(blob);
    return x.id;
  }

  /* Lo que se manda al guardar una ficha: los datos sueltos con `v`; los de parámetros con p/f/m. */
  function cuerpoFicha(h, fotos = h.nuevas) {
    const valores = {};
    for (const [codigo, c] of Object.entries(h.valores)) {
      if ('v' in c) valores[codigo] = c.v === null || c.v === '' ? null : { v: c.v };
      else valores[codigo] = c;
    }
    return {
      obraId: h.ref.obra, clave: h.ref.clave, plantilla: h.ref.plantilla,
      cabecera: h.cabecera, valores, observaciones: h.observaciones,
      fotosNuevas: fotos.map((x) => ({ id: x.id, pie: x.pie, hora: x.hora })),
      quitarFotos: [...h.quitar],
    };
  }

  /*
   * «GUARDADA» SOLO SI SE HA GUARDADO DE VERDAD (JC, 28-oct: el checklist de un
   * split decía «Todo guardado» y al volver no estaba). El servidor contesta con
   * la ficha RELEÍDA de la base tras guardarla; se comprueba que trae lo que se
   * mandó (las respuestas y los datos sueltos, que el servidor no recalcula). Si
   * algo no está, no se da por guardado: se avisa y lo tecleado se queda.
   */
  function noReleido(cuerpo, r) {
    if (!r || !r.id) return ['la ficha'];
    const puntos = new Map((r.secciones || []).flatMap((s) => s.puntos || []).map((p) => [p.codigo, p]));
    const igual = (a, b) => {
      const n = (x) => (x === null || x === undefined ? '' : String(x).trim());
      if (n(a) === n(b)) return true;
      return n(a) !== '' && n(b) !== '' && Number.isFinite(Number(n(a))) && Number(n(a)) === Number(n(b));
    };
    const faltan = [];
    for (const [codigo, v] of Object.entries(cuerpo.valores || {})) {
      const p = puntos.get(codigo);
      if (!p) continue; /* fuera de la plantilla: el servidor lo descarta a propósito */
      if (v === null) { if (!igual(p.valor, null)) faltan.push(codigo); continue; }
      if ('v' in v && !igual(p.valor, v.v)) faltan.push(codigo);
    }
    return faltan;
  }
  async function postFicha(cuerpo) {
    const r = await C.postJson('api/ficha', cuerpo);
    if (!r.ok) throw new Error(r.error || 'No se ha podido guardar.');
    const faltan = noReleido(cuerpo, r);
    if (faltan.length) throw new Error(`No se ha guardado bien (${faltan.length === 1 ? faltan[0] : `${faltan.length} puntos`}): sigue en el móvil y se vuelve a intentar.`);
    return r;
  }

  /* ═══════════════════════════════════ El autoguardado de las fichas */

  /*
   * NADA SE PIERDE AL IR ATRÁS (JC, 28-oct-2026: «Autoguardado… en toda la
   * app»). Antes lo tecleado en una hoja (checklist, puesta en marcha,
   * estanqueidad del circuito, hoja de balanceo) o en la toma de datos vivía
   * en memoria hasta pulsar «Guardar»: atrás, otra pestaña, bloquear el móvil
   * o cerrar la app, y se perdía. Ahora no hay botón Guardar:
   *   · cada cambio se apunta AL MOMENTO en un borrador del teléfono
   *     (autoguardado.js: `cx.borrador.ficha.<obra>|<clave>|<plantilla>`), y
   *     las fotos se guardan en el teléfono (IndexedDB) antes de subirlas;
   *   · al ~1,2 s sin tocar nada, al salir de la hoja, al cambiar de pantalla
   *     y al irse de la app se manda al servidor por el camino de siempre
   *     (api/ficha, con su comprobación de lo releído);
   *   · sin conexión, el borrador espera en el teléfono y se manda solo al
   *     volver la red (colaGuardado.js), aunque la hoja ya no esté abierta;
   *   · al reabrir la ficha, lo que quedó en el teléfono se vuelve a poner.
   * El aviso discreto dice dónde está: Guardando… · Guardado · Guardado en el
   * móvil · Sin conexión, se guardará.
   */
  const ESPERA_AUTOGUARDADO = 1200;
  const claveBorrador = (ref) => `ficha.${ref.obra}|${ref.clave}|${ref.plantilla}`;
  const hayPendiente = (h) => Object.keys(h.valores).length > 0 || Object.keys(h.cabecera).length > 0
    || h.observaciones !== undefined || h.nuevas.length > 0 || h.quitar.size > 0;
  const comoJson = (v) => JSON.stringify(v === undefined ? null : v);

  function escribirBorrador(h) {
    if (!AG || !h || !h.ref) return;
    if (!h.cambiada) { AG.olvidar(claveBorrador(h.ref)); return; }
    AG.guardar(claveBorrador(h.ref), {
      ref: h.ref, nombre: h.nombre, valores: h.valores, cabecera: h.cabecera,
      observaciones: h.observaciones === undefined ? null : h.observaciones, hayObs: h.observaciones !== undefined,
      fotos: AG.fotosParaGuardar(h.nuevas), quitar: [...h.quitar],
    });
  }

  /* Lo que quedó en el teléfono, otra vez en la ficha leída del servidor. */
  async function recuperarBorrador(h) {
    if (!AG || !h || !h.f || !h.f.editable) return h;
    const b = AG.leer(claveBorrador(h.ref));
    if (!b) return h;
    Object.assign(h.valores, b.valores || {});
    Object.assign(h.cabecera, b.cabecera || {});
    if (b.hayObs) h.observaciones = b.observaciones || '';
    const ya = new Set(h.nuevas.map((x) => x.local));
    for (const x of await AG.restaurarFotos(b.fotos || [])) if (!ya.has(x.local)) h.nuevas.push(x);
    for (const i of b.quitar || []) h.quitar.add(Number(i));
    h.cambiada = hayPendiente(h);
    if (h.cambiada) { h._estado = 'movil'; vivas.set(claveBorrador(h.ref), h); programar(h, 300); }
    return h;
  }

  function cambio(h) {
    if (!h) return;
    h.cambiada = true;
    vivas.set(claveBorrador(h.ref), h);
    h._estado = 'movil';
    escribirBorrador(h);
    pintarEstado(h);
    programar(h);
  }
  function programar(h, ms = ESPERA_AUTOGUARDADO) {
    clearTimeout(h._reloj);
    h._reloj = setTimeout(() => { h._reloj = null; autoguardar(h); }, ms);
  }

  /* El aviso de la hoja abierta o, en la toma, el de todas sus fichas juntas. */
  function pintarEstado(h) {
    if (!$app.querySelector) return;
    if (h === hoja) {
      const el = $app.querySelector('.barra-guardar .autoguardado');
      if (el) { el.className = `autoguardado ${h._estado || ''}`; el.textContent = TEXTO_AG[h._estado] || ''; }
      return;
    }
    const el = $app.querySelector('.barra-toma .autoguardado');
    if (el) { const e = estadoTomas(); el.className = `autoguardado ${e}`; el.textContent = TEXTO_AG[e] || ''; }
  }
  function estadoTomas() {
    const es = [...tomas.values()].map((t) => t._estado).filter(Boolean);
    return ['guardando', 'error', 'sinRed', 'movil', 'guardado'].find((e) => es.includes(e)) || '';
  }

  /* Una foto nueva va al servidor cuando ya tiene pie (o pasado un rato, o al salir), no mientras se escribe. */
  const fotoLista = (x, forzar) => {
    const foco = document.activeElement;
    const escribiendo = foco && foco.dataset && foco.dataset.hPie !== undefined && foco.dataset.hPie === String(x.local);
    return forzar || (!escribiendo && (String(x.pie || '').trim() !== '' || Date.now() - (x.t || 0) > 30000));
  };

  async function autoguardar(h, { forzar = false } = {}) {
    if (!h || !h.f || !h.f.editable) return true;
    clearTimeout(h._reloj);
    h._reloj = null;
    while (h._vuelo) { try { await h._vuelo; } catch { /* lo dice el aviso */ } }
    if (!h.cambiada) return true;
    h._vuelo = enviarFicha(h, forzar);
    try { return await h._vuelo; } finally { h._vuelo = null; }
  }

  async function enviarFicha(h, forzar) {
    h._estado = 'guardando';
    pintarEstado(h);
    try {
      const listas = h.nuevas.filter((x) => fotoLista(x, forzar));
      for (const x of listas) await subirFotoNueva(x);
      /* Lo que se manda, para saber después qué ha cambiado mientras viajaba. */
      const enviado = {
        valores: Object.fromEntries(Object.entries(h.valores).map(([k, v]) => [k, comoJson(v)])),
        cabecera: Object.fromEntries(Object.entries(h.cabecera).map(([k, v]) => [k, comoJson(v)])),
        observaciones: h.observaciones, quitar: [...h.quitar], fotos: listas,
      };
      let r;
      try { r = await postFicha(cuerpoFicha(h, listas)); } catch (e) {
        /* El ordenador olvidó la foto en espera (p. ej. al cerrar la app): se vuelve a subir desde el teléfono. */
        if (!listas.length || !/ya no está/i.test(e.message) || (AG && AG.sinRed(e))) throw e;
        for (const x of listas) { x.id = null; await subirFotoNueva(x); }
        r = await postFicha(cuerpoFicha(h, listas));
      }
      h.f = r;
      for (const [k, v] of Object.entries(enviado.valores)) if (comoJson(h.valores[k]) === v) delete h.valores[k];
      for (const [k, v] of Object.entries(enviado.cabecera)) if (comoJson(h.cabecera[k]) === v) delete h.cabecera[k];
      if (h.observaciones === enviado.observaciones) h.observaciones = undefined;
      for (const i of enviado.quitar) h.quitar.delete(i);
      for (const x of enviado.fotos) {
        const i = h.nuevas.indexOf(x);
        if (i >= 0) h.nuevas.splice(i, 1);
        if (x.url) { try { URL.revokeObjectURL(x.url); } catch { /* nada */ } }
        if (AG && x.local) AG.borrarFoto(x.local);
      }
      h.cambiada = hayPendiente(h);
      h._estado = h.cambiada ? 'movil' : 'guardado';
      h._error = null;
      if (!h.cambiada && vivas.get(claveBorrador(h.ref)) === h) vivas.delete(claveBorrador(h.ref));
      escribirBorrador(h);
      trasGuardar(h, r, forzar);
      if (h.cambiada && !h._reloj) programar(h, h.nuevas.length && !Object.keys(h.valores).length ? 15000 : ESPERA_AUTOGUARDADO);
      return !h.cambiada;
    } catch (e) {
      const sinRed = AG ? AG.sinRed(e) : false;
      h._estado = sinRed ? 'sinRed' : 'error';
      pintarEstado(h);
      if (!sinRed && !h._silencio && (forzar || h._error !== e.message)) C.aviso(e.message);
      h._error = e.message;
      if (COLA) COLA.masTarde();
      return false;
    }
  }

  /* Tras guardar: se avisa en silencio y se repinta solo si no se está escribiendo. */
  function trasGuardar(h, r, forzar) {
    const k = `${h.ref.clave}|${h.ref.plantilla}`;
    if (h === hoja) {
      tomas.delete(k);
      fichasEq = null;
      if (forzar) C.aviso(r.estado === 'completa' ? 'Guardada: la ficha está completa.' : 'Guardada.', 'bien');
      if (ficha) cargarFichas(ficha.equipo.id);
      if (!activa()) return;
      if (escribiendoEnApp()) { h._repintar = true; pintarEstado(h); refrescarPasos(); return; }
      const y = window.scrollY;
      pintarHoja();
      window.scrollTo(0, y);
      return;
    }
    if (tomas.get(k) === h) {
      for (const [, p] of puntosToma(h)) h.vistos.add(p.codigo);
      h._repintar = true;
      pintarEstado(h);
      if (activa() && ficha && !hoja && !escribiendoEnApp()) repintarTomas();
    }
  }
  const escribiendoEnApp = () => {
    const a = document.activeElement;
    return Boolean(a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(String(a.tagName || '')) && (!$app.contains || $app.contains(a)));
  };
  function repintarTomas() {
    for (const t of tomas.values()) t._repintar = false;
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
    if (ficha) cargarFichas(ficha.equipo.id);
  }

  /* La cola: un borrador de ficha que quedó en el teléfono se manda aunque la ficha no esté abierta. */
  async function enviarBorradorFicha(clave, b) {
    const viva = vivas.get(clave);
    if (viva) return autoguardar(viva, { forzar: true });
    if (!b || !b.ref || !b.ref.obra || !b.ref.clave) { if (AG) AG.borrar(clave); return true; }
    const h = {
      ref: b.ref, nombre: b.nombre, f: { editable: true }, valores: b.valores || {}, cabecera: b.cabecera || {},
      observaciones: b.hayObs ? (b.observaciones || '') : undefined,
      nuevas: AG ? await AG.restaurarFotos(b.fotos || []) : [], quitar: new Set((b.quitar || []).map(Number)),
      cambiada: true, _silencio: true,
    };
    if (vivas.has(clave)) return autoguardar(vivas.get(clave), { forzar: true });
    vivas.set(clave, h);
    const ok = await autoguardar(h, { forzar: true });
    if (vivas.get(clave) === h && !h.cambiada) vivas.delete(clave);
    return ok;
  }

  /* Todo lo pendiente (la hoja abierta y la toma), ya: al salir de la hoja, de la pantalla o de la app. */
  function guardarTodoYa() {
    const hs = [hoja, ...tomas.values()].filter((h) => h && h.f && h.cambiada);
    for (const h of hs) escribirBorrador(h);
    return Promise.all(hs.map((h) => autoguardar(h, { forzar: true })));
  }

  /* Lo que se llama «Guardar» por dentro: guardar ya, y decir si ha ido bien. */
  async function guardarHoja() {
    const h = hoja;
    if (!h || !h.cambiada) return true;
    return autoguardar(h, { forzar: true });
  }

  async function terminarHoja() {
    /*
     * Terminar vuelve al equipo y NADA MÁS (29-oct-2026, JC: «al pulsar el
     * botón terminar y volver a equipo que no abra la cámara»). La foto de una
     * UI se hace solo desde el hueco con la cámara de su fila.
     */
    if (hoja.cambiada && hoja.f.editable && !(await guardarHoja())) {
      /* Sin red sí se sale: queda en el teléfono y se manda solo. */
      if (hoja._estado !== 'sinRed') return;
    }
    salirHoja();
    window.scrollTo(0, 0);
  }

  const compartirPdf = (...a) => C.compartirPdf(...a);

  /* sinMedidos: la hoja para rellenar a mano en obra (proyecto sí, medidos no). */
  async function pdfHoja(boton, sinMedidos = false) {
    if (hoja.cambiada && hoja.f.editable && !(await guardarHoja())) return;
    const tag = ficha ? ficha.equipo.tag : hoja.f.titulo;
    const q = new URLSearchParams({ tipo: 'ficha', ...hoja.ref, ...(sinMedidos ? { sinMedidos: '1' } : {}) });
    await compartirPdf(`api/informe?${q}`, `${tag} - ${hoja.nombre || hoja.f.plantilla.nombre}${sinMedidos ? ' - sin medidos' : ''}.pdf`, boton);
  }

  /* ═══════════════════════════════════ La toma de datos de la primera pantalla */

  /*
   * TOMA DE DATOS SIN ABRIR LAS FICHAS (27-oct-2026, JC): para medir había que
   * abrir cada ficha («SPLIT UD. EXTERIOR · 0 de 2 datos») y dentro ir por
   * apartados. Ahora, debajo del conjunto, salen juntos los datos que faltan de
   * las fichas del equipo: los obligatorios sin rellenar y las casillas
   * «Medido» vacías (temperaturas, presiones…), agrupados por ficha, con un
   * Guardar para todas. Es la MISMA ficha que la hoja completa (api/ficha), con
   * sus mismos campos, su misma validación y su mismo guardado: el servidor
   * calcula desviación y resultado igual que siempre. El checklist (Sí/No por
   * docenas) y el balanceo no entran: se rellenan en su hoja.
   */
  const claveToma = (x) => `${x.clave}|${x.plantilla}`;
  const CLASES_SIN_TOMA = new Set(['checklist', 'balanceo']);
  const fichasToma = () => (fichasEq && fichasEq.ok !== false ? (fichasEq.fichas || []) : [])
    .map((x, i) => [x, i])
    .filter(([x]) => x.plantilla && !x.conservada && pestanaDeFicha(x) === 'equipo' && !CLASES_SIN_TOMA.has(x.clase) && x.estado !== 'firmada'
      /* VRF (29-oct): cada unidad tiene su toma; aquí solo la de la unidad abierta. */
      && !(x.porUnidad && x.unidadId && ficha && x.unidadId !== ficha.equipo.id));

  /* Las funciones de la hoja leen `hoja`: se pinta cada ficha de la toma como si lo fuera. */
  function conHoja(h, fn) {
    const antes = hoja;
    hoja = h;
    try { return fn(); } finally { hoja = antes; }
  }

  /* Lo que sale en la toma: lo vacío según lo GUARDADO (no desaparece al teclear)
     y, tras guardar, lo que ya salía (para ver su desviación). */
  function puntosToma(t) {
    const r = [];
    for (const s of t.f.secciones || []) {
      if (s.tipo === 'fotos' || s.tipo === 'bocas') continue;
      for (const p of s.puntos || []) {
        const v = s.tipo === 'parametros' ? p.m : p.valor;
        const vacio = v === null || v === undefined || v === '';
        if (t.vistos.has(p.codigo) || (vacio && (p.obligatorio || s.tipo === 'parametros'))) r.push([s, p]);
      }
    }
    return r;
  }
  function nuevaToma(ref, nombre, r, vistos = null) {
    const t = nuevaHoja(ref, nombre, r);
    t.vistos = new Set(vistos || []);
    for (const [, p] of puntosToma(t)) t.vistos.add(p.codigo);
    return t;
  }

  /* Pide en paralelo las fichas que aún no están (las demás, de la caché). */
  async function cargarTomas(id) {
    if (!fichasEq || fichasEq.ok === false || !fichasEq.equipo) return;
    const obra = fichasEq.equipo.obraId;
    const faltan = fichasToma().filter(([x]) => !tomas.has(claveToma(x)));
    if (!faltan.length) return;
    await Promise.all(faltan.map(async ([x]) => {
      const ref = { obra, clave: x.clave, plantilla: x.plantilla };
      try {
        const r = await C.pedir(`api/ficha?${new URLSearchParams(ref)}`);
        if (!r.ok) throw new Error(r.error);
        if (tomas.has(claveToma(x))) return;
        /* La ficha aún guardándose desde la hoja, o lo que quedó en el teléfono. */
        const viva = vivas.get(claveBorrador(ref));
        if (viva && viva.cambiada && viva !== hoja) { viva.vistos = viva.vistos || new Set(); for (const [, p] of puntosToma(viva)) viva.vistos.add(p.codigo); tomas.set(claveToma(x), viva); return; }
        const t = await recuperarBorrador(nuevaToma(ref, x.nombre, r));
        for (const [, p] of puntosToma(t)) t.vistos.add(p.codigo);
        if (!tomas.has(claveToma(x))) tomas.set(claveToma(x), t);
      } catch (e) {
        /* Sin red: no se guarda en la caché, la próxima vez se vuelve a pedir. */
        tomas.set(claveToma(x), { ref, nombre: x.nombre, error: e.message, cambiada: false, temporal: true });
      }
    }));
    if (activa() && ficha && !hoja && ficha.equipo.id === id && pestanaEq === 'fichas' && !escribiendoEnApp()) {
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    }
    for (const [k, t] of tomas) if (t.temporal) tomas.delete(k);
  }

  function filaToma(s, p, ed) {
    if (s.tipo !== 'parametros') return campoPunto(s, p, ed);
    /* Un parámetro: solo la casilla Medido; el de proyecto, a la vista para comparar. */
    const ref = valorDe(p, 'p');
    const proy = ref !== null && ref !== undefined && ref !== '' ? ` <span class="tenue">proy. ${esc(coma(ref))}</span>` : '';
    return `<div class="fd n"><span class="et">${esc(p.etiqueta)}${obligatorioDe(p)}${unidadDe(p)}${proy}${desvParametro(p)}</span>${casillaParametro(p, 'm', 'Medido', ed ? '' : 'disabled')}</div>`;
  }

  function htmlTomaDatos() {
    const fs = fichasToma();
    if (!fs.length) return '';
    const grupos = fs.map(([x, i]) => [x, i, tomas.get(claveToma(x))]);
    const listas = grupos.filter(([, , t]) => t && t.f);
    const cargando = grupos.some(([, , t]) => !t);
    /* Sin permiso para rellenar ninguna: no sale (se ve todo en las fichas). */
    if (!cargando && listas.length && !listas.some(([, , t]) => t.f.editable)) return '';
    const cuerpos = grupos.map(([x, i, t]) => {
      if (!t) return '';
      const abrirla = `<button class="enlace" data-cx="hoja" data-i="${i}">Abrir la ficha completa</button>`;
      if (!t.f) return `<div class="toma-grupo"><h3 class="banda">${esc(x.nombre)}</h3><p class="nota aviso">${esc(t.error || 'No se ha podido leer la ficha')}. ${abrirla}</p></div>`;
      const ps = puntosToma(t);
      if (!ps.length) return '';
      const ed = t.f.editable;
      const m = t.f.medidos;
      return `<div class="toma-grupo" data-toma="${esc(claveToma(x))}">
        <h3 class="banda">${esc(x.nombre)}${m && m.obligatorios ? ` <span class="tenue">${m.rellenos} de ${m.obligatorios}</span>` : ''} ${abrirla}</h3>
        ${ed ? '' : `<p class="nota">${t.f.firmada ? 'Firmada: ya no se cambia.' : 'Tu rol puede ver la ficha, pero no rellenarla.'}</p>`}
        <section class="hoja-tabla rejilla-datos toma-tabla">${conHoja(t, () => ps.map(([s, p]) => filaToma(s, p, ed)).join(''))}</section>
      </div>`;
    }).filter(Boolean);
    if (!cuerpos.length) return cargando ? '<section id="toma-datos"><h2>Toma de datos</h2><p class="cargando">Cargando lo que falta por medir…</p></section>' : '';
    const sucias = listas.filter(([, , t]) => t.cambiada).length;
    const puede = listas.some(([, , t]) => t.f.editable);
    return `<section id="toma-datos" data-plegable>
      <h2>Toma de datos <span class="cuenta">lo que falta, sin abrir las fichas</span></h2>
      ${cuerpos.join('')}
      ${cargando ? '<p class="cargando">Cargando el resto…</p>' : ''}
      ${puede ? `<div class="barra-toma" data-toma-guardado="${sucias}">${marcaAG(estadoTomas() || (sucias ? 'movil' : ''))}</div>` : ''}
    </section>`;
  }

  const tomaDe = (el) => {
    const g = el && el.closest ? el.closest('[data-toma]') : null;
    const t = g ? tomas.get(g.dataset.toma) : null;
    return t && t.f && t.f.editable ? t : null;
  };
  function anotarToma(el) {
    const t = tomaDe(el);
    if (!t) return false;
    if (anotarEn(t, el)) marcarToma(t);
    return true;
  }
  /* Cada ficha de la toma se guarda sola, como la hoja (autoguardado). */
  function marcarToma(t) { cambio(t); }

  /* Guardar ya todas las fichas tocadas de la toma (por dentro; ya no hay botón). */
  async function guardarTomas() {
    const claves = new Set(fichasToma().map(([x]) => claveToma(x)));
    const sucias = [...tomas.entries()].filter(([k, t]) => claves.has(k) && t.f && t.cambiada);
    await Promise.all(sucias.map(([, t]) => autoguardar(t, { forzar: true })));
    if (activa() && ficha && !hoja && sucias.length) repintarTomas();
  }

  /* Salir de la hoja no pide confirmar: lo pendiente ya está en el teléfono y se manda solo. */
  function salirHoja() {
    const guardando = hoja && hoja.cambiada ? autoguardar(hoja, { forzar: true }) : null;
    hoja = null;
    if (hojaDirecta && origenPlano) { volverAlPlano(); return; }
    /* Al volver al equipo, sus fotos al día: las hechas en la ficha salen ya
       (desde la cola del teléfono mientras no han subido; luego, del servidor). */
    if (ficha) { const id = ficha.equipo.id; Promise.resolve(guardando).catch(() => {}).then(() => refrescarEquipo(id)); }
    if (balDirecto) { balDirecto = false; pestanaEq = 'equipo'; }
    pintarFicha();
    if (!fichasEq && ficha) cargarFichas(ficha.equipo.id);
    else if (ficha) cargarTomas(ficha.equipo.id);
    window.scrollTo(0, 0);
  }

  /* ═══════════════════════════════════ El cronómetro de cuadrilla */

  /*
   * EL CRONÓMETRO DE CUADRILLA (23-oct-2026, JC: «contar las horas de los dos
   * para saber el tiempo y el dinero que cuesta medir cada equipo»). Empezar /
   * Pausar / Terminar guardan la HORA en la hoja de balanceo del equipo (no un
   * contador): cerrar la app no lo para. La cuadrilla es quien mide + 1
   * operario, editable. Las cuentas, en shared/commissioning/cronometro.js
   * (por electron/data/cronometroBalanceo.js); aquí solo se toca y se enseña.
   */
  let cuadrillaLocal = null; /* la cuadrilla mientras se edita: { equipoId, personas } */
  let relojCrono = null;
  const ROL_CRONO = { oficial: 'Técnico', operario: 'Operario' };
  const hms = (msT) => {
    const s = Math.max(0, Math.floor(msT / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const comaCr = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
  const eurosCx = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

  function estiloCrono() {
    if (document.getElementById('estilo-crono')) return;
    const st = document.createElement('style');
    st.id = 'estilo-crono';
    st.textContent = `
      .crono { margin: 4px 0 14px; padding: 0 2px; }
      .crono h2 { display: flex; align-items: baseline; gap: 8px; }
      .crono-reloj { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 2px 0 8px; }
      .crono-tiempo { font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--acento-fuerte); letter-spacing: .5px; }
      .crono-botones { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
      .crono-botones .boton { width: fit-content; min-width: 104px; border-radius: 999px; padding: 0 18px; }
      .crono-botones .boton.empezar { background: var(--bien); color: #fff; }
      .crono-botones .boton.terminar { background: #1F5FA8; color: #fff; }
      .crono table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 4px 0 6px; }
      .crono th { text-align: left; font-weight: 600; color: var(--acento); background: none; border-bottom: 2px solid var(--acento); padding: 4px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .3px; }
      .crono td { border-bottom: 1px solid var(--rejilla); padding: 4px 6px; vertical-align: middle; }
      .crono td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .crono td input, .crono td select { width: 100%; min-height: 36px; font-size: 15px; border: 1px solid var(--borde); border-radius: 8px; padding: 2px 6px; background: var(--panel); color: var(--texto); box-sizing: border-box; }
      .crono td .quitar { border: 0; background: none; color: var(--mal); font-size: 20px; min-width: 36px; min-height: 36px; }
      .crono-acciones { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 10px; }
      .crono-acciones .boton { width: fit-content; border-radius: 999px; padding: 0 16px; min-height: 40px; font-size: 15px; }
      .crono-cifras { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
      .crono-cifras span { width: fit-content; border-radius: 999px; padding: 3px 12px; background: var(--acento-suave); color: var(--acento-fuerte); font-size: 14px; font-variant-numeric: tabular-nums; }
      .crono-cifras span.azul { background: #E8F0FA; color: #1F5FA8; }
      .crono-cifras span.verde { background: var(--bien-fondo); color: var(--bien); }
      .crono-cifras span.falta { background: var(--aviso-fondo); color: var(--aviso); }
      .crono-bocas { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--textoSuave); margin: 4px 0; }
      .crono-bocas input { width: 80px; min-height: 36px; border: 1px solid var(--borde); border-radius: 8px; padding: 2px 6px; font-size: 15px; }`;
    document.head.appendChild(st);
  }

  const datosCrono = () => (ficha && ficha.cronometro && ficha.cronometro.ok ? ficha.cronometro : null);

  function personasCrono() {
    const d = datosCrono();
    if (!d) return [];
    if (!cuadrillaLocal || cuadrillaLocal.equipoId !== ficha.equipo.id) {
      cuadrillaLocal = { equipoId: ficha.equipo.id, personas: (d.cronometro.cuadrilla && d.cronometro.cuadrilla.length ? d.cronometro.cuadrilla
        : [{ nombre: 'Yo', rol: 'oficial', empresa: null }, { nombre: 'Operario 1', rol: 'operario', empresa: null }]).map((p) => ({ ...p })), cambiada: false };
    }
    return cuadrillaLocal.personas;
  }

  function htmlCrono() {
    const d = datosCrono();
    if (!d) return '';
    estiloCrono();
    const c = d.cronometro;
    const ed = d.puede.medir && !bloqueosDe(ficha).length;
    const gente = personasCrono();
    const estado = c.enMarcha ? ['bien', 'En marcha'] : c.terminado ? ['info', 'Terminado'] : c.vacio ? ['neutra', 'Sin empezar'] : ['aviso', 'En pausa'];
    const vivo = c.enMarcha ? `data-crono-inicio="${esc(c.inicioTramo)}" data-crono-cerrados="${c.msCerrados}"` : '';
    const b = c.bocas;
    const dinero = c.veDinero && c.dinero;
    const filas = gente.map((p, i) => `<tr>
        <td>${ed ? `<input data-crono-campo="nombre" data-i="${i}" value="${esc(p.nombre)}" aria-label="Nombre">` : esc(p.nombre)}</td>
        <td>${ed ? `<select data-crono-campo="rol" data-i="${i}" aria-label="Rol">${Object.entries(ROL_CRONO).map(([k, n]) => `<option value="${k}" ${p.rol === k ? 'selected' : ''}>${n}</option>`).join('')}</select>` : esc(ROL_CRONO[p.rol] || p.rol)}</td>
        <td>${ed ? `<input data-crono-campo="empresa" data-i="${i}" value="${esc(p.empresa || '')}" list="crono-empresas" placeholder="Empresa" aria-label="Empresa">` : esc(p.empresa || '—')}</td>
        ${ed ? `<td><button class="quitar" data-cx="crono-quitar" data-i="${i}" aria-label="Quitar a ${esc(p.nombre)}" ${gente.length < 2 ? 'disabled' : ''}>×</button></td>` : ''}
      </tr>`).join('');
    const porPersona = c.personas.length ? `<table><thead><tr><th>Persona</th><th>Rol</th><th class="num">Horas</th>${dinero ? '<th class="num">Coste</th>' : ''}</tr></thead><tbody>
      ${c.personas.map((p) => `<tr><td>${esc(p.nombre)}</td><td>${esc(ROL_CRONO[p.rol] || p.rol)}</td><td class="num">${comaCr(p.horas, 2)} h</td>
        ${dinero ? `<td class="num">${p.coste === null ? '<span class="chip aviso">falta la tarifa</span>' : eurosCx(p.coste)}</td>` : ''}</tr>`).join('')}</tbody></table>` : '';
    return `<section class="crono" data-crono>
      <h2>Cronómetro de cuadrilla <span class="chip ${estado[0]}">${estado[1]}</span></h2>
      <div class="crono-reloj"><span class="crono-tiempo" ${vivo} data-crono-tiempo>${hms(c.duracionMs)}</span>
        <span class="cuenta">${c.tramos ? `${c.tramos} tramo${c.tramos === 1 ? '' : 's'}` : 'mide el tiempo de la cuadrilla en este equipo'}</span></div>
      ${ed ? `<div class="crono-botones">
        ${c.enMarcha ? '<button class="boton secundario" data-cx="crono" data-accion="pausar">Pausar</button>'
          : `<button class="boton empezar" data-cx="crono" data-accion="empezar">${c.vacio ? 'Empezar' : 'Seguir'}</button>`}
        ${!c.vacio && !c.terminado ? '<button class="boton terminar" data-cx="crono" data-accion="terminar">Terminar</button>' : ''}
      </div>` : ''}
      <table><thead><tr><th>Cuadrilla</th><th>Rol</th><th>Empresa</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>${filas}</tbody></table>
      <datalist id="crono-empresas">${(d.empresas || []).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      ${ed ? `<div class="crono-acciones"><button class="boton secundario" data-cx="crono-anadir">+ Persona</button>
        ${cuadrillaLocal && cuadrillaLocal.cambiada ? marcaAG(cuadrillaLocal.estado || 'guardando') : ''}</div>` : ''}
      ${c.vacio ? '' : `<div class="crono-cifras">
        <span>${comaCr(c.duracionH, 2)} h de reloj</span>
        <span>${comaCr(c.horasPersona, 2)} horas-persona</span>
        <span class="azul">${b.total} boca${b.total === 1 ? '' : 's'}${b.aMano !== null ? ' (a mano)' : ` · ${b.difusores} dif. · ${b.rejas} rejas`}</span>
        ${c.minPorBoca !== null ? `<span class="verde">${comaCr(c.minPorBoca)} min/boca</span>` : ''}
        ${c.bocasHora !== null ? `<span class="verde">${comaCr(c.bocasHora)} bocas/h</span>` : ''}
        ${dinero ? (dinero.coste !== null ? `<span>${eurosCx(dinero.coste)}${dinero.costePorBoca !== null ? ` · ${eurosCx(dinero.costePorBoca)}/boca` : ''}</span>`
          : `<span class="falta">Falta la tarifa: ${esc(dinero.sinTarifa.join(', '))}</span>`) : ''}
      </div>
      ${porPersona}
      ${ed ? `<label class="crono-bocas">Bocas medidas a mano <input inputmode="numeric" data-crono-bocas value="${b.aMano === null ? '' : b.aMano}" placeholder="${b.contadas}"> <span>vacío = las medidas en la app</span></label>` : ''}
      ${c.parteId ? `<p class="nota">Pasado al parte de trabajo <strong>${esc(c.parteCodigo || '')}</strong>.</p>`
        : !c.enMarcha && d.puede.parte ? '<div class="crono-acciones"><button class="boton secundario" data-cx="crono-parte">Pasar a parte de trabajo</button></div>' : ''}
      ${!c.enMarcha ? '<div class="crono-acciones"><button class="boton secundario" data-cx="crono-pdf" title="Interno: no es para el cliente">Informe interno (PDF)</button></div>' : ''}`}
    </section>`;
  }

  function repintarCrono() {
    const s = $app.querySelector('[data-crono]');
    if (!s) return;
    const t = document.createElement('div');
    t.innerHTML = htmlCrono();
    if (t.firstElementChild) s.replaceWith(t.firstElementChild);
    latirCrono();
  }

  /* El reloj cuenta solo en la pantalla con la hora guardada; no guarda nada. */
  function latirCrono() {
    clearInterval(relojCrono);
    const el = $app.querySelector('[data-crono-inicio]');
    if (!el) return;
    const inicio = Date.parse(el.dataset.cronoInicio);
    const cerrados = Number(el.dataset.cronoCerrados) || 0;
    const tic = () => {
      const x = $app.querySelector('[data-crono-inicio]');
      if (!x || !activa()) { clearInterval(relojCrono); return; }
      x.textContent = hms(cerrados + Date.now() - inicio);
    };
    tic();
    relojCrono = setInterval(tic, 1000);
  }

  function leerCuadrilla() {
    personasCrono();
    $app.querySelectorAll('[data-crono-campo]').forEach((el) => {
      const p = cuadrillaLocal.personas[Number(el.dataset.i)];
      if (p) p[el.dataset.cronoCampo] = el.value;
    });
    return cuadrillaLocal.personas;
  }

  /* La cuadrilla se guarda sola (JC, 28-oct): ~1 s después de tocarla, sin botón. */
  let relojCuadrilla = null;
  function cuadrillaPronto() {
    clearTimeout(relojCuadrilla);
    relojCuadrilla = setTimeout(() => { relojCuadrilla = null; if (ficha && cuadrillaLocal && cuadrillaLocal.cambiada) accionCrono(null, 'cuadrilla', {}, true); }, 1000);
  }
  async function accionCrono(boton, accion, extra = {}, silencio = false) {
    if (!ficha) return;
    if (boton) boton.disabled = true;
    try {
      const cuerpo = { equipoId: ficha.equipo.id, accion, ...extra };
      if (accion === 'empezar' || accion === 'cuadrilla' || (accion === 'pausar' && cuadrillaLocal && cuadrillaLocal.cambiada)) cuerpo.cuadrilla = leerCuadrilla();
      if (accion === 'terminar' && !window.confirm('¿Terminar el cronómetro de este equipo? Se congelan las bocas medidas en este tiempo.')) { if (boton) boton.disabled = false; return; }
      const r = await C.postJson('api/cronometro', cuerpo);
      if (!r.ok) throw new Error(r.error);
      ficha.cronometro.cronometro = r.cronometro;
      if (cuerpo.cuadrilla) { cuadrillaLocal = null; }
      repintarCrono();
      const txt = { empezar: 'Cronómetro en marcha', pausar: 'En pausa', terminar: `Terminado: ${hms(r.cronometro.duracionMs)}`, cuadrilla: 'Cuadrilla guardada', bocas: 'Bocas apuntadas' }[accion];
      if (txt && !silencio) C.aviso(txt, 'bien');
    } catch (e) {
      if (boton) boton.disabled = false;
      if (silencio && cuadrillaLocal) {
        cuadrillaLocal.estado = AG && AG.sinRed(e) ? 'sinRed' : 'error';
        if (cuadrillaLocal.estado === 'error') C.aviso(e.message);
        if (!escribiendoEnApp()) repintarCrono();
        setTimeout(cuadrillaPronto, 30000);
      } else C.aviso(e.message);
    }
  }

  async function parteCrono(boton) {
    if (!ficha) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/cronometro/parte', { equipoId: ficha.equipo.id });
      if (!r.ok) throw new Error(r.error);
      const d = await C.pedir(`api/cronometro?equipo=${encodeURIComponent(ficha.equipo.id)}`);
      if (d.ok) ficha.cronometro = d;
      repintarCrono();
      C.aviso(r.yaEstaba ? `Ya estaba en el parte ${r.codigo}` : `Parte ${r.codigo} abierto con las horas`, 'bien');
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  $app.addEventListener('change', (ev) => {
    if (!activa() || hoja || !ficha) return;
    if (ev.target.hasAttribute('data-cx-fechas')) { guardarFechasEquipo(ev.target.dataset.cxFechas, ev.target.value.trim()); return; }
    if (ev.target.hasAttribute('data-crono-campo')) {
      leerCuadrilla();
      cuadrillaLocal.estado = 'guardando';
      if (!cuadrillaLocal.cambiada) { cuadrillaLocal.cambiada = true; repintarCrono(); }
      cuadrillaPronto();
    } else if (ev.target.hasAttribute('data-crono-bocas')) accionCrono(null, 'bocas', { bocasAMano: ev.target.value.trim() });
  });

  /* ═══════════════════════════════════ Eventos */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const sg = ev.target.closest('[data-cx-seg]');
    /* Las cifras de arriba filtran; pulsar la que ya está elegida vuelve a todos. */
    if (sg) { segmento = sg.dataset.cxSeg === segmento ? 'todos' : sg.dataset.cxSeg; AGRUPAR.forEach(([id]) => C.reiniciarLista(`cx-equipos-${id}`)); pintarLista(); return; }
    const ag = ev.target.closest('[data-cx-agrupar]');
    if (ag) {
      agrupar = ag.dataset.cxAgrupar;
      try { sessionStorage.setItem('cx.agrupar', agrupar); } catch { /* sin almacén */ }
      pintarLista(); return;
    }
    const b = ev.target.closest('[data-cx]');
    if (!b) return;
    const que = b.dataset.cx;
    if (que === 'lista') cargarLista();
    /* El plano de equipos por plantas con sus colores (planoEquipos.js, 28-oct). */
    else if (que === 'plano-equipos' && window.CX_PLANO_EQUIPOS) { ficha = null; window.CX_PLANO_EQUIPOS.abrir($app); }
    /* 16-oct (JC): la franja del TAG vuelve SIEMPRE a la pantalla anterior:
       si se llegó desde otra unidad del conjunto (UI → UE-DAS), a esa unidad. */
    else if (que === 'atras') { const prev = pilaEquipos.pop(); if (prev) abrir(prev, { atras: true }); else if (origenPlano) volverAlPlano(); else { const y = yLista; cargarLista().then(() => window.scrollTo(0, y)); } }
    else if (que === 'equipo') { if (!ficha) yLista = window.scrollY; if (ficha && ficha.equipo.id !== b.dataset.id) pilaEquipos.push(ficha.equipo.id); abrir(b.dataset.id); }
    else if (que === 'ver-balanceo' && ficha) {
      /* Una sola hoja de balanceo y sin plano de bocas: se abre la hoja directamente (JC, 29-oct: «¿por qué otra vez?»). */
      const i = hojaUnicaBalanceo();
      if (i >= 0) { balDirecto = true; abrirHoja(i); return; }
      pestanaEq = 'balanceo'; pintarFicha(); window.scrollTo(0, 0);
    }
    /* Ya no hay botón: la subpantalla (toma de datos y guardadas antes) queda para quien la invoque. */
    else if (que === 'ver-fichas' && ficha) { document.body.classList.remove('sin-scroll'); pestanaEq = 'fichas'; pintarFicha(); window.scrollTo(0, 0); if (fichasEq) cargarTomas(ficha.equipo.id); }
    else if (que === 'ficha-equipo' && ficha && directoPlano && origenPlano) volverAlPlano();
    else if (que === 'ficha-equipo' && ficha) { document.body.classList.remove('sin-scroll'); pestanaEq = 'equipo'; pintarFicha(); window.scrollTo(0, 0); }
    else if (que === 'hoja') abrirHoja(Number(b.dataset.i));
    else if (que === 'volver-equipo') salirHoja();
    /* Fin del checklist (JC, 28-oct): guarda lo pendiente y vuelve al equipo;
       si no se ha podido guardar, se queda en la hoja con el aviso del error. */
    else if (que === 'terminar-hoja' && hoja) terminarHoja(b);
    else if (que === 'paso-hoja' && hoja) irAPaso(Number(b.dataset.ir !== undefined ? b.dataset.ir : b.dataset.paso));
    else if (que === 'foto') fotoHoja(b.dataset.camara === '1');
    else if (que === 'quitar-foto' && hoja) { hoja.quitar.add(Number(b.dataset.i)); cambio(hoja); pintarHoja(); }
    else if (que === 'quitar-nueva' && hoja) {
      const x = fotoNuevaDe(hoja, b.dataset.i);
      const i = hoja.nuevas.indexOf(x);
      if (i >= 0) hoja.nuevas.splice(i, 1);
      if (x && x.url) { try { URL.revokeObjectURL(x.url); } catch { /* nada */ } }
      if (x && x.local && AG) AG.borrarFoto(x.local);
      cambio(hoja);
      pintarHoja();
    }
    else if (que === 'guardar-hoja') guardarHoja();
    else if (que === 'guardar-toma' && ficha && !hoja) guardarTomas();
    else if (que === 'pdf-hoja') pdfHoja(b);
    else if (que === 'pdf-hoja-obra') pdfHoja(b, true);
    else if (que === 'equipo-medida' && ficha) cambiarEquipo(b, false);
    else if (que === 'equipo-medida-todo' && ficha) cambiarEquipo(b, true);
    else if (que === 'lectura' && ficha) cambiarEquipo(b, false);
    else if (que === 'lectura-todo' && ficha) cambiarEquipo(b, true);
    else if (que === 'ir-boca' && ficha) {
      /* Una boca del otro circuito: se cambia de circuito y se abre. */
      if (b.dataset.circuito && b.dataset.circuito !== circuitoBal) { cerrarHojaBoca(); circuitoBal = b.dataset.circuito; pintarFicha(); }
      irABoca(b.dataset.boca);
    }
    else if (que === 'plano-grande' && ficha) planoGrande(b);
    else if (que === 'circuito-bal' && ficha) {
      if (circuitoBal === b.dataset.circuito) return;
      cerrarHojaBoca();
      circuitoBal = b.dataset.circuito;
      pintarFicha();
      window.scrollTo(0, 0);
    }
    else if (que === 'zoom-mas' && ficha) zoomBoton(b, 1.6);
    else if (que === 'zoom-menos' && ficha) zoomBoton(b, 1 / 1.6);
    else if (que === 'cerrar-boca' && ficha) cerrarHojaBoca();
    else if (que === 'boca-siguiente' && ficha) bocaVecina(1);
    else if (que === 'boca-anterior' && ficha) bocaVecina(-1);
    else if (que === 'avisar-modelo') avisarModelo();
    else if (que === 'crear-incidencia') crearIncidencia();
    else if (que === 'validar-tras-inc' && ficha) validarTrasIncidencia(b);
    else if (que === 'ir-incidencia') irIncidencia(b.dataset.id);
    else if (que === 'verificar-instalacion' && ficha) verificarInstalacion(b);
    else if (que === 'foto-equipo') fotoEquipo(b);
    else if (que === 'foto-ui-grande' && ficha) fotoUiGrande(b.dataset.equipo);
    else if (que === 'firmar' && ficha) abrirFirma(b.dataset.rol);
    else if (que === 'cancelar-firma' && ficha) cerrarFirma({ olvidar: true });
    else if (que === 'limpiar-firma' && ficha) { const cv = $app.querySelector('[data-firma-lienzo]'); if (cv) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); FD.soltar(cv); trazado = false; firmaSinPintar = null; apuntarFirma(); } }
    else if (que === 'guardar-firma' && ficha) guardarFirma(b);
    else if (que === 'quitar-firma' && ficha) guardarFirma(b, true);
    else if (que === 'quitar-foto-equipo') quitarFotoEquipo(b);
    else if (que === 'ver-hoja') verHoja(b);
    else if (que === 'nube-ahora' && window.cxObra && window.cxObra.sync) { b.disabled = true; window.cxObra.sync.ahora().finally(() => { if (ficha) abrir(ficha.equipo.id, { quieto: true }); }); }
    else if (que === 'crono' && ficha) accionCrono(b, b.dataset.accion);
    else if (que === 'crono-anadir' && ficha) { const g = leerCuadrilla(); g.push({ nombre: `Operario ${g.filter((p) => p.rol === 'operario').length + 1}`, rol: 'operario', empresa: (g[g.length - 1] || {}).empresa || null }); cuadrillaLocal.cambiada = true; cuadrillaLocal.estado = 'guardando'; repintarCrono(); cuadrillaPronto(); }
    else if (que === 'crono-quitar' && ficha) { const g = leerCuadrilla(); if (g.length > 1) { g.splice(Number(b.dataset.i), 1); cuadrillaLocal.cambiada = true; cuadrillaLocal.estado = 'guardando'; repintarCrono(); cuadrillaPronto(); } }
    else if (que === 'crono-parte' && ficha) parteCrono(b);
    else if (que === 'crono-pdf' && ficha) compartirPdf(`api/informe?tipo=cronometro&equipo=${encodeURIComponent(ficha.equipo.id)}`, `${ficha.equipo.tag} - tiempo de medida (interno).pdf`, b);
    else if (que === 'serie' && ficha) abrirSerie(b);
    else if (que === 'serie-guardar' && ficha) guardarSerie(b.closest('.serie-edita'));
    else if (que === 'serie-cancelar' && ficha) repintarConScroll();
    else if (que === 'placa-confirmar' && ficha) responderPlaca(b, 'confirmar');
    else if (que === 'placa-descartar' && ficha) responderPlaca(b, 'descartar');
    else if (que === 'placa-leer' && ficha) leerPlaca(b.dataset.equipo, b.dataset.foto, null, b);
    else if (que === 'pdf-uis' && ficha) compartirPdf(`api/informe?tipo=vrf&equipo=${encodeURIComponent(ficha.equipo.id)}`, `${ficha.equipo.tag} - tomas de datos UE y UIs.pdf`, b);
    else if (que === 'pdf-balanceo' && ficha) compartirPdf(`api/informe?tipo=balanceo&equipo=${encodeURIComponent(ficha.equipo.id)}`, `${ficha.equipo.tag} - balanceo.pdf`, b);
  });
  /* Sí / No / N/A: un toque marca, otro toque en la misma desmarca. */
  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-h-resp]');
    if (!b || b.disabled) return;
    if (hoja) {
      const nuevo = tocarResp(hoja, b);
      marcarCambiada();
      if (nuevo) pasarSiCompleto();
      return;
    }
    const t = tomaDe(b);
    if (t) { tocarResp(t, b); marcarToma(t); }
  });
  /* Un toque en Sí / No / N/A de la ficha `h`: marca, o desmarca si ya lo estaba. */
  function tocarResp(h, b) {
    const p = b.dataset.hPunto;
    const sec = h.f.secciones.find((s) => (s.puntos || []).some((x) => x.codigo === p));
    const punto = sec ? sec.puntos.find((x) => x.codigo === p) : null;
    const guardado = (punto || {}).valor;
    const actual = h.valores[p] && 'v' in h.valores[p] ? h.valores[p].v : guardado;
    const nuevo = actual === b.dataset.hResp ? null : b.dataset.hResp;
    h.valores[p] = { v: nuevo };
    for (const x of b.parentElement.children) x.className = '';
    if (nuevo) b.className = b.parentElement.classList.contains('segmento') ? 'activa' : claseResp(nuevo, punto, sec && sec.tipo);
    return nuevo;
  }
  /*
   * AVANZAR SOLO AL COMPLETAR EL APARTADO (revisión UX 18-oct, 2): en una hoja
   * por apartados, cuando el toque que acaba de darse deja el apartado con
   * todos sus obligatorios, se pasa al siguiente tras un momento, con un aviso
   * que dice adónde. Solo con los toques Sí/No/N/A (no al escribir un número,
   * que se sigue escribiendo) y nunca desde el último apartado ni hacia atrás.
   */
  let avanceHoja = null;
  function pasarSiCompleto() {
    if (!hoja || !hoja.pasos) return;
    const i = hoja.paso || 0;
    const paso = hoja.pasos[i];
    if (!paso) return;
    const [hechos, de] = cuentaPaso(paso);
    if (!de || hechos < de) return;
    const siguiente = hoja.pasos[i + 1] || { titulo: 'Cierre' };
    clearTimeout(avanceHoja);
    const h = hoja;
    avanceHoja = setTimeout(() => {
      if (hoja !== h || h.paso !== i) return;
      irAPaso(i + 1);
      C.aviso(`${paso.titulo} completo · ${siguiente.titulo}`, 'bien');
    }, 450);
  }
  $app.addEventListener('change', (ev) => {
    if (activa() && hoja) anotar(ev.target);
    else if (activa()) anotarToma(ev.target);
  });
  $app.addEventListener('input', (ev) => {
    if (activa() && hoja) { anotar(ev.target); return; }
    if (activa() && firmando && ev.target.hasAttribute && ev.target.hasAttribute('data-firma-nombre')) { apuntarFirma(); return; }
    if (activa() && anotarToma(ev.target)) return;
    if (activa() && ev.target.dataset && ev.target.dataset.punto) { const li = ev.target.closest('li[data-boca]'); if (li) { vivoBoca(li); apuntarBoca(li); guardarBocaPronto(li); } return; }
    if (!activa() || !ev.target.hasAttribute('data-cx-buscar')) return;
    filtro = ev.target.value;
    const pos = ev.target.selectionStart;
    pintarLista();
    const i = $app.querySelector('[data-cx-buscar]');
    i.focus(); i.setSelectionRange(pos, pos);
  });
  /* Intro: de M1 a M2… y desde la última casilla, a la siguiente boca (guardando). */
  let saltando = false;
  $app.addEventListener('keydown', (ev) => {
    if (!activa() || !ev.target.dataset || !ev.target.dataset.punto || ev.key !== 'Enter') return;
    ev.preventDefault();
    const li = ev.target.closest('li[data-boca]');
    /* «Q del aparato» y la Tª son opcionales: Intro desde M4 salta a la boca siguiente. */
    const ins = casillas(li).filter((x) => x === ev.target || !x.closest('.q-aparato, .t-boca'));
    const i = ins.indexOf(ev.target);
    if (i < ins.length - 1) { ins[i + 1].focus(); return; }
    saltando = true;
    if (cambiada(li) || li.dataset.guardada) medir(li, 'siguiente');
    else if (bocaAbierta) {
      bocaVecina(1);
    } else {
      const bocas = [...$app.querySelectorAll('li[data-boca]')];
      const sig = bocas[bocas.indexOf(li) + 1];
      if (sig && casillas(sig)[0]) casillas(sig)[0].focus(); else ev.target.blur();
    }
    saltando = false;
  });
  /* Se guarda al salir de la BOCA, no de cada casilla: saltar de M1 a M2 no guarda. */
  $app.addEventListener('focusout', (ev) => {
    if (!activa() || saltando || !ev.target.dataset || !ev.target.dataset.punto) return;
    const li = ev.target.closest('li[data-boca]');
    if (!li || (ev.relatedTarget && li.contains(ev.relatedTarget))) return;
    clearTimeout(temporizadores.get(li));
    /* Ya guardada en silencio: se repinta con lo guardado (totales, chips) como siempre. */
    if (!cambiada(li) && !li.dataset.guardada) return;
    const r = ev.relatedTarget && ev.relatedTarget.dataset && ev.relatedTarget.dataset.punto ? ev.relatedTarget.dataset : null;
    medir(li, r ? { plano: r.plano, punto: r.punto, m: r.m } : null);
  });

  window.addEventListener('movil:obra', () => { if (activa()) cargarLista(); });
  window.addEventListener('hashchange', (ev) => {
    /* Se va a otra pantalla (atrás, otra pestaña): lo pendiente se manda ya. */
    if (!activa()) { guardarTodoYa(); return; }
    /* Ha llegado algo de la oficina con un equipo abierto: se repinta ese equipo, no la lista. */
    if (ev.cxDatos && ficha) {
      /* Con una boca a medio escribir no se repinta: se perdería lo tecleado (se guarda y repinta sola). */
      const foco = document.activeElement && document.activeElement.closest ? document.activeElement.closest('li[data-boca]') : null;
      if (foco && (cambiada(foco) || foco.dataset.guardada)) return;
      /* Tampoco con el dedo en la toma de datos: se perdería el foco a medio escribir. */
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-toma]')) return;
      /* Ni a media firma: se borraría el trazo. */
      if (firmando) return;
      if (!hoja && !abriendoHoja) abrir(ficha.equipo.id, { quieto: true });
      return;
    }
    cargarLista();
  });
  /* Al irse de la app (gesto de inicio, bloquear, cerrar): lo pendiente, una última vez. */
  if (AG) AG.alSalir(() => { guardarTodoYa(); });
  /* Lo que quedó en el teléfono sin mandar (sin red, app cerrada): la cola lo manda al volver. */
  if (COLA) {
    COLA.registrar('ficha.', enviarBorradorFicha);
    COLA.registrar('fotoEquipo.', enviarFotoEquipoPendiente);
    COLA.registrar('boca.', enviarBocaPendiente);
    COLA.registrar('serie.', enviarSeriePendiente);
  }
  if (activa()) cargarLista();
})();
