import {test,expect,type Page} from '@playwright/test';
import {authHost,firestoreHost,firestorePort,syncBase} from '../../emulator-endpoints.mjs';

// Dedicated sequential rehearsal: this replaces the demo Rules, so never run it
// concurrently with ordinary UI tests. Both clients use real Auth/Firestore emulators.
test('single UID: real Memorama, two clients, canonical export, total pause and explicit recovery',async({browser})=>{
  test.skip(process.env.SINGLE_OPERATOR_UI_QA!=='1','Run only in the dedicated single-operator emulator rehearsal');
  test.setTimeout(120000);
  if(process.env.GCLOUD_PROJECT!=='demo-optilab-sync'||process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost||process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost||!process.env.MEMORAMA_DIR)throw Error('Exact local emulators and pinned Memorama fixture required');
  const [{initializeApp,deleteApp},{getFirestore,Timestamp},{getAuth},{initializeTestEnvironment,assertFails},firestore,{prepareSession},{preparePaused,operate,pauseTotal,inspectControl,requiredPermissions},{session,sources},{hash}]=await Promise.all([
    import('firebase-admin/app'),import('firebase-admin/firestore'),import('firebase-admin/auth'),import('@firebase/rules-unit-testing'),import('firebase/firestore'),
    import('../../../server/single-operator/preparation.mjs'),import('../../../server/single-operator/execution.mjs'),import('../../single-operator/fixture.mjs'),import('../../../server/pilot/plan.mjs')]);
  const uid='single-ui-'+crypto.randomUUID(),email=uid+'@example.test',password='Fictitious-ui-only-42!',now=Date.now();
  const manifest={...session(now),uid},bundle=prepareSession(manifest,sources);
  const approval={scope:'single-operator-test-execution-v1',approvedBy:manifest.operator,approvedAt:new Date(now-1000).toISOString(),frontendSha:manifest.frontendSha,windowDigest:bundle.plan.windowDigest,candidateRulesSha256:bundle.plan.rulesSha256,expectedActiveRulesSha256:manifest.expectedActiveRulesSha256,approvedServicesSha256:hash(['firestore.googleapis.com']),impactReviewed:true,singleOperatorRiskAccepted:true,allowRulesDeployment:true,allowSessionWrites:true,allowFrontendOn:true,allowFrontendOff:true,allowRecovery:true};
  const env=await initializeTestEnvironment({projectId:'demo-optilab-sync',firestore:{host:'127.0.0.1',port:firestorePort,rules:bundle.rules}});
  const admin=initializeApp({projectId:'demo-optilab-sync'},'single-ui-'+uid),db=getFirestore(admin),auth=getAuth(admin);
  const receipt=async()=>({version:1,project:manifest.project,observedAt:new Date().toISOString(),windowDigest:bundle.plan.windowDigest,candidateRulesSha256:bundle.plan.rulesSha256,
    platform:{rules:{status:'PASS',candidateDeployed:true,sourceSha256:bundle.plan.rulesSha256},billing:{status:'PASS',billingEnabled:false},services:{status:'PASS',enabled:['firestore.googleapis.com']}},
    usage:{source:'console',operator:manifest.operator,windowHours:24,storageBytes:1000,storageObservedAt:new Date().toISOString(),observedAt:new Date().toISOString(),evidenceSha256:'a'.repeat(64),counts:{reads:1,writes:1,deletes:0,documents:1,largestAccount:1}},permissions:{status:'PASS',granted:requiredPermissions},control:await inspectControl(db)});
  const ca=await browser.newContext({baseURL:syncBase,viewport:{width:1440,height:1000}}),cb=await browser.newContext({baseURL:syncBase,viewport:{width:390,height:844}});
  const progress=(p:Page)=>p.getByRole('region',{name:'Sincronización de progreso'}),attempts=(p:Page)=>p.getByRole('region',{name:'Sincronización de intentos'});
  const synced=(p:Page)=>expect(progress(p).getByRole('status')).toContainText('Sincronizado',{timeout:20000});
  async function login(p:Page){await p.goto('#/cuenta');await p.locator('#account-email').fill(email);await p.locator('#account-password').fill(password);await p.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();await progress(p).getByRole('button',{name:'Conservar progreso remoto',exact:true}).click();await synced(p);}
  async function exportAttempts(p:Page){await p.goto('#/cuenta');await expect(attempts(p).getByRole('status')).toContainText('synced',{timeout:20000});const waiting=p.waitForEvent('download');await attempts(p).getByRole('button',{name:'Exportar respaldo de intentos de esta cuenta'}).click();let raw='';for await(const chunk of (await (await waiting).createReadStream())!)raw+=chunk.toString();return JSON.parse(raw).ledger.entries.filter((e:any)=>e.kind==='reported'&&e.activityId==='memorama-simplex');}
  try{
    await env.clearFirestore();await auth.createUser({uid,email,password,emailVerified:true});
    await preparePaused(db,auth,Timestamp,manifest,sources,approval,await receipt());
    const client=env.authenticatedContext(uid,{email_verified:true}).firestore();await assertFails(firestore.getDoc(firestore.doc(client,`users/${uid}/sync/current`)));
    await operate(db,auth,Timestamp,'open',manifest,sources,approval,await receipt());
    for(const context of [ca,cb])await context.route(/https:\/\/[^/]*(firestore|identitytoolkit|securetoken)[^/]*googleapis\.com/,route=>route.abort());
    const a=await ca.newPage(),b=await cb.newPage();await login(a);await login(b);
    for(const p of [a,b]){
      await expect(p.getByLabel('Guardar futuros intentos en este navegador')).not.toBeChecked();
      await attempts(p).getByRole('button',{name:'Sincronizar historial de esta cuenta',exact:true}).click();
      await expect(attempts(p).getByRole('status')).toContainText('synced');
    }
    await a.route('https://israeltiburcio-ai.github.io/memorama-simplex/**',async route=>{const url=new URL(route.request().url());const response=await a.request.get('http://127.0.0.1:5190/'+url.pathname.replace('/memorama-simplex/','')+url.search);await route.fulfill({response});});
    await a.goto('#/jugar/memorama-simplex');await expect(a.locator('.player-status')).toContainText('Conectado');const frame=a.frameLocator('.player-frame-shell iframe');await frame.locator('#btn-play').click();
    const pairs=await frame.locator('#board').evaluate(board=>{const text=(html:string)=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent!.replace(/\s+/g,' ').trim();};const groups:Record<string,number[]>={};board.querySelectorAll('.card-text').forEach((el,i)=>{const content=el.textContent!.replace(/\s+/g,' ').trim(),pair=(window as any).MEMORAMA_DATA.pairs.find((p:any)=>text(p.a)===content||text(p.b)===content);if(!pair)throw Error('Unknown fixture pair');(groups[pair.id]??=[]).push(i);});return Object.values(groups);});
    expect(pairs).toHaveLength(8);for(const pair of pairs){await frame.locator('.card').nth(pair[0]).click();await frame.locator('.card').nth(pair[1]).click();}
    await expect(a.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toBeVisible();await synced(a);
    const first=await exportAttempts(a);expect(first).toHaveLength(1);expect(first[0].trust).toBe('client-report');expect(first[0].result.completed).toBe(true);
    await expect.poll(async()=>await exportAttempts(b),{timeout:20000}).toEqual(first);
    await b.reload();expect(await exportAttempts(b)).toEqual(first);
    const reports=await db.collection(`users/${uid}/reportedAttempts`).get();expect(reports.docs.filter(d=>d.data().kind==='reported'&&d.data().activityId==='memorama-simplex')).toHaveLength(1);
    await b.goto('#/aventura');await expect(b.locator('.game-history')).toContainText('1 finalizaciones guardadas');expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await pauseTotal(db,Timestamp);await assertFails(firestore.getDoc(firestore.doc(client,`users/${uid}/sync/current`)));
    await a.goto('#/aventura');await a.locator('#nickname').fill('Pendiente tras pausa');await a.locator('#nickname').press('Tab');
    await expect.poll(()=>a.evaluate(uid=>Object.keys(localStorage).filter(k=>k.startsWith(`optilab-sync:v2:${encodeURIComponent(uid)}:op:`)).length,uid)).toBeGreaterThan(0);
    await expect(progress(a).getByRole('status')).not.toContainText('Sincronizado');
    await expect(operate(db,auth,Timestamp,'renew',manifest,sources,approval,await receipt())).rejects.toThrow();
    await operate(db,auth,Timestamp,'recover',manifest,sources,approval,await receipt());
    // A permission-denied listener is terminal; recreate both clients. The journal stays local.
    await a.reload();await b.reload();
    await synced(a);await synced(b);await expect(b.locator('#nickname')).toHaveValue('Pendiente tras pausa');
    for(const p of [a,b]){await p.goto('#/cuenta');await attempts(p).getByRole('button',{name:'Reintentar intentos',exact:true}).click();}
    expect(await exportAttempts(a)).toEqual(first);expect(await exportAttempts(b)).toEqual(first);
    const after=await db.collection(`users/${uid}/reportedAttempts`).get();expect(after.docs.filter(d=>d.data().kind==='reported'&&d.data().activityId==='memorama-simplex')).toHaveLength(1);
  }finally{
    await pauseTotal(db,Timestamp).catch(()=>{});await ca.close();await cb.close();await auth.deleteUser(uid).catch(()=>{});await env.clearFirestore();await env.cleanup();await db.terminate();await deleteApp(admin);
  }
});
