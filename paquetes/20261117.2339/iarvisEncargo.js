'use strict';
/*
 * IARVIS PROGRAMA O ARREGLA LA APP (13-nov-2026) — SOLO para su dueño, como Iarvis personal.
 *
 * Qué hace: de «arregla que el botón de la ficha no guarda» saca un ENCARGO (qué pantalla, qué ficheros según
 * el mapa de código, criterio de aceptación) y lo ejecuta el ordenador de desarrollo lanzando Claude Code en
 * local (`claude -p`) dentro de un worktree NUEVO, nunca en el repositorio principal. El encargo obliga a usar
 * el mapa, pasar la suite y dejar commit SIN push. Al acabar, avisa con el resumen y las capturas.
 *
 * Blindaje (lo que NO se puede romper):
 *   · Solo quien figura en el fichero personal de ESE ordenador (fuera del repositorio) y además es administrador.
 *     A cualquier otro se le dice lo mismo que a todo lo que no es usar la app: no, y que puede dejar una sugerencia.
 *   · Desde la web o el móvil no se ejecuta nada: la petición queda en cola y la recoge el ordenador. Quién puede
 *     encolar lo decide el SERVIDOR (ajuste `iarvis_personal`), no el cliente.
 *   · Nada de claves: el texto del encargo se mira antes de salir, y el proceso hijo corre sin las claves del entorno
 *     y con el push anulado.
 *
 * Este fichero no toca disco ni lanza procesos: eso es electron/data/iarvisEncargos.js. Aquí, lo que se puede probar.
 */
(function (fabrica) {
  const API = fabrica();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.IarvisEncargo = API;
})(() => {
  const llano = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /* «programa…», «implementa…», o un verbo de cambio + una pieza de la app. «Cambia la fecha de la UTA-01» NO lo es:
     eso es usar la app. Tampoco una pregunta («¿cómo cambio…?», «¿se puede añadir…?»). */
  const RE_PROGRAMAR = /\b(programa(?:me|lo|la)?|implementa(?:me|lo|la)?|desarrolla(?:me)?|codifica|refactoriza)\b/;
  const RE_CAMBIO = /\b(arregla(?:me|lo|la)?|corrige|repara|cambia(?:me)?|modifica|anade(?:me|le)?|pon(?:me|le)?|quita(?:me|le)?|mete(?:me|le)?|haz que|que salga|que aparezca)\b/;
  const RE_PIEZA = /\b(la app|la aplicacion|el codigo|el programa|la pantalla|la ventana|la pestana|el boton|un boton|el menu|la barra|el modulo|el fichero|la funcion|el fallo de la app|el fallo de la pantalla|el bug|el error de la app|el listado de la app|la tabla de la pantalla|el formulario|el pdf que saca|el informe que saca|a iarvis|iarvis sepa|iarvis pueda)\b/;
  const RE_PREGUNTA = /^(¿|como |se puede|puedo |podria|es posible|sabes |donde |por que |que es )/;

  function detectar(pregunta) {
    const original = String(pregunta || '').trim();
    const t = llano(original);
    if (!t || t.length < 12) return null;
    if (RE_PREGUNTA.test(t) || /\?\s*$/.test(original)) return null;
    const explicito = /^(encargo|iarvis,? programa|programa)\s*:/.test(t);
    if (!explicito && !RE_PROGRAMAR.test(t) && !(RE_CAMBIO.test(t) && RE_PIEZA.test(t))) return null;
    return { texto: original.replace(/^\s*(encargo|iarvis,?\s*programa|programa)\s*:\s*/i, '').slice(0, 2000) };
  }

  /** A quien no es el dueño: lo de siempre, sin nombrar a nadie ni decir que la capacidad existe. */
  const NEGATIVA = 'Eso no lo hago: cambiar la app es cosa del equipo de desarrollo. Si quieres, dime «estaría bien que…» y lo dejo anotado como sugerencia para ellos.';
  const EN_COLA = 'Queda en la cola del ordenador de desarrollo. Cuando esté hecho te aviso aquí con el resumen.';
  const SOLO_ORDENADOR = 'Esto solo se ejecuta en el ordenador de desarrollo.';

  /**
   * ¿Puede este usuario encargar programación en ESTE ordenador? Administrador + la misma persona que el fichero
   * personal del ordenador (que vive fuera del repositorio) + ese fichero lo permite. Sin fichero, nadie.
   */
  function puedeProgramar(yo, personal) {
    if (!yo || !personal || typeof personal !== 'object') return false;
    if (yo.rol !== 'administrador') return false;
    if (personal.programar !== true) return false;
    const a = String(yo.personaId || '').trim();
    const b = String(personal.personaId || '').trim();
    return !!a && a === b;
  }

  /* ── Nada de claves en el encargo ni en los mensajes ── */
  const SECRETOS = [
    /sk-ant-[A-Za-z0-9_-]{8,}/g, /sk-[A-Za-z0-9]{20,}/g, /sbp_[A-Za-z0-9]{20,}/g, /sb_secret_[A-Za-z0-9_-]{10,}/g,
    /gh[pousr]_[A-Za-z0-9]{20,}/g, /AKIA[0-9A-Z]{16}/g, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    /\b(contrasena|password|passwd|clave|token|secret|api[_-]?key|service[_-]?role)\b\s*[:=]\s*\S{6,}/gi,
  ];
  const tapar = (texto) => SECRETOS.reduce((t, re) => t.replace(re, '[clave quitada]'), String(texto || ''));
  const tieneSecretos = (texto) => tapar(texto) !== String(texto || '');

  /** El entorno del proceso hijo: sin claves, sin nube y con el push anulado. */
  function entornoLimpio(env = {}) {
    const fuera = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|SUPABASE|SERVICE_ROLE|ANTHROPIC|OPENAI|AWS_|VERCEL|EXPO_|EAS_|GH_|GITHUB|NPM_)/i;
    const out = {};
    for (const [k, v] of Object.entries(env || {})) if (!fuera.test(k)) out[k] = v;
    delete out.ELECTRON_RUN_AS_NODE;
    return {
      ...out,
      VIDAIRE_SIN_NUBE: '1',
      /* `git push` desde el encargo no llega a ningún sitio. */
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'remote.origin.pushurl', GIT_CONFIG_VALUE_0: 'file:///dev/null/push-anulado',
    };
  }

  const slug = (s) => llano(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'encargo';

  /** Las palabras con las que se pregunta al mapa: la pantalla y lo sustantivo de la petición. */
  const VACIAS = new Set('que el la los las un una unos unas de del al a en y o con sin por para no se me le lo es esta este esto app aplicacion pantalla boton arregla corrige cambia anade pon quita haz programa implementa cuando como salga aparezca iarvis'.split(' '));
  function terminos(texto, pantalla = '') {
    const pal = llano(`${pantalla} ${texto}`).split(/[^a-z0-9]+/).filter((p) => p.length > 3 && !VACIAS.has(p));
    return [...new Set(pal)].slice(0, 5);
  }

  /**
   * El encargo: qué pantalla, qué ficheros (los candidatos que da el mapa de código) y el criterio de aceptación.
   * `candidatos`: líneas «ruta:línea …» del mapa (o vacío: el encargo obliga a consultarlo igualmente).
   */
  function preparar({ pregunta, pantalla = '', candidatos = [], ahora = new Date() } = {}) {
    const d = detectar(pregunta) || { texto: String(pregunta || '').trim().slice(0, 2000) };
    const texto = tapar(d.texto);
    const dia = new Date(ahora).toISOString().slice(0, 10).replace(/-/g, '');
    const hora = new Date(ahora).toISOString().slice(11, 19).replace(/:/g, '');
    const id = `${dia}-${hora}-${slug(texto).slice(0, 24)}`;
    const ficheros = (Array.isArray(candidatos) ? candidatos : []).map((c) => String(c || '').trim()).filter((c) => /^[\w./-]+\.\w+(:\d+)?/.test(c)).slice(0, 8);
    const criterio = [
      `Lo pedido funciona${pantalla ? ` en «${pantalla}»` : ''}: ${texto}`,
      'Hay una prueba en test/ que lo cubre (falla sin el cambio y pasa con él).',
      'La suite completa pasa: `npm test` en verde.',
      'El cambio queda en un commit de la rama del encargo. Sin push, sin publicar, sin tocar la base real.',
      'Si la pantalla se puede arrancar, una captura del resultado en .iarvis/capturas/.',
    ];
    return { id, rama: `iarvis/enc-${id}`, titulo: texto.slice(0, 90), texto, pantalla: String(pantalla || '').slice(0, 120), ficheros, criterio, pedido: new Date(ahora).toISOString() };
  }

  /** La tarjeta que ve el dueño antes de lanzar. */
  function tarjeta(e) {
    return [
      `Encargo: ${e.titulo}`,
      e.pantalla ? `Pantalla: ${e.pantalla}` : 'Pantalla: por confirmar (la localiza con el mapa)',
      e.ficheros.length ? `Ficheros según el mapa:\n${e.ficheros.map((f) => `  · ${f}`).join('\n')}` : 'Ficheros: los localiza con el mapa de código antes de tocar nada',
      `Criterio de aceptación:\n${e.criterio.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`,
      'Se hace en una copia de trabajo nueva, con commit y sin push.',
    ].join('\n');
  }

  /** Lo que recibe Claude Code. Es el contrato del encargo: mapa, suite, commit sin push, resumen y capturas. */
  function prompt(e, { mapa = 'node ~/Proyectos/Bitacora/herramientas/mapa/mapa.mjs vidaire' } = {}) {
    return tapar([
      'ENCARGO DE PROGRAMACIÓN (Vidaire Obras). Trabajas en ESTA copia de trabajo (worktree) y solo en ella.',
      '',
      `Qué se pide: ${e.texto}`,
      e.pantalla ? `Pantalla desde la que se pidió: ${e.pantalla}` : '',
      e.ficheros.length ? `Candidatos según el mapa de código:\n${e.ficheros.map((f) => `- ${f}`).join('\n')}` : '',
      '',
      'Reglas, todas obligatorias:',
      `1. ANTES de buscar o abrir ficheros, consulta el mapa de código: \`${mapa} donde <término>\` (también \`quien-usa\`, \`fichero\`). El mapa indexa el repositorio principal; las rutas son las mismas aquí. Lee y edita SOLO en este directorio.`,
      '2. No salgas de este directorio: no edites ni ejecutes nada en el repositorio principal ni en otros proyectos.',
      '3. Escribe o amplía una prueba en test/ que cubra el cambio.',
      '4. Pasa la suite entera con `npm test` y no des nada por hecho hasta que esté en verde. De una en una, nada en paralelo.',
      '5. Haz commit en la rama actual con un mensaje claro. NO hagas push, no publiques, no despliegues, no apliques migraciones, no toques la base real.',
      '6. Nada de claves ni contraseñas en el código, en los mensajes ni en el commit.',
      '7. Si puedes arrancar la pantalla tocada, deja una captura en .iarvis/capturas/ (PNG). Si no puedes, dilo.',
      '8. Si lo pedido no está claro o no se puede hacer bien, NO inventes: deja el repositorio como estaba y explica qué falta.',
      '',
      `Criterio de aceptación:\n${e.criterio.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
      '',
      'Termina con un RESUMEN corto en español: qué has cambiado (ficheros), qué prueba lo cubre, resultado de la suite, el commit, y lo que NO has podido comprobar.',
    ].filter((l) => l !== '').join('\n'));
  }

  /** Los argumentos de `claude -p`: edita y prueba; el push, vetado. El prompt va por la entrada estándar. */
  function argumentos({ modelo = null, tope = 15 } = {}) {
    return [
      '-p', '--output-format', 'json', '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(node:*)', 'Bash(npm test:*)', 'Bash(npm run:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git log:*)', 'Bash(ls:*)', 'Bash(sed:*)', 'Bash(grep:*)', 'Bash(mkdir:*)',
      '--disallowedTools', 'Bash(git push:*)', 'Bash(git remote:*)', 'Bash(rm -rf:*)', 'Bash(curl:*)', 'WebFetch', 'WebSearch',
      '--max-budget-usd', String(tope),
      ...(modelo ? ['--model', String(modelo)] : []),
    ];
  }

  /** ¿Se puede trabajar ahí? Nunca en el repositorio principal ni dentro de él. Rutas ya resueltas (absolutas). */
  function validarDestino(worktree, repoPrincipal) {
    const limpia = (p) => String(p || '').replace(/\/+$/, '');
    const w = limpia(worktree); const r = limpia(repoPrincipal);
    if (!w || !w.startsWith('/')) return { ok: false, motivo: 'La copia de trabajo no tiene ruta.' };
    if (!r) return { ok: false, motivo: 'No sé cuál es el repositorio principal.' };
    if (w === r) return { ok: false, motivo: 'Nunca se trabaja en el repositorio principal.' };
    if (w.startsWith(`${r}/`)) return { ok: false, motivo: 'La copia de trabajo no puede estar dentro del repositorio principal.' };
    if (r.startsWith(`${w}/`)) return { ok: false, motivo: 'La copia de trabajo no puede contener al repositorio principal.' };
    return { ok: true };
  }

  /** El aviso final: resumen, commit, coste y capturas. Sin claves aunque el resumen las trajera. */
  function aviso(e, r = {}) {
    const lineas = [
      r.ok ? `Encargo hecho: ${e.titulo}` : `Encargo sin terminar: ${e.titulo}`,
      r.resumen ? tapar(String(r.resumen)).slice(0, 4000) : '',
      r.commits && r.commits.length ? `Commit: ${r.commits.join(', ')} (rama ${e.rama}, sin push)` : 'Sin commit.',
      r.suite ? `Suite: ${r.suite}` : '',
      r.worktree ? `Copia de trabajo: ${r.worktree}` : '',
      r.capturas && r.capturas.length ? `Capturas:\n${r.capturas.map((c) => `  · ${c}`).join('\n')}` : 'Capturas: ninguna',
      r.coste != null ? `Coste: ${Number(r.coste).toFixed(2)} USD` : '',
      r.motivo ? `Motivo: ${tapar(r.motivo)}` : '',
    ];
    return lineas.filter(Boolean).join('\n');
  }

  return { detectar, NEGATIVA, EN_COLA, SOLO_ORDENADOR, puedeProgramar, tapar, tieneSecretos, entornoLimpio, slug, terminos, preparar, tarjeta, prompt, argumentos, validarDestino, aviso };
});
