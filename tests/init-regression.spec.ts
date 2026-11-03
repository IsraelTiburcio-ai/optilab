import {test,expect} from '@playwright/test';
test.skip(process.env.MEMORAMA_PUBLIC!=='1','Public iframe requires explicit opt-in');
test('Memorama initializes after document load without target-origin error',async({page})=>{const errors:string[]=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('#/jugar/memorama-simplex');await expect(page.getByText(/Conectado · voltea/)).toBeVisible({timeout:25000});expect(errors.filter(e=>/Unable to post message|target origin/i.test(e))).toEqual([]);});
