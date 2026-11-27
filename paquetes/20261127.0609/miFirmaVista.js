'use strict';
/*
 * AJUSTES › MI FIRMA, LA MISMA PIEZA EN ESCRITORIO, WEB Y MÓVIL CX (JC,
 * 26-nov-2026): «dibujando con el dedo en la app móvil o con el ratón en el
 * ordenador, o mediante la carga de una imagen y ya esa firma quedará para ese
 * usuario». Un recuadro para firmar (eventos de puntero: dedo, lápiz o ratón),
 * «Subir imagen» (el fondo blanco pasa a transparente) y la vista previa del
 * sello tal y como saldrá en los papeles (shared/firma/sello.js).
 *
 * window.FIRMA_MI.montar(el, { leer, guardar, quitar, rol, empresa, aviso })
 *   leer()            → { ok, nombre, firma: { nombre, imagen, origen } | null }
 *   guardar({ imagen, origen, nombre }) → lo mismo
 *   quitar()          → lo mismo
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => window.FIRMA_SELLO;
  const TRAZO = '#0e4f56';

  function montar(el, op = {}) {
    if (!el) return;
    let estado = { nombre: '', firma: null };
    let trazado = false;
    let origen = 'trazo';
    const avisar = (t, nivel) => (op.aviso ? op.aviso(t, nivel) : null);

    function pintar() {
      const f = estado.firma;
      const vista = f ? S().selloHtml({ imagen: f.imagen, nombre: f.nombre || estado.nombre, rol: op.rol, fecha: new Date(), empresa: op.empresa })
        : S().huecoHtml('Aún no tienes firma');
      el.innerHTML = `<style>${S().CSS_SELLO}
        .miFirma .mfLienzo { width: 100%; max-width: 520px; aspect-ratio: 3 / 1; border: 1px solid #8fb8b3; border-radius: 6px; background: #fff; touch-action: none; display: block; }
        .miFirma .mfBotones { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        .miFirma .mfBotones .boton { width: auto; flex: 1 1 auto; margin: 0; }
        .miFirma .mfVista { max-width: 360px; margin-top: 6px; }
        .miFirma .mfNota { font-size: 12px; color: #4d6f70; margin: 4px 0; }
        .miFirma .mfCol { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 700px) { .miFirma .mfCol { grid-template-columns: minmax(0, 1fr); } }
      </style>
      <div class="miFirma">
        <div class="mfCol">
          <div>
            <p class="mfNota">${f ? 'Para cambiarla, firma de nuevo o sube otra imagen.' : 'Firma dentro del recuadro con el dedo o con el ratón, o sube una imagen de tu firma.'}</p>
            <canvas class="mfLienzo" width="600" height="200" data-mf-lienzo aria-label="Firma aquí"></canvas>
            <div class="mfBotones">
              <button type="button" class="boton" data-mf="guardar">Guardar mi firma</button>
              <button type="button" class="boton secundario" data-mf="limpiar">Borrar trazo</button>
              <label class="boton secundario" style="cursor:pointer">Subir imagen…<input type="file" accept="image/png,image/jpeg" data-mf-archivo hidden></label>
              ${f ? '<button type="button" class="enlace mal" data-mf="quitar">Quitar mi firma</button>' : ''}
            </div>
          </div>
          <div>
            <p class="mfNota"><strong>Así sale en los papeles que firmas</strong> (certificaciones, commissioning, estanqueidad…). Se pone sola cuando confirmas con un toque; nunca sin ti.</p>
            <div class="mfVista" data-mf-vista>${vista}</div>
            <p class="mfNota">Es solo tuya: nadie más la ve ni la puede usar. Viaja a tu teléfono y a la nube de tu empresa.</p>
          </div>
        </div>
      </div>`;
      enlazar();
    }

    function enlazar() {
      const cv = el.querySelector('[data-mf-lienzo]');
      const cx = cv.getContext('2d');
      cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = TRAZO;
      trazado = false; origen = 'trazo';
      let ultimo = null;
      const punto = (ev) => { const r = cv.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * cv.width, y: ((ev.clientY - r.top) / r.height) * cv.height }; };
      cv.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        try { cv.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
        ultimo = punto(ev);
        cx.beginPath(); cx.arc(ultimo.x, ultimo.y, 1.5, 0, Math.PI * 2); cx.fillStyle = TRAZO; cx.fill();
        trazado = true; origen = 'trazo';
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!ultimo) return;
        ev.preventDefault();
        const p = punto(ev);
        cx.beginPath(); cx.moveTo(ultimo.x, ultimo.y); cx.lineTo(p.x, p.y); cx.stroke();
        ultimo = p;
      });
      const fin = () => { ultimo = null; };
      cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('pointerleave', fin);

      el.querySelector('[data-mf="limpiar"]').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); trazado = false; };
      el.querySelector('[data-mf="guardar"]').onclick = async () => {
        if (!trazado) { avisar('Firma en el recuadro (o sube una imagen) antes de guardar.'); return; }
        const r = await op.guardar({ imagen: cv.toDataURL('image/png'), origen, nombre: estado.nombre });
        if (!r || r.ok === false) { avisar((r && r.error) || 'No se ha podido guardar la firma.'); return; }
        estado = r; pintar(); avisar('Firma guardada.', 'bien');
      };
      const q = el.querySelector('[data-mf="quitar"]');
      if (q) q.onclick = async () => {
        if (!confirm('¿Quitar tu firma guardada? Las ya puestas en papeles se quedan.')) return;
        const r = await op.quitar();
        if (r && r.ok !== false) { estado = r; pintar(); }
      };
      el.querySelector('[data-mf-archivo]').onchange = (ev) => {
        const a = ev.target.files && ev.target.files[0];
        if (!a) return;
        const lector = new FileReader();
        lector.onload = () => {
          const img = new Image();
          img.onload = () => {
            cx.clearRect(0, 0, cv.width, cv.height);
            const k = Math.min(cv.width / img.width, cv.height / img.height);
            const w = img.width * k; const h = img.height * k;
            cx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
            try {
              const d = cx.getImageData(0, 0, cv.width, cv.height);
              S().fondoATransparente(d.data);
              cx.putImageData(d, 0, 0);
            } catch { /* sin recorte: se guarda tal cual */ }
            trazado = true; origen = 'imagen';
            avisar('Imagen cargada: revisa el recuadro y pulsa «Guardar mi firma».', 'bien');
          };
          img.src = lector.result;
        };
        lector.readAsDataURL(a);
      };
    }

    Promise.resolve(op.leer ? op.leer() : null).then((r) => { if (r && r.ok !== false) estado = r; pintar(); })
      .catch(() => pintar());
  }

  window.FIRMA_MI = { montar };
}());
