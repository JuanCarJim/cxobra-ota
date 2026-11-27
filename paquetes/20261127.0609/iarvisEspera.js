'use strict';
/*
 * LO QUE DICE IARVIS MIENTRAS PIENSA (9-nov-2026, JC: fuera el «••• Mirándolo en la app…»;
 * la brújula de Iarvis latiendo y, al lado, un verbo que va cambiando cada 1,5–2 s, al estilo
 * «Thinking… / Computing… / Considering…»).
 *
 * En los seis idiomas de la interfaz (shared/idioma.js › IDIOMAS: es, en, ca, pt, de, fr).
 * Si Iarvis está haciendo algo concreto, el verbo dice eso («Leyendo la placa…», «Buscando
 * la UTA-01…») en vez de rotar.
 *
 *   verbos(idioma) → ['Pensando…', …]
 *   haciendo(idioma, { que, ref }) → 'Leyendo la placa…' | 'Buscando la UTA-01…' | null
 *   adivinar(pregunta, { fotos }) → { que, ref } | null    (lo que va a hacer, por cómo se pidió)
 *
 * Lo usa renderer/iarvis.js (escritorio, web y móvil Cx). Sin DOM: se prueba bajo node.
 */
(function (raiz, fabrica) {
  const x = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = x;
  else raiz.IARVIS_ESPERA = x;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ORDEN = ['es', 'en', 'ca', 'pt', 'de', 'fr'];
  const VERBOS = {
    es: ['Pensando…', 'Calculando…', 'Considerando…', 'Consultando la obra…', 'Repasando los datos…', 'Atando cabos…'],
    en: ['Thinking…', 'Computing…', 'Considering…', 'Checking the site…', 'Going over the data…', 'Connecting the dots…'],
    ca: ['Pensant…', 'Calculant…', 'Considerant…', 'Consultant l’obra…', 'Repassant les dades…', 'Lligant caps…'],
    pt: ['A pensar…', 'A calcular…', 'A considerar…', 'A consultar a obra…', 'A rever os dados…', 'A juntar as peças…'],
    de: ['Denke nach…', 'Rechne…', 'Wäge ab…', 'Prüfe die Baustelle…', 'Gehe die Daten durch…', 'Füge alles zusammen…'],
    fr: ['Réflexion…', 'Calcul…', 'Examen…', 'Consultation du chantier…', 'Revue des données…', 'Je recoupe…'],
  };
  /* Lo que hace una herramienta concreta. {ref}: el TAG o el código que se busca. */
  const HACIENDO = {
    leerPlaca: { es: 'Leyendo la placa…', en: 'Reading the nameplate…', ca: 'Llegint la placa…', pt: 'A ler a chapa…', de: 'Lese das Typenschild…', fr: 'Lecture de la plaque…' },
    buscar: { es: 'Buscando {ref}…', en: 'Looking for {ref}…', ca: 'Buscant {ref}…', pt: 'A procurar {ref}…', de: 'Suche {ref}…', fr: 'Recherche de {ref}…' },
    preparar: { es: 'Preparando la acción…', en: 'Preparing the action…', ca: 'Preparant l’acció…', pt: 'A preparar a ação…', de: 'Bereite die Aktion vor…', fr: 'Préparation de l’action…' },
    guardar: { es: 'Guardando…', en: 'Saving…', ca: 'Desant…', pt: 'A guardar…', de: 'Speichere…', fr: 'Enregistrement…' },
  };
  const id = (idioma) => { const c = String(idioma || 'es').slice(0, 2).toLowerCase(); return ORDEN.includes(c) ? c : 'es'; };
  const verbos = (idioma) => VERBOS[id(idioma)].slice();
  function haciendo(idioma, h) {
    if (!h || !HACIENDO[h.que]) return null;
    const t = HACIENDO[h.que][id(idioma)];
    if (t.includes('{ref}') && !h.ref) return null;
    return t.replace('{ref}', String(h.ref || '').slice(0, 40));
  }
  /* «UTA-01», «UTA 2», «CLM-01», «NCR-0042», «split 2.14»… */
  const REF = /\b((?:UTA|UE|UI|FC|FCU|CLI|ENF|BC|VE|VI|VEX|CRAC|RCT|CLM|NCR|INC|OC)[\s-]?\d+(?:[.-]\d+)*[A-Z]?)\b/i;
  function adivinar(pregunta, { fotos = 0 } = {}) {
    const t = String(pregunta || '');
    const m = REF.exec(t);
    const ref = m ? m[1].toUpperCase().replace(/\s+/, '-') : null;
    if (fotos && (/\bplaca\b/i.test(t) || ref) && !/^(CLM|NCR|INC|OC)/.test(ref || '')) return { que: 'leerPlaca', ref };
    if (ref) return { que: 'buscar', ref };
    if (/\b(crea|crear|añade|añadir|anade|mete|cambia|cambiar|apunta|guarda|pon|borra)\b/i.test(t)) return { que: 'preparar' };
    return null;
  }
  return { ORDEN, VERBOS, HACIENDO, verbos, haciendo, adivinar, CADA: 1700 };
});
