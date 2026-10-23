import {test,expect} from '@playwright/test';
import catalog from '../catalogo_optimizacion_gimnasios_1_a_5.json' with {type:'json'};
import type {Game} from '../src/data';
import {evolutionProgress,practiceEvidence,reconcileMilestones,parseMilestones} from '../src/lib/evolutionRules';
const games=catalog.juegos as Game[];
const date='2026-10-20T12:00:00Z';
const entries=(ids:string[])=>Object.fromEntries(ids.map(id=>[id,date]));
const selected=(counts:number[])=>games.filter(g=>games.filter(x=>x.gimnasio===g.gimnasio).indexOf(g)<(counts[g.gimnasio-1]||0)).map(g=>g.repo);

test('etapa 2 requiere seis juegos únicos repartidos entre dos gimnasios',()=>{
  const single=entries(selected([0,6]));
  expect(reconcileMilestones(single,[],games)).toEqual([]);
  const spread=entries(selected([5,1]));
  expect(evolutionProgress(spread,reconcileMilestones(spread,[],games),games).stage).toBe(2);
  const five=entries(selected([4,1]));expect(reconcileMilestones(five,[],games)).toEqual([]);
});
test('etapa 3 requiere dieciocho juegos y cuatro gimnasios',()=>{
  const three=entries(selected([5,8,5]));
  expect(evolutionProgress(three,reconcileMilestones(three,[],games),games).stage).toBe(2);
  const four=entries(selected([5,8,4,1]));
  expect(evolutionProgress(four,reconcileMilestones(four,[],games),games).stage).toBe(3);
});
test('IDs ajenos, fechas inválidas, repeticiones y evidencias corruptas no desbloquean',()=>{
  const valid=entries(selected([4,1]));
  const invalid={...valid,'profesora-learningapps':date,'caza-el-pivote':'no es una fecha','espejo-dual':'2026-02-31T00:00:00Z'};
  expect(practiceEvidence(invalid,games)).toHaveLength(5);expect(reconcileMilestones(invalid,[],games)).toEqual([]);
  const evidence=Array.from({length:18},()=>({gameId:'memorama-simplex',practicedAt:date}));
  expect(parseMilestones([{stage:3,ruleVersion:1,unlockedAt:date,practice:evidence}],games)).toEqual([]);
  expect(parseMilestones([{stage:3,unlockedAt:date,practice:[]},null,{stage:8}],games)).toEqual([]);
  expect(practiceEvidence({ 'memorama-simplex':12},games)).toEqual([]);
});
test('hitos conservan la forma tras desmarcar y se pueden restaurar desde su evidencia',()=>{
  const practiced=entries(selected([5,8,4,1]));const history=reconcileMilestones(practiced,[],games);
  const restored=reconcileMilestones({},JSON.parse(JSON.stringify(history)),games);
  expect(evolutionProgress({},restored,games).stage).toBe(3);
  expect(restored).toEqual(history);expect(reconcileMilestones({},[],games)).toEqual([]);
  expect(parseMilestones(history.map(m=>({...m,ruleVersion:999})),games)).toEqual([]);
  const bad=history.map(m=>({...m,practice:[...m.practice,{gameId:'desconocido',practicedAt:date}]}));
  expect(parseMilestones(bad,games)).toEqual([]);
});
