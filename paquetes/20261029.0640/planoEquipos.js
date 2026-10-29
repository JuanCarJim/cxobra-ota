'use strict';
/*
 * EL PLANO DE EQUIPOS EN VIDAIRE CX (28-oct-2026, tareas 6b9ec3be y 6c94dc06;
 * colores y salas del 29-oct, JC: «que el jefe de obra acceda al plano desde
 * la tablet o el móvil»).
 *
 * Desde Commissioning, «Ver los equipos en el plano»: se elige la planta y
 * salen TODOS sus equipos, marcados sobre el plano como los difusores del
 * balanceo (símbolo del color de su estado y el TAG al lado) y en la lista de
 * la planta (equipo · sala · estado), con la regla de
 * shared/commissioning/planoEquipos.js:
 *   VERDE hecho · AZUL empezado, le falta algún documento · ROJO sin empezar.
 * Un split o un VRF, todo el conjunto del mismo color.
 *
 * Con el dedo: tocar la planta, la leyenda (filtra), pellizcar o + y − para
 * acercar, arrastrar para moverse; tocar un equipo dice su sala y qué le
 * falta, y «Abrir el equipo» lleva a su ficha (data-cx="equipo", lo atiende
 * commissioning.js). En tablet (≥ 900 px) el plano y la lista van lado a lado.
 * Lo ven el jefe de obra, el encargado y el jefe de grupo en sus obras.
 */
(function planoEquiposCx() {
  const C = window.CX;
  if (!C) return;
  const { esc, cifra } = C;

  const NOMBRE = { verde: 'Hecho', azul: 'Falta documento', rojo: 'Sin empezar' };
  const ORDEN = ['verde', 'azul', 'rojo'];
  const ZOOM_MAX = 8;
  const ZOOM_SALAS = 3; /* desde aquí se leen los nombres de sala encima del plano */
  const SIMBOLO = '<svg class="simbolo-boca" viewBox="0 0 22 22" aria-hidden="true"><rect class="cuerpo" x="2" y="2" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/><rect class="lleno" x="7" y="7" width="8" height="8" rx="1"/></svg>';
  let datos = null;
  let planta = null;
  let zoom = 1;
  let elegida = null; /* el equipo tocado */
  let ocultos = new Set(); /* colores que no se enseñan */
  let $raiz = null;
  try { planta = sessionStorage.getItem('cx.planoEquipos.planta'); } catch { /* sin almacén */ }

  const ESTILO = `
  .pe-cabeza{display:flex;align-items:center;gap:8px;margin:4px 0 8px}
  .pe-cabeza h2{font-size:18px;margin:0;flex:1}
  .pe-plantas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px;-webkit-overflow-scrolling:touch}
  .pe-plantas button{flex:none;min-height:40px;border:1px solid var(--borde,#c9d3d6);background:var(--superficie,#fff);color:var(--texto,#123);border-radius:999px;padding:6px 12px;font-size:14px}
  .pe-plantas button small{font-size:11px;opacity:.75;margin-left:4px}
  .pe-plantas button.activa{background:var(--acento,#178276);border-color:var(--acento,#178276);color:#fff}
  .pe-plantas button.activa small{color:#fff;opacity:.9}
  .pe-leyenda{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;align-items:center}
  .pe-leyenda button{display:inline-flex;align-items:center;gap:6px;min-height:36px;border:1px solid var(--borde,#c9d3d6);background:var(--superficie,#fff);color:var(--texto,#123);border-radius:999px;padding:4px 10px;font-size:13px}
  .pe-leyenda button[aria-pressed="false"]{opacity:.45}
  .pe-leyenda .nota{margin:0;font-size:12px}
  .pe-punto{display:inline-block;width:11px;height:11px;border-radius:2px;flex:none}
  .pe-verde{background:var(--bien)}.pe-azul{background:var(--pe-azul)}.pe-rojo{background:var(--mal)}
  #app{--pe-azul:#1F63C6}
  .pe-cuerpo{display:block}
  .pe-marco{position:relative;overflow:auto;height:52vh;border:1px solid var(--borde,#c9d3d6);border-radius:10px;background:#fff;-webkit-overflow-scrolling:touch}
  .pe-lienzo{position:relative}
  .pe-lienzo img{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none;pointer-events:none}
  .pe-lienzo .marca-boca.azul{color:var(--pe-azul)}
  .pe-lienzo .marca-boca.azul .simbolo-boca .cuerpo{fill:color-mix(in srgb,var(--pe-azul) 22%,#fff)}
  .pe-lienzo .marca-boca.azul .rotulo-boca{background:var(--pe-azul)}
  .pe-lienzo .marca-boca.elegida{z-index:3}
  .pe-lienzo .marca-boca.elegida .simbolo-boca{height:24px;outline:3px solid var(--acento,#178276);outline-offset:2px}
  .pe-sin-plano{padding:14px;border:1px dashed var(--borde,#c9d3d6);border-radius:10px;background:var(--superficie,#fff);font-size:14px}
  .pe-visor{position:relative}
  /* Los nombres de sala, como texto encima del plano: nítidos a cualquier zoom
     aunque la imagen que baja al móvil sea ligera. Solo al acercar (≥3×). */
  .pe-sala{position:absolute;transform:translate(-50%,-50%);font-size:10px;line-height:1.1;color:#3d5560;background:rgba(255,255,255,.78);padding:0 2px;border-radius:2px;white-space:nowrap;pointer-events:none;display:none;z-index:1}
  .pe-lienzo.con-salas .pe-sala{display:block}
  /* Los − / + flotan sobre el plano, arriba a la derecha: abajo los tapaba la barra de navegación. */
  .pe-zoom{position:absolute;top:8px;right:8px;z-index:5;display:flex;gap:4px;padding:4px;border-radius:10px;background:color-mix(in srgb,var(--superficie,#fff) 88%,transparent);box-shadow:var(--sombra,0 1px 4px rgba(0,0,0,.18))}
  .pe-zoom button{min-width:44px;min-height:44px;margin:0;font-size:20px;line-height:1;padding:0 10px}
  .pe-zoom button[data-pe-zoom="0"]{font-size:14px}
  .pe-elegido{margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--superficie,#fff);box-shadow:var(--sombra)}
  .pe-elegido .sub{margin-top:4px;font-size:14px}
  .pe-elegido ul{margin:4px 0 0;padding-left:18px;font-size:14px}
  .pe-lista{background:var(--superficie,#fff);border-radius:10px;box-shadow:var(--sombra);max-height:46vh;overflow:auto;-webkit-overflow-scrolling:touch}
  .pe-lista table{width:100%;border-collapse:collapse;font-size:13.5px}
  .pe-lista th{position:sticky;top:0;background:var(--superficie,#fff);text-align:left;font-weight:600;color:var(--acento,#178276);border-bottom:2px solid var(--acento,#178276);padding:6px 8px;z-index:1}
  .pe-lista td{padding:8px;border-bottom:1px solid var(--borde,#e3e8ea);vertical-align:top}
  .pe-lista tr.elegida td{background:var(--acento-suave,#E6F4F0)}
  .pe-lista td.estado{white-space:nowrap}
  .pe-lista .tenue{color:var(--textoTenue,#567)}
  @media (min-width:900px){
    .pe-cuerpo{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;align-items:start}
    .pe-marco{height:calc(100vh - 250px)}
    .pe-lado{display:flex;flex-direction:column;height:calc(100vh - 250px)}
    .pe-lado .pe-lista{flex:1;max-height:none;min-height:0}
    .pe-lado .pe-elegido{margin-top:0}
  }`;
  function ponerEstilo() {
    if (document.getElementById('pe-estilo')) return;
    const s = document.createElement('style');
    s.id = 'pe-estilo';
    s.textContent = ESTILO;
    document.head.appendChild(s);
  }

  const plantas = () => (datos && datos.plantas) || [];
  const plantaActual = () => {
    const ps = plantas();
    return ps.find((p) => (p.planta || '') === (planta || '')) || ps.find((p) => p.plano) || ps.find((p) => p.planta) || ps[0] || null;
  };
  const etiqueta = (p) => p.planta || 'Sin planta';

  async function abrir($app) {
    $raiz = $app;
    ponerEstilo();
    elegida = null;
    document.body.classList.remove('sin-scroll');
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = true;
    $app.innerHTML = '<p class="cargando">Cargando el plano…</p>';
    try {
      datos = await C.pedir(`api/plano-equipos?obra=${encodeURIComponent(C.obraId())}`);
      if (!datos.ok) throw new Error(datos.error);
      if (!Array.isArray(datos.plantas)) datos.plantas = [];
    } catch (e) {
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cx="lista">Volver</button></div>`;
      return;
    }
    pintar();
  }

  function detalle(p) {
    const e = elegida ? p.equipos.find((x) => x.id === elegida) : null;
    if (!e) return `<p class="nota">${p.plano ? 'Toca un equipo en el plano o en la lista. Pellizca o usa + y − para acercar.' : 'Toca un equipo de la lista para ver qué le falta.'}</p>`;
    return `<div class="pe-elegido">
      <div class="fila-principal"><strong class="cifra">${e.papel ? `<em>${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</strong><span class="chip"><i class="pe-punto pe-${e.color}"></i> ${esc(NOMBRE[e.color])}</span></div>
      <div class="sub">Sala: <b>${esc(e.sala || 'sin sala')}</b></div>
      ${e.conjunto ? `<div class="sub">${e.papel === 'UE' ? 'Exterior' : 'Interior'} de ${esc(e.conjunto)}</div>` : ''}
      ${e.color === 'verde' ? '<div class="sub">Commissioning completo.</div>' : (e.falta && e.falta.length ? `<div class="sub">Le falta:</div><ul>${e.falta.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')}
      ${p.plano && e.x === null ? '<div class="sub tenue">No está en el plano.</div>' : ''}
      <button class="boton" data-cx="equipo" data-id="${esc(e.id)}" style="margin-top:8px">Abrir el equipo</button>
    </div>`;
  }

  function pintar() {
    const p = plantaActual();
    if (!p) {
      $raiz.innerHTML = `${cabeza()}<p class="vacio">Esta obra aún no tiene equipos.</p>`;
      return;
    }
    planta = p.planta || '';
    try { sessionStorage.setItem('cx.planoEquipos.planta', planta); } catch { /* nada */ }
    const c = p.cuentas;
    const visibles = p.equipos.filter((m) => !ocultos.has(m.color));
    const enPlano = visibles.filter((m) => m.x !== null);
    const plano = p.plano ? `<div class="pe-visor"><div class="pe-marco" data-pe-marco>
        <div class="pe-lienzo${zoom >= ZOOM_SALAS ? ' con-salas' : ''}" data-pe-lienzo style="width:${zoom * 100}%">
          <img data-src="api/plano-equipos/imagen?id=${encodeURIComponent(p.plano.id)}" alt="Plano ${esc(p.plano.nombre)}">
          ${(p.plano.salas || []).map((r) => `<span class="pe-sala" style="left:${r.x * 100}%;top:${r.y * 100}%">${esc(r.t)}</span>`).join('')}
          ${enPlano.map((x) => `<button class="marca-boca ${x.color === 'verde' ? 'bien' : x.color === 'rojo' ? 'mal' : 'azul'}${x.id === elegida ? ' elegida' : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%" data-pe-marca="${esc(x.id)}" aria-label="${esc(`${x.tag}, ${x.sala || 'sin sala'}: ${NOMBRE[x.color]}`)}">${SIMBOLO}<span class="rotulo-boca">${esc(x.tag)}</span></button>`).join('')}
        </div>
      </div>
      <div class="pe-zoom"><button class="boton secundario" data-pe-zoom="-1" aria-label="Alejar">−</button><button class="boton secundario" data-pe-zoom="0">Entero</button><button class="boton secundario" data-pe-zoom="1" aria-label="Acercar">+</button></div></div>`
      : `<div class="pe-sin-plano"><b>La planta ${esc(etiqueta(p))} aún no tiene plano de equipos.</b><br>Lo sube la oficina desde Commissioning › Plano. Mientras, la lista dice la sala y el estado de cada equipo.</div>`;
    $raiz.innerHTML = `
      ${cabeza()}
      <div class="pe-plantas" role="tablist">${plantas().map((q) => `<button role="tab" data-pe-planta="${esc(q.planta || '')}" aria-selected="${q === p}" class="${q === p ? 'activa' : ''}">${esc(etiqueta(q))}<small>${cifra(q.equipos.length)}</small></button>`).join('')}</div>
      <div class="pe-leyenda" role="group" aria-label="Colores">${ORDEN.map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}"><i class="pe-punto pe-${k}"></i>${esc(NOMBRE[k])} <b>${cifra(c[k] || 0)}</b></button>`).join('')}
        <p class="nota">sin sala ${cifra(c.sinSala)}${p.plano ? ` · en el plano ${cifra(c.enPlano)} de ${cifra(p.equipos.length)}` : ''}</p></div>
      <div class="pe-cuerpo">
        <div>${plano}</div>
        <div class="pe-lado">
          ${detalle(p)}
          <div class="pe-lista"><table><thead><tr><th>Equipo</th><th>Sala</th><th>Estado</th></tr></thead><tbody>
          ${visibles.map((e) => `<tr data-pe-fila="${esc(e.id)}" class="${e.id === elegida ? 'elegida' : ''}"><td>${e.papel ? `<em class="tenue">${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</td><td>${e.sala ? esc(e.sala) : '<span class="tenue">sin sala</span>'}</td><td class="estado"><i class="pe-punto pe-${e.color}"></i> ${esc(NOMBRE[e.color])}</td></tr>`).join('') || '<tr><td colspan="3" class="tenue">Ningún equipo con esos colores.</td></tr>'}
          </tbody></table></div>
        </div>
      </div>`;
    C.cargarImagenes($raiz);
    /* La planta elegida, a la vista en la fila de plantas (en el teléfono se sale por la derecha). */
    const fila = $raiz.querySelector('.pe-plantas');
    const act = fila && fila.querySelector('.activa');
    if (act) fila.scrollLeft = act.offsetLeft - fila.clientWidth / 2 + act.offsetWidth / 2;
  }

  function cabeza() {
    return `<div class="pe-cabeza"><button class="enlace" data-cx="lista">‹ Equipos</button><h2>Plano de equipos</h2></div>`;
  }

  /* Cambia el zoom sin perder el punto que estaba en el centro (o bajo los dedos). */
  function ponerZoom(nuevo, cx, cy) {
    const marco = $raiz && $raiz.querySelector('[data-pe-marco]');
    const lienzo = $raiz && $raiz.querySelector('[data-pe-lienzo]');
    nuevo = Math.min(ZOOM_MAX, Math.max(1, nuevo));
    if (!marco || !lienzo) { zoom = nuevo; return; }
    const px = cx === undefined ? marco.clientWidth / 2 : cx;
    const py = cy === undefined ? marco.clientHeight / 2 : cy;
    const fx = (marco.scrollLeft + px) / (lienzo.offsetWidth || 1);
    const fy = (marco.scrollTop + py) / (lienzo.offsetHeight || 1);
    zoom = nuevo;
    lienzo.style.width = `${zoom * 100}%`;
    lienzo.classList.toggle('con-salas', zoom >= ZOOM_SALAS);
    marco.scrollLeft = fx * lienzo.offsetWidth - px;
    marco.scrollTop = fy * lienzo.offsetHeight - py;
  }

  function enMarco(ev) {
    return $raiz && ev.target && ev.target.closest && ev.target.closest('[data-pe-marco]');
  }

  /* El pellizco: dos dedos sobre el plano. */
  let pellizco = null;
  document.addEventListener('touchstart', (ev) => {
    const marco = enMarco(ev);
    if (!marco || ev.touches.length !== 2) return;
    const [a, b] = ev.touches;
    const r = marco.getBoundingClientRect();
    pellizco = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom, cx: (a.clientX + b.clientX) / 2 - r.left, cy: (a.clientY + b.clientY) / 2 - r.top };
  }, { passive: true });
  document.addEventListener('touchmove', (ev) => {
    if (!pellizco || ev.touches.length !== 2 || !enMarco(ev)) return;
    ev.preventDefault();
    const [a, b] = ev.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    ponerZoom(pellizco.z * (d / (pellizco.d || 1)), pellizco.cx, pellizco.cy);
  }, { passive: false });
  document.addEventListener('touchend', () => { pellizco = null; });

  /* Repinta sin perder dónde estaba el plano ni la lista. */
  function repintarQuieto() {
    const marco = $raiz.querySelector('[data-pe-marco]');
    const lista = $raiz.querySelector('.pe-lista');
    const pos = [marco && marco.scrollLeft, marco && marco.scrollTop, lista && lista.scrollTop];
    pintar();
    const m2 = $raiz.querySelector('[data-pe-marco]');
    const l2 = $raiz.querySelector('.pe-lista');
    if (m2 && pos[0] !== undefined) { m2.scrollLeft = pos[0]; m2.scrollTop = pos[1]; }
    if (l2 && pos[2] !== undefined) l2.scrollTop = pos[2];
  }

  /* Lleva el plano hasta el equipo elegido en la lista. */
  function centrar(id) {
    const p = plantaActual();
    const e = p && p.equipos.find((x) => x.id === id && x.x !== null);
    if (!e) return;
    if (zoom < 3) ponerZoom(3);
    const marco = $raiz.querySelector('[data-pe-marco]');
    const lienzo = $raiz.querySelector('[data-pe-lienzo]');
    if (!marco || !lienzo) return;
    marco.scrollLeft = e.x * lienzo.offsetWidth - marco.clientWidth / 2;
    marco.scrollTop = e.y * lienzo.offsetHeight - marco.clientHeight / 2;
    if (marco.getBoundingClientRect().top < 0 || marco.getBoundingClientRect().bottom > window.innerHeight) marco.scrollIntoView({ block: 'center' });
  }

  document.addEventListener('click', (ev) => {
    if (!$raiz || !$raiz.contains(ev.target) || !datos) return;
    const pl = ev.target.closest('[data-pe-planta]');
    if (pl) { planta = pl.dataset.pePlanta; elegida = null; zoom = 1; pintar(); return; }
    const co = ev.target.closest('[data-pe-color]');
    if (co) { const c = co.dataset.peColor; if (ocultos.has(c)) ocultos.delete(c); else ocultos.add(c); repintarQuieto(); return; }
    const z = ev.target.closest('[data-pe-zoom]');
    if (z) {
      /* Con un equipo elegido a la vista, se acerca hacia él y no hacia el centro. */
      const v = Number(z.dataset.peZoom);
      const p = plantaActual();
      const e = elegida && p && p.equipos.find((x) => x.id === elegida && x.x !== null);
      const marco = $raiz.querySelector('[data-pe-marco]');
      const lienzo = $raiz.querySelector('[data-pe-lienzo]');
      let cx; let cy;
      if (e && marco && lienzo) {
        const px = e.x * lienzo.offsetWidth - marco.scrollLeft;
        const py = e.y * lienzo.offsetHeight - marco.scrollTop;
        if (px >= 0 && px <= marco.clientWidth && py >= 0 && py <= marco.clientHeight) { cx = px; cy = py; }
      }
      ponerZoom(v === 0 ? 1 : zoom * (v > 0 ? 1.6 : 1 / 1.6), cx, cy);
      return;
    }
    const mk = ev.target.closest('[data-pe-marca]');
    if (mk) {
      elegida = mk.dataset.peMarca === elegida ? null : mk.dataset.peMarca;
      repintarQuieto();
      /* En el teléfono el detalle queda debajo del plano: se asoma sin perder el plano. */
      const d = elegida && window.innerWidth < 900 && $raiz.querySelector('.pe-elegido');
      if (d && d.getBoundingClientRect().bottom > window.innerHeight - 90) window.scrollBy({ top: d.getBoundingClientRect().bottom - window.innerHeight + 110, behavior: 'smooth' });
      return;
    }
    const fi = ev.target.closest('[data-pe-fila]');
    if (fi) { elegida = fi.dataset.peFila; repintarQuieto(); centrar(elegida); }
  });

  window.CX_PLANO_EQUIPOS = { abrir };
})();
