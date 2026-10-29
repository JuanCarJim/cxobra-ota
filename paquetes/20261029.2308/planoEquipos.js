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
 * 29-oct (JC): navegar con los dedos (pellizco centrado entre los dedos,
 * arrastre con uno, doble toque para acercar; la página no se mueve) y, al
 * pulsar un equipo, una hoja inferior corta con qué es, cómo está y los
 * botones que ese equipo necesita (los calcula el servidor con las reglas de
 * shared/commissioning: Rellenar datos, Checklist, Balanceo, Estanqueidad);
 * cada botón abre la pantalla de siempre y al volver el plano queda como
 * estaba (mismo zoom y posición). «Todos los que estemos enrolados en la obra
 * los podamos ver»: lo ve cualquier persona de la obra; sin Commissioning es
 * solo lectura (sin botones) y es su propia sección («Más › Plano de equipos»).
 */
(function planoEquiposCx() {
  const C = window.CX;
  if (!C) return;
  const { esc, cifra } = C;

  const NOMBRE = { verde: 'Hecho', azul: 'Falta documento', rojo: 'Sin empezar' };
  const ORDEN = ['verde', 'azul', 'rojo'];
  const ZOOM_MAX = 8;
  const ZOOM_SALAS = 3; /* desde aquí se leen los nombres de sala encima del plano */
  /* El dibujo de cada familia viene del servidor (shared/commissioning/planoEquipos.js: ICONOS),
     así es el mismo en escritorio, web y móvil, también sin conexión. */
  const SIMBOLO_GENERICO = '<rect class="cuerpo" x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><rect class="lleno" x="8" y="8" width="8" height="8" rx="1"/>';
  const simbolo = (k) => `<svg class="simbolo-boca" viewBox="0 0 24 24" aria-hidden="true">${(datos && datos.iconos && datos.iconos[k] && datos.iconos[k].svg) || SIMBOLO_GENERICO}</svg>`;
  let datos = null;
  let planta = null;
  let zoom = 1;
  let elegida = null; /* el equipo tocado */
  let ocultos = new Set(); /* colores que no se enseñan */
  let $raiz = null;
  let vista = null; /* cómo estaba el plano al irse a una ficha, para volver igual */
  let propio = false; /* sección «Plano de equipos» (sin Commissioning) */
  let verSinUbicar = false; /* franja gris «Sin ubicar en el plano» abierta */
  /* Materiales instalados (29-oct, JC): compuertas, difusores, rejillas… con nº de serie y ficha técnica. */
  let capasOff = new Set(); /* capas apagadas (equipos, compuertas, difusores…) */
  let mat = null; /* el material tocado */
  let lista = 'equipos'; /* la lista de abajo: equipos o materiales */
  let filtro = '';
  const ESTADO_MAT = { sinDatos: 'Sin datos', conFicha: 'Con ficha', conIncidencia: 'Con incidencia' };
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
  .pe-marco{position:relative;overflow:hidden;height:52vh;border:1px solid var(--borde,#c9d3d6);border-radius:10px;background:#fff;touch-action:none;overscroll-behavior:contain;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .pe-lienzo{position:relative}
  .pe-lienzo img{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none;pointer-events:none}
  .pe-lienzo .marca-boca.azul{color:var(--pe-azul)}
  .pe-lienzo .marca-boca.azul .simbolo-boca .cuerpo{fill:color-mix(in srgb,var(--pe-azul) 22%,#fff)}
  .pe-lienzo .marca-boca.azul .rotulo-boca{background:var(--pe-azul)}
  .pe-lienzo .marca-boca .simbolo-boca{height:20px;width:20px;border-radius:5px}
  /* La etiqueta sin color de estado: el estado se lee en el icono y en la leyenda. */
  #app .pe-lienzo .marca-boca .rotulo-boca{background:rgba(255,255,255,.74);color:#0b4f48;padding:0 3px;font-weight:700;text-shadow:0 0 2px #fff}
  .pe-lienzo .marca-boca.elegida{z-index:3}
  .pe-lienzo .marca-boca.elegida .simbolo-boca{outline:3px solid var(--acento,#178276);outline-offset:2px}
  .pe-iconos{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:12px;color:var(--textoTenue,#567)}
  .pe-iconos span{display:inline-flex;align-items:center;gap:4px}
  .pe-iconos svg{height:16px;width:16px;color:var(--acento,#178276)}
  .pe-iconos svg .cuerpo{fill:#fff}
  .pe-conjunto{margin-top:6px;font-size:14px;display:grid;gap:2px}
  .pe-conjunto div{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;font-size:13.5px}
  .pe-conjunto div>span{flex:1 1 auto;min-width:0}
  .pe-conjunto button{width:auto;min-width:56px;min-height:32px;margin:0;padding:0 12px;font-size:13px;flex:none}
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
  .pe-hoja{position:fixed;left:8px;right:8px;bottom:calc(var(--hueco-barra,104px) + 4px + env(safe-area-inset-bottom,0px));z-index:12;max-height:42vh;overflow:auto;padding:10px 12px 12px;border-radius:14px;background:var(--superficie,#fff);box-shadow:0 -2px 14px rgba(8,50,60,.28);border:1px solid var(--borde,#c9d3d6)}
  .pe-hoja[hidden]{display:none}
  .pe-hoja .fila-principal{display:flex;align-items:center;gap:8px;justify-content:space-between}
  .pe-hoja .sub{margin-top:3px;font-size:14px}
  .pe-hoja .falta{font-size:13.5px;margin-top:3px}
  .pe-hoja .cierra{min-width:44px;min-height:44px;border:0;background:none;font-size:22px;color:var(--textoTenue,#567);margin:-8px -8px -8px 0}
  .pe-acciones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
  .pe-acciones button{min-height:46px;margin:0;font-size:15px}
  .pe-hoja .mas{display:block;margin-top:8px;font-size:14px}
  .pe-cuerpo{padding-bottom:0}
  .pe-elegido .sub{margin-top:4px;font-size:14px}
  .pe-elegido ul{margin:4px 0 0;padding-left:18px;font-size:14px}
  .pe-lista{background:var(--superficie,#fff);border-radius:10px;box-shadow:var(--sombra);max-height:46vh;overflow:auto;-webkit-overflow-scrolling:touch}
  .pe-lista table{width:100%;border-collapse:collapse;font-size:13.5px}
  .pe-lista th{position:sticky;top:0;background:var(--superficie,#fff);text-align:left;font-weight:600;color:var(--acento,#178276);border-bottom:2px solid var(--acento,#178276);padding:6px 8px;z-index:1}
  .pe-lista td{padding:8px;border-bottom:1px solid var(--borde,#e3e8ea);vertical-align:top}
  .pe-lista tr.elegida td{background:var(--acento-suave,#E6F4F0)}
  .pe-lista td.estado{white-space:nowrap}
  .pe-lista .tenue{color:var(--textoTenue,#567)}
  /* Sin ubicar en el plano (29-oct, JC): en gris, para estudiarlos. */
  .pe-punto.pe-gris{background:var(--textoTenue,#567);opacity:.55}
  .pe-sin-ubicar{margin:0 0 8px;font-size:13px;color:var(--textoTenue,#567)}
  .pe-sin-ubicar summary{min-height:36px;display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer}
  .pe-sin-ubicar .pe-grises{display:flex;flex-wrap:wrap;gap:4px;max-height:118px;overflow:auto;margin-top:4px}
  .pe-sin-ubicar .pe-grises button{min-height:32px;border:1px solid var(--borde,#c9d3d6);background:var(--fondo,#f3f5f6);color:var(--textoTenue,#567);border-radius:999px;padding:2px 10px;font-size:12.5px}
  .pe-lista tr.sin-ubicar td{color:var(--textoTenue,#567)}
  /* Materiales: marcas pequeñas por estado (gris sin datos · teal con ficha · rojo con incidencia), forma por capa. */
  /* Materiales con la FORMA del elemento (29-oct, JC): difusor redondo, lineal alargado, rejilla con lamas…
     Color por estado: gris sin datos · teal con ficha · rojo con incidencia. Crecen un poco al acercar (--pe-esc). */
  .pe-mat{position:absolute;transform:translate(-50%,-50%) rotate(var(--giro,0deg));width:calc(var(--w,13px) * var(--pe-esc,1));height:calc(var(--h,13px) * var(--pe-esc,1));min-height:0;min-width:0;padding:0;margin:0;border:0;background:none;color:var(--textoTenue,#567);line-height:0}
  .pe-mat svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 1px #fff)}
  .pe-mat svg *{vector-effect:non-scaling-stroke;stroke-width:1px}
  .pe-lienzo.con-salas .pe-mat svg *{stroke-width:1.5px}
  .pe-mat svg .cuerpo{fill:color-mix(in srgb,currentColor 14%,#fff)}
  .pe-mat::after{content:'';position:absolute;inset:-8px}
  .pe-mat.conFicha{color:var(--acento,#178276)} .pe-mat.conIncidencia{color:var(--mal)}
  .pe-mat.elegida{outline:3px solid var(--pe-azul);outline-offset:3px;z-index:3}
  .pe-mat.apagada{opacity:.15}
  .pe-mat span{display:none;position:absolute;left:100%;top:50%;margin-left:3px;transform:translateY(-50%) rotate(calc(-1 * var(--giro,0deg)));line-height:1.1;white-space:nowrap;font-size:9px;font-weight:600;color:#3d5560;background:rgba(255,255,255,.78);padding:0 2px;border-radius:2px}
  .pe-lienzo.con-salas .pe-mat span{display:block}
  .pe-formas{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:12px;color:var(--textoTenue,#567)}
  .pe-formas span{display:inline-flex;align-items:center;gap:4px}
  .pe-formas svg{height:14px;width:auto;max-width:34px;color:var(--acento,#178276)}
  .pe-formas svg .cuerpo{fill:#fff}
  .pe-lista td .pe-sala-cod,.pe-sala-cod{display:block;font-size:11.5px;color:var(--textoTenue,#567);white-space:nowrap}
  .pe-bloque{margin-top:8px;padding-top:6px;border-top:1px solid var(--borde,#e3e8ea)}
  .pe-bloque h4{margin:0 0 3px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--acento,#178276)}
  .pe-cad{font-size:11.5px;color:var(--textoTenue,#567);margin-top:2px}
  .pe-vacio{color:var(--textoTenue,#567);opacity:.7}
  .pe-serie input::placeholder{color:var(--textoTenue,#567);opacity:.55}
  .pe-capas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 6px;-webkit-overflow-scrolling:touch}
  .pe-capas button{flex:none;min-height:34px;border:1px solid var(--borde,#c9d3d6);background:var(--superficie,#fff);color:var(--texto,#123);border-radius:999px;padding:3px 10px;font-size:13px}
  .pe-capas button[aria-pressed="true"]{background:var(--acento-suave,#E6F4F0);border-color:var(--acento,#178276)}
  .pe-capas button[aria-pressed="false"]{opacity:.5;text-decoration:line-through}
  .pe-punto.sinDatos{background:var(--textoTenue,#567);border-radius:50%} .pe-punto.conFicha{background:var(--acento,#178276);border-radius:50%} .pe-punto.conIncidencia{background:var(--mal);border-radius:50%}
  .pe-pestanas{display:flex;gap:6px;align-items:center;margin:8px 0 6px}
  .pe-pestanas button{min-height:36px;margin:0;border:1px solid var(--borde,#c9d3d6);background:var(--superficie,#fff);color:var(--texto,#123);border-radius:999px;padding:3px 12px;font-size:13.5px;width:auto}
  .pe-pestanas button.activa{background:var(--acento,#178276);border-color:var(--acento,#178276);color:#fff}
  .pe-buscar{width:100%;box-sizing:border-box;min-height:40px;margin:0 0 6px;font-size:15px}
  .pe-ficha{width:100%;border-collapse:collapse;margin-top:6px;font-size:13.5px}
  .pe-ficha th{text-align:left;font-weight:400;color:var(--textoTenue,#567);padding:2px 8px 2px 0;width:40%;vertical-align:top}
  .pe-ficha td{padding:2px 0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .pe-enlaces{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:15px}
  .pe-enlaces a{font-weight:600;min-height:32px;display:inline-flex;align-items:center}
  .pe-serie{display:flex;gap:6px;margin-top:8px} .pe-serie input{flex:1;min-width:0;min-height:42px;font-size:15px} .pe-serie button{width:auto;min-height:42px;margin:0;padding:0 14px}
  .pe-entregable{font-size:13px;margin:0 0 6px}
  @media (min-width:900px){
    .pe-cuerpo{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;align-items:start}
    .pe-marco{height:calc(100vh - 250px)}
    .pe-lado{display:flex;flex-direction:column;height:calc(100vh - 250px)}
    .pe-lado .pe-lista{flex:1;max-height:none;min-height:0}
    .pe-lado .pe-elegido{margin-top:0}
    .pe-hoja{position:static;max-height:none;box-shadow:var(--sombra);margin:0 0 8px}
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

  async function cargar() {
    datos = await C.pedir(`api/plano-equipos?obra=${encodeURIComponent(C.obraId())}`);
    if (!datos.ok) throw new Error(datos.error);
    if (!Array.isArray(datos.plantas)) datos.plantas = [];
  }

  async function abrir($app) {
    $raiz = $app;
    ponerEstilo();
    elegida = null;
    vista = null;
    zoom = 1;
    document.body.classList.remove('sin-scroll');
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = true;
    $app.innerHTML = '<p class="cargando">Cargando el plano…</p>';
    try { await cargar(); } catch (e) {
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cx="lista">Volver</button></div>`;
      return;
    }
    pintar();
  }

  /* Vuelta desde una ficha del equipo: los colores se piden de nuevo (acaba de
     cambiar algo) y el plano queda con el mismo zoom, posición y equipo. */
  async function volver($app) {
    $raiz = $app;
    ponerEstilo();
    const v = vista;
    vista = null;
    if (!v) return abrir($app);
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = true;
    try { await cargar(); } catch { if (!datos) return abrir($app); }
    planta = v.planta; zoom = v.zoom; elegida = v.elegida; ocultos = new Set(v.ocultos);
    pintar();
    restaurar(v);
    if (elegida) mostrarHoja();
  }

  function restaurar(v) {
    const poner = () => {
      const m = $raiz && $raiz.querySelector('[data-pe-marco]');
      const l = $raiz && $raiz.querySelector('.pe-lista');
      if (m) { m.scrollLeft = v.sl; m.scrollTop = v.st; }
      if (l) l.scrollTop = v.lista;
    };
    poner();
    const img = $raiz.querySelector('.pe-lienzo img');
    if (img) img.addEventListener('load', poner, { once: true });
    window.scrollTo(0, v.pagina || 0);
  }

  const equipoElegido = () => {
    const p = plantaActual();
    return elegida && p ? p.equipos.find((x) => x.id === elegida) : null;
  };

  /* La hoja corta: qué es, cómo está y los botones que le tocan. */
  /* Los equipos que se resaltan a la vez: el elegido y los de su conjunto que están en este plano. */
  function idsDelConjunto() {
    const e = equipoElegido();
    const ids = new Set();
    if (!e) return ids;
    ids.add(e.id);
    for (const m of e.miembros || []) if (m.aqui) ids.add(m.id);
    return ids;
  }

  function leyendaIconos(p) {
    const usados = [...new Set(p.equipos.filter((e) => e.x !== null).map((e) => e.icono || 'generico'))];
    const ic = (datos && datos.iconos) || {};
    return `<div class="pe-iconos" role="group" aria-label="Iconos">${usados.filter((k) => ic[k]).map((k) => `<span><svg viewBox="0 0 24 24" aria-hidden="true">${ic[k].svg}</svg>${esc(ic[k].nombre)}</span>`).join('')}</div>`;
  }

  /* El conjunto en la ficha: UE y UI con su TAG; las que caen en otro plano o fuera de la vista, con «ver». */
  function conjuntoHtml(e) {
    const ms = e.miembros || [];
    if (ms.length < 2) return '';
    const filas = ms.map((m) => {
      const donde = m.id === e.id ? 'esta' : m.aqui ? 'en este plano' : m.enPlano ? `en ${esc(m.planta || 'otra planta')}` : 'sin colocar';
      const ver = m.id !== e.id && m.enPlano ? `<button class="boton secundario" data-pe-ver="${esc(m.id)}">ver</button>` : '';
      return `<div><span><em>${esc(m.papel)}</em> <b class="cifra">${esc(m.tag)}</b> <span class="tenue">· ${m.papel === 'UE' ? 'exterior' : 'interior'}, ${donde}</span></span>${ver}</div>`;
    });
    return `<div class="pe-conjunto">${filas.join('')}</div>`;
  }

  function hojaHtml(p) {
    const e = equipoElegido();
    if (!e) return '';
    const que = [e.tipo, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const falta = e.color === 'verde' ? 'Commissioning completo.'
      : (e.falta && e.falta.length ? `Le falta: ${e.falta.slice(0, 2).map(esc).join(', ')}${e.falta.length > 2 ? ` y ${e.falta.length - 2} más` : ''}.` : '');
    const rol = e.conjunto ? `${e.papel === 'UE' ? 'Exterior' : 'Interior'} de ${esc(e.conjunto)}` : '';
    const acc = Array.isArray(e.acciones) ? e.acciones : [];
    return `<div class="fila-principal"><strong class="cifra">${e.papel ? `<em>${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</strong>
        <span class="chip"><i class="pe-punto pe-${e.color}"></i> ${esc(NOMBRE[e.color])}</span>
        <button class="cierra" data-pe-cerrar aria-label="Cerrar">×</button></div>
      <div class="sub">${que ? esc(que) : ''}</div>
      <div class="sub">${salaHtml(e.sala)}${p.planta ? ` <span class="tenue">· ${esc(p.planta)}</span>` : ''}</div>
      ${e.miembros && e.miembros.length > 1 ? conjuntoHtml(e) : (rol ? `<div class="sub">${rol}</div>` : '')}
      ${falta ? `<div class="falta">${falta}</div>` : ''}
      ${(e.documentos || []).length ? `<div class="pe-enlaces">${e.documentos.map(enlaceDoc).join('')}</div>` : ''}
      ${p.plano && e.x === null ? '<div class="sub tenue">No está en el plano.</div>' : ''}
      ${acc.length ? `<div class="pe-acciones">${acc.map((a) => `<button class="boton${a.id === 'datos' ? '' : ' secundario'}" data-pe-accion="${esc(a.id)}">${esc(a.texto)}</button>`).join('')}</div>` : ''}
      ${datos.conCommissioning ? `<button class="enlace mas" data-pe-accion="equipo">Ver la ficha completa</button>` : (datos.puedeEditar === false ? '<div class="sub tenue">Solo lectura.</div>' : '')}`;
  }

  const casaMat = (m, q) => !q || [m.tag, m.codigo, m.sala, m.numSerie, m.tipoNombre, m.modelo].some((v) => String(v || '').toLowerCase().includes(q));
  const materialElegido = () => {
    const p = plantaActual();
    return mat && p ? (p.materiales || []).find((x) => x.id === mat) : null;
  };
  /* Solo el hipervínculo con su nombre legible, nunca la dirección en texto (29-oct, JC). */
  const enlaceFicha = (e, texto) => (e && e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${texto}: ${esc(e.nombre)}${e.nivel === 'tipo' ? ' (del tipo)' : ''} ↗</a>` : '');
  const enlaceDoc = (d) => `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.etiqueta)}: ${esc(d.nombre)} ↗</a>`;
  /* Formas y sala compartidas con el escritorio (shared/commissioning/formasPlano.js). */
  const FP = () => window.FORMAS_PLANO || null;
  const VACIO = '<span class="pe-vacio">—</span>';
  /* «Cuarto Eléctrico · P3.STE.0007» → el nombre en una línea y el código gris debajo. */
  function salaHtml(sala, vacio = 'sin sala') {
    if (!sala) return `<span class="tenue">${esc(vacio)}</span>`;
    const f = FP();
    const s = f ? f.partirSala(sala) : { nombre: sala, codigo: '' };
    return `${s.nombre ? esc(s.nombre) : ''}${s.codigo ? `<span class="pe-sala-cod cifra">${esc(s.codigo)}</span>` : ''}`;
  }
  const escMarcas = () => Math.min(3, 0.4 * Math.pow(Math.max(1, zoom), 0.8));
  /* «3 equipos · 669 materiales», sin los ceros: el contador de la pestaña dice lo mismo. */
  function cuentaTexto(nEq, nMat) {
    const t = [];
    if (nEq) t.push(`${cifra(nEq)} equipo${nEq === 1 ? '' : 's'}`);
    if (nMat) t.push(`${cifra(nMat)} material${nMat === 1 ? '' : 'es'}`);
    return t.join(' · ') || 'vacía';
  }
  function marcaMaterial(m, q) {
    const f = FP();
    const fm = f ? f.formaMaterial(m) : null;
    const st = `left:${m.x * 100}%;top:${m.y * 100}%${fm ? `;--w:${fm.w}px;--h:${fm.h}px;--giro:${fm.giro || 0}deg` : ''}`;
    return `<button class="pe-mat ${esc(m.capa)} ${esc(m.estado)}${m.id === mat ? ' elegida' : ''}${q && !casaMat(m, q) ? ' apagada' : ''}" style="${st}" data-pe-mat="${esc(m.id)}" aria-label="${esc(`${m.tag}, ${m.tipoNombre}, ${m.sala || 'sin sala'}`)}">${f ? f.svgMaterial(m) : ''}<span>${esc(m.tag)}</span></button>`;
  }
  function leyendaFormas(p) {
    const f = FP();
    const mats = (p.materiales || []).filter((m) => m.x !== null);
    if (!f || !mats.length) return '';
    return `<div class="pe-formas" role="group" aria-label="Formas">${f.leyendaFormas(mats).map((x) => `<span>${f.svgForma(x.forma)}${esc(x.nombre)} <b>${cifra(x.n)}</b></span>`).join('')}</div>`;
  }

  /* La hoja de un material (29-oct, JC): TAG grande con tipo y estado; luego Identificación,
     Fabricante, Documentos y Estado. Lo vacío es «—» en gris, nunca un texto que parezca un valor. */
  function hojaMaterial(m) {
    const f = FP();
    const fm = f ? f.formaMaterial(m) : null;
    const fila = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
    const val = (v) => (v === null || v === undefined || v === '' ? VACIO : esc(v));
    const car = Object.entries(m.caracteristicas || {}).filter(([, v]) => v !== null && v !== '');
    const docs = [enlaceFicha(m.fichaTecnica, 'Ficha técnica'), enlaceFicha(m.marcadoCE, 'Marcado CE')].filter(Boolean).join('');
    return `<div class="fila-principal"><strong class="cifra" style="font-size:17px">${esc(m.tag)}</strong>
        <span class="chip"><i class="pe-punto ${esc(m.estado)}"></i> ${esc(ESTADO_MAT[m.estado] || '')}</span>
        <button class="cierra" data-pe-cerrar aria-label="Cerrar">×</button></div>
      <div class="sub">${esc(m.tipoNombre)}${fm ? ` · <span class="tenue">en el plano: ${esc(fm.nombre)}</span>` : ''}</div>
      ${m.codigo ? `<div class="pe-cad cifra">Código CAD ${esc(m.codigo)}</div>` : ''}
      <div class="pe-bloque"><h4>Identificación</h4><table class="pe-ficha">
        ${fila('Sala', salaHtml(m.sala))}${fila('Nº de serie', val(m.numSerie))}</table>
        ${datos.puedeEditar ? `<div class="pe-serie"><input data-pe-serie value="${esc(m.numSerie || '')}" placeholder="—" aria-label="Nº de serie (de la placa)" autocapitalize="characters"><button class="boton" data-pe-guardar-serie="${esc(m.id)}">Guardar</button></div>` : ''}</div>
      <div class="pe-bloque"><h4>Fabricante</h4><table class="pe-ficha">
        ${fila('Marca', val(m.marca))}${fila('Modelo', val(m.modelo))}${car.map(([k, v]) => fila(k, esc(v))).join('')}</table></div>
      <div class="pe-bloque"><h4>Documentos</h4><div class="pe-enlaces">${docs || '<span class="tenue">Sin ficha técnica.</span>'}</div></div>
      <div class="pe-bloque"><h4>Estado e incidencias</h4><table class="pe-ficha">
        ${fila('Sirve a', m.sirveA ? `<b class="cifra">${esc(m.sirveA)}</b>` : VACIO)}${fila('Incidencia', m.incidencia ? `<span style="color:var(--mal)">${esc(m.incidencia)}</span>` : '<span class="tenue">Ninguna</span>')}</table></div>`;
  }

  function listaMateriales(p, q) {
    const fs = (p.materiales || []).filter((m) => !capasOff.has(m.capa) && casaMat(m, q));
    const tope = 300;
    return `<div class="pe-lista"><table><thead><tr><th>Material</th><th>Sala</th><th>Estado</th></tr></thead><tbody>
      ${fs.slice(0, tope).map((m) => `<tr data-pe-fila-mat="${esc(m.id)}" class="${m.id === mat ? 'elegida' : ''}"><td>${esc(m.tag)}<br><span class="tenue">${esc(m.tipoNombre)}</span></td><td>${salaHtml(m.sala)}</td><td class="estado"><i class="pe-punto ${esc(m.estado)}"></i> ${esc(ESTADO_MAT[m.estado] || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="tenue">Ningún material así.</td></tr>'}
      ${fs.length > tope ? `<tr><td colspan="3" class="tenue">${cifra(fs.length - tope)} más: afina con el buscador o las capas.</td></tr>` : ''}
      </tbody></table></div>`;
  }

  function mostrarHoja() {
    const h = $raiz && $raiz.querySelector('[data-pe-hoja]');
    if (!h) return;
    const p = plantaActual();
    const m = materialElegido();
    h.innerHTML = m ? hojaMaterial(m) : (p ? hojaHtml(p) : '');
    h.hidden = !equipoElegido() && !m;
    ajustarMarco();
  }

  /* En el teléfono la hoja flota sobre la lista: el plano se queda con lo que queda libre
     encima de ella (así el equipo tocado no queda tapado) y la lista, con sitio debajo. */
  function ajustarMarco() {
    const h = $raiz && $raiz.querySelector('[data-pe-hoja]');
    const [marco] = marcoYLienzo();
    if (!h) return;
    const flota = !h.hidden && window.innerWidth < 900;
    $raiz.style.paddingBottom = flota ? `${Math.round(h.offsetHeight) + 12}px` : '';
    if (!marco) return;
    if (!flota) { marco.style.height = ''; return; }
    const libre = h.getBoundingClientRect().top - marco.getBoundingClientRect().top - 8;
    marco.style.height = `${Math.max(150, Math.round(libre))}px`;
  }

  function marcarElegida() {
    const juntas = idsDelConjunto();
    for (const el of $raiz.querySelectorAll('[data-pe-marca]')) el.classList.toggle('elegida', juntas.has(el.dataset.peMarca));
    for (const el of $raiz.querySelectorAll('[data-pe-fila]')) el.classList.toggle('elegida', el.dataset.peFila === elegida);
  }

  function elegir(id, { centrarla = false } = {}) {
    elegida = id === elegida ? null : id;
    if (mat) { mat = null; for (const el of $raiz.querySelectorAll('[data-pe-mat]')) el.classList.remove('elegida'); }
    marcarElegida();
    mostrarHoja();
    if (elegida && centrarla) centrar(elegida);
    else if (elegida) asomar(elegida);
  }

  /* Que el equipo tocado quede a la vista: si está cerca de un borde del plano visible, se centra. */
  function asomar(id) {
    const p = plantaActual();
    const e = p && p.equipos.find((x) => x.id === id && x.x !== null);
    const [marco, lienzo] = marcoYLienzo();
    if (!e || !marco || !lienzo) return;
    const px = e.x * lienzo.offsetWidth - marco.scrollLeft;
    const py = e.y * lienzo.offsetHeight - marco.scrollTop;
    if (px < marco.clientWidth * 0.12 || px > marco.clientWidth * 0.88) marco.scrollLeft = e.x * lienzo.offsetWidth - marco.clientWidth / 2;
    if (py < marco.clientHeight * 0.15 || py > marco.clientHeight * 0.85) marco.scrollTop = e.y * lienzo.offsetHeight - marco.clientHeight / 2;
  }

  function pintar() {
    const p = plantaActual();
    if (!p) {
      $raiz.innerHTML = `${cabeza()}<p class="vacio">Esta obra aún no tiene equipos.</p>`;
      return;
    }
    planta = p.planta || '';
    /* Una planta sin equipos y con materiales abre la lista de materiales: «Equipos 0» no dice nada. */
    if (!p.equipos.length && (p.materiales || []).length) lista = 'materiales';
    try { sessionStorage.setItem('cx.planoEquipos.planta', planta); } catch { /* nada */ }
    const c = p.cuentas;
    const qq = filtro.trim().toLowerCase();
    const visibles = p.equipos.filter((m) => !ocultos.has(m.color) && (!qq || [m.tag, m.sala].some((v) => String(v || '').toLowerCase().includes(qq))));
    const enPlano = capasOff.has('equipos') ? [] : visibles.filter((m) => m.x !== null);
    const enConjunto = idsDelConjunto();
    const q = filtro.trim().toLowerCase();
    const mats = (p.materiales || []).filter((m) => m.x !== null && !capasOff.has(m.capa));
    const cuentasCapa = p.capas || {};
    const capas = ((datos && datos.capas) || []).filter((k) => cuentasCapa[k.id]);
    const plano = p.plano ? `<div class="pe-visor"><div class="pe-marco" data-pe-marco>
        <div class="pe-lienzo${zoom >= ZOOM_SALAS ? ' con-salas' : ''}" data-pe-lienzo style="width:${zoom * 100}%;--pe-esc:${escMarcas()}">
          <img data-src="api/plano-equipos/imagen?id=${encodeURIComponent(p.plano.id)}" alt="Plano ${esc(p.plano.nombre)}" draggable="false">
          ${(p.plano.salas || []).map((r) => `<span class="pe-sala" style="left:${r.x * 100}%;top:${r.y * 100}%">${esc(r.t)}</span>`).join('')}
          ${mats.map((m) => marcaMaterial(m, q)).join('')}
          ${enPlano.map((x) => `<button class="marca-boca ${x.color === 'verde' ? 'bien' : x.color === 'rojo' ? 'mal' : 'azul'}${enConjunto.has(x.id) ? ' elegida' : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%" data-pe-marca="${esc(x.id)}" aria-label="${esc(`${x.tag}, ${x.sala || 'sin sala'}: ${NOMBRE[x.color]}`)}">${simbolo(x.icono)}<span class="rotulo-boca">${esc(x.tag)}</span></button>`).join('')}
        </div>
      </div>
      <div class="pe-zoom"><button class="boton secundario" data-pe-zoom="-1" aria-label="Alejar">−</button><button class="boton secundario" data-pe-zoom="0">Entero</button><button class="boton secundario" data-pe-zoom="1" aria-label="Acercar">+</button></div></div>`
      : `<div class="pe-sin-plano"><b>La planta ${esc(etiqueta(p))} aún no tiene plano de equipos.</b><br>Lo sube la oficina desde Commissioning › Plano. Mientras, la lista dice la sala y el estado de cada equipo.</div>`;
    $raiz.innerHTML = `
      ${cabeza()}
      <div class="pe-plantas" role="tablist">${plantas().map((x) => `<button role="tab" data-pe-planta="${esc(x.planta || '')}" aria-selected="${x === p}" class="${x === p ? 'activa' : ''}">${esc(etiqueta(x))}<small>${cuentaTexto(x.equipos.length, (x.materiales || []).length)}</small></button>`).join('')}</div>
      ${capas.length > 1 ? `<div class="pe-capas" role="group" aria-label="Capas">${capas.map((k) => `<button data-pe-capa="${esc(k.id)}" aria-pressed="${!capasOff.has(k.id)}">${esc(k.nombre)} <b>${cifra(cuentasCapa[k.id])}</b></button>`).join('')}</div>` : ''}
      ${p.equipos.length ? `<div class="pe-leyenda" role="group" aria-label="Colores">${ORDEN.map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}"><i class="pe-punto pe-${k}"></i>${esc(NOMBRE[k])} <b>${cifra(c[k] || 0)}</b></button>`).join('')}
        <p class="nota">sin sala ${cifra(c.sinSala)}${p.plano ? ` · en el plano ${cifra(c.enPlano)} de ${cifra(p.equipos.length)}` : ''}</p></div>` : ''}
      ${p.plano && p.equipos.length ? leyendaIconos(p) : ''}
      ${p.plano ? leyendaFormas(p) : ''}
      ${p.plano && (p.sinUbicar || []).length ? `<details class="pe-sin-ubicar" data-pe-sin-ubicar${verSinUbicar ? ' open' : ''}><summary><i class="pe-punto pe-gris"></i>Sin ubicar en el plano · ${cifra(p.sinUbicar.length)}</summary>
        <div class="pe-grises">${p.sinUbicar.map((g) => `<button data-pe-fila="${esc(g.id)}" aria-label="${esc(`${g.tag}: en el listado de esta planta y no en su plano`)}">${esc(g.tag)}</button>`).join('')}</div></details>` : ''}
      <div class="pe-cuerpo">
        <div>${plano}</div>
        <div class="pe-lado">
          <div class="pe-hoja" data-pe-hoja hidden></div>
          ${equipoElegido() || materialElegido() ? '' : `<p class="nota pe-ayuda">${p.plano ? `Pellizca para acercar, arrastra para moverte y toca un equipo${(p.materiales || []).length ? ' o un material' : ''}.` : 'Toca un equipo de la lista para ver qué le falta.'}</p>`}
          ${(p.materiales || []).length ? `<div class="pe-pestanas" role="tablist"><button data-pe-lista="equipos" class="${lista === 'equipos' ? 'activa' : ''}"${p.equipos.length ? '' : ' disabled'}>Equipos ${cifra(p.equipos.length)}</button><button data-pe-lista="materiales" class="${lista === 'materiales' ? 'activa' : ''}">Materiales ${cifra(p.materiales.length)}</button></div>
          <input type="search" class="pe-buscar" data-pe-buscar placeholder="Buscar TAG, sala o nº de serie" value="${esc(filtro)}">
          <p class="nota pe-entregable"><a href="api/plano-equipos/entregable?obra=${encodeURIComponent(C.obraId())}&planta=${encodeURIComponent(p.planta || '')}" target="_blank" rel="noopener">Entregable a mantenimiento (planta ${esc(etiqueta(p))}) ↗</a></p>` : ''}
          ${lista === 'materiales' && (p.materiales || []).length ? listaMateriales(p, q) : `<div class="pe-lista"><table><thead><tr><th>Equipo</th><th>Sala</th><th>Estado</th></tr></thead><tbody>
          ${visibles.map((e) => `<tr data-pe-fila="${esc(e.id)}" class="${e.id === elegida ? 'elegida' : ''}${p.plano && e.x === null ? ' sin-ubicar' : ''}"><td>${e.papel ? `<em class="tenue">${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</td><td>${salaHtml(e.sala)}</td><td class="estado">${p.plano && e.x === null ? '<i class="pe-punto pe-gris"></i> Sin ubicar' : `<i class="pe-punto pe-${e.color}"></i> ${esc(NOMBRE[e.color])}`}</td></tr>`).join('') || '<tr><td colspan="3" class="tenue">Ningún equipo con esos colores.</td></tr>'}
          </tbody></table></div>`}
        </div>
      </div>`;
    C.cargarImagenes($raiz);
    mostrarHoja();
    const fila = $raiz.querySelector('.pe-plantas');
    const act = fila && fila.querySelector('.activa');
    if (act) fila.scrollLeft = act.offsetLeft - fila.clientWidth / 2 + act.offsetWidth / 2;
  }

  function cabeza() {
    return propio ? '<div class="pe-cabeza"><h2>Plano de equipos</h2></div>'
      : '<div class="pe-cabeza"><button class="enlace" data-cx="lista">‹ Equipos</button><h2>Plano de equipos</h2></div>';
  }

  const marcoYLienzo = () => [$raiz && $raiz.querySelector('[data-pe-marco]'), $raiz && $raiz.querySelector('[data-pe-lienzo]')];

  /* Cambia el zoom dejando quieto el punto (px, py del marco) que está bajo los dedos. */
  function ponerZoom(nuevo, px, py) {
    const [marco, lienzo] = marcoYLienzo();
    nuevo = Math.min(ZOOM_MAX, Math.max(1, nuevo));
    if (!marco || !lienzo) { zoom = nuevo; return; }
    if (px === undefined) px = marco.clientWidth / 2;
    if (py === undefined) py = marco.clientHeight / 2;
    const fx = (marco.scrollLeft + px) / (lienzo.offsetWidth || 1);
    const fy = (marco.scrollTop + py) / (lienzo.offsetHeight || 1);
    zoom = nuevo;
    lienzo.style.width = `${zoom * 100}%`;
    lienzo.style.setProperty('--pe-esc', String(escMarcas()));
    lienzo.classList.toggle('con-salas', zoom >= ZOOM_SALAS);
    marco.scrollLeft = fx * lienzo.offsetWidth - px;
    marco.scrollTop = fy * lienzo.offsetHeight - py;
  }

  /* Zoom con una breve animación (doble toque, +, −, Entero). */
  let animando = 0;
  function irAZoom(destino, px, py) {
    cancelAnimationFrame(animando);
    destino = Math.min(ZOOM_MAX, Math.max(1, destino));
    const origen = zoom;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / 160);
      ponerZoom(origen + (destino - origen) * (1 - (1 - k) ** 3), px, py);
      if (k < 1) animando = requestAnimationFrame(paso);
    };
    animando = requestAnimationFrame(paso);
  }

  /* ───────── Los dedos: pellizco, arrastre y doble toque ───────── */
  const UMBRAL = 8; /* píxeles antes de que un toque sea un arrastre */
  const dedos = new Map();
  let gesto = null; /* { tipo:'arrastre'|'pellizco', ... } */
  let tragarClick = false;
  let ultimoToque = null;

  const enMarco = (ev) => $raiz && $raiz.isConnected && ev.target && ev.target.closest && ev.target.closest('[data-pe-marco]');
  const dentro = (marco, ev) => { const r = marco.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  function empezarPellizco(marco) {
    const [a, b] = [...dedos.values()];
    const r = marco.getBoundingClientRect();
    gesto = { tipo: 'pellizco', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
    tragarClick = true;
  }

  document.addEventListener('pointerdown', (ev) => {
    const marco = enMarco(ev);
    if (!marco) return;
    cancelAnimationFrame(animando);
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try { marco.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
    if (dedos.size === 2) empezarPellizco(marco);
    else if (dedos.size === 1) {
      gesto = { tipo: 'espera', x: ev.clientX, y: ev.clientY, sl: marco.scrollLeft, st: marco.scrollTop, movido: false };
      tragarClick = false;
    }
  });

  document.addEventListener('pointermove', (ev) => {
    if (!dedos.has(ev.pointerId)) return;
    const marco = $raiz && $raiz.querySelector('[data-pe-marco]');
    if (!marco) return;
    dedos.get(ev.pointerId).x = ev.clientX;
    dedos.get(ev.pointerId).y = ev.clientY;
    if (!gesto) return;
    if (gesto.tipo === 'pellizco' && dedos.size >= 2) {
      const [a, b] = [...dedos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = marco.getBoundingClientRect();
      /* El punto de anclaje sigue a los dedos: pellizcar y mover a la vez también desplaza. */
      const cx = (a.x + b.x) / 2 - r.left;
      const cy = (a.y + b.y) / 2 - r.top;
      const antes = zoom;
      ponerZoom(gesto.z * (d / gesto.d), gesto.cx, gesto.cy);
      if (antes !== zoom || cx !== gesto.cx || cy !== gesto.cy) {
        marco.scrollLeft += gesto.cx - cx;
        marco.scrollTop += gesto.cy - cy;
        gesto.cx = cx; gesto.cy = cy; gesto.d = d; gesto.z = zoom;
      }
      ev.preventDefault();
      return;
    }
    if (dedos.size === 1 && (gesto.tipo === 'espera' || gesto.tipo === 'arrastre')) {
      const dx = ev.clientX - gesto.x;
      const dy = ev.clientY - gesto.y;
      if (gesto.tipo === 'espera' && Math.hypot(dx, dy) < UMBRAL) return;
      gesto.tipo = 'arrastre';
      gesto.movido = true;
      tragarClick = true;
      marco.scrollLeft = gesto.sl - dx;
      marco.scrollTop = gesto.st - dy;
      ev.preventDefault();
    }
  }, { passive: false });

  function soltar(ev) {
    if (!dedos.has(ev.pointerId)) return;
    const marco = $raiz && $raiz.querySelector('[data-pe-marco]');
    const eraEspera = gesto && gesto.tipo === 'espera' && dedos.size === 1 && ev.type === 'pointerup';
    dedos.delete(ev.pointerId);
    if (marco) { try { marco.releasePointerCapture(ev.pointerId); } catch { /* ya soltado */ } }
    if (dedos.size === 0) {
      /* Doble toque en un hueco del plano: acerca (o, si ya está muy cerca, vuelve a entero). */
      if (eraEspera && marco && !(ev.target.closest && ev.target.closest('[data-pe-marca],[data-pe-mat],[data-pe-zoom]'))) {
        const ahora = performance.now();
        const [px, py] = dentro(marco, ev);
        if (ultimoToque && ahora - ultimoToque.t < 300 && Math.hypot(px - ultimoToque.x, py - ultimoToque.y) < 40) {
          tragarClick = true;
          ultimoToque = null;
          irAZoom(zoom >= ZOOM_MAX / 2 ? 1 : zoom * 2.2, px, py);
        } else ultimoToque = { t: ahora, x: px, y: py };
      } else ultimoToque = null;
      gesto = null;
      /* El click que sigue a un arrastre o pellizco se traga; la bandera se apaga sola. */
      if (tragarClick) setTimeout(() => { tragarClick = false; }, 350);
    } else if (dedos.size === 1 && marco) {
      /* Al levantar un dedo del pellizco, el que queda sigue arrastrando sin saltos. */
      const [q] = [...dedos.values()];
      gesto = { tipo: 'arrastre', x: q.x, y: q.y, sl: marco.scrollLeft, st: marco.scrollTop, movido: true };
    }
  }
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);

  /* Ni la página ni el navegador hacen zoom con los dedos sobre el plano. */
  for (const n of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(n, (ev) => { if (enMarco(ev)) ev.preventDefault(); }, { passive: false });
  }
  document.addEventListener('touchmove', (ev) => { if (enMarco(ev)) ev.preventDefault(); }, { passive: false });
  /* Ratón o trackpad: rueda para acercar donde está el puntero. */
  document.addEventListener('wheel', (ev) => {
    const marco = enMarco(ev);
    if (!marco) return;
    ev.preventDefault();
    const [px, py] = dentro(marco, ev);
    ponerZoom(zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.012 : 0.0015)), px, py);
  }, { passive: false });

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
    const [marco, lienzo] = marcoYLienzo();
    if (!marco || !lienzo) return;
    marco.scrollLeft = e.x * lienzo.offsetWidth - marco.clientWidth / 2;
    marco.scrollTop = e.y * lienzo.offsetHeight - marco.clientHeight / 2;
    if (marco.getBoundingClientRect().top < 0 || marco.getBoundingClientRect().bottom > window.innerHeight) marco.scrollIntoView({ block: 'center' });
  }

  function centrarMat(id) {
    const p = plantaActual();
    const m = p && (p.materiales || []).find((x) => x.id === id && x.x !== null);
    if (!m) return;
    if (zoom < 3) ponerZoom(3);
    const [marco, lienzo] = marcoYLienzo();
    if (!marco || !lienzo) return;
    marco.scrollLeft = m.x * lienzo.offsetWidth - marco.clientWidth / 2;
    marco.scrollTop = m.y * lienzo.offsetHeight - marco.clientHeight / 2;
    if (marco.getBoundingClientRect().top < 0 || marco.getBoundingClientRect().bottom > window.innerHeight) marco.scrollIntoView({ block: 'center' });
  }

  /* El buscador filtra la lista y apaga en el plano lo que no casa. */
  document.addEventListener('input', (ev) => {
    if (!$raiz || !ev.target.matches || !ev.target.matches('[data-pe-buscar]') || !$raiz.contains(ev.target)) return;
    filtro = ev.target.value;
    const pos = ev.target.selectionStart;
    repintarQuieto();
    const b = $raiz.querySelector('[data-pe-buscar]');
    if (b) { b.focus(); try { b.setSelectionRange(pos, pos); } catch { /* nada */ } }
  });

  /* Se guarda cómo está el plano y se va a la pantalla de siempre del equipo. */
  function irAlEquipo(accion) {
    const e = equipoElegido();
    if (!e || typeof window.CX_COMMISSIONING_IR !== 'function') return;
    const [marco] = marcoYLienzo();
    const lista = $raiz.querySelector('.pe-lista');
    vista = { planta, zoom, elegida, ocultos: [...ocultos], sl: marco ? marco.scrollLeft : 0, st: marco ? marco.scrollTop : 0, lista: lista ? lista.scrollTop : 0, pagina: window.scrollY };
    window.CX_COMMISSIONING_IR(e.id, accion, $raiz);
  }

  /* La franja gris abierta o cerrada se recuerda al repintar. */
  document.addEventListener('toggle', (ev) => {
    if (ev.target && ev.target.matches && ev.target.matches('[data-pe-sin-ubicar]')) verSinUbicar = ev.target.open;
  }, true);

  /* Un arrastre o pellizco no es un toque: se traga el click que viene detrás. */
  document.addEventListener('click', (ev) => {
    if (tragarClick && enMarco(ev)) { ev.stopPropagation(); ev.preventDefault(); tragarClick = false; }
  }, true);

  document.addEventListener('click', (ev) => {
    if (!$raiz || !$raiz.contains(ev.target) || !datos) return;
    const pl = ev.target.closest('[data-pe-planta]');
    if (pl) { planta = pl.dataset.pePlanta; elegida = null; mat = null; zoom = 1; pintar(); return; }
    const co = ev.target.closest('[data-pe-color]');
    if (co) { const k = co.dataset.peColor; if (ocultos.has(k)) ocultos.delete(k); else ocultos.add(k); repintarQuieto(); return; }
    const z = ev.target.closest('[data-pe-zoom]');
    if (z) {
      /* Con un equipo elegido a la vista, se acerca hacia él y no hacia el centro. */
      const v = Number(z.dataset.peZoom);
      const p = plantaActual();
      const e = elegida && p && p.equipos.find((x) => x.id === elegida && x.x !== null);
      const [marco, lienzo] = marcoYLienzo();
      let cx; let cy;
      if (e && marco && lienzo) {
        const px = e.x * lienzo.offsetWidth - marco.scrollLeft;
        const py = e.y * lienzo.offsetHeight - marco.scrollTop;
        if (px >= 0 && px <= marco.clientWidth && py >= 0 && py <= marco.clientHeight) { cx = px; cy = py; }
      }
      irAZoom(v === 0 ? 1 : zoom * (v > 0 ? 1.6 : 1 / 1.6), cx, cy);
      return;
    }
    if (ev.target.closest('[data-pe-cerrar]')) { elegida = null; mat = null; for (const el of $raiz.querySelectorAll('[data-pe-mat]')) el.classList.remove('elegida'); marcarElegida(); mostrarHoja(); return; }
    const capa = ev.target.closest('[data-pe-capa]');
    if (capa) { const k = capa.dataset.peCapa; if (capasOff.has(k)) capasOff.delete(k); else capasOff.add(k); repintarQuieto(); return; }
    const li = ev.target.closest('[data-pe-lista]');
    if (li) { lista = li.dataset.peLista; repintarQuieto(); return; }
    const gs = ev.target.closest('[data-pe-guardar-serie]');
    if (gs) {
      const inp = $raiz.querySelector('[data-pe-serie]');
      gs.disabled = true;
      C.postJson('api/materiales', { id: gs.dataset.peGuardarSerie, numSerie: inp ? inp.value.trim() : '' })
        .then(async (r) => { if (r && r.ok === false) throw new Error(r.error); C.aviso('Nº de serie guardado.', 'bien'); await cargar(); repintarQuieto(); })
        .catch((e) => { gs.disabled = false; C.aviso(e.message); });
      return;
    }
    const mm = ev.target.closest('[data-pe-mat]') || ev.target.closest('[data-pe-fila-mat]');
    if (mm) {
      const id = mm.dataset.peMat || mm.dataset.peFilaMat;
      mat = id === mat ? null : id;
      elegida = null;
      marcarElegida();
      for (const el of $raiz.querySelectorAll('[data-pe-mat]')) el.classList.toggle('elegida', el.dataset.peMat === mat);
      for (const el of $raiz.querySelectorAll('[data-pe-fila-mat]')) el.classList.toggle('elegida', el.dataset.peFilaMat === mat);
      mostrarHoja();
      if (mat && mm.dataset.peFilaMat) centrarMat(mat);
      return;
    }
    const ver = ev.target.closest('[data-pe-ver]');
    if (ver) {
      const q = plantas().find((x) => x.equipos.some((y) => y.id === ver.dataset.peVer && y.x !== null));
      if (q && (q.planta || '') !== (planta || '')) { planta = q.planta || ''; elegida = ver.dataset.peVer; zoom = 1; pintar(); mostrarHoja(); asomar(elegida); }
      else centrar(ver.dataset.peVer);
      return;
    }
    const ac = ev.target.closest('[data-pe-accion]');
    if (ac) { irAlEquipo(ac.dataset.peAccion); return; }
    const mk = ev.target.closest('[data-pe-marca]');
    if (mk) { elegir(mk.dataset.peMarca); return; }
    const fi = ev.target.closest('[data-pe-fila]');
    if (fi) { elegir(fi.dataset.peFila, { centrarla: true }); }
  });

  /* Sección propia «Más › Plano de equipos» (quien no tiene Commissioning). */
  const activaPropia = () => C.activa('plano');
  const abrirPropio = () => { propio = true; const a = document.getElementById('app'); if (a) abrir(a); };
  window.addEventListener('movil:obra', () => { if (activaPropia()) abrirPropio(); });
  window.addEventListener('hashchange', () => { if (activaPropia()) abrirPropio(); else propio = false; });
  if (activaPropia()) abrirPropio();

  window.CX_PLANO_EQUIPOS = { abrir: ($app) => { propio = false; return abrir($app); }, volver };
})();
