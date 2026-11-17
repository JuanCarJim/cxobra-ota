'use strict';
/*
 * LAS CONVERSACIONES CON IARVIS (7-nov-2026): una sola lógica para el escritorio,
 * la web y el móvil. La pantalla (renderer/iarvis.js) no sabe de nubes: llama aquí.
 *
 *   const conv = crearConversaciones({ nube, app, quien: () => ({ personaId, espacio }), almacen })
 *   await conv.preguntar({ pregunta, contexto, obraId, adjuntos }) → { id, estado, respuesta }
 *     (13-nov) `cuerpo`: lo que va SOLO en la llamada a la función y no se guarda en la fila (los datos de un
 *     juicio); `sinCola`: si no hay red no se encola (lo que va en `cuerpo` no sobrevive a la cola).
 *   await conv.historial()                                          → [filas, la más nueva primero]
 *   await conv.valorar(id, 'util' | 'no_util')
 *   await conv.adjuntar({ nombre, bytes, tipo })                    → referencia en el cubo
 *   await conv.reintentar()                                         → manda lo que quedó en cola
 *
 * Nunca lanza hacia la pantalla. Sin red, la pregunta queda en `almacen` (localStorage
 * o equivalente) y el chat dice que Iarvis contestará luego. Quien contesta es la edge
 * function `iarvis` (supabase/functions/iarvis/index.ts), que escribe en la misma fila.
 * Tabla y permisos: supabase/cxobra-sync/0046_iarvis_chat.sql.
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisConversaciones = API;
})(() => {
  const TABLA = 'ia_mensajes';
  const CUBO = 'ia-adjuntos';
  const MAX_ADJUNTO = 25 * 1024 * 1024; /* el mismo tope que el cubo */
  const MAX_PREGUNTA = 4000;
  const COLA = 'vidaire.iarvis.cola';
  /* 14-nov: `motor` dice quién contestó (🧭 su modelo «ollama» o ✳︎ «claude»); el chat lo enseña bajo la respuesta. */
  const CAMPOS = 'id,pregunta,respuesta,estado,valoracion,creado,adjuntos,propuesta,modelo,motor';
  const SIN_RED = 'Sin conexión: tu pregunta queda guardada y Iarvis te contestará en cuanto haya red.';
  const MAS_TARDE = 'Iarvis te contestará en un rato. Tu pregunta queda guardada.';
  /* 8-nov (JC: «Iarvis tiene que responder AL MOMENTO»): la cola es SOLO para cuando no hay red.
     Cualquier otro fallo se dice en el acto, sin prometer una respuesta que no va a llegar. */
  const NO_PUDO = 'Iarvis no ha podido contestar ahora. Vuelve a preguntármelo.';
  /* 13-nov · escalado (shared/ia/escalado.js): la nube puede contestar «esto lo hace la app» con la marca
     [[app:frase]]; quien pregunta la sigue. En el historial, esa fila se lee sin la marca. */
  const RE_MARCA = /\s*\[\[(?:app|dudo|pregunta|aclarar|sin-herramienta)(?::[^\]]*)?\]\]/g;
  const sinMarcas = (f) => (f && typeof f.respuesta === 'string' && f.respuesta.includes('[[')
    ? { ...f, respuesta: f.respuesta.replace(RE_MARCA, '').trim() || 'Te lo contesté con los datos de la app.' } : f);

  const uuid = () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  const limpioNombre = (n) => String(n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120);

  /* 11-nov (bloc 1011-hablar-con-iarvis): cada pregunta lleva el id de la conversación de la sesión
     (shared/ia/charla.js), y la función recuerda solo lo hablado en ESA conversación. */
  const Charla = (() => {
    try { if (typeof require === 'function') return require('./charla'); } catch { /* navegador */ }
    return (typeof window !== 'undefined' && window.IarvisCharla) || null;
  })();
  let convSinCharla = null;
  const idConversacion = (almacen, nueva = false) => {
    if (Charla && Charla.idConversacion) return Charla.idConversacion({ almacen, nueva });
    if (!convSinCharla || nueva) convSinCharla = uuid();
    return convSinCharla;
  };

  function crearConversaciones({ nube = null, app = 'obras', quien = () => null, almacen = null, plazoRespuesta = 90000 } = {}) {
    const leerCola = () => { try { return JSON.parse((almacen && almacen.getItem(COLA)) || '[]'); } catch { return []; } };
    const ponerCola = (l) => { try { if (almacen) almacen.setItem(COLA, JSON.stringify(l.slice(-50))); } catch { /* lleno */ } };
    const yo = () => {
      const q = (typeof quien === 'function' ? quien() : quien) || {};
      const deSesion = nube && !nube.esSecreta && nube.yo ? nube.yo() : null;
      return { personaId: (deSesion && deSesion.personaId) || q.personaId || null, espacio: (deSesion && deSesion.espacio) || q.espacio || 'principal' };
    };

    /** Pide a la edge function que conteste esa fila. */
    async function contestar(id, cuerpo = null) {
      const { personaId, espacio } = yo();
      try {
        const r = await nube.llamarFuncion('iarvis', '', JSON.stringify({ ...(cuerpo && typeof cuerpo === 'object' ? cuerpo : {}), id, persona_id: personaId, espacio }), cuerpo ? Math.max(plazoRespuesta, 150000) : plazoRespuesta);
        const j = await r.json().catch(() => null);
        if (j && j.estado) return { id, estado: j.estado, respuesta: j.respuesta || (j.estado === 'pendiente' ? MAS_TARDE : null), propuesta: j.propuesta || null, motor: j.motor || null, modelo: j.modelo || null };
        /* La función no está desplegada (404) o no ha contestado nada que se entienda. */
        return { id, estado: 'fallo', respuesta: NO_PUDO };
      } catch (e) {
        /* Sin red a mitad: la fila ya está en la nube, pendiente; el chat la sondea. */
        if (e && e.sinRed) return { id, estado: 'pendiente', respuesta: SIN_RED };
        return { id, estado: 'fallo', respuesta: NO_PUDO };
      }
    }

    async function preguntar({ pregunta, contexto = {}, obraId = null, adjuntos = [], cuerpo = null, sinCola = false } = {}) {
      const texto = String(pregunta || '').trim().slice(0, MAX_PREGUNTA);
      if (!texto) return { estado: 'fallo', respuesta: 'Escribe la pregunta.' };
      const { personaId, espacio } = yo();
      /* Sin nube y sin cola no se toca el almacén (ni el id de la conversación). */
      if (sinCola && (!nube || !personaId)) return { id: uuid(), estado: 'fallo', respuesta: NO_PUDO };
      const conversacion = idConversacion(almacen);
      const fila = { id: uuid(), espacio, persona_id: personaId, obra_id: obraId || null, app, pregunta: texto, contexto: { ...(contexto || {}), conversacion }, adjuntos };
      if (!nube || !personaId) {
        ponerCola([...leerCola(), fila]);
        return { id: fila.id, estado: 'pendiente', respuesta: SIN_RED, enCola: true };
      }
      try {
        await nube.meter(TABLA, [fila]);
      } catch (e) {
        if (sinCola && e && e.sinRed) return { id: fila.id, estado: 'fallo', respuesta: NO_PUDO };
        if (e && e.sinRed) { ponerCola([...leerCola(), fila]); return { id: fila.id, estado: 'pendiente', respuesta: SIN_RED, enCola: true }; }
        /* Una obra que no es suya (RLS) o un contexto demasiado grande: se intenta sin ellos. */
        try { await nube.meter(TABLA, [{ ...fila, obra_id: null, contexto: { app, pantalla: (contexto && contexto.pantalla) || '', conversacion } }]); } catch (e2) {
          if (e2 && e2.sinRed) { ponerCola([...leerCola(), fila]); return { id: fila.id, estado: 'pendiente', respuesta: SIN_RED, enCola: true }; }
          /* Antes esto iba a la cola y el móvil decía «te contestará en un rato» sin llamar nunca a la
             función (8-nov: faltaba el permiso de meter el `id`, supabase/cxobra-sync/0050). */
          return { id: fila.id, estado: 'fallo', respuesta: NO_PUDO };
        }
      }
      return contestar(fila.id, cuerpo);
    }

    /** Lo que quedó sin mandar (sin red o sin sesión): se mete y se contesta ahora. */
    async function reintentar() {
      const cola = leerCola();
      if (!cola.length || !nube) return [];
      const quedan = [];
      const hechas = [];
      for (const f of cola) {
        try {
          const { personaId, espacio } = yo();
          await nube.meter(TABLA, [{ ...f, persona_id: f.persona_id || personaId, espacio: f.espacio || espacio }]);
          hechas.push(await contestar(f.id));
        } catch (e) {
          if (e && e.sinRed) quedan.push(f);
          /* Otro error (ya estaba, RLS): se descarta para no atascar la cola. */
        }
      }
      ponerCola(quedan);
      return hechas;
    }

    async function historial({ limite = 40 } = {}) {
      const cola = leerCola().map((f) => ({ ...f, estado: 'pendiente', respuesta: SIN_RED, creado: null, enCola: true }));
      if (!nube) return cola;
      const { personaId, espacio } = yo();
      if (!personaId) return cola;
      try {
        const filas = await nube.leer(TABLA, `select=${CAMPOS}&persona_id=eq.${encodeURIComponent(personaId)}&espacio=eq.${encodeURIComponent(espacio)}&order=creado.desc&limit=${Math.min(200, limite)}`);
        return [...cola, ...(Array.isArray(filas) ? filas.map(sinMarcas) : [])];
      } catch { return cola; }
    }

    async function valorar(id, valoracion) {
      if (!['util', 'no_util'].includes(valoracion) || !nube) return { ok: false };
      const { personaId } = yo();
      try {
        await nube.cambiar(TABLA, `id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`, { valoracion });
        return { ok: true };
      } catch { return { ok: false }; }
    }

    async function estado(id) {
      if (!nube) return null;
      try {
        const f = await nube.leer(TABLA, `select=${CAMPOS}&id=eq.${encodeURIComponent(id)}`);
        return (Array.isArray(f) && sinMarcas(f[0])) || null;
      } catch { return null; }
    }

    /** Sube un archivo al cubo; devuelve la referencia que va en `adjuntos` (nunca los bytes). */
    async function adjuntar({ nombre, bytes, tipo = 'application/octet-stream' } = {}) {
      const tam = bytes ? (bytes.byteLength || bytes.length || 0) : 0;
      if (!tam) return { ok: false, aviso: 'El archivo está vacío.' };
      if (tam > MAX_ADJUNTO) return { ok: false, aviso: `«${nombre}» pesa ${(tam / 1048576).toFixed(1)} MB y el tope es ${MAX_ADJUNTO / 1048576} MB. Reduce el archivo o pártelo.` };
      if (!nube) return { ok: false, aviso: 'Sin conexión: el archivo no se puede subir ahora.' };
      const { personaId, espacio } = yo();
      if (!personaId) return { ok: false, aviso: 'Sin sesión: el archivo no se puede subir.' };
      const ruta = `${espacio}/${personaId}/${uuid()}-${limpioNombre(nombre)}`;
      try {
        await nube.subirArchivo(CUBO, ruta, bytes, tipo);
        return { ok: true, adjunto: { cubo: CUBO, ruta, nombre: String(nombre || ''), tipo, tamano: tam } };
      } catch (e) {
        return { ok: false, aviso: e && e.sinRed ? 'Sin conexión: el archivo no se ha subido.' : `No se ha podido subir «${nombre}».` };
      }
    }

    /** «Nueva conversación»: Iarvis deja de tener en cuenta lo hablado hasta ahora. */
    const nuevaConversacion = () => idConversacion(almacen, true);

    return { preguntar, reintentar, historial, valorar, estado, adjuntar, contestar, nuevaConversacion };
  }

  /** «… mira [[pantalla:compras]] …» → trozos de texto y enlaces para pintar. */
  function trozos(texto) {
    const fuera = [];
    const re = /\[\[pantalla:([\w-]+)\]\]/g;
    let ult = 0;
    let m;
    const t = String(texto || '');
    while ((m = re.exec(t))) {
      if (m.index > ult) fuera.push({ texto: t.slice(ult, m.index) });
      fuera.push({ pantalla: m[1] });
      ult = re.lastIndex;
    }
    if (ult < t.length) fuera.push({ texto: t.slice(ult) });
    return fuera;
  }

  return { crearConversaciones, trozos, MAX_ADJUNTO, CUBO, TABLA };
});
