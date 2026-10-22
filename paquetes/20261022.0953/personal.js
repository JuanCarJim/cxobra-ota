'use strict';
/*
 * OBRA › PERSONAL EN EL MÓVIL: el encargado ficha a los operarios de las
 * subcontratas con el QR de su tarjeta.
 *
 *   1. HOY: cada subcontrata con los que se esperaban y los que han venido, y
 *      sus operarios (fichado por QR, a mano o todavía no). Arriba, «Leer
 *      tarjeta».
 *   2. LA FOTO de la tarjeta (o de varias juntas) se manda al ordenador, que
 *      lee los QR y los ficha. Sale quién es y si ya lo estaba.
 *   3. A MANO: el que se ha dejado la tarjeta se ficha desde la lista, y
 *      queda marcado «a mano». El que llega nuevo se da de alta aquí; la
 *      tarjeta se imprime en el ordenador.
 *
 * Por qué una foto y no la cámara en directo: la página llega por la wifi
 * sin https, y así el navegador no deja usar la cámara en vivo. La foto sí.
 * Las acciones van con data-per (las de albaranes usan data-accion).
 */
(function personal() {
  const $app = document.getElementById('app');
  const $camara = document.getElementById('camara-qr');

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
  const fechaLarga = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
  const activa = () => location.hash === '#personal';
  const CLASE = { bien: 'bien', aviso: 'aviso', mal: 'mal', vacio: 'neutra', futuro: 'neutra' };

  let datos = null;
  let obraId = null;
  /* La obra es la elegida en la cabecera (carcasa.js), la misma para todas. */
  try { obraId = localStorage.getItem('movil.obra') || localStorage.getItem('personal.obra'); } catch { /* sin almacenamiento */ }
  window.addEventListener('movil:obra', (ev) => { obraId = ev.detail; if (activa() && datos) pintarHoy(); });

  async function pedir(ruta, opciones = {}) {
    const r = await fetch(ruta, { cache: 'no-store', ...opciones });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { throw new Error(t || `Error ${r.status}`); }
    if (r.status >= 400 && j && j.error) throw new Error(j.error);
    return j;
  }
  const postJson = (ruta, cuerpo) => pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

  function aviso(texto, nivel = 'mal') {
    const d = document.createElement('div');
    d.className = `toast ${nivel}`;
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  const obra = () => ((datos && datos.obras) || []).find((o) => o.id === obraId) || ((datos && datos.obras) || [])[0] || null;

  /* ═══════════════════════════════════ 1. Hoy */

  async function cargar() {
    datos = await pedir('api/personal');
    document.getElementById('quien').textContent = datos.quien || '';
  }

  async function hoy() {
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      await cargar();
    } catch (e) {
      if (!activa()) return;
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-per="hoy">Reintentar</button></div>`;
      return;
    }
    if (activa()) pintarHoy();
  }

  function pintarHoy() {
    const obras = datos.obras || [];
    const o = obra();
    const puede = datos.puede && datos.puede.fichar;
    if (!o) { $app.innerHTML = '<p class="vacio">No tienes obras abiertas en las que fichar.</p>'; return; }
    const previsto = o.previsto;
    const estado = previsto === null ? (o.real ? 'aviso' : 'neutra') : o.real >= previsto ? 'bien' : o.real / previsto >= 0.8 ? 'aviso' : 'mal';
    $app.innerHTML = `
      ${window.CX && window.CX.obras().length ? '' : obras.length > 1 ? `<label class="elegir-obra">Obra<select data-per-cambio="obra">${obras.map((x) => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select></label>` : `<p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}</p>`}
      <section class="hoy ${estado}">
        <div class="cifra-grande"><b>${o.real}</b>${previsto !== null ? `<span> de ${previsto}</span>` : ''}</div>
        <div>${previsto !== null ? 'han venido de los previstos' : o.real === 1 ? 'ha venido (sin previsión para hoy)' : 'han venido (sin previsión para hoy)'}</div>
        <small>${esc(fechaLarga(datos.fecha))}${o.mano ? ` · ${o.mano} a mano` : ''}</small>
      </section>
      ${puede ? `<section class="acciones">
        <button class="boton grande" data-per="leer"><i class="ic ic-tarjeta"></i>Leer tarjeta del operario</button>
        <p class="nota centrada">Puedes sacar varias tarjetas en la misma foto.</p>
      </section>` : '<p class="nota">Tu rol puede ver quién ha venido, pero no fichar.</p>'}
      <h2>Subcontratas <span class="cuenta">${o.subcontratas.length}</span></h2>
      ${o.subcontratas.length ? window.CX.listaAgrupada('personal-subs', o.subcontratas, { envolver: (h) => h, fila: (s) => tarjetaSub(s, puede), repintar: pintarHoy }) : '<p class="vacio">Aún no hay subcontratas con operarios dados de alta ni previsión en esta obra.</p>'}
      ${puede ? '<button class="boton secundario" data-per="alta">+ Operario nuevo</button>' : ''}`;
  }

  function tarjetaSub(s, puede) {
    const chip = s.previsto === null
      ? `<span class="chip ${s.real ? 'aviso' : 'neutra'}">${s.real} · sin previsión</span>`
      : `<span class="chip ${CLASE[s.estado] || 'neutra'}">${s.real} de ${s.previsto}</span>`;
    return `<article class="tarjeta sub">
      <div class="cabeza-sub"><strong>${esc(s.nombre)}</strong>${chip}</div>
      ${s.operarios.length ? `<ul class="operarios">${s.operarios.map((x) => `<li>
        <div><span class="nombre">${esc(x.nombre)}</span>${x.oficio ? ` <small>${esc(x.oficio)}</small>` : ''}</div>
        ${x.fichado ? `<span class="chip ${x.fichado === 'qr' ? 'bien' : 'aviso'}">${x.fichado === 'qr' ? '✓' : '✎ a mano'} ${esc(hora(x.hora))}</span>`
          : puede ? `<button class="enlace" data-per="mano" data-id="${esc(x.id)}" data-nombre="${esc(x.nombre)}">Fichar a mano</button>` : '<span class="chip neutra">No ha venido</span>'}
      </li>`).join('')}</ul>` : '<p class="nota">Sin operarios dados de alta.</p>'}
    </article>`;
  }

  /* ═══════════════════════════════════ 2. La foto de la tarjeta */

  async function fotoQr(archivo) {
    if (!archivo) return;
    $app.innerHTML = '<div class="leyendo"><div class="giro"></div><p>Leyendo la tarjeta…</p><small>El QR se lee en el ordenador de la obra.</small></div>';
    try {
      const r = await pedir('api/qr', { method: 'POST', headers: { 'Content-Type': archivo.type || 'image/jpeg' }, body: archivo });
      if (!r.ok) throw new Error(r.error);
      resultado(r.resultados);
    } catch (e) {
      $app.innerHTML = `<section class="resultado mal"><div class="icono">?</div><h1>No se ha leído</h1><p class="sub">${esc(e.message)}</p></section>
        <button class="boton grande" data-per="leer"><i class="ic ic-camara"></i>Repetir la foto</button>
        <button class="boton secundario" data-per="hoy">Volver a la lista</button>`;
    }
  }

  const QUE = {
    fichado: ['bien', '✓', 'Fichado'],
    yaFichado: ['aviso', '=', 'Ya estaba fichado hoy'],
    baja: ['mal', '✕', 'De baja en la obra'],
    otraObra: ['mal', '✕', 'No es de tus obras'],
    desconocido: ['mal', '?', 'Tarjeta que no existe'],
    noEsTarjeta: ['mal', '?', 'Ese QR no es una tarjeta de operario'],
  };

  function resultado(lista) {
    const uno = lista.length === 1 ? lista[0] : null;
    const [clase, icono, titulo] = uno ? QUE[uno.estado] || QUE.desconocido : ['bien', String(lista.filter((x) => x.estado === 'fichado').length), 'fichados'];
    $app.innerHTML = `
      <section class="resultado ${clase}">
        <div class="icono">${esc(icono)}</div>
        <h1>${esc(uno && uno.nombre ? uno.nombre : titulo)}</h1>
        ${uno ? `<p>${esc(uno.nombre ? titulo : '')}${uno.estado === 'yaFichado' ? ` a las ${esc(hora(uno.hora))}${uno.origen === 'mano' ? ' (a mano)' : ''}` : uno.estado === 'fichado' ? ` a las ${esc(hora(uno.hora))}` : ''}</p>` : `<p>${lista.length} tarjetas en la foto</p>`}
        ${uno && uno.proveedor ? `<p class="sub">${esc(uno.proveedor)}${uno.oficio ? ` · ${esc(uno.oficio)}` : ''}${uno.obra ? ` · ${esc(uno.obra)}` : ''}</p>` : ''}
      </section>
      ${uno ? '' : `<ul class="recientes">${lista.map((x) => { const [c, , t] = QUE[x.estado] || QUE.desconocido; return `<li><div><strong>${esc(x.nombre || '—')}</strong><br><small>${esc(x.proveedor || '')}</small></div><span class="chip ${c}">${esc(t)}</span></li>`; }).join('')}</ul>`}
      <button class="boton grande" data-per="leer"><i class="ic ic-camara"></i>Siguiente tarjeta</button>
      <button class="boton secundario" data-per="hoy">Volver a la lista</button>`;
    cargar().catch(() => {});
  }

  /* ═══════════════════════════════════ 3. A mano y altas */

  async function aMano(id, nombre) {
    if (!window.confirm(`¿Fichar a ${nombre} a mano? Quedará marcado «a mano», no por tarjeta.`)) return;
    try {
      const r = await postJson('api/fichar', { operarioId: id });
      if (!r.ok) throw new Error(r.error);
      aviso(`${nombre}: fichado a mano a las ${hora(r.hora)}.`, 'bien');
      await cargar();
      pintarHoy();
    } catch (e) { aviso(e.message); }
  }

  function alta() {
    const o = obra();
    if (!o) return;
    const opciones = (lista) => lista.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
    $app.innerHTML = `
      <button class="volver" data-per="hoy">‹ Personal</button>
      <h2>Operario nuevo</h2>
      <p class="nota">${esc(o.codigo)} · ${esc(o.nombre)}. Solo el nombre, la empresa y el oficio: nada más.</p>
      <label>Nombre y apellido<input id="a-nombre" autocomplete="off" autocapitalize="words"></label>
      <label>Empresa<select id="a-empresa"><option value="">Elige…</option>
        ${o.proveedores.deObra.length ? `<optgroup label="En esta obra">${opciones(o.proveedores.deObra)}</optgroup>` : ''}
        ${o.proveedores.resto.length ? `<optgroup label="Otras">${opciones(o.proveedores.resto)}</optgroup>` : ''}
      </select></label>
      <label>Oficio (si quieres)<input id="a-oficio" autocomplete="off" placeholder="Oficial, peón, frigorista…"></label>
      <label class="marca"><input type="checkbox" id="a-hoy" checked> Ha venido hoy: ficharlo ya (a mano)</label>
      <button class="boton grande" data-per="guardar-alta">Dar de alta</button>
      <p class="nota">Su tarjeta con el QR se imprime en el ordenador: Obra › Personal › Operarios.</p>`;
    document.getElementById('a-nombre').focus();
  }

  async function guardarAlta(boton) {
    const v = (id) => document.getElementById(id).value;
    boton.disabled = true;
    try {
      const r = await postJson('api/operario', { obraId: obra().id, nombre: v('a-nombre'), proveedorId: v('a-empresa'), oficio: v('a-oficio'), ficharHoy: document.getElementById('a-hoy').checked });
      if (!r.ok) throw new Error(r.error);
      aviso(`${r.nombre} dado de alta${r.fichaje && r.fichaje.ok ? ' y fichado hoy a mano' : ''}. Imprime su tarjeta en el ordenador.`, 'bien');
      await cargar();
      pintarHoy();
    } catch (e) {
      aviso(e.message);
      boton.disabled = false;
    }
  }

  /* ═══════════════════════════════════ Los clics */

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-per]');
    if (!b) return;
    const a = b.dataset.per;
    if (a === 'hoy') hoy();
    else if (a === 'leer') $camara.click();
    else if (a === 'mano') aMano(b.dataset.id, b.dataset.nombre);
    else if (a === 'alta') alta();
    else if (a === 'guardar-alta') guardarAlta(b);
  });
  $app.addEventListener('change', (ev) => {
    if (!activa() || ev.target.dataset.perCambio !== 'obra') return;
    obraId = ev.target.value;
    try { localStorage.setItem('personal.obra', obraId); } catch { /* sin almacenamiento */ }
    pintarHoy();
  });
  $camara.addEventListener('change', () => {
    const archivo = $camara.files && $camara.files[0];
    $camara.value = '';
    fotoQr(archivo);
  });

  window.addEventListener('hashchange', () => { if (activa()) hoy(); });
  if (activa()) hoy();
})();
