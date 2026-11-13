'use strict';
/*
 * EL PLANO DE MANTENIMIENTO EN VIDAIRE CX (#planoMant, 13-nov-2026, JC).
 *
 * Por planta: el plano del IFC de fondo y, encima, el bloque del catálogo de cada equipo YA ENTREGADO a la DF, del color
 * de su estado de mantenimiento (al día verde · toca pronto azul · vencido granate). Tocar un bloque abre su ficha de
 * mantenimiento: plan, próximas operaciones, documentos y fotos. La lámina la dibuja el servidor con la misma geometría
 * que la entrega a la DF (shared/commissioning/planoMantenimiento.js + planoEntregaDf.js); aquí solo se pinta y se toca.
 * Solo la ven los roles con el módulo de mantenimiento: el encargado, el jefe de obra y el de producción, no (mant-rol-1311).
 */
(function planoMantenimiento() {
  const C = window.CX;
  if (!C) return;
  const $app = document.getElementById('app');
  const { esc } = C;
  const activa = () => C.activa('planoMant');

  const NOMBRE = { vencido: 'Vencido', pronto: 'Toca pronto', alDia: 'Al día' };
  const COLOR = { vencido: 'var(--mal)', pronto: 'var(--info)', alDia: 'var(--bien)' };
  const VP = () => window.VISTA_PLANO;
  let gesto = null;
  let lista = null, plantaId = null, lamina = null, zoom = 1, ficha = null, elegido = null, ocultos = new Set();
  try { plantaId = sessionStorage.getItem('cx.planoMant.planta'); } catch { /* sin almacén */ }

  if (!document.getElementById('estilo-plano-mant')) {
    const st = document.createElement('style');
    st.id = 'estilo-plano-mant';
    st.textContent = `
      .pm-plantas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 6px;-webkit-overflow-scrolling:touch}
      .pm-plantas button{flex:none;min-height:40px;margin:0;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:6px 12px;font-size:14px;width:auto}
      .pm-plantas button.activa{background:var(--acento-relleno);border-color:var(--acento-relleno);color:var(--sobre-relleno)}
      .pm-plantas small{margin-left:4px;opacity:.8}
      .pm-leyenda{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
      .pm-leyenda button{display:inline-flex;align-items:center;gap:6px;min-height:36px;margin:0;width:auto;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:4px 10px;font-size:13px}
      .pm-leyenda button[aria-pressed="false"]{opacity:.45}
      .pm-punto{width:11px;height:11px;border-radius:2px;display:inline-block}
      .pm-marco{position:relative;border:1px solid var(--borde);border-radius:10px;background:var(--vd-lienzo)}
      .pm-vista{overflow:auto;height:62vh;display:flex;touch-action:none;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
      .pm-vista>div{margin:auto;flex:none}
      .pm-vista .pmLamina{border:0;border-radius:0}
      .pm-vista .pmLamina svg{height:auto}
      .pm-vista .pmLamina.sin-vencido a[data-estado="vencido"],.pm-vista .pmLamina.sin-pronto a[data-estado="pronto"],.pm-vista .pmLamina.sin-alDia a[data-estado="alDia"]{display:none}
      .pm-zoom{position:absolute;top:8px;right:8px;z-index:5;display:flex;gap:4px;padding:4px;border-radius:10px;background:color-mix(in srgb,var(--panel) 90%,transparent);border:1px solid var(--borde)}
      .pm-zoom button{min-width:52px;min-height:52px;margin:0;width:auto;font-size:22px;line-height:1;padding:0 12px}
      .pm-zoom{top:auto;bottom:10px;right:10px}
      .pm-hoja{margin:8px 0;padding:12px;border-radius:10px;background:var(--panel);box-shadow:var(--sombra)}
      .pm-hoja h3{margin:0;font-size:17px}
      .pm-hoja .sub{margin:2px 0 6px;font-size:14px;color:var(--textoTenue)}
      .pm-hoja h4{margin:10px 0 3px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--acento)}
      .pm-hoja ul{margin:0;padding-left:18px;font-size:14px}
      .pm-hoja li.vencida{color:var(--mal);font-weight:600}.pm-hoja li.pronto{color:var(--info);font-weight:600}
      .pm-chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:600;color:var(--sobre-relleno)}
      .pm-fotos{display:flex;gap:6px;overflow-x:auto}.pm-fotos img{height:72px;width:auto;border-radius:6px;border:1px solid var(--borde)}
      .pm-docs a{font-weight:600;color:var(--acento)}
      .pm-cierra{float:right;min-width:44px;min-height:44px;margin:-8px -8px 0 0;width:auto;border:0;background:none;font-size:22px;color:var(--textoTenue)}
    `;
    document.head.append(st);
  }

  async function abrirLista() {
    ficha = null; elegido = null;
    await C.obrasListas();
    if (!activa()) return;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      lista = await C.pedir(`api/mantenimiento/plano?obra=${encodeURIComponent(C.obraId() || '')}`);
      if (!lista.ok) throw new Error(lista.error);
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-pm-a="reintentar">Reintentar</button></div>`;
      return;
    }
    if (!activa()) return;
    if (!lista.plantas.length) {
      $app.innerHTML = `<p class="vacio">Todavía no hay equipos entregados a la DF con su sitio en el plano${lista.entregados ? ` (${lista.entregados} entregados, sin ubicar)` : ''}.</p>`;
      return;
    }
    if (!lista.plantas.some((p) => p.id === plantaId)) plantaId = lista.plantas[0].id;
    await abrirPlanta(plantaId);
  }

  async function abrirPlanta(id) {
    plantaId = id; ficha = null; elegido = null; zoom = 1;
    try { sessionStorage.setItem('cx.planoMant.planta', id); } catch { /* sin almacén */ }
    pintar('<p class="cargando">Cargando el plano…</p>');
    try {
      lamina = await C.pedir(`api/mantenimiento/plano?obra=${encodeURIComponent(C.obraId() || '')}&planta=${encodeURIComponent(id)}`);
      if (!lamina.ok) throw new Error(lamina.error);
    } catch (e) { lamina = null; pintar(`<div class="vacio mal"><p>${esc(e.message)}</p></div>`); return; }
    pintar();
  }

  const marcoVista = () => $app.querySelector('#pm-vista');
  const ratioLamina = () => { const sv = $app.querySelector('#pm-vista svg'); const vb = sv && sv.viewBox && sv.viewBox.baseVal; return vb && vb.width > 0 && vb.height > 0 ? vb.width / vb.height : 1.5; };
  const medidas = () => { const m = marcoVista(); return { W: m.clientWidth, H: m.clientHeight, ratio: ratioLamina() }; };
  const anchoPx = (z) => { const m = medidas(); return `${Math.round((VP() ? VP().anchoBase(m.W, m.H, m.ratio) : m.W) * z)}px`; };
  /* El zoom lo aplica la pieza compartida (vistaPlano.js): ancho del lienzo; el SVG es vectorial, así que las etiquetas siguen nítidas. */
  const aplicar = (z) => { zoom = VP() ? VP().limitarZoom(z, 12) : Math.min(12, Math.max(1, z)); const w = $app.querySelector('#pm-vista > div'); if (w) w.style.width = anchoPx(zoom); };
  function ponerGestos() {
    if (gesto) { gesto.quitar(); gesto = null; }
    const m = marcoVista();
    if (!m || !VP()) return;
    aplicar(zoom);
    gesto = VP().gestos(m, { zoom: () => zoom, max: () => 12, ratio: ratioLamina, aplicar, activo: activa });
    /* doble toque: acerca donde tocas o vuelve a encajar (no se confunde con mover: solo si el dedo apenas se movió) */
    let ult = null, ini = null;
    m.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') ini = { x: ev.clientX, y: ev.clientY }; });
    m.addEventListener('pointerup', (ev) => {
      if (ev.pointerType === 'mouse' || !ini || Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) > 10) { ult = null; return; }
      const ahora = Date.now(), r = m.getBoundingClientRect();
      if (ult && ahora - ult.t < 320 && Math.hypot(ev.clientX - ult.x, ev.clientY - ult.y) < 30) { gesto.irA(zoom > 1.05 ? 1 : 3, ev.clientX - r.left, ev.clientY - r.top); ult = null; } else ult = { t: ahora, x: ev.clientX, y: ev.clientY };
    });
  }

  function pintar(cuerpo) {
    if (!activa() || !lista) return;
    const r = lista.resumen;
    $app.innerHTML = `
      <div class="pm-plantas" role="tablist">${lista.plantas.map((p) => `<button role="tab" data-pm-planta="${esc(p.id)}" class="${p.id === plantaId ? 'activa' : ''}" aria-selected="${p.id === plantaId}">${esc(p.titulo)}<small>${p.n}</small></button>`).join('')}</div>
      <div class="pm-leyenda">${['vencido', 'pronto', 'alDia'].map((k) => `<button data-pm-estado="${k}" aria-pressed="${!ocultos.has(k)}"><span class="pm-punto" style="background:${COLOR[k]}"></span>${NOMBRE[k]} <strong>${(lamina && lamina.cuenta ? lamina.cuenta[k] : r[k])}</strong></button>`).join('')}</div>
      ${cuerpo || (lamina ? `<style>${lamina.css}</style><div class="pm-marco"><div class="pm-vista" id="pm-vista"><div>${lamina.html}</div></div>
        <div class="pm-zoom"><button data-pm-a="menos" aria-label="Alejar">−</button><button data-pm-a="entero" aria-label="Encajar el plano entero">Entero</button><button data-pm-a="mas" aria-label="Acercar">+</button></div></div>` : '')}
      <div id="pm-hoja"></div>
      ${lista.sinUbicar ? `<p class="texto-2">${lista.sinUbicar} equipo${lista.sinUbicar === 1 ? '' : 's'} entregado${lista.sinUbicar === 1 ? '' : 's'} sin ubicar en el plano: por confirmar.</p>` : ''}`;
    marcar();
    ponerGestos();
    if (ficha) pintarFicha(); else centrar();
  }

  /* Al abrir una planta, el plano se centra en el primer equipo de lo más urgente (vencido, luego toca pronto). */
  function centrar() {
    const v = $app.querySelector('#pm-vista');
    if (!v) return;
    const bs = [...v.querySelectorAll('a.pcBloque')];
    const b = bs.find((x) => x.dataset.estado === 'vencido') || bs.find((x) => x.dataset.estado === 'pronto') || bs[0];
    if (!b) return;
    const r = b.getBoundingClientRect(), rv = v.getBoundingClientRect();
    v.scrollLeft += r.left - rv.left - rv.width / 2 + r.width / 2;
    v.scrollTop += r.top - rv.top - rv.height / 2 + r.height / 2;
  }

  /* El bloque elegido resaltado y los estados apagados con la leyenda (el estado viene en data-estado, del servidor). */
  function marcar() {
    const l = $app.querySelector('.pmLamina');
    if (!l || !lamina) return;
    l.querySelectorAll('a.pcBloque').forEach((a) => a.classList.toggle('elegido', a.dataset.pm === elegido));
    for (const k of ['vencido', 'pronto', 'alDia']) l.classList.toggle(`sin-${k}`, ocultos.has(k));
  }

  async function abrirFicha(id) {
    elegido = id; marcar();
    const h = $app.querySelector('#pm-hoja');
    if (h) h.innerHTML = '<div class="pm-hoja"><p class="cargando">Cargando…</p></div>';
    try {
      const r = await C.pedir(`api/mantenimiento/plano/ficha?obra=${encodeURIComponent(C.obraId() || '')}&id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
      ficha = r;
    } catch (e) { ficha = null; if (h) h.innerHTML = `<div class="pm-hoja"><p class="mal">${esc(e.message)}</p></div>`; return; }
    pintarFicha();
    const h2 = $app.querySelector('#pm-hoja');
    if (h2 && h2.scrollIntoView) h2.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function pintarFicha() {
    const h = $app.querySelector('#pm-hoja');
    if (!h || !ficha) return;
    const f = ficha.ficha, p = f.plan || {}, ops = p.operaciones || [];
    const estado = p.vencidas > 0 ? 'vencido' : p.pronto > 0 ? 'pronto' : 'alDia';
    const idn = f.identidad || {};
    const docs = f.documentos || [];
    h.innerHTML = `<div class="pm-hoja">
      <button class="pm-cierra" data-pm-a="cerrar" aria-label="Cerrar">×</button>
      <h3>${esc(f.tag)}</h3>
      <div class="sub">${esc([idn.tipoNombre, idn.marca, idn.modelo].filter(Boolean).join(' · '))}${idn.planta ? ` · ${esc(idn.planta)}` : ''}${idn.sala ? ` · ${esc(idn.sala)}` : ''}</div>
      <span class="pm-chip" style="background:${COLOR[estado]}">${NOMBRE[estado]}</span>
      ${f.entrega ? ` <span class="texto-2">${esc(f.entrega.texto)}</span>` : ''}
      <h4>Plan de mantenimiento${p.proximaTexto ? ` · próxima ${esc(p.proximaTexto)}` : ''}</h4>
      ${ops.length ? `<ul>${ops.map((o) => `<li class="${o.estado === 'vencida' ? 'vencida' : o.estado === 'pronto' ? 'pronto' : ''}">${esc(o.texto)} <span class="texto-2">· ${esc(o.periodoNombre)}${o.proxima ? ` · ${o.estado === 'vencida' ? 'vencida desde' : 'próxima'} ${esc(String(o.proxima).split('-').reverse().join('/'))}` : ''}${o.nunca ? ' · aún sin hacer' : ''}</span></li>`).join('')}</ul>` : '<p class="texto-2">Este equipo no tiene operaciones de plan.</p>'}
      <h4>Documentos</h4>
      <ul class="pm-docs">${docs.map((d) => `<li>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.nombre)}</a>` : esc(d.nombre)} <span class="texto-2">· ${esc(d.estadoNombre)}</span></li>`).join('') || '<li class="texto-2">Sin documentos.</li>'}</ul>
      ${ficha.fotos.length ? `<h4>Fotos</h4><div class="pm-fotos">${ficha.fotos.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt="${esc(x.pie || 'Foto del equipo')}" loading="lazy"></a>`).join('')}</div>` : ''}
      ${(f.porConfirmar || []).length ? `<h4>Por confirmar</h4><ul>${f.porConfirmar.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const t = ev.target;
    const pl = t.closest && t.closest('[data-pm-planta]');
    if (pl) { abrirPlanta(pl.dataset.pmPlanta); return; }
    const es = t.closest && t.closest('[data-pm-estado]');
    if (es) { const k = es.dataset.pmEstado; if (ocultos.has(k)) ocultos.delete(k); else ocultos.add(k); es.setAttribute('aria-pressed', String(!ocultos.has(k))); marcar(); return; }
    const a = t.closest && t.closest('[data-pm-a]');
    if (a) {
      const q = a.dataset.pmA;
      if (q === 'reintentar') abrirLista();
      else if (q === 'cerrar') { ficha = null; elegido = null; marcar(); const h = $app.querySelector('#pm-hoja'); if (h) h.innerHTML = ''; }
      else if ((q === 'mas' || q === 'menos' || q === 'entero') && gesto) {
        const m = marcoVista();
        gesto.irA(q === 'entero' ? 1 : zoom * (q === 'mas' ? 1.6 : 1 / 1.6), m.clientWidth / 2, m.clientHeight / 2);
      }
      return;
    }
    const b = t.closest && t.closest('[data-pm]');
    if (b) { ev.preventDefault(); abrirFicha(b.dataset.pm); }
  });
  $app.addEventListener('keydown', (ev) => {
    if (!activa() || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    const b = ev.target.closest && ev.target.closest('[data-pm]');
    if (b) { ev.preventDefault(); abrirFicha(b.dataset.pm); }
  });

  window.addEventListener('movil:obra', () => { if (activa()) abrirLista(); });
  window.addEventListener('hashchange', () => { if (activa()) abrirLista(); });
  if (activa()) abrirLista();
})();
