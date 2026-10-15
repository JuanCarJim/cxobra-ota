'use strict';
/*
 * BLOC DE NOTAS EN EL MÓVIL (#bloc).
 *
 * Las notas son de cada uno (las mismas que su bloc del escritorio). Salen
 * las de la obra elegida y las generales; las fijadas, arriba. Una nota puede
 * llevar fotos: el ordenador las guarda en la carpeta del bloc de quien
 * escribe y las marca en el texto como «[foto:xxxx.jpg]»; aquí esas marcas
 * no se ven en el texto, se ven como fotos debajo.
 */
(function bloc() {
  const C = window.CX;
  const $app = document.getElementById('app');
  const { esc } = C;
  const activa = () => C.activa('bloc');
  const RE_FOTO = /\[foto:[A-Za-z0-9_-]{8,40}\.(?:jpg|png|heic|heif|webp)\]/g;
  const sinFotos = (t) => String(t || '').replace(RE_FOTO, '').replace(/\n{3,}/g, '\n\n').trim();

  let notas = [];
  let editando = null;

  const cuando = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    return d.toDateString() === hoy.toDateString()
      ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  async function lista() {
    editando = null;
    await C.obrasListas();
    if (!activa()) return;
    $app.innerHTML = '<p class="cargando">Cargando…</p>';
    try {
      const r = await C.pedir(`api/bloc${C.obraId() ? `?obra=${encodeURIComponent(C.obraId())}` : ''}`);
      if (!r.ok) throw new Error(r.error);
      notas = r.notas || [];
    } catch (e) {
      if (activa()) $app.innerHTML = `<div class="vacio mal"><p>${esc(e.message)}</p><button class="boton" data-bl="lista">Reintentar</button></div>`;
      return;
    }
    if (activa() && !editando) pintarLista();
  }

  function pintarLista() {
    const orden = [...notas].sort((a, b) => (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0) || String(b.modificadoEn).localeCompare(String(a.modificadoEn)));
    $app.innerHTML = `
      <button class="boton grande" data-bl="nueva">＋ Nueva nota</button>
      ${orden.length ? C.listaAgrupada('bloc', orden, { repintar: pintarLista,
        grupo: orden.length > 20 ? (n) => (n.fijada ? 'Fijadas' : n.obra || 'General') : null,
        fila: (n) => {
        const t = sinFotos(n.texto);
        const [primera, ...resto] = t.split('\n');
        return `<li><button class="fila-ios" data-bl="abrir" data-id="${esc(n.id)}">
          <div class="fila-principal"><strong>${n.fijada ? '<i class="ic ic-chincheta"></i>' : ''}${esc(primera || (n.fotos.length ? 'Foto' : 'Nota'))}</strong><span class="sub">${esc(cuando(n.modificadoEn))}</span></div>
          ${resto.join(' ').trim() ? `<div class="texto-2 sub">${esc(resto.join(' ').trim())}</div>` : ''}
          <div class="sub">${esc(n.obra || 'General')}${n.fotos.length ? ` · ${n.fotos.length} foto${n.fotos.length === 1 ? '' : 's'}` : ''}</div>
        </button></li>`;
      } }) : '<p class="vacio">Sin notas todavía. Lo que apuntes aquí también sale en el bloc del ordenador.</p>'}`;
  }

  function abrir(n) {
    editando = n
      ? { id: n.id, texto: sinFotos(n.texto), marcas: n.texto.match(RE_FOTO) || [], fotos: n.fotos, fijada: Boolean(n.fijada), deObra: Boolean(n.obraId), nuevas: [] }
      : { id: null, texto: '', marcas: [], fotos: [], fijada: false, deObra: Boolean(C.obraId()), nuevas: [] };
    pintarEditor();
    if (!n) { const t = $app.querySelector('textarea'); if (t) t.focus(); }
  }

  function pintarEditor() {
    const e = editando;
    const o = C.obra();
    $app.innerHTML = `
      <div class="barra-editor">
        <button class="volver" data-bl="lista">‹ Notas</button>
        <button class="boton pequeno" data-bl="guardar">Guardar</button>
      </div>
      <textarea class="editor-nota" rows="12" data-bl-texto placeholder="Escribe aquí…">${esc(e.texto)}</textarea>
      ${e.fotos.length || e.nuevas.length ? `<div class="fotos">
        ${e.fotos.map((f) => `<img data-src="api/bloc/foto?f=${encodeURIComponent(f)}" alt="">`).join('')}
        ${e.nuevas.map((x) => `<img src="${esc(x.url)}" alt="">`).join('')}
      </div>` : ''}
      <div class="fila-botones">
        <button class="boton secundario" data-bl="camara"><i class="ic ic-camara"></i>Foto</button>
        <button class="boton secundario" data-bl="galeria">De la galería</button>
      </div>
      <section class="grupo">
        <label class="fila-dato interruptor"><span>Fijada arriba</span><input type="checkbox" data-bl-fijada ${e.fijada ? 'checked' : ''}></label>
        ${o ? `<label class="fila-dato interruptor"><span>De la obra ${esc(o.codigo)}</span><input type="checkbox" data-bl-obra ${e.deObra ? 'checked' : ''}></label>` : ''}
      </section>
      ${e.id ? '<button class="boton peligro" data-bl="borrar">Borrar nota</button>' : ''}`;
    C.cargarImagenes($app);
  }

  async function foto(camara) {
    const archivo = await C.elegirFoto(camara);
    if (!archivo || !editando) return;
    try {
      const id = await C.subirFoto(archivo);
      editando.nuevas.push({ id, url: URL.createObjectURL(archivo) });
      pintarEditor();
    } catch (e) { C.aviso(e.message); }
  }

  async function guardar(boton) {
    const e = editando;
    const texto = [e.texto.trim(), ...e.marcas].filter(Boolean).join('\n');
    if (!texto && !e.nuevas.length) { C.aviso('La nota está vacía.', 'aviso'); return; }
    boton.disabled = true;
    try {
      const r = await C.postJson('api/bloc', {
        id: e.id || undefined, texto, fijada: e.fijada, obraId: e.deObra ? C.obraId() : null, fotos: e.nuevas.map((x) => x.id),
      });
      if (!r.ok) throw new Error(r.error);
      C.aviso('Nota guardada.', 'bien');
      await lista();
    } catch (err) { C.aviso(err.message); boton.disabled = false; }
  }

  async function borrar(boton) {
    if (!window.confirm('¿Borrar esta nota y sus fotos?')) return;
    boton.disabled = true;
    try {
      const r = await C.postJson('api/bloc/borrar', { id: editando.id });
      if (!r.ok) throw new Error(r.error);
      await lista();
    } catch (e) { C.aviso(e.message); boton.disabled = false; }
  }

  $app.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-bl]');
    if (!b) return;
    const a = b.dataset.bl;
    if (a === 'lista') lista();
    else if (a === 'nueva') abrir(null);
    else if (a === 'abrir') abrir(notas.find((n) => n.id === b.dataset.id));
    else if (a === 'camara') foto(true);
    else if (a === 'galeria') foto(false);
    else if (a === 'guardar') guardar(b);
    else if (a === 'borrar') borrar(b);
  });
  $app.addEventListener('input', (ev) => { if (activa() && editando && ev.target.hasAttribute('data-bl-texto')) editando.texto = ev.target.value; });
  $app.addEventListener('change', (ev) => {
    if (!activa() || !editando) return;
    if (ev.target.hasAttribute('data-bl-fijada')) editando.fijada = ev.target.checked;
    if (ev.target.hasAttribute('data-bl-obra')) editando.deObra = ev.target.checked;
  });

  window.addEventListener('movil:obra', () => { if (activa() && !editando) lista(); });
  window.addEventListener('hashchange', () => { if (activa()) lista(); });
  if (activa()) lista();
})();
