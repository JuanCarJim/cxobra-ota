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

  /* 13-nov (JC): los colores del bloque son los de shared/commissioning/colorBloque.js —certificado (azul), Cx hecho
     (verde), instalado sin Cx (gris), no instalado (gris claro discontinuo), sin dato—; sustituyen a «En marcha / Falta doc. /
     Sin empezar». La leyenda, el filtro y el recuento de arriba van por ese estado. */
  const CB = window.COLOR_BLOQUE;
  /* 18-nov (JC: «es incoherente cómo se ven los equipos con sus colores en la web y en el móvil»): el orden, los nombres y los
     nombres cortos (14-nov, chips a 390 px) son los de shared/commissioning/estadoEquipoPlano.js, los mismos que la web. */
  const EEP = window.ESTADO_EQUIPO_PLANO;
  const ORDEN = EEP ? EEP.ORDEN : CB ? CB.ORDEN_BLOQUE : ['cxHecho', 'instalado', 'sinDato'];
  /* 21-nov: con «Color: DF y recepción», el plano se colorea por la validación de la DF y la recepción de la propiedad
     (shared/commissioning/recepcionDF.js: ORDEN_PLANO, COLOR_PLANO, ETIQUETAS), como el escritorio. */
  const RD = window.RECEPCION_DF;
  const NOMBRE_BQ = EEP ? EEP.NOMBRE : CB ? Object.fromEntries(CB.ESTADOS_BLOQUE.map((x) => [x.id, x.nombre])) : { cxHecho: 'Commissioning hecho', instalado: 'Instalado, sin Cx', sinDato: 'Sin dato' };
  const NOMBRE = { ...NOMBRE_BQ, ...(RD ? RD.ETIQUETAS : {}) };
  const CORTO = { ...(EEP ? EEP.CORTO : { certificado: 'Certificado', cxHecho: 'Cx hecho', instalado: 'Instalado', noInstalado: 'No instalado', sinDato: 'Sin dato' }), ...(RD ? RD.ETIQUETAS : {}) };
  let colorRdf = false;
  const enRdf = () => Boolean(colorRdf && RD && datos && datos.rdf);
  const ordenV = () => (enRdf() ? RD.ORDEN_PLANO : ORDEN);
  /* Verde por estar en marcha, sin el Cx cerrado: se dice «En marcha», no «Commissioning hecho» (15-nov). */
  const enMarchaSinCerrar = (e) => Boolean(e && e.color === 'verde' && e.completo === false && bq(e) !== 'certificado');
  const nombreBloque = (e) => (enMarchaSinCerrar(e) ? 'En marcha, Cx sin cerrar' : NOMBRE[bq(e)]);
  const bq = (e) => (enRdf() ? ((e && datos.rdf[e.id]) || 'sinValidar') : bqCx(e));
  const bqCx = (e) => (e && e.bloque) || (e && e.color === 'verde' ? 'cxHecho' : e && e.color === 'azul' ? 'instalado' : 'sinDato');
  const ZOOM_MAX = 30; /* 30-oct, JC: «hay que poder ampliar más» */
  const TAM_EQ = 22; const TAM_EQ_MIN = 18; /* 13-nov, JC: «si son grandes y hago zoom y no se adaptan, nunca podré ver los que hay»: 18–24 px */ const TAM_EQ_ELEGIDO = 30; /* px de pantalla, a cualquier zoom */
  const ZOOM_SALAS = 3; /* desde aquí se leen los nombres de sala encima del plano */
  /* El dibujo de cada familia viene del servidor (shared/commissioning/planoEquipos.js: ICONOS),
     así es el mismo en escritorio, web y móvil, también sin conexión. */
  const SIMBOLO_GENERICO = '<rect class="cuerpo" x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><rect class="lleno" x="8" y="8" width="8" height="8" rx="1"/>';
  const iconosDe = () => (datos && datos.iconos) || iconosMini || {};
  const simbolo = (k) => `<svg class="simbolo-boca" viewBox="0 0 24 24" aria-hidden="true">${(iconosDe()[k] && iconosDe()[k].svg) || SIMBOLO_GENERICO}</svg>`;
  /* El tipo de un equipo en palabras (ventilador, fan coil…): el suyo o el de su icono. */
  const tipoDe = (x) => (x && x.tipo) || (datos && datos.iconos && x && datos.iconos[x.icono] && datos.iconos[x.icono].nombre) || '';
  let datos = null;
  let iconosMini = null; /* los iconos que trajo la miniatura de la ficha, si el plano aún no se ha abierto */
  let planta = null;
  let zoom = 1;
  let elegida = null; /* el equipo tocado */
  let ocultos = new Set(); /* colores que no se enseñan */
  /* 14-nov (JC): el chip «Con incidencia N» deja en el plano solo los equipos con incidencia abierta. */
  let soloInc = false;
  /* La regla es la del escritorio y la web: shared/commissioning/incidenciaPlano.js (incidencias SIN CERRAR del registro,
     extendidas a todo el conjunto de la unidad). */
  const IP = window.INCIDENCIA_PLANO || null;
  const conInc = (e) => Boolean(IP ? IP.tiene(e) : (e && Array.isArray(e.incidencias) && e.incidencias.length));
  const incHtml = () => `<span class="pe-inc" aria-hidden="true">${IP ? IP.DISTINTIVO : '!'}</span>`;
  /* 15-nov (JC): incidencia RESUELTA (cerrada) a falta de la toma de datos → azul con «!» azul; la abierta manda. */
  let soloRes = false;
  const conRes = (e) => Boolean(IP && IP.pendienteDatos(e));
  /* 18-nov (JC): «si tiene una incidencia por terceros, que salga en otro color, en naranja no» → morado. */
  let soloTer = false;
  const conTer = (e) => Boolean(IP && IP.tieneTerceros && IP.tieneTerceros(e));
  const incClase = (x) => (conInc(x) ? ' con-inc' : conTer(x) ? ' con-incter' : conRes(x) ? ' con-incres' : '');
  const incMarca = (x) => (conInc(x) || conTer(x) || conRes(x) ? incHtml() : '');
  const puntoInc = (x) => (conInc(x) ? 'incidencia' : conTer(x) ? 'incTerceros' : conRes(x) ? 'incResuelta' : bq(x));
  const dichoInc = (x) => (conInc(x) ? '; con incidencia abierta' : conTer(x) ? '; con incidencia abierta de terceros' : conRes(x) ? '; incidencia resuelta, faltan datos' : '');
  let $raiz = null;
  let vista = null; /* cómo estaba el plano al irse a una ficha, para volver igual */
  let propio = false; /* sección «Plano de equipos» (sin Commissioning) */
  let verMas = false; /* el desplegable «Leyenda · sin ubicar · revisar» abierto */
  let verSinUbicar = false; /* franja gris «Sin ubicar en el plano» abierta */
  /* 15-nov (JC: «el panel tapa casi todo el plano»): la hoja del equipo abre a media altura ('media'); con el asa se sube
     a 'completa' o se baja a 'plegada' (solo la cabecera y el resumen). */
  let estadoHoja = 'media';
  let hojaDe = null; /* el equipo o material cuya hoja está pintada (para volver arriba y a media altura al cambiar) */
  const ASA = '<button type="button" class="pe-asa" data-pe-asa aria-label="Subir o bajar la ficha del equipo"></button>';
  let verFranja = false; /* 14-nov (JC): la lista «N equipos sin sala, por confirmar» desplegada */
  let franjaFiltro = ''; /* 17-nov (v2): el buscador de la lista «por ubicar» (TAG, sala, zona, tipo) */
  /* 17-nov (JC: «Los equipos sin ubicar debemos de ser capaces de ubicarlos desde el móvil in situ»): el equipo que se está
     ubicando ({ id, tag }); el siguiente toque en el plano (no un arrastre ni un pellizco) dice su sitio. La regla, la del
     escritorio: shared/commissioning/ubicarEnPlano.js y planosIfc.colocarEnModelo (quién y cuándo, y sube a la nube). */
  let ubicando = null;
  let guardandoSitio = false;
  const UB = () => window.UBICAR_PLANO || null;
  const puedeUbicarAqui = (p) => Boolean(datos && datos.puedeUbicar && p && p.esIfc && p.plano && String(p.plano.id || '').startsWith('ifc:'));
  let base = 1; /* 14-nov (JC): ancho del lienzo en «Entero» (fracción del marco) para que la planta quepa entera también a lo alto */
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
  .pe-lienzo{position:relative;flex:none;margin-block:0 auto}
  .pe-franja{margin:6px 0 0}.pe-franja-tit{margin:0 0 3px;font-size:12px;color:var(--textoTenue)}
  .pe-franja-bloques{display:flex;flex-wrap:wrap;gap:4px;max-height:58px;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .pe-franja .marca-boca{position:relative;transform:none;flex:none;width:24px;height:24px;line-height:0;padding:1px;border-radius:4px;background:var(--panel);border:1px solid var(--borde)}
  .pe-franja .marca-boca .simbolo-boca{height:100%;width:100%}
  .pe-franja .marca-boca.elegida{outline:2px solid var(--acento);outline-offset:1px}.pe-marco{display:flex;flex-direction:column}
  /* 14-nov (JC en el iPhone: «esto no se ve bien»): en la pestaña Cx el plano llena el alto entre los chips y la barra de abajo,
     la planta entera centrada; debajo, una sola fila con «N equipos sin sala, por confirmar ›» y el −/Entero/+; sin scroll de página. */
  #app:has(.cx-plano [data-pe-marco]),body:has(.cx-plano [data-pe-marco]){padding-bottom:0}
  .cx-plano .pe-marco{height:auto}
  .cx-plano .pe-lienzo{margin:auto}
  .cx-plano .pe-leyenda.pe-una-fila{flex-wrap:wrap;overflow:visible;gap:4px;margin:0 0 6px}
  .cx-plano .pe-leyenda.pe-una-fila button{min-height:28px;padding:1px 7px;gap:4px;font-size:12px;margin:0;width:auto}
  .cx-plano .pe-leyenda .pe-punto{width:10px;height:10px}
  .cx-plano .pe-planta-sel{margin:0 0 6px}.cx-plano .pe-planta-sel select{min-height:40px}
  .pe-pie{display:flex;align-items:center;gap:6px;margin:4px 0 0}
  .pe-pie .pe-zoom{margin:0 0 0 auto;flex:none}
  .pe-franja-boton{flex:1 1 auto;min-width:0;width:auto;min-height:34px;margin:0;padding:2px 2px;border:0;background:none;color:var(--acento-fuerte,var(--acento));font-size:12.5px;line-height:15px;font-weight:600;text-align:left;display:flex;align-items:center;gap:4px}
  .pe-franja-boton .flecha{flex:none;display:inline-block;transition:transform .15s;font-size:16px}
  .pe-franja-boton[aria-expanded="true"] .flecha{transform:rotate(90deg)}
  .pe-pie{flex-wrap:wrap}
  /* 18-nov (JC): sin −/Entero/+ (se pellizca); «N equipos por ubicar ›» en una sola línea. */
  .pe-franja-boton>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pe-pie .pe-franja-lista{flex:1 0 100%}
  .cx-plano .pe-pie{position:relative;flex-wrap:nowrap}
  .cx-plano .pe-pie .pe-franja-lista{position:absolute;left:0;right:0;bottom:calc(100% + 6px);z-index:6;max-height:min(46vh,380px);margin:0;border:1px solid var(--acento);border-radius:8px}
  .pe-franja-lista{margin:4px 0 0;max-height:30vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-top:1px solid var(--acento);background:var(--panel)}
  .pe-franja-lista ul{list-style:none;margin:0;padding:0}
  .pe-franja-lista li{border-bottom:1px solid var(--borde)}
  .pe-franja-lista button{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;margin:0;padding:4px 6px;border:0;background:none;color:var(--texto);font-size:14px;text-align:left}
  .pe-franja-lista .simbolo-boca{width:20px;height:20px;flex:none;color:var(--acento-fuerte)}
  .pe-franja-lista .simbolo-boca .cuerpo{fill:var(--panel)}
  .pe-franja-lista b{font-variant-numeric:tabular-nums;white-space:nowrap}
  .pe-franja-lista .tipo{flex:1;min-width:0;color:var(--textoTenue);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pe-franja-lista .pe-ir{flex:none;color:var(--textoTenue)}
  .pe-franja-lista li.con-ubicar{display:flex;align-items:center}
  .pe-franja-lista li.con-ubicar>button:first-child{flex:1 1 auto;min-width:0}
  .pe-franja-lista .pe-ubicar{flex:none;width:auto;min-height:36px;margin:2px 6px 2px 0;padding:0 12px;border:1px solid var(--acento);border-radius:6px;background:var(--panel);color:var(--acento-fuerte,var(--acento));font-size:13px;font-weight:600}
  .pe-marco.pe-colocando{cursor:crosshair;outline:2px solid var(--acento);outline-offset:-2px}
  /* 17-nov (v2, JC: «hay que poder acceder a toda la info posible de proyecto de ese equipo para poder ubicarlo bien»). */
  .pe-franja-lista .pe-fr-txt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}
  .pe-franja-lista .pe-fr-l1{display:flex;align-items:baseline;gap:8px;min-width:0}
  .pe-franja-lista .pista{font-size:12px;line-height:15px;color:var(--textoSuave,var(--textoTenue));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pe-franja-lista .pista.vacia{font-style:italic}
  .pe-franja-buscar{position:sticky;top:0;z-index:1;display:block;box-sizing:border-box;width:100%;margin:0;padding:6px 8px;border:0;border-bottom:1px solid var(--borde);background:var(--panel);color:var(--texto);font:inherit;font-size:14px}
  .pe-franja-lista .pe-franja-nada{padding:8px;font-size:13px;color:var(--textoTenue)}
  .pe-ubicando .pe-ub-txt{display:flex;flex-direction:column;gap:1px}
  .pe-ubicando small{font-size:12px;line-height:15px;color:var(--textoSuave,var(--textoTenue))}
  .pe-sala-buscada{position:absolute;transform:translate(-50%,-50%);box-sizing:border-box;min-width:26px;min-height:26px;border:2px solid var(--acento);border-radius:4px;background:color-mix(in srgb,var(--acento) 16%,transparent);pointer-events:none;z-index:1;animation:peBuscada 1.2s ease-in-out infinite alternate}
  .pe-sala-buscada span{position:absolute;left:50%;bottom:calc(100% + 2px);transform:translateX(-50%);white-space:nowrap;font:700 11px/14px system-ui,sans-serif;color:var(--sobre-relleno);background:var(--acento-relleno,var(--acento));padding:0 5px;border-radius:3px}
  @keyframes peBuscada{from{background:color-mix(in srgb,var(--acento) 10%,transparent)}to{background:color-mix(in srgb,var(--acento) 26%,transparent)}}
  @media (prefers-reduced-motion:reduce){.pe-sala-buscada{animation:none}}
  .pe-propuesta{position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;box-sizing:border-box;border:2px dashed var(--acento);border-radius:50%;background:color-mix(in srgb,var(--acento) 22%,transparent);pointer-events:none;z-index:2}
  .pe-propuesta span{position:absolute;left:50%;top:calc(100% + 3px);transform:translateX(-50%);white-space:nowrap;font:700 11px/14px system-ui,sans-serif;color:var(--sobre-relleno);background:var(--acento-relleno,var(--acento));padding:0 5px;border-radius:3px}
  .pe-franja-lista .pe-propuesto,.pe-ubicar-hoja .pe-propuesto{display:block;font-size:12px;line-height:16px;color:var(--acento);font-weight:600}
  #app .pe-lienzo .marca-boca.pe-referencia{opacity:1!important;z-index:7}
  #app .pe-lienzo .marca-boca.pe-referencia .simbolo-boca{outline:2px solid var(--acento);outline-offset:3px;border-radius:50%}
  #app .pe-lienzo .marca-boca.pe-referencia .rotulo-boca{display:block}
  .pe-pistas{margin:6px 0;padding:6px 8px;border:1px solid var(--borde);border-radius:8px;background:var(--panel)}
  .pe-pistas h4{margin:0 0 4px;font-size:13px;color:var(--acento-fuerte,var(--acento))}
  .pe-pistas dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;font-size:13px;line-height:17px}
  .pe-pistas dt{color:var(--textoTenue);white-space:nowrap}
  .pe-pistas dd{margin:0;min-width:0;overflow-wrap:anywhere}
  .pe-pistas .pe-refs{display:flex;flex-wrap:wrap;gap:4px}
  .pe-pistas .pe-refs button{width:auto;min-height:30px;margin:0;padding:0 8px;font-size:12.5px}
  /* Mientras se ubica, el aviso ocupa su fila entera y el zoom baja a la siguiente (en 390 px no caben juntos). */
  .cx-plano .pe-pie.con-ubicando,.pe-pie.con-ubicando{flex-wrap:wrap}
  .pe-pie.con-ubicando .pe-ubicando{flex:1 0 100%}
  .pe-ubicando{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;min-height:36px;padding:2px 4px 2px 8px;border:1px solid var(--acento);border-radius:6px;background:var(--panel);font-size:13px;line-height:16px}
  .pe-ubicando span{flex:1;min-width:0}
  .pe-ubicando button{flex:none;width:auto;min-height:32px;margin:0;padding:0 10px}
  .pe-ubicando.con-propuesta{flex-wrap:wrap;justify-content:flex-end;padding:6px 6px 6px 8px}.pe-ubicando.con-propuesta .pe-ub-txt{flex:1 0 100%}
  .pe-ubicar-hoja{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0}
  .pe-ubicar-hoja .boton{width:auto;margin:0}
  /* TAG encima o debajo del bloque cuando a los lados no cabe (vistaPlano.colocarRotulos, opción sitios). */
  #app .pe-lienzo .marca-boca.tag-arr .rotulo-boca{left:calc(50% + var(--tag-dx,0px));top:auto;bottom:calc(100% + 1px);transform:translateX(-50%);margin:0}
  #app .pe-lienzo .marca-boca.tag-abj .rotulo-boca{left:calc(50% + var(--tag-dx,0px));top:calc(100% + 1px);transform:translateX(-50%);margin:0}
  /* Los equipos cuyo TAG no cabe con este zoom, juntos en una píldora «+N»: al tocarla, se acerca y salen sus TAG. */
  .pe-grupo{position:absolute;transform:translate(-50%,-50%);z-index:3;box-sizing:border-box;width:auto;height:14px;min-height:0;min-width:0;margin:0;padding:0 4px;border:1px solid var(--acento);border-radius:7px;background:var(--panel);color:var(--acento-fuerte,var(--acento));font:700 9px/12px system-ui,sans-serif;white-space:nowrap;box-shadow:none}
  .pe-grupo::after{content:'';position:absolute;left:50%;top:50%;width:36px;height:36px;transform:translate(-50%,-50%)}
  /* El nombre de sala con su fondo: la línea de la pared no lo atraviesa. */
  .pe-lienzo .pe-sala.ver{background:color-mix(in srgb,var(--vd-lienzo) 86%,transparent);border-radius:3px}
  .pe-fondo{display:flex;gap:6px;margin:0 0 6px}.pe-fondo button{flex:1;padding:6px 10px;border:1px solid var(--borde);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:13px}.pe-fondo button[aria-pressed=true]{background:color-mix(in srgb,currentColor 14%,transparent);font-weight:700;border-color:currentColor}.pe-fondo button:disabled{opacity:.4}
  .pe-lienzo img{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none;pointer-events:none}
  .pe-lienzo .marca-boca.azul{color:var(--pe-azul)}
  .pe-lienzo .marca-boca.azul .simbolo-boca .cuerpo{fill:color-mix(in srgb,var(--pe-azul) 22%,var(--vd-lienzo))}
  .pe-lienzo .marca-boca.azul .rotulo-boca{background:var(--pe-azul)}
  .pe-lienzo .marca-boca{width:22px;aspect-ratio:1;height:auto;line-height:0;z-index:2}
  .pe-lienzo .marca-boca::after{width:calc(100% + 16px);height:calc(100% + 16px)}
  .pe-lienzo .marca-boca .simbolo-boca{display:block;height:100%;width:100%;border-radius:0;overflow:visible;filter:drop-shadow(0 0 1px var(--vd-lienzo))}
  .pe-lienzo .marca-boca .simbolo-boca *{vector-effect:non-scaling-stroke;stroke-width:1.2px}
  /* 14-nov (JC): el contorno del bloque en el color de su estado (colorBloque.cssBloques), algo más grueso que las líneas de dentro. */
  .pe-lienzo .marca-boca .simbolo-boca .cuerpo{stroke-width:1.8px}
  #app .pe-lienzo .marca-boca .rotulo-boca{display:none}
  #app .pe-lienzo .marca-boca.con-tag .rotulo-boca{display:block}
  #app .pe-lienzo .marca-boca.tag-izq .rotulo-boca{left:auto;right:calc(100% + 2px)}
  #app .pe-lienzo .marca-boca.elegida.tag-izq .rotulo-boca{margin-left:0;margin-right:8px}
  .pe-mat.tag-izq span{left:auto;right:100%;margin-left:0;margin-right:3px}
  /* La etiqueta sin color de estado: el estado se lee en el icono y en la leyenda. */
  #app .pe-lienzo .marca-boca .rotulo-boca{font-size:var(--pe-tag,9px);background:var(--vd-lienzo,var(--panel));box-shadow:0 0 0 1px color-mix(in srgb,var(--borde) 70%,transparent);border-radius:3px;color:var(--acento-fuerte);padding:0 3px;font-weight:700;text-shadow:0 0 2px var(--vd-lienzo)}
  .pe-lienzo .marca-boca.revisar .simbolo-boca{outline:1.5px dashed currentColor;outline-offset:2px}
  .pe-lienzo .marca-boca.elegida{width:30px!important;z-index:8;opacity:1!important}
  /* 14-nov (JC: «al pulsar el equipo no resalta en el plano»): el pulsado, mientras su hoja está abierta, conserva el color de su
     estado con el contorno grueso y el interior más cargado, y lleva un halo teal en su silueta que late (sin recuadro). */
  .pe-lienzo .marca-boca.elegida .simbolo-boca{outline:none;transform:none;filter:drop-shadow(0 0 1.5px var(--acento)) drop-shadow(0 0 5px color-mix(in srgb,var(--acento) 70%,transparent));animation:peLatido 1.4s ease-in-out infinite alternate}
  .pe-lienzo .marca-boca.elegida .simbolo-boca *{stroke-width:2.2px}
  .pe-lienzo .marca-boca.elegida .simbolo-boca .cuerpo{stroke-width:3px;fill-opacity:.45}
  @keyframes peLatido{from{filter:drop-shadow(0 0 1.5px var(--acento)) drop-shadow(0 0 4px color-mix(in srgb,var(--acento) 70%,transparent))}to{filter:drop-shadow(0 0 2.5px var(--acento)) drop-shadow(0 0 10px color-mix(in srgb,var(--acento) 85%,transparent))}}
  @media (prefers-reduced-motion:reduce){.pe-lienzo .marca-boca.elegida .simbolo-boca{animation:none}}
  #app .pe-lienzo .marca-boca.elegida .rotulo-boca{display:block;z-index:9;font-size:12px;color:var(--sobre-relleno);background:var(--acento-relleno);text-shadow:none;padding:1px 5px;border-radius:3px;margin-left:8px}
  .pe-lienzo:has(.marca-boca.elegida) .marca-boca:not(.elegida),.pe-lienzo:has(.pe-mat.elegida) .marca-boca{opacity:.6}
  .pe-iconos{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:12px;color:var(--textoTenue)}
  .pe-iconos span{display:inline-flex;align-items:center;gap:4px}
  .pe-iconos svg{height:16px;width:16px;color:var(--acento)}
  .pe-iconos svg .cuerpo{fill:var(--panel)}
  .pe-hoja .pesConjunto{margin:6px 0 4px;padding:6px 8px;border-left:3px solid var(--acento);background:var(--acento-suave);border-radius:4px;font-size:14px}
  .pe-hoja .pesConjuntoTit{margin:0 0 2px;overflow-wrap:anywhere}
  .pe-hoja .pesConjunto .pesTablaFicha{width:100%;border-collapse:collapse}
  .pe-hoja .pesConjunto td{padding:3px 6px 3px 0;vertical-align:middle;border:0;overflow-wrap:anywhere}
  .pe-hoja .pesConjunto td small{display:block;color:var(--textoTenue);font-size:12.5px}
  .pe-hoja .pesConjunto .pesCjSigla{width:1%;white-space:nowrap;font-weight:700;color:var(--textoTenue)}
  .pe-hoja .pesConjunto .pesAccion{width:1%;white-space:nowrap;text-align:right}
  .pe-hoja .pesConjunto tr.actual td{font-weight:600}
  .pe-hoja .pesConjunto .botonMini{min-height:36px;min-width:64px;padding:0 10px;border:0;border-radius:8px;background:var(--panel);color:var(--acento-fuerte);font-size:14px;font-weight:600}
  .pe-hoja .pesConjuntoNota{display:block;color:var(--textoTenue);font-size:12.5px}
  .pe-sin-plano{padding:14px;border:1px dashed var(--borde);border-radius:10px;background:var(--panel);font-size:14px}
  .pe-visor{position:relative}
  /* Los nombres de sala, como texto encima del plano: nítidos a cualquier zoom
     aunque la imagen que baja al móvil sea ligera. Solo las que caben en su sala: las pequeñas, al acercar. */
  .pe-sala{position:absolute;transform:translate(-50%,-50%);font:600 11px/14px system-ui,sans-serif;color:var(--texto);letter-spacing:.01em;padding:0 2px;border-radius:3px;background:color-mix(in srgb,var(--vd-lienzo,var(--papel)) 90%,transparent);white-space:nowrap;pointer-events:none;display:none;z-index:1;text-shadow:0 0 2px var(--papel),0 0 2px var(--papel)}
  .pe-sin-nombres{margin:4px 0 0;font-size:12px;color:var(--textoSuave)}
  /* 13-nov (JC): finos y en gris claro, por debajo de los TAG; solo los que caben y no chocan (colocarTags). */
  .pe-lienzo .pe-sala.ver{display:block;text-align:center}
  .pe-sala small{display:block;font:500 9.5px/11px system-ui,sans-serif;color:var(--textoSuave,var(--texto));font-variant-numeric:tabular-nums;letter-spacing:0}
  /* 13-nov (JC): el − / Entero / + en su franja, bajo el plano y fuera de él: no tapa nada. */
  .pe-zoom{display:flex;justify-content:flex-end;gap:4px;margin:4px 0 0}
  .pe-zoom button{width:auto;flex:none;min-width:44px;min-height:40px;margin:0;font-size:20px;line-height:1;padding:0 10px}
  .pe-zoom button[data-pe-zoom="0"]{font-size:14px}
  .cx-plano .pe-marco .marca-boca.mal{color:var(--mal)} .cx-plano .pe-sin-ifc{margin:2px 0 6px;font-size:12px}
  .cx-plano .pe-zoom{gap:4px}.cx-plano .pe-zoom button{min-width:34px;min-height:34px;font-size:16px;padding:0 6px}.cx-plano .pe-zoom button[data-pe-zoom="0"]{font-size:12px}
  .pe-elegido{margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--panel);box-shadow:var(--sombra)}
  .pe-hoja{position:fixed;left:8px;right:8px;bottom:calc(var(--hueco-barra,104px) + 4px + env(safe-area-inset-bottom,0px));z-index:12;max-height:42vh;overflow:auto;padding:10px 12px 12px;border-radius:14px;background:var(--panel);box-shadow:0 -2px 14px rgba(8,50,60,.28);border:1px solid var(--borde)}
  .pe-hoja[hidden]{display:none}
  /* 14-nov (JC): incidencia abierta = naranja (tokens --incidencia / --incidenciaTexto, incidenciaPlano.js) con «!»;
     arriba de la hoja, sus incidencias con enlace (panelEquipoPlano.incidenciasHtml, la del escritorio). */
  .pe-lienzo .marca-boca .pe-inc{position:absolute;right:-5px;top:-5px;width:13px;height:13px;border-radius:50%;background:var(--incidencia);color:var(--blanco);font:900 10px/13px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 1.5px var(--panel);pointer-events:none}
  .pe-hoja .pesIncEq{margin:6px 0 4px;padding:6px 8px;border-left:3px solid var(--incidencia);background:color-mix(in srgb,var(--incidencia) 9%,var(--panel));border-radius:4px;font-size:14px}
  .pe-hoja .pesIncEqTit{display:flex;align-items:center;gap:6px;margin:0 0 2px;color:var(--incidenciaTexto)}
  .pe-hoja .pesPunto.incidencia{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--incidencia);color:var(--blanco);font:900 11px/16px system-ui,sans-serif;text-align:center}
  .pe-hoja .pesIncEqTabla{width:100%;border-collapse:collapse}
  .pe-hoja .pesIncEqTabla td{padding:2px 6px 2px 0;vertical-align:middle;border:0;overflow-wrap:anywhere}
  .pe-hoja .pesIncEqTabla td:first-child{white-space:nowrap;width:1%}
  .pe-hoja .pesIncEqEstado{white-space:nowrap;width:1%;color:var(--textoTenue);text-align:right;font-size:13px}
  .pe-hoja .pesIncEnlace{min-height:40px;padding:0 4px 0 0;border:0;background:none;color:var(--incidenciaTexto);font-weight:700;text-decoration:underline;font-size:14px}
  .pe-hoja .pesIncEqDonde{display:block;color:var(--incidenciaTexto);font-size:13px}
  .pe-leyenda .pe-chip-inc{border-color:var(--incidencia);color:var(--incidenciaTexto)}
  .pe-leyenda .pe-chip-inc[aria-pressed="false"]{opacity:1}
  .pe-leyenda .pe-chip-inc[aria-pressed="true"]{background:color-mix(in srgb,var(--incidencia) 16%,var(--panel));font-weight:700}
  .pe-leyenda .pe-chip-res{border-color:var(--incResuelta);color:var(--incResuelta)}
  .pe-leyenda .pe-chip-res[aria-pressed="true"]{background:color-mix(in srgb,var(--incResuelta) 14%,var(--panel))}
  .pe-lienzo .marca-boca.con-incres .pe-inc{background:var(--incResuelta)}
  .pe-leyenda .pe-chip-ter{border-color:var(--incTerceros);color:var(--incTerceros)}
  .pe-leyenda .pe-chip-ter[aria-pressed="true"]{background:color-mix(in srgb,var(--incTerceros) 14%,var(--panel))}
  .pe-lienzo .marca-boca.con-incter .pe-inc{background:var(--incTerceros)}
  .pe-hoja .pesIncEq.terceros{border-left-color:var(--incTerceros);background:color-mix(in srgb,var(--incTerceros) 8%,var(--panel))}
  .pe-hoja .pesIncEq.terceros .pesIncEqTit,.pe-hoja .pesIncEq.terceros .pesIncEnlace,.pe-hoja .pesIncEq.terceros .pesIncEqDonde{color:var(--incTerceros)}
  .pe-hoja .pesPunto.incTerceros{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--incTerceros);color:var(--blanco);font:900 11px/16px system-ui,sans-serif;text-align:center}
  .pe-hoja .pesIncEq.resuelta{border-left-color:var(--incResuelta);background:color-mix(in srgb,var(--incResuelta) 8%,var(--panel))}
  .pe-hoja .pesIncEq.resuelta .pesIncEqTit,.pe-hoja .pesIncEq.resuelta .pesIncEnlace,.pe-hoja .pesIncEq.resuelta .pesIncEqDonde{color:var(--incResuelta)}
  .pe-hoja .pesPunto.incResuelta{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--incResuelta);color:var(--blanco);font:900 11px/16px system-ui,sans-serif;text-align:center}
  /* Las hojas de commissioning del equipo (15-nov): filas altas, toda la fila se toca; estado con el color de siempre. */
  .pe-hojas-cx{margin:8px 0 2px}
  .pe-hojas-cx h4{margin:0 0 2px;font-size:13px;font-weight:600;color:var(--acento);border-bottom:1px solid var(--acento-vivo);padding-bottom:3px}
  .pe-hojas-cx .pesTablaFicha{width:100%;border-collapse:collapse;font-size:14px}
  .pe-hojas-cx .pesTablaFicha tr{cursor:pointer}
  .pe-hojas-cx .pesTablaFicha th{text-align:left;font-weight:600;padding:7px 8px 7px 0;border-bottom:1px solid rgba(15,23,42,.08);vertical-align:middle}
  .pe-hojas-cx .pesTablaFicha td{padding:7px 0;border-bottom:1px solid rgba(15,23,42,.08);vertical-align:middle;font-size:13px}
  .pe-hojas-cx .pesTablaFicha td small,.pe-hojas-cx .pesTablaFicha th small{display:block;color:var(--textoTenue);font-size:12px;font-weight:400}
  .pe-hojas-cx .pesAccion{width:1%;text-align:right;white-space:nowrap;padding-left:6px}
  .pe-hojas-cx .botonMini{min-height:38px;min-width:68px;padding:0 10px;border:0;border-radius:8px;background:var(--acento-suave);color:var(--acento-fuerte);font-size:14px;font-weight:600}
  .pe-hojas-cx .pesTono.bien{color:var(--bien);font-weight:600} .pe-hojas-cx .pesTono.info{color:var(--acento);font-weight:600} .pe-hojas-cx .pesTono.mal{color:var(--mal);font-weight:600}
  .pe-hojas-cx .pesVacio{color:var(--textoTenue)}
  /* 15-nov (JC, capturas del plano): la hoja del equipo abre a media altura y se pliega con el asa (altoHoja); la cabecera
     (TAG, estado, X) y el resumen de documentos y garantía van fijos arriba aunque se desplace lo de dentro. */
  .pe-hoja{padding-top:0;overscroll-behavior:contain}
  .pe-hoja-fija{position:sticky;top:0;z-index:3;background:var(--panel);padding:0 0 4px;margin:0 0 2px;border-bottom:1px solid color-mix(in srgb,var(--borde) 60%,transparent)}
  .pe-asa{display:flex;justify-content:center;align-items:center;width:100%;min-height:22px;margin:0;padding:6px 0 4px;border:0;background:none;cursor:grab;touch-action:none}
  .pe-asa::before{content:"";display:block;width:40px;height:4px;border-radius:2px;background:color-mix(in srgb,var(--textoTenue) 55%,transparent)}
  .pe-resumen{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;width:100%;min-height:32px;margin:3px 0 0;padding:2px 0;border:0;background:none;color:var(--texto);font-size:13.5px;text-align:left;cursor:pointer}
  .pe-resumen b{font-variant-numeric:tabular-nums}
  .pe-resumen .mal{color:var(--mal);font-weight:600}.pe-resumen .bien{color:var(--bien);font-weight:600}
  .pe-resumen .flecha{margin-left:auto;color:var(--acento);font-weight:700}
  .pe-hoja.plegada .pe-hoja-resto{display:none}
  .pe-hoja.arrastrando{transition:none!important}
  .pe-hoja .pe-ficha-completa{display:block;width:100%;min-height:44px;margin:8px 0 2px;font-size:15px;font-weight:700}
  /* 14-nov: con la hoja abierta el plano acaba encima de ella; el zoom con botones se esconde mientras (se pellizca). */
  .cx-plano:has([data-pe-hoja]:not([hidden])) .pe-pie,.cx-plano:has([data-pe-hoja]:not([hidden])) .pe-leyenda{display:none}
  .cx-plano .pe-hoja{max-height:40vh}
  .cx-plano .pe-hoja .fila-principal strong{flex:1 1 auto;min-width:0;font-size:16px;line-height:1.25;overflow-wrap:anywhere}
  .cx-plano .pe-hoja .fila-principal .chip{flex:none;white-space:nowrap;font-size:13px}
  .cx-plano .pe-hoja .pe-sala-cod{display:inline;margin-left:6px}
  .cx-plano .pe-hoja .sub{margin-top:2px}
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
    s.textContent = ESTILO + (CB ? `.pe-lienzo .marca-boca[class*="bq-"]{color:var(--acento-fuerte)}${CB.cssBloques('.pe-lienzo .marca-boca')}.pe-franja .marca-boca[class*="bq-"]{color:var(--acento-fuerte)}${CB.cssBloques('.pe-franja .marca-boca')}${IP ? IP.css('.pe-lienzo .marca-boca.con-inc', '.pe-lienzo .marca-boca.con-incres', '.pe-lienzo .marca-boca.con-incter') : ''}${RD ? Object.entries(RD.COLOR_PLANO).map(([k, hex]) => `.pe-lienzo .marca-boca.bq-${k},.pe-franja .marca-boca.bq-${k}{color:#262b38}.pe-lienzo .marca-boca.bq-${k} .cuerpo,.pe-franja .marca-boca.bq-${k} .cuerpo{fill:${hex};fill-opacity:1}.bq-punto-${k}{background:${hex}}`).join('') : ''}:where(.pe-punto[class*="bq-punto-"]){border:1px solid rgba(38,43,56,.35)}` : ''); /* :where: el discontinuo de «no instalado» (colorBloque) manda. */
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
  /* La ficha de un equipo de otra planta (para el plano que comparten), entre las plantas ya cargadas. */
  const fichaDeOtra = (id, p) => {
    for (const x of plantas()) if (x !== p && !x.parcial) { const e = (x.equipos || []).find((q) => q.id === id); if (e) return e; }
    return null;
  };
  const vistaIfc = (p) => {
    if (!p || !p.ifc || p.parcial || !usaModelo(p)) return p;
    const ya = vistas.get(p);
    if (ya) return ya;
    const pos = p.ifc.pos || {};
    /* 14-nov: los de la franja «sin sala» no se pintan sobre el dibujo (a 390 px se pisaban): van en su franja bajo el plano. */
    const deFranja = new Set(p.ifc.franja || []);
    /* 17-nov: quién y cuándo lo colocó a mano, y si su sitio es el bloque del modelo (ese no se mueve a mano). */
    const aMano = p.ifc.mano || {}; const fijos = new Set(p.ifc.fijos || []);
    /* 17-nov (JC: «Desde los IFCs deberías ser capaz de ubicar los equipos»): el casado solo con el modelo y lo propuesto. */
    const prop = p.ifc.propuestos || {}; const solo = p.ifc.desdeIfc || {};
    const delIfc = (e) => ({ ...(prop[e.id] ? { propuesto: prop[e.id] } : {}), ...(solo[e.id] ? { desdeIfc: solo[e.id] } : {}) });
    /* 18-nov (JC: web y móvil, lo mismo): los que el modelo dibuja en el plano de otra planta se ven allí, no aquí. */
    const enOtro = new Set(p.ifc.enOtroPlano || []);
    /* …y los de otra planta que el modelo dibuja en este (S1/S2 comparten plano con N20/N10): su ficha, la de su planta. */
    const deOtra = (p.ifc.deOtraPlanta || []).map((id) => fichaDeOtra(id, p)).filter(Boolean);
    const propios = p.equipos.filter((e) => !enOtro.has(e.id));
    const equipos = (deOtra.length ? propios.concat(deOtra) : propios).map((e) => (pos[e.id] ? { ...e, x: pos[e.id][0], y: pos[e.id][1], mano: false, revisar: false, w: 0, h: 0, ...(deFranja.has(e.id) ? { franja: true } : {}), ...(aMano[e.id] ? { aMano: aMano[e.id] } : {}), ...(fijos.has(e.id) ? { delModelo: true } : {}), ...delIfc(e) } : { ...e, x: null, y: null, mano: false, revisar: false, ...delIfc(e) }));
    const sinUbicar = equipos.filter((q) => q.x === null).map((q) => ({ id: q.id, tag: q.tag, familia: q.familia, sala: q.sala, icono: q.icono }));
    const v = { ...p, plano: p.ifc.plano, equipos, sinUbicar, materiales: (p.materiales || []).map((m) => ({ ...m, x: null, y: null })), faltas: [], esIfc: true,
      cuentas: { ...p.cuentas, ...((enOtro.size || deOtra.length) && EEP ? (({ bloques, conIncidencia, incResuelta }) => ({ bloques, conIncidencia, incResuelta }))(EEP.cuentas(equipos)) : {}), enPlano: equipos.length - sinUbicar.length, sinUbicar: sinUbicar.length, revisar: 0 } };
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
     el teléfono no se baja la obra entera (cada planta son ~0,6-0,9 MB en una obra grande). */
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

  /* El conjunto en la ficha (18-nov, JC: «al pulsar en un equipo de un conjunto, lo que se tiene que mostrar en cualquier app
     es el conjunto»): la misma pieza que el panel de la web (panelEquipoPlano.conjuntoAlPulsar), con su nombre y cada unidad con
     su «Abrir» (data-pe-ver: la lleva a su sitio en el plano o a su ficha). */
  function conjuntoHtml(e) {
    const P = PEP();
    return P && P.conjuntoAlPulsar ? P.conjuntoHtml(P.conjuntoAlPulsar(e), { atributo: 'data-pe-ver' }) : '';
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

  /* El chip «Con incidencia N» (14-nov, JC): cuenta los equipos de la planta con incidencia SIN CERRAR del registro de
     incidencias (IP.recuento, como el escritorio) y, pulsado, deja solo esos en el plano. Sin ninguno, solo sale pulsado. */
  function chipInc(p) {
    const n = IP ? IP.recuento(p.equipos) : p.equipos.filter(conInc).length;
    if (!n && !soloInc) return chipTer(p) + chipRes(p);
    const nombre = IP ? IP.NOMBRE : 'Con incidencia';
    return `<button class="pe-chip-inc" data-pe-solo-inc aria-pressed="${soloInc}" title="${esc(nombre)}: ${soloInc ? 'ver todos' : 'ver solo estos'}"><i class="pe-punto bq-punto-incidencia"></i>${esc(nombre)} <b>${cifra(n)}</b></button>${chipTer(p)}${chipRes(p)}`;
  }
  /* «Incidencia de terceros N» (18-nov): abierta e imputable a otro industrial o al cliente (IP.recuentoTerceros); pulsado, filtra. */
  function chipTer(p) {
    const n = IP && IP.recuentoTerceros ? IP.recuentoTerceros(p.equipos) : 0;
    if (!n && !soloTer) return '';
    return `<button class="pe-chip-inc pe-chip-ter" data-pe-solo-ter aria-pressed="${soloTer}" title="${esc(IP.NOMBRE_TERCEROS)}: ${soloTer ? 'ver todos' : 'ver solo estos'}"><i class="pe-punto bq-punto-incTerceros"></i>${esc(IP.NOMBRE_TERCEROS)} <b>${cifra(n)}</b></button>`;
  }
  /* «Resuelta, faltan datos N» (15-nov): cerrada y sin toma de datos después del cierre (IP.recuentoResueltas); pulsado, filtra. */
  function chipRes(p) {
    const n = IP ? IP.recuentoResueltas(p.equipos) : 0;
    if (!n && !soloRes) return '';
    return `<button class="pe-chip-inc pe-chip-res" data-pe-solo-res aria-pressed="${soloRes}" title="${esc(IP.NOMBRE_RESUELTA)}: ${soloRes ? 'ver todos' : 'ver solo estos'}"><i class="pe-punto bq-punto-incResuelta"></i>${esc(IP.NOMBRE_RESUELTA)} <b>${cifra(n)}</b></button>`;
  }
  /* Arriba de la hoja, sus incidencias abiertas, cada una con su enlace: el mismo trozo del panel del escritorio. */
  function incidenciasHtml(e) {
    const P = window.PANEL_EQUIPO_PLANO;
    return P && P.incidenciasHtml ? P.incidenciasHtml(e) : '';
  }
  /* El enlace de una incidencia la abre en Incidencias › Reparaciones (reparaciones.js lee «cx.abrir» al entrar). */
  function abrirIncidencia(id) {
    try { sessionStorage.setItem('cx.abrir', id); } catch { /* sin almacén */ }
    location.hash = 'reparaciones';
  }

  /* 17-nov: en la hoja, «Ubicar en el plano» si está por ubicar y «Mover» si ya tiene sitio (salvo el bloque del modelo). */
  function ubicarHojaHtml(e, p) {
    const dicho = e.aMano && UB() ? `<span class="sub tenue" data-pe-a-mano>${esc(UB().dichoAMano(e.aMano))}</span>`
      : e.desdeIfc ? `<span class="sub tenue" data-pe-desde-ifc>Ubicado desde el IFC: ${esc(e.desdeIfc.motivo || 'casado con el modelo')}</span>` : '';
    if (!puedeUbicarAqui(p) || e.delModelo) return dicho ? `<div class="pe-ubicar-hoja">${dicho}</div>` : '';
    if (ubicando && ubicando.id === e.id) return `<div class="pe-ubicar-hoja">${dicho}<span class="sub" data-pe-ubicando-hoja>Ubicando: toca en el plano su sitio.</span></div>`;
    const porUbicar = e.x === null || e.franja;
    const prop = porUbicar && e.propuesto ? `<span class="sub pe-propuesto" data-pe-propuesto-hoja>${esc(dichoPropuesto(e.propuesto))}</span>` : '';
    return `<div class="pe-ubicar-hoja">${dicho}${prop}<button type="button" class="boton${porUbicar ? '' : ' secundario'}" data-pe-ubicar="${esc(e.id)}">${e.propuesto && porUbicar ? 'Ver la propuesta del IFC' : porUbicar ? 'Ubicar en el plano' : 'Mover en el plano'}</button></div>`;
  }

  /* 17-nov (v2): las pistas de un equipo por ubicar (ubicarEnPlano.pistaDe, servidas por la lista): solo lo que la base trae. */
  const pistaCorta = (x) => (UB() && UB().lineaPista ? UB().lineaPista(x) : '');
  const casaFranja = (x) => !franjaFiltro.trim() || !UB() || !UB().casaBusqueda || UB().casaBusqueda(x, franjaFiltro, tipoDe(x));
  /* El que se está ubicando: su sala en el plano del modelo (si está) y los ya ubicados que sirven de referencia. */
  function buscado(p) {
    if (!ubicando || !p || !UB() || !UB().hermanos) return null;
    const e = p.equipos.find((q) => q.id === ubicando.id);
    if (!e) return null;
    const fuera = p.equipos.filter((q) => q.franja || q.x === null).map((q) => q.id);
    const hs = UB().hermanos(p.equipos, e, { fuera });
    const pos = (id) => { const q = p.equipos.find((z) => z.id === id); return q ? [q.x, q.y] : null; };
    const sala = p.esIfc && p.plano ? UB().salaEnPlano(p.plano.salas || [], e, { cerca: hs.map((h) => pos(h.id)) }) : null;
    return { e, hs, sala, refs: new Set(hs.map((h) => h.id)) };
  }
  /* «Propuesto desde el IFC · mismo modelo (hay 2 más iguales)». */
  const dichoPropuesto = (x) => `Propuesto desde el IFC · ${x.motivo || 'casado con el modelo'}${x.otros ? ` (hay ${x.otros} más ${x.otros === 1 ? 'igual' : 'iguales'})` : ''}`;
  const propuestaDe = (p) => (p && ubicando && !guardandoSitio ? ((p.equipos || []).find((q) => q.id === ubicando.id) || {}).propuesto || null : null);
  function dichoBuscado(b) {
    if (!b) return '';
    if (b.e.propuesto) return `${dichoPropuesto(b.e.propuesto)}: confírmalo o toca su sitio en el plano.`;
    const pi = b.e.pista || {};
    const ue = b.e.papel === 'UE';
    const nombreSala = pi.salaGris ? [pi.salaGris.nombre, pi.salaGris.codigo].filter(Boolean).join(' ') : '';
    const refs = b.hs.length ? `${b.hs.slice(0, 2).map((h) => h.tag).join(', ')}${b.hs.length > 2 ? ` y ${b.hs.length - 2} más` : ''}` : '';
    if (b.sala) return `${ue ? 'Da servicio a' : 'Su sala'}: ${nombreSala || b.sala.t}, marcada en el plano${refs ? ` · referencia: ${refs}` : ''}.`;
    if (refs) return `${nombreSala ? `${nombreSala} no está en el modelo. ` : ''}Marcados de referencia: ${refs}.`;
    const linea = pistaCorta(b.e);
    return linea ? `${linea}${nombreSala ? ' (sala no está en el modelo)' : ''}.` : 'Sin sala ni referencias en la base: mira su ficha.';
  }
  function pistasHtml(e, p) {
    const pi = e && e.pista;
    const porUbicar = e && (e.x === null || e.franja);
    if (!pi || !porUbicar) return '';
    const filas = [];
    const fila = (k, v) => { if (v) filas.push(`<dt>${esc(k)}</dt><dd>${v}</dd>`); };
    if (pi.salaGris) fila(e.papel === 'UE' ? 'Da servicio a' : 'Sala (arquitectura)', `${esc(pi.salaGris.nombre || '')} <span class="cifra">${esc(pi.salaGris.codigo)}</span>${pi.salaGris.estado ? ` <span class="tenue">(${esc(pi.salaGris.estado)})</span>` : ''}`);
    if (pi.codSala) fila('Código de sala', `<span class="cifra">${esc(pi.codSala)}</span>`);
    fila('Zona', pi.zona ? esc(pi.zona) : '');
    for (const s of pi.sirve || []) fila(s.k, esc(s.v));
    fila('Denominación', pi.denominacion ? esc(pi.denominacion) : '');
    const b = ubicando && ubicando.id === e.id ? buscado(p) : null;
    const hs = b ? b.hs : (UB() && UB().hermanos ? UB().hermanos(p.equipos, e, { fuera: p.equipos.filter((q) => q.franja || q.x === null).map((q) => q.id) }) : []);
    if (hs.length) fila('Referencia', `<span class="pe-refs">${hs.map((h) => `<button type="button" class="boton secundario" data-pe-ir-ref="${esc(h.id)}" title="${esc(h.motivo)}">${esc(h.tag)}</button>`).join('')}</span>`);
    if (pi.origen) fila('Origen', esc([pi.origen.tipo, pi.origen.nombre].filter(Boolean).join(' · ')));
    if (pi.partida) fila('Partida', `<span class="cifra">${esc(pi.partida.codigo)}</span> ${esc(pi.partida.resumen || '')}`);
    else if (pi.partidas) fila('Partida', `${cifra(pi.partidas)} partidas posibles con su modelo`);
    if (pi.compra) {
      const c = pi.compra;
      const t = esc([c.pedido && `Pedido ${c.pedido}`, c.proveedor, c.albaran && `albarán ${c.albaran}${c.fecha ? ` (${c.fecha.split('-').reverse().join('/')})` : ''}`].filter(Boolean).join(' · '));
      fila('Compra', c.enlace ? `<a href="${esc(c.enlace)}" target="_blank" rel="noopener">${t} ↗</a>` : t);
    }
    fila('Notas', pi.notas ? esc(pi.notas) : '');
    return filas.length ? `<div class="pe-pistas" data-pe-pistas><h4>Para encontrarlo</h4><dl>${filas.join('')}</dl></div>` : '';
  }

  function hojaHtml(p) {
    const e = equipoElegido();
    if (!e) return '';
    const que = [e.tipo, [e.marca, e.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    /* 15-nov (JC): verde y «completo» no son lo mismo —el verde también es «en marcha»—; con algo pendiente se dice qué. */
    const leFalta = e.falta && e.falta.length ? `${e.falta.slice(0, 2).map(esc).join(', ')}${e.falta.length > 2 ? ` y ${e.falta.length - 2} más` : ''}` : '';
    const falta = e.color === 'verde' && e.completo !== false ? 'Commissioning completo.'
      : e.color === 'verde' ? `En marcha.${leFalta ? ` Para cerrar el Cx le falta: ${leFalta}.` : ''}`
        : (leFalta ? `Le falta: ${leFalta}.` : '');
    const rol = e.conjunto ? `${e.papel === 'UE' ? 'Exterior' : 'Interior'} de ${esc(e.conjunto)}` : '';
    const acc = Array.isArray(e.acciones) ? e.acciones : [];
    /* 15-nov (JC, capturas del fan coil y la UTA): la cabecera con TAG, estado y X, modelo, sala y el resumen de documentos y
       garantía van en un bloque fijo arriba de la hoja: se ven siempre, se desplace lo que se desplace lo de dentro. */
    return `<div class="pe-hoja-fija" data-pe-hoja-fija>${ASA}<div class="fila-principal"><strong class="cifra">${e.papel ? `<em>${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</strong>
        <span class="chip" title="${esc(nombreBloque(e))}"><i class="pe-punto bq-punto-${bq(e)}"></i> ${esc(compacto ? (enMarchaSinCerrar(e) ? 'En marcha' : CORTO[bq(e)] || NOMBRE[bq(e)]) : nombreBloque(e))}</span>
        <button class="cierra" data-pe-cerrar aria-label="Cerrar">×</button></div>
      <div class="sub">${que ? esc(que) : ''}</div>
      <div class="sub">${salaHtml(e.sala)}${p.planta ? ` <span class="tenue">· ${esc(p.planta)}</span>` : ''}</div>
      ${resumenDocsHtml(e)}</div>
      <div class="pe-hoja-resto">
      ${incidenciasHtml(e)}
      ${e.miembros && e.miembros.length > 1 ? conjuntoHtml(e) : ''}
      ${ubicarHojaHtml(e, p)}
      ${pistasHtml(e, p)}
      ${falta ? `<div class="falta">${falta}</div>` : ''}
      ${hojasCxHtml(e)}
      ${e.marcasDF && e.marcasDF.ok && window.RECEPCION_DF ? window.RECEPCION_DF.htmlPanel(e.marcasDF) : ''}
      ${datos.conCommissioning ? '<button class="boton pe-ficha-completa" data-pe-accion="equipo">Ficha completa ›</button>' : ''}
      ${e.miembros && e.miembros.length > 1 ? '' : (rol ? `<div class="sub">${rol}</div>` : '')}
      ${documentosEquipoHtml(e)}
      ${window.PLANO_FOTOS ? window.PLANO_FOTOS.hueco(e) : ''}
      ${p.plano && e.x === null ? '<div class="sub tenue">No está en el plano.</div>' : ''}
      ${vidaHtml(e)}
      ${acc.length && !(Array.isArray(e.tomas) && e.tomas.length) ? `<div class="pe-acciones">${acc.map((a) => `<button class="boton${a.id === 'datos' ? '' : ' secundario'}" data-pe-accion="${esc(a.id)}">${esc(a.texto)}</button>`).join('')}</div>` : ''}
      ${!datos.conCommissioning && datos.puedeEditar === false ? '<div class="sub tenue">Solo lectura.</div>' : ''}</div>`;
  }

  /* 15-nov (JC: «los documentos y la garantía no se ven sin desplazar»): una línea bajo modelo y sala con «Docs 3/5 · Garantía
     hasta dd/mm/aaaa» (o «Garantía: falta»); al tocarla, la hoja se desplaza hasta los documentos. Cuenta las mismas filas
     que la tabla de documentos (panelEquipoPlano.filasDocumentos), sin las que no aplican a su tipo. */
  function resumenDocs(e) {
    const P = PEP();
    if (!e || (!e.fichaLista && e.documentos === undefined)) return null;
    const filas = P && P.filasDocumentos ? P.filasDocumentos({ pesada: pesadaDe(e) }).filter((f) => f.estado !== 'noAplica') : (e.documentos || []).map(() => ({ estado: 'doc' }));
    const hay = filas.filter((f) => f.estado === 'doc' || (f.estado === 'hoja' && f.hecha)).length;
    const g = ((e.vida && e.vida.bloques) || []).find((b) => b.id === 'garantia');
    const celda = (k) => { const f = g && (g.filas || []).find(([n]) => n === k); return f && f[1] && f[1].texto ? f[1].texto : ''; };
    const hasta = celda('Hasta');
    return { hay, total: filas.length, garantia: hasta ? `hasta ${hasta}` : '' };
  }
  function resumenDocsHtml(e) {
    const r = resumenDocs(e);
    if (!r) return '<div class="pe-resumen tenue" data-pe-resumen>Docs y garantía: cargando…</div>';
    const docs = r.total ? `Docs <b class="${r.hay < r.total ? 'mal' : 'bien'}">${cifra(r.hay)}/${cifra(r.total)}</b>` : 'Docs <b>—</b>';
    const gar = r.garantia ? `Garantía ${esc(r.garantia)}` : 'Garantía: <span class="mal">falta</span>';
    return `<button type="button" class="pe-resumen" data-pe-resumen aria-label="Ver documentos y garantía">${docs}<span class="tenue">·</span>${gar}<span class="flecha" aria-hidden="true">›</span></button>`;
  }
  /* Lleva la hoja hasta los documentos (o la garantía si no hay tabla de documentos), abierta del todo. */
  function irADocs() {
    const h = $raiz && $raiz.querySelector('[data-pe-hoja]');
    if (!h) return;
    if (estadoHoja !== 'completa') { estadoHoja = 'completa'; altoHoja(h); ajustarMarco(); }
    const destino = h.querySelector('.pe-docs') || h.querySelector('.pe-vida');
    const fija = h.querySelector('.pe-hoja-fija');
    if (destino) h.scrollTop = Math.max(0, destino.offsetTop - (fija ? fija.offsetHeight : 0) - 4);
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
  /* Lo que la tabla de documentos sabe del equipo: sus PDF y sus hojas de la app (15-nov: «Ver hoja» si no hay PDF). */
  const pesadaDe = (e) => ({ documentos: e.documentos || [], tomas: Array.isArray(e.tomas) ? e.tomas : [] });
  /* 15-nov (JC, nota 14ee6a75: «cuando en Cx pulso un equipo del mapa, debe salir … las hojas del check list, Toma de Datos de
     Puesta en Marcha, Estanqueidad, Balanceo de Caudales… lo más importante del módulo»): sus hojas, las que pide su tipo, con su
     estado y un toque para abrirla y rellenarla. La tabla es la del panel del escritorio (panelEquipoPlano.tomasHtml). */
  function hojasCxHtml(e) {
    const P = PEP();
    if (!P || !datos || !datos.conCommissioning) return '';
    if (e.tomas === undefined) return '<div class="pe-hojas-cx" data-pe-hojas><p class="tenue">Cargando sus hojas…</p></div>';
    if (!e.tomas.length) return '';
    return `<div class="pe-hojas-cx" data-pe-hojas>${P.tomasHtml({ pesada: { tomas: e.tomas }, abrirTomas: true }).replace('<h4>Toma de datos</h4>', '<h4>Hojas de commissioning</h4>')}</div>`;
  }
  function abrirTomaEquipo(i) {
    const P = PEP(); const e = equipoElegido();
    const t = e && Array.isArray(e.tomas) ? e.tomas[i] : null;
    const a = P && t ? P.accionToma(t) : null;
    if (a) irAlEquipo(a);
  }
  function documentosEquipoHtml(e) {
    const P = PEP();
    if (!P) return (e.documentos || []).length ? `<div class="pe-enlaces">${e.documentos.map(enlaceDoc).join('')}</div>` : '';
    if (!e.fichaLista && e.documentos === undefined) return '';
    const h = P.documentosHtml({ pesada: pesadaDe(e) });
    return `<div class="pe-docs">${h}</div>`;
  }
  function abrirDocEquipo(i) {
    const P = PEP(); const e = equipoElegido();
    if (!P || !e) return;
    const f = P.filasDocumentos({ pesada: pesadaDe(e) })[i];
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
    /* El fondo del modelo sí tiene escala: cada unidad del svg mide plano.res metros (0,02 en una obra real). Tamaño real del equipo. */
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
    /* 18-nov-2026 (JC): sus tres papeles —Marcado CE, ficha técnica y manual—, sin puesta en marcha; valen para su modelo
       (o su tipo, sin modelo). Se suben desde la ficha del escritorio o de la web. */
    const papeles = m.docs && m.docs.papeles ? `<table class="pe-ficha">${m.docs.papeles.map((p) => {
      const d = p.doc;
      const href = d && d.url ? d.url : (d && d.documentoId ? `api/materiales/documento?id=${encodeURIComponent(m.id)}&papel=${encodeURIComponent(p.id)}` : null);
      const nombre = d ? `${esc(d.nombre || p.nombre)}${p.de === 'tipo' ? ' <span class="tenue">(del tipo)</span>' : ''}` : '';
      return fila(p.nombre, d ? (href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${nombre} ↗</a>` : nombre) : '<span style="color:var(--mal)">Falta</span>');
    }).join('')}</table>` : '';
    return `<div class="pe-hoja-fija">${ASA}<div class="fila-principal"><strong class="cifra" style="font-size:17px">${esc(m.tag)}</strong>
        <span class="chip"><i class="pe-punto ${esc(m.estado)}"></i> ${esc(ESTADO_MAT[m.estado] || '')}</span>
        <button class="cierra" data-pe-cerrar aria-label="Cerrar">×</button></div></div>
      <div class="sub">${esc(m.tipoNombre)}${fm ? ` · <span class="tenue">en el plano: ${esc(fm.nombre)}</span>` : ''}</div>
      ${m.codigo ? `<div class="pe-cad cifra">Código CAD ${esc(m.codigo)}</div>` : ''}
      <div class="pe-bloque"><h4>Identificación</h4><table class="pe-ficha">
        ${fila('Sala', salaHtml(m.sala))}${fila('Nº de serie', val(m.numSerie))}</table>
        ${datos.puedeEditar ? `<div class="pe-serie"><input data-pe-serie value="${esc(m.numSerie || '')}" placeholder="—" aria-label="Nº de serie (de la placa)" autocapitalize="characters"><button class="boton" data-pe-guardar-serie="${esc(m.id)}">Guardar</button></div>` : ''}</div>
      <div class="pe-bloque"><h4>Fabricante</h4><table class="pe-ficha">
        ${fila('Marca', val(m.marca))}${fila('Modelo', val(m.modelo))}${car.map(([k, v]) => fila(k, esc(v))).join('')}</table></div>
      <div class="pe-bloque"><h4>Documentos${m.docs ? ` <span class="tenue cifra">${m.docs.subidos} de ${m.docs.total}</span>` : ''}</h4>${papeles || `<div class="pe-enlaces">${docs || '<span class="tenue">Sin ficha técnica.</span>'}</div>`}</div>
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
    const quien = m ? `m:${m.id}` : (equipoElegido() ? `e:${elegida}` : null);
    const arriba = h.scrollTop;
    h.innerHTML = m ? hojaMaterial(m) : (p ? hojaHtml(p) : '');
    h.hidden = !equipoElegido() && !m;
    if (quien !== hojaDe) { hojaDe = quien; estadoHoja = 'media'; h.scrollTop = 0; } else h.scrollTop = arriba;
    if (!h.hidden) altoHoja(h);
    ajustarMarco();
    pedirFicha();
  }

  /* La puesta en marcha, la garantía y los botones del equipo se piden al abrir su ficha (no van en la lista). */
  function pedirFicha() {
    const e = equipoElegido();
    if (!e || e.fichaPidiendo || !datos) return;
    /* Las hojas de commissioning se piden siempre al abrir (cambian al rellenarlas); lo demás, si la lista vino ligera. */
    const faltanHojas = datos.conCommissioning && e.tomas === undefined;
    if (!faltanHojas && (e.fichaLista || !datos.ligero)) return;
    e.fichaPidiendo = true;
    C.pedir(`api/plano-equipos/ficha?obra=${encodeURIComponent(C.obraId())}&id=${encodeURIComponent(e.id)}`)
      .then((r) => {
        if (!r || r.ok === false) return;
        e.documentos = r.documentos; e.acciones = r.acciones; e.vida = r.vida; e.tomas = Array.isArray(r.tomas) ? r.tomas : []; e.marcasDF = r.marcasDF || null; e.fichaLista = true;
        if (elegida === e.id) { mostrarHoja(); asomar(elegida); }
      })
      .catch(() => {})
      .finally(() => { e.fichaPidiendo = false; });
  }

  /* El alto de la hoja según su estado (15-nov): 'media' = la mitad del sitio entre el borde de arriba del plano y la barra de
     abajo (el plano se queda con la otra mitad y el equipo, centrado en ella); 'completa' = hasta la cabecera de la app;
     'plegada' = solo la cabecera fija (TAG, estado, sala y resumen). En pantalla ancha (≥ 900 px) la hoja va al lado y no se toca. */
  function altosHoja(h) {
    const abajo = h.getBoundingClientRect().bottom || (window.innerHeight - 100);
    const [marco] = marcoYLienzo();
    const cab = document.querySelector('.barra');
    const techo = Math.max(8, cab ? cab.getBoundingClientRect().bottom + 8 : 8);
    const top = marco ? Math.max(techo, marco.getBoundingClientRect().top) : techo;
    const fija = h.querySelector('.pe-hoja-fija');
    const plegada = Math.round((fija ? fija.offsetHeight : 90) + 6);
    const completa = Math.round(Math.max(plegada, abajo - techo));
    const media = Math.round(Math.min(completa, Math.max(plegada + 60, (abajo - top) * 0.5)));
    return { plegada, media, completa };
  }
  function altoHoja(h, px = null) {
    if (!h || h.hidden) return;
    if (window.innerWidth >= 900) { h.style.height = ''; h.style.maxHeight = ''; h.classList.remove('plegada'); return; }
    const a = altosHoja(h);
    const alto = px !== null ? Math.max(a.plegada, Math.min(a.completa, px)) : a[estadoHoja] || a.media;
    h.style.maxHeight = 'none';
    h.style.height = `${alto}px`;
    h.classList.toggle('plegada', px === null && estadoHoja === 'plegada');
    h.dataset.peEstado = estadoHoja;
  }
  /* El asa: un toque sube de media a completa (y de completa o plegada vuelve a media); arrastrar sube o baja, y al soltar
     se queda en el estado más cercano. */
  let asa = null;
  document.addEventListener('pointerdown', (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest('[data-pe-asa]');
    const h = b && b.closest('[data-pe-hoja]');
    if (!h || !$raiz || !$raiz.contains(h)) return;
    asa = { id: ev.pointerId, y: ev.clientY, alto: h.getBoundingClientRect().height, h, movido: false };
    try { b.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
  });
  document.addEventListener('pointermove', (ev) => {
    if (!asa || ev.pointerId !== asa.id) return;
    const dy = ev.clientY - asa.y;
    if (!asa.movido && Math.abs(dy) < 6) return;
    asa.movido = true;
    asa.h.classList.add('arrastrando');
    altoHoja(asa.h, asa.alto - dy);
    ev.preventDefault();
  }, { passive: false });
  function soltarAsa(ev) {
    if (!asa || ev.pointerId !== asa.id) return;
    const { h, movido, alto, y } = asa;
    asa = null;
    h.classList.remove('arrastrando');
    if (!movido) return; /* el toque lo lleva el click */
    const final = alto - (ev.clientY - y);
    const a = altosHoja(h);
    estadoHoja = ['plegada', 'media', 'completa'].reduce((m, k) => (Math.abs(a[k] - final) < Math.abs(a[m] - final) ? k : m), 'media');
    altoHoja(h); ajustarMarco();
    if (elegida) asomar(elegida);
    asaTragar = Date.now();
  }
  let asaTragar = 0;
  document.addEventListener('pointerup', soltarAsa);
  document.addEventListener('pointercancel', soltarAsa);
  function tocarAsa() {
    if (Date.now() - asaTragar < 500) return;
    const h = $raiz && $raiz.querySelector('[data-pe-hoja]');
    estadoHoja = estadoHoja === 'media' ? 'completa' : 'media';
    altoHoja(h); ajustarMarco();
    if (elegida) asomar(elegida);
  }

  /* En el teléfono la hoja flota sobre la lista: el plano se queda con lo que queda libre
     encima de ella (así el equipo tocado no queda tapado) y la lista, con sitio debajo. */
  function ajustarMarco() {
    const h = $raiz && $raiz.querySelector('[data-pe-hoja]');
    const [marco] = marcoYLienzo();
    if (!h) return;
    if (compacto) { $raiz.style.paddingBottom = ''; ajustarAlto(); return; }
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
    if (elegida && window.CX_POSICION_PLANO) { const e = (plantaActual() || { equipos: [] }).equipos.find((x) => x.id === elegida); window.CX_POSICION_PLANO.contexto({ equipoId: elegida, tag: e && e.tag, planta: planta, origen: 'plano' }); }
    if (mat) { mat = null; for (const el of $raiz.querySelectorAll('[data-pe-mat]')) el.classList.remove('elegida'); }
    marcarElegida();
    mostrarHoja();
    if (elegida && centrarla) centrar(elegida);
    else if (elegida) {
      /* 15-nov (JC): en Cx, con la hoja a media altura, el equipo tocado queda centrado en la mitad de arriba: si el plano
         estaba en «Entero», se acerca un poco para que haya sitio donde centrarlo. */
      if (compacto && zoom < 2) ponerZoom(2);
      asomar(elegida);
    }
  }

  /* Que el equipo tocado quede a la vista: si está cerca de un borde del plano visible, se centra. */
  function asomar(id) {
    const p = plantaActual();
    /* Con la ficha abierta mientras se ubica, el plano sigue en su sala o referencias (no en su sitio de la franja). */
    if (ubicando && id === ubicando.id && p && verSuSitio(p)) return;
    const e = p && p.equipos.find((x) => x.id === id && x.x !== null);
    const [marco, lienzo] = marcoYLienzo();
    if (!e || !marco || !lienzo) return;
    const px = e.x * lienzo.offsetWidth + lienzo.offsetLeft - marco.scrollLeft;
    const py = e.y * lienzo.offsetHeight + lienzo.offsetTop - marco.scrollTop;
    /* En Cx (compacto) la hoja deja el plano más bajo: el equipo tocado se lleva siempre al centro de lo que queda. */
    if (compacto) { marco.scrollLeft = e.x * lienzo.offsetWidth + lienzo.offsetLeft - marco.clientWidth / 2; marco.scrollTop = e.y * lienzo.offsetHeight + lienzo.offsetTop - marco.clientHeight / 2; marco.dispatchEvent(new Event('scroll')); return; }
    if (px < marco.clientWidth * 0.12 || px > marco.clientWidth * 0.88) marco.scrollLeft = e.x * lienzo.offsetWidth + lienzo.offsetLeft - marco.clientWidth / 2;
    if (py < marco.clientHeight * 0.15 || py > marco.clientHeight * 0.85) marco.scrollTop = e.y * lienzo.offsetHeight + lienzo.offsetTop - marco.clientHeight / 2;
  }

  function pintar() {
    const p = plantaActual();
    if (!p) {
      $raiz.innerHTML = compacto ? `<p class="nota pe-sin-ifc" data-pe-sin-ifc>Ninguna planta tiene todavía plano (ni IFC ni PDF): lo prepara el delineante.</p>`
        : `${cabeza()}<p class="vacio">Esta obra aún no tiene equipos.</p>`;
      return;
    }
    planta = p.planta || '';
    /* Al cambiar de planta (o si el plano ya no es el del modelo) se deja de ubicar. */
    if (ubicando && (ubicando.planta !== planta || !puedeUbicarAqui(p))) { ubicando = null; guardandoSitio = false; }
    /* Una planta sin equipos y con materiales abre la lista de materiales: «Equipos 0» no dice nada. */
    if (!p.equipos.length && (p.materiales || []).length) lista = 'materiales';
    try { sessionStorage.setItem('cx.planoEquipos.planta', planta); } catch { /* nada */ }
    const c = p.cuentas;
    const cuentaV = (k) => (enRdf() ? p.equipos.filter((e) => bq(e) === k).length : (c.bloques || {})[k] || 0);
    const botonRdf = RD && datos && datos.rdf ? `<button data-pe-rdf aria-pressed="${colorRdf}" title="Colorear por validación de la DF y recepción de la propiedad">${colorRdf ? 'Color: Cx' : 'Color: DF y recepción'}</button>` : '';
    const qq = filtro.trim().toLowerCase();
    /* 13-nov (JC: «número de sala es muy importante»): también por número de sala, con o sin puntos («00.STE.036», «00 036»). */
    const BM = window.BUSCADOR_MOVIL;
    const textosEq = (m) => [m.tag, m.sala, m.codSala, m.local];
    const visibles = p.equipos.filter((m) => !ocultos.has(bq(m)) && (!soloInc || conInc(m)) && (!soloRes || conRes(m)) && (!soloTer || conTer(m)) && (!qq || (BM && BM.coincide ? BM.coincide(filtro.trim(), textosEq(m)) : textosEq(m).some((v) => String(v || '').toLowerCase().includes(qq)))));
    const enPlano = capasOff.has('equipos') ? [] : visibles.filter((m) => m.x !== null && !m.franja);
    const enFranja = capasOff.has('equipos') ? [] : visibles.filter((m) => m.x !== null && m.franja).sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || ''), 'es', { numeric: true }));
    const enConjunto = idsDelConjunto();
    const bus = buscado(p);
    const q = filtro.trim().toLowerCase();
    const mats = (p.materiales || []).filter((m) => m.x !== null && !capasOff.has(m.capa));
    const cuentasCapa = p.capas || {};
    const capas = ((datos && datos.capas) || []).filter((k) => cuentasCapa[k.id]);
    const chipFaltas = FA.chip(p);
    const pe0 = datos && (datos.plantas || []).find((x) => (x.planta || '') === (p.planta || ''));
    const selector = compacto ? '' : pe0 && pe0.ifc ? `<div class="pe-fondo" role="group" aria-label="Fondo del plano"><button data-pe-fondo="ifc" aria-pressed="${Boolean(p.esIfc)}">Modelo IFC</button><button data-pe-fondo="pdf" aria-pressed="${!p.esIfc}"${pe0.plano ? '' : ' disabled'}>Plano PDF</button></div>${p.esIfc ? `<p class="nota" data-pe-fondo-nota>${p.sinUbicar.length ? `${cifra(p.sinUbicar.length)} equipo${p.sinUbicar.length === 1 ? '' : 's'} sin posición en el modelo${pe0.plano ? ' (en el plano PDF quizá sí)' : ''}. ` : ''}${(pe0.materiales || []).some((m) => m.x !== null) || (pe0.faltas || []).length ? 'Los materiales y lo que falta están marcados en el plano PDF.' : ''}</p>` : ''}`
      : (p.plano ? '<p class="nota" data-pe-pdf-sin-ifc>plano PDF (sin IFC)</p>' : '');
    const plano = p.plano ? `${selector}<div class="pe-visor"><div class="pe-marco${FA.marcando() ? ' fa-activo' : ''}${ubicando ? ' pe-colocando' : ''}" data-pe-marco data-paleta="vidaire">
        <div class="pe-lienzo${zoom >= ZOOM_SALAS ? ' con-salas' : ''}" data-pe-lienzo style="width:${zoom * base * 100}%;${p.plano.ancho > 0 && p.plano.alto > 0 ? `aspect-ratio:${p.plano.ancho}/${p.plano.alto};` : ''}--pe-esc:${escMarcas()}">
          <img data-src="api/plano-equipos/imagen?id=${encodeURIComponent(p.plano.id)}" alt="Plano ${esc(p.plano.nombre)}" draggable="false">
          ${salasDe(p).map((r, i) => `<span class="pe-sala" data-pe-sala="${i}" style="left:${r.x * 100}%;top:${r.y * 100}%">${esc(r.t)}${r.codigo && r.codigo !== r.t ? `<small>${esc(r.codigo)}</small>` : ''}</span>`).join('')}
          ${mats.map((m) => marcaMaterial(m, q, p)).join('')}
          ${FA.marcas(p)}
          ${propuestaDe(p) ? `<div class="pe-propuesta" data-pe-propuesta style="left:${propuestaDe(p).x * 100}%;top:${propuestaDe(p).y * 100}%"><span>Propuesto desde el IFC</span></div>` : ''}
          ${bus && bus.sala ? `<div class="pe-sala-buscada" data-pe-sala-buscada style="left:${bus.sala.x * 100}%;top:${bus.sala.y * 100}%;width:${(bus.sala.w || 0) * 100}%;height:${(bus.sala.h || 0) * 100}%"><span>${esc(bus.sala.t)}</span></div>` : ''}
          ${enPlano.map((x) => `<button class="marca-boca bq-${bq(x)}${incClase(x)}${enConjunto.has(x.id) ? ' elegida' : ''}${x.revisar ? ' revisar' : ''}${bus && bus.refs.has(x.id) ? ' pe-referencia' : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%;--wp:${(cajaEq(x, p).wf * 100).toFixed(4)}%" data-pe-marca="${esc(x.id)}" aria-label="${esc(`${x.tag}, ${x.sala || 'sin sala'}: ${NOMBRE[bq(x)]}${dichoInc(x)}${x.revisar ? '; revisar ubicación' : ''}`)}">${simbolo(x.icono)}${incMarca(x)}<span class="rotulo-boca">${esc(x.tag)}</span></button>`).join('')}
        </div>
      </div>
      ${!compacto && p.esIfc && !(p.plano.salas || []).length ? '<p class="nota pe-sin-nombres" data-pe-sin-nombres>El modelo de esta planta no trae nombres de sala y no hay plano de arquitectura para situarlos.</p>' : ''}${!compacto && p.esIfc && p.plano.fuenteSalas === 'plano' ? '<p class="nota pe-sin-nombres" data-pe-nombres-pdf>Nombres de sala del plano de arquitectura, situados por los equipos: el modelo no los trae.</p>' : ''}
      <!-- 13-nov (JC en el iPhone): zoom con pellizco y doble toque; 18-nov (JC): sin los botones −/Entero/+.
           14-nov (JC): en la misma fila, plegados, los equipos que el modelo no pone en ninguna sala («por confirmar»). -->
      <div class="pe-pie${ubicando ? ' con-ubicando' : ''}">${ubicando ? `<div class="pe-ubicando${propuestaDe(p) && !guardandoSitio ? ' con-propuesta' : ''}" data-pe-ubicando role="status"><span class="pe-ub-txt"><span>${guardandoSitio ? 'Guardando el sitio de' : 'Toca en el plano dónde está'} <b>${esc(ubicando.tag)}</b></span>${guardandoSitio ? '' : `<small data-pe-ub-pista>${esc(dichoBuscado(bus))}</small>`}</span>${propuestaDe(p) ? `<button type="button" class="boton" data-pe-confirmar-ifc>Confirmar</button>` : ''}${guardandoSitio ? '' : `<button type="button" class="boton secundario" data-pe-ubicar-ficha>Ficha</button>`}<button type="button" class="boton secundario" data-pe-ubicar-cancelar>Cancelar</button></div>`
        : enFranja.length ? `<button type="button" class="pe-franja-boton" data-pe-franja aria-expanded="${verFranja}" aria-controls="pe-franja-lista"><span>${cifra(enFranja.length)} equipo${enFranja.length === 1 ? '' : 's'} ${puedeUbicarAqui(p) ? 'por ubicar' : 'sin sala, por confirmar'} <span class="flecha" aria-hidden="true">›</span></span></button>` : ''}
      ${enFranja.length && verFranja && !ubicando ? `<div class="pe-franja-lista" id="pe-franja-lista" data-pe-franja-lista role="list" aria-label="Sin sala en el modelo, por confirmar">${enFranja.length > 5 ? `<input type="search" class="pe-franja-buscar" data-pe-franja-buscar placeholder="Filtrar por TAG, sala, zona o tipo" aria-label="Filtrar los equipos por ubicar" value="${esc(franjaFiltro)}">` : ''}<ul>${enFranja.map((x) => `<li${puedeUbicarAqui(p) ? ' class="con-ubicar"' : ''} data-pe-franja-fila="${esc(x.id)}"${casaFranja(x) ? '' : ' hidden'}><button type="button" class="${enConjunto.has(x.id) ? 'elegida' : ''}" data-pe-marca="${esc(x.id)}" aria-label="${esc(`${x.tag}, ${pistaCorta(x) || 'sin sala en el modelo'}, por confirmar: ${NOMBRE[bq(x)]}`)}">${simbolo(x.icono)}<span class="pe-fr-txt"><span class="pe-fr-l1"><b>${esc(x.tag)}</b><span class="tipo">${esc([tipoDe(x), x.modelo].filter(Boolean).join(' · '))}</span></span><span class="pista${pistaCorta(x) ? '' : ' vacia'}">${esc(pistaCorta(x) || 'Sin sala, zona ni sistema en la base')}</span>${x.propuesto ? `<span class="pe-propuesto" data-pe-propuesto="${esc(x.id)}">${esc(dichoPropuesto(x.propuesto))}</span>` : ''}</span><i class="pe-punto bq-punto-${puntoInc(x)}" title="${esc(conInc(x) ? 'Con incidencia' : conTer(x) ? IP.NOMBRE_TERCEROS : conRes(x) ? IP.NOMBRE_RESUELTA : NOMBRE[bq(x)])}"></i><span class="pe-ir" aria-hidden="true">›</span></button>${puedeUbicarAqui(p) ? `<button type="button" class="pe-ubicar" data-pe-ubicar="${esc(x.id)}" aria-label="${esc(x.propuesto ? `Ver dónde lo propone el IFC para ${x.tag}` : `Ubicar ${x.tag} en el plano`)}">${x.propuesto ? 'Ver' : 'Ubicar'}</button>` : ''}</li>`).join('')}</ul><p class="pe-franja-nada" data-pe-franja-nada${enFranja.some(casaFranja) ? ' hidden' : ''}>Ninguno con «${esc(franjaFiltro)}».</p></div>` : ''}</div>${FA.marcando() ? FA.mando(p) : ''}</div>`
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
      ${p.equipos.length ? `<div class="pe-leyenda pe-una-fila" role="group" aria-label="Estados">${botonRdf}${ordenV().filter((k) => cuentaV(k) > 0 || ocultos.has(k)).map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}" title="${esc(NOMBRE[k])}"><i class="pe-punto bq-punto-${k}"></i>${esc(CORTO[k] || NOMBRE[k])} <b>${cifra(cuentaV(k))}</b></button>`).join('')}${chipInc(p)}</div>` : ''}
      <div class="pe-cuerpo">
        <div>${plano}</div>
        <div class="pe-lado"><div class="pe-hoja" data-pe-hoja hidden></div></div>
      </div>` : `
      ${cabeza()}
      <div class="pe-plantas" role="tablist">${plantas().map((x) => `<button role="tab" data-pe-planta="${esc(x.planta || '')}" aria-selected="${x === p}" class="${x === p ? 'activa' : ''}">${esc(etiqueta(x))}<small>${cuentaTexto(nEquipos(x), nMateriales(x))}</small></button>`).join('')}</div>
      ${capas.length > 1 || chipFaltas ? `<div class="pe-capas" role="group" aria-label="Capas">${capas.length > 1 ? capas.map((k) => `<button data-pe-capa="${esc(k.id)}" aria-pressed="${!capasOff.has(k.id)}">${esc(k.nombre)} <b>${cifra(cuentasCapa[k.id])}</b></button>`).join('') : ''}${chipFaltas}</div>` : ''}
      ${p.equipos.length ? `<div class="pe-leyenda" role="group" aria-label="Colores">${botonRdf}${ordenV().map((k) => `<button data-pe-color="${k}" aria-pressed="${!ocultos.has(k)}"><i class="pe-punto bq-punto-${k}"></i>${esc(NOMBRE[k])} <b>${cifra(cuentaV(k))}</b></button>`).join('')}${chipInc(p)}
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
          ${visibles.map((e) => `<tr data-pe-fila="${esc(e.id)}" class="${e.id === elegida ? 'elegida' : ''}${p.plano && e.x === null ? ' sin-ubicar' : ''}"><td>${e.papel ? `<em class="tenue">${esc(e.papel)}</em> ` : ''}${esc(e.tag)}</td><td>${salaHtml(e.sala)}</td><td class="estado">${p.plano && e.x === null ? '<i class="pe-punto pe-gris"></i> Sin ubicar' : `<i class="pe-punto bq-punto-${bq(e)}"></i> ${esc(NOMBRE[bq(e)])}`}</td></tr>`).join('') || '<tr><td colspan="3" class="tenue">Ningún equipo con esos colores.</td></tr>'}
          </tbody></table></div>`}
        </div>
      </div>`;
    C.cargarImagenes($raiz);
    mostrarHoja();
    colocarTags($raiz.querySelector('[data-pe-lienzo]'));
    /* 18-nov (JC): «dónde estoy», una capa aparte encima (renderer/movil/posicionPlanoCapa.js). */
    /* 18-nov: con la lista de plantas y su cota del IFC, para proponer la planta en la que estás (plantaAutoCapa.js). */
    if (window.CX_POSICION_PLANO) window.CX_POSICION_PLANO.montar($raiz, p, { salas: salasDe(p), plantas: (compacto ? plantasCx() : plantas()).map((x) => ({ planta: x.planta, cota: x.ifc && x.ifc.plano ? x.ifc.plano.cota ?? null : null })) });
    if (compacto || window.innerWidth < 900) ajustarAlto();
    /* 14-nov: hasta que llega la imagen el lienzo no tiene alto; al llegar, los rótulos se recolocan con el de verdad. */
    const img = $raiz.querySelector('[data-pe-lienzo] img');
    if (img) img.addEventListener('load', () => { const l = $raiz.querySelector('[data-pe-lienzo]'); if (l && l.contains(img)) colocarTags(l); }, { once: true });
    const fila = compacto ? null : $raiz.querySelector('.pe-plantas');
    const act = fila && fila.querySelector('.activa');
    if (act) fila.scrollLeft = act.offsetLeft - fila.clientWidth / 2 + act.offsetWidth / 2;
  }

  /* Pantalla Cx (13-nov, coordinador): el plano se queda con todo el alto que hay entre la cabecera y la barra inferior,
     con la franja del zoom justo debajo; sin hueco blanco debajo. En «Entero» el dibujo va centrado en ese alto. */
  function ajustarAlto() {
    const [marco, lienzo] = marcoYLienzo();
    if (!marco) return;
    if (compacto) { ajustarAltoCx(marco, lienzo); return; }
    const cab = document.querySelector('.barra');
    const arriba = cab ? Math.max(0, cab.getBoundingClientRect().bottom) : 0;
    const raiz = getComputedStyle(document.documentElement);
    const barra = parseFloat(raiz.getPropertyValue('--hueco-barra')) || 0;
    const franja = $raiz.querySelector('.pe-pie');
    const sinSala = $raiz.querySelector('[data-pe-franja-lista]');
    const fh = (franja ? franja.offsetHeight + 8 : 48) + (sinSala ? sinSala.offsetHeight + 6 : 0);
    const libre = Math.round(Math.max(260, window.innerHeight - arriba - barra - fh - 12));
    /* 14-nov (JC): el dibujo pegado arriba y el marco ajustado a él: sin banda blanca encima ni debajo cuando el plano entero
       cabe con menos alto del que hay. */
    const p = plantaActual();
    const pl = p && p.plano;
    const alto = pl && pl.ancho > 0 && pl.alto > 0 ? Math.ceil(marco.clientWidth * (pl.alto / pl.ancho)) + 2 : 0;
    marco.style.height = `${alto > 0 ? Math.min(libre, Math.max(200, alto)) : libre}px`;
  }

  /* 14-nov (JC en el iPhone: «esto no se ve bien»): en la pestaña Cx el marco va desde donde empieza hasta la barra de abajo,
     menos la fila del pie (sin sala + zoom); la lista desplegada va encima del plano y no le quita alto. Sin scroll de página. Y «Entero» = la planta entera dentro
     del marco, también si es más alta que ancha (base < 1: el lienzo, más estrecho que el marco y centrado). */
  function ajustarAltoCx(marco, lienzo) {
    const pastilla = document.querySelector('.barra-pastilla');
    const pb = pastilla && pastilla.offsetParent !== null ? pastilla.getBoundingClientRect().top : 0;
    const raiz = getComputedStyle(document.documentElement);
    /* 14-nov (JC): con la hoja del equipo abierta el plano acaba encima de ella, para que el equipo resaltado se vea;
       los botones de zoom se esconden mientras (se acerca con los dedos) y el encaje no cambia (sin saltos). */
    const hoja = $raiz.querySelector('[data-pe-hoja]');
    const conHoja = Boolean(hoja && !hoja.hidden && hoja.offsetHeight);
    const limite = conHoja ? hoja.getBoundingClientRect().top - 6 : pb > 0 ? pb : window.innerHeight - (parseFloat(raiz.getPropertyValue('--hueco-barra')) || 0);
    const pie = $raiz.querySelector('.pe-pie');
    const debajo = conHoja ? 0 : (pie ? pie.offsetHeight + 4 : 0) + 8;
    const top = marco.getBoundingClientRect().top + (window.scrollY || 0);
    const libre = Math.round(Math.max(conHoja ? 140 : 220, limite - top - debajo));
    const p = plantaActual();
    const pl = p && p.plano;
    /* 19-nov (JC: «que no ocupe tanto la ventana del plano, que puedo hacer zoom»): el marco toma el alto
       del dibujo de ESTA planta a lo ancho (ancho/alto del plano), con un mínimo de 180 px y sin pasar del alto libre; así no
       queda blanco arriba ni abajo y «Dónde estoy», el aviso y «N equipos por ubicar» quedan justo debajo. Se recalcula en
       cada planta (pintar → ajustarAlto) y se sigue acercando con los dedos. */
    const cw0 = marco.clientWidth;
    const delDibujo = pl && pl.ancho > 0 && pl.alto > 0 && cw0 > 0 ? Math.ceil(cw0 * (pl.alto / pl.ancho)) + 2 : 0;
    const alto = delDibujo > 0 ? Math.min(libre, Math.max(conHoja ? 140 : 180, delDibujo)) : libre;
    marco.style.height = `${alto}px`;
    if (conHoja) return;
    const cw = marco.clientWidth; const ch = marco.clientHeight;
    const nb = pl && pl.ancho > 0 && pl.alto > 0 && cw > 0 ? Math.min(1, (ch - 2) / (cw * (pl.alto / pl.ancho))) : 1;
    if (lienzo && Math.abs(nb - base) > 0.001) {
      base = nb;
      lienzo.style.width = `${zoom * base * 100}%`;
      colocarTags(lienzo);
    }
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
  /* 14-nov (JC: «el zoom va mal en el móvil»): al acercar, los símbolos y los TAG crecen un poco (no en proporción al
     zoom, para que no se amontonen); vistaPlano.tamBloques los sigue encogiendo si chocan con el vecino. */
  const tamEq = () => Math.round(Math.min(34, TAM_EQ * Math.pow(Math.max(1, zoom), 0.22)));
  const tamTag = () => Math.round(Math.min(12, 9 * Math.pow(Math.max(1, zoom), 0.13)) * 2) / 2;
  let LETRA_TAG = '700 9px system-ui, sans-serif';
  const LETRA_TAG_ELEGIDO = '700 12px system-ui, sans-serif';
  const LETRA_SALA = '600 11px system-ui, sans-serif';
  const LETRA_COD = '500 9.5px system-ui, sans-serif';
  const huecos = new WeakMap(); /* salas del plano → hueco de cada una (vistaPlano.huecoSalas) */
  /* Los nombres de sala: los que trae el plano (IFC o PDF); si no trae ninguno, el campo sala de los equipos (nunca inventados). */
  const salasEq = new WeakMap();
  /* 15-nov (JC: «Sala de bombas» pintado encima del mismo texto del PDF): sobre el plano PDF, sus rótulos de sala ya están en
     el dibujo; no se repintan: son obstáculos (vistaPlano.colocarRotulos › fijos) y encima solo van las salas de los equipos que
     el PDF no nombra (las que sí nombra, colocarRotulos las descarta). Sobre el modelo IFC, como siempre. */
  const textosDelPdf = (p) => (p && p.plano && !p.esIfc ? (p.plano.salas || []).filter((r) => r && r.t) : []);
  function salasDe(p) {
    if (p && p.plano && !p.esIfc && (p.plano.salas || []).length && window.VISTA_PLANO && window.VISTA_PLANO.salasDeEquipos) {
      if (!salasEq.has(p)) { const f = FP(); salasEq.set(p, window.VISTA_PLANO.salasDeEquipos(p.equipos || [], f ? f.partirSala : undefined).filter((r) => !f || f.partirSala(r.t).nombre)); }
      return salasEq.get(p);
    }
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
    for (const g of lienzo.querySelectorAll('[data-pe-grupo]')) g.remove();
    const quitar = () => { for (const b of [...botones, ...botonesEq]) b.classList.remove('con-tag', 'en-grupo'); for (const s of rotSalas) s.classList.remove('ver'); };
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
    const tMax = tamEq(); const tTag = tamTag();
    LETRA_TAG = `700 ${tTag}px system-ui, sans-serif`;
    lienzo.style.setProperty('--pe-tag', `${tTag}px`);
    const tam = V.tamBloques ? V.tamBloques(botonesEq.map((b) => porEq.get(b.dataset.peMarca)).filter(Boolean), { lw, lh, max: tMax, min: TAM_EQ_MIN }) : new Map();
    const equipos = [];
    for (const b of botonesEq) {
      const e = porEq.get(b.dataset.peMarca);
      if (!e || e.x === null) continue;
      const elegido = b.classList.contains('elegida');
      const t = elegido ? Math.max(TAM_EQ_ELEGIDO, tMax + 4) : (tam.get(e.id) || tMax);
      b.style.width = `${t}px`;
      equipos.push({ id: e.id, x: e.x, y: e.y, sw: t, tag: e.tag, elegido });
    }
    const listaSalas = salasDe(p);
    if (!huecos.has(listaSalas)) huecos.set(listaSalas, V.huecoSalas(listaSalas, lh / lw));
    const ancho = (t, k) => anchoTexto(t || '', k === 'elegido' ? LETRA_TAG_ELEGIDO : k === 'sala' ? LETRA_SALA : k === 'codigo' ? LETRA_COD : LETRA_TAG);
    /* 14-nov (JC en el iPhone): en la pestaña Cx, el TAG también encima o debajo del bloque, y los que no caben, en píldoras «+N». */
    const ver = V.colocarRotulos({ lw, lh, equipos, materiales, salas: listaSalas, huecos: huecos.get(listaSalas), ancho, sitios: compacto, grupos: compacto, fijos: textosDelPdf(p) });
    for (const b of botones) b.classList.toggle('con-tag', ver.tags.has(b.dataset.peMat));
    for (const b of botonesEq) b.classList.toggle('con-tag', ver.tags.has(`eq:${b.dataset.peMarca}`));
    /* 13-nov: un TAG que se saldría por la derecha del plano va a la izquierda de su equipo (regla compartida). */
    const izq = ver.izq || new Set();
    for (const b of botones) b.classList.toggle('tag-izq', izq.has(b.dataset.peMat));
    for (const b of botonesEq) b.classList.toggle('tag-izq', izq.has(`eq:${b.dataset.peMarca}`));
    const sitios = ver.sitios || new Map(); const cajas = ver.cajas || new Map();
    const porEqId = new Map(equipos.map((q) => [q.id, q]));
    for (const b of botonesEq) {
      const k = `eq:${b.dataset.peMarca}`; const st = sitios.get(k);
      b.classList.toggle('tag-arr', st === 'arr'); b.classList.toggle('tag-abj', st === 'abj');
      const q = porEqId.get(b.dataset.peMarca); const cj = cajas.get(k);
      /* Junto al borde el TAG de arriba/abajo va desplazado para no cortarse (la caja que dio colocarRotulos). */
      if (st && q && cj) b.style.setProperty('--tag-dx', `${(cj.x + cj.w / 2 - q.x * lw).toFixed(1)}px`); else b.style.removeProperty('--tag-dx');
    }
    const enGrupo = new Set();
    const pildoras = (ver.grupos || []).map((g, i) => {
      for (const id of g.ids) enGrupo.add(id);
      return `<button type="button" class="pe-grupo" data-pe-grupo="${i}" style="left:${((g.x / lw) * 100).toFixed(3)}%;top:${((g.y / lh) * 100).toFixed(3)}%" aria-label="${g.n} equipos más aquí: acercar para ver sus TAG">+${g.n}</button>`;
    }).join('');
    for (const b of botonesEq) b.classList.toggle('en-grupo', enGrupo.has(b.dataset.peMarca));
    if (pildoras) lienzo.insertAdjacentHTML('beforeend', pildoras);
    for (const s of rotSalas) {
      const i = Number(s.dataset.peSala); const c = ver.sitio.get(i);
      s.classList.toggle('ver', Boolean(c));
      if (c) { s.style.left = `${(c.x / lw) * 100}%`; s.style.top = `${(c.y / lh) * 100}%`; }
    }
  }

  /* Cambia el zoom dejando quieto el punto (px, py del marco) que está bajo los dedos. */
  /* Durante el pellizco, la rueda o la animación, recolocar los rótulos en cada fotograma es lo que hacía ir a saltos:
     se recolocan como mucho cada 140 ms y una vez más al soltar (los símbolos van en % del lienzo y siguen al plano). */
  let tTags = 0;
  function tagsEnUnRato(lienzo) {
    if (tTags) return;
    tTags = setTimeout(() => { tTags = 0; if (lienzo.isConnected) colocarTags(lienzo); }, 140);
  }
  function tagsYa(lienzo) { clearTimeout(tTags); tTags = 0; if (lienzo && lienzo.isConnected) colocarTags(lienzo); }
  function ponerZoom(nuevo, px, py, ligero = false) {
    const [marco, lienzo] = marcoYLienzo();
    nuevo = Math.min(ZOOM_MAX, Math.max(1, nuevo));
    if (!marco || !lienzo) { zoom = nuevo; return; }
    /* Sin dedos: el centro de lo que se ve DEL PLANO (no del marco: en «Entero» el dibujo va centrado y deja margen). */
    const oy0 = lienzo.offsetTop; const ox0 = lienzo.offsetLeft;
    if (px === undefined) { const a = Math.max(0, ox0 - marco.scrollLeft); const b = Math.min(marco.clientWidth, ox0 + lienzo.offsetWidth - marco.scrollLeft); px = (a + b) / 2; }
    if (py === undefined) { const a = Math.max(0, oy0 - marco.scrollTop); const b = Math.min(marco.clientHeight, oy0 + lienzo.offsetHeight - marco.scrollTop); py = (a + b) / 2; }
    const fx = Math.max(0, Math.min(1, (marco.scrollLeft + px - ox0) / (lienzo.offsetWidth || 1)));
    const fy = Math.max(0, Math.min(1, (marco.scrollTop + py - oy0) / (lienzo.offsetHeight || 1)));
    zoom = nuevo;
    lienzo.style.width = `${zoom * base * 100}%`;
    lienzo.style.setProperty('--pe-esc', String(escMarcas()));
    lienzo.classList.toggle('con-salas', zoom >= ZOOM_SALAS);
    if (ligero) tagsEnUnRato(lienzo); else tagsYa(lienzo);
    marco.scrollLeft = fx * lienzo.offsetWidth + lienzo.offsetLeft - px;
    marco.scrollTop = fy * lienzo.offsetHeight + lienzo.offsetTop - py;
  }

  /* 13-nov (coordinador): tras un zoom la vista no se sale de la planta ni se queda en blanco:
     si no cae ningún equipo ni sala a la vista, se centra en el más cercano (vistaPlano.encuadreZoom). */
  function encuadrar() {
    const [marco, lienzo] = marcoYLienzo();
    const p = plantaActual();
    const V = window.VISTA_PLANO;
    if (!marco || !lienzo || !p || !V || !V.encuadreZoom) return;
    const puntos = (p.equipos || []).filter((e) => e.x !== null && e.x !== undefined && !ocultos.has(bq(e))).concat(salasDe(p));
    const r = V.encuadreZoom({ sl: marco.scrollLeft, st: marco.scrollTop, cw: marco.clientWidth, ch: marco.clientHeight, lw: lienzo.offsetWidth, lh: lienzo.offsetHeight, puntos });
    marco.scrollLeft = r.sl; marco.scrollTop = r.st;
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
      ponerZoom(origen + (destino - origen) * (1 - (1 - k) ** 3), px, py, k < 1);
      if (k < 1) animando = requestAnimationFrame(paso); else encuadrar();
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

  let fotoPellizco = 0;
  function pasoPellizco() {
    const marco = $raiz && $raiz.querySelector('[data-pe-marco]');
    if (!marco || !gesto || gesto.tipo !== 'pellizco' || dedos.size < 2) return;
    const [a, b] = [...dedos.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const r = marco.getBoundingClientRect();
    /* El punto de anclaje sigue a los dedos: pellizcar y mover a la vez también desplaza. */
    const cx = (a.x + b.x) / 2 - r.left;
    const cy = (a.y + b.y) / 2 - r.top;
    if (d === gesto.d && cx === gesto.cx && cy === gesto.cy) return;
    /* Desde el zoom y la distancia del ARRANQUE del pellizco (no del fotograma anterior): sin errores que se acumulen. */
    ponerZoom(gesto.z0 * (d / gesto.d0), gesto.cx, gesto.cy, true);
    marco.scrollLeft += gesto.cx - cx;
    marco.scrollTop += gesto.cy - cy;
    gesto.cx = cx; gesto.cy = cy; gesto.d = d;
  }
  function empezarPellizco(marco) {
    const [a, b] = [...dedos.values()];
    const r = marco.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    gesto = { tipo: 'pellizco', d, d0: d, z0: zoom, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
    tragarClick = true;
  }

  /* 15-nov: el plano captura el puntero para arrastrar (setPointerCapture), así que el «soltar» y el click llegan con el
     MARCO de destino, no con el equipo tocado, y el toque no abría su ficha. El blanco real es lo que hay bajo el dedo. */
  function blanco(ev) {
    const t = ev.target;
    if (!t || !t.closest) return t || document.body;
    const m = t.matches && t.matches('[data-pe-marco], [data-pe-lienzo]') ? t : null;
    if (!m || !Number.isFinite(ev.clientX) || (!ev.clientX && !ev.clientY)) return t;
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    return bajo && m.contains(bajo) ? bajo : t;
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
      /* Los dos dedos mandan un pointermove cada uno: se aplica una vez por fotograma con la última posición de ambos. */
      if (!fotoPellizco) fotoPellizco = requestAnimationFrame(() => { fotoPellizco = 0; pasoPellizco(); });
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
      if (gesto && (gesto.tipo === 'pellizco' || gesto.tipo === 'arrastre') && fotoPellizco) { cancelAnimationFrame(fotoPellizco); fotoPellizco = 0; pasoPellizco(); }
      if (gesto && gesto.tipo === 'pellizco') { const l = marco && marco.querySelector('[data-pe-lienzo]'); tagsYa(l); encuadrar(); }
      else if (tTags && marco) tagsYa(marco.querySelector('[data-pe-lienzo]'));
      /* Marcando (8-nov): el toque dice el sitio, aunque caiga encima de otra marca; arrastrar y pellizcar siguen moviendo el plano. */
      /* Ubicando (17-nov): el toque dice el sitio del equipo, aunque caiga encima de otro; arrastrar y pellizcar mueven el plano. */
      if (eraEspera && marco && ubicando && !guardandoSitio) {
        const pt = UB() && UB().puntoDelToque(marco.querySelector('[data-pe-lienzo]').getBoundingClientRect(), ev.clientX, ev.clientY);
        gesto = null;
        ultimoToque = null;
        tragarClick = true;
        setTimeout(() => { tragarClick = false; }, 350);
        /* Fuera del dibujo (el hueco bajo un plano apaisado) no es un sitio: sigue esperando. */
        if (pt) guardarSitio(pt[0], pt[1]);
        return;
      }
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
      if (eraEspera && marco && !(blanco(ev).closest && blanco(ev).closest('[data-pe-marca],[data-pe-mat],[data-pe-zoom],[data-pe-grupo],[data-fa-ver]'))) {
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
      if (fotoPellizco) { cancelAnimationFrame(fotoPellizco); fotoPellizco = 0; }
      tagsYa(marco.querySelector('[data-pe-lienzo]'));
      /* Al levantar un dedo del pellizco, el que queda sigue arrastrando sin saltos. */
      const [q] = [...dedos.values()];
      gesto = { tipo: 'arrastre', x: q.x, y: q.y, sl: marco.scrollLeft, st: marco.scrollTop, movido: true };
    }
  }
  document.addEventListener('pointerup', soltar);
  /* Al girar el teléfono o cambiar el alto (barra del navegador), el plano vuelve a llenar su hueco. */
  let tAlto = 0;
  window.addEventListener('resize', () => { clearTimeout(tAlto); tAlto = setTimeout(() => { if ($raiz && $raiz.isConnected) altoHoja($raiz.querySelector('[data-pe-hoja]')); if (compacto && $raiz && $raiz.isConnected && $raiz.querySelector('[data-pe-marco]')) ajustarAlto(); }, 120); });
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
    ponerZoom(zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.012 : 0.0015)), px, py, true);
  }, { passive: false });

  /* Repinta sin perder dónde estaba el plano ni la lista. */
  /* 17-nov: tocar «Ubicar» (en la lista «por ubicar» o en la hoja) deja el plano libre y espera el toque en su sitio. */
  function empezarAUbicar(id) {
    const p = plantaActual();
    const e = p && p.equipos.find((q) => q.id === id);
    if (!e || !puedeUbicarAqui(p) || e.delModelo) return;
    ubicando = { id: e.id, tag: e.tag || e.id, planta: p.planta || '' };
    verFranja = false; elegida = null; mat = null;
    marcarElegida(); mostrarHoja(); repintarQuieto();
    verSuSitio(p);
  }
  /* 17-nov (v2): el plano va a su sala (si el modelo la tiene) o a sus referencias ya ubicadas. */
  function verSuSitio(p) {
    const pr = propuestaDe(p);
    if (pr) { centrarPunto(pr.x, pr.y); return true; }
    const b = buscado(p);
    const q = b && b.hs[0] ? p.equipos.find((z) => z.id === b.hs[0].id) : null;
    if (b && b.sala) centrarPunto(b.sala.x, b.sala.y, b.sala); else if (q) centrarPunto(q.x, q.y);
    return !!(b && (b.sala || q));
  }
  /* Acerca hasta que la sala (o el punto) llena buena parte del marco, y lo centra. */
  function centrarPunto(x, y, caja = null) {
    const [marco0, lienzo0] = marcoYLienzo();
    if (!marco0 || !lienzo0) return;
    const ancho = lienzo0.offsetWidth / Math.max(1, zoom);
    const objetivo = caja && caja.w > 0 ? Math.min(ZOOM_MAX, Math.max(2, (marco0.clientWidth * 0.45) / (caja.w * ancho))) : 3;
    if (Math.abs(zoom - objetivo) > 0.05) ponerZoom(objetivo);
    const [marco, lienzo] = marcoYLienzo();
    marco.scrollLeft = x * lienzo.offsetWidth + lienzo.offsetLeft - marco.clientWidth / 2;
    marco.scrollTop = y * lienzo.offsetHeight + lienzo.offsetTop - marco.clientHeight / 2;
  }

  async function guardarSitio(x, y) {
    const p = plantaActual();
    const u = ubicando;
    if (!u || !p || !puedeUbicarAqui(p)) { ubicando = null; repintarQuieto(); return; }
    guardandoSitio = true; repintarQuieto();
    let r;
    /* 21-nov (c13cb36e): si ya tenía sitio, «mover»: arrastra su conjunto, guarda la sala donde cae y deja Deshacer. */
    const eq = ((p.equipos || []).find((q) => q.id === u.id)) || null;
    const yaPuesto = Boolean(eq && eq.x !== null && eq.x !== undefined && !eq.franja);
    try { r = await C.postJson(yaPuesto ? 'api/plano-equipos/mover' : 'api/plano-equipos/colocar', { obra: C.obraId(), plano: p.plano.id, id: u.id, x, y }); } catch (e) { r = { ok: false, error: e.message }; }
    guardandoSitio = false;
    if (!r || !r.ok) { C.aviso((r && r.error) || 'No se pudo guardar el sitio.'); repintarQuieto(); return; }
    ubicando = null;
    try { await cargar(); } catch (e) { C.aviso(e.message); }
    elegida = u.id; mat = null;
    repintarQuieto(); marcarElegida(); mostrarHoja(); centrar(u.id);
    if (yaPuesto) avisoMovido(r, u.id);
  }

  function avisoMovido(r, id) {
    const n = (r.conjunto || []).length;
    const donde = r.sala ? `ahora en ${r.sala.codigo}${r.sala.nombre ? ` · ${r.sala.nombre}` : ''}` : 'sin sala (por confirmar)';
    const hoja = document.querySelector('.pe-ubicar-hoja');
    if (!hoja) { C.aviso(`Movido: ${donde}.`, 'bien'); return; }
    const caja = document.createElement('div');
    caja.className = 'sub'; caja.dataset.peMovido = '1';
    caja.innerHTML = `Movido: ${esc(donde)}.${n ? ` Con él, ${n} del conjunto.` : ''} <button type="button" class="boton secundario" data-pe-deshacer-mover="${esc(id)}">Deshacer</button>`;
    hoja.prepend(caja);
  }

  async function deshacerMovido(id) {
    let r;
    try { r = await C.postJson('api/plano-equipos/deshacer-mover', { obra: C.obraId(), id }); } catch (e) { r = { ok: false, error: e.message }; }
    if (!r || !r.ok) { C.aviso((r && r.error) || 'No se ha deshecho.'); return; }
    try { await cargar(); } catch (e) { C.aviso(e.message); }
    elegida = id; mat = null;
    repintarQuieto(); marcarElegida(); mostrarHoja(); centrar(id);
    C.aviso('Deshecho: vuelve a su sitio y su sala de antes.', 'bien');
  }

  /* «Confirmar» la propuesta del IFC (17-nov): el equipo se queda con ese elemento del modelo, su GUID y su bloque. */
  async function confirmarPropuesta() {
    const p = plantaActual();
    const u = ubicando; const pr = propuestaDe(p);
    if (!u || !pr || !puedeUbicarAqui(p)) return;
    guardandoSitio = true; repintarQuieto();
    let r;
    try { r = await C.postJson('api/plano-equipos/confirmar-ifc', { obra: C.obraId(), plano: p.plano.id, id: u.id, g: pr.g, motivo: pr.motivo }); } catch (e) { r = { ok: false, error: e.message }; }
    guardandoSitio = false;
    if (!r || !r.ok) { C.aviso((r && r.error) || 'No se pudo confirmar.'); repintarQuieto(); return; }
    ubicando = null;
    try { await cargar(); } catch (e) { C.aviso(e.message); }
    elegida = u.id; mat = null;
    repintarQuieto(); marcarElegida(); mostrarHoja(); centrar(u.id);
  }

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
    marco.scrollLeft = e.x * lienzo.offsetWidth + lienzo.offsetLeft - marco.clientWidth / 2;
    marco.scrollTop = e.y * lienzo.offsetHeight + lienzo.offsetTop - marco.clientHeight / 2;
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
    if ($raiz && ev.target.matches && ev.target.matches('[data-pe-franja-buscar]') && $raiz.contains(ev.target)) {
      franjaFiltro = ev.target.value;
      const p = plantaActual();
      let alguno = false;
      for (const li of $raiz.querySelectorAll('[data-pe-franja-fila]')) {
        const x = p && p.equipos.find((q) => q.id === li.dataset.peFranjaFila);
        const si = Boolean(x && casaFranja(x)); li.hidden = !si; alguno = alguno || si;
      }
      const nada = $raiz.querySelector('[data-pe-franja-nada]');
      if (nada) { nada.hidden = alguno; nada.textContent = `Ninguno con «${franjaFiltro}».`; }
      return;
    }
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
  /* Validar (DF) / recepcionar (propiedad) desde la hoja del plano (21-nov): se guarda y se pinta el estado nuevo. */
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pe-hoja-resto [data-rdf-marcar], .pe-hoja-resto [data-rdf-deshacer]');
    const e = b && equipoElegido();
    if (!e) return;
    const caja = b.closest('.bloqueRdf');
    const obs = ((caja && caja.querySelector('[data-rdf-obs]')) || {}).value || '';
    const [tipo, valor] = (b.dataset.rdfMarcar || `${b.dataset.rdfDeshacer}:`).split(':');
    C.postJson('api/equipo/marca', { equipoId: e.id, tipo, valor: valor || null, observacion: obs, deshacer: Boolean(b.dataset.rdfDeshacer) }).then((r) => {
      if (r && r.ok === false) { const n = document.createElement('p'); n.className = 'nota aviso'; n.textContent = r.error || 'No se ha guardado.'; if (caja) caja.appendChild(n); return; }
      e.marcasDF = r && r.estado ? r.estado : e.marcasDF;
      /* El color del plano (y de las demás unidades del conjunto) sigue a la marca nueva. */
      if (datos && datos.rdf && r && r.estado && r.estado.fase) {
        const tags = new Set(r.estado.unidades || []);
        for (const pl of datos.plantas || []) for (const x of pl.equipos || []) if (x.id === e.id || tags.has(x.tag)) datos.rdf[x.id] = r.estado.fase;
      }
      if (enRdf()) repintarQuieto(); else mostrarHoja();
    }).catch(() => {});
  });
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
    const vd = blanco(ev).closest('[data-pes-ver-doc]');
    if (vd) { abrirDocEquipo(Number(vd.dataset.pesVerDoc)); return; }
    /* Una hoja de commissioning: el botón «Abrir» o la fila entera (el dedo no tiene que acertar un botón pequeño). */
    const tm = blanco(ev).closest('[data-pes-toma]') || (blanco(ev).closest('[data-pe-hojas] tr') || { querySelector: () => null }).querySelector('[data-pes-toma]');
    if (tm) { abrirTomaEquipo(Number(tm.dataset.pesToma)); return; }
    const dq = blanco(ev).closest('[data-pe-entrega-df-quitar]');
    if (dq) { guardarEntregaDF(dq.dataset.peEntregaDfQuitar, null); return; }
    const pl = blanco(ev).closest('[data-pe-planta]');
    if (pl) {
      const nombre = pl.dataset.pePlanta;
      traerPlanta(nombre).then(() => { planta = nombre; elegida = null; mat = null; zoom = 1; pintar(); precargarVecinas(); }).catch((e) => C.aviso(e.message));
      return;
    }
    if (blanco(ev).closest('[data-pe-solo-inc]')) { soloInc = !soloInc; repintarQuieto(); return; }
    if (blanco(ev).closest('[data-pe-solo-res]')) { soloRes = !soloRes; repintarQuieto(); return; }
    if (blanco(ev).closest('[data-pe-solo-ter]')) { soloTer = !soloTer; repintarQuieto(); return; }
    if (blanco(ev).closest('[data-pe-rdf]')) { colorRdf = !colorRdf; ocultos = new Set(); repintarQuieto(); return; }
    const co = blanco(ev).closest('[data-pe-color]');
    if (co) { const k = co.dataset.peColor; if (ocultos.has(k)) ocultos.delete(k); else ocultos.add(k); repintarQuieto(); return; }
    const fo = blanco(ev).closest('[data-pe-fondo]');
    if (fo) {
      const k = planta || '';
      if (fo.dataset.peFondo === 'pdf') { conPdf.add(k); conModelo.delete(k); } else { conPdf.delete(k); conModelo.add(k); }
      elegida = null; mat = null; zoom = 1; pintar();
      return;
    }
    const ub = blanco(ev).closest('[data-pe-ubicar]');
    if (ub) { empezarAUbicar(ub.dataset.peUbicar); return; }
    if (blanco(ev).closest('[data-pe-ubicar-cancelar]')) { ubicando = null; repintarQuieto(); return; }
    if (blanco(ev).closest('[data-pe-confirmar-ifc]')) { confirmarPropuesta(); return; }
    const dm = blanco(ev).closest('[data-pe-deshacer-mover]');
    if (dm) { dm.disabled = true; deshacerMovido(dm.dataset.peDeshacerMover); return; }
    /* 17-nov (v2): la ficha del que se ubica, sin dejar de ubicar: el siguiente toque en el plano sigue diciendo su sitio. */
    if (blanco(ev).closest('[data-pe-ubicar-ficha]')) { if (ubicando) { elegida = ubicando.id; mat = null; mostrarHoja(); asomar(elegida); } return; }
    const rf = blanco(ev).closest('[data-pe-ir-ref]');
    if (rf) { centrar(rf.dataset.peIrRef); return; }
    const fr = blanco(ev).closest('[data-pe-franja]');
    if (fr) { verFranja = !verFranja; repintarQuieto(); return; }
    /* Una píldora «+N»: acerca hacia ella hasta que sus TAG caben. */
    const gr = blanco(ev).closest('[data-pe-grupo]');
    if (gr) {
      const [marco] = marcoYLienzo();
      if (!marco) return;
      const r = marco.getBoundingClientRect(); const b = gr.getBoundingClientRect();
      irAZoom(Math.min(ZOOM_MAX, Math.max(zoom * 2.2, zoom + 1.5)), b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top);
      return;
    }
    const z = blanco(ev).closest('[data-pe-zoom]');
    if (z) {
      /* Con un equipo elegido a la vista, se acerca hacia él y no hacia el centro. */
      const v = Number(z.dataset.peZoom);
      const p = plantaActual();
      const e = elegida && p && p.equipos.find((x) => x.id === elegida && x.x !== null);
      const [marco, lienzo] = marcoYLienzo();
      let cx; let cy;
      if (e && marco && lienzo) {
        const px = e.x * lienzo.offsetWidth + lienzo.offsetLeft - marco.scrollLeft;
        const py = e.y * lienzo.offsetHeight + lienzo.offsetTop - marco.scrollTop;
        if (px >= 0 && px <= marco.clientWidth && py >= 0 && py <= marco.clientHeight) { cx = px; cy = py; }
      }
      irAZoom(v === 0 ? 1 : zoom * (v > 0 ? 1.6 : 1 / 1.6), cx, cy);
      return;
    }
    if (blanco(ev).closest('[data-pe-asa]')) { tocarAsa(); return; }
    if (blanco(ev).closest('[data-pe-resumen]')) { irADocs(); return; }
    if (blanco(ev).closest('[data-pe-cerrar]')) { elegida = null; mat = null; for (const el of $raiz.querySelectorAll('[data-pe-mat]')) el.classList.remove('elegida'); marcarElegida(); mostrarHoja(); return; }
    const capa = blanco(ev).closest('[data-pe-capa]');
    if (capa) { const k = capa.dataset.peCapa; if (capasOff.has(k)) capasOff.delete(k); else capasOff.add(k); repintarQuieto(); return; }
    const li = blanco(ev).closest('[data-pe-lista]');
    if (li) { lista = li.dataset.peLista; repintarQuieto(); return; }
    const gs = blanco(ev).closest('[data-pe-guardar-serie]');
    if (gs) {
      const inp = $raiz.querySelector('[data-pe-serie]');
      gs.disabled = true;
      C.postJson('api/materiales', { id: gs.dataset.peGuardarSerie, numSerie: inp ? inp.value.trim() : '' })
        .then(async (r) => { if (r && r.ok === false) throw new Error(r.error); C.aviso('Nº de serie guardado.', 'bien'); await cargar(); repintarQuieto(); })
        .catch((e) => { gs.disabled = false; C.aviso(e.message); });
      return;
    }
    const mm = blanco(ev).closest('[data-pe-mat]') || blanco(ev).closest('[data-pe-fila-mat]');
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
    const ver = blanco(ev).closest('[data-pe-ver]');
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
    const inc = blanco(ev).closest('[data-pes-incidencia]');
    if (inc) { abrirIncidencia(inc.dataset.pesIncidencia); return; }
    const ac = blanco(ev).closest('[data-pe-accion]');
    if (ac) { irAlEquipo(ac.dataset.peAccion); return; }
    /* 13-nov (JC, en reunión): desde el plano se llega a SU FICHA COMPLETA (checklist, toma de datos, estanqueidad, balanceo…).
       14-nov (JC: «al pulsar el equipo no resalta en el plano»): el primer toque lo RESALTA en el plano y abre abajo su hoja con
       lo imprescindible (estado de Cx, sala, conjunto, documentos con «Ver PDF», puesta en marcha y garantía, sus fichas) y el
       botón «Ficha completa»; tocarlo otra vez también la abre. Al volver, el plano sigue con su planta, zoom, sitio y resaltado. */
    const mk = blanco(ev).closest('[data-pe-marca]') || blanco(ev).closest('[data-pe-fila]');
    if (mk) {
      const id = mk.dataset.peMarca || mk.dataset.peFila;
      if (typeof window.CX_COMMISSIONING_IR === 'function' && id === elegida) { irAlEquipo('equipo'); return; }
      if (mk.closest('[data-pe-franja-lista]')) { verFranja = false; const l = mk.closest('[data-pe-franja-lista]'); const b = $raiz.querySelector('[data-pe-franja]'); if (b) b.setAttribute('aria-expanded', 'false'); l.remove(); }
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
  /*
   * EL PLANO EN LA FICHA DEL EQUIPO (15-nov-2026, JC con la ficha de UI-N10-SALA IT T01 en el iPhone: «tiene que aparecer
   * un pantallazo del plano con el equipo abierto»). Arriba de la ficha, bajo el nº de serie y el aviso de bloqueo, un
   * recorte de su planta centrado en el equipo, acercado, con el equipo (y su conjunto) resaltado y su rótulo abierto; los
   * vecinos con su color de estado (naranja si llevan incidencia abierta, «no pedido» en gris clarito…): el MISMO pintor
   * y los mismos datos que el plano (api/plano-equipos por planta, que el teléfono sirve también sin conexión).
   * Nada de imagen nueva: el fondo es el SVG de la planta que ya usa el plano, recortado por el marco. Al tocarlo se abre
   * el plano entero en esa planta con el equipo elegido (data-cx="en-plano", commissioning.js). Sin posición en el plano,
   * no se pinta nada: ni hueco ni texto.
   */
  const MINI_ALTO = 184;
  const miniPlantas = new Map(); /* `${obra}|${planta}` → planta entera (las dos últimas) */
  const miniFondos = new Map(); /* id del plano → promesa de su objectURL (una descarga por plano) */
  const urlMini = (pl) => `api/plano-equipos?obra=${encodeURIComponent(C.obraId())}&ligero=1&porPlanta=1&soloIfc=1&planta=${encodeURIComponent(pl || '')}`;
  /* El sitio de un equipo en una planta entera, con la regla de la pestaña Cx: el modelo IFC si la planta lo tiene, si no
     el plano PDF. Los de la franja «sin sala, por confirmar» no van sobre el dibujo, tampoco aquí. */
  function vistaMini(p) {
    if (!p || p.parcial) return null;
    if (p.ifc && p.ifc.plano) {
      const pos = p.ifc.pos || {}; const deFranja = new Set(p.ifc.franja || []);
      return { plano: p.ifc.plano, esIfc: true, p, equipos: p.equipos.map((e) => (pos[e.id] && !deFranja.has(e.id) ? { ...e, x: pos[e.id][0], y: pos[e.id][1] } : { ...e, x: null, y: null })) };
    }
    if (!p.plano) return null;
    return { plano: p.plano, esIfc: false, p, equipos: p.equipos.map((e) => (e.franja ? { ...e, x: null, y: null } : e)) };
  }
  const colocadoMini = (v, ids) => (v ? ids.find((i) => v.equipos.some((e) => e.id === i && e.x !== null && e.x !== undefined)) || null : null);
  const tieneIds = (x, ids) => ids.some((i) => (x.ifc && ((x.ifc.ids || []).includes(i) || (x.ifc.pos && x.ifc.pos[i]))) || (x.enPlano || []).includes(i));
  async function plantaMini(ids, nombre) {
    const obra = C.obraId();
    const busca = (ps) => { for (const x of ps || []) { const v = vistaMini(x); const quien = colocadoMini(v, ids); if (quien) return { v, quien }; } return null; };
    const ya = busca(plantas()) || busca([...miniPlantas].filter(([k]) => k.startsWith(`${obra}|`)).map(([, x]) => x));
    if (ya) return ya;
    const pide = async (pl) => {
      const r = await C.pedir(urlMini(pl));
      if (!r || !r.ok || !Array.isArray(r.plantas)) return null;
      if (r.iconos) iconosMini = r.iconos;
      for (const x of r.plantas) if (!x.parcial) { miniPlantas.set(`${obra}|${x.planta || ''}`, x); while (miniPlantas.size > 2) miniPlantas.delete(miniPlantas.keys().next().value); }
      return r;
    };
    const r = await pide(nombre || '');
    if (!r) return null;
    const hay = busca(r.plantas);
    if (hay) return hay;
    /* La planta de la ficha no es la del plano (o no se pidió bien): la que dice el servidor que lo tiene colocado. */
    const otra = r.plantas.find((x) => x.parcial && tieneIds(x, ids));
    if (!otra) return null;
    const r2 = await pide(otra.planta || '');
    return r2 ? busca(r2.plantas) : null;
  }
  function fondoMini(plano) {
    const id = plano.id;
    if (!miniFondos.has(id)) {
      miniFondos.set(id, fetch(`api/plano-equipos/imagen?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null));
      while (miniFondos.size > 4) miniFondos.delete(miniFondos.keys().next().value);
    }
    return miniFondos.get(id);
  }
  function htmlMini(v, quien, ids, W) {
    const V = window.VISTA_PLANO;
    const pl = v.plano;
    const e = v.equipos.find((x) => x.id === quien);
    const g = V && V.encuadreMiniatura ? V.encuadreMiniatura({ W, H: MINI_ALTO, ancho: pl.ancho, alto: pl.alto, res: v.esIfc ? Number(pl.res) || 0.1 : 0, x: e.x, y: e.y }) : null;
    if (!g) return '';
    /* Resaltado: el equipo y las unidades de su conjunto que estén en esta planta. */
    const resaltar = new Set([quien, ...ids, ...(e.miembros || []).filter((m) => m.aqui).map((m) => m.id)]);
    const margen = 24;
    const dentro = (x) => { const px = x.x * g.lw + g.left; const py = x.y * g.lh + g.top; return px > -margen && px < W + margen && py > -margen && py < MINI_ALTO + margen; };
    const visibles = v.equipos.filter((x) => x.x !== null && x.x !== undefined && (resaltar.has(x.id) || dentro(x)));
    /* El rótulo del equipo a la derecha, a la izquierda, encima o debajo: donde no tape otro equipo (la otra unidad del split). */
    const choca = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const cajasEq = visibles.filter((x) => x.id !== quien).map((x) => { const px = x.x * g.lw + g.left; const py = x.y * g.lh + g.top; const r = resaltar.has(x.id) ? 15 : 10; return { x0: px - r, x1: px + r, y0: py - r, y1: py + r }; });
    const wr = anchoTexto(e.tag || '', LETRA_TAG_ELEGIDO) + 12; const hr = 18;
    const sitios = [
      ['', { x0: g.px + 16, x1: g.px + 16 + wr, y0: g.py - hr / 2, y1: g.py + hr / 2 }],
      ['tag-izq', { x0: g.px - 16 - wr, x1: g.px - 16, y0: g.py - hr / 2, y1: g.py + hr / 2 }],
      ['tag-arr', { x0: g.px - wr / 2 + 4, x1: g.px + wr / 2 + 4, y0: g.py - 16 - hr, y1: g.py - 16 }],
      ['tag-abj', { x0: g.px - wr / 2 + 4, x1: g.px + wr / 2 + 4, y0: g.py + 16, y1: g.py + 16 + hr }],
    ];
    const cabe = (c) => c.x0 >= 2 && c.x1 <= W - 2 && c.y0 >= 2 && c.y1 <= MINI_ALTO - 28;
    const [claseTag, cajaTag] = sitios.find(([, c]) => cabe(c) && !cajasEq.some((q) => choca(c, q))) || sitios.find(([, c]) => cabe(c)) || sitios[0];
    const marcas = visibles
      .map((x) => `<span class="marca-boca bq-${bq(x)}${incClase(x)}${resaltar.has(x.id) ? ' elegida' : ''}${x.id === quien ? ` pe-mini-este ${claseTag}` : ''}" style="left:${x.x * 100}%;top:${x.y * 100}%">${simbolo(x.icono)}${incMarca(x)}${x.id === quien ? `<span class="rotulo-boca">${esc(x.tag)}</span>` : ''}</span>`).join('');
    /* El nombre de las salas que caen dentro, sin pisarse ni pisar el rótulo ni los equipos. */
    const puestas = [cajaTag, ...cajasEq, { x0: g.px - 15, x1: g.px + 15, y0: g.py - 15, y1: g.py + 15 }];
    const salas = salasDe(v.p.plano === pl ? v.p : { ...v.p, plano: pl }).map((r) => {
      const px = r.x * g.lw + g.left; const py = r.y * g.lh + g.top; const w = anchoTexto(r.t, LETRA_SALA) + 4;
      const c = { x0: px - w / 2, x1: px + w / 2, y0: py - 8, y1: py + 8 };
      if (c.x0 < 2 || c.x1 > W - 2 || c.y0 < 2 || c.y1 > MINI_ALTO - 26) return '';
      if (puestas.some((q) => choca(c, q))) return '';
      puestas.push(c);
      return `<span class="pe-sala ver" style="left:${r.x * 100}%;top:${r.y * 100}%">${esc(r.t)}</span>`;
    }).join('');
    const estado = conInc(e) ? (IP ? IP.NOMBRE : 'Con incidencia') : conRes(e) ? IP.NOMBRE_RESUELTA : NOMBRE[bq(e)];
    const punto = puntoInc(e);
    const planta = v.p.planta || '';
    return `<button type="button" class="pe-mini" data-cx="en-plano" data-eq="${esc(quien)}" data-paleta="vidaire" style="height:${MINI_ALTO}px" aria-label="${esc(`Abrir el plano de ${planta || 'la planta'} con ${e.tag} elegido`)}">
      <span class="pe-lienzo" data-pe-mini-lienzo style="width:${g.lw.toFixed(1)}px;height:${g.lh.toFixed(1)}px;left:${g.left.toFixed(1)}px;top:${g.top.toFixed(1)}px"><img alt="" draggable="false" hidden>${salas}${marcas}</span>
      <span class="pe-mini-info"><i class="pe-punto bq-punto-${punto}"></i>${esc(estado)}${e.sala ? ` · ${esc(e.sala)}` : ''}</span>
      <span class="pe-mini-ir">${esc(planta ? `Plano ${planta.split(' · ')[0]}` : 'Plano')} ›</span>
    </button>`;
  }
  const ESTILO_MINI = `
  .pe-mini{position:relative;display:block;width:100%;margin:8px 0 10px;padding:0;overflow:hidden;border:1px solid var(--borde);border-radius:10px;background:var(--vd-lienzo);color:inherit;font:inherit;text-align:left;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none;min-height:0}
  .pe-mini .pe-lienzo{position:absolute;margin:0;pointer-events:none}
  .pe-mini .pe-lienzo img{position:absolute;inset:0;width:100%;height:100%}
  .pe-mini .pe-lienzo .marca-boca{width:18px}
  .pe-mini .pe-lienzo .marca-boca.elegida{width:28px!important}
  .pe-mini .pe-sala{font-size:10.5px}
  .pe-mini .pe-lienzo .marca-boca.pe-mini-este{z-index:9}
  #app .pe-mini .pe-lienzo .marca-boca.tag-izq .rotulo-boca{margin:0;left:auto;right:calc(100% + 4px)}
  #app .pe-mini .pe-lienzo .marca-boca.tag-arr .rotulo-boca,#app .pe-mini .pe-lienzo .marca-boca.tag-abj .rotulo-boca{margin:0}
  .pe-mini-info,.pe-mini-ir{position:absolute;bottom:6px;z-index:10;display:inline-flex;align-items:center;gap:5px;max-width:calc(100% - 110px);padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--borde);font-size:12px;line-height:18px;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pe-mini-info{left:6px}
  .pe-mini-ir{right:6px;max-width:none;color:var(--acento-fuerte,var(--acento));font-weight:700;border-color:var(--acento)}
  .pe-mini:focus-visible{outline:2px solid var(--acento);outline-offset:2px}`;
  /** Pinta la miniatura en `$el` (un hueco de la ficha). `ids`: el equipo y las unidades de su conjunto; `nombrePlanta`: la de la ficha. */
  async function miniatura($el, ids, nombrePlanta) {
    if (!$el) return false;
    ids = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    const quitar = () => { if ($el.isConnected) $el.remove(); return false; };
    if (!ids.length || !C.obraId()) return quitar();
    ponerEstilo();
    if (!document.getElementById('estilo-pe-mini')) { const s = document.createElement('style'); s.id = 'estilo-pe-mini'; s.textContent = ESTILO_MINI; document.head.appendChild(s); }
    let r = null;
    try { r = await plantaMini(ids, nombrePlanta); } catch { r = null; }
    if (!r || !$el.isConnected) return quitar();
    const W = Math.round(($el.parentElement || $el).getBoundingClientRect().width) || 358;
    const html = htmlMini(r.v, r.quien, ids, W);
    if (!html) return quitar();
    $el.outerHTML = html;
    const btn = document.querySelector(`.pe-mini[data-eq="${CSS.escape(r.quien)}"]`);
    const img = btn && btn.querySelector('img');
    const url = await fondoMini(r.v.plano);
    if (img && url) { img.src = url; img.hidden = false; }
    return true;
  }

  window.CX_PLANO_EQUIPOS = { abrir: ($app) => { propio = false; compacto = false; return abrir($app); }, volver: ($app) => { compacto = false; return volver($app); }, verEquipo: ($app, id) => { propio = false; compacto = false; return verEquipo($app, id); }, montar, ir, miniatura };
})();
