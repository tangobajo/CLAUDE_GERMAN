/* Tests de shared.js — correr con:  node tests/test-shared.js  */
const fs = require('fs');
global.window = global; global.document = { getElementById: () => null };
eval(fs.readFileSync(require('path').join(__dirname, '..', 'shared.js'), 'utf8'));
const F = global.FuxiaGames;
const calc = F.calcularIndiceDelDia;
let fallos = 0;
function eq(nombre, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fallos++;
  console.log((ok ? 'OK  ' : 'FAIL') + '  ' + nombre + '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
}
const D = s => new Date(s);
// Dia 1 = 2026-10-01, banco de 30
eq('dia 1 a las 12:00 ARG',      calc('2026-10-01', 30, D('2026-10-01T15:00:00Z')), 0);
eq('dia 1 a las 00:01 ARG',      calc('2026-10-01', 30, D('2026-10-01T03:01:00Z')), 0);
eq('dia 1 a las 23:59 ARG',      calc('2026-10-01', 30, D('2026-10-02T02:59:00Z')), 0);
eq('dia 2 a las 00:00 ARG',      calc('2026-10-01', 30, D('2026-10-02T03:00:00Z')), 1);
eq('22:00 ARG sigue siendo d1',  calc('2026-10-01', 30, D('2026-10-02T01:00:00Z')), 0); // 01:00 UTC = 22:00 ARG del dia 1
eq('dia 30',                     calc('2026-10-01', 30, D('2026-10-30T15:00:00Z')), 29);
eq('dia 31 vuelve a 0',          calc('2026-10-01', 30, D('2026-10-31T15:00:00Z')), 0);
eq('dia 61 vuelve a 0',          calc('2026-10-01', 30, D('2026-11-30T15:00:00Z')), 0);
eq('antes del lanzamiento -> 0', calc('2026-10-01', 30, D('2026-09-22T15:00:00Z')), 0);
eq('muy anterior -> 0',          calc('2026-10-01', 30, D('2020-01-01T15:00:00Z')), 0);
eq('numeroDeDia dia 2',          F.numeroDeDia('2026-10-01', 30, D('2026-10-02T15:00:00Z')), 2);
eq('hoyArgentina cruce UTC',     F.hoyArgentina(D('2026-10-02T01:00:00Z')), '2026-10-01');
eq('hoyArgentina post medianoche', F.hoyArgentina(D('2026-10-02T03:30:00Z')), '2026-10-02');
eq('fechaLegible',               F.fechaLegible(D('2026-10-01T15:00:00Z')), '1 de octubre de 2026');
eq('normalizar tildes',          F.normalizar('viñas ÁÉÍÓÚ'), 'VIÑAS AEIOU');
// baraja determinista
eq('baraja estable',             F.barajarConSemilla([1,2,3,4,5,6], 7), F.barajarConSemilla([1,2,3,4,5,6], 7));
eq('baraja conserva items',      F.barajarConSemilla([1,2,3,4,5,6], 7).slice().sort(), [1,2,3,4,5,6]);
// largo invalido
try { calc('2026-10-01', 0); console.log('FAIL  largo 0 deberia tirar'); fallos++; }
catch (e) { console.log('OK    largo 0 tira error'); }
// recorrido completo: cada dia del ciclo se usa exactamente una vez en 30 dias
const vistos = new Set();
for (let i = 0; i < 30; i++) vistos.add(calc('2026-10-01', 30, new Date(Date.UTC(2026,9,1,15,0,0) + i*86400000)));
eq('30 dias cubren los 30 indices', vistos.size, 30);
console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodos los tests pasaron');
process.exit(fallos ? 1 : 0);
