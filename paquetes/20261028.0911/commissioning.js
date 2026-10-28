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
  let yLista = 0;       /* dónde estaba la lista al abrir un equipo */
  let fichasEq = null; /* las fichas que necesita el equipo abierto */
  let hoja = null;     /* la ficha que se está rellenando */
  let abriendoHoja = 0; /* hojas pidiéndose al servidor (abrirHoja a medias) */
  /* La toma de datos de la primera pantalla: clave|plantilla → la misma forma que `hoja`. */
  const tomas = new Map();
  let filtro = '';

  const ENVIO = {
    completo: ['bien', 'Completo'], enviada: ['bien', 'Enviada'], lista: ['bien', 'Lista para enviar'],
    faltaDocumentacion: ['aviso', 'Falta documentación'], faltaEnsayo: ['aviso', 'Falta balanceo o estanqueidad'],
    /* Papeles completos y fichas por hacer: no es «completo» (15-oct-2026, JC). */
    faltaFichas: ['info', 'Doc. completa'],
    /* Aún fuera de commissioning: nadie ha verificado su instalación (22-oct). */
    sinVerificar: ['neutra', 'Sin verificar'],
  };
  /* «Falta ensayo» dicho por su nombre (16-oct): ensayoFalta = ['balanceo', 'estanqueidad']. */
  const nombreEnsayoFalta = (f) => (!f || !f.length ? null : f.length === 2 ? 'Falta balanceo y estanqueidad'
    : f[0] === 'estanqueidad' ? 'Falta estanqueidad' : 'Falta balanceo');
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
    ficha = null; hoja = null; pilaEquipos = [];
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
    ['faltaEstanqueidad', 'Falta estanqueidad', (e) => !e.completo && e.envio === 'faltaEnsayo' && (e.ensayoFalta || []).includes('estanqueidad')],
    /* Una sola regla: la de shared/commissioning/control.js (papeles + fichas + ensayo). */
    ['completos', 'Completos', (e) => e.completo],
    ['soloDoc', 'Doc. completa', (e) => e.docCompleta && !e.completo],
    /* 22-oct (JC): «puestos en marcha» y «falta ficha», las mismas cuentas que el
       inicio del escritorio (shared/commissioning/control.js · totalesDe). */
    ['enMarcha', 'Puestos en marcha', (e) => e.estadoPM === 'enMarcha' || e.estadoPM === 'hecha'],
    ['faltaFichas', 'Falta ficha', (e) => e.envio === 'faltaFichas'],
    ['faltaEnsayo', 'Falta ensayo', (e) => e.envio === 'faltaEnsayo'],
    ['enviadas', 'Mandados a la DF', (e) => e.envio === 'enviada'],
    ['sinVerificar', 'Instalación sin verificar', (e) => e.envio === 'sinVerificar'],
  ];
  let segmento = 'todos';
  const porPlanta = (a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true });

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
    ['tipo', 'Tipo', tipoDe],
    ['marca', 'Marca', (e) => e.marca || 'Sin marca'],
  ];
  let agrupar = 'planta';
  try { agrupar = sessionStorage.getItem('cx.agrupar') || 'planta'; } catch { /* sin almacén */ }

  /* Un split (UE + UI) o un VRF (UE + sus UI) es UNA línea: su commissioning
     es conjunto (15-oct-2026, JC). Sin conjuntos (un servidor viejo), por unidades. */
  const porConjuntos = () => Array.isArray(lista.conjuntos);
  const NOMBRE_CLASE = { par: 'Split', sistema: 'VRF' };
  const textoDe = (e) => `${(e.unidades || []).map((u) => u.tag).join(' ') || e.tag} ${e.planta || ''} ${e.marca || ''} ${e.modelo || ''} ${tipoDe(e)}`;
  function tagsFila(e) {
    const us = e.unidades || [];
    if (e.clase === 'par') {
      return `<div class="tags-par">${us.map((u) => `<strong class="cifra"><em>${esc(u.papel)}</em>${esc(u.tag)}</strong>`).join('')}</div>`;
    }
    if (e.clase === 'sistema') {
      const n = us.length - 1;
      return `<div class="tags-par"><strong class="cifra"><em>UE</em>${esc(us[0] ? us[0].tag : e.tag)}</strong><span class="sub">+ ${n} interior${n === 1 ? '' : 'es'}</span></div>`;
    }
    return `<strong class="cifra">${esc(e.tag)}</strong>`;
  }

  /* EL NÚMERO DE CADA GRUPO DESCUENTA LO HECHO (28-oct-2026, JC: «cuando haya un
     equipo ya hecho el commissioning debe ir descontando el número que hay por
     planta»). «Hecho» es `e.completo`, la misma regla de siempre (papeles +
     fichas + ensayo, shared/commissioning/control.js) que pinta el chip
     «Completo» y el segmento «Completos»: no hay otra. La cabecera dice los
     pendientes y, discreto, de cuántos; agrupando por tipo o marca, además los
     pendientes por planta. Los hechos siguen en el grupo, al final. */
  const hecho = (e) => !!e.completo;
  function cuentaGrupo(fs, conPlantas) {
    const pend = fs.filter((e) => !hecho(e));
    const plantas = new Map();
    if (conPlantas) for (const e of pend) { const p = e.planta || 'Sin planta'; plantas.set(p, (plantas.get(p) || 0) + 1); }
    return { pendientes: pend.length, total: fs.length, plantas: [...plantas].sort(([a], [b]) => porPlanta(a, b)) };
  }
  function cabeceraGrupo(fs, g) {
    const c = cuentaGrupo(fs, agrupar !== 'planta');
    const desglose = c.plantas.length ? `<small class="desglose-plantas">${c.plantas.map(([p, n]) => `${esc(p)} <b>${cifra(n)}</b>`).join(' · ')}</small>` : '';
    const de = c.pendientes === c.total ? '' : `<small> de ${cifra(c.total)}</small>`;
    return `<span class="titulo-grupo">${esc(g)}${desglose}</span><b class="contador${c.pendientes ? '' : ' hecho'}" aria-label="${c.pendientes} pendientes de ${c.total}">${cifra(c.pendientes)}${de}</b>`;
  }

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
    const equipos = todos.filter(pasa).filter((e) => !q || textoDe(e).toLowerCase().includes(q))
      .sort((a, b) => hecho(a) - hecho(b));
    const [, , grupoDe] = AGRUPAR.find(([id]) => id === agrupar) || AGRUPAR[0];
    const sin = (g) => g.startsWith('Sin ');
    const grupos = [...new Set(equipos.map(grupoDe))].sort(agrupar === 'planta' ? porPlanta
      : (a, b) => sin(a) - sin(b) || a.localeCompare(b, 'es', { numeric: true }));
    $app.innerHTML = `
      <div class="resumen-fila ocho" role="tablist">${[['todos', conj ? t.conjuntos : t.equipos, conj && t.unidades !== t.conjuntos ? 'conjuntos' : 'equipos'], ['enMarcha', t.enMarcha, 'en marcha'], ['completos', t.completos, 'completos'], ['soloDoc', t.soloDoc || 0, 'doc. completa'], ['faltaDoc', t.faltaDocumentacion, 'falta doc.'], ['faltaFichas', t.faltaFichas || 0, 'falta ficha'], ['faltaBalanceo', t.faltaBalanceo || 0, 'falta balanceo'], ['faltaEstanqueidad', t.faltaEstanqueidadEnvio || 0, 'falta estanq.']]
        .filter(([id, n]) => id !== 'enMarcha' || n !== undefined)
        .map(([id, n, texto]) => `<button role="tab" data-cx-seg="${id}" aria-selected="${segmento === id}" class="${segmento === id ? 'activa' : ''} ${id.startsWith('falta') && n ? 'aviso' : ''}"><b>${cifra(n)}</b><span>${esc(texto)}</span></button>`).join('')}</div>
      ${t.sinVerificar ? `<p class="nota tenue cuenta-instaladas">${cifra(t.instaladas)} de ${cifra(conj ? t.conjuntos : t.equipos)} con la instalación verificada; los otros ${cifra(t.sinVerificar)}, solo documentación. <button class="enlace" data-cx-seg="sinVerificar">${segmento === 'sinVerificar' ? 'Ver todos' : 'Ver cuáles'}</button></p>` : ''}
      ${conj && t.unidades !== t.conjuntos ? `<p class="nota tenue cuenta-conjuntos">${cifra(t.conjuntos)} conjuntos con ${cifra(t.unidades)} unidades: ${cifra(t.pares)} splits y ${cifra(t.sistemas)} VRF van en una línea con su exterior.</p>` : ''}
      <input type="search" class="buscar" placeholder="Buscar TAG, planta, tipo o marca" value="${esc(filtro)}" data-cx-buscar>
      <div class="agrupar" role="group" aria-label="Agrupar por"><span>Agrupar por</span>${AGRUPAR
        .map(([id, texto]) => `<button data-cx-agrupar="${id}" aria-pressed="${agrupar === id}" class="${agrupar === id ? 'activa' : ''}">${texto}</button>`).join('')}</div>
      ${equipos.length ? C.listaAgrupada(`cx-equipos-${agrupar}`, equipos, {
        grupo: grupoDe, orden: grupos, buscando: !!q, repintar: pintarLista, cabecera: cabeceraGrupo,
        fila: (e) => `
        <li${hecho(e) ? ' class="hecho"' : ''}><button class="fila-ios" data-cx="equipo" data-id="${esc(e.id)}">
          <div class="fila-principal">
            ${tagsFila(e)}
            ${chipEnvio(e.envio, e.completo, e.ensayoFalta)}
          </div>
          <div class="sub">${esc([NOMBRE_CLASE[e.clase], e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Sin datos')}</div>
          ${e.bocas ? `<div class="progreso" aria-label="${e.medidas} de ${e.bocas} bocas medidas"><i style="width:${Math.round((e.medidas / e.bocas) * 100)}%"></i></div>
          <div class="sub">${cifra(e.medidas)} de ${cifra(e.bocas)} bocas medidas</div>` : '<div class="sub">Sin plano de bocas</div>'}
          ${e.falta && e.falta.length && !e.completo ? `<div class="sub aviso">Falta: ${esc(e.falta.join(', '))}</div>` : ''}
        </button></li>` }) : `<p class="vacio">${q || segmento !== 'todos' ? 'Ningún equipo con ese filtro.' : 'Esta obra no tiene equipos dados de alta.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. La ficha */

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
      if (!ficha || ficha.equipo.id !== r.equipo.id) { pestanaEq = 'equipo'; circuitoBal = 'impulsion'; }
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

  async function cargarFichas(id) {
    try {
      const r = await C.pedir(`api/fichas?equipo=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      fichasEq = r;
    } catch (e) { fichasEq = { ok: false, error: e.message, fichas: [] }; }
    if (activa() && ficha && !hoja && ficha.equipo.id === id) {
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
    conReservas: 'Con reservas', apto: 'Apto', aptoSinBocas: 'Apto (sin bocas)', noApto: 'No apto', noAplica: 'No aplica',
  };
  const nombreEstado = (v) => NOMBRE_ESTADO[v] || v;

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
        ${fila('Puesta en marcha', `<strong>${esc(k.estadoPM ? nombreEstado(k.estadoPM) : '—')}</strong>`)}
      </section>
      ${htmlIncidenciasEquipo(k.incidencias || [])}`;
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
        <ul class="bocas">${p.bocas.map((b) => htmlBoca(p, b, puede, f.tolerancias)).join('')}</ul>`).join('') : sinPlano()}
      ${puede || !f.planos.length ? '' : '<p class="nota">Tu rol puede ver las medidas, pero no tomarlas.</p>'}
      ${f.planos.length ? '<button class="boton secundario" data-cx="pdf-balanceo"><i class="ic ic-doc"></i>Informe del balanceo (PDF)</button>' : ''}
      ${htmlFichas('balanceo', 'Hoja de balanceo')}`;
    const cuerpo = pestanaEq === 'balanceo' ? balanceo()
      : `${htmlConjunto(f.conjunto, e.id)}
      ${htmlTomaDatos()}
      ${htmlFichas('equipo', 'Fichas del equipo')}
      ${htmlFotosEquipo(f, puede)}
      ${checklist(f.checklist, f.medicion, puede)}`;
    const sub = [e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    $app.innerHTML = `
      ${pestanaEq === 'balanceo'
        ? tagFijo(e.tag, tituloMedicion(f), 'ficha-equipo')
        : tagFijo(e.tag, sub, 'atras')}
      <div class="densa">${cuerpo}</div>`;
    C.cargarImagenes($app);
    if (pestanaEq === 'balanceo') { restaurarPlano(); latirCrono(); }
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
   * EL CONJUNTO: en un split la exterior y la interior se ponen en marcha y
   * se entregan juntas; aquí salen las dos, con su modelo y nº de serie, y un
   * toque abre la otra. En un VRF, la exterior y sus interiores.
   */
  function htmlConjunto(cj, actual) {
    if (!cj || !cj.unidades || cj.unidades.length < 2) return '';
    const titulo = cj.clase === 'par' ? 'Split: UE + UI' : `VRF: UE + ${cj.unidades.length - 1} UI`;
    return `<h2>${esc(titulo)} <span class="cuenta">un solo commissioning</span></h2>
      <section class="grupo conjunto-cx">
        ${cj.unidades.map((u) => {
          const datos = `<span class="papel">${esc(u.papel)}</span>
            <span class="que"><strong class="cifra">${esc(u.tag)}</strong>
              <span class="sub">${esc([u.modelo, u.numSerie ? `nº ${u.numSerie}` : 'sin nº de serie', u.planta].filter(Boolean).join(' · '))}</span></span>
            <span class="tenue">${esc(u.estadoPM || '')}</span>`;
          return u.id === actual
            ? `<div class="fila-dato actual">${datos}</div>`
            : `<button class="fila-dato" data-cx="equipo" data-id="${esc(u.id)}">${datos}<span class="flecha">›</span></button>`;
        }).join('')}
        <div class="fila-dato"><span>Estado del conjunto</span>${chipEnvio(cj.envio, cj.completo, cj.ensayoFalta)}</div>
      </section>
      ${cj.falta && cj.falta.length && !cj.completo ? `<p class="nota aviso">Falta en el conjunto: ${esc(cj.falta.join(', '))}</p>` : ''}`;
  }

  /*
   * LAS FOTOS DEL EQUIPO: un toque en «Placa» o «Vista general» abre la
   * cámara y la foto se guarda ya, con ese pie y la hora. Sin pasos de más.
   */
  const PIES_FOTO = ['Placa', 'Vista general', 'Otra'];
  function htmlFotosEquipo(f, puede) {
    const fotos = f.fotos || [];
    return `<h2>Fotos del equipo <span class="cuenta">${fotos.length}</span></h2>
      ${fotos.length ? `<ul class="fotos-equipo">${fotos.map((x) => `<li><img data-src="api/equipo/foto?id=${encodeURIComponent(x.id)}" alt="${esc(x.pie || 'Foto')}">
        <div class="pie"><span>${esc([x.pie, x.hora].filter(Boolean).join(' · '))}</span>${puede ? `<button class="enlace mal" data-cx="quitar-foto-equipo" data-id="${esc(x.id)}">Quitar</button>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${puede ? `<div class="fila-botones fotos-rapidas">
        ${PIES_FOTO.map((pie) => `<button class="boton secundario" data-cx="foto-equipo" data-pie="${esc(pie)}"><i class="ic ic-camara"></i>${esc(pie)}</button>`).join('')}
        <button class="boton secundario" data-cx="foto-equipo" data-pie="" data-galeria="1">De la galería</button>
      </div>` : ''}`;
  }

  async function fotoEquipo(boton) {
    if (!ficha) return;
    const archivo = await C.elegirFoto(!boton.dataset.galeria);
    if (!archivo || !ficha) return;
    boton.disabled = true;
    try {
      const id = await C.subirFoto(archivo);
      const pie = boton.dataset.pie === 'Otra' ? '' : boton.dataset.pie;
      const r = await C.postJson('api/equipo/fotos', { equipoId: ficha.equipo.id, fotos: [{ id, pie, hora: ahoraEs() }] });
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      if (!activa()) return;
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
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
      const r = await C.postJson('api/equipo/fotos/quitar', { id: boton.dataset.id });
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
    } catch (e) {
      C.aviso(e.message);
      ins.forEach((x) => { x.disabled = false; x.value = x.defaultValue; });
    }
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
    } catch { /* sin conexión de datos no hay nada que hacer aquí: se reintenta al salir */ }
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
  const chipFicha = (estado, resultado) => {
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
    return x.medidos ? `${x.medidos.rellenos} de ${x.medidos.obligatorios} datos` : null;
  }

  function htmlFichas(pestana = 'equipo', titulo = 'Fichas del equipo') {
    if (!fichasEq) return `<section id="fichas-equipo"><h2>${esc(titulo)}</h2><p class="cargando">Cargando las fichas…</p></section>`;
    if (fichasEq.ok === false) return `<section id="fichas-equipo"><h2>${esc(titulo)}</h2><p class="nota aviso">${esc(fichasEq.error)}</p></section>`;
    /* Se conserva el índice de cada ficha en la lista completa: data-i lo usa abrirHoja. */
    const fs = (fichasEq.fichas || []).map((x, i) => [x, i]).filter(([x]) => pestanaDeFicha(x) === pestana);
    if (!fs.length && pestana === 'balanceo') return '';
    /* El balanceo, una fila más: abre las bocas del plano y la hoja. */
    const filaBal = pestana === 'equipo' && ficha && tieneBalanceo(ficha) ? htmlFilaBalanceo(ficha) : '';
    /* Sin plano: qué se mide y dónde (un cassette, sus 3 velocidades; un split, la Tª de impulsión). */
    const med = pestana === 'equipo' && ficha && !filaBal && ficha.medicion && ficha.medicion.titulo ? ficha.medicion : null;
    const notaMed = med ? `<p class="nota">Medición de aire: ${esc(med.texto.charAt(0).toLowerCase() + med.texto.slice(1))}.</p>` : '';
    const vacio = pestana === 'equipo' && !(fichasEq.fichas || []).length
      ? 'Este equipo no tiene familia asignada: se le pone en el ordenador (Puesta en marcha).' : 'Sin fichas.';
    return `<section id="fichas-equipo">
      <h2>${esc(titulo)} <span class="cuenta">${fs.length + (filaBal ? 1 : 0)}</span></h2>
      ${fs.length || filaBal ? `<ul class="lista-ios numerada">${fs.map(([x, i]) => (!x.plantilla ? `
        <li><div class="fila-ios apagada">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span class="chip neutra">Sin plantilla</span></div>
          <div class="sub">${esc(x.motivo || 'Falta elegir la plantilla')} Se elige en el ordenador (Puesta en marcha).</div>
        </div></li>` : `
        <li><button class="fila-ios" data-cx="hoja" data-i="${i}">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span>${chipFicha(x.estado, x.resultado)}</span></div>
          <div class="sub">${esc([CLASE_FICHA[x.clase] || x.clase, x.motivo, textoMedidos(x), x.fotos ? `${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))}</div>
        </button></li>`)).join('')}${filaBal}</ul>` : `<p class="vacio">${esc(vacio)}</p>`}
      ${notaMed}
    </section>`;
  }

  function htmlFilaBalanceo(f) {
    const bocas = f.planos.flatMap((p) => p.bocas);
    const medidas = bocas.filter((b) => b.caudal !== null && b.caudal !== undefined).length;
    const fuera = bocas.filter((b) => b.estado === 'alto' || b.estado === 'bajo').length;
    const hoja = ((fichasEq && fichasEq.fichas) || []).find((x) => x.clase === 'balanceo');
    const chip = fuera ? `<span class="chip mal">${fuera} fuera</span>`
      : hoja ? chipFicha(hoja.estado, hoja.resultado)
      : bocas.length && medidas === bocas.length ? '<span class="chip bien">Medido</span>' : '';
    const sub = bocas.length ? `${medidas} de ${bocas.length} bocas medidas` : 'Sin plano de bocas';
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
    if (t && t.f && t.cambiada) {
      tomas.delete(claveToma(x));
      hoja = { ...t, nombre: x.nombre };
      pintarHoja();
      window.scrollTo(0, 0);
      return;
    }
    $app.innerHTML = '<p class="cargando">Cargando la ficha…</p>';
    abriendoHoja += 1;
    try {
      const ref = { obra: fichasEq.equipo.obraId, clave: x.clave, plantilla: x.plantilla };
      const r = await C.pedir(`api/ficha?${new URLSearchParams(ref)}`);
      if (!r.ok) throw new Error(r.error);
      hoja = nuevaHoja(ref, x.nombre, r);
      pintarHoja();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); pintarFicha(); } finally { abriendoHoja -= 1; }
  }

  /* Lo que se ve: lo tecleado ahora si lo hay; si no, lo guardado. */
  const valorDe = (p, k = 'v') => {
    const c = hoja.valores[p.codigo];
    if (c && c[k] !== undefined) return c[k];
    return k === 'v' ? p.valor : p[k];
  };
  const cabDe = (k) => (hoja.cabecera[k] !== undefined ? hoja.cabecera[k] : hoja.f.cabecera[k]);

  const BOTONES_RESP = { siNoNa: [['si', 'Sí'], ['no', 'No'], ['na', 'N/A']], siNo: [['si', 'Sí'], ['no', 'No']], okNoOk: [['ok', 'OK'], ['noOk', 'NO OK']] };
  const claseResp = (k) => `activa ${k === 'no' || k === 'noOk' ? 'mal' : k === 'na' ? 'neutra' : 'bien'}`;

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
  function inputPunto(p, ed, aria) {
    const dis = ed ? '' : 'disabled';
    const v = valorDe(p);
    const a = `aria-label="${esc(aria || p.etiqueta)}"`;
    if (BOTONES_RESP[p.tipo]) {
      return `<div class="respuestas mini">${BOTONES_RESP[p.tipo].map(([k, n]) => `<button type="button" ${dis} class="${v === k ? claseResp(k) : ''}" data-h-resp="${k}" data-h-punto="${esc(p.codigo)}">${n}</button>`).join('')}</div>`;
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
    return `<div class="${clase}"><span class="et">${num}${esc(p.etiqueta)}${obligatorioDe(p)}${unidadDe(p)}</span>${inputPunto(p, ed)}</div>`;
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
  const estadoGuardar = (h) => `<span class="estado-guardar ${h.cambiada ? 'pendiente' : 'al-dia'}">${h.cambiada ? 'Cambios sin guardar' : 'Todo guardado'}</span>`;

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
      ${tagFijo(ficha ? ficha.equipo.tag : (f.titulo || 'Equipo'), h.nombre || f.plantilla.nombre, 'volver-equipo',
        `${chipFicha(f.estado, f.resultado)}${f.medidos ? ` <span class="chip neutra">${f.medidos.rellenos}/${f.medidos.obligatorios}</span>` : ''}`)}
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
        ${h.nuevas.map((x, i) => `<li class="nueva"><img src="${esc(x.url)}" alt="Foto nueva">
          <div class="pie"><input placeholder="¿Qué se ve? (p. ej. placa del equipo)" value="${esc(x.pie)}" data-h-pie="${i}"><span class="tenue">${esc(x.hora)} · sin guardar</span>
          <button class="enlace mal" data-cx="quitar-nueva" data-i="${i}">Quitar</button></div></li>`).join('')}
      </ul>` : '<p class="nota">Las fotos que se hagan aquí salen en el informe, con su pie y su hora.</p>'}
      ${ed && total < 8 ? `<div class="fila-botones">
        <button class="boton secundario" data-cx="foto" data-camara="1"><i class="ic ic-camara"></i>Hacer foto</button>
        <button class="boton secundario" data-cx="foto" data-camara="0">De la galería</button>
      </div>` : ''}
      ${htmlLoQueFalta(f, porPasos ? pasos : null, FALTAN_VISTOS)}
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
      ${ed ? `<div class="barra-guardar" role="status">${estadoGuardar(h)}<button class="boton" data-cx="guardar-hoja" ${h.cambiada ? '' : 'disabled'}>Guardar</button></div>` : ''}`;
    C.cargarImagenes($app);
  }

  function marcarCambiada() {
    refrescarPasos();
    if (hoja.cambiada) return;
    hoja.cambiada = true;
    const b = $app.querySelector('[data-cx="guardar-hoja"]');
    if (b) b.disabled = false;
    const e = $app.querySelector('.barra-guardar .estado-guardar');
    if (e) e.outerHTML = estadoGuardar(hoja);
  }

  function anotar(el) {
    if (anotarEn(hoja, el)) marcarCambiada();
  }
  /* Apunta en la ficha `h` lo tecleado en `el`; dice si había algo que apuntar. */
  function anotarEn(h, el) {
    if (!h || !el.dataset) return false;
    if (el.dataset.hCab) h.cabecera[el.dataset.hCab] = el.value;
    else if (el.hasAttribute('data-h-obs')) h.observaciones = el.value;
    else if (el.dataset.hPie !== undefined) { const x = h.nuevas[Number(el.dataset.hPie)]; if (x) x.pie = el.value; }
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

  async function fotoHoja(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !hoja) return;
    try {
      const id = await C.subirFoto(archivo);
      hoja.nuevas.push({ id, url: URL.createObjectURL(archivo), pie: '', hora: ahoraEs() });
      hoja.cambiada = true;
      const y = window.scrollY;
      pintarHoja();
      window.scrollTo(0, y);
      const pies = $app.querySelectorAll('[data-h-pie]');
      if (pies.length) pies[pies.length - 1].focus();
    } catch (e) { C.aviso(e.message); }
  }

  /* Lo que se manda al guardar una ficha: los datos sueltos con `v`; los de parámetros con p/f/m. */
  function cuerpoFicha(h) {
    const valores = {};
    for (const [codigo, c] of Object.entries(h.valores)) {
      if ('v' in c) valores[codigo] = c.v === null || c.v === '' ? null : { v: c.v };
      else valores[codigo] = c;
    }
    return {
      obraId: h.ref.obra, clave: h.ref.clave, plantilla: h.ref.plantilla,
      cabecera: h.cabecera, valores, observaciones: h.observaciones,
      fotosNuevas: h.nuevas.map((x) => ({ id: x.id, pie: x.pie, hora: x.hora })),
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
    if (faltan.length) throw new Error(`No se ha guardado bien (${faltan.length === 1 ? faltan[0] : `${faltan.length} puntos`}): vuelve a pulsar Guardar.`);
    return r;
  }

  async function guardarHoja(boton) {
    const h = hoja;
    if (!h || !h.cambiada) return true;
    if (boton) boton.disabled = true;
    try {
      const r = await postFicha(cuerpoFicha(h));
      for (const x of h.nuevas) URL.revokeObjectURL(x.url);
      hoja = { ...h, f: r, valores: {}, cabecera: {}, observaciones: undefined, nuevas: [], quitar: new Set(), cambiada: false };
      tomas.delete(`${h.ref.clave}|${h.ref.plantilla}`);
      fichasEq = null;
      if (ficha) cargarFichas(ficha.equipo.id);
      C.aviso(r.estado === 'completa' ? 'Guardada: la ficha está completa.' : 'Guardada.', 'bien');
      const y = window.scrollY;
      if (activa() && hoja) { pintarHoja(); window.scrollTo(0, y); }
      return true;
    } catch (e) {
      C.aviso(e.message);
      if (boton) boton.disabled = false;
      return false;
    }
  }

  async function terminarHoja(boton) {
    if (hoja.cambiada && hoja.f.editable && !(await guardarHoja(boton))) return;
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
    .filter(([x]) => x.plantilla && pestanaDeFicha(x) === 'equipo' && !CLASES_SIN_TOMA.has(x.clase) && x.estado !== 'firmada');

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
        if (!tomas.has(claveToma(x))) tomas.set(claveToma(x), nuevaToma(ref, x.nombre, r));
      } catch (e) {
        /* Sin red: no se guarda en la caché, la próxima vez se vuelve a pedir. */
        tomas.set(claveToma(x), { ref, nombre: x.nombre, error: e.message, cambiada: false, temporal: true });
      }
    }));
    if (activa() && ficha && !hoja && ficha.equipo.id === id && pestanaEq === 'equipo') {
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
        <h3 class="banda">${esc(x.nombre)}${m ? ` <span class="tenue">${m.rellenos} de ${m.obligatorios}</span>` : ''} ${abrirla}</h3>
        ${ed ? '' : `<p class="nota">${t.f.firmada ? 'Firmada: ya no se cambia.' : 'Tu rol puede ver la ficha, pero no rellenarla.'}</p>`}
        <section class="hoja-tabla rejilla-datos toma-tabla">${conHoja(t, () => ps.map(([s, p]) => filaToma(s, p, ed)).join(''))}</section>
      </div>`;
    }).filter(Boolean);
    if (!cuerpos.length) return cargando ? '<section id="toma-datos"><h2>Toma de datos</h2><p class="cargando">Cargando lo que falta por medir…</p></section>' : '';
    const sucias = listas.filter(([, , t]) => t.cambiada).length;
    const puede = listas.some(([, , t]) => t.f.editable);
    return `<section id="toma-datos">
      <h2>Toma de datos <span class="cuenta">lo que falta, sin abrir las fichas</span></h2>
      ${cuerpos.join('')}
      ${cargando ? '<p class="cargando">Cargando el resto…</p>' : ''}
      ${puede ? `<div class="barra-toma">${estadoToma(sucias)}<button class="boton" data-cx="guardar-toma" ${sucias ? '' : 'disabled'}>Guardar</button></div>` : ''}
    </section>`;
  }
  const estadoToma = (n) => `<span class="estado-guardar ${n ? 'pendiente' : 'al-dia'}">${n ? `Cambios sin guardar en ${n} ficha${n === 1 ? '' : 's'}` : 'Todo guardado'}</span>`;

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
  function marcarToma(t) {
    t.cambiada = true;
    const n = [...tomas.values()].filter((x) => x.cambiada).length;
    const b = $app.querySelector('[data-cx="guardar-toma"]');
    if (b) b.disabled = false;
    const e = $app.querySelector('.barra-toma .estado-guardar');
    if (e) e.outerHTML = estadoToma(n);
  }

  /* Guarda una a una las fichas tocadas, por el mismo camino que la hoja. Lo que
     no se guarde (sin red) se queda tecleado, con su aviso, para reintentar. */
  async function guardarTomas(boton) {
    const claves = new Set(fichasToma().map(([x]) => claveToma(x)));
    const sucias = [...tomas.entries()].filter(([k, t]) => claves.has(k) && t.f && t.cambiada);
    if (!sucias.length) return;
    if (boton) boton.disabled = true;
    let bien = 0;
    let completas = 0;
    const fallos = [];
    for (const [k, t] of sucias) {
      try {
        const r = await postFicha(cuerpoFicha(t));
        tomas.set(k, nuevaToma(t.ref, t.nombre, r, t.vistos));
        bien += 1;
        if (r.estado === 'completa') completas += 1;
      } catch (e) { fallos.push(`${t.nombre}: ${e.message}`); }
    }
    if (fallos.length) C.aviso(`${bien ? `Guardadas ${bien}; ` : ''}sin guardar ${fallos.join(' · ')}`);
    else C.aviso(completas ? `Guardado: ${completas === 1 ? 'una ficha completa' : `${completas} fichas completas`}.` : 'Guardado.', 'bien');
    if (!activa() || !ficha || hoja) return;
    const y = window.scrollY;
    pintarFicha();
    window.scrollTo(0, y);
    if (bien) cargarFichas(ficha.equipo.id);
  }

  function salirHoja() {
    if (hoja && hoja.cambiada && !window.confirm('Hay cambios sin guardar en la ficha. ¿Salir sin guardarlos?')) return;
    hoja = null;
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
    const ed = d.puede.medir;
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
        ${cuadrillaLocal && cuadrillaLocal.cambiada ? `<button class="boton" data-cx="crono" data-accion="cuadrilla">Guardar cuadrilla</button>` : ''}</div>` : ''}
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

  async function accionCrono(boton, accion, extra = {}) {
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
      if (txt) C.aviso(txt, 'bien');
    } catch (e) { C.aviso(e.message); if (boton) boton.disabled = false; }
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
    if (ev.target.hasAttribute('data-crono-campo')) {
      leerCuadrilla();
      if (!cuadrillaLocal.cambiada) { cuadrillaLocal.cambiada = true; repintarCrono(); }
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
    /* 16-oct (JC): la franja del TAG vuelve SIEMPRE a la pantalla anterior:
       si se llegó desde otra unidad del conjunto (UI → UE-DAS), a esa unidad. */
    else if (que === 'atras') { const prev = pilaEquipos.pop(); if (prev) abrir(prev, { atras: true }); else { const y = yLista; cargarLista().then(() => window.scrollTo(0, y)); } }
    else if (que === 'equipo') { if (!ficha) yLista = window.scrollY; if (ficha && ficha.equipo.id !== b.dataset.id) pilaEquipos.push(ficha.equipo.id); abrir(b.dataset.id); }
    else if (que === 'ver-balanceo' && ficha) { pestanaEq = 'balanceo'; pintarFicha(); window.scrollTo(0, 0); }
    else if (que === 'ficha-equipo' && ficha) { document.body.classList.remove('sin-scroll'); pestanaEq = 'equipo'; pintarFicha(); window.scrollTo(0, 0); }
    else if (que === 'hoja') abrirHoja(Number(b.dataset.i));
    else if (que === 'volver-equipo') salirHoja();
    /* Fin del checklist (JC, 28-oct): guarda lo pendiente y vuelve al equipo;
       si no se ha podido guardar, se queda en la hoja con el aviso del error. */
    else if (que === 'terminar-hoja' && hoja) terminarHoja(b);
    else if (que === 'paso-hoja' && hoja) irAPaso(Number(b.dataset.ir !== undefined ? b.dataset.ir : b.dataset.paso));
    else if (que === 'foto') fotoHoja(b.dataset.camara === '1');
    else if (que === 'quitar-foto' && hoja) { hoja.quitar.add(Number(b.dataset.i)); hoja.cambiada = true; pintarHoja(); }
    else if (que === 'quitar-nueva' && hoja) { const [x] = hoja.nuevas.splice(Number(b.dataset.i), 1); if (x) URL.revokeObjectURL(x.url); pintarHoja(); }
    else if (que === 'guardar-hoja') guardarHoja(b);
    else if (que === 'guardar-toma' && ficha && !hoja) guardarTomas(b);
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
    else if (que === 'verificar-instalacion' && ficha) verificarInstalacion(b);
    else if (que === 'foto-equipo') fotoEquipo(b);
    else if (que === 'quitar-foto-equipo') quitarFotoEquipo(b);
    else if (que === 'nube-ahora' && window.cxObra && window.cxObra.sync) { b.disabled = true; window.cxObra.sync.ahora().finally(() => { if (ficha) abrir(ficha.equipo.id, { quieto: true }); }); }
    else if (que === 'crono' && ficha) accionCrono(b, b.dataset.accion);
    else if (que === 'crono-anadir' && ficha) { const g = leerCuadrilla(); g.push({ nombre: `Operario ${g.filter((p) => p.rol === 'operario').length + 1}`, rol: 'operario', empresa: (g[g.length - 1] || {}).empresa || null }); cuadrillaLocal.cambiada = true; repintarCrono(); }
    else if (que === 'crono-quitar' && ficha) { const g = leerCuadrilla(); if (g.length > 1) { g.splice(Number(b.dataset.i), 1); cuadrillaLocal.cambiada = true; repintarCrono(); } }
    else if (que === 'crono-parte' && ficha) parteCrono(b);
    else if (que === 'crono-pdf' && ficha) compartirPdf(`api/informe?tipo=cronometro&equipo=${encodeURIComponent(ficha.equipo.id)}`, `${ficha.equipo.tag} - tiempo de medida (interno).pdf`, b);
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
    const guardado = (h.f.secciones.flatMap((s) => s.puntos).find((x) => x.codigo === p) || {}).valor;
    const actual = h.valores[p] && 'v' in h.valores[p] ? h.valores[p].v : guardado;
    const nuevo = actual === b.dataset.hResp ? null : b.dataset.hResp;
    h.valores[p] = { v: nuevo };
    for (const x of b.parentElement.children) x.className = '';
    if (nuevo) b.className = b.parentElement.classList.contains('segmento') ? 'activa' : `activa ${nuevo === 'no' || nuevo === 'noOk' ? 'mal' : nuevo === 'na' ? 'neutra' : 'bien'}`;
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
    if (activa() && anotarToma(ev.target)) return;
    if (activa() && ev.target.dataset && ev.target.dataset.punto) { const li = ev.target.closest('li[data-boca]'); if (li) { vivoBoca(li); guardarBocaPronto(li); } return; }
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
    if (!activa()) return;
    /* Ha llegado algo de la oficina con un equipo abierto: se repinta ese equipo, no la lista. */
    if (ev.cxDatos && ficha) {
      /* Con una boca a medio escribir no se repinta: se perdería lo tecleado (se guarda y repinta sola). */
      const foco = document.activeElement && document.activeElement.closest ? document.activeElement.closest('li[data-boca]') : null;
      if (foco && (cambiada(foco) || foco.dataset.guardada)) return;
      /* Tampoco con el dedo en la toma de datos: se perdería el foco a medio escribir. */
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-toma]')) return;
      if (!hoja && !abriendoHoja) abrir(ficha.equipo.id, { quieto: true });
      return;
    }
    cargarLista();
  });
  if (activa()) cargarLista();
})();
