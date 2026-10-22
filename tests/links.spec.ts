import {test,expect} from '@playwright/test';
import catalog from '../catalogo_optimizacion_gimnasios_1_a_5.json' with {type:'json'};
test('HTTP de los 28 juegos publicados',async({request})=>{test.setTimeout(120000);const results=await Promise.all(catalog.juegos.map(async g=>{try{const r=await request.get(g.juego_url,{timeout:30000});return {nombre:g.nombre,status:r.status(),url:g.juego_url}}catch(e){return {nombre:g.nombre,status:0,url:g.juego_url,error:String(e)}}}));console.log(JSON.stringify(results,null,2));expect(results.filter(r=>r.status!==200)).toEqual([])});
