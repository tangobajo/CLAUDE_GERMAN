# Fuxia Games · Juegos de Manso Diario

Tres juegos diarios que corren enteros en el navegador del lector: sin backend, sin base de
datos y sin cuentas. Se suben como archivos estáticos y se embeben en WordPress con un
`<iframe>`.

```
juegos-fuxia/
├── index.html              portada con las 3 tarjetas
├── palabra-del-dia.html    Wordle en español
├── agrupa.html             Connections
├── trivia-cuyana.html      5 preguntas por día
├── shared.css              estilos comunes
├── shared.js               FG.*: día, rachas, compartir
├── logo-fuxia-games.png
└── data/
    ├── palabras.json
    ├── categorias.json
    ├── trivia.json            el banco que usa el juego
    ├── trivia-original.json   el banco viejo de 40 preguntas, se conserva como fuente
    ├── banco-nuevo.py         las preguntas nuevas, para editar a mano
    └── armar-trivia.py        fusiona los dos y reparte los 30 días
```

---

## 1. Pendientes de contenido

### 1.1 Preguntas y datos marcados "Verificar"

| Archivo | A revisar |
|---|---|
| `palabras.json` | 6 palabras |
| `categorias.json` | 52 grupos, repartidos en 28 de los 30 días |
| `trivia.json` | 20 preguntas (8 del banco viejo + 12 nuevas) |

El campo `"verificar": true` **no se muestra nunca al lector**: es tu checklist. Cuando
confirmes un dato, poné `false` o borrá el campo.

Para listar lo que falta revisar:

```bash
cd juegos-fuxia
python3 - <<'PY'
import json
d = json.load(open('data/trivia.json'))
for dia in d['dias']:
    for q in dia['preguntas']:
        if q['verificar']:
            print('día %2d · %s · %s' % (dia['dia'], q['tema'], q['pregunta']))
PY
```

Las 12 nuevas marcadas son casi todas del tipo "el más grande / el que más ganó", donde el
dato puede quedar viejo o admitir discusión: cuántos Mundiales ganó Argentina, qué club
ganó más Libertadores, cuántos Nobel tiene el país, cuál es el desierto cálido más extenso,
el río más caudaloso, el idioma con más hablantes nativos, cuántos huesos tiene el cuerpo.

### 1.2 `OASIS` repetido en Agrupá (días 5, 17 y 29)

En esos tres días `OASIS` está en dos categorías a la vez: *Accidentes geográficos cuyanos*
y *Elementos del paisaje sanjuanino*. La grilla muestra dos fichas con el mismo texto.

El juego **no se rompe** —`agrupa.html` identifica las fichas por posición, no por texto, y
`comunes()` compara como multiconjunto, así que el puzzle se resuelve igual tomando
cualquiera de las dos— pero el lector ve dos fichas idénticas y no entiende por qué.
Conviene cambiar una de las dos.

### 1.3 Agrupá repite días dentro del mes

Solo 23 de los 30 días traen contenido distinto. Son idénticos entre sí: 5/17/29, 6/18/30,
7/19, 8/20 y 9/21. Palabra del Día sí tiene las 30 palabras únicas, y Trivia ahora también
(ver §2).

### 1.4 "Leer la nota" está apagado a propósito

`trivia-cuyana.html` tiene implementado un botón **"Leer la nota"**: al responder, si la
pregunta trae una URL en `link_nota`, aparece un botón que lleva a esa nota. Sirve para que
el juego empuje tráfico a los artículos, pero obliga a emparejar cada pregunta con una nota
a mano.

**Hoy está desactivado**: las 150 preguntas tienen `link_nota` en `null`, así que el botón
no se dibuja nunca. No hay nada que mantener. Si alguna vez lo querés usar, completás el
campo en `data/trivia.json` y aparece solo en esa pregunta:

```json
"link_nota": "https://mansodiario.com/2026/10/la-fiesta-nacional-del-sol/"
```

Tiene que empezar con `http://` o `https://`; cualquier otra cosa se descarta en silencio.

## 2. El banco de Trivia

### Cómo está armado

150 preguntas únicas en 30 días × 5, **sin que se repita ninguna en el ciclo**. Antes eran
40 únicas repartidas en 150 lugares: el lector veía las mismas 5 preguntas cada 8 días.

| Tema | Preguntas |
|---|---|
| `san-juan` | 40 |
| `argentina` | 28 |
| `deportes` | 28 |
| `espectaculos` | 27 |
| `ciencia` | 27 |

**La pregunta 1 de cada día es siempre de San Juan / Cuyo**, y las otras 4 rotan entre los
temas generales, así ningún día queda con cuatro preguntas del mismo palo. Quedan 6
preguntas en la clave `reserva` del JSON: no se publican, están ahí para no perderlas.

La letra de la respuesta correcta está repartida pareja (A 38, B 38, C 37, D 37). No es
cosmético: barajando cada pregunta por separado salía A 54 y B 24, y el que marcaba siempre
A acertaba el 36%.

### Cómo agregar preguntas

Editá `data/banco-nuevo.py` y agregá tuplas al final de la lista `NUEVAS`:

```python
("deportes", "¿Qué club ganó la Copa Libertadores 2024?",
 "Botafogo", ["Atlético Mineiro", "River Plate", "Peñarol"], True),
#  ^tema      ^pregunta
#             ^la correcta va SIEMPRE primera    ^los 3 distractores   ^verificar
```

Temas válidos: `argentina`, `deportes`, `espectaculos`, `ciencia`. Después:

```bash
python3 juegos-fuxia/data/armar-trivia.py
```

El script baraja las opciones, calcula la letra, reparte los días y te imprime un informe
con los totales por tema, la distribución de letras y cuántas quedaron para verificar.
**No escribas `trivia.json` a mano**: lo pisa el script en la próxima corrida.

Si querés más de 30 días, cambiá `DIAS` arriba de `armar-trivia.py` y cargá preguntas
suficientes: hacen falta `DIAS × 5` únicas, con `DIAS` de ellas locales.

---

## 3. Los otros dos bancos

### `data/palabras.json`

```json
{ "dia1": "2026-10-07",
  "palabras": [
    { "dia": 1, "palabra": "ZONDA", "mostrar": "ZONDA",
      "pista": "Viento cálido y seco típico de Cuyo…", "verificar": true } ] }
```

| Campo | Notas |
|---|---|
| `palabra` | **5 letras, mayúsculas, sin tildes ni Ñ.** Es contra esto que se compara lo que tipea el lector, y el teclado en pantalla no tiene tecla Ñ |
| `mostrar` | lo que se ve al revelar la respuesta; acá sí van tildes (`VIÑAS`, `FOGÓN`) |
| `pista` | se muestra en el panel de resultado, como "¿Sabías que?" |

### `data/categorias.json`

```json
{ "dia1": "2026-10-07",
  "dias": [ { "dia": 1, "grupos": [
    { "dificultad": "amarillo", "categoria": "Comidas típicas de Cuyo",
      "items": ["EMPANADA","LOCRO","HUMITA","ASADO"], "verificar": false } ] } ] }
```

Los 4 grupos van en orden `amarillo`, `verde`, `azul`, `morado` (convención de Connections:
amarillo el más fácil, morado el de la trampa). **Los 16 ítems del día tienen que ser
distintos entre sí** — ver §1.2.

---

## 4. Cómo se calcula el día

`shared.js` expone `FG.calcularIndiceDelDia(fechaLanzamiento, largoDelBanco)`:

- Usa la fecha civil de **San Juan**, restando 3 horas fijas del UTC. San Juan no aplica
  horario de verano, así que el desfase es constante.
- El contenido cambia a la **medianoche de San Juan**, no a la de UTC.
- No depende del reloj del dispositivo del lector.
- Devuelve **-1 si el juego todavía no arrancó**, y ahí los juegos muestran "¡Muy pronto!"
  con la fecha de inicio.
- Cuando se termina el banco vuelve a empezar (módulo).

### Cambiar la fecha de "día 1"

Está en el campo `dia1` de cada JSON, no en el código. Para reiniciar el ciclo, poné la
fecha de hoy en los tres archivos (formato `YYYY-MM-DD`). Hoy los tres están en
`2026-10-07`.

Cambiar `dia1` **no borra las rachas** que ya tenga guardadas el lector.

### Vista previa de otro día

`shared.js` acepta `?fecha=AAAA-MM-DD` en la URL para ver el juego de cualquier día sin
esperar. En ese modo no se guarda nada en el navegador:

```
https://mansodiario.com/juegos-fuxia/trivia-cuyana.html?fecha=2026-10-15
```

---

## 5. Qué se guarda en el navegador

Todo el estado vive en el `localStorage` del lector. No hay servidor ni cuentas. **Si cambia
de dispositivo o borra la caché, pierde la racha** — es una decisión consciente.

Tres claves por juego, con prefijo `fuxiagames_[juego]_`:

| Clave | Contenido |
|---|---|
| `fuxiagames_palabra_hoy` | la partida del día: intentos, si terminó, si ganó |
| `fuxiagames_palabra_racha` | días seguidos ganados |
| `fuxiagames_palabra_ultimoDia` | número de día de la última partida terminada |

Ídem con `agrupa` y `trivia`. Si el navegador bloquea el almacenamiento, `shared.js` cae a
una copia en memoria: el juego anda igual pero no recuerda nada al recargar.

---

## 6. Cómo se sube y se embebe

Copiá la carpeta `juegos-fuxia/` completa al servidor, **dentro del mismo dominio que Manso
Diario**:

```
mansodiario.com/juegos-fuxia/
```

### Tiene que ser el mismo dominio

Si los juegos se sirven desde otro dominio que el de la página de WordPress que los embebe,
Chrome y Safari **particionan el `localStorage` del iframe**: la racha se guarda en un
compartimento aparte, la portada no ve que el lector ya jugó, y en Safari con "Prevent
cross-site tracking" —prendido por defecto— el almacenamiento se borra a los 7 días. Un
subdominio (`juegos.mansodiario.com`) también cuenta como otro dominio.

### Se tiene que servir por HTTP

Los juegos leen su contenido con `fetch()`. Abrir el HTML con doble clic desde el escritorio
(`file://`) no funciona; `shared.js` ya muestra un mensaje explicándolo. Para probar local:

```bash
cd juegos-fuxia && python3 -m http.server 8777
```

### El iframe en WordPress

Una página de WordPress por juego, editor en **HTML personalizado**:

```html
<iframe src="https://mansodiario.com/juegos-fuxia/palabra-del-dia.html"
        title="Palabra del Día" width="100%" height="900"
        style="border:0;max-width:560px;margin:0 auto;display:block"
        loading="lazy"></iframe>
```

Altos sugeridos: portada 1000, Palabra 900, Agrupá 1000, Trivia 800. Si ves scroll interno,
subí el `height`.

`shared.js` además manda su alto real al padre por `postMessage` (`{tipo:
'fuxiagames-alto', alto, juego}`), así que si querés un iframe que se ajuste solo, en la
página de WordPress:

```html
<script>
window.addEventListener('message', function (e) {
  if (e.data && e.data.tipo === 'fuxiagames-alto') {
    var f = document.querySelector('iframe[src*="juegos-fuxia"]');
    if (f) f.style.height = (e.data.alto + 20) + 'px';
  }
});
</script>
```

**No le pongas `sandbox` al iframe** sin incluir `allow-top-navigation-by-user-activation`,
o el logo deja de poder volver a la portada.

Si usás plugin de caché, excluí `/juegos-fuxia/data/*.json` o ponele un TTL corto.

---

## 7. Compartir

Al terminar, cada juego muestra una fila de botones: **WhatsApp, Telegram, X, Facebook,
mail y copiar**. En celular, además, aparece arriba el botón grande "Compartir resultado",
que abre el menú del sistema con todo lo que el lector tenga instalado.

La fila de botones no es redundante: `navigator.share` **solo existe en celular**. En
escritorio, sin esos botones, al lector le queda únicamente copiar y pegar a mano, que es
donde se cae la mayoría. WhatsApp va primero porque es donde más se comparte acá.

Lo que se manda es el encabezado, la grilla de emojis y el link. **Nunca la respuesta**:
hay un test que revisa las URL de los seis botones una por una y falla si alguna filtra la
palabra del día o las categorías de Agrupá.

```
FUXIA GAMES · Palabra del Día #1 3/6
⬛🟨⬛⬛🟩
🟩🟨⬛🟩🟩
🟩🟩🟩🟩🟩
https://mansodiario.com
```

### Falta completar a dónde apunta el link

Arriba de `shared.js` está esto:

```js
var URL_JUEGO = {
  palabra: SITE_URL,   // p. ej. 'https://mansodiario.com/juegos/palabra-del-dia/'
  agrupa:  SITE_URL,
  trivia:  SITE_URL
};
```

Mientras queden en `SITE_URL`, el que recibe el mensaje **cae en la portada del diario** y
tiene que buscar el juego. Poniendo la URL de la página de WordPress de cada juego entra
directo, y además la vista previa del link en WhatsApp o Facebook muestra el título y la
imagen de esa página en vez de los de la home.

Para que esa vista previa quede bien, conviene que cada página de WordPress tenga su propia
imagen de portada y su descripción: eso se configura en WordPress (Yoast, Rank Math o el
plugin de SEO que uses), no acá.

Facebook es el único que **descarta el texto** y solo levanta la URL: comparte el link al
juego, no la grilla de emojis. Es una limitación de Facebook, no del código.

## 8. Cómo navega el lector

| Elemento | A dónde va | Sale del iframe |
|---|---|---|
| `MANSO!DIARIO` del encabezado | portada de **Manso Diario** | sí (`target="_top"`) |
| `← Juegos` del titlebar | portada de **juegos** | no |
| `FUXIA GAMES` del pie, y su logo | **instagram.com/fuxiagames** | pestaña nueva |
| `mansodiario.com` del pie | portada de **Manso Diario** | pestaña nueva |
| "Leer la nota" (cuando exista) | la nota del JSON | pestaña nueva |

El `target="_top"` del encabezado no es decorativo: sin eso, al tocar la marca Manso Diario
se cargaría entero adentro del recuadro embebido en la nota. Instagram y las notas abren en
pestaña nueva en vez de reemplazar la ventana, porque el lector suele estar en medio de una
partida.

Si cambia alguno de los dos dominios:

```bash
cd juegos-fuxia
grep -rn "mansodiario.com\|instagram.com" *.html shared.js
```

---

## 9. Tests

```bash
cd juegos-fuxia && python3 -m http.server 8777 &
python3 tests/test-juegos.py
```

68 casos en Chromium: las 4 pantallas, una partida completa de cada juego, las rachas, el
"ya jugaste hoy", los seis botones de compartir con sus URL revisadas una por una para que
ninguna filtre la respuesta, el botón "Leer la nota" con URL válida y el descarte de una
inválida, y que los links se comporten bien embebidos en una nota (la marca reemplaza la
ventana entera, Instagram abre pestaña nueva y deja la partida intacta).

El script levanta Chromium solo; `mansodiario.com` e `instagram.com` se interceptan porque
el entorno de prueba no los alcanza.
