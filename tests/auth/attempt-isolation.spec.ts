import {authEmulator} from './emulator';
import {test,expect,type Page} from '@playwright/test';
const endpoint=`${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-only-key`;
const password='Synthetic-Isolation-42!';
async function login(page:Page,email:string){await page.goto('#/cuenta');await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.locator('#account-password').fill(password);await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();await expect(page.locator('.account-email')).toHaveText(email);}
async function practice(page:Page,index:number){await page.goto('#/optidex');const button=page.locator('.cartridge').nth(index).locator('.practice-toggle');if(await button.getAttribute('aria-pressed')==='true')await button.click();await button.click();}
const consent=(page:Page)=>page.getByLabel('Guardar futuros intentos en este navegador');
test('real Auth Emulator A -> B -> guest -> A keeps history and consent isolated',async({page,request})=>{
 const suffix=crypto.randomUUID();const emailA=`a-${suffix}@example.test`,emailB=`b-${suffix}@example.test`;
 const make=async(email:string)=>{const r=await request.post(endpoint,{data:{email,password,returnSecureToken:true}});expect(r.ok()).toBe(true);return (await r.json()).localId as string;};const a=await make(emailA),b=await make(emailB);
 const cloud:string[]=[];page.on('request',r=>{if(r.url().includes('firestore.googleapis.com'))cloud.push(r.url());});
 await page.goto('#/cuenta');await consent(page).check();await practice(page,0);await page.goto('#/cuenta');await expect(page.locator('.attempt-history ol li')).toHaveCount(1);
 await login(page,emailA);await expect(consent(page)).not.toBeChecked();await expect(page.locator('.attempt-history ol li')).toHaveCount(0);await consent(page).check();await practice(page,1);await page.goto('#/cuenta');await expect(page.locator('.attempt-history ol li')).toHaveCount(1);await expect(page.locator('.attempt-history ol')).not.toContainText('OptiQuest1');await page.getByRole('button',{name:'Cerrar sesión'}).click();
 await login(page,emailB);await expect(consent(page)).not.toBeChecked();await expect(page.locator('.attempt-history ol li')).toHaveCount(0);await consent(page).check();await practice(page,2);await page.goto('#/cuenta');await expect(page.locator('.attempt-history ol li')).toHaveCount(1);await page.getByRole('button',{name:'Cerrar sesión'}).click();await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();await expect(consent(page)).toBeChecked();await expect(page.locator('.attempt-history ol li')).toHaveCount(1);await expect(page.locator('.attempt-history ol')).toContainText('OptiQuest1');
 await login(page,emailA);await expect(consent(page)).toBeChecked();await expect(page.locator('.attempt-history ol li')).toHaveCount(1);await page.reload();await expect(page.locator('.account-email')).toHaveText(emailA);await expect(page.locator('.attempt-history ol li')).toHaveCount(1);
 const counts=await page.evaluate(({a,b})=>['guest',a,b].map(uid=>JSON.parse(localStorage.getItem('optilab-attempts:v1:'+encodeURIComponent(uid))!).entries.length),{a,b});expect(counts).toEqual([1,1,1]);expect(cloud).toEqual([]);
});
