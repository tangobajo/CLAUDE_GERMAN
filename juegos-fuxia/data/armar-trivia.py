# -*- coding: utf-8 -*-
"""Arma data/trivia.json a partir de:
  - trivia-original.json : el banco de 40 preguntas únicas de San Juan y Cuyo
  - banco-nuevo.py       : las preguntas nuevas de temas generales

Reglas del reparto:
  - 30 días × 5 preguntas = 150 lugares, sin repetir ninguna pregunta en el ciclo.
  - La pregunta 1 de cada día es siempre de San Juan / Cuyo.
  - Las otras 4 rotan entre los temas generales, así ningún día queda con
    cuatro preguntas del mismo palo.
  - Las opciones se barajan con una semilla derivada del texto de la pregunta:
    el orden es estable entre corridas, pero la correcta no cae siempre en la A.

Correr con:  python3 armar-trivia.py
"""
import json, hashlib, importlib.util, collections, os

AQUI = os.path.dirname(os.path.abspath(__file__))
DIAS, POR_DIA = 30, 5
ORDEN_TEMAS = ['argentina', 'deportes', 'espectaculos', 'ciencia', 'san-juan']

def cargar_banco_nuevo():
    spec = importlib.util.spec_from_file_location('banco', os.path.join(AQUI, 'banco-nuevo.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.NUEVAS

def _rnd(semilla):
    """PRNG estable: misma semilla, mismo resultado en cualquier máquina."""
    h = int(hashlib.sha256(str(semilla).encode('utf-8')).hexdigest()[:8], 16)
    def siguiente(n):
        nonlocal h
        h = (h * 1664525 + 1013904223) & 0xFFFFFFFF
        return h % n
    return siguiente

def barajar(xs, semilla):
    rnd = _rnd(semilla)
    xs = list(xs)
    for i in range(len(xs) - 1, 0, -1):
        j = rnd(i + 1)
        xs[i], xs[j] = xs[j], xs[i]
    return xs

def armar(pregunta, correcta, distractores, tema, verificar):
    """Guarda la correcta aparte; la posición se decide recién al repartir."""
    return {
        'pregunta': pregunta,
        '_correcta': correcta,
        '_distractores': list(distractores),
        'tema': tema,
        'link_nota': None,
        'verificar': bool(verificar),
    }

def fijar_opciones(preguntas):
    """Coloca la correcta en A, B, C o D repartiendo parejo.

    Barajar cada pregunta por separado deja la distribución al azar, y con 150
    preguntas eso se desbalancea bastante (salía A=54 y B=24). El que marca
    siempre la misma letra no tiene que acertar más que el que marca otra, así
    que acá se arma una secuencia con las cuatro letras en partes iguales, se
    mezcla y se le asigna una a cada pregunta.
    """
    posiciones = barajar([i % 4 for i in range(len(preguntas))], 'posiciones-fuxia')
    for q, pos in zip(preguntas, posiciones):
        distractores = barajar(q.pop('_distractores'), q['pregunta'])
        opciones = distractores[:pos] + [q.pop('_correcta')] + distractores[pos:]
        q['opciones'] = opciones
        q['respuesta'] = 'ABCD'[pos]
        # el orden de las claves es el que se ve en el archivo
        for k in ('tema', 'link_nota', 'verificar'):
            q[k] = q.pop(k)
    return preguntas

# ── 1. Las 40 preguntas únicas del banco original (todas de San Juan / Cuyo) ──
original = json.load(open(os.path.join(AQUI, 'trivia-original.json'), encoding='utf-8'))
locales, vistas = [], set()
for dia in original['dias']:
    for q in dia['preguntas']:
        if q['pregunta'] in vistas:
            continue
        vistas.add(q['pregunta'])
        correcta = q['opciones']['ABCD'.index(q['respuesta'])]
        distractores = [o for o in q['opciones'] if o != correcta]
        locales.append(armar(q['pregunta'], correcta, distractores, 'san-juan', q.get('verificar')))

# ── 2. Las nuevas ──
nuevas = [armar(p, c, d, tema, v) for tema, p, c, d, v in cargar_banco_nuevo()]

# ── 3. Reparto ──
# Una local por día; las locales que sobran se suman al pozo general.
del_dia, sobran_locales = locales[:DIAS], locales[DIAS:]

colas = collections.OrderedDict((t, []) for t in ORDEN_TEMAS)
for q in nuevas:
    colas[q['tema']].append(q)
colas['san-juan'] = sobran_locales

# Intercalado: se va tomando una de cada tema por vuelta, así cuatro seguidas
# (que es lo que ve el lector en un día) siempre caen de temas distintos.
intercaladas = []
while any(colas.values()):
    for tema in ORDEN_TEMAS:
        if colas[tema]:
            intercaladas.append(colas[tema].pop(0))

faltan = DIAS * (POR_DIA - 1)
generales, reserva = intercaladas[:faltan], intercaladas[faltan:]

# La posición de la correcta se fija acá, sobre el set completo ya ordenado.
fijar_opciones([q for i in range(DIAS)
                for q in [del_dia[i]] + generales[i * (POR_DIA - 1):(i + 1) * (POR_DIA - 1)]])

dias = []
for i in range(DIAS):
    preguntas = [del_dia[i]] + generales[i * (POR_DIA - 1):(i + 1) * (POR_DIA - 1)]
    dias.append({'dia': i + 1, 'preguntas': preguntas})

fijar_opciones(reserva)
salida = {'dia1': original['dia1'], 'dias': dias}
if reserva:
    # No lo lee el juego: queda acá para no perder preguntas que no entraron.
    salida['reserva'] = reserva

with open(os.path.join(AQUI, 'trivia.json'), 'w', encoding='utf-8') as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)
    f.write('\n')

# ── 4. Informe ──
todas = [q for d in dias for q in d['preguntas']]
print('trivia.json escrito')
print('  %d días × %d preguntas = %d lugares' % (len(dias), POR_DIA, len(todas)))
print('  preguntas únicas usadas: %d' % len({q['pregunta'] for q in todas}))
print('  por tema: %s' % dict(collections.Counter(q['tema'] for q in todas)))
print('  letra de la respuesta: %s' % dict(sorted(collections.Counter(q['respuesta'] for q in todas).items())))
print('  a verificar: %d' % sum(1 for q in todas if q['verificar']))
print('  en reserva (no se publican): %d' % len(reserva))
sin_local = [d['dia'] for d in dias if d['preguntas'][0]['tema'] != 'san-juan']
print('  días sin pregunta local: %s' % (sin_local or 'ninguno'))
repes = [d['dia'] for d in dias if len({q['pregunta'] for q in d['preguntas']}) != POR_DIA]
print('  días con pregunta repetida adentro: %s' % (repes or 'ninguno'))
