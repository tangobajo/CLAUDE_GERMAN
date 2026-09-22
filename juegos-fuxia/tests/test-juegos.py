# -*- coding: utf-8 -*-
"""Prueba los 3 juegos en Chromium, servidos por HTTP e incrustados en iframe
del MISMO origen (que es como se despliegan en mansodiario.com).

Antes de correrlo, servir la carpeta:
    cd juegos-fuxia && python3 -m http.server 8777
Y despues:
    python3 tests/test-juegos.py
"""
import json, sys, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('FUXIA_BASE', 'http://localhost:8777')
def _chromium():
    """Usa el Chromium que indique FUXIA_CHROME; si no, el que trae Playwright."""
    ruta = os.environ.get('FUXIA_CHROME')
    if ruta:
        return ruta
    import glob
    for c in sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'), reverse=True):
        return c
    return None

CHROME = _chromium()
DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fallos = []

def chk(nombre, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + nombre + (('  ' + str(extra)) if extra and not cond else ''))
    if not cond:
        fallos.append(nombre)

# wrapper temporal para probar el embebido same-origin
with open(DIR + '/_wrapper-test.html', 'w') as f:
    f.write('<!DOCTYPE html><meta charset="utf-8"><body style="margin:0">'
            '<iframe src="/trivia-cuyana.html" width="100%" height="760" style="border:0"></iframe>')

def compartir(pagina, boton_id):
    """Dispara el botón de compartir y devuelve lo que quedó en el portapapeles."""
    pagina.click('#' + boton_id)
    pagina.wait_for_timeout(300)
    return pagina.evaluate('() => navigator.clipboard.readText()')

try:
    with sync_playwright() as pw:
        nav = pw.chromium.launch(**({'executable_path': CHROME} if CHROME else {}))
        ctx = nav.new_context(viewport={'width': 390, 'height': 780},
                              permissions=['clipboard-read', 'clipboard-write'])
        errores = []

        # -------------------------------------------------------- PALABRA
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errores.append('palabra: ' + str(e)))
        pg.goto(BASE + '/palabra-del-dia.html')
        pg.wait_for_selector('#pd-tablero .pd-celda')
        chk('palabra: 30 celdas (6x5)', pg.locator('.pd-celda').count() == 30)
        chk('palabra: teclado con Ñ', pg.locator('.pd-tecla[data-tecla="Ñ"]').count() == 1)
        chk('palabra: pista visible', len(pg.locator('#pd-texto-pista').inner_text().strip()) > 10)

        secreta = pg.evaluate("""() => fetch('data/palabras.json').then(r=>r.json()).then(d=>{
            const i = FuxiaGames.calcularIndiceDelDia(d.fecha_dia_1, d.dias.length);
            return d.dias[i].palabra; })""")
        chk('palabra: la de hoy tiene 5 letras', len(secreta) == 5, secreta)

        for ch in 'PARRA':
            pg.click('.pd-tecla[data-tecla="%s"]' % ch)
        pg.click('.pd-tecla[data-tecla="ENTER"]')
        pg.wait_for_timeout(150)
        chk('palabra: 1er intento pintado', pg.locator('.pd-celda[data-estado]').count() == 5)
        chk('palabra: teclado se colorea', pg.locator('.pd-tecla[data-estado]').count() > 0)

        for ch in secreta:
            pg.click('.pd-tecla[data-tecla="%s"]' % ch)
        pg.click('.pd-tecla[data-tecla="ENTER"]')
        pg.wait_for_selector('.fx-resultado')
        chk('palabra: 5 verdes al acertar', pg.locator('.pd-celda[data-estado="correcta"]').count() >= 5)
        racha = json.loads(pg.evaluate("() => localStorage.getItem('fuxiagames_palabra_racha')"))
        chk('palabra: racha = 1', racha['actual'] == 1, racha)
        chk('palabra: guarda ultimoDiaJugado',
            racha['ultimoDiaJugado'] == pg.evaluate('() => FuxiaGames.hoyArgentina()'))
        chk('palabra: clave con prefijo fuxiagames_palabra_',
            pg.evaluate("""() => Object.keys(localStorage).filter(k=>k.startsWith('fuxiagames_palabra_')).sort().join(',')""")
            == 'fuxiagames_palabra_estado,fuxiagames_palabra_racha')

        txt = compartir(pg, 'pd-compartir')
        chk('palabra: comparte con marca y link', 'Fuxia Games' in txt and 'mansodiario.com' in txt, txt)
        chk('palabra: NO revela la palabra', secreta not in txt.upper(), txt)
        chk('palabra: grilla de emojis', '\U0001F7E9' in txt, txt)
        chk('palabra: comparte el N° de dia', '#' in txt, txt)

        pg.reload(); pg.wait_for_selector('.fx-resultado')
        chk('palabra: al recargar muestra el resultado de hoy',
            'Ya jugaste hoy' in pg.locator('.fx-proximo').inner_text())
        chk('palabra: ya no deja jugar', pg.evaluate("""() => {
            const antes = document.querySelectorAll('.pd-celda[data-lleno]').length;
            document.querySelector('.pd-tecla[data-tecla="A"]').click();
            return document.querySelectorAll('.pd-celda[data-lleno]').length === antes; }"""))

        # -------------------------------------------------------- AGRUPA
        pg2 = ctx.new_page()
        pg2.on('pageerror', lambda e: errores.append('agrupa: ' + str(e)))
        pg2.goto(BASE + '/agrupa.html')
        pg2.wait_for_selector('.ag-ficha')
        chk('agrupa: 16 fichas', pg2.locator('.ag-ficha').count() == 16)
        chk('agrupa: 4 errores disponibles', pg2.locator('.ag-vida').count() == 4)
        chk('agrupa: enviar arranca deshabilitado', pg2.locator('#ag-enviar').is_disabled())

        orden1 = pg2.locator('.ag-ficha').all_inner_texts()
        pg2.reload(); pg2.wait_for_selector('.ag-ficha')
        chk('agrupa: el orden no cambia al recargar',
            pg2.locator('.ag-ficha').all_inner_texts() == orden1)

        # un error a propósito: 4 fichas de grupos distintos
        mezcla = pg2.evaluate("""async () => {
            const d = await (await fetch('data/categorias.json')).json();
            const i = FuxiaGames.calcularIndiceDelDia(d.fecha_dia_1, d.dias.length);
            const vis = [...document.querySelectorAll('.ag-ficha')];
            return d.dias[i].grupos.map(g => vis.find(b => b.textContent === g.items[0]).id); }""")
        for i in mezcla:
            pg2.click('#' + i)
        pg2.click('#ag-enviar'); pg2.wait_for_timeout(250)
        chk('agrupa: el error gasta una vida', pg2.locator('.ag-vida[data-gastada]').count() == 1)
        chk('agrupa: tras el error la seleccion queda puesta (como el original)',
            pg2.locator('.ag-ficha[aria-pressed="true"]').count() == 4)
        pg2.click('#ag-enviar'); pg2.wait_for_timeout(250)
        chk('agrupa: reenviar lo mismo NO gasta otra vida',
            pg2.locator('.ag-vida[data-gastada]').count() == 1)
        pg2.click('#ag-limpiar'); pg2.wait_for_timeout(100)
        chk('agrupa: "Borrar seleccion" limpia', pg2.locator('.ag-ficha[aria-pressed="true"]').count() == 0)

        for vuelta in range(4):
            objetivo = pg2.evaluate("""async () => {
                const d = await (await fetch('data/categorias.json')).json();
                const i = FuxiaGames.calcularIndiceDelDia(d.fecha_dia_1, d.dias.length);
                const vis = [...document.querySelectorAll('.ag-ficha')].map(b=>({id:b.id,t:b.textContent}));
                for (const g of d.dias[i].grupos) {
                  const usados = new Set(); const u = [];
                  for (const it of g.items) {
                    const c = vis.find(v => v.t === it && !usados.has(v.id));
                    if (c) { usados.add(c.id); u.push(c.id); } }
                  if (u.length === 4) return u; }
                return null; }""")
            if not objetivo:
                chk('agrupa: hallar grupo (vuelta %d)' % (vuelta+1), False); break
            pg2.click('#ag-limpiar')
            for i in objetivo:
                pg2.click('#' + i)
            pg2.click('#ag-enviar'); pg2.wait_for_timeout(250)

        pg2.wait_for_selector('.fx-resultado')
        chk('agrupa: 4 grupos revelados', pg2.locator('.ag-resuelto').count() == 4)
        chk('agrupa: quedo 1 error gastado', pg2.locator('.ag-vida[data-gastada]').count() == 1)
        chk('agrupa: muestra las 4 categorias',
            all(len(t.strip()) > 3 for t in pg2.locator('.ag-resuelto__cat').all_inner_texts()))
        chk('agrupa: los 4 colores de dificultad',
            sorted(pg2.locator('.ag-resuelto').evaluate_all(
                "els => els.map(e => e.dataset.dif)")) == ['amarillo','azul','morado','verde'])

        cats = pg2.locator('.ag-resuelto__cat').all_inner_texts()
        t2 = compartir(pg2, 'ag-compartir')
        chk('agrupa: comparte con marca y link', 'Agrupá' in t2 and 'mansodiario.com' in t2, t2)
        chk('agrupa: NO revela las categorias',
            not any(c.strip().upper() in t2.upper() for c in cats), t2)
        chk('agrupa: grilla de 4 colores',
            all(e in t2 for e in ['\U0001F7E8','\U0001F7E9','\U0001F7E6','\U0001F7EA']), t2)
        r2 = json.loads(pg2.evaluate("() => localStorage.getItem('fuxiagames_agrupa_racha')"))
        chk('agrupa: racha = 1', r2['actual'] == 1, r2)
        pg2.reload(); pg2.wait_for_selector('.fx-resultado')
        chk('agrupa: al recargar muestra el resultado de hoy',
            'Ya jugaste hoy' in pg2.locator('.fx-proximo').inner_text())

        # -------------------------------------------------------- TRIVIA (iframe same-origin)
        pg3 = ctx.new_page()
        pg3.on('pageerror', lambda e: errores.append('trivia: ' + str(e)))
        pg3.goto(BASE + '/_wrapper-test.html')
        fr = pg3.frame_locator('iframe')
        fr.locator('.tr-opcion').first.wait_for()
        chk('trivia: 4 opciones', fr.locator('.tr-opcion').count() == 4)
        chk('trivia: 5 puntos de progreso', fr.locator('.tr-punto').count() == 5)
        chk('trivia: NO filtra "verificar" al lector',
            'verificar' not in fr.locator('body').inner_text().lower())

        for q in range(5):
            fr.locator('.tr-opcion').first.wait_for()
            fr.locator('.tr-opcion').nth(0).click()
            pg3.wait_for_timeout(150)
            if q == 0:
                chk('trivia: marca la correcta', fr.locator('.tr-opcion[data-r="bien"]').count() == 1)
                chk('trivia: muestra veredicto', fr.locator('.tr-veredicto').is_visible())
                chk('trivia: sin "Leer la nota" (banco sin links cargados)',
                    fr.locator('a:has-text("Leer la nota")').count() == 0)
            fr.locator('.tr-devolucion button.fx-btn').click()
            pg3.wait_for_timeout(150)

        fr.locator('.fx-resultado').wait_for()
        chk('trivia: resultado dentro del iframe', fr.locator('.fx-resultado h2').is_visible())
        chk('trivia: marcador sobre 5', 'de 5' in fr.locator('.fx-resultado').inner_text())
        chk('trivia: NO filtra "verificar" en el resultado',
            'verificar' not in fr.locator('body').inner_text().lower())
        chk('trivia: estado visible desde el padre same-origin',
            bool(pg3.evaluate("() => localStorage.getItem('fuxiagames_trivia_estado')")))
        t3 = pg3.evaluate("""async () => { const f=document.querySelector('iframe').contentWindow;
            f.document.getElementById('tr-compartir').click();
            await new Promise(r=>setTimeout(r,300)); return navigator.clipboard.readText(); }""")
        preg = fr.locator('body').inner_text()
        chk('trivia: comparte con marca y link', 'Trivia Cuyana' in t3 and 'mansodiario.com' in t3, t3)
        chk('trivia: NO revela preguntas ni respuestas',
            all(len(l) < 60 for l in t3.split('\n')), t3)

        pg3.reload()
        fr = pg3.frame_locator('iframe')
        fr.locator('.fx-resultado').wait_for()
        chk('trivia: al recargar muestra el resultado de hoy',
            'Ya jugaste hoy' in fr.locator('.fx-proximo').inner_text())

        # -------------------------------------------------------- PORTADA
        pg4 = ctx.new_page()
        pg4.on('pageerror', lambda e: errores.append('index: ' + str(e)))
        pg4.goto(BASE + '/index.html')
        pg4.wait_for_selector('.fx-tarjeta')
        chk('index: 3 tarjetas', pg4.locator('.fx-tarjeta').count() == 3)
        chk('index: 3 chips "Jugado hoy"', pg4.locator('.fx-chip--jugado').count() == 3,
            pg4.locator('.fx-grilla-juegos').inner_text())
        chk('index: 3 botones "Ver resultado"',
            pg4.locator('[data-accion]:has-text("Ver resultado")').count() == 3)
        chk('index: muestra la racha', 'Racha' in pg4.locator('.fx-grilla-juegos').inner_text())
        chk('index: el logo carga',
            pg4.evaluate("() => { const i=document.querySelector('.fx-header__logo'); return i.complete && i.naturalWidth>0; }"))
        chk('index: sin scroll horizontal en mobile',
            pg4.evaluate('() => document.documentElement.scrollWidth <= window.innerWidth + 1'))

        # -------------------------------------------------------- sin red externa
        externas = []
        ctx5 = nav.new_context(viewport={'width': 1280, 'height': 900})
        ctx5.on('request', lambda r: externas.append(r.url) if 'localhost:8777' not in r.url and not r.url.startswith('data:') else None)
        pg5 = ctx5.new_page()
        for f in ['index.html', 'palabra-del-dia.html', 'agrupa.html', 'trivia-cuyana.html']:
            pg5.goto(BASE + '/' + f); pg5.wait_for_timeout(500)
        chk('ninguna pagina pide nada a internet', not externas, externas)
        chk('sin errores de JS en ninguna pagina', not errores, errores)
        nav.close()
finally:
    os.remove(DIR + '/_wrapper-test.html')

print()
if fallos:
    print('%d FALLOS: %s' % (len(fallos), ', '.join(fallos)))
    sys.exit(1)
print('Todos los tests de navegador pasaron')
