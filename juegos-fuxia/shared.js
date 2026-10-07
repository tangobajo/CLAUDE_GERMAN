/* FUXIA GAMES · Juegos de Manso Diario — utilidades comunes (JS vanilla, sin dependencias)
   - Día del juego en huso horario de Argentina (UTC-3 fijo; San Juan no usa horario de verano)
   - Estado del jugador en localStorage con prefijo "fuxiagames_[juego]_"
   - Compartir resultado (Web Share API con fallback a portapapeles)
*/
(function (global) {
  'use strict';

  var SITE_URL = 'https://mansodiario.com';   // link de vuelta al diario (se agrega a lo que se comparte)

  /* A dónde manda el link que se comparte.
     ────────────────────────────────────────────────────────────────────────
     COMPLETAR con la URL de la página de WordPress de cada juego. Mientras
     queden en SITE_URL, el que recibe el mensaje cae en la portada del diario
     y tiene que buscar el juego; apuntando a la página del juego entra
     directo, y además la vista previa del link en WhatsApp o Facebook muestra
     el título y la imagen de esa página en vez de los de la home. */
  var URL_JUEGO = {
    palabra: SITE_URL,   // p. ej. 'https://mansodiario.com/juegos/palabra-del-dia/'
    agrupa:  SITE_URL,   // p. ej. 'https://mansodiario.com/juegos/agrupa/'
    trivia:  SITE_URL    // p. ej. 'https://mansodiario.com/juegos/trivia-cuyana/'
  };

  function urlDe(juego) { return URL_JUEGO[juego] || SITE_URL; }
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
  /* texto = encabezado + grilla de emojis (sin revelar la respuesta). Se le agrega el link al juego. */
  function compartir(texto, juego) {
    var completo = texto + '\n' + urlDe(juego);
    if (navigator.share) {
      /* En celular esto abre el menú del sistema, que ya trae WhatsApp, mail y
         todo lo que el lector tenga instalado. */
      navigator.share({ text: completo }).catch(function (e) {
        if (!e || e.name !== 'AbortError') copiar(completo);
      });
    } else copiar(completo);
  }

  function copiar(completo) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(completo).then(
        function () { toast('¡Copiado! Pegalo donde quieras'); },
        function () { toast(copiarFallback(completo) ? '¡Copiado! Pegalo donde quieras' : 'No se pudo copiar'); });
    } else toast(copiarFallback(completo) ? '¡Copiado! Pegalo donde quieras' : 'No se pudo copiar');
  }

  /* ── Botones directos de compartir ────────────────────────────────────────
     El menú nativo solo existe en celular. En escritorio, sin estos botones,
     al lector le queda únicamente copiar y pegar a mano, que es donde se cae
     la mayoría. WhatsApp va primero porque es donde más se comparte acá. */

  var ICONOS = {
    whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
    telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    mail: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
    copiar: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z'
  };

  function icono(nombre) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' +
           ICONOS[nombre] + '"/></svg>';
  }

  /**
   * Dibuja el bloque de compartir dentro de `caja`.
   * @param {Element} caja   dónde se inserta
   * @param {string}  texto  encabezado + grilla de emojis, sin la respuesta
   * @param {string}  juego  'palabra' | 'agrupa' | 'trivia'
   */
  function pintarCompartir(caja, texto, juego) {
    var url = urlDe(juego);
    var completo = texto + '\n' + url;
    var t = encodeURIComponent(completo);
    var u = encodeURIComponent(url);
    var asunto = encodeURIComponent(texto.split('\n')[0]);

    var redes = [
      ['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + t],
      ['telegram', 'Telegram', 'https://t.me/share/url?url=' + u + '&text=' + encodeURIComponent(texto)],
      ['x', 'X', 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto) + '&url=' + u],
      /* Facebook solo levanta la URL: el texto que se le pase lo descarta. */
      ['facebook', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u],
      ['mail', 'Mail', 'mailto:?subject=' + asunto + '&body=' + t]
    ];

    var h = '';
    if (navigator.share) {
      h += '<div class="fg-actions"><button class="btn btn-primary" id="fg-share">Compartir resultado</button></div>';
    }
    h += '<div class="fg-share-row">';
    redes.forEach(function (r) {
      h += '<a class="fg-share-btn fg-share-' + r[0] + '" href="' + r[2] + '" target="_blank" ' +
           'rel="noopener noreferrer" aria-label="Compartir por ' + r[1] + '" title="' + r[1] + '">' +
           icono(r[0]) + '</a>';
    });
    h += '<button class="fg-share-btn fg-share-copiar" id="fg-copiar" aria-label="Copiar resultado" ' +
         'title="Copiar">' + icono('copiar') + '</button></div>';

    caja.innerHTML = h;
    var b = document.getElementById('fg-share');
    if (b) b.onclick = function () { compartir(texto, juego); };
    document.getElementById('fg-copiar').onclick = function () { copiar(completo); };
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
    iniciar: iniciar, cuentaRegresiva: cuentaRegresiva, compartir: compartir,
    pintarCompartir: pintarCompartir, urlDe: urlDe, URL_JUEGO: URL_JUEGO,
    toast: toast, esc: esc
  };
  global.calcularIndiceDelDia = calcularIndiceDelDia;
})(window);
