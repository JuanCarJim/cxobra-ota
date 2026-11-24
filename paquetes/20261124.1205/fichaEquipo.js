'use strict';
/*
 * LA FICHA DEL EQUIPO CON PESTAÑAS (revisión de la navegación del 2-nov, D9
 * opción A de JC; docs/revision-navegacion-2nov.md § 2.1).
 *
 * El equipo es la unidad: lo que se hace en la visita va en una sola ficha,
 * con pestañas cortas arriba:
 *
 *   Datos y placa · Puesta en marcha · Balanceo · Estanqueidad · Documentos · Incidencias
 *
 * Las que no tocan no salen (un split no tiene Balanceo, un ventilador no
 * tiene Estanqueidad: lo decide `ensayoRequerido`). Encima, una sola línea de
 * estado: «PM ✓ · Balanceo pendiente · Estanqueidad ✓ · Listo para la DF».
 *
 * Es la misma ficha en el escritorio y en la web (renderer/commissioningPantalla.js,
 * abrirFichaEquipoCx) y la definición que tiene que seguir la app móvil Cx
 * (renderer/movil/commissioning.js): aquí solo se decide QUÉ pestañas lleva un
 * equipo y en qué orden, y adónde van las rutas viejas.
 */
(function () {
  const PESTANAS = [
    { id: 'datos', texto: 'Datos y placa', pista: 'TAG, ubicación, marca, modelo, nº de serie, fotos de la placa y su pareja' },
    { id: 'puesta', texto: 'Puesta en marcha', pista: 'El estado de la puesta en marcha, el checklist y la ficha PM' },
    { id: 'balanceo', texto: 'Balanceo', pista: 'La hoja de balanceo de caudales y sus bocas' },
    { id: 'estanqueidad', texto: 'Estanqueidad', pista: 'La prueba de estanqueidad de su circuito' },
    { id: 'documentos', texto: 'Documentos', pista: 'Ficha técnica, CE, manual, ficha PM y los informes de las pruebas' },
    { id: 'incidencias', texto: 'Incidencias', pista: 'Las reparaciones de este equipo' },
  ];

  const pideBalanceo = (f) => Boolean(f) && (f.ensayoRequerido === 'balanceo' || f.ensayoRequerido === 'ambos');
  const pideEstanqueidad = (f) => Boolean(f) && (f.ensayoRequerido === 'estanqueidad' || f.ensayoRequerido === 'ambos');

  /** Las pestañas que lleva este equipo, en su orden. */
  function pestanasDe(f) {
    return PESTANAS.filter((p) => (p.id !== 'balanceo' || pideBalanceo(f)) && (p.id !== 'estanqueidad' || pideEstanqueidad(f)));
  }

  /** La pestaña que se abre: la pedida si el equipo la lleva; si no, «Datos y placa». */
  function pestanaValida(f, pedida) {
    return pestanasDe(f).some((p) => p.id === pedida) ? pedida : 'datos';
  }

  /*
   * LAS RUTAS VIEJAS: Balanceo y Pruebas de estanqueidad eran pantallas sueltas
   * de la barra. Con Commissioning a la vista viven dentro (shared/barraLateral.js,
   * DENTRO_DE_OTRA) y su ruta abre la ficha del equipo en su pestaña.
   */
  const PESTANA_DE_RUTA = { balanceo: 'balanceo', pruebasEstanqueidad: 'estanqueidad' };

  /** «balanceo», «balanceo:<id del equipo>», «pruebasEstanqueidad:<id>» → { pestana, equipoId } o null. */
  function rutaAFicha(destino) {
    const [ruta, ...resto] = String(destino || '').split(':');
    if (!PESTANA_DE_RUTA[ruta]) return null;
    return { pestana: PESTANA_DE_RUTA[ruta], equipoId: resto.join(':') || null };
  }

  /* control.js, ESTADOS_PM: «en marcha» y «hecha» son la PM terminada. */
  const OK_PM = new Set(['hecha', 'enMarcha']);
  const NOMBRE_BAL = { apto: 'Balanceo ✓', aptoSinBocas: 'Balanceo sin bocas', noApto: 'Balanceo no apto', pendiente: 'Balanceo pendiente' };
  const NOMBRE_EST = { apta: 'Estanqueidad ✓', noApta: 'Estanqueidad no apta', pendiente: 'Estanqueidad pendiente' };
  const NOMBRE_ENVIO = { lista: 'Listo para la DF', enviada: 'Enviado a la DF' };

  /**
   * La línea de estado de arriba: [{ texto, tono }] con tono bien | aviso | mal | neutra.
   * `nombrePM` es el nombre del estado de PM tal y como lo enseña la pantalla.
   */
  function lineaEstado(f, { nombrePM } = {}) {
    if (!f) return [];
    const trozos = [];
    const pm = f.estadoPM || 'pendiente';
    trozos.push(OK_PM.has(pm) ? { texto: 'PM ✓', tono: 'bien' } : { texto: `PM: ${(nombrePM && nombrePM(pm)) || pm}`, tono: pm === 'conReservas' ? 'aviso' : 'neutra' });
    if (pideBalanceo(f)) {
      const e = f.balanceoEstado && NOMBRE_BAL[f.balanceoEstado] ? f.balanceoEstado : 'pendiente';
      trozos.push({ texto: NOMBRE_BAL[e], tono: e === 'apto' ? 'bien' : e === 'noApto' ? 'mal' : e === 'aptoSinBocas' ? 'aviso' : 'neutra' });
    }
    if (pideEstanqueidad(f)) {
      const e = f.estanqueidadEstado && NOMBRE_EST[f.estanqueidadEstado] ? f.estanqueidadEstado : 'pendiente';
      trozos.push({ texto: NOMBRE_EST[e], tono: e === 'apta' ? 'bien' : e === 'noApta' ? 'mal' : 'neutra' });
    }
    /* 19-nov (bloc 06b70f2c): lo instalado manda; si la placa no es lo de proyecto, se dice aquí. */
    const cp = cambioProyecto(f);
    if (cp) trozos.push({ texto: 'Cambiado respecto a proyecto', tono: 'aviso', titulo: `Proyecto: ${cp.proyecto} → instalado: ${cp.instalado}` });
    if (NOMBRE_ENVIO[f.envio]) trozos.push({ texto: NOMBRE_ENVIO[f.envio], tono: 'bien' });
    else {
      /* «Bloqueado por INC-…» ya lo dice su aviso, encima: aquí solo lo que falta (5-nov, la app móvil). */
      const falta = (Array.isArray(f.falta) ? f.falta : []).filter((x) => !/^Bloqueado por/i.test(String(x)));
      if (falta.length) trozos.push({ texto: `Falta ${falta.join(', ')}`, tono: 'aviso' });
    }
    return trozos;
  }

  /**
   * ¿Lo instalado no es lo de proyecto? (shared/obra/proyectoInstalado.js guarda lo de proyecto una vez
   * en `modeloProyecto` al poner la placa.) → null | { proyecto, instalado }
   */
  function cambioProyecto(f) {
    const pr = String((f && f.modeloProyecto) || '').trim();
    if (!pr) return null;
    const PI = (typeof window !== 'undefined' && window.PROYECTO_INSTALADO) || (typeof require === 'function' ? (() => { try { return require('../obra/proyectoInstalado'); } catch { return null; } })() : null);
    const igual = PI ? PI.mismoModelo(pr, f.modelo) : pr.toUpperCase().replace(/[^A-Z0-9]/g, '') === String(f.modelo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (igual) return null;
    const mod = (m, mo) => [m, mo].filter(Boolean).join(' ');
    return { proyecto: mod(f.marcaProyecto || f.marca, pr), instalado: mod(f.marca, f.modelo) || '—' };
  }

  /**
   * Las incidencias (reparaciones) de un equipo, de la lista de la obra: las
   * suyas y, si es de un conjunto (split, VRF), las de sus unidades. Primero
   * las que siguen abiertas, después por fecha, de la más nueva a la más vieja.
   */
  function incidenciasDe(filas, ids, { activa } = {}) {
    const de = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    const abierta = activa || ((i) => !['cerrada', 'anulada'].includes(i.estado));
    return (filas || [])
      .filter((i) => de.has(i.equipoId) || (i.equipo && de.has(i.equipo.id)))
      .sort((a, b) => (Number(abierta(b)) - Number(abierta(a)))
        || String(b.creadoEn || b.fechaApertura || b.fecha || '').localeCompare(String(a.creadoEn || a.fechaApertura || a.fecha || '')));
  }

  const API = { PESTANAS, PESTANA_DE_RUTA, pestanasDe, pestanaValida, rutaAFicha, lineaEstado, cambioProyecto, incidenciasDe, pideBalanceo, pideEstanqueidad };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.FICHA_EQUIPO_CX = API;
}());
