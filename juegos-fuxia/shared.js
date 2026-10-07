/* FUXIA GAMES · Juegos de Manso Diario — utilidades comunes (JS vanilla, sin dependencias)
   - Día del juego en huso horario de Argentina (UTC-3 fijo; San Juan no usa horario de verano)
   - Estado del jugador en localStorage con prefijo "fuxiagames_[juego]_"
   - Compartir resultado (Web Share API con fallback a portapapeles)
*/
(function (global) {
  'use strict';

  var SITE_URL = 'https://mansodiario.com';   // link de vuelta al diario (se agrega a lo que se comparte)
  var AR_OFFSET_MS = -3 * 3600 * 1000;        // UTC-3 fijo
  var DAY_MS = 86400000;

  /* ── Fecha "de hoy" en Argentina ───────────────────────────────────────────
     Truco: se corre el reloj 3 h hacia atrás y se lee en UTC; así el cambio de día
     ocurre a las 00:00 de Argentina sin depender del huso del dispositivo.
     Vista previa para el editor: agregar ?fecha=AAAA-MM-DD a la URL (no guarda estado). */
  function previewFecha() {
    try {
      var m = /[?&]fecha=(\d{4}-\d{2}-\d{2})/.exec(location.search);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }
  function ahoraAR() {
    var p = previewFecha();
    if (p) return new Date(Date.parse(p + 'T12:00:00Z'));
    return new Date(Date.now() + AR_OFFSET_MS);
  }
  function diasUTC(fechaISO) {            // 'AAAA-MM-DD' -> nº de día absoluto
    return Math.floor(Date.parse(fechaISO + 'T00:00:00Z') / DAY_MS);
  }
  function hoyAbsoluto() {                // nº de día absoluto de hoy en Argentina
    return Math.floor(ahoraAR().getTime() / DAY_MS);
  }

  /* Devuelve el índice (0..largoDelBanco-1) del contenido de hoy.
     Devuelve -1 si el juego todavía no arrancó (hoy < fechaLanzamiento).
     Cuando se termina el banco vuelve a empezar (módulo). */
  function calcularIndiceDelDia(fechaLanzamiento, largoDelBanco) {
    var n = hoyAbsoluto() - diasUTC(fechaLanzamiento);
    if (n < 0 || !largoDelBanco) return -1;
    return n % largoDelBanco;
  }
  /* Nº de día del ciclo (1 = día de lanzamiento). Sigue creciendo aunque el banco se repita:
     se usa para las rachas. */
  function numeroDeDia(fechaLanzamiento) {
    return hoyAbsoluto() - diasUTC(fechaLanzamiento) + 1;
  }
  function segundosHastaMedianoche() {
    var t = ahoraAR().getTime();
    if (previewFecha()) return 3600;
    return Math.max(0, Math.ceil((DAY_MS - (t % DAY_MS)) / 1000));
  }
  function fechaLarga() {
    var d = ahoraAR();
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return d.getUTCDate() + ' de ' + meses[d.getUTCMonth()];
  }

  /* ── localStorage con prefijo (y fallback en memoria si está bloqueado) ── */
  var mem = {};
  function k(juego, clave) { return 'fuxiagames_' + juego + '_' + clave; }
  function guardar(juego, clave, valor) {
    if (previewFecha()) { mem[k(juego, clave)] = JSON.stringify(valor); return; }
    try { localStorage.setItem(k(juego, clave), JSON.stringify(valor)); }
    catch (e) { mem[k(juego, clave)] = JSON.stringify(valor); }
  }
  function leer(juego, clave, def) {
    var key = k(juego, clave), raw = null;
    if (previewFecha()) raw = mem[key] || null;
    else { try { raw = localStorage.getItem(key); } catch (e) {} if (raw == null) raw = mem[key] || null; }
    if (raw == null) return def;
    try { return JSON.parse(raw); } catch (e) { return def; }
  }

  /* Claves por juego:
       _racha      nº de días seguidos ganados (trivia: días seguidos completados)
       _ultimoDia  nº de día (numeroDeDia) en que terminó su última partida
       _hoy        estado de la partida del día: { dia, terminado, ... } */
  function rachaVigente(juego, diaN) {
    var r = leer(juego, 'racha', 0), u = leer(juego, 'ultimoDia', 0);
    return (u >= diaN - 1) ? r : 0;       // si se salteó un día, la racha está cortada
  }
  function registrarFin(juego, diaN, gano) {
    var u = leer(juego, 'ultimoDia', 0), r = leer(juego, 'racha', 0);
    if (gano) r = (u === diaN - 1) ? r + 1 : 1; else r = 0;
    guardar(juego, 'racha', r);
    guardar(juego, 'ultimoDia', diaN);
    return r;
  }
  function estadoDeHoy(juego, diaN) {      // null si no hay partida de hoy
    var h = leer(juego, 'hoy', null);
    return (h && h.dia === diaN) ? h : null;
  }

  /* ── Carga del banco + día de hoy ─────────────────────────────────────────
     cb(entrada, ctx) con ctx = { dia1, diaN, indice }.
     El día 1 sale del propio JSON ("dia1"), así datos y código nunca se desfasan. */
  function iniciar(opts, cb) {
    var root = document.getElementById('app');
    function falla(msg) {
      root.innerHTML = '<div class="fg-error-box">' + msg + '</div>';
    }
    fetch(opts.json, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      var banco = data[opts.clave];
      var idx = calcularIndiceDelDia(data.dia1, banco.length);
      if (idx < 0) {
        var p = data.dia1.split('-');
        return falla('<h2 class="gradient-text">¡Muy pronto!</h2><p style="margin-top:8px">Los juegos arrancan el ' +
          parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + p[0] + '.</p>');
      }
      cb(banco[idx], { dia1: data.dia1, diaN: numeroDeDia(data.dia1), indice: idx });
      avisarAlto();
    }).catch(function () {
      falla('No pudimos cargar el juego de hoy.<br>Si abriste el archivo con doble clic, probalo desde el sitio publicado: ' +
        'el navegador no deja leer los datos desde <code>file://</code>.');
    });
  }

  /* ── Cuenta regresiva hasta el próximo desafío ── */
  function cuentaRegresiva(el) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var s = segundosHastaMedianoche();
      el.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
      if (s <= 0) clearInterval(t);
    }
    var t = setInterval(tick, 1000); tick();
  }

  /* ── Compartir ── */
  function toast(msg) {
    var t = document.getElementById('fg-toast');
    if (!t) { t = document.createElement('div'); t.id = 'fg-toast'; t.className = 'fg-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function copiarFallback(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  /* texto = encabezado + grilla de emojis (sin revelar la respuesta). Se le agrega el link al diario. */
  function compartir(texto) {
    var completo = texto + '\n' + SITE_URL;
    function copiar() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(completo).then(function () { toast('¡Copiado! Pegalo donde quieras'); },
          function () { toast(copiarFallback(completo) ? '¡Copiado! Pegalo donde quieras' : 'No se pudo copiar'); });
      } else toast(copiarFallback(completo) ? '¡Copiado! Pegalo donde quieras' : 'No se pudo copiar');
    }
    if (navigator.share) {
      navigator.share({ text: completo }).catch(function (e) { if (!e || e.name !== 'AbortError') copiar(); });
    } else copiar();
  }

  /* ── Iframe: le avisa a la página de WordPress cuánto mide el juego (opcional, ver docs) ── */
  function avisarAlto() {
    if (global.parent === global) return;
    function send() {
      try { global.parent.postMessage({ tipo: 'fuxiagames-alto', alto: document.documentElement.scrollHeight, juego: location.pathname }, '*'); } catch (e) {}
    }
    send();
    if (global.ResizeObserver) new ResizeObserver(send).observe(document.body);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  global.FG = {
    SITE_URL: SITE_URL,
    calcularIndiceDelDia: calcularIndiceDelDia, numeroDeDia: numeroDeDia, fechaLarga: fechaLarga,
    guardar: guardar, leer: leer, rachaVigente: rachaVigente, registrarFin: registrarFin, estadoDeHoy: estadoDeHoy,
    iniciar: iniciar, cuentaRegresiva: cuentaRegresiva, compartir: compartir, toast: toast, esc: esc
  };
  global.calcularIndiceDelDia = calcularIndiceDelDia;
})(window);
