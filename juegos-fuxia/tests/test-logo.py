# -*- coding: utf-8 -*-
"""El logo tiene que llevar a la portada de Manso Diario y salir del iframe."""
import os, sys, glob
from playwright.sync_api import sync_playwright

BASE=os.environ.get('FUXIA_BASE','http://localhost:8777'); DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME=sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'), reverse=True)[0]
HOME='https://mansodiario.com/'
fallos=[]
def chk(n,c,e=''):
    print(('OK   ' if c else 'FAIL ')+n+(('  '+str(e)) if e and not c else ''))
    if not c: fallos.append(n)

def wrapper(archivo):
    """Simula la pagina de WordPress que embebe el juego en un iframe."""
    with open(DIR+'/_wrapper-logo.html','w') as f:
        f.write('<!DOCTYPE html><meta charset="utf-8"><title>Nota</title><body style="margin:0">'
                '<h1>Una nota cualquiera</h1>'
                '<iframe id="j" src="/%s" width="100%%" height="700" style="border:0"></iframe>' % archivo)

try:
    with sync_playwright() as pw:
        nav=pw.chromium.launch(executable_path=CHROME)
        ctx=nav.new_context(viewport={'width':390,'height':780})
        # mansodiario.com no se puede alcanzar desde el contenedor: lo interceptamos
        ctx.route('**://mansodiario.com/**', lambda r: r.fulfill(
            status=200, content_type='text/html', body='<h1 id="portada">PORTADA DE MANSO DIARIO</h1>'))

        for archivo in ['index.html','palabra-del-dia.html','agrupa.html','trivia-cuyana.html']:
            # --- 1. abierto directo
            p=ctx.new_page(); p.goto(BASE+'/'+archivo); p.wait_for_timeout(300)
            logo=p.locator('.fx-header__home')
            chk('%-21s el logo es un link' % archivo, logo.count()==1, logo.count())
            chk('%-21s apunta a la portada del diario' % archivo,
                logo.get_attribute('href')==HOME.rstrip('/'), logo.get_attribute('href'))
            chk('%-21s sale del iframe (target=_top)' % archivo,
                logo.get_attribute('target')=='_top', logo.get_attribute('target'))
            chk('%-21s tiene nombre accesible' % archivo,
                bool(logo.get_attribute('aria-label')), logo.get_attribute('aria-label'))
            pie=p.locator('.fx-footer a[href*="mansodiario"]')
            chk('%-21s el link del pie tambien sale del iframe' % archivo,
                pie.get_attribute('target')=='_top', pie.get_attribute('target'))
            p.click('.fx-header__home'); p.wait_for_timeout(500)
            chk('%-21s click directo -> portada' % archivo,
                p.locator('#portada').count()==1, p.url)
            p.close()

            # --- 2. embebido en iframe, que es como lo ve el lector
            wrapper(archivo)
            p=ctx.new_page(); p.goto(BASE+'/_wrapper-logo.html'); p.wait_for_timeout(400)
            fr=p.frame_locator('#j')
            fr.locator('.fx-header__home').click()
            p.wait_for_timeout(700)
            # la ventana ENTERA tiene que haber navegado, no solo el iframe
            chk('%-21s en iframe -> navega la ventana entera' % archivo,
                p.locator('#portada').count()==1, p.url)
            chk('%-21s el iframe ya no existe (no quedo adentro)' % archivo,
                p.locator('#j').count()==0, 'el iframe sigue ahi')
            p.close()

        # el "← Juegos" NO debe salir del iframe: es navegacion interna
        wrapper('agrupa.html')
        p=ctx.new_page(); p.goto(BASE+'/_wrapper-logo.html'); p.wait_for_timeout(400)
        chk('"← Juegos" no lleva target', p.frame_locator('#j').locator('.fx-volver').get_attribute('target') is None)
        p.frame_locator('#j').locator('.fx-volver').click(); p.wait_for_timeout(600)
        chk('"← Juegos" navega DENTRO del iframe',
            p.locator('#j').count()==1 and p.frame_locator('#j').locator('.fx-grilla-juegos').count()==1)
        nav.close()
finally:
    os.remove(DIR+'/_wrapper-logo.html')

print()
if fallos:
    print('%d FALLOS: %s' % (len(fallos), '; '.join(fallos))); sys.exit(1)
print('El logo vuelve a la portada de Manso Diario, desde las 4 paginas, dentro y fuera del iframe')
