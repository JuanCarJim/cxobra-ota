'use strict';
/*
 * LOS PLANOS DEL AVANCE DE OBRA: sus capas y los colores (16-oct-2026).
 *
 * JC: «de un plano en pdf con tubería y conductos y equipos, en ese plano una
 * capa que sea de la tubería para marcar solo la tubería, otra capa para
 * equipos, otra para conductos… Para electricidad, una capa para las
 * bandejas y otra para el cable, otra para el punto de luz o de corriente».
 *
 * Una capa: { id, nombre, tipo, color, lineaIds }. El TIPO dice cómo se
 * marca en ella: trazo (lo lineal: tubería, conducto, bandeja, cable), zona
 * (lo de superficie: falso techo, aislamiento de un local) o punto (lo que
 * se cuenta: equipos, puntos de luz, tomas). `lineaIds`: las partidas del
 * Costs Plan que se miden con esa capa (para certificar al final).
 *
 * Lo usan el ordenador, el móvil y la capa de datos.
 */

const TIPOS_CAPA = { trazo: 'Trazo (metros)', zona: 'Zona (m²)', punto: 'Punto (unidades)' };

/* Las capas de partida de cada disciplina. */
/* DISCIPLINAS_PLANO (se exporta como DISCIPLINAS): en el escritorio comparte
   ámbito con shared/presupuesto/modelo.js, que ya declara DISCIPLINAS. */
const DISCIPLINAS_PLANO = {
  clima: { nombre: 'Climatización', capas: [
    ['tuberia', 'Tubería de agua', 'trazo', '#1f6fd1', 2], // ida y retorno: 2 tubos
    ['conductos', 'Conductos', 'trazo', '#0a8f6b'],
    ['equipos', 'Equipos', 'punto', '#c2410c'],
    ['difusion', 'Rejillas y difusores', 'punto', '#7c3aed'],
  ] },
  electricidad: { nombre: 'Electricidad', capas: [
    ['bandejas', 'Bandejas', 'trazo', '#b45309'],
    ['cable', 'Cable', 'trazo', '#be123c'],
    ['luz', 'Puntos de luz', 'punto', '#ca8a04'],
    ['tomas', 'Tomas de corriente', 'punto', '#2563eb'],
    ['cuadros', 'Cuadros', 'punto', '#475569'],
  ] },
  fontaneria: { nombre: 'Fontanería y saneamiento', capas: [
    ['agua', 'Tubería de agua', 'trazo', '#1f6fd1'],
    ['saneamiento', 'Saneamiento', 'trazo', '#78350f'],
    ['aparatos', 'Aparatos sanitarios', 'punto', '#0f766e'],
  ] },
  pci: { nombre: 'Protección contra incendios', capas: [
    ['tuberiaPci', 'Tubería PCI', 'trazo', '#dc2626'],
    ['rociadores', 'Rociadores', 'punto', '#ea580c'],
    ['detectores', 'Detectores', 'punto', '#9333ea'],
  ] },
  otra: { nombre: 'Otra', capas: [
    ['lineal', 'Lineal', 'trazo', '#1f6fd1'],
    ['superficie', 'Superficie', 'zona', '#0a8f6b'],
    ['unidades', 'Unidades', 'punto', '#c2410c'],
  ] },
};

/*
 * `paralelos` (16-oct-2026, JC: «el número» de tubos): cuántos tubos o
 * circuitos van por el mismo recorrido. Ida y retorno de agua son 2; a cuatro
 * tubos, 4; varios cables por la misma bandeja, los que sean. Es lo que sale
 * por defecto al marcar en esa capa; el encargado lo cambia en cada marca.
 */
const capasDe = (disciplina) => (DISCIPLINAS_PLANO[disciplina] || DISCIPLINAS_PLANO.otra).capas
  .map(([id, nombre, tipo, color, paralelos]) => ({ id, nombre, tipo, color, lineaIds: [], paralelos: paralelos || 1 }));

/* El nº por defecto de una capa de partida que se guardó antes de existir el campo. */
const PARALELOS_DE_PARTIDA = Object.fromEntries(Object.values(DISCIPLINAS_PLANO)
  .flatMap((d) => d.capas).filter((c) => c[4]).map((c) => [c[0], c[4]]));

const COLOR = /^#[0-9a-f]{6}$/i;

function paralelosCapa(v, id) {
  if (v === undefined || v === null || v === '') return PARALELOS_DE_PARTIDA[id] || 1;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 1;
}

/** Capas limpias: id único, tipo válido, color, partidas como texto. */
function normalizarCapas(capas) {
  let c = capas;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = []; } }
  const vistos = new Set();
  return (Array.isArray(c) ? c : []).map((x, i) => {
    let id = String((x && x.id) || `capa${i + 1}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || `capa${i + 1}`;
    while (vistos.has(id)) id += '_';
    vistos.add(id);
    const tipo = TIPOS_CAPA[x && x.tipo] ? x.tipo : 'trazo';
    return {
      id,
      nombre: String((x && x.nombre) || `Capa ${i + 1}`).trim().slice(0, 60),
      tipo,
      color: COLOR.test((x && x.color) || '') ? x.color : '#1f6fd1',
      lineaIds: [...new Set((Array.isArray(x && x.lineaIds) ? x.lineaIds : []).map(String).filter(Boolean))],
      paralelos: tipo === 'trazo' ? paralelosCapa(x && x.paralelos, id) : 1,
    };
  });
}

/* Los colores de los días: del más reciente (fuerte) a los de antes. */
const COLORES_DIA = ['#d93025', '#1a73e8', '#188038', '#e37400', '#9334e6', '#00838f', '#c2185b', '#5f6368'];

/** { 'AAAA-MM-DD': color } para los días que hay, el más reciente primero. */
function coloresPorDia(fechas) {
  const dias = [...new Set((fechas || []).map((f) => String(f || '').slice(0, 10)).filter(Boolean))].sort().reverse();
  return Object.fromEntries(dias.map((d, i) => [d, COLORES_DIA[Math.min(i, COLORES_DIA.length - 1)]]));
}

const ESTADOS_MARCA = {
  pendiente: { nombre: 'Pendiente de revisar', tono: 'aviso' },
  vista: { nombre: 'Vista', tono: 'bien' },
  certificada: { nombre: 'Certificada', tono: 'neutra' },
  descartada: { nombre: 'Descartada', tono: 'mal' },
};

/* La disciplina del plano y las del presupuesto (shared/presupuesto/modelo.js). */
const DISCIPLINAS_PRESUPUESTO = {
  clima: ['climatizacion', 'ventilacion'],
  electricidad: ['electricidad', 'control'],
  fontaneria: ['fontaneria'],
  pci: ['pci'],
};

/* Cómo se reconoce por su texto una partida de cada capa de partida. */
const TUBO = { si: /tuber|tubo|\bDN\s?\d|cobre|acero|multicapa|polipropileno|\bPPR?\b|\bPEX?\b|\bPVC\b|\d\s*(\/\d)?\s*"/i, no: /conduct|chapa|helicoidal|climaver|bandeja/i };
const PALABRAS_CAPA = {
  tuberia: TUBO, agua: TUBO, tuberiaPci: TUBO,
  conductos: { si: /conduct|chapa|helicoidal|climaver|lana mineral|fibra|Ø\s?\d/i, no: /tuber|tubo|\bDN\s?\d|cobre|cable/i },
  saneamiento: { si: /saneam|bajante|colector|desag|\bPVC\b|tuber|tubo/i },
  bandejas: { si: /bandeja|canal|tubo corrugado|rejiban/i },
  cable: { si: /cable|conductor|\d+\s?G\s?\d|mm²|mm2|RZ1|H07/i, no: /bandeja/i },
};

const medir = () => (typeof window !== 'undefined' && window.AVANCE_MEDIR) || require('./avanceMedir');

/**
 * LAS PARTIDAS ENTRE LAS QUE ELIGE EL ENCARGADO al marcar en una capa: las
 * de la capa (lineaIds) si las tiene; si no, las de la disciplina del plano
 * cuya unidad se puede medir con lo que se marca (metros, m² o kg en un
 * trazo; m² en una zona; unidades en un punto). Las partidas sin disciplina
 * entran; si con la disciplina no queda ninguna, todas las de unidad que casa.
 */
function partidasDeCapa(capa, partidas, disciplinaPlano) {
  const todas = (partidas || []).filter((p) => p && p.lineaId && p.activa !== 0);
  if (!capa) return [];
  if (capa.lineaIds && capa.lineaIds.length) {
    const orden = new Map(capa.lineaIds.map((id, i) => [id, i]));
    return todas.filter((p) => orden.has(p.lineaId)).sort((a, b) => orden.get(a.lineaId) - orden.get(b.lineaId));
  }
  let casan = todas.filter((p) => medir().unidadCasa(capa.tipo, p.unidad));
  const de = DISCIPLINAS_PRESUPUESTO[disciplinaPlano];
  if (de) {
    const suyas = casan.filter((p) => !p.disciplina || de.includes(p.disciplina));
    if (suyas.length) casan = suyas;
  }
  /* Dentro de la disciplina, lo que es de esta capa por su texto: en la de
     tubería no salen los conductos, ni al revés. Si no casa nada, todas. */
  const de_capa = PALABRAS_CAPA[capa.id];
  if (!de_capa) return casan;
  const deCapa = casan.filter((p) => de_capa.si.test(p.resumen || '') && !(de_capa.no && de_capa.no.test(p.resumen || '')));
  return deCapa.length ? deCapa : casan;
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.AVANCE_PLANO = API;
})({ TIPOS_CAPA, DISCIPLINAS: DISCIPLINAS_PLANO, capasDe, normalizarCapas, coloresPorDia, COLORES_DIA, ESTADOS_MARCA, DISCIPLINAS_PRESUPUESTO, partidasDeCapa });
