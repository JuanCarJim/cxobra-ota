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
  let fichasEq = null; /* las fichas que necesita el equipo abierto */
  let hoja = null;     /* la ficha que se está rellenando */
  let filtro = '';

  const ENVIO = {
    completo: ['bien', 'Completo'], enviada: ['bien', 'Enviada'], lista: ['bien', 'Lista para enviar'],
    faltaDocumentacion: ['aviso', 'Falta documentación'], faltaEnsayo: ['aviso', 'Falta ensayo'],
  };
  const chipEnvio = (e, completo) => {
    const [clase, nombre] = completo ? ENVIO.completo : (ENVIO[e] || ['neutra', e || 'Pendiente']);
    return `<span class="chip ${clase}">${esc(nombre)}</span>`;
  };
  const ESTADO_BOCA = { dentro: ['bien', 'OK'], ok: ['bien', 'OK'], sinFactor: ['aviso', 'Falta el Ak'], medido: ['neutra', 'Medida'], alto: ['mal', 'Alto'], bajo: ['mal', 'Bajo'], sinMedir: ['neutra', 'Sin medir'], sinProyecto: ['neutra', 'Sin Q proyecto'], sinTolerancia: ['neutra', 'Medida'] };
  const INCIDENCIA = { sinSerie: 'Sin nº de serie', modeloSinAlta: 'Modelo sin dar de alta' };
  const pct = (q, d) => (q === null || q === undefined || !d ? null : Math.round((q / d) * 100));

  /* ═══════════════════════════════════ 1. La lista */

  async function cargarLista() {
    ficha = null; hoja = null;
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
    if (activa() && !ficha) pintarLista();
  }

  /* Segmentos por estado: son las cifras de arriba, siempre a la vista; cada una filtra la lista. */
  const SEGMENTOS = [
    ['todos', 'Todos', () => true],
    ['faltaDoc', 'Falta doc.', (e) => !e.completo && e.envio === 'faltaDocumentacion'],
    ['faltaEnsayo', 'Falta ensayo', (e) => !e.completo && e.envio === 'faltaEnsayo'],
    ['completos', 'Completos', (e) => e.completo || e.envio === 'lista' || e.envio === 'enviada'],
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

  function pintarLista() {
    /* La ficha del equipo escondía el selector de arriba: vuelve. */
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = seg.children.length < 2;
    const conj = porConjuntos();
    const t = conj ? { ...(lista.totales || {}), ...(lista.totalesConjuntos || {}) } : (lista.totales || {});
    const q = filtro.trim().toLowerCase();
    const todos = (conj ? lista.conjuntos : lista.equipos) || [];
    const [, , pasa] = SEGMENTOS.find(([id]) => id === segmento) || SEGMENTOS[0];
    const equipos = todos.filter(pasa).filter((e) => !q || textoDe(e).toLowerCase().includes(q));
    const [, , grupoDe] = AGRUPAR.find(([id]) => id === agrupar) || AGRUPAR[0];
    const sin = (g) => g.startsWith('Sin ');
    const grupos = [...new Set(equipos.map(grupoDe))].sort(agrupar === 'planta' ? porPlanta
      : (a, b) => sin(a) - sin(b) || a.localeCompare(b, 'es', { numeric: true }));
    $app.innerHTML = `
      <div class="resumen-fila" role="tablist">${[['todos', conj ? t.conjuntos : t.equipos, conj ? 'conjuntos' : 'equipos'], ['completos', t.completos, 'completos'], ['faltaDoc', t.faltaDocumentacion, 'falta doc.'], ['faltaEnsayo', t.faltaEnsayo, 'falta ensayo']]
        .map(([id, n, texto]) => `<button role="tab" data-cx-seg="${id}" aria-selected="${segmento === id}" class="${segmento === id ? 'activa' : ''} ${id.startsWith('falta') && n ? 'aviso' : ''}"><b>${cifra(n)}</b><span>${esc(texto)}</span></button>`).join('')}</div>
      ${conj && t.unidades !== t.conjuntos ? `<p class="nota tenue cuenta-conjuntos">${cifra(t.conjuntos)} conjuntos con ${cifra(t.unidades)} unidades: ${cifra(t.pares)} splits y ${cifra(t.sistemas)} VRF van en una línea con su exterior.</p>` : ''}
      <input type="search" class="buscar" placeholder="Buscar TAG, planta, tipo o marca" value="${esc(filtro)}" data-cx-buscar>
      <div class="agrupar" role="group" aria-label="Agrupar por"><span>Agrupar por</span>${AGRUPAR
        .map(([id, texto]) => `<button data-cx-agrupar="${id}" aria-pressed="${agrupar === id}" class="${agrupar === id ? 'activa' : ''}">${texto}</button>`).join('')}</div>
      ${equipos.length ? C.listaAgrupada(`cx-equipos-${agrupar}`, equipos, {
        grupo: grupoDe, orden: grupos, buscando: !!q, repintar: pintarLista,
        fila: (e) => `
        <li><button class="fila-ios" data-cx="equipo" data-id="${esc(e.id)}">
          <div class="fila-principal">
            ${tagsFila(e)}
            ${chipEnvio(e.envio, e.completo)}
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
      if (!ficha || ficha.equipo.id !== r.equipo.id) pestanaEq = 'equipo';
      ficha = r;
      hoja = null;
      fichasEq = null;
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
  }

  function totalCircuito(c, nombre) {
    if (!c || c.estado === 'sinPuntos') return '';
    const diseno = c.disenoEquipo || c.disenoPuntos || null;
    const p = pct(c.suma, diseno);
    const clase = c.estado === 'ok' ? 'bien' : (c.estado === 'alto' || c.estado === 'bajo') ? 'mal' : 'neutra';
    return `<div class="total-circuito">
      <div class="fila-principal"><strong>${esc(nombre)}</strong><span class="chip ${clase}">${p === null ? `${c.medidos}/${c.puntos} medidas` : `${p} %`}</span></div>
      <div class="cifras-total">
        <div><span>Medido</span><b>${cifra(c.suma)}</b><em>m³/h</em></div>
        <div><span>Proyecto</span><b>${cifra(diseno)}</b><em>m³/h</em></div>
        <div><span>Bocas</span><b>${cifra(c.medidos)}/${cifra(c.puntos)}</b></div>
      </div>
      ${c.faltan ? `<div class="sub">Faltan ${c.faltan} boca${c.faltan === 1 ? '' : 's'} por medir.</div>` : ''}
    </div>`;
  }

  function checklist(k, med) {
    if (!k) return '';
    /* Un split o una enfriadora no llevan balanceo de bocas: no se les pide. */
    const sinBal = med && !med.plano && (!k.balanceoEstado || k.balanceoEstado === 'pendiente');
    const si = (v) => (v ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');
    const ensayo = k.ensayoRequerido === 'ninguno' || !k.ensayoRequerido ? '<span class="tenue">No hace falta</span>' : si(k.ensayo);
    return `<h2>Checklist</h2>
      <section class="grupo">
        <div class="fila-dato"><span>Ficha técnica</span>${si(k.ft)}</div>
        <div class="fila-dato"><span>Certificado CE</span>${si(k.ce)}</div>
        <div class="fila-dato"><span>Manual</span>${si(k.manual)}</div>
        <div class="fila-dato"><span>Ficha PM</span>${si(k.fichaPM)}</div>
        <div class="fila-dato"><span>Ensayo</span>${ensayo}</div>
        <div class="fila-dato"><span>Balanceo</span>${sinBal ? '<span class="tenue">No hace falta</span>' : `<strong>${esc(k.balanceoEstado || '—')}</strong>`}</div>
        ${k.estanqueidad ? `<div class="fila-dato"><span>Estanqueidad</span><strong>${esc(typeof k.estanqueidad === 'object' ? (k.estanqueidad.resultado || k.estanqueidad.estado || '✓') : k.estanqueidad)}</strong></div>` : ''}
        <div class="fila-dato"><span>Puesta en marcha</span><strong>${esc(k.estadoPM || '—')}</strong></div>
      </section>
      ${(k.incidencias || []).length ? `<p class="nota aviso">${esc(k.incidencias.map((i) => INCIDENCIA[i] || i).join(' · '))}</p>` : ''}`;
  }

  /*
   * LA FICHA DEL EQUIPO, sin pestañas (15-oct-2026, JC: «Estanqueidad y
   * balanceo muévelas a fichas del equipo»). La estanqueidad es una ficha más
   * de la lista; el balanceo, una fila de esa lista que abre las bocas y su
   * hoja. Mientras se ve un equipo, el selector de arriba se esconde.
   */
  let pestanaEq = 'equipo';
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
      return `<p class="nota aviso">El plano de bocas se dibuja en el ordenador y te llega solo en cuanto entres en la nube de la oficina.</p>
        <button class="boton" data-cx="nube-entrar">Entrar en la nube y traer el plano</button>`;
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
    const balanceo = () => `
      ${totalCircuito(f.circuitos && f.circuitos.impulsion, 'Impulsión')}
      ${totalCircuito(f.circuitos && f.circuitos.retorno, med.retorno || 'Retorno')}
      ${med.velocidad ? `<p class="nota">Una medida por boca, con el equipo a velocidad ${esc(med.velocidad)}.</p>` : ''}
      ${f.planos.length ? f.planos.map((p) => `
        <h2>${esc(p.nombre)} <span class="cuenta">${p.bocas.length} bocas</span></h2>
        ${htmlPlano(p)}
        <ul class="bocas">${p.bocas.map((b) => htmlBoca(p, b, puede, f.tolerancias)).join('')}</ul>`).join('') : sinPlano()}
      ${puede || !f.planos.length ? '' : '<p class="nota">Tu rol puede ver las medidas, pero no tomarlas.</p>'}
      ${f.planos.length ? '<button class="boton secundario" data-cx="pdf-balanceo"><i class="ic ic-doc"></i>Informe del balanceo (PDF)</button>' : ''}
      ${htmlFichas('balanceo', 'Hoja de balanceo')}`;
    const cuerpo = pestanaEq === 'balanceo' ? balanceo()
      : `${htmlConjunto(f.conjunto, e.id)}
      ${htmlFotosEquipo(f, puede)}
      ${htmlFichas('equipo', 'Fichas del equipo')}
      ${checklist(f.checklist, f.medicion)}`;
    $app.innerHTML = `
      ${pestanaEq === 'balanceo'
        ? `<button class="volver" data-cx="ficha-equipo">‹ ${esc(e.tag)}</button>`
        : '<button class="volver" data-cx="lista">‹ Equipos</button>'}
      <section class="cabeza-ficha">
        <h2 class="cifra">${esc(pestanaEq === 'balanceo' ? `${tituloMedicion(f)} · ${e.tag}` : e.tag)}</h2>
        <div class="sub">${esc([e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</div>
      </section>
      ${cuerpo}`;
    C.cargarImagenes($app);
  }

  /* «Balanceo de caudales», «Caudales de extracción»… según lo que se mide. */
  const tituloMedicion = (f) => (f.medicion && f.medicion.titulo) || 'Balanceo de caudales';
  const claseMarca = (estado) => (estado === 'dentro' || estado === 'ok' ? 'bien' : estado === 'alto' || estado === 'bajo' ? 'mal' : 'neutra');

  /*
   * EL PLANO CON SUS BOCAS (15-oct-2026, JC: «la imagen del plano con las
   * bocas»): encima de la lista, una marca por boca donde está de verdad,
   * gris sin medir, verde dentro de tolerancia y roja fuera; cambia mientras
   * se teclea. Tocar una lleva a su boca y pone el foco en M1. «Ampliar» lo
   * abre a pantalla completa, con zoom de dos dedos.
   */
  function htmlPlano(p) {
    const conSitio = p.bocas.filter((b) => b.x !== null && b.x !== undefined && b.y !== null && b.y !== undefined);
    if (!p.imagen || !conSitio.length) return '';
    return `<figure class="plano-bocas" data-plano-fig="${esc(p.id)}">
      <div class="plano-marco"><div class="plano-lienzo">
        <img data-src="api/equipo/plano?id=${encodeURIComponent(p.id)}" alt="Plano ${esc(p.nombre)}">
        ${conSitio.map((b) => `<button class="marca-boca ${claseMarca(b.estado)}${b.circuito === 'retorno' ? ' ret' : ''}" style="left:${(b.x * 100).toFixed(2)}%;top:${(b.y * 100).toFixed(2)}%"
          data-cx="ir-boca" data-boca="${esc(claveBoca(p.id, b.id))}" aria-label="Ir a la boca ${esc(b.nombre)}">${esc(b.nombre)}</button>`).join('')}
      </div></div>
      <figcaption><span class="leyenda"><i class="neutra"></i>Sin medir <i class="bien"></i>Dentro <i class="mal"></i>Fuera</span>
        <button class="enlace" data-cx="plano-grande">Ampliar</button></figcaption>
    </figure>`;
  }

  function irABoca(clave) {
    const fig = $app.querySelector('.plano-bocas.grande');
    if (fig) cerrarPlanoGrande(fig);
    const li = $app.querySelector(`li[data-boca="${CSS.escape(clave)}"]`);
    if (!li) return;
    for (const x of $app.querySelectorAll('li.boca.resaltada')) x.classList.remove('resaltada');
    li.classList.add('resaltada');
    li.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const primera = casillas(li).find((x) => !x.disabled);
    if (primera) primera.focus({ preventScroll: true });
    setTimeout(() => li.classList.remove('resaltada'), 2500);
  }

  function planoGrande(boton) {
    const fig = boton.closest('.plano-bocas');
    if (!fig) return;
    if (fig.classList.contains('grande')) { cerrarPlanoGrande(fig); return; }
    fig.classList.add('grande');
    boton.textContent = 'Cerrar';
    document.body.classList.add('sin-scroll');
  }
  function cerrarPlanoGrande(fig) {
    fig.classList.remove('grande');
    const b = fig.querySelector('[data-cx="plano-grande"]');
    if (b) b.textContent = 'Ampliar';
    document.body.classList.remove('sin-scroll');
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
        <div class="fila-dato"><span>Estado del conjunto</span>${chipEnvio(cj.envio, cj.completo)}</div>
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
   * UNA BOCA. Con el anemómetro se teclean de 1 a 4 lecturas (M1–M4, m/s): la
   * velocidad es su media y Q = v̄ × Ak × 3600. Con el balómetro se teclea el
   * caudal directamente y manda sobre las lecturas.
   */
  const conBalometro = new Set();
  const claveBoca = (plano, punto) => `${plano}|${punto}`;
  const comaD = (v, d = 2) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 10 ** d) / 10 ** d).replace('.', ','));

  function htmlBoca(p, b, puede, tol) {
    const [clase, nombre] = ESTADO_BOCA[b.estado] || ['neutra', b.estado || ''];
    const porc = pct(b.caudal, b.caudalDiseno);
    const clave = claveBoca(p.id, b.id);
    const bal = b.metodo === 'balometro' || conBalometro.has(clave);
    const datos = `data-plano="${esc(p.id)}" data-punto="${esc(b.id)}"`;
    const dis = puede ? '' : 'disabled';
    const lect = b.lecturas && b.lecturas.length ? b.lecturas : (b.velocidad === null || b.velocidad === undefined ? [] : [b.velocidad]);
    const tolB = tol && tol.boca ? Math.round(tol.boca * 100) : 10;
    let formula = '';
    if (!bal) {
      if (b.velocidad === null || b.velocidad === undefined) formula = '';
      else if (!b.factor) formula = '<div class="formula aviso">Falta el Ak de este difusor (ficha del fabricante): sin él no hay caudal.</div>';
      else if (b.modoFactor === 'k') formula = `<div class="formula">v̄ ${comaD(b.velocidad)} m/s · Q = v̄ × k = ${comaD(b.velocidad)} × ${comaD(b.factor, 1)} = <b>${cifra(b.caudal)}</b> m³/h</div>`;
      else formula = `<div class="formula">v̄ ${comaD(b.velocidad)} m/s · Q = v̄ × Ak × 3600 = ${comaD(b.velocidad)} × ${comaD(b.factor, 4)} × 3600 = <b>${cifra(b.caudal)}</b> m³/h</div>`;
    }
    const fuera = (b.estado === 'alto' || b.estado === 'bajo') && porc !== null;
    /* Lo que necesita el cálculo en vivo (vivoBoca): mientras se teclea, la
       boca ya dice si va dentro o fuera, sin esperar a guardarla. */
    const vivo = `data-diseno="${b.caudalDiseno ?? ''}" data-factor="${b.factor ?? ''}" data-modo="${esc(b.modoFactor || '')}" data-tol="${tolB}"`;
    return `<li class="boca ${clase}" data-boca="${esc(clave)}" ${vivo}>
      <div class="boca-cabeza"><strong>${esc(b.nombre)}</strong><span class="sub">${esc(b.circuito === 'retorno' ? 'Retorno' : 'Impulsión')} · ${esc(b.tipo || '')}</span>
        ${puede ? `<button class="interruptor${bal ? ' activo' : ''}" data-cx="balometro" ${datos} aria-pressed="${bal}">Balómetro</button>` : ''}</div>
      ${bal
        ? `<label class="q-balometro">Q balómetro (m³/h)
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-q="1"
              value="${b.caudalMedido === null || b.caudalMedido === undefined ? '' : comaD(b.caudalMedido, 1)}" aria-label="Caudal del balómetro en ${esc(b.nombre)}"></label>`
        : `<div class="lecturas">${[0, 1, 2, 3].map((i) => `<label>M${i + 1}
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-m="${i}"
              value="${lect[i] === undefined ? '' : comaD(lect[i])}" aria-label="Lectura M${i + 1} en ${esc(b.nombre)}"></label>`).join('')}</div>`}
      ${bal ? '' : `<div data-vivo="formula">${formula}</div>`}
      <div class="boca-cifras">
        <div><span>Q medido</span><b data-vivo="q">${cifra(b.caudal)}</b></div>
        <div><span>Q proyecto</span><b>${cifra(b.caudalDiseno)}</b></div>
        <div><span>Desviación</span><b data-vivo="desv">${b.desviacion === null || b.desviacion === undefined ? '—' : `${b.desviacion > 0 ? '+' : ''}${comaD(b.desviacion * 100, 1)} %`}</b></div>
        <div class="porc"><span class="chip ${clase}" data-vivo="chip">${porc === null ? esc(nombre) : `${porc} %`}</span></div>
      </div>
      <p class="nota aviso" data-vivo="aviso" ${fuera ? '' : 'hidden'}>${fuera ? textoFuera(b.desviacion, tolB) : ''}</p>
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
    let q = null;
    if (qIn) q = numVivo(qIn.value);
    else {
      const v = [...li.querySelectorAll('input[data-m]')].map((x) => numVivo(x.value)).filter((n) => n !== null && n >= 0);
      const media = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      if (media !== null && factor) q = li.dataset.modo === 'k' ? media * factor : media * factor * 3600;
      /* La cuenta, también al momento: si no, enseña la de lo guardado. */
      const fo = li.querySelector('[data-vivo="formula"]');
      if (fo) {
        const vm = comaD(Math.round(media * 100) / 100);
        fo.innerHTML = media === null ? ''
          : !factor ? '<div class="formula aviso">Falta el Ak de este difusor (ficha del fabricante): sin él no hay caudal.</div>'
          : li.dataset.modo === 'k' ? `<div class="formula">v̄ ${vm} m/s · Q = v̄ × k = ${vm} × ${comaD(factor, 1)} = <b>${cifra(Math.round(q))}</b> m³/h</div>`
          : `<div class="formula">v̄ ${vm} m/s · Q = v̄ × Ak × 3600 = ${vm} × ${comaD(factor, 4)} × 3600 = <b>${cifra(Math.round(q))}</b> m³/h</div>`;
      }
    }
    const desv = q !== null && diseno ? q / diseno - 1 : null;
    const fuera = desv !== null && Math.abs(desv) * 100 > tolB;
    const clase = q === null ? 'neutra' : desv === null ? 'neutra' : fuera ? 'mal' : 'bien';
    const pon = (k, t) => { const el = li.querySelector(`[data-vivo="${k}"]`); if (el) el.textContent = t; return el; };
    pon('q', q === null ? '—' : cifra(Math.round(q)));
    pon('desv', desv === null ? '—' : `${desv > 0 ? '+' : ''}${comaD(desv * 100, 1)} %`);
    const chip = pon('chip', q === null ? 'Sin medir' : diseno ? `${Math.round((q / diseno) * 100)} %` : 'Sin Q proyecto');
    if (chip) chip.className = `chip ${clase}`;
    li.classList.remove('bien', 'mal', 'aviso', 'neutra');
    li.classList.add(clase);
    /* Su marca en el plano, del mismo color. */
    const marca = $app.querySelector(`.marca-boca[data-boca="${CSS.escape(li.dataset.boca)}"]`);
    if (marca) { marca.classList.remove('bien', 'mal', 'neutra'); marca.classList.add(clase); }
    const av = li.querySelector('[data-vivo="aviso"]');
    if (av) { av.hidden = !fuera; av.textContent = fuera ? textoFuera(desv, tolB) : ''; }
  }

  /* Las casillas de una boca, en orden. */
  const casillas = (li) => [...li.querySelectorAll('input[data-punto]')];
  const cambiada = (li) => casillas(li).some((x) => x.value.trim() !== x.defaultValue.trim());

  /* Guardar la boca entera; luego el foco va a `destino` (otra casilla) o a la siguiente boca sin medir. */
  async function medir(li, destino) {
    const ins = casillas(li);
    if (!ins.length) return;
    const { plano, punto } = ins[0].dataset;
    const cuerpo = { planoId: plano, puntoId: punto };
    if (ins[0].dataset.q) cuerpo.caudalMedido = ins[0].value.trim();
    else cuerpo.lecturas = ins.map((x) => x.value.trim()).filter((v) => v !== '');
    ins.forEach((x) => { x.disabled = true; });
    try {
      const r = await C.postJson('api/boca', cuerpo);
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      if (!activa()) return;
      const y = window.scrollY;
      pintarFicha();
      window.scrollTo(0, y);
      if (destino === 'siguiente') {
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

  /* El interruptor: pasar a balómetro solo cambia la casilla; volver al anemómetro borra el caudal leído. */
  async function cambiarMetodo(boton) {
    const { plano, punto } = boton.dataset;
    const clave = claveBoca(plano, punto);
    const b = ficha.planos.flatMap((p) => p.bocas.map((x) => ({ ...x, plano: p.id }))).find((x) => x.plano === plano && x.id === punto);
    if (!b) return;
    const bal = b.metodo === 'balometro' || conBalometro.has(clave);
    if (!bal) { conBalometro.add(clave); pintarFicha(); const q = $app.querySelector(`li[data-boca="${CSS.escape(clave)}"] input[data-q]`); if (q) q.focus(); return; }
    conBalometro.delete(clave);
    if (b.caudalMedido === null || b.caudalMedido === undefined) { pintarFicha(); return; }
    try {
      const r = await C.postJson('api/boca', { planoId: plano, puntoId: punto, caudalMedido: '' });
      if (!r.ok) throw new Error(r.error);
      ficha = r; if (activa()) pintarFicha();
    } catch (e) { C.aviso(e.message); }
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
          <div class="sub">${esc([CLASE_FICHA[x.clase] || x.clase, x.motivo, x.medidos ? `${x.medidos.rellenos} de ${x.medidos.obligatorios} datos` : null, x.fotos ? `${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))}</div>
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

  async function abrirHoja(i) {
    const x = fichasEq && fichasEq.fichas[i];
    if (!x) return;
    $app.innerHTML = '<p class="cargando">Cargando la ficha…</p>';
    try {
      const ref = { obra: fichasEq.equipo.obraId, clave: x.clave, plantilla: x.plantilla };
      const r = await C.pedir(`api/ficha?${new URLSearchParams(ref)}`);
      if (!r.ok) throw new Error(r.error);
      hoja = { ref, f: r, valores: {}, cabecera: {}, observaciones: undefined, nuevas: [], quitar: new Set(), cambiada: false };
      /* Hoy y quien lleva el teléfono, de entrada (se pueden cambiar). */
      if (r.editable && !r.cabecera.fechaEnsayo) hoja.cabecera.fechaEnsayo = hoyIso();
      if (r.editable && !r.cabecera.realizadoPor) {
        let s = null;
        try { s = window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion(); } catch { /* sin sesión */ }
        if (s && s.nombre) hoja.cabecera.realizadoPor = s.nombre;
      }
      pintarHoja();
      window.scrollTo(0, 0);
    } catch (e) { C.aviso(e.message); pintarFicha(); }
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

  function campoPunto(s, p, ed) {
    const dis = ed ? '' : 'disabled';
    const ob = p.obligatorio ? ' <b class="obligatorio" aria-label="obligatorio">*</b>' : '';
    if (s.tipo === 'parametros') {
      const [cr, nr] = p.resultado && RESULTADO[p.resultado] ? RESULTADO[p.resultado] : ['neutra', ''];
      return `<div class="punto-param">
        <div class="punto-titulo">${esc(p.etiqueta)}${ob}${p.unidad ? ` <span class="tenue">${esc(p.unidad)}</span>` : ''}${nr ? ` <span class="chip ${cr}">${esc(nr)}</span>` : ''}</div>
        <div class="tres-cifras">
          <label>Proyecto<input inputmode="decimal" autocomplete="off" ${dis} value="${esc(coma(valorDe(p, 'p')))}" data-h-punto="${esc(p.codigo)}" data-h-k="p"></label>
          <label>Fabricante<input inputmode="decimal" autocomplete="off" ${dis} value="${esc(coma(valorDe(p, 'f')))}" data-h-punto="${esc(p.codigo)}" data-h-k="f"></label>
          <label class="medido">Medido<input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} value="${esc(coma(valorDe(p, 'm')))}" data-h-punto="${esc(p.codigo)}" data-h-k="m"></label>
        </div>
        ${p.desv !== null && p.desv !== undefined ? `<div class="sub">Desviación ${cifra(p.desv * 100, 1)} %</div>` : ''}
      </div>`;
    }
    const v = valorDe(p);
    if (BOTONES_RESP[p.tipo]) {
      return `<div class="punto-resp">
        <div class="punto-titulo">${s.tipo === 'checklist' ? `<span class="tenue">${esc(p.numero || p.codigo)}</span> ` : ''}${esc(p.etiqueta)}${ob}</div>
        <div class="respuestas">${BOTONES_RESP[p.tipo].map(([k, n]) => `<button type="button" ${dis} class="${v === k ? claseResp(k) : ''}" data-h-resp="${k}" data-h-punto="${esc(p.codigo)}">${n}</button>`).join('')}</div>
      </div>`;
    }
    let input;
    if (p.tipo === 'numero') input = `<input inputmode="decimal" autocomplete="off" ${dis} value="${esc(coma(v))}" data-h-punto="${esc(p.codigo)}" data-h-k="v" data-h-num>`;
    else if (p.tipo === 'fecha') input = `<input type="date" ${dis} value="${esc(String(v || '').slice(0, 10))}" data-h-punto="${esc(p.codigo)}" data-h-k="v">`;
    else if (p.tipo === 'lista') input = `<select ${dis} data-h-punto="${esc(p.codigo)}" data-h-k="v"><option value="">—</option>${(p.opciones || []).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else input = `<input autocomplete="off" ${dis} value="${esc(v ?? '')}" data-h-punto="${esc(p.codigo)}" data-h-k="v">`;
    return `<label class="punto-dato">${esc(p.etiqueta)}${ob}${p.unidad ? ` <span class="tenue">(${esc(p.unidad)})</span>` : ''}${input}</label>`;
  }

  function pintarHoja() {
    const h = hoja;
    const f = h.f;
    const ed = f.editable;
    const fotosGuardadas = f.fotos.filter((x) => !h.quitar.has(x.i));
    const total = fotosGuardadas.length + h.nuevas.length;
    const q = new URLSearchParams(h.ref);
    $app.innerHTML = `
      <button class="volver" data-cx="volver-equipo">‹ ${esc(ficha ? ficha.equipo.tag : 'Equipo')}</button>
      <section class="cabeza-ficha">
        <h2>${esc(f.plantilla.nombre)}</h2>
        <div class="sub">${esc([f.titulo, `Plantilla ${f.plantilla.codigo} v${f.plantilla.version || 1}`].join(' · '))}</div>
        <div class="chips">${chipFicha(f.estado, f.resultado)}${f.medidos ? ` <span class="chip neutra">${f.medidos.rellenos}/${f.medidos.obligatorios} datos</span>` : ''}</div>
      </section>
      ${ed ? '' : `<p class="nota aviso">${f.firmada ? 'La ficha está firmada: ya no se cambia.' : 'Tu rol puede ver la ficha, pero no rellenarla.'}</p>`}
      <h2>El ensayo</h2>
      <section class="grupo hoja-campos">
        <label class="punto-dato">Fecha del ensayo<input type="date" ${ed ? '' : 'disabled'} value="${esc(cabDe('fechaEnsayo') || '')}" data-h-cab="fechaEnsayo"></label>
        <label class="punto-dato">Realizado por<input autocomplete="name" ${ed ? '' : 'disabled'} value="${esc(cabDe('realizadoPor') || '')}" data-h-cab="realizadoPor"></label>
      </section>
      ${f.secciones.filter((s) => s.tipo !== 'fotos').map((s) => {
        if (s.tipo === 'bocas') {
          return `<h2>${esc(s.titulo)}</h2><p class="nota">Las bocas se miden en la ficha del equipo (boca a boca sobre su plano) y salen en el informe del balanceo.</p>`;
        }
        if (!s.puntos.length) return '';
        return `<h2>${esc(s.titulo)}</h2><section class="grupo hoja-campos">${s.puntos.map((p) => campoPunto(s, p, ed)).join('')}</section>`;
      }).join('')}
      <h2>Observaciones</h2>
      <textarea rows="4" ${ed ? '' : 'disabled'} data-h-obs placeholder="Lo que haya que contar (obligatorio si algo sale «No»)">${esc(h.observaciones !== undefined ? h.observaciones : f.observaciones || '')}</textarea>
      <h2>Fotos <span class="cuenta">${total}/8</span></h2>
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
      ${f.faltan.length ? `<h2>Lo que falta <span class="cuenta">${f.faltan.length}</span></h2><ul class="faltan-hoja">${f.faltan.slice(0, 30).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${f.avisos.length ? `<p class="nota aviso">${esc(f.avisos.join(' · '))}</p>` : ''}
      <div class="barra-hoja">
        ${ed ? `<button class="boton grande" data-cx="guardar-hoja" ${h.cambiada ? '' : 'disabled'}>Guardar</button>` : ''}
        <button class="boton grande secundario" data-cx="pdf-hoja"><i class="ic ic-doc"></i>Informe PDF</button>
      </div>`;
    C.cargarImagenes($app);
  }

  function marcarCambiada() {
    if (hoja.cambiada) return;
    hoja.cambiada = true;
    const b = $app.querySelector('[data-cx="guardar-hoja"]');
    if (b) b.disabled = false;
  }

  function anotar(el) {
    const h = hoja;
    if (!h) return;
    if (el.dataset.hCab) h.cabecera[el.dataset.hCab] = el.value;
    else if (el.hasAttribute('data-h-obs')) h.observaciones = el.value;
    else if (el.dataset.hPie !== undefined) { const x = h.nuevas[Number(el.dataset.hPie)]; if (x) x.pie = el.value; }
    else if (el.dataset.hPunto) {
      const k = el.dataset.hK;
      let v = el.value;
      if (k !== 'v' || el.hasAttribute('data-h-num')) {
        const n = num(v);
        if (Number.isNaN(n)) { el.classList.add('mal'); return; }
        el.classList.remove('mal');
        v = n;
      } else if (v === '') v = null;
      h.valores[el.dataset.hPunto] = { ...(h.valores[el.dataset.hPunto] || {}), [k]: v };
    } else return;
    marcarCambiada();
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

  async function guardarHoja(boton) {
    const h = hoja;
    if (!h || !h.cambiada) return true;
    if (boton) boton.disabled = true;
    try {
      /* Los datos sueltos van con `v`; los de parámetros con p/f/m. */
      const valores = {};
      for (const [codigo, c] of Object.entries(h.valores)) {
        if ('v' in c) valores[codigo] = c.v === null || c.v === '' ? null : { v: c.v };
        else valores[codigo] = c;
      }
      const r = await C.postJson('api/ficha', {
        obraId: h.ref.obra, clave: h.ref.clave, plantilla: h.ref.plantilla,
        cabecera: h.cabecera, valores, observaciones: h.observaciones,
        fotosNuevas: h.nuevas.map((x) => ({ id: x.id, pie: x.pie, hora: x.hora })),
        quitarFotos: [...h.quitar],
      });
      if (!r.ok) throw new Error(r.error);
      for (const x of h.nuevas) URL.revokeObjectURL(x.url);
      hoja = { ...h, f: r, valores: {}, cabecera: {}, observaciones: undefined, nuevas: [], quitar: new Set(), cambiada: false };
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

  const compartirPdf = (...a) => C.compartirPdf(...a);

  async function pdfHoja(boton) {
    if (hoja.cambiada && hoja.f.editable && !(await guardarHoja())) return;
    const tag = ficha ? ficha.equipo.tag : hoja.f.titulo;
    await compartirPdf(`api/informe?${new URLSearchParams({ tipo: 'ficha', ...hoja.ref })}`, `${tag} - ${hoja.f.plantilla.nombre}.pdf`, boton);
  }

  function salirHoja() {
    if (hoja && hoja.cambiada && !window.confirm('Hay cambios sin guardar en la ficha. ¿Salir sin guardarlos?')) return;
    hoja = null;
    pintarFicha();
    if (!fichasEq && ficha) cargarFichas(ficha.equipo.id);
    window.scrollTo(0, 0);
  }

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
    else if (que === 'equipo') abrir(b.dataset.id);
    else if (que === 'ver-balanceo' && ficha) { pestanaEq = 'balanceo'; pintarFicha(); window.scrollTo(0, 0); }
    else if (que === 'ficha-equipo' && ficha) { document.body.classList.remove('sin-scroll'); pestanaEq = 'equipo'; pintarFicha(); window.scrollTo(0, 0); }
    else if (que === 'hoja') abrirHoja(Number(b.dataset.i));
    else if (que === 'volver-equipo') salirHoja();
    else if (que === 'foto') fotoHoja(b.dataset.camara === '1');
    else if (que === 'quitar-foto' && hoja) { hoja.quitar.add(Number(b.dataset.i)); hoja.cambiada = true; pintarHoja(); }
    else if (que === 'quitar-nueva' && hoja) { const [x] = hoja.nuevas.splice(Number(b.dataset.i), 1); if (x) URL.revokeObjectURL(x.url); pintarHoja(); }
    else if (que === 'guardar-hoja') guardarHoja(b);
    else if (que === 'pdf-hoja') pdfHoja(b);
    else if (que === 'balometro' && ficha) cambiarMetodo(b);
    else if (que === 'ir-boca' && ficha) irABoca(b.dataset.boca);
    else if (que === 'plano-grande' && ficha) planoGrande(b);
    else if (que === 'foto-equipo') fotoEquipo(b);
    else if (que === 'quitar-foto-equipo') quitarFotoEquipo(b);
    else if (que === 'nube-entrar' && window.cxObra && window.cxObra.sync) window.cxObra.sync.entrar().then((ok) => { if (ok && ficha) abrir(ficha.equipo.id, { quieto: true }); });
    else if (que === 'nube-ahora' && window.cxObra && window.cxObra.sync) { b.disabled = true; window.cxObra.sync.ahora().finally(() => { if (ficha) abrir(ficha.equipo.id, { quieto: true }); }); }
    else if (que === 'pdf-balanceo' && ficha) compartirPdf(`api/informe?tipo=balanceo&equipo=${encodeURIComponent(ficha.equipo.id)}`, `${ficha.equipo.tag} - balanceo.pdf`, b);
  });
  /* Sí / No / N/A: un toque marca, otro toque en la misma desmarca. */
  $app.addEventListener('click', (ev) => {
    if (!activa() || !hoja) return;
    const b = ev.target.closest('[data-h-resp]');
    if (!b || b.disabled) return;
    const p = b.dataset.hPunto;
    const guardado = (hoja.f.secciones.flatMap((s) => s.puntos).find((x) => x.codigo === p) || {}).valor;
    const actual = hoja.valores[p] && 'v' in hoja.valores[p] ? hoja.valores[p].v : guardado;
    const nuevo = actual === b.dataset.hResp ? null : b.dataset.hResp;
    hoja.valores[p] = { v: nuevo };
    for (const x of b.parentElement.children) x.className = '';
    if (nuevo) b.className = `activa ${nuevo === 'no' || nuevo === 'noOk' ? 'mal' : nuevo === 'na' ? 'neutra' : 'bien'}`;
    if (!hoja.cambiada) { hoja.cambiada = true; const g = $app.querySelector('[data-cx="guardar-hoja"]'); if (g) g.disabled = false; }
  });
  $app.addEventListener('change', (ev) => { if (activa() && hoja) anotar(ev.target); });
  $app.addEventListener('input', (ev) => {
    if (activa() && hoja) { anotar(ev.target); return; }
    if (activa() && ev.target.dataset && ev.target.dataset.punto) { const li = ev.target.closest('li[data-boca]'); if (li) vivoBoca(li); return; }
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
    const ins = casillas(li);
    const i = ins.indexOf(ev.target);
    if (i < ins.length - 1) { ins[i + 1].focus(); return; }
    saltando = true;
    if (cambiada(li)) medir(li, 'siguiente');
    else {
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
    if (!cambiada(li)) return;
    const r = ev.relatedTarget && ev.relatedTarget.dataset && ev.relatedTarget.dataset.punto ? ev.relatedTarget.dataset : null;
    medir(li, r ? { plano: r.plano, punto: r.punto, m: r.m } : null);
  });

  window.addEventListener('movil:obra', () => { if (activa()) cargarLista(); });
  window.addEventListener('hashchange', (ev) => {
    if (!activa()) return;
    /* Ha llegado algo de la oficina con un equipo abierto: se repinta ese equipo, no la lista. */
    if (ev.cxDatos && ficha) { if (!hoja) abrir(ficha.equipo.id, { quieto: true }); return; }
    cargarLista();
  });
  if (activa()) cargarLista();
})();
