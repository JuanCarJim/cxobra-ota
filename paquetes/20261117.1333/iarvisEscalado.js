/*
 * IARVIS ESCALA CUANDO DUDA (13-nov-2026, JC: «hace falta»).
 *
 * Haiku se equivoca con las frases raras de obra («sácame lo de la DF del sistema 4», «¿cómo va lo del gol sur?»,
 * «pásame las estanqueidades que faltan»). La regla, en un solo sitio y sin red (los modelos se inyectan):
 *
 *   1. Haiku decide primero. Si lo tiene claro, se hace y no cuesta más que antes.
 *   2. Si duda, la petición es nueva o caben varias herramientas, lo lee Sonnet (una llamada corta, sin el manual).
 *   3. Si Sonnet tampoco lo tiene claro, UNA pregunta corta de aclaración. Nada de probar a ver.
 *   4. Si no hay herramienta, se dice claro y la petición queda anotada como sugerencia para el equipo de desarrollo.
 *      Nunca se inventa ni se hace «algo parecido» sin decirlo.
 *
 * Dos caminos, los dos de la edge function `iarvis` (supabase/functions/iarvis/index.ts):
 *   · el chat (texto): Haiku contesta o deja una MARCA al principio; `conversar()` la sigue.
 *   · elegir acción (tool_use): cada herramienta lleva `confianza` y hay dos metaherramientas; `elegir()` la sigue.
 *
 *   leerMarca(texto)        → { tipo: 'respuesta'|'app'|'dudo'|'pregunta'|'aclarar'|'sin_herramienta', valor, texto }
 *   conversar({ pregunta, responder, interpretar, anotar }) → { tipo, texto, frase?, peticion?, anotada?, pasos, coste }
 *   conConfianza(herramientas) → las mismas, con `confianza`/`otra`, más pedir_aclaracion y sin_herramienta
 *   elegir({ pedir, validar, anotar, modelos }) → { estado, accion?, texto?, pasos, coste }
 *   costeDe(modelo, uso)    → USD de una llamada (uso con los nombres de la casa: entrada, salida, cacheEscrita, cacheLeida)
 *   fraseDeApp(respuesta)   → la frase de [[app:…]] que el cliente vuelve a preguntar a las herramientas de la app
 *
 * Lo copia a la edge function scripts/empaquetarIarvis.js (escalado.js).
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisEscalado = API;
})(() => {
  const MODELO_BASE = 'claude-haiku-5-5';
  const MODELO_ESCALADO = 'claude-sonnet-5-5';

  /* USD por millón de tokens (entrada, salida). La caché: escribir 1,25 × entrada; leer 0,1 × entrada. */
  const PRECIOS = {
    'claude-haiku-5-5': { entrada: 0.10, salida: 0.50 },
    'claude-sonnet-5-5': { entrada: 2, salida: 10 },
    'claude-opus-5-5': { entrada: 4, salida: 20 },
    'claude-fable-5-2': { entrada: 8, salida: 40 },
  };
  /** Lo que cuesta una llamada, en USD. Modelo desconocido o sin uso: null (no se inventa un coste). */
  function costeDe(modelo, uso) {
    const p = PRECIOS[String(modelo || '')];
    if (!p || !uso) return null;
    const usd = ((uso.entrada || 0) * p.entrada + (uso.salida || 0) * p.salida
      + (uso.cacheEscrita || 0) * p.entrada * 1.25 + (uso.cacheLeida || 0) * p.entrada * 0.1) / 1e6;
    return Math.round(usd * 1e6) / 1e6;
  }
  const sumar = (pasos) => {
    const c = pasos.map((p) => p.coste).filter((x) => x != null);
    return c.length ? Math.round(c.reduce((a, b) => a + b, 0) * 1e6) / 1e6 : null;
  };
  const paso = (r, etapa) => ({ etapa, modelo: (r && r.modelo) || null, uso: (r && r.uso) || null, coste: r ? costeDe(r.modelo, r.uso) : null });

  /* Cómo se habla en la obra. Va en los prompts; no nombra ninguna obra ni empresa. */
  const VOCABULARIO_OBRA = `VOCABULARIO DE OBRA (así lo dicen; entiéndelo así):
- GS, GN, LT, TR = gol sur, gol norte, lateral, tribuna (zonas del edificio). «Lo del gol sur» = lo de la zona GS. Si preguntan por una zona, contesta SOLO de esa zona (la app filtra por la zona apuntada en cada equipo); si no se puede separar, pregunta, nunca contestes con la obra entera.
- N10, N20… = plantas (nivel 10, nivel 20). «El sistema 4», «el S4» = un sistema o conjunto de climatización con ese número.
- Conjunto = una unidad exterior (UE) con sus unidades interiores (UI); se entrega y se prueba junto.
- DF = dirección facultativa. «Lo de la DF», «la entrega» = el paquete de entrega a la DF (fichas, pruebas y planos de los conjuntos completos).
- PM = puesta en marcha. Cx = commissioning. «Toma de datos» = la ficha de puesta en marcha.
- CRC = compuerta reguladora de caudal o compuerta circular (depende del plano; si importa cuál, pregúntalo).
- Estanqueidad = la prueba de presión con nitrógeno (41 bar, 24 h, foto del manómetro). «Las estanqueidades que faltan» puede ser: equipos sin la prueba hecha, o lecturas de foto por confirmar.
- NCR = no conformidad. «Repas», «incidencias» = reparaciones/incidencias. «Certi» = certificación.`;

  /* Lo que la app resuelve sola, con los datos de verdad, si se le dice con una de estas frases. */
  const CAPACIDADES_APP = [
    { frase: 'prepara la entrega a la DF', cuando: 'armar el paquete de entrega a la DF (admite «de splits», «de VRF N20», «de VRF Gardentona»); solo en el ordenador' },
    { frase: 'qué conjuntos faltan para la DF y por qué', cuando: 'los conjuntos retenidos (no entran en la entrega) con su motivo (admite zona: «de GN», «del gol sur»; se dice la zona en la frase)' },
    { frase: 'por qué está retenido el conjunto <código>', cuando: 'un conjunto concreto: completo o retenido y qué le falta' },
    { frase: 'qué estanqueidades quedan por confirmar', cuando: 'las lecturas de presión de las fotos que han quedado dudosas' },
    { frase: 'lee las estanqueidades de las fotos', cuando: 'leer la presión de las fotos del manómetro y rellenar las fichas (pide confirmación)' },
    { frase: 'cuántos equipos hay en la <planta>', cuando: 'el número real de equipos de una planta (censo)' },
    { frase: 'censo de equipos por planta', cuando: 'el recuento de equipos de toda la obra, por planta' },
    { frase: 'saca los planos de la planta <planta>', cuando: 'el plano de una planta con cada equipo en su estado' },
    { frase: 'qué equipos de la planta <planta> faltan por instalar', cuando: 'equipos por instalar de una planta' },
    { frase: 'dame las incidencias abiertas', cuando: 'el listado de incidencias o reparaciones (admite tipo de equipo y planta: «dame los splits abiertos de la N10»)' },
    { frase: 'planificación de commissioning de <periodo>', cuando: 'lo planificado de puesta en marcha en un periodo (esta semana, noviembre…)' },
    { frase: 'qué equipos reconociste en el plano de CAD', cuando: 'lo leído de un plano de AutoCAD o PDF: equipos, dudas y por qué' },
  ];
  const listaCapacidades = () => CAPACIDADES_APP.map((c) => `- «${c.frase}»: ${c.cuando}`).join('\n');

  /* Lo que se añade a las pautas del chat (Haiku). Las marcas van SOLAS, al principio de la respuesta. */
  const PAUTAS_ESCALADO = `${VOCABULARIO_OBRA}

CUANDO NO LO TIENES CLARO (regla firme: nunca inventes ni hagas algo parecido sin decirlo):
- Si lo que piden es una de estas cosas que la app resuelve sola, dicho de otra forma, contesta SOLO la marca [[app:<frase>]] con la frase de la lista (cambia lo que va entre < >) y nada más:
${listaCapacidades()}
- Los CONJUNTOS de la entrega a la DF (cuántos hay, cuántos están listos, cuántos faltan, cuáles están parados por una incidencia) y lo que tiene abierto un equipo o una sala concretos NO vienen en «datos_obra»: ahí solo hay recuentos de equipos de toda la obra. Nunca los contestes con esos recuentos ni digas «0» o «ninguno»: usa la marca [[app:…]] («qué conjuntos faltan para la DF y por qué»; para un equipo o sala concretos, «por qué está retenido el conjunto <código>»).
- Si la petición se puede entender de dos formas, o no sabes a qué se refiere («lo de», «eso», un código que no aparece en el contexto), contesta SOLO [[dudo]]. No contestes «por si acaso» con lo primero que encaje.
- Si piden que la app HAGA algo que no existe (ni en el manual ni en la lista de arriba), contesta SOLO [[sin-herramienta:<lo que piden, en una frase>]]. No ofrezcas otra cosa como si fuera lo pedido.
- Si es una pregunta normal y el dato está en el manual o en «datos_obra», contesta como siempre, sin marcas.`;

  /* La segunda lectura (Sonnet): interpreta, no contesta. Corta y sin el manual. */
  const INTERPRETE = `Eres el intérprete de Iarvis, el ayudante de una app de obra de instalaciones (climatización, commissioning, entrega a la dirección facultativa). Una persona de obra ha escrito algo y el primer modelo ha dudado. Tu trabajo es decidir QUÉ quiere, no contestarle.

${VOCABULARIO_OBRA}

Lo que la app resuelve sola si se le dice con estas frases:
${listaCapacidades()}

Además, Iarvis puede contestar preguntas con los datos de la obra abierta (equipos por planta y tipo, toma de datos, pruebas, incidencias, NCR, planificación, compras, certificación) y con el manual de uso de la app.

Contesta SOLO una de estas marcas, sin nada más:
- [[app:<frase de la lista, con lo de < > cambiado>]] si es claramente una de esas cosas.
- [[pregunta:<la petición reescrita, clara y completa, con las palabras de la app>]] si es una pregunta que se contesta con los datos de la obra o el manual y ya sabes cuál.
- [[aclarar:<UNA pregunta corta, de una línea, con las dos o tres opciones posibles>]] si puede ser más de una cosa y no hay forma de saberlo. Una sola pregunta.
- [[sin-herramienta:<lo que pide, en una frase>]] si pide hacer algo que no está en lo anterior.
No inventes códigos, equipos, plantas ni cifras que la persona no haya dicho.`;

  const RE_MARCA = /\[\[\s*(app|dudo|pregunta|aclarar|sin[- _]?herramienta)\s*(?::\s*([\s\S]*?))?\s*\]\]/i;
  /** La marca de una respuesta del modelo (la primera). Sin marca: una respuesta normal. */
  function leerMarca(texto) {
    const t = String(texto || '').trim();
    const m = RE_MARCA.exec(t);
    if (!m) return { tipo: 'respuesta', valor: '', texto: t };
    const clave = m[1].toLowerCase().replace(/[- _]/g, '');
    const tipo = clave === 'sinherramienta' ? 'sin_herramienta' : clave;
    const valor = String(m[2] || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    /* Una marca que necesita valor y viene vacía es una duda. */
    if (['app', 'pregunta', 'aclarar'].includes(tipo) && !valor) return { tipo: 'dudo', valor: '', texto: '' };
    return { tipo, valor, texto: t.replace(RE_MARCA, '').trim() };
  }
  /** Ninguna marca de escalado llega a la persona. */
  const quitarMarcas = (texto) => String(texto || '').replace(new RegExp(RE_MARCA.source, 'gi'), '').replace(/\n{3,}/g, '\n\n').trim();

  /** Lo que el cliente tiene que volver a preguntar a las herramientas de la app, o null. */
  function fraseDeApp(respuesta) {
    const m = /\[\[\s*app\s*:\s*([^\]]+?)\s*\]\]/i.exec(String(respuesta || ''));
    return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  }

  const ACLARAR_GENERICA = 'No tengo claro qué necesitas. ¿Me lo dices con el equipo, la planta o el documento concreto?';
  function textoSinHerramienta(peticion, anotada) {
    const que = String(peticion || '').replace(/[.\s]+$/, '');
    return `No tengo herramienta para eso todavía${que ? `: ${que}` : ''}. No voy a hacer otra cosa parecida sin decírtelo.`
      + (anotada ? ' Lo he dejado anotado como sugerencia para el equipo de desarrollo.' : ' No he podido anotarlo ahora; dilo otra vez más tarde o coméntaselo a quien administra la app.');
  }
  /** El texto que se guarda como sugerencia: dato, no instrucción. */
  const textoSugerencia = (peticion, pregunta) => `Petición sin herramienta: ${String(peticion || '').slice(0, 300)} (dicho así: «${String(pregunta || '').replace(/\s+/g, ' ').slice(0, 400)}»)`.slice(0, 2000);

  async function anotarSeguro(anotar, peticion, pregunta) {
    if (!anotar) return false;
    try { return !!(await anotar(textoSugerencia(peticion, pregunta))); } catch { return false; }
  }

  /**
   * El chat. `responder(pregunta, { segunda })` → { texto, modelo, uso } es Haiku con el manual;
   * `interpretar(pregunta)` → { texto, modelo, uso } es Sonnet con INTERPRETE; `anotar(texto)` guarda la sugerencia.
   * `sinApp`: el cliente ya probó la frase de la app y no la resolvió (no se vuelve a mandar [[app]]).
   */
  async function conversar({ pregunta, responder, interpretar = null, anotar = null, sinApp = false }) {
    const pasos = [];
    const fin = (x) => ({ ...x, pasos, coste: sumar(pasos), escalado: pasos.length > 1 });
    const r1 = await responder(pregunta, { segunda: false });
    pasos.push(paso(r1, 'base'));
    const base = { modelo: r1.modelo, uso: r1.uso, cortado: r1.cortado, rechazo: r1.rechazo };
    const m1 = leerMarca(r1.texto);
    if (m1.tipo === 'respuesta') return fin({ ...base, tipo: 'respuesta', texto: m1.texto });
    if (m1.tipo === 'app' && !sinApp) return fin({ ...base, tipo: 'app', frase: m1.valor, texto: `Entiendo que pides: «${m1.valor}». [[app:${m1.valor}]]` });
    /* Duda, cosa nueva o sin herramienta: segunda lectura. Sin intérprete (sin clave, sin modelo) se pregunta. */
    let m2 = null;
    if (interpretar) {
      try {
        const r2 = await interpretar(pregunta);
        pasos.push(paso(r2, 'escalado'));
        m2 = leerMarca(r2.texto);
      } catch { m2 = null; }
    }
    if (!m2) {
      if (m1.tipo === 'sin_herramienta') {
        const anotada = await anotarSeguro(anotar, m1.valor || pregunta, pregunta);
        return fin({ ...base, tipo: 'sin_herramienta', peticion: m1.valor, anotada, texto: textoSinHerramienta(m1.valor, anotada) });
      }
      return fin({ ...base, tipo: 'aclarar', texto: m1.tipo === 'aclarar' ? m1.valor : ACLARAR_GENERICA });
    }
    if (m2.tipo === 'app' && !sinApp) return fin({ ...base, tipo: 'app', frase: m2.valor, texto: `Entiendo que pides: «${m2.valor}». [[app:${m2.valor}]]` });
    if (m2.tipo === 'sin_herramienta') {
      const anotada = await anotarSeguro(anotar, m2.valor || pregunta, pregunta);
      return fin({ ...base, tipo: 'sin_herramienta', peticion: m2.valor, anotada, texto: textoSinHerramienta(m2.valor, anotada) });
    }
    if (m2.tipo === 'aclarar') return fin({ ...base, tipo: 'aclarar', texto: m2.valor });
    if (m2.tipo === 'pregunta' || (m2.tipo === 'app' && sinApp)) {
      /* Ya se sabe qué quiere: lo contesta Haiku, con el manual y los datos, diciendo cómo se ha entendido. */
      const r3 = await responder(`${pregunta}\n\n(Se ha entendido así: ${m2.valor}. Contesta a eso con los datos del contexto, sin marcas; si el dato no está, dilo.)`, { segunda: true });
      pasos.push(paso(r3, 'respuesta'));
      const m3 = leerMarca(r3.texto);
      const texto = m3.tipo === 'respuesta' ? m3.texto : m3.texto || '';
      if (texto) return fin({ modelo: r3.modelo, uso: r3.uso, cortado: r3.cortado, tipo: 'respuesta', entendido: m2.valor, texto });
      return fin({ ...base, tipo: 'aclarar', texto: ACLARAR_GENERICA });
    }
    return fin({ ...base, tipo: 'aclarar', texto: ACLARAR_GENERICA });
  }

  /* ── Elegir acción (tool_use) ── */
  const META_ACLARAR = 'pedir_aclaracion';
  const META_SIN = 'sin_herramienta';
  const METAS = [
    { name: META_ACLARAR, description: 'Úsala cuando la petición pueda ser más de una herramienta o le falte un dato imprescindible y no se pueda saber cuál. UNA pregunta corta con las opciones.', input_schema: { type: 'object', properties: { pregunta: { type: 'string', description: 'La pregunta de aclaración, una línea.' } }, required: ['pregunta'] } },
    { name: META_SIN, description: 'Úsala cuando la persona pide HACER algo en la app y ninguna herramienta lo hace. No elijas otra parecida.', input_schema: { type: 'object', properties: { peticion: { type: 'string', description: 'Lo que pide, en una frase.' } }, required: ['peticion'] } },
  ];
  const CAMPO_CONFIANZA = { type: 'string', enum: ['alta', 'media', 'baja'], description: 'Lo seguro que estás de que ESTA herramienta es lo que pide: alta (lo dice claro), media (lo más probable), baja (podría ser otra cosa).' };
  const CAMPO_OTRA = { type: 'string', description: 'Si otra herramienta también encajaría, su nombre. Si no, no lo pongas.' };
  /** Las herramientas del catálogo, con la confianza declarada y las dos metaherramientas. */
  function conConfianza(herramientas) {
    const hs = (Array.isArray(herramientas) ? herramientas : []).map((h) => ({
      ...h,
      input_schema: { ...(h.input_schema || { type: 'object' }), properties: { ...((h.input_schema && h.input_schema.properties) || {}), confianza: CAMPO_CONFIANZA, otra: CAMPO_OTRA } },
    }));
    return [...hs, ...METAS];
  }
  const PAUTAS_ELEGIR = `${VOCABULARIO_OBRA}

Rellena siempre «confianza» en la herramienta que elijas, y «otra» si otra también encajaría.
Si puede ser más de una cosa y no se puede saber, usa pedir_aclaracion (una sola pregunta corta).
Si no dice QUÉ («eso», «lo de antes», «pásamelo») y no se puede saber, usa pedir_aclaracion: no contestes «no».
Si pide HACER algo en la app que ninguna herramienta hace (mandar, pedir, reservar, borrar, conectar…), usa sin_herramienta: nunca elijas una parecida para salir del paso.
Si es una PREGUNTA (qué, cuántos, cómo va, por qué…) y ninguna herramienta la contesta, no llames a ninguna y contesta solo «no»: la contestará el chat con los datos de la obra.`;

  /** Lo que ha elegido el modelo, normalizado. */
  function leerEleccion(r) {
    const h = r && r.herramienta;
    if (!h || !h.nombre) return { tipo: 'ninguna' };
    const e = h.entrada && typeof h.entrada === 'object' ? h.entrada : {};
    if (h.nombre === META_ACLARAR) return { tipo: 'aclarar', pregunta: String(e.pregunta || '').replace(/\s+/g, ' ').trim().slice(0, 300) };
    if (h.nombre === META_SIN) return { tipo: 'sin_herramienta', peticion: String(e.peticion || '').replace(/\s+/g, ' ').trim().slice(0, 300) };
    const { confianza, otra, ...entrada } = e;
    const c = ['alta', 'media', 'baja'].includes(confianza) ? confianza : 'media';
    return { tipo: 'accion', nombre: h.nombre, entrada, confianza: c, otra: otra ? String(otra).slice(0, 80) : null };
  }
  /** ¿Hay que leerlo otra vez con el modelo mayor? */
  const dudosa = (el) => el.tipo === 'aclarar' || el.tipo === 'sin_herramienta' || (el.tipo === 'accion' && (el.confianza !== 'alta' || !!el.otra));

  /**
   * Elegir una acción con escalado. `pedir(modelo)` → respuesta del motor con `herramienta`;
   * `validar(nombre, entrada)` → la acción del catálogo o null (rol, parámetros). `anotar(texto)` guarda la sugerencia.
   * `sinNada`: lo que se devuelve cuando ningún modelo ve acción (el chat lo contestará): por defecto 'ninguna'.
   */
  async function elegir({ pregunta = '', pedir, validar, anotar = null, modelos = [MODELO_BASE, MODELO_ESCALADO] }) {
    const pasos = [];
    const fin = (x) => ({ ...x, pasos, coste: sumar(pasos), modelo: pasos.length ? pasos[pasos.length - 1].modelo : null, escalado: pasos.length > 1 });
    const r1 = await pedir(modelos[0]);
    pasos.push(paso(r1, 'base'));
    const e1 = leerEleccion(r1);
    /* Haiku no ve ninguna acción (es una pregunta): no se escala; la contestará el chat, que tiene su propio escalado. */
    if (e1.tipo === 'ninguna') return fin({ estado: 'ninguna', accion: null });
    if (!dudosa(e1)) {
      const accion = validar(e1.nombre, e1.entrada);
      if (accion) return fin({ estado: 'elegida', accion, confianza: e1.confianza });
    }
    let e2 = null;
    if (modelos[1]) {
      try {
        const r2 = await pedir(modelos[1]);
        pasos.push(paso(r2, 'escalado'));
        e2 = leerEleccion(r2);
      } catch { e2 = null; }
    }
    /* Sin segunda lectura: lo de Haiku solo vale si no era baja ni había otra; si no, se pregunta. */
    const e = e2 || e1;
    if (e.tipo === 'accion') {
      const accion = validar(e.nombre, e.entrada);
      const clara = e2 ? e.confianza !== 'baja' : (e.confianza === 'alta' || (e.confianza === 'media' && !e.otra));
      if (accion && clara) return fin({ estado: 'elegida', accion, confianza: e.confianza, ...(e.confianza !== 'alta' ? { entendido: true } : {}) });
      if (accion) return fin({ estado: 'aclarar', accion: null, texto: ACLARAR_GENERICA });
      return fin({ estado: 'ninguna', accion: null });
    }
    if (e.tipo === 'aclarar') return fin({ estado: 'aclarar', accion: null, texto: e.pregunta || ACLARAR_GENERICA });
    if (e.tipo === 'sin_herramienta') {
      const anotada = await anotarSeguro(anotar, e.peticion || pregunta, pregunta);
      return fin({ estado: 'sin_herramienta', accion: null, anotada, texto: textoSinHerramienta(e.peticion, anotada) });
    }
    return fin({ estado: 'ninguna', accion: null });
  }

  return {
    MODELO_BASE, MODELO_ESCALADO, PRECIOS, costeDe, VOCABULARIO_OBRA, CAPACIDADES_APP, PAUTAS_ESCALADO, INTERPRETE, PAUTAS_ELEGIR,
    leerMarca, quitarMarcas, fraseDeApp, conversar, METAS, conConfianza, leerEleccion, dudosa, elegir,
    textoSinHerramienta, textoSugerencia, ACLARAR_GENERICA,
  };
});
