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
  /* La misma regla que el panel (renderer/iarvis.js · CADUCA_MS): 2 horas sin hablar, conversación nueva. */
  const CADUCA_MS = 2 * 60 * 60 * 1000;
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
   * Pasadas 2 horas sin hablar (o con `nueva`), otra conversación. Sin almacén, uno nuevo cada vez
   * que se pide con `nueva` y, si no, el que haya en memoria.
   */
  let enMemoria = null;
  function idConversacion({ almacen = null, ahora = Date.now(), nueva = false } = {}) {
    let c = null;
    try { c = almacen ? JSON.parse(almacen.getItem(CLAVE) || 'null') : enMemoria; } catch { c = null; }
    const viva = c && typeof c.id === 'string' && c.id && Number(c.ultimo) && ahora - Number(c.ultimo) < CADUCA_MS;
    const sigue = viva && !nueva ? c : { id: uuid() };
    const guardar = { id: sigue.id, ultimo: ahora };
    try { if (almacen) almacen.setItem(CLAVE, JSON.stringify(guardar)); } catch { /* lleno */ }
    enMemoria = guardar;
    return guardar.id;
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
   *   filas: [{ pregunta, respuesta, creado, conversacion?, propuesta? }] (la más nueva primero, como las da la base)
   *   conversacion: el id de la conversación de la pregunta de ahora (o null: cliente de antes)
   *   ahora: la fecha de la pregunta de ahora (ms)
   *   limpiar(turno) → { pregunta, respuesta } | null   (el blindaje de la función: fuera lo vetado)
   * Sin id de conversación (clientes de antes del 11-nov), cuenta lo de las últimas 2 horas.
   * Corta por turnos y por caracteres: lo más reciente es lo que se queda.
   */
  function historiaPara(filas, { conversacion = null, ahora = Date.now(), limpiar = (t) => t, maxTurnos = MAX_TURNOS, maxCaracteres = MAX_CARACTERES } = {}) {
    const lista = Array.isArray(filas) ? filas : [];
    const elegidas = [];
    let usados = 0;
    let anterior = ahora;
    for (const f of lista) {
      if (!f || !f.pregunta || !f.respuesta) continue;
      const t = fecha(f.creado);
      if (conversacion) {
        if (f.conversacion !== conversacion) continue;
      } else if (!t || ahora - t > CADUCA_MS || anterior - t > CADUCA_MS) break;
      const l = limpiar({ pregunta: String(f.pregunta), respuesta: String(f.respuesta) + resumenPasos(f.propuesta) });
      if (!l) continue;
      const largo = l.pregunta.length + l.respuesta.length;
      if (elegidas.length >= maxTurnos || (elegidas.length && usados + largo > maxCaracteres)) break;
      usados += largo;
      if (t) anterior = t;
      elegidas.push(l);
    }
    const mensajes = [];
    for (const l of elegidas.reverse()) {
      mensajes.push({ role: 'user', content: l.pregunta.slice(0, maxCaracteres) });
      mensajes.push({ role: 'assistant', content: l.respuesta.slice(0, maxCaracteres) });
    }
    return mensajes;
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

  return { pautasCharla, idConversacion, historiaPara, pasosDe, etiquetaPaso, textoDePasos, resumenPasos, APPS, CADUCA_MS, CLAVE, MAX_PASOS };
});
