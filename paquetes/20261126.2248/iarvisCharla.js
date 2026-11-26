'use strict';
/*
 * HABLAR CON IARVIS COMO CON UNA PERSONA (11-nov-2026, bloc 1011-hablar-con-iarvis).
 *
 * JC, 10-nov: «con Iarvis en esas apps [Gestor y Cálculo de Instalaciones] debo de poder hablar
 * igual que como hablo contigo». «Igual» es la NATURALIDAD, no el alcance: conversación libre en
 * español, con memoria de lo hablado en la sesión, que entienda órdenes a medias y frases sueltas,
 * que pida lo que le falte en vez de fallar, que encadene varios pasos con las herramientas de la
 * app y que explique lo que hace. El alcance no cambia (blindaje.js: solo usar la app, en su rol y
 * su organización; fueraDeUso a la entrada y filtrarSalida a la salida, en la edge function).
 *
 * LO QUE SE COMPARTE, UNA SOLA VEZ, entre Obras (escritorio y web), Cx (móvil), Gestor y Cálculo:
 *   · el motor: la edge function `iarvis` de cxobra-sync (shared/ia/motor.js, Claude);
 *   · el historial: ia_mensajes, con la conversación de la sesión en contexto.conversacion;
 *   · las herramientas: las de cada app, por rol, leído en el servidor (registroAcciones.js para
 *     escritorio y web, catalogo.js para el móvil; Gestor y Cálculo enchufan las suyas aquí);
 *   · las pautas de conversación: este fichero (pautasCharla), una por app.
 *
 * Puro: sin red, sin base, sin DOM. Lo usan shared/ia/conversaciones.js (el id de la conversación)
 * y la edge function (scripts/empaquetarIarvis.js lo copia a supabase/functions/iarvis/charla.js).
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisCharla = API;
})(() => {
  /* La misma regla que el panel (renderer/iarvis.js · CADUCA_MS). 26-nov (JC: «el chat con Iarvis puede ser infinito…
     ¿cómo hacemos para que no consuma tantos tokens?»): conversaciones por tema; 30 minutos sin escribir, conversación
     nueva (antes 2 horas). Cambiar de obra o de equipo también empieza otra (idConversacion · tema). */
  const CADUCA_MS = 30 * 60 * 1000;
  const CLAVE = 'vidaire.iarvis.conversacion';
  const MAX_TURNOS = 12;
  const MAX_CARACTERES = 14000;
  const MAX_PASOS = 4;

  const APPS = {
    obras: { nombre: 'Vidaire Obras', que: 'la gestión de la obra: presupuestos, compras, certificaciones, planificación, commissioning, documentación, reclamaciones' },
    cx: { nombre: 'Vidaire Cx (el móvil de obra)', que: 'el trabajo en obra desde el teléfono: equipos, fichas, pruebas, fotos, incidencias' },
    gestor: { nombre: 'Vidaire Gestor', que: 'la gestión de la empresa: clientes, ofertas, obras y su seguimiento' },
    calculo: { nombre: 'Vidaire Cálculo de Instalaciones', que: 'el cálculo de instalaciones (climatización, ventilación, cargas térmicas, conductos, tuberías) y su normativa (RITE, CTE)' },
  };
  const appDe = (app) => (APPS[app] ? app : 'obras');

  const uuid = () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  /**
   * Cómo se habla con Iarvis en cada app. Va en el `sistema` de la llamada, delante de las pautas
   * de la casa y de PAUTAS_BLINDAJE (que pone la edge function, y que mandan sobre esto).
   */
  function pautasCharla(app) {
    const a = APPS[appDe(app)];
    return `Estás en ${a.nombre}, para ${a.que}.
CÓMO HABLAS: como un compañero que conoce bien la app, en el idioma de la persona (normalmente español), con naturalidad y sin menús ni comandos. Frases cortas; nada de «como modelo de IA» ni de repetir la pregunta.
LO HABLADO CUENTA: los mensajes anteriores son esta misma conversación. Entiende las frases sueltas y las órdenes a medias por lo que se ha dicho antes («y la otra», «ponle 3», «lo mismo para la planta 2», «hazlo»): si se entiende, sigue sin preguntar; nunca hagas repetir lo que ya ha dicho.
SI FALTA ALGO: no falles ni des una lista de requisitos. Pregunta UNA cosa concreta, la que de verdad falta, y propón el valor más probable si lo hay («¿En la UTA-02, como antes?»).
SI TE PIDE HACER ALGO: usa las herramientas de la app que tengas (una por paso, varias si lo pedido son varios pasos, en orden). Di en una o dos frases qué vas a hacer y por qué; la persona confirma cada paso con su botón, tú no escribes nada por tu cuenta. Si no tienes herramienta para eso, di en qué pantalla se hace y cómo, paso a paso.
SI SOLO PREGUNTA: contesta, sin herramientas. Si la respuesta lleva pasos en la app, explícalos en orden.
EL ALCANCE NO CAMBIA: hablar con naturalidad no amplía lo que puedes hacer ni contar. Solo el uso de la app, en el rol y la organización de quien pregunta.`;
  }

  /**
   * El id de la conversación de esta sesión, guardado en `almacen` (localStorage o equivalente).
   * Pasados 30 minutos sin hablar, con `nueva` o con otro `tema` (otra obra u otro equipo, temaDe), otra
   * conversación. Sin almacén, el que haya en memoria.
   */
  let enMemoria = null;
  function idConversacion({ almacen = null, ahora = Date.now(), nueva = false, tema = null } = {}) {
    let c = null;
    try { c = almacen ? JSON.parse(almacen.getItem(CLAVE) || 'null') : enMemoria; } catch { c = null; }
    const viva = c && typeof c.id === 'string' && c.id && Number(c.ultimo) && ahora - Number(c.ultimo) < CADUCA_MS;
    /* Otro tema solo corta si los dos se saben: una pregunta sin obra no rompe la conversación de la obra. */
    const otroTema = Boolean(tema && c && c.tema && c.tema !== tema);
    const sigue = viva && !nueva && !otroTema ? c : { id: uuid() };
    const guardar = { id: sigue.id, ultimo: ahora, tema: tema || (sigue === c ? c.tema || null : null) };
    try { if (almacen) almacen.setItem(CLAVE, JSON.stringify(guardar)); } catch { /* lleno */ }
    enMemoria = guardar;
    return guardar.id;
  }

  /**
   * El tema de una pregunta: la obra y, si se está mirando uno, el equipo. Cambiar de tema = conversación nueva.
   *   temaDe({ obraId, mirando }) → 'obra:ID' | 'obra:ID|equipo:TAG' | null
   * Solo ids y TAG (nunca nombres de obra: dos obras pueden llamarse igual).
   */
  function temaDe({ obraId = null, mirando = null, equipo = null } = {}) {
    const m = mirando && typeof mirando === 'object' ? mirando : {};
    /* El equipo (o el caso del claim) que se mira, si la pantalla lo dice. */
    const eq = [equipo, m.tag, m.equipo, m.equipoId, m.conjunto, m.hechoId].find((v) => typeof v === 'string' && v.trim());
    if (!obraId && !eq) return null;
    return `${obraId ? `obra:${String(obraId).slice(0, 80)}` : 'obra:-'}${eq ? `|equipo:${eq.trim().toUpperCase().slice(0, 60)}` : ''}`;
  }

  const fecha = (x) => { const t = Date.parse(x || ''); return Number.isFinite(t) ? t : 0; };

  /** Lo que Iarvis propuso en un turno, en una línea (para que «el segundo» se entienda luego). */
  function resumenPasos(propuesta) {
    const pasos = propuesta && Array.isArray(propuesta.pasos) ? propuesta.pasos : [];
    if (!pasos.length) return '';
    return `\n(Propuse, para que la persona lo confirme: ${pasos.map((p, i) => `${i + 1}) ${String(p.texto || p.id || '').slice(0, 120)}`).join('; ')}.)`;
  }

  /**
   * Los turnos anteriores de ESTA conversación, listos para el motor (lo más antiguo primero).
   *   filas: [{ pregunta, respuesta, creado, conversacion?, propuesta?, resumen? }] (la más nueva primero, como las da la base)
   *   conversacion: el id de la conversación de la pregunta de ahora (o null: cliente de antes)
   *   ahora: la fecha de la pregunta de ahora (ms)
   *   limpiar(turno) → { pregunta, respuesta } | null   (el blindaje de la función: fuera lo vetado)
   * Sin id de conversación (clientes de antes del 11-nov), cuenta lo de los últimos 30 minutos.
   * Corta por turnos y por caracteres: lo más reciente es lo que se queda.
   *
   * cortePara devuelve además lo que NO cabe (26-nov): `cortados`, los turnos de esta conversación que se quedan
   * fuera (lo más antiguo primero), y `guardado`, el último resumen que ya tiene la conversación (contexto.resumen_charla
   * de una fila suya). Con eso la función resume UNA vez lo cortado (tramoParaResumir) en vez de olvidarlo sin avisar.
   */
  function cortePara(filas, { conversacion = null, ahora = Date.now(), limpiar = (t) => t, maxTurnos = MAX_TURNOS, maxCaracteres = MAX_CARACTERES } = {}) {
    const lista = Array.isArray(filas) ? filas : [];
    const elegidas = [];
    const cortados = [];
    let guardado = null;
    let usados = 0;
    let anterior = ahora;
    let lleno = false;
    for (const f of lista) {
      if (!f) continue;
      const t = fecha(f.creado);
      if (conversacion) {
        if (f.conversacion !== conversacion) continue;
      } else if (!t || ahora - t > CADUCA_MS || anterior - t > CADUCA_MS) break;
      if (!guardado) guardado = resumenDe(f.resumen);
      if (!f.pregunta || !f.respuesta) continue;
      const l = limpiar({ pregunta: String(f.pregunta), respuesta: String(f.respuesta) + resumenPasos(f.propuesta) });
      if (!l) continue;
      const largo = l.pregunta.length + l.respuesta.length;
      if (!lleno && (elegidas.length >= maxTurnos || (elegidas.length && usados + largo > maxCaracteres))) lleno = true;
      if (t) anterior = t;
      if (lleno) { cortados.push({ ...l, creado: f.creado || null }); continue; }
      usados += largo;
      elegidas.push(l);
    }
    const mensajes = [];
    for (const l of elegidas.reverse()) {
      mensajes.push({ role: 'user', content: l.pregunta.slice(0, maxCaracteres) });
      mensajes.push({ role: 'assistant', content: l.respuesta.slice(0, maxCaracteres) });
    }
    return { mensajes, cortados: cortados.reverse(), guardado };
  }
  function historiaPara(filas, opciones = {}) { return cortePara(filas, opciones).mensajes; }

  /* ── EL RESUMEN AL CORTAR (26-nov) ──
     Pasado el corte (12 turnos o 14 000 caracteres), lo que se queda fuera se resume en 3-4 líneas con el modelo barato,
     una sola vez por tramo, y se guarda en la conversación (contexto.resumen_charla de la fila de ahora:
     { texto, hasta, turnos }). La siguiente pregunta lo reutiliza; solo si se corta algo más nuevo que `hasta` se
     vuelve a resumir (el resumen de antes + lo nuevo cortado). */
  const MAX_RESUMEN = 700;
  const MAX_TRAMO = 9000;
  function resumenDe(r) {
    if (!r) return null;
    let o = r;
    if (typeof r === 'string') { try { o = JSON.parse(r); } catch { return null; } }
    if (!o || typeof o.texto !== 'string' || !o.texto.trim()) return null;
    return { texto: o.texto.slice(0, MAX_RESUMEN), hasta: o.hasta || null, turnos: Number(o.turnos) || 0 };
  }
  /** Lo cortado que el resumen guardado todavía no cubre (vacío: no hace falta llamar a nadie). */
  function tramoParaResumir(cortados, guardado = null) {
    const lista = Array.isArray(cortados) ? cortados : [];
    const hasta = guardado && guardado.hasta ? fecha(guardado.hasta) : 0;
    return hasta ? lista.filter((t) => fecha(t.creado) > hasta) : lista;
  }
  const PAUTAS_RESUMEN = `Resumes una conversación de trabajo entre una persona y Iarvis (el ayudante de la app de obra Vidaire) para que Iarvis la recuerde sin releerla entera.
Escribe 3 o 4 líneas como mucho, en español, sin saludos ni adornos: de qué se ha hablado, las cifras, códigos (TAG, salas, plantas, partidas) y decisiones que salieron, y lo que quedó pendiente o propuesto.
Nada que no esté en la conversación. Sin datos personales ni de otras empresas.`;
  /** Lo que se le pide al modelo barato: el resumen de antes (si hay) y los turnos nuevos cortados. */
  function pedirResumen({ previo = null, turnos = [] } = {}) {
    const lineas = [];
    let usados = 0;
    for (const t of [...turnos].reverse()) { /* si no cabe todo, lo más reciente del tramo */
      const l = `Persona: ${String(t.pregunta).slice(0, 1200)}\nIarvis: ${String(t.respuesta).slice(0, 1800)}`;
      if (usados + l.length > MAX_TRAMO && lineas.length) break;
      usados += l.length;
      lineas.unshift(l);
    }
    const antes = previo && previo.texto ? `Resumen de lo anterior:\n${previo.texto}\n\n` : '';
    return { sistema: PAUTAS_RESUMEN, mensaje: `${antes}Conversación que sigue (lo más antiguo primero):\n\n${lineas.join('\n\n')}\n\nEl resumen, en 3-4 líneas:` };
  }
  /** La respuesta del modelo → el resumen que se guarda (4 líneas, 700 caracteres). */
  function limpiarResumen(texto) {
    const l = String(texto || '').split(/\n+/).map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 4);
    const t = l.join('\n');
    return t.length > MAX_RESUMEN ? `${t.slice(0, MAX_RESUMEN - 1)}…` : t;
  }
  /** El resumen como pauta para el sistema de la llamada (va delante de los turnos que sí caben). */
  function pautaResumen(resumen) {
    const r = resumenDe(resumen);
    return r ? `LO HABLADO ANTES EN ESTA CONVERSACIÓN (resumen; esos mensajes ya no van enteros):\n${r.texto}` : '';
  }

  /* ── EL HISTORIAL PLEGADO (26-nov) ──
     Las conversaciones anteriores, cada una con su título (su primera pregunta), plegadas: nada de lista infinita
     (regla pantallas-sin-scroll). Agrupa por id de conversación y, sin él (respuestas locales, clientes de antes),
     por silencios de más de 30 minutos. */
  const MAX_TITULO = 60;
  function tituloDe(pregunta) {
    const t = String(pregunta || '').replace(/\s+/g, ' ').trim();
    if (!t) return 'Conversación';
    return t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1).replace(/\s+\S*$/, '')}…` : t;
  }
  /**
   * filas (la más nueva primero) → [{ id, titulo, desde, hasta, turnos, coste, filas }] (la más nueva primero;
   * `filas`, la más nueva primero, como el panel). `coste`: la suma de contexto.coste_usd (null si no hay ninguno).
   */
  function agruparConversaciones(filas) {
    const lista = (Array.isArray(filas) ? filas : []).filter((f) => f && (f.pregunta || f.respuesta))
      .slice().sort((a, b) => String(a.creado || '9').localeCompare(String(b.creado || '9')));
    const grupos = [];
    let g = null;
    for (const f of lista) {
      const t = fecha(f.creado);
      const conv = typeof f.conversacion === 'string' && f.conversacion ? f.conversacion : null;
      const sigue = g && (conv && g.conv ? conv === g.conv : (!t || !g.ultimo || t - g.ultimo < CADUCA_MS));
      if (!sigue) { g = { conv, ultimo: t, filas: [] }; grupos.push(g); }
      if (conv && !g.conv) g.conv = conv;
      if (t) g.ultimo = t;
      g.filas.push(f);
    }
    return grupos.map((x) => {
      const primera = x.filas.find((f) => f.pregunta) || x.filas[0];
      const costes = x.filas.map((f) => Number(f.coste)).filter((n) => Number.isFinite(n) && n > 0);
      return {
        id: x.conv || `t:${primera.id || primera.creado || ''}`,
        titulo: tituloDe(primera.pregunta || primera.respuesta),
        desde: x.filas[0].creado || null,
        hasta: x.filas[x.filas.length - 1].creado || null,
        turnos: x.filas.length,
        coste: costes.length ? Math.round(costes.reduce((a, b) => a + b, 0) * 1e6) / 1e6 : null,
        filas: x.filas.slice().reverse(),
      };
    }).reverse();
  }

  /* ── EL CONTADOR (26-nov) ── «Llevas N de 300 este mes» (tope_mensajes_mes, cx_ia_mensajes_mes). */
  function textoUso(uso) {
    if (!uso || !Number.isFinite(Number(uso.llevadas))) return '';
    const n = Number(uso.llevadas);
    const tope = Number(uso.tope);
    return Number.isFinite(tope) && tope > 0 ? `Llevas ${n} de ${tope} este mes` : `Llevas ${n} este mes`;
  }
  /** El coste de una conversación, para el administrador: «0,04 $». */
  function textoCoste(usd) {
    const n = Number(usd);
    if (!Number.isFinite(n) || n <= 0) return '';
    return `${n < 0.01 ? '< 0,01' : n.toFixed(2).replace('.', ',')} $`;
  }

  /* ── RESPUESTAS SIN MODELO (26-nov) ──
     Las preguntas de dato directo que ya contesta lo que la app ha sacado de la obra (contexto.datos_obra,
     electron/data/iarvisDatosObra.js, con el alcance del rol): «¿cuántos equipos me faltan por la toma de datos
     en N00?», «¿cuántas incidencias abiertas hay?». Se contestan aquí, sin llamar al modelo. Si la pregunta lleva
     algo más («y por qué», «compara», «propón») o el dato no está, null: sigue el camino de siempre. */
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const CUANTOS = /\b(cuant[oa]s|numero de|n[ºo°] de|how many)\b/;
  const MAS_QUE_DATO = /\b(por que|porque|explica|compara|propon|recomienda|que hago|como (se|lo|puedo)|y si|analiza|revisa|lista|dime cuales|cuales son|que equipos)\b/;
  function plantaDe(t) {
    const m = t.match(/\b(?:planta\s*)?([ns])\s*-?\s*(\d{1,2})\b/);
    if (!m) return null;
    return `${m[1].toUpperCase()}${m[2].padStart(2, '0')}`;
  }
  function respuestaDirecta(pregunta, datos) {
    const t = norm(pregunta);
    if (!datos || typeof datos !== 'object' || !CUANTOS.test(t) || MAS_QUE_DATO.test(t) || t.length > 160) return null;
    if ((t.match(/\?/g) || []).length > 1 || /\by (cuant|que|cual)/.test(t)) return null; /* dos preguntas en una */
    const cx = datos.commissioning && typeof datos.commissioning === 'object' ? datos.commissioning : null;
    const fin = (cifra, texto, pantalla) => `**${cifra}** ${texto}${pantalla ? ` [[pantalla:${pantalla}]]` : ''}`;
    if (cx && /\b(toma de datos|ficha(s)? (de )?pm|puesta en marcha)\b/.test(t) && /\b(faltan|quedan|pendientes?|sin hacer|por hacer)\b/.test(t)) {
      const p = plantaDe(t);
      if (p) {
        const fila = cx.porPlanta && cx.porPlanta[p];
        if (!fila) return null;
        return fin(fila.tomaPendiente, `${fila.tomaPendiente === 1 ? 'equipo' : 'equipos'} de ${p} sin la toma de datos (de ${fila.equipos} confirmados en la planta; ${fila.tomaHecha} hechos).`, 'commissioning');
      }
      if (!cx.tomaDeDatos) return null;
      const td = cx.tomaDeDatos;
      return fin(td.pendiente, `${td.pendiente === 1 ? 'equipo' : 'equipos'} sin la toma de datos (de ${cx.equipos} confirmados; ${td.hecha} hechos${td.conReservas ? `, ${td.conReservas} con reservas` : ''}).`, 'commissioning');
    }
    if (cx && /\bbalance/.test(t) && /\b(faltan|quedan|pendientes?|sin)\b/.test(t) && cx.pruebas && !plantaDe(t)) {
      const pr = cx.pruebas;
      return fin(pr.faltaBalanceoKpi, `equipos esperando solo el balanceo (${pr.sinBalancearTodavia} sin balancear en total; el resto aún con papeles).`, 'commissioning');
    }
    if (cx && /\bestanqueidad/.test(t) && /\b(faltan|quedan|pendientes?|sin)\b/.test(t) && cx.pruebas && !plantaDe(t)) {
      return fin(cx.pruebas.faltaEstanqueidad, `equipos con la prueba de estanqueidad pendiente (de ${cx.pruebas.pidenEstanqueidad} que la piden).`, 'commissioning');
    }
    const inc = datos.incidencias && typeof datos.incidencias === 'object' ? datos.incidencias : null;
    /* «sin cerrar» (abierta, en curso y terminada por revisar, 12-nov); «abiertas» a secas es un estado: va al modelo. */
    if (inc && /\bincidencias?\b/.test(t) && /\bsin cerrar\b/.test(t) && !/\bequipos?\b/.test(t) && !plantaDe(t) && Number.isFinite(Number(inc.sinCerrar))) {
      return fin(inc.sinCerrar, `${inc.sinCerrar === 1 ? 'incidencia' : 'incidencias'} sin cerrar (de ${inc.cuantas} en la obra).`, 'incidencias');
    }
    return null;
  }

  /**
   * Las herramientas que el motor eligió → los botones de los pasos. NO hacen nada al pulsarlos:
   * piden a la app su tarjeta de confirmación de siempre (rol, obra y «¿Lo hago?» los vuelve a
   * mirar la app), así que ninguno lleva `confirmado`.
   *   herramientas: [{ nombre, entrada }] tal cual del motor
   *   validar(nombre, entrada) → { id, parametros } | null   (registroAcciones o catalogo · desdeHerramienta)
   *   hacer: 'proponerRegistro' (escritorio y web) | 'catalogo' (móvil)
   *   texto(accion, herramienta) → la etiqueta del botón
   */
  function pasosDe(herramientas, { validar, hacer, texto = (a) => a.id } = {}) {
    if (!Array.isArray(herramientas) || typeof validar !== 'function' || !hacer) return [];
    const pasos = [];
    for (const h of herramientas) {
      if (pasos.length >= MAX_PASOS) break;
      const a = h && h.nombre ? validar(String(h.nombre), h.entrada || {}) : null;
      if (!a || !a.id) continue;
      const n = pasos.length + 1;
      pasos.push({ tipo: 'hacer', hacer, id: a.id, parametros: a.parametros || {}, texto: `${n}. ${String(texto(a, h) || a.id).slice(0, 90)}` });
    }
    /* Uno solo, sin número delante. */
    if (pasos.length === 1) pasos[0].texto = pasos[0].texto.replace(/^1\.\s*/, '');
    return pasos;
  }

  /**
   * La etiqueta del botón de un paso: lo que hace (la descripción de la herramienta, hasta el primer
   * punto o paréntesis) y lo que lo identifica («CLM-03», «UTA-02», el título), sin pasar de 90.
   */
  const CLAVES_ETIQUETA = ['reclamacion', 'codigo', 'equipo', 'tag', 'incidencia', 'ncr', 'tarea', 'seccion', 'titulo', 'nombre', 'seccionApp', 'destino'];
  function etiquetaPaso(accion, descripcion = '') {
    const que = String(descripcion || '').split(/[.(:]/)[0].trim() || String((accion && accion.id) || 'Hacerlo');
    const p = (accion && accion.parametros) || {};
    const cuales = CLAVES_ETIQUETA.map((k) => p[k]).filter((v) => typeof v === 'string' && v.trim()).slice(0, 2).map((v) => v.trim().slice(0, 40));
    const t = cuales.length ? `${que}: ${cuales.join(' · ')}` : que;
    return t.length > 90 ? `${t.slice(0, 89)}…` : t;
  }

  /** Si el motor solo eligió herramientas sin decir nada, una frase que explique qué hay. */
  function textoDePasos(pasos) {
    if (!pasos.length) return '';
    return pasos.length === 1
      ? 'Te lo dejo preparado: pulsa el botón y te enseño lo que voy a hacer antes de hacerlo.'
      : `Lo haría en ${pasos.length} pasos, en este orden. Pulsa cada uno y te enseño lo que voy a hacer antes de hacerlo.`;
  }

  return { pautasCharla, idConversacion, temaDe, historiaPara, cortePara, tramoParaResumir, pedirResumen, limpiarResumen, pautaResumen, resumenDe, agruparConversaciones, tituloDe, textoUso, textoCoste, respuestaDirecta, pasosDe, etiquetaPaso, textoDePasos, resumenPasos, APPS, CADUCA_MS, CLAVE, MAX_PASOS, MAX_TURNOS };
});
