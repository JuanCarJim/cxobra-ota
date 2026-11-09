'use strict';
/*
 * MARCAR EN EL PLANO DESDE EL MÓVIL (8-nov-2026, JC 5-nov, nota a7a207a7).
 *
 * «Marcar» y un toque en el plano: lo que falta (texto, foto de la zona y fotos
 * adjuntas) o, cuando esté activado, un equipo nuevo para colgarle sus
 * documentos. Todo entra POR CONFIRMAR (shared/commissioning/faltasPlano.js).
 *
 * Lo que se teclea y se fotografía se queda en el teléfono al momento
 * (autoguardado.js): si se cierra la hoja o la app, al pulsar «Marcar» sigue
 * donde estaba. Lo llama planoEquipos.js, que es quien pinta el plano.
 */
(function planoFaltasCx() {
  const C = window.CX;
  if (!C) return;
  const AG = window.AUTOGUARDADO;
  const { esc, cifra } = C;
  const MAX_FOTOS = 10;
  const NOMBRE_ACCION = { confirmar: 'Confirmar', resolver: 'Ya está resuelta', reabrir: 'Reabrir', descartar: 'Descartar' };

  let h = null; /* lo que da planoEquipos.js: datos(), planta(), repintar(), recargar(), abrirEquipo(id) */
  let marcando = false;
  let ocultas = false;
  let form = null;
  let guardando = false;
  let $capa = null;
  let viendo = null;
  let tocadoEn = 0;

  const clave = () => `plano-falta.${C.obraId()}`;
  const puedeMarcar = () => Boolean(h && h.datos() && h.datos().puedeMarcar);
  const conEquipo = () => Boolean(h && h.datos() && h.datos().altaEquipoMovil);
  const abierta = (f) => f.estado === 'porConfirmar' || f.estado === 'confirmada';

  const ESTILO = `
  .fa-marcar{position:absolute;left:8px;bottom:8px;z-index:5;min-height:44px;margin:0;padding:0 14px;font-size:14px;box-shadow:var(--sombra,0 1px 4px rgba(0,0,0,.18))}
  .fa-aviso{position:absolute;left:8px;right:8px;bottom:8px;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 4px 4px 14px;border-radius:10px;font-size:14px;font-weight:600;color:var(--sobre-relleno);background:var(--acento-relleno)}
  .fa-aviso button{min-height:44px;border:0;background:none;color:var(--sobre-relleno);font:inherit;padding:0 10px}
  .pe-marco.fa-activo{cursor:crosshair;outline:2px solid var(--acento);outline-offset:-2px}
  .fa-punto{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;min-width:0;min-height:0;padding:0;margin:0;border:2px solid var(--vd-lienzo);border-radius:50% 50% 50% 4px;font-size:13px;font-weight:700;line-height:1;color:var(--sobre-relleno);background:var(--aviso);box-shadow:0 1px 3px rgba(0,0,0,.4);z-index:3}
  .fa-punto.confirmada{background:var(--mal)}
  .fa-punto.resuelta{background:var(--bien);opacity:.55}
  .fa-hoja{max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .fa-cabeza{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .fa-cabeza h3{margin:0;font-size:19px}
  .fa-cierra{min-width:44px;min-height:44px;border:0;background:none;font-size:22px;color:var(--textoTenue)}
  .fa-tipos{display:flex;gap:4px;margin:8px 0;padding:3px;border-radius:10px;background:var(--rejilla)}
  .fa-tipos button{flex:1;min-height:40px;border:0;border-radius:8px;background:none;font:inherit;font-size:14px;color:var(--texto)}
  .fa-tipos button[aria-pressed="true"]{background:var(--panel);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.12)}
  .fa-hoja label{display:block;margin:10px 0 4px;font-size:13px;color:var(--textoTenue)}
  .fa-hoja textarea,.fa-hoja input[type=text]{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--borde);border-radius:10px;font:inherit;font-size:16px;background:var(--panel);color:var(--texto)}
  .fa-fotos{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
  .fa-fotos button.fa-mini{position:relative;width:64px;height:64px;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--rejilla)}
  .fa-mini img{width:100%;height:100%;object-fit:cover;display:block}
  .fa-mini span{position:absolute;left:0;right:0;bottom:0;font-size:10px;color:var(--vd-sobre-imagen);background:rgba(0,0,0,.55);text-align:center}
  .fa-acciones{display:flex;gap:8px;margin-top:10px}
  .fa-acciones button{flex:1;min-height:44px;margin:0}
  .fa-pie{margin:10px 0 0;font-size:13px;color:var(--textoTenue)}
  .fa-texto{margin:8px 0;font-size:16px;white-space:pre-wrap}
  .fa-descartar{display:block;width:100%;min-height:44px;margin-top:6px;border:0;background:none;font:inherit;font-size:14px;color:var(--textoTenue)}`;
  function ponerEstilo() {
    if (document.getElementById('fa-estilo')) return;
    const s = document.createElement('style');
    s.id = 'fa-estilo';
    s.textContent = ESTILO;
    document.head.appendChild(s);
  }

  /* ── Lo que pinta planoEquipos.js */
  function marcas(p) {
    if (ocultas || !p.faltas) return '';
    return p.faltas.filter((f) => f.x !== null).map((f) => `<button class="fa-punto ${esc(f.estado)}" style="left:${f.x * 100}%;top:${f.y * 100}%" data-fa-ver="${esc(f.id)}" aria-label="${esc(`${f.tag}: ${f.estadoNombre}`)}">${f.estado === 'resuelta' ? '✓' : '!'}</button>`).join('');
  }
  function mando(p) {
    if (!p.plano || !puedeMarcar()) return '';
    if (marcando) return '<div class="fa-aviso"><span>Toca el sitio en el plano</span><button data-fa-cancelar>Cancelar</button></div>';
    return '<button class="boton secundario fa-marcar" data-fa-marcar>Marcar</button>';
  }
  function chip(p) {
    const n = (p.faltas || []).filter(abierta).length;
    if (!(p.faltas || []).length) return '';
    return `<button data-fa-capa aria-pressed="${!ocultas}">Lo que falta <b>${cifra(n)}</b></button>`;
  }

  /* ── La hoja */
  function cerrar() {
    if ($capa) { $capa.remove(); $capa = null; }
    form = null; viendo = null;
  }
  function capa(html) {
    ponerEstilo();
    if ($capa) $capa.remove();
    $capa = document.createElement('div');
    $capa.innerHTML = `<div class="hoja-fondo abierta" data-fa-cerrar></div><div class="hoja abierta fa-hoja" role="dialog" aria-modal="true">${html}</div>`;
    $capa.addEventListener('click', alTocarHoja);
    $capa.addEventListener('input', alEscribir);
    document.body.appendChild($capa);
    return $capa;
  }

  function persistir() {
    if (!form) return;
    AG.guardar(clave(), { ...form, fotos: AG.fotosParaGuardar(form.fotos) });
  }

  function pintarForm() {
    const planta = form.planta || 'Sin planta';
    const miniaturas = form.fotos.map((f, i) => `<button class="fa-mini" data-fa-mini="${i}" aria-label="Ver foto ${i + 1}">${f.url ? `<img src="${esc(f.url)}" alt="">` : ''}<span>${f.momento === 'zona' ? 'Zona' : 'Adjunta'}</span></button>`).join('');
    const tipos = conEquipo() ? `<div class="fa-tipos" role="group"><button data-fa-tipo="falta" aria-pressed="${form.tipo === 'falta'}">Lo que falta</button><button data-fa-tipo="equipo" aria-pressed="${form.tipo === 'equipo'}">Equipo nuevo</button></div>` : '';
    const cuerpo = form.tipo === 'equipo'
      ? `<label for="fa-tag">TAG (si no lo tiene, déjalo vacío)</label><input id="fa-tag" type="text" data-fa-campo="tag" value="${esc(form.tag || '')}" autocapitalize="characters">
        <label for="fa-den">Qué equipo es</label><input id="fa-den" type="text" data-fa-campo="denominacion" value="${esc(form.denominacion || '')}">
        <label for="fa-nota">Nota</label><textarea id="fa-nota" rows="2" data-fa-campo="nota">${esc(form.nota || '')}</textarea>`
      : `<label for="fa-texto">¿Qué falta?</label><textarea id="fa-texto" rows="3" data-fa-campo="texto">${esc(form.texto || '')}</textarea>
        <div class="fa-fotos">${miniaturas}</div>
        <div class="fa-acciones"><button class="boton secundario" data-fa-foto="camara">Foto de la zona</button><button class="boton secundario" data-fa-foto="galeria">Adjuntar fotos</button></div>`;
    capa(`<div class="fa-cabeza"><h3>Marcar en ${esc(planta)}</h3><button class="fa-cierra" data-fa-cerrar aria-label="Cerrar">×</button></div>
      ${tipos}${cuerpo}
      <p class="fa-pie">Entra por confirmar.</p>
      <div class="fa-acciones"><button class="boton" data-fa-guardar${guardando ? ' disabled' : ''}>${guardando ? 'Guardando…' : 'Guardar'}</button></div>
      <button class="fa-descartar" data-fa-tirar>Descartar</button>`);
  }

  function pintarFicha(f) {
    viendo = f.id;
    const miniaturas = f.fotos.map((x) => `<button class="fa-mini" data-fa-ampliar aria-label="Ver foto"><img data-src="api/plano-equipos/falta/foto?id=${encodeURIComponent(f.id)}&i=${x.i}" alt=""><span>${x.momento === 'zona' ? 'Zona' : 'Adjunta'}</span></button>`).join('');
    const quien = [f.autor, f.en ? String(f.en).slice(0, 10) : ''].filter(Boolean).join(' · ');
    const nodo = capa(`<div class="fa-cabeza"><h3 class="cifra">${esc(f.tag)}</h3><button class="fa-cierra" data-fa-cerrar aria-label="Cerrar">×</button></div>
      <div class="sub">${esc(f.estadoNombre)}${f.sala ? ` · ${esc(f.sala)}` : ''}</div>
      ${f.texto ? `<p class="fa-texto">${esc(f.texto)}</p>` : ''}
      ${miniaturas ? `<div class="fa-fotos">${miniaturas}</div>` : ''}
      ${quien ? `<p class="fa-pie">${esc(quien)}</p>` : ''}
      ${f.acciones.length ? `<div class="fa-acciones">${f.acciones.map((a, i) => `<button class="boton${i ? ' secundario' : ''}" data-fa-accion="${esc(a)}">${esc(NOMBRE_ACCION[a] || a)}</button>`).join('')}</div>` : ''}`);
    C.cargarImagenes(nodo);
  }

  /* ── Marcar */
  function empezar() {
    const b = AG.leer(clave());
    if (b && b.x !== undefined) {
      AG.restaurarFotos(b.fotos).then((fotos) => { form = { ...b, fotos: fotos.filter((x) => x.archivo) }; pintarForm(); });
      return;
    }
    marcando = true;
    h.repintar();
  }
  function cancelar() { marcando = false; h.repintar(); }

  /** El toque en el plano mientras se marca, en fracción del plano. */
  function tocado(x, y) {
    marcando = false;
    tocadoEn = Date.now();
    const p = h.planta();
    form = { x, y, planta: p.planta || '', tipo: 'falta', texto: '', tag: '', denominacion: '', nota: '', fotos: [] };
    persistir();
    h.repintar();
    pintarForm();
  }

  async function anadirFotos(camara) {
    const f = form;
    const archivos = await AG.elegirFotos(camara);
    if (!archivos.length || f !== form) return;
    for (const archivo of archivos) {
      if (f.fotos.length >= MAX_FOTOS) { C.aviso(`Como mucho ${MAX_FOTOS} fotos.`); break; }
      f.fotos.push(await AG.fotoNueva(await AG.reducirFoto(archivo), { momento: camara ? 'zona' : 'adjunta' }));
    }
    if (f !== form) return;
    persistir();
    pintarForm();
  }

  async function guardar() {
    if (guardando || !form) return;
    const f = form;
    const equipo = f.tipo === 'equipo';
    if (!equipo && !String(f.texto || '').trim() && !f.fotos.length) { C.aviso('Di qué falta o añade una foto.'); return; }
    guardando = true;
    pintarForm();
    try {
      let r;
      if (equipo) {
        r = await C.postJson('api/plano-equipos/equipo-nuevo', { obra: C.obraId(), planta: f.planta, x: f.x, y: f.y, tag: f.tag, denominacion: f.denominacion, nota: f.nota });
      } else {
        const fotos = [];
        for (const x of f.fotos) fotos.push({ id: await C.subirFoto(x.archivo), momento: x.momento });
        r = await C.postJson('api/plano-equipos/falta', { obra: C.obraId(), planta: f.planta, x: f.x, y: f.y, texto: f.texto, fotos });
      }
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido guardar.');
      AG.borrar(clave());
      cerrar();
      guardando = false;
      if (equipo) C.aviso(r.existente ? `${r.tag} ya existía: te llevo a él.` : `${r.tag} creado, por confirmar.`, 'bien');
      else C.aviso(`${r.tag} marcado, por confirmar.`, 'bien');
      await h.recargar();
      if (equipo) h.abrirEquipo(r.id);
    } catch (e) {
      guardando = false;
      C.aviso(`${e.message} Sigue guardado en el móvil.`);
      if (form === f) pintarForm();
    }
  }

  async function accion(que, boton) {
    const id = viendo;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/plano-equipos/falta/estado', { id, accion: que });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha podido cambiar.');
      cerrar();
      await h.recargar();
    } catch (e) { boton.disabled = false; C.aviso(e.message); }
  }

  function alEscribir(ev) {
    const k = ev.target.dataset && ev.target.dataset.faCampo;
    if (!k || !form) return;
    form[k] = ev.target.value;
    persistir();
  }

  async function tirar() {
    const seguro = C.confirmar ? await C.confirmar('¿Descartar esta marca?', 'Se borra lo escrito y sus fotos.', 'Sí, descartar') : window.confirm('¿Descartar esta marca?');
    if (!seguro) return;
    AG.borrar(clave());
    cerrar();
  }

  function alTocarHoja(ev) {
    const t = ev.target;
    /* El mismo dedo que ha marcado el sitio: su click no cierra la hoja recién abierta. */
    if (Date.now() - tocadoEn < 450) return;
    if (t.closest('[data-fa-cerrar]')) { cerrar(); return; }
    if (t.closest('[data-fa-guardar]')) { guardar(); return; }
    if (t.closest('[data-fa-tirar]')) { tirar(); return; }
    const ti = t.closest('[data-fa-tipo]');
    if (ti && form) { form.tipo = ti.dataset.faTipo; persistir(); pintarForm(); return; }
    const fo = t.closest('[data-fa-foto]');
    if (fo) { anadirFotos(fo.dataset.faFoto === 'camara'); return; }
    const mi = t.closest('[data-fa-mini]');
    if (mi && form) {
      const i = Number(mi.dataset.faMini);
      const f = form;
      AG.verFoto({ url: f.fotos[i] && f.fotos[i].url, quitar: () => {
        const [x] = f.fotos.splice(i, 1);
        if (x && x.local) AG.borrarFoto(x.local);
        if (f === form) { persistir(); pintarForm(); }
      } });
      return;
    }
    const am = t.closest('[data-fa-ampliar]');
    if (am) { const img = am.querySelector('img'); if (img && img.src) AG.verFoto({ url: img.src }); return; }
    const ac = t.closest('[data-fa-accion]');
    if (ac) accion(ac.dataset.faAccion, ac);
  }

  /** Los toques de la pantalla del plano; true si eran suyos. */
  function clic(ev) {
    const t = ev.target;
    if (t.closest('[data-fa-marcar]')) { empezar(); return true; }
    if (t.closest('[data-fa-cancelar]')) { cancelar(); return true; }
    if (t.closest('[data-fa-capa]')) { ocultas = !ocultas; h.repintar(); return true; }
    const v = t.closest('[data-fa-ver]');
    if (v) {
      const f = (h.planta().faltas || []).find((x) => x.id === v.dataset.faVer);
      if (f) pintarFicha(f);
      return true;
    }
    return false;
  }

  try { window.addEventListener('hashchange', () => { marcando = false; cerrar(); }); } catch { /* nada */ }
  window.addEventListener('movil:obra', () => { marcando = false; cerrar(); });

  window.CX_PLANO_FALTAS = {
    conectar: (host) => { h = host; ponerEstilo(); },
    marcas, mando, chip, clic, tocado,
    marcando: () => marcando,
  };
})();
