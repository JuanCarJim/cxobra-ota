'use strict';
/*
 * EL IDIOMA DE LA INTERFAZ (fase 1 de «Idiomas», nota 1105).
 *
 *   t('login.entrar')                      texto con clave, en el idioma activo
 *   t('ini.sinNada', { lista: 'Hoy' })     con {marcadores}
 *   nombre('Obras')                        una etiqueta que en el código está en español
 *                                          (menú, secciones, puestos, títulos del inicio)
 *   fecha('2026-11-05')  numero(1234.5)    con el formato del idioma
 *
 * Seis idiomas: es (la fuente), en, ca, pt, de, fr. Es el ÚNICO motor de idiomas:
 * shared/idiomas.js (los documentos: informe a la DF…) toma de aquí la lista,
 * los nombres y los formatos. Lo que falte en uno se muestra
 * en español, nunca la clave pelada. SOLO INTERFAZ: datos e impresos oficiales
 * no pasan por aquí.
 *
 * Dónde se guarda: en la ficha de la persona (personas.idioma), que viaja con
 * la sincronización al escritorio, la web y el móvil; y en este aparato
 * (localStorage) para la pantalla de entrada, que se pinta antes de saber quién eres.
 */
(function (raiz, fabrica) {
  const x = fabrica(typeof module === 'object' && module.exports ? require('./idiomaTextos.js') : raiz.IDIOMA_TEXTOS);
  if (typeof module === 'object' && module.exports) module.exports = x;
  else raiz.IDIOMA = x;
})(typeof window !== 'undefined' ? window : globalThis, function (TEXTOS) {

  const IDIOMAS = [
    { id: 'es', nombre: 'Español', local: 'es-ES' },
    { id: 'en', nombre: 'English', local: 'en-GB' },
    { id: 'ca', nombre: 'Català', local: 'ca-ES' },
    { id: 'pt', nombre: 'Português', local: 'pt-PT' },
    { id: 'de', nombre: 'Deutsch', local: 'de-CH' },
    { id: 'fr', nombre: 'Français', local: 'fr-FR' },
  ];
  const BASE = 'es';
  const IDS = IDIOMAS.map((i) => i.id);
  if (TEXTOS.ORDEN.join() !== IDS.join()) throw new Error('idiomaTextos.js no trae las columnas en el orden de IDIOMAS');
  const CLAVE_LOCAL = 'idioma';

  /* Los diccionarios, armados desde las filas de idiomaTextos.js. */
  function construir(textos) {
    const dic = Object.fromEntries(IDS.map((i) => [i, {}]));
    textos.FIJAS.forEach((fila) => {
      const [clave, ...valores] = fila;
      IDS.forEach((id, n) => { dic[id][clave] = valores[n]; });
    });
    textos.NOMBRES.forEach((fila) => {
      IDS.forEach((id, n) => { dic[id][`n.${fila[0]}`] = fila[n]; });
    });
    return dic;
  }
  const DICCIONARIOS = construir(TEXTOS);

  let activo = BASE;
  const oyentes = new Set();

  /** Un código cualquiera ('en-GB', 'PT', 'ca_ES') al id que tenemos, o null. */
  function normalizar(codigo) {
    const c = String(codigo || '').toLowerCase().replace('_', '-').split('-')[0];
    return IDS.includes(c) ? c : null;
  }

  /** El idioma del aparato, si es uno de los nuestros; si no, español. */
  function detectar() {
    if (typeof navigator === 'undefined') return BASE;
    const lista = [...(navigator.languages || []), navigator.language];
    for (const l of lista) { const n = normalizar(l); if (n) return n; }
    return BASE;
  }

  function idioma() { return activo; }
  function local() { return IDIOMAS.find((i) => i.id === activo).local; }

  /** Cambia el idioma activo y avisa a quien escuche. Devuelve el que ha quedado. */
  function poner(codigo, { recordar = true } = {}) {
    const id = normalizar(codigo) || BASE;
    const cambia = id !== activo;
    activo = id;
    if (recordar) { try { localStorage.setItem(CLAVE_LOCAL, id); } catch { /* sin almacenamiento */ } }
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = id;
    if (cambia) oyentes.forEach((f) => { try { f(id); } catch { /* un oyente no tumba al resto */ } });
    return id;
  }

  /**
   * Al arrancar: el idioma ELEGIDO en este aparato; sin elección, español. 14-nov (JC, con el Mac en inglés y la app en
   * español: las pestañas salían «Drawing», «Equipment», «Tests and start-up»): el idioma del sistema no decide el de la
   * app; solo cambia cuando alguien lo elige en Ajustes. `detectar` queda para proponerlo, no para imponerlo.
   */
  function iniciar() {
    let guardado = null;
    try { guardado = localStorage.getItem(CLAVE_LOCAL); } catch { /* nada */ }
    return poner(guardado || BASE, { recordar: false });
  }

  function alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); }

  function rellenar(texto, vars) {
    if (!vars) return texto;
    return texto.replace(/\{(\w+)\}/g, (m, k) => (k in vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  }

  /** El texto de una clave en el idioma activo (o en español; o la clave, si no existe en ninguno). */
  function t(clave, vars) {
    const d = DICCIONARIOS[activo];
    const texto = (d && d[clave] !== undefined) ? d[clave] : DICCIONARIOS[BASE][clave];
    return rellenar(texto === undefined ? clave : texto, vars);
  }

  /** Una etiqueta escrita en español en el código: su traducción, o ella misma si no está. */
  function nombre(texto) {
    if (activo === BASE || texto === null || texto === undefined) return texto;
    const v = DICCIONARIOS[activo][`n.${texto}`];
    return v === undefined ? texto : v;
  }

  /* Fechas y números, con las reglas del idioma. */
  function comoFecha(valor) {
    if (valor instanceof Date) return valor;
    const s = String(valor ?? '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    /* Un día suelto ('2026-11-05') se toma a mediodía local: sin eso, en UTC cambiaría de día. */
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** 'corta' 05/11/2026 · 'larga' 5 de noviembre de 2026 · 'hora' 14:30 · 'diaMes' 5 nov. */
  function fecha(valor, estilo = 'corta') {
    const d = comoFecha(valor);
    if (!d) return '';
    const opciones = {
      corta: { day: '2-digit', month: '2-digit', year: 'numeric' },
      larga: { day: 'numeric', month: 'long', year: 'numeric' },
      hora: { hour: '2-digit', minute: '2-digit' },
      diaMes: { day: 'numeric', month: 'short' },
      diaSemana: { weekday: 'long' },
    }[estilo] || { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Intl.DateTimeFormat(local(), opciones).format(d);
  }

  function numero(n, opciones = {}) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return new Intl.NumberFormat(local(), opciones).format(v);
  }

  return {
    IDIOMAS, BASE, IDS, DICCIONARIOS, CLAVE_LOCAL,
    normalizar, detectar, idioma, local, poner, iniciar, alCambiar,
    t, nombre, fecha, numero,
  };
});
