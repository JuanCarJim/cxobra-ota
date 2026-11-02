'use strict';
/*
 * LAS DOS FIRMAS DE UN PAPEL, PIEZA COMÚN DEL MÓVIL (JC, 29-oct-2026):
 * «en las puestas en marcha, checklists… poner en el campo del técnico
 * responsable el que ha rellenado los datos por haber loggeado con su cuenta,
 * pero el otro campo, poner para recoger nombre y apellidos y firma y si es
 * cliente, DF, DEO…».
 *
 *   · jefeObra = TÉCNICO RESPONSABLE: el nombre sale solo, el de quien ha
 *     entrado en Cx (se puede corregir), más su firma.
 *   · cliente  = LA OTRA FIRMA: nombre y apellidos a mano, la firma y el
 *     cargo: Cliente, Dirección Facultativa (DF), DEO u Otro (texto libre).
 *
 * Solo pinta y lee los campos; el lienzo, el guardado y la ruta los pone
 * quien la usa (commissioning.js con api/equipo/firma; reparaciones igual).
 *
 *   const FD = window.CX_FIRMA;
 *   FD.htmlCampos(rol, { previa, medias })  → nombre (+ cargo si es la otra)
 *   FD.enlazar(raiz)                        → «Otro» abre el texto libre
 *   FD.leer(raiz)                           → { nombre, cargo }
 *   FD.rotulo(rol)                          → «Técnico responsable» / «Firma de conformidad»
 *   FD.textoHecha(firma)                    → «Nombre · DF · 29/10/2026»
 *   FD.CARGOS                               → [['Cliente','Cliente'], ['DF', …], ['DEO', …]]
 *
 * Lo que se manda a la ruta: { rol, nombre, cargo, imagen }. Las firmas
 * viejas sin cargo se leen como Cliente.
 */
(function firmaDoble() {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CARGOS = [['Cliente', 'Cliente'], ['DF', 'Dirección Facultativa (DF)'], ['DEO', 'Dirección de Ejecución (DEO)']];
  /* firmaCliente y mantenimiento (30-oct): las dos casillas de después, solo nombre, fecha y trazo. */
  const ROTULOS = { jefeObra: 'Técnico responsable', cliente: 'Firma de conformidad', firmaCliente: 'Cliente', mantenimiento: 'Mantenimiento' };
  const conocido = (c) => CARGOS.some(([v]) => v === c);

  function nombreSesion() {
    try { const s = window.ACCESO_MOVIL && window.ACCESO_MOVIL.sesion(); return (s && s.nombre) || ''; } catch { return ''; }
  }
  const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

  /** Los campos de texto de una firma: el nombre y, en la otra firma, el cargo. */
  function htmlCampos(rol, { previa = null, medias = null } = {}) {
    const tecnico = rol === 'jefeObra';
    const nombre = (medias && medias.nombre) || (previa && previa.nombre) || (tecnico ? nombreSesion() : '');
    const nom = `<label class="campo"><span>${tecnico ? 'Técnico responsable (quien ha tomado los datos)' : 'Nombre y apellidos de quien firma'}</span>
        <input type="text" maxlength="80" data-firma-nombre value="${esc(nombre)}" placeholder="${tecnico ? 'Tu nombre' : 'Nombre y apellidos'}" autocomplete="name"></label>`;
    if (tecnico || rol === 'firmaCliente' || rol === 'mantenimiento') return nom;
    const cargo = (medias && medias.cargo) || (previa && previa.cargo) || '';
    const sel = cargo ? (conocido(cargo) ? cargo : 'otro') : '';
    const opciones = ['<option value="">Elegir…</option>', ...CARGOS.map(([v, t]) => `<option value="${v}"${sel === v ? ' selected' : ''}>${esc(t)}</option>`),
      `<option value="otro"${sel === 'otro' ? ' selected' : ''}>Otro</option>`].join('');
    return `${nom}
      <label class="campo"><span>Firma como</span>
        <select data-firma-cargo>${opciones}</select></label>
      <label class="campo" data-firma-otro-campo${sel === 'otro' ? '' : ' hidden'}><span>¿Quién es? (empresa o cargo)</span>
        <input type="text" maxlength="60" data-firma-otro value="${esc(sel === 'otro' ? cargo : '')}" placeholder="Por ejemplo: Propiedad, Mantenedor, Coordinador SyS"></label>`;
  }

  /** «Otro» enseña el texto libre. */
  function enlazar(raiz) {
    const s = raiz && raiz.querySelector('[data-firma-cargo]');
    if (!s || s.dataset.enlazado) return;
    s.dataset.enlazado = '1';
    s.addEventListener('change', () => {
      const c = raiz.querySelector('[data-firma-otro-campo]');
      if (c) c.hidden = s.value !== 'otro';
      if (s.value === 'otro') { const i = raiz.querySelector('[data-firma-otro]'); if (i) i.focus(); }
    });
  }

  /** { nombre, cargo } tal como están en pantalla (cargo null si no hay desplegable). */
  function leer(raiz) {
    const q = (sel) => (raiz && raiz.querySelector(sel)) || null;
    const nombre = ((q('[data-firma-nombre]') || {}).value || '').trim();
    const s = q('[data-firma-cargo]');
    if (!s) return { nombre, cargo: null };
    const cargo = s.value === 'otro' ? ((q('[data-firma-otro]') || {}).value || '').trim() : s.value;
    return { nombre, cargo };
  }

  /** Qué falta antes de guardar (null si nada). */
  function falta(rol, { nombre, cargo }) {
    if (!nombre) return rol === 'jefeObra' ? 'Falta el nombre del técnico responsable.' : 'Falta el nombre y apellidos de quien firma.';
    if (rol === 'cliente' && !cargo) return 'Elige si firma como Cliente, DF, DEO u Otro.';
    return null;
  }

  /*
   * MI FIRMA YA HECHA (JC, 29-oct): «mi firma, que ya la he hecho hoy, es la
   * que tiene que figurar en todos los documentos que yo tenga que firmar».
   * El servidor devuelve la firma guardada de quien tiene la sesión (su último
   * trazo de técnico responsable; api/firma/guardada). Si hay, el lienzo del
   * TÉCNICO RESPONSABLE sale con ella puesta y «Firmar» la acepta sin trazar.
   * «Borrar trazo» la quita y deja firmar a mano. Nunca en la casilla de otra
   * persona (la otra firma, el cliente, DF…): ahí el lienzo sale vacío.
   *
   *   FD.aplicar(cv, rol, { pintado })  → Promise<boolean>: ¿la puso?
   *   FD.soltar(cv)                     → «Borrar trazo»: ya no es la guardada
   *   FD.alFirmar(cv, nombre)           → { usarGuardada: true } | { error } | {}
   */
  let guardadaCache = null;
  async function guardada() {
    try {
      const C = window.CX;
      const r = C && C.pedir ? await C.pedir('api/firma/guardada') : null;
      guardadaCache = r && r.ok && r.firma ? r.firma : null;
    } catch { /* sin red: la última que se vio */ }
    return guardadaCache;
  }
  const sinAcentos = (v) => String(v ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function cargarImagen(src) {
    return new Promise((ok) => {
      if (typeof Image === 'undefined') { ok(null); return; }
      const img = new Image();
      img.onload = () => ok(img); img.onerror = () => ok(null);
      img.src = src;
    });
  }
  async function aplicar(cv, rol, { pintado = () => false } = {}) {
    if (!cv || rol !== 'jefeObra') return false;
    const g = await guardada();
    if (!g || !cv.isConnected || pintado()) return false;
    const img = await cargarImagen(g.imagen);
    if (!img || !cv.isConnected || pintado()) return false;
    try { cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); } catch { return false; }
    cv.dataset.guardada = sinAcentos(g.nombre);
    const nota = cv.closest('.firma-lienzo') && cv.closest('.firma-lienzo').querySelector('.nota');
    if (nota && !nota.querySelector('[data-firma-guardada]')) {
      nota.insertAdjacentHTML('afterbegin', `<strong data-firma-guardada>Tu firma ya está puesta: pulsa «Firmar». Para firmar a mano, «Borrar trazo». </strong>`);
    }
    return true;
  }
  function soltar(cv) {
    if (!cv) return;
    delete cv.dataset.guardada;
    const a = cv.closest('.firma-lienzo') && cv.closest('.firma-lienzo').querySelector('[data-firma-guardada]');
    if (a) a.remove();
  }
  function alFirmar(cv, nombre) {
    const g = cv && cv.dataset.guardada;
    if (!g) return {};
    if (g !== sinAcentos(nombre)) return { error: 'Esa firma guardada es de otra persona: pulsa «Borrar trazo» y firma a mano.' };
    return { usarGuardada: true };
  }

  const rotulo = (rol) => ROTULOS[rol] || rol;
  const textoHecha = (f) => (f ? [f.nombre, f.rol === 'cliente' ? (f.cargo || 'Cliente') : null, fechaCorta(f.fecha)].filter(Boolean).join(' · ') : '');

  window.CX_FIRMA = { CARGOS, htmlCampos, enlazar, leer, falta, rotulo, textoHecha, nombreSesion, aplicar, soltar, alFirmar };
})();
