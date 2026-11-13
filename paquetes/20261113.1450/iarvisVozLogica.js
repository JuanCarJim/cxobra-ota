'use strict';
/*
 * AUDIOS A IARVIS DESDE VIDAIRE CX (12-nov-2026, JC: «en Vidaire Cx debemos poder mandar audios
 * a Iarvis y que los entienda y que pueda responder»). La lógica, sin pantalla ni aparato:
 * la usa renderer/movil/iarvisVoz.js con el motor del iPhone (cxobra/nativo/VozIarvisPlugin.swift)
 * o el del navegador, y las pruebas (test/iarvisVoz.test.js) con uno de mentira.
 *
 * El audio se pasa a TEXTO en el propio teléfono (reconocimiento de voz del sistema) y ese texto
 * va a Iarvis como una pregunta normal: mismas reglas de rol, organización y acciones como
 * propuesta. El audio no sale del teléfono.
 *
 *   const v = crearVoz({ motor, cola, enviar, avisar })
 *   v.pulsar() / v.soltar()   mantener pulsado graba; un toque corto deja grabando hasta otro toque
 *   v.cancelar()              tira lo grabado
 *   v.tiempo()                ms que lleva grabando
 *
 * Motor: { empezar(), parar() → { ruta?, src?, duracion, texto? }, cancelar(), transcribir({ ruta }) → texto }.
 * Los fallos llevan `code`: 'sin-permiso' | 'sin-red' | 'sin-voz' | 'sin-audio' | 'no-disponible' | 'sin-red-web'.
 * Sin red, el audio grabado en el teléfono queda en la cola y se pasa a texto y se manda al volver.
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisVoz = API;
})(() => {
  const UMBRAL_MANTENER = 400; /* ms: más que esto pulsado = «mantener para grabar» */
  const MINIMO = 700; /* ms: menos, no es un audio */
  const MAXIMO = 60000; /* 1 min y se corta solo (el reconocedor de Apple por la red no pasa de ahí) */
  const MAX_INTENTOS = 6;
  const COLA = 'vidaire.iarvis.voz.cola';
  const AUDIOS = 'vidaire.iarvis.voz.audios';

  const AVISOS = {
    'sin-permiso': 'Sin permiso del micrófono. Actívalo en Ajustes › Vidaire Cx › Micrófono y Reconocimiento de voz.',
    'sin-red': 'Sin conexión: el audio queda guardado y se pasa a texto y se manda a Iarvis en cuanto vuelva la red.',
    'sin-red-web': 'Sin conexión, este navegador no puede pasar la voz a texto. Escríbelo o prueba con red.',
    'sin-voz': 'No se ha oído nada. Vuelve a probar más cerca del micrófono.',
    'sin-audio': 'El audio ya no está en el teléfono.',
    'no-disponible': 'Este aparato no pasa la voz a texto. Escríbelo o usa el micrófono del teclado.',
    corto: 'Mantén pulsado para hablar, o toca una vez para empezar y otra para mandar.',
    fallo: 'No se ha podido grabar. Vuelve a probar.',
  };
  const aviso = (code) => AVISOS[code] || AVISOS.fallo;
  const codigo = (e) => (e && typeof e.code === 'string' && AVISOS[e.code] ? e.code : 'fallo');

  /** 0:07, 1:05 */
  function formatearTiempo(ms) {
    const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Lo que se lee en voz alta: sin marcas de formato, enlaces, emojis ni flechas. */
  function textoParaLeer(texto) {
    return String(texto || '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, '')
      .replace(/[*_`#>]+/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍›‹·]/gu, ' ')
      .replace(/\s*\n+\s*/g, '. ')
      .replace(/([.:;,!?¿¡])\s*\.(?=\s|$)/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 4000);
  }

  /** La voz en español del dispositivo: es-ES primero, luego cualquier es-*, la local antes. */
  function elegirVoz(voces, idioma = 'es-ES') {
    const l = (Array.isArray(voces) ? voces : []).filter((v) => v && v.lang);
    const norm = (x) => String(x).replace('_', '-').toLowerCase();
    const pref = (lista) => lista.find((v) => v.localService) || lista[0] || null;
    return pref(l.filter((v) => norm(v.lang) === norm(idioma))) || pref(l.filter((v) => norm(v.lang).startsWith('es'))) || null;
  }

  function leerLista(almacen, clave) { try { return JSON.parse((almacen && almacen.getItem(clave)) || '[]'); } catch { return []; } }
  function escribirLista(almacen, clave, l) { try { if (almacen) almacen.setItem(clave, JSON.stringify(l)); } catch { /* lleno */ } }

  /** La cola de audios que no se pudieron pasar a texto (sin red). */
  function crearColaVoz({ almacen = null, reloj = Date.now } = {}) {
    const listar = () => leerLista(almacen, COLA);
    const guardar = (g) => {
      const item = { id: `voz-${reloj()}-${Math.random().toString(36).slice(2, 7)}`, ruta: g.ruta, src: g.src || '', duracion: g.duracion || 0, creado: new Date(reloj()).toISOString(), intentos: 0 };
      escribirLista(almacen, COLA, [...listar(), item].slice(-20));
      return item;
    };
    const quitar = (id) => escribirLista(almacen, COLA, listar().filter((x) => x.id !== id));
    let enMarcha = null;
    /** Pasa a texto y manda lo guardado, por orden. Se para en el primer «sin red». */
    function procesar({ motor, enviar }) {
      if (enMarcha) return enMarcha;
      enMarcha = (async () => {
        const r = { mandados: 0, descartados: 0, quedan: 0 };
        for (const item of listar()) {
          let texto = '';
          try { texto = String(await motor.transcribir({ ruta: item.ruta }) || '').trim(); } catch (e) {
            const c = codigo(e);
            if (c === 'sin-red' && item.intentos + 1 < MAX_INTENTOS) {
              escribirLista(almacen, COLA, listar().map((x) => (x.id === item.id ? { ...x, intentos: x.intentos + 1 } : x)));
              break;
            }
            quitar(item.id); r.descartados += 1; continue;
          }
          if (!texto) { quitar(item.id); r.descartados += 1; continue; }
          try { await enviar(texto, { src: item.src, duracion: item.duracion, ruta: item.ruta, deCola: true }); } catch { break; }
          quitar(item.id); r.mandados += 1;
        }
        r.quedan = listar().length;
        return r;
      })().finally(() => { enMarcha = null; });
      return enMarcha;
    }
    return { listar, guardar, quitar, procesar };
  }

  /** El audio de cada burbuja, por su texto (para el ▶ al volver a pintar el chat). */
  function apuntarAudio(almacen, { texto, src, duracion }) {
    const t = String(texto || '').trim();
    if (!t) return;
    escribirLista(almacen, AUDIOS, [{ texto: t, src: src || '', duracion: duracion || 0 }, ...leerLista(almacen, AUDIOS).filter((x) => x.texto !== t)].slice(0, 40));
  }
  function audioDe(almacen, texto) {
    const t = String(texto || '').trim();
    return leerLista(almacen, AUDIOS).find((x) => x.texto === t) || null;
  }

  /**
   * La grabación: «quieto» → «grabando» → «entendiendo» → «quieto».
   * avisar(texto) para lo que hay que decir; cambio(estado) para repintar.
   */
  function crearVoz({ motor, cola = null, enviar, avisar = () => {}, cambio = () => {}, reloj = Date.now, umbral = UMBRAL_MANTENER, minimo = MINIMO, maximo = MAXIMO, temporizador = (f, ms) => setTimeout(f, ms), soltarTemporizador = (t) => clearTimeout(t) } = {}) {
    let estado = 'quieto';
    let inicio = 0;
    let pulsadoEn = 0;
    let modo = null; /* 'mantener' | 'toque' */
    let corte = null;
    const poner = (e) => { estado = e; cambio(e); };

    async function empezar() {
      if (estado !== 'quieto' || !motor) return false;
      poner('arrancando');
      try { await motor.empezar(); } catch (e) { poner('quieto'); avisar(aviso(codigo(e)), codigo(e)); return false; }
      inicio = reloj();
      poner('grabando');
      corte = temporizador(() => { if (estado === 'grabando') parar(); }, maximo);
      return true;
    }

    async function parar() {
      if (estado !== 'grabando') return null;
      if (corte) { soltarTemporizador(corte); corte = null; }
      const ms = reloj() - inicio;
      if (ms < minimo) { await cancelar(); avisar(aviso('corto'), 'corto'); return null; }
      poner('entendiendo');
      let g;
      try { g = await motor.parar(); } catch (e) { poner('quieto'); avisar(aviso(codigo(e)), codigo(e)); return null; }
      g = { ...g, duracion: g && g.duracion ? g.duracion : ms };
      let texto = String((g && g.texto) || '').trim();
      if (!texto) {
        try { texto = String(await motor.transcribir(g) || '').trim(); } catch (e) {
          const c = codigo(e);
          if (c === 'sin-red' && g.ruta && cola) { cola.guardar(g); poner('quieto'); avisar(aviso('sin-red'), 'sin-red'); return { enCola: true }; }
          poner('quieto'); avisar(aviso(c), c); return null;
        }
      }
      if (!texto) { poner('quieto'); avisar(aviso('sin-voz'), 'sin-voz'); return null; }
      poner('quieto');
      try { await enviar(texto, { src: g.src || '', duracion: g.duracion, ruta: g.ruta || '' }); } catch { avisar(aviso('fallo'), 'fallo'); return null; }
      return { texto };
    }

    async function cancelar() {
      if (corte) { soltarTemporizador(corte); corte = null; }
      if (estado !== 'grabando' && estado !== 'arrancando') return;
      try { await motor.cancelar(); } catch { /* ya parado */ }
      modo = null;
      poner('quieto');
    }

    /** Pulsar el botón: si está quieto, empieza; si graba por toque, para y manda. */
    function pulsar() {
      pulsadoEn = reloj();
      if (estado === 'grabando' && modo === 'toque') { modo = null; return parar(); }
      if (estado === 'quieto') { modo = 'mantener'; return empezar(); }
      return Promise.resolve(null);
    }
    /** Soltarlo: tras mantenerlo, para y manda; tras un toque corto, sigue grabando. */
    function soltar() {
      if (modo !== 'mantener') return Promise.resolve(null);
      if (reloj() - pulsadoEn < umbral) { modo = 'toque'; return Promise.resolve(null); }
      modo = null;
      /* Si el permiso o el arranque aún no han terminado, para en cuanto empiece. */
      if (estado === 'arrancando') {
        return new Promise((ok) => { const mirar = () => (estado === 'arrancando' ? temporizador(mirar, 50) : ok(estado === 'grabando' ? parar() : null)); mirar(); });
      }
      return parar();
    }

    return {
      pulsar, soltar, empezar, parar, cancelar,
      estado: () => estado,
      modo: () => modo,
      tiempo: () => (estado === 'grabando' ? reloj() - inicio : 0),
    };
  }

  return { crearVoz, crearColaVoz, formatearTiempo, textoParaLeer, elegirVoz, apuntarAudio, audioDe, aviso, AVISOS, UMBRAL_MANTENER, MINIMO, MAXIMO };
});
