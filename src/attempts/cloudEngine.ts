import {AttemptConflict,attemptId,empty,mergeLedgers,validateLedger,type AttemptRepository,type AttemptTransport} from './cloudModel';
import type {Ledger} from './model';
export interface AttemptCloudView {status:'paused'|'connecting'|'offline'|'syncing'|'synced'|'error'|'conflict';error:string;pending:number;ready:boolean}
/** Separate append-only reported/declaration channel. Never writes verified results or adventure fields. */
export class AttemptCloudEngine {
 private active=false;private online=true;private accepted=false;private ready=false;private busy=false;private requested=false;
 private stop:(()=>void)|undefined;private remote:Ledger=empty();private listeners=new Set<()=>void>();
 private view:AttemptCloudView={status:'paused',error:'',pending:0,ready:false};
 constructor(private repository:AttemptRepository,private transport:AttemptTransport,private valid:()=>boolean){}
 private canSync(){return this.active&&this.accepted&&this.online&&this.ready&&this.valid();}
 getSnapshot=()=>this.view;
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 private publish(p:Partial<AttemptCloudView>){this.view={...this.view,...p,ready:this.ready};this.listeners.forEach(f=>f());}
 start(){this.active=true;}
 activate(){if(!this.active||!this.valid())return;this.accepted=true;this.connect();}
 pause(){this.accepted=false;this.ready=false;this.stop?.();this.stop=undefined;this.publish({status:'paused',error:''});}
 dispose(){this.active=false;this.stop?.();this.stop=undefined;this.listeners.clear();}
 setOnline(value:boolean){this.online=value;if(!value)this.publish({status:this.accepted?'offline':'paused'});else if(this.accepted){this.stop?.();this.stop=undefined;this.ready=false;this.connect();}}
 private connect(){
  if(!this.active||!this.accepted||!this.valid()||this.stop)return;
  if(!this.online){this.publish({status:'offline'});return;}
  this.publish({status:'connecting',error:''});
  try{this.stop=this.transport.watch(ledger=>{
   if(!this.active||!this.accepted||!this.valid())return;
   try{this.remote=validateLedger(ledger);this.ready=true;void this.flush();}catch(e){this.problem(e);}
  },e=>this.problem(e));}catch(e){this.problem(e);}
 }
 private problem(e:unknown){if(!this.active||!this.valid())return;this.stop?.();this.stop=undefined;if(!(e instanceof AttemptConflict))this.ready=false;this.publish({status:e instanceof AttemptConflict?'conflict':'error',error:e instanceof Error?e.message:'Error recuperable. La copia local se conserva.'});}
 changed(){if(this.active&&this.accepted)void this.flush();}
 retry(){if(!this.active||!this.accepted||!this.valid())return;this.publish({error:''});if(!this.stop)this.connect();else void this.flush();}
 private async flush(){
  this.requested=true;if(this.busy)return;this.busy=true;
  try{while(this.requested){this.requested=false;
   if(!this.canSync())return;
   const local=await this.repository.read();if(!this.canSync())return;
   try{mergeLedgers(local,this.remote);}catch(e){await this.repository.backup(local,'conflicto-local');await this.repository.backup(this.remote,'conflicto-remoto');throw e;}
   await this.repository.merge(this.remote);if(!this.canSync())return;
   const merged=await this.repository.read();if(!this.canSync())return;const remoteIds=new Set(this.remote.entries.map(attemptId));const pending=merged.entries.filter(e=>!remoteIds.has(attemptId(e)));
   this.publish({status:pending.length?'syncing':'synced',pending:pending.length,error:''});
   for(let i=0;i<pending.length;i++){
    if(!this.canSync())return;
    await this.transport.put(pending[i]);if(!this.canSync())return;
    this.remote=mergeLedgers(this.remote,{version:1,entries:[pending[i]]});this.publish({pending:pending.length-i-1});
   }
   this.publish({status:'synced',error:'',pending:0});
  }}catch(e){this.problem(e);}finally{this.busy=false;}
 }
 async keepRemote(){
  if(!this.active||!this.valid()||!this.ready)throw Error('Espera a que el remoto esté disponible.');
  await this.repository.backup(await this.repository.read(),'antes-de-elegir-remoto');
  if(!this.canSync())return;
  await this.repository.merge(this.remote,true);this.retry();
 }
}
