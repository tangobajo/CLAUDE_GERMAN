# -*- coding: utf-8 -*-
"""Prueba index, Palabra del Día y Agrupá en Chromium, sueltos y en iframe.

Antes de correr:  cd juegos-fuxia && python3 -m http.server 8777
Después:          python3 tests/test-juegos.py
"""
import os, sys, glob
from playwright.sync_api import sync_playwright

BASE = os.environ.get('FUXIA_BASE', 'http://localhost:8777')
DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('FUXIA_CHROME') or next(
    iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'), reverse=True)), None)
HOME = 'https://mansodiario.com'
IG = 'https://instagram.com/fuxiagames'
fallos = []

def chk(n, c, e=''):
    print(('OK   ' if c else 'FAIL ') + n + (('  ' + str(e)) if e and not c else ''))
    if not c: fallos.append(n)

def wrapper(archivo):
    """Simula la página de WordPress que embebe el juego."""
    with open(DIR + '/_wrap.html', 'w') as f:
        f.write('<!DOCTYPE html><meta charset="utf-8"><body style="margin:0"><h1>Nota</h1>'
                '<iframe id="j" src="/%s" width="100%%" height="900" style="border:0"></iframe>' % archivo)

try:
    with sync_playwright() as pw:
        nav = pw.chromium.launch(**({'executable_path': CHROME} if CHROME else {}))
        ctx = nav.new_context(viewport={'width': 390, 'height': 820},
                              permissions=['clipboard-read', 'clipboard-write'])
        # el contenedor no alcanza estos dominios: se interceptan
        ctx.route('**://mansodiario.com/**', lambda r: r.fulfill(
            status=200, content_type='text/html', body='<h1 id="portada">PORTADA</h1>'))
        ctx.route('**://instagram.com/**', lambda r: r.fulfill(
            status=200, content_type='text/html', body='<h1 id="ig">INSTAGRAM</h1>'))
        ctx.route('**://fonts.googleapis.com/**', lambda r: r.fulfill(
            status=200, content_type='text/css', body=''))
        ctx.route('**://fonts.gstatic.com/**', lambda r: r.abort())
        errores = []

        # ───────────────────────────── PORTADA ─────────────────────────────
        p = ctx.new_page(); p.on('pageerror', lambda e: errores.append('index: ' + str(e)))
        p.goto(BASE + '/index.html'); p.wait_for_selector('.card'); p.wait_for_timeout(700)
        chk('index: 3 tarjetas', p.locator('.card').count() == 3)
        hoy = p.locator('#hoy').inner_text()
        chk('index: el ticker carga el dia', 'desafío #' in hoy or 'Arrancamos' in hoy, hoy)
        chk('index: el logo de Fuxia carga', p.evaluate(
            "() => { const i=document.querySelector('.foot img'); return i.complete && i.naturalWidth>0; }"))
        marca = p.locator('.fg-brand')
        chk('index: la marca va al diario', marca.get_attribute('href') == HOME, marca.get_attribute('href'))
        chk('index: la marca sale del iframe', marca.get_attribute('target') == '_top')
        igs = p.locator('.foot a[href*="instagram"]')
        chk('index: 2 links a Instagram (texto y logo)', igs.count() == 2, igs.count())
        chk('index: Instagram apunta a fuxiagames',
            all(igs.nth(i).get_attribute('href') == IG for i in range(igs.count())))
        chk('index: Instagram en pestana nueva',
            all(igs.nth(i).get_attribute('target') == '_blank' for i in range(igs.count())))
        chk('index: Instagram con noopener noreferrer', all(
            'noopener' in (igs.nth(i).get_attribute('rel') or '') and
            'noreferrer' in (igs.nth(i).get_attribute('rel') or '') for i in range(igs.count())))
        chk('index: el texto dice FUXIA GAMES', 'FUXIA GAMES' in igs.nth(1).inner_text())
        chk('index: sin scroll horizontal',
            p.evaluate('() => document.documentElement.scrollWidth <= window.innerWidth + 1'))

        # ──────────────────────── PALABRA DEL DIA ────────────────────────
        p2 = ctx.new_page(); p2.on('pageerror', lambda e: errores.append('palabra: ' + str(e)))
        p2.goto(BASE + '/palabra-del-dia.html'); p2.wait_for_selector('.tile'); p2.wait_for_timeout(500)
        chk('palabra: 30 celdas', p2.locator('.tile').count() == 30)
        resp = p2.evaluate("""async () => { const d = await (await fetch('data/palabras.json')).json();
            return d.palabras[FG.calcularIndiceDelDia(d.dia1, d.palabras.length)].palabra; }""")
        chk('palabra: la de hoy tiene 5 letras', len(resp) == 5, resp)
        for ch in 'PARRA':
            p2.click('.key[data-k="%s"]' % ch)
        p2.click('.key[data-k="*"]'); p2.wait_for_timeout(800)
        chk('palabra: 1er intento pintado',
            p2.locator('.tile.ok, .tile.near, .tile.miss').count() == 5)
        for ch in resp:
            p2.click('.key[data-k="%s"]' % ch)
        p2.click('.key[data-k="*"]'); p2.wait_for_timeout(1500)
        chk('palabra: 5 verdes al acertar', p2.locator('.tile.ok').count() >= 5)
        chk('palabra: panel de resultado', p2.locator('.fg-result').is_visible())
        chk('palabra: cuenta regresiva corriendo', ':' in p2.locator('#cuenta').inner_text())
        racha = p2.evaluate("() => localStorage.getItem('fuxiagames_palabra_racha')")
        chk('palabra: racha = 1', racha == '1', racha)
        p2.click('#share'); p2.wait_for_timeout(500)
        txt = p2.evaluate('() => navigator.clipboard.readText()')
        chk('palabra: comparte marca y link', 'FUXIA GAMES' in txt and 'mansodiario.com' in txt, txt)
        chk('palabra: NO revela la palabra', resp not in txt.upper(), txt)
        p2.reload(); p2.wait_for_selector('.fg-result'); p2.wait_for_timeout(400)
        chk('palabra: al recargar muestra el resultado', p2.locator('.fg-result').is_visible())
        chk('palabra: teclado deshabilitado', 'off' in (p2.locator('#kb').get_attribute('class') or ''))

        # ──────────────────────────── AGRUPA ────────────────────────────
        p3 = ctx.new_page(); p3.on('pageerror', lambda e: errores.append('agrupa: ' + str(e)))
        p3.goto(BASE + '/agrupa.html'); p3.wait_for_selector('.item'); p3.wait_for_timeout(500)
        chk('agrupa: 16 fichas', p3.locator('.item').count() == 16)
        chk('agrupa: 4 vidas', p3.locator('.vida').count() == 4)
        orden1 = p3.locator('.item').all_inner_texts()
        p3.reload(); p3.wait_for_selector('.item'); p3.wait_for_timeout(300)
        chk('agrupa: el orden no cambia al recargar', p3.locator('.item').all_inner_texts() == orden1)
        for vuelta in range(4):
            ids = p3.evaluate("""async () => {
                const d = await (await fetch('data/categorias.json')).json();
                const i = FG.calcularIndiceDelDia(d.dia1, d.dias.length);
                const vis = [...document.querySelectorAll('.item')];
                for (const g of d.dias[i].grupos) {
                  const us = new Set(), u = [];
                  for (const w of g.items) {
                    const c = vis.find(b => b.textContent === w && !us.has(b.dataset.id));
                    if (c) { us.add(c.dataset.id); u.push(c.dataset.id); } }
                  if (u.length === 4) return u; }
                return null; }""")
            if not ids:
                chk('agrupa: hallar grupo vuelta %d' % (vuelta + 1), False); break
            for i in ids:
                p3.click('.item[data-id="%s"]' % i)
            p3.click('#bEnviar'); p3.wait_for_timeout(500)
        p3.wait_for_selector('.fg-result')
        chk('agrupa: 4 grupos resueltos', p3.locator('.grupo').count() == 4)
        chk('agrupa: sin errores gastados', p3.locator('.vida.off').count() == 0)
        cats = p3.locator('.grupo b').all_inner_texts()
        p3.click('#share'); p3.wait_for_timeout(500)
        t3 = p3.evaluate('() => navigator.clipboard.readText()')
        chk('agrupa: comparte marca y link', 'FUXIA GAMES' in t3 and 'mansodiario.com' in t3, t3)
        chk('agrupa: NO revela las categorias',
            not any(c.strip().upper() in t3.upper() for c in cats), t3)

        # ──────────────── los links, embebidos en una nota ────────────────
        wrapper('agrupa.html')
        p4 = ctx.new_page(); p4.goto(BASE + '/_wrap.html'); p4.wait_for_timeout(900)
        p4.frame_locator('#j').locator('.fg-brand').click(); p4.wait_for_timeout(800)
        chk('iframe: el logo navega la ventana entera', p4.locator('#portada').count() == 1, p4.url)
        chk('iframe: el iframe ya no existe', p4.locator('#j').count() == 0)

        wrapper('index.html')
        p5 = ctx.new_page(); p5.goto(BASE + '/_wrap.html'); p5.wait_for_timeout(1100)
        antes = len(ctx.pages)
        with ctx.expect_page() as nueva:
            p5.frame_locator('#j').locator('.foot a[href*="instagram"]').nth(1).click()
        tab = nueva.value; tab.wait_for_load_state()
        chk('iframe: Instagram abre pestana nueva', len(ctx.pages) == antes + 1)
        chk('iframe: la pestana es Instagram', 'instagram.com' in tab.url, tab.url)
        chk('iframe: el juego sigue en la pestana original', p5.locator('#j').count() == 1)
        tab.close()

        chk('sin errores de JS', not errores, errores)
        nav.close()
finally:
    if os.path.exists(DIR + '/_wrap.html'):
        os.remove(DIR + '/_wrap.html')

print()
if fallos:
    print('%d FALLOS: %s' % (len(fallos), '; '.join(fallos))); sys.exit(1)
print('Todos los tests de navegador pasaron')
