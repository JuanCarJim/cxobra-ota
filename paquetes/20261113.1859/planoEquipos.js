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
  const FA = window.CX_PLANO_FALTAS; /* marcar lo que falta (planoFaltas.js) */

  const NOMBRE = { verde: 'En marcha', azul: 'Falta documentación', rojo: 'Sin empezar' };
  const ORDEN = ['verde', 'azul', 'rojo'];
  const ZOOM_MAX = 30; /* 30-oct, JC: «hay que poder ampliar más» */
  const TAM_EQ = 22; const TAM_EQ_MIN = 10; const TAM_EQ_ELEGIDO = 30; /* px de pantalla, a cualquier zoom */
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
  let verMas = false; /* el desplegable «Leyenda · sin ubicar · revisar» abierto */
  let verSinUbicar = false; /* franja gris «Sin ubicar en el plano» abierta */
  /* Materiales instalados (29-oct, JC): compuertas, difusores, rejillas… con nº de serie y ficha técnica. */
  let capasOff = new Set(); /* capas apagadas (equipos, compuertas, difusores…) */
  let mat = null; /* el material tocado */
  let lista = 'equipos'; /* la lista de abajo: equipos o materiales */
  let filtro = '';
  let compacto = false; /* dentro de la pantalla Cx: sin cabeza, con desplegable de planta y sin lista ni capas (13-nov) */
  const ESTADO_MAT = { sinDatos: 'Sin datos', conFicha: 'Con ficha', conIncidencia: 'Con incidencia' };
  try { planta = sessionStorage.getItem('cx.planoEquipos.planta'); } catch { /* sin almacén */ }

  const ESTILO = `
  .pe-cabeza{display:flex;align-items:center;gap:8px;margin:4px 0 8px}
  .pe-cabeza h2{font-size:18px;margin:0;flex:1}
  .pe-mas{margin:0 0 6px;font-size:13px}.pe-mas>summary{cursor:pointer;min-height:32px;display:flex;align-items:center;color:var(--texto-suave,var(--texto))}.pe-planta-sel{margin:0 0 6px}.pe-planta-sel label{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--texto-suave,var(--texto))}.pe-planta-sel select{flex:1;min-height:44px;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:10px;padding:6px 10px;font-size:15px}
  .pe-plantas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px;-webkit-overflow-scrolling:touch}
  .pe-plantas button{flex:none;min-height:40px;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:6px 12px;font-size:14px}
  .pe-plantas button small{font-size:11px;opacity:.75;margin-left:4px}
  .pe-plantas button.activa{background:var(--acento-relleno);border-color:var(--acento-relleno);color:var(--sobre-relleno)}
  .pe-plantas button.activa small{color:var(--sobre-relleno);opacity:.9}
  .pe-leyenda{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;align-items:center}
  .pe-leyenda button{display:inline-flex;align-items:center;gap:6px;min-height:36px;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:4px 10px;font-size:13px}
  .pe-leyenda button[aria-pressed="false"]{opacity:.45}
  .pe-leyenda .nota{margin:0;font-size:12px}
  .pe-leyenda.pe-una-fila{flex-wrap:nowrap;overflow-x:auto;gap:4px;margin:0 0 6px;scrollbar-width:none}
  .pe-leyenda.pe-una-fila button{min-height:30px;padding:2px 8px;font-size:12.5px;flex:0 0 auto}
  .pe-planta-sel label{flex-wrap:nowrap} .pe-planta-sel{display:flex;align-items:center;gap:8px} .pe-planta-sel label{flex:1;min-width:0} .pe-planta-sel .pe-sin-ifc{flex:0 0 auto;font-size:12px;color:var(--aviso)}
  .pe-punto{display:inline-block;width:11px;height:11px;border-radius:2px;flex:none}
  .pe-verde{background:var(--bien)}.pe-azul{background:var(--pe-azul)}.pe-rojo{background:var(--mal)}
  #app{--pe-azul:var(--info)}
  /* 5-nov (bloques): «sin empezar» en teal; el rojo, solo para incidencias. */
  .pe-marco .marca-boca.mal{color:var(--vd-acento,var(--acento))}
  .pe-marco .marca-boca.mal .simbolo-boca .cuerpo{fill:color-mix(in srgb,var(--mal) 18%,var(--vd-lienzo))}
  .pe-cuerpo{display:block}
  .pe-marco{position:relative;overflow:hidden;height:52vh;border:1px solid var(--borde);border-radius:10px;background:var(--vd-lienzo);touch-action:none;overscroll-behavior:contain;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .pe-lienzo{position:relative}
  .pe-fondo{display:flex;gap:6px;margin:0 0 6px}.pe-fondo button{flex:1;padding:6px 10px;border:1px solid var(--borde);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:13px}.pe-fondo button[aria-pressed=true]{background:color-mix(in srgb,currentColor 14%,transparent);font-weight:700;border-color:currentColor}.pe-fondo button:disabled{opacity:.4}
  .pe-lienzo img{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none;pointer-events:none}
  .pe-lienzo .marca-boca.azul{color:var(--pe-azul)}
  .pe-lienzo .marca-boca.azul .simbolo-boca .cuerpo{fill:color-mix(in srgb,var(--pe-azul) 22%,var(--vd-lienzo))}
  .pe-lienzo .marca-boca.azul .rotulo-boca{background:var(--pe-azul)}
  .pe-lienzo .marca-boca{width:22px;aspect-ratio:1;height:auto;line-height:0;z-index:2}
  .pe-lienzo .marca-boca::after{width:calc(100% + 16px);height:calc(100% + 16px)}
  .pe-lienzo .marca-boca .simbolo-boca{display:block;height:100%;width:100%;border-radius:0;overflow:visible;filter:drop-shadow(0 0 1px var(--vd-lienzo))}
  .pe-lienzo .marca-boca .simbolo-boca *{vector-effect:non-scaling-stroke;stroke-width:1.2px}
  #app .pe-lienzo .marca-boca .rotulo-boca{display:none}
  #app .pe-lienzo .marca-boca.con-tag .rotulo-boca{display:block}
  #app .pe-lienzo .marca-boca.tag-izq .rotulo-boca{left:auto;right:calc(100% + 2px)}
  #app .pe-lienzo .marca-boca.elegida.tag-izq .rotulo-boca{margin-left:0;margin-right:8px}
  .pe-mat.tag-izq span{left:auto;right:100%;margin-left:0;margin-right:3px}
  /* La etiqueta sin color de estado: el estado se lee en el icono y en la leyenda. */
  #app .pe-lienzo .marca-boca .rotulo-boca{background:rgba(255,255,255,.74);color:var(--acento-fuerte);padding:0 3px;font-weight:700;text-shadow:0 0 2px var(--vd-lienzo)}
  .pe-lienzo .marca-boca.revisar .simbolo-boca{outline:1.5px dashed currentColor;outline-offset:2px}
  .pe-lienzo .marca-boca.elegida{width:30px!important;z-index:8;opacity:1!important}
  .pe-lienzo .marca-boca.elegida .simbolo-boca{outline:none;transform:none;filter:drop-shadow(0 0 1.5px var(--acento)) drop-shadow(0 0 5px color-mix(in srgb,var(--acento) 55%,transparent))}
  .pe-lienzo .marca-boca.elegida .simbolo-boca *{stroke-width:3px}
  .pe-lienzo .marca-boca.elegida .simbolo-boca path,.pe-lienzo .marca-boca.elegida .simbolo-boca rect{stroke:var(--acento)}
  #app .pe-lienzo .marca-boca.elegida .rotulo-boca{display:block;z-index:9;font-size:12px;color:var(--sobre-relleno);background:var(--acento-relleno);text-shadow:none;padding:1px 5px;border-radius:3px;margin-left:8px}
  .pe-lienzo:has(.marca-boca.elegida) .marca-boca:not(.elegida),.pe-lienzo:has(.pe-mat.elegida) .marca-boca{opacity:.6}
  .pe-iconos{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:12px;color:var(--textoTenue)}
  .pe-iconos span{display:inline-flex;align-items:center;gap:4px}
  .pe-iconos svg{height:16px;width:16px;color:var(--acento)}
  .pe-iconos svg .cuerpo{fill:var(--panel)}
  .pe-conjunto{margin-top:6px;font-size:14px;display:grid;gap:2px}
  .pe-conjunto div{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;font-size:13.5px}
  .pe-conjunto .actual{background:var(--acento-suave);border-radius:6px;padding:0 6px}
  .pe-conjunto div>span{flex:1 1 auto;min-width:0}
  .pe-conjunto button{width:auto;min-width:56px;min-height:32px;margin:0;padding:0 12px;font-size:13px;flex:none}
  .pe-sin-plano{padding:14px;border:1px dashed var(--borde);border-radius:10px;background:var(--panel);font-size:14px}
  .pe-visor{position:relative}
  /* Los nombres de sala, como texto encima del plano: nítidos a cualquier zoom
     aunque la imagen que baja al móvil sea ligera. Solo las que caben en su sala: las pequeñas, al acercar. */
  .pe-sala{position:absolute;transform:translate(-50%,-50%);font:600 11px/14px system-ui,sans-serif;color:var(--texto);letter-spacing:.01em;padding:0 1px;white-space:nowrap;pointer-events:none;display:none;z-index:1;text-shadow:0 0 2px var(--papel),0 0 2px var(--papel)}
  .pe-sin-nombres{margin:4px 0 0;font-size:12px;color:var(--textoSuave)}
  /* 13-nov (JC): finos y en gris claro, por debajo de los TAG; solo los que caben y no chocan (colocarTags). */
  .pe-lienzo .pe-sala.ver{display:block}
  /* 13-nov (JC): el − / Entero / + en su franja, bajo el plano y fuera de él: no tapa nada. */
  .pe-zoom{display:flex;justify-content:flex-end;gap:4px;margin:4px 0 0}
  .pe-zoom button{width:auto;flex:none;min-width:44px;min-height:40px;margin:0;font-size:20px;line-height:1;padding:0 10px}
  .pe-zoom button[data-pe-zoom="0"]{font-size:14px}
  .cx-plano .pe-marco .marca-boca.mal{color:var(--mal)} .cx-plano .pe-sin-ifc{margin:2px 0 6px;font-size:12px}
  .cx-plano .pe-zoom{gap:4px}.cx-plano .pe-zoom button{min-width:34px;min-height:34px;font-size:16px;padding:0 6px}.cx-plano .pe-zoom button[data-pe-zoom="0"]{font-size:12px}
  .pe-elegido{margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--panel);box-shadow:var(--sombra)}
  .pe-hoja{position:fixed;left:8px;right:8px;bottom:calc(var(--hueco-barra,104px) + 4px + env(safe-area-inset-bottom,0px));z-index:12;max-height:42vh;overflow:auto;padding:10px 12px 12px;border-radius:14px;background:var(--panel);box-shadow:0 -2px 14px rgba(8,50,60,.28);border:1px solid var(--borde)}
  .pe-hoja[hidden]{display:none}
  .pe-hoja .fila-principal{display:flex;align-items:center;gap:8px;justify-content:space-between}
  .pe-hoja .sub{margin-top:3px;font-size:14px}
  .pe-hoja .falta{font-size:13.5px;margin-top:3px}
  .pe-hoja .cierra{min-width:44px;min-height:44px;border:0;background:none;font-size:22px;color:var(--textoTenue);margin:-8px -8px -8px 0}
  .pe-acciones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
  .pe-acciones button{min-height:46px;margin:0;font-size:15px}
  .pe-hoja .mas{display:block;margin-top:8px;font-size:14px}
  .pe-cuerpo{padding-bottom:0}
  .pe-elegido .sub{margin-top:4px;font-size:14px}
  .pe-elegido ul{margin:4px 0 0;padding-left:18px;font-size:14px}
  .pe-lista{background:var(--panel);border-radius:10px;box-shadow:var(--sombra);max-height:46vh;overflow:auto;-webkit-overflow-scrolling:touch}
  .pe-lista table{width:100%;border-collapse:collapse;font-size:13.5px}
  .pe-lista th{position:sticky;top:0;background:var(--panel);text-align:left;font-weight:600;color:var(--acento);border-bottom:2px solid var(--acento);padding:6px 8px;z-index:1}
  .pe-lista td{padding:8px;border-bottom:1px solid var(--borde);vertical-align:top}
  .pe-lista tr.elegida td{background:var(--acento-suave)}
  .pe-lista td.estado{white-space:nowrap}
  .pe-lista .tenue{color:var(--textoTenue)}
  /* Sin ubicar en el plano (29-oct, JC): en gris, para estudiarlos. */
  .pe-punto.pe-gris{background:var(--textoTenue);opacity:.55}
  .pe-sin-ubicar{margin:0 0 8px;font-size:13px;color:var(--textoTenue)}
  .pe-sin-ubicar summary{min-height:36px;display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer}
  .pe-sin-ubicar .pe-grises{display:flex;flex-wrap:wrap;gap:4px;max-height:118px;overflow:auto;margin-top:4px}
  .pe-sin-ubicar .pe-grises button{min-height:32px;border:1px solid var(--borde);background:var(--panel);color:var(--textoTenue);border-radius:999px;padding:2px 10px;font-size:12.5px}
  .pe-lista tr.sin-ubicar td{color:var(--textoTenue)}
  /* Materiales: marcas pequeñas por estado (gris sin datos · teal con ficha · rojo con incidencia), forma por capa. */
  /* Materiales con la FORMA del elemento (29-oct, JC): difusor redondo, lineal alargado, rejilla con lamas…
     Color por estado: gris sin datos · teal con ficha · rojo con incidencia. Crecen un poco al acercar (--pe-esc). */
  .pe-mat{position:absolute;transform:translate(-50%,-50%) rotate(var(--giro,0deg));width:max(var(--minw,4px),var(--wp,0px));height:auto;aspect-ratio:var(--ar,1);min-height:0;min-width:0;padding:0;margin:0;border:0;background:none;color:var(--textoTenue);line-height:0}
  .pe-mat svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 1px var(--vd-lienzo))}
  .pe-mat svg *{vector-effect:non-scaling-stroke;stroke-width:1px}
  .pe-lienzo.con-salas .pe-mat svg *{stroke-width:1.5px}
  .pe-mat svg .cuerpo{fill:color-mix(in srgb,currentColor 14%,var(--vd-lienzo))}
  .pe-mat::after{content:'';position:absolute;inset:-8px}
  .pe-mat.conFicha{color:var(--acento)} .pe-mat.conIncidencia{color:var(--mal)}
  /* El tocado, resaltado (30-oct, JC): más grande, teal, con halo y su TAG siempre; los demás, más tenues. */
  .pe-mat.elegida{color:var(--acento);width:max(calc(var(--minw,4px) * 4),calc(var(--wp,0px) * 1.6));z-index:6;opacity:1!important}
  .pe-mat.elegida svg{filter:drop-shadow(0 0 1.5px var(--acento)) drop-shadow(0 0 5px color-mix(in srgb,var(--acento) 55%,transparent))}
  .pe-mat.elegida svg *{stroke-width:3px;stroke:var(--acento)}
  @keyframes pe-pulso{0%{transform:scale(.8);opacity:1}100%{transform:scale(1.8);opacity:0}}
  .pe-mat.elegida span{display:block;z-index:7;font-size:12px;font-weight:700;color:var(--sobre-relleno);background:var(--acento-relleno);padding:1px 5px;border-radius:3px;margin-left:8px}
  .pe-lienzo:has(.pe-mat.elegida) .pe-mat:not(.elegida){opacity:.6}
  .pe-mat.apagada{opacity:.15}
  .pe-mat span{display:none;position:absolute;left:100%;top:50%;margin-left:3px;transform:translateY(-50%) rotate(calc(-1 * var(--giro,0deg)));line-height:1.1;white-space:nowrap;font-size:9px;font-weight:600;color:var(--textoSuave);background:rgba(255,255,255,.78);padding:0 2px;border-radius:2px}
  .pe-lienzo .pe-mat.con-tag span{display:block}
  .pe-formas{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:12px;color:var(--textoTenue)}
  .pe-formas span{display:inline-flex;align-items:center;gap:4px}
  .pe-formas svg{height:14px;width:auto;max-width:34px;color:var(--acento)}
  .pe-formas svg .cuerpo{fill:var(--panel)}
  .pe-lista td .pe-sala-cod,.pe-sala-cod{display:block;font-size:11.5px;color:var(--textoTenue);white-space:nowrap}
  .pe-bloque{margin-top:8px;padding-top:6px;border-top:1px solid var(--borde)}
  .pe-bloque h4{margin:0 0 3px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--acento)}
  .pe-cad{font-size:11.5px;color:var(--textoTenue);margin-top:2px}
  .pe-vacio{color:var(--textoTenue);opacity:.7}
  .pe-tono-bien{color:var(--bien);font-weight:600}.pe-tono-info{color:var(--pe-azul);font-weight:600}
  .pe-vida .pe-ficha{width:100%;border-collapse:collapse;font-size:13px}
  .pe-vida .pe-ficha th{text-align:left;font-weight:400;color:var(--textoTenue);width:32%;padding:1px 8px 1px 0;vertical-align:top}
  .pe-vida .pe-ficha td{padding:1px 0;font-variant-numeric:tabular-nums}
  .pe-vida .pe-entrega-df{font:inherit;font-size:14px;padding:2px 4px;min-height:30px}
  .pe-serie input::placeholder{color:var(--textoTenue);opacity:.55}
  .pe-capas{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 6px;-webkit-overflow-scrolling:touch}
  .pe-capas button{flex:none;min-height:34px;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:3px 10px;font-size:13px}
  .pe-capas button[aria-pressed="true"]{background:var(--acento-suave);border-color:var(--acento)}
  .pe-capas button[aria-pressed="false"]{opacity:.5;text-decoration:line-through}
  .pe-punto.sinDatos{background:var(--textoTenue);border-radius:50%} .pe-punto.conFicha{background:var(--acento);border-radius:50%} .pe-punto.conIncidencia{background:var(--mal);border-radius:50%}
  .pe-pestanas{display:flex;gap:6px;align-items:center;margin:8px 0 6px}
  .pe-pestanas button{min-height:36px;margin:0;border:1px solid var(--borde);background:var(--panel);color:var(--texto);border-radius:999px;padding:3px 12px;font-size:13.5px;width:auto}
  .pe-pestanas button.activa{background:var(--acento-relleno);border-color:var(--acento-relleno);color:var(--sobre-relleno)}
  .pe-buscar{width:100%;box-sizing:border-box;min-height:40px;margin:0 0 6px;font-size:15px}
  .pe-ficha{width:100%;border-collapse:collapse;margin-top:6px;font-size:13.5px}
  .pe-ficha th{text-align:left;font-weight:400;color:var(--textoTenue);padding:2px 8px 2px 0;width:40%;vertical-align:top}
  .pe-ficha td{padding:2px 0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .pe-enlaces{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:15px}
  .pe-enlaces a{font-weight:600;min-height:32px;display:inline-flex;align-items:center}
  .pe-docs .pesDocs{width:100%;border-collapse:collapse;margin-top:6px;font-size:14px}
  .pe-docs .pesDocs thead th{padding:0 0 3px;font-size:12px;font-weight:600;text-align:left;color:var(--textoTenue);border-bottom:1px solid var(--acento-vivo)}
  .pe-docs .pesDocs tbody th{padding:6px 8px 6px 0;text-align:left;font-weight:500;border-bottom:1px solid rgba(15,23,42,.08)}
  .pe-docs .pesDocs td{padding:6px 0;border-bottom:1px solid rgba(15,23,42,.08)}
  .pe-docs .pesDocAccion{width:96px;text-align:center;white-space:nowrap}
  .pe-docs .pesDocArchivo{display:block;max-width:56vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:400;color:var(--textoTenue)}
  .pe-docs .pesVerPdf{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:88px;min-height:36px;padding:0 8px;font-size:14px;font-weight:600;border:0;border-radius:8px;background:var(--acento-suave);color:var(--acento-fuerte)}
  .pe-docs .pesDocFalta{color:var(--mal);font-weight:600} .pe-docs .pesDocPend,.pe-docs .pesVacio{color:var(--textoTenue)}
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
  /* EL MODELO IFC DE FONDO (13-nov-2026, JC): una planta con modelo (`p.ifc`) se ve con él, por defecto, y el PDF queda de respaldo
     (botón «Plano PDF»). Con el modelo, los equipos van donde los pone el modelo, los que no están en él quedan «sin ubicar» y los
     materiales y lo que falta (que se marcaron sobre el PDF) se ven en el PDF. */
  const conPdf = new Set(); /* plantas en que se eligió el PDF */
  const conModelo = new Set(); /* y en las que se eligió el modelo */
  const vistas = new WeakMap();
  /* Sin elegir, el modelo en cuanto coloca algún equipo (o si no hay PDF); el botón «Plano PDF» está encima, y la nota dice cuántos faltan. */
  const usaModelo = (p) => {
    const k = p.planta || '';
    if (compacto) return Boolean(p.ifc) || !p.plano; /* pestaña Cx: el modelo IFC siempre que la planta lo tenga; el PDF solo si le falta (y se avisa) */
    if (conPdf.has(k)) return false;
    return conModelo.has(k) || !p.plano || Object.keys((p.ifc && p.ifc.pos) || {}).length > 0;
  };
  const vistaIfc = (p) => {
    if (!p || !p.ifc || p.parcial || !usaModelo(p)) return p;
    const ya = vistas.get(p);
    if (ya) return ya;
    const pos = p.ifc.pos || {};
    const equipos = p.equipos.map((e) => (pos[e.id] ? { ...e, x: pos[e.id][0], y: pos[e.id][1], mano: false, revisar: false, w: 0, h: 0 } : { ...e, x: null, y: null, mano: false, revisar: false }));
    const sinUbicar = equipos.filter((q) => q.x === null).map((q) => ({ id: q.id, tag: q.tag, familia: q.familia, sala: q.sala, icono: q.icono }));
    const v = { ...p, plano: p.ifc.plano, equipos, sinUbicar, materiales: (p.materiales || []).map((m) => ({ ...m, x: null, y: null })), faltas: [], esIfc: true,
      cuentas: { ...p.cuentas, enPlano: equipos.length - sinUbicar.length, sinUbicar: sinUbicar.length, revisar: 0 } };
    vistas.set(p, v);
    return v;
  };
  /* LA PESTAÑA CX, SOLO CON EL IFC (13-nov-2026, JC: «Solo plano de IFC con equipos interactivo»): en el modo compacto solo
     salen las plantas con modelo y algún equipo colocado en él; las demás, en una línea (las prepara el delineante). */
  const nIfc = (x) => (!x || !x.ifc ? 0 : x.parcial ? Number(x.ifc.n) || 0 : Object.keys(x.ifc.pos || {}).length);
  const plantasIfc = () => plantas().filter((x) => nIfc(x) > 0);
  const plantasCx = () => plantas().filter((x) => x.ifc || (x.planta && nEquipos(x) > 0));
  const colocadoEn = (x, id) => (compacto && x.ifc ? (x.parcial ? (x.ifc.ids || []).includes(id) : Boolean(x.ifc.pos && x.ifc.pos[id]))
    : x.parcial ? (x.enPlano || []).includes(id) : x.equipos.some((y) => y.id === id && y.x !== null));
  const CLAVE_CX = 'cx.planoCx.planta'; /* la última planta que eligió el usuario en la pestaña Cx (se queda al cerrar la app) */
  const plantaGuardadaCx = () => { try { return localStorage.getItem(CLAVE_CX); } catch { return null; } };
  const plantaActual = () => {
    const ps = plantas();
    if (compacto) {
      /* 13-nov-2026 (JC): todas las plantas con equipos; con IFC, su modelo; sin IFC, el PDF con aviso. Sin elegir, la primera con IFC. */
      const ps2 = plantasCx();
      return vistaIfc((planta ? ps2.find((p) => (p.planta || '') === planta) : null) || plantasIfc()[0] || ps2[0] || null);
    }
    return vistaIfc(((!compacto || planta !== null) && ps.find((p) => (p.planta || '') === (planta || ''))) || (compacto && ps.find((p) => nEquipos(p) > 0 && (p.plano || p.ifc))) || ps.find((p) => p.plano || p.ifc) || ps.find((p) => p.planta) || ps[0] || null);
  };
  const etiqueta = (p) => p.planta || 'Sin planta';

  /* POR PLANTA (5-nov-2026, JC): se pide solo la planta abierta entera; de las demás llegan sus
     cuentas (`parcial`) y se piden al tocarlas. */
  const url = (pl) => `api/plano-equipos?obra=${encodeURIComponent(C.obraId())}&ligero=1&porPlanta=1${compacto ? '&soloIfc=1' : ''}&planta=${encodeURIComponent(pl || '')}`;
  const nEquipos = (x) => (x.parcial ? x.n.equipos : x.equipos.length);
  const nMateriales = (x) => (x.parcial ? x.n.materiales : (x.materiales || []).length);

  /** Trae entera una planta que llegó solo con sus cuentas. */
  async function traerPlanta(nombre, callado = false) {
    const i = plantas().findIndex((x) => (x.planta || '') === (nombre || ''));
    if (i < 0 || !plantas()[i].parcial) return;
    if (!callado) $raiz.querySelector('.pe-plantas')?.classList.add('cargando');
    const d0 = datos;
    const r = await C.pedir(url(nombre));
    if (!r || !r.ok) throw new Error((r && r.error) || 'No se pudo abrir la planta.');
    const nueva = (r.plantas || []).find((x) => (x.planta || '') === (nombre || '') && !x.parcial);
    /* Si entretanto se recargó la lista, esta planta ya no va en esa posición. */
    if (nueva && datos && datos === d0 && (datos.plantas[i].planta || '') === (nombre || '')) datos.plantas[i] = nueva;
  }

  /* PRECARGA DE LAS VECINAS (13-nov-2026, JC: «cambiar de planta en menos de 300 ms»): en la pestaña Cx, la planta de
     antes y la de después del selector se piden en segundo plano; cambiar a ellas ya no espera a la red. Solo dos:
     el teléfono no se baja la obra entera (cada planta son ~0,6-0,9 MB en el NCN). */
  let precargando = false;
  function precargarVecinas() {
    if (!compacto || !datos || precargando) return;
    const ps = plantasCx(), p = plantaActual();
    const i = p ? ps.findIndex((x) => (x.planta || '') === (p.planta || '')) : -1;
    if (i < 0) return;
    const vecinas = [ps[i + 1], ps[i - 1]].filter((x) => x && x.parcial).map((x) => x.planta || '');
    if (!vecinas.length) return;
    precargando = true;
    const siguiente = () => {
      const n = vecinas.shift();
      if (n === undefined) { precargando = false; return; }
      traerPlanta(n, true).catch(() => {}).then(() => setTimeout(siguiente, 50));
    };
    setTimeout(siguiente, 300);
  }

  async function cargar() {
    const previo = datos;
    datos = await C.pedir(url(planta));
    /* Las fichas ya pedidas se conservan al recargar la lista. */
    if (datos && datos.ok && previo && Array.isArray(previo.plantas)) {
      const vistas = new Map(previo.plantas.flatMap((p) => p.equipos || []).filter((e) => e.fichaLista).map((e) => [e.id, e]));
      for (const e of (datos.plantas || []).flatMap((p) => p.equipos || [])) {
        const v = vistas.get(e.id);
        if (v) { e.documentos = v.documentos; e.acciones = v.acciones; e.vida = v.vida; e.fichaLista = true; }
      }
    }
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
    precargarVecinas();
  }

  /* «En plano» desde la ficha de un equipo (13-nov): abre el plano con la planta de ese equipo ya elegida, el equipo
     marcado y centrado. Solo navega; el dibujo del plano es el de siempre. */
  async function verEquipo($app, id) {
    $raiz = $app;
    ponerEstilo();
    vista = null; zoom = 1; elegida = null;
    document.body.classList.remove('sin-scroll');
    const seg = document.getElementById('segmentos');
    if (seg) seg.hidden = true;
    $app.innerHTML = '<p class="cargando">Cargando el plano…</p>';
    try {
      await cargar();
      const q = compacto ? plantas().find((x) => colocadoEn(x, id)) : plantas().find((x) => (x.parcial ? (x.enPlano || []).includes(id) || false : x.equipos.some((y) => y.id === id)));
      if (q) { await traerPlanta(q.planta || ''); planta = q.planta || ''; elegida = id; }
    } catch (e) {
      $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-cx="lista">Volver</button></div>`;
      return;
    }
    pintar();
    if (elegida) { mostrarHoja(); centrar(elegida); }
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
    const puestos = p.equipos.filter((e) => e.x !== null);
    const usados = [...new Set(puestos.map((e) => e.icono || 'generico'))];
    const ic = (datos && datos.iconos) || {};
    /* Cuántos hay de cada tipo en el plano (2-nov, JC: los HRU no se contaban). */
    const n = (k) => puestos.filter((e) => (e.icono || 'generico') === k).length;
    return `<div class="pe-iconos" role="group" aria-label="Tipos de equipo">${usados.filter((k) => ic[k]).map((k) => `<span><svg viewBox="0 0 24 24" aria-hidden="true">${ic[k].svg}</svg>${esc(ic[k].nombre)} <b>${cifra(n(k))}</b></span>`).join('')}</div>`;
  }

  /* El conjunto en la ficha: UE y UI con su TAG; las que caen en otro plano o fuera de la vista, con «ver». */
  function conjuntoHtml(e) {
    const ms = e.miembros || [];
    if (ms.length < 2) return '';
    const filas = ms.map((m) => {
      const donde = m.id === e.id ? '' : m.aqui ? 'en este plano' : m.enPlano ? `en ${esc(m.planta || 'otra planta')}` : 'sin colocar';
      const ver = m.id !== e.id && m.enPlano ? `<button class="boton secundario" data-pe-ver="${esc(m.id)}">ver</button>` : '';
      return `<div${m.id === e.id ? ' class="actual" aria-current="true"' : ''}><span><em>${esc(m.papel === 'UE' ? 'UE' : 'UI')}</em> <b class="cifra">${esc(m.tag)}</b> <span class="tenue">· ${m.papel === 'UE' ? 'Unidad exterior' : 'Unidad interior'}${donde ? ` · ${donde}` : ''}</span></span>${ver}</div>`;
    });
    return `<div class="pe-conjunto">${filas.join('')}</div>`;
  }

  /* Puesta en marcha, garantía y certificación, ya escritas por el servidor
   * (shared/commissioning/vidaEquipo.js: bloquesFicha). */
  function vidaHtml(e) {
    const celda = (c) => (!c || !c.texto ? VACIO
      : c.tono === 'gris' ? `<span class="pe-vacio">${esc(c.texto)}</span>`
        : c.tono ? `<span class="pe-tono-${c.tono}">${esc(c.texto)}</span>`
          : c.enlace && /^https?:\/\//i.test(c.enlace) ? `<a href="${esc(c.enlace)}" target="_blank" rel="noopener">${esc(c.texto)}</a>` : esc(c.texto));
    return ((e.vida && e.vida.bloques) || []).map((b) => `<div class="pe-bloque pe-vida"><h4>${esc(b.titulo)}</h4><table class="pe-ficha">${b.id === 'garantia' ? entregaDFHtml(e) : ''}${b.filas.map(([k, c]) => `<tr><th>${esc(k)}</th><td>${celda(c)}</td></tr>`).join('')}</table></div>`).join('');
  }
  /* La entrega a la DF, editable por quien edita la puesta en marcha (30-oct, sin
     el Mac): se guarda en el teléfono y sube a la nube (paquete.js › CAMPOS_VUELTA). */
  function entregaDFHtml(e) {
    const d = e.vida && e.vida.entregaDF;
    if (!d || !d.editable) return '';
    const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return `<tr><th>Entrega a DF</th><td><input type="date" class="pe-entrega-df" data-pe-entrega-df="${esc(e.id)}" value="${esc(d.fecha || '')}" max="${hoy}" aria-label="Fecha de entrega a la DF">${d.fecha ? ` <button class="enlace" data-pe-entrega-df-quitar="${esc(e.id)}">Quitar</button>` : ''}</td></tr>`;
  }
  async function guardarEntregaDF(id, fecha) {
    try {
      const r = await C.postJson('api/plano-equipos/entrega-df', { equipoId: id, fecha });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'No se ha guardado.');
      C.aviso(fecha ? 'Entrega a la DF guardada.' : 'Entrega a la DF quitada.', 'bien');
      await cargar(); repintarQuieto();
    } catch (err) { C.aviso(err.message); await cargar().then(repintarQuieto).catch(() => {}); }
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
      ${documentosEquipoHtml(e)}
      ${p.plano && e.x === null ? '<div class="sub tenue">No está en el plano.</div>' : ''}
      ${vidaHtml(e)}
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
  /* Los documentos en tabla, la misma pieza que el panel del escritorio y la web (shared/commissioning/panelEquipoPlano.js). */
  const PEP = () => window.PANEL_EQUIPO_PLANO || null;
  function documentosEquipoHtml(e) {
    const P = PEP();
    if (!P) return (e.documentos || []).length ? `<div class="pe-enlaces">${e.documentos.map(enlaceDoc).join('')}</div>` : '';
    if (!e.fichaLista && e.documentos === undefined) return '';
    const h = P.documentosHtml({ pesada: { documentos: e.documentos || [] } });
    return `<div class="pe-docs">${h}</div>`;
  }
  function abrirDocEquipo(i) {
    const P = PEP(); const e = equipoElegido();
    if (!P || !e) return;
    const f = P.filasDocumentos({ pesada: { documentos: e.documentos || [] } })[i];
    const a = f && f.archivos && f.archivos[0];
    if (!a) return;
    if (!window.VISOR_DOC || !P.abrirVisor(f, { subtitulo: e.tag || '' })) window.open(a.url || a.ruta, '_blank', 'noopener');
  }
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
  /* 30-oct: cada material mide lo suyo en el plano (tamaño real a la escala estimada), con un mínimo de MIN_PX. */
  const MIN_PX = 4;
  const escalas = new Map();
  function escalaDe(p) {
    const f = FP();
    if (!f || !p || !p.plano || p.esIfc) return 0;
    const k = `${p.plano.id}|${(p.materiales || []).length}`;
    if (!escalas.has(k)) escalas.set(k, f.escalaPlano(p.plano, p.materiales || []).mmPorPx);
    return escalas.get(k);
  }
  /* Los equipos, a su tamaño típico en planta (formasPlano.cajaEquipo), con un mínimo de MIN_PX_EQ. */
  const MIN_PX_EQ = 7;
  function cajaEq(e, p) {
    const f = FP();
    if (!f || !f.cajaEquipo || !p || !p.plano) return { wf: 0, ar: 1 };
    /* El fondo del modelo sí tiene escala: cada unidad del svg mide plano.res metros (0,02 en NCN). Tamaño real del equipo. */
    if (p.esIfc) return f.cajaEquipo(e.icono || 'generico', p.plano, (Number(p.plano.res) || 0.1) * 1000);
    /* Con el símbolo del dibujo (30-oct), su tamaño. */
    if (e.w > 0 && e.h > 0 && p.plano.ancho > 0 && p.plano.alto > 0) return { wf: Math.max(e.w, (e.h * p.plano.alto) / p.plano.ancho), ar: 1 };
    return f.cajaEquipo(e.icono || 'generico', p.plano, escalaDe(p));
  }
  function marcaMaterial(m, q, p) {
    const f = FP();
    const fm = f ? f.formaMaterial(m) : null;
    const c = f && p && p.plano ? f.cajaEnPlano(m, p.plano, escalaDe(p)) : { wf: 0, ar: 1 };
    const st = `left:${m.x * 100}%;top:${m.y * 100}%;--wp:${(c.wf * 100).toFixed(4)}%;--ar:${c.ar.toFixed(3)};--minw:${(MIN_PX * Math.max(1, c.ar)).toFixed(1)}px${fm ? `;--giro:${fm.giro || 0}deg` : ''}`;
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
    pedirFicha();
  }

  /* La puesta en marcha, la garantía y los botones del equipo se piden al abrir su ficha (no van en la lista). */
  function pedirFicha() {
    const e = equipoElegido();
    if (!e || e.fichaLista || e.fichaPidiendo || !datos || !datos.ligero) return;
    e.fichaPidiendo = true;
    C.pedir(`api/plano-equipos/ficha?obra=${encodeURIComponent(C.obraId())}&id=${encodeURIComponent(e.id)}`)
      .then((r) => {
        if (!r || r.ok === false) return;
        e.documentos = r.documentos; e.acciones = r.acciones; e.vida = r.vida; e.fichaLista = true;
        if (elegida === e.id) mostrarHoja();
      })
      .catch(() => {})
      .finally(() => { e.fichaPidiendo = false; });
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
    if (!flota) { marco.style.height = ''; if (compacto || window.innerWidth < 900) ajustarAlto(); return; }
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
      $raiz.innerHTML = compacto ? `<p class="nota pe-sin-ifc" data-pe-sin-ifc>Ninguna planta tiene todavía plano (ni IFC ni PDF): lo prepara el delineante.</p>`
        : `${cabeza()}<p class="vacio">Esta obra aún no tiene equipos.</p>`;
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
    const chipFaltas = FA.chip(p);
    const pe0 = datos && (datos.plantas || []).find((x) => (x.planta || '') === (p.planta || ''));
    const selector = compacto ? '' : pe0 && pe0.ifc ? `<div class="pe-fondo" role="group" aria-label="Fondo del plano"><button data-pe-fondo="ifc" aria-pressed="${Boolean(p.esIfc)}">Modelo IFC</button><button data-pe-fondo="pdf" aria-pressed="${!p.esIfc}"${pe0.plano ? '' : ' disabled'}>Plano PDF</button></div>${p.esIfc ? `<p class="nota" data-pe-fondo-nota>${p.sinUbicar.length ? `${cifra(p.sinUbicar.length)} equipo${p.sinUbicar.length === 1 ? '' : 's'} sin posición en el modelo${pe0.plano ? ' (en el plano PDF quizá sí)' : ''}. ` : ''}${(pe0.materiales || []).some((m) => m.x !== null) || (pe0.faltas || []).length ? 'Los materiales y lo que falta están marcados en el plano PDF.' : ''}</p>` : ''}`
      : (p.plano ? '<p class="nota" data-pe-pdf-sin-ifc>plano PDF (sin IFC)</p>' : '');
    const plano = p.plano ? `${selector}<div class="pe-visor"><div class="pe-marco${FA.marcando() ? ' fa-activo' : ''}" data-pe-marco data-paleta="vidaire">
        <div class="pe-lienzo${zoom >= ZOOM_SALAS ? ' con-salas' : ''}" data-pe-lienzo style="width:${zoom * 100}%;--pe-esc:${escMarcas()}">
          <img data-src="api/plano-equipos/imagen?id=${encodeURIComponent(p.plano.id)}" alt="Plano ${esc(p.plano.nombre)}" draggable="false">
          ${salasDe(p).map((r, i) => `<span class="pe-sala" data-pe-sala="${i}" style="left:${r.x * 100}%;top:${r.y * 100}%">${esc(r.t)}</span>`).join('')}
          ${mats.map((m) => marcaMaterial(m, q, p)).join('')}
          ${FA.marcas(p)}
          ${enPlano.map((x) => `<button class="marca-boca ${x.color === 'verde' ? 'bien' : x.color === 'rojo' ? 'mal' : 'azul'}${enConjunto.has(x.id) ? ' elegida' : ''}${x.revisar ? ' revisar' : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%;--wp:${(cajaEq(x, p).wf * 100).toFixed(4)}%" data-pe-marca="${esc(x.id)}" aria-label="${esc(`${x.tag}, ${x.sala || 'sin sala'}: ${NOMBRE[x.color]}${x.revisar ? '; revisar ubicación' : ''}`)}">${simbolo(x.icono)}<span class="rotulo-boca">${esc(x.tag)}</span></button>`).join('')}
        </div>
      </div>
      ${p.esIfc && !(p.plano.salas || []).length ? '<p class="nota pe-sin-nombres" data-pe-sin-nombres>El modelo de esta planta no trae nombres de sala y no hay plano de arquitectura para situarlos.</p>' : ''}${p.esIfc && p.plano.fuenteSalas === 'plano' ? '<p class="nota pe-sin-nombres" data-pe-nombres-pdf>Nombres de sala del plano de arquitectura, situados por los equipos: el modelo no los trae.</p>' : ''}
      <!-- 13-nov (JC en el iPhone): el −/Entero/+ en una franja bajo el plano, nunca encima; también pellizco y doble toque -->
      <div class="pe-zoom" role="group" aria-label="Zoom del plano"><button class="boton secundario" data-pe-zoom="-1" aria-label="Alejar">−</button><button class="boton secundario" data-pe-zoom="0">Entero</button><button class="boton secundario" data-pe-zoom="1" aria-label="Acercar">+</button></div>${FA.marcando() ? FA.mando(p) : ''}</div>`
      : compacto ? `<div class="pe-sin-plano" data-pe-sin-ifc><b>Falta el IFC de la planta ${esc(etiqueta(p))}</b> (y tampoco tiene plano PDF). Lo prepara el delineante; mientras, sus equipos están en «Lista».</div>`
      : `<div class="pe-sin-plano"><b>La planta ${esc(etiqueta(p))} aún no tiene plano de equipos.</b><br>Lo sube la oficina desde Commissioning › Plano. Mientras, la lista dice la sala y el estado de cada equipo.</div>`;
    /* Fila 1 de la pestaña Cx: el desplegable con todas las plantas (las que tienen IFC dicen cuántos coloca el modelo; las que no,
       «sin IFC») y, si a la abierta le falta el IFC, el aviso en la misma fila. */
    const ops = plantasCx();
    const desplegable = `<div class="pe-planta-sel"><label>Planta <select data-pe-planta-sel aria-label="Planta">${(ops.length ? ops : [p]).map((x) => `<option value="${esc(x.planta || '')}"${(x.planta || '') === (p.planta || '') ? ' selected' : ''}>${esc(etiqueta(x))} · ${x.ifc ? `${cifra(nIfc(x))} de ${cifra(nEquipos(x))} en el modelo` : `sin IFC · ${cifra(nEquipos(x))} equipos`}</option>`).join('')}</select></label>${p.esIfc || !p.plano ? '' : '<span class="pe-sin-ifc" data-pe-sin-ifc>Falta el IFC: plano PDF</span>'}</div>`;
    const nRev = p.plano ? p.equipos.filter((x) => x.revisar).length : 0;
    const masDentro = `${p.plano && p.equipos.length ? leyendaIconos(p) : ''}
      ${p.plano ? leyendaFormas(p) : ''}
      ${p.plano && (p.sinUbicar || []).length ? `<details class="pe-sin-ubicar" data-pe-sin-ubicar${verSinUbicar ? ' open' : ''}><summary><i class="pe-punto pe-gris"></i>Sin ubicar en el plano · ${cifra(p.sinUbicar.length)}</summary>
        <div class="pe-grises">${p.sinUbicar.map((g) => `<button data-pe-fila="${esc(g.id)}" aria-label="${esc(`${g.tag}: en el listado de esta planta y no en su plano`)}">${esc(g.tag)}</button>`).join('')}</div></details>` : ''}
      ${p.plano && p.equipos.some((x) => x.revisar) ? `<details class="pe-sin-ubicar pe-revisar"><summary><i class="pe-punto pe-gris"></i>Revisar ubicación · ${cifra(p.equipos.filter((x) => x.revisar).length)}</summary>
        <div class="pe-grises">${p.equipos.filter((x) => x.revisar).map((g) => `<button data-pe-fila="${esc(g.id)}" aria-label="${esc(`${g.tag}: ${g.motivo || 'revisar ubicación'}`)}">${esc(g.tag)}</button>`).join('')}</div></details>` : ''}`;
    /* 13-nov (JC): la leyenda por tipos, «Sin ubicar» y «Revisar ubicación» empujaban el plano hacia abajo: plegadas en una línea cerrada. */
    const masPlegado = masDentro.trim() ? `<details class="pe-mas" data-pe-mas${verMas || verSinUbicar ? ' open' : ''}><summary>Leyenda${p.plano && (p.sinUbicar || []).length ? ` · sin ubicar ${cifra(p.sinUbicar.length)}` : ''}${nRev ? ` · revisar ${cifra(nRev)}` : ''}</summary>${masDentro}</details>` : '';
    $raiz.innerHTML = compacto ? `
      ${desplegable}
      ${p.equipos.length ? `<div class="pe-leyenda pe-una-fila" role="group" aria-label="Estados">${ORDEN.map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}"><i class="pe-punto pe-${k}"></i>${esc(NOMBRE[k])} <b>${cifra(c[k] || 0)}</b></button>`).join('')}</div>` : ''}
      <div class="pe-cuerpo">
        <div>${plano}</div>
        <div class="pe-lado"><div class="pe-hoja" data-pe-hoja hidden></div></div>
      </div>` : `
      ${cabeza()}
      <div class="pe-plantas" role="tablist">${plantas().map((x) => `<button role="tab" data-pe-planta="${esc(x.planta || '')}" aria-selected="${x === p}" class="${x === p ? 'activa' : ''}">${esc(etiqueta(x))}<small>${cuentaTexto(nEquipos(x), nMateriales(x))}</small></button>`).join('')}</div>
      ${capas.length > 1 || chipFaltas ? `<div class="pe-capas" role="group" aria-label="Capas">${capas.length > 1 ? capas.map((k) => `<button data-pe-capa="${esc(k.id)}" aria-pressed="${!capasOff.has(k.id)}">${esc(k.nombre)} <b>${cifra(cuentasCapa[k.id])}</b></button>`).join('') : ''}${chipFaltas}</div>` : ''}
      ${p.equipos.length ? `<div class="pe-leyenda" role="group" aria-label="Colores">${ORDEN.map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}"><i class="pe-punto pe-${k}"></i>${esc(NOMBRE[k])} <b>${cifra(c[k] || 0)}</b></button>`).join('')}
        <p class="nota">sin sala ${cifra(c.sinSala)}${p.plano ? ` · en el plano ${cifra(c.enPlano)} de ${cifra(p.equipos.length)}` : ''}</p></div>` : ''}
      ${masPlegado}
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
    colocarTags($raiz.querySelector('[data-pe-lienzo]'));
    if (compacto || window.innerWidth < 900) ajustarAlto();
    const fila = compacto ? null : $raiz.querySelector('.pe-plantas');
    const act = fila && fila.querySelector('.activa');
    if (act) fila.scrollLeft = act.offsetLeft - fila.clientWidth / 2 + act.offsetWidth / 2;
  }

  /* Pantalla Cx (13-nov, JC): sin hueco blanco bajo el plano. Entero: el marco se pega al plano; con zoom: ocupa todo el alto libre hasta la barra. */
  function ajustarAlto() {
    const [marco] = marcoYLienzo();
    const img = marco && marco.querySelector('.pe-lienzo img');
    if (!marco || !img) return;
    const poner = () => {
      if (!marco.isConnected || !img.naturalWidth) return;
      const libre = Math.max(240, window.innerHeight - marco.getBoundingClientRect().top - 112);
      const natural = marco.clientWidth * (img.naturalHeight / img.naturalWidth) * zoom + 2;
      marco.style.height = Math.round(zoom > 1 ? libre : Math.max(natural, 160)) + 'px'; /* entero: el plano entero, sin hueco ni recorte */
    };
    /* La imagen llega después (data-src → blob): hasta que carga no tiene medidas; se ajusta al cargar. */
    if (img.complete && img.naturalWidth) poner(); else img.addEventListener('load', poner, { once: true });
  }

  function cabeza() {
    return propio ? '<div class="pe-cabeza"><h2>Plano de equipos</h2></div>'
      : '<div class="pe-cabeza"><button class="enlace" data-cx="lista">‹ Cx</button><h2>Plano de equipos</h2></div>';
  }

  const marcoYLienzo = () => [$raiz && $raiz.querySelector('[data-pe-marco]'), $raiz && $raiz.querySelector('[data-pe-lienzo]')];

  /* Lo que mide un texto en px con la letra del rótulo (recordado: al pellizcar se recalcula en cada fotograma). */
  const anchos = new Map();
  let lienzoTexto = null;
  function anchoTexto(t, letra) {
    const k = `${letra}|${t}`;
    if (anchos.has(k)) return anchos.get(k);
    if (!lienzoTexto) { try { lienzoTexto = document.createElement('canvas').getContext('2d'); } catch { lienzoTexto = null; } }
    let w = String(t).length * 5.6;
    if (lienzoTexto) { lienzoTexto.font = letra; w = lienzoTexto.measureText(String(t)).width; }
    if (anchos.size > 5000) anchos.clear();
    anchos.set(k, w);
    return w;
  }
  const LETRA_TAG = '700 9px system-ui, sans-serif';
  const LETRA_TAG_ELEGIDO = '700 12px system-ui, sans-serif';
  const LETRA_SALA = '600 11px system-ui, sans-serif';
  const huecos = new WeakMap(); /* salas del plano → hueco de cada una (vistaPlano.huecoSalas) */
  /* Los nombres de sala: los que trae el plano (IFC o PDF); si no trae ninguno, el campo sala de los equipos (nunca inventados). */
  const salasEq = new WeakMap();
  function salasDe(p) {
    const ls = (p && p.plano && p.plano.salas) || [];
    if (ls.length || !p || !window.VISTA_PLANO || !window.VISTA_PLANO.salasDeEquipos) return ls;
    if (!salasEq.has(p)) { const f = FP(); salasEq.set(p, window.VISTA_PLANO.salasDeEquipos(p.equipos || [], f ? f.partirSala : undefined).filter((r) => !f || f.partirSala(r.t).nombre)); }
    return salasEq.get(p);
  }

  /*
   * LOS RÓTULOS SIN AMONTONARSE (13-nov, JC: «eso así no puede ser»): vistaPlano.rotulosSinChoque, en px del lienzo.
   * Los TAG desde ZOOM_SALAS y solo los que no chocan (el tocado manda; el que no sale, sale al tocar su equipo).
   * Los nombres de sala, finos y en gris, por debajo: solo los que caben en su sala y no tapan ni un TAG, ni un
   * símbolo, ni otra sala; las grandes primero. Igual sobre el modelo IFC que sobre el PDF de reserva.
   */
  function colocarTags(lienzo) {
    const V = window.VISTA_PLANO; const f = FP(); const p = plantaActual();
    if (!lienzo) return;
    const botones = [...lienzo.querySelectorAll('[data-pe-mat]')];
    const botonesEq = [...lienzo.querySelectorAll('[data-pe-marca]')];
    const rotSalas = [...lienzo.querySelectorAll('[data-pe-sala]')];
    const quitar = () => { for (const b of [...botones, ...botonesEq]) b.classList.remove('con-tag'); for (const s of rotSalas) s.classList.remove('ver'); };
    if (!V || !V.colocarRotulos || !f || !p || !p.plano) { quitar(); return; }
    const lw = lienzo.offsetWidth; const lh = lienzo.offsetHeight || lw;
    if (!lw) { quitar(); return; }
    /* 13-nov (JC: «es súper importante el nombre de la sala»): la regla compartida (vistaPlano.colocarRotulos), la misma
       de la web, el escritorio y el HTML de la DF: bloques de tamaño fijo, nombres de sala antes que los TAG, nada se pisa. */
    const porId = new Map((p.materiales || []).map((m) => [m.id, m]));
    const materiales = [];
    for (const b of botones) {
      const m = porId.get(b.dataset.peMat);
      if (!m || m.x === null || b.classList.contains('apagada')) continue;
      const c = f.cajaEnPlano(m, p.plano, escalaDe(p));
      materiales.push({ id: m.id, x: m.x, y: m.y, sw: Math.max(MIN_PX * Math.max(1, c.ar), c.wf * lw), tag: m.tag, elegido: m.id === mat, pri: m.estado === 'conIncidencia' ? 2 : m.estado === 'conFicha' ? 2.5 : 3 });
    }
    const porEq = new Map((p.equipos || []).map((e) => [e.id, e]));
    /* 13-nov (JC en el iPhone): el bloque mide lo mismo en pantalla a cualquier zoom (TAM_EQ px) y encoge si choca con el
       vecino (vistaPlano.tamBloques): al acercar, las salas crecen y los equipos se separan. */
    const tam = V.tamBloques ? V.tamBloques(botonesEq.map((b) => porEq.get(b.dataset.peMarca)).filter(Boolean), { lw, lh, max: TAM_EQ, min: TAM_EQ_MIN }) : new Map();
    const equipos = [];
    for (const b of botonesEq) {
      const e = porEq.get(b.dataset.peMarca);
      if (!e || e.x === null) continue;
      const elegido = b.classList.contains('elegida');
      const t = elegido ? TAM_EQ_ELEGIDO : (tam.get(e.id) || TAM_EQ);
      b.style.width = `${t}px`;
      equipos.push({ id: e.id, x: e.x, y: e.y, sw: t, tag: e.tag, elegido });
    }
    const listaSalas = salasDe(p);
    if (!huecos.has(listaSalas)) huecos.set(listaSalas, V.huecoSalas(listaSalas, lh / lw));
    const ancho = (t, k) => anchoTexto(t || '', k === 'elegido' ? LETRA_TAG_ELEGIDO : k === 'sala' ? LETRA_SALA : LETRA_TAG);
    const ver = V.colocarRotulos({ lw, lh, equipos, materiales, salas: listaSalas, huecos: huecos.get(listaSalas), ancho });
    for (const b of botones) b.classList.toggle('con-tag', ver.tags.has(b.dataset.peMat));
    for (const b of botonesEq) b.classList.toggle('con-tag', ver.tags.has(`eq:${b.dataset.peMarca}`));
    /* 13-nov: un TAG que se saldría por la derecha del plano va a la izquierda de su equipo (regla compartida). */
    const izq = ver.izq || new Set();
    for (const b of botones) b.classList.toggle('tag-izq', izq.has(b.dataset.peMat));
    for (const b of botonesEq) b.classList.toggle('tag-izq', izq.has(`eq:${b.dataset.peMarca}`));
    for (const s of rotSalas) {
      const i = Number(s.dataset.peSala); const c = ver.sitio.get(i);
      s.classList.toggle('ver', Boolean(c));
      if (c) { s.style.left = `${(c.x / lw) * 100}%`; s.style.top = `${(c.y / lh) * 100}%`; }
    }
  }

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
    colocarTags(lienzo);
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
      /* Marcando (8-nov): el toque dice el sitio, aunque caiga encima de otra marca; arrastrar y pellizcar siguen moviendo el plano. */
      if (eraEspera && marco && FA.marcando()) {
        const caja = marco.querySelector('[data-pe-lienzo]').getBoundingClientRect();
        const x = (ev.clientX - caja.left) / caja.width;
        const y = (ev.clientY - caja.top) / caja.height;
        gesto = null;
        ultimoToque = null;
        tragarClick = true;
        setTimeout(() => { tragarClick = false; }, 350);
        /* Fuera del dibujo (el hueco bajo un plano apaisado) no es un sitio: sigue esperando. */
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) FA.tocado(x, y);
        return;
      }
      /* Doble toque en un hueco del plano: acerca (o, si ya está muy cerca, vuelve a entero). */
      if (eraEspera && marco && !(ev.target.closest && ev.target.closest('[data-pe-marca],[data-pe-mat],[data-pe-zoom],[data-fa-ver]'))) {
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
  function irAlEquipo(accion, otro = null) {
    const e = otro ? { id: otro } : equipoElegido();
    if (!e || typeof window.CX_COMMISSIONING_IR !== 'function') return;
    const [marco] = marcoYLienzo();
    const lista = $raiz.querySelector('.pe-lista');
    vista = { planta, zoom, elegida, ocultos: [...ocultos], sl: marco ? marco.scrollLeft : 0, st: marco ? marco.scrollTop : 0, lista: lista ? lista.scrollTop : 0, pagina: window.scrollY };
    window.CX_COMMISSIONING_IR(e.id, accion, $raiz);
  }

  /* La franja gris abierta o cerrada se recuerda al repintar. */
  document.addEventListener('toggle', (ev) => {
    if (ev.target && ev.target.matches && ev.target.matches('[data-pe-sin-ubicar]')) verSinUbicar = ev.target.open;
    if (ev.target && ev.target.matches && ev.target.matches('[data-pe-mas]')) verMas = ev.target.open;
  }, true);

  /* Un arrastre o pellizco no es un toque: se traga el click que viene detrás. */
  document.addEventListener('click', (ev) => {
    if (tragarClick && enMarco(ev)) { ev.stopPropagation(); ev.preventDefault(); tragarClick = false; }
  }, true);

  document.addEventListener('change', (ev) => {
    if (!$raiz || !$raiz.contains(ev.target) || !datos) return;
    const sel = ev.target.closest && ev.target.closest('[data-pe-planta-sel]');
    if (sel) {
      const nombre = sel.value;
      if (compacto) { try { localStorage.setItem(CLAVE_CX, nombre); } catch { /* sin almacén */ } }
      traerPlanta(nombre).then(() => { planta = nombre; elegida = null; mat = null; zoom = 1; pintar(); precargarVecinas(); }).catch((e) => C.aviso(e.message));
      return;
    }
    const df = ev.target.closest('[data-pe-entrega-df]');
    if (df && df.value) guardarEntregaDF(df.dataset.peEntregaDf, df.value);
  });

  document.addEventListener('click', (ev) => {
    if (!$raiz || !$raiz.contains(ev.target) || !datos) return;
    if (FA.clic(ev)) return;
    const vd = ev.target.closest('[data-pes-ver-doc]');
    if (vd) { abrirDocEquipo(Number(vd.dataset.pesVerDoc)); return; }
    const dq = ev.target.closest('[data-pe-entrega-df-quitar]');
    if (dq) { guardarEntregaDF(dq.dataset.peEntregaDfQuitar, null); return; }
    const pl = ev.target.closest('[data-pe-planta]');
    if (pl) {
      const nombre = pl.dataset.pePlanta;
      traerPlanta(nombre).then(() => { planta = nombre; elegida = null; mat = null; zoom = 1; pintar(); precargarVecinas(); }).catch((e) => C.aviso(e.message));
      return;
    }
    const co = ev.target.closest('[data-pe-color]');
    if (co) { const k = co.dataset.peColor; if (ocultos.has(k)) ocultos.delete(k); else ocultos.add(k); repintarQuieto(); return; }
    const fo = ev.target.closest('[data-pe-fondo]');
    if (fo) {
      const k = planta || '';
      if (fo.dataset.peFondo === 'pdf') { conPdf.add(k); conModelo.delete(k); } else { conPdf.delete(k); conModelo.add(k); }
      elegida = null; mat = null; zoom = 1; pintar();
      return;
    }
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
      const id = ver.dataset.peVer;
      /* 13-nov (JC): «ver» el otro equipo del par abre también su ficha completa. */
      if (typeof window.CX_COMMISSIONING_IR === 'function') { irAlEquipo('equipo', id); if (vista) vista.elegida = null; return; }
      const q = plantas().find((x) => (x.parcial ? (x.enPlano || []).includes(id) : x.equipos.some((y) => y.id === id && y.x !== null)));
      if (q && (q.planta || '') !== (planta || '')) {
        traerPlanta(q.planta || '').then(() => { planta = q.planta || ''; elegida = id; zoom = 1; pintar(); mostrarHoja(); asomar(elegida); }).catch((e) => C.aviso(e.message));
      }
      else centrar(ver.dataset.peVer);
      return;
    }
    const ac = ev.target.closest('[data-pe-accion]');
    if (ac) { irAlEquipo(ac.dataset.peAccion); return; }
    /* 13-nov (JC, en reunión): tocar un equipo del plano o de la lista abre SU FICHA COMPLETA (checklist, toma de datos,
       estanqueidad, balanceo…), no la hoja corta; al volver, el plano sigue con su planta, zoom y sitio (irAlEquipo guarda la vista). */
    const mk = ev.target.closest('[data-pe-marca]') || ev.target.closest('[data-pe-fila]');
    if (mk) {
      const id = mk.dataset.peMarca || mk.dataset.peFila;
      if (typeof window.CX_COMMISSIONING_IR === 'function') { elegida = id; mat = null; irAlEquipo('equipo'); if (vista) vista.elegida = null; return; }
      if (mk.dataset.peMarca) elegir(id); else elegir(id, { centrarla: true });
    }
  });

  FA.conectar({
    datos: () => datos,
    planta: () => plantaActual(),
    repintar: () => repintarQuieto(),
    recargar: async () => { await cargar(); repintarQuieto(); },
    abrirEquipo: (id) => elegir(id, { centrarla: true }),
  });

  /* Sección propia «Más › Plano de equipos» (quien no tiene Commissioning). */
  const activaPropia = () => C.activa('plano');
  const abrirPropio = () => { propio = true; const a = document.getElementById('app'); if (a) abrir(a); };
  window.addEventListener('movil:obra', () => { if (activaPropia()) abrirPropio(); });
  window.addEventListener('hashchange', () => { if (activaPropia()) abrirPropio(); else propio = false; });
  if (activaPropia()) abrirPropio();

  /* LA PANTALLA CX (13-nov, JC): el plano se monta dentro de un contenedor de la pantalla Cx (el buscador queda encima).
     `ir` lleva a un equipo: cambia de planta, lo marca, abre su hoja y lo centra. Devuelve false si el plano no lo conoce. */
  async function ir(id, ids = [id]) {
    if (!$raiz || !$raiz.isConnected || !datos) return false;
    const quien = ids.find((i) => plantas().some((x) => colocadoEn(x, i))) || null;
    const q = quien && plantas().find((x) => colocadoEn(x, quien));
    if (!q) return false;
    try { await traerPlanta(q.planta || ''); } catch (e) { C.aviso(e.message); return false; }
    planta = q.planta || ''; elegida = quien; mat = null; zoom = 1;
    pintar(); mostrarHoja(); centrar(quien);
    return true;
  }
  const montar = ($c, op = {}) => {
    if (!compacto) planta = plantaGuardadaCx(); /* al entrar en la pestaña Cx, la última planta elegida allí (o la primera con IFC) */
    propio = false; compacto = true;
    return op.equipo ? verEquipo($c, op.equipo) : (op.volver ? volver($c) : abrir($c));
  };
  window.CX_PLANO_EQUIPOS = { abrir: ($app) => { propio = false; compacto = false; return abrir($app); }, volver: ($app) => { compacto = false; return volver($app); }, verEquipo: ($app, id) => { propio = false; compacto = false; return verEquipo($app, id); }, montar, ir };
})();
