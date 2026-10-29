import {test,expect} from '@playwright/test';
const ids=['ahorcado-simplex','ordena-simplex','rompecabezas-simplex','caza-el-pivote'];
const fixture='<!doctype html><html lang="es"><title>Fixture, no juego real</title><body><button>Partida de prueba</button></body></html>';
test.beforeEach(async({context})=>{for(const id of ids)await context.route(`https://israeltiburcio-ai.github.io/${id}/`,r=>r.fulfill({contentType:'text/html',body:fixture}));});

test('los cinco juegos de gimnasio3 integrados; otros23 conservan sus enlaces',async({page})=>{
  await page.goto('#/optidex');await expect(page.locator('.cartridge')).toHaveCount(28);
  await expect(page.locator('.cartridge .play[target="_blank"]')).toHaveCount(23);
  await expect(page.locator('.cartridge .play[href="#/jugar/memorama-simplex"]')).toHaveCount(1);
  for(const id of ids){const link=page.locator(`.cartridge .play[href="#/jugar-original/${id}"]`);await expect(link).toHaveCount(1);expect(await link.getAttribute('target')).toBeNull();}
  const mem=page.locator('.cartridge').filter({hasText:'Memorama Simplex'});await mem.getByRole('button',{name:'Detalles',exact:true}).click();await expect(mem.getByText('al completar ocho parejas',{exact:false})).toBeVisible();
});
for(const id of ids)test(`${id}: sandbox opaco y mensajes sin resultados ni progreso`,async({page})=>{
  await page.goto(`#/jugar-original/${id}`);const node=page.locator('.original-player iframe'),child=page.frameLocator('.original-player iframe');await child.getByRole('button').waitFor();
  await expect(node).toHaveAttribute('sandbox','allow-scripts');await expect(node).toHaveAttribute('referrerpolicy','no-referrer');await expect(node).toHaveAttribute('src',`https://israeltiburcio-ai.github.io/${id}/`);
  const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  expect(await child.locator('body').evaluate(()=>{try{localStorage.setItem('optilab-v1','corrupted');return false;}catch(e){return (e as Error).name==='SecurityError';}})).toBe(true);
  await child.locator('body').evaluate(()=>{parent.postMessage({protocol:'optilab-game',version:1,type:'game:completed',gameId:'memorama-simplex',result:{accuracy:100}},'*');parent.postMessage('AppSolved|pznycxd7t21|100|4|0','*');});
  await expect(page.getByText('Este piloto no comunica resultados',{exact:false})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);await expect(page.locator('.game-result-panel,.external-observed')).toHaveCount(0);
});
test('rutas no permiten URLs arbitrarias ni habilitan otros juegos',async({page})=>{
  for(const id of ['lp-factory','memorama-simplex','https%3A%2F%2Fevil.example']){await page.goto(`#/jugar-original/${id}?url=https://evil.example`);await expect(page.getByRole('heading',{name:'Este juego no está disponible en el piloto integrado'})).toBeVisible();await expect(page.locator('.original-player iframe')).toHaveCount(0);}
});
test('fallo de red conserva fallback externo seguro sin afirmar carga útil',async({page})=>{
  await page.route('https://israeltiburcio-ai.github.io/ahorcado-simplex/',r=>r.abort());await page.goto('#/jugar-original/ahorcado-simplex');
  await expect(page.getByRole('heading',{name:'¿No aparece o no responde?'})).toBeVisible();const link=page.getByRole('link',{name:'Abrir en otra pestaña',exact:false});await expect(link).toHaveAttribute('href','https://israeltiburcio-ai.github.io/ahorcado-simplex/');await expect(link).toHaveAttribute('rel','noopener noreferrer');await expect(link).toHaveAttribute('referrerpolicy','no-referrer');
});
test('cambiar de juego y salir desmonta la sesión y limpia la arena',async({page})=>{
  await page.goto('#/jugar-original/ahorcado-simplex');const before=await page.locator('.original-player iframe').elementHandle();
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.goto('#/jugar-original/ordena-simplex');await expect(page.getByRole('heading',{name:'Ordena el Simplex',exact:true})).toBeVisible();expect(await before!.evaluate(el=>el.isConnected)).toBe(false);await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');await expect(page.locator('[inert]')).toHaveCount(0);
});
