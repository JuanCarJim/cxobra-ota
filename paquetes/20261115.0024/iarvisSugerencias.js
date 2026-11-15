'use strict';
/*
 * 💡 IARVIS RECOGE SUGERENCIAS (11-nov-2026, JC, 9-nov: «estaría de locos que Iarvis recogiera propuestas y
 * sugerencias del usuario para mejorar la app o desarrollar nuevas funciones y que me las pase a mí»).
 * Una sola lógica para el escritorio, la web y el móvil.
 *
 *   detectar(pregunta)        → { texto } si lo escrito es una propuesta de mejora («estaría bien que…»,
 *                                «propongo…», «echo en falta…»), o null si es una pregunta o una orden
 *   filaConfirmacion(d)       → la respuesta del chat: qué va a enviar, y los botones «Enviar» / «No, es una pregunta»
 *   crearSugerencias({ nube, quien, app, almacen })
 *       .enviar({ texto, pantalla, obraId, obraNombre }) → { ok, estado, respuesta }
 *       .reintentar()                                    → manda lo que quedó sin red
 *
 * SEGURIDAD (obligatoria, JC):
 *   · El texto del usuario es un DATO. Aquí solo se guarda en ia_sugerencias (cxobra-sync, 0062): no va al
 *     bloc, ni a la cola de agentes, ni al motor de IA. Solo JC lo lee, desde su lista de Bitácora, y solo
 *     él lo convierte, a mano, en nota.
 *   · Al usuario se le dice que la sugerencia pasa «al equipo de desarrollo»: nunca se nombra a nadie.
 *   · El usuario solo inserta (RLS): no lee las suyas ni las de otros; el rol lo pone la base (cx_llaves).
 *   · Se quitan correos, teléfonos, DNI/NIE e IBAN que escriba de más (sin datos personales de más).
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisSugerencias = API;
})(() => {
  const TABLA = 'ia_sugerencias';
  const COLA = 'vidaire.iarvis.sugerencias.cola';
  const MAX_TEXTO = 2000;
  const MIN_TEXTO = 3;
  const MAX_ECO = 220;

  const ENVIADA = 'Hecho: tu sugerencia pasa al equipo de desarrollo. Gracias por ayudar a mejorar la app.';
  const SIN_RED = 'Sin conexión: tu sugerencia queda guardada en este dispositivo y se envía al equipo de desarrollo en cuanto vuelva la red.';
  const TOPE = 'Hoy ya has enviado muchas sugerencias. Guarda esta para mañana y la envío al equipo de desarrollo.';
  const NO_PUDO = 'No he podido enviar la sugerencia ahora. Vuelve a intentarlo en un rato.';
  const NO_ENVIADA = 'De acuerdo, no la envío.';

  const llano = (v) => String(v ?? '').trim();
  const normal = (v) => llano(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* Cómo suena una propuesta de mejora (en minúsculas y sin tildes). Español, catalán e inglés. */
  const PROPUESTA = [
    /\bestaria (muy |super |bastante |realmente )?(bien|genial|bueno|guay|chulo|perfecto|util|interesante|de lujo)\b/,
    /\bseria (muy |super |bastante |realmente )?(bueno|util|genial|interesante|mejor|ideal|practico|guay|chulo|de agradecer|de locos)\b/,
    /\b(propongo|propondria|propondriamos|sugiero|sugeriria|sugeririamos|recomendaria)\b/,
    /\b(tengo|os dejo|te dejo|dejo|va|mi|una|otra) (una )?(sugerencia|propuesta|idea|peticion de mejora)\b/,
    /\b(sugerencia|propuesta de mejora|idea de mejora|mejora para la app|peticion de funcion)\s*[:\-]/,
    /\b(podriais|podrian|podeis|podrias|pudierais|pudieseis|pudieran|pudiesen)\b.{0,25}\b(a?nadir|poner|incluir|crear|hacer|tener|implementar|mejorar|cambiar|agregar|meter|permitir|activar|quitar|mostrar|sacar)\b/,
    /\b(echo|echamos|echaba|echabamos) (de menos|en falta)\b|\bme hace falta\b.{0,40}\b(app|pantalla|boton|opcion|funcion)\b/,
    /\b(falta|faltaria|haria falta|hace falta|vendria bien|vendria genial)\b.{0,30}\b(boton|opcion|funcion|funcionalidad|pantalla|filtro|informe|vista|campo|columna|atajo|aviso|exportar|buscador|grafico|listado)\b/,
    /\b(deberia|deberiais|deberian|habria que)\b.{0,12}\b(haber|existir|incluir|a?nadir|permitir|tener|poder|mostrar|cambiar|mejorar)\b/,
    /\bme gustaria (que (hubiera|hubiese|existiera|tuviera|tuvierais|tuviese|se pudiera|se pudiese|se pudieran|la app|vidaire|iarvis|pudierais|pudieseis)|tener en la app|ver en la app)\b/,
    /\b(estaria|seria) (genial|bien|muy bien|ideal|mejor|bueno) (poder|que|si)\b/,
    /\b(estaria|seria) (be|bo|genial|ideal|millor) (que|si|poder|tenir)\b/,
    /\b(suggereixo|proposo|suggeriria|suggeriment|trobo a faltar|em fa falta|podrieu (afegir|posar|fer|incloure|crear|canviar))\b/,
    /\bit would be (so |really |very )?(nice|great|good|useful|helpful|cool|awesome|amazing) (if|to|that)\b|\bwould be (nice|great|cool|awesome) if\b/,
    /\b(i|we) (suggest|propose|recommend|wish)\b|\b(feature request|suggestion:|you should (add|include|make|let|allow|offer))\b|\bwish (it|the app|you) (could|would|had|did)\b|\bwhat if (the app|you|we) (could|would)\b/,
  ];
  /* Lo que, aunque lo parezca, es una pregunta de uso o una orden: «¿cómo hago…?», «¿dónde está…?», «abre…». */
  const PREGUNTA_DE_USO = /^(como|donde|cuando|cuanto|cuantos|cuantas|cual|cuales|quien|por que|que (es|son|significa|hay|puedo|hago|tengo|pasa)|puedo|se puede|hay |existe|sabes|me puedes|puedes|me ayudas|how |where |when |what |can i|is there|com |on |quan |puc )/;

  /** Quita lo personal que se cuele (correos, teléfonos, DNI/NIE, IBAN) y deja el texto en una línea limpia. */
  function limpiar(texto) {
    return llano(texto)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo quitado]')
      .replace(/\b[A-Z]{2}\d{2}(?:[ ]?\d{4}){4,6}\b/g, '[cuenta quitada]')
      .replace(/\b[XYZxyz]?\d{7,8}[ -]?[A-Za-z]\b/g, '[documento quitado]')
      .replace(/(?:\+|00)?\d(?:[\s.-]?\d){8,13}\b/g, '[teléfono quitado]')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_TEXTO);
  }

  /** ¿Es una propuesta de mejora de la app? { texto } o null. La pregunta de uso («¿cómo…?») no lo es. */
  function detectar(pregunta) {
    const crudo = llano(pregunta);
    if (crudo.length < 16) return null;
    const t = normal(crudo).replace(/[¿¡]/g, ' ').replace(/\s+/g, ' ').trim();
    if (PREGUNTA_DE_USO.test(t)) return null;
    if (!PROPUESTA.some((r) => r.test(t))) return null;
    const texto = limpiar(crudo);
    return texto.length >= MIN_TEXTO ? { texto } : null;
  }

  const recortar = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

  /**
   * La respuesta del chat cuando se detecta una propuesta: dice en una línea qué va a enviar y pide el «sí».
   * No se guarda nada hasta que se pulsa «Enviar». Los botones son «hacer» de siempre (renderer/iarvis.js).
   */
  function filaConfirmacion({ pregunta, texto, pantalla = '', obraId = null, obraNombre = '' } = {}) {
    const dato = { texto: llano(texto), pantalla: llano(pantalla).slice(0, 120), obraId: obraId ? String(obraId).slice(0, 80) : null, obraNombre: llano(obraNombre).slice(0, 160) };
    return {
      id: null,
      pregunta: llano(pregunta),
      estado: 'respondida',
      local: true,
      respuesta: `Esto parece una sugerencia para mejorar la app. Voy a enviarla al equipo de desarrollo:\n\n**«${recortar(dato.texto, MAX_ECO)}»**\n\n¿La envío?`,
      acciones: [
        { tipo: 'hacer', hacer: 'sugerencia', texto: 'Enviar sugerencia', sugerencia: dato },
        { tipo: 'hacer', hacer: 'rechazar', texto: 'No, es una pregunta', sugerencia: dato },
      ],
    };
  }

  /** La respuesta del chat tras pulsar «Enviar» (o tras fallar). */
  const filaResultado = (r, pregunta = 'Enviar sugerencia') => ({ id: null, pregunta, estado: 'respondida', local: true, respuesta: r.respuesta });
  /** La respuesta del chat tras pulsar «No, es una pregunta». */
  const filaNoEnviada = (pregunta = 'No, es una pregunta') => ({ id: null, pregunta, estado: 'respondida', local: true, respuesta: NO_ENVIADA });

  const uuid = () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  /**
   * crearSugerencias({ nube, quien, app, almacen }):
   *   nube     la de la sesión (móvil y web, con RLS) o la del escritorio (clave secreta); con meterSinDevolver
   *   quien()  { personaId, espacio } (el escritorio; con sesión manda la sesión)
   *   almacen  localStorage o equivalente: la cola sin red
   */
  function crearSugerencias({ nube = null, quien = () => null, app = 'obras', almacen = null } = {}) {
    const leerCola = () => { try { return JSON.parse((almacen && almacen.getItem(COLA)) || '[]'); } catch { return []; } };
    const ponerCola = (l) => { try { if (almacen) almacen.setItem(COLA, JSON.stringify(l.slice(-20))); } catch { /* lleno */ } };
    const yo = () => {
      const q = (typeof quien === 'function' ? quien() : quien) || {};
      const deSesion = nube && !nube.esSecreta && nube.yo ? nube.yo() : null;
      return { personaId: (deSesion && deSesion.personaId) || q.personaId || null, espacio: (deSesion && deSesion.espacio) || q.espacio || 'principal' };
    };
    const meter = (fila) => (nube.meterSinDevolver ? nube.meterSinDevolver(TABLA, [fila]) : nube.guardar(TABLA, [fila]));
    const elTope = (e) => /tope diario/i.test(String((e && (e.message || e.cuerpo && e.cuerpo.message)) || ''));

    /** Guarda la sugerencia en la nube. Nunca lanza: devuelve lo que se le dice a la persona. */
    async function enviar({ texto, pantalla = '', obraId = null, obraNombre = '', id = null } = {}) {
      const limpio = limpiar(texto);
      if (limpio.length < MIN_TEXTO) return { ok: false, estado: 'vacia', respuesta: 'Escribe la sugerencia.' };
      const { personaId, espacio } = yo();
      const fila = {
        id: id || uuid(), espacio, persona_id: personaId, app,
        obra_id: obraId ? String(obraId).slice(0, 80) : null, obra: llano(obraNombre).slice(0, 160) || null,
        pantalla: llano(pantalla).slice(0, 120) || null, texto: limpio,
      };
      if (!nube || !personaId) {
        ponerCola([...leerCola(), fila]);
        return { ok: true, estado: 'enCola', respuesta: SIN_RED };
      }
      try {
        await meter(fila);
        return { ok: true, estado: 'enviada', respuesta: ENVIADA };
      } catch (e) {
        if (e && e.sinRed) { ponerCola([...leerCola(), fila]); return { ok: true, estado: 'enCola', respuesta: SIN_RED }; }
        if (elTope(e)) return { ok: false, estado: 'tope', respuesta: TOPE };
        /* La obra no es suya (RLS): se envía sin ella, no se pierde la idea. */
        if (fila.obra_id) {
          try { await meter({ ...fila, obra_id: null }); return { ok: true, estado: 'enviada', respuesta: ENVIADA }; } catch (e2) {
            if (e2 && e2.sinRed) { ponerCola([...leerCola(), { ...fila, obra_id: null }]); return { ok: true, estado: 'enCola', respuesta: SIN_RED }; }
            if (elTope(e2)) return { ok: false, estado: 'tope', respuesta: TOPE };
          }
        }
        return { ok: false, estado: 'fallo', respuesta: NO_PUDO };
      }
    }

    /** Lo que quedó sin mandar (sin red): se envía ahora. */
    async function reintentar() {
      const cola = leerCola();
      if (!cola.length || !nube) return [];
      const quedan = [];
      const hechas = [];
      for (const f of cola) {
        try {
          const { personaId, espacio } = yo();
          await meter({ ...f, persona_id: f.persona_id || personaId, espacio: f.espacio || espacio });
          hechas.push(f.id);
        } catch (e) {
          if (e && e.sinRed) quedan.push(f);
          /* Otro error (tope, RLS): se descarta para no atascar la cola. */
        }
      }
      ponerCola(quedan);
      return hechas;
    }

    return { enviar, reintentar };
  }

  return { detectar, limpiar, filaConfirmacion, filaResultado, filaNoEnviada, crearSugerencias, TABLA, MAX_TEXTO, ENVIADA, SIN_RED, TOPE, NO_PUDO, NO_ENVIADA };
});
