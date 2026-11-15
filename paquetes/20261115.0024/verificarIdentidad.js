'use strict';
/*
 * 🧭 ¿ERES TÚ? (8-nov-2026, nota 1108-iarvis-medidas-firmas-motor). Antes de que Iarvis firme con
 * tu firma guardada: Face ID o huella si el teléfono los tiene; si no, un PIN.
 *
 *   window.CX_VERIFICAR({ motivo }) → Promise<'biometria' | 'webauthn' | 'pin' | null>
 *
 * Por orden:
 *   1. El plugin nativo «Biometria» de la app Cx (cxobra/nativo/BiometriaPlugin.swift, con
 *      LocalAuthentication: Face ID o Touch ID de verdad). Si cancela o no le reconoce, no se
 *      firma; solo si el aparato no tiene biometría se sigue al paso 2. (Por compatibilidad
 *      también vale NativeBiometric o BiometricAuth, si algún día se instala uno de esos.)
 *   2. WebAuthn con el autenticador del propio aparato (Face ID / Touch ID / huella), con
 *      `userVerification: 'required'`, donde el navegador lo permita (Safari, Chrome, la web).
 *   3. Un PIN de 4–8 cifras de este teléfono: la primera vez se crea (dos veces), después se
 *      pide. Se guarda solo su huella (SHA-256 con sal) en el almacenamiento del teléfono.
 *
 * Es una comprobación del aparato: el servidor exige además el reto de un solo uso del «Sí»
 * (electron/data/iarvisGeneral.js · firmarEquipo), que el motor de IA no conoce.
 */
(function verificarIdentidad() {
  const CLAVE_PIN = 'cx.iarvis.pin';
  const CLAVE_CRED = 'cx.iarvis.webauthn';
  const leer = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
  const escribir = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const bytes = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  /*
   * 9-nov (JC: «no funciona el botón del Face ID»). Las builds 5 a 8 de iOS llevan el plugin compilado
   * pero sin registrar: SceneDelegate.swift creaba un CAPBridgeViewController pelado, así que
   * CxObraViewController.capacitorDidLoad no corría y window.Capacitor.Plugins.Biometria no existe.
   * El puente de Capacitor sí sabe cargar un plugin por el nombre de su clase Objective-C
   * (CapacitorBridge.handleJSCall → NSClassFromString), y eso llega por OTA a esas builds.
   * Si el binario es anterior a la build 5 no hay clase y Capacitor NO contesta nunca: de ahí el plazo.
   * El «sí» sigue saliendo solo de LocalAuthentication; esto únicamente cambia cómo se le llama.
   */
  const PLAZO_MODULO_MS = 4000;
  let sinModuloHasta = 0;
  function porClaseIos(C) {
    let ios = false;
    try { ios = Boolean(C.getPlatform && C.getPlatform() === 'ios'); } catch { ios = false; }
    if (!ios || typeof C.nativePromise !== 'function' || Date.now() < sinModuloHasta) return null;
    return {
      disponible: () => new Promise((bien, mal) => {
        const plazo = setTimeout(() => {
          sinModuloHasta = Date.now() + 60000; /* para no hacer esperar otra vez en el mismo intento */
          mal(Object.assign(new Error('Sin el módulo de biometría'), { code: 'sin-modulo' }));
        }, PLAZO_MODULO_MS);
        C.nativePromise('BiometriaPlugin', 'disponible', {}).then((d) => { clearTimeout(plazo); bien(d); }, (e) => { clearTimeout(plazo); mal(e); });
      }),
      verificar: (o) => C.nativePromise('BiometriaPlugin', 'verificar', o || {}),
    };
  }

  /* El plugin propio de la app Cx: registrado en CxObraViewController.swift, sin paquete npm. */
  function pluginBiometria(C) {
    if (!C) return null;
    if (typeof C.isPluginAvailable === 'function' && !C.isPluginAvailable('Biometria')) return porClaseIos(C);
    try { return (C.registerPlugin ? C.registerPlugin('Biometria') : (C.Plugins && C.Plugins.Biometria)) || porClaseIos(C); } catch { return porClaseIos(C); }
  }

  /* Por qué no se puede usar ahora, con los códigos que da el sistema (LAError de iOS; en Android, BiometricManager). */
  function causaNoDisponible(d) {
    const codigo = Number(d && d.codigo);
    const tipo = String((d && d.tipo) || '').toLowerCase();
    if (codigo === -7 || codigo === 11) return 'sin-configurar';
    if (codigo === -5) return 'sin-codigo';
    if (codigo === -8) return 'bloqueada';
    if (codigo === -6 && tipo && tipo !== 'ninguna') return 'sin-permiso'; /* hay Face ID, pero se le negó a la app */
    return 'no-disponible';
  }

  async function nativa(motivo) {
    const C = window.Capacitor;
    const B = pluginBiometria(C);
    if (B) {
      let d = null;
      try { d = await B.disponible(); } catch { d = null; }
      if (d && d.disponible) {
        try {
          const r = await B.verificar({ motivo });
          return r && r.ok ? 'biometria' : false;
        } catch (e) {
          return e && e.code === 'no-disponible' ? null : false; /* canceló o no era él: no se firma */
        }
      }
      /* Sin Face ID ni huella en este aparato: sigue al PIN. */
    }
    const P = C && C.Plugins;
    if (!P) return null;
    try {
      if (P.NativeBiometric) {
        const d = await P.NativeBiometric.isAvailable();
        if (!d || !d.isAvailable) return null;
        await P.NativeBiometric.verifyIdentity({ reason: motivo, title: 'Vidaire Cx' });
        return 'biometria';
      }
      if (P.BiometricAuth) {
        const d = await P.BiometricAuth.checkBiometry();
        if (!d || !d.isAvailable) return null;
        await P.BiometricAuth.authenticate({ reason: motivo, allowDeviceCredential: false });
        return 'biometria';
      }
    } catch { return false; } /* la canceló o no era él */
    return null;
  }

  async function webauthn() {
    const PK = window.PublicKeyCredential;
    if (!PK || !navigator.credentials || !window.isSecureContext) return null;
    try { if (!(await PK.isUserVerifyingPlatformAuthenticatorAvailable())) return null; } catch { return null; }
    const host = location.hostname;
    if (!host) return null;
    try {
      let id = leer(CLAVE_CRED);
      if (!id) {
        const c = await navigator.credentials.create({ publicKey: {
          challenge: bytes(32), rp: { name: 'Vidaire Cx', id: host },
          user: { id: bytes(16), name: 'iarvis-firma', displayName: 'Firma con Iarvis' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
          timeout: 60000,
        } });
        if (!c) return false;
        id = b64(c.rawId);
        escribir(CLAVE_CRED, id);
        return 'webauthn';
      }
      const a = await navigator.credentials.get({ publicKey: {
        challenge: bytes(32), rpId: host, userVerification: 'required', timeout: 60000,
        allowCredentials: [{ type: 'public-key', id: deB64(id), transports: ['internal'] }],
      } });
      return a ? 'webauthn' : false;
    } catch { return null; } /* sin permiso en este origen (la app nativa): al PIN */
  }

  async function huella(pin, sal) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${pin}`));
    return b64(d);
  }

  /* El PIN, en una hoja propia (no el prompt del sistema: no tapa los números). */
  function pedirPin(titulo) {
    return new Promise((resolver) => {
      const capa = document.createElement('div');
      capa.className = 'hoja-verificar';
      capa.setAttribute('role', 'dialog');
      capa.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)';
      capa.innerHTML = `<form style="background:var(--panel);color:var(--texto);padding:18px;border-radius:12px;max-width:300px;width:calc(100% - 32px)">
        <p style="margin:0 0 10px">${titulo}</p>
        <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" style="width:100%;font-size:22px;letter-spacing:6px;padding:8px" aria-label="PIN">
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="enlace" data-no>Cancelar</button><button type="submit" class="boton">Aceptar</button></div>
      </form>`;
      const fin = (v) => { capa.remove(); resolver(v); };
      capa.querySelector('[data-no]').addEventListener('click', () => fin(null));
      capa.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); fin(capa.querySelector('input').value); });
      document.body.appendChild(capa);
      setTimeout(() => capa.querySelector('input').focus(), 50);
    });
  }

  async function pin() {
    if (!window.crypto || !crypto.subtle) return null;
    const guardado = (() => { try { return JSON.parse(leer(CLAVE_PIN) || 'null'); } catch { return null; } })();
    const valido = (p) => /^\d{4,8}$/.test(String(p || ''));
    if (!guardado) {
      const a = await pedirPin('Para firmar con Iarvis sin Face ID, crea un PIN de este teléfono (4 a 8 cifras).');
      if (!valido(a)) return false;
      const b = await pedirPin('Repite el PIN.');
      if (a !== b) return false;
      const sal = b64(bytes(16));
      escribir(CLAVE_PIN, JSON.stringify({ sal, h: await huella(a, sal) }));
      return 'pin';
    }
    const p = await pedirPin('Tu PIN para firmar.');
    if (!valido(p)) return false;
    return (await huella(p, guardado.sal)) === guardado.h ? 'pin' : false;
  }

  /*
   * LAS PIEZAS SUELTAS (8-nov, nota 1108-cx-entrar): para la pantalla de bloqueo al ENTRAR en Cx
   * (renderer/movil/bloqueo.js), que necesita distinguir «canceló» de «no le reconoce» y pinta el
   * PIN en su propia pantalla. El PIN es el mismo que el de firmar con Iarvis.
   *   biometria(motivo) → 'ok' | 'cancelado' | 'fallo' | 'no-disponible' | 'sin-plugin'
   *                       | 'sin-permiso' | 'sin-configurar' | 'sin-codigo' | 'bloqueada'
   */
  async function biometria(motivo) {
    const B = pluginBiometria(window.Capacitor);
    if (!B) return 'sin-plugin';
    let d;
    try { d = await B.disponible(); } catch { return 'sin-plugin'; } /* app anterior a la build 5 */
    if (!d || !d.disponible) return causaNoDisponible(d);
    try {
      const r = await B.verificar({ motivo });
      return r && r.ok ? 'ok' : 'fallo';
    } catch (e) {
      const c = e && e.code;
      return c === 'cancelado' || c === 'no-disponible' ? c : 'fallo';
    }
  }
  /* Cómo se llama la biometría de este aparato, para los botones: «Face ID», «Touch ID» o «la huella». */
  async function nombreBiometria() {
    const C = window.Capacitor;
    const android = (() => { try { return C && C.getPlatform && C.getPlatform() === 'android'; } catch { return false; } })();
    const B = pluginBiometria(C);
    let t = '';
    if (B) { try { const d = await B.disponible(); t = String((d && d.tipo) || '').toLowerCase(); } catch { t = ''; } }
    if (t === 'touchid') return 'Touch ID';
    if (t === 'opticid') return 'Optic ID';
    if (t === 'huella' || android) return 'la huella';
    return 'Face ID';
  }
  const pinGuardado = () => { try { return JSON.parse(leer(CLAVE_PIN) || 'null'); } catch { return null; } };
  window.CX_IDENTIDAD = {
    biometria,
    nombreBiometria,
    /* La app nativa (Capacitor en el iPhone o el Android), con o sin el plugin. */
    nativa: () => { const C = window.Capacitor; try { return Boolean(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.getPlatform && C.getPlatform() !== 'web')); } catch { return false; } },
    pinValido: (p) => /^\d{4,8}$/.test(String(p || '')),
    pinExiste: () => Boolean(pinGuardado()),
    crearPin: async (p) => {
      if (!/^\d{4,8}$/.test(String(p || '')) || !window.crypto || !crypto.subtle) return false;
      const sal = b64(bytes(16));
      escribir(CLAVE_PIN, JSON.stringify({ sal, h: await huella(String(p), sal) }));
      return true;
    },
    comprobarPin: async (p) => {
      const g = pinGuardado();
      if (!g || !/^\d{4,8}$/.test(String(p || '')) || !window.crypto || !crypto.subtle) return false;
      return (await huella(String(p), g.sal)) === g.h;
    },
  };

  window.CX_VERIFICAR = async ({ motivo = 'Confirma que eres tú para firmar' } = {}) => {
    for (const paso of [() => nativa(motivo), webauthn, pin]) {
      const r = await paso();
      if (r === false) return null; /* falló de verdad: no se sigue probando */
      if (r) return r;
    }
    return null;
  };
})();
