'use strict';
/*
 * DÓNDE ESTOY, ENCIMA DEL PLANO DE CX (18-nov-2026, JC en Plano: «¿podríamos tener algún tipo de circulito que
 * marque dónde estoy?»; nota e9f5c1b6). La regla es shared/commissioning/posicionEnPlano.js (window.POSICION_PLANO); esto es
 * solo la capa: el punto violeta (aro blanco, halo que palpita, círculo de precisión), el botón «Dónde estoy», el aviso
 * discreto y el «fijar el plano con dos puntos» del jefe.
 *
 *   · El permiso de ubicación se pide SOLO al tocar «Dónde estoy», nunca al abrir.
 *   · Por contexto: al abrir un equipo (ficha o placa leída), al tocarlo en el plano o al tocar una sala, el punto va a
 *     su sitio (sin pastilla con la hora junto al punto: JC, 18-nov), hasta que llegue algo mejor (gana lo más reciente que sea bueno).
 *   · planoEquipos.js solo llama a montar() al pintar y a contexto() al elegir: así esta capa no toca su dibujo.
 */
(function posicionPlanoCapa() {
  const PZ = window.POSICION_PLANO;
  const C = window.CX;
  if (!PZ || !C) return;
  const { esc } = C;
  const K = PZ.COLOR;
  const VIGENCIA_CTX = 12 * 3600 * 1000;

  let $raiz = null; let planta = null; let salas = [];
  let geo = null; let geoDe = ''; let puedeFijar = false; const geoCache = new Map();
  let gps = null; let vigia = null;
  let ctx = null; /* { equipoId, tag, sala, planta, origen, en } */
  let fijando = null; /* { puntos: [], lat, lon } */
  let cerrado = ''; /* el aviso que el usuario ya ha cerrado */
  let bajo = null; /* el último pointerdown en el lienzo (para no confundir un arrastre con un toque) */

  const obra = () => (C.obraId && C.obraId()) || '';
  const clave = () => `cx.posicion.${obra()}`;
  let ctxDe = null; /* la obra de la que se leyó ctx */
  function leerCtx() {
    if (ctxDe === obra()) return;
    ctxDe = obra(); ctx = null;
    try { const v = JSON.parse(localStorage.getItem(clave()) || 'null'); if (v && Date.now() - v.en < VIGENCIA_CTX) ctx = v; } catch { /* sin almacenamiento */ }
  }

  function estilo() {
    if (document.getElementById('estilo-posicion-plano')) return;
    const s = document.createElement('style');
    s.id = 'estilo-posicion-plano';
    s.textContent = `
  .pe-visor{position:relative}
  .pz-capa{position:absolute;inset:0;pointer-events:none;z-index:6}
  .pz-precision{position:absolute;transform:translate(-50%,-50%);aspect-ratio:1;border-radius:50%;background:${K.precision};border:1px solid ${K.bordePrecision};box-sizing:border-box}
  .pz-punto{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:${K.punto};border:3px solid ${K.aro};box-sizing:border-box;box-shadow:0 0 0 0 ${K.halo},0 1px 3px rgba(0,0,0,.35);animation:pzHalo 1.8s ease-out infinite}
  .pz-punto.pz-ctx{width:16px;height:16px;margin:-8px 0 0 -8px}
  @keyframes pzHalo{0%{box-shadow:0 0 0 0 ${K.halo},0 1px 3px rgba(0,0,0,.35)}70%{box-shadow:0 0 0 14px rgba(124,58,237,0),0 1px 3px rgba(0,0,0,.35)}100%{box-shadow:0 0 0 0 rgba(124,58,237,0),0 1px 3px rgba(0,0,0,.35)}}
  @media (prefers-reduced-motion:reduce){.pz-punto{animation:none;box-shadow:0 0 0 6px ${K.halo}}}
  .pz-aviso{position:absolute;left:8px;top:8px;right:8px;z-index:7;display:flex;gap:6px;align-items:center;max-width:max-content;font:500 12px/16px system-ui,sans-serif;color:var(--texto,#262b38);background:color-mix(in srgb,var(--papel,#fff) 94%,transparent);border-left:3px solid ${K.punto};border-radius:6px;padding:4px 6px 4px 8px;box-shadow:0 1px 4px rgba(0,0,0,.12)}
  .pz-aviso button{border:0;background:none;color:${K.punto};font:700 12px/16px system-ui,sans-serif;padding:2px 4px;cursor:pointer}
  .pz-boton{position:absolute;right:8px;bottom:8px;z-index:7;width:40px;height:40px;min-width:0;min-height:0;margin:0;padding:0;border-radius:50%;border:1px solid rgba(38,43,56,.15);background:var(--papel,#fff);box-shadow:0 1px 4px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;cursor:pointer}
  .pz-boton[hidden]{display:none}
  .pz-boton i{width:12px;height:12px;border-radius:50%;background:${K.punto};box-shadow:0 0 0 2px #fff,0 0 0 3px ${K.punto}}
  .pz-boton[aria-pressed="true"]{border-color:${K.punto};box-shadow:0 0 0 2px ${K.halo},0 1px 4px rgba(0,0,0,.2)}
  .pz-fijar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%;font:500 12px/16px system-ui,sans-serif;border-left:3px solid ${K.punto};padding:4px 0 4px 8px}
  .pz-fijar input{font-size:16px;min-width:0;flex:1 1 160px;padding:4px 6px}
  .pe-marco.pz-fijando{cursor:crosshair}`;
    document.head.appendChild(s);
  }

  const lienzo = () => $raiz && $raiz.querySelector('[data-pe-lienzo]');
  const planoId = () => (planta && planta.plano && planta.plano.id) || '';

  async function traerGeo() {
    const id = planoId();
    if (!id) { geo = null; geoDe = ''; return; }
    if (geoCache.has(id)) { ({ geo, puedeFijar } = geoCache.get(id)); geoDe = id; return; }
    try {
      const r = await C.pedir(`api/plano-equipos/georreferencia?obra=${encodeURIComponent(obra())}&plano=${encodeURIComponent(id)}`);
      const g = r && r.ok && r.georreferencia ? PZ.crearGeorreferencia(r.georreferencia.puntos, r.georreferencia) : null;
      const v = { geo: g && g.ok ? g : null, puedeFijar: Boolean(r && r.puedeFijar) };
      geoCache.set(id, v);
      if (planoId() === id) { ({ geo, puedeFijar } = v); geoDe = id; pintar(); }
    } catch { geo = null; }
  }

  /** planoEquipos.js lo llama al final de cada pintar(): pone el botón, el punto y el aviso sobre lo recién pintado. */
  function montar(raiz, p, extra = {}) {
    estilo();
    leerCtx();
    $raiz = raiz; planta = p; salas = extra.salas || (p && p.plano && p.plano.salas) || [];
    if (!p || !p.plano) { parar(); return; }
    if (geoDe !== planoId()) { geo = null; traerGeo(); }
    if (window.CX_PLANTA_AUTO) window.CX_PLANTA_AUTO.montar(raiz, p, extra);
    pintar();
  }

  /** Lo que dice la última posición por contexto sobre la planta abierta. */
  function posCtx() {
    if (!ctx || !planta) return null;
    return PZ.posicionPorContexto({ planta: planta.planta || '', equipos: planta.equipos || [], salas }, ctx);
  }

  function pintar() {
    const l = lienzo();
    if (!l) return;
    /* 18-nov (JC): «Dónde estoy» es un botón redondo pequeño, solo el punto violeta, en la esquina del plano (como los mapas).
       Sin georreferencia no sale; al jefe que puede fijar el plano sí, para poder fijarlo. */
    const visorB = l.closest('.pe-visor');
    let b = visorB && visorB.querySelector('[data-pz-donde]');
    if (visorB && !b) {
      b = document.createElement('button');
      b.type = 'button'; b.className = 'pz-boton'; b.dataset.pzDonde = '1';
      b.setAttribute('aria-label', 'Dónde estoy'); b.title = 'Dónde estoy';
      b.innerHTML = '<i aria-hidden="true"></i>';
      visorB.appendChild(b);
    }
    if (b) { b.hidden = !(geo || puedeFijar); b.setAttribute('aria-pressed', String(Boolean(vigia !== null))); }
    const marco = $raiz.querySelector('[data-pe-marco]');
    if (marco) marco.classList.toggle('pz-fijando', Boolean(fijando));
    let capa = l.querySelector('[data-pz-capa]');
    if (!capa) { capa = document.createElement('div'); capa.className = 'pz-capa'; capa.dataset.pzCapa = '1'; l.appendChild(capa); }
    const c = posCtx();
    const g = !gps ? null : gps.coords ? PZ.posicionGps(geo, gps.coords, { en: gps.en }) : { ...gps.estado, en: gps.en };
    const { punto, aviso } = PZ.elegir(c, g);
    capa.innerHTML = !punto || fijando ? ''
      : punto.tipo === 'gps' ? `<div class="pz-precision" style="left:${punto.x * 100}%;top:${punto.y * 100}%;width:${punto.radio * 200}%"></div><div class="pz-punto" data-pz-punto="gps" style="left:${punto.x * 100}%;top:${punto.y * 100}%" role="img" aria-label="Estás aquí (±${punto.precision} m)"></div>`
        : `<div class="pz-punto pz-ctx" data-pz-punto="contexto" style="left:${punto.x * 100}%;top:${punto.y * 100}%" role="img" aria-label="${esc(punto.texto)}"></div>`;
    /* El aviso: el del GPS que no se pinta, o qué dice el punto por contexto (cerrable). */
    const texto = fijando ? '' : aviso && (vigia !== null || (c && c.estado === 'otraPlanta')) ? aviso
      : punto && punto.tipo === 'contexto' ? punto.texto : '';
    const visor = l.closest('.pe-visor');
    let av = visor && visor.querySelector('[data-pz-aviso]');
    if (!texto || texto === cerrado) { if (av) av.remove(); }
    else if (visor) {
      if (!av) { av = document.createElement('div'); av.className = 'pz-aviso'; av.dataset.pzAviso = '1'; av.setAttribute('role', 'status'); visor.appendChild(av); }
      const conFijar = !geo && puedeFijar && vigia !== null;
      av.innerHTML = `<span>${esc(texto)}</span>${conFijar ? '<button type="button" data-pz-fijar>Fijar el plano</button>' : ''}<button type="button" data-pz-cerrar aria-label="Cerrar el aviso">×</button>`;
    }
    pintarFijar();
  }

  /* ——— GPS: solo al tocar «Dónde estoy» ——— */
  function empezar() {
    if (!navigator.geolocation) { gps = { en: Date.now(), estado: { tipo: 'gps', estado: 'sinSenal', aviso: 'Esta versión de la app aún no puede usar el GPS. Abre un equipo o toca una sala y te sitúo ahí.' } }; vigia = -1; cerrado = ''; pintar(); return; }
    cerrado = '';
    vigia = navigator.geolocation.watchPosition(
      (pos) => { gps = { en: Date.now(), coords: pos.coords }; pintar(); },
      (err) => {
        const aviso = err && err.code === 1 ? 'Sin permiso de ubicación: actívalo en Ajustes › Vidaire Cx › Ubicación.' : 'Sin señal de GPS. Dentro del estadio, abre un equipo o toca una sala y te sitúo ahí.';
        gps = { en: Date.now(), estado: { tipo: 'gps', estado: 'sinSenal', aviso } }; pintar();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    gps = gps || { en: Date.now(), estado: { tipo: 'gps', estado: 'sinSenal', aviso: 'Buscando el GPS…' } };
    pintar();
  }
  function parar() {
    if (vigia !== null && vigia >= 0 && navigator.geolocation) navigator.geolocation.clearWatch(vigia);
    vigia = null; gps = null;
  }

  /** Dónde estoy por contexto: lo llaman la ficha del equipo (commissioning.js) y el plano al elegir un equipo. */
  function contexto(c) {
    if (!c || (!c.equipoId && !c.tag && !c.sala)) return;
    leerCtx();
    ctx = { equipoId: c.equipoId || null, tag: c.tag || null, sala: c.sala || null, planta: c.planta ?? (planta && planta.planta) ?? null, origen: c.origen || 'ficha', en: Date.now() };
    cerrado = '';
    try { localStorage.setItem(clave(), JSON.stringify(ctx)); } catch { /* sin almacenamiento */ }
    if (lienzo()) pintar();
    /* 18-nov: el mismo contexto calibra el barómetro y enseña el wifi (plantaAutoCapa.js). */
    if (window.CX_PLANTA_AUTO && ctx.planta) window.CX_PLANTA_AUTO.contexto(ctx);
  }

  /* ——— Fijar el plano con dos puntos (el jefe) ——— */
  function pintarFijar() {
    const pie = $raiz && $raiz.querySelector('.pe-pie');
    if (!pie) return;
    let f = pie.querySelector('[data-pz-fijar-barra]');
    if (!fijando) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement('div'); f.className = 'pz-fijar'; f.dataset.pzFijarBarra = '1'; f.setAttribute('role', 'status'); pie.prepend(f); }
    const n = fijando.puntos.length + 1;
    const valor = fijando.lat != null ? `${fijando.lat.toFixed(6)}, ${fijando.lon.toFixed(6)}` : '';
    if (f.dataset.paso === String(n)) return;
    f.dataset.paso = String(n);
    f.innerHTML = `<span>Punto <b>${n} de 2</b>: un sitio que reconozcas (esquina, pilar, puerta). Pon sus coordenadas y tócalo en el plano.</span>
      <input type="text" inputmode="decimal" data-pz-coords placeholder="41.380900, 2.122800" aria-label="Latitud, longitud" value="${esc(valor)}">
      <button type="button" class="boton secundario" data-pz-migps>Mi GPS</button><button type="button" class="boton secundario" data-pz-fijar-cancelar>Cancelar</button>`;
  }
  function leerCoords() {
    const i = $raiz && $raiz.querySelector('[data-pz-coords]');
    const m = i && String(i.value).replace(/\s+/g, ' ').match(/(-?\d+(?:[.,]\d+)?)\s*[ ,;]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1].replace(',', '.')); const lon = Number(m[2].replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  async function tocadoFijando(x, y) {
    const co = leerCoords();
    if (!co) { C.aviso('Primero las coordenadas de ese sitio (o «Mi GPS» estando allí).'); return; }
    fijando.puntos.push({ ...co, x, y });
    fijando.lat = null; fijando.lon = null;
    if (fijando.puntos.length < 2) { pintar(); return; }
    const r = await C.postJson('api/plano-equipos/georreferencia', { obra: obra(), plano: planoId(), puntos: fijando.puntos, ancho: planta.plano.ancho, alto: planta.plano.alto }).catch((e) => ({ ok: false, error: e.message }));
    if (!r || !r.ok) { C.aviso((r && r.error) || 'No se ha podido fijar el plano.'); fijando.puntos = []; pintar(); return; }
    geoCache.delete(planoId()); geoDe = ''; fijando = null;
    C.aviso('Plano fijado: el GPS ya cae en su sitio.');
    await traerGeo(); pintar();
  }

  /* Un toque (no un arrastre) en un hueco del plano: al fijar, el punto de control; si no, la sala más cercana. */
  document.addEventListener('pointerdown', (ev) => { bajo = lienzo() && lienzo().contains(ev.target) ? { x: ev.clientX, y: ev.clientY } : null; }, true);
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!$raiz || !t || !t.closest) return;
    if (t.closest('[data-pz-donde]')) { if (vigia !== null) { parar(); pintar(); } else empezar(); return; }
    if (t.closest('[data-pz-cerrar]')) { const a = t.closest('[data-pz-aviso]'); cerrado = a ? a.querySelector('span').textContent : ''; if (a) a.remove(); return; }
    if (t.closest('[data-pz-fijar]')) { fijando = { puntos: [], lat: null, lon: null }; pintar(); return; }
    if (t.closest('[data-pz-fijar-cancelar]')) { fijando = null; pintar(); return; }
    if (t.closest('[data-pz-migps]')) {
      if (!navigator.geolocation) { C.aviso('Esta versión de la app aún no puede usar el GPS: escribe las coordenadas.'); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        if (!fijando) return;
        if (pos.coords.accuracy > PZ.PRECISION_MAX_M) C.aviso(`GPS impreciso (±${Math.round(pos.coords.accuracy)} m): espera al aire libre o escríbelas.`);
        else { const i = $raiz.querySelector('[data-pz-coords]'); if (i) i.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`; }
      }, () => C.aviso('Sin GPS: escribe las coordenadas.'), { enableHighAccuracy: true, timeout: 20000 });
      return;
    }
    const l = lienzo();
    if (!l || !l.contains(t) || t.closest('[data-pe-marca],[data-pe-mat],button,a,input')) return;
    if (bajo && Math.hypot(ev.clientX - bajo.x, ev.clientY - bajo.y) > 10) return;
    const marco = l.closest('[data-pe-marco]');
    if (marco && (marco.classList.contains('pe-colocando') || marco.classList.contains('fa-activo')) && !fijando) return;
    const r = l.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width; const y = (ev.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (fijando) { ev.stopPropagation(); ev.preventDefault(); tocadoFijando(x, y); return; }
    /* La sala tocada: la de rótulo más cercano a menos de 28 px de pantalla. */
    let mejor = null; let dmin = 28;
    for (const s of salas) {
      if (!s || s.x == null) continue;
      const d = Math.hypot((s.x - x) * r.width, (s.y - y) * r.height);
      if (d < dmin) { dmin = d; mejor = s; }
    }
    if (mejor) contexto({ sala: mejor.codigo || mejor.t, origen: 'sala' });
  }, true);
  window.addEventListener('pagehide', parar);

  window.CX_POSICION_PLANO = { montar, contexto, parar, _estado: () => ({ ctx, gps, geo, fijando, plano: planoId(), planta }) };
})();
