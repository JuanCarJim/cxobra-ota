'use strict';
/*
 * MODO MANTENIMIENTO de Vidaire Cx (el técnico de la mantenedora): ruta de
 * hoy, equipos con su gas y su control de fugas por t CO₂e, libro F-gas,
 * IT 3 del RITE, furgoneta y cilindros, certificados, incidencias propias por
 * corregir con foto y escaneo del QR del equipo.
 *
 * Las reglas y los datos vienen de window.MANT (mantenimiento-motor.js, la
 * lógica portada de la app de campo + packages/normativa). Aquí solo hay
 * pantallas, con las clases y la navegación de Cx.
 *
 * Se entra según el rol (no hay selector): quien es de mantenimiento ve
 * este modo y los demás, el de obra. Las
 * direcciones son #m/ruta, #m/equipo/<id>… y la carcasa de Cx no pinta nada
 * mientras el modo es Mantenimiento (window.VIDAIRE_MODO).
 */
(function mantenimiento() {
  const $app = document.getElementById('app');
  const C = window.CX;
  if (!$app || !C) return;
  const { esc } = C;

  /* El rol decide el modo: el jefe de mantenimiento va a Mantenimiento; el resto, a Obra (JC, 22-oct). */
  const ROLES_MANT = ['jefeMantenimiento'];
  const sesion = () => (window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion()) || null;
  const modoDelRol = () => { const s = sesion(); return s && ROLES_MANT.includes(s.rol) ? 'mant' : 'obra'; };
  let modo = 'obra';
  window.VIDAIRE_MODO = () => (modo = modoDelRol());

  const M = () => window.MANT;
  const hayMotor = () => Boolean(window.MANT);
  const ctx = () => M().contexto();

  /* ═══════════════════════════════════ Utilidades */

  const ICONO = (off, on) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="off">${off}</g><g class="on">${on}</g></svg>`;
  const HUECO = 'style="stroke:var(--barra-solida)"';
  const PESTANAS = [
    { id: 'ruta', nombre: 'Ruta', rutas: ['ruta', 'edificio', 'equipo', 'gas', 'recuperar', 'fuga', 'it3', 'cerrar', 'fin'],
      icono: ICONO('<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.2"/>',
        `<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z" fill="currentColor"/><circle cx="12" cy="10" r="2.2" ${HUECO}/>`) },
    { id: 'furgoneta', nombre: 'Furgoneta', rutas: ['furgoneta', 'cilindro'],
      icono: ICONO('<rect x="8" y="3.5" width="8" height="17" rx="3"/><path d="M8 8h8M10.5 3.5V2M13.5 3.5V2"/>',
        `<rect x="8" y="3.5" width="8" height="17" rx="3" fill="currentColor"/><path d="M8 8h8" ${HUECO}/>`) },
    { id: 'incidencias', nombre: 'Incidencias', rutas: ['incidencias'],
      icono: ICONO('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
        `<path d="M12 3.5 2.8 19.5h18.4z" fill="currentColor"/><path d="M12 10v4" ${HUECO} stroke-width="2.2"/><path d="M12 16.9v.1" ${HUECO} stroke-width="2.4"/>`) },
    { id: 'mas', nombre: 'Más', rutas: ['mas', 'certificados', 'libro', 'alta', 'entrega'],
      icono: ICONO('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
        '<g fill="currentColor"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></g>') },
  ];
  const QR = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7 12h10"/></svg>';

  const TITULOS = {
    ruta: 'Ruta de hoy', edificio: 'Equipos de hoy', equipo: 'Equipo', gas: 'Añadir gas', recuperar: 'Recuperar gas', fuga: 'Hay fuga', it3: 'IT 3 (RITE)',
    cerrar: 'Cerrar la visita', fin: 'Visita cerrada', furgoneta: 'Mi furgoneta', cilindro: 'Cilindro', incidencias: 'Mis incidencias', mas: 'Más', certificados: 'Mis certificados',
    libro: 'Libro F-gas', alta: 'Añadir equipo', escanear: 'Escanear equipo', entrega: 'Acta de entrega',
  };

  const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
  const hora = (iso) => (iso && String(iso).length > 15 ? String(iso).slice(11, 16) : '');
  const num = (n, d = 0) => C.cifra(n, d);
  const kgT = (n) => M().formato.kg(Number(n));
  const chip = (clase, texto) => `<span class="chip ${clase}">${esc(texto)}</span>`;
  const fila = (nombre, valor, clase = '') => `<div class="fila-dato${clase ? ` ${clase}` : ''}"><span>${esc(nombre)}</span><strong>${valor}</strong></div>`;
  const vacio = (html) => `<div class="vacio">${html}</div>`;
  const error = (e) => `<div class="vacio mal"><p>${esc(e && e.message ? e.message : String(e))}</p></div>`;

  const MOTIVOS = { no_accesible: 'No accesible', sin_material: 'Sin material', no_procede: 'No procede', otro: 'Otro motivo' };
  const TIPO_INTERV = { control_fugas: 'Control de fugas', carga: 'Carga de gas', recuperacion: 'Recuperación de gas', desmantelamiento: 'Desmontaje', it3: 'IT 3' };
  const RESULTADO = { sin_fugas: 'Sin fugas', fuga_detectada: 'Fuga sin reparar', fuga_reparada: 'Fuga reparada', correcto: 'Hecha', corregido: 'Hecha y corregida', no_aplica: 'No hecha' };
  const TIPOS_EQUIPO = [['split', 'Split'], ['multisplit', 'Multisplit'], ['vrf', 'VRF'], ['compacto', 'Compacto'], ['rooftop', 'Rooftop'], ['enfriadora', 'Enfriadora'],
    ['bomba_calor_aire_agua', 'Bomba de calor aire-agua'], ['bomba_calor_aire_aire', 'Bomba de calor aire-aire'], ['fancoil', 'Fancoil'], ['unidad_tratamiento_aire', 'UTA'],
    ['recuperador', 'Recuperador'], ['camara_frigorifica', 'Cámara frigorífica'], ['central_frigorifica', 'Central frigorífica'], ['mueble_frigorifico', 'Mueble frigorífico'], ['caldera', 'Caldera']];
  const GRAVEDAD = { critica: ['mal', 'Crítica'], importante: ['aviso', 'Importante'], menor: ['neutra', 'Menor'] };

  const aviso = (t, n = 'mal') => C.aviso(t, n);

  async function leerArchivo(f) {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => mal(r.error);
      r.readAsDataURL(f);
    });
  }

  /** Un diálogo pequeño de aceptar / cancelar con la hoja de Cx. */
  async function confirmar(titulo, texto, si = 'Sí', no = 'No, volver') {
    const r = await C.menu({ titulo, sub: texto, opciones: [{ id: 'si', nombre: si }, { id: 'no', nombre: no }] });
    return r === 'si';
  }

  /** Pizarra para firmar con el dedo: devuelve { svg(), vacia(), limpiar() }. */
  function pizarra(lienzo) {
    const g = lienzo.getContext('2d');
    const trazos = [];
    let actual = null;
    const ajustar = () => {
      const r = lienzo.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      lienzo.width = Math.round(r.width * dpr);
      lienzo.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1A1A1A';
      for (const t of trazos) { g.beginPath(); t.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    };
    const punto = (ev) => { const r = lienzo.getBoundingClientRect(); return [Math.round(ev.clientX - r.left), Math.round(ev.clientY - r.top)]; };
    lienzo.addEventListener('pointerdown', (ev) => { lienzo.setPointerCapture(ev.pointerId); actual = [punto(ev)]; trazos.push(actual); g.beginPath(); g.moveTo(...actual[0]); });
    lienzo.addEventListener('pointermove', (ev) => { if (!actual) return; const p = punto(ev); actual.push(p); g.lineTo(...p); g.stroke(); });
    const fin = () => { actual = null; };
    lienzo.addEventListener('pointerup', fin);
    lienzo.addEventListener('pointercancel', fin);
    requestAnimationFrame(ajustar);
    return {
      vacia: () => trazos.every((t) => t.length < 2),
      limpiar: () => { trazos.length = 0; ajustar(); g.clearRect(0, 0, lienzo.width, lienzo.height); },
      svg: () => {
        const r = lienzo.getBoundingClientRect();
        const ds = trazos.filter((t) => t.length > 1).map((t) => `<path d="${t.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')}"/>`).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(r.width)} ${Math.round(r.height)}" fill="none" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ds}</svg>`;
      },
    };
  }

  /* ═══════════════════════════════════ Barra de abajo y router */

  const partes = () => { const h = location.hash.slice(1); return h.startsWith('m/') ? h.slice(2).split('/').map(decodeURIComponent) : null; };

  function barraInferior(r) {
    const abajo = document.getElementById('barra-inferior');
    if (!abajo) return;
    const actual = PESTANAS.find((p) => p.rutas.includes(r[0])) || null;
    const boton = (p) => `<a href="#m/${p.id}" class="pestana-${p.id}${actual === p ? ' activa' : ''}" ${actual === p ? 'aria-current="page"' : ''}>${p.icono}<span>${esc(p.nombre)}</span></a>`;
    abajo.innerHTML = `<div class="barra-pastilla">${PESTANAS.slice(0, 2).map(boton).join('')}
      <div class="barra-centro"><a href="#m/escanear" class="boton-anadir" aria-label="Escanear equipo">${QR}</a><span>Escanear</span></div>
      ${PESTANAS.slice(2).map(boton).join('')}</div>`;
    abajo.hidden = !sesion();
  }

  function titulo(r) {
    const t = document.getElementById('titulo-seccion');
    if (t) t.textContent = TITULOS[r[0]] || 'Mantenimiento';
    document.title = `${TITULOS[r[0]] || 'Mantenimiento'} · Vidaire Cx`;
  }

  let motorListo = null;
  function abrirMotor() {
    if (!motorListo) motorListo = M().iniciar('sql-wasm-browser.wasm');
    return motorListo;
  }

  const PANTALLAS = {
    ruta: pRuta, edificio: pEdificio, equipo: pEquipo, gas: pGas, recuperar: pRecuperar, fuga: pFuga, it3: pIt3, cerrar: pCerrar, fin: pFin,
    furgoneta: pFurgoneta, cilindro: pCilindroNuevo, incidencias: pIncidencias, mas: pMas, certificados: pCertificados, libro: pLibro, alta: pAlta, escanear: pEscanear,
    entrega: pEntrega,
  };

  let pintando = 0;
  async function ir() {
    if (window.VIDAIRE_MODO() !== 'mant') {
      /* Quien no es de mantenimiento no ve nada suyo, ni con una dirección #m/ guardada. */
      document.body.classList.remove('modo-mant');
      if (sesion() && location.hash.startsWith('#m/')) { location.hash = 'inicio'; window.dispatchEvent(new HashChangeEvent('hashchange')); C.volverAObra(); }
      return;
    }
    let r = partes();
    if (!r) { location.hash = 'm/ruta'; return; }
    if (!PANTALLAS[r[0]]) r = ['ruta'];
    document.body.classList.add('modo-mant');
    barraInferior(r);
    titulo(r);
    const mia = ++pintando;
    if (!hayMotor()) { $app.innerHTML = vacio('<p>Esta versión de la app no trae el modo Mantenimiento.</p>'); return; }
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      await abrirMotor();
      if (mia !== pintando) return;
      await PANTALLAS[r[0]](r.slice(1));
    } catch (e) {
      if (mia === pintando) $app.innerHTML = error(e);
    }
  }
  const repintar = () => ir();
  window.addEventListener('hashchange', ir);

  /* ═══════════════════════════════════ Ruta de hoy */

  function sinDatos() {
    return vacio(`<p>Aún no hay ruta en este móvil.</p><p style="font-size:14px;font-weight:400;color:var(--textoTenue)">Cuando la oficina te asigne visitas aparecerán aquí. Mientras tanto puedes ver cómo funciona con datos de ejemplo.</p>
      <button class="boton" data-m="ejemplo">Ver un ejemplo</button>`);
  }

  async function pRuta() {
    const m = M();
    const nube = conNube() ? await m.nube.estado() : null;
    if (!(await m.hayDatos())) {
      $app.innerHTML = nube && nube.conectado
        ? vacio(`<p>Aún no te ha llegado ninguna ruta.</p><p style="font-size:14px;font-weight:400;color:var(--textoTenue)">${esc(textoNube(nube))}. Cuando la oficina te asigne visitas en Vidaire aparecerán aquí.</p>
          <button class="boton secundario" data-m="nube-sync">Sincronizar ahora</button>`)
        : sinDatos();
      return;
    }
    const c = ctx();
    const [ruta, sin] = await Promise.all([m.mant.rutaDeHoy(c), m.mant.visitasSinCerrar(c)]);
    const hoyTxt = fecha(c.hoy);
    /* Lo de la nube solo si hay algo que contar (minimalista): por enviar, sin red o un fallo. */
    const nubeTxt = nube && nube.conectado && (nube.porEnviar || nube.sinRed || nube.error) ? ` · ${textoNube(nube)}` : '';
    $app.innerHTML = `
      <p class="nota">${esc(hoyTxt)} · ${esc(c.usuarioNombre)}${esc(nubeTxt)}</p>
      ${sin.length ? `<h2 class="titulo-grupo">Sin cerrar de otro día</h2>
        <ul class="lista-ios">${sin.map((v) => `<li><button class="fila-ios" data-m="cerrar-visita" data-ed="${esc(v.edificio_id)}" data-fecha="${esc(v.fecha)}">
          <div class="fila-principal"><strong>${esc(v.nombre)}</strong>${chip('aviso', fecha(v.fecha))}</div>
          <span class="texto-2">Falta cerrarla y firmarla.</span></button></li>`).join('')}</ul>` : ''}
      <h2 class="titulo-grupo">Visitas de hoy</h2>
      ${ruta.length ? `<ul class="lista-ios numerada">${ruta.map((p) => {
        const pct = p.equipos ? Math.round((p.hechos / p.equipos) * 100) : 0;
        return `<li><button class="fila-ios" data-m="edificio" data-ed="${esc(p.edificioId)}">
          <div class="fila-principal"><strong>${esc(p.nombre)}</strong>${p.visitaCerrada ? chip('bien', 'Cerrada') : p.hechos ? chip('info', 'En curso') : chip('neutra', 'Por hacer')}</div>
          <span class="texto-2">${esc([p.municipio, p.descripcion].filter(Boolean).join(' · '))}</span>
          <div class="progreso"><i style="width:${pct}%"></i></div><small class="tenue">${num(p.hechos)} de ${num(p.equipos)} equipos</small></button></li>`;
      }).join('')}</ul>` : vacio('<p>Hoy no tienes visitas.</p>')}`;
  }

  /* ═══════════════════════════════════ Equipos de una visita */

  async function visitaDeEdificio(edificioId) {
    const m = M(); const c = ctx();
    const ruta = await m.mant.rutaDeHoy(c);
    const p = ruta.find((x) => x.edificioId === edificioId);
    return m.mant.visita(c, p || { edificioId, ordenId: null, contratoId: null });
  }

  function etiquetaEquipo(s) {
    if (s.terminado) return chip('bien', 'Hecho');
    if (s.vencido) return chip('mal', 'Control vencido');
    if (s.venceHoy) return chip('aviso', 'Vence hoy');
    if (s.faltaFugas) return chip('aviso', 'Falta fugas');
    if (s.faltaIt3) return chip('aviso', 'Falta IT 3');
    return chip('neutra', 'Por hacer');
  }

  async function pEdificio([edificioId]) {
    const m = M(); const c = ctx();
    const ed = await c.base.una('select nombre, municipio from edificios where id = ?', [edificioId]);
    const v = await visitaDeEdificio(edificioId);
    const estados = await m.mant.estadoDeEquipos(c, edificioId, v.id);
    const hechos = estados.filter((s) => s.terminado).length;
    $app.innerHTML = `
      <button class="volver" data-m="ruta">‹ Ruta de hoy</button>
      <h2 class="titulo-grupo">${esc(ed ? ed.nombre : 'Edificio')}</h2>
      <p class="nota">${num(hechos)} de ${num(estados.length)} equipos terminados${v.estado === 'cerrada' ? ' · visita cerrada' : ''}</p>
      ${estados.length ? `<ul class="lista-ios">${estados.map((s) => `<li><button class="fila-ios" data-m="equipo" data-id="${esc(s.equipo.id)}">
        <div class="fila-principal"><strong>${esc(s.equipo.tag)}</strong>${etiquetaEquipo(s)}</div>
        <span class="texto-2">${esc([s.equipo.ubicacion, s.equipo.descripcion || s.equipo.tipo].filter(Boolean).join(' · '))}</span>
        ${s.gas ? `<small class="tenue">${esc(s.equipo.refrigerante)} · ${kgT(s.gas.kg)} kg · ${esc(s.gas.toneladasTexto)} t CO₂e</small>` : ''}</button></li>`).join('')}</ul>` : vacio('<p>Este edificio no tiene equipos en el móvil.</p>')}
      ${v.estado !== 'cerrada' ? `<div class="mant-botones"><button class="boton grande" data-m="cerrar" data-ed="${esc(edificioId)}">Cerrar la visita</button>
        <button class="boton secundario" data-m="alta" data-ed="${esc(edificioId)}">Añadir un equipo que no está</button></div>` : ''}`;
  }

  /* ═══════════════════════════════════ Ficha del equipo */

  let pestanaFicha = 'hoy';

  async function pEquipo([id]) {
    const m = M(); const c = ctx();
    const e = await m.mant.equipo(c.base, id);
    if (!e) { $app.innerHTML = `<button class="volver" data-m="atras">‹ Volver</button>${vacio('<p>Este equipo no está en el móvil. Puede que lo hayan quitado de la ruta, o que aún no te haya llegado.</p>')}`; return; }
    const v = await visitaDeEdificio(e.edificio_id);
    const est = await m.mant.estadoDeEquipo(c, e, v.id);
    const hoy = await m.mant.hechoHoy(c, e.id);
    const cerrada = v.estado === 'cerrada';
    const g = est.gas;
    const hab = e.refrigerante ? await m.mant.puedo(c, 'control_fugas', e) : null;
    const avisos = [];
    if (hab && !hab.puede) avisos.push(hab.explicacion);
    if (g && g.control.faltaDeteccion) avisos.push('Este equipo debe tener detección de fugas y no la tiene.');
    if (e.estado === 'desmantelado') avisos.push('Este equipo está dado de baja.');
    const bloqueado = cerrada || e.estado === 'desmantelado';

    let cuerpo = '';
    if (pestanaFicha === 'hist') {
      const h = await m.mant.historial(c.base, e.id);
      cuerpo = h.length ? `<section class="grupo">${h.map((i) => `<div class="fila-dato"><span>${esc(fecha(i.realizada_en))}<br><small>${esc(TIPO_INTERV[i.tipo] || i.tipo)}</small></span>
        <strong>${esc(RESULTADO[i.resultado] || '')}${i.kg ? ` · ${kgT(i.kg)} kg` : ''}${i.cilindro ? `<br><small>${esc(i.cilindro)}</small>` : ''}</strong></div>`).join('')}</section>` : vacio('<p>Este equipo aún no tiene nada en el libro.</p>');
    } else if (pestanaFicha === 'datos') {
      cuerpo = `<section class="grupo">
        ${fila('Fabricante', esc(e.fabricante || '—'))}${fila('Modelo', esc(e.modelo || '—'))}${fila('Nº de serie', esc(e.numero_serie || '—'))}
        ${fila('Instalado', esc(fecha(e.fecha_instalacion)))}${fila('Potencia frío', e.potencia_frio_kw ? `${num(e.potencia_frio_kw, 1)} kW` : '—')}
        ${fila('Hermético', e.hermetico ? 'Sí' : 'No')}${fila('Detección de fugas', e.deteccion_fugas ? 'Sí' : 'No')}${fila('En vivienda', e.en_vivienda ? 'Sí' : 'No')}
        ${fila('QR / etiqueta', esc(e.qr_token || '—'))}</section>`;
    } else {
      cuerpo = await fichaHoy(m, c, e, est, hoy, bloqueado);
    }

    $app.innerHTML = `
      <button class="volver" data-m="atras">‹ Volver</button>
      <section class="grupo">
        <div class="fila-dato"><span>${esc(e.tag)}</span>${etiquetaEquipo(est)}</div>
        ${fila('Equipo', esc(e.descripcion || (TIPOS_EQUIPO.find((t) => t[0] === e.tipo) || [0, e.tipo])[1]))}
        ${fila('Dónde', esc(e.ubicacion || '—'))}
        ${g ? `${fila('Gas', `${esc(e.refrigerante)} · ${kgT(g.kg)} kg`)}
        ${fila('Potencial', `${esc(g.toneladasTexto)} t CO₂e`)}
        ${fila('Control de fugas', g.control.sujeto ? `cada ${g.control.periodicidadMeses} meses` : 'No está sujeto')}
        ${g.control.sujeto ? fila('Último control', esc(fecha(est.ultimoControl))) : ''}
        ${g.control.sujeto && g.proximo.fechaLimite ? fila('Próximo antes del', esc(fecha(g.proximo.fechaLimite)), g.proximo.vencido ? 'aviso' : '') : ''}` : fila('Gas', 'Sin gas fluorado')}
      </section>
      ${g ? `<p class="nota">${esc(g.control.explicacion)}</p>` : ''}
      ${avisos.map((a) => `<p class="nota aviso">${esc(a)}</p>`).join('')}
      <div class="segmentado">${[['hoy', 'Hoy'], ['hist', 'Libro'], ['datos', 'Datos']].map(([k, n]) => `<button type="button" data-m="ficha-tab" data-tab="${k}" class="${pestanaFicha === k ? 'activa' : ''}">${n}</button>`).join('')}</div>
      ${cuerpo}`;
  }

  async function fichaHoy(m, c, e, est, hoy, bloqueado) {
    const g = est.gas;
    const filas = [];
    if (hoy.control) filas.push(`<li><span>Control de fugas<small>${esc(RESULTADO[hoy.control.resultado] || '')}${hoy.control.observaciones && hoy.control.observaciones !== 'localizada' ? ` · ${esc(hoy.control.observaciones === 'no_localizada' ? 'sin localizar' : hoy.control.observaciones)}` : ''}</small></span>${bloqueado ? '' : `<button class="enlace" data-m="deshacer" data-id="${esc(hoy.control.id)}">Deshacer</button>`}</li>`);
    for (const x of hoy.cargas) filas.push(`<li><span>Cargado ${kgT(x.movimientos.reduce((a, y) => a + y.kg, 0))} kg<small>${esc(x.movimientos[0] ? x.movimientos[0].cilindro : '')}${x.arrastra ? ' · con su fuga' : ''}</small></span>${bloqueado ? '' : `<button class="enlace" data-m="deshacer" data-id="${esc(x.id)}">Deshacer</button>`}</li>`);
    for (const x of hoy.recuperaciones) filas.push(`<li><span>Recuperado ${kgT(x.movimientos.reduce((a, y) => a + y.kg, 0))} kg<small>${esc(x.movimientos[0] ? x.movimientos[0].cilindro : '')}</small></span>${bloqueado ? '' : `<button class="enlace" data-m="deshacer" data-id="${esc(x.id)}">Deshacer</button>`}</li>`);
    if (hoy.operaciones.length) filas.push(`<li><span>IT 3: ${num(hoy.operaciones.filter((o) => o.resultado === 'correcto').length)} de ${num(hoy.operaciones.length)} hechas</span>${bloqueado ? '' : `<button class="enlace" data-m="deshacer-it3" data-id="${esc(e.id)}">Deshacer</button>`}</li>`);
    if (hoy.desmontaje) filas.push('<li><span>Desmontaje anotado</span></li>');
    const it3 = await m.mant.it3DeHoy(c, e);
    const hechoControl = Boolean(hoy.control);
    const acciones = bloqueado ? '' : `
      <div class="mant-botones">
        ${g && g.control.sujeto ? `<div class="mant-fila-doble"><button class="boton bien" data-m="sin-fuga" data-id="${esc(e.id)}">Sin fuga</button>
          <button class="boton peligro-suave" data-m="fuga" data-id="${esc(e.id)}">Hay fuga</button></div>` : ''}
        ${g ? `<div class="mant-fila-doble"><button class="boton secundario" data-m="gas" data-id="${esc(e.id)}">Añadir gas</button>
          <button class="boton secundario" data-m="recuperar" data-id="${esc(e.id)}">Recuperar gas</button></div>` : ''}
        ${it3.hoy.length ? `<button class="boton secundario" data-m="it3" data-id="${esc(e.id)}">IT 3 · ${num(it3.hoy.length)} ${it3.hoy.length === 1 ? 'operación' : 'operaciones'} hoy</button>` : ''}
        <button class="boton grande" data-m="terminar" data-id="${esc(e.id)}">${est.terminado ? 'Terminado' : 'Terminar · siguiente equipo'}</button>
        ${g && g.control.sujeto && !hechoControl ? '' : ''}
      </div>`;
    return `<h2 class="titulo-grupo">Hecho hoy</h2>
      ${filas.length ? `<section class="grupo mant-hoy"><ul>${filas.join('')}</ul></section>` : '<p class="nota">Todavía nada hoy en este equipo.</p>'}
      ${acciones}`;
  }

  /* ═══════════════════════════════════ Acciones sobre el equipo */

  async function contextoEquipo(id) {
    const m = M(); const c = ctx();
    const e = await m.mant.equipo(c.base, id);
    if (!e) throw new Error('El equipo no está en el móvil.');
    const v = await visitaDeEdificio(e.edificio_id);
    return { m, c, e, v };
  }

  /** Corre una acción de la lógica y enseña un bloqueo (certificado, art. 13…) como pantalla roja. */
  async function conBloqueo(fn) {
    try { return await fn(); } catch (err) {
      if (err && err.motivo) { $app.insertAdjacentHTML('afterbegin', `<div class="mant-rojo" id="mant-bloqueo"><b>No se puede</b>${esc(err.message)}</div>`); window.scrollTo(0, 0); return null; }
      throw err;
    }
  }

  async function pFuga([id]) {
    const { e } = await contextoEquipo(id);
    $app.innerHTML = `
      <button class="volver" data-m="equipo" data-id="${esc(id)}">‹ ${esc(e.tag)}</button>
      <h2 class="titulo-grupo">¿Dónde está la fuga?</h2>
      <section class="grupo"><label class="fila-dato" style="display:block"><span>Dónde (puede ser «no localizada»)</span>
        <input id="mant-donde" type="text" placeholder="p. ej. unión de la batería" autocomplete="off"></label></section>
      <div class="mant-botones">
        <button class="boton bien" data-m="fuga-guardar" data-id="${esc(id)}" data-rep="1">La he reparado ahora</button>
        <button class="boton peligro-suave" data-m="fuga-guardar" data-id="${esc(id)}" data-rep="0">Queda pendiente de reparar</button>
      </div>`;
  }

  async function pGas([id]) {
    const { m, c, e } = await contextoEquipo(id);
    const todos = await m.mant.cilindros(c.base, c.usuarioId);
    const { permitidos, prohibidos } = m.reglas.cilindrosParaCargar(e, todos, c.hoy);
    const recomendado = permitidos[0] ? permitidos[0].id : null;
    const lleva = (cil) => `${cil.origen || 'virgen'} · quedan ${kgT(cil.kg)} kg`;
    $app.innerHTML = `
      <button class="volver" data-m="equipo" data-id="${esc(id)}">‹ ${esc(e.tag)}</button>
      <p class="nota">${esc(e.tag)} lleva <b>${esc(e.refrigerante || '—')}</b>. Solo salen cilindros de ese gas.</p>
      ${permitidos.length ? `<h2 class="titulo-grupo">Cilindros que puedes usar</h2>
        <ul class="lista-ios">${permitidos.map((cil) => `<li><button class="fila-ios" data-m="cil-elegir" data-cil="${esc(cil.id)}">
          <div class="mant-cilindro"><span><strong>${esc(cil.codigo)}</strong><small>${esc(lleva(cil))}</small></span>${cil.id === recomendado ? chip('bien', 'Recomendado') : ''}</div></button></li>`).join('')}</ul>`
        : '<div class="mant-rojo"><b>No tienes ningún cilindro válido</b>Con la ley en la mano, ahora mismo no puedes añadir gas a este equipo con lo que hay en la furgoneta.</div>'}
      ${prohibidos.length ? `<h2 class="titulo-grupo">No se pueden usar</h2>
        <ul class="lista-ios">${prohibidos.map((cil) => {
          const comp = m.reglas.comprobarCilindro(e, cil, c.hoy);
          const porque = comp.estado === 'vacio' ? 'Está vacío.' : comp.resultado ? comp.resultado.explicacion : '';
          return `<li><div class="fila-ios apagada mant-cilindro fuera"><span><strong>${esc(cil.codigo)}</strong><small>${esc(lleva(cil))}</small><small>${esc(porque)}</small></span>${chip('mal', 'Prohibido')}</div></li>`;
        }).join('')}</ul>` : ''}
      <div id="mant-cantidad" hidden>
        <h2 class="titulo-grupo">Cuántos kg añades</h2>
        <section class="grupo"><label class="fila-dato" style="display:block"><span id="mant-cil-nombre"></span>
          <input id="mant-kg" type="text" inputmode="decimal" placeholder="0,0" autocomplete="off"></label></section>
        <div class="mant-botones"><button class="boton grande" data-m="gas-guardar" data-id="${esc(id)}">Guardar carga</button></div>
      </div>`;
  }

  async function pRecuperar([id]) {
    const { m, c, e } = await contextoEquipo(id);
    const todos = await m.mant.cilindros(c.base, c.usuarioId);
    const cil = m.reglas.cilindroDeRecuperacion(e, todos);
    const libre = cil ? Math.max(0, Number(cil.capacidad_kg ?? 0) - cil.kg) : 0;
    $app.innerHTML = `
      <button class="volver" data-m="equipo" data-id="${esc(id)}">‹ ${esc(e.tag)}</button>
      ${cil ? `<section class="grupo">${fila('Cilindro de recuperación', esc(cil.codigo))}${fila('Gas', esc(cil.refrigerante))}${fila('Lleva', `${kgT(cil.kg)} de ${cil.capacidad_kg ? kgT(cil.capacidad_kg) : '—'} kg`)}${fila('Caben', `${kgT(libre)} kg`)}</section>
        <section class="grupo"><label class="fila-dato" style="display:block"><span>Kg que recuperas</span><input id="mant-kg" type="text" inputmode="decimal" placeholder="0,0" autocomplete="off"></label></section>
        <div class="mant-botones">
          <button class="boton" data-m="recuperar-guardar" data-id="${esc(id)}" data-cil="${esc(cil.id)}" data-motivo="reparar">Recuperar para reparar</button>
          <button class="boton peligro-suave" data-m="recuperar-guardar" data-id="${esc(id)}" data-cil="${esc(cil.id)}" data-motivo="desmontaje">Recuperar y desmontar el equipo</button>
        </div>`
      : '<div class="mant-rojo"><b>No hay cilindro de recuperación</b>No tienes en la furgoneta ningún cilindro de recuperación de ' + esc(e.refrigerante || 'este gas') + '. Añade uno en «Mi furgoneta».</div>'}`;
  }

  async function pIt3([id]) {
    const { m, c, e } = await contextoEquipo(id);
    const it3 = await m.mant.it3DeHoy(c, e);
    const op = (o, i) => `<div class="mant-op"><input type="checkbox" id="op${i}" data-op="${i}" checked>
      <label for="op${i}" style="flex:1;color:var(--texto);font-size:15px">${esc(o.texto)}<small>${esc(`Cada ${o.periodicidad} · última: ${o.ultima ? fecha(o.ultima) : 'sin registro'}`)}</small>
      <select data-motivo="${i}" hidden aria-label="Motivo">${Object.entries(MOTIVOS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label></div>`;
    $app.innerHTML = `
      <button class="volver" data-m="equipo" data-id="${esc(id)}">‹ ${esc(e.tag)}</button>
      <p class="nota">Operaciones de la IT 3 del RITE que tocan hoy a ${esc(e.tag)} (tabla ${esc(it3.tabla)}). Desmarca las que no hagas y di por qué.</p>
      <section class="grupo" id="mant-ops">${it3.hoy.map(op).join('') || '<p class="nota">Hoy no toca ninguna.</p>'}</section>
      <div class="mant-botones"><button class="boton grande" data-m="it3-guardar" data-id="${esc(id)}">Guardar IT 3</button></div>`;
    $app.querySelector('#mant-ops').addEventListener('change', (ev) => {
      const i = ev.target.dataset.op;
      if (i === undefined) return;
      $app.querySelector(`[data-motivo="${i}"]`).hidden = ev.target.checked;
    });
  }

  /* ═══════════════════════════════════ Cerrar la visita */

  async function pCerrar([edificioId]) {
    const m = M(); const c = ctx();
    const ed = await c.base.una('select nombre from edificios where id = ?', [edificioId]);
    const v = await visitaDeEdificio(edificioId);
    const res = await m.mant.resumenVisita(c, edificioId, v.id);
    const sin = res.filter((r) => !r.terminado);
    const cuenta = (r) => [r.hoy.control ? 'fugas' : null, r.hoy.cargas.length ? `${r.hoy.cargas.length} carga` : null, r.hoy.recuperaciones.length ? 'recuperación' : null, r.hoy.operaciones.length ? 'IT 3' : null, r.hoy.desmontaje ? 'desmontaje' : null].filter(Boolean).join(' · ') || 'sin anotar';
    $app.innerHTML = `
      <button class="volver" data-m="edificio" data-ed="${esc(edificioId)}">‹ Equipos</button>
      <h2 class="titulo-grupo">${esc(ed ? ed.nombre : '')}</h2>
      <section class="grupo">${res.map((r) => `<div class="fila-dato"><span>${esc(r.equipo.tag)}<br><small>${esc(cuenta(r))}</small></span>${r.terminado ? chip('bien', 'Hecho') : chip('neutra', 'Sin terminar')}</div>`).join('')}</section>
      ${sin.length ? `<p class="nota aviso">${num(sin.length)} ${sin.length === 1 ? 'equipo sin terminar pasa' : 'equipos sin terminar pasan'} a otro día. Lo que hayas anotado en ellos se firma igualmente.</p>` : ''}
      <h2 class="titulo-grupo">Tu firma</h2>
      <section class="grupo" style="padding:12px 18px"><button class="enlace mant-limpiar" data-m="limpiar" data-p="tec">Borrar</button><canvas class="mant-pizarra" id="firma-tec" aria-label="Firma del técnico"></canvas></section>
      <h2 class="titulo-grupo">Quien lo recibe (cliente)</h2>
      <section class="grupo"><div class="campos" style="padding:6px 18px 14px;margin:0"><label>Nombre<input id="cli-nombre" type="text" autocomplete="off"></label><label>Cargo<input id="cli-cargo" type="text" autocomplete="off"></label></div>
        <div style="padding:0 18px 14px"><button class="enlace mant-limpiar" data-m="limpiar" data-p="cli">Borrar</button><canvas class="mant-pizarra" id="firma-cli" aria-label="Firma del cliente"></canvas></div>
        <label class="fila-dato interruptor"><span>Firmará después, por enlace</span><input type="checkbox" id="cli-enlace"></label></section>
      <p class="nota">Cerrar la visita es definitivo: se firman las anotaciones de hoy y ya no se pueden cambiar.</p>
      <div class="mant-botones"><button class="boton grande" data-m="cerrar-guardar" data-ed="${esc(edificioId)}">Firmar y cerrar la visita</button></div>`;
    pizarras.tec = pizarra($app.querySelector('#firma-tec'));
    pizarras.cli = pizarra($app.querySelector('#firma-cli'));
  }
  const pizarras = {};

  async function pFin([edificioId, i, o]) {
    $app.innerHTML = `${vacio(`<p>Visita cerrada y firmada.</p><p style="font-size:14px;font-weight:400;color:var(--textoTenue)">${num(Number(i))} ${Number(i) === 1 ? 'intervención' : 'intervenciones'} del libro F-gas y ${num(Number(o))} ${Number(o) === 1 ? 'operación' : 'operaciones'} de IT 3.</p>`)}
      <div class="mant-botones"><button class="boton" data-m="ruta">Volver a la ruta</button></div>`;
    void edificioId;
  }

  /* ═══════════════════════════════════ Furgoneta */

  async function pFurgoneta() {
    const m = M(); const c = ctx();
    const lista = await m.mant.cilindros(c.base, c.usuarioId);
    const grupo = (uso, nombre) => {
      const xs = lista.filter((x) => x.uso === uso);
      return `<h2 class="titulo-grupo">${nombre}</h2>${xs.length ? `<ul class="lista-ios">${xs.map((x) => {
        const cap = Number(x.capacidad_kg ?? 0);
        const pct = cap ? Math.min(100, Math.round((x.kg / cap) * 100)) : null;
        return `<li><div class="fila-ios mant-cilindro" style="cursor:default"><span><strong>${esc(x.codigo)}</strong><small>${esc(x.refrigerante)}${x.origen ? ` · ${esc(x.origen)}` : ''}${x.lote ? ` · lote ${esc(x.lote)}` : ''}</small>
          ${pct !== null ? `<div class="mant-barra-gas"><i style="width:${pct}%"></i></div>` : ''}</span><b>${kgT(x.kg)}${cap ? ` / ${kgT(cap)}` : ''} kg</b></div></li>`;
      }).join('')}</ul>` : '<p class="nota">Ninguno.</p>'}`;
    };
    $app.innerHTML = `${grupo('carga', 'Para cargar')}${grupo('recuperacion', 'Para recuperar')}
      <div class="mant-botones"><button class="boton secundario" data-m="cilindro-nuevo">Añadir un cilindro</button></div>
      <p class="nota">Los kg bajan solos al cargar y suben al recuperar. Si lo deshaces, vuelven.</p>`;
  }

  async function pCilindroNuevo() {
    // REFRIGERANTES es un objeto (id → ficha); la lista de ids es IDS_REFRIGERANTES.
    const gases = M().normativa.IDS_REFRIGERANTES || ['R410A', 'R32', 'R134a', 'R404A', 'R407C', 'R290'];
    $app.innerHTML = `
      <button class="volver" data-m="furgoneta">‹ Mi furgoneta</button>
      <div class="campos" style="grid-template-columns:1fr">
        <label>Código del cilindro<input id="cl-codigo" type="text" autocomplete="off" placeholder="C-12"></label>
        <label>Para<select id="cl-uso"><option value="carga">Cargar en equipos</option><option value="recuperacion">Recuperar gas</option></select></label>
        <label>Gas<select id="cl-gas">${gases.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label>
        <label class="cl-carga">Origen<select id="cl-origen"><option value="virgen">Virgen</option><option value="regenerado">Regenerado</option><option value="reciclado">Reciclado</option></select></label>
        <label class="cl-tratado" hidden>Dónde se trató<input id="cl-lugar" type="text" autocomplete="off" placeholder="Planta o empresa autorizada"></label>
        <label class="cl-reciclado" hidden>¿Lo recuperó tu empresa?<select id="cl-propio"><option value="">No lo sé</option><option value="1">Sí</option><option value="0">No</option></select></label>
        <label>Kg que lleva<input id="cl-kg" type="text" inputmode="decimal" placeholder="0,0"></label>
        <label>Capacidad (kg)<input id="cl-cap" type="text" inputmode="decimal" placeholder="13,4"></label>
        <label>Lote<input id="cl-lote" type="text" autocomplete="off"></label>
      </div>
      <div class="mant-botones"><button class="boton grande" data-m="cilindro-guardar">Guardar cilindro</button></div>`;
  }

  /* ═══════════════════════════════════ Incidencias propias */

  async function pIncidencias() {
    const m = M(); const c = ctx();
    const lista = await m.inc.misIncidencias(c.base, c.organizacionId);
    if (!lista.length) { $app.innerHTML = vacio('<p>No tienes incidencias por corregir.</p>'); return; }
    $app.innerHTML = `<p class="nota">Las que la obra ha asignado a tu empresa. Márcala corregida y, si puedes, hazle una foto.</p>
      <ul class="lista-ios">${lista.map((i) => {
        const [cl, tx] = GRAVEDAD[i.gravedad] || ['neutra', i.gravedad];
        const hecha = i.estado === 'corregida';
        return `<li><div class="fila-ios" style="cursor:default">
          <div class="fila-principal"><strong>${esc(i.tag || 'Sin equipo')}</strong>${hecha ? chip('bien', 'Corregida') : chip(cl, tx)}</div>
          <span class="texto-2">${esc(i.titulo)}</span>
          <small class="tenue">${i.fotos ? `${num(i.fotos)} ${i.fotos === 1 ? 'foto' : 'fotos'}` : 'Sin foto'}</small>
          <div class="mant-fila-doble" style="margin-top:10px">
            ${hecha ? `<button class="boton secundario" data-m="inc-foto" data-id="${esc(i.id)}">Añadir foto</button><button class="boton peligro-suave" data-m="inc-deshacer" data-id="${esc(i.id)}">Deshacer</button>`
              : `<button class="boton" data-m="inc-corregida" data-id="${esc(i.id)}" data-foto="1">Corregida con foto</button><button class="boton secundario" data-m="inc-corregida" data-id="${esc(i.id)}" data-foto="0">Sin foto</button>`}
          </div></div></li>`;
      }).join('')}</ul>`;
  }

  /* ═══════════════════════════════════ Más: certificados, libro, alta, datos */

  async function pMas() {
    const m = M();
    const hay = await m.hayDatos();
    $app.innerHTML = `
      <ul class="lista-ios">
        <li><button class="fila-ios" data-m="certificados"><strong>Mis certificados</strong><span class="texto-2">Gases fluorados y RITE: caducidad y qué puedes hacer.</span></button></li>
        <li><button class="fila-ios" data-m="libro"><strong>Libro F-gas</strong><span class="texto-2">Controles, cargas y recuperaciones anotadas.</span></button></li>
        <li><button class="fila-ios" data-m="alta"><strong>Añadir un equipo</strong><span class="texto-2">Uno que has encontrado y no está en la ruta.</span></button></li>
        <li><button class="fila-ios" data-m="entrega"><strong>Traer un acta de entrega</strong><span class="texto-2">Los equipos de una obra recién entregada, con su historial.</span></button></li>
      </ul>
      ${await bloqueNube(m, hay)}`;
  }

  /* ═══════════════════════════════════ La cuenta de Vidaire (cuenta.ts en el motor) */

  const CLAVE_CORREO = 'vidaire.mant.correo';
  const conNube = () => Boolean(M() && M().nube && M().nube.hay);
  const horaCorta = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); };

  /** El estado en pocas palabras: «Al día · 10:42», «3 por enviar», «Sin conexión…». */
  function textoNube(e) {
    if (e.error) return e.error;
    if (e.sincronizando) return 'Enviando y recibiendo…';
    if (e.sinRed) return e.porEnviar ? `Sin conexión · ${num(e.porEnviar)} por enviar, se envían al volver la red` : 'Sin conexión';
    if (e.porEnviar) return `${num(e.porEnviar)} por enviar`;
    return e.ultima ? `Al día · ${horaCorta(e.ultima)}` : 'Al día';
  }

  async function bloqueNube(m, hay) {
    const local = hay ? '<button class="boton peligro-suave" data-m="vaciar">Borrar los datos de Mantenimiento</button>' : '<button class="boton secundario" data-m="ejemplo">Cargar datos de ejemplo</button>';
    if (!conNube()) {
      return `<h2 class="titulo-grupo">Datos de este móvil</h2><div class="mant-botones">${local}</div>
        <p class="nota">Esta versión no se conecta con Vidaire: lo que anotes aquí se queda en el teléfono.</p>`;
    }
    const e = await m.nube.estado();
    if (!e.conectado) {
      let correo = '';
      try { correo = localStorage.getItem(CLAVE_CORREO) || ''; } catch { /* nada */ }
      return `<h2 class="titulo-grupo">Vidaire</h2>
        ${e.error ? `<p class="nota">${esc(e.error)}</p>` : ''}
        <div class="campos" style="grid-template-columns:1fr">
          <label>Correo<input id="nb-correo" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(correo)}"></label>
          <label>Contraseña<input id="nb-clave" type="password" autocomplete="current-password"></label>
        </div>
        <div class="mant-botones"><button class="boton" data-m="nube-entrar">Entrar en Vidaire</button></div>
        <p class="nota">Con tu usuario de Vidaire te llega la ruta que te asigna la oficina y lo que anotes se envía solo, también lo hecho sin cobertura.${hay ? ' Los datos de ejemplo de este móvil se quitan al entrar.' : ''}</p>
        <div class="mant-botones">${local}</div>`;
    }
    const rech = e.rechazados ? await m.nube.rechazados() : [];
    return `<h2 class="titulo-grupo">Vidaire</h2>
      <section class="grupo">${fila('Usuario', esc(e.correo || ''))}${fila('Estado', esc(textoNube(e)))}
        ${e.conflictos ? fila('Cambios en los que ganó la oficina', num(e.conflictos)) : ''}</section>
      ${rech.length ? `<h2 class="titulo-grupo">No aceptado por Vidaire</h2>
        <section class="grupo">${rech.map((r) => fila(r.tabla.replace(/_/g, ' '), esc(r.mensaje.replace(/^[A-Z0-9]+: /, '')))).join('')}</section>` : ''}
      <div class="mant-botones"><button class="boton secundario" data-m="nube-sync">Sincronizar ahora</button>
        <button class="boton peligro-suave" data-m="nube-salir">Salir de Vidaire</button></div>`;
  }

  /* Al acabar una vuelta: repintar la lista si ha entrado algo (nunca un formulario a medias). */
  window.addEventListener('vidaire:mant-sync', (ev) => {
    if (window.VIDAIRE_MODO() !== 'mant') return;
    const r = partes();
    if (!r) return;
    const escribiendo = document.activeElement && $app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (escribiendo) return;
    const v = ev.detail && ev.detail.vuelta;
    if (r[0] === 'mas' || (['ruta', 'edificio', 'incidencias', 'furgoneta'].includes(r[0]) && v && v.filas)) repintar();
  });

  async function pCertificados() {
    const m = M(); const c = ctx();
    const lista = await m.mant.misCertificados(c);
    const acts = [['control_fugas', 'Control de fugas'], ['carga', 'Cargar gas'], ['recuperacion', 'Recuperar gas']];
    const hab = m.reglas.habilitacion(lista, 'carga', 42, c.hoy);
    void hab;
    $app.innerHTML = `
      ${lista.length ? `<ul class="lista-ios">${lista.map((x) => {
        const dias = x.caduca_el ? m.normativa.diasEntre(c.hoy, x.caduca_el) : null;
        const [cl, tx] = dias === null ? ['neutra', 'Sin caducidad'] : dias < 0 ? ['mal', 'Caducado'] : dias <= 60 ? ['aviso', `Caduca en ${dias} días`] : ['bien', 'Vigente'];
        return `<li><div class="fila-ios" style="cursor:default"><div class="fila-principal"><strong>${esc(x.esquema === 'fgas' ? 'Gases fluorados' : x.esquema === 'rite' ? 'RITE' : x.esquema)}</strong>${chip(cl, tx)}</div>
          <span class="texto-2">${esc(x.categoria)} · nº ${esc(x.numero)}</span><small class="tenue">Hasta el ${esc(fecha(x.caduca_el))}</small></div></li>`;
      }).join('')}</ul>` : vacio('<p>No tienes ningún certificado anotado.</p>')}
      ${lista.some((x) => x.esquema === 'fgas') ? `<h2 class="titulo-grupo">Con el de gases fluorados puedes</h2><section class="grupo">${acts.map(([k, n]) => {
        const h1 = m.reglas.habilitacion(lista, k, 100, c.hoy); const h2 = m.reglas.habilitacion(lista, k, 2, c.hoy);
        return fila(n, h1.puede ? 'Cualquier carga' : h2.puede ? 'Menos de 3 kg' : 'No');
      }).join('')}</section>` : ''}
      <h2 class="titulo-grupo">Añadir un certificado</h2>
      <div class="campos" style="grid-template-columns:1fr">
        <label>Tipo<select id="ce-esquema"><option value="fgas">Gases fluorados</option><option value="rite">RITE (instalador / mantenedor)</option></select></label>
        <label>Categoría<select id="ce-cat"><option value="I1 · cualquier carga">Cualquier carga</option><option value="I2 · menos de 3 kg">Menos de 3 kg</option></select></label>
        <label>Número<input id="ce-num" type="text" autocomplete="off"></label>
        <label>Expedido el<input id="ce-exp" type="date"></label>
        <label>Caduca el<input id="ce-cad" type="date"></label>
      </div>
      <div class="mant-botones"><button class="boton" data-m="cert-guardar">Guardar certificado</button></div>`;
  }

  async function pLibro() {
    const c = ctx();
    const filas = await c.base.todas(`select i.id, i.tipo, i.resultado, i.realizada_en, i.estado, e.tag, e.refrigerante,
        (select sum(kg) from movimientos_gas m where m.intervencion_id = i.id) as kg,
        (select max(cilindro) from movimientos_gas m where m.intervencion_id = i.id) as cilindro
      from intervenciones i join equipos e on e.id = i.equipo_id
      where i.borrado_en is null order by i.realizada_en desc limit 120`);
    if (!filas.length) { $app.innerHTML = vacio('<p>El libro está vacío. Aquí irán los controles, cargas y recuperaciones.</p>'); return; }
    const toneladas = filas.filter((f) => f.tipo === 'carga').reduce((a, f) => a + Number(f.kg || 0), 0);
    $app.innerHTML = `
      <div class="resumen-fila"><div><b>${num(filas.length)}</b><span>anotaciones</span></div><div><b>${num(filas.filter((f) => f.tipo === 'control_fugas').length)}</b><span>controles</span></div>
        <div><b>${kgT(toneladas)}</b><span>kg cargados</span></div><div class="${filas.some((f) => f.estado === 'borrador') ? 'aviso' : ''}"><b>${num(filas.filter((f) => f.estado === 'borrador').length)}</b><span>sin firmar</span></div></div>
      <ul class="lista-ios">${filas.map((f) => `<li><div class="fila-ios" style="cursor:default"><div class="fila-principal"><strong>${esc(f.tag)} · ${esc(TIPO_INTERV[f.tipo] || f.tipo)}</strong>${f.estado === 'borrador' ? chip('aviso', 'Sin firmar') : chip('bien', 'Firmada')}</div>
        <span class="texto-2">${esc([fecha(f.realizada_en), f.refrigerante, RESULTADO[f.resultado], f.kg ? `${kgT(f.kg)} kg` : null, f.cilindro].filter(Boolean).join(' · '))}</span></div></li>`).join('')}</ul>`;
  }

  async function pAlta([edificioId]) {
    const m = M(); const c = ctx();
    const eds = await c.base.todas('select id, nombre from edificios where borrado_en is null order by nombre');
    if (!eds.length) { $app.innerHTML = vacio('<p>Primero hace falta un edificio. Carga los datos de ejemplo en «Más».</p>'); return; }
    const ed = edificioId || eds[0].id;
    const ubis = await m.mant.ubicacionesDelEdificio(c.base, ed);
    const gases = m.normativa.REFRIGERANTES ? m.normativa.REFRIGERANTES.map((r) => r.id) : ['R410A', 'R32', 'R134a', 'R404A', 'R407C', 'R290'];
    $app.innerHTML = `
      <button class="volver" data-m="atras">‹ Volver</button>
      <p class="nota">Para un equipo que has encontrado y no estaba. Se apunta con lo que pone la placa.</p>
      <div class="campos" style="grid-template-columns:1fr">
        <label>Edificio<select id="al-ed" data-m="alta-ed">${eds.map((x) => `<option value="${esc(x.id)}" ${x.id === ed ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
        <label>Dónde<select id="al-ubi"><option value="">Sin indicar</option>${ubis.map((u) => `<option value="${esc(u.id)}">${esc(u.nombre)}</option>`).join('')}</select></label>
        <label>Etiqueta o TAG<input id="al-tag" type="text" autocomplete="off" placeholder="SPL-12"></label>
        <label>Tipo<select id="al-tipo">${TIPOS_EQUIPO.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
        <label>Fabricante<input id="al-fab" type="text" autocomplete="off"></label>
        <label>Modelo<input id="al-mod" type="text" autocomplete="off"></label>
        <label>Nº de serie<input id="al-serie" type="text" autocomplete="off"></label>
        <label>Gas<select id="al-gas"><option value="">Sin gas fluorado</option>${gases.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label>
        <label>Carga de fábrica (kg)<input id="al-carga" type="text" inputmode="decimal" placeholder="0,0"></label>
        <label>Gas añadido al instalar (kg)<input id="al-extra" type="text" inputmode="decimal" placeholder="0"></label>
        <label>Potencia frío (kW)<input id="al-kw" type="text" inputmode="decimal"></label>
      </div>
      <div class="mant-botones"><button class="boton grande" data-m="alta-guardar">Añadir el equipo</button></div>`;
  }

  /* ═══════════════════════════════════ El acta de entrega de una obra (entrega.ts) */

  /* El acta leída y el edificio elegido, mientras se está en la pantalla. */
  let entregaActa = null;
  let entregaEd = null;

  async function pEntrega() {
    const m = M(); const c = ctx();
    const eds = await c.base.todas('select id, nombre from edificios where borrado_en is null order by nombre');
    if (!eds.length) { $app.innerHTML = vacio('<p>Primero hace falta el edificio del contrato. Entra en Vidaire en «Más».</p>'); return; }
    if (!eds.some((x) => x.id === entregaEd)) entregaEd = eds[0].id;
    let resumen = '';
    if (entregaActa) {
      const v = await m.entrega.previsualizarEntrega(c.base, entregaActa, entregaEd);
      const a = entregaActa.acta;
      resumen = `
        <section class="grupo">
          ${fila('Acta', esc(`${a.numero} · ${fecha(a.fecha)}`))}
          ${fila('Obra', esc((a.obra && (a.obra.codigo || a.obra.nombre)) || '—'))}
          ${fila('Firma', esc((a.firmante && a.firmante.nombre) || '—'))}
          ${fila('Equipos nuevos', num(v.nuevos.length))}
          ${v.conReservas ? fila('Con reservas de la obra', num(v.conReservas)) : ''}
          ${v.yaEstan.length ? fila('Ya están en el edificio', esc(v.yaEstan.join(', '))) : ''}
        </section>
        <div class="mant-botones"><button class="boton grande" data-m="entrega-traer" ${v.nuevos.length ? '' : 'disabled'}>${v.nuevos.length ? `Traer ${num(v.nuevos.length)} equipos` : 'Nada nuevo que traer'}</button></div>`;
    }
    $app.innerHTML = `
      <button class="volver" data-m="atras">‹ Volver</button>
      <p class="nota">El acta firmada en Vidaire Obras (Commissioning › Entregas › «Guardar para mantenimiento»). Sus equipos entran en el edificio ya en operación, con su historial de obra dentro.</p>
      <div class="campos" style="grid-template-columns:1fr">
        <label>Edificio del contrato<select id="en-ed">${eds.map((x) => `<option value="${esc(x.id)}" ${x.id === entregaEd ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
        <label>Acta (.json)<input id="en-fichero" type="file" accept=".json,application/json"></label>
      </div>
      ${resumen}`;
  }

  /* ═══════════════════════════════════ Escanear */

  async function pEscanear() {
    $app.innerHTML = `
      <div class="mant-qr"><p class="nota" style="margin-bottom:16px">Haz una foto al QR de la etiqueta del equipo.</p>
        <button class="boton grande" data-m="foto-qr">Escanear el QR</button></div>
      <h2 class="titulo-grupo">O escribe su TAG</h2>
      <section class="grupo"><label class="fila-dato" style="display:block"><span>TAG o código de la etiqueta</span><input id="mant-tag" type="text" autocomplete="off" autocapitalize="characters" placeholder="VRF-01"></label></section>
      <div class="mant-botones"><button class="boton secundario" data-m="buscar-tag">Buscar</button></div>
      <p class="nota" id="mant-qr-msg"></p>`;
  }

  async function abrirPorTexto(textos) {
    const m = M(); const c = ctx();
    for (const t of textos) {
      const e = await m.mant.buscarPorQr(c.base, t);
      if (e) { location.hash = `m/equipo/${encodeURIComponent(e.id)}`; return true; }
      const cil = await m.mant.cilindroPorCodigo(c.base, t, c.usuarioId);
      if (cil) { location.hash = 'm/furgoneta'; return true; }
    }
    return false;
  }

  function pluginQr() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    try { return cap.registerPlugin('LectorAlbaran'); } catch { return null; }
  }

  /* ═══════════════════════════════════ Un solo gestor de toques */

  const leerNum = (id) => M().formato.leerCantidad(($app.querySelector(id) || {}).value || '');
  const valor = (id) => (($app.querySelector(id) || {}).value || '').trim();
  let cilElegido = null;

  $app.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-m]');
    if (!b || window.VIDAIRE_MODO() !== 'mant') return;
    const a = b.dataset.m;
    const m = M();
    try {
      if (a === 'ruta' || a === 'furgoneta' || a === 'certificados' || a === 'libro' || a === 'entrega') { location.hash = `m/${a}`; return; }
      if (a === 'entrega-traer') {
        b.disabled = true;
        const r = await m.entrega.importarEntrega(ctx(), entregaActa, entregaEd);
        aviso(`${num(r.altas.length)} equipos traídos del acta ${entregaActa.acta.numero}${r.yaEstaban.length ? ` · ${num(r.yaEstaban.length)} ya estaban` : ''}. Se envían a Vidaire con lo demás.`, 'bien');
        entregaActa = null;
        repintar();
        return;
      }
      if (a === 'atras') { history.length > 1 ? history.back() : (location.hash = 'm/ruta'); return; }
      if (a === 'edificio') { location.hash = `m/edificio/${encodeURIComponent(b.dataset.ed)}`; return; }
      if (a === 'equipo') { location.hash = `m/equipo/${encodeURIComponent(b.dataset.id)}`; return; }
      if (a === 'alta') { location.hash = b.dataset.ed ? `m/alta/${encodeURIComponent(b.dataset.ed)}` : 'm/alta'; return; }
      if (a === 'cerrar' || a === 'cerrar-visita') { location.hash = `m/cerrar/${encodeURIComponent(b.dataset.ed)}`; return; }
      if (a === 'cilindro-nuevo') { location.hash = 'm/cilindro'; return; }
      if (a === 'ficha-tab') { pestanaFicha = b.dataset.tab; repintar(); return; }
      if (a === 'limpiar') { pizarras[b.dataset.p]?.limpiar(); return; }
      if (a === 'ejemplo') { b.disabled = true; await m.ejemplo(); aviso('Datos de ejemplo cargados.', 'bien'); location.hash = 'm/ruta'; repintar(); return; }
      if (a === 'nube-entrar') {
        const correo = ($app.querySelector('#nb-correo')?.value || '').trim();
        const clave = $app.querySelector('#nb-clave')?.value || '';
        if (!correo || !clave) { aviso('Escribe tu correo y tu contraseña de Vidaire.'); return; }
        try { localStorage.setItem(CLAVE_CORREO, correo); } catch { /* nada */ }
        b.disabled = true; b.textContent = 'Entrando…';
        try {
          const yo = await m.nube.entrar(correo, clave);
          aviso(`Hola, ${yo.nombre}. Tu ruta ya está en el móvil.`, 'bien');
          location.hash = 'm/ruta';
        } catch (e) { aviso(e && e.esDeRed ? 'Sin conexión: prueba cuando tengas cobertura.' : (e && e.message) || String(e)); }
        repintar();
        return;
      }
      if (a === 'nube-sync') {
        b.disabled = true; b.textContent = 'Sincronizando…';
        const r = await m.nube.sincronizar();
        const e = await m.nube.estado();
        aviso(textoNube(e), r && !r.sinRed && !e.error ? 'bien' : 'mal');
        repintar();
        return;
      }
      if (a === 'nube-salir') {
        const e = await m.nube.estado();
        const pierde = e.porEnviar > 0;
        const ok = await confirmar(pierde ? `Hay ${num(e.porEnviar)} cambios sin enviar` : '¿Salir de Vidaire?',
          pierde ? 'Si sales ahora se pierden. Mejor sincroniza antes con cobertura.' : 'Tu ruta y lo anotado se quitan de este móvil; en Vidaire sigue todo.',
          pierde ? 'Salir y perderlos' : 'Sí, salir', 'No, volver');
        if (!ok) return;
        try { await m.nube.salir(pierde); aviso('Has salido de Vidaire.', 'bien'); } catch (x) { aviso((x && x.message) || String(x)); }
        repintar();
        return;
      }
      if (a === 'vaciar') {
        if (await confirmar('¿Borrar los datos de Mantenimiento?', 'Se quita todo lo que hay en este móvil: ruta, equipos, cilindros y lo anotado.', 'Sí, borrar', 'No, dejarlos')) { await m.vaciar(); aviso('Datos borrados.', 'bien'); repintar(); }
        return;
      }

      /* ── fugas */
      if (a === 'sin-fuga') {
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const id = await conBloqueo(() => m.mant.sinFuga(c, v, e));
        if (id) repintar();
        return;
      }
      if (a === 'fuga') { location.hash = `m/fuga/${encodeURIComponent(b.dataset.id)}`; return; }
      if (a === 'fuga-guardar') {
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const donde = valor('#mant-donde') || 'no_localizada';
        const id = await conBloqueo(() => m.mant.hayFuga(c, v, e, donde, b.dataset.rep === '1'));
        if (id) location.hash = `m/equipo/${encodeURIComponent(b.dataset.id)}`;
        return;
      }

      /* ── gas */
      if (a === 'gas') { cilElegido = null; location.hash = `m/gas/${encodeURIComponent(b.dataset.id)}`; return; }
      if (a === 'cil-elegir') {
        cilElegido = b.dataset.cil;
        const fila1 = await ctx().base.una('select codigo, kg from cilindros where id = ?', [cilElegido]);
        $app.querySelector('#mant-cantidad').hidden = false;
        $app.querySelector('#mant-cil-nombre').textContent = `Del cilindro ${fila1.codigo} (quedan ${M().formato.kg(fila1.kg)} kg)`;
        $app.querySelectorAll('[data-m="cil-elegir"]').forEach((x) => x.classList.toggle('activa', x === b));
        $app.querySelector('#mant-kg').focus();
        return;
      }
      if (a === 'gas-guardar') {
        if (!cilElegido) { aviso('Elige antes el cilindro.'); return; }
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const cil = await c.base.una('select * from cilindros where id = ?', [cilElegido]);
        const r = await conBloqueo(() => m.mant.cargarGas(c, v, e, cil, leerNum('#mant-kg')));
        if (!r) return;
        if (r.preguntarFuga) {
          const resp = await C.menu({
            titulo: 'Has añadido gas', sub: `Eso es el ${num(r.porcentaje, 0)} % de la carga. Si falta gas es que hay fuga: ¿la has encontrado?`,
            opciones: [{ id: 'reparada', nombre: 'Sí, y la he reparado' }, { id: 'pendiente', nombre: 'Sí, queda pendiente de reparar' }, { id: 'no_localizada', nombre: 'No la he localizado' }, { id: 'ninguna', nombre: 'No hay fuga (solo era ajuste)' }],
          });
          if (resp && resp !== 'ninguna') await conBloqueo(() => m.mant.respuestaFuga(c, v, e, resp, r.id));
        }
        cilElegido = null;
        location.hash = `m/equipo/${encodeURIComponent(b.dataset.id)}`;
        return;
      }
      if (a === 'recuperar') { location.hash = `m/recuperar/${encodeURIComponent(b.dataset.id)}`; return; }
      if (a === 'recuperar-guardar') {
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const cil = await c.base.una('select * from cilindros where id = ?', [b.dataset.cil]);
        const motivo = b.dataset.motivo;
        if (motivo === 'desmontaje' && !(await confirmar('¿Desmontar el equipo?', `${e.tag} se da de baja y sale de la ruta. No se puede deshacer.`, 'Sí, desmontar', 'No, volver'))) return;
        const id = await conBloqueo(() => m.mant.recuperarGas(c, v, e, cil, leerNum('#mant-kg'), motivo));
        if (id) location.hash = motivo === 'desmontaje' ? `m/edificio/${encodeURIComponent(e.edificio_id)}` : `m/equipo/${encodeURIComponent(b.dataset.id)}`;
        return;
      }
      if (a === 'deshacer') { await m.mant.borrarBorrador(ctx(), b.dataset.id); repintar(); return; }
      if (a === 'deshacer-it3') {
        const c = ctx();
        const ids = (await m.mant.hechoHoy(c, b.dataset.id)).operaciones.map((o) => o.id);
        await m.mant.deshacerIt3(c, ids);
        repintar();
        return;
      }

      /* ── IT 3 */
      if (a === 'it3') { location.hash = `m/it3/${encodeURIComponent(b.dataset.id)}`; return; }
      if (a === 'it3-guardar') {
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const it3 = await m.mant.it3DeHoy(c, e);
        const ops = it3.hoy.map((op, i) => {
          const hecha = $app.querySelector(`[data-op="${i}"]`).checked;
          return { op, hecha, motivo: hecha ? null : $app.querySelector(`[data-motivo="${i}"]`).value };
        });
        const r = await conBloqueo(() => m.mant.guardarIt3(c, v, e, ops));
        if (r) location.hash = `m/equipo/${encodeURIComponent(b.dataset.id)}`;
        return;
      }

      /* ── terminar un equipo */
      if (a === 'terminar') {
        const { c, e, v } = await contextoEquipo(b.dataset.id);
        const r = await m.mant.terminarEquipo(c, v, e, e.edificio_id);
        if (r.falta === 'fugas') { aviso('Falta el control de fugas: pulsa «Sin fuga» o «Hay fuga».'); return; }
        if (r.falta === 'it3') { aviso('Faltan las operaciones de la IT 3 de hoy.'); return; }
        location.hash = r.siguiente ? `m/equipo/${encodeURIComponent(r.siguiente.id)}` : `m/edificio/${encodeURIComponent(e.edificio_id)}`;
        if (!r.siguiente) aviso('Equipos terminados. Ya puedes cerrar la visita.', 'bien');
        return;
      }

      /* ── cerrar la visita */
      if (a === 'cerrar-guardar') {
        const c = ctx();
        if (!pizarras.tec || pizarras.tec.vacia()) { aviso('Falta tu firma.'); return; }
        const enlace = $app.querySelector('#cli-enlace').checked;
        const cliSvg = pizarras.cli.vacia() ? null : pizarras.cli.svg();
        const nombre = valor('#cli-nombre') || null;
        if (!cliSvg && !enlace) { aviso('Falta la firma del cliente, o marca que firmará después por enlace.'); return; }
        if (!(await confirmar('¿Cerrar la visita?', 'Se firman las anotaciones de hoy y ya no se pueden cambiar.', 'Sí, firmar y cerrar', 'No, volver'))) return;
        const v = await visitaDeEdificio(b.dataset.ed);
        const r = await m.mant.cerrarVisita(c, v, b.dataset.ed, { tecnico: pizarras.tec.svg(), cliente: { nombre, cargo: valor('#cli-cargo') || null, svg: cliSvg, enlace } });
        location.hash = `m/fin/${encodeURIComponent(b.dataset.ed)}/${r.intervenciones}/${r.operaciones}`;
        return;
      }

      /* ── furgoneta */
      if (a === 'cilindro-guardar') {
        const c = ctx();
        const uso = valor('#cl-uso');
        const propio = valor('#cl-propio');
        const id = await conBloqueo(() => m.mant.altaCilindro(c, {
          codigo: valor('#cl-codigo'), uso, refrigerante: valor('#cl-gas'), kg: leerNum('#cl-kg'), capacidad_kg: leerNum('#cl-cap'),
          lote: valor('#cl-lote'), origen: uso === 'carga' ? valor('#cl-origen') : null, lugar_tratamiento: valor('#cl-lugar'),
          reciclado_por_mi_empresa: propio === '' ? null : propio === '1',
        }));
        if (!id) return;
        if (conNube()) void m.nube.sincronizar();
        aviso('Cilindro añadido.', 'bien');
        location.hash = 'm/furgoneta';
        return;
      }

      /* ── incidencias */
      if (a === 'inc-corregida' || a === 'inc-foto') {
        const c = ctx();
        let foto = null;
        if (a === 'inc-foto' || b.dataset.foto === '1') {
          const f = await C.elegirFoto(true);
          if (!f && a === 'inc-foto') return;
          if (f) foto = { uri: await leerArchivo(f), mime: f.type || 'image/jpeg' };
        }
        if (a === 'inc-foto') await m.inc.fotoDeCorreccion(c, b.dataset.id, foto);
        else {
          const inc = await c.base.una('select id, estado from incidencias where id = ?', [b.dataset.id]);
          await m.inc.marcarCorregida(c, inc, foto);
        }
        repintar();
        return;
      }
      if (a === 'inc-deshacer') { await m.inc.deshacerCorregida(ctx(), b.dataset.id); repintar(); return; }

      /* ── certificados */
      if (a === 'cert-guardar') {
        const c = ctx();
        const numero = valor('#ce-num');
        if (!numero) { aviso('Falta el número del certificado.'); return; }
        await m.almacen.insertar(c.base, 'certificados_tecnico', {
          id: m.uuid(), usuario_id: c.usuarioId, organizacion_id: c.organizacionId, esquema: valor('#ce-esquema'), categoria: valor('#ce-cat'),
          numero, expedido_el: valor('#ce-exp') || null, caduca_el: valor('#ce-cad') || null,
        });
        aviso('Certificado guardado.', 'bien');
        repintar();
        return;
      }

      /* ── alta de equipo */
      if (a === 'alta-guardar') {
        const c = ctx();
        const tag = valor('#al-tag');
        if (!tag) { aviso('Falta el TAG o la etiqueta del equipo.'); return; }
        const edId = valor('#al-ed');
        const ed = await c.base.una('select titular_id from edificios where id = ?', [edId]);
        const gas = valor('#al-gas') || null;
        const id = await m.mant.altaEquipo(c, {
          edificioId: edId, titularId: ed ? ed.titular_id : 'sin-titular', tag: m.mant.tagDeEtiqueta(tag), tipo: valor('#al-tipo'),
          fabricante: valor('#al-fab') || null, modelo: valor('#al-mod') || null, numeroSerie: valor('#al-serie') || null, refrigerante: gas,
          cargaFabricaKg: gas ? leerNum('#al-carga') || null : null, cargaAnadidaKg: gas ? leerNum('#al-extra') || 0 : 0,
          potenciaFrioKw: leerNum('#al-kw') || null, ubicacionId: valor('#al-ubi') || null, qrToken: tag, fotoPlaca: null,
        });
        aviso('Equipo añadido.', 'bien');
        location.hash = `m/equipo/${encodeURIComponent(id)}`;
        return;
      }

      /* ── escanear */
      if (a === 'buscar-tag') {
        const t = valor('#mant-tag');
        if (!t) return;
        if (!(await abrirPorTexto([t]))) $app.querySelector('#mant-qr-msg').textContent = `No encuentro «${t}» en el móvil.`;
        return;
      }
      if (a === 'foto-qr') {
        const msg = $app.querySelector('#mant-qr-msg');
        const plugin = pluginQr();
        if (!plugin) { msg.textContent = 'En este teléfono el QR no se lee solo todavía: escribe el TAG.'; return; }
        const f = await C.elegirFoto(true);
        if (!f) return;
        msg.textContent = 'Leyendo…';
        const url = await leerArchivo(f);
        const r = await plugin.qr({ imagen: url.split(',')[1] });
        const textos = (r && r.textos) || [];
        if (!textos.length) { msg.textContent = 'No he visto ningún QR en la foto. Prueba de nuevo, más cerca.'; return; }
        if (!(await abrirPorTexto(textos))) msg.textContent = 'He leído el QR pero ese equipo no está en el móvil.';
      }
    } catch (err) {
      aviso(err && err.message ? err.message : String(err));
    }
  });

  $app.addEventListener('change', (ev) => {
    if (ev.target.matches('#al-ed')) location.hash = `m/alta/${encodeURIComponent(ev.target.value)}`;
    if (ev.target.matches('#en-ed')) { entregaEd = ev.target.value; repintar(); }
    if (ev.target.matches('#en-fichero') && ev.target.files && ev.target.files[0]) {
      ev.target.files[0].text().then((texto) => {
        try { entregaActa = M().entrega.leerEntrega(texto); } catch (e) { entregaActa = null; aviso(e.message); }
        repintar();
      });
    }
    if (ev.target.matches('#cl-uso, #cl-origen')) {
      // Solo se pregunta lo que pide la ley para ese cilindro.
      const carga = valor('#cl-uso') === 'carga';
      const origen = valor('#cl-origen');
      $app.querySelector('.cl-carga').hidden = !carga;
      $app.querySelector('.cl-tratado').hidden = !carga || origen === 'virgen';
      $app.querySelector('.cl-reciclado').hidden = !carga || origen !== 'reciclado';
    }
  });

  /* ═══════════════════════════════════ Arranque */

  function arrancar() {
    if (!sesion()) { setTimeout(arrancar, 400); return; }
    if (window.VIDAIRE_MODO() === 'mant') {
      document.body.classList.add('modo-mant');
      if (!partes()) location.hash = 'm/ruta'; else ir();
    } else ir();
  }
  /* Con un rol de Mantenimiento, ni la carcasa ni este script se pisan: pintar() de la carcasa ya no hace nada. */
  arrancar();
})();
