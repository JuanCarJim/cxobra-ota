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

  /* Segmentos por estado: lo que resume (las cifras) arriba y siempre a la vista. */
  const SEGMENTOS = [
    ['todos', 'Todos', () => true],
    ['faltaDoc', 'Falta doc.', (e) => !e.completo && e.envio === 'faltaDocumentacion'],
    ['faltaEnsayo', 'Falta ensayo', (e) => !e.completo && e.envio === 'faltaEnsayo'],
    ['completos', 'Completos', (e) => e.completo || e.envio === 'lista' || e.envio === 'enviada'],
  ];
  let segmento = 'todos';
  const porPlanta = (a, b) => (a === 'Sin planta') - (b === 'Sin planta') || a.localeCompare(b, 'es', { numeric: true });

  function pintarLista() {
    const t = lista.totales || {};
    const q = filtro.trim().toLowerCase();
    const todos = lista.equipos || [];
    const [, , pasa] = SEGMENTOS.find(([id]) => id === segmento) || SEGMENTOS[0];
    const equipos = todos.filter(pasa).filter((e) => !q || `${e.tag} ${e.planta || ''} ${e.marca || ''} ${e.modelo || ''}`.toLowerCase().includes(q));
    const plantas = [...new Set(equipos.map((e) => e.planta || 'Sin planta'))].sort(porPlanta);
    $app.innerHTML = `
      <div class="resumen-fila">
        <div><b>${cifra(t.equipos)}</b><span>equipos</span></div>
        <div><b>${cifra(t.completos)}</b><span>completos</span></div>
        <div class="${t.faltaDocumentacion ? 'aviso' : ''}"><b>${cifra(t.faltaDocumentacion)}</b><span>falta doc.</span></div>
        <div class="${t.faltaEnsayo ? 'aviso' : ''}"><b>${cifra(t.faltaEnsayo)}</b><span>falta ensayo</span></div>
      </div>
      <div class="segmentado" role="tablist">${SEGMENTOS.map(([id, n, f]) => `<button role="tab" data-cx-seg="${id}" class="${segmento === id ? 'activa' : ''}" aria-selected="${segmento === id}">${esc(n)} <small>${cifra(todos.filter(f).length)}</small></button>`).join('')}</div>
      <input type="search" class="buscar" placeholder="Buscar TAG, planta o modelo" value="${esc(filtro)}" data-cx-buscar>
      ${equipos.length ? C.listaAgrupada('cx-equipos', equipos, {
        grupo: (e) => e.planta || 'Sin planta', orden: plantas, buscando: !!q, repintar: pintarLista,
        fila: (e) => `
        <li><button class="fila-ios" data-cx="equipo" data-id="${esc(e.id)}">
          <div class="fila-principal">
            <strong class="cifra">${esc(e.tag)}</strong>
            ${chipEnvio(e.envio, e.completo)}
          </div>
          <div class="sub">${esc([e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Sin datos')}</div>
          ${e.bocas ? `<div class="progreso" aria-label="${e.medidas} de ${e.bocas} bocas medidas"><i style="width:${Math.round((e.medidas / e.bocas) * 100)}%"></i></div>
          <div class="sub">${cifra(e.medidas)} de ${cifra(e.bocas)} bocas medidas</div>` : '<div class="sub">Sin plano de bocas</div>'}
          ${e.falta && e.falta.length && !e.completo ? `<div class="sub aviso">Falta: ${esc(e.falta.join(', '))}</div>` : ''}
        </button></li>` }) : `<p class="vacio">${q || segmento !== 'todos' ? 'Ningún equipo con ese filtro.' : 'Esta obra no tiene equipos dados de alta.'}</p>`}`;
  }

  /* ═══════════════════════════════════ 2. La ficha */

  async function abrir(id) {
    $app.innerHTML = '<p class="cargando">Cargando el equipo…</p>';
    try {
      const r = await C.pedir(`api/equipo?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      ficha = r;
      hoja = null;
      fichasEq = null;
      pintarFicha();
      window.scrollTo(0, 0);
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
      const caja = document.getElementById('fichas-equipo');
      if (caja) caja.outerHTML = htmlFichas();
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

  function checklist(k) {
    if (!k) return '';
    const si = (v) => (v ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');
    const ensayo = k.ensayoRequerido === 'ninguno' || !k.ensayoRequerido ? '<span class="tenue">No hace falta</span>' : si(k.ensayo);
    return `<h2>Checklist</h2>
      <section class="grupo">
        <div class="fila-dato"><span>Ficha técnica</span>${si(k.ft)}</div>
        <div class="fila-dato"><span>Certificado CE</span>${si(k.ce)}</div>
        <div class="fila-dato"><span>Manual</span>${si(k.manual)}</div>
        <div class="fila-dato"><span>Ficha PM</span>${si(k.fichaPM)}</div>
        <div class="fila-dato"><span>Ensayo</span>${ensayo}</div>
        <div class="fila-dato"><span>Balanceo</span><strong>${esc(k.balanceoEstado || '—')}</strong></div>
        ${k.estanqueidad ? `<div class="fila-dato"><span>Estanqueidad</span><strong>${esc(typeof k.estanqueidad === 'object' ? (k.estanqueidad.resultado || k.estanqueidad.estado || '✓') : k.estanqueidad)}</strong></div>` : ''}
        <div class="fila-dato"><span>Puesta en marcha</span><strong>${esc(k.estadoPM || '—')}</strong></div>
      </section>
      ${(k.incidencias || []).length ? `<p class="nota aviso">${esc(k.incidencias.map((i) => INCIDENCIA[i] || i).join(' · '))}</p>` : ''}`;
  }

  function pintarFicha() {
    const f = ficha;
    const e = f.equipo;
    const puede = f.puedeMedir;
    $app.innerHTML = `
      <button class="volver" data-cx="lista">‹ Equipos</button>
      <section class="cabeza-ficha">
        <h2 class="cifra">${esc(e.tag)}</h2>
        <div class="sub">${esc([e.planta, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</div>
      </section>
      ${htmlFotosEquipo(f, puede)}
      ${totalCircuito(f.circuitos && f.circuitos.impulsion, 'Impulsión')}
      ${totalCircuito(f.circuitos && f.circuitos.retorno, 'Retorno')}
      ${f.planos.length ? f.planos.map((p) => `
        <h2>${esc(p.nombre)} <span class="cuenta">${p.bocas.length} bocas</span></h2>
        <ul class="bocas">${p.bocas.map((b) => htmlBoca(p, b, puede, f.tolerancias)).join('')}</ul>`).join('') : '<p class="vacio">Este equipo no tiene plano de bocas: se dibuja en el ordenador (Commissioning › Balanceo).</p>'}
      ${puede ? '' : '<p class="nota">Tu rol puede ver las medidas, pero no tomarlas.</p>'}
      ${f.planos.length ? '<button class="boton secundario" data-cx="pdf-balanceo"><i class="ic ic-doc"></i>Informe del balanceo (PDF)</button>' : ''}
      ${htmlFichas()}
      ${checklist(f.checklist)}`;
    C.cargarImagenes($app);
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
    return `<li class="boca ${clase}" data-boca="${esc(clave)}">
      <div class="boca-cabeza"><strong>${esc(b.nombre)}</strong><span class="sub">${esc(b.circuito === 'retorno' ? 'Retorno' : 'Impulsión')} · ${esc(b.tipo || '')}</span>
        ${puede ? `<button class="interruptor${bal ? ' activo' : ''}" data-cx="balometro" ${datos} aria-pressed="${bal}">Balómetro</button>` : ''}</div>
      ${bal
        ? `<label class="q-balometro">Q balómetro (m³/h)
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-q="1"
              value="${b.caudalMedido === null || b.caudalMedido === undefined ? '' : comaD(b.caudalMedido, 1)}" aria-label="Caudal del balómetro en ${esc(b.nombre)}"></label>`
        : `<div class="lecturas">${[0, 1, 2, 3].map((i) => `<label>M${i + 1}
            <input inputmode="decimal" enterkeyhint="next" autocomplete="off" ${dis} ${datos} data-m="${i}"
              value="${lect[i] === undefined ? '' : comaD(lect[i])}" aria-label="Lectura M${i + 1} en ${esc(b.nombre)}"></label>`).join('')}</div>`}
      ${formula}
      <div class="boca-cifras">
        <div><span>Q medido</span><b>${cifra(b.caudal)}</b></div>
        <div><span>Q proyecto</span><b>${cifra(b.caudalDiseno)}</b></div>
        <div><span>Desviación</span><b>${b.desviacion === null || b.desviacion === undefined ? '—' : `${b.desviacion > 0 ? '+' : ''}${comaD(b.desviacion * 100, 1)} %`}</b></div>
        <div class="porc"><span class="chip ${clase}">${porc === null ? esc(nombre) : `${porc} %`}</span></div>
      </div>
      ${fuera ? `<p class="nota aviso">Fuera de ±${tolB} %: hay que regular esta boca.</p>` : ''}
    </li>`;
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

  function htmlFichas() {
    if (!fichasEq) return '<section id="fichas-equipo"><h2>Fichas del equipo</h2><p class="cargando">Cargando las fichas…</p></section>';
    if (fichasEq.ok === false) return `<section id="fichas-equipo"><h2>Fichas del equipo</h2><p class="nota aviso">${esc(fichasEq.error)}</p></section>`;
    const fs = fichasEq.fichas || [];
    return `<section id="fichas-equipo">
      <h2>Fichas del equipo <span class="cuenta">${fs.length}</span></h2>
      ${fs.length ? `<ul class="lista-ios">${fs.map((x, i) => (!x.plantilla ? `
        <li><div class="fila-ios apagada">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span class="chip neutra">Sin plantilla</span></div>
          <div class="sub">${esc(x.motivo || 'Falta elegir la plantilla')} Se elige en el ordenador (Puesta en marcha).</div>
        </div></li>` : `
        <li><button class="fila-ios" data-cx="hoja" data-i="${i}">
          <div class="fila-principal"><strong>${esc(x.nombre)}</strong><span>${chipFicha(x.estado, x.resultado)}</span></div>
          <div class="sub">${esc([CLASE_FICHA[x.clase] || x.clase, x.motivo, x.medidos ? `${x.medidos.rellenos} de ${x.medidos.obligatorios} datos` : null, x.fotos ? `${x.fotos} foto${x.fotos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))}</div>
        </button></li>`)).join('')}</ul>` : '<p class="vacio">Este equipo no tiene familia asignada: se le pone en el ordenador (Puesta en marcha).</p>'}
    </section>`;
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
    if (sg) { segmento = sg.dataset.cxSeg; C.reiniciarLista('cx-equipos'); pintarLista(); return; }
    const b = ev.target.closest('[data-cx]');
    if (!b) return;
    const que = b.dataset.cx;
    if (que === 'lista') cargarLista();
    else if (que === 'equipo') abrir(b.dataset.id);
    else if (que === 'hoja') abrirHoja(Number(b.dataset.i));
    else if (que === 'volver-equipo') salirHoja();
    else if (que === 'foto') fotoHoja(b.dataset.camara === '1');
    else if (que === 'quitar-foto' && hoja) { hoja.quitar.add(Number(b.dataset.i)); hoja.cambiada = true; pintarHoja(); }
    else if (que === 'quitar-nueva' && hoja) { const [x] = hoja.nuevas.splice(Number(b.dataset.i), 1); if (x) URL.revokeObjectURL(x.url); pintarHoja(); }
    else if (que === 'guardar-hoja') guardarHoja(b);
    else if (que === 'pdf-hoja') pdfHoja(b);
    else if (que === 'balometro' && ficha) cambiarMetodo(b);
    else if (que === 'foto-equipo') fotoEquipo(b);
    else if (que === 'quitar-foto-equipo') quitarFotoEquipo(b);
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
  window.addEventListener('hashchange', () => { if (activa()) cargarLista(); });
  if (activa()) cargarLista();
})();
