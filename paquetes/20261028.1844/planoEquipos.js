'use strict';
/*
 * EL PLANO DE EQUIPOS EN VIDAIRE CX (28-oct-2026, tareas 6b9ec3be y 6c94dc06).
 *
 * Desde la lista de Commissioning, «Plano de equipos»: la planta con cada
 * equipo pintado de su color, con la prioridad de JC:
 *   ROJO no instalado (aunque le falten papeles) · AZUL instalado (aunque le
 *   falte algún documento) · VERDE instalado y con el commissioning completo.
 * Las dos unidades de un split salen cada una con su punto y su color.
 *
 * Tocar un punto dice qué equipo es y qué le falta; «Abrir el equipo» lleva a
 * su ficha (el data-cx="equipo" lo atiende commissioning.js). El plano lo
 * sube la oficina (Commissioning › Plano del escritorio).
 */
(function planoEquiposCx() {
  const C = window.CX;
  if (!C) return;
  const { esc, cifra } = C;

  const NOMBRE = { rojo: 'No instalado', azul: 'Instalado', verde: 'Completo' };
  const ZOOM_MAX = 8;
  let datos = null;
  let plantaId = null;
  let zoom = 1;
  let elegida = null; /* el equipo tocado */
  let ocultos = new Set(); /* colores que no se enseñan */
  let $raiz = null;
  try { plantaId = sessionStorage.getItem('cx.planoEquipos') || null; } catch { /* sin almacén */ }

  const ESTILO = `
  .pe-cabeza{display:flex;align-items:center;gap:8px;margin:4px 0 10px}
  .pe-cabeza h2{font-size:18px;margin:0;flex:1}
  .pe-plantas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:8px}
  .pe-plantas button{flex:none;border:1px solid var(--borde,#c9d3d6);background:var(--panel,#fff);color:var(--texto,#123);border-radius:999px;padding:6px 12px;font-size:14px}
  .pe-plantas button.activa{background:var(--acento,#00857c);border-color:var(--acento,#00857c);color:#fff}
  .pe-leyenda{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
  .pe-leyenda button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--borde,#c9d3d6);background:var(--panel,#fff);color:var(--texto,#123);border-radius:999px;padding:5px 10px;font-size:13px}
  .pe-leyenda button[aria-pressed="false"]{opacity:.45}
  .pe-punto{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
  .pe-rojo{background:#d9363e}.pe-azul{background:#1f6fd1}.pe-verde{background:#1a9c5b}
  .pe-marco{position:relative;overflow:auto;height:62vh;border:1px solid var(--borde,#c9d3d6);border-radius:10px;background:#fff;touch-action:pan-x pan-y}
  .pe-lienzo{position:relative;transform-origin:0 0}
  .pe-lienzo img{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none;pointer-events:none}
  .pe-marca{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);padding:0}
  .pe-marca.elegida{width:28px;height:28px;margin:-14px 0 0 -14px;box-shadow:0 0 0 3px #00857c}
  .pe-zoom{display:flex;gap:6px;justify-content:flex-end;margin:6px 0}
  .pe-zoom button{min-width:40px}
  .pe-elegido{margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--panel2,#eef4f4)}
  .pe-elegido .sub{margin-top:4px}
  .pe-fuera summary{cursor:pointer;margin:10px 2px;color:var(--textoTenue,#567)}
  .pe-fuera ul{list-style:none;margin:0;padding:0;columns:2;font-size:13px}
  .pe-fuera li{padding:3px 0;display:flex;align-items:center;gap:6px;break-inside:avoid}`;
  function ponerEstilo() {
    if (document.getElementById('pe-estilo')) return;
    const s = document.createElement('style');
    s.id = 'pe-estilo';
    s.textContent = ESTILO;
    document.head.appendChild(s);
  }

  const planoActual = () => (datos && datos.planos.find((p) => p.id === plantaId)) || (datos && datos.planos[0]) || null;

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
    } catch (e) {
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cx="lista">Volver</button></div>`;
      return;
    }
    pintar();
  }

  function pintar() {
    const p = planoActual();
    if (!p) {
      $raiz.innerHTML = `${cabeza()}<p class="vacio">Esta obra aún no tiene plano de equipos. Lo sube la oficina desde Commissioning › Plano.</p>`;
      return;
    }
    plantaId = p.id;
    try { sessionStorage.setItem('cx.planoEquipos', p.id); } catch { /* nada */ }
    const visibles = p.marcas.filter((m) => !ocultos.has(m.color));
    const m = elegida ? p.marcas.find((x) => x.equipoId === elegida) : null;
    $raiz.innerHTML = `
      ${cabeza()}
      ${datos.planos.length > 1 ? `<div class="pe-plantas" role="tablist">${datos.planos.map((q) => `<button role="tab" data-pe-planta="${esc(q.id)}" aria-selected="${q.id === p.id}" class="${q.id === p.id ? 'activa' : ''}">${esc(q.planta || q.nombre)}</button>`).join('')}</div>` : `<p class="nota">${esc(p.nombre)}</p>`}
      <div class="pe-leyenda" role="group" aria-label="Colores">${['rojo', 'azul', 'verde'].map((c) => `<button data-pe-color="${c}" aria-pressed="${!ocultos.has(c)}"><i class="pe-punto pe-${c}"></i>${esc(NOMBRE[c])} <b>${cifra(p.cuentas[c] || 0)}</b></button>`).join('')}</div>
      <div class="pe-marco" data-pe-marco>
        <div class="pe-lienzo" data-pe-lienzo style="width:${zoom * 100}%">
          <img data-src="api/plano-equipos/imagen?id=${encodeURIComponent(p.id)}" alt="Plano ${esc(p.nombre)}">
          ${visibles.map((x) => `<button class="pe-marca pe-${x.color}${x.equipoId === elegida ? ' elegida' : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%" data-pe-marca="${esc(x.equipoId)}" aria-label="${esc(`${x.tag}: ${NOMBRE[x.color]}`)}"></button>`).join('')}
        </div>
      </div>
      <div class="pe-zoom"><button class="boton secundario" data-pe-zoom="-1" aria-label="Alejar">−</button><button class="boton secundario" data-pe-zoom="0">Entero</button><button class="boton secundario" data-pe-zoom="1" aria-label="Acercar">+</button></div>
      ${m ? `<div class="pe-elegido">
        <div class="fila-principal"><strong class="cifra">${m.papel ? `<em>${esc(m.papel)}</em> ` : ''}${esc(m.tag)}</strong><span class="chip"><i class="pe-punto pe-${m.color}"></i> ${esc(NOMBRE[m.color])}</span></div>
        ${m.conjunto ? `<div class="sub">Split: ${esc(m.conjunto)}</div>` : ''}
        ${m.falta && m.falta.length ? `<div class="sub aviso">Falta: ${esc(m.falta.join(', '))}</div>` : ''}
        <button class="boton" data-cx="equipo" data-id="${esc(m.equipoId)}" style="margin-top:8px">Abrir el equipo</button>
      </div>` : '<p class="nota">Toca un punto para ver el equipo. Pellizca o usa + y − para acercar.</p>'}
      ${p.sinPoner && p.sinPoner.length ? `<details class="pe-fuera"><summary>${cifra(p.sinPoner.length)} equipo${p.sinPoner.length === 1 ? '' : 's'} de la planta ${esc(p.planta || '')} sin sitio en el plano</summary>
        <ul>${p.sinPoner.map((e) => `<li><i class="pe-punto pe-${e.color}"></i><button class="enlace" data-cx="equipo" data-id="${esc(e.id)}">${esc(e.tag)}</button></li>`).join('')}</ul></details>` : ''}`;
    C.cargarImagenes($raiz);
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

  document.addEventListener('click', (ev) => {
    if (!$raiz || !$raiz.contains(ev.target) || !datos) return;
    const pl = ev.target.closest('[data-pe-planta]');
    if (pl) { plantaId = pl.dataset.pePlanta; elegida = null; zoom = 1; pintar(); return; }
    const co = ev.target.closest('[data-pe-color]');
    if (co) { const c = co.dataset.peColor; if (ocultos.has(c)) ocultos.delete(c); else ocultos.add(c); pintar(); return; }
    const z = ev.target.closest('[data-pe-zoom]');
    if (z) { const v = Number(z.dataset.peZoom); ponerZoom(v === 0 ? 1 : zoom * (v > 0 ? 1.6 : 1 / 1.6)); return; }
    const mk = ev.target.closest('[data-pe-marca]');
    if (mk) {
      elegida = mk.dataset.peMarca === elegida ? null : mk.dataset.peMarca;
      const marco = $raiz.querySelector('[data-pe-marco]');
      const pos = marco ? [marco.scrollLeft, marco.scrollTop] : null;
      pintar();
      const nuevo = $raiz.querySelector('[data-pe-marco]');
      if (pos && nuevo) { nuevo.scrollLeft = pos[0]; nuevo.scrollTop = pos[1]; }
    }
  });

  window.CX_PLANO_EQUIPOS = { abrir };
})();
