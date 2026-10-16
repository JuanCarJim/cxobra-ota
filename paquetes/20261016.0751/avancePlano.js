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
const DISCIPLINAS = {
  clima: { nombre: 'Climatización', capas: [
    ['tuberia', 'Tubería de agua', 'trazo', '#1f6fd1'],
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

const capasDe = (disciplina) => (DISCIPLINAS[disciplina] || DISCIPLINAS.otra).capas
  .map(([id, nombre, tipo, color]) => ({ id, nombre, tipo, color, lineaIds: [] }));

const COLOR = /^#[0-9a-f]{6}$/i;

/** Capas limpias: id único, tipo válido, color, partidas como texto. */
function normalizarCapas(capas) {
  let c = capas;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = []; } }
  const vistos = new Set();
  return (Array.isArray(c) ? c : []).map((x, i) => {
    let id = String((x && x.id) || `capa${i + 1}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || `capa${i + 1}`;
    while (vistos.has(id)) id += '_';
    vistos.add(id);
    return {
      id,
      nombre: String((x && x.nombre) || `Capa ${i + 1}`).trim().slice(0, 60),
      tipo: TIPOS_CAPA[x && x.tipo] ? x.tipo : 'trazo',
      color: COLOR.test((x && x.color) || '') ? x.color : '#1f6fd1',
      lineaIds: [...new Set((Array.isArray(x && x.lineaIds) ? x.lineaIds : []).map(String).filter(Boolean))],
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

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.AVANCE_PLANO = API;
})({ TIPOS_CAPA, DISCIPLINAS, capasDe, normalizarCapas, coloresPorDia, COLORES_DIA, ESTADOS_MARCA });
