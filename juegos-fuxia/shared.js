/* ==========================================================================
   Fuxia Games para Manso Diario — lógica común a los 3 juegos
   Sin dependencias, sin backend, sin librerías. Todo el estado vive en
   el localStorage del navegador del lector.
   ========================================================================== */
(function (global) {
  'use strict';

  /* San Juan no aplica horario de verano, así que el huso es UTC-3 fijo
     todo el año. Trabajamos con ese corrimiento en vez de depender de la
     zona horaria del dispositivo, que puede estar en cualquier lado. */
  var OFFSET_ARG_MIN = -180;
  var MS_POR_DIA = 86400000;
  var URL_MANSO = 'https://mansodiario.com';

  /* ---------------------------------------------------------------- fechas */

  /** Fecha civil de San Juan para un instante dado, como {anio, mes, dia}. */
  function fechaCivilArgentina(instante) {
    var t = (instante instanceof Date ? instante : new Date()).getTime();
    var d = new Date(t + OFFSET_ARG_MIN * 60000);
    return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }

  /** "YYYY-MM-DD" de hoy en San Juan. Es la clave con la que comparamos días. */
  function hoyArgentina(instante) {
    var f = fechaCivilArgentina(instante);
    return f.anio + '-' + dosDigitos(f.mes) + '-' + dosDigitos(f.dia);
  }

  function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }

  /** "YYYY-MM-DD" -> número de día absoluto, sin que influya el huso local. */
  function aDiaAbsoluto(iso) {
    var p = String(iso).slice(0, 10).split('-');
    var ms = Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    if (isNaN(ms)) throw new Error('Fecha inválida: ' + iso);
    return Math.floor(ms / MS_POR_DIA);
  }

  /**
   * Índice (base 0) del contenido que toca hoy.
   *
   * @param {string} fechaLanzamiento  "YYYY-MM-DD" del día 1 del banco.
   * @param {number} largoDelBanco     cuántos días trae el JSON.
   * @param {Date}   [instante]        para tests; por defecto, ahora.
   * @returns {number} 0 .. largoDelBanco-1
   *
   * El corte es a las 00:00 de San Juan, no a las 00:00 UTC: a las 22:00 de
   * San Juan ya son las 01:00 UTC del día siguiente, y sin este ajuste el
   * juego cambiaría de palabra dos horas antes de la medianoche local.
   *
   * Antes del día 1 devuelve 0, así el contenido se puede probar desde ya.
   */
  function calcularIndiceDelDia(fechaLanzamiento, largoDelBanco, instante) {
    var largo = Math.floor(largoDelBanco);
    if (!(largo > 0)) throw new Error('largoDelBanco debe ser mayor que 0');
    var transcurridos = aDiaAbsoluto(hoyArgentina(instante)) - aDiaAbsoluto(fechaLanzamiento);
    if (transcurridos < 0) return 0;
    return transcurridos % largo;
  }

  /** Número de día del ciclo tal como lo ve el lector (1..largo). */
  function numeroDeDia(fechaLanzamiento, largoDelBanco, instante) {
    return calcularIndiceDelDia(fechaLanzamiento, largoDelBanco, instante) + 1;
  }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** "1 de octubre de 2026" a partir de la fecha civil de San Juan. */
  function fechaLegible(instante) {
    var f = fechaCivilArgentina(instante);
    return f.dia + ' de ' + MESES[f.mes - 1] + ' de ' + f.anio;
  }

  /** Cuánto falta para la medianoche de San Juan, como "3 h 20 min". */
  function faltaParaElProximo(instante) {
    var ahora = (instante instanceof Date ? instante : new Date()).getTime();
    var corrido = ahora + OFFSET_ARG_MIN * 60000;
    var restanteMs = MS_POR_DIA - (((corrido % MS_POR_DIA) + MS_POR_DIA) % MS_POR_DIA);
    var horas = Math.floor(restanteMs / 3600000);
    var minutos = Math.floor((restanteMs % 3600000) / 60000);
    return horas > 0 ? horas + ' h ' + minutos + ' min' : minutos + ' min';
  }

  /* ----------------------------------------------------------- persistencia */

  /* Todo va con el prefijo fuxiagames_[juego]_ para no pisar nada que el sitio
     que embebe el iframe pueda estar guardando en su propio origen. */
  function clave(juego, sufijo) { return 'fuxiagames_' + juego + '_' + sufijo; }

  /* El acceso a localStorage tira excepción en modo privado de algunos
     navegadores y cuando el sitio bloquea cookies de terceros en iframes.
     En ese caso el juego sigue andando, pero sin recordar nada. */
  function leer(k, porDefecto) {
    try {
      var crudo = global.localStorage.getItem(k);
      return crudo === null ? porDefecto : JSON.parse(crudo);
    } catch (e) {
      return porDefecto;
    }
  }

  function escribir(k, valor) {
    try {
      global.localStorage.setItem(k, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function hayAlmacenamiento() {
    try {
      var k = '__fuxiagames_test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Estado guardado del juego de hoy.
   * @returns {{jugadoHoy: boolean, estado: object|null, racha: number,
   *            ultimoDiaJugado: string|null, maxRacha: number, jugados: number}}
   */
  function cargarEstado(juego, instante) {
    var hoy = hoyArgentina(instante);
    var guardado = leer(clave(juego, 'estado'), null);
    var racha = leer(clave(juego, 'racha'), null) || {};
    return {
      jugadoHoy: !!(guardado && guardado.fecha === hoy),
      estado: guardado && guardado.fecha === hoy ? guardado : null,
      racha: racha.actual || 0,
      maxRacha: racha.maxima || 0,
      jugados: racha.jugados || 0,
      ultimoDiaJugado: racha.ultimoDiaJugado || null
    };
  }

  /** Guarda la partida en curso o terminada del día de hoy. */
  function guardarEstado(juego, datos, instante) {
    var payload = {};
    for (var k in datos) if (Object.prototype.hasOwnProperty.call(datos, k)) payload[k] = datos[k];
    payload.fecha = hoyArgentina(instante);
    return escribir(clave(juego, 'estado'), payload);
  }

  /**
   * Cierra el día: actualiza racha, último día jugado y total de partidas.
   * Es idempotente — llamarla dos veces el mismo día no infla la racha.
   */
  function registrarPartida(juego, gano, instante) {
    var hoy = hoyArgentina(instante);
    var racha = leer(clave(juego, 'racha'), null) || {};
    if (racha.ultimoDiaJugado === hoy) return racha;

    var ayer = aDiaAbsoluto(hoy) - 1;
    var seguido = racha.ultimoDiaJugado && aDiaAbsoluto(racha.ultimoDiaJugado) === ayer;
    /* La racha cuenta días ganados seguidos: perder la corta, igual que en Wordle. */
    var actual = gano ? (seguido ? (racha.actual || 0) + 1 : 1) : 0;

    racha = {
      actual: actual,
      maxima: Math.max(racha.maxima || 0, actual),
      jugados: (racha.jugados || 0) + 1,
      ganados: (racha.ganados || 0) + (gano ? 1 : 0),
      ultimoDiaJugado: hoy
    };
    escribir(clave(juego, 'racha'), racha);
    return racha;
  }

  /* -------------------------------------------------------------- compartir */

  /**
   * Comparte el resultado sin revelar nunca la respuesta: solo la grilla de
   * emojis, el número de día y el link de vuelta a Manso Diario.
   * Web Share API donde exista; si no, copia al portapapeles.
   */
  function compartirResultado(texto, alTerminar) {
    var aviso = function (m) { if (typeof alTerminar === 'function') alTerminar(m); };

    if (global.navigator && typeof global.navigator.share === 'function') {
      global.navigator.share({ text: texto })
        .then(function () { aviso('¡Compartido!'); })
        .catch(function (e) {
          /* El lector canceló el diálogo: no es un error que valga avisar. */
          if (e && e.name === 'AbortError') return;
          copiarAlPortapapeles(texto, aviso);
        });
      return;
    }
    copiarAlPortapapeles(texto, aviso);
  }

  function copiarAlPortapapeles(texto, aviso) {
    if (global.navigator && global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(texto)
        .then(function () { aviso('Resultado copiado'); })
        .catch(function () { copiarALaAntigua(texto, aviso); });
      return;
    }
    copiarALaAntigua(texto, aviso);
  }

  /* execCommand está obsoleto pero es lo único que anda en iframes sin
     permiso de clipboard y en navegadores viejos de Android. */
  function copiarALaAntigua(texto, aviso) {
    try {
      var ta = global.document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      global.document.body.appendChild(ta);
      ta.select();
      var ok = global.document.execCommand('copy');
      global.document.body.removeChild(ta);
      aviso(ok ? 'Resultado copiado' : 'No se pudo copiar');
    } catch (e) {
      aviso('No se pudo copiar');
    }
  }

  /** Arma el texto que se comparte. `grilla` es un array de filas de emojis. */
  function armarTextoCompartir(titulo, dia, marcador, grilla) {
    var lineas = ['Fuxia Games · ' + titulo + ' #' + dia];
    if (marcador) lineas[0] += ' — ' + marcador;
    lineas.push('');
    lineas = lineas.concat(grilla);
    lineas.push('');
    lineas.push('Jugá en ' + URL_MANSO);
    return lineas.join('\n');
  }

  /* ------------------------------------------------------------- utilidades */

  /** Carga un JSON del mismo directorio. No sale a internet. */
  function cargarDatos(archivo) {
    return fetch(archivo, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo leer ' + archivo + ' (HTTP ' + r.status + ')');
      return r.json();
    });
  }

  /** Busca el día del banco por índice, con el objeto {dia, ...} ya resuelto. */
  function diaDelBanco(datos) {
    var i = calcularIndiceDelDia(datos.fecha_dia_1, datos.dias.length);
    return { indice: i, numero: i + 1, contenido: datos.dias[i] };
  }

  /** Quita tildes y diéresis para comparar lo que tipea el lector. */
  function normalizar(texto) {
    return String(texto).toUpperCase()
      .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
      .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U');
  }

  /**
   * Baraja determinística: el mismo día muestra siempre el mismo orden, así
   * que recargar la página no reordena la grilla ni da ventaja.
   */
  function barajarConSemilla(array, semilla) {
    var copia = array.slice();
    var s = semilla >>> 0 || 1;
    for (var i = copia.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;   /* LCG de Numerical Recipes */
      var j = s % (i + 1);
      var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
    }
    return copia;
  }

  /** Toast breve, compartido por los 3 juegos. */
  function toast(mensaje, ms) {
    var el = global.document.getElementById('fx-toast');
    if (!el) return;
    el.textContent = mensaje;
    el.classList.add('visible');
    global.clearTimeout(toast._t);
    toast._t = global.setTimeout(function () { el.classList.remove('visible'); }, ms || 1900);
  }

  /** Pinta el logo, el nombre del juego y la fecha en la cabecera. */
  function pintarCabecera(nombreJuego) {
    var fecha = global.document.getElementById('fx-fecha');
    if (fecha) fecha.textContent = fechaLegible();
    var juego = global.document.getElementById('fx-nombre-juego');
    if (juego && nombreJuego) juego.textContent = nombreJuego;
  }

  global.FuxiaGames = {
    /* fechas */
    calcularIndiceDelDia: calcularIndiceDelDia,
    numeroDeDia: numeroDeDia,
    hoyArgentina: hoyArgentina,
    fechaLegible: fechaLegible,
    faltaParaElProximo: faltaParaElProximo,
    /* persistencia */
    clave: clave,
    cargarEstado: cargarEstado,
    guardarEstado: guardarEstado,
    registrarPartida: registrarPartida,
    hayAlmacenamiento: hayAlmacenamiento,
    /* compartir */
    compartirResultado: compartirResultado,
    armarTextoCompartir: armarTextoCompartir,
    URL_MANSO: URL_MANSO,
    /* utilidades */
    cargarDatos: cargarDatos,
    diaDelBanco: diaDelBanco,
    normalizar: normalizar,
    barajarConSemilla: barajarConSemilla,
    toast: toast,
    pintarCabecera: pintarCabecera
  };
})(window);
