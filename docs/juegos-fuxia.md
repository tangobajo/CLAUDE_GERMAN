# Fuxia Games para Manso Diario

Tres juegos diarios que corren enteros en el navegador del lector: sin backend, sin
base de datos, sin Firebase y sin librerías externas. Se suben como archivos estáticos
y se embeben en WordPress con un `<iframe>`.

| Juego | Archivo | Datos | Contenido por día |
|---|---|---|---|
| Palabra del Día | `palabra-del-dia.html` | `data/palabras.json` | 1 palabra de 5 letras |
| Agrupá | `agrupa.html` | `data/categorias.json` | 4 categorías × 4 ítems |
| Trivia Cuyana | `trivia-cuyana.html` | `data/trivia.json` | 5 preguntas |

---

## 1. Pendientes antes de publicar

Estas tres cosas salieron de revisar el banco de los primeros 30 días. Ninguna rompe
el código: son decisiones de contenido tuyas.

### 1.1 Preguntas marcadas "Verificar"

La planilla marca con **Sí** en la columna `Verificar` los datos que conviene confirmar
antes de publicarlos como respuesta correcta. Eso se convirtió al campo `"verificar": true`
en los JSON. **No se muestra nunca en pantalla**: es solo para tu seguimiento interno.

| Archivo | Ítems a verificar |
|---|---|
| `palabras.json` | 6 palabras |
| `categorias.json` | 52 categorías, repartidas en 28 de los 30 días |
| `trivia.json` | 33 preguntas, repartidas en 15 de los 30 días |

Para listar lo que falta revisar:

```bash
cd juegos-fuxia
python3 - <<'PY'
import json
for f in ['palabras','categorias','trivia']:
    d = json.load(open('data/%s.json' % f))
    print('\n===', f, '->', d['revisar'])
PY
```

Cuando confirmes un dato, **borrá el campo `"verificar": true`** de ese ítem. El juego
funciona igual con o sin el campo; es tu checklist.

### 1.2 Ítem repetido en Agrupá (días 5, 17 y 29)

En esos tres días **`OASIS` aparece en dos categorías a la vez** (`Accidentes geográficos
cuyanos` y `Elementos del paisaje sanjuanino`). La grilla muestra dos fichas con el mismo
texto y el lector no tiene forma de saber cuál va en cada grupo.

El juego no se rompe —cada ficha se maneja por su propio id interno, así que el puzzle se
sigue pudiendo resolver— pero es confuso. **Cambiá uno de los dos `OASIS` en la planilla**
por otra palabra antes de que salgan esos días. Está registrado en
`data/categorias.json` → `revisar.items_duplicados_en_el_dia`.

### 1.3 El banco repite días dentro del mismo mes

No todos los 30 días traen contenido distinto:

| Juego | Días con contenido único | Qué pasa |
|---|---|---|
| Palabra del Día | **30 de 30** ✅ | ninguna palabra se repite |
| Agrupá | **23 de 30** | los días 5/17/29, 6/18/30, 7/19, 8/20 y 9/21 son idénticos entre sí |
| Trivia Cuyana | **8 de 30** | solo hay 8 días distintos; el lector ve las mismas 5 preguntas cada 8 días |

Trivia es el caso más fuerte: **40 preguntas únicas repartidas en 150 lugares**. Si el
objetivo es retención, conviene ampliar ese banco antes del lanzamiento. Está registrado
en el bloque `revisar.dias_duplicados` de cada JSON.

### 1.4 Ninguna pregunta tiene "Link nota" cargado

La columna `Link nota` de la planilla está vacía en las 150 preguntas, así que hoy el botón
**"Leer la nota"** no aparece nunca. El código está listo y probado: apenas cargues una URL
en esa columna, el botón sale solo. Ver §3.3.

---

## 2. Cómo se calcula el día

`shared.js` expone la función que usan los tres juegos:

```js
FuxiaGames.calcularIndiceDelDia(fechaLanzamiento, largoDelBanco)  // -> 0 .. largo-1
```

- Toma la fecha civil de **San Juan**, restando 3 horas fijas del UTC. San Juan no aplica
  horario de verano, así que el desfase es constante todo el año.
- El contenido cambia a la **medianoche de San Juan**, no a la de UTC. Sin este ajuste el
  juego cambiaría de palabra a las 21:00 hora local.
- No depende del reloj ni de la zona horaria del dispositivo del lector: alguien que abra
  la página desde Madrid ve el mismo juego que alguien en San Juan.
- Cuando se termina el banco, **vuelve a empezar** (es un módulo). Con 30 días cargados, el
  día 31 muestra otra vez el día 1.
- **Antes del día 1 devuelve 0**, es decir el día 1. Así se puede probar el contenido antes
  del lanzamiento sin ver una pantalla vacía.

### Cambiar la fecha de "día 1" / reiniciar el ciclo

La fecha vive en el campo `fecha_dia_1` de cada JSON — **no está hardcodeada en el código**.
Para reiniciar el ciclo, editá ese campo en los tres archivos:

```json
{
  "juego": "palabra-del-dia",
  "fecha_dia_1": "2026-10-01",     <-- cambiá esto
  "dias": [ ... ]
}
```

Formato `YYYY-MM-DD`. Poniendo la fecha de hoy, el lector vuelve a ver el día 1.

> Los tres archivos pueden tener fechas distintas si querés arrancar un juego antes que
> otro. Hoy los tres están en `2026-10-01`, que es el día 1 que fija la hoja `Instrucciones`
> de la planilla.

Ojo: cambiar `fecha_dia_1` **no borra las rachas** que ya tenga guardadas el lector. Para
eso tendría que limpiar los datos del sitio en su navegador.

---

## 3. Cómo agregar contenido nuevo

El formato de cada JSON es un espejo de la hoja de la planilla, así que la próxima planilla
se convierte igual. El script que hace la conversión está en
`juegos-fuxia/data/convertir-planilla.py`:

```bash
# editá las constantes XLSX / OUT / FECHA_DIA_1 de arriba del script y corré:
pip install openpyxl
python3 juegos-fuxia/data/convertir-planilla.py
```

El script valida mientras convierte: que las palabras sean de 5 letras, que cada día de
Agrupá tenga las 4 dificultades y que cada día de Trivia tenga 5 preguntas. Si algo no
cierra, corta y avisa en qué día.

Si preferís editar el JSON a mano, este es el formato exacto.

### 3.1 `data/palabras.json` — hoja "Palabra del Dia"

```json
{
  "juego": "palabra-del-dia",
  "fecha_dia_1": "2026-10-01",
  "revisar": { "...": "diagnóstico, no lo lee el juego" },
  "dias": [
    {
      "dia": 1,
      "palabra": "ZONDA",
      "palabra_display": "ZONDA",
      "pista": "Viento cálido y seco típico de Cuyo; también nombre de un departamento sanjuanino",
      "verificar": true
    }
  ]
}
```

| Campo | Columna de la planilla | Obligatorio | Notas |
|---|---|---|---|
| `dia` | `Día` | sí | 1, 2, 3… en orden |
| `palabra` | `Palabra (sin tilde)` | sí | **5 letras, mayúsculas, sin tilde**. Es contra esto que se compara lo que tipea el lector. La `Ñ` sí se acepta |
| `palabra_display` | `Palabra (con tilde)` | sí | Lo que se muestra al revelar la respuesta. Si no lleva tilde, repetí `palabra` |
| `pista` | `Tema / Pista` | sí | Se muestra arriba del tablero desde el arranque |
| `verificar` | `Verificar` = Sí | no | Solo para tu control. Nunca se muestra |

La columna `Fecha (ref.)` de la planilla **no se convierte**: es una referencia visual. La
fecha real sale de `fecha_dia_1` + la posición en el array.

### 3.2 `data/categorias.json` — hoja "Agrupa"

Cuatro filas de la planilla = un día. Una fila por dificultad.

```json
{
  "juego": "agrupa",
  "fecha_dia_1": "2026-10-01",
  "dias": [
    {
      "dia": 1,
      "grupos": [
        { "dificultad": "amarillo", "categoria": "Comidas típicas de Cuyo",
          "items": ["EMPANADA", "LOCRO", "HUMITA", "ASADO"] },
        { "dificultad": "verde",    "categoria": "Instrumentos del folklore",
          "items": ["GUITARRA", "BOMBO", "ACORDEON", "VIOLIN"] },
        { "dificultad": "azul",     "categoria": "Palabras del mundo del vino",
          "items": ["COSECHA", "RACIMO", "BODEGA", "VARIETAL"] },
        { "dificultad": "morado",   "categoria": "Departamentos de San Juan",
          "items": ["CAPITAL", "RAWSON", "CHIMBAS", "POCITO"], "verificar": true }
      ]
    }
  ]
}
```

| Campo | Columna | Notas |
|---|---|---|
| `dificultad` | `Dificultad` | En minúscula: `amarillo`, `verde`, `azul`, `morado`. Convención de Connections: amarillo = más fácil, morado = el que tiene trampa |
| `categoria` | `Categoría` | Se revela recién cuando el lector acierta ese grupo |
| `items` | `Ítem 1` a `Ítem 4` | Exactamente 4, en mayúsculas |
| `verificar` | `Verificar` = Sí | Solo para tu control |

**Reglas que conviene respetar:**

- Los 4 grupos tienen que estar, uno por cada dificultad, y en ese orden.
- **Los 16 ítems del día tienen que ser distintos entre sí.** Si una palabra se repite en
  dos categorías, el lector ve dos fichas iguales y no puede resolver el puzzle sin adivinar
  (es lo que pasa hoy con `OASIS`, §1.2).
- Ítems cortos: en un celular de 320 px de ancho, las palabras de más de ~11 caracteres
  entran justas.
- El orden de la grilla se mezcla solo, con una semilla derivada del número de día: siempre
  igual para todos los lectores y estable si recargan la página.

### 3.3 `data/trivia.json` — hoja "Trivia Cuyana"

Cinco filas de la planilla = un día. Una fila por pregunta.

```json
{
  "juego": "trivia-cuyana",
  "fecha_dia_1": "2026-10-01",
  "dias": [
    {
      "dia": 1,
      "preguntas": [
        {
          "n": 1,
          "pregunta": "¿En qué provincia argentina nació Domingo Faustino Sarmiento?",
          "opciones": ["San Juan", "Mendoza", "San Luis", "La Rioja"],
          "respuesta": 0,
          "link_nota": null,
          "verificar": true
        }
      ]
    }
  ]
}
```

| Campo | Columna | Notas |
|---|---|---|
| `n` | `N° Pregunta` | 1 a 5 |
| `pregunta` | `Pregunta` | Texto plano |
| `opciones` | `Opción A` a `Opción D` | Siempre 4, en ese orden |
| `respuesta` | `Respuesta` | **Número, no letra.** A→`0`, B→`1`, C→`2`, D→`3` |
| `link_nota` | `Link nota (opcional)` | `null` o una URL. Ver abajo |
| `verificar` | `Verificar` = Sí | Solo para tu control. **No se muestra al lector** |

**El botón "Leer la nota":** si `link_nota` trae una URL, al responder esa pregunta aparece
un botón que la abre en una pestaña nueva. Si es `null`, no aparece nada.

```json
"link_nota": "https://mansodiario.com/2026/10/la-fiesta-nacional-del-sol/"
```

Tiene que empezar con `http://` o `https://`; cualquier otra cosa se descarta en silencio,
para que un valor mal pegado en la planilla no termine ejecutándose en la página.

---

## 4. Qué se guarda en el navegador

Todo el estado del jugador vive en el `localStorage` de su navegador. No hay servidor, no
hay cuentas, no se manda nada a ningún lado. **Si el lector cambia de dispositivo o borra la
caché, pierde la racha** — es una decisión consciente del proyecto.

Dos claves por juego:

| Clave | Contenido |
|---|---|
| `fuxiagames_palabra_estado` | la partida de hoy: intentos, si ganó, y la fecha |
| `fuxiagames_palabra_racha` | `actual`, `maxima`, `jugados`, `ganados`, `ultimoDiaJugado` |
| `fuxiagames_agrupa_estado` / `_racha` | ídem para Agrupá |
| `fuxiagames_trivia_estado` / `_racha` | ídem para Trivia |

- **Si ya jugó hoy**, el juego muestra el resultado del día en vez de dejarlo jugar otra vez.
  Lo decide comparando el campo `fecha` del estado guardado contra la fecha de hoy en San Juan.
- La partida se guarda **a medida que avanza**, no solo al terminar: si cierra el navegador
  a mitad de camino, al volver retoma donde estaba.
- La racha cuenta **días ganados seguidos**. Perder la corta. Saltarse un día la corta.
- Si el navegador está en modo incógnito o bloquea el almacenamiento, los juegos **funcionan
  igual**, solo que no recuerdan nada. La portada avisa con un cartel.

### Compartir resultado

Los tres juegos arman una grilla de emojis al estilo Wordle **sin revelar la respuesta**,
más el link de vuelta a `mansodiario.com`:

```
Fuxia Games · Palabra del Día #1 — 3/6

⬛🟨⬛⬛🟩
🟩🟨⬛🟩🟩
🟩🟩🟩🟩🟩

Jugá en https://mansodiario.com
```

Usa la **Web Share API** (el menú nativo de compartir del celular) y, donde no existe,
copia al portapapeles. Está verificado que el texto compartido no contiene ni la palabra
secreta, ni los nombres de las categorías, ni las preguntas.

---

## 5. Cómo se sube al hosting

Copiá la carpeta `juegos-fuxia/` completa al servidor, **dentro del mismo dominio que
Manso Diario**:

```
mansodiario.com/
└── juegos-fuxia/
    ├── index.html
    ├── palabra-del-dia.html
    ├── agrupa.html
    ├── trivia-cuyana.html
    ├── shared.css
    ├── shared.js
    ├── assets/
    │   ├── logo-fuxia-games.svg
    │   └── logo-fuxia-games-icono.svg
    └── data/
        ├── palabras.json
        ├── categorias.json
        └── trivia.json
```

Se puede subir por FTP, por el administrador de archivos del hosting, o con el plugin
*File Manager* de WordPress. No hace falta compilar nada.

### ⚠️ Tiene que ser el mismo dominio

**Esto es importante y no es negociable.** Si los juegos se sirven desde un dominio distinto
al de la página de WordPress que los embebe (por ejemplo `juegos.otrositio.com` dentro de
`mansodiario.com`), Chrome y Safari **particionan el `localStorage` del iframe**. Consecuencias:

- la racha del lector se guarda en un compartimento aparte,
- la portada `index.html` no ve que ya jugó,
- y en Safari con "Prevent cross-site tracking" activado —que viene **prendido por defecto**—
  el almacenamiento directamente se borra a los 7 días.

Lo verifiqué en Chromium: con el iframe en el mismo origen el estado se comparte bien; con
el iframe en otro origen, la página directa no ve nada de lo guardado dentro del iframe.

**Subilo a `mansodiario.com/juegos-fuxia/` y listo.** Un subdominio (`juegos.mansodiario.com`)
también es cross-origin para el `localStorage`: no sirve.

### Los archivos se tienen que servir por HTTP

Los juegos leen su contenido con `fetch()` desde `data/*.json`. Abrir el HTML con doble clic
desde el escritorio (`file://`) **no funciona**: el navegador bloquea esas lecturas. Para
probar en tu máquina antes de subir:

```bash
cd juegos-fuxia
python3 -m http.server 8777
# abrir http://localhost:8777/index.html
```

---

## 6. Cómo se embebe en WordPress

Cada juego es un archivo independiente y se embebe solo. Creá una página de WordPress
("Juegos", "Palabra del Día", etc.), pasá el editor a **HTML personalizado** y pegá:

### Portada con los 3 juegos

```html
<iframe src="https://mansodiario.com/juegos-fuxia/index.html"
        title="Juegos de Fuxia Games"
        width="100%" height="1100"
        style="border:0;max-width:900px;margin:0 auto;display:block"
        loading="lazy"></iframe>
```

### Palabra del Día

```html
<iframe src="https://mansodiario.com/juegos-fuxia/palabra-del-dia.html"
        title="Palabra del Día"
        width="100%" height="900"
        style="border:0;max-width:600px;margin:0 auto;display:block"
        loading="lazy"></iframe>
```

### Agrupá

```html
<iframe src="https://mansodiario.com/juegos-fuxia/agrupa.html"
        title="Agrupá"
        width="100%" height="1000"
        style="border:0;max-width:600px;margin:0 auto;display:block"
        loading="lazy"></iframe>
```

### Trivia Cuyana

```html
<iframe src="https://mansodiario.com/juegos-fuxia/trivia-cuyana.html"
        title="Trivia Cuyana"
        width="100%" height="800"
        style="border:0;max-width:600px;margin:0 auto;display:block"
        loading="lazy"></iframe>
```

## 6.1 Cómo navega el lector

Dentro de los juegos hay dos clases de link y se comportan distinto a propósito:

| Elemento | A dónde va | Sale del iframe |
|---|---|---|
| El logo de la cabecera | portada de **Manso Diario** | sí (`target="_top"`) |
| "Manso Diario" en el pie | portada de **Manso Diario** | sí (`target="_top"`) |
| "← Juegos" | portada de **juegos** (`index.html`) | no |
| "Ver los otros juegos" | portada de **juegos** (`index.html`) | no |
| "Leer la nota" (Trivia) | la nota que diga el JSON | pestaña nueva (`target="_blank"`) |

El `target="_top"` no es decorativo: **sin eso, al tocar el logo Manso Diario se cargaría
entero adentro del recuadro de 900 px embebido en la nota**, con el diario metido dentro
de sí mismo. Con `_top` la navegación reemplaza la ventana completa, que es lo que espera
el lector.

El área de toque del logo es de 44×44 px aunque el dibujo mida 30: se agranda con un
pseudo-elemento invisible, así entra cómodo con el dedo sin correr el logo de lugar.

### Cambiar el dominio

La URL de la portada está escrita en dos lugares de cada uno de los 4 HTML (el logo y el
pie), más la constante `URL_MANSO` de `shared.js` que arma el texto de compartir. Si alguna
vez cambia el dominio:

```bash
cd juegos-fuxia
grep -rn "mansodiario.com" *.html shared.js
```

### Notas sobre el iframe

- **El alto es fijo.** El iframe no se estira solo con el contenido. Los valores de arriba
  dan aire de sobra en celular; si ves una barra de scroll interna, subí el `height`.
- **Poné cada juego en su propia página de WordPress.** Los links internos ("← Juegos",
  "Ver los otros juegos") navegan dentro del iframe, lo cual funciona pero deja al lector
  con la cabecera de WordPress de otra página. Si querés que salten a la página de WordPress
  correspondiente, hay que cambiar esos `href` por las URLs reales de tu sitio.
- **No le pongas `sandbox` al iframe** sin incluir `allow-top-navigation-by-user-activation`,
  o el logo deja de poder volver a la portada (ver §6.1).
- El botón "Leer la nota" abre en **pestaña nueva** (`target="_blank"`), así el lector no
  pierde la partida.
- No hace falta `allow` ni `sandbox`. Si tu tema o un plugin de seguridad agrega
  `sandbox`, tiene que incluir al menos `allow-scripts allow-same-origin allow-popups`.
- Si usás un plugin de caché (WP Rocket, LiteSpeed, W3 Total Cache), **excluí
  `/juegos-fuxia/data/*.json` de la caché** o al menos ponele un TTL corto, para que los
  cambios de contenido se vean el mismo día.

---

## 7. Tests

```bash
# lógica de fechas, rachas y utilidades (no necesita navegador)
node juegos-fuxia/tests/test-shared.js

# los 3 juegos en Chromium, incluido el embebido en iframe
pip install playwright && playwright install chromium
cd juegos-fuxia && python3 -m http.server 8777 &
python3 juegos-fuxia/tests/test-juegos.py

# la navegación del logo y del pie, dentro y fuera del iframe
python3 juegos-fuxia/tests/test-logo.py
```

Cubren: el corte a medianoche de San Juan (incluido el cruce de UTC), el ciclado del banco,
el comportamiento antes del día 1, el pintado de letras repetidas al estilo Wordle, las
rachas, el "ya jugaste hoy", que el texto compartido no filtre la respuesta, que el botón
"Leer la nota" aparezca solo con URL válida, que ninguna página salga a internet, y que el
logo vuelva a la portada del diario rompiendo el iframe mientras "← Juegos" navega adentro.

---

## 8. Colores y logo

Los juegos usan la paleta de Manso Diario, no una propia. Los valores salieron de
muestrear la home del diario, y viven todos juntos arriba de `shared.css`:

```css
:root {
  --md-naranja:       #E76F2E;   /* banda del header y badges del diario */
  --md-naranja-hover: #D15E1F;
  --md-naranja-texto: #A8450E;   /* links: ver la nota de contraste abajo */
  --md-tinta:         #252525;   /* titulares y pills de categoría */
  --md-texto-suave:   #4A4A4A;   /* bajadas */
  --md-fondo:         #E7E7E5;   /* fondo de página */
  --md-superficie:    #FFFFFF;   /* tarjetas */
  --md-borde:         #D6D6D4;   /* divisores */
}
```

El fondo de los juegos es **el mismo gris que el cuerpo del diario**, así que el iframe
no aparece como un recuadro pegado encima de la nota: se funde con la página.

Tres decisiones que conviene no revertir sin mirar el contraste:

- **Los botones naranjas llevan texto oscuro, no blanco.** Blanco sobre `#E76F2E` da
  3.13:1 y no llega al 4.5:1 que pide WCAG para texto normal; con tinta da 4.90:1. Además
  es lo que hace el propio diario: el "MUNDO" del header y los números de los badges van
  en oscuro sobre naranja.
- **Los links usan `--md-naranja-texto` (`#A8450E`), no el naranja de marca.** El naranja
  puro como color de texto sobre el gris de fondo da 2.53:1, ilegible. El oscurecido da 4.81:1.
- **Las celdas verde y amarilla de Palabra del Día llevan texto oscuro.** Wordle las pone en
  blanco, pero ahí el contraste es 2.78:1 y 2.07:1. Con tinta pasan a 5.51:1 y 7.41:1.

Los cuatro colores de dificultad de Agrupá (`--juego-amarillo`, `--juego-verde`,
`--juego-azul`, `--juego-morado`) **no son de Manso Diario**: son la convención de
Connections y por eso están en un bloque aparte. Conviene dejarlos como están, porque el
lector ya los tiene aprendidos de ese juego y los lee sin pensar. La ficha seleccionada va
en tinta y no en naranja justamente para que el naranja no se lea como un quinto grupo.

### El logo

`assets/logo-fuxia-games.svg` (completo, para la portada) y
`assets/logo-fuxia-games-icono.svg` (solo el cuadrado, para la cabecera de los juegos) son
**provisorios**: los armé porque no tenía acceso al repo de Fuxia Games. Están dibujados en
la paleta del diario —cuadrado en tinta, puntos en naranja y blanco— para que no compitan
con la identidad de Manso Diario.

Para poner los reales, pisá esos dos archivos conservando el nombre: no hay que tocar ni el
HTML ni el CSS. Si el logo real viene en la paleta fucsia de Fuxia Games, va a destacar
bastante sobre el gris del diario; en ese caso conviene pedir una versión monocromática para
la cabecera.

### Tipografía

Los títulos van en la sans del sistema en peso 800 con tracking negativo, para acercarse a
la sans pesada de los titulares del diario. No se cargan fuentes externas (ni Google Fonts
ni ningún CDN), así que el juego funciona offline y no agrega peso en mobile. Si querés
usar la fuente real de Manso Diario, se cambia en `--md-titulo` y hay que servir el archivo
de la fuente desde el mismo dominio.
