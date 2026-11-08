/*
 * «+ BOCA» EN LA HOJA DE BALANCEO DEL MÓVIL (30-oct-2026, JC desde Nou Camp
 * Nou: «En los balanceos de caudales necesito en el móvil poder poner yo
 * rejas o difusores manualmente por si el programa se deja alguno»).
 *
 * Debajo de la lista de Impulsión y de la de Retorno, «+ Boca». Se abre a
 * pantalla completa: con plano, se toca donde está la reja o el difusor (dos
 * dedos acercan y alejan) y queda colocada; sin plano, «Sin posición». Debajo,
 * sus datos: sistema, difusor o reja, modelo (los de esa hoja o uno escrito),
 * medidas, caudal de proyecto, sala y nota. La boca entra en las sumas y en
 * el recuento como las demás, con la marca «añadida en obra»; se cambia y se
 * quita desde su fila («Cambiar»). La regla es de
 * shared/commissioning/bocaManual.js; las rutas, electron/movil/rutasBocaManual.js.
 *
 * Commissioning (commissioning.js) solo pinta el botón y la marca, y engancha
 * aquí la ficha abierta: `BOCA_MANUAL_MOVIL.enganchar({ ficha, poner })`.
 */
(function bocaManualMovil() {
  const C = window.CX;
  const AG = window.AUTOGUARDADO || null;
  const COLA = window.COLA_GUARDADO || null;
  const esc = (v) => (C && C.esc ? C.esc(v) : String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`));
  let gancho = { ficha: () => null, poner: () => {} };
  let capa = null;     /* el panel abierto */
  let estado = null;   /* lo que se está apuntando */

  const SISTEMAS = [['impulsion', 'Impulsión'], ['retorno', 'Retorno'], ['extraccion', 'Extracción']];
  const CLASES = [['difusor', 'Difusor'], ['reja', 'Reja']];
  const nuevoId = () => `bm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const coma = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));

  /** El botón, debajo de la lista del circuito que se ve. `circ` = 'impulsion' | 'retorno' | null (un solo circuito). */
  function boton(f, circ, nombreRet, puede) {
    if (!f) return '';
    const sp = sinPosicion(f, circ || null, puede);
    if (!puede) return sp;
    const ret = circ === 'retorno' || (!circ && f.planos.flatMap((p) => p.bocas).length && f.planos.flatMap((p) => p.bocas).every((b) => b.circuito === 'retorno'));
    const sistema = ret ? (/extrac/i.test(nombreRet || '') ? 'extraccion' : 'retorno') : 'impulsion';
    const rotulo = ret ? (nombreRet || 'Retorno').toLowerCase() : 'impulsión';
    return `<div class="bm-barra"><button class="bm-mas" data-bm="nueva" data-sistema="${sistema}">+ Boca <span>de ${esc(rotulo)}</span></button>
      <span class="bm-ayuda">Si el plano se ha dejado una reja o un difusor, añádela aquí.</span></div>${sp}`;
  }

  /** La marca de la fila de una boca añadida en obra, con su «Cambiar». */
  function marca(p, b, puede) {
    if (!b || !b.manual) return '';
    return `<span class="marca-manual">añadida en obra${b.manual.modelo ? ` · ${esc(b.manual.modelo)}` : ''}</span>${b.manual.posibleDuplicado ? `<span class="marca-revisar">${esc(b.manual.posibleDuplicado)}</span>` : ''}${puede ? `<button class="enlace bm-cambiar" data-bm="editar" data-plano="${esc(p.id)}" data-punto="${esc(b.id)}">Cambiar</button>` : ''}`;
  }

  /*
   * EL MODELO Y LAS MEDIDAS DE CUALQUIER BOCA Y DE DÓNDE SALE SU AK (30-oct-2026,
   * JC sobre R1 de HUB 01: «esa reja es de 10×40»; «que en todas las tomas de
   * rejas rectangulares y difusores lineales podamos poner sus medidas a mano»;
   * «el modelo de difusor rotacional también influye en las mediciones»).
   * Debajo de la cuenta: L × H (rejas) o longitud (lineales), editables ahí
   * mismo; «Modelo…» abre la cascada marca → modelo → variante → tamaño y el Ak
   * a mano con su fuente. Lo del plano queda como referencia. Las lecturas no
   * se tocan: solo cambia el Ak y con él el caudal.
   */
  let catalogo = null;          /* la cascada (api/boca-medidas/catalogo), una vez */
  let editor = null;            /* { clave, tipo, tamano, largo, alto, ak, akFuente, todas } */
  const claveDe = (p, b) => `${p.id}|${b.id}`;

  function medidas(p, b, puede) {
    if (!b) return '';
    const obra = b.textoObra ? `<span class="marca-manual">${esc(b.textoObra)}</span>` : '';
    const ak = b.akOrigen ? `<p class="bm-akboca${b.factor ? '' : ' sin'}">${esc(b.akOrigen)}</p>` : '';
    const dis = puede ? '' : 'disabled';
    const casilla = (k, rot, v, ancho) => `<label>${rot} <input inputmode="numeric" enterkeyhint="done" autocomplete="off" ${dis} data-bmm="${k}"
      value="${v ? esc(v) : ''}" aria-label="${rot} de ${esc(b.nombre)} en mm"${ancho ? ' class="ancho"' : ''}></label>`;
    const forma = b.forma || (b.medidasLA === false ? 'nominal' : 'largoAlto');
    const fila = forma === 'largoAlto' ? `${casilla('largo', 'L', b.largo)}<span>×</span>${casilla('alto', 'H', b.alto)}<span>mm</span>`
      : forma === 'lineal' ? `${casilla('tamano', 'Longitud', b.tamano, true)}<span>mm</span>` : `<span>${esc(b.tamano || '—')}</span>`;
    const abierto = editor && editor.clave === claveDe(p, b);
    return `<div class="bm-medidas" data-plano="${esc(p.id)}" data-punto="${esc(b.id)}" data-tipo="${esc(b.tipoId || '')}">
      <div class="bm-medidas-fila"><span>Medidas</span>${fila}${obra}
        ${puede ? `<button type="button" class="bm-medidas-guardar" data-bmm-guardar="1" hidden>Guardar medidas</button>
        <button type="button" class="enlace bm-modelo-abrir" data-bmm-modelo="1" aria-expanded="${abierto}">${abierto ? 'Cerrar modelo' : 'Modelo…'}</button>` : ''}</div>
      ${ak}${abierto ? htmlEditor(b) : ''}</div>`;
  }

  /* La cascada, con lo elegido (o lo de la boca). */
  function htmlEditor(b) {
    if (!catalogo) return '<p class="bm-akboca">Cargando modelos…</p>';
    const e = editor;
    const todas = catalogo.flatMap((m) => m.modelos.flatMap((mo) => mo.variantes.map((v) => ({ marca: m.marca, modelo: mo.modelo, ...v }))));
    const actual = todas.find((v) => v.id === e.tipo) || null;
    const marca = actual ? actual.marca : '';
    const modelos = (catalogo.find((m) => m.marca === marca) || { modelos: [] }).modelos;
    const variantes = (modelos.find((mo) => mo.modelo === (actual && actual.modelo)) || { variantes: [] }).variantes;
    const opc = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const tams = actual ? actual.tamanos : [];
    const claveTam = e.largo && e.alto ? `${e.largo}×${e.alto}` : e.tamano || '';
    return `<div class="bm-editor">
      ${actual ? '' : `<p class="bm-akboca sin">El modelo de esta boca (${esc(e.tipo || 'sin modelo')}) no está en el catálogo: elige uno.</p>`}
      <label class="bm-fila">Marca <select data-bme="marca"><option value="">—</option>${opc(catalogo.map((m) => [m.marca, m.marca]), marca)}</select></label>
      <label class="bm-fila">Modelo <select data-bme="modelo">${opc(modelos.map((mo) => [mo.modelo, mo.modelo]), actual && actual.modelo)}</select></label>
      <label class="bm-fila">Variante <select data-bme="tipo">${opc(variantes.map((v) => [v.id, v.variante]), e.tipo)}</select></label>
      ${tams.length ? `<label class="bm-fila">Tamaño de la ficha <select data-bme="tamFicha"><option value="">— a mano —</option>${opc(tams, claveTam)}</select></label>` : ''}
      ${actual && actual.forma === 'lineal' ? `<label class="bm-fila">Longitud (mm) <input inputmode="numeric" data-bme="tamano" value="${esc(e.tamano || '')}"></label>`
        : actual && actual.forma === 'nominal' ? '' : `<div class="bm-dos"><label class="bm-fila">Largo (mm) <input inputmode="numeric" data-bme="largo" value="${esc(e.largo || '')}"></label>
        <label class="bm-fila">Alto (mm) <input inputmode="numeric" data-bme="alto" value="${esc(e.alto || '')}"></label></div>`}
      <div class="bm-dos"><label class="bm-fila">Ak a mano (m²) <input inputmode="decimal" data-bme="ak" value="${esc(coma(e.ak))}" placeholder="de la ficha"></label>
        <label class="bm-fila">Fuente del Ak <input data-bme="akFuente" value="${esc(e.akFuente || '')}" placeholder="ficha y página"></label></div>
      <p class="bm-akboca">Si la ficha no trae esa medida, el Ak se queda sin dato y no hay caudal. Nunca se estima.</p>
      ${b.iguales > 1 ? `<label class="bm-todas"><input type="checkbox" data-bme="todas" ${e.todas ? 'checked' : ''}> Aplicar a las ${b.iguales} de este rótulo</label>` : ''}
      <button type="button" class="bm-medidas-guardar" data-bmm-modelo-guardar="1">Guardar modelo</button>
    </div>`;
  }

  async function abrirModelo(caja) {
    const f = gancho.ficha();
    const pl = f && f.planos.find((p) => p.id === caja.dataset.plano);
    const b = pl && pl.bocas.find((x) => x.id === caja.dataset.punto);
    if (!b) return;
    const clave = claveDe(pl, b);
    if (editor && editor.clave === clave) { editor = null; repintar(); return; }
    editor = { clave, tipo: b.tipoId, largo: b.largo, alto: b.alto, tamano: b.tamano, ak: b.akMano, akFuente: b.akFuente, todas: false };
    repintar();
    if (!catalogo) {
      try { const r = await C.pedir('api/boca-medidas/catalogo'); if (r && r.ok) catalogo = r.marcas; } catch { /* sin catálogo */ }
      if (!catalogo) { C.aviso('No se han podido cargar los modelos.'); editor = null; }
      repintar();
    }
  }
  function repintar() { const f = gancho.ficha(); if (f) gancho.poner(f); }

  function leerEditor(caja) {
    for (const i of caja.querySelectorAll('[data-bme]')) {
      const k = i.dataset.bme;
      if (k === 'todas') editor.todas = i.checked;
      else if (['largo', 'alto', 'tamano', 'ak', 'akFuente'].includes(k)) editor[k] = i.value.trim();
    }
  }

  function cambioEditor(sel) {
    const caja = sel.closest('.bm-medidas');
    leerEditor(caja);
    const k = sel.dataset.bme;
    const vs = (marca, modelo) => {
      const m = catalogo.find((x) => x.marca === marca);
      const mo = m && (modelo ? m.modelos.find((x) => x.modelo === modelo) : m.modelos[0]);
      return mo ? mo.variantes : [];
    };
    if (k === 'marca') { const v = vs(sel.value)[0]; if (v) editor.tipo = v.id; }
    else if (k === 'modelo') { const marca = caja.querySelector('[data-bme="marca"]').value; const v = vs(marca, sel.value)[0]; if (v) editor.tipo = v.id; }
    else if (k === 'tipo') editor.tipo = sel.value;
    else if (k === 'tamFicha') {
      const m = /^(\d+)×(\d+)$/.exec(sel.value);
      if (m) { editor.largo = m[1]; editor.alto = m[2]; editor.tamano = ''; } else if (sel.value) { editor.tamano = sel.value; editor.largo = ''; editor.alto = ''; }
    } else return;
    repintar();
  }

  async function guardarModelo(btn) {
    const caja = btn.closest('.bm-medidas');
    leerEditor(caja);
    const e = editor;
    const c = { planoId: caja.dataset.plano, puntoId: caja.dataset.punto, tipo: e.tipo, largo: e.largo || '', alto: e.alto || '', tamano: e.tamano || '', ak: e.ak || '', akFuente: e.akFuente || '', todas: Boolean(e.todas) };
    btn.disabled = true;
    const r = await mandar('api/boca-medidas', c, `bocaManual.medidas.${c.planoId}.${c.puntoId}`);
    btn.disabled = false;
    if (r.enCola) { editor = null; return; }
    if (!r.ok) { C.aviso(r.error || 'No se ha podido guardar el modelo.'); return; }
    editor = null;
    gancho.poner(r);
    const sin = /^Ak sin dato/.test(r.akOrigen || '');
    C.aviso([sin ? 'Modelo guardado. Ak sin dato para esa medida: sin caudal.' : `Modelo guardado. ${String(r.akOrigen || '').split(' (')[0]}.`, ...(r.avisos || [])].join(' '), sin ? 'info' : 'bien');
  }

  async function guardarMedidas(btn) {
    const caja = btn.closest('.bm-medidas');
    const val = (k) => { const i = caja.querySelector(`input[data-bmm="${k}"]`); return i ? i.value.trim() : undefined; };
    const c = { planoId: caja.dataset.plano, puntoId: caja.dataset.punto };
    for (const k of ['largo', 'alto', 'tamano']) if (val(k) !== undefined) c[k] = val(k);
    btn.disabled = true;
    const r = await mandar('api/boca-medidas', c, `bocaManual.medidas.${c.planoId}.${c.puntoId}`);
    btn.disabled = false;
    if (r.enCola) { btn.hidden = true; return; }
    if (!r.ok) { C.aviso(r.error || 'No se han podido guardar las medidas.'); return; }
    gancho.poner(r);
    const sin = /^Ak sin dato/.test(r.akOrigen || '');
    const que = c.tamano !== undefined ? `Longitud ${c.tamano} mm` : `Medidas ${c.largo}×${c.alto}`;
    C.aviso([sin ? `${que} guardada${c.tamano !== undefined ? '' : 's'}. Ak sin dato para ese tamaño: sin caudal.` : `Medidas guardadas. ${String(r.akOrigen || '').split(' (')[0]}.`, ...(r.avisos || [])].join(' '), sin ? 'info' : 'bien');
  }

  /*
   * LAS BOCAS SIN POSICIÓN (30-oct): las que tienen lecturas pero no sitio en
   * el plano (D27 de HUB 01). Se ven en una lista y se colocan tocando.
   */
  function sinPosicion(f, circ, puede) {
    if (!f) return '';
    const lista = [];
    for (const p of f.planos || []) for (const b of p.bocas || []) {
      if (!b.sinPosicion || (circ && b.circuito && b.circuito !== circ)) continue;
      lista.push({ p, b });
    }
    if (!lista.length) return '';
    const conDibujo = planosConDibujo(f).length > 0;
    return `<div class="bm-sinpos"><h4>Sin posición <span>${lista.length}</span></h4><ul>${lista.map(({ p, b }) => `<li>
      <strong>${esc(b.nombre)}</strong> <span>${esc(b.tipo || '')}${b.largo && b.alto ? ` · ${b.largo}×${b.alto}` : b.tamano ? ` · ${esc(b.tamano)}` : ''}${b.velocidad !== null && b.velocidad !== undefined ? ` · ${coma(b.velocidad)} m/s` : ''}</span>
      ${puede && conDibujo ? `<button type="button" class="enlace" data-bm="colocar" data-plano="${esc(p.id)}" data-punto="${esc(b.id)}">Colocar en el plano</button>` : ''}</li>`).join('')}</ul></div>`;
  }

  /* ───────────────────────────────────────────── el panel */

  function planosConDibujo(f) { return (f.planos || []).filter((p) => p.imagen); }

  async function abrir({ sistema = 'impulsion', planoId = null, puntoId = null, colocar = false } = {}) {
    const f = gancho.ficha();
    if (!f) return;
    const conDibujo = planosConDibujo(f);
    let boca = null;
    if (puntoId) {
      const pl = f.planos.find((p) => p.id === planoId);
      boca = pl && pl.bocas.find((b) => b.id === puntoId);
      if (!boca || (!boca.manual && !colocar)) { C.aviso('Esa boca no es de las añadidas en obra.'); return; }
    }
    const m = boca ? boca.manual : {};
    /* El plano por defecto: el de la boca; si no, el primero con dibujo que tenga bocas de ese circuito. */
    const circ = sistema === 'impulsion' ? 'impulsion' : 'retorno';
    const elegido = boca ? f.planos.find((p) => p.id === planoId)
      : conDibujo.find((p) => p.bocas.some((b) => b.circuito === circ)) || conDibujo[0] || null;
    estado = {
      equipoId: f.equipo.id, puntoId: boca ? boca.id : null, nombre: boca ? boca.nombre : null,
      planoId: elegido ? elegido.id : (f.planos[0] ? f.planos[0].id : null),
      x: boca && boca.x !== null ? boca.x : null, y: boca && boca.y !== null ? boca.y : null,
      sinPosicion: boca ? Boolean(boca.sinPosicion || boca.x === null) : !elegido || !elegido.imagen,
      sistema: boca ? m.sistema || (boca.circuito === 'retorno' ? 'retorno' : 'impulsion') : sistema,
      clase: m.clase || (sistema === 'impulsion' ? 'difusor' : 'reja'),
      modelo: m.modelo || '', largo: m.largo || '', alto: m.alto || '', sala: m.sala || '',
      caudalProyecto: boca && boca.caudalDiseno !== null && boca.caudalDiseno !== undefined ? boca.caudalDiseno : '',
      nota: m.nota || '', lecturas: boca ? tieneLecturas(boca) : false,
      modelos: [], vista: { s: 1, x: 0, y: 0 },
      /* Solo ponerla en el plano (una boca «sin posición», manual o no). */
      colocar: Boolean(colocar),
    };
    if (colocar) {
      if (!elegido || !elegido.imagen) { estado = null; C.aviso('Ese plano no tiene dibujo: no se puede colocar.'); return; }
      Object.assign(estado, { sinPosicion: false, x: null, y: null });
      pintar();
      return;
    }
    pintar();
    try {
      const r = await C.pedir(`api/boca-manual/modelos?equipo=${encodeURIComponent(f.equipo.id)}`);
      if (r && r.ok && estado) { estado.modelos = r.modelos || []; pintarModelos(); }
    } catch { /* sin modelos: se escribe */ }
  }

  function tieneLecturas(b) {
    return (b.lecturas && b.lecturas.length) || (b.lecturasCaudal && b.lecturasCaudal.length)
      || [b.velocidad, b.caudalMedido, b.tFrio, b.tCalor, b.temperatura].some((v) => v !== null && v !== undefined);
  }

  function cerrar() {
    if (capa) capa.remove();
    capa = null; estado = null;
    document.body.classList.remove('bm-abierta');
  }

  function pintar() {
    const f = gancho.ficha();
    const s = estado;
    const plano = f.planos.find((p) => p.id === s.planoId);
    const conDibujo = planosConDibujo(f);
    const verPlano = plano && plano.imagen && !s.sinPosicion;
    if (!capa) { capa = document.createElement('div'); capa.className = 'bm-capa'; capa.setAttribute('role', 'dialog'); document.body.appendChild(capa); document.body.classList.add('bm-abierta'); }
    const seg = (campo, opciones) => `<div class="segmentado bm-seg" role="radiogroup">${opciones.map(([id, n]) => `<button type="button" role="radio" data-bm="campo" data-campo="${campo}" data-valor="${id}" aria-checked="${s[campo] === id}" class="${s[campo] === id ? 'activa' : ''}">${n}</button>`).join('')}</div>`;
    capa.innerHTML = `
      <header class="bm-cabeza">
        <button class="enlace" data-bm="cancelar">Cancelar</button>
        <strong>${s.colocar ? `Colocar ${esc(s.nombre)}` : s.puntoId ? `Cambiar ${esc(s.nombre)}` : 'Nueva boca'}</strong>
        <button class="bm-guardar" data-bm="guardar">Guardar</button>
      </header>
      ${conDibujo.length && !s.colocar ? `<div class="bm-plano-barra">
        ${conDibujo.length > 1 ? `<select data-bm-campo="planoId" aria-label="Plano">${conDibujo.map((p) => `<option value="${esc(p.id)}" ${p.id === s.planoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>` : `<span class="bm-plano-nombre">${esc(plano ? plano.nombre : conDibujo[0].nombre)}</span>`}
        <button class="enlace" data-bm="sin-posicion">${s.sinPosicion ? 'Ponerla en el plano' : 'Sin posición'}</button>
      </div>` : ''}
      ${verPlano ? `<p class="bm-pista">${s.x === null ? 'Toca en el plano donde está la boca. Dos dedos para acercar.' : 'Colocada. Toca otro sitio para moverla.'}</p>
      <div class="bm-marco"><div class="bm-lienzo">
        <img data-src="api/equipo/plano?id=${encodeURIComponent(plano.id)}" alt="Plano ${esc(plano.nombre)}" draggable="false">
        ${(plano.bocas || []).filter((b) => b.x !== null && b.x !== undefined && b.id !== s.puntoId).map((b) => `<span class="bm-otra${b.circuito === 'retorno' ? ' ret' : ''}" style="left:${(b.x * 100).toFixed(2)}%;top:${(b.y * 100).toFixed(2)}%"><i></i>${esc(b.nombre)}</span>`).join('')}
        ${s.x !== null ? `<span class="bm-nueva" style="left:${(s.x * 100).toFixed(2)}%;top:${(s.y * 100).toFixed(2)}%"><i></i>${esc(s.nombre || 'nueva')}</span>` : ''}
      </div></div>` : `<p class="bm-pista">${conDibujo.length ? 'Sin posición: se añade a la lista y no sale en el plano.' : 'Este equipo no tiene plano con dibujo: se añade a la lista, sin posición.'}</p>`}
      ${s.colocar ? '' : `<div class="bm-datos">
        <label class="bm-fila">Sistema ${seg('sistema', SISTEMAS)}</label>
        <label class="bm-fila">Tipo ${seg('clase', CLASES)}</label>
        <label class="bm-fila">Modelo <input data-bm-campo="modelo" list="bm-modelos" autocomplete="off" autocapitalize="characters" placeholder="DL_09_0205, RR_05_0803… o escríbelo" value="${esc(s.modelo)}"><datalist id="bm-modelos"></datalist></label>
        <p class="bm-ak" data-bm-ak></p>
        <div class="bm-dos">
          <label class="bm-fila">Largo (mm) <input data-bm-campo="largo" inputmode="numeric" value="${esc(s.largo)}" placeholder="opcional"></label>
          <label class="bm-fila">Alto (mm) <input data-bm-campo="alto" inputmode="numeric" value="${esc(s.alto)}" placeholder="opcional"></label>
        </div>
        <label class="bm-fila">Caudal de proyecto (m³/h) <input data-bm-campo="caudalProyecto" inputmode="decimal" value="${esc(coma(s.caudalProyecto))}" placeholder="vacío = sin dato"></label>
        <label class="bm-fila">Sala <input data-bm-campo="sala" value="${esc(s.sala)}" placeholder="opcional"></label>
        <label class="bm-fila">Nota <input data-bm-campo="nota" value="${esc(s.nota)}" placeholder="opcional"></label>
        ${s.puntoId ? `<button class="enlace bm-quitar" data-bm="quitar">Quitar ${esc(s.nombre)}</button>` : ''}
      </div>`}`;
    if (verPlano) {
      C.cargarImagenes(capa);
      prepararGestos(capa.querySelector('.bm-marco'));
    }
    pintarModelos();
  }

  function pintarModelos() {
    if (!capa || !estado) return;
    const dl = capa.querySelector('#bm-modelos');
    if (dl) dl.innerHTML = estado.modelos.map((m) => `<option value="${esc(m.codigo)}">${esc(`${m.tipoNombre || ''}${m.tamano ? ` ${m.tamano}` : ''} · ${m.cuantas} en la hoja`)}</option>`).join('');
    const ak = capa.querySelector('[data-bm-ak]');
    if (!ak) return;
    const m = estado.modelos.find((x) => x.codigo.toUpperCase() === String(estado.modelo || '').trim().toUpperCase());
    ak.textContent = m ? `${m.tipoNombre || 'Modelo de la hoja'}${m.tamano ? ` · ${m.tamano}` : ''} · Ak ${m.ak ? `${coma(m.ak)} m² (${m.akDe === 'ficha' ? 'ficha técnica' : 'catálogo'})` : 'sin dato'}`
      : estado.modelo ? 'Modelo que no está en la hoja: el Ak sale del catálogo si casa; si no, «sin dato».' : 'Sin modelo: Ak sin dato.';
  }

  /* ───────────────────────────── el plano: tocar para colocar, dos dedos para acercar */

  function prepararGestos(marco) {
    if (!marco) return;
    const lienzo = marco.querySelector('.bm-lienzo');
    const v = estado.vista;
    const aplicar = () => {
      v.s = Math.min(8, Math.max(1, v.s));
      const w = lienzo.offsetWidth * v.s, h = lienzo.offsetHeight * v.s;
      v.x = w > marco.clientWidth ? Math.min(0, Math.max(marco.clientWidth - w, v.x)) : (marco.clientWidth - w) / 2;
      v.y = h > marco.clientHeight ? Math.min(0, Math.max(marco.clientHeight - h, v.y)) : (marco.clientHeight - h) / 2;
      lienzo.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
      lienzo.style.setProperty('--esc', String(v.s));
    };
    const img = lienzo.querySelector('img');
    if (img) img.addEventListener('load', aplicar);
    aplicar();
    const rel = (x, y) => { const r = marco.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
    const d2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    let g = null;
    let tocado = 0;
    const colocar = (cx, cy) => {
      const r = lienzo.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (cx - r.left) / r.width, y = (cy - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      estado.x = Math.round(x * 10000) / 10000; estado.y = Math.round(y * 10000) / 10000; estado.sinPosicion = false;
      leerCampos();
      pintar();
    };
    marco.addEventListener('touchstart', (ev) => {
      const t = ev.touches;
      if (t.length >= 2) g = { tipo: 'pellizco', d0: d2(t[0], t[1]) || 1, v0: { ...v }, c0: rel((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2), movido: true };
      else g = { tipo: 'uno', x0: t[0].clientX, y0: t[0].clientY, v0: { ...v }, movido: false };
    }, { passive: true });
    marco.addEventListener('touchmove', (ev) => {
      if (!g) return;
      const t = ev.touches;
      ev.preventDefault();
      if (g.tipo === 'pellizco' && t.length >= 2) {
        const s2 = Math.min(8, Math.max(1, g.v0.s * (d2(t[0], t[1]) / g.d0)));
        const c = rel((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
        const px = (g.c0.x - g.v0.x) / g.v0.s, py = (g.c0.y - g.v0.y) / g.v0.s;
        Object.assign(v, { s: s2, x: c.x - px * s2, y: c.y - py * s2 });
        aplicar();
      } else if (g.tipo === 'uno' && t.length === 1) {
        const dx = t[0].clientX - g.x0, dy = t[0].clientY - g.y0;
        if (Math.hypot(dx, dy) > 8) g.movido = true;
        if (g.movido && v.s > 1.001) { v.x = g.v0.x + dx; v.y = g.v0.y + dy; aplicar(); }
      }
    }, { passive: false });
    marco.addEventListener('touchend', (ev) => {
      if (!g) return;
      if (g.tipo === 'uno' && !g.movido && ev.changedTouches.length) { tocado = Date.now(); colocar(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY); }
      if (!ev.touches.length) g = null;
    });
    /* Ratón (la web y el escritorio): clic coloca, rueda acerca. */
    marco.addEventListener('click', (ev) => { if (Date.now() - tocado > 600) colocar(ev.clientX, ev.clientY); });
    marco.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const c = rel(ev.clientX, ev.clientY);
      const s2 = Math.min(8, Math.max(1, v.s * (ev.deltaY < 0 ? 1.2 : 1 / 1.2)));
      const px = (c.x - v.x) / v.s, py = (c.y - v.y) / v.s;
      Object.assign(v, { s: s2, x: c.x - px * s2, y: c.y - py * s2 });
      aplicar();
    }, { passive: false });
  }

  /* ───────────────────────────────────────────── guardar y quitar */

  function leerCampos() {
    if (!capa || !estado) return;
    for (const i of capa.querySelectorAll('[data-bm-campo]')) {
      if (i.dataset.bmCampo === 'planoId') continue;
      estado[i.dataset.bmCampo] = i.value.trim();
    }
  }

  function cuerpo() {
    const s = estado;
    return {
      equipoId: s.equipoId, planoId: s.planoId, ...(s.puntoId ? { puntoId: s.puntoId } : { id: s.idNuevo || (s.idNuevo = nuevoId()) }),
      ...(s.sinPosicion || s.x === null ? { sinPosicion: true } : { x: s.x, y: s.y }),
      sistema: s.sistema, clase: s.clase, modelo: s.modelo, largo: s.largo, alto: s.alto,
      caudalProyecto: String(s.caudalProyecto ?? '').replace(',', '.'), sala: s.sala, nota: s.nota,
    };
  }

  async function mandar(ruta, c, clave) {
    try {
      const r = await C.postJson(ruta, c);
      return r;
    } catch (e) {
      if (AG && AG.sinRed(e)) {
        AG.guardar(clave, { ruta, cuerpo: c });
        if (COLA) COLA.masTarde();
        C.aviso('Sin conexión: la boca queda guardada en el móvil y se mandará sola.', 'info');
        return { ok: false, enCola: true };
      }
      return { ok: false, error: e.message };
    }
  }

  async function guardar() {
    leerCampos();
    const s = estado;
    if (s.colocar) {
      if (s.x === null) { C.aviso('Toca en el plano donde está la boca.'); return; }
      const c = { planoId: s.planoId, puntoId: s.puntoId, x: s.x, y: s.y };
      const r = await mandar('api/boca-colocar', c, `bocaManual.colocar.${s.puntoId}`);
      if (r.enCola) { cerrar(); return; }
      if (!r.ok) { C.aviso(r.error || 'No se ha podido colocar la boca.'); return; }
      const nombre = s.nombre;
      cerrar();
      gancho.poner(r);
      C.aviso(`${nombre} colocada en el plano.`, 'bien');
      return;
    }
    const f = gancho.ficha();
    const plano = f && f.planos.find((p) => p.id === s.planoId);
    if (plano && plano.imagen && !s.sinPosicion && s.x === null) { C.aviso('Toca en el plano donde está la boca, o pulsa «Sin posición».'); return; }
    const c = cuerpo();
    const boton = capa.querySelector('[data-bm="guardar"]');
    if (boton) boton.disabled = true;
    const r = await mandar('api/boca-manual', c, `bocaManual.${c.puntoId || c.id}`);
    if (boton) boton.disabled = false;
    if (r.enCola) { cerrar(); return; }
    if (!r.ok) { C.aviso(r.error || 'No se ha podido guardar la boca.'); return; }
    cerrar();
    gancho.poner(r);
    C.aviso(s.puntoId ? `${s.nombre} cambiada.` : `${r.nombre || 'Boca'} añadida en obra.`, 'bien');
  }

  async function quitar() {
    const s = estado;
    const f = gancho.ficha();
    const pl = f && f.planos.find((p) => p.bocas.some((b) => b.id === s.puntoId));
    if (!pl) return;
    if (s.lecturas && !window.confirm(`${s.nombre} tiene lecturas apuntadas. ¿La quitas con ellas?`)) return;
    if (!s.lecturas && !window.confirm(`¿Quitar ${s.nombre}?`)) return;
    const c = { planoId: pl.id, puntoId: s.puntoId, confirmar: Boolean(s.lecturas) };
    let r = await mandar('api/boca-manual/quitar', c, `bocaManual.quitar.${s.puntoId}`);
    if (r.enCola) { cerrar(); return; }
    if (!r.ok && r.pideConfirmar && window.confirm(r.error)) r = await mandar('api/boca-manual/quitar', { ...c, confirmar: true }, `bocaManual.quitar.${s.puntoId}`);
    if (!r.ok) { if (r.error) C.aviso(r.error); return; }
    const nombre = s.nombre;
    cerrar();
    gancho.poner(r);
    C.aviso(`${nombre} quitada.`, 'bien');
  }

  /* Lo que quedó en el teléfono sin mandar: la cola lo manda al volver la red. */
  async function enviarPendiente(clave, b) {
    const r = await C.postJson(b.ruta, b.cuerpo);
    AG.olvidar(clave);
    const f = gancho.ficha();
    if (r && r.ok && f && r.equipo && f.equipo.id === r.equipo.id && !capa) gancho.poner(r);
    return true;
  }

  document.addEventListener('click', (ev) => {
    const gm = ev.target.closest && ev.target.closest('[data-bmm-guardar]');
    if (gm) { ev.preventDefault(); guardarMedidas(gm); return; }
    const mo = ev.target.closest && ev.target.closest('[data-bmm-modelo]');
    if (mo) { ev.preventDefault(); abrirModelo(mo.closest('.bm-medidas')); return; }
    const mg = ev.target.closest && ev.target.closest('[data-bmm-modelo-guardar]');
    if (mg) { ev.preventDefault(); guardarModelo(mg); return; }
    const b = ev.target.closest && ev.target.closest('[data-bm]');
    if (!b) return;
    const que = b.dataset.bm;
    if (que === 'nueva') abrir({ sistema: b.dataset.sistema });
    else if (que === 'editar') abrir({ planoId: b.dataset.plano, puntoId: b.dataset.punto });
    else if (que === 'colocar') abrir({ planoId: b.dataset.plano, puntoId: b.dataset.punto, colocar: true });
    else if (!estado) return;
    else if (que === 'cancelar') cerrar();
    else if (que === 'guardar') guardar();
    else if (que === 'quitar') quitar();
    else if (que === 'sin-posicion') { leerCampos(); estado.sinPosicion = !estado.sinPosicion; if (estado.sinPosicion) { estado.x = null; estado.y = null; } pintar(); }
    else if (que === 'campo') {
      leerCampos();
      estado[b.dataset.campo] = b.dataset.valor;
      if (b.dataset.campo === 'sistema' && !estado.puntoId && !estado.claseTocada) estado.clase = b.dataset.valor === 'impulsion' ? 'difusor' : 'reja';
      if (b.dataset.campo === 'clase') estado.claseTocada = true;
      pintar();
    }
  });
  /* Al teclear una medida, aparece «Guardar medidas». */
  document.addEventListener('input', (ev) => {
    const m = ev.target.dataset && ev.target.dataset.bmm;
    if (!m) return;
    const caja = ev.target.closest('.bm-medidas');
    const btn = caja && caja.querySelector('[data-bmm-guardar]');
    if (editor && caja && editor.clave === `${caja.dataset.plano}|${caja.dataset.punto}`) editor[m] = ev.target.value.trim();
    if (btn) btn.hidden = ![...caja.querySelectorAll('input[data-bmm]')].some((x) => x.value.trim() !== x.defaultValue.trim());
  });
  document.addEventListener('input', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.bme;
    if (k && editor && ev.target.tagName === 'INPUT' && k !== 'todas') editor[k] = ev.target.value.trim();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || !ev.target.dataset || !ev.target.dataset.bmm) return;
    const btn = ev.target.closest('.bm-medidas').querySelector('[data-bmm-guardar]');
    if (btn && !btn.hidden) { ev.preventDefault(); guardarMedidas(btn); }
  });
  document.addEventListener('input', (ev) => {
    if (!capa || !estado || !capa.contains(ev.target) || !ev.target.dataset.bmCampo) return;
    if (ev.target.dataset.bmCampo === 'modelo') { estado.modelo = ev.target.value.trim(); pintarModelos(); }
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.dataset && ev.target.dataset.bme && ev.target.tagName === 'SELECT') { cambioEditor(ev.target); return; }
    if (ev.target.dataset && ev.target.dataset.bme === 'todas' && editor) { editor.todas = ev.target.checked; return; }
  });
  document.addEventListener('change', (ev) => {
    if (!capa || !estado || !capa.contains(ev.target) || ev.target.dataset.bmCampo !== 'planoId') return;
    leerCampos();
    estado.planoId = ev.target.value; estado.x = null; estado.y = null; estado.vista = { s: 1, x: 0, y: 0 };
    pintar();
  });

  /* El aspecto: sin tarjetas, teal / verde / azul (movil.css da los tokens). */
  const estilo = document.createElement('style');
  estilo.textContent = `
.bm-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 6px 0 12px; }
.bm-mas { border: 1px solid var(--acento); background: transparent; color: var(--acento); font: inherit; font-weight: 700; border-radius: 999px; padding: 6px 14px; width: fit-content; }
.bm-mas span { font-weight: 500; }
.bm-ayuda { font-size: 12px; color: var(--textoTenue); }
.marca-manual { color: var(--acento-fuerte); background: var(--acento-suave); border-radius: 999px; padding: 1px 8px; font-size: 12px; font-weight: 600; width: fit-content; }
.bm-cambiar { font-size: 12px; margin-left: 6px; }
body.bm-abierta { overflow: hidden; }
.bm-capa { position: fixed; inset: 0; z-index: 9000; background: var(--panel); display: flex; flex-direction: column; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
.bm-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--acento); }
.bm-cabeza strong { font-size: 16px; }
.bm-guardar { background: var(--acento); color: #fff; border: 0; border-radius: 999px; padding: 7px 16px; font: inherit; font-weight: 700; }
.bm-guardar:disabled { opacity: .5; }
.bm-plano-barra { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 16px 0; font-size: 13px; }
.bm-plano-barra select { font: inherit; max-width: 60%; }
.bm-plano-nombre { color: var(--textoSuave); }
.bm-pista { margin: 4px 16px; font-size: 13px; color: var(--aviso); }
.bm-marco { position: relative; flex: 1 1 45%; min-height: 200px; overflow: hidden; touch-action: none; background: var(--panel2); border-top: 1px solid var(--rejilla); border-bottom: 1px solid var(--rejilla); }
.bm-lienzo { position: absolute; left: 0; top: 0; width: 100%; transform-origin: 0 0; }
.bm-lienzo img { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; pointer-events: none; }
.bm-otra, .bm-nueva { position: absolute; transform: translate(-50%, -50%) scale(calc(1 / var(--esc, 1))); display: flex; flex-direction: column; align-items: center; font-size: 10px; line-height: 1; pointer-events: none; color: var(--acento-fuerte); }
.bm-otra i { width: 8px; height: 8px; border-radius: 50%; background: var(--acento-vivo); opacity: .7; }
.bm-otra.ret i { background: var(--aviso); }
.bm-nueva { color: var(--bien); font-weight: 700; font-size: 12px; }
.bm-nueva i { width: 18px; height: 18px; border-radius: 50%; border: 3px solid var(--bien); background: rgba(46, 125, 50, .2); }
.bm-datos { flex: 1 1 auto; overflow-y: auto; padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 8px; }
.bm-fila { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--textoSuave); }
.bm-fila input, .bm-fila select { font: inherit; font-size: 16px; color: var(--texto); padding: 6px 2px; border: 0; border-bottom: 1px solid var(--borde); background: transparent; border-radius: 0; }
.bm-fila input:focus { outline: none; border-bottom-color: var(--acento); }
.bm-seg { width: fit-content; }
.bm-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.bm-ak { margin: 0; font-size: 12px; color: var(--aviso); }
.bm-quitar { color: var(--mal); align-self: flex-start; margin-top: 8px; }
.bm-medidas { margin: 4px 0 2px; }
.bm-medidas-fila { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 13px; color: var(--textoSuave); }
.bm-medidas-fila label { display: inline-flex; align-items: center; gap: 3px; }
#app .boca .bm-medidas-fila input { width: 5em; max-width: 5em; min-height: 30px; height: 30px; padding: 2px 4px; margin-top: 0; font-size: 15px; text-align: center; font-variant-numeric: tabular-nums; }
.bm-medidas-guardar { border: 1px solid var(--acento); background: transparent; color: var(--acento); font: inherit; font-size: 13px; font-weight: 700; border-radius: 999px; padding: 3px 12px; width: fit-content; }
.bm-akboca { margin: 2px 0 0; font-size: 12px; color: var(--textoSuave); }
.bm-akboca.sin { color: var(--aviso); font-weight: 600; }
#app .boca .bm-medidas-fila input.ancho { width: 6em; max-width: 6em; }
.bm-modelo-abrir { font-size: 13px; }
.bm-editor { display: flex; flex-direction: column; gap: 6px; margin: 6px 0 4px; padding-left: 10px; border-left: 2px solid var(--acento); }
#app .boca .bm-editor input, #app .boca .bm-editor select { font-size: 15px; min-height: 32px; margin-top: 0; }
.bm-todas { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--textoSuave); }
#app .boca .bm-todas input { width: auto; min-height: 0; }
.bm-sinpos { margin: 4px 0 12px; }
.bm-sinpos h4 { margin: 0 0 4px; font-size: 13px; color: var(--acento-fuerte); border-bottom: 1px solid var(--acento); width: fit-content; }
.bm-sinpos h4 span { font-weight: 500; color: var(--textoSuave); }
.bm-sinpos ul { list-style: none; margin: 0; padding: 0; }
.bm-sinpos li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--rejilla); }
.bm-sinpos li span { color: var(--textoSuave); }
`;
  document.head.appendChild(estilo);

  function enganchar(g) {
    gancho = { ...gancho, ...g };
  }
  if (COLA && AG) COLA.registrar('bocaManual.', enviarPendiente);
  /* Al volver al móvil (la hoja seguía abierta): trae lo de la nube ya, sin
     esperar al ciclo de 30 s, para no medir sobre una copia vieja. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    try { const s = globalThis.cxObra && globalThis.cxObra.sync; if (s && typeof s.ahora === 'function') s.ahora(); } catch { /* sin motor: la web lee de la nube */ }
  });

  window.BOCA_MANUAL_MOVIL = { boton, marca, medidas, enganchar, abrir, cerrar };
})();
