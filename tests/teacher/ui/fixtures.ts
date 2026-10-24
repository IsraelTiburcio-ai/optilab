import {test as base,expect,type Page,type BrowserContext,type Route} from '@playwright/test';
import {emulatorAdmin,type EmulatorAdmin} from '../../../server/academic/sdk';
import {seedFixtures,type Fixtures} from '../../../server/academic/bootstrap';
import {localConfig} from '../../../server/academic/config';
import {AcademicRepository} from '../../../server/academic/repository';
import {AcademicService} from '../../../server/academic/service';
import {httpServer} from '../../../server/academic/http';
import type {Server} from 'node:http';
export const password='fixture-password-123';
type Worker={sdk:EmulatorAdmin;server:Server;base:string};
export interface Fixture {f:Fixtures;tokens:Record<string,string>;scope:(group?:'a'|'b')=>{courseId:string;termId:string;groupId:string};
  call:(actor:string,op:string,input:unknown)=>Promise<{status:number;body:any}>;sdk:EmulatorAdmin;
  attach:(context:BrowserContext)=>Promise<void>;
  fault:{offline:boolean;legacy:boolean;lost:string;forbidden:string;rate:string;hold:string;waiting:Promise<void>;release:()=>void};commands:string[]}
export const test=base.extend<{fixture:Fixture},{backend:Worker}>({
  backend:[async({},use)=>{
    const config=localConfig(process.env),sdk=await emulatorAdmin();
    const server=httpServer({...config,rateLimit:10000},sdk,new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds));
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    try{await use({sdk,server,base:`http://127.0.0.1:${(server.address() as {port:number}).port}`});}
    finally{await new Promise<void>(r=>server.close(()=>r()));await sdk.close();}
  },{scope:'worker'}],
  fixture:async({backend,context},use)=>{
    const f=await seedFixtures(backend.sdk,password),tokens:Record<string,string>={};
    for(const [name,actor] of Object.entries(f.actors)){
      const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-emulator-only-key',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password,returnSecureToken:true})});
      if(!response.ok)throw new Error('SYNTHETIC_AUTH_FAILED');tokens[name]=(await response.json()).idToken;
    }
    const scope=(group:'a'|'b'='a')=>({courseId:f.courseId,termId:f.termId,groupId:f.groups[group]});
    const call=async(actor:string,op:string,input:unknown)=>{
      const response=await fetch(`${backend.base}/v1/${op}`,{method:'POST',headers:{Authorization:`Bearer ${tokens[actor]}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
      return {status:response.status,body:await response.json()};
    };
    const inv=(await call('teacherA','createInvitation',{...scope(),idempotencyKey:crypto.randomUUID(),expiresInSeconds:3600,maxUses:70,maxPending:70})).body;
    for(const actor of ['studentA','studentB','studentC']){
      const req=await call(actor,'requestMembership',{...scope(),inviteId:inv.inviteId,token:inv.token,idempotencyKey:crypto.randomUUID()});
      if(req.status!==200)throw new Error('SYNTHETIC_REQUEST_FAILED');
      if(actor==='studentA'){
        const approval=await call('teacherA','approveMembership',{...scope(),requestId:req.body.requestId,expectedVersion:1,idempotencyKey:crypto.randomUUID()});
        if(approval.status!==200)throw new Error('SYNTHETIC_APPROVAL_FAILED');
      }
    }
    let release=()=>{},waitingResolve=()=>{};
    const waiting=new Promise<void>(r=>waitingResolve=r),gate=new Promise<void>(r=>release=r);
    const fault={offline:false,legacy:false,lost:'',forbidden:'',rate:'',hold:'',waiting,release};const commands:string[]=[];
    // Real HTTP/Auth/Firestore service, on an ephemeral loopback port. This avoids
    // taking over the owner's :5200 process. Only the test transport URL differs.
    const routeAcademic=async(route:Route)=>{
      const request=route.request(),op=new URL(request.url()).pathname.split('/').at(-1)!;
      if(fault.offline){await route.abort();return;}
      if(fault.forbidden===op){fault.forbidden='';await route.fulfill({status:403,contentType:'application/json',body:'{"error":{"code":"FORBIDDEN"}}'});return;}
      if(fault.rate===op){fault.rate='';await route.fulfill({status:429,contentType:'application/json',body:'{"error":{"code":"RATE_LIMIT"}}'});return;}
      if(!['myScopes','roster','groupRequests','groupInvitations'].includes(op))commands.push(op);
      try{
        const response=await route.fetch({url:backend.base+new URL(request.url()).pathname,headers:{...request.headers(),host:new URL(backend.base).host}});
        if(fault.legacy&&op==='myScopes'){const body=await response.json();for(const row of body.items)delete row.capabilities;await route.fulfill({response,json:body});return;}
        if(fault.lost===op){fault.lost='';await route.abort();return;}
        if(fault.hold===op){fault.hold='';waitingResolve();await gate;}
        await route.fulfill({response});
      }catch{/* A session switch can cancel a held browser request. */}
    };
    const attach=async(target:BrowserContext)=>{await target.route('http://127.0.0.1:5200/**',routeAcademic);await target.route(/https:\/\/[^/]*(firestore|identitytoolkit|securetoken)[^/]*googleapis\.com/,r=>r.abort());};
    await attach(context);
    try{await use({f,tokens,scope,call,sdk:backend.sdk,fault,commands,attach});}finally{release();}
  },
});
export {expect};
export async function login(page:Page,fixture:Fixture,actor:keyof Fixtures['actors']='teacherA') {
  await page.goto('#/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(fixture.f.actors[actor].email);
  await page.locator('#account-password').fill(password);await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();
  await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await page.goto('#/docente');await expect(page.getByRole('heading',{name:'Panel de la profesora'})).toBeVisible();
}
export async function ready(page:Page) {await expect(page.getByLabel('Grupo',{exact:true})).toBeVisible();await expect(page.getByText('Comprobando tus grupos autorizados…')).toHaveCount(0);}
export async function tab(page:Page,name:string){await page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name,exact:true}).click();}
export async function confirm(page:Page){await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
