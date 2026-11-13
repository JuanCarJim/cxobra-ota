'use strict';
/*
 * LA BARRA DE ABAJO DEL MÓVIL SEGÚN EL ROL (8-nov-2026, JC eligió la opción B: «como el
 * inicio del ordenador»). Todo lo que decide qué pestañas lleva cada rol y qué va en «Más»
 * está AQUÍ, en una tabla; carcasa.js solo pinta. Sin tocar el DOM: sirve en el navegador
 * (window.CXBarraRol) y en node (module.exports) para las pruebas.
 *
 *   · ABAJO, siempre [Inicio] [X] [+] [Y] [Más]: X e Y, lo que más usa el rol
 *     (BARRA_POR_ROL, por orden de preferencia: se cogen las dos primeras que el rol
 *     puede ver; si no llega, se rellena con RELLENO). El «+» no es una pestaña.
 *   · «MÁS», una lista agrupada con los mismos grupos, nombres e iconos que la barra
 *     lateral del ordenador (shared/roles.js › SECCIONES_OBRA y «Mi espacio» de
 *     renderer/app.js), en orden alfabético como allí. Lo que ya va abajo no se repite.
 *   · ARRIBA, como mucho dos pestañas (Inicio | Mis tareas, Plan | Reportes): nunca
 *     más de cuatro (memoria «menos barras») y dos niveles: Más › sección.
 * Lo que el rol no puede ver no sale nunca: todo se cruza con sus secciones del móvil
 * (shared/roles.js › seccionesMovil, que ya llegan en la sesión).
 */
(function barraRol(raiz) {
  /*
   * LAS PESTAÑAS QUE PUEDEN IR ABAJO. `secciones`: [id, nombre arriba, oculta]; una
   * oculta no sale arriba (Estanqueidad se abre desde Inicio y desde el «+», 22-oct).
   * El nombre de abajo es corto para que quepa en el iPhone; en «Más» y en el título,
   * el del ordenador.
   */
  const PESTANAS = {
    inicio: { nombre: 'Inicio', secciones: [['inicio', 'Inicio'], ['misTareas', 'Mis tareas']] },
    /* 9-nov (JC): «En lugar de Commissioning pon Cx». */
    commissioning: { nombre: 'Cx', secciones: [['commissioning', 'Equipos'], ['estanqueidad', 'Estanqueidad', true]] },
    /* Lo mismo que Commissioning, con el nombre que usa el técnico: lo que mide son equipos. */
    equipos: { nombre: 'Equipos', secciones: [['commissioning', 'Equipos'], ['estanqueidad', 'Estanqueidad', true]] },
    avance: { nombre: 'Avance', secciones: [['avance', 'Avance']] },
    partes: { nombre: 'Avisos', secciones: [['partes', 'Avisos']] },
    ncr: { nombre: 'NCR', secciones: [['ncr', 'NCR']] },
    qhse: { nombre: 'QHSE', secciones: [['qhse', 'Plan'], ['reportesQhse', 'Reportes']] },
    /* «Reclamaciones» en el ordenador; en el móvil, los avisos del tajo que se reclaman. */
    reclamables: { nombre: 'Reclamables', secciones: [['avisos', 'Reclamables']] },
    reparaciones: { nombre: 'Reparaciones', secciones: [['reparaciones', 'Reparaciones']] },
    albaranes: { nombre: 'Albaranes', secciones: [['albaranes', 'Albaranes']] },
    personal: { nombre: 'Personal', secciones: [['personal', 'Personal']] },
    jornada: { nombre: 'Jornada', secciones: [['jornada', 'Jornada']] },
    bloc: { nombre: 'Bloc', secciones: [['bloc', 'Bloc']] },
    plano: { nombre: 'Plano', secciones: [['plano', 'Plano de equipos']] },
    mas: { nombre: 'Más', secciones: [['mas', 'Más']] },
  };

  /*
   * X E Y DE CADA ROL, por orden de preferencia (los de JC, 8-nov, arriba; el resto con el
   * mismo criterio: lo que más hace cada uno en la obra). Un rol que no está aquí, RELLENO.
   */
  const BARRA_POR_ROL = {
    encargadoObra: ['avance', 'partes'],
    /* El técnico de commissioning aún no es un rol propio: queda preparado por id. */
    tecnicoCommissioning: ['equipos', 'ncr'],
    jefeCommissioning: ['equipos', 'ncr'],
    jefeObra: ['commissioning', 'qhse'],
    jefeProduccion: ['commissioning', 'qhse'],
    /* Rol de la rama jefe-departamento-f124093f. El móvil no tiene «Obras» ni «Reclamaciones»:
       la obra ya es su Inicio («Mi obra»), así que Commissioning; y Reclamables. */
    jefeDepartamento: ['commissioning', 'reclamables', 'ncr'],
    jefeProyectos: ['commissioning', 'reclamables', 'ncr'],
    jefeGrupo: ['commissioning', 'reclamables', 'ncr'],
    gerente: ['commissioning', 'ncr'],
    administrador: ['commissioning', 'qhse'],
    contractSupport: ['albaranes', 'ncr'],
    jefeMantenimiento: ['reparaciones', 'equipos'],
    encargadoMantenimiento: ['reparaciones', 'equipos'],
    operarioMantenimiento: ['reparaciones', 'equipos'],
    operario: ['partes', 'equipos'],
    subcontrata: ['personal', 'jornada'],
    jefeQhse: ['qhse', 'plano'],
    tecnicoQhse: ['qhse', 'plano'],
    jefeEstudios: ['jornada', 'bloc'],
    tecnicoEstudios: ['jornada', 'bloc'],
    jefeDelineacion: ['jornada', 'bloc'],
    delineante: ['jornada', 'bloc'],
    comercial: ['jornada', 'bloc'],
  };
  /* Si las preferidas no se pueden ver, las primeras de estas que sí. */
  const RELLENO = ['commissioning', 'partes', 'ncr', 'qhse', 'reparaciones', 'jornada', 'bloc'];

  /*
   * «MÁS»: cada sección del móvil con su grupo, su nombre y su icono del ordenador (la
   * barra lateral: SECCIONES_OBRA de shared/roles.js, ICONOS y HERRAMIENTAS de renderer/app.js).
   * Las de Inicio (Mis tareas) no van aquí: ya están arriba en Inicio.
   */
  const EN_MAS = {
    commissioning: { grupo: 'Calidad y commissioning', nombre: 'Commissioning', icono: '◈' },
    estanqueidad: { grupo: 'Calidad y commissioning', nombre: 'Pruebas de estanqueidad', icono: '◍' },
    ncr: { grupo: 'Calidad y commissioning', nombre: 'No conformidades', icono: '⚑' },
    reparaciones: { grupo: 'Calidad y commissioning', nombre: 'Reparaciones de equipos', icono: '⚒' },
    /* Quien no tiene Commissioning ve el plano en su grupo «Equipos», como en el ordenador. */
    plano: { grupo: 'Equipos', nombre: 'Plano de equipos', icono: '◈' },
    qhse: { grupo: 'Seguridad y QHSE', nombre: 'Plan QHSE', icono: '✚' },
    reportesQhse: { grupo: 'Seguridad y QHSE', nombre: 'Reportes QHSE', icono: '✚' },
    partes: { grupo: 'Seguridad y QHSE', nombre: 'Avisos de incidencia', icono: '⚠' },
    /* Lo reclamable va con los conflictos y el claim, en «Contrato y cliente». */
    avisos: { grupo: 'Contrato y cliente', nombre: 'Reclamables', icono: '⚖' },
    avance: { grupo: 'Producción', nombre: 'Avance de obra', icono: '◩' },
    albaranes: { grupo: 'Compras', nombre: 'Albaranes', icono: '▨' },
    inventario: { grupo: 'Compras', nombre: 'Inventario', icono: '▨' },
    personal: { grupo: 'Personal', nombre: 'Personal en obra', icono: '♙' },
    bloc: { grupo: 'Mi espacio', nombre: 'Bloc', icono: '✎' },
    jornada: { grupo: 'Personal', nombre: 'Mi jornada', icono: '◴' },
    cuenta: { grupo: 'Ajustes', nombre: 'Perfil', icono: '◉' },
  };
  /* Siempre se pueden abrir, tenga el rol las secciones que tenga. */
  const DE_TODOS = ['inicio', 'cuenta', 'mas'];

  /*
   * EL «+»: QUÉ ACCIONES LLEVA CADA ROL A LA VISTA (9-nov, JC: «hay demasiadas cosas»). Hasta
   * 6, por orden; las demás que el rol tenga permitidas, en «Todas las acciones», al pie de
   * la misma hoja. Esta tabla decide el orden, NUNCA los permisos: todo se cruza con lo que
   * el rol puede abrir. Las claves son las secciones de ACCIONES en carcasa.js.
   */
  const MAX_ACCIONES = 6;
  /* Las de ACCIONES en carcasa.js, en su mismo orden (una prueba lo vigila). */
  const SECCIONES_ACCION = ['jornada', 'commissioning', 'estanqueidad', 'ncr', 'reparaciones', 'avance', 'bloc', 'albaranes', 'partes', 'avisos', 'reportesQhse', 'qhse'];
  const JEFE_OBRA = ['commissioning', 'ncr', 'avisos', 'reportesQhse', 'bloc', 'jornada'];
  const CX = ['commissioning', 'estanqueidad', 'ncr', 'reparaciones', 'bloc', 'jornada'];
  const MANDO = ['avisos', 'ncr', 'reportesQhse', 'bloc'];
  const MANTENIMIENTO = ['reparaciones', 'commissioning', 'ncr', 'bloc', 'jornada'];
  const QHSE = ['qhse', 'reportesQhse', 'bloc', 'jornada'];
  const SOLO_LO_SUYO = ['jornada', 'bloc'];
  const ACCIONES_PLUS_POR_ROL = {
    jefeObra: JEFE_OBRA,
    jefeProduccion: JEFE_OBRA,
    encargadoObra: ['jornada', 'avance', 'partes', 'albaranes', 'avisos', 'bloc'],
    operario: ['jornada', 'partes', 'commissioning', 'bloc'],
    jefeCommissioning: CX,
    tecnicoCommissioning: CX,
    jefeGrupo: MANDO,
    jefeDepartamento: MANDO,
    jefeProyectos: MANDO,
    contractSupport: ['albaranes', 'ncr', 'avisos', 'bloc', 'jornada'],
    jefeMantenimiento: MANTENIMIENTO,
    encargadoMantenimiento: MANTENIMIENTO,
    operarioMantenimiento: MANTENIMIENTO,
    jefeQhse: QHSE,
    tecnicoQhse: QHSE,
    subcontrata: SOLO_LO_SUYO,
    operarioSubcontrata: SOLO_LO_SUYO,
    jefeEstudios: SOLO_LO_SUYO,
    tecnicoEstudios: SOLO_LO_SUYO,
    jefeDelineacion: SOLO_LO_SUYO,
    delineante: SOLO_LO_SUYO,
    comercial: SOLO_LO_SUYO,
  };

  /**
   * Reparte las acciones que el rol puede hacer: `principales` (hasta 6, a la vista) y `resto`
   * («Todas las acciones»). `disponibles`, las secciones permitidas en el orden de carcasa.js.
   * Un rol sin tabla, o sin ninguna de las suyas permitida, ve las primeras 6 de siempre.
   */
  function accionesDe(rol, disponibles = []) {
    const ok = new Set(disponibles);
    const suyas = (ACCIONES_PLUS_POR_ROL[rol] || []).filter((s) => ok.has(s));
    const principales = (suyas.length ? suyas : disponibles).slice(0, MAX_ACCIONES);
    const arriba = new Set(principales);
    return { principales, resto: disponibles.filter((s) => !arriba.has(s)) };
  }

  /* Jornada no va en «Más» si «Fichar» está a la vista en el «+»: abre esa misma pantalla. */
  const fichaEnElMas = (rol, secciones) => accionesDe(rol, SECCIONES_ACCION.filter((s) => secciones.includes(s))).principales.includes('jornada');

  const orden = (a, b) => a.localeCompare(b, 'es');

  /** Las pestañas de abajo del rol: [Inicio, X, Y, Más], cada una con solo las secciones que ve. */
  function pestanasDe(rol, secciones = []) {
    const ve = new Set([...DE_TODOS, ...secciones]);
    const visibles = (id) => PESTANAS[id].secciones.filter(([s]) => ve.has(s));
    const elegidas = [];
    const usadas = new Set();
    for (const id of [...(BARRA_POR_ROL[rol] || []), ...RELLENO]) {
      if (elegidas.length === 2) break;
      if (!PESTANAS[id] || elegidas.includes(id)) continue;
      const v = visibles(id).filter(([, , oculta]) => !oculta);
      /* Dos pestañas no comparten sección (Commissioning y Equipos son la misma). */
      if (!v.length || v.some(([s]) => usadas.has(s))) continue;
      elegidas.push(id);
      for (const [s] of visibles(id)) usadas.add(s);
    }
    return ['inicio', ...elegidas, 'mas'].map((id) => ({ id, nombre: PESTANAS[id].nombre, secciones: visibles(id) }));
  }

  /** «Más» del rol: [{ nombre, icono, items: [{ id, nombre, icono }] }], sin lo que ya va abajo. */
  function masDe(rol, secciones = []) {
    const abajo = new Set(pestanasDe(rol, secciones).flatMap((p) => p.secciones.map(([s]) => s)));
    const ve = new Set([...secciones, 'cuenta']);
    const grupos = new Map();
    const sinJornada = fichaEnElMas(rol, secciones);
    for (const [id, m] of Object.entries(EN_MAS)) {
      if (!ve.has(id) || abajo.has(id) || (id === 'jornada' && sinJornada)) continue;
      if (!grupos.has(m.grupo)) grupos.set(m.grupo, []);
      grupos.get(m.grupo).push({ id, nombre: m.nombre, icono: m.icono });
    }
    return [...grupos.entries()].sort(([a], [b]) => orden(a, b)).map(([nombre, items]) => {
      items.sort((a, b) => orden(a.nombre, b.nombre));
      /* El icono del grupo, el de su primera pantalla (como iconoDe en renderer/barraLateral.js). */
      return { nombre, icono: items[0].icono, items };
    });
  }

  /** Qué pestaña de abajo se enciende en una sección: la que la lleva o, si va en «Más», «Más». */
  function pestanaDeSeccion(rol, secciones, s) {
    const lista = pestanasDe(rol, secciones);
    return lista.find((p) => p.secciones.some(([id]) => id === s))
      || (EN_MAS[s] && (s === 'cuenta' || secciones.includes(s)) ? lista.find((p) => p.id === 'mas') : null);
  }

  /** El nombre del ordenador de cada sección, para el título de arriba. */
  const nombreDe = (s) => (EN_MAS[s] ? EN_MAS[s].nombre : null);

  const api = { PESTANAS, BARRA_POR_ROL, RELLENO, EN_MAS, ACCIONES_PLUS_POR_ROL, MAX_ACCIONES, SECCIONES_ACCION, accionesDe, pestanasDe, masDe, pestanaDeSeccion, nombreDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.CXBarraRol = api;
})(typeof window !== 'undefined' ? window : null);
