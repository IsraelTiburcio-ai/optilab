import {createHash} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {Firestore,Transaction,Query} from 'firebase-admin/firestore';
import type {Data,Scope} from './contracts';
import {identifier} from './validation';
import {assertEmulatedDatabase} from './sdk';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const scopeKey=(s:Scope)=>hash(JSON.stringify([s.courseId,s.termId,s.groupId]));
export interface Metrics {documentReadAttempts:number;queryDocumentsReturned:number;writeIntents:number;committedWrites:number;transactionAttempts:number}
export const coursePath=(c:string)=>{if(!identifier(c))throw new Error('INVALID_REPOSITORY_PATH');return `courses/${c}`;};
export const termPath=(c:string,t:string)=>{if(!identifier(t))throw new Error('INVALID_REPOSITORY_PATH');return `${coursePath(c)}/terms/${t}`;};
export const groupPath=(s:Scope)=>{if(!identifier(s.groupId))throw new Error('INVALID_REPOSITORY_PATH');return `${termPath(s.courseId,s.termId)}/groups/${s.groupId}`;};
/** Deny even trusted-code mistakes targeting personal progress or arbitrary paths. */
export function academicPath(path:string):string {
  const id='[A-Za-z0-9_-]{1,128}',c='[A-Za-z0-9_-]{1,80}';
  const allowed=[`courses/${c}`,`courses/${c}/(?:staff|members|administration|academicMemberships)/${id}`,`courses/${c}/academicSettings/current`,
    `courses/${c}/terms/${c}`,`courses/${c}/terms/${c}/groups/${c}`,
    `courses/${c}/terms/${c}/groups/${c}/(?:staff|members|administration|membershipDetails|invitations|membershipRequests|roster|membershipEvents)/${id}`,
    `courses/${c}/terms/${c}/groups/${c}/settings/current`,`users/${id}/(?:enrollments|teachingScopes)/${id}`,`academicOperations/${id}`,`academicAudit/${id}`];
  if(!allowed.some(pattern=>new RegExp(`^${pattern}$`).test(path)))throw new Error('INVALID_REPOSITORY_PATH');return path;
}
export class AcademicTransaction {
  constructor(private db:Firestore,private tx:Transaction,private track:(key:keyof Metrics,n:number)=>void){}
  async get(path:string):Promise<Data|null>{this.track('documentReadAttempts',1);const s=await this.tx.get(this.db.doc(academicPath(path)));return s.exists?s.data()!:null;}
  set(path:string,data:Data){this.track('writeIntents',1);this.tx.set(this.db.doc(academicPath(path)),data);}
  async page(path:string,limit:number,cursor?:string,status?:string):Promise<{id:string;data:Data}[]> {
    const rows=await this.tx.get(pageQuery(this.db,path,limit,cursor,status));
    this.track('documentReadAttempts',rows.size||1);this.track('queryDocumentsReturned',rows.size);
    return rows.docs.map(d=>({id:d.id,data:d.data()}));
  }
}
export type AcademicReadView=Pick<AcademicTransaction,'get'|'page'>;
function pageQuery(db:Firestore,path:string,limit:number,cursor?:string,status?:string):Query {
  academicPath(path+'/probe');let q:Query=db.collection(path).orderBy('__name__').limit(limit);
  if(status)q=q.where('status','==',status);if(cursor)q=q.startAfter(cursor);return q;
}
export class AcademicRepository {
  private metrics=new AsyncLocalStorage<Metrics>();
  constructor(private db:Firestore){assertEmulatedDatabase(db);}
  private track=(key:keyof Metrics,n:number)=>{const m=this.metrics.getStore();if(m)m[key]+=n;};
  measure<T>(fn:()=>Promise<T>,done:(metrics:Metrics)=>void):Promise<T> {
    const m:Metrics={documentReadAttempts:0,queryDocumentsReturned:0,writeIntents:0,committedWrites:0,transactionAttempts:0};
    return this.metrics.run(m,async()=>{try{return await fn();}finally{done({...m});}});
  }
  async get(path:string):Promise<Data|null>{this.track('documentReadAttempts',1);const s=await this.db.doc(academicPath(path)).get();return s.exists?s.data()!:null;}
  async transaction<T>(fn:(tx:AcademicTransaction)=>Promise<T>):Promise<T> {
    let finalWrites=0;
    const result=await this.db.runTransaction(tx=>{finalWrites=0;this.track('transactionAttempts',1);
      return fn(new AcademicTransaction(this.db,tx,(key,n)=>{this.track(key,n);if(key==='writeIntents')finalWrites+=n;}));},{maxAttempts:3});
    this.track('committedWrites',finalWrites);return result;
  }
  async page(path:string,limit:number,cursor?:string,status?:string):Promise<{id:string;data:Data}[]> {
    // Validate a synthetic child; collection names are chosen by server, never a proxy input.
    const rows=await pageQuery(this.db,path,limit,cursor,status).get();this.track('documentReadAttempts',rows.size||1);this.track('queryDocumentsReturned',rows.size);return rows.docs.map(d=>({id:d.id,data:d.data()}));
  }
  async readTransaction<T>(fn:(view:AcademicReadView)=>Promise<T>):Promise<T> {
    return this.db.runTransaction(tx=>{this.track('transactionAttempts',1);return fn(new AcademicTransaction(this.db,tx,this.track));},{readOnly:true});
  }
}
