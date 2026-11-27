'use strict';
/*
 * EL SELLO DE FIRMA, ESTILO ACROBAT (JC, 26-nov-2026): «una firma digital del
 * estilo a la que hay en Adobe Acrobat que ponga nombre, hora y el dibujo de la
 * firma». Pieza común (escritorio, web, móvil Cx y PDF): el dibujo de la firma
 * guardada de la persona (Ajustes › Mi firma) y al lado «Firmado por Nombre
 * Apellidos · Rol · dd/mm/aaaa hh:mm» (+ empresa). Sin firma, el hueco con el
 * rótulo de la casilla, para que firme quien toque.
 *
 * También: pasar a transparente el fondo blanco de una imagen subida (los
 * píxeles casi blancos), en puro JS sobre los bytes RGBA del lienzo.
 */
(function () {

const escSello = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dosSello = (n) => String(n).padStart(2, '0');

/** dd/mm/aaaa hh:mm en hora local; '' si no es una fecha. */
function fechaHora(valor) {
  /* Un día sin hora (la misma fecha para todas las firmas de un equipo) sale solo con el día. */
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ''));
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const d = valor instanceof Date ? valor : new Date(valor || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return `${dosSello(d.getDate())}/${dosSello(d.getMonth() + 1)}/${d.getFullYear()} ${dosSello(d.getHours())}:${dosSello(d.getMinutes())}`;
}

/** «Firmado por Nombre · Rol · dd/mm/aaaa hh:mm · Empresa» (lo que falte, fuera). */
function textoSello({ nombre, rol, fecha, empresa } = {}) {
  const partes = [nombre ? `Firmado por ${String(nombre).trim()}` : 'Firmado', rol, fechaHora(fecha), empresa]
    .map((x) => String(x || '').trim()).filter(Boolean);
  return partes.join(' · ');
}

/** ¿Es una imagen PNG/JPEG en data URL? */
const esImagen = (s) => /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));

/** Estilos del sello: van dentro del HTML del documento (PDF, hoja, pantalla). Teal, sin negro. */
const CSS_SELLO = `
.selloFirma { display: flex; align-items: center; gap: 8px; border: 1px solid #2f8f83; border-radius: 4px; padding: 4px 8px;
  background: #f3faf8; min-height: 52px; page-break-inside: avoid; break-inside: avoid; max-width: 100%; box-sizing: border-box; }
.selloFirma img { height: 46px; max-width: 48%; object-fit: contain; }
.selloFirma .selloTexto { font-size: 8pt; line-height: 1.3; color: #17484a; }
.selloFirma .selloTexto b { display: block; color: #0e6b62; }
.selloFirma .selloTexto span { display: block; }
.selloHueco { border: 1px dashed #8fb8b3; border-radius: 4px; min-height: 52px; padding: 4px 8px; font-size: 8pt; color: #4d6f70;
  display: flex; align-items: flex-end; box-sizing: border-box; }`;

/**
 * El sello: { imagen, nombre, rol, fecha, empresa }. Sin imagen válida, el
 * hueco (`huecoHtml`). `rotulo` (la casilla: «El contratista») va arriba.
 */
function selloHtml(f = {}, { rotulo = '' } = {}) {
  if (!f || !esImagen(f.imagen)) return huecoHtml(rotulo);
  return `<div class="selloFirma" data-sello="1">
    <img src="${escSello(f.imagen)}" alt="Firma de ${escSello(f.nombre)}">
    <div class="selloTexto">${rotulo ? `<span>${escSello(rotulo)}</span>` : ''}<b>Firmado por ${escSello(String(f.nombre || '').trim())}</b>${f.rol ? `<span>${escSello(f.rol)}</span>` : ''}<span>${escSello(fechaHora(f.fecha))}</span>${f.empresa ? `<span>${escSello(f.empresa)}</span>` : ''}</div>
  </div>`;
}

/** La casilla sin firmar: queda para quien la tenga que firmar. */
function huecoHtml(rotulo = '') {
  return `<div class="selloHueco" data-sello="0">${escSello(rotulo || 'Pendiente de firma')} · pendiente de firma</div>`;
}

/**
 * Fondo blanco a transparente sobre RGBA (Uint8ClampedArray de un ImageData):
 * los píxeles con R, G y B ≥ `umbral` pasan a alfa 0; los grises claros del
 * borde, a alfa parcial (que no quede un halo). Devuelve cuántos ha tocado.
 */
function fondoATransparente(rgba, { umbral = 235, suave = 200 } = {}) {
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const m = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (m >= umbral) { if (rgba[i + 3]) n += 1; rgba[i + 3] = 0; continue; }
    if (m > suave) {
      const a = Math.round(rgba[i + 3] * (umbral - m) / (umbral - suave));
      if (a !== rgba[i + 3]) { rgba[i + 3] = a; n += 1; }
    }
  }
  return n;
}

(function exportar(API) {
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.FIRMA_SELLO = API;
})({ fechaHora, textoSello, selloHtml, huecoHtml, esImagen, fondoATransparente, CSS_SELLO });
}());
