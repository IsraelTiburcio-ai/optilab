import type {Page} from '@playwright/test';

/** Navigation visits are legitimate and intentionally separate from game effects. */
export const visitedGyms=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')??'null')?.visited??[]);
export const protectedProgress=(page:Page)=>page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem('optilab-v1')??'null');
  if(!state)throw new Error('Guest progress is missing');
  const {practiced,results,gameResults,badges}=state;
  return {practiced,results,gameResults,badges};
});
export function observeFirebase(page:Page){
  const requests:string[]=[];
  page.context().on('request',r=>{if(/(?:firestore|identitytoolkit|securetoken)\.googleapis\.com/.test(r.url()))requests.push(`${r.method()} ${r.url().split('?')[0]}`);});
  return requests;
}
