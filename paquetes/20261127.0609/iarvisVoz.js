'use strict';
/*
 * 🎙 AUDIOS A IARVIS EN VIDAIRE CX (12-nov-2026, JC: «mandar audios a Iarvis y que los entienda
 * y que pueda responder»). Se monta sobre el chat del móvil (renderer/movil/iarvisMovil.js, que
 * usa el componente renderer/iarvis.js) sin tocar el componente:
 *
 *   · micrófono junto a «Mandar»: mantener pulsado graba y al soltar se manda; un toque corto
 *     empieza y otro toque manda. Se ve el tiempo y ✕ cancela.
 *   · el audio se pasa a texto EN EL TELÉFONO y ese texto va a Iarvis como cualquier pregunta;
 *     la burbuja enseña el ▶ del audio y el texto entendido.
 *   · cada respuesta lleva un altavoz que la lee con la voz del dispositivo en español.
 *
 * Motores: en la app del iPhone, el plugin VozIarvis (cxobra/nativo/VozIarvisPlugin.swift:
 * AVAudioRecorder + Speech, en el teléfono si el modelo lo permite, y AVSpeechSynthesizer, que
 * suena aunque el iPhone esté en silencio). Sin el plugin (navegador, o una compilación que aún
 * no lo lleva): MediaRecorder + webkitSpeechRecognition + speechSynthesis, si los hay.
 * La lógica (cola sin red, mantener/tocar, texto para leer) está en shared/ia/voz.js.
 */
(function iarvisVoz() {
  const V = window.IarvisVoz;
  if (!V) return;
  let almacen = null;
  try { almacen = window.localStorage; } catch { /* sin almacenamiento: sin cola ni ▶ al repintar */ }

  const ICONO_MIC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
  const ICONO_PARAR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
  const ICONO_ALTAVOZ = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const ICONO_CALLAR = ICONO_PARAR;

  /* ── MOTORES ─────────────────────────────────────────────────────────────── */
  const error = (code, msg) => Object.assign(new Error(msg || code), { code });

  function pluginNativo() {
    const C = window.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    if (typeof C.isPluginAvailable === 'function' && !C.isPluginAvailable('VozIarvis')) return null;
    try { return C.registerPlugin ? C.registerPlugin('VozIarvis') : (C.Plugins && C.Plugins.VozIarvis) || null; } catch { return null; }
  }

  function motorNativo(P) {
    const C = window.Capacitor;
    const comoCodigo = (e) => error(e && e.code ? String(e.code) : 'fallo', e && e.message);
    return {
      tipo: 'nativo',
      empezar: async () => {
        const p = await P.permisos().catch(() => ({}));
        if (!p.microfono) throw error('sin-permiso');
        await P.empezar().catch((e) => { throw comoCodigo(e); });
      },
      parar: async () => {
        const r = await P.parar().catch((e) => { throw comoCodigo(e); });
        return { ruta: r.ruta, src: C && C.convertFileSrc ? C.convertFileSrc(r.ruta) : '', duracion: r.duracion };
      },
      cancelar: () => P.cancelar(),
      transcribir: async ({ ruta }) => (await P.transcribir({ ruta, idioma: 'es-ES' }).catch((e) => { throw comoCodigo(e); })).texto,
    };
  }

  function motorNavegador() {
    const MD = navigator.mediaDevices;
    const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!MD || !MD.getUserMedia || !window.MediaRecorder) return null;
    let flujo = null; let grab = null; let trozos = []; let rec = null; let texto = ''; let fallo = ''; let finRec = null;
    const soltarFlujo = () => { if (flujo) flujo.getTracks().forEach((t) => t.stop()); flujo = null; };
    return {
      tipo: 'navegador',
      empezar: async () => {
        try { flujo = await MD.getUserMedia({ audio: true }); } catch { throw error('sin-permiso'); }
        trozos = []; texto = ''; fallo = '';
        grab = new MediaRecorder(flujo);
        grab.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
        grab.start();
        if (Reconocer) {
          rec = new Reconocer();
          rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
          rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) texto += `${e.results[i][0].transcript} `; };
          rec.onerror = (e) => { fallo = e.error || 'fallo'; };
          finRec = new Promise((ok) => { rec.onend = ok; });
          try { rec.start(); } catch { rec = null; }
        }
      },
      parar: async () => {
        const audio = new Promise((ok) => { grab.onstop = ok; });
        try { grab.stop(); } catch { /* ya parado */ }
        if (rec) { try { rec.stop(); } catch { /* ya parado */ } await Promise.race([finRec, new Promise((ok) => setTimeout(ok, 3000))]); }
        await Promise.race([audio, new Promise((ok) => setTimeout(ok, 2000))]);
        soltarFlujo();
        const blob = new Blob(trozos, { type: (grab && grab.mimeType) || 'audio/mp4' });
        return { src: URL.createObjectURL(blob), texto: texto.trim(), fallo, conReconocedor: Boolean(rec) };
      },
      cancelar: async () => { try { if (grab) grab.stop(); if (rec) rec.abort(); } catch { /* ya parado */ } soltarFlujo(); },
      transcribir: async (g) => {
        if (!g || !g.conReconocedor) throw error('no-disponible');
        if (g.fallo === 'network') throw error(navigator.onLine === false ? 'sin-red-web' : 'no-disponible');
        if (g.fallo === 'not-allowed' || g.fallo === 'service-not-allowed') throw error('sin-permiso');
        throw error('sin-voz');
      },
    };
  }

  /* Leer en voz alta: el sintetizador del iPhone (suena con el interruptor de silencio puesto)
     o el del navegador. */
  function crearLector(P) {
    let alTerminar = null;
    if (P && P.hablar) {
      try { P.addListener('fin', () => { if (alTerminar) alTerminar(); }); } catch { /* sin aviso de fin */ }
      return {
        hablar: (t, fin) => { alTerminar = fin; return P.hablar({ texto: t, idioma: 'es-ES' }); },
        callar: () => P.callar(),
      };
    }
    const S = window.speechSynthesis;
    if (!S || !window.SpeechSynthesisUtterance) return null;
    return {
      hablar: (t, fin) => {
        S.cancel();
        const u = new window.SpeechSynthesisUtterance(t);
        u.lang = 'es-ES';
        const voz = V.elegirVoz(S.getVoices());
        if (voz) u.voice = voz;
        u.onend = fin; u.onerror = fin;
        S.speak(u);
      },
      callar: () => S.cancel(),
    };
  }

  const P = pluginNativo();
  const motor = (P && motorNativo(P)) || motorNavegador();
  const lector = crearLector(P);
  const cola = V.crearColaVoz({ almacen });
  /* Las preguntas que vinieron de un audio (para el contexto: «entrada: voz»). */
  const deVoz = new Set();

  /* ── EL CHAT ─────────────────────────────────────────────────────────────── */
  const panel = () => document.querySelector('.iaPanel.iaMovil');
  const ocupado = () => Boolean(window.IARVIS && window.IARVIS.estado && window.IARVIS.estado.ocupado);

  async function enviar(texto, meta) {
    const p = panel();
    if (!p || !document.body.contains(p)) throw error('fallo', 'Chat cerrado');
    for (let i = 0; i < 200 && ocupado(); i++) await new Promise((ok) => setTimeout(ok, 300));
    V.apuntarAudio(almacen, { texto, src: meta.src, duracion: meta.duracion });
    if (meta.src && !meta.ruta) audiosSesion.set(texto, meta.src);
    deVoz.add(texto);
    const caja = p.querySelector('textarea');
    caja.value = texto;
    p.querySelector('.iaMandar').click();
  }
  const audiosSesion = new Map(); /* los del navegador: blob: de esta vez */

  let voz = null; let reloj = null; let avisoT = null;
  function decir(texto) {
    const z = panel() && panel().querySelector('.iaVozAviso');
    if (!z) return;
    z.textContent = texto; z.hidden = !texto;
    clearTimeout(avisoT);
    avisoT = setTimeout(pintarCola, 7000);
  }
  function pintarCola() {
    const z = panel() && panel().querySelector('.iaVozAviso');
    if (!z) return;
    const n = cola.listar().length;
    z.textContent = n ? `${n === 1 ? '1 audio espera' : `${n} audios esperan`} conexión: se mandan solos al volver la red.` : '';
    z.hidden = !n;
  }

  function pintarGrabando(estado) {
    const p = panel();
    if (!p) return;
    const fila = p.querySelector('.iaFila');
    const b = p.querySelector('.iaMic');
    const grabando = estado === 'grabando' || estado === 'arrancando';
    fila.classList.toggle('iaGrabando', grabando);
    fila.classList.toggle('iaEntendiendo', estado === 'entendiendo');
    const pista = p.querySelector('.iaVozPista');
    if (pista) pista.textContent = estado === 'entendiendo' ? 'Entendiendo…' : voz.modo() === 'toque' ? 'Toca ■ para mandar' : 'Suelta para mandar';
    b.innerHTML = grabando && voz.modo() === 'toque' ? ICONO_PARAR : ICONO_MIC;
    b.setAttribute('aria-label', grabando ? 'Parar y mandar' : 'Grabar un audio para Iarvis');
    clearInterval(reloj);
    const t = p.querySelector('.iaVozTiempo');
    if (grabando) reloj = setInterval(() => { t.textContent = V.formatearTiempo(voz.tiempo()); }, 250);
    t.textContent = V.formatearTiempo(voz.tiempo());
  }

  function instalar() {
    const p = panel();
    if (!p || p.querySelector('.iaMic')) { decorar(); return; }
    const fila = p.querySelector('.iaFila');
    const caja = p.querySelector('textarea');
    if (!fila || !caja) return;
    caja.placeholder = motor ? 'Escribe o habla' : caja.placeholder;
    const aviso = document.createElement('div');
    aviso.className = 'iaVozAviso'; aviso.hidden = true; aviso.setAttribute('role', 'status');
    p.querySelector('.iaEntrada').prepend(aviso);
    if (!motor) return;
    const barra = document.createElement('div');
    barra.className = 'iaVozBarra';
    barra.innerHTML = '<span class="iaVozPunto" aria-hidden="true"></span><span class="iaVozTiempo">0:00</span><span class="iaVozPista"></span><button type="button" class="iaVozCancelar" aria-label="Cancelar el audio">Cancelar</button>';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'iaMic'; b.innerHTML = ICONO_MIC;
    b.title = 'Mantén pulsado para hablar · o toca para empezar y otra vez para mandar';
    b.setAttribute('aria-label', 'Grabar un audio para Iarvis');
    fila.insertBefore(barra, caja);
    fila.insertBefore(b, p.querySelector('.iaMandar'));
    voz = V.crearVoz({ motor, cola, enviar, avisar: decir, cambio: pintarGrabando });
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* sin captura */ } voz.pulsar(); });
    b.addEventListener('pointerup', (e) => { e.preventDefault(); voz.soltar(); pintarGrabando(voz.estado()); });
    b.addEventListener('pointercancel', () => { if (voz.modo() === 'mantener') voz.cancelar(); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    barra.querySelector('.iaVozCancelar').addEventListener('click', () => voz.cancelar());
    const lista = p.querySelector('.iaLista');
    if (lista) new MutationObserver(decorar).observe(lista, { childList: true });
    decorar();
    pintarCola();
    mandarCola();
  }

  /* ── LAS BURBUJAS: ▶ del audio en la pregunta, altavoz en la respuesta ────── */
  let sonando = null;
  function decorar() {
    const p = panel();
    if (!p) return;
    for (const q of p.querySelectorAll('.iaPregunta:not([data-voz])')) {
      q.setAttribute('data-voz', '');
      const n = q.firstChild;
      const texto = n && n.nodeType === 3 ? n.textContent.trim() : '';
      const a = texto && V.audioDe(almacen, texto);
      if (!a) continue;
      const src = audiosSesion.get(texto) || a.src;
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'iaAudio';
      chip.innerHTML = `<span aria-hidden="true">▶</span> ${V.formatearTiempo(a.duracion)}`;
      chip.setAttribute('aria-label', `Escuchar el audio (${V.formatearTiempo(a.duracion)})`);
      chip.addEventListener('click', () => {
        if (!src) return;
        const au = new Audio(src);
        au.play().catch(() => { chip.textContent = 'Audio no disponible'; chip.disabled = true; });
      });
      q.prepend(chip);
    }
    if (!lector) return;
    for (const r of p.querySelectorAll('.iaRespuesta:not(.iaEspera):not(.iaPensando):not([data-voz])')) {
      r.setAttribute('data-voz', '');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'iaAltavoz'; b.innerHTML = ICONO_ALTAVOZ;
      b.title = 'Leer en voz alta'; b.setAttribute('aria-label', 'Leer la respuesta en voz alta');
      b.addEventListener('click', () => {
        if (sonando === b) { lector.callar(); fin(); return; }
        if (sonando) fin();
        const copia = r.cloneNode(true);
        copia.querySelectorAll('button, .iaPie, .iaAcciones, .iaPropuesta').forEach((x) => x.remove());
        copia.querySelectorAll('p, li, br, h1, h2, h3, h4').forEach((x) => x.after('\n'));
        const t = V.textoParaLeer(copia.textContent);
        if (!t) return;
        sonando = b; b.innerHTML = ICONO_CALLAR; b.classList.add('iaSonando'); b.setAttribute('aria-label', 'Callar');
        Promise.resolve(lector.hablar(t, fin)).catch(fin);
      });
      const pie = r.querySelector('.iaPie');
      if (pie) pie.prepend(b); else r.append(b);
    }
  }
  function fin() {
    const b = sonando; sonando = null;
    if (!b) return;
    b.innerHTML = ICONO_ALTAVOZ; b.classList.remove('iaSonando'); b.setAttribute('aria-label', 'Leer la respuesta en voz alta');
  }

  /* ── SIN RED: lo guardado sale al volver ─────────────────────────────────── */
  async function mandarCola() {
    if (!motor || !cola.listar().length || !panel() || navigator.onLine === false) return;
    const r = await cola.procesar({ motor, enviar }).catch(() => null);
    if (r && r.descartados) decir(`${r.descartados === 1 ? 'Un audio guardado no se ha entendido' : `${r.descartados} audios guardados no se han entendido`}: vuelve a grabarlo.`);
    else pintarCola();
  }
  window.addEventListener('online', mandarCola);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mandarCola(); });

  window.CX_VOZ = { esDeVoz: (t) => deVoz.has(String(t || '').trim()), motor: motor && motor.tipo };
  const montar = () => setTimeout(instalar, 0);
  window.addEventListener('hashchange', montar);
  montar();
})();
