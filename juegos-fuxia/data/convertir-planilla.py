# -*- coding: utf-8 -*-
"""Convierte fuxia-games-manso-diario-30-dias.xlsx a los 3 JSON de /juegos-fuxia/data/.
Conversion fila por fila, sin inventar contenido. Los problemas detectados en el banco
se registran en el bloque "revisar" de cada JSON, no se corrigen en silencio."""
import json, collections, openpyxl

XLSX = '/root/.claude/uploads/995d41b0-b238-5f7d-9c6d-eb8a549af825/5e2309d0-fuxia-games-manso-diario-30-dias.xlsx'
OUT  = '/home/user/CLAUDE_GERMAN/juegos-fuxia/data'
FECHA_DIA_1 = '2026-10-01'           # hoja 'Instrucciones': Dia 1 = 01/10/2026
DIF = {'Amarillo': 'amarillo', 'Verde': 'verde', 'Azul': 'azul', 'Morado': 'morado'}
ORDEN_DIF = ['amarillo', 'verde', 'azul', 'morado']

wb = openpyxl.load_workbook(XLSX, data_only=True)
txt = lambda v: None if v is None else str(v).strip()
si  = lambda v: txt(v) == 'Sí'

def dump(nombre, obj):
    with open('%s/%s' % (OUT, nombre), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')

def dias_identicos(porDia, clave):
    firmas = collections.defaultdict(list)
    for d in sorted(porDia):
        firmas[json.dumps(clave(porDia[d]), ensure_ascii=False, sort_keys=True)].append(d)
    return sorted((ds for ds in firmas.values() if len(ds) > 1), key=lambda ds: ds[0])

# ---------------- palabras.json ----------------
dias = []
for r in wb['Palabra del Dia'].iter_rows(min_row=2, values_only=True):
    if r[0] is None:
        continue
    d = {'dia': int(r[0]), 'palabra': txt(r[2]).upper(),
         'palabra_display': txt(r[3]).upper(), 'pista': txt(r[4])}
    if si(r[5]):
        d['verificar'] = True
    if len(d['palabra']) != 5:
        raise SystemExit('palabra de %d letras en el dia %d: %s' % (len(d['palabra']), d['dia'], d['palabra']))
    dias.append(d)
dias.sort(key=lambda d: d['dia'])

dump('palabras.json', {
    'juego': 'palabra-del-dia',
    'fecha_dia_1': FECHA_DIA_1,
    'revisar': {
        'verificar': sorted(d['dia'] for d in dias if d.get('verificar')),
        'dias_duplicados': [],
        'notas': [],
    },
    'dias': dias,
})
print('palabras.json  %2d dias, %d unicos, %d a verificar'
      % (len(dias), len({d['palabra'] for d in dias}), sum(1 for d in dias if d.get('verificar'))))

# ---------------- categorias.json ----------------
porDia = collections.OrderedDict()
for r in wb['Agrupa'].iter_rows(min_row=2, values_only=True):
    if r[0] is None:
        continue
    g = {'dificultad': DIF[txt(r[2])], 'categoria': txt(r[3]),
         'items': [txt(r[i]).upper() for i in (4, 5, 6, 7)]}
    if si(r[8]):
        g['verificar'] = True
    porDia.setdefault(int(r[0]), []).append(g)

dias, items_dup = [], []
for dia in sorted(porDia):
    grupos = sorted(porDia[dia], key=lambda g: ORDEN_DIF.index(g['dificultad']))
    if [g['dificultad'] for g in grupos] != ORDEN_DIF:
        raise SystemExit('el dia %d no tiene las 4 dificultades' % dia)
    plano = [i for g in grupos for i in g['items']]
    repes = sorted(x for x, c in collections.Counter(plano).items() if c > 1)
    if repes:
        items_dup.append({'dia': dia, 'items': repes})
    dias.append({'dia': dia, 'grupos': grupos})

dump('categorias.json', {
    'juego': 'agrupa',
    'fecha_dia_1': FECHA_DIA_1,
    'revisar': {
        'verificar': sorted({d['dia'] for d in dias for g in d['grupos'] if g.get('verificar')}),
        'dias_duplicados': dias_identicos(porDia, lambda gs: sorted(
            [g['dificultad'], g['categoria']] + sorted(g['items']) for g in gs)),
        'items_duplicados_en_el_dia': items_dup,
        'notas': [
            'items_duplicados_en_el_dia: el mismo item aparece en dos categorias del mismo dia. '
            'La grilla muestra dos fichas con el mismo texto y el jugador no puede saber cual va '
            'en cada grupo. Reemplazar uno de los dos en la planilla antes de publicar.',
            'dias_duplicados: esos dias tienen exactamente las mismas 4 categorias y los mismos 16 '
            'items, asi que el lector repite el mismo puzzle dentro del mismo mes.',
        ],
    },
    'dias': dias,
})
print('categorias.json %2d dias, %d unicos, %d con items duplicados'
      % (len(dias), len(dias) - sum(len(g) - 1 for g in dias_identicos(porDia, lambda gs: sorted(
          [g['dificultad'], g['categoria']] + sorted(g['items']) for g in gs))), len(items_dup)))

# ---------------- trivia.json ----------------
porDia = collections.OrderedDict()
for r in wb['Trivia Cuyana'].iter_rows(min_row=2, values_only=True):
    if r[0] is None:
        continue
    p = {'n': int(r[2]), 'pregunta': txt(r[3]),
         'opciones': [txt(r[i]) for i in (4, 5, 6, 7)],
         'respuesta': 'ABCD'.index(txt(r[8]).upper()),
         'link_nota': txt(r[9])}
    if si(r[10]):
        p['verificar'] = True
    porDia.setdefault(int(r[0]), []).append(p)

dias = []
for dia in sorted(porDia):
    preguntas = sorted(porDia[dia], key=lambda p: p['n'])
    if len(preguntas) != 5:
        raise SystemExit('el dia %d tiene %d preguntas, no 5' % (dia, len(preguntas)))
    dias.append({'dia': dia, 'preguntas': preguntas})

todas = [p['pregunta'] for d in dias for p in d['preguntas']]
dump('trivia.json', {
    'juego': 'trivia-cuyana',
    'fecha_dia_1': FECHA_DIA_1,
    'revisar': {
        'verificar': [{'dia': d['dia'], 'preguntas': [p['n'] for p in d['preguntas'] if p.get('verificar')]}
                      for d in dias if any(p.get('verificar') for p in d['preguntas'])],
        'dias_duplicados': dias_identicos(porDia, lambda ps: sorted(p['pregunta'] for p in ps)),
        'preguntas_unicas': len(set(todas)),
        'preguntas_totales': len(todas),
        'con_link_nota': sum(1 for d in dias for p in d['preguntas'] if p['link_nota']),
        'notas': [
            'verificar: preguntas marcadas "Si" en la planilla. Confirmar el dato antes de '
            'publicarlas como respuesta correcta. No se muestra en pantalla al lector.',
            'dias_duplicados: el banco tiene solo 8 dias distintos de preguntas repetidos en ciclo, '
            'asi que el lector ve las mismas 5 preguntas cada 8 dias.',
            'con_link_nota: cuantas preguntas tienen URL cargada. En 0 el boton "Leer la nota" '
            'nunca aparece; se activa solo al completar la columna "Link nota" de la planilla.',
        ],
    },
    'dias': dias,
})
print('trivia.json    %2d dias, %d preguntas unicas de %d, %d con link_nota, %d a verificar'
      % (len(dias), len(set(todas)), len(todas),
         sum(1 for d in dias for p in d['preguntas'] if p['link_nota']),
         sum(1 for d in dias for p in d['preguntas'] if p.get('verificar'))))
